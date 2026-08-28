import asyncio
import logging
import socket
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware

from .timer_engine import TimerEngine
from .connection_manager import ConnectionManager
from .propresenter_client import ProPresenterClient
from .config import Settings, get_settings
from .models import TimerStateModel, StartRequest, AdjustRequest, SettingsModel, QueueModel, TemplateModel, SendStageMessageRequest, StageMessageModel, ServiceCountdownModel
from .storage import StateManager

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def get_local_ip():
    """Get the local IP address of the server."""
    try:
        # Connect to a public DNS server to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_next_segment_name() -> str | None:
    """Get the name of the next segment in queue, or None if no queue, at the end, or an
    ad-hoc/unplanned segment is currently playing (see unplanned_segment_active) - in that
    case there's no meaningful "next" to preview, since the operator has stepped outside the
    queue's normal progression. This feeds both the web "Up Next" display and the auto
    "Coming Next" stage message, so suppressing it here covers both at once.
    """
    if unplanned_segment_active:
        return None
    if not queue["names"] or queue["current_index"] >= len(queue["names"]) - 1:
        return None
    return queue["names"][queue["current_index"] + 1]


def get_display_stage_message() -> str:
    """Get the current stage message to display, handling expiry and fallback."""
    global stage_message

    # Check if custom message has expired
    if stage_message.get("expires_at") is not None:
        if time.time() > stage_message["expires_at"]:
            # Message expired, revert to auto message
            stage_message = {"text": "", "expires_at": None, "auto": True}
            app_state["stage_message"] = stage_message
            state_manager.save_state(app_state)

    # If there's an active, operator-authored custom message, return it. Auto-generated text
    # (auto=True) is NOT returned here even if non-empty - it's just whatever "Coming Next"
    # happened to be stored the last time the queue changed, and would otherwise permanently
    # block the countdown message below since nothing re-computes it on its own as time passes.
    if stage_message.get("text") and not stage_message.get("auto"):
        return stage_message["text"]

    # While the pre-service countdown is active and nothing's been started yet, prefer
    # "Service starts in X minutes" over the normal "Coming Next" queue preview.
    countdown_remaining = get_service_countdown_remaining()
    if countdown_remaining is not None and engine.state().status == "idle":
        return format_service_countdown_message(countdown_remaining)

    # Fall back to auto "Coming Next: {segment}" message
    return compute_auto_stage_message_text()


def compute_auto_stage_message_text() -> str:
    """Compute the auto "Coming Next: {segment}" text from the current queue position."""
    next_segment = get_next_segment_name()
    if next_segment:
        return f"Coming Next: {next_segment}"
    return ""


def format_service_countdown_message(remaining_seconds: int) -> str:
    """"Service starts in <MM:SS>" (or <H:MM:SS> past an hour) - the live ticking clock, in
    the same format as the app's own timer readout, not a rounded "X minutes" approximation."""
    hours, rem = divmod(max(remaining_seconds, 0), 3600)
    minutes, seconds = divmod(rem, 60)
    clock = f"{hours}:{minutes:02d}:{seconds:02d}" if hours > 0 else f"{minutes:02d}:{seconds:02d}"
    return f"Service starts in {clock}"


WEEKDAY_NUMBERS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def get_server_timezone() -> ZoneInfo:
    """The IANA zone the SERVER should treat as "local" for weekly recurrence, from the
    "timezone" app setting (Setup UI, persisted in state.json) - not server env/infra config,
    so there's no .env file or docker-compose variable to forget on a fresh deployment; it's
    right there in the same UI as everything else and survives a rebuild via the normal data
    volume. Defaults to UTC, same as every other never-configured setting in this app - an
    obviously-wrong display is preferable to silently guessing a specific venue.
    """
    tz_name = app_state["settings"].get("timezone", "UTC")
    try:
        return ZoneInfo(tz_name)
    except Exception:
        logger.warning(f"Unknown timezone setting '{tz_name}', falling back to UTC")
        return ZoneInfo("UTC")


def compute_next_weekly_occurrence(weekday: str | None, target_time: str | None) -> float | None:
    """Next unix-epoch occurrence of `weekday` ("sunday" etc) at `target_time` ("HH:MM"), in
    the server's configured timezone (see get_server_timezone). Unlike the one-time mode, this
    genuinely has to run unattended week after week with no browser present to compute it, so
    it's the one piece of this feature that depends on the server's TZ being configured right.
    """
    if weekday not in WEEKDAY_NUMBERS or not target_time:
        return None
    try:
        hour, minute = map(int, target_time.split(":"))
    except ValueError:
        return None

    now = datetime.now(get_server_timezone())
    days_ahead = (WEEKDAY_NUMBERS[weekday] - now.weekday()) % 7
    candidate = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=7)
    return candidate.timestamp()


# How far ahead of the target the countdown is allowed to actually show/push. Without this,
# "weekly" mode - which re-resolves to *next* week's occurrence the instant the current one
# elapses - would display/push a ~7-day countdown non-stop between services. Matches the
# original intent: a short pre-service window (e.g. the gap after Sunday school), not an
# always-on fixture.
SERVICE_COUNTDOWN_WINDOW_SECONDS = 4 * 3600


def get_service_countdown_state() -> dict:
    """Snapshot of the operator-configured service-start countdown, plus the resolved next
    occurrence as an absolute unix epoch ("resolved_target_timestamp") for clients to tick.

    In "once" mode, resolved_target_timestamp is just target_timestamp verbatim - an absolute
    moment the operator's own browser computed at save time, so no server timezone is involved
    and it ticks correctly on whatever device is driving the display. In "weekly" mode, it's
    computed fresh from weekday + target_time using the server's configured TZ each call, since
    recurrence has to run unattended with no browser present to (re)compute it week to week.

    Either way, resolved_target_timestamp comes back None (i.e. "nothing to show right now")
    until the target is within SERVICE_COUNTDOWN_WINDOW_SECONDS - see the comment above it.
    """
    recurrence = service_countdown.get("recurrence", "once")
    if recurrence == "weekly":
        resolved_target_timestamp = compute_next_weekly_occurrence(
            service_countdown.get("weekday"), service_countdown.get("target_time")
        )
    else:
        resolved_target_timestamp = service_countdown.get("target_timestamp")

    if resolved_target_timestamp is not None and resolved_target_timestamp - time.time() > SERVICE_COUNTDOWN_WINDOW_SECONDS:
        resolved_target_timestamp = None

    return {
        "enabled": service_countdown.get("enabled", False),
        "recurrence": recurrence,
        "target_time": service_countdown.get("target_time"),
        "target_timestamp": service_countdown.get("target_timestamp"),
        "weekday": service_countdown.get("weekday"),
        "resolved_target_timestamp": resolved_target_timestamp,
    }


def get_service_countdown_remaining() -> int | None:
    """Seconds until the configured service-start target, or None if not enabled/elapsed.

    Used only for the ProPresenter push below (stage screen + stage message), which - unlike
    the web Display page - has no browser clock to lean on since it's driven by this server's
    own background loop.
    """
    if not service_countdown.get("enabled"):
        return None
    target_timestamp = get_service_countdown_state()["resolved_target_timestamp"]
    if target_timestamp is None:
        return None
    remaining = int(target_timestamp - time.time())
    return remaining if remaining > 0 else None


async def push_stage_message_and_resync(text: str) -> None:
    """Send a stage message to ProPresenter, then immediately resync whichever timer is
    actually showing on stage right now.

    ProPresenter resets its timer as a side effect of receiving a stage message, so every
    push must be followed by a resync of the CORRECT target or it visibly clobbers the wrong
    one - e.g. sending a custom message while the pre-service countdown is up would otherwise
    reset the countdown's timer box to the idle segment engine's 0:00 instead of leaving it
    alone. Also updates last_pp_message so the ticking loop doesn't redundantly re-send the
    same text.
    """
    global last_pp_message
    await pp_client.send_stage_message(text)
    last_pp_message = text

    current = engine.state()
    countdown_remaining = get_service_countdown_remaining()
    if current.status == "idle" and countdown_remaining is not None:
        await pp_client.sync(
            name="Service Starts In",
            duration=countdown_remaining,
            remaining=countdown_remaining,
            status="running",
            allows_overrun=False,
        )
        return
    await pp_client.sync(
        name=current.name,
        duration=current.duration,
        remaining=current.remaining,
        status=current.status
    )


# Global state
engine = TimerEngine()
manager = ConnectionManager()
settings = get_settings()
pp_client = ProPresenterClient(settings)
state_manager = StateManager()

# Load persisted state (settings, segments, queue, templates, stage_message)
app_state = state_manager.load_state()
segments = app_state["segments"]
queue = app_state["queue"]
templates = app_state.get("templates", {})  # Handle old state files without templates key
stage_message = app_state.get("stage_message", {"text": "", "expires_at": None, "auto": False})  # Handle old state files
service_countdown = app_state.get("service_countdown", {"enabled": False, "target_time": None, "target_timestamp": None})  # Handle old state files

# Restore the timer itself (name/duration/status/remaining) from its last persisted snapshot,
# so a backend restart mid-service doesn't reset the Display page to a blank "Service 0:00"
# while the queue list still correctly shows a segment as current. Uses a wall-clock-anchored
# timestamp (see TimerEngine.restore), so a segment that was running keeps counting from where
# it truly is right now - including straight into overtime if enough real downtime passed -
# rather than freezing at its last-saved value.
if "timer" in app_state:
    engine.restore(app_state["timer"])

# Apply persisted ProPresenter settings
pp_client.update_settings(app_state["settings"])

# Background task references for shutdown
ticking_task: asyncio.Task | None = None
health_check_task: asyncio.Task | None = None
last_pp_message: str | None = None  # Track last stage message text sent to ProPresenter
unplanned_segment_active: bool = False  # True while an ad-hoc (Quick Start) segment is
# playing, outside the queue's normal progression - see get_next_segment_name


async def ticking_loop():
    """Background task: broadcast current state every ~1s and sync stage messages + timer to ProPresenter."""
    global last_pp_message
    tick_count = 0
    while True:
        try:
            # Check and revert expired stage messages, get current display message
            current_display_message = get_display_stage_message()

            state = engine.state()
            countdown_state = get_service_countdown_state()
            # Broadcast if timer is in a ticking state, or the service countdown is enabled.
            # The countdown itself ticks client-side (see get_service_countdown_state), but a
            # Display page that connects *after* the operator enabled it still needs to learn
            # {enabled, target_time} promptly rather than waiting on an unrelated broadcast.
            # Also broadcast at least every 10s regardless (tick_count % 10) purely to prune
            # dead connections: a WebSocket that silently dies (WiFi drop, tab closed, dev-proxy
            # hiccup) is only detected when a *write* to it fails, so with nothing else
            # triggering a broadcast during a fully idle session, a stale connection could
            # otherwise sit forever, inflating connected_clients indefinitely.
            if (
                state.status in ("running", "completed") or countdown_state["enabled"] or tick_count % 10 == 0
            ) and manager.active_connections:
                state_dict = state.to_dict()
                # Add queue info and COMPUTED display message (handles expiration) to broadcast
                state_dict["next_segment_name"] = get_next_segment_name()
                state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
                state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
                state_dict["queue_names"] = queue["names"]
                state_dict["stage_message"] = {
                    "text": current_display_message,
                    "expires_at": stage_message.get("expires_at")
                }
                state_dict["service_countdown"] = countdown_state
                state_dict["connected_clients"] = len(manager.active_connections)
                await manager.broadcast(state_dict)

            # Keep ProPresenter's stage message in sync with our computed display text
            # whenever it changes - regardless of timer status - and always follow with an
            # immediate resync of whichever timer is actually on stage right now (see
            # push_stage_message_and_resync), since ProPresenter resets its timer as a side
            # effect of any message push. Deliberately NOT gated on status=="running"/"paused":
            # a custom message's auto-expiry (or the countdown's live MM:SS clock, which
            # changes every second while active) has to reach the stage screen even while
            # fully idle with nothing else going on, or it just sits there stale.
            if current_display_message != last_pp_message:
                asyncio.create_task(push_stage_message_and_resync(current_display_message))

            # Periodic defensive resync to ProPresenter while running or in overtime (every 10
            # seconds). Prevents minor genuine clock drift, but not urgent now that sync() uses
            # absolute values.
            if state.status in ("running", "completed") and tick_count % 10 == 0:
                asyncio.create_task(pp_client.sync(
                    name=state.name,
                    duration=state.duration,
                    remaining=state.remaining,
                    status=state.status
                ))

            tick_count += 1
            await asyncio.sleep(1.0)
        except Exception as e:
            logger.error(f"Ticking loop error: {e}")
            await asyncio.sleep(1.0)


async def propresenter_health_check_loop():
    """Background task: check ProPresenter connectivity every ~5s."""
    while True:
        try:
            connected = await pp_client.health_check()
            if engine.propresenter_connected != connected:
                engine.set_propresenter_connected(connected)
                # Broadcast updated state
                if manager.active_connections:
                    state = engine.state()
                    await manager.broadcast(state.to_dict())
            await asyncio.sleep(5.0)
        except Exception as e:
            logger.error(f"ProPresenter health check error: {e}")
            await asyncio.sleep(5.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifespan."""
    global ticking_task, health_check_task

    # Startup
    logger.info("Starting background tasks...")
    ticking_task = asyncio.create_task(ticking_loop())
    health_check_task = asyncio.create_task(propresenter_health_check_loop())

    yield

    # Shutdown
    logger.info("Shutting down background tasks...")
    if ticking_task:
        ticking_task.cancel()
    if health_check_task:
        health_check_task.cancel()
    await pp_client.close()


# Create FastAPI app
app = FastAPI(title="Church Service Timer", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_full_state_dict() -> dict:
    """Assemble the complete state payload: timer + queue + stage message + service countdown
    + connected-client count. Shared by the REST snapshot endpoint, the one-off personal
    message a client gets the instant its WebSocket connects, and the periodic broadcast - so
    a freshly-connected (or reconnected) client is immediately fully in sync rather than
    waiting on the next tick, which for a fully idle session with no countdown enabled might
    never come at all.
    """
    state = engine.state()
    state_dict = state.to_dict()
    # COMPUTED display message (handles expiration and fallback to "Coming Next"), not the raw
    # stage_message state
    state_dict["stage_message"] = {
        "text": get_display_stage_message(),
        "expires_at": stage_message.get("expires_at")  # include expiry for UI countdown
    }
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
    state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
    state_dict["queue_names"] = queue["names"]
    state_dict["service_countdown"] = get_service_countdown_state()
    state_dict["connected_clients"] = len(manager.active_connections)
    return state_dict


def persist_timer_state() -> None:
    """Save the engine's current state to disk, wall-clock-anchored (see
    TimerEngine.get_persistable_state), so it can be correctly restored on the next startup.
    Called after every action that actually changes the timer (start/pause/reset/add/subtract,
    plus the queue actions that start/reset it) - never from the per-second ticking loop, since
    a wall-clock-anchored snapshot stays exactly accurate for as long as nothing changes, with
    no need to re-save it while a segment just sits there counting down on its own.
    """
    app_state["timer"] = engine.get_persistable_state()
    state_manager.save_state(app_state)


@app.get("/api/timer/state")
async def get_timer_state():
    """Get current timer state with additional metadata."""
    return build_full_state_dict()


@app.post("/api/timer/start")
async def start_timer(request: StartRequest) -> TimerStateModel:
    """Start timer with optional name/duration."""
    if request.unplanned:
        global unplanned_segment_active
        unplanned_segment_active = True
    state = engine.start(name=request.name, duration=request.duration)
    persist_timer_state()
    await manager.broadcast(state.to_dict())
    # Sync to ProPresenter asynchronously using absolute values
    asyncio.create_task(pp_client.sync(
        name=state.name,
        duration=state.duration,
        remaining=state.remaining,
        status=state.status
    ))
    return state


@app.post("/api/timer/pause")
async def pause_timer() -> TimerStateModel:
    """Pause the timer."""
    state = engine.pause()
    persist_timer_state()
    await manager.broadcast(state.to_dict())
    # Sync to ProPresenter asynchronously using absolute values (ensures exact frozen value)
    asyncio.create_task(pp_client.sync(
        name=state.name,
        duration=state.duration,
        remaining=state.remaining,
        status=state.status
    ))
    return state


@app.post("/api/timer/reset")
async def reset_timer() -> TimerStateModel:
    """Reset timer to initial duration."""
    state = engine.reset()
    persist_timer_state()
    await manager.broadcast(state.to_dict())
    # Sync to ProPresenter asynchronously using absolute values
    asyncio.create_task(pp_client.sync(
        name=state.name,
        duration=state.duration,
        remaining=state.remaining,
        status=state.status
    ))
    return state


@app.post("/api/timer/add")
async def add_time(request: AdjustRequest) -> TimerStateModel:
    """Add time to the timer."""
    state = engine.add(request.seconds)
    persist_timer_state()
    await manager.broadcast(state.to_dict())
    # Sync to ProPresenter asynchronously using absolute values (not relative adjustments)
    asyncio.create_task(pp_client.sync(
        name=state.name,
        duration=state.duration,
        remaining=state.remaining,
        status=state.status
    ))
    return state


@app.post("/api/timer/subtract")
async def subtract_time(request: AdjustRequest) -> TimerStateModel:
    """Subtract time from the timer."""
    state = engine.subtract(request.seconds)
    persist_timer_state()
    await manager.broadcast(state.to_dict())
    # Sync to ProPresenter asynchronously using absolute values (not relative adjustments)
    asyncio.create_task(pp_client.sync(
        name=state.name,
        duration=state.duration,
        remaining=state.remaining,
        status=state.status
    ))
    return state


@app.get("/api/segments")
async def get_segments():
    """Get all available service segments."""
    return {
        "segments": [
            {"name": name, "duration": duration}
            for name, duration in sorted(segments.items())
        ]
    }


@app.post("/api/segments")
async def add_segment(name: str, duration: int):
    """Add a new service segment."""
    if not name or duration < 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid segment data")
    segments[name] = duration
    # Persist to disk
    app_state["segments"] = segments
    state_manager.save_state(app_state)
    return {"success": True, "segment": {"name": name, "duration": duration}}


@app.put("/api/segments/{segment_name}")
async def update_segment(segment_name: str, new_name: str | None = None, duration: int | None = None):
    """Update (rename and/or change duration) of a segment."""
    if segment_name not in segments:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Segment not found")

    if new_name and new_name != segment_name:
        # Rename: create new entry and delete old one
        segments[new_name] = duration if duration is not None else segments[segment_name]
        del segments[segment_name]
        # Update queue if this segment is in it
        if segment_name in queue["names"]:
            queue["names"] = [new_name if n == segment_name else n for n in queue["names"]]
    elif duration is not None:
        # Just update duration
        segments[segment_name] = duration

    # Persist to disk
    app_state["segments"] = segments
    app_state["queue"] = queue
    state_manager.save_state(app_state)

    final_name = new_name if new_name else segment_name
    return {"success": True, "segment": {"name": final_name, "duration": segments[final_name]}}


@app.delete("/api/segments/{segment_name}")
async def delete_segment(segment_name: str):
    """Delete a service segment."""
    if segment_name in segments:
        del segments[segment_name]
        # Remove from queue if present
        if segment_name in queue["names"]:
            queue["names"] = [n for n in queue["names"] if n != segment_name]
            # Adjust current_index if needed
            if queue["current_index"] >= len(queue["names"]):
                queue["current_index"] = -1
        # Persist to disk
        app_state["segments"] = segments
        app_state["queue"] = queue
        state_manager.save_state(app_state)
        return {"success": True}
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Segment not found")


@app.get("/api/settings")
async def get_settings_endpoint() -> SettingsModel:
    """Get current application settings."""
    return SettingsModel(**app_state["settings"])


@app.put("/api/settings")
async def update_settings_endpoint(settings: SettingsModel) -> SettingsModel:
    """Update application settings and persist to disk."""
    from fastapi import HTTPException

    try:
        ZoneInfo(settings.timezone)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {settings.timezone!r}")

    new_settings = settings.dict()
    app_state["settings"] = new_settings
    state_manager.save_state(app_state)

    # Update ProPresenterClient with new settings
    pp_client.update_settings(new_settings)

    return settings


@app.get("/api/service-countdown")
async def get_service_countdown_endpoint() -> ServiceCountdownModel:
    """Get the configured service-start countdown (target time + enabled toggle)."""
    return ServiceCountdownModel(**service_countdown)


@app.put("/api/service-countdown")
async def update_service_countdown_endpoint(payload: ServiceCountdownModel) -> ServiceCountdownModel:
    """Update the service-start countdown target time / enabled toggle and persist it."""
    from fastapi import HTTPException

    if payload.target_time is not None:
        try:
            hour, minute = map(int, payload.target_time.split(":"))
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError
        except ValueError:
            raise HTTPException(status_code=400, detail="target_time must be in HH:MM 24-hour format")

    if payload.enabled and payload.recurrence == "weekly" and (payload.weekday is None or payload.target_time is None):
        raise HTTPException(status_code=400, detail="weekday and target_time are required for weekly recurrence")

    global service_countdown
    service_countdown = payload.dict()
    app_state["service_countdown"] = service_countdown
    state_manager.save_state(app_state)

    if manager.active_connections:
        state = engine.state()
        state_dict = state.to_dict()
        state_dict["service_countdown"] = get_service_countdown_state()
        await manager.broadcast(state_dict)

    return payload


@app.get("/api/queue")
async def get_queue() -> QueueModel:
    """Get the current service run-of-show queue."""
    return QueueModel(**queue)


@app.put("/api/queue")
async def update_queue(queue_model: QueueModel) -> QueueModel:
    """Replace the entire queue (body: {names: [...]}). Used for adding, removing, and
    drag-reordering segments, including while a service is actively running.

    The submitted current_index is ignored; the server preserves the currently-playing
    segment's position automatically. Segments that have already played (index <=
    current_index) must remain in place at the front of the list unchanged - reordering
    or removing them is rejected with 409, since the server has no way to "un-play" a
    segment that's already aired. When the queue is idle (current_index == -1), any order
    is accepted.
    """
    from fastapi import HTTPException

    global stage_message

    new_names = queue_model.names

    # Validate that all segment names exist
    for name in new_names:
        if name not in segments:
            raise HTTPException(status_code=400, detail=f"Segment '{name}' does not exist")

    # Prevent duplicate segments in queue
    if len(new_names) != len(set(new_names)):
        raise HTTPException(status_code=400, detail="Queue contains duplicate segments")

    old_names = queue["names"]
    old_index = queue["current_index"]

    if old_index >= 0:
        played = old_names[:old_index + 1]
        if new_names[:len(played)] != played:
            raise HTTPException(
                status_code=409,
                detail="Cannot reorder or remove segments that have already played during an active service",
            )
        new_index = old_index  # unchanged: the played prefix is identical
    else:
        new_index = -1

    queue["names"] = new_names
    queue["current_index"] = new_index
    app_state["queue"] = queue

    # Recompute the auto "Coming Next" message and push it to ProPresenter, unless an
    # operator's own custom (non-auto) message is currently showing on stage.
    auto_text = compute_auto_stage_message_text()
    should_push = not stage_message.get("text") or stage_message.get("auto", False)
    if should_push and auto_text != stage_message.get("text"):
        stage_message = {"text": auto_text, "expires_at": None, "auto": True}
        app_state["stage_message"] = stage_message
        asyncio.create_task(push_stage_message_and_resync(auto_text))

    state_manager.save_state(app_state)

    # Broadcast the updated queue/next-segment info so the display page and any other
    # connected controllers reflect the reorder immediately.
    state = engine.state()
    state_dict = state.to_dict()
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
    state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
    state_dict["queue_names"] = queue["names"]
    state_dict["stage_message"] = {
        "text": get_display_stage_message(),
        "expires_at": stage_message.get("expires_at"),
    }
    await manager.broadcast(state_dict)

    return QueueModel(**queue)


@app.post("/api/queue/next")
async def advance_queue() -> TimerStateModel:
    """Advance to next segment in queue, start it, and return updated state."""
    from fastapi import HTTPException

    if not queue["names"]:
        raise HTTPException(status_code=409, detail="Queue is empty")

    next_index = queue["current_index"] + 1
    if next_index >= len(queue["names"]):
        raise HTTPException(status_code=409, detail="Queue complete - no more segments")

    global unplanned_segment_active
    unplanned_segment_active = False
    queue["current_index"] = next_index
    segment_name = queue["names"][next_index]
    segment_duration = segments[segment_name]

    # Start the timer with this segment
    state = engine.start(name=segment_name, duration=segment_duration)

    # Persist queue and timer state
    app_state["queue"] = queue
    state_manager.save_state(app_state)
    persist_timer_state()

    # Broadcast to all clients
    state_dict = state.to_dict()
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1
    state_dict["queue_length"] = len(queue["names"])
    state_dict["queue_names"] = queue["names"]
    await manager.broadcast(state_dict)

    # Update stage message to show next segment, or blank the display once the queue is done
    # (never show a literal "Service Complete" message on stage)
    stage_message_text = compute_auto_stage_message_text()

    # Update stage message state (persist, no expiry)
    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None, "auto": True}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    asyncio.create_task(push_stage_message_and_resync(stage_message_text))

    return state


@app.post("/api/queue/reset")
async def reset_queue() -> dict:
    """Reset queue to beginning (current_index = -1) for replay."""
    global queue, unplanned_segment_active
    queue["current_index"] = -1
    unplanned_segment_active = False
    app_state["queue"] = queue

    # Reset timer to idle state with 0 duration
    engine.name = ""
    engine.duration = 0
    timer_state = engine.reset()
    persist_timer_state()

    # Sync idle timer state to ProPresenter
    asyncio.create_task(pp_client.sync(
        name="",
        duration=0,
        remaining=0,
        status="idle"
    ))

    # Reset stage message to show first segment
    stage_message_text = compute_auto_stage_message_text()

    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None, "auto": True}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    asyncio.create_task(push_stage_message_and_resync(stage_message_text))

    await manager.broadcast(timer_state.to_dict())

    return {"success": True, "message": "Queue reset to beginning"}


@app.post("/api/queue/start-at/{index}")
async def start_at_queue_index(index: int) -> dict:
    """Start service from a specific segment in the queue."""
    global queue, unplanned_segment_active

    # Validate index
    if index < 0 or index >= len(queue["names"]):
        return {"success": False, "error": f"Invalid queue index: {index}"}

    segment_name = queue["names"][index]

    # The clicked segment is now the current/playing one (matches advance_queue's
    # convention: current_index always points at the currently-playing segment).
    queue["current_index"] = index
    unplanned_segment_active = False
    app_state["queue"] = queue

    # Find segment duration (stored in seconds)
    if segment_name not in segments:
        return {"success": False, "error": f"Segment not found: {segment_name}"}

    duration_seconds = segments[segment_name]

    # Actually start the countdown (not just load it idle) - this is "start at",
    # matching what advance_queue's "Next Segment" does.
    timer_state = engine.start(name=segment_name, duration=duration_seconds)
    persist_timer_state()

    # Update stage message to show next segment (if there is one)
    stage_message_text = compute_auto_stage_message_text()

    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None, "auto": True}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    asyncio.create_task(push_stage_message_and_resync(stage_message_text))

    # Broadcast updated state, including queue info so the display page and other
    # connected controllers reflect the jump immediately.
    state_dict = timer_state.to_dict()
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
    state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
    state_dict["queue_names"] = queue["names"]
    await manager.broadcast(state_dict)

    return {"success": True, "message": f"Starting from segment {index + 1}: {segment_name}"}


@app.post("/api/queue/load-template/{template_name}")
async def load_template_to_queue(template_name: str) -> dict:
    """Load a template's segments into the queue and reset timer to idle state."""
    global queue, unplanned_segment_active

    if template_name not in templates:
        return {"success": False, "error": f"Template not found: {template_name}"}

    template = templates[template_name]
    segment_names = template.get("segment_names", [])

    if not segment_names:
        return {"success": False, "error": "Template has no segments"}

    # Check if this template is already loaded
    already_loaded = queue["names"] == segment_names

    # Load segments into queue
    queue["names"] = segment_names.copy()
    queue["current_index"] = -1  # Reset to beginning
    unplanned_segment_active = False
    app_state["queue"] = queue
    state_manager.save_state(app_state)

    # Reset timer to idle state when loading a new template
    engine.name = ""
    engine.duration = 0
    timer_state = engine.reset()
    persist_timer_state()

    # Sync idle timer to ProPresenter
    asyncio.create_task(pp_client.sync(
        name=timer_state.name,
        duration=timer_state.duration,
        remaining=timer_state.remaining,
        status=timer_state.status
    ))

    # Broadcast both queue and timer updates
    await manager.broadcast(timer_state.to_dict())

    return {
        "success": True,
        "message": "Template already loaded - no changes made" if already_loaded else f"Loaded template: {template_name}",
        "already_loaded": already_loaded,
        "queue": queue
    }


@app.get("/api/templates")
async def list_templates():
    """List all saved templates."""
    template_list = [
        {
            "name": name,
            "description": data.get("description", ""),
            "segment_names": data.get("segment_names", [])
        }
        for name, data in templates.items()
    ]
    return {"templates": template_list}


@app.post("/api/templates")
async def save_template(name: str, description: str = ""):
    """Save current queue as a template."""
    from fastapi import HTTPException

    if not name.strip():
        raise HTTPException(status_code=400, detail="Template name is required")

    # Prevent empty templates
    if not queue["names"]:
        raise HTTPException(status_code=400, detail="Cannot save empty queue as template")

    templates[name] = {
        "description": description,
        "segment_names": queue["names"].copy()
    }

    # Persist to disk
    app_state["templates"] = templates
    state_manager.save_state(app_state)

    return {
        "success": True,
        "template": {
            "name": name,
            "description": description,
            "segment_names": queue["names"]
        }
    }


@app.get("/api/templates/{template_name}")
async def get_template(template_name: str):
    """Get a single template by name."""
    from fastapi import HTTPException

    if template_name not in templates:
        raise HTTPException(status_code=404, detail="Template not found")

    data = templates[template_name]
    return {
        "name": template_name,
        "description": data.get("description", ""),
        "segment_names": data.get("segment_names", [])
    }


@app.post("/api/templates/{template_name}/load")
async def load_template(template_name: str):
    """Load a template (replaces current queue)."""
    from fastapi import HTTPException

    if template_name not in templates:
        raise HTTPException(status_code=404, detail="Template not found")

    data = templates[template_name]
    segment_names = data.get("segment_names", [])

    # Validate that all segment names in the template exist
    for name in segment_names:
        if name not in segments:
            raise HTTPException(status_code=400, detail=f"Segment '{name}' in template no longer exists")

    # Replace queue with template
    queue["names"] = segment_names.copy()
    queue["current_index"] = -1

    # Persist to disk
    app_state["queue"] = queue
    state_manager.save_state(app_state)

    return {
        "success": True,
        "queue": {
            "names": queue["names"],
            "current_index": queue["current_index"]
        }
    }


@app.delete("/api/templates/{template_name}")
async def delete_template(template_name: str):
    """Delete a template."""
    from fastapi import HTTPException

    if template_name not in templates:
        raise HTTPException(status_code=404, detail="Template not found")

    del templates[template_name]

    # Persist to disk
    app_state["templates"] = templates
    state_manager.save_state(app_state)

    return {"success": True}


@app.get("/api/server-info")
async def get_server_info(request: Request):
    """Get server connection info (IP/hostname, port, connected clients)."""
    # Try to get the client's real IP from X-Forwarded-For (set by nginx)
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs; take the first (client IP)
        host = forwarded_for.split(",")[0].strip()
    else:
        # Fallback to Host header
        host = request.headers.get("host", "").split(":")[0]

    # If still empty or localhost, fall back to detecting the IP
    if not host or host == "localhost" or host.startswith("10."):
        host = get_local_ip()

    return {
        "ip": host,
        "port": 80,
        "connected_clients": len(manager.active_connections),
    }


@app.post("/api/stage-message")
async def send_stage_message(request: SendStageMessageRequest) -> StageMessageModel:
    """Send a stage message with optional auto-expire duration, syncing timer state afterward."""
    global stage_message

    # Calculate expiration time if duration is specified
    expires_at = None
    if request.duration is not None:
        expires_at = time.time() + request.duration

    # Update stage message (operator-authored, not auto-computed)
    stage_message = {"text": request.text, "expires_at": expires_at, "auto": False}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Fire the send-and-resync as a single sequential task to avoid race conditions
    # with ProPresenter's undocumented side effects (e.g., stage message reception resetting its timer)
    asyncio.create_task(push_stage_message_and_resync(request.text))

    return StageMessageModel(text=request.text, expires_at=expires_at, auto=False)


@app.delete("/api/stage-message")
async def clear_stage_message() -> dict:
    """Clear the current stage message and resync timer state."""
    global stage_message

    stage_message = {"text": "", "expires_at": None, "auto": True}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Clear on ProPresenter and resync timer state sequentially
    asyncio.create_task(push_stage_message_and_resync(""))

    return {"success": True}


@app.websocket("/ws/timer")
async def websocket_timer(websocket: WebSocket):
    """WebSocket connection for real-time timer state broadcasts."""
    await manager.connect(websocket)
    # Send the full current state immediately upon connection - not just the timer/queue
    # basics, but stage_message and service_countdown too, so a freshly-opened Display page
    # doesn't sit blank waiting for a periodic broadcast that might not come for a while.
    await manager.send_personal(websocket, build_full_state_dict())

    try:
        # Keep connection open, discard any incoming messages (control is REST-only)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        # Let remaining clients know the connected-client count just changed, so it doesn't
        # sit stale until some unrelated broadcast happens to fire.
        if manager.active_connections:
            await manager.broadcast(build_full_state_dict())


# Note: Frontend is served by nginx (in Docker) or Vite dev server (local dev)
# Backend only serves API routes and WebSocket


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

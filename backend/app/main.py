import asyncio
import logging
import socket
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware

from .timer_engine import TimerEngine
from .connection_manager import ConnectionManager
from .propresenter_client import ProPresenterClient
from .config import Settings, get_settings
from .models import TimerStateModel, StartRequest, AdjustRequest, SettingsModel, QueueModel, TemplateModel, SendStageMessageRequest, StageMessageModel
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
    """Get the name of the next segment in queue, or None if no queue or at end."""
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
            stage_message = {"text": "", "expires_at": None}
            app_state["stage_message"] = stage_message
            state_manager.save_state(app_state)

    # If there's an active custom message, return it
    if stage_message.get("text"):
        return stage_message["text"]

    # Fall back to auto "Coming Next: {segment}" message
    next_segment = get_next_segment_name()
    if next_segment:
        return f"Coming Next: {next_segment}"

    return ""


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
stage_message = app_state.get("stage_message", {"text": "", "expires_at": None})  # Handle old state files

# Apply persisted ProPresenter settings
pp_client.update_settings(app_state["settings"])

# Background task references for shutdown
ticking_task: asyncio.Task | None = None
health_check_task: asyncio.Task | None = None


async def ticking_loop():
    """Background task: broadcast current state every ~1s and sync stage messages + timer to ProPresenter."""
    tick_count = 0
    last_pp_message = None  # Track last message sent to ProPresenter
    while True:
        try:
            # Check and revert expired stage messages, get current display message
            current_display_message = get_display_stage_message()

            state = engine.state()
            # Only broadcast if timer is in a ticking state and clients are connected
            if state.status in ("running", "completed") and manager.active_connections:
                state_dict = state.to_dict()
                # Add queue info and COMPUTED display message (handles expiration) to broadcast
                state_dict["next_segment_name"] = get_next_segment_name()
                state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
                state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
                state_dict["stage_message"] = {
                    "text": current_display_message,
                    "expires_at": stage_message.get("expires_at")
                }
                await manager.broadcast(state_dict)

            # Sync stage message to ProPresenter if it changed (e.g., expired custom message reverted to "Coming Next")
            # Do this every tick while timer is active to catch message expirations immediately
            if state.status in ("running", "paused") and current_display_message != last_pp_message:
                asyncio.create_task(pp_client.send_stage_message(current_display_message))
                last_pp_message = current_display_message

            # Periodic defensive resync to ProPresenter while running only (every 10 seconds)
            # Prevents minor genuine clock drift, but not urgent now that sync() uses absolute values
            if state.status == "running" and tick_count % 10 == 0:
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


@app.get("/api/timer/state")
async def get_timer_state():
    """Get current timer state with additional metadata."""
    state = engine.state()
    state_dict = state.to_dict()
    # Add the COMPUTED display message (handles expiration and fallback to "Coming Next")
    # not the raw stage_message state
    display_message_text = get_display_stage_message()
    state_dict["stage_message"] = {
        "text": display_message_text,
        "expires_at": stage_message.get("expires_at")  # include expiry for UI countdown
    }
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
    state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
    return state_dict


@app.post("/api/timer/start")
async def start_timer(request: StartRequest) -> TimerStateModel:
    """Start timer with optional name/duration."""
    state = engine.start(name=request.name, duration=request.duration)
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
    new_settings = settings.dict()
    app_state["settings"] = new_settings
    state_manager.save_state(app_state)

    # Update ProPresenterClient with new settings
    pp_client.update_settings(new_settings)

    return settings


@app.get("/api/queue")
async def get_queue() -> QueueModel:
    """Get the current service run-of-show queue."""
    return QueueModel(**queue)


@app.put("/api/queue")
async def update_queue(queue_model: QueueModel) -> QueueModel:
    """Replace the entire queue (body: {names: [...]}, resets current_index to -1)."""
    from fastapi import HTTPException

    # Validate that all segment names exist
    for name in queue_model.names:
        if name not in segments:
            raise HTTPException(status_code=400, detail=f"Segment '{name}' does not exist")

    # Prevent duplicate segments in queue
    if len(queue_model.names) != len(set(queue_model.names)):
        raise HTTPException(status_code=400, detail="Queue contains duplicate segments")

    queue["names"] = queue_model.names
    queue["current_index"] = -1
    app_state["queue"] = queue
    state_manager.save_state(app_state)

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

    queue["current_index"] = next_index
    segment_name = queue["names"][next_index]
    segment_duration = segments[segment_name]

    # Start the timer with this segment
    state = engine.start(name=segment_name, duration=segment_duration)

    # Persist queue state
    app_state["queue"] = queue
    state_manager.save_state(app_state)

    # Broadcast to all clients
    state_dict = state.to_dict()
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1
    state_dict["queue_length"] = len(queue["names"])
    await manager.broadcast(state_dict)

    # Update stage message to show next segment (if there is one)
    next_segment = get_next_segment_name()
    if next_segment:
        stage_message_text = f"Coming Next: {next_segment}"
    else:
        stage_message_text = "Service Complete"

    # Update stage message state (persist, no expiry)
    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    async def _send_and_sync():
        await pp_client.send_stage_message(stage_message_text)
        await pp_client.sync(
            name=state.name,
            duration=state.duration,
            remaining=state.remaining,
            status=state.status
        )
    asyncio.create_task(_send_and_sync())

    return state


@app.post("/api/queue/reset")
async def reset_queue() -> dict:
    """Reset queue to beginning (current_index = -1) for replay."""
    global queue
    queue["current_index"] = -1
    app_state["queue"] = queue

    # Reset timer to idle state with 0 duration
    engine.name = ""
    engine.duration = 0
    timer_state = engine.reset()
    app_state["timer"] = timer_state.to_dict()
    state_manager.save_state(app_state)

    # Sync idle timer state to ProPresenter
    asyncio.create_task(pp_client.sync(
        name="",
        duration=0,
        remaining=0,
        status="idle"
    ))

    # Reset stage message to show first segment
    next_segment = get_next_segment_name()
    if next_segment:
        stage_message_text = f"Coming Next: {next_segment}"
    else:
        stage_message_text = ""

    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    async def _send_and_sync():
        await pp_client.send_stage_message(stage_message_text)
        await pp_client.sync(
            name=timer_state.name,
            duration=timer_state.duration,
            remaining=timer_state.remaining,
            status=timer_state.status
        )
    asyncio.create_task(_send_and_sync())

    await manager.broadcast(timer_state.to_dict())

    return {"success": True, "message": "Queue reset to beginning"}


@app.post("/api/queue/start-at/{index}")
async def start_at_queue_index(index: int) -> dict:
    """Start service from a specific segment in the queue."""
    global queue

    # Validate index
    if index < 0 or index >= len(queue["names"]):
        return {"success": False, "error": f"Invalid queue index: {index}"}

    segment_name = queue["names"][index]

    # Set queue position
    queue["current_index"] = index - 1  # -1 so next segment is at 'index'
    app_state["queue"] = queue

    # Find segment duration (stored in seconds)
    if segment_name not in segments:
        return {"success": False, "error": f"Segment not found: {segment_name}"}

    duration_seconds = segments[segment_name]

    # Initialize timer for this segment
    engine.name = segment_name
    engine.duration = duration_seconds
    timer_state = engine.reset()
    app_state["timer"] = timer_state.to_dict()
    state_manager.save_state(app_state)

    # Update stage message to show next segment (if there is one)
    next_segment = get_next_segment_name()
    if next_segment:
        stage_message_text = f"Coming Next: {next_segment}"
    else:
        stage_message_text = ""

    global stage_message
    stage_message = {"text": stage_message_text, "expires_at": None}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Send stage message and sync timer state sequentially to ProPresenter
    async def _send_and_sync():
        await pp_client.send_stage_message(stage_message_text)
        await pp_client.sync(
            name=timer_state.name,
            duration=timer_state.duration,
            remaining=timer_state.remaining,
            status=timer_state.status
        )
    asyncio.create_task(_send_and_sync())

    # Broadcast updated state
    await manager.broadcast(timer_state.to_dict())

    return {"success": True, "message": f"Starting from segment {index + 1}: {segment_name}"}


@app.post("/api/queue/load-template/{template_name}")
async def load_template_to_queue(template_name: str) -> dict:
    """Load a template's segments into the queue and reset timer to idle state."""
    global queue

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
    app_state["queue"] = queue
    state_manager.save_state(app_state)

    # Reset timer to idle state when loading a new template
    engine.name = ""
    engine.duration = 0
    timer_state = engine.reset()
    app_state["timer"] = timer_state.to_dict()
    state_manager.save_state(app_state)

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

    # Update stage message
    stage_message = {"text": request.text, "expires_at": expires_at}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Fire the send-and-resync as a single sequential task to avoid race conditions
    # with ProPresenter's undocumented side effects (e.g., stage message reception resetting its timer)
    async def _send_and_resync():
        await pp_client.send_stage_message(request.text)
        current = engine.state()
        await pp_client.sync(
            name=current.name,
            duration=current.duration,
            remaining=current.remaining,
            status=current.status
        )
    asyncio.create_task(_send_and_resync())

    return StageMessageModel(text=request.text, expires_at=expires_at)


@app.delete("/api/stage-message")
async def clear_stage_message() -> dict:
    """Clear the current stage message and resync timer state."""
    global stage_message

    stage_message = {"text": "", "expires_at": None}
    app_state["stage_message"] = stage_message
    state_manager.save_state(app_state)

    # Clear on ProPresenter and resync timer state sequentially
    async def _clear_and_resync():
        await pp_client.send_stage_message("")
        current = engine.state()
        await pp_client.sync(
            name=current.name,
            duration=current.duration,
            remaining=current.remaining,
            status=current.status
        )
    asyncio.create_task(_clear_and_resync())

    return {"success": True}


@app.websocket("/ws/timer")
async def websocket_timer(websocket: WebSocket):
    """WebSocket connection for real-time timer state broadcasts."""
    await manager.connect(websocket)
    # Send current state immediately upon connection
    state = engine.state()
    state_dict = state.to_dict()
    state_dict["next_segment_name"] = get_next_segment_name()
    state_dict["queue_position"] = queue["current_index"] + 1 if queue["names"] else None
    state_dict["queue_length"] = len(queue["names"]) if queue["names"] else None
    await manager.send_personal(websocket, state_dict)

    try:
        # Keep connection open, discard any incoming messages (control is REST-only)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# Note: Frontend is served by nginx (in Docker) or Vite dev server (local dev)
# Backend only serves API routes and WebSocket


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

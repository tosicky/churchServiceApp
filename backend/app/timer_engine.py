import math
import time
from typing import Callable, Optional, Literal
from dataclasses import dataclass


@dataclass
class TimerState:
    name: str
    duration: int  # planned duration in seconds
    remaining: int  # current remaining seconds (can be negative for overtime)
    status: Literal["idle", "running", "paused", "completed"]
    propresenter_connected: bool = False

    def to_dict(self):
        return {
            "name": self.name,
            "duration": self.duration,
            "remaining": self.remaining,
            "status": self.status,
            "propresenter_connected": self.propresenter_connected,
        }


class TimerEngine:
    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self.name = "Service"
        self.duration = 0
        self._target_end: Optional[float] = None
        self._frozen_remaining = 0
        self.status: Literal["idle", "running", "paused", "completed"] = "idle"
        self.propresenter_connected = False

    def state(self) -> TimerState:
        """Compute current state, deriving remaining and status from elapsed time."""
        if self._target_end is not None:
            # Timer is running or was completed, compute remaining from target. Uses floor,
            # not int() (which truncates toward zero): int(-0.5) is 0, not -1, which would
            # freeze the display at "0:00" for up to a full extra second after expiry before
            # ever showing "-0:01" - floor keeps it decreasing monotonically through zero.
            remaining = math.floor(self._target_end - self.clock())
            # Determine status based on sign of remaining
            if remaining <= 0 and self.status != "paused":
                computed_status: Literal["idle", "running", "paused", "completed"] = "completed"
            elif self.status == "paused":
                computed_status = "paused"
            else:
                computed_status = "running"
        else:
            # Timer is idle or paused, use frozen value
            remaining = self._frozen_remaining
            computed_status = self.status

        return TimerState(
            name=self.name,
            duration=self.duration,
            remaining=remaining,
            status=computed_status,
            propresenter_connected=self.propresenter_connected,
        )

    def start(self, name: Optional[str] = None, duration: Optional[int] = None) -> TimerState:
        """Start the timer. If name/duration provided, load new segment first."""
        if name is not None:
            self.name = name
        if duration is not None:
            self.duration = duration
            self._frozen_remaining = duration

        # If currently paused with a remaining value, resume from that point
        # Otherwise use the frozen remaining or duration
        if self.status == "paused":
            remaining = self._frozen_remaining
        else:
            remaining = self.duration

        self._target_end = self.clock() + remaining
        self.status = "running"
        return self.state()

    def pause(self) -> TimerState:
        """Pause the timer, freezing current remaining time."""
        if self._target_end is not None:
            # Timer is running/completed, freeze the computed remaining (floor - see state())
            self._frozen_remaining = math.floor(self._target_end - self.clock())
            self._target_end = None
        self.status = "paused"
        return self.state()

    def reset(self) -> TimerState:
        """Reset timer to initial duration."""
        self._frozen_remaining = self.duration
        self._target_end = None
        self.status = "idle"
        return self.state()

    def add(self, seconds: int) -> TimerState:
        """Add seconds to the timer."""
        if self._target_end is not None:
            # Timer is running, adjust target end time
            self._target_end += seconds
        else:
            # Timer is paused/idle, adjust frozen remaining
            self._frozen_remaining += seconds
        # Re-derive status
        return self.state()

    def subtract(self, seconds: int) -> TimerState:
        """Subtract seconds from the timer."""
        return self.add(-seconds)

    def set_propresenter_connected(self, connected: bool):
        """Update ProPresenter connection status."""
        self.propresenter_connected = connected

    def get_persistable_state(self) -> dict:
        """Snapshot for disk persistence, anchored to an absolute wall-clock timestamp
        (time.time()) rather than the engine's internal monotonic clock. time.monotonic()
        resets to an arbitrary epoch on every process start, so a value derived from it is
        meaningless once read back after a restart; time.time() is not. Calling this while
        running/completed costs nothing extra later: "when should this segment hit 0:00"
        doesn't change while it's running, so this snapshot stays exactly accurate no matter
        how much real time passes before it's restored - there's no need to re-save it on
        every tick, only when start/pause/reset/add/subtract actually change something.
        """
        if self._target_end is not None:
            remaining = self._target_end - self.clock()
            target_timestamp: Optional[float] = time.time() + remaining
        else:
            target_timestamp = None
        return {
            "name": self.name,
            "duration": self.duration,
            "status": self.status,
            "frozen_remaining": self._frozen_remaining,
            "target_timestamp": target_timestamp,
        }

    # A segment restored more than this far into overtime is treated as stale leftover state
    # rather than "still relevant", and reverts to idle instead (see restore()). Genuine
    # mid-service overtime - the restart happening seconds or minutes after a segment ran
    # long - is still faithfully restored either way; this only catches the case where nobody
    # reset the queue since (the previous week's last segment, a forgotten test run, etc.),
    # which would otherwise sit "completed" indefinitely and block anything that expects idle
    # (like the pre-service countdown) until someone happens to notice and reset it manually.
    STALE_OVERTIME_SECONDS = 3600  # 1 hour

    def restore(self, data: dict) -> None:
        """Restore engine state from a get_persistable_state() snapshot - meant to be called
        once, at startup, right after loading persisted state from disk.

        A segment that was running (or already in overtime) when the process went down keeps
        counting from where it truly would be right now, computed fresh from the wall-clock
        target - it does not freeze at its last-saved value, nor does it "un-elapse" whatever
        downtime occurred. A paused/idle segment restores its frozen value exactly as saved,
        since it wasn't ticking and downtime doesn't apply. An exception: overtime beyond
        STALE_OVERTIME_SECONDS reverts to idle instead (see its comment) rather than being
        restored as still "completed".
        """
        status = data.get("status", "idle")
        target_timestamp = data.get("target_timestamp")

        if status in ("running", "completed") and target_timestamp is not None:
            remaining = target_timestamp - time.time()
            if remaining < -self.STALE_OVERTIME_SECONDS:
                self._revert_to_idle()
                return
            self.name = data.get("name", self.name)
            self.duration = data.get("duration", self.duration)
            self._target_end = self.clock() + remaining
            self._frozen_remaining = 0
            self.status = "running"  # state() re-derives "completed" on its own if remaining <= 0
        elif status == "paused":
            self.name = data.get("name", self.name)
            self.duration = data.get("duration", self.duration)
            self._frozen_remaining = data.get("frozen_remaining", 0)
            self._target_end = None
            self.status = "paused"
        else:
            self.name = data.get("name", self.name)
            self.duration = data.get("duration", self.duration)
            self._frozen_remaining = data.get("frozen_remaining", 0)
            self._target_end = None
            self.status = "idle"

    def _revert_to_idle(self) -> None:
        self.name = "Service"
        self.duration = 0
        self._frozen_remaining = 0
        self._target_end = None
        self.status = "idle"

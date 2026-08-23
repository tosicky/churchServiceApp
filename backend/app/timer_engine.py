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

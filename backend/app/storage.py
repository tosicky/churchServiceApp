import json
import os
import tempfile
from pathlib import Path
from typing import Any, TypedDict


class AppState(TypedDict):
    """Persistent application state structure."""
    settings: dict[str, Any]
    segments: dict[str, int]
    queue: dict[str, Any]
    templates: dict[str, dict[str, Any]]
    stage_message: dict[str, Any]  # {text: str, expires_at: float | None, auto: bool}


class StateManager:
    """JSON-file-backed persistent state store."""

    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.state_file = self.data_dir / "state.json"
        # Ensure data directory exists
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load_state(self) -> AppState:
        """Load state from disk, return defaults if file doesn't exist."""
        defaults = self._default_state()

        if self.state_file.exists():
            try:
                with open(self.state_file, "r") as f:
                    loaded = json.load(f)
                    # Merge with defaults to ensure all keys exist (handles migration from older versions)
                    for key in defaults:
                        if key not in loaded:
                            loaded[key] = defaults[key]
                    return loaded
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load state file: {e}. Using defaults.")

        # Return default state
        return defaults

    def save_state(self, state: AppState) -> None:
        """Atomically write state to disk (write to temp file, then rename)."""
        try:
            # Write to temporary file first
            fd, temp_path = tempfile.mkstemp(dir=self.data_dir, suffix=".tmp")
            try:
                with os.fdopen(fd, "w") as f:
                    json.dump(state, f, indent=2)
                # Atomic rename
                os.replace(temp_path, self.state_file)
            except Exception:
                # Clean up temp file if something went wrong
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
                raise
        except Exception as e:
            print(f"Error: Failed to save state: {e}")
            raise

    @staticmethod
    def _default_state() -> AppState:
        """Return the default application state."""
        return {
            "settings": {
                "propresenter_enabled": True,
                "propresenter_host": os.environ.get("PROPRESENTER_HOST", "host.docker.internal"),
                "propresenter_port": int(os.environ.get("PROPRESENTER_PORT", "61767")),
                "propresenter_timer_name": os.environ.get("PROPRESENTER_TIMER_NAME", "Segment Countdown"),
                "server_address": "",  # Operator sets this once for QR code sharing
            },
            "segments": {
                "Praise and Worship": 900,      # 15 minutes
                "Prayers": 600,                 # 10 minutes
                "Announcements": 600,           # 10 minutes
                "Tithe and Offering": 600,      # 10 minutes
                "Choir Ministration": 600,      # 10 minutes
                "Sermon": 1800,                 # 30 minutes
            },
            "queue": {
                "names": [],
                "current_index": -1,
            },
            "templates": {},
            "stage_message": {
                "text": "",
                "expires_at": None,
                "auto": False,
            },
        }

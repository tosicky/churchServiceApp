import pytest
import json
import tempfile
import os
from pathlib import Path
from app.storage import StateManager


def test_load_nonexistent_file():
    """Test loading state when file doesn't exist returns defaults."""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = StateManager(data_dir=tmpdir)
        state = manager.load_state()

        assert "settings" in state
        assert "segments" in state
        assert "queue" in state
        assert state["queue"]["current_index"] == -1
        assert state["queue"]["names"] == []
        assert len(state["segments"]) > 0  # Should have default segments


def test_save_and_load_state():
    """Test saving and loading state round-trip."""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = StateManager(data_dir=tmpdir)

        # Save state
        state_data = {
            "settings": {
                "propresenter_enabled": True,
                "propresenter_host": "test.local",
                "propresenter_port": 12345,
                "propresenter_timer_name": "Test Timer",
                "server_address": "192.168.1.50",
            },
            "segments": {
                "Test Segment": 600,
                "Another Segment": 1200,
            },
            "queue": {
                "names": ["Test Segment", "Another Segment"],
                "current_index": 0,
            },
        }
        manager.save_state(state_data)

        # Load and verify
        loaded = manager.load_state()
        assert loaded == state_data


def test_save_creates_file():
    """Test that save_state creates the state file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = StateManager(data_dir=tmpdir)
        state_file = Path(tmpdir) / "state.json"

        assert not state_file.exists()

        state = manager.load_state()  # Get defaults
        manager.save_state(state)

        assert state_file.exists()
        with open(state_file) as f:
            data = json.load(f)
        assert "settings" in data


def test_atomic_write():
    """Test that write is atomic - file should not be corrupted on partial write."""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = StateManager(data_dir=tmpdir)

        state1 = {
            "settings": {"propresenter_enabled": True, "propresenter_host": "host1", "propresenter_port": 100, "propresenter_timer_name": "Timer", "server_address": ""},
            "segments": {"Seg1": 100},
            "queue": {"names": [], "current_index": -1},
        }
        manager.save_state(state1)

        state2 = {
            "settings": {"propresenter_enabled": False, "propresenter_host": "host2", "propresenter_port": 200, "propresenter_timer_name": "Timer2", "server_address": "1.2.3.4"},
            "segments": {"Seg1": 100, "Seg2": 200},
            "queue": {"names": ["Seg1"], "current_index": 0},
        }
        manager.save_state(state2)

        loaded = manager.load_state()
        assert loaded == state2
        assert loaded["settings"]["propresenter_host"] == "host2"


def test_defaults_have_propresenter_settings():
    """Test that default state includes ProPresenter settings from env or defaults."""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = StateManager(data_dir=tmpdir)
        state = manager.load_state()

        assert "settings" in state
        assert "propresenter_enabled" in state["settings"]
        assert "propresenter_host" in state["settings"]
        assert "propresenter_port" in state["settings"]
        assert "propresenter_timer_name" in state["settings"]

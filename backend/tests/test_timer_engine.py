import pytest
from unittest.mock import patch
from app.timer_engine import TimerEngine


class TestTimerEngine:
    """Test suite for TimerEngine."""

    def fake_clock(self):
        """Simple fake clock for testing."""
        if not hasattr(self, "_fake_time"):
            self._fake_time = 0.0
        return self._fake_time

    def advance_time(self, seconds: float):
        """Advance the fake clock."""
        self._fake_time += seconds

    def test_initial_state(self):
        """Test engine starts in idle state."""
        engine = TimerEngine(clock=self.fake_clock)
        state = engine.state()
        assert state.status == "idle"
        assert state.remaining == 0
        assert state.duration == 0

    def test_start_and_count_down(self):
        """Test starting timer and countdown."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        # Start with 60 seconds
        state = engine.start(name="Test", duration=60)
        assert state.status == "running"
        assert state.remaining == 60
        assert state.name == "Test"
        assert state.duration == 60

        # Advance 10 seconds
        self.advance_time(10)
        state = engine.state()
        assert state.remaining == 50
        assert state.status == "running"

        # Advance 40 more seconds (total 50)
        self.advance_time(40)
        state = engine.state()
        assert state.remaining == 10
        assert state.status == "running"

    def test_countdown_to_zero(self):
        """Test countdown reaching zero transitions to completed."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=10)
        self.advance_time(10)
        state = engine.state()
        assert state.remaining == 0
        assert state.status == "completed"

    def test_overtime_negative_remaining(self):
        """Test overtime (negative remaining after completed)."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=10)
        self.advance_time(15)  # 5 seconds overtime
        state = engine.state()
        assert state.remaining == -5
        assert state.status == "completed"

    def test_pause_freezes_time(self):
        """Test pausing freezes the remaining time."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)

        # Pause at 40 remaining
        state = engine.pause()
        assert state.remaining == 40
        assert state.status == "paused"

        # Advance time more
        self.advance_time(30)

        # Should still be at 40 remaining
        state = engine.state()
        assert state.remaining == 40
        assert state.status == "paused"

    def test_resume_from_pause(self):
        """Test resuming from pause."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)
        engine.pause()

        # Resume
        self.advance_time(10)  # Advance time while paused
        state = engine.start()  # Resume
        assert state.status == "running"
        assert state.remaining == 40  # Should resume from pause point

        # Continue counting
        self.advance_time(5)
        state = engine.state()
        assert state.remaining == 35

    def test_reset(self):
        """Test reset restores initial duration."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(30)

        state = engine.reset()
        assert state.remaining == 60
        assert state.status == "idle"

    def test_add_time_while_running(self):
        """Test adding time while timer is running."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)  # 40 remaining

        state = engine.add(10)
        assert state.remaining == 50  # 40 + 10
        assert state.status == "running"

    def test_subtract_time_while_running(self):
        """Test subtracting time while timer is running."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)  # 40 remaining

        state = engine.subtract(10)
        assert state.remaining == 30  # 40 - 10
        assert state.status == "running"

    def test_add_time_while_paused(self):
        """Test adding time while timer is paused."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)
        engine.pause()  # 40 remaining

        state = engine.add(15)
        assert state.remaining == 55
        assert state.status == "paused"

    def test_subtract_time_while_paused(self):
        """Test subtracting time while timer is paused."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(20)
        engine.pause()  # 40 remaining

        state = engine.subtract(15)
        assert state.remaining == 25
        assert state.status == "paused"

    def test_start_with_new_name_and_duration(self):
        """Test starting with new name and duration."""
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)

        engine.start(duration=60)
        self.advance_time(30)

        # Start new segment
        state = engine.start(name="Sermon", duration=300)
        assert state.name == "Sermon"
        assert state.duration == 300
        assert state.remaining == 300
        assert state.status == "running"

    def test_propresenter_connected_flag(self):
        """Test ProPresenter connection flag."""
        engine = TimerEngine()

        state = engine.state()
        assert state.propresenter_connected is False

        engine.set_propresenter_connected(True)
        state = engine.state()
        assert state.propresenter_connected is True


class TestTimerEnginePersistence:
    """Persist/restore across a simulated process restart - get_persistable_state() uses real
    wall-clock time.time(), independent of the injectable monotonic `clock`, so these tests
    patch time.time() directly to control it precisely.
    """

    def fake_clock(self):
        if not hasattr(self, "_fake_time"):
            self._fake_time = 0.0
        return self._fake_time

    def advance_time(self, seconds: float):
        self._fake_time += seconds

    def test_persistable_state_idle(self):
        engine = TimerEngine(clock=self.fake_clock)
        data = engine.get_persistable_state()
        assert data == {
            "name": "Service",
            "duration": 0,
            "status": "idle",
            "frozen_remaining": 0,
            "target_timestamp": None,
        }

    def test_persistable_state_running_has_wallclock_target(self):
        self._fake_time = 0.0
        engine = TimerEngine(clock=self.fake_clock)
        engine.start(name="Sermon", duration=60)
        self.advance_time(20)  # 40s remaining

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            data = engine.get_persistable_state()

        assert data["status"] == "running"
        assert data["target_timestamp"] == pytest.approx(1_000_040.0)

    def test_restore_running_accounts_for_real_downtime(self):
        """A segment that was running when the process died should reflect the time that
        actually passed while it was down, not freeze or "un-elapse" that gap."""
        self._fake_time = 0.0
        original = TimerEngine(clock=self.fake_clock)
        original.start(name="Sermon", duration=60)
        self.advance_time(20)  # 40s remaining at the moment of "saving"

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = original.get_persistable_state()

        # Restore into a brand new engine (simulating a fresh process) after 25s of real
        # downtime - restored remaining should be 40 - 25 = 15, not a frozen 40.
        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_025.0):
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "running"
        assert state.name == "Sermon"
        assert state.remaining == 15

    def test_restore_running_into_overtime_after_long_downtime(self):
        """If enough real time passed while the process was down that the segment would
        already be over, restoring should land straight into overtime, not idle/frozen."""
        self._fake_time = 0.0
        original = TimerEngine(clock=self.fake_clock)
        original.start(name="Sermon", duration=60)  # 60s remaining

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = original.get_persistable_state()

        # 90 seconds of real downtime - 30s past when it should have ended
        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_090.0):
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "completed"
        assert state.remaining == -30

    def test_restore_reverts_stale_overtime_to_idle(self):
        """A segment that's been sitting in overtime for a long time (the previous week's
        last segment, a forgotten test run, etc.) should NOT be restored as still "completed" -
        that would silently block anything expecting idle (like the pre-service countdown)
        until someone happens to notice and manually reset it."""
        self._fake_time = 0.0
        original = TimerEngine(clock=self.fake_clock)
        original.start(name="Dedication", duration=600)

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = original.get_persistable_state()

        # 2 hours of "downtime" - well past the 1-hour staleness threshold
        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_000.0 + 7200):
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "idle"
        assert state.name == "Service"
        assert state.duration == 0
        assert state.remaining == 0

    def test_restore_just_under_stale_threshold_still_restores(self):
        """The boundary case: overtime just short of the threshold should still restore as
        completed/overtime, not revert - only genuinely long-stale state reverts."""
        self._fake_time = 0.0
        original = TimerEngine(clock=self.fake_clock)
        original.start(name="Sermon", duration=60)

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = original.get_persistable_state()

        # 60s duration + 59 minutes overtime = 1 second under the 1-hour threshold
        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_060.0 + 3599):
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "completed"
        assert state.name == "Sermon"
        assert state.remaining == -3599

    def test_restore_paused_stays_frozen_regardless_of_downtime(self):
        self._fake_time = 0.0
        original = TimerEngine(clock=self.fake_clock)
        original.start(duration=60)
        self.advance_time(20)
        original.pause()  # frozen at 40

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = original.get_persistable_state()

        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_500.0):  # 500s "downtime"
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "paused"
        assert state.remaining == 40

    def test_restore_idle_preserves_name_and_duration(self):
        engine = TimerEngine(clock=self.fake_clock)
        engine.name = "Sermon"
        engine.duration = 1800
        engine.status = "idle"
        engine._frozen_remaining = 1800

        with patch("app.timer_engine.time.time", return_value=1_000_000.0):
            snapshot = engine.get_persistable_state()

        restored = TimerEngine(clock=lambda: 0.0)
        with patch("app.timer_engine.time.time", return_value=1_000_050.0):
            restored.restore(snapshot)
            state = restored.state()

        assert state.status == "idle"
        assert state.name == "Sermon"
        assert state.duration == 1800
        assert state.remaining == 1800

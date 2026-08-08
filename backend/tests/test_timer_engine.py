import pytest
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

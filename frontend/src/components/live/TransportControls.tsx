import { useServiceData } from '../../contexts/ServiceDataContext';
import { useTimerControls } from '../../hooks/useTimerControls';
import { Button } from '../ui/Button';

// The hero control: the single most-used action during a live service, given the
// visual primacy it previously lacked entirely (it was the 7th of 9 same-weight
// sections in the old ControlPanel). Sits directly under the timer stage.
export function TransportControls() {
  const { state, queue, advanceQueue, queueLoading } = useServiceData();
  const controls = useTimerControls(state);

  const handleAdvance = async () => {
    const success = await advanceQueue();
    if (!success) alert('Queue complete or empty');
  };

  const handleReset = () => {
    if (confirm('Reset the timer? This stops the current countdown.')) {
      controls.reset();
    }
  };

  const canStart = Boolean(state?.name && state.duration);

  const primaryLabel =
    controls.primaryAction === 'pause' ? '⏸ Pause' : controls.primaryAction === 'resume' ? '▶ Resume' : '▶ Start';
  const primaryVariant = controls.primaryAction === 'pause' ? 'warning' : 'success';
  const primaryDisabled = controls.primaryAction === 'start' && !canStart;

  const handlePrimary = () => {
    if (controls.primaryAction === 'pause') {
      controls.pause();
    } else if (controls.primaryAction === 'resume') {
      controls.resume();
    } else if (state?.name && state.duration) {
      controls.start(state.name, state.duration);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={handlePrimary} disabled={primaryDisabled} variant={primaryVariant} size="hero">
        {primaryLabel}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleAdvance}
          disabled={queueLoading || queue.names.length === 0}
          variant="primary"
          size="lg"
        >
          ▶▶ Next Segment
        </Button>
        <Button onClick={handleReset} variant="ghost" size="lg" className="text-danger">
          ↺ Reset
        </Button>
      </div>
    </div>
  );
}

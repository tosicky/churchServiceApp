import { useServiceData } from '../../contexts/ServiceDataContext';
import { useTimerControls } from '../../hooks/useTimerControls';
import { Button } from '../ui/Button';

export function TimeAdjustControls() {
  const { state } = useServiceData();
  const controls = useTimerControls(state);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button onClick={() => controls.addSeconds(60)} variant="secondary" size="sm">
        +1m
      </Button>
      <Button onClick={() => controls.addSeconds(300)} variant="secondary" size="sm">
        +5m
      </Button>
      <Button onClick={() => controls.subtractSeconds(60)} variant="secondary" size="sm">
        -1m
      </Button>
    </div>
  );
}

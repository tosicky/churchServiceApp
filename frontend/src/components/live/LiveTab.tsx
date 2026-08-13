import { useState } from 'react';
import { TimerStage } from './TimerStage';
import { TransportControls } from './TransportControls';
import { TimeAdjustControls } from './TimeAdjustControls';
import { RunOfShowPanel } from './RunOfShowPanel';
import { QuickStartPanel } from './QuickStartPanel';
import { StageMessagePanel } from '../StageMessagePanel';
import { Card } from '../ui/Card';
import { useServiceData } from '../../contexts/ServiceDataContext';

export function LiveTab() {
  const { state } = useServiceData();
  const [showStageMessage, setShowStageMessage] = useState(false);

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 pt-2 -mt-2 bg-canvas">
        <TimerStage state={state} />
      </div>

      <TransportControls />
      <TimeAdjustControls />

      <Card>
        <RunOfShowPanel />
      </Card>

      <Card>
        <button
          onClick={() => setShowStageMessage((v) => !v)}
          className="text-sm font-semibold text-content-secondary hover:text-content transition"
        >
          {showStageMessage ? '▼' : '▶'} Stage Message
        </button>
        {showStageMessage && (
          <div className="mt-3">
            <StageMessagePanel />
          </div>
        )}
      </Card>

      <Card>
        <QuickStartPanel />
      </Card>
    </div>
  );
}

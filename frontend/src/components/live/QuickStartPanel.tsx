import { useState, useEffect } from 'react';
import { useServiceData } from '../../contexts/ServiceDataContext';
import { useTimerControls } from '../../hooks/useTimerControls';
import { Button } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';

// Collapsed by default - this is for the exceptional case of starting a segment
// that isn't in the queue (e.g. an unplanned announcement), not the everyday path.
export function QuickStartPanel() {
  const [expanded, setExpanded] = useState(false);
  const { segments, segmentsLoading, state } = useServiceData();
  const controls = useTimerControls(state);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [customDuration, setCustomDuration] = useState<number | null>(null);

  useEffect(() => {
    if (segments.length > 0 && !selectedSegment) {
      setSelectedSegment(segments[0].name);
    }
  }, [segments, selectedSegment]);

  const selectedDuration = customDuration ?? (segments.find((s) => s.name === selectedSegment)?.duration ?? 0) / 60;

  const handleSegmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSegment(e.target.value);
    setCustomDuration(null);
  };

  const handleStart = () => {
    if (!selectedSegment) return;
    controls.start(selectedSegment, Math.round(selectedDuration * 60));
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-semibold text-content-secondary hover:text-content transition"
      >
        {expanded ? '▼' : '▶'} Start an unplanned segment
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Segment">
              <select
                value={selectedSegment}
                onChange={handleSegmentSelect}
                disabled={segmentsLoading}
                className={inputClass}
              >
                {segments.map((seg) => (
                  <option key={seg.name} value={seg.name}>
                    {seg.name} ({Math.round(seg.duration / 60)}m)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                value={customDuration ?? selectedDuration}
                onChange={(e) => setCustomDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
                min="1"
              />
            </Field>
          </div>
          <Button onClick={handleStart} disabled={!selectedSegment} variant="primary" className="w-full">
            Start This Segment
          </Button>
        </div>
      )}
    </div>
  );
}

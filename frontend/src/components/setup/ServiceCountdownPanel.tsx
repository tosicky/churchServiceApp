import { useState } from 'react';
import { useServiceCountdown, targetTimeToTimestamp, type ServiceCountdown, type Weekday } from '../../hooks/useServiceCountdown';
import { Field, inputClass } from '../ui/Field';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function ServiceCountdownPanel() {
  const { countdown, loading, error, updateCountdown } = useServiceCountdown();
  const [formData, setFormData] = useState<ServiceCountdown | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync form data with the loaded countdown once it arrives
  if (countdown && !formData) {
    setFormData(countdown);
  }

  const isWeekly = formData?.recurrence === 'weekly';
  const canSave = !!formData && (!formData.enabled || (isWeekly ? !!formData.weekday && !!formData.target_time : !!formData.target_time));

  const handleSave = async () => {
    if (!formData) return;
    try {
      setSaving(true);
      setSaved(false);
      setSaveError(null);
      const payload: ServiceCountdown =
        formData.recurrence === 'weekly'
          ? { ...formData, target_timestamp: null }
          : { ...formData, weekday: null, target_timestamp: targetTimeToTimestamp(formData.target_time) };
      await updateCountdown(payload);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-content">Service Starts In</h3>
      <p className="text-sm text-content-secondary">
        Show a "Service starts in..." countdown on the Display page ahead of the service - useful
        for the gap between Sunday school ending and the service's start time. It won't start the
        queue on its own.
      </p>

      {loading && <p className="text-content-secondary text-sm">Loading...</p>}
      {error && <Alert tone="error">{error}</Alert>}

      {formData && (
        <>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="countdown-enabled"
              checked={formData.enabled}
              onChange={(e) => {
                setSaved(false);
                setFormData({ ...formData, enabled: e.target.checked });
              }}
              className="mr-2 accent-accent"
            />
            <label htmlFor="countdown-enabled" className="text-sm text-content">
              Enable service start countdown
            </label>
          </div>

          <Field label="Repeats">
            <div className="flex gap-4 text-sm text-content">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="countdown-recurrence"
                  checked={formData.recurrence === 'once'}
                  onChange={() => {
                    setSaved(false);
                    setFormData({ ...formData, recurrence: 'once' });
                  }}
                  className="accent-accent"
                />
                One time
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="countdown-recurrence"
                  checked={formData.recurrence === 'weekly'}
                  onChange={() => {
                    setSaved(false);
                    setFormData({ ...formData, recurrence: 'weekly', weekday: formData.weekday ?? 'sunday' });
                  }}
                  className="accent-accent"
                />
                Every week
              </label>
            </div>
          </Field>

          {isWeekly && (
            <Field label="Day of week">
              <select
                value={formData.weekday ?? 'sunday'}
                onChange={(e) => {
                  setSaved(false);
                  setFormData({ ...formData, weekday: e.target.value as Weekday });
                }}
                className={inputClass}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label="Service start time"
            helper={
              isWeekly
                ? "Uses the server's configured timezone (set via TZ in docker-compose.yml), since it needs to fire automatically each week."
                : "Uses this device's local clock at the moment you save."
            }
          >
            <input
              type="time"
              value={formData.target_time ?? ''}
              onChange={(e) => {
                setSaved(false);
                setFormData({ ...formData, target_time: e.target.value || null });
              }}
              className={inputClass}
            />
          </Field>

          {saveError && <Alert tone="error">{saveError}</Alert>}
          {saved && <Alert tone="success">Saved.</Alert>}

          <Button onClick={handleSave} disabled={saving || !canSave} variant="primary" className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      )}
    </div>
  );
}

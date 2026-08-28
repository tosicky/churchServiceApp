import { useState, useMemo } from 'react';
import { useServiceCountdown, targetTimeToTimestamp, type ServiceCountdown, type Weekday } from '../../hooks/useServiceCountdown';
import { useSettings } from '../../hooks/useSettings';
import { Field, inputClass } from '../ui/Field';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Modern browsers (Chrome 99+, Safari 17+, Edge) expose the full IANA database directly -
// no need to ship/maintain our own list. Falls back to a plain text input on anything older.
function getSupportedTimezones(): string[] {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (typeof supportedValuesOf === 'function') {
      return supportedValuesOf('timeZone');
    }
  } catch {
    // fall through to empty list below
  }
  return [];
}

export function ServiceCountdownPanel() {
  const { countdown, loading, error, updateCountdown } = useServiceCountdown();
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<ServiceCountdown | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);

  // Sync form data with the loaded countdown/settings once they arrive
  if (countdown && !formData) {
    setFormData(countdown);
  }
  if (settings && timezone === null) {
    setTimezone(settings.timezone);
  }

  const timezoneOptions = useMemo(() => getSupportedTimezones(), []);
  const isWeekly = formData?.recurrence === 'weekly';
  // "Use This Device" and picking from the dropdown both only stage a value locally - neither
  // persists anything by itself. This is the one thing on the page that's easy to mistake for
  // already being saved, since the field visibly updates right away; call it out explicitly
  // until the Save button below actually commits it.
  const timezoneDirty = !!settings && !!timezone && timezone !== settings.timezone;
  const canSave =
    !!formData &&
    (!formData.enabled ||
      (isWeekly ? !!formData.weekday && !!formData.target_time && !!timezone : !!formData.target_time));

  const handleSave = async () => {
    if (!formData) return;
    try {
      setSaving(true);
      setSaved(false);
      setSaveError(null);

      const savingTimezone = isWeekly && settings && timezone && timezone !== settings.timezone;
      if (savingTimezone) {
        await updateSettings({ ...settings, timezone });
      }
      setSavedTimezone(savingTimezone ? timezone : null);

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

  const detectBrowserTimezone = () => {
    setSaved(false);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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

          {isWeekly && (
            <Field
              label="Server timezone"
              helper="Weekly recurrence runs unattended, so the server needs to know which timezone to use - no browser is open at 3am to tell it."
            >
              <div className="flex gap-2">
                {timezoneOptions.length > 0 ? (
                  <select
                    value={timezone ?? 'UTC'}
                    onChange={(e) => {
                      setSaved(false);
                      setTimezone(e.target.value);
                    }}
                    className={inputClass}
                  >
                    {!timezoneOptions.includes(timezone ?? 'UTC') && (
                      <option value={timezone ?? 'UTC'}>{timezone ?? 'UTC'}</option>
                    )}
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={timezone ?? ''}
                    onChange={(e) => {
                      setSaved(false);
                      setTimezone(e.target.value);
                    }}
                    placeholder="e.g., America/Moncton"
                    className={inputClass}
                  />
                )}
                <Button onClick={detectBrowserTimezone} variant="secondary" className="whitespace-nowrap">
                  Use This Device
                </Button>
              </div>
              {timezoneDirty && (
                <p className="text-xs text-warning mt-1.5">
                  ⚠ Not saved yet - click Save below to apply "{timezone}" (currently saved: {settings?.timezone}).
                </p>
              )}
            </Field>
          )}

          <Field
            label="Service start time"
            helper={
              isWeekly
                ? 'Interpreted in the server timezone set above.'
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
          {saved && (
            <Alert tone="success">{savedTimezone ? `Saved. Server timezone set to ${savedTimezone}.` : 'Saved.'}</Alert>
          )}

          <Button onClick={handleSave} disabled={saving || !canSave} variant="primary" className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      )}
    </div>
  );
}

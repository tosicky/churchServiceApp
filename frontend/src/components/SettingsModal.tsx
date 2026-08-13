import { useState } from 'react';
import { useSettings, type Settings } from '../hooks/useSettings';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, loading, updateSettings } = useSettings();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form data with settings when settings load
  if (settings && !formData) {
    setFormData(settings);
  }

  const handleChange = (field: keyof Settings, value: any) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    try {
      setSaving(true);
      setError(null);
      await updateSettings(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-md">
      {loading && <p className="text-content-secondary text-sm">Loading...</p>}
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {formData && (
        <div className="space-y-4">
          <Field label="Server Address" helper="IP or hostname for mobile/tablet access and QR code (e.g., 192.168.1.100)">
            <input
              type="text"
              value={formData.server_address}
              onChange={(e) => handleChange('server_address', e.target.value)}
              placeholder="192.168.1.100"
              className={inputClass}
            />
          </Field>

          <div className="border-t border-line pt-4">
            <h3 className="font-semibold mb-3 text-sm text-content">ProPresenter</h3>

            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="pp-enabled"
                checked={formData.propresenter_enabled}
                onChange={(e) => handleChange('propresenter_enabled', e.target.checked)}
                className="mr-2 accent-accent"
              />
              <label htmlFor="pp-enabled" className="text-sm text-content">
                Enable ProPresenter sync
              </label>
            </div>

            <Field label="Host" className="mb-3">
              <input
                type="text"
                value={formData.propresenter_host}
                onChange={(e) => handleChange('propresenter_host', e.target.value)}
                placeholder="host.docker.internal"
                className={inputClass}
              />
            </Field>

            <Field label="Port" className="mb-3">
              <input
                type="number"
                value={formData.propresenter_port}
                onChange={(e) => handleChange('propresenter_port', parseInt(e.target.value) || 0)}
                className={inputClass}
              />
            </Field>

            <Field label="Timer Name">
              <input
                type="text"
                value={formData.propresenter_timer_name}
                onChange={(e) => handleChange('propresenter_timer_name', e.target.value)}
                placeholder="Segment Countdown"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-line">
            <Button onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} variant="primary">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

import { useState } from 'react';
import { useSettings, type Settings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme } = useTheme();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`rounded-lg shadow-lg p-6 max-w-md w-full mx-4 ${
        theme === 'dark'
          ? 'bg-gray-800 text-white'
          : 'bg-white'
      }`}>
        <h2 className="text-xl font-bold mb-4">Settings</h2>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

        {formData && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Server Address</label>
              <p className="text-xs text-gray-600 mb-1">
                IP or hostname for mobile/tablet access and QR code (e.g., 192.168.1.100)
              </p>
              <input
                type="text"
                value={formData.server_address}
                onChange={(e) => handleChange('server_address', e.target.value)}
                placeholder="192.168.1.100"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-sm">ProPresenter</h3>

              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="pp-enabled"
                  checked={formData.propresenter_enabled}
                  onChange={(e) => handleChange('propresenter_enabled', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="pp-enabled" className="text-sm">
                  Enable ProPresenter sync
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Host</label>
                <input
                  type="text"
                  value={formData.propresenter_host}
                  onChange={(e) => handleChange('propresenter_host', e.target.value)}
                  placeholder="host.docker.internal"
                  className="w-full border rounded px-3 py-2 text-sm mb-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.propresenter_port}
                    onChange={(e) => handleChange('propresenter_port', parseInt(e.target.value) || 0)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Timer Name</label>
                <input
                  type="text"
                  value={formData.propresenter_timer_name}
                  onChange={(e) => handleChange('propresenter_timer_name', e.target.value)}
                  placeholder="Segment Countdown"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-700 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';

export interface Settings {
  propresenter_enabled: boolean;
  propresenter_host: string;
  propresenter_port: number;
  propresenter_timer_name: string;
  server_address: string;
  timezone: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Settings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      const updated = await response.json();
      setSettings(updated);
      setError(null);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      throw err;
    }
  };

  return { settings, loading, error, updateSettings, refetch: fetchSettings };
}

import { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import QRCode from 'qrcode.react';
import { Button } from './ui/Button';

interface ServerInfoData {
  connected_clients: number;
}

export function ServerInfo() {
  const { theme } = useTheme();
  const [info, setInfo] = useState<ServerInfoData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [customAddress, setCustomAddress] = useState('');

  // Use the current hostname/IP from the browser's location
  const serverAddress = window.location.hostname;
  const serverUrl = `http://${serverAddress}/`;
  const isLocalhost = serverAddress === 'localhost' || serverAddress === '127.0.0.1';

  // Get custom server address from settings on mount and refetch every 3s to catch updates
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        if (settings.server_address) {
          setCustomAddress(settings.server_address);
        }
      } catch (e) {
        console.error('Failed to fetch settings:', e);
      }
    };
    fetchSettings();
    // Poll settings every 3 seconds to pick up changes from SettingsModal
    const interval = setInterval(fetchSettings, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await fetch('/api/server-info');
        const data = await response.json();
        setInfo(data);
      } catch (e) {
        console.error('Failed to fetch server info:', e);
      }
    };

    fetchInfo();
    // Refresh every 5 seconds to update client count
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyIP = () => {
    navigator.clipboard.writeText(serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {isLocalhost && (
        <div className="border rounded-lg p-4 space-y-3 border-warning/40 bg-warning-soft">
          <div className="text-xs text-warning-content">
            <p className="font-semibold mb-2">⚠️ Localhost access (laptop only)</p>
            <p className="mb-2">To access from phone/tablet/monitor:</p>
            <ol className="space-y-1 ml-3">
              <li>1. Find your laptop's IP: <code className="px-1 py-0.5 rounded bg-surface">ipconfig</code> or <code className="px-1 py-0.5 rounded bg-surface">ifconfig</code></li>
              <li>2. Open: <code className="px-1 py-0.5 rounded bg-surface">http://192.168.x.x/</code> (use your IP)</li>
              <li>3. Copy that URL and share with team</li>
            </ol>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs p-3 rounded-lg border text-content-secondary bg-surface border-line">
        <span>
          🔗 <strong>{info?.connected_clients ?? 0}</strong> device{info?.connected_clients !== 1 ? 's' : ''} connected
        </span>
        <Button onClick={() => setShowQR(!showQR)} variant="ghost" size="sm" className="text-accent hover:text-accent-hover">
          {showQR ? '▼' : '▶'} 📱 QR Code
        </Button>
      </div>

      {showQR && (
        <div className="p-4 rounded-lg border flex flex-col items-center gap-3 bg-surface border-line">
          <p className="text-xs text-content-secondary">Scan to access from mobile/tablet:</p>
          <QRCode
            value={customAddress ? `http://${customAddress}/` : serverUrl}
            size={200}
            level="H"
            includeMargin={true}
            bgColor={theme === 'dark' ? '#18181b' : '#ffffff'}
            fgColor={theme === 'dark' ? '#f4f4f5' : '#000000'}
          />
          <div className="flex items-center gap-2">
            <p className="text-xs text-center text-content-secondary">
              {customAddress ? `http://${customAddress}/` : serverUrl}
            </p>
            <Button onClick={handleCopyIP} variant="ghost" size="sm">
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

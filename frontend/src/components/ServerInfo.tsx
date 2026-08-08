import { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import QRCode from 'qrcode.react';

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
        <div className={`border rounded-lg p-4 space-y-3 ${
          theme === 'dark'
            ? 'border-yellow-600 bg-yellow-900/30'
            : 'border-yellow-200 bg-yellow-50'
        }`}>
          <div className={`text-xs ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'}`}>
            <p className="font-semibold mb-2">⚠️ Localhost access (laptop only)</p>
            <p className="mb-2">To access from phone/tablet/monitor:</p>
            <ol className="space-y-1 ml-3">
              <li>1. Find your laptop's IP: <code className={`px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>ipconfig</code> or <code className={`px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>ifconfig</code></li>
              <li>2. Open: <code className={`px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>http://192.168.x.x/</code> (use your IP)</li>
              <li>3. Copy that URL and share with team</li>
            </ol>
          </div>
        </div>
      )}

      <div className={`flex items-center justify-between text-xs p-3 rounded border ${
        theme === 'dark'
          ? 'text-gray-300 bg-gray-800 border-gray-700'
          : 'text-gray-600 bg-white border-gray-200'
      }`}>
        <span>
          🔗 <strong>{info?.connected_clients ?? 0}</strong> device{info?.connected_clients !== 1 ? 's' : ''} connected
        </span>
        <button
          onClick={() => setShowQR(!showQR)}
          className={`font-semibold ${
            theme === 'dark'
              ? 'text-blue-400 hover:text-blue-300'
              : 'text-blue-600 hover:text-blue-800'
          }`}
        >
          {showQR ? '▼' : '▶'} 📱 QR Code
        </button>
      </div>

      {showQR && (
        <div className={`p-4 rounded border flex flex-col items-center gap-3 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Scan to access from mobile/tablet:
          </p>
          <QRCode
            value={customAddress ? `http://${customAddress}/` : serverUrl}
            size={200}
            level="H"
            includeMargin={true}
            bgColor={theme === 'dark' ? '#1f2937' : '#ffffff'}
            fgColor={theme === 'dark' ? '#f3f4f6' : '#000000'}
          />
          <p className={`text-xs text-center ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            {customAddress ? `http://${customAddress}/` : serverUrl}
          </p>
        </div>
      )}
    </>
  );
}

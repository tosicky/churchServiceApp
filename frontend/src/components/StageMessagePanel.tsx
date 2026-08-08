import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useStageMessage } from '../hooks/useStageMessage';

export function StageMessagePanel() {
  const { theme } = useTheme();
  const { message: currentMessage, loading, error, sendMessage, clearMessage } = useStageMessage();

  const [messageText, setMessageText] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const durations = [
    { label: '10s', value: 10 },
    { label: '20s', value: 20 },
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
  ];

  // Timer countdown display
  useEffect(() => {
    if (selectedDuration === null) return;

    let remaining = selectedDuration;
    setTimeRemaining(remaining);

    const interval = setInterval(() => {
      remaining--;
      setTimeRemaining(remaining <= 0 ? null : remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedDuration]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const success = await sendMessage(messageText, selectedDuration);
    if (success) {
      setMessageText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setSelectedDuration(null);
    }
  };

  const handleClear = async () => {
    await clearMessage();
    setSelectedDuration(null);
    setTimeRemaining(null);
  };

  return (
    <div
      className={`rounded-lg shadow-md p-4 space-y-4 ${
        theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
      }`}
    >
      <h3 className="font-semibold text-lg">Stage Message</h3>

      {/* Current message display */}
      {currentMessage?.text && (
        <div className={`p-3 rounded border ${
          theme === 'dark'
            ? 'bg-blue-900/20 border-blue-700 text-blue-300'
            : 'bg-blue-50 border-blue-300 text-blue-700'
        }`}>
          <p className="text-xs font-semibold mb-2 flex items-center gap-2">
            <span>📺 Currently on Stage:</span>
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">➜</span>
            <p>{currentMessage.text}</p>
          </div>
          {currentMessage.expires_at && (
            <p className="text-xs mt-2 opacity-75">
              ⏱️ Expires in {Math.ceil((currentMessage.expires_at - Date.now() / 1000))}s
            </p>
          )}
        </div>
      )}

      {/* Message input */}
      <div>
        <label className={`block text-sm font-medium mb-1 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>Message Text</label>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="e.g., 5 min warning, Choir take stage"
          disabled={loading}
          className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>

      {/* Duration picker */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>Auto-clear duration</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {durations.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDuration(d.value)}
              className={`py-2 px-2 text-sm font-semibold rounded transition-colors ${
                selectedDuration === d.value
                  ? theme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedDuration(null)}
            className={`py-2 px-2 text-sm font-semibold rounded transition-colors ${
              selectedDuration === null
                ? theme === 'dark'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-500 text-white'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Persist
          </button>
        </div>
        {timeRemaining !== null && (
          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            ⏱️ {timeRemaining}s remaining
          </p>
        )}
      </div>

      {/* Success message */}
      {showSuccess && (
        <div className={`p-2 border rounded text-xs ${
          theme === 'dark'
            ? 'bg-green-900/30 border-green-700 text-green-300'
            : 'bg-green-100 border-green-300 text-green-700'
        }`}>
          ✓ Message sent to stage
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={`p-2 border rounded text-xs ${
          theme === 'dark'
            ? 'bg-red-900/30 border-red-700 text-red-300'
            : 'bg-red-100 border-red-300 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <button
          onClick={handleSend}
          disabled={loading || !messageText.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded transition"
        >
          {loading ? 'Sending...' : 'Send to Stage'}
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className={`flex-1 font-semibold py-2 px-4 rounded transition ${
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:opacity-50 text-gray-100'
              : 'bg-gray-300 hover:bg-gray-400 disabled:bg-gray-300 disabled:opacity-50 text-gray-800'
          }`}
        >
          Clear Message
        </button>
      </div>
    </div>
  );
}

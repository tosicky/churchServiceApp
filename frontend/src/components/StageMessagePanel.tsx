import { useState, useEffect } from 'react';
import { useStageMessage } from '../hooks/useStageMessage';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { inputClass } from './ui/Field';

export function StageMessagePanel() {
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
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-content">Stage Message</h3>

      {/* Current message display */}
      {currentMessage?.text && (
        <div className="p-3 rounded-lg border bg-accent-soft border-accent/30 text-content">
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
        <label className="block text-sm font-medium mb-1 text-content-secondary">Message Text</label>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="e.g., 5 min warning, Choir take stage"
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Duration picker */}
      <div>
        <label className="block text-sm font-medium mb-2 text-content-secondary">Auto-clear duration</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {durations.map((d) => (
            <Button
              key={d.value}
              onClick={() => setSelectedDuration(d.value)}
              variant={selectedDuration === d.value ? 'primary' : 'secondary'}
              size="sm"
            >
              {d.label}
            </Button>
          ))}
          <Button
            onClick={() => setSelectedDuration(null)}
            variant={selectedDuration === null ? 'success' : 'secondary'}
            size="sm"
          >
            Persist
          </Button>
        </div>
        {timeRemaining !== null && (
          <p className="text-xs mt-2 text-content-secondary">⏱️ {timeRemaining}s remaining</p>
        )}
      </div>

      {showSuccess && <Alert tone="success">✓ Message sent to stage</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Action buttons */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <Button onClick={handleSend} disabled={loading || !messageText.trim()} variant="primary" className="flex-1">
          {loading ? 'Sending...' : 'Send to Stage'}
        </Button>
        <Button onClick={handleClear} disabled={loading} variant="secondary" className="flex-1">
          Clear Message
        </Button>
      </div>
    </div>
  );
}

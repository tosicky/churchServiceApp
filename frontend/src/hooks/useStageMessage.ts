import { useState, useEffect } from 'react';

export interface StageMessage {
  text: string;
  expires_at: number | null;
}

export function useStageMessage() {
  const [message, setMessage] = useState<StageMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current stage message from server
  useEffect(() => {
    const fetchCurrentMessage = async () => {
      try {
        const response = await fetch('/api/timer/state');
        if (response.ok) {
          const data = await response.json();
          // Server broadcasts stage_message in timer state
          if (data.stage_message) {
            setMessage(data.stage_message);
          }
        }
      } catch (err) {
        console.error('Failed to fetch current stage message:', err);
      }
    };

    fetchCurrentMessage();
    // Poll every 2 seconds to catch server-side updates (queue advances, expirations)
    const interval = setInterval(fetchCurrentMessage, 2000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (text: string, duration: number | null) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/stage-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, duration }),
      });
      if (response.ok) {
        const data = await response.json();
        setMessage(data);
        return true;
      } else {
        setError('Failed to send message');
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/stage-message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setMessage(null);
        return true;
      } else {
        setError('Failed to clear message');
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { message, loading, error, sendMessage, clearMessage };
}

import { useEffect, useState, useRef } from 'react';
import type { TimerState } from '../lib/api';

export function useTimerSocket() {
  const [state, setState] = useState<TimerState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    // Scoped to THIS effect invocation only (not a ref) - critical under React StrictMode,
    // which runs mount->cleanup->mount once in dev: a ref-based flag gets reset by the second
    // mount, which would un-cancel the first (already-torn-down) socket's still-pending async
    // onclose handler and let it incorrectly reconnect. A closure-local flag can never be
    // touched by any other invocation, so once cancelled here it stays cancelled for good.
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${window.location.host}/ws/timer`;

        const ws = new WebSocket(url);

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          console.log('WebSocket connected');
          setConnected(true);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data);
            setState(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnected(false);
          if (!cancelled) {
            reconnect();
          }
        };

        wsRef.current = ws;
      } catch (e) {
        console.error('Failed to create WebSocket:', e);
        if (!cancelled) {
          reconnect();
        }
      }
    };

    const reconnect = () => {
      if (cancelled) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectAttempts.current += 1;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);

      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { state, connected };
}

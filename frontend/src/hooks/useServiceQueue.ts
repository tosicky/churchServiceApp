import { useEffect, useState } from 'react';

export interface ServiceQueue {
  names: string[];
  current_index: number;
}

export function useServiceQueue(liveNames?: string[], liveCurrentIndex?: number) {
  const [queue, setQueue] = useState<ServiceQueue>({ names: [], current_index: -1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  // Opportunistically pick up queue changes broadcast by the server (e.g. from another
  // connected controller, or after advance/reset), without clobbering unrelated local state.
  useEffect(() => {
    if (liveNames === undefined) return;
    setQueue((prev) => {
      const namesChanged =
        prev.names.length !== liveNames.length || prev.names.some((n, i) => n !== liveNames[i]);
      const newIndex = liveCurrentIndex ?? prev.current_index;
      if (!namesChanged && prev.current_index === newIndex) return prev;
      return { names: liveNames, current_index: newIndex };
    });
  }, [liveNames, liveCurrentIndex]);

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/queue');
      if (response.ok) {
        const data = await response.json();
        setQueue(data);
      }
    } catch (e) {
      console.error('Failed to fetch queue:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateQueue = async (names: string[]) => {
    const previous = queue;
    // Apply optimistically so drag/reorder/add/remove feel instant; roll back on failure.
    setQueue((q) => ({ ...q, names }));
    setError(null);
    try {
      const response = await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names,
          current_index: previous.current_index,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setQueue(updated);
        return true;
      }
      setQueue(previous);
      try {
        const data = await response.json();
        setError(data.detail || 'Failed to update queue');
      } catch {
        setError('Failed to update queue');
      }
      return false;
    } catch (e) {
      console.error('Failed to update queue:', e);
      setQueue(previous);
      setError('Failed to update queue');
      return false;
    }
  };

  const advanceQueue = async () => {
    try {
      const response = await fetch('/api/queue/next', { method: 'POST' });
      if (response.ok) {
        // Refetch queue state to update current_index
        await fetchQueue();
        return true;
      } else if (response.status === 409) {
        return false; // Queue complete or empty
      }
      return false;
    } catch (e) {
      console.error('Failed to advance queue:', e);
      return false;
    }
  };

  // Jumps to (and starts) an arbitrary queue position - used both for the "Back" transport
  // control (index - 1) and for clicking a specific segment in the run-of-show list.
  const startAtIndex = async (index: number) => {
    try {
      const response = await fetch(`/api/queue/start-at/${index}`, { method: 'POST' });
      if (response.ok) {
        await fetchQueue();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to start at queue index:', e);
      return false;
    }
  };

  const addToQueue = (segmentName: string) => {
    const newNames = [...queue.names, segmentName];
    return updateQueue(newNames);
  };

  const removeFromQueue = (index: number) => {
    const newNames = queue.names.filter((_, i) => i !== index);
    return updateQueue(newNames);
  };

  const moveInQueue = (fromIndex: number, toIndex: number) => {
    const newNames = [...queue.names];
    const [removed] = newNames.splice(fromIndex, 1);
    newNames.splice(toIndex, 0, removed);
    return updateQueue(newNames);
  };

  // Segments at index < lockedCount have already played (or are currently playing) and
  // must not be reordered or removed while the service is active - the server rejects it.
  const lockedCount = queue.current_index >= 0 ? queue.current_index + 1 : 0;

  return {
    queue,
    loading,
    error,
    clearError: () => setError(null),
    lockedCount,
    updateQueue,
    advanceQueue,
    startAtIndex,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    refetch: fetchQueue,
  };
}

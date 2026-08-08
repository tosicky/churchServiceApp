import { useEffect, useState } from 'react';

export interface ServiceQueue {
  names: string[];
  current_index: number;
}

export function useServiceQueue() {
  const [queue, setQueue] = useState<ServiceQueue>({ names: [], current_index: -1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

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
    try {
      const response = await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names,
          current_index: queue.current_index
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setQueue(updated);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to update queue:', e);
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

  return { queue, loading, updateQueue, advanceQueue, addToQueue, removeFromQueue, moveInQueue, refetch: fetchQueue };
}

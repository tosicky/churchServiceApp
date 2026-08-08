import { useEffect, useState } from 'react';

export interface Segment {
  name: string;
  duration: number; // in seconds
}

export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const response = await fetch('/api/segments');
      const data = await response.json();
      setSegments(data.segments);
    } catch (e) {
      console.error('Failed to fetch segments:', e);
    } finally {
      setLoading(false);
    }
  };

  const addSegment = async (name: string, duration: number) => {
    try {
      const response = await fetch(`/api/segments?name=${encodeURIComponent(name)}&duration=${duration}`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchSegments();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to add segment:', e);
      return false;
    }
  };

  const updateSegment = async (name: string, newName?: string, duration?: number) => {
    try {
      const params = new URLSearchParams();
      if (newName) params.append('new_name', newName);
      if (duration !== undefined) params.append('duration', duration.toString());

      const response = await fetch(`/api/segments/${encodeURIComponent(name)}?${params}`, {
        method: 'PUT',
      });
      if (response.ok) {
        await fetchSegments();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to update segment:', e);
      return false;
    }
  };

  const deleteSegment = async (name: string) => {
    try {
      const response = await fetch(`/api/segments/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchSegments();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete segment:', e);
      return false;
    }
  };

  return { segments, loading, addSegment, updateSegment, deleteSegment, refetch: fetchSegments };
}

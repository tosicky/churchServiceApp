import { useEffect, useState } from 'react';

export interface Template {
  name: string;
  description: string;
  segment_names: string[];
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      } else {
        setError('Failed to fetch templates');
      }
    } catch (e) {
      console.error('Failed to fetch templates:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (name: string, description: string = '') => {
    try {
      setError(null);
      const params = new URLSearchParams({
        name,
        description
      });
      const response = await fetch(`/api/templates?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        await fetchTemplates();
        return { success: true, template: data.template };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || 'Failed to save template';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save template';
      setError(errorMsg);
      console.error('Failed to save template:', e);
      return { success: false, error: errorMsg };
    }
  };

  const loadTemplate = async (templateName: string) => {
    try {
      setError(null);
      // Use the queue/load-template endpoint (not templates/{name}/load) - it resets
      // the timer and broadcasts the change over the WebSocket, so the display screen
      // and any other connected controllers pick up the new queue immediately. It
      // returns HTTP 200 with {success: false, error} rather than raising on failure.
      const response = await fetch(`/api/queue/load-template/${templateName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success !== false) {
        return { success: true, queue: data.queue };
      }
      const errorMsg = data.error || data.detail || 'Failed to load template';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load template';
      setError(errorMsg);
      console.error('Failed to load template:', e);
      return { success: false, error: errorMsg };
    }
  };

  const deleteTemplate = async (templateName: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/templates/${templateName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        await fetchTemplates();
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || 'Failed to delete template';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to delete template';
      setError(errorMsg);
      console.error('Failed to delete template:', e);
      return { success: false, error: errorMsg };
    }
  };

  return {
    templates,
    loading,
    error,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    refetch: fetchTemplates
  };
}

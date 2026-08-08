import { useState, useEffect } from 'react';
import { startTimer, pauseTimer, resetTimer, addTime, subtractTime } from '../lib/api';
import { useSegments } from '../hooks/useSegments';
import { useServiceQueue } from '../hooks/useServiceQueue';
import { useTheme } from '../hooks/useTheme';

export function ControlPanel() {
  const { theme } = useTheme();
  const { segments, loading: segmentsLoading, addSegment, updateSegment, deleteSegment } = useSegments();
  const { queue, loading: queueLoading, advanceQueue, addToQueue, removeFromQueue, moveInQueue, refetch: refetchQueue } = useServiceQueue();
  const [selectedSegment, setSelectedSegment] = useState<string>('');

  // Initialize selectedSegment to first available segment once segments load
  useEffect(() => {
    if (segments.length > 0 && !selectedSegment) {
      setSelectedSegment(segments[0].name);
    }
  }, [segments, selectedSegment]);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManage, setShowManage] = useState(true);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDuration, setNewSegmentDuration] = useState(10);
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [templateNotification, setTemplateNotification] = useState<string | null>(null);
  const [showQueueDisplay, setShowQueueDisplay] = useState(true);
  const [templates, setTemplates] = useState<Array<{name: string; description: string}>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateDescription, setSaveTemplateDescription] = useState('');

  // Load templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  const selectedDuration = customDuration ?? (segments.find(s => s.name === selectedSegment)?.duration ?? 0) / 60;

  const handleSegmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedSegment(name);
    setCustomDuration(null);
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await startTimer(selectedSegment, Math.round(selectedDuration * 60));
    } catch (e) {
      console.error('Start failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      await pauseTimer();
    } catch (e) {
      console.error('Pause failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetTimer();
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (minutes: number) => {
    setLoading(true);
    try {
      await addTime(minutes * 60);
    } catch (e) {
      console.error('Add failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubtract = async () => {
    setLoading(true);
    try {
      await subtractTime(60);
    } catch (e) {
      console.error('Subtract failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSegment = async () => {
    if (!newSegmentName.trim()) return;
    setLoading(true);
    try {
      const success = await addSegment(newSegmentName, newSegmentDuration * 60);
      if (success) {
        setNewSegmentName('');
        setNewSegmentDuration(10);
        setShowAddForm(false);
      }
    } catch (e) {
      console.error('Add segment failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (segmentName: string) => {
    const segment = segments.find(s => s.name === segmentName);
    if (segment) {
      setEditingSegment(segmentName);
      setEditName(segmentName);
      setEditDuration(segment.duration / 60);
    }
  };

  const handleUpdateSegment = async () => {
    if (!editingSegment || !editName.trim()) return;
    setLoading(true);
    try {
      const success = await updateSegment(
        editingSegment,
        editName !== editingSegment ? editName : undefined,
        editDuration * 60
      );
      if (success) {
        setEditingSegment(null);
        setEditName('');
        setEditDuration(0);
      }
    } catch (e) {
      console.error('Update segment failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSegment = async (segmentName: string) => {
    if (!confirm(`Delete "${segmentName}"?`)) return;
    setLoading(true);
    try {
      await deleteSegment(segmentName);
      if (selectedSegment === segmentName && segments.length > 1) {
        const nextSeg = segments.find(s => s.name !== segmentName);
        if (nextSeg) setSelectedSegment(nextSeg.name);
      }
    } catch (e) {
      console.error('Delete segment failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const isSegmentInQueue = (segmentName: string) => {
    return queue.names.includes(segmentName);
  };


  const handleRemoveFromQueue = async (index: number) => {
    setLoading(true);
    try {
      await removeFromQueue(index);
    } catch (e) {
      console.error('Remove from queue failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveInQueue = async (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= queue.names.length) return;
    setLoading(true);
    try {
      await moveInQueue(fromIndex, toIndex);
    } catch (e) {
      console.error('Move in queue failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceQueue = async () => {
    setLoading(true);
    try {
      const success = await advanceQueue();
      if (!success) {
        alert('Queue complete or empty');
      }
    } catch (e) {
      console.error('Advance queue failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/queue/load-template/${selectedTemplate}`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        await refetchQueue();
        setError(null);
        // Show notification message
        setTemplateNotification(data.message);
        setTimeout(() => setTemplateNotification(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load template');
        setTemplateNotification(null);
      }
    } catch (e) {
      console.error('Load template failed:', e);
      setError('Failed to load template');
      setTemplateNotification(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `name=${encodeURIComponent(saveTemplateName)}&description=${encodeURIComponent(saveTemplateDescription)}`,
      });
      if (response.ok) {
        // Refresh templates list
        const templatesResponse = await fetch('/api/templates');
        if (templatesResponse.ok) {
          const data = await templatesResponse.json();
          setTemplates(data.templates || []);
        }
        setSaveTemplateName('');
        setSaveTemplateDescription('');
        setShowSaveTemplate(false);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to save template');
      }
    } catch (e) {
      console.error('Save template failed:', e);
      setError('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg shadow-md p-6 space-y-6 ${
      theme === 'dark'
        ? 'bg-gray-800 text-gray-100'
        : 'bg-white text-gray-900'
    }`}>
      {/* Segment Selection */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Service Segment
            </label>
            <select
              value={selectedSegment}
              onChange={handleSegmentSelect}
              disabled={loading || segmentsLoading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {segments.map(seg => (
                <option key={seg.name} value={seg.name}>
                  {seg.name} ({Math.round(seg.duration / 60)}m)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Duration (minutes)
            </label>
            <input
              type="number"
              value={customDuration ?? selectedDuration}
              onChange={(e) => setCustomDuration(Math.max(1, parseInt(e.target.value) || 1))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              disabled={loading}
              min="1"
            />
          </div>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition text-sm"
          >
            + Add New Segment
          </button>
        )}
      </div>

      {/* Add New Segment Form */}
      {showAddForm && (
        <div className={`border-t pt-4 space-y-3 p-4 rounded ${
          theme === 'dark'
            ? 'bg-purple-900/20 border-gray-700'
            : 'bg-purple-50'
        }`}>
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Add Special Event Segment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Segment Name
              </label>
              <input
                type="text"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                placeholder="e.g., Baptism, Dedication..."
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Duration (minutes)
              </label>
              <input
                type="number"
                value={newSegmentDuration}
                onChange={(e) => setNewSegmentDuration(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={loading}
                min="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAddSegment}
              disabled={loading || !newSegmentName.trim()}
              className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
            >
              Save
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manage Segments */}
      <div className={`border-t pt-4 ${theme === 'dark' ? 'border-gray-700' : ''}`}>
        <button
          onClick={() => setShowManage(!showManage)}
          className={`text-sm font-semibold ${
            theme === 'dark'
              ? 'text-gray-300 hover:text-gray-100'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          {showManage ? '▼' : '▶'} Manage Segments
        </button>
        {showManage && (
          <div className={`mt-3 space-y-2 p-3 rounded ${
            theme === 'dark'
              ? 'bg-gray-700/50'
              : 'bg-gray-50'
          }`}>
            {segments.map(seg => (
              <div key={seg.name} className={`flex items-center justify-between gap-2 p-2 rounded border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-white border-gray-200'
              }`}>
                {editingSegment === seg.name ? (
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={loading}
                      className={`px-2 py-1 border rounded text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-100'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                    <input
                      type="number"
                      value={editDuration}
                      onChange={(e) => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={loading}
                      min="1"
                      className={`px-2 py-1 border rounded text-sm ${
                        theme === 'dark'
                          ? 'bg-gray-600 border-gray-500 text-gray-100'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleUpdateSegment}
                        disabled={loading}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs font-semibold py-1 rounded transition"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingSegment(null)}
                        disabled={loading}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white text-xs font-semibold py-1 rounded transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium">{seg.name} ({Math.round(seg.duration / 60)}m)</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      <button
                        onClick={() => startEditing(seg.name)}
                        disabled={loading}
                        className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded transition"
                      >
                        Edit
                      </button>
                      {isSegmentInQueue(seg.name) ? (
                        <span className="px-2 py-1 text-xs bg-gray-300 text-gray-500 rounded cursor-not-allowed">
                          ✓ In Queue
                        </span>
                      ) : (
                        <button
                          onClick={() => addToQueue(seg.name)}
                          disabled={loading}
                          className="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white rounded transition"
                        >
                          + Queue
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSegment(seg.name)}
                        disabled={loading}
                        className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Loading */}
      <div className="border-t pt-4">
        <div className="space-y-3">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>Load Template</label>
            <div className="flex gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                disabled={loading || templates.length === 0}
                className={`flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">Select a template...</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.name} value={tmpl.name}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLoadTemplate}
                disabled={loading || !selectedTemplate}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition text-sm"
              >
                Load
              </button>
            </div>
            {templateNotification && (
              <div className={`mt-2 p-2 rounded text-sm font-medium ${
                theme === 'dark'
                  ? 'bg-blue-900/30 border border-blue-700 text-blue-300'
                  : 'bg-blue-100 border border-blue-300 text-blue-700'
              }`}>
                ✓ {templateNotification}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSaveTemplateName('');
              setSaveTemplateDescription('');
              setShowSaveTemplate(true);
            }}
            disabled={loading || queue.names.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition text-sm"
          >
            💾 Save Queue as Template
          </button>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="border-t pt-4 bg-purple-50 p-4 rounded">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Save Queue as Template</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g., Sunday Service"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={saveTemplateDescription}
                onChange={(e) => setSaveTemplateDescription(e.target.value)}
                placeholder="e.g., Standard Sunday morning service"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveTemplate}
                disabled={loading || !saveTemplateName.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveTemplate(false)}
                disabled={loading}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Run of Show Queue */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowQueueDisplay(!showQueueDisplay)}
          className="text-sm font-semibold text-gray-700 hover:text-gray-900 mb-2"
        >
          {showQueueDisplay ? '▼' : '▶'} Today's Run of Show ({queue.names.length} segments)
        </button>
        {showQueueDisplay && (
        <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded">
          {queue.names.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Queue is empty. Add segments above.</p>
          ) : (
            <>
              {queue.names.map((name, index) => (
                <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-blue-50 transition">
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch(`/api/queue/start-at/${index}`, { method: 'POST' });
                        if (response.ok) {
                          await refetchQueue();
                        } else {
                          const data = await response.json();
                          setError(data.error || 'Failed to start at segment');
                        }
                      } catch (e) {
                        console.error('Start at segment failed:', e);
                        setError('Failed to start at segment');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="text-sm font-medium flex-1 text-left hover:text-blue-600 cursor-pointer transition disabled:opacity-50"
                  >
                    {index + 1}. {name}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMoveInQueue(index, 'up')}
                      disabled={loading || index === 0}
                      className="px-2 py-1 text-xs bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white rounded transition"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveInQueue(index, 'down')}
                      disabled={loading || index === queue.names.length - 1}
                      className="px-2 py-1 text-xs bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white rounded transition"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveFromQueue(index)}
                      disabled={loading}
                      className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={handleAdvanceQueue}
                  disabled={loading || queueLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded transition text-lg"
                >
                  ▶ Next Segment
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const response = await fetch('/api/queue/reset', { method: 'POST' });
                      if (response.ok) {
                        await refetchQueue();
                      }
                    } catch (e) {
                      console.error('Reset queue failed:', e);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || queueLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded transition text-lg"
                >
                  ↻ Replay Queue
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* Timer Controls */}
      <div className="grid grid-cols-3 gap-2 border-t pt-4">
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition"
        >
          Start
        </button>
        <button
          onClick={handlePause}
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition"
        >
          Pause
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition"
        >
          Reset
        </button>
      </div>

      {/* Time Adjustments */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleAdd(1)}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition text-sm"
        >
          +1m
        </button>
        <button
          onClick={() => handleAdd(5)}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition text-sm"
        >
          +5m
        </button>
        <button
          onClick={handleSubtract}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition text-sm"
        >
          -1m
        </button>
      </div>

      {/* Keyboard Shortcuts Legend */}
      <div className="border-t pt-4 text-xs text-gray-600">
        <p className="font-semibold mb-2">Keyboard Shortcuts:</p>
        <div className="grid grid-cols-2 gap-2">
          <p><kbd className="bg-gray-200 px-2 py-1 rounded">Space</kbd> Start/Pause</p>
          <p><kbd className="bg-gray-200 px-2 py-1 rounded">↑↓</kbd> ±1 minute</p>
          <p><kbd className="bg-gray-200 px-2 py-1 rounded">R</kbd> Reset</p>
        </div>
      </div>
    </div>
  );
}

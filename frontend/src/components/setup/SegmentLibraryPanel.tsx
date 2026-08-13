import { useState } from 'react';
import { useServiceData } from '../../contexts/ServiceDataContext';
import { Button } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';

export function SegmentLibraryPanel() {
  const { segments, addSegment, updateSegment, deleteSegment, queue, addToQueue } = useServiceData();

  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDuration, setNewSegmentDuration] = useState(10);
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(0);

  const isSegmentInQueue = (segmentName: string) => queue.names.includes(segmentName);

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
    const segment = segments.find((s) => s.name === segmentName);
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
    } catch (e) {
      console.error('Delete segment failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-content">Segment Library</h3>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} disabled={loading} variant="primary" size="sm">
            + Add Segment
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="space-y-3 p-4 rounded-lg bg-accent-soft border border-accent/30">
          <h4 className="font-semibold text-sm text-content">Add Special Event Segment</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Segment Name">
              <input
                type="text"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                placeholder="e.g., Baptism, Dedication..."
                disabled={loading}
                className={inputClass}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                value={newSegmentDuration}
                onChange={(e) => setNewSegmentDuration(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={loading}
                min="1"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleAddSegment} disabled={loading || !newSegmentName.trim()} variant="primary">
              Save
            </Button>
            <Button onClick={() => setShowAddForm(false)} disabled={loading} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg) => (
          <div
            key={seg.name}
            className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-surface border-line"
          >
            {editingSegment === seg.name ? (
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
                <input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={loading}
                  min="1"
                  className={inputClass}
                />
                <div className="flex gap-1">
                  <Button onClick={handleUpdateSegment} disabled={loading} variant="success" size="sm" className="flex-1">
                    ✓
                  </Button>
                  <Button onClick={() => setEditingSegment(null)} disabled={loading} variant="secondary" size="sm" className="flex-1">
                    ✕
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-content">
                  {seg.name} ({Math.round(seg.duration / 60)}m)
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  <Button onClick={() => startEditing(seg.name)} disabled={loading} variant="secondary" size="sm">
                    Edit
                  </Button>
                  {isSegmentInQueue(seg.name) ? (
                    <span className="px-3 py-1.5 text-xs bg-surface-subtle text-content-muted rounded-md cursor-not-allowed">
                      ✓ In Queue
                    </span>
                  ) : (
                    <Button onClick={() => addToQueue(seg.name)} disabled={loading} variant="primary" size="sm">
                      + Queue
                    </Button>
                  )}
                  <Button onClick={() => handleDeleteSegment(seg.name)} disabled={loading} variant="danger" size="sm">
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

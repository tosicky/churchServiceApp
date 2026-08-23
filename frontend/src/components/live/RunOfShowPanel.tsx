import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { useServiceData } from '../../contexts/ServiceDataContext';
import { SortableQueueItem } from '../SortableQueueItem';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Field, inputClass } from '../ui/Field';

export function RunOfShowPanel() {
  const {
    queue,
    queueLoading,
    queueError,
    clearQueueError,
    lockedCount,
    moveInQueue,
    removeFromQueue,
    startAtIndex,
    refetchQueue,
    addSegment,
    addToQueue,
  } = useServiceData();

  const [loading, setLoading] = useState(false);
  const [startAtError, setStartAtError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDuration, setNewSegmentDuration] = useState(10);
  const [addingSegment, setAddingSegment] = useState(false);
  const [addSegmentError, setAddSegmentError] = useState<string | null>(null);

  const handleAddSegment = async () => {
    const name = newSegmentName.trim();
    if (!name) return;
    setAddingSegment(true);
    setAddSegmentError(null);
    try {
      const created = await addSegment(name, Math.round(newSegmentDuration * 60));
      if (!created) {
        setAddSegmentError('Failed to create segment');
        return;
      }
      const queued = await addToQueue(name);
      if (!queued) {
        setAddSegmentError(`"${name}" was created in the segment library, but couldn't be added to the queue`);
        return;
      }
      setNewSegmentName('');
      setNewSegmentDuration(10);
      setShowAddForm(false);
    } finally {
      setAddingSegment(false);
    }
  };

  const handleStartAtSegment = async (index: number) => {
    setLoading(true);
    try {
      const success = await startAtIndex(index);
      setStartAtError(success ? null : 'Failed to start at segment');
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

  const handleReplayQueue = async () => {
    // Only worth confirming once the service is actually underway - resetting an
    // untouched queue destroys nothing.
    if (queue.current_index > -1 && !confirm('Restart the queue from the beginning? This stops the current segment.')) {
      return;
    }
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
  };

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = queue.names.indexOf(active.id as string);
    const toIndex = queue.names.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;
    if (fromIndex < lockedCount || toIndex < lockedCount) return;
    setLoading(true);
    try {
      await moveInQueue(fromIndex, toIndex);
    } catch (e) {
      console.error('Drag reorder failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-content-secondary">
          Today's Run of Show ({queue.names.length} segment{queue.names.length !== 1 ? 's' : ''})
        </h3>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="primary" size="sm">
            + Add Segment
          </Button>
        )}
      </div>

      {queueError && (
        <Alert tone="error" onDismiss={clearQueueError}>
          {queueError}
        </Alert>
      )}
      {startAtError && (
        <Alert tone="error" onDismiss={() => setStartAtError(null)}>
          {startAtError}
        </Alert>
      )}

      {showAddForm && (
        <div className="space-y-3 p-4 rounded-lg bg-accent-soft border border-accent/30">
          <h4 className="font-semibold text-sm text-content">Add Segment to Run of Show</h4>
          <p className="text-xs text-content-secondary">
            Creates it in the segment library and appends it to the end of the queue - no need to visit Setup.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Segment Name">
              <input
                type="text"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                placeholder="e.g., Special Announcement"
                disabled={addingSegment}
                className={inputClass}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                value={newSegmentDuration}
                onChange={(e) => setNewSegmentDuration(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={addingSegment}
                min="1"
                className={inputClass}
              />
            </Field>
          </div>
          {addSegmentError && <Alert tone="error">{addSegmentError}</Alert>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleAddSegment} disabled={addingSegment || !newSegmentName.trim()} variant="primary">
              {addingSegment ? 'Adding...' : 'Add to Queue'}
            </Button>
            <Button
              onClick={() => {
                setShowAddForm(false);
                setAddSegmentError(null);
              }}
              disabled={addingSegment}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {queue.names.length === 0 ? (
        <p className="text-sm text-content-secondary text-center py-6">
          Queue is empty. Add a segment above, or load a template from the Setup tab.
        </p>
      ) : (
        <>
          <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1">
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={queue.names} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {queue.names.map((name, index) => (
                    <SortableQueueItem
                      key={name}
                      name={name}
                      index={index}
                      currentIndex={queue.current_index}
                      locked={index < lockedCount}
                      loading={loading}
                      disableUp={loading || index <= lockedCount}
                      disableDown={loading || index >= queue.names.length - 1 || index < lockedCount}
                      disableRemove={loading || index < lockedCount}
                      onStartAt={handleStartAtSegment}
                      onMoveUp={(i) => handleMoveInQueue(i, 'up')}
                      onMoveDown={(i) => handleMoveInQueue(i, 'down')}
                      onRemove={handleRemoveFromQueue}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <Button onClick={handleReplayQueue} disabled={loading || queueLoading} variant="secondary" className="w-full">
            ↻ Replay Queue
          </Button>
        </>
      )}
    </div>
  );
}

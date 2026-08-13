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

export function RunOfShowPanel() {
  const {
    queue,
    queueLoading,
    queueError,
    clearQueueError,
    lockedCount,
    moveInQueue,
    removeFromQueue,
    refetchQueue,
  } = useServiceData();

  const [loading, setLoading] = useState(false);
  const [startAtError, setStartAtError] = useState<string | null>(null);

  const handleStartAtSegment = async (index: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/queue/start-at/${index}`, { method: 'POST' });
      if (response.ok) {
        await refetchQueue();
        setStartAtError(null);
      } else {
        const data = await response.json();
        setStartAtError(data.error || 'Failed to start at segment');
      }
    } catch (e) {
      console.error('Start at segment failed:', e);
      setStartAtError('Failed to start at segment');
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
      <h3 className="text-sm font-semibold text-content-secondary">
        Today's Run of Show ({queue.names.length} segment{queue.names.length !== 1 ? 's' : ''})
      </h3>

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

      {queue.names.length === 0 ? (
        <p className="text-sm text-content-secondary text-center py-6">
          Queue is empty. Add segments or load a template from the Setup tab.
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

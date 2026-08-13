import { createContext, useContext, type ReactNode } from 'react';
import { useTimerSocket } from '../hooks/useTimerSocket';
import { useSegments, type Segment } from '../hooks/useSegments';
import { useServiceQueue, type ServiceQueue } from '../hooks/useServiceQueue';
import type { TimerState } from '../lib/api';

interface ServiceDataContextValue {
  // Live timer state (single shared WebSocket connection)
  state: TimerState | null;
  connected: boolean;

  // Segment library
  segments: Segment[];
  segmentsLoading: boolean;
  addSegment: (name: string, duration: number) => Promise<boolean>;
  updateSegment: (name: string, newName?: string, duration?: number) => Promise<boolean>;
  deleteSegment: (name: string) => Promise<boolean>;
  refetchSegments: () => Promise<void>;

  // Run-of-show queue (single shared instance so the queue list, the Templates
  // modal, and the Setup tab's segment library all agree on the same state)
  queue: ServiceQueue;
  queueLoading: boolean;
  queueError: string | null;
  clearQueueError: () => void;
  lockedCount: number;
  updateQueue: (names: string[]) => Promise<boolean>;
  advanceQueue: () => Promise<boolean>;
  addToQueue: (segmentName: string) => Promise<boolean>;
  removeFromQueue: (index: number) => Promise<boolean>;
  moveInQueue: (fromIndex: number, toIndex: number) => Promise<boolean>;
  refetchQueue: () => Promise<void>;
}

const ServiceDataContext = createContext<ServiceDataContextValue | null>(null);

export function ServiceDataProvider({ children }: { children: ReactNode }) {
  const { state, connected } = useTimerSocket();

  const {
    segments,
    loading: segmentsLoading,
    addSegment,
    updateSegment,
    deleteSegment,
    refetch: refetchSegments,
  } = useSegments();

  const liveCurrentIndex = state?.queue_position != null ? state.queue_position - 1 : undefined;
  const {
    queue,
    loading: queueLoading,
    error: queueError,
    clearError: clearQueueError,
    lockedCount,
    updateQueue,
    advanceQueue,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    refetch: refetchQueue,
  } = useServiceQueue(state?.queue_names, liveCurrentIndex);

  return (
    <ServiceDataContext.Provider
      value={{
        state,
        connected,
        segments,
        segmentsLoading,
        addSegment,
        updateSegment,
        deleteSegment,
        refetchSegments,
        queue,
        queueLoading,
        queueError,
        clearQueueError,
        lockedCount,
        updateQueue,
        advanceQueue,
        addToQueue,
        removeFromQueue,
        moveInQueue,
        refetchQueue,
      }}
    >
      {children}
    </ServiceDataContext.Provider>
  );
}

export function useServiceData() {
  const ctx = useContext(ServiceDataContext);
  if (!ctx) {
    throw new Error('useServiceData must be used within a ServiceDataProvider');
  }
  return ctx;
}

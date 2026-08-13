import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/Button';

interface SortableQueueItemProps {
  name: string;
  index: number;
  currentIndex: number;
  locked: boolean;
  loading: boolean;
  disableUp: boolean;
  disableDown: boolean;
  disableRemove: boolean;
  onStartAt: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
}

export function SortableQueueItem({
  name,
  index,
  currentIndex,
  locked,
  loading,
  disableUp,
  disableDown,
  disableRemove,
  onStartAt,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SortableQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
    disabled: locked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPlayed = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isNext = index === currentIndex + 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-lg border transition ${
        isCurrent
          ? 'bg-success-soft border-success/40'
          : locked
          ? 'bg-surface-subtle border-line text-content-muted opacity-60'
          : 'bg-surface border-line hover:bg-accent-soft'
      }`}
    >
      {!locked ? (
        <button
          {...attributes}
          {...listeners}
          disabled={loading}
          aria-label={`Drag to reorder ${name}`}
          className="touch-none shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-content-muted hover:text-content-secondary cursor-grab active:cursor-grabbing disabled:opacity-50"
        >
          ⠿
        </button>
      ) : (
        <span
          className="shrink-0 w-[44px] flex items-center justify-center text-content-muted"
          aria-hidden="true"
          title="Already played - can't be reordered"
        >
          🔒
        </span>
      )}

      <button
        onClick={() => onStartAt(index)}
        disabled={loading}
        className="text-sm font-medium min-w-0 flex-1 basis-full sm:basis-auto truncate text-left text-content hover:text-accent cursor-pointer transition disabled:opacity-50"
      >
        {index + 1}. {name}
        {isCurrent && <span className="ml-2 text-xs font-semibold text-success">▶ Now</span>}
        {isNext && !isCurrent && <span className="ml-2 text-xs font-semibold text-accent">Up Next</span>}
        {isPlayed && <span className="ml-2 text-xs text-content-muted">✓</span>}
      </button>

      <div className="flex gap-1 ml-auto shrink-0">
        <Button onClick={() => onMoveUp(index)} disabled={disableUp} variant="ghost" size="sm" className="min-w-[44px]">
          ↑
        </Button>
        <Button onClick={() => onMoveDown(index)} disabled={disableDown} variant="ghost" size="sm" className="min-w-[44px]">
          ↓
        </Button>
        <Button onClick={() => onRemove(index)} disabled={disableRemove} variant="danger" size="sm" className="min-w-[44px]">
          <span className="sm:hidden">✕</span>
          <span className="hidden sm:inline">Remove</span>
        </Button>
      </div>
    </div>
  );
}

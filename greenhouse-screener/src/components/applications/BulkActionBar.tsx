import { X, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  selectedCount: number;
  onScreen: () => void;
  onReject: () => void;
  onClear: () => void;
  isScreening?: boolean;
  screeningProgress?: { current: number; total: number } | null;
}

export function BulkActionBar({
  selectedCount,
  onScreen,
  onReject,
  onClear,
  isScreening,
  screeningProgress,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-4 px-6 py-3 rounded-full',
        'bg-card border shadow-lg backdrop-blur-sm',
        'animate-fade-in'
      )}
    >
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onScreen}
          disabled={isScreening}
        >
          {isScreening ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {screeningProgress
                ? `${screeningProgress.current}/${screeningProgress.total}`
                : 'Screening...'}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Screen Selected
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={onReject}
          disabled={isScreening}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reject Selected
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={isScreening}
        >
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}

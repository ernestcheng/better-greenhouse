import { useRef, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ApplicationCard } from './ApplicationCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Application, ScreeningResult } from '@/types';

interface ApplicationGridProps {
  applications: Application[];
  screeningResults: Record<number, ScreeningResult>;
  selectedIds: Set<number>;
  focusedIndex: number;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (application: Application) => void;
  onFocusChange: (index: number) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export function ApplicationGrid({
  applications,
  screeningResults,
  selectedIds,
  focusedIndex,
  onToggleSelect,
  onOpenDetail,
  onFocusChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  isLoading,
}: ApplicationGridProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex >= 0 && cardRefs.current[focusedIndex]) {
      cardRefs.current[focusedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [focusedIndex]);

  const setCardRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      cardRefs.current[index] = el;
    },
    []
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-[180px] rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h3 className="text-lg font-semibold">No applications found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select a job to view applications, or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {applications.map((application, index) => (
          <ApplicationCard
            key={application.id}
            ref={setCardRef(index)}
            application={application}
            screeningResult={screeningResults[application.id] || null}
            isSelected={selectedIds.has(application.id)}
            isFocused={focusedIndex === index}
            onToggleSelect={() => onToggleSelect(application.id)}
            onClick={() => {
              onFocusChange(index);
              onOpenDetail(application);
            }}
          />
        ))}
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Application, ScreeningResult } from '@/types';

interface ApplicationTableProps {
  applications: Application[];
  screeningResults: Record<number, ScreeningResult>;
  selectedIds: Set<number>;
  focusedIndex: number;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onOpenDetail: (application: Application) => void;
  onFocusChange: (index: number) => void;
  isLoading?: boolean;
  // Pagination
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSize: number;
}

function ScreeningPreview({ result }: { result: ScreeningResult }) {
  const isGreen = result.recommendation === 'GREEN';
  
  return (
    <div className="max-w-xs space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'px-1.5 py-0.5 text-xs font-semibold rounded',
            isGreen
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          )}
        >
          {result.recommendation}
        </span>
        <span className="text-xs text-muted-foreground">
          {result.confidence} confidence
        </span>
      </div>
      <p className="text-sm">{result.summary}</p>
      {result.key_factors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Strengths</p>
          <ul className="text-xs space-y-0.5">
            {result.key_factors.slice(0, 3).map((f, i) => (
              <li key={i} className="text-green-700">+ {f}</li>
            ))}
          </ul>
        </div>
      )}
      {result.concerns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Concerns</p>
          <ul className="text-xs space-y-0.5">
            {result.concerns.slice(0, 3).map((c, i) => (
              <li key={i} className="text-red-700">− {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ApplicationTable({
  applications,
  screeningResults,
  selectedIds,
  focusedIndex,
  onToggleSelect,
  onSelectAll,
  onOpenDetail,
  onFocusChange,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  pageSize,
}: ApplicationTableProps) {
  const allSelected = applications.length > 0 && applications.every(a => selectedIds.has(a.id));
  const someSelected = applications.some(a => selectedIds.has(a.id)) && !allSelected;

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-2 space-y-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <span className="text-xl">📋</span>
        </div>
        <h3 className="font-semibold">No applications found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select a job or adjust your filters.
        </p>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-2 py-2">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el && someSelected) {
                      el.dataset.state = 'indeterminate';
                    }
                  }}
                  onCheckedChange={onSelectAll}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="px-2 py-2 font-medium">Candidate</th>
              <th className="px-2 py-2 font-medium hidden md:table-cell">Email</th>
              <th className="px-2 py-2 font-medium w-20">Applied</th>
              <th className="px-2 py-2 font-medium w-20 hidden lg:table-cell">Source</th>
              <th className="px-2 py-2 font-medium">AI Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {applications.map((application, index) => {
              const { candidate, applied_at, source } = application;
              const fullName = `${candidate.first_name} ${candidate.last_name}`;
              const screeningResult = screeningResults[application.id];
              const isSelected = selectedIds.has(application.id);
              const isFocused = focusedIndex === index;
              const isGreen = screeningResult?.recommendation === 'GREEN';

              return (
                <tr
                  key={application.id}
                  className={cn(
                    'hover:bg-muted/30 cursor-pointer transition-colors',
                    isSelected && 'bg-primary/5',
                    isFocused && 'ring-1 ring-inset ring-primary'
                  )}
                  onClick={() => {
                    onFocusChange(index);
                    onOpenDetail(application);
                  }}
                >
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(application.id)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {screeningResult && (
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            isGreen ? 'bg-green-500' : 'bg-red-500'
                          )}
                        />
                      )}
                      <span className="font-medium truncate max-w-[180px]">{fullName}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px] hidden md:table-cell">
                    {candidate.email}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground text-xs whitespace-nowrap">
                    {formatRelativeTime(applied_at)}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground text-xs truncate max-w-[100px] hidden lg:table-cell">
                    {source?.name || '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    {screeningResult ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-default">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-xs font-medium rounded shrink-0',
                                isGreen
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              )}
                            >
                              {screeningResult.recommendation}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {screeningResult.summary}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="p-3">
                          <ScreeningPreview result={screeningResult} />
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not screened</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-xs text-muted-foreground">
          {startIndex}–{endIndex} of {totalCount}
        </p>
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            className="h-7 px-2"
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          {/* Previous page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-7 px-2"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          {/* Next page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-7 px-2"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* Last page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="h-7 px-2"
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { forwardRef } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScreeningBadge } from '@/components/screening/ScreeningBadge';
import type { Application, ScreeningResult } from '@/types';

interface ApplicationCardProps {
  application: Application;
  screeningResult: ScreeningResult | null;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}

export const ApplicationCard = forwardRef<HTMLDivElement, ApplicationCardProps>(
  (
    {
      application,
      screeningResult,
      isSelected,
      isFocused,
      onToggleSelect,
      onClick,
    },
    ref
  ) => {
    const { candidate, applied_at, source, current_stage } = application;
    const fullName = `${candidate.first_name} ${candidate.last_name}`;

    const getBorderColor = () => {
      if (!screeningResult) return 'border-border';
      return screeningResult.recommendation === 'GREEN'
        ? 'border-l-green-500 border-l-4'
        : 'border-l-red-500 border-l-4';
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          'group relative rounded-lg border bg-card p-4 transition-all cursor-pointer',
          'hover:shadow-md hover:border-primary/30',
          getBorderColor(),
          isSelected && 'bg-primary/5 border-primary/50',
          isFocused && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClick();
          if (e.key === ' ') {
            e.preventDefault();
            onToggleSelect();
          }
        }}
      >
        {/* Selection Checkbox */}
        <div
          className="absolute top-3 left-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Card Content */}
        <div className="pl-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary">
                  {getInitials(candidate.first_name, candidate.last_name)}
                </span>
              </div>

              {/* Name and Email */}
              <div className="min-w-0">
                <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                  {fullName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {candidate.email}
                </p>
              </div>
            </div>

            {/* Screening Badge */}
            {screeningResult && (
              <ScreeningBadge
                recommendation={screeningResult.recommendation}
                confidence={screeningResult.confidence}
              />
            )}
          </div>

          {/* Meta Info */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatRelativeTime(applied_at)}
            </span>

            {source && (
              <>
                <span className="text-border">•</span>
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {source.name}
                </Badge>
              </>
            )}

            {current_stage && (
              <>
                <span className="text-border">•</span>
                <span>{current_stage.name}</span>
              </>
            )}
          </div>

          {/* Screening Summary Preview */}
          {screeningResult && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
              {screeningResult.summary}
            </p>
          )}

          {/* Hover Action Hint */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }
);

ApplicationCard.displayName = 'ApplicationCard';

import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Filters } from '@/types';

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  totalCount?: number;
}

export function FilterBar({
  filters,
  onFiltersChange,
  totalCount,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 pb-4 border-b">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter:</span>
      </div>

      {/* Screening Result Filter */}
      <Select
        value={filters.screening || 'all'}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            screening: value as Filters['screening'],
          })
        }
      >
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Screening" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Results</SelectItem>
          <SelectItem value="green">Green Only</SelectItem>
          <SelectItem value="red">Red Only</SelectItem>
          <SelectItem value="unscreened">Unscreened</SelectItem>
        </SelectContent>
      </Select>

      {/* Total Count */}
      {totalCount !== undefined && (
        <span className="ml-auto text-sm text-muted-foreground">
          {totalCount} candidate{totalCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

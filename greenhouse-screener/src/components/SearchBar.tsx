import { useState } from 'react';
import { Search, Database, Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEmbeddingStatus, useIndexStatus, useBuildIndex, useSearch } from '@/hooks/useSearch';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  jobId: number | null;
  onSearchResults: (results: Array<{ application_id: number; score: number }> | null) => void;
  isSearchActive: boolean;
}

export function SearchBar({ jobId, onSearchResults, isSearchActive }: SearchBarProps) {
  const [query, setQuery] = useState('');
  
  const { data: embeddingStatus } = useEmbeddingStatus();
  const { data: indexStatus } = useIndexStatus(jobId);
  const { mutate: buildIndex, isPending: isIndexing } = useBuildIndex();
  const { mutate: search, isPending: isSearching } = useSearch(jobId);

  const handleSearch = () => {
    if (!query.trim() || !jobId) return;
    
    search(
      { query: query.trim(), limit: 100 },
      {
        onSuccess: (data) => {
          onSearchResults(data.results.map(r => ({ 
            application_id: r.application_id, 
            score: r.score 
          })));
        },
        onError: (error) => {
          console.error('Search failed:', error);
        },
      }
    );
  };

  const handleClearSearch = () => {
    setQuery('');
    onSearchResults(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      handleClearSearch();
    }
  };

  const handleBuildIndex = () => {
    if (!jobId) return;
    buildIndex(jobId);
  };

  if (!jobId) return null;

  const embeddingAvailable = embeddingStatus?.available;
  const hasIndex = indexStatus?.indexed && indexStatus.count > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={hasIndex ? "Semantic search (e.g., 'marketing analyst with A/B testing')" : "Build index first to enable search"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hasIndex || isSearching}
          className={cn(
            "w-full h-9 pl-9 pr-9 text-sm rounded-md border bg-background",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />
        {(query || isSearchActive) && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Button */}
      <Button
        variant="default"
        size="sm"
        onClick={handleSearch}
        disabled={!hasIndex || !query.trim() || isSearching}
        className="h-9"
      >
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Search className="h-4 w-4 mr-1" />
            Search
          </>
        )}
      </Button>

      {/* Index Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBuildIndex}
              disabled={!embeddingAvailable || isIndexing}
              className={cn("h-9", hasIndex && "border-green-300")}
            >
              {isIndexing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-1" />
                  {hasIndex ? `${indexStatus.count} indexed` : 'Build Index'}
                </>
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {!embeddingAvailable ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {embeddingStatus?.error || 'Embedding service not available'}
            </div>
          ) : hasIndex ? (
            <div>
              <p>{indexStatus.count} candidates indexed</p>
              <p className="text-xs text-muted-foreground">Click to rebuild</p>
            </div>
          ) : (
            <p>Index all resumes for semantic search</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

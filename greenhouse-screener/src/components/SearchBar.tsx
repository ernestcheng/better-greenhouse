import { useState } from 'react';
import { Search, Database, Loader2, X, AlertCircle, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEmbeddingStatus, useIndexStatus, useSearch } from '@/hooks/useSearch';
import { useQueryClient } from '@tanstack/react-query';
import { ExportProgressDialog } from '@/components/ExportProgressDialog';
import { IndexProgressDialog } from '@/components/IndexProgressDialog';
import { HighlightsDialog } from '@/components/HighlightsDialog';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  jobId: number | null;
  jobRequirements?: string;
  onSearchResults: (results: Array<{ application_id: number; score: number }> | null) => void;
  isSearchActive: boolean;
}

export function SearchBar({ jobId, jobRequirements = '', onSearchResults, isSearchActive }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showIndexDialog, setShowIndexDialog] = useState(false);
  const [showHighlightsDialog, setShowHighlightsDialog] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: embeddingStatus } = useEmbeddingStatus();
  const { data: indexStatus, refetch: refetchIndexStatus } = useIndexStatus(jobId);
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

  const handleIndexComplete = () => {
    // Refresh the index status after indexing completes
    refetchIndexStatus();
    queryClient.invalidateQueries({ queryKey: ['index-status', jobId] });
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
              onClick={() => setShowIndexDialog(true)}
              disabled={!embeddingAvailable}
              className={cn("h-9", hasIndex && "border-green-300")}
            >
              <Database className="h-4 w-4 mr-1" />
              {hasIndex ? `${indexStatus.count} indexed` : 'Build Index'}
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

      {/* Export Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Export all resumes as JSON for LLM processing</p>
        </TooltipContent>
      </Tooltip>

      {/* AI Highlights Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHighlightsDialog(true)}
            className="h-9"
          >
            <Sparkles className="h-4 w-4 mr-1 text-yellow-500" />
            AI Highlights
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Use AI to find and rank the top 100 candidates</p>
        </TooltipContent>
      </Tooltip>

      {/* Index Progress Dialog */}
      <IndexProgressDialog
        isOpen={showIndexDialog}
        jobId={jobId}
        onClose={() => setShowIndexDialog(false)}
        onComplete={handleIndexComplete}
      />

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        isOpen={showExportDialog}
        jobId={jobId}
        onClose={() => setShowExportDialog(false)}
      />

      {/* Highlights Dialog */}
      <HighlightsDialog
        isOpen={showHighlightsDialog}
        jobId={jobId}
        jobRequirements={jobRequirements}
        onClose={() => setShowHighlightsDialog(false)}
      />
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Sparkles, Loader2, CheckCircle2, XCircle, ExternalLink, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface HighlightedCandidate {
  rank: number;
  application_id: number;
  candidate_id: number;
  candidate_name: string;
  greenhouse_url: string;
  score: number;
  summary: string;
  tier: 'TOP' | 'STRONG' | 'GOOD';
}

interface HighlightsDialogProps {
  isOpen: boolean;
  jobId: number | null;
  jobRequirements: string;
  onClose: () => void;
}

type Phase = 'idle' | 'init' | 'fetching' | 'extracting' | 'analyzing' | 'complete' | 'error';

export function HighlightsDialog({ isOpen, jobId, jobRequirements, onClose }: HighlightsDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ processed: 0, total: 0, percent: 0 });
  const [fetchingProgress, setFetchingProgress] = useState({ page: 0, fetched: 0 });
  const [highlights, setHighlights] = useState<HighlightedCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      startHighlights(jobId);
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen, jobId]);

  const startHighlights = (jobId: number) => {
    setPhase('init');
    setMessage('Starting highlights generation...');
    setProgress({ processed: 0, total: 0, percent: 0 });
    setFetchingProgress({ page: 0, fetched: 0 });
    setHighlights([]);
    setError(null);

    const params = new URLSearchParams({ 
      top_n: '100',
      requirements: jobRequirements || ''
    });
    const eventSource = new EventSource(`/api/search/highlights/${jobId}?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setPhase(data.phase);
      setMessage(data.message);
      if (data.total) {
        setProgress(prev => ({ ...prev, total: data.total }));
      }
    });

    eventSource.addEventListener('fetching', (e) => {
      const data = JSON.parse(e.data);
      setFetchingProgress({ page: data.page, fetched: data.fetched });
      setMessage(data.message);
    });

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress({
        processed: data.processed,
        total: data.total,
        percent: data.percent,
      });
      setMessage(data.message);
    });

    eventSource.addEventListener('batch', (e) => {
      const data = JSON.parse(e.data);
      setMessage(data.message);
      // Update progress for batch processing
      setProgress({
        processed: data.batch,
        total: data.totalBatches,
        percent: Math.round((data.batch / data.totalBatches) * 100),
      });
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setHighlights(data.highlights || []);
      setPhase('complete');
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as any).data);
        setError(data.message);
      } catch {
        setError('Highlights generation failed');
      }
      setPhase('error');
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (phase !== 'complete') {
        setError('Connection lost');
        setPhase('error');
      }
      eventSource.close();
    };
  };

  const handleCopyAll = () => {
    const text = highlights
      .map(h => `${h.rank}. ${h.candidate_name} - ${h.greenhouse_url}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setPhase('idle');
    onClose();
  };

  const tierColors = {
    TOP: 'bg-yellow-500 text-yellow-950',
    STRONG: 'bg-blue-500 text-white',
    GOOD: 'bg-green-500 text-white',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === 'complete' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : phase === 'error' ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Sparkles className="h-5 w-5 text-yellow-500" />
            )}
            AI Highlights
          </DialogTitle>
          <DialogDescription>
            {phase === 'complete' 
              ? `Found ${highlights.length} top candidates`
              : phase === 'error'
              ? 'Generation failed'
              : 'Analyzing all candidates to find the best...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Fetching Progress */}
          {phase === 'fetching' && fetchingProgress.page > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Fetching page {fetchingProgress.page}...</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {fetchingProgress.fetched} applications loaded
              </div>
            </div>
          )}

          {/* Extracting/Analyzing Progress */}
          {(phase === 'extracting' || phase === 'analyzing') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{message}</span>
              </div>
              {phase === 'extracting' && progress.total > 0 && (
                <>
                  <Progress value={progress.percent} className="h-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{progress.processed} / {progress.total}</span>
                    <span>{progress.percent}%</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Init/Error Status */}
          {(phase === 'init' || phase === 'error') && (
            <div className="flex items-center gap-2 text-sm">
              {phase === 'init' && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className={phase === 'error' ? 'text-destructive' : ''}>
                {error || message}
              </span>
            </div>
          )}

          {/* Results List */}
          {phase === 'complete' && highlights.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {highlights.length} highlighted candidates
                </span>
                <Button variant="outline" size="sm" onClick={handleCopyAll}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy All Links'}
                </Button>
              </div>
              
              <div className="flex-1 border rounded-md overflow-y-auto">
                <div className="divide-y">
                  {highlights.map((h) => (
                    <div key={h.application_id} className="p-3 hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-muted-foreground w-6">
                              #{h.rank}
                            </span>
                            <Badge className={tierColors[h.tier]} variant="secondary">
                              {h.tier}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Score: {h.score}
                            </span>
                          </div>
                          <a 
                            href={h.greenhouse_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            {h.candidate_name}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {h.summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close/Cancel Button */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>
            {phase === 'complete' || phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Database, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface IndexProgressDialogProps {
  isOpen: boolean;
  jobId: number | null;
  onClose: () => void;
  onComplete: () => void;
}

type IndexPhase = 'idle' | 'init' | 'fetching' | 'processing' | 'complete' | 'error';

export function IndexProgressDialog({ isOpen, jobId, onClose, onComplete }: IndexProgressDialogProps) {
  const [phase, setPhase] = useState<IndexPhase>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ processed: 0, total: 0, percent: 0, indexed: 0, failed: 0 });
  const [fetchingProgress, setFetchingProgress] = useState({ page: 0, fetched: 0 });
  const [currentBatch, setCurrentBatch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      startIndexing(jobId);
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen, jobId]);

  const startIndexing = async (jobId: number) => {
    setPhase('init');
    setMessage('Starting...');
    setProgress({ processed: 0, total: 0, percent: 0, indexed: 0, failed: 0 });
    setFetchingProgress({ page: 0, fetched: 0 });
    setCurrentBatch('');
    setError(null);

    // Use fetch with POST to initiate, then read as event stream
    try {
      const response = await fetch(`/api/search/index/${jobId}`, {
        method: 'POST',
        headers: { 'Accept': 'text/event-stream' },
      });

      if (!response.ok) {
        throw new Error('Failed to start indexing');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            const data = JSON.parse(line.slice(6));
            handleEvent(currentEvent, data);
            currentEvent = '';
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  };

  const handleEvent = (event: string, data: any) => {
    switch (event) {
      case 'status':
        setPhase(data.phase);
        setMessage(data.message);
        if (data.total) {
          setProgress(prev => ({ ...prev, total: data.total }));
        }
        break;
      case 'fetching':
        setFetchingProgress({ page: data.page, fetched: data.fetched });
        setMessage(data.message);
        break;
      case 'progress':
        setProgress({
          processed: data.processed,
          total: data.total,
          percent: data.percent,
          indexed: data.indexed,
          failed: data.failed,
        });
        setCurrentBatch(data.current);
        break;
      case 'complete':
        setPhase('complete');
        setProgress(prev => ({
          ...prev,
          indexed: data.indexed,
          failed: data.failed,
        }));
        onComplete();
        break;
      case 'error':
        setError(data.message);
        setPhase('error');
        break;
    }
  };

  const handleClose = () => {
    setPhase('idle');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === 'complete' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : phase === 'error' ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Database className="h-5 w-5" />
            )}
            Build Search Index
          </DialogTitle>
          <DialogDescription>
            {phase === 'complete' 
              ? `Indexed ${progress.indexed} candidates${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`
              : phase === 'error'
              ? 'Indexing failed'
              : 'Extracting and indexing resumes for semantic search...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 overflow-hidden">
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

          {/* Processing Progress Bar */}
          {(phase === 'processing' || phase === 'complete') && (
            <div className="space-y-2">
              <Progress value={progress.percent} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{progress.processed} / {progress.total} candidates</span>
                <span>{progress.percent}%</span>
              </div>
            </div>
          )}

          {/* Status Message (for init phase) */}
          {(phase === 'init' || phase === 'error') && (
            <div className="flex items-center gap-2 text-sm">
              {phase === 'init' && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className={phase === 'error' ? 'text-destructive' : ''}>
                {error || message}
              </span>
            </div>
          )}

          {/* Current Batch */}
          {currentBatch && phase === 'processing' && (
            <div className="text-xs text-muted-foreground truncate max-w-full overflow-hidden">
              <span className="font-medium">Indexing:</span> {currentBatch}
            </div>
          )}

          {/* Stats on complete */}
          {phase === 'complete' && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{progress.indexed} indexed</span>
              </div>
              {progress.failed > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{progress.failed} failed</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <Button 
            variant={phase === 'complete' ? 'default' : 'outline'} 
            onClick={handleClose}
          >
            {phase === 'complete' ? 'Done' : phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

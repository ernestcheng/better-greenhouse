import { useEffect, useState, useRef } from 'react';
import { Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ExportProgressDialogProps {
  isOpen: boolean;
  jobId: number | null;
  onClose: () => void;
}

type ExportPhase = 'idle' | 'init' | 'fetching' | 'processing' | 'complete' | 'error';

export function ExportProgressDialog({ isOpen, jobId, onClose }: ExportProgressDialogProps) {
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ processed: 0, total: 0, percent: 0 });
  const [fetchingProgress, setFetchingProgress] = useState({ page: 0, fetched: 0 });
  const [currentBatch, setCurrentBatch] = useState('');
  const [exportData, setExportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      startExport(jobId);
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen, jobId]);

  const startExport = (jobId: number) => {
    setPhase('init');
    setMessage('Starting export...');
    setProgress({ processed: 0, total: 0, percent: 0 });
    setFetchingProgress({ page: 0, fetched: 0 });
    setCurrentBatch('');
    setExportData(null);
    setError(null);

    const eventSource = new EventSource(`/api/search/export/${jobId}`);
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
      setCurrentBatch(data.current);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setExportData(data);
      setPhase('complete');
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as any).data);
        setError(data.message);
      } catch {
        setError('Export failed');
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

  const handleDownload = () => {
    if (!exportData) return;
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumes-${exportData.job_id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
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
              <Download className="h-5 w-5" />
            )}
            Export Resumes
          </DialogTitle>
          <DialogDescription>
            {phase === 'complete' 
              ? `Exported ${exportData?.total_candidates} candidates`
              : phase === 'error'
              ? 'Export failed'
              : 'Extracting text from resumes...'}
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
              <span className="font-medium">Processing:</span> {currentBatch}
            </div>
          )}

          {/* Download Button */}
          {phase === 'complete' && (
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download JSON ({(JSON.stringify(exportData).length / 1024).toFixed(0)} KB)
            </Button>
          )}
        </div>

        {/* Close/Cancel Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            {phase === 'complete' || phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

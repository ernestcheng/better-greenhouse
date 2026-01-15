import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DisagreementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  candidateName: string;
  llmRecommendation: 'GREEN' | 'RED';
  userAction: 'ADVANCE' | 'REJECT';
  isLoading?: boolean;
}

export function DisagreementDialog({
  isOpen,
  onClose,
  onConfirm,
  candidateName,
  llmRecommendation,
  userAction,
  isLoading,
}: DisagreementDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleSkip = () => {
    onConfirm(''); // Empty reason means skip feedback
    setReason('');
  };

  const isRejecting = userAction === 'REJECT';
  const actionWord = isRejecting ? 'rejecting' : 'advancing';
  const llmWord = llmRecommendation === 'GREEN' ? 'recommended' : 'flagged as not qualified';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Help Claude Learn
          </DialogTitle>
          <DialogDescription>
            You're {actionWord} <strong>{candidateName}</strong>, but Claude {llmWord} them.
            Why do you disagree?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            placeholder={isRejecting 
              ? "e.g., Missing specific experience in X, red flag in job history, not enough depth in Y..."
              : "e.g., Strong signal from Z experience, their work at Company shows potential..."
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This feedback will improve future recommendations for this role.
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
            Skip
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? 'Processing...' : `${isRejecting ? 'Reject' : 'Advance'} & Save Feedback`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { RejectionReason } from '@/types';

interface BulkRejectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rejectionReasonId: number) => void;
  selectedCount: number;
  rejectionReasons: RejectionReason[];
  isLoading?: boolean;
}

// Find "Does not have the necessary skill(s)/qualification(s)" reason
function getDefaultReasonId(reasons: RejectionReason[]): string | null {
  const skillsReason = reasons.find(r => 
    r.name.toLowerCase().includes('skill') || r.name.toLowerCase().includes('qualification')
  );
  return (skillsReason?.id || reasons[0]?.id)?.toString() || null;
}

export function BulkRejectDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  rejectionReasons,
  isLoading,
}: BulkRejectDialogProps) {
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);

  // Set default when reasons load
  useEffect(() => {
    if (rejectionReasons.length > 0 && !selectedReasonId) {
      setSelectedReasonId(getDefaultReasonId(rejectionReasons));
    }
  }, [rejectionReasons, selectedReasonId]);

  const handleConfirm = () => {
    if (selectedReasonId) {
      onConfirm(parseInt(selectedReasonId));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reject {selectedCount} {selectedCount === 1 ? 'Application' : 'Applications'}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The selected candidates will be
            rejected and notified via email.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">
            Rejection Reason
          </label>
          <Select
            value={selectedReasonId || undefined}
            onValueChange={setSelectedReasonId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {rejectionReasons.map((reason) => (
                <SelectItem key={reason.id} value={reason.id.toString()}>
                  {reason.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReasonId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              `Reject ${selectedCount} ${selectedCount === 1 ? 'Application' : 'Applications'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

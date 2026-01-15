import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
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
import { useEmailTemplates } from '@/hooks/useApplications';
import type { RejectionSettings } from '@/types';

interface ScreeningSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobRequirements: string;
  rejectionSettings: RejectionSettings;
  onSave: (requirements: string, rejectionSettings: RejectionSettings) => void;
  jobTitle?: string;
}

export function ScreeningSettingsDialog({
  isOpen,
  onClose,
  jobRequirements,
  rejectionSettings,
  onSave,
  jobTitle,
}: ScreeningSettingsDialogProps) {
  const [requirements, setRequirements] = useState(jobRequirements);
  const [emailTemplateId, setEmailTemplateId] = useState<number | undefined>(
    rejectionSettings.emailTemplateId
  );

  const { data: emailTemplates = [] } = useEmailTemplates();

  useEffect(() => {
    setRequirements(jobRequirements);
    setEmailTemplateId(rejectionSettings.emailTemplateId);
  }, [jobRequirements, rejectionSettings]);

  const handleSave = () => {
    onSave(requirements, { emailTemplateId });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure screening and rejection settings.
            {jobTitle && (
              <span className="block mt-1 font-medium text-foreground">
                Job: {jobTitle}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Screening Requirements */}
          <div>
            <h3 className="text-sm font-semibold mb-2">AI Screening Requirements</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Paste the key requirements for this role. Claude will use these to evaluate candidates.
            </p>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Example:
- 5+ years of experience in backend development
- Strong proficiency in Python and distributed systems
- Experience with AWS/GCP cloud infrastructure
- Bachelor's degree in Computer Science or equivalent"
              className="w-full h-48 px-3 py-2 text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Rejection Email Settings */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold mb-2">Rejection Email Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure the email template and sender for rejection emails.
            </p>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Email Template
              </label>
              <Select
                value={emailTemplateId?.toString() || 'none'}
                onValueChange={(value) =>
                  setEmailTemplateId(value === 'none' ? undefined : parseInt(value))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select email template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No email (reject silently)</SelectItem>
                  {emailTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                If no template is selected, candidates will be rejected without notification.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

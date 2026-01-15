import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['↓'], action: 'Next candidate' },
  { keys: ['↑'], action: 'Previous candidate' },
  { keys: ['Enter'], action: 'Open candidate detail' },
  { keys: ['Esc'], action: 'Close / go back' },
  { keys: ['z'], action: 'Advance' },
  { keys: ['x'], action: 'Reject' },
  { keys: ['s'], action: 'AI screen selected' },
  { keys: ['a'], action: 'Select all' },
  { keys: ['['], action: 'Previous page' },
  { keys: [']'], action: 'Next page' },
  { keys: [','], action: 'Settings' },
  { keys: ['?'], action: 'Shortcuts' },
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and take actions quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-1">
          {shortcuts.map(({ keys, action }) => (
            <div
              key={keys.join('-')}
              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-muted-foreground">{action}</span>
              <div className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

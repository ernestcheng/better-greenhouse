import { Leaf, Settings, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeaderProps {
  onGlobalSettingsClick?: () => void;
  onKeyboardShortcutsClick?: () => void;
}

export function Header({ onGlobalSettingsClick, onKeyboardShortcutsClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Leaf className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Greenhouse Screener</h1>
            <p className="text-xs text-muted-foreground">AI-powered resume screening</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onKeyboardShortcutsClick}
              >
                <Keyboard className="h-4 w-4" />
                <span className="sr-only">Keyboard shortcuts</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Keyboard shortcuts (?)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onGlobalSettingsClick}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Global settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>API keys & global settings</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

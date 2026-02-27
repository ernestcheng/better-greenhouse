import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface GlobalSettings {
  greenhouseApiKey?: string;
  greenhouseUserId?: string;
  anthropicApiKey?: string;
}

interface ValidationStatus {
  greenhouse: 'idle' | 'checking' | 'valid' | 'invalid';
  anthropic: 'idle' | 'checking' | 'valid' | 'invalid';
  greenhouseError?: string;
  anthropicError?: string;
}

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSettingsDialog({ isOpen, onClose }: GlobalSettingsDialogProps) {
  const [settings, setSettings] = useState<GlobalSettings>({});
  const [showGreenhouseKey, setShowGreenhouseKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [validation, setValidation] = useState<ValidationStatus>({
    greenhouse: 'idle',
    anthropic: 'idle',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const data = await api.get<GlobalSettings>('/settings');
      setSettings({
        greenhouseApiKey: data.greenhouseApiKey || '',
        greenhouseUserId: data.greenhouseUserId || '',
        anthropicApiKey: data.anthropicApiKey || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const validateKeys = async () => {
    setValidation({
      greenhouse: settings.greenhouseApiKey ? 'checking' : 'idle',
      anthropic: settings.anthropicApiKey ? 'checking' : 'idle',
    });

    try {
      const result = await api.post<{
        greenhouse: { valid: boolean; error?: string };
        anthropic: { valid: boolean; error?: string };
      }>('/settings/validate', settings);

      setValidation({
        greenhouse: result.greenhouse.valid ? 'valid' : 'invalid',
        anthropic: result.anthropic.valid ? 'valid' : 'invalid',
        greenhouseError: result.greenhouse.error,
        anthropicError: result.anthropic.error,
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.post('/settings', settings);
      onClose();
      // Reload the page to apply new settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const ValidationIcon = ({ status }: { status: 'idle' | 'checking' | 'valid' | 'invalid' }) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Global Settings
          </DialogTitle>
          <DialogDescription>
            Configure your API credentials. These are stored locally and override environment variables.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Greenhouse API Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Greenhouse API</h3>
              <a
                href="https://developers.greenhouse.io/harvest.html#authentication"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a Harvest API key in Greenhouse: Configure → Dev Center → API Credential Management → Create New API Key (type: Harvest).
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">API Key</label>
                <div className="relative">
                  <input
                    type={showGreenhouseKey ? 'text' : 'password'}
                    value={settings.greenhouseApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, greenhouseApiKey: e.target.value })}
                    placeholder="Enter your Greenhouse Harvest API key"
                    className="w-full h-9 px-3 pr-20 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <ValidationIcon status={validation.greenhouse} />
                    <button
                      type="button"
                      onClick={() => setShowGreenhouseKey(!showGreenhouseKey)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showGreenhouseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {validation.greenhouseError && (
                  <p className="text-xs text-destructive mt-1">{validation.greenhouseError}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">User ID (On-Behalf-Of)</label>
                <input
                  type="text"
                  value={settings.greenhouseUserId || ''}
                  onChange={(e) => setSettings({ ...settings, greenhouseUserId: e.target.value })}
                  placeholder="Your Greenhouse user ID (numeric)"
                  className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Find this in Greenhouse: Click your name → Configure → scroll to "Your user ID"
                </p>
              </div>
            </div>
          </div>

          {/* Anthropic API Settings */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Anthropic API (Claude)</h3>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Create an API key at console.anthropic.com. Used for AI-powered resume screening.
            </p>
            
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <div className="relative">
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={settings.anthropicApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full h-9 px-3 pr-20 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <ValidationIcon status={validation.anthropic} />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {validation.anthropicError && (
                <p className="text-xs text-destructive mt-1">{validation.anthropicError}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={validateKeys} disabled={isSaving}>
            Validate Keys
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save & Reload
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

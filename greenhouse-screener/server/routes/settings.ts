import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateConfig, CONFIG } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

const router = Router();

interface Settings {
  greenhouseApiKey?: string;
  greenhouseUserId?: string;
  anthropicApiKey?: string;
}

// Ensure data directory exists
const dataDir = path.dirname(SETTINGS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load settings from file
function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return {};
}

// Save settings to file
function saveSettings(settings: Settings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET /api/settings - Get current settings (masked)
router.get('/', (req, res) => {
  const settings = loadSettings();
  
  // Return masked keys (show only last 4 chars if exists)
  res.json({
    greenhouseApiKey: settings.greenhouseApiKey 
      ? '•'.repeat(Math.max(0, settings.greenhouseApiKey.length - 4)) + settings.greenhouseApiKey.slice(-4)
      : '',
    greenhouseUserId: settings.greenhouseUserId || '',
    anthropicApiKey: settings.anthropicApiKey
      ? '•'.repeat(Math.max(0, settings.anthropicApiKey.length - 4)) + settings.anthropicApiKey.slice(-4)
      : '',
  });
});

// POST /api/settings - Save settings
router.post('/', (req, res) => {
  const { greenhouseApiKey, greenhouseUserId, anthropicApiKey } = req.body;
  const currentSettings = loadSettings();
  
  // Only update if new value provided (not masked)
  const newSettings: Settings = {
    greenhouseApiKey: greenhouseApiKey && !greenhouseApiKey.includes('•') 
      ? greenhouseApiKey 
      : currentSettings.greenhouseApiKey,
    greenhouseUserId: greenhouseUserId || currentSettings.greenhouseUserId,
    anthropicApiKey: anthropicApiKey && !anthropicApiKey.includes('•')
      ? anthropicApiKey
      : currentSettings.anthropicApiKey,
  };
  
  saveSettings(newSettings);
  
  // Update runtime config
  updateConfig(newSettings);
  
  res.json({ success: true });
});

// POST /api/settings/validate - Validate API keys
router.post('/validate', async (req, res) => {
  const { greenhouseApiKey, greenhouseUserId, anthropicApiKey } = req.body;
  const currentSettings = loadSettings();
  
  // Use provided keys or fall back to saved/env
  const ghKey = (greenhouseApiKey && !greenhouseApiKey.includes('•'))
    ? greenhouseApiKey 
    : currentSettings.greenhouseApiKey || CONFIG.GREENHOUSE_API_KEY;
  const ghUserId = greenhouseUserId || currentSettings.greenhouseUserId || CONFIG.GREENHOUSE_USER_ID;
  const anthropicKey = (anthropicApiKey && !anthropicApiKey.includes('•'))
    ? anthropicApiKey
    : currentSettings.anthropicApiKey || CONFIG.ANTHROPIC_API_KEY;
  
  const results = {
    greenhouse: { valid: false, error: undefined as string | undefined },
    anthropic: { valid: false, error: undefined as string | undefined },
  };
  
  // Validate Greenhouse API key
  if (ghKey) {
    try {
      const auth = Buffer.from(`${ghKey}:`).toString('base64');
      const response = await fetch('https://harvest.greenhouse.io/v1/jobs?per_page=1', {
        headers: {
          'Authorization': `Basic ${auth}`,
          'On-Behalf-Of': ghUserId || '1',
        },
      });
      
      if (response.ok) {
        results.greenhouse.valid = true;
      } else if (response.status === 401) {
        results.greenhouse.error = 'Invalid API key';
      } else if (response.status === 403) {
        results.greenhouse.error = 'API key lacks required permissions';
      } else {
        results.greenhouse.error = `API returned ${response.status}`;
      }
    } catch (error: any) {
      results.greenhouse.error = error.message;
    }
  } else {
    results.greenhouse.error = 'No API key provided';
  }
  
  // Validate Anthropic API key
  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      
      if (response.ok || response.status === 200) {
        results.anthropic.valid = true;
      } else if (response.status === 401) {
        results.anthropic.error = 'Invalid API key';
      } else if (response.status === 403) {
        results.anthropic.error = 'API key lacks permissions';
      } else {
        const data = await response.json().catch(() => ({}));
        results.anthropic.error = data.error?.message || `API returned ${response.status}`;
      }
    } catch (error: any) {
      results.anthropic.error = error.message;
    }
  } else {
    results.anthropic.error = 'No API key provided';
  }
  
  res.json(results);
});

export default router;

// Export function to initialize config from saved settings on startup
export function initializeFromSavedSettings(): void {
  const settings = loadSettings();
  if (Object.keys(settings).length > 0) {
    updateConfig(settings);
    console.log('Loaded saved API settings');
  }
}

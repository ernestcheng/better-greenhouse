import { config } from 'dotenv';

config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3333', 10),
  GREENHOUSE_API_KEY: process.env.GREENHOUSE_API_KEY || '',
  GREENHOUSE_USER_ID: process.env.GREENHOUSE_USER_ID || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  
  GREENHOUSE_BASE_URL: 'https://harvest.greenhouse.io/v1',
  
  DEFAULT_REJECTION_REASON_NAME: "Does not have the necessary skill(s)/qualification(s)",
  DEFAULT_FROM_EMAIL: "no-reply@hightouch.io",
};

export function validateConfig() {
  const missing: string[] = [];
  
  if (!CONFIG.GREENHOUSE_API_KEY) missing.push('GREENHOUSE_API_KEY');
  if (!CONFIG.GREENHOUSE_USER_ID) missing.push('GREENHOUSE_USER_ID');
  if (!CONFIG.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('   Create a .env file based on .env.example');
  }
  
  return missing.length === 0;
}

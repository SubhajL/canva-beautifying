import { defineConfig, devices } from '@playwright/test';
import fs from 'fs'
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Playwright config specifically for UI mode
 * This bypasses the webServer config which is causing issues
 */
export default defineConfig({
  testDir: './e2e',
  
  // No globalSetup for UI mode
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    [require.resolve('./e2e/reporters/heartbeat-reporter'), { idleLogMs: 30000, exitAfterMs: 0 }],
  ],
  
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json' },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json' },
    },
  ],

  // No webServer config - assumes dev server is already running
});

import { defineConfig, devices } from '@playwright/test';
import fs from 'fs'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';

// Load local environment for dev runs, then override with .env.test if present
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Setup files to run before tests */
  // Disable globalSetup in UI mode, and only enforce service checks when E2E_ENABLE_SERVICES=true
  globalSetup:
    process.env.PWTEST_UI_MODE === 'true'
      ? undefined
      : require.resolve('./e2e/setup/check-services.ts'),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    [require.resolve('./e2e/reporters/heartbeat-reporter'), { idleLogMs: 30000, exitAfterMs: 0 }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7072',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Maximum time each action can take */
    actionTimeout: 15000,

    /* Navigation timeout */
    navigationTimeout: 30000,
    
    /* BeautifyAI specific options */
  },

  /* Configure projects for major browsers */
  projects: [
    // Gated UI-only project: runs everything except @services-tagged specs
    {
      name: 'ui',
      use: { 
        ...devices['Desktop Chrome'], 
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/ui.json') ? undefined : 'e2e/.auth/ui.json'
      },
      grep: /@ui/i,
    },
    // Gated services project: runs only @services-tagged specs and enables service checks
    {
      name: 'services',
      use: { ...devices['Desktop Chrome'] },
      grep: /@services/i,
      env: { ...process.env, E2E_ENABLE_SERVICES: 'true' },
    },
    // Test different subscription tiers
    {
      name: 'free-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'pro-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/pro-user.json') ? undefined : 'e2e/.auth/pro-user.json'
      },
    },
    {
      name: 'premium-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/premium-user.json') ? undefined : 'e2e/.auth/premium-user.json'
      },
    },
    // Accessibility testing
    {
      name: 'accessibility',
      use: { 
        ...devices['Desktop Chrome'],
        // Force high contrast mode
        colorScheme: 'dark',
        forcedColors: 'active',
        storageState: 'e2e/.auth/free-user.json'
      },
    },
    // Mobile testing
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 14'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    // Performance testing
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // Launch with performance flags
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--disable-dev-shm-usage'
          ]
        },
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    // WebSocket testing
    {
      name: 'websocket',
      use: {
        ...devices['Desktop Chrome'],
        // Longer timeouts for WebSocket tests
        actionTimeout: 30000,
        navigationTimeout: 45000,
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    // Standard browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: process.env.E2E_IGNORE_STORAGE === 'true' || !fs.existsSync('e2e/.auth/free-user.json') ? undefined : 'e2e/.auth/free-user.json'
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: (process.env.CI || process.env.PLAYWRIGHT_EXTERNAL_SERVER === 'true') ? undefined : [
    {
      command: 'npm run dev',
      port: 7072,
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'WEBSOCKET_PORT=5006 npm run websocket:dev',
      port: 5006,
      timeout: 60000,
      reuseExistingServer: true,
    }
  ],
});

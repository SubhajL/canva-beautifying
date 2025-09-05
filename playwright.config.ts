import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';

// Read from ".env.test" file for test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Setup files to run before tests */
  // Disable globalSetup in UI mode to prevent loading issues
  globalSetup: process.env.PWTEST_UI_MODE === 'true' ? undefined : require.resolve('./e2e/setup/check-services.ts'),
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
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    // Add custom reporter for UX compliance
    ['./e2e/reporters/ux-compliance-reporter.ts']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7071',

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
    storageState: 'e2e/.auth/user.json', // Persist auth
    extraHTTPHeaders: {
      'X-Test-Mode': 'true' // Flag for test mode
    }
  },

  /* Configure projects for major browsers */
  projects: [
    // Test different subscription tiers
    {
      name: 'free-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'pro-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/pro-user.json'
      },
    },
    {
      name: 'premium-tier',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/premium-user.json'
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
        storageState: 'e2e/.auth/free-user.json'
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
        storageState: 'e2e/.auth/free-user.json'
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
        storageState: 'e2e/.auth/free-user.json'
      },
    },
    // Standard browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/free-user.json'
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/free-user.json'
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : [
    {
      command: 'npm run dev',
      port: 7071,
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run websocket:dev',
      port: 5001,
      timeout: 60000,
      reuseExistingServer: true,
    }
  ],
});
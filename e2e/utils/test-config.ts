/**
 * Test configuration for real API testing
 */

export const TEST_CONFIG = {
  // Use longer timeouts for real API calls
  timeouts: {
    api: 30000,
    upload: 60000,
    enhancement: 120000,
    navigation: 30000,
  },
  
  // Polling intervals for async operations
  polling: {
    interval: 2000,
    maxAttempts: 60,
  },
  
  // Test data
  testData: {
    // Generate unique emails to avoid conflicts
    generateEmail: () => `e2e-test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    defaultPassword: 'E2ETest@2024!Secure',
  },
  
  // API endpoints (will use baseURL from playwright.config.ts)
  api: {
    auth: {
      signup: '/auth/signup',
      login: '/auth/login',
      logout: '/auth/logout',
      resetPassword: '/auth/reset-password',
    },
    enhance: {
      upload: '/api/v1/enhance/upload',
      process: '/api/v1/enhance/process',
      status: '/api/v1/enhance/status',
      result: '/api/v1/enhance/result',
      export: '/api/v1/enhance/export',
    },
    user: {
      profile: '/api/v1/user/profile',
      enhancements: '/api/v1/user/enhancements',
      usage: '/api/v1/user/usage',
    },
  },
  
  // Environment checks
  requiresServices: {
    supabase: true,
    r2: true,
    redis: true,
    ai: true,
  },
  
  // Cleanup settings
  cleanup: {
    deleteTestUsers: true,
    deleteTestFiles: true,
  },
};

export default TEST_CONFIG;
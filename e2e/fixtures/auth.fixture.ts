import { test as base } from '@playwright/test';
import TestHelpers from '../utils/test-helpers';

export type AuthFixtures = {
  testUser: {
    email: string;
    password: string;
  };
  authenticatedPage: void;
};

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    // Create test user credentials
    const user = {
      email: TestHelpers.generateTestEmail(),
      password: TestHelpers.generateTestPassword(),
    };
    
    await use(user);
    
    // Cleanup would go here if needed
  },

  authenticatedPage: [async ({ page, testUser }, use) => {
    // Sign up the test user
    await page.goto('/auth/signup');
    
    const helpers = new TestHelpers(page);
    
    // Fill signup form
    await helpers.fillByLabel('Email', testUser.email);
    await helpers.fillByLabel('Password', testUser.password);
    
    // Wait for signup API call
    const signupPromise = helpers.waitForApiResponse(/\/auth\/v1\/signup/);
    await helpers.clickButton('Sign Up');
    
    try {
      const signupResponse = await signupPromise;
      
      // Check if signup was successful
      if (!signupResponse.user) {
        throw new Error('Signup failed: No user returned');
      }
      
      // Wait for redirect to dashboard
      await helpers.waitForNavigation('/dashboard');
      
      // Verify we're authenticated by checking for user email on page
      await page.waitForSelector(`text="${testUser.email}"`, { timeout: 10000 });
      
    } catch (error) {
      // If signup fails, try login (user might already exist)
      await page.goto('/auth/login');
      await helpers.fillByLabel('Email', testUser.email);
      await helpers.fillByLabel('Password', testUser.password);
      
      const loginPromise = helpers.waitForApiResponse(/\/auth\/v1\/token/);
      await helpers.clickButton('Log In');
      await loginPromise;
      
      await helpers.waitForNavigation('/dashboard');
    }
    
    // Use the authenticated page
    await use();
    
    // Logout after test
    await helpers.logout();
  }, { auto: true }],
});

export { expect } from '@playwright/test';
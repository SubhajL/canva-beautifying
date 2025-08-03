import { test, expect } from '@playwright/test';
import TestHelpers from './utils/test-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display landing page with login/signup options', async ({ page }) => {
    // Check landing page elements
    await expect(page).toHaveTitle(/Canva Beautifying/i);
    
    // Check for main CTA buttons
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible();
    
    const loginLink = page.getByRole('link', { name: /log in/i });
    await expect(loginLink).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Click Get Started
    await helpers.clickButton('Get Started');
    
    // Should redirect to signup
    await expect(page).toHaveURL(/\/auth\/signup/);
    
    // Check signup form elements
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });

  test('should sign up a new user', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const testEmail = TestHelpers.generateTestEmail();
    const testPassword = TestHelpers.generateTestPassword();
    
    // Navigate to signup
    await page.goto('/auth/signup');
    
    // Fill form
    await helpers.fillByLabel('Email', testEmail);
    await helpers.fillByLabel('Password', testPassword);
    
    // Wait for signup API response
    const signupPromise = helpers.waitForApiResponse(/\/auth\/v1\/signup/);
    
    // Submit form
    await helpers.clickButton('Sign Up');
    
    // Check API response
    const response = await signupPromise;
    expect(response.user).toBeDefined();
    expect(response.user.email).toBe(testEmail);
    
    // Should redirect to dashboard
    await helpers.waitForNavigation('/dashboard');
    
    // Verify user is logged in
    await expect(page.getByText(testEmail)).toBeVisible({ timeout: 10000 });
  });

  test('should log in existing user', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const testEmail = TestHelpers.generateTestEmail();
    const testPassword = TestHelpers.generateTestPassword();
    
    // First sign up
    await page.goto('/auth/signup');
    await helpers.fillByLabel('Email', testEmail);
    await helpers.fillByLabel('Password', testPassword);
    
    const signupPromise = helpers.waitForApiResponse(/\/auth\/v1\/signup/);
    await helpers.clickButton('Sign Up');
    await signupPromise;
    
    await helpers.waitForNavigation('/dashboard');
    
    // Log out
    await helpers.logout();
    
    // Now test login
    await page.goto('/auth/login');
    await helpers.fillByLabel('Email', testEmail);
    await helpers.fillByLabel('Password', testPassword);
    
    // Wait for login API response
    const loginPromise = helpers.waitForApiResponse(/\/auth\/v1\/token/);
    await helpers.clickButton('Log In');
    
    const loginResponse = await loginPromise;
    expect(loginResponse.access_token).toBeDefined();
    
    // Should redirect to dashboard
    await helpers.waitForNavigation('/dashboard');
    await expect(page.getByText(testEmail)).toBeVisible({ timeout: 10000 });
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/auth/signup');
    
    // Try to submit empty form
    await helpers.clickButton('Sign Up');
    
    // Should show validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    
    // Try invalid email
    await helpers.fillByLabel('Email', 'invalid-email');
    await helpers.clickButton('Sign Up');
    
    await expect(page.getByText(/valid email/i)).toBeVisible();
    
    // Try weak password
    await helpers.fillByLabel('Email', 'test@example.com');
    await helpers.fillByLabel('Password', '123');
    await helpers.clickButton('Sign Up');
    
    await expect(page.getByText(/password must be/i)).toBeVisible();
  });

  test('should handle OAuth login', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Check OAuth buttons
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    const microsoftButton = page.getByRole('button', { name: /continue with microsoft/i });
    
    await expect(googleButton).toBeVisible();
    await expect(microsoftButton).toBeVisible();
    
    // Note: Actual OAuth flow testing would require mocking or test accounts
  });

  test('should handle password reset flow', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/auth/login');
    
    // Click forgot password
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await forgotLink.click();
    
    // Should navigate to reset page
    await expect(page).toHaveURL(/\/auth\/reset-password/);
    
    // Fill email
    await helpers.fillByLabel('Email', 'test@example.com');
    await helpers.clickButton('Send Reset Link');
    
    // Should show success message
    await expect(page.getByText(/reset link sent/i)).toBeVisible();
  });

  test('should redirect authenticated users from auth pages', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const testEmail = TestHelpers.generateTestEmail();
    const testPassword = TestHelpers.generateTestPassword();
    
    // Sign up first
    await page.goto('/auth/signup');
    await helpers.fillByLabel('Email', testEmail);
    await helpers.fillByLabel('Password', testPassword);
    await helpers.clickButton('Sign Up');
    await helpers.waitForNavigation('/dashboard');
    
    // Try to access auth pages while logged in
    await page.goto('/auth/login');
    await expect(page).toHaveURL('/dashboard');
    
    await page.goto('/auth/signup');
    await expect(page).toHaveURL('/dashboard');
  });
});
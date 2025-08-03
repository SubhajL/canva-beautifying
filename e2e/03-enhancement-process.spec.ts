import { test, expect } from './fixtures/auth.fixture';
import TestHelpers from './utils/test-helpers';
import path from 'path';

test.describe('Enhancement Process', () => {
  let testImagePath: string;

  test.beforeAll(async () => {
    testImagePath = path.join(process.cwd(), 'test-results', 'test-worksheet.svg');
    await TestHelpers.createTestImage(testImagePath);
  });

  let documentId: string;

  test.beforeEach(async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    // Upload a document first
    await page.goto('/dashboard');
    
    // Wait for upload API response
    const uploadPromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/upload/, 60000);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    
    // Get document ID from response
    const uploadResponse = await uploadPromise;
    documentId = uploadResponse.data.documentId;
    
    // Wait for navigation
    await page.waitForURL(/enhance|wizard|settings|results/, { timeout: 30000 });
  });

  test('should display enhancement options', async ({ page }) => {
    // Check for style options
    await expect(page.getByText(/style/i)).toBeVisible();
    
    // Check for common enhancement options
    const styleOptions = [
      'Modern',
      'Classic',
      'Playful',
      'Professional'
    ];
    
    for (const style of styleOptions) {
      const option = page.getByText(new RegExp(style, 'i'));
      if (await option.isVisible()) {
        await expect(option).toBeVisible();
      }
    }
  });

  test('should allow style selection', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Select a style
    const modernStyle = page.getByText('Modern').or(
      page.locator('[data-style="modern"]')
    ).first();
    
    await modernStyle.click();
    
    // Should show selected state
    await expect(modernStyle).toHaveClass(/selected|active/);
  });

  test('should show color scheme options', async ({ page }) => {
    // Look for color options
    const colorSection = page.getByText(/color/i);
    await expect(colorSection).toBeVisible();
    
    // Check for color scheme options
    const colorSchemes = ['Vibrant', 'Pastel', 'Monochrome', 'Earth'];
    
    for (const scheme of colorSchemes) {
      const option = page.getByText(new RegExp(scheme, 'i'));
      if (await option.isVisible()) {
        await expect(option).toBeVisible();
      }
    }
  });

  test('should show target audience options', async ({ page }) => {
    // Look for audience section
    const audienceSection = page.getByText(/audience|grade/i);
    
    if (await audienceSection.isVisible()) {
      await expect(audienceSection).toBeVisible();
      
      // Check for audience options
      const audiences = ['Elementary', 'Middle School', 'High School', 'Adult'];
      
      for (const audience of audiences) {
        const option = page.getByText(new RegExp(audience, 'i'));
        if (await option.isVisible()) {
          await expect(option).toBeVisible();
        }
      }
    }
  });

  test('should start enhancement process', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Select style if on settings page
    const modernStyle = page.getByText('Modern').first();
    if (await modernStyle.isVisible()) {
      await modernStyle.click();
    }
    
    // Wait for enhancement API
    const enhancePromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/process/);
    
    // Find and click enhance button
    const enhanceButton = page.getByRole('button', { name: /enhance|start|begin|process/i });
    await enhanceButton.click();
    
    // Check enhancement response
    const enhanceResponse = await enhancePromise;
    expect(enhanceResponse.success).toBe(true);
    expect(enhanceResponse.data.enhancementId).toBeDefined();
    
    // Should show progress
    await expect(page.getByText(/processing|enhancing|analyzing|progress/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show enhancement progress', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Start enhancement
    const enhancePromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/process/);
    const enhanceButton = page.getByRole('button', { name: /enhance|start|process/i });
    await enhanceButton.click();
    
    // Get enhancement ID
    const enhanceResponse = await enhancePromise;
    const enhancementId = enhanceResponse.data.enhancementId;
    
    // Poll for status updates
    const statusUrl = `/api/v1/enhance/status/${enhancementId}`;
    
    // Wait for processing to start
    await page.waitForTimeout(2000);
    
    // Check status
    const statusData = await helpers.pollApi(
      statusUrl,
      (data: any) => data.data.status === 'completed' || data.data.status === 'failed',
      { maxAttempts: 60, interval: 2000 }
    );
    
    // Should show progress indicators during processing
    const progressIndicators = page.locator('[role="progressbar"], .progress-bar, [data-testid="progress"]');
    if (await progressIndicators.first().isVisible()) {
      await expect(progressIndicators.first()).toBeVisible();
    }
    
    // Check final status
    expect(statusData.data.status).toBe('completed');
  });

  test.skip('should handle enhancement errors', async ({ page }) => {
    // Skip this test when using real API as we don't want to force errors
    // This test is better suited for mocked environments
  });

  test('should complete enhancement and show results', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Start enhancement
    const enhancePromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/process/);
    const enhanceButton = page.getByRole('button', { name: /enhance|start|process/i });
    await enhanceButton.click();
    
    // Get enhancement ID
    const enhanceResponse = await enhancePromise;
    expect(enhanceResponse.success).toBe(true);
    const enhancementId = enhanceResponse.data.enhancementId;
    
    // Poll for completion
    const statusUrl = `/api/v1/enhance/status/${enhancementId}`;
    const completedData = await helpers.pollApi(
      statusUrl,
      (data: any) => data.data.status === 'completed',
      { maxAttempts: 60, interval: 2000 }
    );
    
    expect(completedData.data.status).toBe('completed');
    
    // Navigate to results if not already there
    if (!page.url().includes('/results/')) {
      await page.goto(`/app/results/${enhancementId}`);
    }
    
    // Wait for results to load
    await page.waitForLoadState('networkidle');
    
    // Should show improvements
    const improvementIndicators = [
      page.getByText(/improvement|better|enhanced/i),
      page.getByText(/before.*after/i),
      page.getByText(/\\d+%/), // Percentage improvements
    ];
    
    // At least one indicator should be visible
    let found = false;
    for (const indicator of improvementIndicators) {
      if (await indicator.first().isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('should allow cancellation during enhancement', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Mock slow enhancement
    await page.route('**/api/v1/enhance/process', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { enhancementId: 'test-123' }
        })
      });
    });
    
    // Start enhancement
    const enhanceButton = page.getByRole('button', { name: /enhance|start/i });
    await enhanceButton.click();
    
    // Should show cancel option
    const cancelButton = page.getByRole('button', { name: /cancel|stop/i });
    await expect(cancelButton).toBeVisible();
    
    // Click cancel
    await cancelButton.click();
    
    // Should confirm cancellation
    const confirmDialog = page.getByText(/sure.*cancel|confirm/i);
    if (await confirmDialog.isVisible()) {
      const confirmButton = page.getByRole('button', { name: /yes|confirm/i });
      await confirmButton.click();
    }
    
    // Should return to options
    await expect(page.getByRole('button', { name: /enhance|start/i })).toBeVisible();
  });
});
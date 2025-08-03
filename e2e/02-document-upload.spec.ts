import { test, expect } from './fixtures/auth.fixture';
import TestHelpers from './utils/test-helpers';
import path from 'path';
import fs from 'fs/promises';

test.describe('Document Upload Flow', () => {
  let testImagePath: string;

  test.beforeAll(async () => {
    // Create test image
    testImagePath = path.join(process.cwd(), 'test-results', 'test-worksheet.svg');
    await TestHelpers.createTestImage(testImagePath);
  });

  test.afterAll(async () => {
    // Clean up test image
    try {
      await fs.unlink(testImagePath);
    } catch {
      // Ignore if already deleted
    }
  });

  test('should display upload interface on dashboard', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check for upload section
    await expect(page.getByText(/upload document/i)).toBeVisible();
    
    // Check for dropzone
    const dropzone = page.locator('[data-testid="upload-dropzone"]').or(
      page.locator('.dropzone')
    ).or(
      page.getByText(/drag.*drop/i)
    );
    await expect(dropzone).toBeVisible();
  });

  test('should upload a document via file picker', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Find file input
    const fileInput = page.locator('input[type="file"]');
    
    // Wait for upload API response
    const uploadPromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/upload/, 60000);
    
    // Upload file
    await fileInput.setInputFiles(testImagePath);
    
    // Check upload response
    const uploadResponse = await uploadPromise;
    expect(uploadResponse.success).toBe(true);
    expect(uploadResponse.data.documentId).toBeDefined();
    
    // Wait for UI to update
    await page.waitForTimeout(1000);
    
    // Should show next step or success message
    const successIndicator = page.getByText(/success|uploaded|analyze|next|continue/i);
    await expect(successIndicator).toBeVisible({ timeout: 10000 });
  });

  test('should validate file types', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Create an invalid file type
    const invalidFilePath = path.join(process.cwd(), 'test-results', 'invalid.txt');
    await fs.writeFile(invalidFilePath, 'This is not an image');
    
    try {
      // Try to upload invalid file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // Should show error message
      await expect(page.getByText(/invalid file type|not supported/i)).toBeVisible();
    } finally {
      // Clean up
      await fs.unlink(invalidFilePath);
    }
  });

  test('should show file size limits', async ({ page, authenticatedPage }) => {
    await page.goto('/dashboard');
    
    // Look for file size information
    const sizeInfo = page.getByText(/max.*mb|file size/i);
    await expect(sizeInfo).toBeVisible();
  });

  test('should handle drag and drop upload', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Get dropzone element
    const dropzone = page.locator('[data-testid="upload-dropzone"]').or(
      page.locator('.dropzone')
    ).first();
    
    // Create DataTransfer and dispatch events
    await dropzone.dispatchEvent('dragenter', {
      dataTransfer: { files: [] }
    });
    
    // Check for visual feedback
    await expect(dropzone).toHaveClass(/drag-over|active|highlight/);
    
    // Note: Actual file drop simulation is complex in Playwright
    // This test mainly checks the UI responds to drag events
  });

  test('should show upload progress', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Start upload
    const fileInput = page.locator('input[type="file"]');
    
    // Listen for progress indicators
    const progressPromise = page.waitForSelector('[role="progressbar"], .progress-bar, [data-testid="upload-progress"]', {
      timeout: 5000
    }).catch(() => null);
    
    await fileInput.setInputFiles(testImagePath);
    
    const progressElement = await progressPromise;
    if (progressElement) {
      await expect(progressElement).toBeVisible();
    }
  });

  test('should handle multiple file uploads', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Check if multiple file upload is supported
    const fileInput = page.locator('input[type="file"]');
    const isMultiple = await fileInput.getAttribute('multiple');
    
    if (isMultiple !== null) {
      // Create second test file
      const secondImagePath = path.join(process.cwd(), 'test-results', 'test-worksheet-2.svg');
      await TestHelpers.createTestImage(secondImagePath);
      
      try {
        // Upload multiple files
        await fileInput.setInputFiles([testImagePath, secondImagePath]);
        
        // Should show both files or batch upload interface
        await expect(page.getByText(/2 files|batch/i)).toBeVisible();
      } finally {
        await fs.unlink(secondImagePath);
      }
    }
  });

  test('should navigate to enhancement options after upload', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Wait for upload API response
    const uploadPromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/upload/, 60000);
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    
    // Get document ID from response
    const uploadResponse = await uploadPromise;
    const documentId = uploadResponse.data.documentId;
    
    // Wait for navigation to enhancement page
    await page.waitForURL(/enhance|wizard|settings|results/, { timeout: 30000 });
    
    // Should show enhancement options or be on enhancement page
    const enhancementOptions = page.getByText(/style|enhance|modern|classic|playful/i).first();
    await expect(enhancementOptions).toBeVisible({ timeout: 10000 });
  });

  test('should handle upload errors gracefully', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/dashboard');
    
    // Intercept upload request and force error
    await page.route('**/api/v1/enhance/upload', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Upload failed' }
        })
      });
    });
    
    // Try to upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    
    // Should show error message
    await expect(page.getByText(/upload failed|error|try again/i)).toBeVisible();
    
    // Should allow retry
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
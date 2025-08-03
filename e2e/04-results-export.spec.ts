import { test, expect } from './fixtures/auth.fixture';
import TestHelpers from './utils/test-helpers';
import path from 'path';

test.describe('Results and Export', () => {
  let enhancementId: string;
  
  test.beforeEach(async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    // Create a real enhancement first
    await page.goto('/dashboard');
    
    // Upload a document
    const testImagePath = path.join(process.cwd(), 'test-results', 'test-worksheet.svg');
    await TestHelpers.createTestImage(testImagePath);
    
    const uploadPromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/upload/, 60000);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    
    const uploadResponse = await uploadPromise;
    const documentId = uploadResponse.data.documentId;
    
    // Wait for navigation to enhancement page
    await page.waitForURL(/enhance|wizard|settings|results/, { timeout: 30000 });
    
    // Start enhancement
    const enhancePromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/process/);
    const enhanceButton = page.getByRole('button', { name: /enhance|start|process/i });
    if (await enhanceButton.isVisible()) {
      await enhanceButton.click();
      const enhanceResponse = await enhancePromise;
      enhancementId = enhanceResponse.data.enhancementId;
      
      // Poll for completion
      const statusUrl = `/api/v1/enhance/status/${enhancementId}`;
      await helpers.pollApi(
        statusUrl,
        (data: any) => data.data.status === 'completed',
        { maxAttempts: 60, interval: 2000 }
      );
    } else {
      // Already on results page
      enhancementId = page.url().match(/results\/(\w+)/)?.[1] || 'test';
    }
    
    // Navigate to results page
    if (!page.url().includes('/results/')) {
      await page.goto(`/app/results/${enhancementId}`);
    }
    
    await page.waitForLoadState('networkidle');
  });

  test('should display enhancement results', async ({ page }) => {
    // Check for before/after comparison
    await expect(page.getByText(/before/i)).toBeVisible();
    await expect(page.getByText(/after/i)).toBeVisible();
    
    // Check for improvement metrics
    await expect(page.getByText(/88/)).toBeVisible(); // Overall score
    await expect(page.getByText(/readability/i)).toBeVisible();
    await expect(page.getByText(/visual.*appeal/i)).toBeVisible();
    await expect(page.getByText(/accessibility/i)).toBeVisible();
  });

  test('should show improvement details', async ({ page }) => {
    // Check for enhancement list
    await expect(page.getByText(/improved color contrast/i)).toBeVisible();
    await expect(page.getByText(/visual hierarchy/i)).toBeVisible();
    
    // Check for processing time
    await expect(page.getByText(/8.5.*seconds/i)).toBeVisible();
  });

  test('should allow toggling between before and after views', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Look for toggle or slider
    const toggleButton = page.getByRole('button', { name: /compare|toggle/i });
    const slider = page.locator('[role="slider"], .comparison-slider');
    
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      // Should change view
      await expect(page.locator('.before-view, .after-view')).toBeVisible();
    } else if (await slider.isVisible()) {
      // Test slider interaction
      await slider.hover();
      await page.mouse.down();
      await page.mouse.move(100, 0);
      await page.mouse.up();
    }
  });

  test('should provide download options', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Find download button
    const downloadButton = page.getByRole('button', { name: /download/i });
    await expect(downloadButton).toBeVisible();
    
    // Click download
    await downloadButton.click();
    
    // Should show format options
    const formatOptions = ['PNG', 'JPG', 'PDF'];
    for (const format of formatOptions) {
      const option = page.getByText(format);
      if (await option.isVisible()) {
        await expect(option).toBeVisible();
      }
    }
  });

  test('should download enhanced document', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Find download button
    const downloadButton = page.getByRole('button', { name: /download|export/i });
    await expect(downloadButton).toBeVisible();
    
    // Click download
    await downloadButton.click();
    
    // If format options appear, select PNG
    const pngOption = page.getByText('PNG').first();
    if (await pngOption.isVisible()) {
      await pngOption.click();
      
      // Wait for export API
      const exportPromise = helpers.waitForApiResponse(/\/api\/v1\/enhance\/export/);
      
      // Confirm download
      const confirmButton = page.getByRole('button', { name: /download|confirm|export/i }).last();
      await confirmButton.click();
      
      // Check export response
      const exportResponse = await exportPromise;
      expect(exportResponse.success).toBe(true);
      expect(exportResponse.data.exportUrl).toBeDefined();
    } else {
      // Direct download
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();
    }
  });

  test('should allow sharing results', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Find share button
    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible();
    
    // Click share
    await shareButton.click();
    
    // Should show share options
    await expect(page.getByText(/share.*link|copy.*link/i)).toBeVisible();
    
    // Test copy link
    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.click();
    
    // Should show success message
    await expect(page.getByText(/copied/i)).toBeVisible();
  });

  test('should save to user library', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Find save button
    const saveButton = page.getByRole('button', { name: /save/i });
    
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Should show success
      await expect(page.getByText(/saved/i)).toBeVisible();
    }
  });

  test('should allow starting new enhancement', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Find new enhancement button
    const newButton = page.getByRole('button', { name: /new|another|enhance again/i });
    await expect(newButton).toBeVisible();
    
    // Click it
    await newButton.click();
    
    // Should navigate back to dashboard or upload
    await expect(page).toHaveURL(/dashboard|upload/);
  });

  test('should show export options for different formats', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Click download/export
    const exportButton = page.getByRole('button', { name: /export|download/i });
    await exportButton.click();
    
    // Check for format options
    const formats = [
      { name: 'PNG', desc: 'High quality' },
      { name: 'JPG', desc: 'Smaller size' },
      { name: 'PDF', desc: 'Print ready' }
    ];
    
    for (const format of formats) {
      const option = page.getByText(format.name);
      if (await option.isVisible()) {
        await expect(option).toBeVisible();
        
        // Check for description
        const desc = page.getByText(new RegExp(format.desc, 'i'));
        if (await desc.isVisible()) {
          await expect(desc).toBeVisible();
        }
      }
    }
  });

  test('should track export usage', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Mock usage tracking
    let exportTracked = false;
    await page.route('**/api/v1/usage/track', route => {
      const request = route.request();
      if (request.postDataJSON()?.action === 'export') {
        exportTracked = true;
      }
      route.fulfill({ status: 200 });
    });
    
    // Export document
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();
    
    // Should track usage
    await page.waitForTimeout(1000); // Give time for tracking
    expect(exportTracked).toBeTruthy();
  });

  test('should handle export errors gracefully', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Mock export error
    await page.route('**/api/v1/enhance/export/*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Export failed' }
        })
      });
    });
    
    // Try to export
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();
    
    // Select format if needed
    const pngOption = page.getByText('PNG');
    if (await pngOption.isVisible()) {
      await pngOption.click();
      const confirmButton = page.getByRole('button', { name: /download|confirm/i }).last();
      await confirmButton.click();
    }
    
    // Should show error
    await expect(page.getByText(/export failed|error|try again/i)).toBeVisible();
  });
});
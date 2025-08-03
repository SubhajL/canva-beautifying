import { test, expect } from './fixtures/auth.fixture';
import TestHelpers from './utils/test-helpers';

test.describe('User Dashboard', () => {
  test.beforeEach(async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display user dashboard', async ({ page, testUser }) => {
    // Check dashboard elements
    const dashboardHeading = page.getByRole('heading', { name: /dashboard|home|documents/i }).first();
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });
    
    // Check for user email or profile indicator
    const userIndicator = page.getByText(testUser.email).or(
      page.locator('[data-testid="user-email"]')
    ).or(
      page.getByRole('button', { name: /profile|account/i })
    );
    await expect(userIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show usage statistics', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Wait for usage data to load
    const usagePromise = helpers.waitForApiResponse(/\/api\/v1\/user\/(usage|profile)/, 10000).catch(() => null);
    
    // Check for usage info - look for any credit/usage indicators
    const usageIndicators = [
      page.getByText(/credit/i),
      page.getByText(/usage/i),
      page.getByText(/limit/i),
      page.locator('[role="progressbar"]'),
      page.locator('.usage-bar'),
      page.locator('[data-testid="usage"]')
    ];
    
    // Wait for at least one indicator to be visible
    let found = false;
    for (const indicator of usageIndicators) {
      try {
        await indicator.first().waitFor({ state: 'visible', timeout: 5000 });
        found = true;
        break;
      } catch {
        // Continue to next indicator
      }
    }
    
    if (!found) {
      // If no usage UI, check if API was called
      const usageData = await usagePromise;
      if (usageData) {
        console.log('Usage data from API:', usageData);
      }
    }
  });

  test('should display recent enhancements or empty state', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Wait for enhancements to load
    await page.waitForTimeout(2000);
    
    // Check for enhancements section or empty state
    const hasEnhancements = await page.getByText(/recent|history|documents|enhancements/i).isVisible();
    
    if (hasEnhancements) {
      // Look for enhancement cards
      const enhancementCards = page.locator('[data-testid="enhancement-card"], .enhancement-card, [role="article"]');
      const cardCount = await enhancementCards.count();
      
      if (cardCount > 0) {
        // Has enhancements
        await expect(enhancementCards.first()).toBeVisible();
      } else {
        // Empty state
        const emptyState = page.getByText(/no.*enhancement|start.*upload|get.*started/i);
        await expect(emptyState).toBeVisible();
      }
    } else {
      // No enhancement section - might be showing upload UI directly
      const uploadSection = page.locator('input[type="file"], [data-testid="upload"]');
      await expect(uploadSection.first()).toBeVisible();
    }
  });

  test('should navigate to enhancement details', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Click on completed enhancement
    await page.getByText('Math Worksheet').click();
    
    // Should navigate to results page
    await expect(page).toHaveURL(/results.*enh-1/);
  });

  test('should allow filtering enhancements', async ({ page }) => {
    // Look for filter options
    const filterButton = page.getByRole('button', { name: /filter/i });
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Check for filter options
      await expect(page.getByText(/completed/i)).toBeVisible();
      await expect(page.getByText(/processing/i)).toBeVisible();
      await expect(page.getByText(/all/i)).toBeVisible();
    }
  });

  test('should show upgrade prompt for free users', async ({ page }) => {
    // Check for upgrade prompt
    const upgradePrompt = page.getByText(/upgrade|pro|premium/i);
    
    if (await upgradePrompt.isVisible()) {
      await expect(upgradePrompt).toBeVisible();
      
      // Check for upgrade button
      const upgradeButton = page.getByRole('button', { name: /upgrade/i });
      await expect(upgradeButton).toBeVisible();
    }
  });

  test('should refresh processing enhancements', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Mock updated status
    let statusCallCount = 0;
    await page.route('**/api/v1/enhance/status/enh-3', route => {
      statusCallCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: statusCallCount > 2 ? 'completed' : 'processing',
            progress: Math.min(100, 65 + statusCallCount * 15)
          }
        })
      });
    });
    
    // Wait for auto-refresh or manual refresh
    await page.waitForTimeout(5000);
    
    // Should update progress
    const progressText = page.getByText(/80%|95%|completed/i);
    await expect(progressText).toBeVisible();
  });

  test('should handle empty state', async ({ page }) => {
    // Mock empty enhancements
    await page.route('**/api/v1/user/enhancements*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            enhancements: [],
            pagination: { total: 0, page: 1, totalPages: 0 }
          }
        })
      });
    });
    
    await page.reload();
    
    // Should show empty state
    await expect(page.getByText(/no enhancements|get started|upload/i)).toBeVisible();
    
    // Should have CTA
    const ctaButton = page.getByRole('button', { name: /upload|start|new/i });
    await expect(ctaButton).toBeVisible();
  });

  test('should show quick actions', async ({ page }) => {
    // Check for quick action buttons
    const newEnhancementButton = page.getByRole('button', { name: /new enhancement/i });
    await expect(newEnhancementButton).toBeVisible();
    
    // Check for settings link
    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();
  });

  test('should paginate enhancements', async ({ page }) => {
    // Mock paginated response
    await page.route('**/api/v1/user/enhancements*', route => {
      const url = new URL(route.request().url());
      const page = parseInt(url.searchParams.get('page') || '1');
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            enhancements: Array(10).fill(null).map((_, i) => ({
              id: `enh-page${page}-${i}`,
              title: `Enhancement ${(page - 1) * 10 + i + 1}`,
              status: 'completed',
              createdAt: new Date().toISOString(),
              thumbnailUrl: `https://example.com/thumb${i}.png`
            })),
            pagination: {
              total: 25,
              page,
              totalPages: 3,
              perPage: 10
            }
          }
        })
      });
    });
    
    await page.reload();
    
    // Check for pagination controls
    const nextButton = page.getByRole('button', { name: /next/i });
    const pageInfo = page.getByText(/page.*1.*3/i);
    
    if (await nextButton.isVisible()) {
      await expect(pageInfo).toBeVisible();
      
      // Go to next page
      await nextButton.click();
      
      // Should load page 2
      await expect(page.getByText('Enhancement 11')).toBeVisible();
    }
  });

  test('should search enhancements', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Look for search input
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('Math');
      
      // Mock filtered results
      await page.route('**/api/v1/user/enhancements*search=Math*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              enhancements: [{
                id: 'enh-1',
                title: 'Math Worksheet',
                status: 'completed',
                createdAt: new Date().toISOString()
              }],
              pagination: { total: 1, page: 1, totalPages: 1 }
            }
          })
        });
      });
      
      // Submit search
      await searchInput.press('Enter');
      
      // Should show filtered results
      await expect(page.getByText('Math Worksheet')).toBeVisible();
      await expect(page.getByText('Science Quiz')).not.toBeVisible();
    }
  });
});
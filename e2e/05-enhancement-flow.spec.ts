/**
 * Full document enhancement flow E2E test with real services
 * Requires: Supabase, Redis, R2, and AI providers
 */

import { test, expect } from './fixtures/auth.fixture'
import TestHelpers from './utils/test-helpers'
import path from 'path'
import fs from 'fs/promises'

test.describe('@services Document Enhancement Flow', () => {
  let testImagePath: string

  test.beforeAll(async () => {
    // Create test image for upload
    testImagePath = path.join(process.cwd(), 'test-results', 'enhancement-test.jpg')
    await fs.mkdir(path.dirname(testImagePath), { recursive: true }).catch(() => {})

    // Create a minimal valid JPEG
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00
    ])
    const jpegFooter = Buffer.from([0xFF, 0xD9])
    const filler = Buffer.alloc(2000, 0xFF)

    await fs.writeFile(testImagePath, Buffer.concat([jpegHeader, filler, jpegFooter]))
  })

  test.afterAll(async () => {
    // Clean up test image
    try {
      await fs.unlink(testImagePath)
    } catch {
      // Ignore if already deleted
    }
  })

  test('should complete full enhancement workflow', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Navigate to dashboard
    await page.goto('/dashboard')

    // Find and use file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10000 })

    // Upload document
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/, 60000)
    await fileInput.setInputFiles(testImagePath)

    // Wait for successful upload
    const uploadResponse = await uploadPromise
    expect(uploadResponse.success).toBe(true)
    expect(uploadResponse.enhancementId).toBeDefined()

    const enhancementId = uploadResponse.enhancementId

    // Should navigate to enhancement page or show next steps
    await page.waitForTimeout(2000)

    // Check if we can start enhancement
    const enhanceButton = page.getByRole('button', { name: /enhance|analyze|process|start/i })
    if (await enhanceButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Start enhancement process
      await enhanceButton.click()

      // Wait for enhancement to begin
      await page.waitForTimeout(1000)
    }

    // Poll for enhancement completion
    // Note: Real enhancement might take 30-60 seconds
    let enhancementComplete = false
    let attempts = 0
    const maxAttempts = 60

    while (!enhancementComplete && attempts < maxAttempts) {
      const statusResponse = await page.request.get(`/api/v1/enhance/${enhancementId}`)

      if (statusResponse.ok()) {
        const payload = await statusResponse.json()

        // Check for API-level errors
        if (!payload.success) {
          const apiError = payload.error?.message || payload.error || 'API returned success: false'
          throw new Error(`Enhancement API error: ${apiError}`)
        }

        // Guard against missing data
        if (!payload.data) {
          console.log(`Attempt ${attempts + 1}: No data in response, retrying...`)
          await page.waitForTimeout(2000)
          attempts++
          continue
        }

        const status = payload.data.status

        if (status === 'completed') {
          enhancementComplete = true
          break
        } else if (status === 'failed') {
          const errorMsg = payload.data.error || payload.data.error_message || 'Unknown error'
          throw new Error(`Enhancement failed: ${errorMsg}`)
        }

        // Log progress for other states (processing, analyzing, etc.)
        console.log(`Attempt ${attempts + 1}: Status = ${status}`)
      } else {
        // Non-OK HTTP status
        const errorText = await statusResponse.text().catch(() => 'Unknown error')
        console.log(`Attempt ${attempts + 1}: HTTP ${statusResponse.status()} - ${errorText}`)
      }

      await page.waitForTimeout(2000)
      attempts++
    }

    if (!enhancementComplete) {
      throw new Error(`Enhancement did not complete within ${maxAttempts * 2} seconds`)
    }

    // Navigate to results page if not already there
    if (!page.url().includes('/results')) {
      await page.goto(`/results/${enhancementId}`)
    }

    // Verify results page loaded
    await expect(page).toHaveURL(new RegExp(`/results/${enhancementId}`), { timeout: 10000 })

    // Check for enhanced image or comparison view
    const enhancedImage = page.locator('img[alt*="enhanced" i], img[alt*="after" i]').first()
    await expect(enhancedImage).toBeVisible({ timeout: 10000 })

    // Verify export buttons are present
    const exportButton = page.getByRole('button', { name: /export|download/i }).first()
    await expect(exportButton).toBeVisible({ timeout: 5000 })
  })

  test('should handle enhancement with preferences', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    await page.goto('/dashboard')

    // Upload document
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    expect(uploadResponse.success).toBe(true)

    // Look for enhancement preferences/settings
    const preferencesButton = page.getByRole('button', { name: /preferences|settings|options|customize/i })

    if (await preferencesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await preferencesButton.click()

      // Try to select a style if available
      const styleOptions = [
        /modern/i,
        /classic/i,
        /playful/i,
        /professional/i
      ]

      for (const stylePattern of styleOptions) {
        const styleButton = page.getByRole('button', { name: stylePattern }).or(
          page.getByLabel(stylePattern)
        )
        if (await styleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await styleButton.click()
          break
        }
      }

      // Save/apply preferences
      const applyButton = page.getByRole('button', { name: /apply|save|continue/i })
      if (await applyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await applyButton.click()
      }
    }

    // Verify enhancement was initiated
    await page.waitForTimeout(2000)

    // Should see some processing indicator
    const processingIndicator = page.locator('[role="progressbar"], .progress, .spinner').or(
      page.getByText(/processing|enhancing|analyzing/i)
    )

    // Either processing indicator shows, or we're already done
    const indicatorVisible = await processingIndicator.isVisible({ timeout: 5000 }).catch(() => false)

    if (indicatorVisible) {
      // Wait for processing to complete
      await expect(processingIndicator).not.toBeVisible({ timeout: 90000 })
    }
  })

  test('should provide feedback on results', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload and wait for completion
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    const enhancementId = uploadResponse.enhancementId

    // Navigate directly to results (assuming enhancement completes)
    // In real test, we'd wait for completion first
    await page.goto(`/results/${enhancementId}`)

    // Look for feedback form
    const feedbackButton = page.getByRole('button', { name: /feedback|rate|review/i })

    if (await feedbackButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await feedbackButton.click()

      // Try to submit positive feedback
      const ratingStars = page.locator('[aria-label*="star" i], [data-rating]')
      const firstStar = ratingStars.first()

      if (await firstStar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstStar.click()

        // Add optional comment
        const commentField = page.locator('textarea, input[type="text"]').filter({
          hasText: /comment|feedback|thoughts/i
        }).or(
          page.getByPlaceholder(/comment|feedback/i)
        )

        if (await commentField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await commentField.fill('Great enhancement! Looks much better.')
        }

        // Submit feedback
        const submitButton = page.getByRole('button', { name: /submit|send/i })
        if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitButton.click()

          // Verify success message
          await expect(page.getByText(/thank|success|submitted/i)).toBeVisible({ timeout: 5000 })
        }
      }
    }
  })

  test('should export enhanced document', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload document
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    const enhancementId = uploadResponse.enhancementId

    // Navigate to results
    await page.goto(`/results/${enhancementId}`)

    // Wait for page to load
    await page.waitForTimeout(2000)

    // Find export/download button
    const exportButton = page.getByRole('button', { name: /export|download/i }).first()

    if (await exportButton.isVisible({ timeout: 10000 })) {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 })

      await exportButton.click()

      // Check for format selection
      const formatOptions = [
        /png/i,
        /jpg|jpeg/i,
        /pdf/i
      ]

      for (const formatPattern of formatOptions) {
        const formatButton = page.getByRole('button', { name: formatPattern }).or(
          page.getByRole('option', { name: formatPattern })
        )

        if (await formatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await formatButton.click()
          break
        }
      }

      // Confirm download if needed
      const confirmButton = page.getByRole('button', { name: /confirm|download|export/i })
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click()
      }

      // Wait for download to start
      const download = await downloadPromise

      // Verify download properties
      expect(download.suggestedFilename()).toBeDefined()
      expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg|pdf)$/i)

      // Optional: Save and verify file
      const downloadPath = path.join(process.cwd(), 'test-results', download.suggestedFilename())
      await download.saveAs(downloadPath)

      // Verify file exists and has content
      const stats = await fs.stat(downloadPath)
      expect(stats.size).toBeGreaterThan(0)

      // Clean up
      await fs.unlink(downloadPath).catch(() => {})
    }
  })
})

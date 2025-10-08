/**
 * Results and Export E2E Tests
 * Tests the complete enhancement results page and export functionality
 */

import { test, expect } from './fixtures/auth.fixture'
import TestHelpers from './utils/test-helpers'
import path from 'path'
import fs from 'fs/promises'

const servicesEnabled = process.env.E2E_ENABLE_SERVICES === 'true'

test.describe(servicesEnabled ? '@services Results and Export' : test.skip, () => {
  let testImagePath: string

  test.beforeAll(async () => {
    // Create test image for upload
    testImagePath = path.join(process.cwd(), 'test-results', 'results-test.jpg')
    await fs.mkdir(path.dirname(testImagePath), { recursive: true }).catch(() => {})

    // Create minimal valid JPEG
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

  test('should display results page after enhancement', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload document
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    expect(uploadResponse.success).toBe(true)
    expect(uploadResponse.enhancementId).toBeDefined()

    const enhancementId = uploadResponse.enhancementId

    // Wait for enhancement to complete
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

        // Log progress for other states
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
      const timeoutSecs = maxAttempts * 2
      throw new Error(`Enhancement did not complete within ${timeoutSecs} seconds`)
    }

    // Navigate to results page
    await page.goto(`/results/${enhancementId}`)

    // Verify results page loaded
    await expect(page).toHaveURL(new RegExp(`/results/${enhancementId}`))

    // Check for key results page elements
    const enhancedImage = page.locator('img[alt*="enhanced" i], img[alt*="after" i]').first()
    await expect(enhancedImage).toBeVisible({ timeout: 10000 })

    // Check for before/after comparison
    const originalImage = page.locator('img[alt*="original" i], img[alt*="before" i]').first()
    await expect(originalImage).toBeVisible({ timeout: 5000 })
  })

  test('should provide export options', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    const enhancementId = uploadResponse.enhancementId

    // Navigate to results
    await page.goto(`/results/${enhancementId}`)
    await page.waitForTimeout(2000)

    // Check for export button
    const exportButton = page.getByRole('button', { name: /export|download/i }).first()
    await expect(exportButton).toBeVisible({ timeout: 10000 })
  })

  test('should allow downloading enhanced document', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    await fileInput.setInputFiles(testImagePath)

    const uploadResponse = await uploadPromise
    const enhancementId = uploadResponse.enhancementId

    // Navigate to results
    await page.goto(`/results/${enhancementId}`)
    await page.waitForTimeout(2000)

    const exportButton = page.getByRole('button', { name: /export|download/i }).first()

    if (await exportButton.isVisible({ timeout: 10000 })) {
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
      await exportButton.click()

      // Try to select format
      const pngButton = page.getByRole('button', { name: /png/i }).or(
        page.getByRole('option', { name: /png/i })
      )

      if (await pngButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pngButton.click()
      }

      // Confirm
      const confirmButton = page.getByRole('button', { name: /confirm|download|export/i })
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click()
      }

      // Verify download
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBeDefined()
      expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg|pdf)$/i)

      const downloadPath = path.join(process.cwd(), 'test-results', download.suggestedFilename())
      await download.saveAs(downloadPath)

      const stats = await fs.stat(downloadPath)
      expect(stats.size).toBeGreaterThan(0)

      await fs.unlink(downloadPath).catch(() => {})
    }
  })
})

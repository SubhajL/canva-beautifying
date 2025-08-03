import { Page, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import TEST_CONFIG from './test-config';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Generate a unique test email
   */
  static generateTestEmail(): string {
    return TEST_CONFIG.testData.generateEmail();
  }

  /**
   * Generate a secure test password
   */
  static generateTestPassword(): string {
    return TEST_CONFIG.testData.defaultPassword;
  }

  /**
   * Wait for a specific text to appear on the page
   */
  async waitForText(text: string, timeout = 30000): Promise<void> {
    await this.page.waitForSelector(`text="${text}"`, { timeout });
  }

  /**
   * Upload a file using the file input
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    const fileInput = await this.page.$(selector);
    if (!fileInput) {
      throw new Error(`File input not found: ${selector}`);
    }
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Create a test image file
   */
  static async createTestImage(outputPath: string): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Create a simple SVG image
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f0f0f0"/>
  <text x="400" y="250" font-family="Arial" font-size="48" text-anchor="middle" fill="#333">
    Test Worksheet
  </text>
  <text x="400" y="320" font-family="Arial" font-size="24" text-anchor="middle" fill="#666">
    Sample Educational Content
  </text>
  <rect x="100" y="380" width="600" height="150" fill="none" stroke="#999" stroke-width="2"/>
  <text x="110" y="410" font-family="Arial" font-size="18" fill="#333">
    Question 1: What is 2 + 2?
  </text>
  <text x="110" y="450" font-family="Arial" font-size="18" fill="#333">
    Answer: ________________
  </text>
</svg>`;

    await fs.writeFile(outputPath, svgContent, 'utf-8');
  }

  /**
   * Check if an element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      return await this.page.isVisible(selector);
    } catch {
      return false;
    }
  }

  /**
   * Get text content from an element
   */
  async getText(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return await element.textContent() || '';
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for navigation with a specific URL pattern
   */
  async waitForNavigation(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(urlPattern);
  }

  /**
   * Fill a form field by label
   */
  async fillByLabel(label: string, value: string): Promise<void> {
    const input = await this.page.getByLabel(label);
    await input.fill(value);
  }

  /**
   * Click a button by its text
   */
  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp, timeout = TEST_CONFIG.timeouts.api): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern, { timeout });
    return await response.json();
  }

  /**
   * Poll an API endpoint until a condition is met
   */
  async pollApi<T>(
    url: string,
    condition: (data: T) => boolean,
    options: {
      interval?: number;
      maxAttempts?: number;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const {
      interval = TEST_CONFIG.polling.interval,
      maxAttempts = TEST_CONFIG.polling.maxAttempts,
      headers = {}
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const response = await this.page.request.get(url, { headers });
      const data = await response.json();
      
      if (condition(data)) {
        return data;
      }
      
      attempts++;
      await this.page.waitForTimeout(interval);
    }
    
    throw new Error(`Polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Make an authenticated API request
   */
  async apiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    options: {
      data?: any;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<any> {
    const response = await this.page.request[method.toLowerCase()](url, {
      data: options.data,
      headers: options.headers,
      timeout: options.timeout || TEST_CONFIG.timeouts.api,
    });
    
    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status()} - ${error}`);
    }
    
    return await response.json();
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for auth cookie or specific UI element
    const cookies = await this.page.context().cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    return !!authCookie;
  }

  /**
   * Logout if logged in
   */
  async logout(): Promise<void> {
    if (await this.isLoggedIn()) {
      await this.page.goto('/app/settings');
      await this.clickButton('Sign Out');
      await this.waitForNavigation('/');
    }
  }
}

export default TestHelpers;
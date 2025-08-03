/**
 * Canva URL patterns and utilities
 */

// Canva URL patterns
const CANVA_URL_PATTERNS = [
  /^https?:\/\/(www\.)?canva\.com\/design\/([A-Za-z0-9_-]+)\//,
  /^https?:\/\/(www\.)?canva\.com\/design\/([A-Za-z0-9_-]+)$/,
  /^https?:\/\/(www\.)?canva\.com\/share\/([A-Za-z0-9_-]+)/,
  /^https?:\/\/(www\.)?canva\.site\/([A-Za-z0-9_-]+)/,
];

export interface CanvaUrlInfo {
  designId: string;
  type: 'design' | 'share' | 'site';
  originalUrl: string;
}

/**
 * Validate if a URL is a valid Canva URL
 */
export function validateCanvaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return false;
  }

  // Check against Canva patterns
  return CANVA_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Parse Canva URL to extract design information
 */
export function parseCanvaUrl(url: string): CanvaUrlInfo | null {
  if (!validateCanvaUrl(url)) {
    return null;
  }

  // Try each pattern
  for (const pattern of CANVA_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const designId = match[2];
      let type: 'design' | 'share' | 'site' = 'design';
      
      if (url.includes('/share/')) {
        type = 'share';
      } else if (url.includes('canva.site')) {
        type = 'site';
      }

      return {
        designId,
        type,
        originalUrl: url,
      };
    }
  }

  return null;
}

/**
 * Generate a public download URL for a Canva design
 * Note: This requires the design to be publicly shared
 */
export function generateCanvaDownloadUrl(designId: string, format: 'png' | 'pdf' | 'jpg' = 'png'): string {
  // This is a placeholder - actual implementation would depend on Canva's API
  // For now, we'll construct what the URL might look like
  return `https://www.canva.com/design/${designId}/download?format=${format}`;
}

/**
 * Clean and normalize a Canva URL
 */
export function normalizeCanvaUrl(url: string): string {
  const info = parseCanvaUrl(url);
  if (!info) {
    return url;
  }

  // Return a clean, normalized URL
  return `https://www.canva.com/design/${info.designId}/`;
}

/**
 * Extract metadata from Canva URL if possible
 */
export async function fetchCanvaMetadata(_url: string): Promise<{
  title?: string;
  description?: string;
  thumbnail?: string;
} | null> {
  try {
    // In a real implementation, this would fetch the page and extract OG tags
    // For now, return null as we can't access Canva's metadata directly
    return null;
  } catch (error) {
    console.error('Failed to fetch Canva metadata:', error);
    return null;
  }
}

/**
 * Check if a Canva URL is accessible (publicly shared)
 */
export async function checkCanvaUrlAccessibility(url: string): Promise<boolean> {
  try {
    // In production, this would make a HEAD request to check accessibility
    // For now, we'll assume all validated URLs are accessible
    return validateCanvaUrl(url);
  } catch (error) {
    console.error('Failed to check Canva URL accessibility:', error);
    return false;
  }
}
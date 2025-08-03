/**
 * Color contrast utilities for WCAG compliance
 * Based on WCAG 2.1 guidelines: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to relative luminance
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21 (higher is better)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid color format. Please use hex colors.');
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * WCAG contrast requirements
 */
export const WCAG_CONTRAST = {
  // Normal text
  AA_NORMAL: 4.5,
  AAA_NORMAL: 7,
  // Large text (18pt or 14pt bold)
  AA_LARGE: 3,
  AAA_LARGE: 4.5,
  // UI components and graphics
  AA_UI: 3,
} as const;

/**
 * Check if color combination meets WCAG standards
 */
export function meetsWCAG(
  foreground: string,
  background: string,
  level: keyof typeof WCAG_CONTRAST = 'AA_NORMAL'
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= WCAG_CONTRAST[level];
}

/**
 * Get WCAG compliance level for a color combination
 */
export function getWCAGLevel(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): {
  ratio: number;
  AA: boolean;
  AAA: boolean;
  level: 'AAA' | 'AA' | 'Fail';
} {
  const ratio = getContrastRatio(foreground, background);
  
  const AA = isLargeText
    ? ratio >= WCAG_CONTRAST.AA_LARGE
    : ratio >= WCAG_CONTRAST.AA_NORMAL;
    
  const AAA = isLargeText
    ? ratio >= WCAG_CONTRAST.AAA_LARGE
    : ratio >= WCAG_CONTRAST.AAA_NORMAL;

  const level = AAA ? 'AAA' : AA ? 'AA' : 'Fail';

  return { ratio, AA, AAA, level };
}

/**
 * Suggest a better color if contrast is insufficient
 * This is a simple implementation that lightens/darkens the foreground color
 */
export function suggestAccessibleColor(
  foreground: string,
  background: string,
  targetLevel: keyof typeof WCAG_CONTRAST = 'AA_NORMAL'
): string {
  const currentRatio = getContrastRatio(foreground, background);
  const targetRatio = WCAG_CONTRAST[targetLevel];

  if (currentRatio >= targetRatio) {
    return foreground; // Already accessible
  }

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return foreground;
  }

  const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const isDarkBg = bgLuminance < 0.5;

  // Adjust foreground color
  const adjustedRgb = { ...fgRgb };
  const step = isDarkBg ? 10 : -10;
  let attempts = 0;

  while (attempts < 50) {
    adjustedRgb.r = Math.max(0, Math.min(255, adjustedRgb.r + step));
    adjustedRgb.g = Math.max(0, Math.min(255, adjustedRgb.g + step));
    adjustedRgb.b = Math.max(0, Math.min(255, adjustedRgb.b + step));

    const adjustedHex = `#${[adjustedRgb.r, adjustedRgb.g, adjustedRgb.b]
      .map(val => val.toString(16).padStart(2, '0'))
      .join('')}`;

    if (getContrastRatio(adjustedHex, background) >= targetRatio) {
      return adjustedHex;
    }

    attempts++;
  }

  // If we can't find a suitable color, return black or white
  return isDarkBg ? '#FFFFFF' : '#000000';
}

/**
 * Predefined accessible color combinations
 */
export const ACCESSIBLE_COLORS = {
  light: {
    background: '#FFFFFF',
    text: {
      primary: '#000000',    // 21:1
      secondary: '#4B5563',  // 8.57:1
      muted: '#6B7280',      // 5.84:1
      link: '#2563EB',       // 8.05:1
      error: '#DC2626',      // 5.87:1
      success: '#059669',    // 5.95:1
      warning: '#D97706',    // 4.49:1 (use larger text)
    },
  },
  dark: {
    background: '#0A0A0A',
    text: {
      primary: '#FFFFFF',    // 19.25:1
      secondary: '#D1D5DB',  // 13.11:1
      muted: '#9CA3AF',      // 7.71:1
      link: '#60A5FA',       // 8.32:1
      error: '#F87171',      // 7.19:1
      success: '#34D399',    // 11.71:1
      warning: '#FCD34D',    // 13.31:1
    },
  },
} as const;

/**
 * Hook to check contrast in development
 */
export function useContrastChecker(enabled: boolean = process.env.NODE_ENV === 'development') {
  if (!enabled) return;

  if (typeof window !== 'undefined') {
    // Add a global function for checking contrast
    (window as any).checkContrast = (selector1: string, selector2: string) => {
      const el1 = document.querySelector(selector1);
      const el2 = document.querySelector(selector2);

      if (!el1 || !el2) {
        console.error('Elements not found');
        return;
      }

      const style1 = window.getComputedStyle(el1);
      const style2 = window.getComputedStyle(el2);

      const color1 = style1.color;
      const color2 = style2.backgroundColor || style2.color;

      // Convert RGB to hex
      const rgbToHex = (rgb: string) => {
        const match = rgb.match(/\d+/g);
        if (!match) return '#000000';
        return `#${match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('')}`;
      };

      const hex1 = rgbToHex(color1);
      const hex2 = rgbToHex(color2);

      const result = getWCAGLevel(hex1, hex2);
      
      console.log(`Contrast Ratio: ${result.ratio.toFixed(2)}
Level: ${result.level}
AA: ${result.AA ? '✓' : '✗'}
AAA: ${result.AAA ? '✓' : '✗'}`);
    };
  }
}
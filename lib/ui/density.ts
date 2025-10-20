/**
 * Density utility functions for responsive spacing and sizing
 */

import { DensityMode } from "@/contexts/density"

export interface DensityClasses {
  gap: string
  padding: string
  text: string
}

/**
 * Get Tailwind classes for a given density mode
 */
export function getDensityClasses(mode: DensityMode): DensityClasses {
  return mode === "comfortable"
    ? {
        gap: "gap-4",
        padding: "py-4 px-6",
        text: "text-base",
      }
    : {
        gap: "gap-2",
        padding: "py-2 px-3",
        text: "text-sm",
      }
}

/**
 * Get combined density class string (gap + padding)
 */
export function getDensityString(mode: DensityMode): string {
  const classes = getDensityClasses(mode)
  return `${classes.gap} ${classes.padding}`
}

/**
 * Get spacing multiplier for density mode
 */
export function getSpacingMultiplier(mode: DensityMode): number {
  return mode === "comfortable" ? 1 : 0.5
}

/**
 * Get font size class for density mode
 */
export function getFontSize(mode: DensityMode): string {
  return getDensityClasses(mode).text
}

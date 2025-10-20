import { getR2Config } from './config'

/**
 * Normalize an input value (key or URL) to an R2 key.
 * - If input is a full URL (public URL or R2 endpoint), strip origin and leading slash
 * - Otherwise, return as-is
 */
export function toR2Key(input: string): string {
  if (!input) return input

  // Fast path: looks like a plain key (no scheme)
  if (!/^https?:\/\//i.test(input)) return input.replace(/^\//, '')

  try {
    const url = new URL(input)
    const { publicUrl, accountId } = getR2Config()

    // If matches configured public URL origin, strip it
    if (publicUrl) {
      const pub = new URL(publicUrl)
      if (url.origin === pub.origin) {
        return url.pathname.replace(/^\//, '')
      }
    }

    // If matches R2 endpoint pattern for this account, strip origin
    if (accountId && url.hostname === `${accountId}.r2.cloudflarestorage.com`) {
      return url.pathname.replace(/^\//, '')
    }

    // Otherwise, best-effort: drop origin
    return url.pathname.replace(/^\//, '')
  } catch {
    // Not a valid URL — return as-is (minus leading slash)
    return input.replace(/^\//, '')
  }
}
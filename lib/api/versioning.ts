import { NextRequest } from 'next/server'

export type APIVersion = 'v1' | 'v2'
export type VersionStrategy = 'header' | 'path' | 'both'

interface VersionConfig {
  strategy: VersionStrategy
  defaultVersion: APIVersion
  supportedVersions: APIVersion[]
  headerName: string
  deprecated?: {
    [K in APIVersion]?: {
      deprecatedAt: Date
      sunsetDate: Date
      message: string
    }
  }
}

export class APIVersionManager {
  private static instance: APIVersionManager
  private config: VersionConfig

  private constructor(config: Partial<VersionConfig> = {}) {
    this.config = {
      strategy: config.strategy || 'both',
      defaultVersion: config.defaultVersion || 'v1',
      supportedVersions: config.supportedVersions || ['v1', 'v2'],
      headerName: config.headerName || 'X-API-Version',
      deprecated: config.deprecated || {}
    }
  }

  static getInstance(config?: Partial<VersionConfig>): APIVersionManager {
    if (!APIVersionManager.instance) {
      APIVersionManager.instance = new APIVersionManager(config)
    }
    return APIVersionManager.instance
  }

  /**
   * Extract API version from request based on configured strategy
   */
  extractVersion(request: NextRequest): APIVersion {
    const { pathname } = request.nextUrl
    const { strategy, headerName, defaultVersion } = this.config

    let version: APIVersion | null = null

    // Try path-based versioning
    if (strategy === 'path' || strategy === 'both') {
      const pathMatch = pathname.match(/\/api\/(v\d+)\//)
      if (pathMatch && this.isValidVersion(pathMatch[1] as APIVersion)) {
        version = pathMatch[1] as APIVersion
      }
    }

    // Try header-based versioning
    if (!version && (strategy === 'header' || strategy === 'both')) {
      const headerVersion = request.headers.get(headerName)
      if (headerVersion && this.isValidVersion(headerVersion as APIVersion)) {
        version = headerVersion as APIVersion
      }
    }

    return version || defaultVersion
  }

  /**
   * Check if version is valid and supported
   */
  isValidVersion(version: string): version is APIVersion {
    return this.config.supportedVersions.includes(version as APIVersion)
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(version: APIVersion): boolean {
    return !!this.config.deprecated?.[version]
  }

  /**
   * Get deprecation info for version
   */
  getDeprecationInfo(version: APIVersion) {
    return this.config.deprecated?.[version] || null
  }

  /**
   * Get version-specific headers for response
   */
  getVersionHeaders(version: APIVersion): Record<string, string> {
    const headers: Record<string, string> = {
      'X-API-Version': version,
    }

    const deprecationInfo = this.getDeprecationInfo(version)
    if (deprecationInfo) {
      headers['X-API-Deprecated'] = 'true'
      headers['X-API-Sunset'] = deprecationInfo.sunsetDate.toISOString()
      headers['X-API-Deprecation-Message'] = deprecationInfo.message
    }

    return headers
  }

  /**
   * Get all supported versions
   */
  getSupportedVersions(): APIVersion[] {
    return [...this.config.supportedVersions]
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VersionConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Version-specific feature flags
export interface VersionFeatures {
  v1: {
    maxFileSize: number
    supportedFormats: string[]
    rateLimits: {
      requestsPerMinute: number
      requestsPerHour: number
    }
  }
  v2: {
    maxFileSize: number
    supportedFormats: string[]
    rateLimits: {
      requestsPerMinute: number
      requestsPerHour: number
    }
    features: {
      batchProcessing: boolean
      webhooks: boolean
      advancedAnalytics: boolean
      multiModel: boolean
    }
  }
}

export const versionFeatures: VersionFeatures = {
  v1: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'ppt', 'pptx'],
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 600
    }
  },
  v2: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'ppt', 'pptx', 'svg', 'gif'],
    rateLimits: {
      requestsPerMinute: 120,
      requestsPerHour: 1200
    },
    features: {
      batchProcessing: true,
      webhooks: true,
      advancedAnalytics: true,
      multiModel: true
    }
  }
}

/**
 * Get features for a specific API version
 */
export function getVersionFeatures<V extends APIVersion>(version: V): VersionFeatures[V] {
  return versionFeatures[version]
}

/**
 * Version-aware route handler wrapper
 */
export function withVersion<T extends (...args: any[]) => any>(
  handlers: Record<APIVersion, T>
): (request: NextRequest, ...args: Parameters<T>) => ReturnType<T> {
  const versionManager = APIVersionManager.getInstance()
  
  return (request: NextRequest, ...args: Parameters<T>): ReturnType<T> => {
    const version = versionManager.extractVersion(request)
    const handler = handlers[version]
    
    if (!handler) {
      throw new Error(`No handler defined for API version ${version}`)
    }
    
    return handler(request, ...args)
  }
}
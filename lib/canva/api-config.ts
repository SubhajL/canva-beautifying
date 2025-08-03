export const CANVA_API_CONFIG = {
  // OAuth 2.0 Configuration
  oauth: {
    authorizationUrl: 'https://www.canva.com/api/oauth/authorize',
    tokenUrl: 'https://www.canva.com/api/oauth/token',
    clientId: process.env.NEXT_PUBLIC_CANVA_CLIENT_ID || '',
    clientSecret: process.env.CANVA_CLIENT_SECRET || '',
    redirectUri: process.env.NEXT_PUBLIC_CANVA_REDIRECT_URI || 'http://localhost:3000/api/canva/callback',
    scopes: ['design:content:read', 'design:meta:read', 'asset:read'],
  },

  // API Endpoints
  endpoints: {
    base: 'https://api.canva.com/rest/v1',
    designs: {
      list: '/designs',
      get: '/designs/{designId}',
      export: '/designs/{designId}/exports',
    },
    imports: {
      create: '/imports',
      status: '/imports/{importId}',
    },
    assets: {
      upload: '/assets/uploads',
    },
  },

  // Export Configuration
  export: {
    formats: ['png', 'jpg', 'pdf'] as const,
    quality: {
      png: 'print',
      jpg: 100,
      pdf: 'print',
    },
    defaultFormat: 'png' as const,
  },

  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxConcurrentExports: 5,
  },

  // Feature Flags
  features: {
    apiEnabled: process.env.NEXT_PUBLIC_CANVA_API_ENABLED === 'true',
    fallbackToManual: true,
  },
};

export type CanvaExportFormat = typeof CANVA_API_CONFIG.export.formats[number];

export interface CanvaDesign {
  id: string;
  name: string;
  urls: {
    editUrl: string;
    viewUrl: string;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CanvaExportRequest {
  format: CanvaExportFormat;
  pages?: number[];
  quality?: 'standard' | 'print';
}

export interface CanvaExportResponse {
  job: {
    id: string;
    status: 'in_progress' | 'success' | 'failed';
    urls?: string[];
    error?: string;
  };
}

export interface CanvaAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  created_at: number;
}

// Helper to check if API is configured
export function isCanvaAPIConfigured(): boolean {
  return !!(
    CANVA_API_CONFIG.oauth.clientId &&
    CANVA_API_CONFIG.oauth.clientSecret &&
    CANVA_API_CONFIG.features.apiEnabled
  );
}
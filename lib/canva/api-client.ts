import { CANVA_API_CONFIG, CanvaAuthToken, CanvaDesign, CanvaExportRequest, CanvaExportResponse } from './api-config';

export class CanvaAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'CanvaAPIError';
  }
}

export class CanvaAPIClient {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(private token?: CanvaAuthToken) {
    if (token) {
      this.setToken(token);
    }
  }

  setToken(token: CanvaAuthToken) {
    this.accessToken = token.access_token;
    this.tokenExpiry = token.created_at + token.expires_in * 1000;
  }

  isTokenValid(): boolean {
    return !!(
      this.accessToken &&
      this.tokenExpiry &&
      Date.now() < this.tokenExpiry
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isTokenValid()) {
      throw new CanvaAPIError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    const url = `${CANVA_API_CONFIG.endpoints.base}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new CanvaAPIError(
        error.message || `API request failed: ${response.statusText}`,
        response.status,
        error.code
      );
    }

    return response.json();
  }

  // Get user's designs
  async listDesigns(limit = 20, continuation?: string): Promise<{
    designs: CanvaDesign[];
    continuation?: string;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(continuation && { continuation }),
    });

    return this.request(`/designs?${params}`);
  }

  // Get a specific design
  async getDesign(designId: string): Promise<CanvaDesign> {
    return this.request(`/designs/${designId}`);
  }

  // Export a design
  async exportDesign(
    designId: string,
    options: CanvaExportRequest
  ): Promise<CanvaExportResponse> {
    return this.request(`/designs/${designId}/exports`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Check export status
  async getExportStatus(designId: string, jobId: string): Promise<CanvaExportResponse> {
    return this.request(`/designs/${designId}/exports/${jobId}`);
  }

  // Create an import
  async createImport(data: {
    name: string;
    asset_id: string;
  }): Promise<{
    design: CanvaDesign;
  }> {
    return this.request('/imports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Upload an asset
  async uploadAsset(file: File): Promise<{
    asset: {
      id: string;
      name: string;
      tags: string[];
    };
  }> {
    const formData = new FormData();
    formData.append('asset', file);

    return this.request('/assets/uploads', {
      method: 'POST',
      headers: {
        // Remove Content-Type to let browser set it with boundary
      },
      body: formData,
    });
  }

  // Parse design ID from various Canva URL formats
  static parseDesignId(url: string): string | null {
    const patterns = [
      /canva\.com\/design\/([A-Za-z0-9_-]+)/,
      /canva\.site\/([A-Za-z0-9_-]+)/,
      /canva-user-assets.*\/([A-Za-z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // Helper to wait for export completion
  async waitForExport(
    designId: string,
    jobId: string,
    maxAttempts = 30,
    delayMs = 2000
  ): Promise<string[]> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getExportStatus(designId, jobId);

      if (status.job.status === 'success' && status.job.urls) {
        return status.job.urls;
      }

      if (status.job.status === 'failed') {
        throw new CanvaAPIError(
          status.job.error || 'Export failed',
          500,
          'EXPORT_FAILED'
        );
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new CanvaAPIError('Export timeout', 408, 'TIMEOUT');
  }
}
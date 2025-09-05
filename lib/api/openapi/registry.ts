import { 
  RegisteredRoute, 
  RouteMetadata, 
  RequestMetadata, 
  ResponseMetadata,
  ROUTE_METADATA_KEY,
  REQUEST_METADATA_KEY,
  RESPONSE_METADATA_KEY
} from './types';

/**
 * Singleton registry for storing API route documentation
 */
export class RouteRegistry {
  private static instance: RouteRegistry;
  private routes: Map<string, RegisteredRoute> = new Map();
  private globalSecuritySchemes: Record<string, any> = {};
  private globalTags: Array<{ name: string; description?: string }> = [];
  private globalServers: Array<{ url: string; description?: string }> = [];
  private info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  } = {
    title: 'BeautifyAI API',
    version: '1.0.0',
    description: 'AI-powered document enhancement API'
  };

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): RouteRegistry {
    if (!RouteRegistry.instance) {
      RouteRegistry.instance = new RouteRegistry();
    }
    return RouteRegistry.instance;
  }

  /**
   * Register a route
   */
  registerRoute(metadataOrPath: RouteMetadata | string, method?: string): void {
    let metadata: RouteMetadata;
    
    // Support both registerRoute(metadata) and registerRoute(path, method) signatures
    if (typeof metadataOrPath === 'string' && method) {
      metadata = {
        path: metadataOrPath,
        method: method as any
      };
    } else if (typeof metadataOrPath === 'object') {
      metadata = metadataOrPath;
    } else {
      throw new Error('Invalid arguments for registerRoute');
    }
    
    const key = `${metadata.method}:${metadata.path}`;
    
    if (!this.routes.has(key)) {
      // Generate operation ID if not provided
      if (!metadata.operationId) {
        metadata.operationId = this.generateOperationId(metadata.method, metadata.path);
      }
      
      this.routes.set(key, {
        metadata,
        path: metadata.path,
        method: metadata.method
      });
    } else {
      // Update existing route metadata
      const existing = this.routes.get(key)!;
      existing.metadata = { ...existing.metadata, ...metadata };
      console.warn(`Route already registered: ${metadata.method} ${metadata.path}`);
    }
  }

  /**
   * Add request metadata to a route
   */
  addRequestMetadata(method: string, path: string, request: RequestMetadata): void {
    const key = `${method}:${path}`;
    const route = this.routes.get(key);
    
    if (route) {
      route.request = request;
    } else {
      // Create route if it doesn't exist
      this.routes.set(key, {
        metadata: { method: method as any, path },
        request
      });
    }
  }

  /**
   * Add response metadata to a route
   */
  addResponseMetadata(method: string, path: string, responses: ResponseMetadata): void {
    const key = `${method}:${path}`;
    const route = this.routes.get(key);
    
    if (route) {
      route.responses = { ...route.responses, ...responses };
    } else {
      // Create route if it doesn't exist
      this.routes.set(key, {
        metadata: { method: method as any, path },
        responses
      });
    }
  }

  /**
   * Get a registered route
   */
  getRoute(method: string, path: string): RegisteredRoute | undefined {
    return this.routes.get(`${method}:${path}`);
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): RegisteredRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get routes grouped by path
   */
  getRoutesByPath(): Map<string, RegisteredRoute[]> {
    const byPath = new Map<string, RegisteredRoute[]>();
    
    for (const route of this.routes.values()) {
      const path = route.metadata.path;
      if (!byPath.has(path)) {
        byPath.set(path, []);
      }
      byPath.get(path)!.push(route);
    }
    
    return byPath;
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes.clear();
  }

  /**
   * Set API info
   */
  setInfo(info: Partial<typeof this.info>): void {
    this.info = { ...this.info, ...info };
  }

  /**
   * Get API info
   */
  getInfo(): typeof this.info {
    return this.info;
  }

  /**
   * Add a security scheme
   */
  addSecurityScheme(name: string, scheme: any): void {
    this.globalSecuritySchemes[name] = scheme;
  }

  /**
   * Get all security schemes
   */
  getSecuritySchemes(): Record<string, any> {
    return this.globalSecuritySchemes;
  }

  /**
   * Add a global tag
   */
  addTag(name: string, description?: string): void {
    const existing = this.globalTags.find(tag => tag.name === name);
    if (!existing) {
      this.globalTags.push({ name, description });
    }
  }

  /**
   * Get all tags
   */
  getTags(): Array<{ name: string; description?: string }> {
    return this.globalTags;
  }

  /**
   * Add a server
   */
  addServer(url: string, description?: string): void {
    const existing = this.globalServers.find(server => server.url === url);
    if (!existing) {
      this.globalServers.push({ url, description });
    }
  }

  /**
   * Get all servers
   */
  getServers(): Array<{ url: string; description?: string }> {
    return this.globalServers;
  }

  /**
   * Check if a route exists
   */
  hasRoute(method: string, path: string): boolean {
    return this.routes.has(`${method}:${path}`);
  }

  /**
   * Get route count
   */
  getRouteCount(): number {
    return this.routes.size;
  }

  /**
   * Get routes by tag
   */
  getRoutesByTag(tag: string): RegisteredRoute[] {
    return Array.from(this.routes.values()).filter(route =>
      route.metadata.tags?.includes(tag)
    );
  }

  /**
   * Reset the registry (mainly for testing)
   */
  reset(): void {
    this.routes.clear();
    this.globalSecuritySchemes = {};
    this.globalTags = [];
    this.globalServers = [];
    this.info = {
      title: 'BeautifyAI API',
      version: '1.0.0',
      description: 'AI-powered document enhancement API'
    };
  }

  /**
   * Get all routes (for tests)
   */
  getRoutes(): Map<string, RegisteredRoute> {
    return this.routes;
  }

  /**
   * Clear all routes (alias for reset)
   */
  clear(): void {
    this.reset();
  }

  /**
   * Register a route from metadata attached to handler (for tests)
   */
  registerRouteFromMetadata(handler: any): void {
    const metadata = handler[ROUTE_METADATA_KEY];
    if (metadata) {
      this.registerRoute(metadata);
      
      const request = handler[REQUEST_METADATA_KEY];
      if (request) {
        this.addRequestMetadata(metadata.method, metadata.path, request);
      }
      
      const responses = handler[RESPONSE_METADATA_KEY];
      if (responses) {
        this.addResponseMetadata(metadata.method, metadata.path, responses);
      }
    }
  }

  /**
   * Generate operation ID from method and path
   * Note: Made non-private for testing purposes
   */
  generateOperationId(method: string, path: string): string {
    // Convert path to camelCase operation ID
    // e.g., DELETE /api/users/{id} -> deleteApiUsersId
    const parts = path.split('/').filter(p => p);
    const methodLower = method.toLowerCase();
    
    const pathParts = parts.map((part, index) => {
      // Remove path parameters
      const cleanPart = part.replace(/{([^}]+)}/g, (_, param) => {
        return param.charAt(0).toUpperCase() + param.slice(1);
      });
      
      // Split by special characters and capitalize each word
      const words = cleanPart.split(/[^a-zA-Z0-9]+/).filter(w => w);
      return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    });
    
    return methodLower + pathParts.join('');
  }
}

// Export singleton instance
export const routeRegistry = RouteRegistry.getInstance();
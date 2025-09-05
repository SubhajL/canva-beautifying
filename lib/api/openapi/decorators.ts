import { z } from 'zod';
import { routeRegistry } from './registry';
import {
  RouteMetadata,
  RequestMetadata,
  ResponseMetadata,
  ROUTE_METADATA_KEY,
  REQUEST_METADATA_KEY,
  RESPONSE_METADATA_KEY
} from './types';

/**
 * Type for route handler functions in Next.js App Router
 */
type RouteHandler = (
  request: Request,
  context?: any
) => Promise<Response> | Response;

/**
 * Extended route handler with metadata
 */
interface ExtendedRouteHandler extends RouteHandler {
  [ROUTE_METADATA_KEY]?: RouteMetadata;
  [REQUEST_METADATA_KEY]?: RequestMetadata;
  [RESPONSE_METADATA_KEY]?: ResponseMetadata;
}

/**
 * Main decorator to mark routes for documentation
 */
export function apiRoute(metadata: Omit<RouteMetadata, 'method' | 'path'>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handler = descriptor.value as ExtendedRouteHandler;
    
    // Store metadata on the handler function
    handler[ROUTE_METADATA_KEY] = metadata as RouteMetadata;
    
    return descriptor;
  };
}

/**
 * Decorator for request documentation
 */
export function apiRequest(request: RequestMetadata) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handler = descriptor.value as ExtendedRouteHandler;
    
    // Store request metadata on the handler function
    handler[REQUEST_METADATA_KEY] = request;
    
    return descriptor;
  };
}

/**
 * Decorator for response documentation
 */
export function apiResponse(responses: ResponseMetadata) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handler = descriptor.value as ExtendedRouteHandler;
    
    // Store response metadata on the handler function
    handler[RESPONSE_METADATA_KEY] = responses;
    
    return descriptor;
  };
}

/**
 * Register a route handler with metadata
 * This is used for Next.js App Router where we can't use class decorators
 */
export function documentRoute<T extends RouteHandler>(
  handler: T,
  metadata: RouteMetadata,
  request?: RequestMetadata,
  responses?: ResponseMetadata
): T {
  // Store metadata on the handler for potential runtime use
  const extendedHandler = handler as ExtendedRouteHandler;
  extendedHandler[ROUTE_METADATA_KEY] = metadata;
  if (request) extendedHandler[REQUEST_METADATA_KEY] = request;
  if (responses) extendedHandler[RESPONSE_METADATA_KEY] = responses;
  
  // Register in the global registry
  routeRegistry.registerRoute(metadata);
  
  if (request) {
    routeRegistry.addRequestMetadata(metadata.method, metadata.path, request);
  }
  
  if (responses) {
    routeRegistry.addResponseMetadata(metadata.method, metadata.path, responses);
  }
  
  return handler;
}

/**
 * Helper to create request body documentation
 */
export function requestBody(
  schema: z.ZodType<any>,
  options: {
    description?: string;
    required?: boolean;
    contentType?: string;
    examples?: Record<string, any>;
  } = {}
): RequestMetadata {
  const contentType = options.contentType || 'application/json';
  
  return {
    body: {
      description: options.description,
      required: options.required ?? true,
      content: {
        [contentType]: {
          schema,
          examples: options.examples
        }
      }
    }
  };
}

/**
 * Helper to create query parameters documentation
 */
export function queryParams(
  schema: z.ZodType<any>,
  description?: string
): RequestMetadata {
  return {
    query: {
      schema,
      description
    }
  };
}

/**
 * Helper to create path parameters documentation
 */
export function pathParams(
  schema: z.ZodType<any>,
  description?: string
): RequestMetadata {
  return {
    params: {
      schema,
      description
    }
  };
}

/**
 * Helper to create headers documentation
 */
export function headers(
  schema: z.ZodType<any>,
  description?: string
): RequestMetadata {
  return {
    headers: {
      schema,
      description
    }
  };
}

/**
 * Helper to create response documentation
 */
export function response(
  statusCode: number | string,
  description: string,
  options: {
    schema?: z.ZodType<any>;
    contentType?: string;
    headers?: Record<string, { description?: string; schema: z.ZodType<any> }>;
    examples?: Record<string, any>;
  } = {}
): ResponseMetadata {
  const response: ResponseMetadata = {
    [statusCode.toString()]: {
      description
    }
  };
  
  if (options.schema) {
    const contentType = options.contentType || 'application/json';
    response[statusCode.toString()].content = {
      [contentType]: {
        schema: options.schema,
        examples: options.examples
      }
    };
  }
  
  if (options.headers) {
    response[statusCode.toString()].headers = options.headers;
  }
  
  return response;
}

/**
 * Combine multiple response definitions
 */
export function responses(...responseDefs: ResponseMetadata[]): ResponseMetadata {
  return responseDefs.reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

/**
 * Helper to create standard error responses
 */
export function errorResponses(): ResponseMetadata {
  return responses(
    response(400, 'Bad Request', {
      schema: z.object({
        error: z.string(),
        message: z.string(),
        code: z.string().optional()
      })
    }),
    response(401, 'Unauthorized', {
      schema: z.object({
        error: z.string(),
        message: z.string()
      })
    }),
    response(403, 'Forbidden', {
      schema: z.object({
        error: z.string(),
        message: z.string()
      })
    }),
    response(404, 'Not Found', {
      schema: z.object({
        error: z.string(),
        message: z.string()
      })
    }),
    response(500, 'Internal Server Error', {
      schema: z.object({
        error: z.string(),
        message: z.string()
      })
    })
  );
}

/**
 * Initialize route documentation for a specific API version
 */
export function initializeAPIDocs(options: {
  title: string;
  version: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  securitySchemes?: Record<string, any>;
}) {
  const registry = routeRegistry;
  
  // Set API info
  registry.setInfo({
    title: options.title,
    version: options.version,
    description: options.description
  });
  
  // Add servers
  if (options.servers) {
    options.servers.forEach(server => {
      registry.addServer(server.url, server.description);
    });
  }
  
  // Add tags
  if (options.tags) {
    options.tags.forEach(tag => {
      registry.addTag(tag.name, tag.description);
    });
  }
  
  // Add security schemes
  if (options.securitySchemes) {
    Object.entries(options.securitySchemes).forEach(([name, scheme]) => {
      registry.addSecurityScheme(name, scheme);
    });
  }
}
import {
  OpenAPIDocument,
  OpenAPIPaths,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIComponents,
  OpenAPIParameter,
  OpenAPIRequestBody,
  OpenAPIResponses,
  OpenAPISchema
} from './types';
import { routeRegistry } from './registry';
import { zodToOpenAPISchema } from './zod-to-openapi';
import { z } from 'zod';

/**
 * Generate OpenAPI 3.0 specification from registered routes
 */
export function generateOpenAPISpec(): OpenAPIDocument {
  const registry = routeRegistry;
  const routes = registry.getAllRoutes();
  
  // Generate paths from routes
  const paths: OpenAPIPaths = {};
  const components: OpenAPIComponents = {
    schemas: {},
    securitySchemes: registry.getSecuritySchemes()
  };
  
  // Add default security schemes if not already defined
  if (!components.securitySchemes.bearerAuth) {
    components.securitySchemes.bearerAuth = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    };
  }
  if (!components.securitySchemes.apiKey) {
    components.securitySchemes.apiKey = {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key'
    };
  }
  
  // Group routes by path
  const routesByPath = registry.getRoutesByPath();
  
  for (const [path, pathRoutes] of routesByPath) {
    const pathItem: OpenAPIPathItem = {};
    
    for (const route of pathRoutes) {
      const method = route.metadata.method.toLowerCase() as keyof OpenAPIPathItem;
      const operation = generateOperation(route, components);
      pathItem[method] = operation;
    }
    
    paths[path] = pathItem;
  }
  
  // Build the complete OpenAPI document
  const spec: OpenAPIDocument = {
    openapi: '3.0.0',
    info: registry.getInfo(),
    paths
  };
  
  // Add servers - use defaults if none configured
  const servers = registry.getServers();
  if (servers.length > 0) {
    spec.servers = servers;
  } else {
    // Add default servers
    spec.servers = [
      { url: 'http://localhost:3000', description: 'Development server' },
      { url: 'https://api.beautifyai.com', description: 'Production server' }
    ];
  }
  
  // Add tags if configured
  const tags = registry.getTags();
  if (tags.length > 0) {
    spec.tags = tags;
  }
  
  // Add security requirements if security schemes are defined
  const securitySchemes = registry.getSecuritySchemes();
  if (Object.keys(securitySchemes).length > 0) {
    // Default security requirement for bearer auth if it exists
    if (securitySchemes.bearerAuth) {
      spec.security = [{ bearerAuth: [] }];
    }
  }
  
  // Add components if they have content
  if (
    Object.keys(components.schemas || {}).length > 0 ||
    Object.keys(components.securitySchemes || {}).length > 0
  ) {
    spec.components = components;
  }
  
  return spec;
}

/**
 * Generate operation object for a route
 */
function generateOperation(
  route: any,
  components: OpenAPIComponents
): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    responses: {}
  };
  
  // Add basic metadata
  if (route.metadata.operationId) {
    operation.operationId = route.metadata.operationId;
  }
  if (route.metadata.summary) {
    operation.summary = route.metadata.summary;
  }
  if (route.metadata.description) {
    operation.description = route.metadata.description;
  }
  if (route.metadata.tags) {
    operation.tags = route.metadata.tags;
  }
  if (route.metadata.deprecated) {
    operation.deprecated = route.metadata.deprecated;
  }
  if (route.metadata.security) {
    operation.security = route.metadata.security;
  }
  
  // Process request metadata
  if (route.request) {
    const parameters: OpenAPIParameter[] = [];
    
    // Process query parameters
    if (route.request.query) {
      const querySchema = zodToOpenAPISchema(route.request.query.schema);
      
      // If it's an object, extract individual parameters
      if (querySchema.type === 'object' && querySchema.properties) {
        for (const [name, schema] of Object.entries(querySchema.properties)) {
          const param: OpenAPIParameter = {
            name,
            in: 'query',
            schema: schema as OpenAPISchema,
            required: querySchema.required?.includes(name)
          };
          
          // Add description from schema if available
          if ((schema as OpenAPISchema).description) {
            param.description = (schema as OpenAPISchema).description;
          }
          
          parameters.push(param);
        }
      }
    }
    
    // Process path parameters
    if (route.request.params) {
      const paramsSchema = zodToOpenAPISchema(route.request.params.schema);
      
      // If it's an object, extract individual parameters
      if (paramsSchema.type === 'object' && paramsSchema.properties) {
        for (const [name, schema] of Object.entries(paramsSchema.properties)) {
          const param: OpenAPIParameter = {
            name,
            in: 'path',
            schema: schema as OpenAPISchema,
            required: true // Path parameters are always required
          };
          
          // Add description from schema if available
          if ((schema as OpenAPISchema).description) {
            param.description = (schema as OpenAPISchema).description;
          }
          
          parameters.push(param);
        }
      }
    }
    
    // Process header parameters
    if (route.request.headers) {
      const headersSchema = zodToOpenAPISchema(route.request.headers.schema);
      
      // If it's an object, extract individual parameters
      if (headersSchema.type === 'object' && headersSchema.properties) {
        for (const [name, schema] of Object.entries(headersSchema.properties)) {
          const param: OpenAPIParameter = {
            name,
            in: 'header',
            schema: schema as OpenAPISchema,
            required: headersSchema.required?.includes(name)
          };
          
          // Add description from schema if available
          if ((schema as OpenAPISchema).description) {
            param.description = (schema as OpenAPISchema).description;
          }
          
          parameters.push(param);
        }
      }
    }
    
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
    
    // Process request body
    if (route.request.body) {
      const requestBody: OpenAPIRequestBody = {
        description: route.request.body.description || '',
        required: route.request.body.required !== undefined && typeof route.request.body.required !== 'boolean' 
          ? true 
          : (route.request.body.required ?? true),
        content: {}
      };
      
      // Handle both simple (body + contentType) and complex (content object) formats
      if (route.request.body.content) {
        // Complex format with content object
        for (const [contentType, contentDef] of Object.entries(route.request.body.content)) {
          const schemaName = generateSchemaName(route.metadata.path, route.metadata.method, 'Request');
          // Check if schema is already a plain object (OpenAPI schema) or a Zod schema
          const schema = contentDef.schema.type || contentDef.schema.oneOf || contentDef.schema.$ref
            ? contentDef.schema  // Already an OpenAPI schema
            : zodToOpenAPISchema(contentDef.schema);  // Convert from Zod
          
          // Store schema in components if it's complex
          if (isComplexSchema(schema)) {
            if (!components.schemas) components.schemas = {};
            components.schemas[schemaName] = schema;
            
            requestBody.content[contentType] = {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            };
          } else {
            requestBody.content[contentType] = { schema };
          }
          
          // Add examples if provided
          if (contentDef.examples) {
            requestBody.content[contentType].examples = Object.entries(contentDef.examples).reduce(
              (acc, [name, value]) => ({
                ...acc,
                [name]: { value }
              }),
              {}
            );
          }
        }
      } else if (route.request.body) {
        // Simple format with body schema and optional contentType
        const contentType = route.request.contentType || 'application/json';
        const schema = route.request.body.type ? route.request.body : zodToOpenAPISchema(route.request.body);
        
        requestBody.content[contentType] = { schema };
      }
      
      operation.requestBody = requestBody;
    }
  }
  
  // Add parameters from route metadata if present
  if (route.metadata.parameters && route.metadata.parameters.length > 0) {
    if (!operation.parameters) operation.parameters = [];
    operation.parameters.push(...route.metadata.parameters);
  }
  
  // Process response metadata
  if (route.responses) {
    const responses: OpenAPIResponses = {};
    
    for (const [statusCode, responseDef] of Object.entries(route.responses)) {
      responses[statusCode] = {
        description: responseDef.description
      };
      
      // Handle both simple (schema) and complex (content object) formats
      if (responseDef.content) {
        // Complex format with content object
        responses[statusCode].content = {};
        
        for (const [contentType, contentDef] of Object.entries(responseDef.content)) {
          const schemaName = generateSchemaName(
            route.metadata.path,
            route.metadata.method,
            `Response${statusCode}`
          );
          // Check if schema is already a plain object (OpenAPI schema) or a Zod schema
          const schema = contentDef.schema.type || contentDef.schema.oneOf || contentDef.schema.$ref
            ? contentDef.schema  // Already an OpenAPI schema
            : zodToOpenAPISchema(contentDef.schema);  // Convert from Zod
          
          // Store schema in components if it's complex
          if (isComplexSchema(schema)) {
            if (!components.schemas) components.schemas = {};
            components.schemas[schemaName] = schema;
            
            responses[statusCode].content![contentType] = {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            };
          } else {
            responses[statusCode].content![contentType] = { schema };
          }
          
          // Add examples if provided
          if (contentDef.examples) {
            responses[statusCode].content![contentType].examples = Object.entries(
              contentDef.examples
            ).reduce(
              (acc, [name, value]) => ({
                ...acc,
                [name]: { value }
              }),
              {}
            );
          }
        }
      } else if (responseDef.schema) {
        // Simple format with just a schema
        const contentType = 'application/json';
        const schema = responseDef.schema.type ? responseDef.schema : zodToOpenAPISchema(responseDef.schema);
        
        responses[statusCode].content = {
          [contentType]: { schema }
        };
      }
      
      // Process response headers
      if (responseDef.headers) {
        responses[statusCode].headers = {};
        
        for (const [headerName, headerDef] of Object.entries(responseDef.headers)) {
          responses[statusCode].headers![headerName] = {
            description: headerDef.description,
            schema: zodToOpenAPISchema(headerDef.schema)
          };
        }
      }
    }
    
    operation.responses = responses;
  } else {
    // Default response if none specified
    operation.responses = {
      '200': {
        description: 'Successful response'
      }
    };
  }
  
  return operation;
}

/**
 * Generate a schema name from route information
 */
function generateSchemaName(path: string, method: string, suffix: string): string {
  // Convert path to PascalCase
  const pathParts = path
    .split('/')
    .filter(part => part && !part.startsWith(':') && !part.startsWith('{'))
    .map(part => part.charAt(0).toUpperCase() + part.slice(1));
  
  return `${method}${pathParts.join('')}${suffix}`;
}

/**
 * Check if a schema is complex enough to warrant being stored as a component
 */
function isComplexSchema(schema: OpenAPISchema): boolean {
  // Consider a schema complex if:
  // - It's an object with more than 3 properties
  // - It's an array with a complex items schema
  // - It has composition (allOf, oneOf, anyOf)
  // - It has nested objects or arrays
  
  if (schema.allOf !== undefined || schema.oneOf !== undefined || schema.anyOf !== undefined) {
    return true;
  }
  
  if (schema.type === 'object' && schema.properties) {
    const propertyCount = Object.keys(schema.properties).length;
    
    // Check if any property is itself complex
    const hasComplexProperty = Object.values(schema.properties).some(prop => {
      const propSchema = prop as OpenAPISchema;
      return propSchema.type === 'object' || propSchema.type === 'array' ||
             propSchema.allOf || propSchema.oneOf || propSchema.anyOf;
    });
    
    return propertyCount > 3 || hasComplexProperty;
  }
  
  if (schema.type === 'array' && schema.items) {
    return isComplexSchema(schema.items as OpenAPISchema);
  }
  
  return false;
}

/**
 * Validate OpenAPI specification
 */
export function validateOpenAPISpec(spec: OpenAPIDocument): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Basic validation
  if (!spec.openapi || !spec.openapi.startsWith('3.0')) {
    errors.push('OpenAPI version must be 3.0.x');
  }
  
  if (!spec.info || !spec.info.title || !spec.info.version) {
    errors.push('Info object must contain title and version');
  }
  
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push('Paths object must contain at least one path');
  }
  
  // Validate paths
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    if (!path.startsWith('/')) {
      errors.push(`Path "${path}" must start with /`);
    }
    
    // Check that at least one operation is defined
    const operations = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    const hasOperation = operations.some(op => op in pathItem);
    if (!hasOperation) {
      errors.push(`Path "${path}" must have at least one operation`);
    }
    
    // Validate operations
    for (const operation of operations) {
      if (operation in pathItem) {
        const op = pathItem[operation as keyof OpenAPIPathItem];
        if (op && (!op.responses || Object.keys(op.responses).length === 0)) {
          errors.push(`Operation ${operation.toUpperCase()} ${path} must have at least one response`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
import { z } from 'zod';

// OpenAPI 3.0 type definitions
export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: OpenAPIPaths;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocs;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

export interface OpenAPIContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface OpenAPILicense {
  name: string;
  url?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, OpenAPIServerVariable>;
}

export interface OpenAPIServerVariable {
  default: string;
  description?: string;
  enum?: string[];
}

export interface OpenAPIPaths {
  [path: string]: OpenAPIPathItem;
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  head?: OpenAPIOperation;
  options?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  servers?: OpenAPIServer[];
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  externalDocs?: OpenAPIExternalDocs;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: OpenAPIResponses;
  callbacks?: Record<string, any>;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  servers?: OpenAPIServer[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
  encoding?: Record<string, OpenAPIEncoding>;
}

export interface OpenAPIEncoding {
  contentType?: string;
  headers?: Record<string, OpenAPIHeader>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface OpenAPIHeader extends Omit<OpenAPIParameter, 'name' | 'in'> {}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface OpenAPIResponses {
  [statusCode: string]: OpenAPIResponse;
}

export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
  links?: Record<string, OpenAPILink>;
}

export interface OpenAPILink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: OpenAPIServer;
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  examples?: Record<string, OpenAPIExample>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  links?: Record<string, OpenAPILink>;
  callbacks?: Record<string, any>;
}

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  example?: any;
  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Number validations
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;
  exclusiveMaximum?: boolean | number;
  multipleOf?: number;
  // Array validations
  items?: OpenAPISchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object validations
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: boolean | OpenAPISchema;
  minProperties?: number;
  maxProperties?: number;
  // Composition
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  // Other
  enum?: any[];
  const?: any;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: OpenAPIXML;
  externalDocs?: OpenAPIExternalDocs;
  deprecated?: boolean;
  discriminator?: OpenAPIDiscriminator;
}

export interface OpenAPIXML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface OpenAPIDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  // For apiKey
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  // For http
  scheme?: string;
  bearerFormat?: string;
  // For oauth2
  flows?: OpenAPIAuthFlows;
  // For openIdConnect
  openIdConnectUrl?: string;
}

export interface OpenAPIAuthFlows {
  implicit?: OpenAPIAuthFlow;
  password?: OpenAPIAuthFlow;
  clientCredentials?: OpenAPIAuthFlow;
  authorizationCode?: OpenAPIAuthFlow;
}

export interface OpenAPIAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocs;
}

export interface OpenAPIExternalDocs {
  description?: string;
  url: string;
}

// Route metadata for decorators
export interface RouteMetadata {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
}

export interface RequestMetadata {
  body?: {
    description?: string;
    required?: boolean;
    content: {
      [contentType: string]: {
        schema: z.ZodType<any>;
        examples?: Record<string, any>;
      };
    };
  };
  query?: {
    schema: z.ZodType<any>;
    description?: string;
  };
  params?: {
    schema: z.ZodType<any>;
    description?: string;
  };
  headers?: {
    schema: z.ZodType<any>;
    description?: string;
  };
}

export interface ResponseMetadata {
  [statusCode: string]: {
    description: string;
    content?: {
      [contentType: string]: {
        schema: z.ZodType<any>;
        examples?: Record<string, any>;
      };
    };
    headers?: Record<string, {
      description?: string;
      schema: z.ZodType<any>;
    }>;
  };
}

// Registry types
export interface RegisteredRoute {
  metadata: RouteMetadata;
  request?: RequestMetadata;
  responses?: ResponseMetadata;
  // Convenience properties for tests
  path?: string;
  method?: string;
}

// Decorator metadata keys
export const ROUTE_METADATA_KEY = Symbol('route:metadata');
export const REQUEST_METADATA_KEY = Symbol('request:metadata');
export const RESPONSE_METADATA_KEY = Symbol('response:metadata');
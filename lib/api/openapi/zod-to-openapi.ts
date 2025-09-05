import { z } from 'zod';
import { OpenAPISchema } from './types';

/**
 * Convert Zod schema to OpenAPI 3.0 schema format
 */
export function zodToOpenAPISchema(schema: z.ZodType<any>): OpenAPISchema {
  const openAPISchema: OpenAPISchema = {};
  
  // Handle nullable types
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    const innerSchema = zodToOpenAPISchema(schema.unwrap());
    if (schema instanceof z.ZodNullable) {
      // Note: In OpenAPI 3.0, nullable is a property at the same level as type
      // In OpenAPI 3.1, you would use type: ['string', 'null'] instead
      return {
        ...innerSchema,
        nullable: true
      };
    }
    return innerSchema;
  }

  // Handle default values
  if (schema instanceof z.ZodDefault) {
    const innerSchema = zodToOpenAPISchema(schema._def.innerType);
    return {
      ...innerSchema,
      default: schema._def.defaultValue()
    };
  }

  // String types
  if (schema instanceof z.ZodString) {
    openAPISchema.type = 'string';
    
    for (const check of (schema as any)._def.checks || []) {
      switch (check.kind) {
        case 'min':
          openAPISchema.minLength = check.value;
          break;
        case 'max':
          openAPISchema.maxLength = check.value;
          break;
        case 'length':
          openAPISchema.minLength = check.value;
          openAPISchema.maxLength = check.value;
          break;
        case 'email':
          openAPISchema.format = 'email';
          break;
        case 'url':
          openAPISchema.format = 'uri';
          break;
        case 'uuid':
          openAPISchema.format = 'uuid';
          break;
        case 'datetime':
          openAPISchema.format = 'date-time';
          break;
        case 'regex':
          openAPISchema.pattern = check.regex.source;
          break;
      }
    }
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Number types
  if (schema instanceof z.ZodNumber) {
    openAPISchema.type = 'number';
    
    for (const check of (schema as any)._def.checks || []) {
      switch (check.kind) {
        case 'min':
          openAPISchema.minimum = check.value;
          break;
        case 'max':
          openAPISchema.maximum = check.value;
          break;
        case 'int':
          openAPISchema.type = 'integer';
          break;
        case 'multipleOf':
          openAPISchema.multipleOf = check.value;
          break;
      }
    }
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Boolean types
  if (schema instanceof z.ZodBoolean) {
    openAPISchema.type = 'boolean';
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Literal types
  if (schema instanceof z.ZodLiteral) {
    const value = (schema as any)._def.value;
    openAPISchema.const = value;
    
    if (typeof value === 'string') {
      openAPISchema.type = 'string';
    } else if (typeof value === 'number') {
      openAPISchema.type = 'number';
    } else if (typeof value === 'boolean') {
      openAPISchema.type = 'boolean';
    }
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Enum types
  if (schema instanceof z.ZodEnum) {
    openAPISchema.type = 'string';
    openAPISchema.enum = (schema as any)._def.values;
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Native enum types
  if (schema instanceof z.ZodNativeEnum) {
    const enumObj = (schema as any)._def.values;
    const values = Object.values(enumObj);
    
    // Check if all values are strings or all are numbers
    const allStrings = values.every(v => typeof v === 'string');
    const allNumbers = values.every(v => typeof v === 'number');
    
    if (allStrings) {
      openAPISchema.type = 'string';
    } else if (allNumbers) {
      openAPISchema.type = 'number';
    }
    
    openAPISchema.enum = values;
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Array types
  if (schema instanceof z.ZodArray) {
    openAPISchema.type = 'array';
    openAPISchema.items = zodToOpenAPISchema((schema as any)._def.type);
    
    const def = (schema as any)._def;
    if (def.minLength !== null && def.minLength !== undefined) {
      openAPISchema.minItems = def.minLength.value;
    }
    if (def.maxLength !== null && def.maxLength !== undefined) {
      openAPISchema.maxItems = def.maxLength.value;
    }
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Object types
  if (schema instanceof z.ZodObject) {
    openAPISchema.type = 'object';
    openAPISchema.properties = {};
    openAPISchema.required = [];
    
    const shape = (schema as any)._def.shape();
    
    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType<any>;
      openAPISchema.properties[key] = zodToOpenAPISchema(fieldSchema);
      
      // Check if field is required
      // Note: ZodNullable fields are still required (must be present, but can be null)
      // Only ZodOptional and ZodDefault fields are not required
      if (!(fieldSchema instanceof z.ZodOptional) && 
          !(fieldSchema instanceof z.ZodDefault)) {
        openAPISchema.required.push(key);
      }
    }
    
    // Handle additional properties
    const unknownKeys = (schema as any)._def.unknownKeys;
    if (unknownKeys === 'strict') {
      openAPISchema.additionalProperties = false;
    }
    
    if (openAPISchema.required.length === 0) {
      delete openAPISchema.required;
    }
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Record types
  if (schema instanceof z.ZodRecord) {
    openAPISchema.type = 'object';
    openAPISchema.additionalProperties = zodToOpenAPISchema((schema as any)._def.valueType);
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Union types
  if (schema instanceof z.ZodUnion) {
    const options = (schema as any)._def.options as z.ZodType<any>[];
    openAPISchema.oneOf = options.map(option => zodToOpenAPISchema(option));
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Discriminated union types
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const discriminator = (schema as any)._def.discriminator;
    const options = [...(schema as any)._def.options.values()] as z.ZodType<any>[];
    
    openAPISchema.oneOf = options.map(option => zodToOpenAPISchema(option));
    openAPISchema.discriminator = {
      propertyName: discriminator
    };
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Intersection types
  if (schema instanceof z.ZodIntersection) {
    const left = zodToOpenAPISchema((schema as any)._def.left);
    const right = zodToOpenAPISchema((schema as any)._def.right);
    
    openAPISchema.allOf = [left, right];
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Tuple types
  if (schema instanceof z.ZodTuple) {
    openAPISchema.type = 'array';
    const items = (schema as any)._def.items as z.ZodType<any>[];
    openAPISchema.minItems = items.length;
    openAPISchema.maxItems = items.length;
    
    // Use prefixItems for tuple validation if available (OpenAPI 3.1)
    // Otherwise, use items with oneOf
    openAPISchema.items = {
      oneOf: items.map(item => zodToOpenAPISchema(item))
    };
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Date types
  if (schema instanceof z.ZodDate) {
    openAPISchema.type = 'string';
    openAPISchema.format = 'date-time';
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Any types
  if (schema instanceof z.ZodAny) {
    // Any type allows any value
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Unknown types
  if (schema instanceof z.ZodUnknown) {
    // Unknown type allows any value
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Void types
  if (schema instanceof z.ZodVoid) {
    openAPISchema.type = 'null';
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Never types
  if (schema instanceof z.ZodNever) {
    openAPISchema.not = {};
    
    if (schema.description) {
      openAPISchema.description = schema.description;
    }
    
    return openAPISchema;
  }

  // Effects (refinements, transforms) - extract inner type
  if ((schema as any)._def && 'innerType' in (schema as any)._def) {
    return zodToOpenAPISchema((schema as any)._def.innerType);
  }

  // Default case
  console.warn('Unknown Zod type:', schema.constructor.name);
  return openAPISchema;
}

/**
 * Extract examples from Zod schema if available
 */
export function extractExamplesFromZodSchema(schema: z.ZodType<any>): any[] {
  // This could be extended to extract examples from schema metadata
  // For now, return empty array
  return [];
}

/**
 * Create a reference to a schema component
 */
export function createSchemaRef(name: string): OpenAPISchema {
  return {
    $ref: `#/components/schemas/${name}`
  } as any;
}
/**
 * Schema Registry System
 * 
 * Provides a flexible way to define schemas once and reuse them across:
 * - tRPC procedures 
 * - MCP tool registration
 * - JSON-RPC method validation
 * 
 * Supports multiple validation libraries with extensible interface.
 */

import { z } from 'zod';
import { zodSchemaToJson } from '../utils/zod-json-schema';

/**
 * Base validator interface - extensible for other validation libraries
 */
export interface BaseValidator<T = any> {
  parse(input: unknown): T;
  safeParse?(input: unknown): { success: boolean; data?: T; error?: any };
}

/**
 * Validator type enum for easy identification
 */
export enum ValidatorType {
  ZOD = 'zod',
  YUP = 'yup',
  JOI = 'joi'
}

/**
 * Schema definition with metadata
 */
export interface SchemaDefinition<T = any> {
  /** Unique identifier for this schema */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description for documentation */
  description: string;
  /** The actual validator (Zod, Yup, Joi, etc.) */
  validator: BaseValidator<T>;
  /** Type of validator for conversion logic */
  validatorType: ValidatorType;
  /** Category for organization */
  category?: string;
  /** Example input for documentation */
  example?: T;
  /** JSON Schema representation (cached) */
  jsonSchema?: any;
}

/**
 * Schema registry for managing reusable schemas
 */
export class SchemaRegistry {
  private schemas = new Map<string, SchemaDefinition>();
  private jsonSchemaCache = new Map<string, any>();

  /**
   * Register a schema in the registry
   */
  register<T>(definition: SchemaDefinition<T>): void {
    this.schemas.set(definition.id, definition);
    // Clear cached JSON schema if it exists
    this.jsonSchemaCache.delete(definition.id);
  }

  /**
   * Get a schema by ID
   */
  get<T = any>(id: string): SchemaDefinition<T> | undefined {
    return this.schemas.get(id) as SchemaDefinition<T> | undefined;
  }

  /**
   * Get validator directly (for tRPC .input())
   */
  getValidator<T = any>(id: string): BaseValidator<T> | undefined {
    const schema = this.get<T>(id);
    return schema?.validator;
  }

  /**
   * Get JSON Schema representation (for MCP tools)
   */
  getJsonSchema(id: string): any {
    // Check cache first
    if (this.jsonSchemaCache.has(id)) {
      return this.jsonSchemaCache.get(id);
    }

    const schema = this.get(id);
    if (!schema) {
      throw new Error(`Schema '${id}' not found in registry`);
    }

    let jsonSchema: any;

    switch (schema.validatorType) {
      case ValidatorType.ZOD:
        jsonSchema = this.convertZodToJsonSchema(schema.validator as z.ZodType);
        break;
      case ValidatorType.YUP:
        jsonSchema = this.convertYupToJsonSchema(schema.validator);
        break;
      case ValidatorType.JOI:
        jsonSchema = this.convertJoiToJsonSchema(schema.validator);
        break;
      default:
        // Fallback for unknown validator types
        jsonSchema = {
          type: 'object',
          properties: {},
          additionalProperties: true,
          description: `Schema for ${schema.name} (${schema.validatorType} validator)`
        };
    }

    // Cache the result
    this.jsonSchemaCache.set(id, jsonSchema);
    return jsonSchema;
  }

  /**
   * List all registered schemas
   */
  list(): SchemaDefinition[] {
    return Array.from(this.schemas.values());
  }

  /**
   * List schemas by category
   */
  listByCategory(category: string): SchemaDefinition[] {
    return Array.from(this.schemas.values()).filter(s => s.category === category);
  }

  /**
   * Validate input against a schema
   */
  validate<T = any>(schemaId: string, input: unknown): T {
    const schema = this.get(schemaId);
    if (!schema) {
      throw new Error(`Schema '${schemaId}' not found`);
    }
    return schema.validator.parse(input);
  }

  /**
   * Safe validation (returns success/error instead of throwing)
   */
  safeValidate<T = any>(schemaId: string, input: unknown): { success: boolean; data?: T; error?: any } {
    const schema = this.get(schemaId);
    if (!schema) {
      return { success: false, error: `Schema '${schemaId}' not found` };
    }

    if (schema.validator.safeParse) {
      return schema.validator.safeParse(input);
    }

    // Fallback for validators without safeParse
    try {
      const data = schema.validator.parse(input);
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Private converter methods
  private convertZodToJsonSchema(zodSchema: z.ZodType): any {
    try {
      const schema = zodSchemaToJson(zodSchema);
      
      // Handle schemas with $ref and definitions
      if ((schema as any).$ref && ((schema as any).definitions || (schema as any).$defs)) {
        const defs = (schema as any).definitions || (schema as any).$defs;
        const refKey = (schema as any).$ref.replace('#/definitions/', '').replace('#/$defs/', '');
        const resolvedSchema = defs[refKey];
        
        if (resolvedSchema) {
          // Return the resolved schema for direct property access
          return {
            type: "object",
            properties: resolvedSchema.properties || {},
            additionalProperties: resolvedSchema.additionalProperties ?? true,
            required: resolvedSchema.required || [],
            description: resolvedSchema.description
          };
        }
      }
      
      // Fallback for direct schemas without $ref
      return {
        type: "object",
        properties: (schema as any).properties || {},
        additionalProperties: (schema as any).additionalProperties ?? true,
        required: (schema as any).required || [],
      };
    } catch (error) {
      console.warn('Failed to convert Zod schema to JSON Schema:', error);
      return {
        type: 'object',
        properties: {},
        additionalProperties: true
      };
    }
  }

  private convertYupToJsonSchema(yupSchema: any): any {
    // Placeholder for Yup conversion - would need yup-to-json-schema package
    console.warn('Yup to JSON Schema conversion not implemented yet');
    return {
      type: 'object',
      properties: {},
      additionalProperties: true,
      description: 'Yup schema (conversion not implemented)'
    };
  }

  private convertJoiToJsonSchema(joiSchema: any): any {
    // Placeholder for Joi conversion - would need joi-to-json-schema package
    console.warn('Joi to JSON Schema conversion not implemented yet');
    return {
      type: 'object',
      properties: {},
      additionalProperties: true,
      description: 'Joi schema (conversion not implemented)'
    };
  }
}

/**
 * Global schema registry instance
 */
export const schemaRegistry = new SchemaRegistry();

/**
 * Helper functions for common schema operations
 */

/**
 * Create a Zod schema definition
 */
export function createZodSchema<T>(
  id: string,
  name: string,
  description: string,
  validator: z.ZodType<T>,
  options?: {
    category?: string;
    example?: T;
  }
): SchemaDefinition<T> {
  return {
    id,
    name,
    description,
    validator: validator as BaseValidator<T>,
    validatorType: ValidatorType.ZOD,
    category: options?.category,
    example: options?.example
  };
}

/**
 * Simple input schema definition - auto-registers and returns original validator
 * Name clarifies this is for input validation only (not output)
 */
export function input<T extends z.ZodType>(
  validator: T,
  id?: string
): T {
  // Auto-generate ID if not provided
  if (!id) {
    id = `schema_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Auto-generate name and description from validator
  let name = id.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  let description = `Input schema for ${name}`;
  
  // Try to extract description from Zod schema
  if ((validator as any).description) {
    description = (validator as any).description;
  }

  const schemaDefinition: SchemaDefinition<z.infer<T>> = {
    id,
    name,
    description,
    validator: validator as BaseValidator<z.infer<T>>,
    validatorType: ValidatorType.ZOD,
  };

  schemaRegistry.register(schemaDefinition);
  return validator; // Return the original validator for tRPC type inference
}

/**
 * Shorter alias for input() - just as easy to remember
 */
export const s = input;

/**
 * Define schema with explicit metadata (for when you need more control)
 */
export function defineSchema<T extends z.ZodType>(
  validator: T,
  options: {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    example?: z.infer<T>;
  } = {}
): T {
  const id = options.id || `schema_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const name = options.name || id.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const description = options.description || `Schema for ${name}`;

  // Auto-detect validator type
  let validatorType = ValidatorType.ZOD;
  if ((validator as any)._isYupSchema) validatorType = ValidatorType.YUP;
  if ((validator as any).isJoi) validatorType = ValidatorType.JOI;

  const schemaDefinition: SchemaDefinition<z.infer<T>> = {
    id,
    name,
    description,
    validator: validator as BaseValidator<z.infer<T>>,
    validatorType,
    category: options.category,
    example: options.example
  };

  schemaRegistry.register(schemaDefinition);
  return validator; // Return original validator for direct use
}

/**
 * Get schema by ID (backwards compatibility)
 */
export function schema(id: string) {
  const validator = schemaRegistry.getValidator(id);
  if (!validator) {
    throw new Error(`Schema '${id}' not found. Make sure to register it first.`);
  }
  return validator;
}

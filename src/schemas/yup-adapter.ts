/**
 * Yup Validator Adapter
 * 
 * Provides Yup schema support for the schema registry.
 * Install with: npm install yup
 */

import type { BaseValidator, ValidatorType } from './schema-registry';

/**
 * Yup validator adapter - implements BaseValidator interface
 */
export class YupValidator<T = any> implements BaseValidator<T> {
  constructor(private yupSchema: any) {}

  parse(input: unknown): T {
    // Yup uses validate() method
    return this.yupSchema.validateSync(input, { strict: true });
  }

  safeParse(input: unknown): { success: boolean; data?: T; error?: any } {
    try {
      const data = this.yupSchema.validateSync(input, { strict: true });
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }
}

/**
 * Helper function to create Yup schema definitions
 */
export function createYupSchema<T>(
  id: string,
  name: string,
  description: string,
  yupSchema: any,
  options?: {
    category?: string;
    example?: T;
  }
) {
  return {
    id,
    name,
    description,
    validator: new YupValidator<T>(yupSchema),
    validatorType: 'yup' as ValidatorType,
    category: options?.category,
    example: options?.example
  };
}

/**
 * Example usage:
 * 
 * import * as yup from 'yup';
 * import { schemaRegistry } from './schema-registry';
 * import { createYupSchema } from './yup-adapter';
 * 
 * const userSchema = yup.object({
 *   name: yup.string().required(),
 *   age: yup.number().positive().integer().required()
 * });
 * 
 * const schemaDefinition = createYupSchema(
 *   'user.profile',
 *   'User Profile',
 *   'User profile information',
 *   userSchema,
 *   { category: 'user', example: { name: 'John', age: 25 } }
 * );
 * 
 * schemaRegistry.register(schemaDefinition);
 */
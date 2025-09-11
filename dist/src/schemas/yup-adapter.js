/**
 * Yup Validator Adapter
 *
 * Provides Yup schema support for the schema registry.
 * Install with: npm install yup
 */
/**
 * Yup validator adapter - implements BaseValidator interface
 */
export class YupValidator {
    yupSchema;
    constructor(yupSchema) {
        this.yupSchema = yupSchema;
    }
    parse(input) {
        // Yup uses validate() method
        return this.yupSchema.validateSync(input, { strict: true });
    }
    safeParse(input) {
        try {
            const data = this.yupSchema.validateSync(input, { strict: true });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error };
        }
    }
}
/**
 * Helper function to create Yup schema definitions
 */
export function createYupSchema(id, name, description, yupSchema, options) {
    return {
        id,
        name,
        description,
        validator: new YupValidator(yupSchema),
        validatorType: 'yup',
        category: options?.category,
        example: options?.example
    };
}
/**
 * Example usage:
 *
 * import * as yup from 'yup';
 * import { schemaRegistry } from './schema-registry.js';
 * import { createYupSchema } from './yup-adapter.js';
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

import { z, ZodFirstPartyTypeKind } from 'zod';

/**
 * Convert a Zod schema to a JSON Schema representation using Zod's built-in generator.
 * Normalizes root $ref structures so consumers can rely on standard object shapes.
 */
export function zodSchemaToJson(schema: z.ZodTypeAny): Record<string, unknown> {
  const typeName = (schema as any)?._def?.typeName;

  if (typeName === ZodFirstPartyTypeKind.ZodVoid || typeName === ZodFirstPartyTypeKind.ZodUndefined) {
    return {
      type: 'object',
      properties: {},
      additionalProperties: false,
      description: 'No parameters required.',
    };
  }

  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
  return normalizeRootSchema(jsonSchema);
}

function normalizeRootSchema(schema: any): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: true };
  }

  if (schema.$ref) {
    const defs = schema.$defs ?? schema.definitions;
    if (defs) {
      const refKey = schema.$ref.replace('#/$defs/', '').replace('#/definitions/', '');
      const resolved = defs[refKey];
      if (resolved && typeof resolved === 'object') {
        return {
          ...resolved,
          $schema: schema.$schema ?? resolved.$schema,
        };
      }
    }
  }

  return schema;
}

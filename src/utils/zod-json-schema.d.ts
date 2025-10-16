import { z } from 'zod';
/**
 * Convert a Zod schema to a JSON Schema representation using Zod's built-in generator.
 * Normalizes root $ref structures so consumers can rely on standard object shapes.
 */
export declare function zodSchemaToJson(schema: z.ZodTypeAny): Record<string, unknown>;
//# sourceMappingURL=zod-json-schema.d.ts.map
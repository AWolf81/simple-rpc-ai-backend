/**
 * Type-safe RPC Router inspired by tRPC patterns
 *
 * Provides createRPCRouter for building type-safe JSON-RPC endpoints
 * with automatic OpenRPC schema generation.
 */
// Simple validation helpers (can be extended with zod later)
export const v = {
    object: (schema) => {
        return (input) => {
            if (typeof input !== 'object' || input === null) {
                throw new Error('Input must be an object');
            }
            const result = {};
            const inputObj = input;
            for (const [key, validator] of Object.entries(schema)) {
                result[key] = validator(inputObj[key]);
            }
            return result;
        };
    },
    string: () => {
        return (input) => {
            if (typeof input !== 'string') {
                throw new Error('Expected string');
            }
            return input;
        };
    },
    number: () => {
        return (input) => {
            if (typeof input !== 'number') {
                throw new Error('Expected number');
            }
            return input;
        };
    },
    optional: (validator) => {
        return (input) => {
            if (input === undefined || input === null) {
                return undefined;
            }
            return validator(input);
        };
    }
};
// Procedure builder implementation
class RPCProcedureBuilderImpl {
    _input;
    _meta;
    input(validator) {
        this._input = validator;
        return this;
    }
    meta(meta) {
        this._meta = meta;
        return this;
    }
    mutation(resolver) {
        return {
            _def: {
                input: this._input,
                meta: this._meta,
                resolver
            }
        };
    }
    query(resolver) {
        return {
            _def: {
                input: this._input,
                meta: this._meta,
                resolver
            }
        };
    }
}
// Export the procedure builder
export const publicProcedure = new RPCProcedureBuilderImpl();
// Router creation function (like tRPC's createTRPCRouter)
export function createRPCRouter(procedures) {
    return {
        _def: {
            procedures
        }
    };
}
// Execute a procedure
export async function executeProcedure(procedure, input, ctx) {
    try {
        // Validate input if validator exists
        const validatedInput = procedure._def.input ? procedure._def.input(input) : input;
        // Execute resolver
        const result = await procedure._def.resolver(validatedInput, ctx);
        return result;
    }
    catch (error) {
        throw error;
    }
}
// Generate OpenRPC schema from router
export function generateOpenRPCSchema(router, info) {
    const methods = Object.entries(router._def.procedures).map(([name, procedure]) => {
        return {
            name,
            description: procedure._def.meta?.description || `${name} procedure`,
            params: procedure._def.input ? [
                {
                    name: 'input',
                    required: true,
                    schema: { type: 'object' } // Could be enhanced with actual schema inference
                }
            ] : [],
            result: {
                name: 'result',
                schema: { type: 'object' }
            },
            examples: procedure._def.meta?.examples || []
        };
    });
    return {
        openrpc: '1.2.6',
        info,
        methods
    };
}
//# sourceMappingURL=router.js.map
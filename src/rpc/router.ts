/**
 * Type-safe RPC Router inspired by tRPC patterns
 * 
 * Provides createRPCRouter for building type-safe JSON-RPC endpoints
 * with automatic OpenRPC schema generation.
 */

import type { Request, Response } from 'express';

// Base types for RPC procedures
export interface RPCContext {
  req: Request;
  res: Response;
}

export interface RPCMeta {
  description?: string;
  examples?: Array<{
    name: string;
    params?: any;
    result?: any;
  }>;
}

// Procedure builder types
export interface RPCProcedure<TInput = any, TOutput = any> {
  _def: {
    input?: (input: unknown) => TInput;
    output?: (output: TOutput) => TOutput;
    meta?: RPCMeta;
    resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput;
  };
}

export interface RPCProcedureBuilder {
  input<T>(validator: (input: unknown) => T): RPCProcedureWithInput<T>;
  meta(meta: RPCMeta): this;
  mutation<TOutput>(
    resolver: (input: unknown, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<unknown, TOutput>;
  query<TOutput>(
    resolver: (input: unknown, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<unknown, TOutput>;
}

export interface RPCProcedureWithInput<TInput> {
  meta(meta: RPCMeta): this;
  mutation<TOutput>(
    resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<TInput, TOutput>;
  query<TOutput>(
    resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<TInput, TOutput>;
}

// Router types
export interface RPCRouter {
  _def: {
    procedures: Record<string, RPCProcedure>;
  };
}

// Input validator type (simple - could be replaced with zod)
export type InputValidator<T> = (input: unknown) => T;

// Simple validation helpers (can be extended with zod later)
export const v = {
  object: <T extends Record<string, any>>(schema: {
    [K in keyof T]: InputValidator<T[K]>;
  }): InputValidator<T> => {
    return (input: unknown): T => {
      if (typeof input !== 'object' || input === null) {
        throw new Error('Input must be an object');
      }
      
      const result = {} as T;
      const inputObj = input as Record<string, unknown>;
      
      for (const [key, validator] of Object.entries(schema)) {
        result[key as keyof T] = validator(inputObj[key]);
      }
      
      return result;
    };
  },
  
  string: (): InputValidator<string> => {
    return (input: unknown): string => {
      if (typeof input !== 'string') {
        throw new Error('Expected string');
      }
      return input;
    };
  },
  
  number: (): InputValidator<number> => {
    return (input: unknown): number => {
      if (typeof input !== 'number') {
        throw new Error('Expected number');
      }
      return input;
    };
  },
  
  optional: <T>(validator: InputValidator<T>): InputValidator<T | undefined> => {
    return (input: unknown): T | undefined => {
      if (input === undefined || input === null) {
        return undefined;
      }
      return validator(input);
    };
  }
};

// Procedure builder implementation
class RPCProcedureBuilderImpl implements RPCProcedureBuilder, RPCProcedureWithInput<any> {
  private _input?: (input: unknown) => any;
  private _meta?: RPCMeta;

  input<T>(validator: (input: unknown) => T): RPCProcedureWithInput<T> {
    this._input = validator;
    return this as any;
  }

  meta(meta: RPCMeta): this {
    this._meta = meta;
    return this;
  }

  mutation<TOutput>(
    resolver: (input: any, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<any, TOutput> {
    return {
      _def: {
        input: this._input,
        meta: this._meta,
        resolver
      }
    };
  }

  query<TOutput>(
    resolver: (input: any, ctx: RPCContext) => Promise<TOutput> | TOutput
  ): RPCProcedure<any, TOutput> {
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
export function createRPCRouter(procedures: Record<string, RPCProcedure>): RPCRouter {
  return {
    _def: {
      procedures
    }
  };
}

// Execute a procedure
export async function executeProcedure(
  procedure: RPCProcedure,
  input: unknown,
  ctx: RPCContext
): Promise<any> {
  try {
    // Validate input if validator exists
    const validatedInput = procedure._def.input ? procedure._def.input(input) : input;
    
    // Execute resolver
    const result = await procedure._def.resolver(validatedInput, ctx);
    
    return result;
  } catch (error) {
    throw error;
  }
}

// Generate OpenRPC schema from router
export function generateOpenRPCSchema(
  router: RPCRouter,
  info: { title: string; description?: string; version: string }
): any {
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
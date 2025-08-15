/**
 * Tests for the simplified tRPC-based router
 */

import { describe, it, expect } from 'vitest';
import { createTRPCRouter, publicProcedure, v, generateOpenRPCSchema } from '../src/rpc/router.js';
import type { AppRouter } from '../src/rpc/router.js';

describe('Simplified tRPC Router', () => {
  it('should create a simple tRPC router', () => {
    const router = createTRPCRouter({
      hello: publicProcedure
        .input(v.object({ name: v.string() }))
        .query(async ({ input }) => {
          return { message: `Hello, ${input.name}!` };
        }),

      ping: publicProcedure
        .query(async () => {
          return { pong: true };
        })
    });

    expect(router).toBeDefined();
    expect(typeof router).toBe('object'); // tRPC routers are objects with call signatures
  });

  it('should generate OpenRPC schema', () => {
    const schema = generateOpenRPCSchema({
      title: 'Test API',
      description: 'Test RPC API',
      version: '1.0.0'
    });

    expect(schema.openrpc).toBe('1.2.6');
    expect(schema.info.title).toBe('Test API');
    expect(schema.info.description).toBe('Test RPC API');
    expect(schema.methods).toHaveLength(3); // ai.health, ai.executeAIRequest, ai.listProviders
    expect(schema.methods[0].name).toBe('ai.health');
  });

  it('should export Zod validators correctly', () => {
    // Test Zod validators through our v object
    const stringSchema = v.string();
    const numberSchema = v.number();
    const objectSchema = v.object({
      name: v.string(),
      age: v.optional(v.number())
    });

    // These would be parsed by Zod, not executed directly
    expect(stringSchema).toBeDefined();
    expect(numberSchema).toBeDefined(); 
    expect(objectSchema).toBeDefined();
    
    // Test basic Zod parsing
    expect(stringSchema.parse('hello')).toBe('hello');
    expect(numberSchema.parse(42)).toBe(42);
    expect(objectSchema.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    expect(objectSchema.parse({ name: 'Bob' })).toEqual({ name: 'Bob' });
  });

  it('should validate tRPC router compatibility', () => {
    // Test that we can create a tRPC router with proper types
    const testRouter = createTRPCRouter({
      test: publicProcedure
        .input(v.object({
          message: v.string(),
          count: v.optional(v.number().default(1))
        }))
        .query(async ({ input }) => {
          return {
            response: `Received: ${input.message}`,
            repeated: input.count || 1
          };
        })
    });

    expect(testRouter).toBeDefined();
    expect(typeof testRouter).toBe('object');
  });
});
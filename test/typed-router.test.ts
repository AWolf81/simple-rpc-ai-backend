/**
 * Tests for the type-safe RPC router implementation
 */

import { describe, it, expect } from 'vitest';
import { createRPCRouter, publicProcedure, v, generateOpenRPCSchema, executeProcedure } from '../src/rpc/router.js';
import type { RPCContext } from '../src/rpc/router.js';

describe('Type-safe RPC Router', () => {
  it('should create a simple router with procedures', () => {
    const router = createRPCRouter({
      hello: publicProcedure
        .input(v.object({ name: v.string() }))
        .query(async ({ name }) => {
          return { message: `Hello, ${name}!` };
        }),

      ping: publicProcedure
        .query(async () => {
          return { pong: true };
        })
    });

    expect(router._def.procedures).toHaveProperty('hello');
    expect(router._def.procedures).toHaveProperty('ping');
    expect(Object.keys(router._def.procedures)).toHaveLength(2);
  });

  it('should execute procedures with proper input validation', async () => {
    const router = createRPCRouter({
      greet: publicProcedure
        .input(v.object({ 
          name: v.string(),
          age: v.optional(v.number())
        }))
        .query(async ({ name, age }) => {
          return { 
            greeting: `Hello ${name}${age ? `, you are ${age} years old` : ''}!`
          };
        })
    });

    const ctx: RPCContext = {} as any;
    
    // Test with valid input
    const result1 = await executeProcedure(
      router._def.procedures.greet, 
      { name: 'Alice', age: 30 }, 
      ctx
    );
    expect(result1.greeting).toBe('Hello Alice, you are 30 years old!');

    // Test with partial input
    const result2 = await executeProcedure(
      router._def.procedures.greet,
      { name: 'Bob' },
      ctx  
    );
    expect(result2.greeting).toBe('Hello Bob!');

    // Test with invalid input
    await expect(executeProcedure(
      router._def.procedures.greet,
      { name: 123 }, // invalid type
      ctx
    )).rejects.toThrow('Expected string');
  });

  it('should generate OpenRPC schema from router', () => {
    const router = createRPCRouter({
      health: publicProcedure
        .meta({
          description: 'Check server health',
          examples: [{ name: 'health check', result: { status: 'ok' } }]
        })
        .query(async () => ({ status: 'healthy' })),

      echo: publicProcedure
        .input(v.object({ message: v.string() }))
        .meta({
          description: 'Echo back a message'
        })
        .query(async ({ message }) => ({ echo: message }))
    });

    const schema = generateOpenRPCSchema(router, {
      title: 'Test API',
      description: 'Test RPC API',
      version: '1.0.0'
    });

    expect(schema.openrpc).toBe('1.2.6');
    expect(schema.info.title).toBe('Test API');
    expect(schema.methods).toHaveLength(2);
    expect(schema.methods[0].name).toBe('health');
    expect(schema.methods[1].name).toBe('echo');
    expect(schema.methods[0].description).toBe('Check server health');
  });

  it('should handle input validators correctly', () => {
    // Test string validator
    expect(v.string()('hello')).toBe('hello');
    expect(() => v.string()(123)).toThrow('Expected string');

    // Test number validator  
    expect(v.number()(42)).toBe(42);
    expect(() => v.number()('42')).toThrow('Expected number');

    // Test optional validator
    expect(v.optional(v.string())('test')).toBe('test');
    expect(v.optional(v.string())(undefined)).toBeUndefined();
    expect(v.optional(v.string())(null)).toBeUndefined();

    // Test object validator
    const objectValidator = v.object({
      name: v.string(),
      count: v.number()
    });
    
    expect(objectValidator({ name: 'test', count: 5 })).toEqual({
      name: 'test',
      count: 5
    });
    
    expect(() => objectValidator({ name: 'test' })).toThrow();
    expect(() => objectValidator('not an object')).toThrow('Input must be an object');
  });
});
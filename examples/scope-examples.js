/**
 * MCP Scope System Examples
 *
 * This example demonstrates how to use the new customizable scope system
 * for controlling access to MCP tools with fine-grained permissions.
 */

import { createRpcAiServer } from '../dist/index.js';
import { ScopeHelpers, DefaultScopes, createMCPTool } from '../dist/auth/scopes.js';

// Example: Custom tRPC procedures with different scope requirements
const customMCPTools = `
import { publicProcedure, router } from "./index.js";
import z from "zod";
import { ScopeHelpers, DefaultScopes, createMCPTool } from "../auth/scopes.js";

export const customScopedRouter = router({
  // Public tool - no authentication required
  publicGreeting: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'publicGreeting',
        description: 'Generate a greeting - no auth required',
        category: 'utility',
        public: true  // No scopes needed
      })
    })
    .input(z.object({ name: z.string() }))
    .query(({ input }) => ({ message: \`Hello \${input.name}!\` })),

  // Basic MCP access required
  userInfo: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'userInfo',
        description: 'Get user information',
        category: 'user',
        scopes: ScopeHelpers.mcpCall()  // Requires mcp:call (or mcp:tools, or mcp)
      })
    })
    .input(z.object({ userId: z.string() }))
    .query(({ input, ctx }) => ({
      userId: input.userId,
      hasAuth: !!ctx.user,
      message: 'User info retrieved'
    })),

  // System administration required
  systemStats: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'systemStats',
        description: 'Get system statistics and health info',
        category: 'system',
        scopes: ScopeHelpers.system('admin')  // Requires system:admin
      })
    })
    .input(z.object({}))
    .query(() => ({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      restricted: 'This data requires system:admin scope'
    })),

  // AI service configuration - requires specific AI scope
  configureAI: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'configureAI',
        description: 'Configure AI service settings',
        category: 'ai',
        scopes: ScopeHelpers.ai('configure')  // Requires ai:configure
      })
    })
    .input(z.object({
      provider: z.enum(['anthropic', 'openai', 'google']),
      apiKey: z.string().optional()
    }))
    .mutation(({ input }) => ({
      message: \`AI provider configured: \${input.provider}\`,
      hasApiKey: !!input.apiKey,
      timestamp: new Date().toISOString()
    })),

  // Custom scope with multiple options
  advancedOperation: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'advancedOperation',
        description: 'Advanced operation requiring admin OR custom privileges',
        category: 'admin',
        scopes: ScopeHelpers.custom(
          ['admin', 'custom:advanced', 'system:admin'],
          'Advanced operation privileges',
          { anyOf: true, privileged: true }  // User needs ANY ONE of these scopes
        )
      })
    })
    .input(z.object({ operation: z.string() }))
    .mutation(({ input }) => ({
      operation: input.operation,
      message: 'Advanced operation completed',
      privilegeLevel: 'high',
      timestamp: new Date().toISOString()
    })),

  // Hierarchical scope example
  readOnlyData: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'readOnlyData',
        description: 'Read-only data access',
        category: 'data',
        scopes: ScopeHelpers.read('data')  // Requires data:read
      })
    })
    .input(z.object({ dataId: z.string() }))
    .query(({ input }) => ({
      dataId: input.dataId,
      data: 'Sample read-only data',
      access: 'read-only'
    })),

  // Profile management with write access
  updateProfile: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'updateProfile',
        description: 'Update user profile information',
        category: 'user',
        scopes: ScopeHelpers.profile('write')  // Requires profile:write
      })
    })
    .input(z.object({
      name: z.string().optional(),
      email: z.string().email().optional()
    }))
    .mutation(({ input, ctx }) => ({
      message: 'Profile updated',
      user: ctx.user?.email || 'anonymous',
      changes: input,
      timestamp: new Date().toISOString()
    }))
});
`;

console.log('📋 MCP Scope System Examples');
console.log('');
console.log('This demonstrates the new customizable scope system for MCP tools:');
console.log('');

console.log('🔧 Available Scope Helpers:');
console.log('');
console.log('// Public access (no auth)');
console.log('scopes: ScopeHelpers.public()');
console.log('');
console.log('// Basic MCP access');
console.log('scopes: ScopeHelpers.mcpCall()        // mcp:call, mcp:tools, or mcp');
console.log('scopes: ScopeHelpers.mcpList()        // mcp:list, mcp:tools, or mcp');
console.log('');
console.log('// Resource-specific access');
console.log('scopes: ScopeHelpers.read("data")     // data:read');
console.log('scopes: ScopeHelpers.write("data")    // data:write');
console.log('scopes: ScopeHelpers.execute("tools") // tools:execute');
console.log('');
console.log('// System and AI access');
console.log('scopes: ScopeHelpers.system("read")   // system:read');
console.log('scopes: ScopeHelpers.system("admin")  // system:admin (privileged)');
console.log('scopes: ScopeHelpers.ai("execute")    // ai:execute');
console.log('scopes: ScopeHelpers.ai("configure")  // ai:configure');
console.log('');
console.log('// User data access');
console.log('scopes: ScopeHelpers.profile("read")  // profile:read');
console.log('scopes: ScopeHelpers.profile("write") // profile:write');
console.log('scopes: ScopeHelpers.billing("read")  // billing:read');
console.log('');
console.log('// Advanced custom scopes');
console.log('scopes: ScopeHelpers.custom(');
console.log('  ["admin", "custom:feature"],');
console.log('  "Custom feature access",');
console.log('  { anyOf: true, privileged: true }   // Needs ANY ONE scope');
console.log(')');

console.log('');
console.log('🎯 Scope Hierarchy:');
console.log('');
console.log('• admin          → grants user, read, write');
console.log('• write          → grants read');
console.log('• mcp            → grants mcp:list, mcp:call, mcp:tools');
console.log('• mcp:tools      → grants mcp:list, mcp:call');
console.log('• system:admin   → grants system:read, system:health');
console.log('• ai:configure   → grants ai:read');

console.log('');
console.log('📝 How to Use:');
console.log('');
console.log('1. Import the scope helpers in your tRPC router:');
console.log('   import { ScopeHelpers, createMCPTool } from "../auth/scopes.js";');
console.log('');
console.log('2. Add scope requirements to your procedures:');
console.log('   .meta({');
console.log('     ...createMCPTool({');
console.log('       name: "myTool",');
console.log('       description: "My custom tool",');
console.log('       scopes: ScopeHelpers.mcpCall()  // or any other scope requirement');
console.log('     })');
console.log('   })');
console.log('');
console.log('3. Tools will automatically be filtered based on user OAuth scopes');
console.log('');

console.log('🧪 Testing Scopes:');
console.log('');
console.log('1. Start server with OAuth enabled');
console.log('2. Use MCP Jam to connect and authenticate');
console.log('3. Request specific scopes during OAuth flow');
console.log('4. Only tools matching your scopes will be available in tools/list');
console.log('5. tools/call will validate scopes before execution');

console.log('');
console.log('🔐 OAuth Scope Discovery:');
console.log('');
console.log('Available scopes are automatically exposed at:');
console.log('• /.well-known/oauth-authorization-server');  
console.log('• /.well-known/openid-configuration');
console.log('');
console.log('This allows OAuth clients to discover what scopes are available');
console.log('and request appropriate permissions during the OAuth flow.');

console.log('');
console.log('✅ Scope system is now fully implemented and integrated!');
console.log('   Package users can customize scopes via tRPC metadata');
console.log('   instead of hard-coded "mcp" scope.');
#!/usr/bin/env node

/**
 * Generate trpc-methods.json from tRPC router
 * 
 * This script extracts all tRPC procedures and their metadata
 * to generate a JSON file that can be used by the dev panel.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

console.log('🔨 Generating tRPC methods documentation...');

async function extractTRPCMethods() {
  try {
    // Import the router after TypeScript compilation
    const { createAppRouter } = await import('../dist/trpc/root.js');
    
    const router = createAppRouter();
    const methods = {};
    
    // Extract procedures from router
    // Use the flattened procedures object for nested routers
    if (router._def && router._def.procedures) {
      const procedures = router._def.procedures;
      
      for (const [procedureName, procedure] of Object.entries(procedures)) {
        methods[procedureName] = extractProcedureInfo(procedure, procedureName);
      }
    }
    
    function extractProcedureInfo(procedure, path) {
      const def = procedure._def;
      const info = {
        path,
        type: def.type || 'unknown',
        description: null,
        summary: null,
        tags: [],
        input: null,
        output: null,
        meta: def.meta || null
      };
      
      // Extract OpenAPI metadata if present
      if (def.meta?.openapi) {
        const openapi = def.meta.openapi;
        info.method = openapi.method;
        info.path = openapi.path;
        info.summary = openapi.summary;
        info.description = openapi.description;
        info.tags = openapi.tags || [];
      }
      
      // Extract input schema info
      if (def.inputs && def.inputs.length > 0) {
        const inputSchema = def.inputs[0];
        info.input = extractZodSchemaInfo(inputSchema);
      }
      
      // Extract output schema info
      if (def.output) {
        info.output = extractZodSchemaInfo(def.output);
      }
      
      return info;
    }
    
    function extractZodSchemaInfo(schema) {
      if (!schema || !schema._def) {
        return { type: 'unknown' };
      }
      
      const def = schema._def;
      const info = {
        type: def.typeName || 'unknown',
        description: def.description || null
      };
      
      // Extract shape for objects
      if (def.typeName === 'ZodObject' && def.shape) {
        try {
          const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
          info.properties = {};
          
          for (const [key, propSchema] of Object.entries(shape)) {
            info.properties[key] = extractZodSchemaInfo(propSchema);
          }
        } catch (e) {
          // Ignore shape extraction errors
        }
      }
      
      // Extract other useful info
      if (def.innerType) {
        info.innerType = extractZodSchemaInfo(def.innerType);
      }
      
      return info;
    }
    
    // Detect MCP methods and generate calling examples
    const mcpMethods = {};
    const mcpProcedures = Object.entries(methods).filter(([name, method]) => 
      method.meta?.mcp
    );
    
    for (const [name, method] of mcpProcedures) {
      const mcpMeta = method.meta.mcp;
      const procedureName = name;
      const httpMethod = method.type === 'mutation' ? 'POST' : 'GET';
      
      mcpMethods[name] = {
        title: mcpMeta.title || mcpMeta.name || mcpMeta.description || `Tool ${name}`,
        description: mcpMeta.description,
        category: mcpMeta.category || 'general',
        type: method.type,
        scopes: mcpMeta.scopes || null,
        calling: {
          mcp: {
            endpoint: 'http://localhost:8000/mcp',
            method: 'tools/call',
            example: {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: {
                name: name.split('.').pop(), // Remove router prefix for MCP
                arguments: generateExampleArgs(method.input)
              }
            }
          },
          trpc: {
            endpoint: `http://localhost:8000/trpc/${procedureName}`,
            method: httpMethod,
            example: httpMethod === 'GET' 
              ? `curl -X GET "http://localhost:8000/trpc/${procedureName}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A${encodeURIComponent(JSON.stringify(generateExampleArgs(method.input)))}%7D%7D"`
              : `curl -X POST "http://localhost:8000/trpc/${procedureName}?batch=1" -H "Content-Type: application/json" -d '[{"0":{"json":${JSON.stringify(generateExampleArgs(method.input))}}}]'`
          },
          jsonRpc: {
            endpoint: 'http://localhost:8000/rpc',
            method: procedureName,
            example: {
              jsonrpc: '2.0',
              id: 1,
              method: procedureName,
              params: generateExampleArgs(method.input)
            }
          }
        }
      };
    }
    
    function generateExampleArgs(inputSchema) {
      if (!inputSchema || !inputSchema.properties) {
        return {};
      }
      
      const args = {};
      
      function getBaseType(schema) {
        if (!schema) return null;
        
        // Recursively unwrap nested types (ZodDefault -> ZodOptional -> ZodString)
        if (schema.innerType) {
          return getBaseType(schema.innerType);
        }
        
        return schema.type;
      }
      
      for (const [key, prop] of Object.entries(inputSchema.properties)) {
        const baseType = getBaseType(prop);
        
        switch (baseType) {
          case 'ZodString':
            if (key === 'name') args[key] = 'World';
            else if (key === 'message') args[key] = 'Hello MCP';
            else if (key === 'language') args[key] = 'en';
            else args[key] = 'example';
            break;
          case 'ZodBoolean':
            args[key] = key === 'uppercase';
            break;
          case 'ZodNumber':
            args[key] = key === 'repeat' ? 2 : 42;
            break;
          default:
            // Fallback based on field names
            if (key === 'name') args[key] = 'World';
            else if (key === 'message') args[key] = 'Hello MCP';
            else if (key === 'language') args[key] = 'en';
            else if (key === 'uppercase') args[key] = true;
            else if (key === 'repeat') args[key] = 2;
            else args[key] = 'example';
        }
      }
      return args;
    }

    const documentation = {
      generated: new Date().toISOString(),
      version: '1.0.0',
      description: 'tRPC procedure documentation extracted from router',
      procedures: methods,
      mcp: {
        available: Object.keys(mcpMethods).length > 0,
        methods: mcpMethods,
        endpoint: 'http://localhost:8000/mcp',
        protocolVersion: '2024-11-05'
      },
      stats: {
        totalProcedures: Object.keys(methods).length,
        queries: Object.values(methods).filter(m => m.type === 'query').length,
        mutations: Object.values(methods).filter(m => m.type === 'mutation').length,
        subscriptions: Object.values(methods).filter(m => m.type === 'subscription').length,
        mcpMethods: Object.keys(mcpMethods).length
      }
    };
    
    return documentation;
    
  } catch (error) {
    console.error('❌ Failed to extract tRPC methods:', error.message);
    console.error('Stack:', error.stack);
    
    // Return minimal fallback structure
    return {
      generated: new Date().toISOString(),
      version: '1.0.0',
      description: 'Failed to extract tRPC methods - fallback structure',
      error: error.message,
      procedures: {},
      stats: {
        totalProcedures: 0,
        queries: 0,
        mutations: 0,
        subscriptions: 0
      }
    };
  }
}

function formatScopeInfo(scopes) {
  if (!scopes) return 'None required';
  
  let info = '';
  
  // Handle combined required (AND) + anyOf (OR) scopes
  if (scopes.required && Array.isArray(scopes.required) && 
      scopes.anyOf && Array.isArray(scopes.anyOf)) {
    // Both AND and OR conditions - show clearly that BOTH must be satisfied
    info = `${scopes.required.join(' AND ')} AND (${scopes.anyOf.join(' OR ')})`;
  }
  // Handle only required scopes (AND logic)
  else if (scopes.required && Array.isArray(scopes.required)) {
    info = `${scopes.required.join(' AND ')}`;
  }
  // Handle only anyOf scopes (OR logic)
  else if (scopes.anyOf && Array.isArray(scopes.anyOf)) {
    info = `${scopes.anyOf.join(' OR ')}`;
  }
  // Handle allOf scopes (AND logic - less common)
  else if (scopes.allOf && Array.isArray(scopes.allOf)) {
    info = `${scopes.allOf.join(' AND ')}`;
  }
  
  // Add description if available
  if (scopes.description) {
    info += ` (${scopes.description})`;
  }
  
  // Add admin requirement notation
  if (scopes.requireAdminUser) {
    info += ' [Admin Required]';
  }
  
  // Add privileged notation
  if (scopes.privileged) {
    info += ' [Privileged]';
  }
  
  // Handle public/no scopes case
  if (!info && scopes.description) {
    info = scopes.description;
  }
  
  return info || 'Custom scopes';
}

async function main() {
  const documentation = await extractTRPCMethods();
  
  // Ensure dist directory exists
  mkdirSync('dist', { recursive: true });
  
  // Write the methods file
  const outputPath = 'dist/trpc-methods.json';
  writeFileSync(outputPath, JSON.stringify(documentation, null, 2));
  
  console.log(`✅ Generated ${outputPath}`);
  console.log(`📊 Found ${documentation.stats.totalProcedures} procedures:`);
  console.log(`   - ${documentation.stats.queries} queries`);
  console.log(`   - ${documentation.stats.mutations} mutations`);
  console.log(`   - ${documentation.stats.subscriptions} subscriptions`);
  
  if (documentation.mcp.available) {
    console.log(`🔧 MCP Integration:`);
    console.log(`   - ${documentation.stats.mcpMethods} MCP tools available`);
    console.log(`   - Endpoint: ${documentation.mcp.endpoint}`);
    console.log(`   - Protocol: ${documentation.mcp.protocolVersion}`);
    
    if (documentation.stats.mcpMethods > 0) {
      console.log(`🛠️  Available MCP Tools:`);
      for (const [name, tool] of Object.entries(documentation.mcp.methods)) {
        const toolName = name.split('.').pop();
        console.log(`   📋 ${toolName}: ${tool.title}`);
        
        // Display scope requirements
        if (tool.scopes) {
          const scopesInfo = formatScopeInfo(tool.scopes);
          console.log(`      🔐 Scopes: ${scopesInfo}`);
        }
        
        console.log(`      🔹 MCP: POST ${tool.calling.mcp.endpoint}`);
        console.log(`      🔹 tRPC: ${tool.calling.trpc.method} ${tool.calling.trpc.endpoint}`);
        console.log(`      🔹 JSON-RPC: POST ${tool.calling.jsonRpc.endpoint} (method: ${tool.calling.jsonRpc.method})`);
      }
    }
  } else {
    console.log(`🔧 MCP Integration: No tools found (add .meta({ mcp: {...} }) to procedures)`);
  }
  
  if (documentation.error) {
    console.error(`⚠️  Generation completed with error: ${documentation.error}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
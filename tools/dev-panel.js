#!/usr/bin/env node
/**
 * Development Panel Server - Using trpc-methods.json
 * 
 * Creates a documentation panel that reads from the generated trpc-methods.json
 */

import express from 'express';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { expressHandler } from 'trpc-playground/handlers/express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { zodResolveTypes } from './trpc-playground-fix.js';

const app = express();
const port = process.env.DEV_PANEL_PORT || 8080;
const playgroundEndpoint = '/api/trpc-playground';
const mcpJamEndpoint = 'http://localhost:4000';
const trpcApiEndpoint = '/api/trpc'; // endpoint used by trpc playground

// Dynamic server configuration discovery
let serverConfig = null;

// Check if MCP Inspector is running and get auth token
async function checkMCPInspector() {
  try {
    const response = await fetch('http://localhost:6274/');
    if (response.ok) {
      // Inspector is running, but we need to extract the token from process or logs
      // For now, detect if it's running and show instructions
      return { running: true, token: null };
    }
  } catch (error) {
    return { running: false, token: null };
  }
  return { running: false, token: null };
}

async function discoverServerConfig() {
  // Try to discover running servers on common ports
  const commonPorts = [8000, 8001, 8002, 3000];
  const manualPort = process.env.AI_SERVER_PORT;
  
  // If manual port is specified, try it first
  if (manualPort) {
    commonPorts.unshift(parseInt(manualPort));
  }
  
  for (const testPort of commonPorts) {
    try {
      const response = await fetch(`http://localhost:${testPort}/config`);
      if (response.ok) {
        const config = await response.json();
        console.log(`🔍 Discovered AI server on port ${testPort}`);
        return config;
      }
    } catch (error) {
      // Server not running on this port, continue
    }
  }
  
  // Fallback to default configuration
  const fallbackPort = manualPort || 8000;
  console.log(`⚠️  No running server discovered, using fallback port ${fallbackPort}`);
  return {
    port: fallbackPort,
    baseUrl: `http://localhost:${fallbackPort}`,
    endpoints: {
      health: `http://localhost:${fallbackPort}/health`,
      jsonRpc: `http://localhost:${fallbackPort}/rpc`,
      tRpc: `http://localhost:${fallbackPort}/trpc`,
      mcp: `http://localhost:${fallbackPort}/mcp`,
    }
  };
}

// Initialize server configuration
(async () => {
  serverConfig = await discoverServerConfig();
})();

// Helper function to get current config or fallback
function getServerConfig() {
  return serverConfig || {
    port: process.env.AI_SERVER_PORT || 8000,
    baseUrl: `http://localhost:${process.env.AI_SERVER_PORT || 8000}`,
    endpoints: {
      jsonRpc: `http://localhost:${process.env.AI_SERVER_PORT || 8000}/rpc`,
      tRpc: `http://localhost:${process.env.AI_SERVER_PORT || 8000}/trpc`,
      mcp: `http://localhost:${process.env.AI_SERVER_PORT || 8000}/mcp`,
    }
  };
}

// Load tRPC methods from generated JSON
function loadTRPCMethods() {
  const methodsPath = path.join(process.cwd(), 'dist/trpc-methods.json');
  
  if (!existsSync(methodsPath)) {
    console.error(`❌ trpc-methods.json not found at ${methodsPath}`);
    console.log('💡 Run "npm run build:trpc-methods" to generate it');
    return null;
  }
  
  try {
    const data = JSON.parse(readFileSync(methodsPath, 'utf8'));
    console.log(`✅ Loaded ${data.stats.totalProcedures} tRPC procedures from ${methodsPath}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to parse trpc-methods.json:`, error.message);
    return null;
  }
}

const trpcMethods = loadTRPCMethods();

// Set up tRPC playground if methods are available
if (trpcMethods) {
  setupTRPCPlayground();
}

app.use(express.json());
app.use(express.static('public'));

// Generate playground URL with pre-filled data
function generatePlaygroundURL(procedureName, inputSchema) {
  const sampleInput = generateSampleInput(inputSchema);
  const inputObj = JSON.parse(sampleInput);
  
  // Create playground state with pre-filled data
  const playgroundState = {
    method: procedureName,
    input: inputObj
  };
  
  // Encode the state for URL
  // not working
  //const encodedState = encodeURIComponent(JSON.stringify(playgroundState));
  return `${playgroundEndpoint}`; //?state=${encodedState}`;
}

// Generate HTML for a procedure
// Extract descriptions and metadata from Zod schemas
function extractSchemaInfo(schema) {
  if (!schema) return { fields: [], hasFields: false };
  
  const fields = [];
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const field = {
        name: key,
        type: getZodTypeName(prop),
        required: schema.required && schema.required.includes(key),
        description: prop.description || null,
        constraints: extractConstraints(prop)
      };
      fields.push(field);
    }
  }
  
  return {
    fields,
    hasFields: fields.length > 0,
    description: schema.description || null,
    title: schema.title || null
  };
}

function getZodTypeName(prop) {
  if (prop.type) {
    const typeMap = {
      'ZodString': 'string',
      'ZodNumber': 'number', 
      'ZodBoolean': 'boolean',
      'ZodArray': 'array',
      'ZodObject': 'object',
      'ZodEnum': 'enum',
      'ZodOptional': 'optional',
      'ZodNullable': 'nullable',
      'ZodUnion': 'union'
    };
    return typeMap[prop.type] || prop.type.replace('Zod', '').toLowerCase();
  }
  return 'any';
}

function extractConstraints(prop) {
  const constraints = [];
  if (prop.minLength !== undefined) constraints.push(`min: ${prop.minLength}`);
  if (prop.maxLength !== undefined) constraints.push(`max: ${prop.maxLength}`);
  if (prop.min !== undefined) constraints.push(`min: ${prop.min}`);
  if (prop.max !== undefined) constraints.push(`max: ${prop.max}`);
  if (prop.format) constraints.push(`format: ${prop.format}`);
  if (prop.pattern) constraints.push(`pattern: ${prop.pattern}`);
  if (prop.enum) constraints.push(`enum: [${prop.enum.join(', ')}]`);
  return constraints;
}

function generateVSCodeLink(procedureName, sourceFile) {
  if (sourceFile) {
    // Extract just the method name (last part after the dot)
    const methodName = procedureName.split('.').pop();
    // Direct file link with search term to scroll to the right line
    const absolutePath = `${process.cwd()}/${sourceFile}`;
    return `vscode://file/${absolutePath}?search=${encodeURIComponent(methodName + ':')}`;
  }
  
  // Fallback: search across the entire workspace
  const searchTerm = `${procedureName.replace(/\./g, '')}:`;
  return `vscode://search/${encodeURIComponent(searchTerm)}`;
}

function renderSchemaField(field) {
  const requiredIcon = field.required ? '🔴' : '⚪';
  const constraintsText = field.constraints.length > 0 ? ` (${field.constraints.join(', ')})` : '';
  
  return `
    <div class="schema-field">
      <div class="field-header">
        <span class="field-required" title="${field.required ? 'Required' : 'Optional'}">${requiredIcon}</span>
        <code class="field-name">${field.name}</code>
        <span class="field-type">${field.type}</span>
        ${constraintsText ? `<span class="field-constraints">${constraintsText}</span>` : ''}
      </div>
      ${field.description ? `<div class="field-description">${field.description}</div>` : ''}
    </div>
  `;
}

function generateProcedureHTML(name, procedure) {
  const { type, method, path: procPath, summary, description, tags, input, output } = procedure;
  
  const methodBadge = method ? `<span class="method-badge method-${method.toLowerCase()}">${method}</span>` : 
                     `<span class="method-badge method-${type}">${type.toUpperCase()}</span>`;
  
  const pathDisplay = procPath || name;
  const inputInfo = extractSchemaInfo(input);
  const outputInfo = extractSchemaInfo(output);
  const vsCodeLink = generateVSCodeLink(name, procedure.sourceFile);
  
  const inputTitle = inputInfo.title || (inputInfo.description ? inputInfo.description : 'Input Parameters');
  const outputTitle = outputInfo.title || (outputInfo.description ? outputInfo.description : 'Response');
  
  return `
    <div class="procedure" data-type="${type}">
      <div class="procedure-header">
        ${methodBadge}
        <code class="procedure-name">${pathDisplay}</code>
        ${summary ? `<span class="summary">${summary}</span>` : ''}
      </div>
      
      ${description ? `<p class="description">${description}</p>` : ''}
      
      ${tags && tags.length > 0 ? `
        <div class="tags">
          ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
      
      <div class="procedure-body">
        <div class="io-section">
          <h4 class="io-title" title="Click to view source schema">
            📥 ${inputTitle}
            <button class="vs-code-btn" onclick="window.open('${vsCodeLink}', '_blank')" title="Open in VS Code">⚡</button>
            <button class="toggle-schema" onclick="toggleSchema('input-${name.replace(/\./g, '-')}')" title="Show/Hide Zod Schema">{ }</button>
          </h4>
          
          ${inputInfo.hasFields ? `
            <div class="schema-fields">
              ${inputInfo.fields.map(field => renderSchemaField(field)).join('')}
            </div>
          ` : `
            <div class="no-input">No input parameters required</div>
          `}
          
          <div class="raw-schema schema-hidden" id="input-${name.replace(/\./g, '-')}">
            <pre class="schema">${JSON.stringify(input, null, 2)}</pre>
          </div>
        </div>
        
        <div class="io-section">
          <h4 class="io-title" title="Click to view source schema">
            📤 ${outputTitle}
            <button class="vs-code-btn" onclick="window.open('${vsCodeLink}', '_blank')" title="Open in VS Code">⚡</button>
            <button class="toggle-schema" onclick="toggleSchema('output-${name.replace(/\./g, '-')}')" title="Show/Hide Zod Schema">{ }</button>
          </h4>
          
          ${outputInfo.hasFields ? `
            <div class="schema-fields">
              ${outputInfo.fields.map(field => renderSchemaField(field)).join('')}
            </div>
          ` : `
            <div class="no-output">Output schema not available</div>
          `}
          
          <div class="raw-schema schema-hidden" id="output-${name.replace(/\./g, '-')}">
            <pre class="schema">${JSON.stringify(output, null, 2)}</pre>
          </div>
        </div>
        
        <div class="curl-example">
          <h4>🌐 cURL Example 
            <button class="copy-btn" onclick="copyToClipboard('curl-${name.replace(/\./g, '-')}')">📋 Copy</button>
          </h4>
          <pre class="curl" id="curl-${name.replace(/\./g, '-')}"><code>${generateJsonRpcExample(name, type, input)}</code></pre>
        </div>
        
        <div class="playground-section">
          <h4>🎮 Interactive Testing</h4>
          <a href="${generatePlaygroundURL(name, input)}" target="_blank" class="playground-btn">
            🚀 Open in tRPC Playground
          </a>
        </div>
      </div>
    </div>
  `;
}

function generateSampleInput(inputSchema) {
  // Check for void/empty schemas (z.void(), no input, etc.)
  if (!inputSchema || 
      inputSchema.type === 'ZodVoid' || 
      inputSchema.type === 'ZodUndefined' ||
      (!inputSchema.properties && !inputSchema.type)) {
    return null; // No parameters needed
  }
  
  if (!inputSchema.properties) {
    return '{}';
  }
  
  const sample = {};
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    if (prop.type === 'ZodString') {
      sample[key] = 'example';
    } else if (prop.type === 'ZodNumber') {
      sample[key] = 123;
    } else if (prop.type === 'ZodBoolean') {
      sample[key] = true;
    } else {
      sample[key] = 'value';
    }
  }
  
  return JSON.stringify(sample, null, 2);
}

// Setup tRPC Playground with proxy to actual server
async function setupTRPCPlayground() {
  try {
    // Load the actual router for playground schema discovery only
    const routerPath = path.join(process.cwd(), 'dist/trpc/root.js');
    
    if (!existsSync(routerPath)) {
      console.log('⚠️  Router not found at', routerPath, '- skipping playground setup');
      return;
    }
    
    // Dynamic import the router
    const { createAppRouter } = await import(routerPath);
    
    // Create a minimal router instance for schema discovery only
    const schemaRouter = createAppRouter();
    
    console.log('🔍 Router loaded for schema discovery...');
    
    // Proxy tRPC requests to the actual server instead of handling them locally
    app.use(trpcApiEndpoint, async (req, res, next) => {
      // Ensure we have current server configuration
      if (!serverConfig) {
        serverConfig = await discoverServerConfig();
      }
      const config = getServerConfig();
      
      // Check if tRPC is available on the server
      if (!config.endpoints.tRpc) {
        console.log(`❌ tRPC not available on server (${config.baseUrl})`);
        return res.status(503).json({
          error: 'tRPC not available',
          message: 'The connected server only supports JSON-RPC. Please connect to a server with tRPC enabled.',
          serverConfig: {
            baseUrl: config.baseUrl,
            protocols: { jsonRpc: true, tRpc: false }
          }
        });
      }
      
      try {
        const { default: fetch } = await import('node-fetch');
        
        // Forward the request to the actual tRPC server
        const targetUrl = `${config.endpoints.tRpc}${req.url}`;
        console.log(`🔗 Proxying tRPC request to: ${targetUrl}`);
        
        // Prepare request body
        let body = undefined;
        if (req.method !== 'GET' && req.body) {
          body = JSON.stringify(req.body);
        }
        
        const response = await fetch(targetUrl, {
          method: req.method,
          headers: {
            'Content-Type': req.headers['content-type'] || 'application/json',
            'Accept': req.headers.accept || 'application/json',
          },
          body,
        });
        
        // Forward the response
        res.status(response.status);
        
        // Copy relevant headers
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.setHeader('content-type', contentType);
        }
        
        const responseText = await response.text();
        res.send(responseText);
        
      } catch (error) {
        console.error(`❌ tRPC Proxy Error:`, error.message);
        res.status(500).json({ 
          error: 'tRPC proxy failed', 
          message: `Could not connect to server at ${config.baseUrl}. Make sure the AI server is running.`,
          details: error.message 
        });
      }
    });
    
    // Set up playground endpoint with schema router for discovery
    app.use(
      playgroundEndpoint,
      await expressHandler({
        trpcApiEndpoint,
        playgroundEndpoint,
        // zodResolveTypes fix - only need because trpc-playground is not supporting trpc v11 yet.
        // Can be removed once PR #61 is merged https://github.com/sachinraja/trpc-playground/pull/61
        resolveTypes: zodResolveTypes, 
        router: schemaRouter, // Used for schema discovery only
        request: {
          superjson: true, // Adjust based on your setup
          globalHeaders: {},
        },
        polling: {
          enable: true,
          interval: 4000,
        },
      })
    );
    
    console.log(`🎮 tRPC Playground available at http://localhost:${port}${playgroundEndpoint}`);
    console.log(`🔄 tRPC requests proxied to ${getServerConfig().endpoints.tRpc}`);
  } catch (error) {
    console.log('⚠️  Failed to setup tRPC Playground:', error.message);
    console.log('💡 Error details:', error.stack);
    console.log('💡 Make sure to build the project first: pnpm build');
  }
}


function generateJsonRpcExample(procedureName, procedureType, inputSchema) {
  const sampleInput = generateSampleInput(inputSchema);
  
  // Convert tRPC procedure name to JSON-RPC method name
  // ai.health -> health, ai.executeAIRequest -> executeAIRequest
  const methodName = procedureName.includes('.') ? procedureName.split('.')[1] : procedureName;
  
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    method: methodName,
    id: 1
  };
  
  // Only add params if there are actual parameters (not void)
  if (sampleInput !== null) {
    jsonRpcRequest.params = JSON.parse(sampleInput);
  }
  
  return `curl -X POST ${getServerConfig().endpoints.jsonRpc} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(jsonRpcRequest)}'`;
}

// Main route
app.get('/', async (req, res) => {
  // Ensure we have current server configuration
  if (!serverConfig) {
    serverConfig = await discoverServerConfig();
  } else {
    // Verify current config is still valid by checking health
    try {
      const { default: fetch } = await import('node-fetch');
      const healthUrl = `${serverConfig.baseUrl}/health`;
      const response = await fetch(healthUrl, { timeout: 1000 });
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`🔄 Current server config invalid, rediscovering...`);
      serverConfig = await discoverServerConfig();
    }
  }

  // Check MCP Inspector status
  const mcpInspectorStatus = await checkMCPInspector();

  const config = getServerConfig();
  if (!trpcMethods) {
    res.send(`
      <html>
        <head><title>tRPC Development Panel</title></head>
        <body style="font-family: system-ui; padding: 2rem;">
          <h1>❌ tRPC Methods Not Found</h1>
          <p>Please run <code>npm run build:trpc-methods</code> to generate the methods documentation.</p>
        </body>
      </html>
    `);
    return;
  }

  const { procedures, stats, generated } = trpcMethods;
  
  // Group procedures by namespace
  const groupedProcedures = {};
  Object.entries(procedures).forEach(([name, proc]) => {
    const namespace = name.includes('.') ? name.split('.')[0] : 'core';
    if (!groupedProcedures[namespace]) {
      groupedProcedures[namespace] = [];
    }
    groupedProcedures[namespace].push([name, proc]);
  });
  
  // Generate accordion HTML
  const accordionHTML = Object.entries(groupedProcedures)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, procs]) => {
      const procedureCount = procs.length;
      const queriesCount = procs.filter(([, proc]) => proc.type === 'query').length;
      const mutationsCount = procs.filter(([, proc]) => proc.type === 'mutation').length;
      
      const proceduresHTML = procs
        .map(([name, proc]) => generateProcedureHTML(name, proc))
        .join('\n');
      
      return `
        <div class="accordion-group">
          <button class="accordion-header" onclick="toggleAccordion('${namespace}')">
            <div class="accordion-title">
              <span class="namespace-badge">${namespace}</span>
              <span class="procedure-count">${procedureCount} procedures</span>
            </div>
            <div class="accordion-stats">
              <span class="stat-badge stat-query">${queriesCount} queries</span>
              <span class="stat-badge stat-mutation">${mutationsCount} mutations</span>
              <span class="accordion-arrow" id="arrow-${namespace}">▼</span>
            </div>
          </button>
          <div class="accordion-content" id="content-${namespace}" style="display: none;">
            ${proceduresHTML}
          </div>
        </div>
      `;
    })
    .join('\n');

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>tRPC Development Panel</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 2rem;
      background: #f8fafc;
      color: #1a202c;
    }
    
    .header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .stats {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .stat {
      background: #edf2f7;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    
    .procedure {
      background: white;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      border: 2px solid #e2e8f0;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    .procedure:hover {
      border-color: #cbd5e0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .procedure-header {
      padding: 1rem;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .method-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .method-post { background: #fed7d7; color: #c53030; }
    .method-get { background: #c6f6d5; color: #22543d; }
    .method-mutation { background: #fed7d7; color: #c53030; }
    .method-query { background: #c6f6d5; color: #22543d; }
    
    .procedure-name {
      font-family: 'Courier New', monospace;
      background: #edf2f7;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    
    .summary {
      color: #4a5568;
      font-style: italic;
    }
    
    .description {
      margin: 0.5rem 1rem;
      padding: 0;
      color: #4a5568;
      line-height: 1.5;
    }
    
    .tags {
      margin: 0.5rem 1rem;
      display: flex;
      gap: 0.5rem;
    }
    
    .tag {
      background: #bee3f8;
      color: #2b6cb0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    
    .procedure-body {
      padding: 1rem;
    }
    
    .io-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      color: #2d3748;
      font-size: 1rem;
      cursor: help;
    }
    
    .vs-code-btn, .toggle-schema {
      background: #4a5568;
      color: white;
      border: none;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .vs-code-btn:hover {
      background: #2b6cb0;
    }
    
    .toggle-schema:hover {
      background: #38a169;
    }
    
    .schema-fields {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .schema-field {
      border-bottom: 1px solid #edf2f7;
    }
    
    .schema-field:last-child {
      border-bottom: none;
    }
    
    .field-header {
      padding: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #f8fafc;
    }
    
    .field-required {
      font-size: 0.75rem;
      cursor: help;
    }
    
    .field-name {
      background: #e2e8f0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #2d3748;
    }
    
    .field-type {
      background: #bee3f8;
      color: #2b6cb0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }
    
    .field-constraints {
      color: #4a5568;
      font-size: 0.75rem;
      font-style: italic;
    }
    
    .field-description {
      padding: 0.5rem 0.75rem;
      color: #4a5568;
      font-size: 0.875rem;
      background: white;
      border-top: 1px solid #edf2f7;
    }
    
    .no-input, .no-output {
      padding: 1rem;
      text-align: center;
      color: #718096;
      font-style: italic;
      background: #f8fafc;
      border: 1px dashed #cbd5e0;
      border-radius: 4px;
    }
    
    .raw-schema {
      margin-top: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      transition: opacity 0.2s ease-in-out;
    }
    
    .schema-hidden {
      display: none !important;
    }
    
    .schema-visible {
      display: block !important;
    }
    
    .schema-visible-btn {
      background: #e53e3e !important;
    }
    
    .schema-hidden-btn {
      background: #4a5568 !important;
    }
    
    .io-section {
      margin-bottom: 1rem;
    }
    
    .io-section h4 {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
    }
    
    .schema, .curl {
      background: #1a202c;
      color: #f7fafc;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      margin: 0;
    }
    
    .curl-example {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }
    
    .copy-btn {
      background: #4299e1;
      color: white;
      border: none;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      margin-left: 0.5rem;
      transition: background-color 0.2s;
    }
    
    .copy-btn:hover {
      background: #3182ce;
    }
    
    .copy-btn:active {
      background: #2c5aa0;
    }
    
    .accordion-group {
      margin-bottom: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .accordion-header {
      width: 100%;
      background: #f7fafc;
      border: none;
      padding: 1rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s;
      font-family: inherit;
      text-align: left;
    }
    
    .accordion-header:hover {
      background: #edf2f7;
    }
    
    .accordion-title {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .namespace-badge {
      background: #4299e1;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.875rem;
    }
    
    .procedure-count {
      color: #4a5568;
      font-weight: 500;
    }
    
    .accordion-stats {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .stat-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .stat-query {
      background: #c6f6d5;
      color: #22543d;
    }
    
    .stat-mutation {
      background: #fed7d7;
      color: #c53030;
    }
    
    .accordion-arrow {
      transition: transform 0.2s;
      font-size: 0.875rem;
      color: #4a5568;
      margin-left: 0.5rem;
    }
    
    .accordion-arrow.rotated {
      transform: rotate(180deg);
    }
    
    .accordion-content {
      padding: 1rem;
      border-top: 1px solid #e2e8f0;
    }
    
    .playground-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }
    
    .playground-btn {
      display: inline-block;
      background: #10b981;
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.875rem;
      transition: background-color 0.2s;
    }
    
    .playground-btn:hover {
      background: #059669;
      text-decoration: none;
      color: white;
    }
    
    .playground-link {
      color: #10b981;
      font-weight: bold;
      text-decoration: none;
    }
    
    .playground-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 tRPC Development Panel</h1>
    <div style="background: #f3f4f6; padding: 10px; border-radius: 8px; margin: 10px 0;">
      <strong>📡 Connected Server:</strong> ${config.baseUrl} 
      <span style="margin-left: 10px;">
        ${config.protocols ? Object.entries(config.protocols).map(([protocol, enabled]) => 
          `<span style="color: ${enabled ? '#059669' : '#6b7280'}; margin-right: 15px;">${protocol.toUpperCase()}: ${enabled ? '✅' : '❌'}</span>`
        ).join('') : 'Loading...'}
      </span>
    </div>
    <p><strong>🎮 MCP jam:</strong> <a href="${mcpJamEndpoint}" target="_blank">Open MCP JAM Playground</a></p>
    <p><strong>🔍 Official MCP Inspector:</strong>
      ${mcpInspectorStatus.running
        ? `<span style="color: #059669;">✅ Running</span> - <a href="http://localhost:6274" target="_blank">Open Inspector</a> <em>(Add ?MCP_PROXY_AUTH_TOKEN=your-token from console)</em>`
        : `<span style="color: #dc2626;">❌ Not Running</span> - Run: <code>npx @modelcontextprotocol/inspector --transport http --server-url http://localhost:${config.port}/mcp</code>`
      }
    </p>
    ${mcpInspectorStatus.running
      ? `<div style="background: #f3f4f6; padding: 10px; border-radius: 5px; margin: 10px 0;"><small><strong>💡 Auth Token Required:</strong> Copy the full URL with <code>MCP_PROXY_AUTH_TOKEN</code> parameter from your console when you started the Inspector.</small></div>`
      : `<div style="background: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0;"><small><strong>💡 MCP Inspector Setup:</strong> When you run the command above, it will print the full URL with auth token in your console. Use that URL to access the Inspector.</small></div>`
    }
    <p>Generated from <code>dist/trpc-methods.json</code> on ${new Date(generated).toLocaleString()}</p>
    <p><strong>💡 Start AI Server:</strong> <code>pnpm start:ai</code> or <code>pnpm dev:server</code> ${config.endpoints.tRpc ? `(with tRPC at <code>${config.endpoints.tRpc}</code>)` : '(JSON-RPC only)'}</p>
    ${config.endpoints.tRpc ? `<p><strong>🎮 Interactive Playground:</strong> <a href="${playgroundEndpoint}" target="_blank" class="playground-link">Open tRPC Playground</a></p>` : `<p><strong>⚠️ tRPC Playground:</strong> <em>Not available - server has JSON-RPC only</em></p>`}

    <h2>Open-RPC tools</h2>
    <p>Enable JSON-RPC protocol and ensure CORS is allowing 'https://playground.open-rpc.org/' and 'https://inspector.open-rpc.org' in server config.    
    <p><strong>🎮 Open-RPC Playground:</strong> <a href="https://playground.open-rpc.org/?url=${config.baseUrl}/openrpc.json&rpcUrl=${config.endpoints.jsonRpc}" target="_blank" class="playground-link">Open RPC Playground</a></p>
    <p><strong>🎮 Open-RPC Inspector:</strong> <a href="https://inspector.open-rpc.org/?url=${config.endpoints.jsonRpc}" target="_blank" class="playground-link">Open RPC Inspector</a></p>
    
    <h2>tRPC statistics</h2>
    <div class="stats">
      <div class="stat">Total: ${stats.totalProcedures}</div>
      <div class="stat">Queries: ${stats.queries}</div>
      <div class="stat">Mutations: ${stats.mutations}</div>
      <div class="stat">Subscriptions: ${stats.subscriptions}</div>
    </div>
  </div>
  
  <div class="procedures">
    ${accordionHTML}
  </div>
  
  <script>
    function copyToClipboard(elementId) {
      const element = document.getElementById(elementId);
      const text = element.textContent || element.innerText;
      
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API
        navigator.clipboard.writeText(text).then(() => {
          showCopyFeedback(elementId);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          fallbackCopyTextToClipboard(text);
        });
      } else {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(text);
      }
    }
    
    function fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        showCopyFeedback();
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
      }
      
      document.body.removeChild(textArea);
    }
    
    function showCopyFeedback(elementId) {
      // Find the copy button for this element
      const button = document.querySelector(\`button[onclick="copyToClipboard('\${elementId}')"]\`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#48bb78';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '#4299e1';
        }, 2000);
      }
    }
    
    function toggleSchema(elementId) {
      const element = document.getElementById(elementId);
      const button = event.target;
      
      // Use CSS classes for better performance instead of direct style manipulation
      if (element.classList.contains('schema-hidden')) {
        element.classList.remove('schema-hidden');
        element.classList.add('schema-visible');
        button.textContent = '{ hide }';
        button.className = 'toggle-schema schema-visible-btn';
      } else {
        element.classList.remove('schema-visible');
        element.classList.add('schema-hidden');
        button.textContent = '{ }';
        button.className = 'toggle-schema schema-hidden-btn';
      }
    }

    function toggleAccordion(namespace) {
      const content = document.getElementById(\`content-\${namespace}\`);
      const arrow = document.getElementById(\`arrow-\${namespace}\`);
      
      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        arrow.classList.add('rotated');
      } else {
        content.style.display = 'none';
        arrow.classList.remove('rotated');
      }
    }
  </script>
</body>
</html>
  `);
});

// JSON endpoint for raw data
app.get('/api/methods', (req, res) => {
  if (trpcMethods) {
    res.json(trpcMethods);
  } else {
    res.status(404).json({ error: 'trpc-methods.json not found' });
  }
});

app.listen(port, () => {
  console.log(`🎨 tRPC Development Panel running at http://localhost:${port}`);
  
  if (trpcMethods) {
    console.log(`📊 Serving ${trpcMethods.stats.totalProcedures} procedures`);
    console.log(`📄 JSON API: http://localhost:${port}/api/methods`);
  } else {
    console.log(`⚠️  Run 'npm run build:trpc-methods' to generate documentation`);
  }
});
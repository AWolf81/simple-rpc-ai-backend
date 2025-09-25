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
const openBrowser = process.env.DEV_PANEL_OPEN_BROWSER !== 'false';
const playgroundEndpoint = '/api/trpc-playground';
const mcpJamEndpoint = 'http://localhost:4000';
const trpcApiEndpoint = '/api/trpc'; // endpoint used by trpc playground

// Dynamic server configuration discovery
let serverConfig = null;
let mcpInspectorStatus = { running: false, token: null };

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
        return config;
      }
    } catch (error) {
      // Server not running on this port, continue
    }
  }
  
  // Fallback to default configuration
  const fallbackPort = manualPort || 8000;
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
  mcpInspectorStatus = await checkMCPInspector();
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

// Smart JSON file lookup with environment variable fallback
function findTrpcMethodsJson() {
  // 1. Check environment variable first (repo development case)
  if (process.env.TRPC_METHODS_JSON_PATH) {
    const envPath = path.resolve(process.env.TRPC_METHODS_JSON_PATH);
    if (existsSync(envPath)) {
      console.log(`📋 Using tRPC methods from env variable: ${envPath}`);
      return envPath;
    } else {
      console.warn(`⚠️ TRPC_METHODS_JSON_PATH points to non-existent file: ${envPath}`);
    }
  }

  // 2. Look in current directory (consumer project case)
  const currentDir = path.join(process.cwd(), 'dist/trpc-methods.json');
  if (existsSync(currentDir)) {
    console.log(`📋 Found tRPC methods in current project: ${currentDir}`);
    return currentDir;
  }

  // 3. Check common fallback locations
  const commonPaths = [
    path.join(process.cwd(), 'trpc-methods.json'),
    path.join(__dirname, '../trpc-methods.json'),
    path.join(__dirname, '../../dist/trpc-methods.json')
  ];

  for (const fallbackPath of commonPaths) {
    if (existsSync(fallbackPath)) {
      console.log(`📋 Found tRPC methods at fallback location: ${fallbackPath}`);
      return fallbackPath;
    }
  }

  console.log(`🔍 No tRPC methods file found in any location`);
  return null;
}

// Load tRPC methods from discovered JSON file, auto-build if needed
async function loadTRPCMethods() {
  let methodsPath = findTrpcMethodsJson();

  if (!methodsPath) {
    console.log(`📦 trpc-methods.json not found in any location`);
    console.log(`🔍 Checking if this is a consumer project...`);

    // Check if consumer has build:trpc-methods script in package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let hasBuildScript = false;

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        hasBuildScript = packageJson.scripts && packageJson.scripts['build:trpc-methods'];
      } catch (error) {
        console.warn(`⚠️ Could not read package.json: ${error.message}`);
      }
    }

    if (hasBuildScript) {
      console.log(`📦 Found build:trpc-methods script, building...`);

      try {
        const { spawn } = await import('child_process');

        const buildProcess = spawn('npm', ['run', 'build:trpc-methods'], {
          cwd: process.cwd(),
          stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
          buildProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Build failed with code ${code}`));
            }
          });
          buildProcess.on('error', reject);
        });

        console.log(`✅ Built tRPC methods successfully`);

        // Try to find the file again after build
        methodsPath = findTrpcMethodsJson();
        if (!methodsPath) {
          console.error(`❌ trpc-methods.json still not found after build attempt`);
          return null;
        }
      } catch (error) {
        console.error(`❌ Failed to build trpc-methods.json:`, error.message);
        return null;
      }
    } else {
      console.log(`💡 Consumer project detected without build:trpc-methods script`);
      console.log(`📝 To use dev-panel with your tRPC methods, add to your package.json:`);
      console.log(`   "scripts": {`);
      console.log(`     "build:trpc-methods": "node node_modules/simple-rpc-ai-backend/tools/generate-trpc-methods.js"`);
      console.log(`   }`);
      console.log(`🚀 Then run: npm run build:trpc-methods && npx simple-rpc-dev-panel`);

      // Still try to provide basic dev panel functionality
      console.log(`🔄 Continuing with basic dev panel (no tRPC method discovery)...`);
      return {
        procedures: {},
        stats: { totalProcedures: 0, queries: 0, mutations: 0, subscriptions: 0 },
        generated: new Date().toISOString(),
        isPlaceholder: true
      };
    }
  }

  // Load the discovered or built file
  try {
    const data = JSON.parse(readFileSync(methodsPath, 'utf8'));
    console.log(`✅ Loaded ${data.stats.totalProcedures} tRPC procedures from ${methodsPath}`);

    // Show configuration information if available
    if (data.config) {
      console.log(`📋 Configuration: AI=${data.config.ai?.enabled}, MCP=${data.config.mcp?.enabled}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Failed to parse trpc-methods.json:`, error.message);
    return null;
  }
}

// Initialize everything async
let trpcMethods = null;

(async () => {
  trpcMethods = await loadTRPCMethods();

  // Set up tRPC playground if methods are available
  if (trpcMethods) {
    setupTRPCPlayground();
  }
})();

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

// Generate tRPC call code from procedure info
function generateTRPCCall(procedureName, procedureType, inputSchema) {
  const sampleInput = generateSampleInput(inputSchema);
  const hasInput = sampleInput !== null;

  const inputCode = hasInput ? `(${sampleInput})` : '()';
  const methodCall = procedureType === 'query' ? 'query' : 'mutation';

  return `await trpc.${procedureName}.${methodCall}${inputCode}`;
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

function generateVSCodeLink(procedureName, sourceFile, lineNumber) {
  if (sourceFile) {
    const absolutePath = `${process.cwd()}/${sourceFile}`;
    
    // If we have a line number, use it for direct navigation
    if (lineNumber) {
      return `vscode://file/${absolutePath}:${lineNumber}`;
    }
    
    // Otherwise, try to extract just the method name (last part after the dot) for search
    const methodName = procedureName.split('.').pop();
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
  const { type, method, path: procPath, summary, description, tags, input, output, requiresAuth } = procedure;

  // Add lock icon for procedures that require authentication
  const authIcon = requiresAuth ? ' 🔒' : '';
  const authTitle = requiresAuth ? 'Authentication required' : '';

  const methodBadge = method ? `<span class="method-badge method-${method.toLowerCase()}" title="${authTitle}">${method}${authIcon}</span>` :
                     `<span class="method-badge method-${type}" title="${authTitle}">${type.toUpperCase()}${authIcon}</span>`;

  const pathDisplay = procPath || name;
  const inputInfo = extractSchemaInfo(input);
  const outputInfo = extractSchemaInfo(output);
  const inputVSCodeLink = generateVSCodeLink(name, procedure.sourceFile, procedure.inputLineNumber || procedure.lineNumber);
  const outputVSCodeLink = generateVSCodeLink(name, procedure.sourceFile, procedure.outputLineNumber || procedure.lineNumber);
  
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
            <button class="vs-code-btn" onclick="window.open('${inputVSCodeLink}', '_blank')" title="Open in VS Code">⚡</button>
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
            <button class="vs-code-btn" onclick="window.open('${outputVSCodeLink}', '_blank')" title="Open in VS Code">⚡</button>
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
          <button
            class="playground-copy-btn"
            onclick="copyAndOpenPlayground('trpc-${name.replace(/\./g, '-')}', '${generatePlaygroundURL(name, input)}')"
            title="Copy tRPC call to clipboard and open playground. Paste the copied call to test this method."
          >
            📋🚀 Copy & Open Playground
          </button>
          <div class="trpc-call-example">
            <pre class="trpc-call" id="trpc-${name.replace(/\./g, '-')}"><code>${generateTRPCCall(name, type, input)}</code></pre>
          </div>
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
    } else if (prop.type === 'ZodEnum' && prop.enum && prop.enum.length > 0) {
      // Use the first enum value for realistic examples
      sample[key] = prop.enum[0];
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

  // Use full procedure name as JSON-RPC method name (preserve namespace)
  // ai.generateText -> ai.generateText, mcp.greeting -> mcp.greeting
  const methodName = procedureName;

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
          <h1>🔄 Loading tRPC Methods...</h1>
          <p>Dev panel is starting up. If this persists:</p>
          <ol>
            <li>Ensure you have a <code>build:trpc-methods</code> script in package.json</li>
            <li>Run <code>npm run build:trpc-methods</code> manually</li>
            <li>Refresh this page</li>
          </ol>
          <script>setTimeout(() => window.location.reload(), 3000);</script>
        </body>
      </html>
    `);
    return;
  }

  // Handle placeholder case (consumer without tRPC methods)
  if (trpcMethods.isPlaceholder) {
    res.send(`
      <html>
        <head><title>tRPC Development Panel - Setup Required</title></head>
        <body style="font-family: system-ui; padding: 2rem; background: #f8fafc;">
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1>🎨 Dev Panel Ready - tRPC Setup Required</h1>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>📡 Connected Server:</strong> ${config.baseUrl}
            </div>

            <h2>🚀 Quick Setup for tRPC Method Discovery</h2>
            <p>To see your tRPC methods in the dev panel, add this script to your <code>package.json</code>:</p>

            <pre style="background: #1a202c; color: #f7fafc; padding: 1rem; border-radius: 4px; overflow-x: auto;"><code>"scripts": {
  "build:trpc-methods": "node node_modules/simple-rpc-ai-backend/tools/generate-trpc-methods.js"
}</code></pre>

            <p>Then run:</p>
            <pre style="background: #1a202c; color: #f7fafc; padding: 1rem; border-radius: 4px; overflow-x: auto;"><code>npm run build:trpc-methods
npx simple-rpc-dev-panel</code></pre>

            <h2>🔗 Available Tools (No tRPC Setup Required)</h2>
            <ul>
              <li><strong>🎮 MCP JAM:</strong> <a href="${mcpJamEndpoint}" target="_blank">Open MCP JAM Playground</a></li>
              <li><strong>🎮 Open-RPC Playground:</strong> <a href="https://playground.open-rpc.org/?url=${config.baseUrl}/openrpc.json&rpcUrl=${config.endpoints.jsonRpc}" target="_blank">Open RPC Playground</a></li>
              <li><strong>🎮 Open-RPC Inspector:</strong> <a href="https://inspector.open-rpc.org/?url=${config.endpoints.jsonRpc}" target="_blank">Open RPC Inspector</a></li>
            </ul>

            <div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4fd1c7;">
              <strong>💡 Pro Tip:</strong> You can use the JSON-RPC tools above even without tRPC method discovery!
            </div>
          </div>
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

    .playground-copy-btn {
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin-bottom: 1rem;
      display: inline-block;
    }

    .playground-copy-btn:hover {
      background: linear-gradient(135deg, #059669 0%, #2563eb 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .playground-copy-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .trpc-call-example {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
    }

    .trpc-call {
      background: #1a202c;
      color: #f7fafc;
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      margin: 0;
      white-space: pre-wrap;
    }

    .playground-link {
      color: #10b981;
      font-weight: bold;
      text-decoration: none;
    }

    .playground-link:hover {
      text-decoration: underline;
    }

    /* Two-column layout styles */
    .main-content {
      display: flex;
      gap: 2rem;
      margin-top: 1rem;
    }

    .left-panel {
      flex: 1;
      min-width: 300px;
    }

    .right-panel {
      flex: 1;
      min-width: 300px;
    }

    .status-card, .tools-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
    }

    .status-card h3, .tools-card h3 {
      margin: 0 0 1rem 0;
      color: #2d3748;
      font-size: 1.1rem;
    }

    .tool-links {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .tool-link {
      display: block;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      text-decoration: none;
      color: #2d3748;
      transition: all 0.2s;
    }

    .tool-link:hover {
      background: #edf2f7;
      border-color: #cbd5e0;
      text-decoration: none;
      color: #2d3748;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .tool-link.disabled {
      background: #f7fafc;
      color: #718096;
      cursor: not-allowed;
      border-color: #e2e8f0;
    }

    .tool-link strong {
      color: #2b6cb0;
    }

    .tool-link.disabled strong {
      color: #718096;
    }

    .tool-link small {
      color: #4a5568;
      font-size: 0.875rem;
    }

    /* Responsive design */
    @media (max-width: 1024px) {
      .main-content {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 tRPC Development Panel</h1>
    <!-- Connected Server at the top -->
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <strong>📡 Connected Server:</strong> ${config.baseUrl}
      <span style="margin-left: 10px;">
        ${config.protocols ? Object.entries(config.protocols).map(([protocol, enabled]) =>
          `<span style="color: ${enabled ? '#059669' : '#6b7280'}; margin-right: 15px;">${protocol.toUpperCase()}: ${enabled ? '✅' : '❌'}</span>`
        ).join('') : 'Loading...'}
      </span>
    </div>
  </div>

  <!-- Two column layout: Status on left, Tools on right -->
  <div class="main-content">
    <div class="left-panel">
      <h2>📊 Status & Information</h2>

      <div class="status-card">
        <h3>🔍 Official MCP Inspector</h3>
        <p><strong>Status:</strong>
          ${mcpInspectorStatus.running
            ? `<span style="color: #059669;">✅ Running</span> - <a href="http://localhost:6274" target="_blank">Open Inspector</a>`
            : `<span style="color: #dc2626;">❌ Not Running</span> - <em>requires manual setup</em>`
          }
        </p>
        ${!mcpInspectorStatus.running ? `
          <div style="background: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <small><strong>Manual Setup Required:</strong><br>
            <code>npx @modelcontextprotocol/inspector --transport http --server-url http://localhost:${config.port}/mcp</code><br>
            <em>This will generate a proxyAuthToken URL that you must use.</em></small>
          </div>
        ` : `
          <div style="background: #e6fffa; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4fd1c7;">
            <small><strong>💡 Note:</strong> Use the full URL with <code>MCP_PROXY_AUTH_TOKEN</code> parameter from your console for authenticated access.</small>
          </div>
        `}
      </div>

      <div class="status-card">
        <h3>📈 tRPC Statistics</h3>
        <div class="stats">
          <div class="stat">Total: ${stats.totalProcedures}</div>
          <div class="stat">Queries: ${stats.queries}</div>
          <div class="stat">Mutations: ${stats.mutations}</div>
          <div class="stat">Subscriptions: ${stats.subscriptions}</div>
        </div>
      </div>

      <div class="status-card">
        <h3>ℹ️ Build Info</h3>
        <p><small>Generated from <code>dist/trpc-methods.json</code><br>
        ${new Date(generated).toLocaleString()}</small></p>
        <p><small><strong>Start Server:</strong> <code>pnpm start:ai</code> or <code>pnpm dev:server</code></small></p>
      </div>
    </div>

    <div class="right-panel">
      <h2>🛠️ Development Tools</h2>

      <div class="tools-card">
        <h3>🎮 Interactive Playgrounds</h3>
        <div class="tool-links">
          <a href="${mcpJamEndpoint}" target="_blank" class="tool-link">
            <strong>🎮 MCP JAM</strong><br>
            <small>Model Context Protocol testing (auto-started)</small>
          </a>

          ${config.endpoints.tRpc ? `
            <a href="${playgroundEndpoint}" target="_blank" class="tool-link">
              <strong>🚀 tRPC Playground</strong><br>
              <small>Type-safe API testing</small>
            </a>
          ` : `
            <div class="tool-link disabled">
              <strong>⚠️ tRPC Playground</strong><br>
              <small>Not available - JSON-RPC only server</small>
            </div>
          `}
        </div>
      </div>

      <div class="tools-card">
        <h3>🌐 Open-RPC Tools</h3>
        <p><small>Enable JSON-RPC protocol and ensure CORS allows 'https://playground.open-rpc.org/' and 'https://inspector.open-rpc.org'</small></p>
        <div class="tool-links">
          <a href="https://playground.open-rpc.org/?url=${config.baseUrl}/openrpc.json?pretty=true&rpcUrl=${config.endpoints.jsonRpc}" target="_blank" class="tool-link">
            <strong>🎮 Open-RPC Playground</strong><br>
            <small>Standard JSON-RPC testing</small>
          </a>

          <a href="https://inspector.open-rpc.org/?url=${config.endpoints.jsonRpc}" target="_blank" class="tool-link">
            <strong>🔍 Open-RPC Inspector</strong><br>
            <small>API schema inspection</small>
          </a>
        </div>
      </div>
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

      let successful = false;
      try {
        successful = document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
      }

      document.body.removeChild(textArea);
      return successful;
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

    function copyAndOpenPlayground(elementId, playgroundUrl) {
      const element = document.getElementById(elementId);
      const text = element.textContent || element.innerText;

      // Copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API
        navigator.clipboard.writeText(text).then(() => {
          // Open playground after successful copy
          window.open(playgroundUrl, '_blank');
        }).catch(err => {
          console.error('Failed to copy tRPC call: ', err);
          // Try fallback copy, then open playground
          if (fallbackCopyTextToClipboard(text)) {
            window.open(playgroundUrl, '_blank');
          }
        });
      } else {
        // Fallback for older browsers
        if (fallbackCopyTextToClipboard(text)) {
          window.open(playgroundUrl, '_blank');
        }
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
app.get('/api/methods', (_, res) => {
  if (trpcMethods) {
    res.json(trpcMethods);
  } else {
    res.status(404).json({ error: 'trpc-methods.json not found' });
  }
});

app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`🎨 tRPC Development Panel running at ${url}`);

  if (trpcMethods) {
    if (trpcMethods.isPlaceholder) {
      console.log(`📋 Setup page available - add build:trpc-methods script to see tRPC methods`);
    } else {
      console.log(`📊 Serving ${trpcMethods.stats.totalProcedures} procedures`);
      console.log(`📄 JSON API: ${url}/api/methods`);
    }
  } else {
    console.log(`🔄 Loading tRPC methods...`);
  }

  // Auto-open browser
  if (openBrowser) {
    setTimeout(async () => {
      try {
        const open = await import('open');
        await open.default(url);
        console.log(`🌐 Browser opened to ${url}`);
      } catch (error) {
        console.log(`💡 Open browser manually: ${url}`);
      }
    }, 1000);
  }
});
// Periodically check server status and MCP Inspector status
setInterval(async () => {
  try {
    // Check server status (silent)
    const newServerConfig = await discoverServerConfig();
    if (newServerConfig && !serverConfig) {
      serverConfig = newServerConfig;
    } else if (!newServerConfig && serverConfig) {
      serverConfig = null;
    }

    // Check MCP Inspector status (silent)
    const newMcpInspectorStatus = await checkMCPInspector();
    mcpInspectorStatus = newMcpInspectorStatus;
  } catch (error) {
    // Silent error handling - don't spam console
  }
}, 10000); // Check every 10 seconds

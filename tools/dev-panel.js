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
const port = process.env.PORT || 8080;
const playgroundEndpoint = '/api/trpc-playground';
const mcpJamEndpoint = 'http://localhost:4000';
const aiServerEndpoint = 'http://localhost:8000';
const rpcEndpoint = `${aiServerEndpoint}/rpc`;
const trpcApiEndpoint = '/api/trpc'; // endpoint used by trpc playground

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
function generateProcedureHTML(name, procedure) {
  const { type, method, path: procPath, summary, description, tags, input, output } = procedure;
  
  const methodBadge = method ? `<span class="method-badge method-${method.toLowerCase()}">${method}</span>` : 
                     `<span class="method-badge method-${type}">${type.toUpperCase()}</span>`;
  
  const pathDisplay = procPath || name;
  
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
          <h4>Input</h4>
          <pre class="schema">${JSON.stringify(input, null, 2)}</pre>
        </div>
        
        <div class="io-section">
          <h4>Output</h4>
          <pre class="schema">${JSON.stringify(output, null, 2)}</pre>
        </div>
        
        <div class="curl-example">
          <h4>cURL Example 
            <button class="copy-btn" onclick="copyToClipboard('curl-${name}')">📋 Copy</button>
          </h4>
          <pre class="curl" id="curl-${name}"><code>${generateJsonRpcExample(name, type, input)}</code></pre>
        </div>
        
        <div class="playground-section">
          <h4>🎮 Try in Playground</h4>
          <a href="${generatePlaygroundURL(name, input)}" target="_blank" class="playground-btn">
            🚀 Open in tRPC Playground
          </a>
        </div>
      </div>
    </div>
  `;
}

function generateSampleInput(inputSchema) {
  if (!inputSchema || !inputSchema.properties) {
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

// Setup tRPC Playground
async function setupTRPCPlayground() {
  try {
    // Load the actual router - this is a bit tricky since we need to import the built version
    const routerPath = path.join(process.cwd(), 'dist/trpc/root.js');
    
    if (!existsSync(routerPath)) {
      console.log('⚠️  Router not found at', routerPath, '- skipping playground setup');
      return;
    }
    
    // Dynamic import the router
    const { createAppRouter } = await import(routerPath);
    
    // Create a simple router instance without dependencies for playground
    const router = createAppRouter();
    
    console.log('🔍 Router created, testing procedures...');
    
    // Set up tRPC API endpoint for playground
    app.use(
      trpcApiEndpoint,
      trpcExpress.createExpressMiddleware({
        router,
        createContext: () => ({}), // Provide empty context
        onError: ({ error, path }) => {
          console.error(`❌ tRPC Error on ${path}:`, error.message);
        },
      })
    );
    
    // Set up playground endpoint
    app.use(
      playgroundEndpoint,
      await expressHandler({
        trpcApiEndpoint,
        playgroundEndpoint,
        // zodResolveTypes fix - only need because trpc-playground is not supporting trpc v11 yet.
        // Can be removed once PR #61 is merged https://github.com/sachinraja/trpc-playground/pull/61
        resolveTypes: zodResolveTypes, 
        router: router,
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
  } catch (error) {
    console.log('⚠️  Failed to setup tRPC Playground:', error.message);
    console.log('💡 Error details:', error.stack);
    console.log('💡 Make sure to build the project first: pnpm build');
  }
}


function generateJsonRpcExample(procedureName, procedureType, inputSchema) {
  const sampleInput = generateSampleInput(inputSchema);
  const inputObj = JSON.parse(sampleInput);
  
  // Convert tRPC procedure name to JSON-RPC method name
  // ai.health -> health, ai.executeAIRequest -> executeAIRequest
  const methodName = procedureName.includes('.') ? procedureName.split('.')[1] : procedureName;
  
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    method: methodName,
    params: inputObj,
    id: 1
  };
  
  return `curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(jsonRpcRequest)}'`;
}

// Main route
app.get('/', (req, res) => {
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
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
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
    
    .tags {
      margin: 0.5rem 0;
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
    <p><strong>🎮 MCP jam:</strong> <a href="${mcpJamEndpoint}" target="_blank">Open MCP JAM Playground</a></p>
    <p>Generated from <code>dist/trpc-methods.json</code> on ${new Date(generated).toLocaleString()}</p>
    <p><strong>💡 Start AI Server:</strong> <code>pnpm start:ai</code> or <code>pnpm dev:server</code> (with tRPC at <code>http://localhost:8000/trpc</code>)</p>
    <p><strong>🎮 Interactive Playground:</strong> <a href="${playgroundEndpoint}" target="_blank" class="playground-link">Open tRPC Playground</a></p>

    <h2>Open-RPC tools</h2>
    <p>Enable JSON-RPC protocol and ensure CORS is allowing 'https://playground.open-rpc.org/' and 'https://inspector.open-rpc.org' in server config.    
    <p><strong>🎮 Open-RPC Playground:</strong> <a href="https://playground.open-rpc.org/?url=${aiServerEndpoint}/openrpc.json&rpcUrl=${rpcEndpoint}" target="_blank" class="playground-link">Open RPC Playground</a></p>
    <p><strong>🎮 Open-RPC Inspector:</strong> <a href="https://inspector.open-rpc.org/?url=${rpcEndpoint}" target="_blank" class="playground-link">Open RPC Inspector</a></p>
    
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
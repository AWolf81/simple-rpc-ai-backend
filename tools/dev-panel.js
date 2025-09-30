#!/usr/bin/env node
/**
 * Development Panel Server - Using trpc-methods.json
 * 
 * Creates a documentation panel that reads from the generated trpc-methods.json
 */

import express from 'express';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { expressHandler } from 'trpc-playground/handlers/express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { zodResolveTypes } from './trpc-playground-fix.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let serverPort = null;
let devPanelPort = null;
let skipServerCheck = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--skip-server-check') {
    skipServerCheck = true;
  } else if (arg === '--server-port') {
    serverPort = parseInt(args[i + 1]);
    i++;
  } else if (arg === '--port') {
    devPanelPort = parseInt(args[i + 1]);
    i++;
  } else if (arg === '--help') {
    console.log(`
🚀 Simple RPC AI Backend Dev Panel

Usage: simple-rpc-dev-panel [options]

Options:
  --port <number>          Dev panel port (default: 8080)
  --server-port <number>   Backend server port (default: auto-discover 8001, 8000, ...)
  --skip-server-check      Skip backend server health check (dev-panel only mode)
  --help                   Show this help message

Examples:
  # Basic usage (auto-discovers server on 8001, 8000, etc.)
  simple-rpc-dev-panel --port 8080

  # Force specific server port (basic server on 8000)
  simple-rpc-dev-panel --server-port 8000 --port 8080

  # Force specific server port (MCP server on 8001)
  simple-rpc-dev-panel --server-port 8001 --port 8080

  # Use with wait-on for workflow sequencing
  "dev-panel": "npx simple-rpc-dev-panel --server-port 8001 --port 8080"
  "start-chrome": "wait-on http://localhost:8080/ready && google-chrome ..."

  # Or use wait-on with stdout detection
  "start-chrome": "wait-on -l 'READY' && google-chrome ..."

  # Skip backend server check if only using dev-panel
  simple-rpc-dev-panel --port 8080 --skip-server-check

Readiness Detection (Always Available):
  - HTTP endpoint: GET http://localhost:<port>/ready (returns 200 when ready)
  - Stdout signal: "READY" is output when all services are ready
  - Process stays running for ongoing development
  - Use --skip-server-check if backend server not available
`);
    process.exit(0);
  }
}

const app = express();
const port = devPanelPort || process.env.DEV_PANEL_PORT || 8080;
const openBrowser = process.env.DEV_PANEL_OPEN_BROWSER !== 'false';
const playgroundEndpoint = '/api/trpc-playground';
const mcpJamEndpoint = 'http://localhost:4000';
const trpcApiEndpoint = '/api/trpc'; // endpoint used by trpc playground

// Override server port discovery if specified
if (serverPort) {
  process.env.AI_SERVER_PORT = serverPort.toString();
}

// Dynamic server configuration discovery
let serverConfig = null;
let mcpInspectorStatus = { running: false, token: null };
let mcpJamProcess = null;
let mcpJamStatus = { running: false, port: 4000 };
let mcpJamStartLogged = false;

function logMcpJamStarted(message = '✅ MCP JAM started successfully') {
  if (mcpJamStartLogged) {
    return;
  }
  console.log(message);
  mcpJamStartLogged = true;
}

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

// Check if MCP JAM is running and start it if not
async function checkAndStartMCPJam() {
  try {
    // First, check if MCP JAM is already running
    const response = await fetch(`http://localhost:${mcpJamStatus.port}/health`);
    if (response.ok) {
      console.log(`🎮 MCP JAM already running on port ${mcpJamStatus.port}`);
      mcpJamStatus.running = true;
      return mcpJamStatus;
    }
  } catch (error) {
    // Not running, try to start it
  }

  try {
    console.log(`🚀 Starting MCP JAM on port ${mcpJamStatus.port}...`);

    // Find the MCP JAM binary in node_modules
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules/@mcpjam/inspector/bin/start.js'),
      path.join(__dirname, '../node_modules/@mcpjam/inspector/bin/start.js'),
      path.join(__dirname, '../../node_modules/@mcpjam/inspector/bin/start.js'),
    ];

    let mcpJamPath = null;
    for (const testPath of possiblePaths) {
      if (existsSync(testPath)) {
        mcpJamPath = testPath;
        break;
      }
    }

    if (!mcpJamPath) {
      // Try npx as a fallback for out-of-the-box functionality
      console.log('📦 Local MCP JAM not found, trying npx @mcpjam/inspector...');
      try {
        mcpJamProcess = spawn('npx', ['@mcpjam/inspector', '--port', mcpJamStatus.port.toString()], {
          stdio: 'pipe',
          detached: false,
          env: {
            ...process.env,
            PORT: mcpJamStatus.port.toString(),
            NODE_ENV: 'production'
          }
        });

        // Set up event handlers for npx approach
        mcpJamProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Inspector Launched') || output.includes('localhost:')) {
            mcpJamStatus.running = true;
            logMcpJamStarted();
          }
        });

        mcpJamProcess.stderr?.on('data', (data) => {
          const output = data.toString().trim();
          if (output.includes('error') || output.includes('Error')) {
            console.log(`MCP JAM (npx): ${output}`);
          }
        });

        mcpJamProcess.on('exit', (code) => {
          if (code !== 0) {
            console.log(`⚠️  MCP JAM (npx) exited with code ${code}`);
          }
          mcpJamStatus.running = false;
        });

        // Wait a moment to see if it starts successfully
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if it's actually running
        try {
          const response = await fetch(`http://localhost:${mcpJamStatus.port}/health`);
          if (response.ok) {
            mcpJamStatus.running = true;
            logMcpJamStarted();
            return mcpJamStatus;
          }
        } catch (error) {
          // Still not running, fall through to warning
        }
      } catch (error) {
        console.log(`⚠️  MCP JAM could not be started via npx: ${error.message}`);
      }

      // Final fallback: graceful degradation
      console.log('⚠️  MCP JAM could not be started - @mcpjam/inspector not accessible');
      console.log('💡 Dev-panel will work without MCP JAM. To enable MCP JAM:');
      console.log('   • Install locally: npm install @mcpjam/inspector');
      console.log('   • Or ensure npx can access it globally');
      mcpJamStatus.running = false;
      return mcpJamStatus;
    }

    mcpJamProcess = spawn('node', [mcpJamPath, '--port', mcpJamStatus.port.toString()], {
      stdio: 'pipe',
      detached: false,
      env: {
        ...process.env,
        PORT: mcpJamStatus.port.toString(),
        NODE_ENV: 'production'
      }
    });

    mcpJamProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Inspector Launched') || output.includes('localhost:')) {
        mcpJamStatus.running = true;
        logMcpJamStarted();
      }
    });

    mcpJamProcess.stderr?.on('data', (data) => {
      // Suppress MCP JAM logs unless there's an error
      const output = data.toString().trim();
      if (output.includes('error') || output.includes('Error')) {
        console.log(`MCP JAM: ${output}`);
      }
    });

    mcpJamProcess.on('close', (code) => {
      console.log(`🎮 MCP JAM process exited with code ${code}`);
      mcpJamStatus.running = false;
      mcpJamProcess = null;
      mcpJamStartLogged = false;
    });

    mcpJamProcess.on('error', (error) => {
      console.error(`❌ MCP JAM failed to start: ${error.message}`);
      mcpJamStatus.running = false;
      mcpJamProcess = null;
      mcpJamStartLogged = false;
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    mcpJamStatus.running = true; // Assume it started
    logMcpJamStarted();

    return mcpJamStatus;

  } catch (error) {
    console.log(`⚠️  MCP JAM could not be started: ${error.message}`);
    console.log('💡 Dev-panel will work without MCP JAM.');
    mcpJamStatus.running = false;
    return mcpJamStatus;
  }
}

async function discoverServerConfig() {
  // Try to discover running servers on common ports
  // Default to 8001 (MCP server with more features) but also check 8000 (basic server)
  const commonPorts = [8001, 8000, 8002, 3000];
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
        return {
          ...config,
          detected: true
        };
      }
    } catch (error) {
      // Server not running on this port, continue
    }
  }

  // Fallback to default configuration
  // Default to 8001 (MCP server) but allow override via environment
  const fallbackPort = manualPort || 8001;
  return {
    port: fallbackPort,
    baseUrl: `http://localhost:${fallbackPort}`,
    detected: false,
    endpoints: {
      health: `http://localhost:${fallbackPort}/health`,
      jsonRpc: `http://localhost:${fallbackPort}/rpc`,
      tRpc: `http://localhost:${fallbackPort}/trpc`,
      mcp: `http://localhost:${fallbackPort}/mcp`,
    },
    protocols: {
      jsonRpc: false,
      tRpc: false,
      mcp: false
    }
  };
}

// Health check functions for readiness polling
async function checkServerHealth() {
  try {
    const config = getServerConfig();
    const healthUrl = config.endpoints && config.endpoints.health
      ? config.endpoints.health
      : `${config.baseUrl}/health`;

    const response = await fetch(healthUrl, {
      timeout: 2000,
      signal: AbortSignal.timeout(2000)
    });

    if (response.ok) {
      if (!config.detected) {
        serverConfig = await discoverServerConfig();
      } else if (serverConfig && !serverConfig.detected) {
        serverConfig = { ...serverConfig, detected: true };
      }
      return true;
    } else {
      console.log(`⚠️  Backend server responded with status ${response.status} at ${healthUrl}`);
      if (serverConfig && serverConfig.detected) {
        serverConfig = { ...serverConfig, detected: false };
      }
      return false;
    }
  } catch (error) {
    const config = getServerConfig();

    // Try alternative endpoints if health check fails
    const alternativeEndpoints = [
      `${config.baseUrl}/config`,
      `${config.baseUrl}/`,
      config.endpoints.tRpc,
      config.endpoints.jsonRpc
    ].filter(url => url && url !== config.endpoints.health);

    console.log(`⚠️  Backend server health check failed: ${error.message} (trying ${config.endpoints.health})`);

    // Try alternative endpoints to see if server is running
    for (const altUrl of alternativeEndpoints) {
      try {
        const altResponse = await fetch(altUrl, {
          timeout: 1000,
          signal: AbortSignal.timeout(1000)
        });

        if (altResponse.ok) {
          console.log(`✅ Backend server detected via alternative endpoint: ${altUrl}`);
          return true;
        }
      } catch (altError) {
        // Continue trying other endpoints
      }
    }

    // If all endpoints fail, server is likely not running
    console.log(`💡 Backend server not detected on port ${config.port}. Is it running?`);
    if (serverConfig && serverConfig.detected) {
      serverConfig = { ...serverConfig, detected: false };
    }
    return false;
  }
}

async function checkMCPJamHealth() {
  try {
    const response = await fetch(`http://localhost:${mcpJamStatus.port}/health`, {
      timeout: 2000,
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function checkDevPanelHealth() {
  try {
    const response = await fetch(`http://localhost:${port}/api/methods`, {
      timeout: 2000,
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function waitForServicesReady() {
  console.log('🔄 Waiting for services to be ready...');

  const maxWaitTime = 30000; // 30 seconds (reduced from 60)
  const pollInterval = 1000; // 1 second
  const serverMaxWaitTime = 10000; // Only wait 10 seconds for server
  const startTime = Date.now();

  let serverReady = false;
  let mcpJamReady = false;
  let devPanelReady = false;

  while (Date.now() - startTime < maxWaitTime) {
    // Check server health with shorter timeout
    if (!serverReady) {
      if (skipServerCheck) {
        serverReady = true; // Skip server check
        console.log('⏭️  Backend server check skipped');
      } else if (Date.now() - startTime > serverMaxWaitTime) {
        // After 10 seconds, give up on server and continue with dev-panel only
        console.log('⚠️  Backend server timeout after 10s - continuing with dev-panel only mode');
        serverReady = true; // Continue without server
      } else {
        serverReady = await checkServerHealth();
        if (serverReady) {
          console.log('✅ Backend server is ready');
        }
      }
    }

    // Check MCP JAM health (only if enabled)
    if (!mcpJamReady && mcpJamStatus.running) {
      mcpJamReady = await checkMCPJamHealth();
      if (mcpJamReady) {
        console.log('✅ MCP JAM is ready');
      }
    } else if (!mcpJamStatus.running) {
      mcpJamReady = true; // Skip if not running
    }

    // Check dev panel health
    if (!devPanelReady) {
      devPanelReady = await checkDevPanelHealth();
      if (devPanelReady) {
        console.log('✅ Dev Panel is ready');
      }
    }

    // All services ready
    if (serverReady && mcpJamReady && devPanelReady) {
      console.log('🎉 All services are ready!');
      return true;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout reached
  console.log('⚠️  Timeout waiting for services to be ready');
  console.log(`   Backend server: ${serverReady ? '✅' : '❌'} ${serverReady && Date.now() - startTime > serverMaxWaitTime ? '(timeout - continuing anyway)' : ''}`);
  if (mcpJamStatus.running) {
    console.log(`   MCP JAM: ${mcpJamReady ? '✅' : '❌'}`);
  }
  console.log(`   Dev Panel: ${devPanelReady ? '✅' : '❌'}`);

  // If dev panel is ready, we can continue even if backend server failed
  if (devPanelReady) {
    console.log('💡 Dev panel is ready - continuing in dev-panel only mode');
    return true;
  }

  return false;
}


// Initialize server configuration
(async () => {
  serverConfig = await discoverServerConfig();
  mcpInspectorStatus = await checkMCPInspector();
  mcpJamStatus = await checkAndStartMCPJam();
})();

// Helper function to get current config or fallback
function getServerConfig() {
  return serverConfig || {
    port: process.env.AI_SERVER_PORT || 8001,
    baseUrl: `http://localhost:${process.env.AI_SERVER_PORT || 8001}`,
    detected: false,
    protocols: {
      jsonRpc: false,
      tRpc: false,
      mcp: false
    },
    endpoints: {
      jsonRpc: `http://localhost:${process.env.AI_SERVER_PORT || 8001}/rpc`,
      tRpc: `http://localhost:${process.env.AI_SERVER_PORT || 8001}/trpc`,
      mcp: `http://localhost:${process.env.AI_SERVER_PORT || 8001}/mcp`,
      health: `http://localhost:${process.env.AI_SERVER_PORT || 8001}/health`
    }
  };
}

// Discover custom routers from consumer project
async function discoverCustomRouters() {
  try {
    const cwd = process.cwd();

    // Common patterns for custom router discovery
    const possiblePaths = [
      './src/methods.js',
      './src/methods/index.js',
      './methods/index.js',
      './methods.js',
      './src/routers.js',
      './routers.js',
      './src/trpc/custom-routers.js',
      './src/trpc/custom-routers/index.js'
    ];

    // Check if we're running a specific example server (detect from running process)
    // Try to detect which server is running by checking for process arguments
    try {
      const { execSync } = await import('child_process');
      const psOutput = execSync('ps aux | grep -E "node|tsx" | grep -E "server\\.js|server\\.ts" | grep -v grep', { encoding: 'utf-8' });

      // Look for example server paths in running processes
      const exampleDirs = ['examples/02-mcp-server', 'examples/01-basic-server', 'examples/04-mcp-tasks-server'];
      for (const exampleDir of exampleDirs) {
        if (psOutput.includes(exampleDir)) {
          const exampleMethodsPath = path.join(cwd, exampleDir, 'methods/index.js');
          const relativeExamplePath = `./${path.relative(cwd, exampleMethodsPath)}`;
          if (existsSync(exampleMethodsPath) && !possiblePaths.includes(relativeExamplePath)) {
            possiblePaths.unshift(relativeExamplePath);
            console.log(`📋 Detected running server: ${exampleDir}`);
          }
        }
      }
    } catch (error) {
      // Fallback: check all example directories
      const exampleDirs = ['examples/02-mcp-server', 'examples/01-basic-server', 'examples'];
      for (const exampleDir of exampleDirs) {
        const examplePath = path.join(cwd, exampleDir, 'methods/index.js');
        const relativeExamplePath = `./${path.relative(cwd, examplePath)}`;
        if (existsSync(examplePath) && !possiblePaths.includes(relativeExamplePath)) {
          possiblePaths.unshift(relativeExamplePath);
        }
      }
    }

    // Also check if we're in an example directory with methods
    if (cwd.includes('examples/')) {
      possiblePaths.unshift('./methods/index.js');
      possiblePaths.unshift('./methods.js');
    }

    for (const testPath of possiblePaths) {
      if (existsSync(testPath)) {
        try {
          const methodsModule = await import(path.resolve(testPath));

          // Try different export patterns
          if (methodsModule.getCustomRouters) {
            return methodsModule.getCustomRouters();
          } else if (methodsModule.default && methodsModule.default.getCustomRouters) {
            return methodsModule.default.getCustomRouters();
          } else if (methodsModule.customRouters) {
            return methodsModule.customRouters;
          } else {
            // Check for individual router exports
            const routers = {};
            const possibleRouterNames = ['mathRouter', 'utilityRouter', 'fileRouter', 'customMathRouter', 'customUtilityRouter', 'fileOperationsRouter'];

            for (const routerName of possibleRouterNames) {
              if (methodsModule[routerName]) {
                // Extract namespace from router name
                const namespace = routerName.replace(/Router$/, '').replace(/^custom/, '').toLowerCase();
                routers[namespace] = methodsModule[routerName];
              }
            }

            if (Object.keys(routers).length > 0) {
              return routers;
            }
          }
        } catch (error) {
          console.log(`⚠️  Failed to load custom routers from ${testPath}:`, error.message);
        }
      }
    }

    return null;
  } catch (error) {
    console.log('⚠️  Error discovering custom routers:', error.message);
    return null;
  }
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

  const cwd = process.cwd();
  console.log(`🔍 Searching for trpc-methods.json from working directory: ${cwd}`);

  // 2. Comprehensive search strategy for flexible project structures
  const searchPaths = [
    // Current directory variations
    path.join(cwd, 'dist/trpc-methods.json'),                    // ./dist/trpc-methods.json
    path.join(cwd, 'trpc-methods.json'),                         // ./trpc-methods.json
    path.join(cwd, 'build/trpc-methods.json'),                   // ./build/trpc-methods.json

    // Monorepo patterns - apps/backend
    path.join(cwd, 'apps/backend/dist/trpc-methods.json'),       // ./apps/backend/dist/trpc-methods.json
    path.join(cwd, 'apps/backend/trpc-methods.json'),            // ./apps/backend/trpc-methods.json
    path.join(cwd, 'apps/backend/build/trpc-methods.json'),      // ./apps/backend/build/trpc-methods.json

    // Monorepo patterns - packages/backend
    path.join(cwd, 'packages/backend/dist/trpc-methods.json'),   // ./packages/backend/dist/trpc-methods.json
    path.join(cwd, 'packages/backend/trpc-methods.json'),        // ./packages/backend/trpc-methods.json

    // Monorepo patterns - server
    path.join(cwd, 'apps/server/dist/trpc-methods.json'),        // ./apps/server/dist/trpc-methods.json
    path.join(cwd, 'packages/server/dist/trpc-methods.json'),    // ./packages/server/dist/trpc-methods.json
    path.join(cwd, 'server/dist/trpc-methods.json'),             // ./server/dist/trpc-methods.json

    // Common subdirectory patterns
    path.join(cwd, 'backend/dist/trpc-methods.json'),            // ./backend/dist/trpc-methods.json
    path.join(cwd, 'backend/trpc-methods.json'),                 // ./backend/trpc-methods.json
    path.join(cwd, 'api/dist/trpc-methods.json'),                // ./api/dist/trpc-methods.json
    path.join(cwd, 'src/dist/trpc-methods.json'),                // ./src/dist/trpc-methods.json

    // Parent directory patterns (in case dev-panel is run from a subdirectory)
    path.join(cwd, '../dist/trpc-methods.json'),                 // ../dist/trpc-methods.json
    path.join(cwd, '../trpc-methods.json'),                      // ../trpc-methods.json

    // Simple-rpc-ai-backend package fallbacks (when used as dependency)
    path.join(__dirname, '../trpc-methods.json'),                // package/trpc-methods.json
    path.join(__dirname, '../../dist/trpc-methods.json'),        // package/dist/trpc-methods.json
    path.join(__dirname, '../dist/trpc-methods.json'),           // package/dist/trpc-methods.json
  ];

  // Search with detailed logging
  for (let i = 0; i < searchPaths.length; i++) {
    const searchPath = searchPaths[i];
    if (existsSync(searchPath)) {
      const relativePath = path.relative(cwd, searchPath);
      console.log(`✅ Found tRPC methods at: ${searchPath}`);
      console.log(`   Relative to working directory: ${relativePath}`);
      return searchPath;
    }
  }

  // Final attempt: recursive search in common directories (limited depth)
  const recursiveSearchDirs = [
    path.join(cwd, 'apps'),
    path.join(cwd, 'packages'),
    path.join(cwd, 'services'),
    cwd
  ];

  for (const searchDir of recursiveSearchDirs) {
    if (existsSync(searchDir)) {
      const found = findTrpcMethodsRecursive(searchDir, 3); // max 3 levels deep
      if (found) {
        const relativePath = path.relative(cwd, found);
        console.log(`✅ Found tRPC methods via recursive search: ${found}`);
        console.log(`   Relative to working directory: ${relativePath}`);
        return found;
      }
    }
  }

  console.log(`🔍 No trpc-methods.json found after comprehensive search`);
  console.log(`💡 Searched ${searchPaths.length} common locations plus recursive search`);
  return null;
}

// Helper function for recursive search (limited depth)
function findTrpcMethodsRecursive(dir, maxDepth) {
  if (maxDepth <= 0) return null;

  try {
    const items = require('fs').readdirSync(dir, { withFileTypes: true });

    // First check for trpc-methods.json in this directory
    const methodsFile = path.join(dir, 'trpc-methods.json');
    if (existsSync(methodsFile)) return methodsFile;

    // Then check dist/trpc-methods.json
    const distMethodsFile = path.join(dir, 'dist/trpc-methods.json');
    if (existsSync(distMethodsFile)) return distMethodsFile;

    // Then recurse into subdirectories
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        const found = findTrpcMethodsRecursive(path.join(dir, item.name), maxDepth - 1);
        if (found) return found;
      }
    }
  } catch (error) {
    // Ignore permission errors, etc.
  }

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

function generateProcedureHTML(name, procedure, anchorRegistry, options = {}) {
  const { toolNameLookup = {} } = options;
  const { type, method, path: procPath, summary, description, tags, input, output, requiresAuth, meta } = procedure;

  // Add lock icon for procedures that require authentication
  const authIcon = requiresAuth ? ' 🔒' : '';
  const authTitle = requiresAuth ? 'Authentication required' : '';

  // Create shareable anchor (default to last segment of tRPC name)
  const anchorBase = (meta && meta.anchor) || name.split('.').pop() || name;
  const sanitizedAnchor = anchorBase
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '') || 'method';
  const usageCount = anchorRegistry.get(sanitizedAnchor) || 0;
  anchorRegistry.set(sanitizedAnchor, usageCount + 1);
  const anchorId = usageCount === 0 ? sanitizedAnchor : `${sanitizedAnchor}-${usageCount + 1}`;

  // Check if this procedure is exposed as an MCP tool
  const isMCPTool = meta && meta.mcp;
  const toolLabel = isMCPTool
    ? (toolNameLookup[name] || meta.mcp.toolName || meta.mcp.name || name.split('.').pop() || name)
    : null;
  const mcpBadge = isMCPTool ? `<span class="mcp-badge" title="Available as MCP tool: ${toolLabel}">MCP</span>` : '';

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
    <div class="procedure" data-type="${type}" id="method-${name.replace(/\./g, '-')}" data-anchor="${anchorId}">
      <span class="procedure-anchor" id="${anchorId}"></span>
      <div class="procedure-header">
        ${methodBadge}
        <div class="procedure-title">
          <code class="procedure-name">${pathDisplay}</code>
          <a class="procedure-permalink" href="#${anchorId}" title="Copy link to ${pathDisplay}">#</a>
        </div>
        ${mcpBadge}
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

// Helper function to find tRPC router files with flexible discovery
function findTrpcRouterFile() {
  const cwd = process.cwd();
  console.log(`🔍 Searching for tRPC router file from working directory: ${cwd}`);

  const routerSearchPaths = [
    // Standard patterns
    path.join(cwd, 'dist/trpc/root.js'),                     // ./dist/trpc/root.js (standard)
    path.join(cwd, 'dist/trpc/router.js'),                   // ./dist/trpc/router.js
    path.join(cwd, 'dist/trpc/index.js'),                    // ./dist/trpc/index.js
    path.join(cwd, 'dist/router.js'),                        // ./dist/router.js
    path.join(cwd, 'dist/index.js'),                         // ./dist/index.js

    // Custom patterns (like src/methods.js)
    path.join(cwd, 'dist/methods.js'),                       // ./dist/methods.js
    path.join(cwd, 'src/methods.js'),                        // ./src/methods.js (your use case)
    path.join(cwd, 'src/methods/index.js'),                  // ./src/methods/index.js (your requested pattern)
    path.join(cwd, 'methods.js'),                            // ./methods.js
    path.join(cwd, 'methods/index.js'),                      // ./methods/index.js

    // Monorepo patterns
    path.join(cwd, 'apps/backend/dist/trpc/root.js'),        // ./apps/backend/dist/trpc/root.js
    path.join(cwd, 'apps/backend/dist/methods.js'),          // ./apps/backend/dist/methods.js
    path.join(cwd, 'apps/backend/src/methods.js'),           // ./apps/backend/src/methods.js
    path.join(cwd, 'apps/backend/src/methods/index.js'),     // ./apps/backend/src/methods/index.js
    path.join(cwd, 'packages/backend/dist/trpc/root.js'),    // ./packages/backend/dist/trpc/root.js
    path.join(cwd, 'packages/backend/src/methods/index.js'), // ./packages/backend/src/methods/index.js
    path.join(cwd, 'backend/dist/trpc/root.js'),             // ./backend/dist/trpc/root.js
    path.join(cwd, 'backend/src/methods/index.js'),          // ./backend/src/methods/index.js

    // Build variations
    path.join(cwd, 'build/trpc/root.js'),                    // ./build/trpc/root.js
    path.join(cwd, 'build/router.js'),                       // ./build/router.js
    path.join(cwd, 'build/methods.js'),                      // ./build/methods.js
  ];

  for (const routerPath of routerSearchPaths) {
    if (existsSync(routerPath)) {
      const relativePath = path.relative(cwd, routerPath);
      console.log(`✅ Found tRPC router at: ${routerPath}`);
      console.log(`   Relative to working directory: ${relativePath}`);
      return routerPath;
    }
  }

  // Recursive search for router files
  const recursiveSearchDirs = [
    path.join(cwd, 'apps'),
    path.join(cwd, 'packages'),
    path.join(cwd, 'dist'),
    path.join(cwd, 'src'),
    cwd
  ];

  for (const searchDir of recursiveSearchDirs) {
    if (existsSync(searchDir)) {
      const found = findRouterFileRecursive(searchDir, 3);
      if (found) {
        const relativePath = path.relative(cwd, found);
        console.log(`✅ Found tRPC router via recursive search: ${found}`);
        console.log(`   Relative to working directory: ${relativePath}`);
        return found;
      }
    }
  }

  console.log(`🔍 No tRPC router file found after comprehensive search`);
  return null;
}

// Helper function for recursive router search
function findRouterFileRecursive(dir, maxDepth) {
  if (maxDepth <= 0) return null;

  try {
    const items = require('fs').readdirSync(dir, { withFileTypes: true });

    // Common router file names to look for
    const routerFileNames = [
      'root.js', 'router.js', 'index.js', 'methods.js',
      'trpc.js', 'app.js', 'api.js'
    ];

    for (const fileName of routerFileNames) {
      const routerFile = path.join(dir, fileName);
      if (existsSync(routerFile)) {
        // Basic check to see if it might be a tRPC router file
        try {
          const content = require('fs').readFileSync(routerFile, 'utf8');
          if (content.includes('router') || content.includes('trpc') || content.includes('procedure')) {
            return routerFile;
          }
        } catch (error) {
          // Ignore read errors
        }
      }
    }

    // Recurse into subdirectories (especially trpc subdirectories)
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        const found = findRouterFileRecursive(path.join(dir, item.name), maxDepth - 1);
        if (found) return found;
      }
    }
  } catch (error) {
    // Ignore permission errors, etc.
  }

  return null;
}

// Setup tRPC Playground with proxy to actual server
async function setupTRPCPlayground() {
  try {
    // Try to load the actual router for playground schema discovery
    const routerPath = findTrpcRouterFile();
    let schemaRouter = null;

    if (routerPath && existsSync(routerPath)) {
      try {
        // Dynamic import the router
        const routerModule = await import(routerPath);
        console.log('📁 Router module imported, available exports:', Object.keys(routerModule));

        // Try different export patterns
        if (routerModule.createAppRouter) {
          // Standard simple-rpc-ai-backend pattern
          // Try to detect and include custom routers for complete schema discovery
          let customRouters = null;

          // Check if there are custom routers available in the current context
          if (routerModule.getCustomRouters) {
            customRouters = routerModule.getCustomRouters();
            console.log('📋 Found custom routers:', Object.keys(customRouters));
          } else {
            // Try to discover custom routers from consumer project
            customRouters = await discoverCustomRouters();
            if (customRouters && Object.keys(customRouters).length > 0) {
              console.log('📋 Discovered custom routers from project:', Object.keys(customRouters));
            }
          }

          // Create router with custom routers if available
          if (customRouters && Object.keys(customRouters).length > 0) {
            // Pass customRouters as 10th parameter: createAppRouter(aiConfig, tokenTracking, db, serverProviders, byokProviders, postgresRPC, mcpConfig, modelRestrictions, rootFolders, customRouters)
            schemaRouter = routerModule.createAppRouter(
              undefined,  // aiConfig
              false,      // tokenTrackingEnabled
              undefined,  // dbAdapter
              ['anthropic'],  // serverProviders
              ['anthropic'],  // byokProviders
              undefined,  // postgresRPCMethods
              { enableMCP: true },  // mcpConfig
              undefined,  // modelRestrictions
              {},         // rootFolders
              customRouters  // customRouters (10th parameter)
            );
            console.log('✅ Router loaded via createAppRouter with custom routers:', Object.keys(customRouters));
          } else {
            schemaRouter = routerModule.createAppRouter();
            console.log('✅ Router loaded via createAppRouter (core only)');
          }
        } else if (routerModule.getCustomRouters) {
          // Custom pattern like your src/methods.js
          const customRouters = routerModule.getCustomRouters();
          console.log('✅ Router loaded via getCustomRouters export');
          console.log('📋 Available custom routers:', Object.keys(customRouters));
          // For schema discovery, we'll use proxy mode since custom routers need server integration
          schemaRouter = null;
        } else if (routerModule.default) {
          // Default export pattern
          if (typeof routerModule.default === 'function') {
            try {
              schemaRouter = routerModule.default();
              console.log('✅ Router loaded via default function export');
            } catch (error) {
              console.log('⚠️  Default export is not a router factory function');
              schemaRouter = null;
            }
          } else if (routerModule.default.getCustomRouters) {
            const customRouters = routerModule.default.getCustomRouters();
            console.log('✅ Router loaded via default.getCustomRouters export');
            console.log('📋 Available custom routers:', Object.keys(customRouters));
            schemaRouter = null;
          } else {
            console.log('⚠️  Default export is not a recognized router pattern');
            schemaRouter = null;
          }
        } else {
          console.log('⚠️  No recognized router export pattern found');
          console.log('💡 Expected: createAppRouter, getCustomRouters, or default function');
          schemaRouter = null;
        }

        if (schemaRouter) {
          console.log('🔍 Router loaded for schema discovery...');
        } else {
          console.log('🔄 Using proxy-only mode (custom routers require server integration)...');
        }
      } catch (error) {
        console.log('⚠️  Failed to load router for schema discovery:', error.message);
        console.log('🔄 Continuing with proxy-only setup...');
        schemaRouter = null;
      }
    } else {
      console.log('🔄 Setting up playground with proxy-only mode (no schema discovery)...');
    }
    
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

    // Set up playground endpoint - create minimal fallback if no schema router
    if (!schemaRouter) {
      // Import tRPC for minimal router creation
      try {
        const { initTRPC } = await import('@trpc/server');
        const { z } = await import('zod');

        const t = initTRPC.create();
        const router = t.router;
        const publicProcedure = t.procedure;

        // Create a minimal fallback router with a health check
        schemaRouter = router({
          health: publicProcedure
            .query(() => ({ status: 'Playground proxy mode - schema discovery unavailable' }))
        });

        console.log('🔧 Created minimal fallback router for playground');
        console.log('💡 For full schema discovery, ensure your server is built: pnpm build');
      } catch (error) {
        console.log('❌ Failed to create fallback router:', error.message);
        console.log('💡 tRPC Playground will not be available');
        return;
      }
    }

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
    
    const modeText = schemaRouter ? (existsSync(routerPath) ? 'full schema discovery' : 'proxy mode') : 'proxy mode';
    console.log(`🎮 tRPC Playground available at http://localhost:${port}${playgroundEndpoint} (${modeText})`);
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
  // Ensure protocols is always set for template rendering
  if (!config.protocols) {
    config.protocols = {
      jsonRpc: false,
      tRpc: false,
      mcp: false
    };
  }

  const protocolLabel = (name) => {
    const normalized = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const friendlyNames = {
      trpc: 'tRPC',
      jsonrpc: 'JSON-RPC',
      mcp: 'MCP'
    };
    return friendlyNames[normalized] || name.toUpperCase();
  };

  const protocolStatusHTML = config.protocols
    ? Object.entries(config.protocols)
        .map(([protocol, enabled]) => {
          const isDetected = Boolean(config.detected);
          const isEnabled = Boolean(enabled) && isDetected;
          const statusSymbol = isDetected ? (isEnabled ? '✅' : '❌') : '❓';
          const color = isDetected
            ? (isEnabled ? '#059669' : '#b91c1c')
            : '#6b7280';
          return `<span style="color: ${color}; margin-right: 15px;">${protocolLabel(protocol)}: ${statusSymbol}</span>`;
        })
        .join('')
    : '';

  const serverStatusDescriptor = (() => {
    if (skipServerCheck) {
      return {
        color: '#b45309',
        icon: '⏭️',
        text: 'Server check skipped (dev-panel only mode)',
        detail: config.baseUrl ? `Expected server: ${config.baseUrl}` : null
      };
    }
    if (config.detected) {
      return {
        color: '#059669',
        icon: '✅',
        text: `Connected at ${config.baseUrl}`,
        detail: null
      };
    }
    return {
      color: '#dc2626',
      icon: '⚠️',
      text: 'Server not detected',
      detail: config.baseUrl ? `Last attempt: ${config.baseUrl}` : null
    };
  })();

  const serverStatusBanner = `
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <strong>📡 Server Status:</strong>
      <span style="margin-left: 10px; color: ${serverStatusDescriptor.color};">
        ${serverStatusDescriptor.icon} ${serverStatusDescriptor.text}
      </span>
      ${serverStatusDescriptor.detail ? `<div style='margin-top: 6px; color: #4a5568;'>${serverStatusDescriptor.detail}</div>` : ''}
      ${protocolStatusHTML ? `<div style='margin-top: 6px;'>${protocolStatusHTML}</div>` : ''}
    </div>
  `;
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

            ${serverStatusBanner}

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
  const mcpToolIndex = (trpcMethods.mcp && trpcMethods.mcp.toolIndex) ? trpcMethods.mcp.toolIndex : {};
  const mcpMethods = (trpcMethods.mcp && trpcMethods.mcp.methods) ? trpcMethods.mcp.methods : {};
  const mcpToolNameLookup = Object.fromEntries(
    Object.entries(mcpMethods).map(([procName, toolInfo]) => [
      procName,
      toolInfo.toolName || toolInfo.name || procName.split('.').pop() || procName
    ])
  );
  const serializedMcpToolIndex = JSON.stringify(mcpToolIndex).replace(/</g, '\\u003c');

  // Generate server setup status HTML
  const routerPath = findTrpcRouterFile();
  const routerExists = routerPath && existsSync(routerPath);
  const hasServerRunning = Boolean(config.detected);

  let serverSetupStatusHTML = '';
  if (routerExists && hasServerRunning) {
    const relativePath = path.relative(process.cwd(), routerPath);
    serverSetupStatusHTML = `<p style="color: #059669;"><strong>✅ Full Setup</strong><br><small>Schema discovery + server proxy working</small></p>
      <div style="background: #d1fae5; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <small><strong>Router file:</strong> <code>${relativePath}</code></small>
      </div>`;
  } else if (!routerExists && hasServerRunning) {
    serverSetupStatusHTML = `<p style="color: #f59e0b;"><strong>⚠️ Proxy Mode</strong><br><small>Server running, but no local schema discovery</small></p>
      <div style="background: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <small><strong>To enable full schema discovery:</strong><br>
        Run <code>pnpm build</code> to generate tRPC router file</small>
      </div>`;
  } else if (routerExists && !hasServerRunning) {
    const relativePath = path.relative(process.cwd(), routerPath);
    serverSetupStatusHTML = `<p style="color: #f59e0b;"><strong>⚠️ No Server</strong><br><small>Schema available, but server not detected</small></p>
      <div style="background: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <small><strong>Router file:</strong> <code>${relativePath}</code><br>
        <strong>To start server:</strong> Run <code>pnpm start</code> or <code>pnpm dev:server</code></small>
      </div>`;
  } else {
    serverSetupStatusHTML = `<p style="color: #dc2626;"><strong>❌ Setup Required</strong><br><small>No server detected, no schema available</small></p>
      <div style="background: #fee2e2; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <small><strong>Quick setup:</strong><br>
        1. Run <code>pnpm build</code><br>
        2. Run <code>pnpm start</code> or <code>pnpm dev:server</code></small>
      </div>`;
  }

  // Generate tRPC playground link HTML
  const hasRouter = routerExists;
  const trpcPlaygroundHTML = config.endpoints.tRpc ? `
    <a href="${playgroundEndpoint}" target="_blank" class="tool-link ${!hasRouter ? 'proxy-mode' : ''}">
      <strong>🚀 tRPC Playground</strong><br>
      <small>${!hasRouter ?
        'Proxy mode - limited schema discovery' :
        'Type-safe API testing with full schema'}</small>
    </a>` : `
    <div class="tool-link disabled">
      <strong>⚠️ tRPC Playground</strong><br>
      <small>Not available - JSON-RPC only server</small>
    </div>`;

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
  const anchorRegistry = new Map();

  const accordionHTML = Object.entries(groupedProcedures)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, procs]) => {
      const procedureCount = procs.length;
      const queriesCount = procs.filter(([, proc]) => proc.type === 'query').length;
      const mutationsCount = procs.filter(([, proc]) => proc.type === 'mutation').length;
      
      const proceduresHTML = procs
        .map(([name, proc]) => generateProcedureHTML(name, proc, anchorRegistry, { toolNameLookup: mcpToolNameLookup }))
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
    html {
      scroll-behavior: smooth;
    }

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

    .procedure-anchor {
      display: block;
      position: relative;
      top: -90px;
      visibility: hidden;
    }
    
    .procedure:hover {
      border-color: #cbd5e0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .procedure-highlight {
      border-color: #63b3ed !important;
      box-shadow: 0 0 20px rgba(66, 153, 225, 0.5) !important;
    }
    
    .procedure-header {
      padding: 1rem;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .procedure-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .procedure-permalink {
      color: #4a5568;
      text-decoration: none;
      font-size: 0.9rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .procedure-permalink:focus,
    .procedure-permalink:focus-visible,
    .procedure-permalink:active {
      opacity: 1;
    }

    .procedure-permalink:focus-visible {
      outline: 2px solid #63b3ed;
      outline-offset: 2px;
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

    .tool-link.proxy-mode {
      border-left: 4px solid #f59e0b;
      background: #fffbeb;
    }

    .tool-link.proxy-mode:hover {
      background: #fef3c7;
      border-color: #d97706;
    }

    .tool-link small {
      color: #4a5568;
      font-size: 0.875rem;
    }

    /* MCP Tools Styles */
    .mcp-tools-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
    }

    .mcp-tool-item {
      padding: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
      transition: background-color 0.2s;
      cursor: pointer;
    }

    .mcp-tool-item:last-child {
      border-bottom: none;
    }

    .mcp-tool-item:hover {
      background: #edf2f7;
    }

    .mcp-tool-name {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
    }

    .mcp-tool-description {
      color: #4a5568;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    .mcp-badge {
      background: #4299e1;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.625rem;
      font-weight: bold;
      text-transform: uppercase;
      margin-left: 0.5rem;
    }

    .loading-placeholder {
      padding: 2rem;
      text-align: center;
      color: #718096;
      font-style: italic;
    }

    .error-placeholder {
      padding: 1rem;
      text-align: center;
      color: #e53e3e;
      background: #fed7d7;
      border-radius: 4px;
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
    ${serverStatusBanner}
  </div>

  <!-- Two column layout: MCP Tools on left, Development Tools on right -->
  <div class="main-content">
    <div class="left-panel">
      <h2>🔧 MCP Tools</h2>

      <div class="status-card">
        <h3>🛠️ Available Tools</h3>
        <div style="margin-bottom: 1rem;">
          <button onclick="refreshMCPTools()" class="copy-btn" style="background: #4299e1;">
            🔄 Refresh Tools
          </button>
          <span id="tools-status" style="margin-left: 0.5rem; color: #4a5568; font-size: 0.875rem;"></span>
        </div>
        <div id="mcp-tools-list" class="mcp-tools-container">
          <div class="loading-placeholder" style="text-align: center; padding: 2rem; color: #718096;">
            🔄 Loading MCP tools...
          </div>
        </div>
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
        <h3>🔧 Server Setup Status</h3>
        ${serverSetupStatusHTML}
      </div>
    </div>

    <div class="right-panel">
      <h2>🛠️ Development Tools</h2>

      <div class="tools-card">
        <h3>🎮 Interactive Playgrounds</h3>
        <div class="tool-links">
          <a href="${mcpJamEndpoint}" target="_blank" class="tool-link ${!mcpJamStatus.running ? 'disabled' : ''}">
            <strong>🎮 MCP JAM</strong><br>
            <small>${mcpJamStatus.running ? 'Model Context Protocol testing (auto-started)' : 'MCP JAM not available - install @mcpjam/inspector'}</small>
          </a>

          ${trpcPlaygroundHTML}
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

      <div class="tools-card">
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

      <div class="tools-card">
        <h3>ℹ️ Build Info</h3>
        <p><small>Generated from <code>dist/trpc-methods.json</code><br>
        ${new Date(generated).toLocaleString()}</small></p>
      </div>
    </div>
  </div>
  
  <div class="procedures">
    ${accordionHTML}
  </div>
  
  <script>
    // Configuration from server
    const serverConfig = {
      baseUrl: '${config.baseUrl}',
      endpoints: {
        mcp: '${config.endpoints.mcp}',
        tRpc: '${config.endpoints.tRpc}',
        jsonRpc: '${config.endpoints.jsonRpc}'
      }
    };
    const mcpToolIndex = ${serializedMcpToolIndex};
    const mcpToolIndexLower = Object.fromEntries(Object.entries(mcpToolIndex).map(([key, value]) => [key.toLowerCase(), value]));

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
      const header = content ? content.previousElementSibling : null;

      if (!content) {
        return;
      }

      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        if (arrow) {
          arrow.classList.add('rotated');
        }
        if (header && header.setAttribute) {
          header.setAttribute('aria-expanded', 'true');
        }
      } else {
        content.style.display = 'none';
        if (arrow) {
          arrow.classList.remove('rotated');
        }
        if (header && header.setAttribute) {
          header.setAttribute('aria-expanded', 'false');
        }
      }
    }

    // MCP Tools functionality
    async function refreshMCPTools() {
      const container = document.getElementById('mcp-tools-list');
      const status = document.getElementById('tools-status');

      // Show loading state
      container.innerHTML = '<div class="loading-placeholder">🔄 Loading MCP tools...</div>';
      status.textContent = 'Refreshing...';

      try {
        const response = await fetch(serverConfig.endpoints.mcp, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list'
          })
        });

        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'MCP request failed');
        }

        const tools = data.result?.tools || [];
        displayMCPTools(tools);
        status.textContent = \`\${tools.length} tools found - \${new Date().toLocaleTimeString()}\`;

      } catch (error) {
        console.error('Failed to fetch MCP tools:', error);
        container.innerHTML = \`
          <div class="error-placeholder">
            ❌ Failed to load MCP tools<br>
            <small>\${error.message}</small>
          </div>
        \`;
        status.textContent = 'Error - check console';
      }
    }

    function displayMCPTools(tools) {
      const container = document.getElementById('mcp-tools-list');

      if (tools.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">📭 No MCP tools available</div>';
        return;
      }

      const toolsHTML = tools.map(tool => \`
        <div class="mcp-tool-item" onclick="showToolDetails('\${tool.name}')">
          <div class="mcp-tool-name">
            \${tool.name}
            <span class="mcp-badge">MCP</span>
          </div>
          <div class="mcp-tool-description">
            \${tool.description || 'No description available'}
          </div>
        </div>
      \`).join('');

      container.innerHTML = toolsHTML;
    }

    function showToolDetails(toolName) {
      // Try to find the corresponding method by searching for the tool name
      const methodElement = findMethodByToolName(toolName);

      if (methodElement) {
        const anchorId = methodElement.dataset ? methodElement.dataset.anchor : null;
        focusProcedureElement(methodElement, anchorId || toolName, { skipHash: false });
      } else {
        // Fallback if method not found
        console.log(\`Could not find method for tool: \${toolName}\`);
        alert(\`Tool: \${toolName}\\n\\nUse the MCP Inspector or tRPC Playground to test this tool.\`);
      }
    }

    function findMethodByToolName(toolName) {
      if (!toolName) return null;

      const trimmed = toolName.trim();
      if (!trimmed) return null;

      const directMapping = mcpToolIndex[trimmed] || mcpToolIndexLower[trimmed.toLowerCase()];
      if (directMapping) {
        const mappedId = 'method-' + directMapping.replace(/\./g, '-');
        const mappedElement = document.getElementById(mappedId);
        if (mappedElement) {
          return mappedElement;
        }
      }

      const directAnchor = document.getElementById(trimmed);
      if (directAnchor) {
        const directProcedure = directAnchor.closest('.procedure');
        if (directProcedure) return directProcedure;
      }

      const lowerAnchor = document.getElementById(trimmed.toLowerCase());
      if (lowerAnchor) {
        const lowerProcedure = lowerAnchor.closest('.procedure');
        if (lowerProcedure) return lowerProcedure;
      }

      const fallbackId = 'method-' + trimmed.replace(/\./g, '-');
      const fallbackElement = document.getElementById(fallbackId);
      if (fallbackElement) {
        return fallbackElement;
      }

      const procedures = document.querySelectorAll('.procedure');
      for (const proc of procedures) {
        const nameElement = proc.querySelector('.procedure-name');
        if (nameElement && nameElement.textContent.includes(trimmed)) {
          return proc;
        }
      }

      return null;
    }

    function openAccordionForElement(element) {
      const content = element.closest('.accordion-content');
      if (content && content.style.display === 'none') {
        content.style.display = 'block';
        const namespace = content.id.replace('content-', '');
        const arrow = document.getElementById('arrow-' + namespace);
        if (arrow) {
          arrow.classList.add('rotated');
        }
        const accordionHeader = content.previousElementSibling;
        if (accordionHeader && accordionHeader.setAttribute) {
          accordionHeader.setAttribute('aria-expanded', 'true');
        }
      }
    }

    function focusProcedureElement(procedureElement, anchorId, options = {}) {
      if (!procedureElement) return;

      openAccordionForElement(procedureElement);

      const targetAnchor = anchorId ? document.getElementById(anchorId) : null;
      const scrollTarget = targetAnchor || procedureElement;

      scrollTarget.scrollIntoView({
        behavior: options.instant ? 'auto' : 'smooth',
        block: 'start',
        inline: 'nearest'
      });

      if (!options.skipHash && anchorId) {
        if (history.replaceState) {
          history.replaceState(null, '', '#' + anchorId);
        } else {
          window.location.hash = anchorId;
        }
      }

      if (!options.skipHighlight) {
        procedureElement.classList.add('procedure-highlight');
        setTimeout(() => {
          procedureElement.classList.remove('procedure-highlight');
        }, 2000);
      }
    }

    function handleHashNavigation(options = {}) {
      const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
      if (!rawHash) return;

      const anchorId = decodeURIComponent(rawHash);
      const anchorElement = document.getElementById(anchorId);
      if (!anchorElement) return;

      const procedureElement = anchorElement.closest('.procedure') || anchorElement;
      focusProcedureElement(procedureElement, anchorId, options);
    }

    // Auto-refresh MCP tools on page load
    document.addEventListener('DOMContentLoaded', function() {
      refreshMCPTools();
      if (window.location.hash) {
        setTimeout(() => handleHashNavigation({ instant: true, skipHash: true }), 150);
      }
    });

    window.addEventListener('hashchange', () => handleHashNavigation());
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

// Readiness endpoint for wait-on and other tools
let isReady = false;
app.get('/ready', (_, res) => {
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      message: 'All services are ready',
      timestamp: new Date().toISOString(),
      services: {
        devPanel: true,
        backendServer: true,
        mcpJam: mcpJamStatus.running
      }
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      message: 'Services are still starting up',
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, async () => {
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

  // Always check for readiness and provide signals
  const ready = await waitForServicesReady();
  if (ready) {
    isReady = true; // Set readiness flag for /ready endpoint
    console.log('READY'); // Signal for wait-on and other tools to detect readiness
  } else {
    console.log('NOT_READY'); // Signal for scripts to detect failure
    process.exit(1);
  }

  // Auto-open browser if enabled (after readiness check)
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

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down dev-panel...');

  if (mcpJamProcess) {
    console.log('🎮 Stopping MCP JAM...');
    mcpJamProcess.kill();
  }

  process.exit(0);
});

process.on('SIGTERM', () => {
  if (mcpJamProcess) {
    mcpJamProcess.kill();
  }
  process.exit(0);
});

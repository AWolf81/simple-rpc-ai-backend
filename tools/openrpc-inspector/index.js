#!/usr/bin/env node

/**
 * OpenRPC Inspector Server
 * 
 * Standalone web server that provides a browser-based interface for exploring
 * and testing OpenRPC/JSON-RPC APIs. Can be used as a development tool or
 * extracted as a separate npm package.
 * 
 * Usage:
 *   openrpc-inspector [options]
 * 
 * Options:
 *   --port, -p <port>        Inspector server port (default: 3002)
 *   --schema, -s <file>      OpenRPC schema file path (default: openrpc.json)
 *   --rpc-url, -r <url>      RPC server URL (default: http://localhost:8000/rpc)
 *   --help, -h               Show this help message
 * 
 * Examples:
 *   openrpc-inspector
 *   openrpc-inspector --port 3003 --schema ./api-schema.json
 *   openrpc-inspector --rpc-url https://api.example.com/rpc
 */

import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import TemplateEngine from './template-engine.js';

const __filename = fileURLToPath(import.meta.url);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 3002,
    schemaFile: 'openrpc.json',
    rpcUrl: 'http://localhost:8000/rpc'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        config.port = parseInt(nextArg) || config.port;
        i++;
        break;
      case '--schema':
      case '-s':
        config.schemaFile = nextArg || config.schemaFile;
        i++;
        break;
      case '--rpc-url':
      case '-r':
        config.rpcUrl = nextArg || config.rpcUrl;
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
OpenRPC Inspector Server v0.1.0

Usage: openrpc-inspector [options]

Options:
  --port, -p <port>        Inspector server port (default: 3002)
  --schema, -s <file>      OpenRPC schema file path (default: openrpc.json)
  --rpc-url, -r <url>      RPC server URL (default: http://localhost:8000/rpc)
  --help, -h               Show this help message

Examples:
  openrpc-inspector
  openrpc-inspector --port 3003 --schema ./api-schema.json
  openrpc-inspector --rpc-url https://api.example.com/rpc

Environment Variables:
  OPENRPC_PORT            Override default port
  OPENRPC_SCHEMA          Override default schema file
  OPENRPC_RPC_URL         Override default RPC URL
`);
        process.exit(0);
        break;
    }
  }

  // Environment variable overrides
  config.port = process.env.OPENRPC_PORT || config.port;
  config.schemaFile = process.env.OPENRPC_SCHEMA || config.schemaFile;
  config.rpcUrl = process.env.OPENRPC_RPC_URL || config.rpcUrl;

  return config;
}

const config = parseArgs();
const app = express();
const templateEngine = new TemplateEngine();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve OpenRPC schema
app.get('/openrpc.json', (req, res) => {
  try {
    const schemaPath = resolve(config.schemaFile);
    
    if (!existsSync(schemaPath)) {
      return res.status(404).json({ 
        error: 'Schema file not found', 
        path: config.schemaFile,
        resolvedPath: schemaPath,
        cwd: process.cwd()
      });
    }

    const schema = readFileSync(schemaPath, 'utf8');
    const parsedSchema = JSON.parse(schema);
    
    // Add server info if not present
    if (!parsedSchema.servers || parsedSchema.servers.length === 0) {
      parsedSchema.servers = [{
        name: "RPC Server",
        url: config.rpcUrl,
        description: "JSON-RPC server endpoint"
      }];
    }
    
    res.set('Content-Type', 'application/json');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.send(JSON.stringify(parsedSchema, null, 2));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to read schema file', 
      path: config.schemaFile,
      message: error.message 
    });
  }
});

// Main inspector interface
app.get('/', (req, res) => {
  const layoutData = {
    title: 'Home',
    showBackButton: false,
    headerStatus: 'Loading...',
    ...templateEngine.getCommonLayoutData(config)
  };
  
  const pageData = templateEngine.getCommonPageData(config);
  
  const html = templateEngine.render('index', pageData, layoutData);
  res.send(html);
});

// API endpoint to get method templates from OpenRPC schema
app.get('/api/templates', (req, res) => {
  try {
    const schemaPath = resolve(config.schemaFile);
    if (!existsSync(schemaPath)) {
      return res.status(404).json({ error: 'Schema file not found' });
    }

    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const templates = {};

    schema.methods?.forEach((method, index) => {
      const params = {};
      
      // Build params object from schema for our server (which expects objects)
      if (method.params && Array.isArray(method.params)) {
        method.params.forEach(param => {
          if (param.required) {
            // Use example value if available, otherwise generate based on type
            if (param.schema?.examples?.[0]) {
              params[param.name] = param.schema.examples[0];
            } else if (param.schema?.example) {
              params[param.name] = param.schema.example;
            } else {
              // Generate example based on schema type
              params[param.name] = generateExampleValue(param.schema);
            }
          }
        });
      }

      templates[method.name] = {
        jsonrpc: "2.0",
        method: method.name,
        params: params, // Keep as object for our server compatibility
        id: index + 1
      };
    });

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate templates', message: error.message });
  }
});

function generateExampleValue(schema) {
  if (!schema) return null;
  
  switch (schema.type) {
    case 'string':
      if (schema.enum) return schema.enum[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      return schema.minLength ? 'x'.repeat(schema.minLength) : 'example';
    case 'number':
    case 'integer':
      return schema.minimum || 0;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

// Test interface
app.get('/test', (req, res) => {
  const layoutData = {
    title: 'Test Interface',
    headerIcon: '🧪',
    headerTitle: 'JSON-RPC Test Interface',
    headerSubtitle: 'Interactive testing for your API methods',
    ...templateEngine.getCommonLayoutData(config)
  };
  
  const pageData = templateEngine.getCommonPageData(config);
  
  const html = templateEngine.render('test', pageData, layoutData);
  res.send(html);
});

// Documentation page
app.get('/docs', (req, res) => {
  const layoutData = {
    title: 'Documentation',
    headerIcon: '📚',
    headerTitle: 'Documentation',
    headerSubtitle: 'API documentation and usage guide',
    ...templateEngine.getCommonLayoutData(config)
  };
  
  const pageData = {
    serviceName: 'OpenRPC Inspector',
    version: '0.1.0',
    description: 'Interactive API explorer for OpenRPC/JSON-RPC services',
    uptime: Math.floor(process.uptime()),
    ...templateEngine.getCommonPageData(config)
  };
  
  const html = templateEngine.render('docs', pageData, layoutData);
  res.send(html);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'openrpc-inspector',
    version: '0.1.0',
    config: {
      port: config.port,
      schema: config.schemaFile,
      rpcServer: config.rpcUrl
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Inspector Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🔍 OpenRPC Inspector Server v0.1.0`);
  console.log(`📍 Running on: http://localhost:${config.port}`);
  console.log(`📄 Schema: ${config.schemaFile}`);
  console.log(`🚀 RPC Server: ${config.rpcUrl}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  • Inspector UI: http://localhost:${config.port}`);
  console.log(`  • Test Interface: http://localhost:${config.port}/test`);
  console.log(`  • Schema JSON: http://localhost:${config.port}/openrpc.json`);
  console.log(`  • Documentation: http://localhost:${config.port}/docs`);
  console.log(`  • Health Check: http://localhost:${config.port}/health`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down OpenRPC Inspector...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});
#!/usr/bin/env node
/**
 * Binary for generating tRPC methods in consuming projects
 *
 * This script generates trpc-methods.json based on the consuming project's
 * server configuration and environment variables.
 *
 * Usage:
 *   npx simple-rpc-gen-methods
 *   TRPC_GEN_AI_ENABLED=false npx simple-rpc-gen-methods
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the actual generator script (two levels up from tools/bin/)
const generatorScript = resolve(__dirname, '../generate-trpc-methods.js');

console.log('🔨 Simple RPC: Generating tRPC Methods');
console.log(`📍 Working Directory: ${process.cwd()}`);

// Pass through all environment variables
const env = { ...process.env };

// Log active configuration
const config = {
  AI: env.TRPC_GEN_AI_ENABLED ?? 'true',
  MCP: env.TRPC_GEN_MCP_ENABLED ?? 'true',
  'MCP AI': env.TRPC_GEN_MCP_AI_ENABLED ?? 'true',
  System: env.TRPC_GEN_SYSTEM_ENABLED ?? 'true',
  User: env.TRPC_GEN_USER_ENABLED ?? 'true',
  Billing: env.TRPC_GEN_BILLING_ENABLED ?? 'true',
  Auth: env.TRPC_GEN_AUTH_ENABLED ?? 'true',
  Admin: env.TRPC_GEN_ADMIN_ENABLED ?? 'true',
};

console.log('⚙️  Router Configuration:');
Object.entries(config).forEach(([name, value]) => {
  const status = value === 'true' ? '✅' : '❌';
  console.log(`   ${status} ${name}`);
});

if (env.TRPC_GEN_CUSTOM_ROUTERS) {
  console.log(`📦 Custom Routers: ${env.TRPC_GEN_CUSTOM_ROUTERS}`);
}

if (env.TRPC_GEN_NAMESPACE_WHITELIST) {
  console.log(`🔍 Namespace Whitelist: ${env.TRPC_GEN_NAMESPACE_WHITELIST}`);
}

// Run the generator
const result = spawnSync(process.execPath, [generatorScript], {
  stdio: 'inherit',
  env,
  cwd: process.cwd()
});

if (result.error) {
  console.error('❌ Failed to run generate-trpc-methods.js:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);

/**
 * Configuration file loader for .simplerpcaibackendrc
 *
 * Supports JSON configuration for:
 * - tRPC method generation
 * - Dev panel settings
 * - Server defaults
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface SimpleRPCConfig {
  trpcMethodGen?: {
    customRoutersPath?: string;
    enableAI?: boolean;
    enableMCP?: boolean;
    enableMCPAI?: boolean;
    enableSystem?: boolean;
    enableUser?: boolean;
    enableBilling?: boolean;
    enableAuth?: boolean;
    enableAdmin?: boolean;
    namespaceWhitelist?: string[];
  };
  devPanel?: {
    autoOpenBrowser?: boolean;
    port?: number;
    openPlayground?: boolean;
  };
  server?: {
    port?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  };
}

/**
 * Load configuration from .simplerpcaibackendrc file
 *
 * Searches for the config file in the following order:
 * 1. Current working directory
 * 2. Parent directories (up to root)
 *
 * @param startDir - Starting directory for search (defaults to process.cwd())
 * @returns Parsed configuration or empty object if no config file found
 */
export function loadRCConfig(startDir: string = process.cwd()): SimpleRPCConfig {
  const configFileName = '.simplerpcaibackendrc';
  let currentDir = startDir;
  const root = '/';

  // Search up the directory tree
  while (currentDir !== root) {
    const configPath = join(currentDir, configFileName);

    if (existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent) as SimpleRPCConfig;

        console.log(`📄 Loaded config from: ${configPath}`);
        return config;
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${configPath}:`, error instanceof Error ? error.message : error);
        return {};
      }
    }

    // Move up one directory
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }

  // No config file found
  return {};
}

/**
 * Merge RC config with environment variables
 * Environment variables take precedence over RC config
 */
export function mergeWithEnv(rcConfig: SimpleRPCConfig): SimpleRPCConfig {
  const merged: SimpleRPCConfig = { ...rcConfig };

  // tRPC Method Generation
  if (merged.trpcMethodGen) {
    // Environment variables override RC config
    if (process.env.TRPC_GEN_CUSTOM_ROUTERS) {
      merged.trpcMethodGen.customRoutersPath = process.env.TRPC_GEN_CUSTOM_ROUTERS;
    }
    if (process.env.TRPC_GEN_AI_ENABLED !== undefined) {
      merged.trpcMethodGen.enableAI = process.env.TRPC_GEN_AI_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_MCP_ENABLED !== undefined) {
      merged.trpcMethodGen.enableMCP = process.env.TRPC_GEN_MCP_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_MCP_AI_ENABLED !== undefined) {
      merged.trpcMethodGen.enableMCPAI = process.env.TRPC_GEN_MCP_AI_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_SYSTEM_ENABLED !== undefined) {
      merged.trpcMethodGen.enableSystem = process.env.TRPC_GEN_SYSTEM_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_USER_ENABLED !== undefined) {
      merged.trpcMethodGen.enableUser = process.env.TRPC_GEN_USER_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_BILLING_ENABLED !== undefined) {
      merged.trpcMethodGen.enableBilling = process.env.TRPC_GEN_BILLING_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_AUTH_ENABLED !== undefined) {
      merged.trpcMethodGen.enableAuth = process.env.TRPC_GEN_AUTH_ENABLED === 'true';
    }
    if (process.env.TRPC_GEN_ADMIN_ENABLED !== undefined) {
      merged.trpcMethodGen.enableAdmin = process.env.TRPC_GEN_ADMIN_ENABLED === 'true';
    }
  }

  // Dev Panel
  if (merged.devPanel) {
    if (process.env.DEV_PANEL_AUTO_OPEN !== undefined) {
      merged.devPanel.autoOpenBrowser = process.env.DEV_PANEL_AUTO_OPEN === 'true';
    }
    if (process.env.DEV_PANEL_PORT) {
      merged.devPanel.port = parseInt(process.env.DEV_PANEL_PORT, 10);
    }
  }

  // Server
  if (merged.server) {
    if (process.env.AI_SERVER_PORT) {
      merged.server.port = parseInt(process.env.AI_SERVER_PORT, 10);
    }
    if (process.env.LOG_LEVEL) {
      merged.server.logLevel = process.env.LOG_LEVEL as any;
    }
  }

  return merged;
}

/**
 * Apply RC config to environment variables
 * This allows existing code to use process.env
 */
export function applyToEnv(config: SimpleRPCConfig): void {
  if (config.trpcMethodGen) {
    const gen = config.trpcMethodGen;

    if (gen.customRoutersPath && !process.env.TRPC_GEN_CUSTOM_ROUTERS) {
      process.env.TRPC_GEN_CUSTOM_ROUTERS = gen.customRoutersPath;
    }
    if (gen.enableAI !== undefined && process.env.TRPC_GEN_AI_ENABLED === undefined) {
      process.env.TRPC_GEN_AI_ENABLED = String(gen.enableAI);
    }
    if (gen.enableMCP !== undefined && process.env.TRPC_GEN_MCP_ENABLED === undefined) {
      process.env.TRPC_GEN_MCP_ENABLED = String(gen.enableMCP);
    }
    if (gen.enableMCPAI !== undefined && process.env.TRPC_GEN_MCP_AI_ENABLED === undefined) {
      process.env.TRPC_GEN_MCP_AI_ENABLED = String(gen.enableMCPAI);
    }
    if (gen.enableSystem !== undefined && process.env.TRPC_GEN_SYSTEM_ENABLED === undefined) {
      process.env.TRPC_GEN_SYSTEM_ENABLED = String(gen.enableSystem);
    }
    if (gen.enableUser !== undefined && process.env.TRPC_GEN_USER_ENABLED === undefined) {
      process.env.TRPC_GEN_USER_ENABLED = String(gen.enableUser);
    }
    if (gen.enableBilling !== undefined && process.env.TRPC_GEN_BILLING_ENABLED === undefined) {
      process.env.TRPC_GEN_BILLING_ENABLED = String(gen.enableBilling);
    }
    if (gen.enableAuth !== undefined && process.env.TRPC_GEN_AUTH_ENABLED === undefined) {
      process.env.TRPC_GEN_AUTH_ENABLED = String(gen.enableAuth);
    }
    if (gen.enableAdmin !== undefined && process.env.TRPC_GEN_ADMIN_ENABLED === undefined) {
      process.env.TRPC_GEN_ADMIN_ENABLED = String(gen.enableAdmin);
    }
  }

  if (config.devPanel) {
    const panel = config.devPanel;

    if (panel.autoOpenBrowser !== undefined && process.env.DEV_PANEL_AUTO_OPEN === undefined) {
      process.env.DEV_PANEL_AUTO_OPEN = String(panel.autoOpenBrowser);
    }
    if (panel.port && !process.env.DEV_PANEL_PORT) {
      process.env.DEV_PANEL_PORT = String(panel.port);
    }
  }

  if (config.server) {
    const srv = config.server;

    if (srv.port && !process.env.AI_SERVER_PORT) {
      process.env.AI_SERVER_PORT = String(srv.port);
    }
    if (srv.logLevel && !process.env.LOG_LEVEL) {
      process.env.LOG_LEVEL = srv.logLevel;
    }
  }
}

#!/usr/bin/env node
/**
 * MCP Security Checker CLI
 *
 * Command-line tool to scan MCP server packages for security issues.
 *
 * Usage:
 *   npx ts-node src/tools/check-mcp-security.ts <package-name> [--type npx|uvx]
 *   npx ts-node src/tools/check-mcp-security.ts --config <config.json>
 *
 * Examples:
 *   npx ts-node src/tools/check-mcp-security.ts mcp-server-time --type uvx
 *   npx ts-node src/tools/check-mcp-security.ts @modelcontextprotocol/server-filesystem --type npx
 *   npx ts-node src/tools/check-mcp-security.ts --config claude_desktop_config.json
 */

import fs from 'fs';
import path from 'path';
import { scanMCPServerPackage, scanMCPServerConfig, formatScanResult, type MCPServerSecurityConfig } from '../security/mcp-server-scanner.js';

interface ClaudeDesktopConfig {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
}

async function scanSinglePackage(packageName: string, type: 'npx' | 'uvx') {
  console.log(`\n🔍 Scanning MCP server: ${packageName} (${type})\n`);

  const result = await scanMCPServerPackage(packageName, type);
  console.log(formatScanResult(result));

  if (result.level === 'RED') {
    console.log('\n⛔ RECOMMENDATION: Do not use this package without thorough manual review');
    process.exit(1);
  } else if (result.level === 'YELLOW') {
    console.log('\n⚠️  RECOMMENDATION: Review the flagged patterns before using');
    process.exit(0);
  } else {
    console.log('\n✅ RECOMMENDATION: Package appears safe to use');
    process.exit(0);
  }
}

async function scanConfigFile(configPath: string) {
  const fullPath = path.resolve(configPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Config file not found: ${fullPath}`);
    process.exit(1);
  }

  const configContent = fs.readFileSync(fullPath, 'utf-8');
  const config: ClaudeDesktopConfig = JSON.parse(configContent);

  if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
    console.log('ℹ️  No MCP servers configured in this file');
    process.exit(0);
  }

  console.log(`\n🔍 Scanning ${Object.keys(config.mcpServers).length} MCP server(s) from config\n`);

  let hasRed = false;
  let hasYellow = false;

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Server: ${name}`);
    console.log(`${'='.repeat(60)}`);

    const securityConfig: MCPServerSecurityConfig = {
      name,
      command: serverConfig.command as any,
      args: serverConfig.args
    };

    const result = await scanMCPServerConfig(securityConfig);
    console.log(formatScanResult(result));

    if (result.level === 'RED') {
      hasRed = true;
    } else if (result.level === 'YELLOW') {
      hasYellow = true;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log(`${'='.repeat(60)}\n`);

  if (hasRed) {
    console.log('⛔ Some servers have HIGH-RISK issues - manual review required');
    process.exit(1);
  } else if (hasYellow) {
    console.log('⚠️  Some servers have suspicious patterns - review recommended');
    process.exit(0);
  } else {
    console.log('✅ All servers appear safe to use');
    process.exit(0);
  }
}

function printUsage() {
  console.log(`
MCP Security Checker - Scan MCP server packages for security issues

Usage:
  check-mcp-security <package-name> --type <npx|uvx>
  check-mcp-security --config <config.json>

Examples:
  # Scan a Python MCP server
  check-mcp-security mcp-server-time --type uvx

  # Scan a Node.js MCP server
  check-mcp-security @modelcontextprotocol/server-filesystem --type npx

  # Scan all servers in a Claude Desktop config
  check-mcp-security --config ~/.config/claude/claude_desktop_config.json

Options:
  --type <npx|uvx>    Package manager type (required for single package scan)
  --config <path>     Path to Claude Desktop config file
  --help             Show this help message
  `);
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (args.includes('--config')) {
  const configIndex = args.indexOf('--config');
  const configPath = args[configIndex + 1];
  if (!configPath) {
    console.error('❌ Error: --config requires a file path');
    printUsage();
    process.exit(1);
  }
  scanConfigFile(configPath);
} else {
  const packageName = args[0];
  const typeIndex = args.indexOf('--type');

  if (typeIndex === -1) {
    console.error('❌ Error: --type is required for single package scan');
    printUsage();
    process.exit(1);
  }

  const type = args[typeIndex + 1] as 'npx' | 'uvx';

  if (!type || !['npx', 'uvx'].includes(type)) {
    console.error('❌ Error: --type must be either "npx" or "uvx"');
    printUsage();
    process.exit(1);
  }

  scanSinglePackage(packageName, type);
}

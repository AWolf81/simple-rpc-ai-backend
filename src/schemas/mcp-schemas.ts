/**
 * MCP Tool Schemas
 * 
 * Centralized schema definitions for MCP tools and procedures.
 * These schemas are reused across tRPC procedures and MCP tool registration.
 */

import { z } from 'zod';
import { input, defineSchema } from './schema-registry';

// ===== MCP Tool Schemas =====

/**
 * Greeting tool input schema
 */
export const greetingSchema = input(
  z.object({ 
    name: z.string().optional().default("World").describe("Name of the person to greet"),
    language: z.enum(["en", "es", "fr"]).optional().default("en").describe("Language for the greeting")
  }),
  'mcp.greeting'
);

/**
 * Echo tool input schema  
 */
export const echoSchema = input(
  z.object({
    message: z.string().describe("Message to echo back"),
    uppercase: z.boolean().optional().default(false).describe("Convert message to uppercase"),
    repeat: z.number().min(1).max(5).optional().default(1).describe("Number of times to repeat the message")
  }),
  'mcp.echo'
);

// Legacy exports for backwards compatibility
export const GREETING_SCHEMA_ID = 'mcp.greeting';
export const ECHO_SCHEMA_ID = 'mcp.echo';

// ===== MCP Service Schemas =====

/**
 * MCP server configuration schema
 */
export const serverConfigSchema = defineSchema(
  z.object({
    id: z.string().min(1).describe("Unique server identifier"),
    name: z.string().min(1).describe("Human-readable server name"),
    description: z.string().optional().describe("Server description"),
    type: z.enum(['stdio', 'http']).describe("Communication type"),
    command: z.string().optional().describe("Command to execute (stdio only)"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    url: z.string().url().optional().describe("HTTP endpoint URL"),
    headers: z.record(z.string()).optional().describe("HTTP headers"),
    timeout: z.number().positive().optional().describe("Request timeout in milliseconds"),
    retryAttempts: z.number().min(0).optional().describe("Number of retry attempts"),
    autoRestart: z.boolean().optional().describe("Auto-restart on failure"),
    enabled: z.boolean().optional().describe("Whether server is enabled")
  }),
  {
    id: 'mcp.serverConfig',
    name: 'MCP Server Configuration',
    description: 'Configuration schema for MCP server instances',
    category: 'mcp-service',
    example: {
      id: 'test-server',
      name: 'Test MCP Server',
      type: 'http' as const,
      url: 'http://localhost:3000/mcp'
    }
  }
);

/**
 * Tool execution schema
 */
export const toolExecutionSchema = defineSchema(
  z.object({
    name: z.string().min(1).describe("Name of the tool to execute"),
    arguments: z.record(z.any()).optional().describe("Tool arguments"),
    serverId: z.string().optional().describe("Specific server ID to use"),
    context: z.object({
      userId: z.string().optional().describe("User identifier"),
      requestId: z.string().optional().describe("Request tracking ID"),
      systemPrompt: z.string().optional().describe("System prompt context")
    }).optional().describe("Execution context")
  }),
  {
    id: 'mcp.toolExecution',
    name: 'Tool Execution Request',
    description: 'Schema for executing MCP tools with context',
    category: 'mcp-service',
    example: {
      name: 'greeting',
      arguments: { name: 'World', language: 'en' },
      context: { userId: 'user123' }
    }
  }
);

// ===== SDK Integration Schemas =====

/**
 * SDK tool execution schema
 */
export const sdkToolExecutionSchema = defineSchema(
  z.object({ 
    name: z.string().describe("Tool name"),
    args: z.record(z.any()).optional().describe("Tool arguments") 
  }),
  {
    id: 'mcp.sdkToolExecution',
    name: 'SDK Tool Execution',
    description: 'Schema for SDK-based tool execution',
    category: 'mcp-sdk',
    example: { name: 'greeting', args: { name: 'World' } }
  }
);

// Legacy exports for backwards compatibility
export const MCP_SERVER_CONFIG_SCHEMA_ID = 'mcp.serverConfig';
export const TOOL_EXECUTION_SCHEMA_ID = 'mcp.toolExecution';
export const SDK_TOOL_EXECUTION_SCHEMA_ID = 'mcp.sdkToolExecution';

// ===== Helper Functions =====

/**
 * Get all MCP tool schema IDs
 */
export function getMCPToolSchemas(): string[] {
  return [
    GREETING_SCHEMA_ID,
    ECHO_SCHEMA_ID
  ];
}

/**
 * Get all MCP service schema IDs
 */
export function getMCPServiceSchemas(): string[] {
  return [
    MCP_SERVER_CONFIG_SCHEMA_ID,
    TOOL_EXECUTION_SCHEMA_ID,
    SDK_TOOL_EXECUTION_SCHEMA_ID
  ];
}

/**
 * Get all MCP-related schema IDs
 */
export function getAllMCPSchemas(): string[] {
  return [
    ...getMCPToolSchemas(),
    ...getMCPServiceSchemas()
  ];
}
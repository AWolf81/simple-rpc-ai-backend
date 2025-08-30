#!/usr/bin/env node

/**
 * Standalone MCP Server Example using proper SDK approach
 * Based on https://modelcontextprotocol.io/quickstart/server#node
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "simple-rpc-ai-backend",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register greeting tool
server.tool("greeting", {
  description: "Generate a friendly greeting message",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the person to greet"
      },
      language: {
        type: "string",
        enum: ["en", "es", "fr"],
        description: "Language for the greeting"
      }
    },
    additionalProperties: false
  }
}, async ({ name = "World", language = "en" }) => {
  console.error(`🔧 Greeting tool called with: ${JSON.stringify({ name, language })}`);
  
  const greetings = {
    en: `Hello, ${name}! 👋`,
    es: `¡Hola, ${name}! 👋`,
    fr: `Bonjour, ${name}! 👋`
  };
  
  return {
    content: [{
      type: "text",
      text: greetings[language] || greetings.en
    }]
  };
});

// Register echo tool
server.tool("echo", {
  description: "Echo back the provided message with optional transformations",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Message to echo back"
      },
      uppercase: {
        type: "boolean",
        description: "Convert message to uppercase"
      },
      repeat: {
        type: "number",
        minimum: 1,
        maximum: 5,
        description: "Number of times to repeat the message"
      }
    },
    required: ["message"],
    additionalProperties: false
  }
}, async ({ message, uppercase = false, repeat = 1 }) => {
  console.error(`🔧 Echo tool called with: ${JSON.stringify({ message, uppercase, repeat })}`);
  
  let result = message;
  if (uppercase) {
    result = result.toUpperCase();
  }
  const repeated = Array(repeat).fill(result).join(' | ');
  
  return {
    content: [{
      type: "text",
      text: repeated
    }]
  };
});

// Connect server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`🤖 MCP server connected with greeting and echo tools`);
}

main().catch(console.error);
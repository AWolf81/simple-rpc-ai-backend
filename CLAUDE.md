# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview
Building a **Simple RPC AI Backend** that provides secure, platform-agnostic JSON-RPC communication for AI integration in VS Code extensions, web applications, and CLI tools. **System prompt protection and corporate proxy bypass are mission-critical** since this package enables AI-powered applications to work in enterprise environments while keeping proprietary prompts secure.

## Development Commands

### Key Commands
```bash
pnpm build && pnpm test:coverage && pnpm typecheck  # Build & validate
pnpm dev:docs             # Start server + panel + playground
pnpm test:coverage        # 80% threshold required
```

### Dev Panel Integration
```javascript
import { createServerWithDevPanel } from 'simple-rpc-ai-backend';
const server = await createServerWithDevPanel({
  serverConfig: { port: 8001 },
  devPanelConfig: { port: 8080, openBrowser: true }
});
```


## Architecture Overview

### Architecture
1. **JSON-RPC Client** - Platform-agnostic RPC client
2. **Express Server** - HTTP server with JSON-RPC endpoint and security
3. **Platform Extensions** - VS Code, web, CLI integrations

### System Prompt Protection Architecture

**Key Security Features**:
- System prompts server-side only (proxy bypass)
- Progressive auth: anonymous → OAuth → Pro
- AES-256-GCM encrypted API keys
- Works behind corporate firewalls


## Import Patterns


### tRPC Client Development (Recommended for TypeScript)
```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';

const client = createTypedAIClient({
  links: [
    httpBatchLink({ 
      url: 'http://localhost:8000/trpc',
      headers: { authorization: `Bearer ${authToken}` }
    })
  ]
});

// Full type safety - no 'as any' casts needed
await client.ai.health.query();
await client.ai.executeAIRequest.mutate({ content, systemPrompt });
await client.ai.configureBYOK.mutate({ provider, apiKey });
```

### Server Development
```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';
const server = createRpcAiServer({
  ai: {
    providers: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
      openai: { apiKey: process.env.OPENAI_API_KEY }
    }
  },

  // Server-managed directories (distinct from MCP client roots)
  serverWorkspaces: {
    project: {
      path: '/home/user/project',
      name: 'Project Files',
      readOnly: false
    },
    templates: {
      path: '/opt/templates',
      name: 'Server Templates',
      readOnly: true
    }
  },

  mcp: {
    enableMCP: true,
    ai: {
      enabled: true,                    // Enable AI-powered sampling tools
      useServerConfig: true,            // Use same providers as ai.generateText
      restrictToSampling: true          // Only sampling tools use AI (secure)
    }
  }
});
server.start();
```

### Custom Router Extension
```typescript
import { createRpcAiServer, router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

// Create custom router with MCP tools
const mathRouter = router({
  add: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'add',
        description: 'Add two numbers together',
        category: 'math',
        public: true
      })
    })
    .input(z.object({
      a: z.number(),
      b: z.number()
    }))
    .query(({ input }) => ({ result: input.a + input.b }))
});

const server = createRpcAiServer({
  customRouters: {
    math: mathRouter  // Merged with built-in namespaces
  }
});
```


## JSON-RPC Methods Available

The package provides these JSON-RPC methods:

### Core AI Methods
1. **`executeAIRequest`** - Execute AI request with system prompt protection
2. **`health`** - Check server health and availability

### Authentication Methods
3. **`initializeSession`** - Create device session for progressive auth
4. **`upgradeToOAuth`** - Upgrade to OAuth authentication
5. **`getAuthStatus`** - Get current authentication status
6. **`shouldSuggestUpgrade`** - Check if auth upgrade should be suggested

### Key Management Methods (BYOK)
**User Identification**: All key management methods use email addresses as user identifiers. Any valid email format works: `user@gmail.com`, `admin@company.com`, `developer@startup.io`, etc.

7. **`storeUserKey`** - Store encrypted API key for user
8. **`getUserKey`** - Retrieve user's API key
9. **`getUserProviders`** - Get configured providers for user
10. **`validateUserKey`** - Validate user's API key
11. **`rotateUserKey`** - Rotate user's API key
12. **`deleteUserKey`** - Delete user's API key

## Development URLs
- **Dev Panel**: `http://localhost:8080` - API explorer with MCP integration
- **tRPC Playground**: `http://localhost:8080/trpc` - Type-safe testing
- **MCP Inspector**: `http://localhost:8080/mcp` - Tool explorer
- **OpenRPC Playground**: `http://localhost:3000` - JSON-RPC testing

### MCP Development Workflow
1. Add `meta({ mcp: {...} })` to tRPC procedure
2. Visit `http://localhost:8080/mcp` for auto-discovery
3. Test with `tools/list` and `tools/call`

### AI-Free MCP Configuration
To use MCP without any AI interaction (automatically hides AI tools from MCP tools/list):
```typescript
const server = createRpcAiServer({
  mcp: {
    enableMCP: true,
    ai: {
      enabled: false          // Disables AI and automatically excludes AI tools from MCP
    }
  }
});
```
When `ai.enabled: false`, MCP clients only see non-AI tools (mcp.*, system.*, etc.) and cannot access any AI functionality.

## AI Provider Registry System

Uses `@anolilab/ai-model-registry` with intelligent curation:
- 1,700+ models from 33+ providers with automatic updates
- Smart curation extends registry with missing stable models
- Provider-specific handling (Google, Anthropic, OpenAI format conversion)
- Works offline with fallbacks

Registry tools: `pnpm registry:health`, `pnpm registry:check-updates`

## Testing

**Requirements**: 80% coverage, Node.js 22+, security-focused
**Test Types**: Unit, Integration, Security, Performance
**Run**: `pnpm test -- <filename>.test.ts`

### Known Issues
- `src/billing/opensaas-integration.ts`: TypeScript compilation errors
- `src/client.ts:398`: Replace demo hash with proper crypto
- Missing `rpc.discover` method implementation

## Platform Support
- **VS Code**: Primary target, progressive auth, server detection
- **Web**: Standard HTTP client, CORS support
- **CLI/Node.js**: Direct integration, full auth support

## Corporate Deployment
**Key Features**: Corporate proxy bypass, system prompt protection, zero client setup, centralized control
**Security**: AES-256-GCM encryption, progressive auth, session isolation

## MCP Integration: Dynamic tRPC Tool Exposure

### 🔀 MCP Roots vs Server Workspaces: Key Architecture Concepts

**Understanding the Distinction**: The Model Context Protocol separates client-managed roots from server-managed directories. This separation is crucial for proper MCP implementation and user control.

```
                  Model Context Protocol (MCP)

 ┌─────────────────────────────────────────────────────────────┐
 │                         CLIENT                              │
 │                                                             │
 │   User's local or mounted folders                           │
 │   (e.g. ~/projects, /mnt/shared/projectX)                   │
 │                                                             │
 │   • Client controls what to expose                          │
 │   • Advertises via MCP roots                                │
 │                                                             │
 │   roots/list  ────────────────────────────►                 │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
                 ▲
                 │
                 │ (MCP spec: server queries roots/list)
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                         SERVER                              │
 │                                                             │
 │   Server-managed directories                                │
 │   (e.g. /opt/templates, /srv/data, /home/server/project)    │
 │                                                             │
 │   • Configured in server config                             │
 │   • Exposed through tools (listFiles, readFile, etc.)       │
 │   • Not part of MCP roots                                   │
 │                                                             │
 │   serverWorkspaces / managedDirectories                     │
 │   (internal server concept)                                 │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

#### 🔑 Key Architectural Principles

**✅ MCP Roots (Client-Managed)**
- **Who owns it?** → The client
- **What for?** → To expose user-controlled locations (e.g. IDE workspace, local project folders)
- **How used?** → The server calls `roots/list` to discover what the client has exposed
- **Important** → The server should never configure or assume these; they are entirely under the user/client's control
- **MCP Spec Compliance** → Required part of the MCP spec to ensure servers ask users where they're allowed to operate
- **Capability Negotiation** → Client must advertise `{"roots": {"listChanged": true}}` during initialization
- **Error Handling** → Server returns `-32601 (Method not found)` if client doesn't support roots

**✅ Server Workspaces (Server-Managed)**
- **Who owns it?** → The server
- **What for?** → To expose the server's own resources (like `/opt/templates`, `/var/data`, `/home/server/project`)
- **How used?** → The server declares these in its own config and offers tools (`listFiles`, `readFile`) to interact with them
- **Important** → These are NOT MCP "roots" - they are a different concept because they don't come from the client

**🔀 Why They Must Be Kept Separate**
If you overload the word "roots" to mean both "client-exposed folders" and "server-exposed folders," it causes confusion:
- Clients will expect `roots/list` to reflect their workspace exposure
- But if a server stuffed its own folders in there, you'd mix two unrelated concerns

**📚 References**:
- [Model Context Protocol - Roots](https://modelcontextprotocol.io/docs/concepts/roots)
- [Complete Guide: Server Workspaces vs MCP Roots](./docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md)
- [Quick Reference: Workspace Concepts](./docs/WORKSPACE_QUICK_REFERENCE.md)

#### 🏷️ Configuration Example

```typescript
const server = createRpcAiServer({
  // Server-managed directories (not MCP roots)
  serverWorkspaces: {
    project: {
      path: '/home/user/project',
      name: 'Project Files',
      readOnly: false
    },
    templates: {
      path: '/opt/templates',
      name: 'Server Templates',
      readOnly: true
    }
  },

  // MCP roots are discovered dynamically via roots/list call to client
  mcp: {
    enableMCP: true,
    // Server will call client's roots/list to discover user workspaces
  }
});
```

### Model Context Protocol (MCP) Implementation Status: ✅ **COMPLETE**

**Current Status**: Full MCP server implementation with dynamic tRPC integration

### 🚀 Dynamic tRPC Method Handling for MCP Exposure

**Key Innovation**: tRPC procedures with `meta()` decorators are automatically exposed as MCP tools

#### **How to Add MCP Tools**
```typescript
// In any tRPC router - just add meta() with MCP information
newTool: publicProcedure
  .meta({
    mcp: {
      title: "Tool Name",
      description: "What this tool does",
      category: "utility"  // optional
    }
  })
  .input(z.object({ 
    param: z.string(),
    count: z.number().min(1).max(10)  // Validation constraints
  }))
  .mutation(async ({ input }) => {
    return `Result: ${input.param} (${input.count} times)`;
  })
```

#### **Automatic Discovery Process**
1. **Runtime Discovery**: Server scans all tRPC procedures for `meta.mcp` decorators
2. **Schema Generation**: Zod schemas → JSON Schema with full validation rules  
3. **Tool Registration**: Procedures become callable via MCP `tools/call`
4. **Validation Enforcement**: Input validation runs before execution

#### **Technical Implementation**
- **Discovery Method**: `discoverMCPToolsFromTRPC()` scans `router._def.procedures`
- **Schema Conversion**: Uses `zod-to-json-schema` for proper constraint handling
- **Execution Path**: `procedure._def.resolver()` with input validation
- **Error Handling**: Zod validation errors → proper MCP error responses

#### **MCP Protocol Endpoints**
```typescript
// All endpoints automatically available at /mcp
POST /mcp  // MCP HTTP transport
{
  "method": "tools/list",     // → Dynamic discovery from tRPC
  "method": "tools/call",     // → Execute with validation
  "method": "initialize"      // → MCP handshake
}
```

### 🔧 **MCP Server Configuration**
```typescript
const server = createRpcAiServer({
  mcp: {
    enableMCP: true,
    auth: {
      requireAuthForToolsList: false,   // tools/list public by default
      requireAuthForToolsCall: true,    // tools/call requires auth
      publicTools: ['greeting']          // Exception list
    }
  }
});
```

### 📋 **Current MCP Tools Available**
- **greeting**: Generate friendly greetings with language support
- **echo**: Message repetition with transformation options
- **All tools**: Automatically discovered from tRPC router metadata

### 🎯 **MCP Benefits Realized**
- ✅ **Direct AI Integration**: Claude, ChatGPT, Gemini can discover and use tools
- ✅ **Zero Configuration**: Just add `meta()` to tRPC procedures
- ✅ **Full Validation**: Zod constraints enforced (`min/max`, `enum`, `required`)
- ✅ **Type Safety**: End-to-end TypeScript support
- ✅ **Authentication**: JWT-based protection with configurable public tools
- ✅ **Schema Compliance**: Proper JSON Schema generation for AI consumption

### 🤖 **AI-Powered Sampling & Elicitation**

**Key Feature**: Real AI integration with secure defaults and explicit opt-in controls.

#### **AI Sampling Configuration**
```typescript
const server = createRpcAiServer({
  mcp: {
    enableMCP: true,
    ai: {
      enabled: true,                    // Enable AI for MCP sampling tools (disabled by default)
      useServerConfig: true,            // Use same providers as ai.generateText
      restrictToSampling: true,         // Only sampling tools use AI (recommended)
      allowByokOverride: false          // Server keys only (secure default)
    }
  }
});
```

#### **Built-in AI Tools**
- **`generateWithApproval`**: AI content generation with MCP sampling protocol
  - Secure: Disabled by default, shows configuration help when AI not enabled
  - Real AI: Uses AIService with Vercel AI SDK for actual generation
  - Fallback: Graceful error handling with helpful fallback messages
  - Security: Uses server-configured API keys, not BYOK by default

- **`requestElicitation`**: User input/decision workflow support
  - No AI required: Pure workflow orchestration tool
  - Validation: Full input validation for confirmation, choice, input, approval types
  - Workflow: Demonstrates MCP elicitation protocol patterns

#### **Security-First Design**
```typescript
// AI disabled by default - explicit opt-in required
mcp: {
  ai: {
    enabled: false  // Default: Shows configuration help instead of AI generation
  }
}

// When enabled - secure server configuration (default)
mcp: {
  ai: {
    enabled: true,                    // Explicitly enable AI features
    useServerConfig: true,            // Use same providers/keys as ai.generateText
    restrictToSampling: true,         // Only sampling tools get AI (not general tools)
    allowByokOverride: false          // Server manages API keys (no BYOK for MCP)
  }
}
```

#### **MCP-Specific Configuration (useServerConfig: false)**
```typescript
// Independent MCP AI configuration - separate from main server
const server = createRpcAiServer({
  // Main server AI configuration (e.g., for ai.generateText)
  ai: {
    providers: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-3-5-sonnet-20241022'] // Premium model
      }
    }
  },

  mcp: {
    enableMCP: true,
    ai: {
      enabled: true,
      useServerConfig: false,         // Don't inherit from main server config

      // MCP-specific providers with different keys/models
      mcpProviders: {
        anthropic: {
          apiKey: process.env.MCP_ANTHROPIC_KEY,  // Different API key
          enabled: true,
          priority: 1,
          models: ['claude-3-5-haiku-20241022']   // Budget model for MCP
        },
        openai: {
          apiKey: process.env.MCP_OPENAI_KEY,
          enabled: true,
          priority: 2,
          models: ['gpt-4o-mini']                 // Budget model
        }
      },

      // MCP-specific AI service configuration
      aiServiceConfig: {
        defaultProvider: 'anthropic',
        maxTokens: 500,                // Lower limits for MCP tools
        temperature: 0.1,              // More deterministic for tool usage
        systemPrompts: {
          'sampling': 'You are a helpful assistant for MCP sampling tasks.'
        }
      },

      // MCP-specific model restrictions
      modelRestrictions: {
        anthropic: {
          allowedModels: ['claude-3-5-haiku-20241022'],
          blockedModels: ['claude-3-5-sonnet-20241022'] // Block expensive models
        }
      },

      restrictToSampling: true,
      allowByokOverride: false
    }
  }
});
```

#### **Use Cases for useServerConfig: false**
- **Cost Control**: Use budget models (haiku, gpt-4o-mini) for MCP tools vs premium models for main AI
- **Different Keys**: Separate billing/usage tracking between main AI and MCP functionality
- **Model Restrictions**: Restrict MCP to specific models while allowing full access for main AI
- **Performance Tuning**: Different temperature/token limits optimized for tool usage vs content generation

### 🔄 **Integration Architecture**
```typescript
// Unified server supports all protocols simultaneously
app.post('/rpc', handleJSONRPC);     // AI backend protocol
app.post('/trpc', handleTRPC);       // TypeScript client protocol
app.post('/mcp', handleMCP);         // Model Context Protocol

// Tools defined once, available everywhere:
// - tRPC: mcp.generateWithApproval, mcp.requestElicitation
// - JSON-RPC: mcp.generateWithApproval, mcp.requestElicitation
// - MCP: generateWithApproval, requestElicitation (auto-discovered)
```

### 🔐 **Security Integration**
- **System Prompt Protection**: MCP tools don't expose internal prompts
- **Corporate Proxy Friendly**: Standard HTTPS, no special requirements
- **Progressive Auth**: Anonymous discovery → JWT authentication for execution
- **Input Validation**: All MCP tool calls validated against tRPC schemas

## Security & Development Guidelines

**Security**: System prompt protection, AES-256-GCM encryption, no hardcoded secrets, input validation, rate limiting
**Contributing**: Security review required, 80% test coverage, TypeScript strict mode, comprehensive tests
**Pre-PR**: `pnpm build && pnpm test:coverage && pnpm typecheck`

## Key Principles
**Security**: System prompt protection, progressive auth, corporate proxy bypass
**Platform**: VS Code (primary), web, CLI support
**Architecture**: JSON-RPC compliance, MCP integration

## Current Status: ✅ Core Complete
- JSON-RPC server, PostgreSQL billing, AI service integration (Anthropic, OpenAI, Google)
- Platform-agnostic client, TypeScript compilation (0 errors), core tests

## MCP Troubleshooting

**UI Controls Not Working**: MCP clients may not send parameter changes. Avoid `.optional().default()` - make params required, handle defaults in code.

**Tools Not Discovered**: Check `mcp: { enableMCP: true }`, ensure `.meta({ mcp: {...} })` present, verify build success.

**Tool Execution Fails**: Check server logs for Zod validation errors, test via tRPC directly.

**Testing**: Use dev panel at `http://localhost:8080/mcp` or direct curl to `/mcp` endpoint.

## Core Reminders
- **System Prompt Protection**: Non-negotiable, corporate-friendly architecture
- **Platform Agnostic**: VS Code, web, CLI support required
- **MCP Integration**: Dynamic tRPC → MCP tool exposure via `meta()` decorators
- **Parameter Design**: Avoid `.optional().default()` for user-controllable MCP parameters

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- ✅ **COMPLETED**: Add new JSON-RPC approach to memory - Implemented tRPC to JSON-RPC bridge extraction where JSON-RPC methods are dynamically extracted from tRPC methods, enabling dual protocol support on the same server
- ✅ **COMPLETED**: Comprehensive documentation of tRPC playground and MCP development panel
  - **Development Panel Suite**: Unified API explorer at `http://localhost:8080` with protocol integration
  - **tRPC Playground**: Type-safe testing with IntelliSense at `http://localhost:8080/api/trpc-playground`  
  - **MCP Jam Testing Tool**: Live MCP tool discovery and testing at `http://localhost:4000`
  - **Development Workflow**: 4-step process for adding and testing MCP tools
  - **Multi-Protocol Support**: tRPC, JSON-RPC, and MCP all accessible from one panel
- ✅ **COMPLETED**: Dynamic tRPC method handling for MCP exposure with metadata
  - **Key Feature**: tRPC procedures with `meta({ mcp: {...} })` automatically become MCP tools
  - **Discovery**: Runtime scanning of `router._def.procedures` for MCP metadata
  - **Validation**: Full Zod validation enforced via `inputParser.parse(args)`
  - **Schema**: Automatic Zod → JSON Schema conversion with constraints
  - **Execution**: Direct resolver calls with proper error handling
  - **Authentication**: JWT-based protection with configurable public tools
  - **Protocol**: Standard MCP HTTP transport at `/mcp` endpoint
- ✅ **COMPLETED**: Fixed all GitHub installation issues with comprehensive solution
  - **Problem 1**: `bcrypt` native module failed to build on Python 3.12+ due to missing `distutils`
  - **Solution 1**: Replaced `bcrypt` with pure JavaScript `bcryptjs` - no functionality loss
  - **Problem 2**: Missing JSON data files causing TypeScript build errors during postinstall
  - **Solution 2**: Fixed build order - assets copied **before** TypeScript compilation
  - **Problem 3**: Optional native dependencies (`cpu-features`, `ssh2`) causing install failures
  - **Solution 3**: Moved `@testcontainers/postgresql` to `optionalDependencies` + robust error handling
  - **Problem 4**: Build order issues in temporary GitHub install environment
  - **Solution 4**: Updated build script: `copy-assets → tsc → tsc-alias → build-methods`
  - **Benefits**: Zero native build dependencies, fault-tolerant asset copying, graceful optional deps
  - **Files Changed**: `package.json`, `src/services/APITokenManager.ts`, `.npmrc`, `scripts/safe-build.js`
  - **Requirements**: Node.js >=22.0.0 for tRPC compatibility
  - **Status**: GitHub installs now work reliably on all platforms with Python 3.8-3.13+
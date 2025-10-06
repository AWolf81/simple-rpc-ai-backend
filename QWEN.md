# QWEN.md

This file provides guidance to Qwen Code when working with code in this repository.

## Package Overview
Building a **Simple RPC AI Backend** that provides secure, platform-agnostic JSON-RPC communication for AI integration in VS Code extensions, web applications, and CLI tools. **System prompt protection and corporate proxy bypass are mission-critical** since this package enables AI-powered applications to work in enterprise environments while keeping proprietary prompts secure.

## Development Commands

### Building & Testing
```bash
pnpm build                 # Compile TypeScript
pnpm dev                   # Start development server
pnpm test                  # Run test suite with Vitest
pnpm test:coverage         # Run tests with coverage (80% threshold required)
pnpm test:watch           # Watch mode for development
pnpm test:ui              # Interactive test UI
pnpm typecheck            # TypeScript type checking
pnpm clean                # Remove dist and coverage directories
```

### Development Server
```bash
pnpm dev                  # Compile TypeScript in watch mode
pnpm dev:server           # Start basic server example with watch
pnpm dev:panel            # Start custom API explorer on port 8080
pnpm dev:full             # Start all three: compiler + server + panel

# Alternative server examples
node examples/servers/basic-server.js      # Basic server example
node examples/servers/ai-server-example.js # Full AI server example
```

### API Documentation Commands
```bash
pnpm docs                 # Start custom API explorer (same as dev:panel)
pnpm docs:playground      # Start local OpenRPC playground
pnpm docs:local           # Start panel + local OpenRPC playground
pnpm dev:docs             # Complete setup: server + panel + OpenRPC playground
```

### Dev Panel Integration for Package Consumers

**Option 1: Add to your package.json scripts**
```json
{
  "scripts": {
    "dev:panel": "node -e \"import('simple-rpc-ai-backend').then(pkg => pkg.startDevPanel({ port: 8080, openBrowser: true, serverUrl: 'http://localhost:8001' }))\"",
    "dev:server": "node your-server.js",
    "dev:full": "concurrently \"npm run dev:server\" \"npm run dev:panel\""
  },
  "devDependencies": {
    "concurrently": "^7.0.0"
  }
}
```

**Option 2: Integrated server approach**
```javascript
// your-server.js
import { createServerWithDevPanel } from 'simple-rpc-ai-backend';

const server = await createServerWithDevPanel({
  serverConfig: {
    port: 8001,
    // ... your server configuration
  },
  devPanelConfig: {
    port: 8080,
    openBrowser: process.env.NODE_ENV === 'development'
  }
});
```

**Option 3: Standalone dev panel**
```javascript
// dev-panel.js
import { startDevPanel, checkDevPanelRunning } from 'simple-rpc-ai-backend';

// Check if panel is already running
if (!(await checkDevPanelRunning(8080))) {
  await startDevPanel({
    port: 8080,
    serverUrl: 'http://localhost:8001',  // Your server URL
    openBrowser: true,
    features: {
      tRpcPlayground: true,
      mcpInspector: true,
      apiExplorer: true
    }
  });
}
```


## Architecture Overview

### Core Components

**Three-tier platform-agnostic architecture**:

1. **JSON-RPC Client** (`src/client.ts`) - Platform-agnostic RPC client using `json-rpc-2.0` library
2. **Express Server** (`src/server.ts`) - HTTP server with JSON-RPC endpoint and security middleware
3. **Platform Extensions** - Application-specific extensions (VS Code, web, CLI)

### System Prompt Protection Architecture

**Corporate-Friendly Design**:
- System prompts stored server-side only
- Corporate proxies see user code, not proprietary prompts
- Zero client configuration required
- Works behind corporate firewalls

**Security Implementation**:
- **Transport**: Standard HTTPS (no custom encryption needed)
- **Authentication**: Progressive (anonymous → OAuth → Pro)
- **Key Management**: AES-256-GCM encrypted API keys
- **Session Management**: Device-based with secure cleanup

### File Structure

```
src/
├── client.ts             # Platform-agnostic JSON-RPC client
├── server.ts             # Express server with JSON-RPC endpoint
├── services/
│   ├── ai-service.ts     # Multi-provider AI integration
│   └── ai-validator.ts   # API key validation
├── auth/
│   ├── auth-manager.ts   # Progressive authentication
│   ├── user-manager.ts   # User persistence
│   └── key-manager.ts    # Encrypted key storage
├── database/
│   └── sqlite-adapter.ts # Database abstraction
└── index.ts              # Main exports
```

## Import Patterns

### JSON-RPC Client Development
```typescript
import { RPCClient } from 'simple-rpc-ai-backend';
const client = new RPCClient('http://localhost:8000');
const result = await client.request('ai.generateText', { content, systemPrompt });
```

### Enhanced Client with Authentication
```typescript
import { AIClient } from 'simple-rpc-ai-backend';
const client = new AIClient(
  { baseUrl: 'http://localhost:8000' },
  deviceInfo
);
await client.initialize();
const result = await client.generateText(content, systemPrompt);
```

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
await client.ai.generateText.mutate({ content, systemPrompt });
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

### Development Panel Integration
```typescript
import { createServerWithDevPanel } from 'simple-rpc-ai-backend';

// Start server with integrated development panel
const server = await createServerWithDevPanel({
  serverConfig: { /* your server config */ },
  devPanelConfig: {
    port: 8080,
    openBrowser: true
  }
});
```

## JSON-RPC Methods Available

The package provides these JSON-RPC methods:

### Core AI Methods
1. **`ai.generateText`** - Execute AI request with system prompt protection
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

## API Documentation & Testing

### 🚀 Interactive Development Panel & Playground Suite

#### **Complete Development Environment**
```bash
# 🎯 RECOMMENDED: Start everything at once
pnpm dev:docs             # Starts server + custom panel + OpenRPC playground

# 🔧 Individual components (for focused development)
pnpm dev:server           # Start server only (port 8000)
pnpm docs                 # Start custom panel only (port 8080)  
pnpm docs:playground      # Start local OpenRPC playground (port 3000)
```

#### **🌐 Development URLs**
| Service | URL | Purpose |
|---------|-----|---------|
| **Custom Dev Panel** | `http://localhost:8080` | 📋 Unified API explorer with MCP integration |
| **OpenRPC Playground** | `http://localhost:3000` | 🔍 Interactive JSON-RPC testing |
| **tRPC Playground** | `http://localhost:8080/trpc` | ⚡ Type-safe tRPC procedure testing |
| **MCP Inspector** | `http://localhost:8080/mcp` | 🤖 Model Context Protocol tool explorer |
| **Server Health** | `http://localhost:8000/health` | ❤️ Server status and configuration |

### 🎛️ **Custom Development Panel Features**

**Primary Panel** (`http://localhost:8080`):
- 📋 **Complete Procedure Documentation**: All 37+ tRPC procedures with descriptions
- 🔗 **Protocol Integration Links**: Direct navigation to tRPC/MCP/OpenRPC tools
- 📝 **Multi-Protocol Examples**: curl examples for tRPC, JSON-RPC, and MCP calls
- 🎯 **Parameter Specifications**: Type validation and constraint information
- 🔍 **Live Schema Access**: Links to `http://localhost:8000/openrpc.json`

**MCP Integration Panel** (`http://localhost:8080/mcp`):
- 🤖 **MCP Tool Discovery**: Live view of auto-discovered tRPC tools with MCP metadata
- 🛠️ **Tool Schema Inspection**: JSON schemas generated from Zod validators
- 🧪 **MCP Protocol Testing**: Direct MCP tool/call execution with validation
- ⚡ **Dynamic Updates**: Automatically refreshes when new tools are added via `meta()`

### ⚡ **tRPC Playground Integration**

**Advanced tRPC Testing** (`http://localhost:8080/trpc`):
- 🎯 **Type-Safe Testing**: Full TypeScript IntelliSense for all procedures
- 🔄 **Real-Time Validation**: Input validation with Zod schema enforcement
- 📊 **Response Inspection**: Formatted JSON responses with type information
- 🔗 **MCP Cross-Reference**: Links to MCP versions of procedures with `meta.mcp`
- 🛡️ **Authentication Testing**: JWT token support for protected endpoints

**Supported Procedure Types**:
- ✅ **Queries**: `ai.health`, `mcp.listTools`, `ai.listProviders` (23 total)
- ✅ **Mutations**: `ai.generateText`, `mcp.echo`, `ai.configureBYOK` (14 total)
- ✅ **MCP Tools**: Auto-discovered from `meta({ mcp: {...} })` decorators

### 🔍 **OpenRPC Playground Integration**

**Standards-Based Testing** (`http://localhost:3000`):
- 📜 **Schema URL**: `http://localhost:8000/openrpc.json` (auto-loaded)
- 🧪 **JSON-RPC 2.0 Testing**: Direct method invocation with parameter validation
- 📋 **Method Discovery**: All available RPC methods with documentation
- 🔄 **Bi-Directional Sync**: Changes reflected across all development tools

### 🤖 **MCP Protocol Development**

**Model Context Protocol Support**:
- 🚀 **Dynamic Tool Discovery**: tRPC procedures with MCP metadata automatically exposed
- 📝 **Interactive Testing**: `tools/list` and `tools/call` directly from the panel
- 🔐 **Authentication Testing**: JWT-based tool access with configurable public tools
- ⚡ **Live Updates**: New tools appear immediately when added to tRPC routers
- 🛠️ **Schema Validation**: Full Zod constraint enforcement in MCP calls

**MCP Development Workflow**:
1. Add `meta({ mcp: {...} })` to any tRPC procedure
2. Visit `http://localhost:8080/mcp` to see auto-discovery
3. Test `tools/list` and `tools/call` directly from the panel
4. Validate schemas and authentication in real-time

## AI Provider Registry System

### How It Works

The system uses `@anolilab/ai-model-registry` for **live model data** with intelligent provider-specific curation:

- ✅ **Zero Configuration** - Works immediately after install
- ✅ **Live Data** - 1,700+ models from 33+ providers  
- ✅ **Automatic Updates** - Always current models and pricing
- ✅ **Intelligent Fallbacks** - Works offline with built-in model data
- ✅ **Corporate Friendly** - No network requirements for basic functionality
- ✅ **Smart Curation** - Extends registry with missing stable models and deprecated model handling

### Registry Curation & Extension

The system intelligently extends external registry data to ensure production-ready model selection:

#### **Google Provider Curation**

```typescript
// Automatic curation handles missing stable models
const registry = new ModelRegistry({
  serviceProviders: ['google'],
  byokProviders: ['google']
});

// Registry may only have: gemini-2-0-flash-exp (experimental)
// Curation automatically adds: gemini-2.0-flash (stable equivalent)
// Default selection: gemini-2.0-flash (stable prioritized over experimental)
```

**How Google curation works:**
1. **Extends Missing Models**: Adds stable `gemini-2.0-flash` when registry only has experimental `gemini-2-0-flash-exp`
2. **Prioritizes Stability**: Stable models get higher priority than experimental ones
3. **Preserves User Choice**: User-specified models (including experimental) pass through unchanged
4. **Handles Deprecation**: Legacy models like `gemini-1.5-flash` are deprioritized but still available

#### **Anthropic Provider Extension**

```typescript
// Anthropic requires ID format conversion from registry to SDK format
// Registry: "claude-sonnet-3-5" + "2024-10-22" 
// SDK: "claude-3-5-sonnet-20241022"
```

#### **OpenAI Provider Curation**

```typescript
// OpenAI uses external curation file to exclude deprecated models
// Registry: All OpenAI models including deprecated ones
// Curated: Only chat-compatible, supported models
```

### Provider Extension

```typescript
import { ModelRegistry } from 'simple-rpc-ai-backend';

// Add custom providers with automatic curation
const registry = new ModelRegistry({
  serviceProviders: ['anthropic', 'openai', 'google', 'custom-ai'],
  byokProviders: ['anthropic', 'openai', 'google', 'custom-ai'],
  enablePriceUpdates: true,
  validationMode: 'warn'
});

// Override pricing for contract rates
registry.addPricingOverride({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  pricing: { input: 1.0, output: 5.0 },
  reason: 'Enterprise contract pricing'
});
```

### Handling Outdated Registry Information

**Problem**: External registries may lag behind provider changes or lack stable model variants.

**Solution**: Provider-specific curation that extends and corrects registry data:

#### **Missing Stable Models**
```typescript
// Registry only has: gemini-2-0-flash-exp
// System adds: gemini-2.0-flash (stable equivalent)
// Default becomes: gemini-2.0-flash (works with APIs)
```

#### **Deprecated Models**
```typescript
// Registry includes: gemini-1.5-flash (deprecated/offline)
// System: Deprioritizes in default selection but preserves for user choice
// Fallback: Uses gemini-2.0-flash instead of deprecated models
```

#### **Format Incompatibilities**  
```typescript
// Registry: "claude-sonnet-3-5" (simplified format)
// SDK needs: "claude-3-5-sonnet-20241022" (full format with date)
// System: Auto-converts using release date from registry
```

#### **User Choice Preservation**
```typescript
// User requests: gemini-2-0-flash-exp (experimental)
// System: Preserves user choice exactly - no automatic conversion
// User requests: "default" or undefined
// System: Uses curated stable model selection
```

### Available Registry Tools

```bash
pnpm registry:health        # Check current registry status
pnpm registry:check-updates # Check for new models and pricing
```

**Registry Status Example:**
- ✅ **Status**: HEALTHY (33 providers, 1727+ models)  
- ✅ **Providers**: Anthropic (10), OpenAI (20), Google (50), OpenRouter (333+)
- ✅ **Performance**: <100ms response time
- ✅ **Features**: Real-time model availability, pricing data, capability filtering

## Testing Standards

### Coverage Requirements
- **Minimum 80% coverage** across branches, functions, lines, statements
- **Cross-platform testing** on Node.js 22+
- **Security-focused tests** for authentication and key management
- **Integration tests** for complete AI request workflows

### Test Categories
- **Unit Tests**: JSON-RPC client, AI service, authentication logic
- **Integration Tests**: End-to-end server testing, VS Code extension integration
- **Security Tests**: Authentication flows, key encryption, session management
- **Performance Tests**: AI requests must complete <30s, auth <200ms

### Running Specific Tests
```bash
pnpm test -- client.test.ts        # JSON-RPC client tests
pnpm test -- server.test.ts        # Server integration tests
pnpm test -- auth.test.ts          # Authentication tests
pnpm test -- ai-service.test.ts    # AI provider tests
```

### Known Issues & TODOs

**High Priority Issues**:
- `src/billing/opensaas-integration.ts`: 6 TypeScript compilation errors (incomplete module)
- `src/client.ts:398`: Replace demo hash function with proper crypto (SHA-256)
- Missing `rpc.discover` method implementation (currently falls back to `/config`)

**Medium Priority**:
- Add comprehensive input validation for all RPC methods
- Implement database migration system with versioning
- Standardize error response format across all endpoints
- Add performance monitoring and metrics

## Platform-Specific Notes

### VS Code Extensions
- **Primary target platform** - receives most testing and features
- **Progressive authentication** integrates with VS Code auth API
- **Server detection** automatically discovers backend capabilities
- **Context-aware implementation** with VS Code extension lifecycle

### Web Applications
- **Standard HTTP client** works in all browsers
- **CORS support** for cross-origin requests
- **No VS Code dependencies** in core client

### CLI Tools and Node.js
- **Direct integration** with Node.js applications
- **Server-side usage** for backend services
- **Full authentication flow** support

## Corporate Deployment

### Enterprise Features
- **Corporate proxy bypass** - AI requests route through your backend
- **System prompt protection** - Proprietary prompts never leave your server
- **Zero client setup** - Users don't configure API keys
- **Centralized control** - Update prompts without extension updates

### Security Properties
- ✅ **Corporate proxies see user code only** (not system prompts)
- ✅ **VS Code extensions never access plaintext prompts**
- ✅ **Encrypted API key storage** with AES-256-GCM
- ✅ **Progressive authentication** (anonymous → OAuth → Pro)
- ✅ **Session isolation** with automatic cleanup

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
- **Schema Conversion**: Uses Zod's built-in `z.toJSONSchema` for proper constraint handling
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
    useServerConfig: true,            // Use same providers as ai.generateText
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

## Security Guidelines

### System Prompt Protection
- **Never expose prompts** client-side or in network traffic
- **Server-side storage only** for all proprietary prompts
- **Corporate network isolation** - proxies never see your IP
- **Defense in depth** - multiple layers protect valuable prompts

### API Key Management
- **Encrypt at rest** using AES-256-GCM with master key
- **Never log decrypted keys** in any environment
- **Automatic cleanup** of sensitive data in memory
- **User-controlled** - users can bring their own keys (BYOK)

### Development Security
- **No hardcoded secrets** in code or configuration
- **Input validation** on all JSON-RPC method parameters
- **SQL injection prevention** with parameterized queries
- **Rate limiting** and DOS protection

## Contributing Guidelines

### Security-First Development
1. **Security review required** for all authentication and key management changes
2. **Test coverage must remain ≥80%** after changes
3. **No performance regressions** for AI request workflows
4. **Cross-platform compatibility** must be maintained

### Code Standards
- **TypeScript strict mode** - no `any` types in production code
- **Follow established patterns** in JSON-RPC implementations
- **Document security implications** of all changes
- **Include comprehensive tests** for new JSON-RPC methods

### Before Submitting PRs
```bash
pnpm build && pnpm test:coverage && pnpm typecheck
```

All checks must pass with ≥80% coverage maintained.

## Auto-Response Workflow

When feature planning is detected, assess:

1. **Security Impact**: Does it affect system prompt protection or key management?
2. **Platform Compatibility**: Will it work across VS Code, web, and CLI?
3. **Corporate Friendliness**: Does it maintain proxy bypass capabilities?
4. **JSON-RPC Compliance**: Does it follow our established RPC patterns?

## Smart Context Rules

### Always Generate Specs For:
- New JSON-RPC methods or protocol changes
- Authentication and authorization mechanisms
- AI provider integration points
- System prompt handling modifications
- Key management functionality

### Ask Before Generating For:
- Bug fixes (unless affecting security)
- Minor utility functions
- Documentation updates
- Performance optimizations (non-security related)

### Required Clarifying Questions:
When generating specs, always ask:
1. "What JSON-RPC methods are involved?"
2. "How does this protect system prompts in corporate environments?"
3. "What authentication/authorization is required?"
4. "How does this work across VS Code, web, and CLI platforms?"
5. "Are there any corporate proxy bypass implications?"
6. "What AI providers or external systems are involved?"

## JSON-RPC Security Principles

### Core Security Requirements:
- **Standard HTTPS Transport**: No custom encryption protocols needed
- **System Prompt Isolation**: Prompts never leave server environment  
- **Progressive Authentication**: Anonymous → OAuth → Pro upgrade path
- **Encrypted Key Storage**: AES-256-GCM for user API keys
- **Corporate Proxy Bypass**: Architecture enables enterprise deployment

### Platform-Specific Security:
- **VS Code Extensions**: Thin client, all crypto on server
- **Web Applications**: Standard CORS and HTTPS
- **CLI Tools**: Direct secure communication
- **Corporate Networks**: Proxy-friendly, prompt-protecting architecture

## Project Structure
```
project/
├── src/                   # Main source code
├── docker/                # Docker infrastructure and scripts
│   ├── setup-postgres.sh        # PostgreSQL setup script
│   └── init-db.sql              # Database initialization
├── examples/
│   ├── servers/           # Server implementation examples
│   ├── extensions/        # VS Code extension examples
│   └── web-ui/           # Web application examples
├── test/                 # Test suites
├── dev-panel.js          # Custom API explorer for development
├── local-openrpc-tools.js # Local OpenRPC inspector and playground servers
├── CLAUDE.md             # Claude-specific documentation
├── QWEN.md               # Qwen-specific documentation
└── README.md             # User-facing documentation
```

## Implementation Status Tracking

### Status Definitions:
- **📝 Draft**: Initial spec, needs refinement
- **🔍 Planning**: Spec complete, ready for implementation planning
- **⚡ In Progress**: Currently being implemented
- **👀 Review**: Implementation complete, needs code review
- **🧪 Testing**: In testing phase (unit, integration, security tests)
- **✅ Complete**: Fully implemented, tested, and deployed
- **🚫 Blocked**: Cannot proceed due to dependencies or issues
- **❄️ On Hold**: Temporarily paused
- **🗑️ Cancelled**: No longer needed

### Current Package Status: **✅ Core Complete - Simplified Architecture**
- **Simple JSON-RPC server**: ✅ Complete (`createSimpleAIServer`)
- **PostgreSQL billing integration**: ✅ Complete (token tracking for OpenSaaS)
- **AI service integration**: ✅ Complete (Anthropic, OpenAI, Google)
- **Platform-agnostic client**: ✅ Complete
- **TypeScript compilation**: ✅ Complete (0 errors)
- **Core tests**: ✅ Complete (simple server tested)
- **Complex server**: 🗑️ Deprecated (use simple server instead)

## MCP Troubleshooting Guide

### **Issue: MCP UI Controls Show But Arguments Not Sent**

**Problem**: MCP clients like MCP Jam show UI controls (toggles, inputs) but changing them has no effect on the server.

**Symptoms**:
- UI control appears (toggle, dropdown, text input)
- Changing the control value doesn't affect tool execution
- Server logs show same arguments regardless of UI changes
- Tool always behaves as if default values are used

**Root Cause**: MCP clients like MCP Jam have known bugs with parameter UI controls where the UI shows controls but doesn't send the user's input to the server.

**Debug Steps**:

1. **Check Server Logs** for the exact MCP request:
```bash
# Look for logs like:
📡 MCP Request: {
  "method": "tools/call",
  "params": { 
    "name": "toolName",
    "arguments": { "param": "value" }  // ← Check if arguments are present
  }
}
```

2. **Compare Working vs Broken Tools**:
```typescript
// Tools that work usually have required parameters:
calculate: publicProcedure
  .input(z.object({
    expression: z.string().min(1)  // ✅ Required - MCP sends arguments
  }))

// Tools that don't work often have optional-only parameters:
status: publicProcedure
  .input(z.object({
    detailed: z.boolean().optional().default(false)  // ❌ MCP may skip arguments
  }))
```

3. **Fix: Make Parameters Required in Schema**:
```typescript
// Instead of optional with defaults:
status: publicProcedure
  .input(z.object({
    detailed: z.boolean().optional().default(false)  // ❌ Arguments skipped
  }))

// Make required, handle defaults in code:
status: publicProcedure  
  .input(z.object({
    detailed: z.boolean().describe('Include detailed information?')  // ✅ Forces arguments
  }))
  .query(({ input }) => {
    const detailed = input.detailed ?? false;  // Handle missing in code
  })
```

**Solution**: Avoid `.optional().default()` patterns for user-controllable parameters. Make them required in the schema and handle missing values in your application logic.

**Workarounds**:

1. **Direct API Testing** (Most reliable):
```bash
# Test status basic mode
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "status", "arguments": {"mode": "basic"}}}'

# Test status detailed mode  
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "status", "arguments": {"mode": "detailed"}}}'
```

2. **Alternative MCP Clients**: Try different MCP clients that handle parameters correctly
3. **Development Panel**: Use `http://localhost:8080/mcp` for parameter testing

### **Issue: MCP Tools Not Discovered**

**Problem**: tRPC procedures not appearing in `tools/list`.

**Check**:
1. **MCP enabled**: `mcp: { enableMCP: true }` in server config
2. **Metadata present**: Procedure has `.meta({ mcp: { description: '...' } })`
3. **Server logs**: Look for "Auto-discovered tools from tRPC procedures" message
4. **Build status**: Ensure `pnpm build` completes without errors

### **Issue: MCP Tool Execution Fails**

**Problem**: `tools/call` returns validation errors.

**Debug Steps**:
1. Check server logs for Zod validation errors
2. Verify input schema matches the arguments sent
3. Test the same procedure via tRPC directly
4. Check for parameter name mismatches

## Communication Guidelines
- Be proactive about detecting JSON-RPC and AI integration planning
- Always consider corporate proxy bypass and system prompt protection
- Focus on platform-agnostic solutions that work across environments
- Ask clarifying questions about enterprise security requirements
- Provide realistic effort estimates including security implementation time
- Consider MCP compatibility for future-proofing when relevant

## Package-Specific Reminders
- **System Prompt Protection is Non-Negotiable**: Corporate-friendly architecture required
- **Platform Agnostic**: Must work in VS Code, web, and CLI environments
- **JSON-RPC Standard Compliance**: Follow RFC 7231 and json-rpc-2.0 library patterns
- **Progressive Authentication**: Support anonymous → OAuth → Pro upgrade flows
- **Security First**: All authentication and key management must be production-ready
- **MCP Integration**: Dynamic tRPC → MCP tool exposure with `meta()` decorators is core feature
- **Dynamic Discovery**: All tRPC procedures with MCP metadata automatically become AI-accessible tools
- **Validation Enforcement**: Zod schemas must be properly validated for all MCP tool calls
- **Parameter Design**: Avoid `.optional().default()` for user-controllable parameters in MCP tools

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

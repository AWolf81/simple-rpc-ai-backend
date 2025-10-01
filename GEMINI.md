# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

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
import { createAIServer } from 'simple-rpc-ai-backend';
const server = createAIServer({
  serviceProviders: ['anthropic', 'openai', 'google'],
  requirePayment: { enabled: false }
});
server.start();
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

The system uses `@anolilab/ai-model-registry` for **live model data** with intelligent fallbacks:

- ✅ **Zero Configuration** - Works immediately after install
- ✅ **Live Data** - 1,700+ models from 33+ providers
- ✅ **Automatic Updates** - Always current models and pricing
- ✅ **Intelligent Fallbacks** - Works offline with built-in model data
- ✅ **Corporate Friendly** - No network requirements for basic functionality

### Provider Extension

```typescript
import { ProviderRegistryService } from 'simple-rpc-ai-backend';

// Add custom providers
const registry = new ProviderRegistryService(
  ['anthropic', 'openai', 'custom-ai'], // service providers
  ['anthropic', 'openai', 'custom-ai']  // BYOK providers
);

// Override pricing for contract rates
registry.addPricingOverride({
  provider: 'anthropic',
  model: 'gemini-1.5-pro-20241022',
  pricing: { input: 1.0, output: 5.0 },
  reason: 'Enterprise contract pricing'
});
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
- ✅ **Direct AI Integration**: Gemini, ChatGPT, Claude can discover and use tools
- ✅ **Zero Configuration**: Just add `meta()` to tRPC procedures
- ✅ **Full Validation**: Zod constraints enforced (`min/max`, `enum`, `required`)
- ✅ **Type Safety**: End-to-end TypeScript support
- ✅ **Authentication**: JWT-based protection with configurable public tools
- ✅ **Schema Compliance**: Proper JSON Schema generation for AI consumption

### 🔄 **Integration Architecture**
```typescript
// Unified server supports both protocols simultaneously
app.post('/rpc', handleJSONRPC);     // AI backend protocol
app.post('/trpc', handleTRPC);       // TypeScript client protocol
app.post('/mcp', handleMCP);         // Model Context Protocol

// Tools defined once, available everywhere:
// - tRPC: mcp.greeting, mcp.echo
// - JSON-RPC: mcp.greeting, mcp.echo
// - MCP: greeting, echo (auto-discovered)
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
│   ├── setup-vaultwarden.sh     # Vaultwarden setup script
│   ├── backup-vaultwarden.sh    # Backup script
│   ├── restore-vaultwarden.sh   # Restore script
│   ├── wait-for-postgres.sh     # PostgreSQL wait script
│   ├── pg-healthcheck.sh        # PostgreSQL health check
│   └── init-db.sql              # Database initialization
├── examples/
│   ├── servers/           # Server implementation examples
│   ├── extensions/        # VS Code extension examples
│   └── web-ui/           # Web application examples
├── test/                 # Test suites
├── dev-panel.js          # Custom API explorer for development
├── local-openrpc-tools.js # Local OpenRPC inspector and playground servers
├── docker-compose.vaultwarden.yml  # Vaultwarden infrastructure
├── .env.vaultwarden.example        # Environment template
├── GEMINI.md             # This file
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
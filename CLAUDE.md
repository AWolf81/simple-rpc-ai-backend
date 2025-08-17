# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
pnpm dev                  # Start AI backend server on port 8000
node examples/servers/basic-server.js    # Basic server example
node examples/servers/ai-server-example.js  # Full AI server example
```

### Vaultwarden Management
```bash
pnpm run vaultwarden:setup    # Setup Vaultwarden infrastructure
pnpm run vaultwarden:start    # Start Vaultwarden services
pnpm run vaultwarden:stop     # Stop Vaultwarden services
pnpm run vaultwarden:logs     # View service logs
pnpm run vaultwarden:backup   # Create encrypted backup
pnpm run vaultwarden:restore  # Restore from backup
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
const result = await client.request('executeAIRequest', { content, systemPrompt });
```

### Enhanced Client with Authentication
```typescript
import { AIClient } from 'simple-rpc-ai-backend';
const client = new AIClient(
  { baseUrl: 'http://localhost:8000' },
  deviceInfo
);
await client.initialize();
const result = await client.executeAIRequest(content, systemPrompt);
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
await client.health.query();
await client.executeAIRequest.mutate({ content, systemPrompt });
await client.configureBYOK.mutate({ provider, apiKey });
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

## Testing Standards

### Coverage Requirements
- **Minimum 80% coverage** across branches, functions, lines, statements
- **Cross-platform testing** on Node.js 18, 20, 22
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

## Future Considerations: MCP Integration

### Model Context Protocol (MCP) Compatibility

**Current Status**: We use JSON-RPC 2.0, same foundation as MCP

**Potential Integration**:
```typescript
// Could support both protocols on same server
app.post('/rpc', async (req, res) => {
  if (req.body.method.startsWith('tools/')) {
    return handleMCPRequest(req, res);  // MCP tool protocol
  }
  return handleRPCRequest(req, res);    // Our AI backend protocol
});
```

**MCP Benefits**:
- Direct integration with Claude, ChatGPT, Gemini (2024+ standard)
- Tool discovery by AI providers
- Industry standardization (adopted by OpenAI, Google DeepMind)

**Why Not Yet Implemented**:
- Different use case (MCP = tool integration, we = AI request proxying)
- Added complexity for our specific system prompt protection use case
- Our current architecture already solves the corporate proxy problem

**Decision**: Monitor MCP adoption; consider hybrid approach if demand emerges

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
├── docker-compose.vaultwarden.yml  # Vaultwarden infrastructure
├── .env.vaultwarden.example        # Environment template
├── CLAUDE.md             # This file
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

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
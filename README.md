# Simple RPC AI Backend

> **🚀 One server for all your AI needs - supports both JSON-RPC and tRPC with configurable limits.**

[![codecov](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend/branch/master/graph/badge.svg?token=LB25iUAO1h)](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend)
[![Test Simple RPC AI Backend](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml/badge.svg)](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Alpha-orange.svg)](https://github.com/AWolf81/simple-rpc-ai-backend)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet.svg)](https://claude.ai/code)

## 🚀 **Quick Start**

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Basic setup - uses smart defaults
const server = createRpcAiServer();  // See default configuration below
await server.start();

// Production setup with predefined limits
import { AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8000,
  aiLimits: AI_LIMIT_PRESETS.standard    // Balanced limits for most apps
});
await server.start();
```

**Smart protocol defaults:**
- 📡 **JSON-RPC by default** - Simple, universal, works everywhere
- ⚡ **tRPC available** - Enable for TypeScript projects with better DX

## ⚙️ **Default Configuration (Zero Config)**

When you call `createRpcAiServer()` with no parameters, you get these sensible defaults:

```typescript
// This is what you get by default:
createRpcAiServer({
  port: 8000,
  
  // Protocols: JSON-RPC only (simple, universal)
  protocols: {
    jsonRpc: true,   // ✅ Enabled - works with any language
    tRpc: false      // ❌ Disabled - enable for TypeScript projects
  },
  
  // AI Limits: Standard preset (balanced for most use cases)
  aiLimits: {
    content: {
      maxLength: 500_000,    // 500KB (~100k words) - handles large files
      minLength: 1
    },
    tokens: {
      defaultMaxTokens: 4096,    // Good default for most AI models
      maxTokenLimit: 32_000,     // Supports long context models
      minTokens: 1
    },
    systemPrompt: {
      maxLength: 25_000,     // 25KB - supports complex prompts
      minLength: 1
    }
  },
  
  // Security: Permissive for development, lock down for production
  cors: {
    origin: '*',           // Allow all origins - ⚠️ change for production
    credentials: false
  },
  
  // Rate Limiting: Conservative but reasonable
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 1000                  // 1000 requests per 15 min per IP
  },
  
  // Endpoints: Standard paths
  paths: {
    jsonRpc: '/rpc',       // POST requests for JSON-RPC
    tRpc: '/trpc',         // tRPC endpoint (if enabled)
    health: '/health'      // GET for health checks
  }
});
```

**Why These Defaults?**

| Setting | Value | Reasoning |
|---------|-------|-----------|
| **JSON-RPC only** | `jsonRpc: true, tRpc: false` | Universal compatibility, simpler to use |
| **Standard AI limits** | 500KB content, 4096 tokens | Handles most use cases without being excessive |
| **Permissive CORS** | `origin: '*'` | Easy development - ⚠️ **change for production** |
| **Generous rate limits** | 1000/15min | Prevents abuse while allowing normal usage |
| **Port 8000** | Standard port | Avoids conflicts with common services |

> ⚠️ **Review Before Production:** These defaults prioritize ease of development. For production deployments:
> - **AI Limits:** Validate token limits against your AI provider's models and your budget
> - **CORS:** Always restrict to your specific domains (`origin: 'https://yourapp.com'`)
> - **Rate Limits:** Adjust based on expected user load and abuse prevention needs
> - **Security:** Consider authentication, API keys, and access controls

**⚡ Quick Customization:**

```typescript
// Enable tRPC for TypeScript projects
const server = createRpcAiServer({
  protocols: { tRpc: true }  // Auto-disables JSON-RPC
});

// Use conservative limits for production
const server = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.conservative,
  cors: { origin: 'https://yourapp.com' }  // Lock down CORS
});

// Development with generous limits
const server = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.generous,
  rateLimit: { max: 10000 }  // Higher rate limits for dev
});
```

## 🔀 **tRPC vs JSON-RPC: When to Use Which?**

### **📊 Quick Comparison**

| Feature | JSON-RPC 2.0 | tRPC |
|---------|-------------|------|
| **Type Safety** | ❌ Manual types | ✅ End-to-end TypeScript |
| **Client Generation** | ❌ Manual client code | ✅ Auto-generated client |
| **Protocol Standard** | ✅ Universal standard | 🟡 TypeScript ecosystem |
| **VS Code Extensions** | ✅ Simple setup | ✅ Better DX |
| **Web Applications** | 🟡 More work | ✅ Excellent DX |
| **Non-TypeScript Clients** | ✅ Any language | ❌ TypeScript only |
| **Bundle Size** | 🟢 Minimal | 🟡 Larger |
| **Learning Curve** | 🟢 Simple | 🟡 Moderate |

### **🎯 When to Use JSON-RPC**

**Perfect for:**
- ✅ **Standalone VS Code Extensions** - When extension is independent from backend
- ✅ **Cross-language clients** - Python, Go, Rust, Java can all consume JSON-RPC
- ✅ **CLI tools** - Minimal dependencies, easy to implement
- ✅ **Mobile apps** - React Native, Flutter, native iOS/Android
- ✅ **Legacy systems** - Integrates with existing JSON-RPC infrastructure
- ✅ **Simple automation** - Scripts, webhooks, serverless functions
- ✅ **Third-party integrations** - When consumers don't use TypeScript

**Example - VS Code Extension:**
```typescript
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

// Simple and direct
const result = await client.request('executeAIRequest', {
  content: editor.document.getText(),
  systemPrompt: 'security_review',
  apiKey: await context.secrets.get('anthropic-key')
});
```

### **⚡ When to Use tRPC**

**Perfect for:**
- ✅ **Modern web applications** - React, Vue, Svelte with TypeScript
- ✅ **Full-stack TypeScript** - Shared types between frontend and backend
- ✅ **Monorepo VS Code Extensions** - When extension and backend share types
- ✅ **Rapid development** - Auto-completion, refactoring, error detection
- ✅ **Complex data flows** - Nested objects, unions, detailed validation
- ✅ **Team development** - Type safety prevents integration bugs

**Example - React Web App:**
```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })],
});

// Full type safety and auto-completion
const result = await client.ai.executeAIRequest.mutate({
  content: code,              // TypeScript knows this is required
  systemPrompt: 'code_review', // Auto-complete available prompts
  options: {
    maxTokens: 4096,          // Type-checked at compile time
    temperature: 0.1
  }
});

// result is fully typed - no manual type assertions needed!
console.log(result.success); // TypeScript knows this exists
```

### **🎯 Recommendation: Choose One Protocol**

While our unified server supports both protocols simultaneously, **choose one** based on your tech stack:

```typescript
// Default: JSON-RPC only (simple, universal)
const server = createRpcAiServer();  // { jsonRpc: true, tRpc: false }

// TypeScript project: tRPC only (better DX)
const server = createRpcAiServer({
  protocols: { tRpc: true }          // Auto-sets { jsonRpc: false, tRpc: true }
});

// Explicit control: enable both (if needed)
const server = createRpcAiServer({
  protocols: { 
    jsonRpc: true, 
    tRpc: true 
  }
});
```

**Decision Tree:**

```
Is your entire stack TypeScript?
├── YES → Use tRPC (better DX, type safety, auto-completion)
│   ├── VS Code extension + TS backend → tRPC
│   ├── React/Vue + Node.js → tRPC  
│   └── Monorepo setup → tRPC
│
└── NO → Use JSON-RPC (universal compatibility)
    ├── Python/Go/PHP backend → JSON-RPC
    ├── Multiple client languages → JSON-RPC
    ├── Third-party consumers → JSON-RPC
    └── Legacy system integration → JSON-RPC
```

### **🏗️ Monorepo VS Code Extension with Shared Types**

**If your VS Code extension and backend are in the same repository**, tRPC is actually the better choice:

```typescript
// packages/backend/src/server.ts
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  protocols: { tRpc: true },  // Enable tRPC for shared types
  aiLimits: {
    content: { maxLength: 1_000_000 },
    tokens: { defaultMaxTokens: 8192 }
  }
});

export type AppRouter = typeof server.getRouter;
```

```typescript
// packages/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../backend/src/server'; // Shared types!

export function activate(context: vscode.ExtensionContext) {
  // Type-safe client with zero manual type definitions
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:8000/trpc',
      }),
    ],
  });

  const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
      // Full type safety - VS Code will auto-complete everything!
      const result = await client.ai.executeAIRequest.mutate({
        content: editor.document.getText(),     // TypeScript knows this is required
        systemPrompt: 'security_review',       // Auto-complete shows available prompts
        options: {
          maxTokens: 4096,                     // Type-checked at compile time
          temperature: 0.1                     // VS Code shows valid range
        }
      });

      // result is fully typed - no casting needed!
      if (result.success) {
        vscode.window.showInformationMessage(result.data.content);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}
```

**Benefits of tRPC in Monorepo VS Code Extensions:**
- ✅ **Zero type maintenance** - Types are automatically shared
- ✅ **Refactoring safety** - Rename a field, get compile errors everywhere it's used
- ✅ **Auto-completion** - VS Code shows all available methods and parameters
- ✅ **Runtime validation** - Input validation with Zod schemas
- ✅ **Better debugging** - TypeScript stack traces with real method names

### **📋 Complete Monorepo Setup Guide**

**Step 1: Project Structure**
```
your-ai-extension-project/
├── packages/
│   ├── backend/                 # AI server package
│   │   ├── src/
│   │   │   ├── server.ts       # Main server file
│   │   │   └── types.ts        # Shared types export
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── extension/              # VS Code extension package
│       ├── src/
│       │   ├── extension.ts    # Main extension file
│       │   └── ai-client.ts    # tRPC client
│       ├── package.json
│       └── tsconfig.json
├── package.json                # Root package.json with workspaces
└── tsconfig.json              # Root TypeScript config
```

**Step 2: Root Package Configuration**
```json
// package.json (root)
{
  "name": "ai-extension-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "concurrently": "^8.0.0"
  },
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:extension\"",
    "dev:backend": "npm run dev --workspace=packages/backend",
    "dev:extension": "npm run compile --workspace=packages/extension",
    "build": "npm run build --workspace=packages/backend && npm run compile --workspace=packages/extension"
  }
}
```

**Step 3: Backend Package Setup**
```json
// packages/backend/package.json
{
  "name": "@your-project/backend",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "simple-rpc-ai-backend": "*"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

```typescript
// packages/backend/src/server.ts
import { createRpcAiServer, AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  protocols: { tRpc: true },  // tRPC only for TypeScript monorepo
  port: 3000,
  aiLimits: AI_LIMIT_PRESETS.standard,
  cors: {
    origin: ['vscode-webview://*'],  // Allow VS Code webviews
    credentials: true
  }
});

// Export the router type for the extension
export type AppRouter = typeof server.getRouter;

// Start server
server.start().then(() => {
  console.log('🚀 AI Backend server running on port 3000');
  console.log('📍 tRPC endpoint: http://localhost:3000/trpc');
}).catch(console.error);
```

```typescript
// packages/backend/src/types.ts
export type { AppRouter } from './server.js';
```

**Step 4: Extension Package Setup**
```json
// packages/extension/package.json
{
  "name": "your-ai-extension",
  "version": "1.0.0",
  "main": "./dist/extension.js",
  "engines": {
    "vscode": "^1.80.0"
  },
  "activationEvents": [
    "onCommand:extension.analyzeCode"
  ],
  "contributes": {
    "commands": [
      {
        "command": "extension.analyzeCode",
        "title": "Analyze Code with AI"
      }
    ]
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "dependencies": {
    "@trpc/client": "^10.45.0",
    "@your-project/backend": "workspace:*"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "typescript": "^5.0.0"
  }
}
```

```typescript
// packages/extension/src/ai-client.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@your-project/backend/src/types';

export const aiClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});
```

```typescript
// packages/extension/src/extension.ts
import * as vscode from 'vscode';
import { aiClient } from './ai-client';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const document = editor.document;
    const code = document.getText();

    try {
      // Type-safe AI request with full auto-completion
      const result = await aiClient.ai.executeAIRequest.mutate({
        content: code,
        systemPrompt: 'security_review',
        options: {
          maxTokens: 4096,
          temperature: 0.1
        }
      });

      // Show results in VS Code
      if (result.success) {
        const panel = vscode.window.createWebviewPanel(
          'aiAnalysis',
          'AI Analysis Results',
          vscode.ViewColumn.Two,
          {}
        );
        
        panel.webview.html = `
          <html>
            <body>
              <h1>AI Analysis Results</h1>
              <pre>${result.data.content}</pre>
            </body>
          </html>
        `;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`AI analysis failed: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

**Step 5: TypeScript Configuration**
```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "references": [
    { "path": "./packages/backend" },
    { "path": "./packages/extension" }
  ]
}
```

```json
// packages/backend/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

```json
// packages/extension/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "target": "ES2020"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../backend" }
  ]
}
```

**Step 6: Development Workflow**
```bash
# Install dependencies
npm install

# Start development (both backend and extension compilation)
npm run dev

# In VS Code, press F5 to launch Extension Development Host
# Your extension will have full type safety with the running backend
```

**Key Benefits of This Setup:**
- ✅ **Shared types** - Extension gets full TypeScript intellisense for AI methods
- ✅ **Hot reload** - Backend changes automatically update extension types
- ✅ **Type safety** - Compile-time errors if backend API changes
- ✅ **Auto-completion** - VS Code shows all available AI methods and parameters
- ✅ **Single repository** - Easy to manage and deploy together

### **💡 Why We Built Both**

**JSON-RPC** is the universal language of RPC - every programming language can speak it. It's perfect for VS Code extensions where simplicity and small bundle size matter.

**tRPC** provides an incredible developer experience for TypeScript applications. The type safety and auto-completion significantly reduce bugs and development time.

**Our approach**: Start with JSON-RPC for simplicity, add tRPC when you need the enhanced DX for web applications.

## ⚠️ **Development Status**

**🔬 Alpha Software** - This package is in active development and not yet published to npm.

- ✅ **Core functionality working** - Unified RPC server, AI integration, configurable limits
- ✅ **PostgreSQL key management** - Secure multi-tenant API key storage  
- ✅ **OpenRPC documentation complete** - Full API specification available
- ✅ **Test coverage >80%** - Comprehensive test suite
- ⚠️ **API may change** - Breaking changes possible before v1.0
- 📦 **Not on npm yet** - Install directly from GitHub (see below)

### **Roadmap to v1.0**
- [x] PostgreSQL secret management with user isolation
- [x] Comprehensive audit logging for all secret operations
- [x] JSON-RPC CRUD operations for API key management
- [x] Security testing and user isolation validation
- [x] API token system for external access
- [x] Comprehensive health monitoring
- [ ] Performance optimization and load testing
- [ ] Additional AI provider integrations
- [ ] Production deployment guides
- [ ] Security audit and hardening
- [ ] **npm publication**

## ⚙️ **Configuration**

The new unified server supports extensive configuration for all use cases:

### **Basic Configuration**

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  // Basic settings
  port: 8000,
  
  // Protocol support (JSON-RPC by default, tRPC available)
  protocols: {
    tRpc: true        // Enable tRPC for TypeScript projects (auto-disables JSON-RPC)
    // Default: { jsonRpc: true, tRpc: false }
  },
  
  // AI limits (configurable for your use case)
  aiLimits: {
    content: {
      maxLength: 1_000_000,  // 1MB content limit
      minLength: 1
    },
    tokens: {
      defaultMaxTokens: 4096,    // Good default for most use cases
      maxTokenLimit: 200_000,    // Support for long context models
      minTokens: 1
    },
    systemPrompt: {
      maxLength: 50_000,   // Support for complex prompts
      minLength: 1
    }
  },
  
  // Security & rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 1000                  // requests per window per IP
  },
  
  // CORS configuration
  cors: {
    origin: '*',        // or ['https://yourapp.com']
    credentials: false
  }
});
```

### **AI Limit Presets for Common Use Cases**

Choose the right preset for your needs:

```typescript
import { createRpcAiServer, AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

// 🏭 Production (conservative limits)
const prodServer = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.conservative,
  rateLimit: { max: 100 }
});

// 📊 Most applications (balanced limits)  
const appServer = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.standard      // Default choice
});

// 🚀 Development (generous limits)
const devServer = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.generous
});

// 🔥 Specialized use cases (maximum limits)
const maxServer = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.maximum
});
```

**Preset Details:**

| Preset | Content Limit | Default Tokens | Max Tokens | System Prompt | Use Case |
|--------|---------------|----------------|------------|---------------|----------|
| **conservative** | 100KB (~20k words) | 2,048 | 8,192 | 10KB | 🏭 Production, cost control |
| **standard** | 500KB (~100k words) | 4,096 | 32,000 | 25KB | 📊 Most applications |
| **generous** | 2MB (~400k words) | 8,192 | 100,000 | 50KB | 🚀 Development, large docs |
| **maximum** | 10MB (~2M words) | 16,384 | 1,000,000 | 100KB | 🔥 Specialized, research |

> ⚠️ **Important Disclaimers:**
> 
> **Validate Against Your Needs:** These are suggested defaults based on common use cases. Always review and adjust limits based on:
> - Your specific application requirements
> - AI provider token limits (Claude: 200k, GPT-4: 128k, etc.)
> - Cost considerations and budget constraints
> - Expected user behavior and content size
> 
> **Check AI Provider Limits:** Each AI provider has different context windows and token limits:
> - **Anthropic Claude:** 200k tokens max context
> - **OpenAI GPT-4:** 8k-128k tokens depending on model
> - **Google Gemini:** 1M tokens for Pro models
> 
> **Monitor Usage & Costs:** Higher limits = higher potential costs. Start conservative and increase based on actual usage patterns.

**Custom Configuration:**

```typescript
// Mix presets with custom overrides
const customServer = createRpcAiServer({
  aiLimits: {
    ...AI_LIMIT_PRESETS.standard,
    tokens: { 
      ...AI_LIMIT_PRESETS.standard.tokens,
      defaultMaxTokens: 8192        // Higher default for your use case
    }
  }
});

// Protocol selection examples
const jsonRpcServer = createRpcAiServer({
  aiLimits: AI_LIMIT_PRESETS.conservative    // JSON-RPC by default
});

const tRpcServer = createRpcAiServer({
  protocols: { tRpc: true },                  // tRPC only
  aiLimits: AI_LIMIT_PRESETS.generous
});
```

## 🔐 **API Key Management Options**

This package offers **flexible storage options** for API keys and system configuration:

### 🐘 **PostgreSQL Secret Manager (Recommended)**

**Simple, secure multi-tenant API key storage with PostgreSQL:**

```bash
# Setup PostgreSQL secret manager
pnpm run postgres:setup

# Start PostgreSQL service
pnpm run postgres:start

# Test user isolation security
pnpm test:postgres
```

**Benefits:**
- 🔒 **AES-256-GCM encryption** for all API keys
- 👥 **True user isolation** - each user has separate database rows
- 📊 **Comprehensive audit logging** of all secret operations
- 🚀 **Simple setup** - just PostgreSQL, no complex dependencies
- 🛡️ **Security-first design** - database-level access controls
- 🏢 **Corporate-friendly** - works behind firewalls and proxies

> **Why PostgreSQL over Infisical?** We chose PostgreSQL for simplicity and reliability. While Infisical offers enterprise features, our PostgreSQL implementation provides the same security guarantees (encryption, user isolation, audit logging) with a much simpler setup. No Docker orchestration complexity, no external services - just a reliable PostgreSQL database.

### 📁 **File Storage (Simple Development)**

**Simple file-based storage for development and small deployments:**

```javascript
const server = createRpcAiServer({
  // File storage is built-in, just specify limits
  aiLimits: {
    content: { maxLength: 1_000_000 },  // 1MB max
    tokens: { defaultMaxTokens: 4096 }  // Good default
  }
});
```

**Benefits:**
- 🚀 **Zero setup** - No external dependencies
- 🔒 **AES-256-GCM encryption** for local files  
- 💻 **Perfect for development** and single-user deployments
- 📦 **Portable** - Easy to backup and restore

### 🔑 **Direct Key Passing (Ultimate Flexibility)**

**Pass API keys directly in requests - ideal for VS Code secure storage integration:**

```javascript
// Client can pass API key per request
const result = await client.request('executeAIRequest', {
  content: code,
  systemPrompt: 'security_review',
  apiKey: vsCodeSecretStorage.get('anthropic-key')  // VS Code handles storage
});
```

**Benefits:**
- 🎯 **Zero backend storage** - Client manages keys entirely
- 🔐 **VS Code secure storage** integration
- 🏢 **Corporate policy compliance** - Keys never leave user's machine
- ⚡ **Instant setup** - No key management infrastructure needed

## 📚 **Usage Examples**

### **JSON-RPC Client Examples**

**Basic usage (platform-agnostic):**
```typescript
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

// Execute AI request with client-managed API key
const result = await client.request('executeAIRequest', {
  content: 'function login(user, pass) { return user === "admin" && pass === "123"; }',
  systemPrompt: 'security_review',
  apiKey: 'your-anthropic-key'  // Optional - only if using client-managed keys
});

console.log(result.success, result.data);
```

**VS Code Extension integration:**
```typescript
import * as vscode from 'vscode';
import { RPCClient } from 'simple-rpc-ai-backend';

export function activate(context: vscode.ExtensionContext) {
  const client = new RPCClient('http://localhost:8000');
  
  const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    // Get API key from VS Code's secure storage
    const apiKey = await context.secrets.get('anthropic-api-key');
    
    try {
      const result = await client.request('executeAIRequest', {
        content: editor.document.getText(),
        systemPrompt: 'security_review',
        apiKey: apiKey
      });
      
      // Show results in VS Code
      vscode.window.showInformationMessage(`Analysis: ${result.data.content}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  });
  
  context.subscriptions.push(disposable);
}
```

### **tRPC Client Examples**

**React web application:**
```typescript
import React, { useState } from 'react';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:8000/trpc',
    }),
  ],
});

function CodeAnalyzer() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  
  const analyzeCode = async () => {
    setLoading(true);
    try {
      // Full type safety - TypeScript knows all parameter types
      const response = await client.ai.executeAIRequest.mutate({
        content: code,
        systemPrompt: 'security_review',
        options: {
          maxTokens: 4096,
          temperature: 0.1
        }
      });
      
      // Response is fully typed
      setResult(response.content);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <textarea 
        value={code} 
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste your code here..."
      />
      <button onClick={analyzeCode} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Code'}
      </button>
      {result && (
        <div className="result">
          <h3>Analysis Result:</h3>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}

export default CodeAnalyzer;
```

**Next.js API integration:**
```typescript
// pages/api/ai-proxy.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: process.env.AI_BACKEND_URL || 'http://localhost:8000/trpc',
    }),
  ],
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { content, systemPrompt } = req.body;
    
    // Type-safe proxy to AI backend
    const result = await client.ai.executeAIRequest.mutate({
      content,
      systemPrompt,
      options: {
        maxTokens: 2048
      }
    });
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'AI request failed' });
  }
}
```

### **CLI Tool Example**

```typescript
#!/usr/bin/env node
import { RPCClient } from 'simple-rpc-ai-backend';
import { readFileSync } from 'fs';
import { program } from 'commander';

program
  .name('ai-code-review')
  .description('AI-powered code review tool')
  .argument('<file>', 'file to analyze')
  .option('-p, --prompt <prompt>', 'system prompt to use', 'security_review')
  .option('-k, --api-key <key>', 'API key (or set AI_API_KEY env var)')
  .action(async (file, options) => {
    const client = new RPCClient(process.env.AI_BACKEND_URL || 'http://localhost:8000');
    const apiKey = options.apiKey || process.env.AI_API_KEY;
    
    if (!apiKey) {
      console.error('Error: API key required. Use --api-key or set AI_API_KEY environment variable.');
      process.exit(1);
    }
    
    try {
      const content = readFileSync(file, 'utf-8');
      
      console.log(`Analyzing ${file} with ${options.prompt} prompt...`);
      
      const result = await client.request('executeAIRequest', {
        content,
        systemPrompt: options.prompt,
        apiKey
      });
      
      console.log('\n--- Analysis Result ---');
      console.log(result.data.content);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
```

**Usage:**
```bash
# Install globally
npm install -g ai-code-review

# Analyze a file
ai-code-review src/auth.js --prompt security_review --api-key sk-ant-...

# Or with environment variable
export AI_API_KEY=sk-ant-...
ai-code-review src/auth.js
```

## 🔧 **Storage Configuration Examples**

### Option 1: PostgreSQL Secret Manager (Recommended)

```javascript
// server.js - Production setup with PostgreSQL
import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { PostgreSQLRPCMethods } from 'simple-rpc-ai-backend/auth/PostgreSQLRPCMethods';

const server = createRpcAiServer({
  secretManager: {
    type: 'postgresql',
    host: process.env.SECRET_MANAGER_DB_HOST || 'localhost',
    port: process.env.SECRET_MANAGER_DB_PORT || 5433,
    database: process.env.SECRET_MANAGER_DB_NAME || 'secrets',
    user: process.env.SECRET_MANAGER_DB_USER || 'secret_manager',
    password: process.env.SECRET_MANAGER_DB_PASS,
    encryptionKey: process.env.SECRET_MANAGER_ENCRYPTION_KEY
  },
  systemPrompts: {
    security_review: "You are a senior security engineer...",
    code_quality: "You are a senior architect..."
  }
});

server.start();
```

**Environment setup:**
```bash
# .env.postgres
SECRET_MANAGER_DB_HOST=localhost
SECRET_MANAGER_DB_PORT=5433
SECRET_MANAGER_DB_NAME=secrets
SECRET_MANAGER_DB_USER=secret_manager
SECRET_MANAGER_DB_PASS=your-secure-password
SECRET_MANAGER_ENCRYPTION_KEY=your-32-character-key
```

### Option 2: File Storage (Simple Development)

```javascript
// server.js - Development/small deployment setup  
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  keyStorage: {
    type: 'file',
    path: './secure/keys.encrypted.json',
    masterKey: process.env.MASTER_KEY || 'dev-key-not-for-production'
  },
  prompts: {
    security_review: "You are a senior security engineer...",
    code_quality: "You are a senior architect..."
  }
});

server.start();
```

### Option 3: Client-Managed Keys (VS Code Integration)

```javascript
// server.js - No backend key storage
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  keyStorage: {
    type: 'client_managed'  // Keys passed in each request
  },
  prompts: {
    security_review: "You are a senior security engineer...",
    code_quality: "You are a senior architect..."
  }
});

// VS Code extension
import * as vscode from 'vscode';
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

async function analyzeCode() {
  // Get API key from VS Code's secure storage
  const apiKey = await vscode.workspace.getConfiguration().get('anthropic.apiKey') ||
                 await context.secrets.get('anthropic-api-key');
  
  const result = await client.request('executeAIRequest', {
    content: editor.document.getText(),
    systemPrompt: 'security_review',
    apiKey: apiKey  // Passed directly, never stored on server
  });
}
```

## 📦 **Using in Your Own Package**

### Installation

```bash
# Install from GitHub (current)
npm install git+https://github.com/AWolf81/simple-rpc-ai-backend.git

# Or with pnpm (recommended)
pnpm add git+https://github.com/AWolf81/simple-rpc-ai-backend.git
```

### Option A: Secure Enterprise Setup with PostgreSQL

**1. Add PostgreSQL infrastructure to your project:**

```bash
# Copy infrastructure files to your project
cp node_modules/simple-rpc-ai-backend/docker-compose.postgres.yml ./
cp node_modules/simple-rpc-ai-backend/.env.postgres.example ./
cp -r node_modules/simple-rpc-ai-backend/docker ./

# Setup PostgreSQL
./docker/setup-postgres.sh
```

**2. Create your secure AI backend server:**

```javascript
// your-ai-backend/server.js - PostgreSQL-powered secure backend
import { createRpcAiServer, AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8000,
  
  // Enable token tracking with PostgreSQL
  tokenTracking: {
    enabled: true,
    databaseUrl: process.env.DATABASE_URL,
    platformFeePercent: 25, // 25% platform fee
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
  },
  
  // JWT authentication for user identification
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-opensaas-app',
    audience: 'your-ai-service'
  },
  
  // Standard limits for production
  aiLimits: AI_LIMIT_PRESETS.standard,
  
  // CORS for your frontend domains
  cors: {
    origin: ['https://your-app.com', 'vscode-webview://*'],
    credentials: true
  }
});

server.start();
```

**3. Ultra-simple client integration:**

```javascript
// your-vscode-extension/src/extension.js - tRPC Client for TypeScript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// Type-safe tRPC client
const client = createTRPCProxyClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:8000/trpc',
      headers: {
        authorization: `Bearer ${opensaasJWT}`, // Your JWT token
      },
    }),
  ],
});

export async function activate(context) {
  // Store user's API key (one-time setup)
  await client.configureBYOK.mutate({
    providers: {
      anthropic: {
        enabled: true,
        apiKey: await getApiKeyFromUser()
      }
    }
  });

  // Use AI with system prompt protection
  const result = await client.executeAIRequest.mutate({
    content: code,
    systemPrompt: "You are an expert code reviewer...",
    options: {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096
    }
  });
  
  // Zero crypto complexity, full type safety!
}
```

### Option B: Simple File Storage

```javascript
// your-ai-backend/server.js - No external dependencies
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  keyStorage: {
    type: 'file',
    path: './secure/api-keys.encrypted.json',
    masterKey: process.env.MASTER_KEY
  },
  prompts: {
    myAnalysis: "Your domain-specific prompt here..."
  }
});

server.start();
```

### Option C: Client-Managed Keys (Perfect for VS Code)

```javascript
// your-ai-backend/server.js - Zero key management
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  keyStorage: { type: 'client_managed' },
  prompts: {
    myAnalysis: "Your protected system prompt..."
  }
});

// your-vscode-extension/src/extension.js  
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

async function analyzeWithVSCodeKeys() {
  // VS Code's secure storage handles API keys
  const apiKey = await context.secrets.get('anthropic-api-key');
  
  const result = await client.request('executeAIRequest', {
    content: code,
    systemPrompt: 'myAnalysis',
    apiKey: apiKey  // Never stored on server
  });
}
```

## 🎯 **Which Storage Option Should You Choose?**

| Scenario | Recommended Option | Why |
|----------|-------------------|-----|
| **Enterprise SaaS** | 🐘 PostgreSQL Vault | Multi-user, audit trails, encrypted storage |
| **Team Development** | 📁 File Storage | Simple setup, encrypted, portable |
| **VS Code Extensions** | 🔑 Client-Managed | Integrates with VS Code secure storage |
| **Corporate Deployment** | 🐘 PostgreSQL Vault | Compliance, centralized control |
| **MVP/Prototype** | 🔑 Client-Managed | Zero infrastructure, instant start |
| **Open Source Projects** | 📁 File Storage | No external dependencies |

## 🔒 **Storage Security Comparison**

| Feature | PostgreSQL | File Storage | Client-Managed |
|---------|-----------|--------------|----------------|
| **System Prompt Protection** | ✅ Server-side only | ✅ Server-side only | ✅ Server-side only |
| **API Key Security** | 🔒 AES-256-GCM encrypted | 🔒 AES-256-GCM encrypted | ✅ Client handles |
| **Multi-user Support** | ✅ True user isolation | ❌ Single instance | ✅ Per client instance |
| **Audit Trail** | ✅ Complete server logs | 🟡 Basic file logs | ❌ No audit trail |
| **Setup Complexity** | 🟡 PostgreSQL + server | 🟢 Server only | 🟢 Server only |
| **Corporate Compliance** | ✅ Enterprise ready | 🟡 Basic compliance | ✅ Zero storage risk |
| **Backup & Recovery** | ✅ Database backups | 🟡 File-based | ✅ Client responsibility |
| **Attack Surface** | 🟡 Database + server | 🟡 File system + server | 🟢 Minimal server |
| **Recommended For** | 🏢 Production/Enterprise | 💻 Development/Small teams | 🔌 VS Code extensions |

## 🚀 **5-Minute Quick Start**

### Simple Development Setup (No External Dependencies)

```bash
# 1. Create your project
mkdir my-ai-backend && cd my-ai-backend
npm init -y

# 2. Install package
npm install git+https://github.com/AWolf81/simple-rpc-ai-backend.git

# 3. Create server
cat > server.js << 'EOF'
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  keyStorage: { type: 'client_managed' },  // No storage needed
  prompts: {
    security_review: "You are a senior security engineer. Review code for vulnerabilities."
  },
  serviceProviders: ['anthropic', 'openai']
});

server.start();
EOF

# 4. Start server
node server.js
# 🚀 Server running on http://localhost:8000
```

### Test with curl (passing API key directly):

```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", 
    "method": "executeAIRequest", 
    "params": {
      "content": "function login(user, pass) { return users[user] === pass; }",
      "systemPrompt": "security_review",
      "apiKey": "your-anthropic-key"
    }, 
    "id": 1
  }'
```

**Your system prompts are protected server-side, but setup takes 2 minutes!**

## 🎯 **Why This Package Exists**

### 🔍 **The Claude Code Wake-Up Call**

After reading [Kir Shatrov's reverse engineering of Claude Code](https://kirshatrov.com/posts/claude-code-internals), we realized how easily proprietary AI system prompts can be extracted from client-side applications:

**What the reverse engineering revealed:**
- **System prompts fully visible** in client code and network traffic
- **Multi-step prompt logic exposed** - security policies, validation rules, proprietary techniques
- **Business logic discoverable** - competitors can see exactly how your AI features work
- **No protection against inspection** - anyone can extract your valuable prompts

**This is a massive business risk for AI-powered applications.**

### 🚨 **The Real Problem with Current AI Extensions**

**Building AI-powered VS Code extensions is unnecessarily complex AND insecure:**

- 🔴 **System prompts exposed** - Extensions store sensitive prompts in client code
- 🔴 **Business logic visible** - Competitors can reverse engineer your AI techniques
- 🔴 **API key management** - Users must configure AI provider credentials  
- 🔴 **Provider coupling** - Extensions tied to specific AI providers
- 🔴 **Corporate restrictions** - Proxies block AI provider APIs
- 🔴 **Complex integration** - Each extension reinvents AI communication

### 🛡️ **Our Solution: Server-Side Prompt Protection with Flexible Storage**

**This package solves these problems with a simple RPC architecture:**

- ✅ **System Prompt Protection** - Keep sensitive prompts on your secure server (never client-side)
- ✅ **Business Logic Security** - Your proprietary AI techniques stay hidden
- ✅ **Corporate Proxy Bypass** - AI requests go through your backend, not blocked
- ✅ **Flexible Key Management** - PostgreSQL, file storage, or client-managed keys
- ✅ **Zero Extension Setup** - Users don't need API keys or configuration (optional)
- ✅ **Multi-Provider Support** - Switch AI providers without extension updates
- ✅ **Simple Integration** - Clean JSON-RPC API for VS Code extensions

**Key Security Principle**: If Claude Code's prompts can be reverse engineered, so can yours. The only safe place for valuable system prompts is on servers you control.

## 🖥️ **Frontend Development Guide**

### **Complete CRUD API for VaultStorage**

The RPC API provides comprehensive CRUD operations for API key management. Here's everything you need to build a frontend:

#### **Authentication Setup**
```typescript
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

// Get user's JWT from your auth system (OpenSaaS, Auth0, etc.)
const userJWT = await getUserJWT(); // Your auth implementation
```

#### **CREATE - Store API Keys**
```typescript
// Store user's API key for a provider
async function storeApiKey(provider: string, apiKey: string) {
  try {
    const result = await client.request('storeUserKey', {
      jwt: userJWT,
      provider: provider,        // 'anthropic', 'openai', 'google'
      apiKey: apiKey            // User's actual API key
    });
    
    return {
      success: true,
      keyId: result.keyId,
      message: `${provider} API key stored successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage in frontend
await storeApiKey('anthropic', 'sk-ant-api-key-12345');
await storeApiKey('openai', 'sk-openai-key-67890');
```

#### **READ - Retrieve API Key Status**
```typescript
// Check if user has an API key for a provider
async function hasApiKey(provider: string) {
  try {
    const result = await client.request('getUserKey', {
      jwt: userJWT,
      provider: provider
    });
    
    return {
      hasKey: !!result.apiKey,
      keyPreview: result.apiKey ? `${result.apiKey.slice(0, 8)}...` : null
    };
  } catch (error) {
    return { hasKey: false, error: error.message };
  }
}

// List all providers and their key status
async function listAllProviders() {
  try {
    const result = await client.request('getUserProviders', {
      jwt: userJWT
    });
    
    return {
      success: true,
      providers: result.providers.map(p => ({
        name: p.provider,
        hasKey: p.hasKey,
        displayName: getProviderDisplayName(p.provider)
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getProviderDisplayName(provider: string): string {
  const names = {
    'anthropic': 'Anthropic (Claude)',
    'openai': 'OpenAI (GPT)',
    'google': 'Google (Gemini)'
  };
  return names[provider] || provider;
}
```

#### **UPDATE - Rotate API Keys**
```typescript
// Rotate/update an existing API key
async function rotateApiKey(provider: string, newApiKey: string) {
  try {
    const result = await client.request('rotateUserKey', {
      jwt: userJWT,
      provider: provider,
      newApiKey: newApiKey
    });
    
    return {
      success: true,
      keyId: result.keyId,
      message: `${provider} API key updated successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

#### **DELETE - Remove API Keys**
```typescript
// Delete user's API key for a provider
async function deleteApiKey(provider: string) {
  try {
    const result = await client.request('deleteUserKey', {
      jwt: userJWT,
      provider: provider
    });
    
    return {
      success: result.deleted,
      message: result.deleted ? 
        `${provider} API key deleted successfully` : 
        `Failed to delete ${provider} API key`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

#### **VALIDATE - Test API Keys**
```typescript
// Validate if stored API key works with the provider
async function validateApiKey(provider: string) {
  try {
    const result = await client.request('validateUserKey', {
      jwt: userJWT,
      provider: provider
    });
    
    return {
      isValid: result.isValid,
      message: result.isValid ? 
        `${provider} API key is working` : 
        `${provider} API key is invalid or expired`
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}
```

### **React Component Example**

```tsx
import React, { useState, useEffect } from 'react';

interface ApiKeyManager {
  provider: string;
  hasKey: boolean;
  displayName: string;
}

const ApiKeyManagerComponent: React.FC = () => {
  const [providers, setProviders] = useState<ApiKeyManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    const result = await listAllProviders();
    if (result.success) {
      setProviders(result.providers);
    }
    setLoading(false);
  };

  const handleStoreKey = async () => {
    if (!selectedProvider || !newKey) return;
    
    const result = await storeApiKey(selectedProvider, newKey);
    if (result.success) {
      setNewKey('');
      setSelectedProvider('');
      await loadProviders(); // Refresh list
      alert(result.message);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!confirm(`Delete ${provider} API key?`)) return;
    
    const result = await deleteApiKey(provider);
    if (result.success) {
      await loadProviders(); // Refresh list
      alert(result.message);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleValidateKey = async (provider: string) => {
    const result = await validateApiKey(provider);
    alert(result.isValid ? result.message : `Error: ${result.error}`);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="api-key-manager">
      <h2>API Key Management</h2>
      
      {/* Add new API key */}
      <div className="add-key-section">
        <h3>Add New API Key</h3>
        <select 
          value={selectedProvider} 
          onChange={(e) => setSelectedProvider(e.target.value)}
        >
          <option value="">Select Provider</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
          <option value="google">Google (Gemini)</option>
        </select>
        
        <input
          type="password"
          placeholder="Enter API key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        
        <button onClick={handleStoreKey}>Store API Key</button>
      </div>

      {/* List existing keys */}
      <div className="keys-list">
        <h3>Your API Keys</h3>
        {providers.map(provider => (
          <div key={provider.name} className="provider-row">
            <span className="provider-name">{provider.displayName}</span>
            <span className={`status ${provider.hasKey ? 'has-key' : 'no-key'}`}>
              {provider.hasKey ? '✅ Configured' : '❌ Not configured'}
            </span>
            
            {provider.hasKey && (
              <div className="key-actions">
                <button onClick={() => handleValidateKey(provider.name)}>
                  Test
                </button>
                <button onClick={() => handleDeleteKey(provider.name)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApiKeyManagerComponent;
```

### **Vue.js Component Example**

```vue
<template>
  <div class="api-key-manager">
    <h2>API Key Management</h2>
    
    <!-- Add new API key -->
    <div class="add-key-section">
      <h3>Add New API Key</h3>
      <select v-model="selectedProvider">
        <option value="">Select Provider</option>
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI (GPT)</option>
        <option value="google">Google (Gemini)</option>
      </select>
      
      <input
        v-model="newKey"
        type="password"
        placeholder="Enter API key"
      />
      
      <button @click="handleStoreKey" :disabled="!selectedProvider || !newKey">
        Store API Key
      </button>
    </div>

    <!-- List existing keys -->
    <div class="keys-list">
      <h3>Your API Keys</h3>
      <div v-for="provider in providers" :key="provider.name" class="provider-row">
        <span class="provider-name">{{ provider.displayName }}</span>
        <span :class="`status ${provider.hasKey ? 'has-key' : 'no-key'}`">
          {{ provider.hasKey ? '✅ Configured' : '❌ Not configured' }}
        </span>
        
        <div v-if="provider.hasKey" class="key-actions">
          <button @click="handleValidateKey(provider.name)">Test</button>
          <button @click="handleDeleteKey(provider.name)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ApiKeyManager',
  data() {
    return {
      providers: [],
      loading: true,
      newKey: '',
      selectedProvider: ''
    };
  },
  
  async created() {
    await this.loadProviders();
  },
  
  methods: {
    async loadProviders() {
      this.loading = true;
      const result = await listAllProviders();
      if (result.success) {
        this.providers = result.providers;
      }
      this.loading = false;
    },
    
    async handleStoreKey() {
      if (!this.selectedProvider || !this.newKey) return;
      
      const result = await storeApiKey(this.selectedProvider, this.newKey);
      if (result.success) {
        this.newKey = '';
        this.selectedProvider = '';
        await this.loadProviders();
        alert(result.message);
      } else {
        alert(`Error: ${result.error}`);
      }
    },
    
    async handleDeleteKey(provider) {
      if (!confirm(`Delete ${provider} API key?`)) return;
      
      const result = await deleteApiKey(provider);
      if (result.success) {
        await this.loadProviders();
        alert(result.message);
      } else {
        alert(`Error: ${result.error}`);
      }
    },
    
    async handleValidateKey(provider) {
      const result = await validateApiKey(provider);
      alert(result.isValid ? result.message : `Error: ${result.error}`);
    }
  }
};
</script>
```

### **Error Handling Patterns**

```typescript
// Comprehensive error handling for all CRUD operations
async function safeApiCall<T>(operation: () => Promise<T>): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('Unauthorized')) {
      return { success: false, error: 'Please log in again' };
    }
    if (error.message.includes('Invalid API key')) {
      return { success: false, error: 'The API key format is invalid' };
    }
    if (error.message.includes('Provider not supported')) {
      return { success: false, error: 'This AI provider is not supported' };
    }
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Usage
const result = await safeApiCall(() => storeApiKey('anthropic', 'sk-ant-key'));
if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### **Real-time Status Updates**

```typescript
// WebSocket or polling for real-time key status
class ApiKeyStatusMonitor {
  private client: RPCClient;
  private statusCallbacks: Map<string, (status: boolean) => void> = new Map();
  
  constructor(rpcClient: RPCClient) {
    this.client = rpcClient;
    this.startMonitoring();
  }
  
  // Subscribe to provider status changes
  onProviderStatusChange(provider: string, callback: (hasKey: boolean) => void) {
    this.statusCallbacks.set(provider, callback);
  }
  
  private async startMonitoring() {
    // Poll every 30 seconds for status changes
    setInterval(async () => {
      const result = await listAllProviders();
      if (result.success) {
        result.providers.forEach(provider => {
          const callback = this.statusCallbacks.get(provider.name);
          if (callback) {
            callback(provider.hasKey);
          }
        });
      }
    }, 30000);
  }
}

// Usage
const monitor = new ApiKeyStatusMonitor(client);
monitor.onProviderStatusChange('anthropic', (hasKey) => {
  updateUIStatus('anthropic', hasKey);
});
```

## 📋 **API Reference**

### Core RPC Methods

| Method | Description | Parameters | Storage Required |
|--------|-------------|------------|------------------|
| `health` | Server health check | None | None |
| `executeAIRequest` | Execute AI with protected prompts | `content`, `systemPrompt`, `apiKey?` | None |

### Key Management (When Using Storage)

| Method | Description | Parameters | PostgreSQL | File | Client |
|--------|-------------|------------|-------------|------|--------|
| `storeUserKey` | Store encrypted API key | `provider`, `apiKey` | ✅ | ✅ | ❌ |
| `getUserKey` | Check if key exists | `provider` | ✅ | ✅ | ❌ |
| `deleteUserKey` | Delete API key | `provider` | ✅ | ✅ | ❌ |
| `getUserProviders` | List configured providers | None | ✅ | ✅ | ❌ |
| `validateUserKey` | Validate key with provider | `provider` | ✅ | ✅ | ❌ |

### API Token System (PostgreSQL Only)

| Method | Description | Parameters | Pro Feature |
|--------|-------------|------------|-------------|
| `createAPIToken` | Create external access token | `name`, `scopes` | ✅ |
| `listAPITokens` | List user's tokens | None | ✅ |
| `revokeAPIToken` | Revoke access token | `tokenId` | ✅ |

### Authentication (Progressive System)

| Method | Description | Parameters |
|--------|-------------|------------|
| `initializeSession` | Create device session | `deviceId` |
| `getAuthStatus` | Get authentication level | `deviceId` |
| `upgradeToOAuth` | Upgrade to OAuth | `deviceId`, `provider`, `token` |

### tRPC Methods Available

| Method | Description | Type | Authentication |
|--------|-------------|------|----------------|
| `configureBYOK` | Configure user's API keys | Mutation | ✅ JWT Required |
| `executeAIRequest` | Execute AI request with system prompt protection | Mutation | ✅ JWT Required |
| `getUserProfile` | Get user capabilities and preferences | Query | ✅ JWT Required |
| `getUserTokenBalances` | Get user's token balances (subscription/one-time) | Query | ✅ JWT Required |
| `getUsageAnalytics` | Get usage analytics and history | Query | ✅ JWT Required |
| `health` | Check server health | Query | 🌐 Public |

### **💡 Current User Flow**

1. **User Authentication** - JWT token from your OpenSaaS application
2. **API Key Configuration** - `configureBYOK()` to store encrypted API keys
3. **AI Requests** - `executeAIRequest()` with system prompt protection
   - **Subscription users**: Uses virtual token balance
   - **BYOK users**: Uses their stored API keys

### **🆓 Free vs 💎 Pro Users**

| Feature | Free Users | Pro Users |
|---------|------------|-----------|
| **API Key Management** | 🔑 BYOK (Bring Your Own Key) | ✅ Server-provided keys |
| **Key Storage** | ✅ Encrypted in PostgreSQL | ❌ Not needed |
| **Setup Required** | ✅ Must store API key first | ❌ Works immediately |
| **Usage Limits** | 🔒 Limited by their API key | ✅ Higher limits on server keys |

## 🔐 **Authentication & Security**

### **All Users Must Be Authenticated**

**IMPORTANT**: This backend requires authentication for ALL users, regardless of payment method. This ensures system prompt protection and prevents API abuse.

```typescript
// ✅ SECURE: All requests require JWT authentication
const server = createRpcAiServer({
  // Enable authentication and token tracking
  tokenTracking: {
    enabled: true,
    databaseUrl: process.env.DATABASE_URL,
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  },
  
  // JWT configuration for user authentication
  jwt: {
    secret: process.env.OPENSAAS_JWT_SECRET,
    issuer: 'opensaas',
    audience: 'your-ai-backend'
  }
});
```

### **Authentication Flow**

#### **1. User Authentication (Required for All)**
```typescript
// VS Code Extension Example
const authSession = await vscode.authentication.getSession('opensaas', [], { 
  createIfNone: true 
});

// Store JWT securely
await context.secrets.store('opensaas-jwt', authSession.accessToken);
```

#### **2. Making AI Requests (Same for All User Types)**
```typescript
// Client code - same for subscription, one-time, and BYOK users
const jwtToken = await getStoredJWT();

const response = await fetch('/trpc/ai.executeAIRequest', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,  // ✅ Always required
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: "function test() { return 42; }",
    systemPrompt: "Review this code for best practices",
    // ❌ NO apiKey parameter - handled server-side
  })
});
```

#### **3. BYOK Configuration (One-time Setup)**
```typescript
// Configure BYOK through authenticated endpoint
await fetch('/trpc/ai.configureBYOK', {
  method: 'POST', 
  headers: { 'Authorization': `Bearer ${jwtToken}` },
  body: JSON.stringify({
    providers: {
      anthropic: { enabled: true, apiKey: "sk-ant-..." },
      openai: { enabled: true, apiKey: "sk-..." }
    },
    enabled: true
  })
});

// ✅ API keys stored encrypted server-side
// ✅ No API keys in subsequent requests
```

### **Payment Methods & User Types**

| User Type | Authentication | Payment Method | Setup Required |
|-----------|----------------|----------------|----------------|
| **Subscription** | ✅ JWT Required | Platform tokens | Sign in only |
| **One-time Purchase** | ✅ JWT Required | Platform tokens | Sign in only |
| **BYOK** | ✅ JWT Required | User's API keys | Sign in + configure keys |

### **Server-Side Payment Method Selection**

The server automatically determines payment method based on user's configuration:

```typescript
// Server logic (automatic)
async function executeAIRequest({ content, systemPrompt }, { user }) {
  const userId = user.userId; // From validated JWT
  
  // 1. Check managed token balances
  const managedTokens = await getUserTokenBalances(userId);
  const totalTokens = managedTokens.reduce((sum, b) => sum + b.balance, 0);
  
  if (totalTokens >= estimatedTokens) {
    // ✅ Use subscription/one-time tokens
    return executeWithManagedTokens(userId, estimatedTokens);
  }
  
  // 2. Fallback to stored BYOK keys
  const profile = await getUserProfile(userId);
  const storedApiKey = profile.byokProviders?.anthropic?.apiKey;
  
  if (storedApiKey) {
    // ✅ Use user's stored API key (encrypted)
    return executeWithStoredBYOK(storedApiKey, content, systemPrompt);
  }
  
  // 3. No payment method available
  throw new Error('Please configure payment method or purchase tokens');
}
```

### **Security Features**

#### **✅ System Prompt Protection**
- Only authenticated users can access proprietary prompts
- JWT validates requests come from authorized applications
- No unauthorized access to valuable intellectual property

#### **✅ API Key Security** 
- BYOK keys stored encrypted on server (AES-256-GCM)
- No API keys transmitted in client requests
- Keys associated with authenticated users only

#### **✅ Origin Validation**
- JWT issuer validation prevents arbitrary web apps from accessing API
- Only authorized applications (VS Code extension, approved web apps) can connect
- Enterprise-grade access control

#### **✅ Complete Audit Trail**
- All usage tracked to authenticated users
- Comprehensive analytics regardless of payment method
- Enterprise compliance and abuse detection

### **VS Code Extension Integration**

```typescript
// Extension activation
export async function activate(context: vscode.ExtensionContext) {
  // 1. Authenticate user
  const authSession = await vscode.authentication.getSession('opensaas', [], { 
    createIfNone: true 
  });
  
  // 2. Store JWT securely
  await context.secrets.store('opensaas-jwt', authSession.accessToken);
  
  // 3. Optional: Configure BYOK for this user
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Anthropic API key (optional)',
    password: true
  });
  
  if (apiKey) {
    await configureBYOK(authSession.accessToken, { 
      anthropic: { enabled: true, apiKey } 
    });
  }
}

// Making AI requests
async function reviewCode(code: string) {
  const jwtToken = await context.secrets.get('opensaas-jwt');
  
  // Same request for all user types
  const response = await fetch('/trpc/ai.executeAIRequest', {
    headers: { 'Authorization': `Bearer ${jwtToken}` },
    body: JSON.stringify({
      content: code,
      systemPrompt: "proprietary-code-review-prompt"
    })
  });
  
  const result = await response.json();
  
  // Server automatically selected payment method
  console.log('Payment method used:', result.consumption?.plan);
  
  return result.data;
}
```

### **Enterprise Deployment**

#### **Corporate Authentication Setup**
```typescript
// Corporate backend configuration
const server = createRpcAiServer({
  jwt: {
    secret: process.env.CORPORATE_JWT_SECRET,
    issuer: 'corporate-sso',
    audience: 'ai-backend.company.com'
  },
  
  tokenTracking: {
    enabled: true,
    databaseUrl: process.env.CORPORATE_DB_URL
  },
  
  cors: {
    origin: ['https://vscode-extension.company.com'],
    credentials: true
  }
});
```

#### **User Onboarding Flow**
1. **IT Setup**: Deploy backend with corporate SSO integration
2. **Developer Setup**: Install VS Code extension, sign in with corporate credentials
3. **Payment Configuration**: IT configures team subscription or BYOK policies
4. **Usage**: Developers make AI requests automatically with proper cost attribution

### **Migration from Public API**

If you currently allow unauthenticated access, here's how to migrate:

#### **Before (Insecure)**
```typescript
// ❌ OLD: Allowed unauthenticated access
app.post('/ai/request', (req, res) => {
  const { content, systemPrompt, apiKey } = req.body;
  // Anyone could call this with any API key
});
```

#### **After (Secure)**
```typescript
// ✅ NEW: All users authenticated
executeAIRequest: protectedProcedure
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user!.userId; // Guaranteed to exist
    // Server determines payment method automatically
  });
```

#### **Client Migration**
```typescript
// ❌ OLD: API keys in requests
const response = await fetch('/ai/request', {
  body: JSON.stringify({
    content: code,
    systemPrompt: prompt,
    apiKey: "sk-ant-..." // ❌ Exposed in client
  })
});

// ✅ NEW: JWT authentication only
const response = await fetch('/trpc/ai.executeAIRequest', {
  headers: { 'Authorization': `Bearer ${jwtToken}` }, // ✅ Secure
  body: JSON.stringify({
    content: code,
    systemPrompt: prompt
    // ❌ No apiKey - handled server-side
  })
});
```

### **Testing Authentication**

```bash
# Test server with authentication
pnpm test:auth

# Test VS Code extension integration
pnpm test:vscode-auth

# Test enterprise SSO integration  
pnpm test:enterprise-auth
```

### **Common Authentication Patterns**

#### **Multi-Provider Support**
```typescript
// Configure multiple BYOK providers
await rpc.ai.configureBYOK({
  providers: {
    anthropic: { enabled: true, apiKey: "sk-ant-..." },
    openai: { enabled: true, apiKey: "sk-..." },
    google: { enabled: false }
  }
});

// Server automatically selects best provider
```

#### **Hybrid Payment Methods**
```typescript
// User can have subscription + BYOK fallback
const result = await rpc.ai.executeAIRequest({
  content: largeCodebase,
  systemPrompt: "comprehensive-analysis"
});

// Server response shows payment method used
console.log(result.consumption);
// {
//   plan: [
//     { type: 'subscription', tokensUsed: 5000 },
//     { type: 'byok', tokensUsed: 3000 }
//   ],
//   fallbackUsed: true,
//   notifications: ["Subscription tokens exhausted, used BYOK"]
// }
```

This authentication model ensures enterprise-grade security while maintaining developer-friendly experience across all payment methods.

## 📖 **OpenRPC Documentation & Playground**

This package provides a complete **OpenRPC** specification - the JSON-RPC equivalent of OpenAPI for REST APIs.

### 🎮 Interactive Development Playground

```bash
# Install dependencies
pnpm install

# Start development with OpenRPC Inspector (Swagger-like UI)
pnpm run dev:docs
```

**OpenRPC Inspector URL:** http://localhost:3002

**Features:**
- 🎨 **Modern UI** - Clean, professional interface similar to Swagger UI
- 🔍 **Better schema visualization** - Cleaner parameter and response displays
- 🎮 **Interactive testing** - Try API methods directly in the browser
- 📋 **Collapsible sections** - Organized, easy-to-navigate documentation

### 🔧 **tRPC Documentation & Type Explorer**

**tRPC provides even better documentation through TypeScript itself:**

**Built-in Documentation:**
- ✅ **TypeScript Intellisense** - Hover over any method to see full documentation
- ✅ **Auto-completion** - VS Code shows all available methods and parameters
- ✅ **Type Explorer** - Navigate through types with Go to Definition
- ✅ **Runtime validation** - Zod schemas provide detailed error messages

**Accessing tRPC Documentation:**

```typescript
// In your IDE, hover over any method for instant docs
client.ai.executeAIRequest.mutate({
  content: 'code here',     // Hover shows: string (required)
  systemPrompt: 'review',   // Hover shows: available prompt names
  options: {
    maxTokens: 4096,       // Hover shows: number | undefined (1-200000)
    temperature: 0.1       // Hover shows: number | undefined (0-2)
  }
});
```

**Live API Explorer (tRPC Panel):**

tRPC Panel runs as a **separate development server** for clean separation of concerns:

```typescript
import { createRpcAiServer, createLocalPanelServer } from 'simple-rpc-ai-backend';

// 1. Start your main RPC server (port 8000)
const server = createRpcAiServer({
  port: 8000,
  protocols: { tRpc: true }  // Enable tRPC for panel integration
});
await server.start();

// 2. Start separate panel server (port 8080) 
const panelServer = createLocalPanelServer(server.getRouter(), 8080);
await panelServer.start();
```

**URLs:**
- **Main API:** http://localhost:8000/trpc/* (your application endpoints)  
- **Development Panel:** http://localhost:8080/ (interactive testing interface)

**Features:**
- 🎯 **Live schema exploration** - Browse all procedures with real-time type info
- 🔍 **Interactive testing** - Execute procedures directly in the browser  
- 📝 **Auto-generated docs** - Procedures, inputs, outputs all documented automatically
- 🔄 **Real-time updates** - Documentation updates as you change your code
- 🏗️ **Clean separation** - Panel excluded from production builds
- 🚀 **Independent operation** - Start/stop panel without affecting main server

**Comparison: Documentation Methods**

| Feature | OpenRPC (JSON-RPC) | tRPC Panel |
|---------|-------------------|------------|
| **Interactive Testing** | ✅ Inspector UI | ✅ Web interface |
| **Type Information** | 🟡 Manual schemas | ✅ Live from TypeScript |
| **IDE Integration** | ❌ External tool | ✅ Full TypeScript Intellisense |
| **Documentation Maintenance** | 🟡 Manual updates | ✅ Zero maintenance |
| **External Sharing** | ✅ Standards-based | ✅ Web interface |
| **Production Impact** | ✅ No overhead | ✅ Excluded from build |
| **Development Setup** | 🟡 Single command | 🟡 Two servers |
| **Standards Compliance** | ✅ OpenRPC standard | 🟡 Proprietary format |

**Clear Recommendation:**

🎯 **Choose ONE protocol based on your tech stack:**

**Use tRPC when:**
- ✅ **Full TypeScript stack** - Both client and server are TypeScript
- ✅ **Monorepo setup** - Shared types between frontend and backend
- ✅ **React/Vue/Svelte + Node.js/Express** - Modern web app architecture
- ✅ **VS Code extension + TypeScript backend** - Type safety across the stack

**Use JSON-RPC when:**
- ✅ **Mixed language stack** - FastAPI (Python) + React, Go backend + any frontend
- ✅ **Third-party integrations** - External systems need to consume your API
- ✅ **Legacy systems** - Existing JSON-RPC infrastructure
- ✅ **Multiple client types** - Mobile apps, CLI tools, webhooks

## 🛠️ **Development Tools Setup**

### 📡 **JSON-RPC Development with OpenRPC Inspector**

For JSON-RPC endpoints, use the OpenRPC Inspector (Swagger-like UI):

```bash
# Start main server + OpenRPC inspector
pnpm run dev:docs
```

**URLs:**
- **Main API:** http://localhost:8000/rpc (JSON-RPC endpoint)
- **OpenRPC Inspector:** http://localhost:3002 (interactive documentation)

**Features:**
- 🎮 **Interactive testing** - Execute JSON-RPC methods directly in browser
- 📋 **Complete schema** - All methods, parameters, and responses documented
- 🎨 **Modern UI** - Clean interface similar to Swagger UI
- 📖 **Standards compliant** - Full OpenRPC specification

### ⚡ **tRPC Development with Panel Server**

For tRPC endpoints, use the separate panel server approach:

```bash
# Terminal 1: Start your main server
node your-server.js

# Terminal 2: Start panel server (separate process)
node -e "
import { createLocalPanelServer, createRpcAiServer } from 'simple-rpc-ai-backend';
const server = createRpcAiServer({ protocols: { tRpc: true } });
await server.start();
const panel = createLocalPanelServer(server.getRouter(), 8080);
await panel.start();
"
```

**Or use the included example:**

```bash
# Run the complete panel example
node examples/dev-tools/trpc-panel-example.js
```

**URLs:**
- **Main API:** http://localhost:8000/trpc/* (tRPC endpoint)
- **Development Panel:** http://localhost:8080/ (interactive testing interface)

**Benefits:**
- 🏗️ **Clean separation** - Panel runs independently from main server
- 🚀 **Production ready** - Panel excluded from production builds
- 🔄 **Live updates** - Schema changes reflected immediately
- 💻 **Resource isolation** - Panel doesn't affect main server performance

### 🎯 **Quick Development Workflow**

**Choose your approach based on protocol:**

| Protocol | Start Command | API URL | Dev Tools URL | Use Case |
|----------|---------------|---------|---------------|----------|
| **JSON-RPC** | `pnpm run dev:docs` | `localhost:8000/rpc` | `localhost:3002` | Universal compatibility |
| **tRPC** | `node examples/dev-tools/trpc-panel-example.js` | `localhost:8000/trpc/*` | `localhost:8080/` | TypeScript projects |

### 🔧 **Custom Development Setup**

**Advanced: Custom panel configuration**

```typescript
import { TrpcPanelServer } from 'simple-rpc-ai-backend';

const panelServer = new TrpcPanelServer({
  port: 8080,
  path: '/api-docs',  // Custom path
  trpcUrl: 'http://localhost:8000/trpc',
  router: yourRouter,
  transformer: 'superjson'
});

await panelServer.start();
```

**Development vs Production:**

```typescript
// Development: Both servers
if (process.env.NODE_ENV === 'development') {
  const panelServer = createLocalPanelServer(server.getRouter());
  await panelServer.start();
}

// Production: Main server only
const server = createRpcAiServer({/* config */});
await server.start();
```

## 🧪 **Testing**

### Test Coverage Requirements

```bash
# Full test suite with >80% coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Integration tests
pnpm test:integration
```

### Test Different Storage Options

```bash
# Test file storage
STORAGE_TYPE=file pnpm test

# Test PostgreSQL integration (requires Docker)
pnpm run vaultwarden:start
STORAGE_TYPE=vaultwarden pnpm test

# Test client-managed keys
STORAGE_TYPE=client_managed pnpm test
```

## 🧪 **Testing the Authentication Flow**

### **Testing Strategy: Split into Multiple Phases**

The authentication flow has multiple layers that should be tested independently before testing the complete integration:

### **Phase 1: Test PostgreSQL Directly (Infrastructure)**

Test the PostgreSQL server and Bitwarden SDK integration directly without RPC:

```bash
# 1. Start PostgreSQL infrastructure
pnpm run vaultwarden:start

# 2. Test direct PostgreSQL connection
npx ts-node test-vaultwarden-auth.ts
# Gets access token programmatically
# Tests basic API connectivity
# Validates service account setup

# 3. Test PostgreSQL secret operations
npx ts-node test-vaultwarden-direct.ts
# Tests secret CRUD operations
# Validates organization permissions
# Tests user API key workflow
```

**What Phase 1 Tests:**
- ✅ PostgreSQL server connectivity
- ✅ Service account authentication
- ✅ Organization permissions
- ✅ Secret storage/retrieval operations
- ✅ Bitwarden SDK integration

### **Phase 2: Test RPC Methods (Business Logic)**

Test the RPC methods that implement the auth flow:

```bash
# Test PostgreSQL RPC integration
npx ts-node test-vaultwarden-session.ts
# Tests PostgreSQLRPCMethods
# Tests JWT validation
# Tests auto-provisioning flow
```

**What Phase 2 Tests:**
- ✅ `configureBYOK` - JWT validation + encrypted key storage
- ✅ `executeAIRequest` - System prompt protection + usage tracking

### **Phase 3: Test Complete End-to-End Flow**

Test the complete auth flow with mock OpenSaaS JWT tokens:

```bash
# Test complete auth flow
pnpm test:auth-flow
# Or run manually:
npx ts-node test/integration/complete-auth-flow.test.ts
```

**Secure E2E Test Flow (Auto-Onboarding):**
```typescript
// 1. Mock OpenSaaS JWT generation
const mockJWT = generateMockOpenSaaSJWT({
  userId: 'test-user-123',
  email: 'testuser@company.com',
  subscriptionTier: 'pro'
});

// 2. Configure BYOK API keys (encrypted storage)
const storeResult = await trpcClient.configureBYOK.mutate({
  providers: {
    anthropic: {
      enabled: true,
      apiKey: 'sk-ant-test-key-12345'
    }
  }
});
// Result: { success: true, providersConfigured: ['anthropic'] }

// 3. Execute AI request with system prompt protection
const aiResult = await trpcClient.executeAIRequest.mutate({
  content: 'function test() { return "hello"; }',
  systemPrompt: 'You are an expert code reviewer. Analyze for bugs and improvements.',
  options: {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096
  }
});
// Result: AI analysis response with usage tracking

// Modern tRPC-based implementation with full type safety!
```

### **Testing REST API Directly (Without RPC)**

For debugging, you can test PostgreSQL's REST API directly:

```bash
# 1. Get access token
curl -X POST http://localhost:8081/identity/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=service@simple-rpc-ai.local&password=YOUR_PASSWORD&scope=api offline_access&client_id=web"

# 2. Test API with token
curl -X GET http://localhost:8081/api/sync \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"

# 3. Create a secret
curl -X POST http://localhost:8081/api/organizations/ORG_ID/secrets \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"test-api-key","value":"sk-ant-test-123","note":"Test API key"}'

# 4. List secrets
curl -X GET http://localhost:8081/api/organizations/ORG_ID/secrets \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **Test Configuration Files**

Create these environment files for testing:

**`.env.vaultwarden.test`:**
```bash
VW_DOMAIN=http://localhost:8081
VW_SERVICE_EMAIL=service@simple-rpc-ai.local
VW_SERVICE_PASSWORD=secure-service-password-123
VW_SERVICE_CLIENT_ID=web
VW_ADMIN_TOKEN=your-admin-token
SIMPLE_RPC_ORG_ID=your-org-uuid

# For testing with tokens
VW_ACCESS_TOKEN=your-access-token
VW_REFRESH_TOKEN=your-refresh-token
```

### **Recommended Test Sequence**

```bash
# 1. Infrastructure setup
pnpm run vaultwarden:setup
pnpm run vaultwarden:start
pnpm run vaultwarden:logs  # Check for errors

# 2. Phase 1: Direct PostgreSQL testing
npx ts-node test-vaultwarden-auth.ts     # Get access token
npx ts-node test-vaultwarden-direct.ts   # Test secret operations

# 3. Phase 2: RPC methods testing  
npx ts-node test-vaultwarden-session.ts  # Test RPC integration

# 4. Phase 3: End-to-end testing
pnpm test:auth-flow                       # Complete auth flow

# 5. Integration testing
pnpm test:integration                     # Full integration suite
```

### **Common Testing Issues & Solutions**

| Issue | Solution |
|-------|----------|
| **Connection refused** | Check `pnpm run vaultwarden:logs`, ensure PostgreSQL is running |
| **Authentication failed** | Verify service account exists, check password in `.env.vaultwarden` |
| **Organization not found** | Create organization in admin panel, set `SIMPLE_RPC_ORG_ID` |
| **Token expired** | Re-run `test-vaultwarden-auth.ts` to get fresh token |
| **Permission denied** | Ensure service account has organization access |

### **What Each Test Validates**

| Test File | Purpose | Validates |
|-----------|---------|-----------|
| `test-vaultwarden-auth.ts` | Get access tokens | Service account, basic auth |
| `test-vaultwarden-direct.ts` | Direct PostgreSQL operations | Secret CRUD, organization permissions |
| `test-secure-vault-manager.ts` | Secure RPC integration | Server-side crypto, JWT validation |
| Complete E2E test | Simplified full flow | OpenSaaS→Server→PostgreSQL→AI integration |

### **Simplified Testing Benefits**

✅ **No client-side crypto testing** - All encryption handled server-side  
✅ **No master password management** - Server generates vault passwords  
✅ **No token lifecycle testing** - Simplified JWT-only authentication  
✅ **Focus on business logic** - Test AI request flow, not crypto implementation

This layered testing approach helps isolate issues quickly and ensures each component works before testing the complete integration.

## 🤝 **Contributing**

We welcome contributions that maintain the **simple, flexible** philosophy:

### 🎯 **Contribution Guidelines**
- **Simplicity first** - Reject complexity that doesn't solve real problems
- **Storage flexibility** - Support multiple key management approaches
- **Standard tech** - HTTP, JSON-RPC, Express, PostgreSQL
- **Clear docs** - Honest about what we protect vs. don't protect
- **Minimal deps** - Keep the package lightweight and secure

### 🔧 **Development Setup**
```bash
git clone https://github.com/your-org/simple-rpc-ai-backend
cd simple-rpc-ai-backend
pnpm install

# Test all storage options
pnpm test:coverage

# Start development environment
pnpm run dev:docs  # OpenRPC Inspector at localhost:3002

# Test PostgreSQL integration
pnpm run vaultwarden:setup
pnpm run vaultwarden:start

# Backup and restore
pnpm run vaultwarden:backup
pnpm run vaultwarden:restore
```

## 📄 **License** 

MIT - Permissive licensing for easy adoption in commercial and open source projects.

---

## 💡 **Key Takeaways**

**The value isn't in complex custom implementations** - it's in solving real security and deployment problems:

**Real value comes from:**
- 🔒 **System prompt protection** (works with any storage option)
- 🏢 **Corporate proxy bypass** through backend architecture
- ⚡ **Flexible deployment** - PostgreSQL, file storage, or client-managed
- 📦 **Standard protocols** (JSON-RPC 2.0, HTTPS)
- 🎯 **Simple integration** for VS Code extensions

**This package focuses on practical solutions** that solve real problems for real developers, with the storage flexibility you need for any deployment scenario.

## 🔮 **Future: Model Context Protocol (MCP) Integration**

### **What is MCP?**
The Model Context Protocol (MCP) is a 2024 standard adopted by OpenAI, Google DeepMind, and Anthropic for AI tool integration. It's built on JSON-RPC 2.0 (same as our package).

### **Could We Support Both?**
**YES** - Our architecture could easily support both protocols:

```typescript
// Hybrid server supporting both protocols
app.post('/rpc', async (req, res) => {
  if (req.body.method.startsWith('tools/')) {
    return handleMCPRequest(req, res);    // MCP tool protocol
  }
  return handleAIRequest(req, res);       // Our AI backend protocol
});
```

**Current Status**: Our JSON-RPC 2.0 foundation makes future MCP integration straightforward if needed. Our focus remains on system prompt protection and flexible key management.
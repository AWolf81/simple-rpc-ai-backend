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
  port: 8080,
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
// your-ai-backend/server.js - Secure Server-Side Implementation
import { createRpcAiServer, SecureVaultManager } from 'simple-rpc-ai-backend';

// Initialize secure vault manager
const vaultManager = new SecureVaultManager({
  bitwardenConfig: loadPostgreSQLConfig(),
  databaseMasterKey: process.env.DATABASE_MASTER_KEY, // 64-char hex key
  userBridge: new UserIdentityBridge()
});

const server = createRpcAiServer({
  vaultManager,
  prompts: {
    // Your proprietary system prompts (server-side only!)
    myCustomAnalysis: `
      You are an expert in my domain-specific requirements.
      Analyze the code for: [your specific criteria]  
      Provide recommendations in this format: [your format]
    `,
    security_review: `
      You are a senior security engineer. Review code for vulnerabilities...
    `
  },
  serviceProviders: ['anthropic', 'openai', 'google'],
  port: 8000
});

// Register secure RPC methods (automatic onboarding built-in)
server.addMethod('vaultwarden.storeApiKey', async (params) => {
  // Auto-onboards user if needed - no explicit onboarding call required
  return await vaultManager.storeApiKey(
    params.opensaasJWT, 
    params.apiKey, 
    params.provider
  );
});

server.addMethod('executeAIRequest', async (params) => {
  // Auto-onboards user + retrieves keys automatically
  return await vaultManager.executeAIRequestWithAutoKey(
    params.opensaasJWT,
    params.content,
    params.systemPrompt,
    params.provider
  );
});

server.start();
```

**3. Ultra-simple client integration:**

```javascript
// your-vscode-extension/src/extension.js - Zero Crypto Complexity!
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');

export async function activate(context) {
  // Get OpenSaaS JWT (from your auth system)
  const opensaasJWT = await getOpenSaaSJWT();
  
  // Store API key once - server auto-onboards user transparently!
  await client.request('vaultwarden.storeApiKey', {
    opensaasJWT,
    apiKey: await getApiKeyFromUser(), 
    provider: 'anthropic'
  });

  // Use AI - server handles everything automatically!
  const result = await client.request('executeAIRequest', {
    opensaasJWT,
    content: code,
    systemPrompt: 'myCustomAnalysis',
    provider: 'anthropic'  // Server retrieves key + onboards if needed
  });
  
  // That's it! Zero onboarding calls, zero crypto, zero vault management!
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
| **Setup Complexity** | 🟡 PostgreSQL required | ✅ Zero setup | ✅ Zero server setup |
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

### Secure PostgreSQL Integration

| Method | Description | Parameters | Security |
|--------|-------------|------------|----------|
| `vaultwarden.storeApiKey` | Store API key (onboards user if needed) | `jwt`, `apiKey`, `provider` | ✅ BYOK - User provides own keys |
| `executeAIRequest` | Execute AI request | `jwt`, `content`, `systemPrompt`, `provider` | ✅ Pro users use server keys, Free users use BYOK |

### **💡 Corrected User Flow**

1. **User Authentication** - Sign up/login with OpenSaaS, Auth0, OAuth2, etc.
2. **API Key Storage** (Free users) - Store their own API key: `storeApiKey(jwt, apiKey, provider)`
3. **AI Requests** - Execute AI requests: `executeAIRequest(jwt, content, prompt, provider)`
   - **Free users**: Uses their stored BYOK API key
   - **Pro users**: Uses server-provided API key automatically

### **🆓 Free vs 💎 Pro Users**

| Feature | Free Users | Pro Users |
|---------|------------|-----------|
| **API Key Management** | 🔑 BYOK (Bring Your Own Key) | ✅ Server-provided keys |
| **Key Storage** | ✅ Encrypted in PostgreSQL | ❌ Not needed |
| **Setup Required** | ✅ Must store API key first | ❌ Works immediately |
| **Usage Limits** | 🔒 Limited by their API key | ✅ Higher limits on server keys |

## 🔐 **Authorization & Payment Features**

### **Progressive Authentication Flow**

The system supports **three authentication levels** with automatic upgrade paths:

```typescript
// 1. Anonymous Access (Limited)
const client = new RPCClient('http://localhost:8000');
const result = await client.request('executeAIRequest', {
  content: 'Hello world',
  systemPrompt: 'basic-assistant' // Limited to public prompts only
});

// 2. JWT-Based Authentication (Standard)
const client = new RPCClient('http://localhost:8000');
const result = await client.request('executeAIRequest', {
  jwt: 'eyJ...opensaas-jwt',     // From OpenSaaS, Auth0, etc.
  content: 'Hello world',
  systemPrompt: 'code-expert'   // Access to user plan features
});

// 3. Progressive Upgrade (Device Sessions)
await client.request('initializeSession', { deviceId: 'vscode-12345' });
await client.request('upgradeToOAuth', { 
  deviceId: 'vscode-12345', 
  provider: 'google',
  token: 'oauth-token' 
});
```

### **Plan-Based Feature Access**

Check user's subscription and usage status for client-side feature gating:

```typescript
// Check user's plan and usage limits
const userStatus = await client.request('getUserUsageStatus', {
  userId: 'user-123',
  userPlan: 'pro' // or 'free', 'enterprise'
});

// Response includes comprehensive payment/usage info
{
  plan: {
    planId: 'pro',
    displayName: 'Pro Plan',
    features: {
      systemPrompts: ['code-expert', 'security-audit', 'custom-prompts'],
      customSystemPrompts: true,
      analyticsAccess: true,
      priorityQueue: true
    },
    rateLimits: {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    }
  },
  quotaStatus: {
    'anthropic': {
      used: 15000,
      limit: 100000,
      resetDate: '2024-02-01T00:00:00Z',
      percentUsed: 15
    }
  },
  rateLimitStatus: {
    requestsThisMinute: 5,
    requestsThisHour: 45,
    requestsThisDay: 230,
    limits: { perMinute: 100, perHour: 1000, perDay: 10000 }
  }
}
```

### **Client-Side Feature Gating Examples**

Use payment/plan information to control UI and features:

```typescript
// Feature access control
if (userStatus.plan.features.customSystemPrompts) {
  showCustomPromptEditor();
}

if (userStatus.plan.features.analyticsAccess) {
  showUsageDashboard(userStatus.quotaStatus);
}

// Usage-based UI updates
const anthropicQuota = userStatus.quotaStatus.anthropic;
if (anthropicQuota.percentUsed > 90) {
  showQuotaWarning(`${anthropicQuota.percentUsed}% of monthly quota used`);
}

// Rate limit handling
const canMakeRequest = await client.request('canUserMakeRequest', {
  userId: 'user-123',
  provider: 'anthropic',
  userPlan: 'pro'
});

if (!canMakeRequest.allowed) {
  showRateLimitMessage(canMakeRequest.reason, canMakeRequest.retryAfter);
}
```

### **BYOK vs Server-Provided Keys**

Support multiple key management strategies based on subscription:

```typescript
// Free users: Bring Your Own Key (BYOK)
await client.request('storeUserKey', {
  userId: 'user@company.com',
  provider: 'anthropic',
  apiKey: 'sk-ant-user-provided-key',
  encrypted: true
});

// Pro users: Server-provided keys (automatic)
const result = await client.request('executeAIRequest', {
  jwt: 'eyJ...pro-user-jwt',
  content: 'Analyze this code',
  systemPrompt: 'security-expert' // Uses server's API keys automatically
});

// Check key source and quota remaining
const keyInfo = await client.request('getApiKeyForUser', {
  userId: 'user-123',
  provider: 'anthropic',
  userPlan: 'pro'
});
// Returns: { apiKey: '***', source: 'server_provided', quotaRemaining: 85000 }
```

### **Multi-Tenant Architecture**

Support multiple subscription tiers with flexible configurations:

```typescript
// Enterprise tier with custom limits
{
  planId: 'enterprise',
  keySource: 'server_provided', // Company provides API keys
  allowedProviders: ['anthropic', 'openai', 'google'],
  tokenQuotas: {
    'anthropic': { maxTokensPerPeriod: 1000000, resetInterval: 'monthly' },
    'openai': { maxTokensPerPeriod: 500000, resetInterval: 'monthly' }
  },
  features: {
    systemPrompts: '*', // Access to all prompts
    customSystemPrompts: true,
    analyticsAccess: true,
    priorityQueue: true
  }
}

// Startup tier with mixed approach  
{
  planId: 'startup',
  keySource: 'server_optional', // Server keys available, BYOK allowed
  allowedProviders: ['anthropic'],
  tokenQuotas: {
    'anthropic': { maxTokensPerPeriod: 50000, resetInterval: 'monthly' }
  },
  features: {
    systemPrompts: ['basic-assistant', 'code-helper'],
    customSystemPrompts: false,
    analyticsAccess: false
  }
}
```

### **Available Authorization Methods**

| Method | Description | Returns | Client Usage |
|--------|-------------|---------|--------------|
| `getUserUsageStatus` | Get plan, quotas, rate limits | Full user status | Feature gating, usage displays |
| `canUserMakeRequest` | Check if request is allowed | `{allowed, reason, retryAfter}` | Pre-request validation |
| `getAuthStatus` | Get authentication level | Device auth status | Progressive auth UI |
| `shouldSuggestUpgrade` | Check if upgrade needed | Upgrade recommendations | Subscription prompts |

## 🏗️ **RPC Architecture with System Prompt Protection**

```mermaid
sequenceDiagram
    participant Client as RPC Client<br/>(VS Code/Web/CLI)
    participant Proxy as Corporate Proxy<br/>(Traffic Monitor)
    participant Backend as Your RPC Backend<br/>(System Prompts Here)
    participant Storage as Key Storage<br/>(PostgreSQL/File/Client)
    participant AI as AI Provider<br/>(Anthropic/OpenAI/Google)
    
    Note over Client,AI: User triggers AI request
    
    Client->>Proxy: JSON-RPC: executeAIRequest(userContent, promptName)
    
    Note over Proxy: ✅ Sees user content only<br/>❌ Never sees system prompts
    
    Proxy->>Backend: Forward RPC request
    Backend->>Backend: Load system prompt by name (secure)
    
    alt Storage-Based Keys
        Backend->>Storage: Get user's API key (encrypted)
        Storage->>Backend: Return API key
    else Client-Managed Keys
        Note over Backend: API key provided in request
    end
    
    Backend->>AI: generateText(systemPrompt + userContent)
    AI->>Backend: Return AI response
    Backend->>Client: JSON-RPC response with results
    
    Note over Client,AI: 🔒 System prompts protected<br/>🚀 Corporate proxy friendly<br/>⚡ Flexible key management
```

## 🔐 **Detailed Authentication Architecture**

### **Secure Server-Side Architecture (Recommended)**

```mermaid
sequenceDiagram
    participant Client as RPC Client<br/>(VS Code Extension)
    participant RPC as RPC Backend<br/>(Secure Vault Manager)
    participant OpenSaaS as OpenSaaS Service<br/>(User Management & Billing)
    participant DB as Secure Database<br/>(Encrypted User Mappings)
    participant Vault as PostgreSQL Server<br/>(API Key Storage)
    participant AI as AI Provider<br/>(Anthropic/OpenAI)
    
    Note over Client,AI: Secure Server-Side Key Management
    
    rect rgb(240, 248, 255)
        Note over Client, OpenSaaS: 1. User Registration & JWT Generation
        Client->>OpenSaaS: User signs up / logs in
        OpenSaaS->>OpenSaaS: Generate JWT with user claims
        OpenSaaS->>Client: Return opensaasJWT
    end
    
    rect rgb(255, 248, 240)
        Note over Client, Vault: 2. User Onboarding (First API Key Storage)
        Client->>RPC: vaultwarden.storeApiKey(jwt, apiKey, provider)
        RPC->>RPC: Extract user identity (supports OAuth2 primary)
        RPC->>RPC: Generate secure vault password (64 chars, server-side)
        RPC->>Vault: Create PostgreSQL account with server password
        RPC->>DB: Store encrypted mapping with subscription tier
        
        Note over RPC: User onboarded when they store first API key!
    end
    
    rect rgb(248, 255, 248)
        Note over Client, Vault: 3. Secure API Key Storage (Combined with Onboarding)
        RPC->>DB: Get vault credentials for user (server-only)
        RPC->>Vault: Authenticate with server-generated password
        RPC->>Vault: Store API key directly in vault
        RPC->>Client: {success: true, keyId}
        
        Note over Client: Onboarding + key storage in one seamless operation!
    end
    
    rect rgb(240, 255, 240)
        Note over Client, AI: 4. AI Request Flow (Free vs Pro Users)
        Client->>RPC: executeAIRequest(jwt, content, systemPrompt, provider)
        RPC->>RPC: Check user exists (must store API key first)
        
        alt Free User (BYOK)
            RPC->>DB: Get vault credentials for user  
            RPC->>Vault: Retrieve user's encrypted API key
            Note over RPC: Uses user's own API key
        else Pro User
            RPC->>RPC: Get server-provided API key
            Note over RPC: Uses company's API key pool
        end
        
        RPC->>RPC: Combine content + server-side system prompt
        RPC->>AI: Make AI request with appropriate key
        AI->>RPC: Return AI response
        RPC->>Client: AI response
        
        Note over Client: Pro users get instant access, Free users need BYOK setup!
    end
    
    rect rgb(255, 255, 240)
        Note over OpenSaaS, RPC: 5. Billing Integration (Background)
        OpenSaaS->>RPC: Webhook: user.created, payment.completed, etc.
        RPC->>RPC: Update billing preferences via SeamlessOpenSaaSIntegration
        RPC->>RPC: Track usage with HybridBillingManager
        
        Note over RPC: Automatic credit management, usage tracking
    end
```

### **🔒 Secure Server-Side Key Management**

| Component | OpenSaaS JWT | Vault Password | API Keys | System Prompts | Vault User ID |
|-----------|-------------|----------------|----------|----------------|---------------|
| **Client** | ✅ Provides | ❌ Never sees | ✅ Provides once | ❌ Never sees | ❌ Never sees |
| **RPC Backend** | ✅ Validates | ✅ Generates & stores | ✅ Retrieves & uses | ✅ Stores securely | ✅ Manages internally |
| **Database** | ❌ | ✅ Encrypted storage | ❌ | ❌ | ✅ User mappings |
| **PostgreSQL** | ❌ | ✅ Account auth | ✅ Encrypted storage | ❌ | ✅ Internal user |
| **OpenSaaS** | ✅ Issues | ❌ | ❌ | ❌ | ❌ |

**True Zero-Knowledge Architecture**: Client provides JWT from any auth provider. Server handles all crypto securely!

### **🔄 Auth Provider Flexibility**

The RPC backend works with **any JWT-issuing auth provider**:

| Auth Provider | JWT Format | Integration |
|---------------|------------|-------------|
| **OpenSaaS** | `{ userId, email, subscriptionTier }` | ✅ Built-in support |
| **Auth0** | `{ sub, email, custom_claims }` | ✅ Automatic mapping |
| **Firebase** | `{ uid, email, firebase }` | ✅ Automatic mapping |  
| **Custom Backend** | `{ user_id, email, roles }` | ✅ Configurable mapping |
| **Enterprise SSO** | `{ employee_id, email, department }` | ✅ SAML/OIDC support |

**Example with different auth providers:**
```typescript
// OpenSaaS JWT
const openSaasResult = await client.request('executeAIRequest', {
  jwt: 'eyJ...opensaas-jwt',  // { userId: 'user-123', email: 'john@co.com' }
  content, systemPrompt, provider
});

// Auth0 JWT  
const auth0Result = await client.request('executeAIRequest', {
  jwt: 'eyJ...auth0-jwt',     // { sub: 'auth0|user-123', email: 'john@co.com' }
  content, systemPrompt, provider
});

// Same user, same vault, different auth provider!
```

### **👥 Multiple User ID Support**

Users can have multiple IDs across different auth providers:

```typescript
// User starts with email/password
JWT1: { userId: 'user-123', email: 'john@company.com' }
// Creates vault: primaryUserId = 'user-123'

// Later adds Google OAuth
JWT2: { userId: 'user-123', googleId: 'google-98765', email: 'john@company.com' }
// Updates vault: alternateUserIds = ['google-98765']

// Later adds GitHub OAuth  
JWT3: { userId: 'user-123', githubId: 'github-54321', googleId: 'google-98765' }
// Updates vault: alternateUserIds = ['google-98765', 'github-54321']

// Same user, same vault, multiple auth methods!
```

**Benefits:**
- ✅ **Seamless auth provider migration** - Users keep their API keys
- ✅ **Multiple login methods** - Google, GitHub, SSO, email/password
- ✅ **No duplicate accounts** - System recognizes same user across providers
- ✅ **Enterprise flexibility** - Support any corporate auth system

### **🔐 What's Protected Where**

| Component | Sees User Code | Sees System Prompts | Sees API Keys | Your Control |
|-----------|---------------|---------------------|---------------|--------------|
| **VS Code Extension** | ✅ | ❌ | 🟡 (Client-managed only) | ❌ (User's machine) |
| **Corporate Proxy** | ✅ | ❌ | ❌ | ❌ (Company network) |
| **Your RPC Backend** | ✅ | ✅ | 🟡 (Depends on storage) | ✅ (Your server) |
| **PostgreSQL Storage** | ❌ | ❌ | ✅ (Encrypted) | ✅ (Your infrastructure) |
| **AI Provider** | ✅ | ✅ | ✅ | ❌ (External service) |

**Key Insight**: Corporate proxies and extension users never see your valuable system prompts regardless of storage option!

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

tRPC Panel is a **web-based API explorer** (like Swagger UI) that you add to your server:

```bash
# Install tRPC Panel for interactive API exploration
npm install trpc-panel

# Add to your server setup
import { renderTrpcPanel } from 'trpc-panel';

// Serve interactive API docs at /panel
app.use('/panel', (req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:8000/trpc',
      transformer: 'superjson'
    })
  );
});
```

**tRPC Panel URL:** http://localhost:8000/panel (web interface, not VS Code extension)

**Features:**
- 🎯 **Live schema exploration** - Browse all procedures with real-time type info
- 🔍 **Interactive testing** - Execute procedures directly in the browser
- 📝 **Auto-generated docs** - Procedures, inputs, outputs all documented automatically
- 🔄 **Real-time updates** - Documentation updates as you change your code

**Comparison: Documentation Methods**

| Feature | OpenRPC (JSON-RPC) | tRPC Built-in | tRPC Panel |
|---------|-------------------|---------------|------------|
| **Interactive Testing** | ✅ | ❌ | ✅ |
| **Type Information** | 🟡 Manual schemas | ✅ Automatic from TS | ✅ Live from TS |
| **IDE Integration** | ❌ | ✅ Full Intellisense | ❌ |
| **Documentation Maintenance** | 🟡 Manual updates | ✅ Zero maintenance | ✅ Zero maintenance |
| **External Sharing** | ✅ | ❌ | ✅ |
| **Standards Compliance** | ✅ OpenRPC standard | ❌ | ❌ |

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
- ✅ `vaultwarden.storeApiKey` - JWT validation + auto-onboarding + key encryption
- ✅ `executeAIRequest` - Auto-onboarding + key retrieval + AI execution

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

// 2. Test API key storage with automatic onboarding
const storeResult = await rpcClient.request('vaultwarden.storeApiKey', {
  opensaasJWT: mockJWT,
  apiKey: 'sk-ant-test-key-12345',  // Server auto-onboards user if needed
  provider: 'anthropic'
});
// Result: { success: true, keyId: 'vault-item-id' }
// User was onboarded transparently during this call!

// 3. Test AI request - works even for brand new users
const aiResult = await rpcClient.request('executeAIRequest', {
  opensaasJWT: mockJWT,
  content: 'function test() { return "hello"; }',
  systemPrompt: 'code_review', 
  provider: 'anthropic'  // Auto-onboards + retrieves key + executes AI
});
// Result: AI analysis response

// That's it! Zero onboarding calls needed - server handles everything automatically!
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
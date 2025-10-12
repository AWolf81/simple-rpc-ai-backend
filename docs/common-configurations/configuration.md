---
title: Server Configuration
parent: Common Configurations
grand_parent: Documentation
nav_order: 1
---

# Server Configuration

Complete reference for `createRpcAiServer()` configuration options.

## Basic Configuration

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8000,
  serverProviders: ['anthropic', 'openai', 'google']
});

await server.start();
```

---

## Configuration Options by Category

### Basic Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `8000` | Server port number |
| `trustProxy` | `boolean` | `false` | Enable trust proxy for reverse proxies |
| `debug.enableTiming` | `boolean` | `false` | Enable performance timing logs (see [Debug & Monitoring]({% link performance/debug-monitoring.md %})) |

**Example:**
```typescript
{
  port: 3000,
  trustProxy: true,
  debug: {
    enableTiming: true  // See Performance docs for details
  }
}
```

**See also:** [Performance Benchmarks]({% link performance/benchmarks.md %}) for timing analysis and optimization tips.

---

### AI Providers & Models

| Option | Type | Description |
|--------|------|-------------|
| `providers` | `(string \| ProviderConfig)[]` | Unified provider configuration (strings or objects) |
| `serverProviders` | `string[]` | Built-in provider names: `'anthropic'`, `'openai'`, `'google'` |
| `byokProviders` | `string[]` | Providers available for Bring-Your-Own-Key (BYOK) |
| `customProviders` | `CustomProvider[]` | Legacy custom provider configurations |
| `systemPrompts` | `Record<string, string>` | Named system prompt templates |
| `modelRestrictions` | `Record<string, {...}>` | Per-provider model allow/block lists |
| `aiLimits` | `AIRouterConfig` | Rate limits and token restrictions for AI operations |

#### Provider Configuration Approaches

**Approach 1: New Unified `providers` Configuration (Recommended)**
```typescript
{
  providers: [
    // Simple string form (uses environment variables)
    'anthropic',
    'openai',

    // Extended object form with per-provider config
    {
      name: 'google',
      apiKey: process.env.GOOGLE_API_KEY,  // Explicit API key
      defaultModel: 'gemini-1.5-flash',
      systemPrompts: {
        'default': 'You are a helpful Google assistant'
      },
      modelRestrictions: {
        allowedModels: ['gemini-1.5-flash', 'gemini-1.5-pro']
      }
    },

    // Custom provider (OpenAI-compatible)
    {
      name: 'deepseek',
      type: 'openai',  // Base provider type
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat'
    }
  ],

  // Global system prompts (can be overridden per-provider)
  systemPrompts: {
    'code-review': 'You are an expert code reviewer...'
  }
}
```

**Approach 2: Legacy Split Configuration (Still Supported)**
```typescript
{
  serverProviders: ['anthropic', 'openai'],
  byokProviders: ['anthropic', 'openai', 'google'],

  systemPrompts: {
    'code-review': 'You are an expert code reviewer...',
    'documentation': 'Generate clear documentation...'
  },

  modelRestrictions: {
    anthropic: {
      allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
      blockedModels: ['claude-2.1']
    },
    openai: {
      allowedPatterns: ['gpt-4*', 'gpt-3.5*']
    }
  },

  customProviders: [{
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    defaultModel: 'deepseek-chat'
  }]
}
```

**⚠️ Deprecated Pattern: Nested `ai` Configuration**

The following pattern is **deprecated** and should be avoided:

```typescript
// ❌ DEPRECATED: Don't nest AI config under 'ai' property
{
  ai: {
    providers: {
      anthropic: { apiKey: '...' }
    }
  }
}
```

**Why deprecated:** AI provider configuration belongs at the root level, not nested under an `ai` object. This pattern causes confusion and conflicts with the unified configuration approach.

**Migration:** Move all AI-related configuration to the root level using the `providers` array (Approach 1) or legacy split configuration (Approach 2).

**See:** [Provider Configuration Guide]({% link common-configurations/provider-configuration.md %}) for detailed migration instructions.

---

### MCP (Model Context Protocol)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mcp.enabled` | `boolean` | `true` | Enable MCP server |
| `mcp.transports.http` | `boolean` | `true` | HTTP transport at `/mcp` |
| `mcp.transports.stdio` | `boolean` | `false` | STDIO transport for Claude Desktop |
| `mcp.transports.sse` | `boolean` | `false` | Server-Sent Events transport |
| `mcp.auth.requireAuthForToolsList` | `boolean` | `false` | Require auth for `tools/list` |
| `mcp.auth.requireAuthForToolsCall` | `boolean` | `true` | Require auth for `tools/call` |
| `mcp.auth.publicTools` | `string[]` | `[]` | Tools accessible without auth |
| `mcp.adminUsers` | `string[]` | `[]` | Admin users (by email/username) |
| `mcp.defaultConfig.enableWebSearchTool` | `boolean` | `false` | Built-in web search tool |
| `mcp.defaultConfig.enableFilesystemTools` | `boolean` | `false` | Filesystem access tools |

**Example:**
```typescript
{
  mcp: {
    enabled: true,
    transports: {
      http: true,
      stdio: false
    },
    auth: {
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true,
      publicTools: ['greeting', 'echo']
    },
    adminUsers: ['admin@example.com'],
    defaultConfig: {
      enableWebSearchTool: true,
      enableFilesystemTools: false
    }
  }
}
```

---

### Server Workspaces

Server-managed directories for file operations (separate from MCP client roots).

| Option | Type | Description |
|--------|------|-------------|
| `serverWorkspaces.enabled` | `boolean` | Enable server-managed workspaces |
| `serverWorkspaces.defaultWorkspace.path` | `string` | Default workspace absolute path |
| `serverWorkspaces.defaultWorkspace.readOnly` | `boolean` | Read-only access |
| `serverWorkspaces.defaultWorkspace.allowedExtensions` | `string[]` | Allowed file extensions |
| `serverWorkspaces.defaultWorkspace.maxFileSize` | `number` | Max file size in bytes |
| `serverWorkspaces.additionalWorkspaces` | `Record<string, {...}>` | Named workspace configurations |

**Example:**
```typescript
{
  serverWorkspaces: {
    enabled: true,
    defaultWorkspace: {
      path: '/home/user/project',
      readOnly: false,
      allowedExtensions: ['.js', '.ts', '.json', '.md'],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    },
    additionalWorkspaces: {
      templates: {
        path: '/opt/templates',
        name: 'Server Templates',
        readOnly: true,
        allowedExtensions: ['.hbs', '.md']
      },
      logs: {
        path: '/var/logs/app',
        name: 'Application Logs',
        readOnly: true
      }
    }
  }
}
```

---

### Authentication & Security

#### OAuth Configuration

| Option | Type | Description |
|--------|------|-------------|
| `oauth.enabled` | `boolean` | Enable OAuth 2.0 server |
| `oauth.googleClientId` | `string` | Google OAuth client ID |
| `oauth.googleClientSecret` | `string` | Google OAuth client secret |
| `oauth.encryptionKey` | `string` | Token encryption key |
| `oauth.sessionStorage.type` | `'memory' \| 'file' \| 'redis'` | Session storage backend |
| `oauth.sessionStorage.filePath` | `string` | File path for file storage |
| `oauth.sessionStorage.redis` | `object` | Redis configuration |

**Example:**
```typescript
{
  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY,
    sessionStorage: {
      type: 'file',
      filePath: './logs/oauth-sessions.json'
    }
  }
}
```

#### JWT Authentication

| Option | Type | Description |
|--------|------|-------------|
| `jwt.secret` | `string` | JWT signing secret |
| `jwt.issuer` | `string` | Expected issuer |
| `jwt.audience` | `string` | Expected audience |

**Example:**
```typescript
{
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-service',
    audience: 'your-api'
  }
}
```

#### Rate Limiting

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rateLimit.windowMs` | `number` | `900000` | Time window (15 minutes) |
| `rateLimit.max` | `number` | `100` | Max requests per window |

**Example:**
```typescript
{
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  }
}
```

#### CORS Configuration

| Option | Type | Description |
|--------|------|-------------|
| `cors.origin` | `string \| string[]` | Allowed origins |
| `cors.credentials` | `boolean` | Allow credentials |

**Example:**
```typescript
{
  cors: {
    origin: ['http://localhost:3000', 'https://app.example.com'],
    credentials: true
  }
}
```

---

### Secret Manager (BYOK Storage)

| Option | Type | Description |
|--------|------|-------------|
| `secretManager.type` | `'postgresql'` | Storage backend type |
| `secretManager.host` | `string` | Database host |
| `secretManager.port` | `number` | Database port |
| `secretManager.database` | `string` | Database name |
| `secretManager.user` | `string` | Database user |
| `secretManager.password` | `string` | Database password |
| `secretManager.encryptionKey` | `string` | AES-256-GCM encryption key |

**Example:**
```typescript
{
  secretManager: {
    type: 'postgresql',
    host: process.env.SECRET_MANAGER_DB_HOST || 'localhost',
    port: parseInt(process.env.SECRET_MANAGER_DB_PORT) || 5432,
    database: process.env.SECRET_MANAGER_DB_NAME || 'secrets',
    user: process.env.SECRET_MANAGER_DB_USER,
    password: process.env.SECRET_MANAGER_DB_PASSWORD,
    encryptionKey: process.env.SECRET_MANAGER_ENCRYPTION_KEY
  }
}
```

---

### Token Tracking & Billing

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tokenTracking.enabled` | `boolean` | `false` | Enable usage tracking |
| `tokenTracking.platformFeePercent` | `number` | `25` | Platform fee percentage |
| `tokenTracking.databaseUrl` | `string` | - | PostgreSQL connection string |
| `tokenTracking.webhookSecret` | `string` | - | LemonSqueezy webhook secret |
| `tokenTracking.webhookPath` | `string` | `'/webhooks/lemonsqueezy'` | Webhook endpoint path |

**Example:**
```typescript
{
  tokenTracking: {
    enabled: true,
    platformFeePercent: 20,
    databaseUrl: process.env.DATABASE_URL,
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  }
}
```

---

### Protocol Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `protocols.jsonRpc` | `boolean` | `true` | Enable JSON-RPC endpoint at `/rpc` |
| `protocols.tRpc` | `boolean` | `false` | Enable tRPC endpoint at `/trpc` |

**Example:**
```typescript
{
  protocols: {
    jsonRpc: true,
    tRpc: true
  }
}
```

---

### Custom Paths

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `paths.jsonRpc` | `string` | `'/rpc'` | JSON-RPC endpoint path |
| `paths.tRpc` | `string` | `'/trpc'` | tRPC endpoint path |
| `paths.health` | `string` | `'/health'` | Health check endpoint |
| `paths.webhooks` | `string` | `'/webhooks/lemonsqueezy'` | Webhook endpoint |

**Example:**
```typescript
{
  paths: {
    jsonRpc: '/api/rpc',
    tRpc: '/api/trpc',
    health: '/api/health'
  }
}
```

---

### Custom Routers

Extend the server with custom tRPC procedures.

**Example:**
```typescript
import { router, publicProcedure } from 'simple-rpc-ai-backend';
import { z } from 'zod';

const mathRouter = router({
  add: publicProcedure
    .input(z.object({ a: z.number(), b: z.number() }))
    .mutation(({ input }) => ({ result: input.a + input.b }))
});

const server = createRpcAiServer({
  customRouters: {
    math: mathRouter
  }
});

// Available as: math.add via tRPC and JSON-RPC
```

---

## Complete Example

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  // Basic
  port: 8000,
  trustProxy: true,

  // AI Providers
  serverProviders: ['anthropic', 'openai'],
  byokProviders: ['anthropic', 'openai', 'google'],

  systemPrompts: {
    'default': 'You are a helpful assistant.'
  },

  modelRestrictions: {
    anthropic: {
      allowedModels: ['claude-3-5-sonnet-20241022']
    }
  },

  // MCP
  mcp: {
    enabled: true,
    auth: {
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true
    }
  },

  // Security
  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },

  cors: {
    origin: ['http://localhost:3000'],
    credentials: true
  },

  // Server Workspaces
  serverWorkspaces: {
    enabled: true,
    defaultWorkspace: {
      path: '/home/user/project',
      readOnly: false
    }
  },

  // Custom Routers
  customRouters: {
    // Your custom tRPC routers
  }
});

await server.start();
```

---

## Environment Variables

The server automatically loads environment variables from `.env` files. Common variables:

```bash
# AI Provider Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_ENCRYPTION_KEY=...

# Database
DATABASE_URL=postgresql://...
SECRET_MANAGER_DB_HOST=localhost
SECRET_MANAGER_DB_PORT=5432
SECRET_MANAGER_DB_NAME=secrets
SECRET_MANAGER_DB_USER=...
SECRET_MANAGER_DB_PASSWORD=...
SECRET_MANAGER_ENCRYPTION_KEY=...

# JWT
JWT_SECRET=...

# Billing
LEMONSQUEEZY_WEBHOOK_SECRET=...

# Server
SERVER_PORT=8000
NODE_ENV=production
LOG_LEVEL=info
```

---

## Configuration File

You can also use `.simplerpcaibackendrc` for persistent configuration:

```json
{
  "port": 8000,
  "serverProviders": ["anthropic", "openai"],
  "mcp": {
    "enabled": true
  }
}
```

See [Common Configurations]({{ site.baseurl }}{% link common-configurations/index.md %}) for more examples.

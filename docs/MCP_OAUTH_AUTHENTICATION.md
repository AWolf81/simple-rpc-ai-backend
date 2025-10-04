# MCP OAuth Authentication Configuration Guide

Complete guide for configuring authentication in the Model Context Protocol (MCP) server.

## Table of Contents
- [Overview](#overview)
- [Authentication Types](#authentication-types)
- [OAuth Configuration](#oauth-configuration)
- [JWT Configuration](#jwt-configuration)
- [Dual Authentication](#dual-authentication)
- [Authentication Flows](#authentication-flows)
- [Testing](#testing)
- [Production Considerations](#production-considerations)

## Overview

The MCP server supports multiple authentication strategies via the `authType` configuration:

```typescript
type MCPAuthType = 'oauth' | 'jwt' | 'both' | 'none';
```

**Default**: `'oauth'` (for backward compatibility)

### When to Use Each Type

| Auth Type | Use Case | Best For |
|-----------|----------|----------|
| `oauth` | User-facing applications with browser-based login | Web apps, MCP Jam, Claude Desktop with OAuth |
| `jwt` | Service-to-service communication | APIs, automated tools, server integrations |
| `both` | Flexible environments supporting multiple clients | Enterprise deployments, multi-client systems |
| `none` | Development/testing only | Local testing, demos (NOT for production) |

## Authentication Types

### 1. OAuth Authentication

OAuth 2.0 provides user-facing authentication with support for external providers (Google, GitHub, etc.).

**Configuration Location**: `src/trpc/routers/mcp/types.ts:6-37`

```typescript
interface MCPAuthConfig {
  authType?: 'oauth';  // ⭐ Set this to 'oauth'

  oauth?: {
    enabled?: boolean;              // Default: true when authType = 'oauth'
    sessionStorePath?: string;      // Path to OAuth session storage
    requireValidSession?: boolean;  // Default: true
  };

  requireAuthForToolsList?: boolean;  // Default: false (public discovery)
  requireAuthForToolsCall?: boolean;  // Default: true (protected execution)
  publicTools?: string[];             // Tools exempt from auth
}
```

### 2. JWT Authentication

JSON Web Token authentication for service-to-service communication.

```typescript
interface MCPAuthConfig {
  authType?: 'jwt';  // ⭐ Set this to 'jwt'

  jwt?: {
    enabled?: boolean;                // Default: true when authType = 'jwt'
    requireValidSignature?: boolean;  // Default: true
    requiredScopes?: string[];        // Required JWT scopes (e.g., ['mcp', 'mcp:call'])
    allowExpiredTokens?: boolean;     // Default: false
  };
}
```

### 3. Dual Authentication (Both)

Support both OAuth and JWT simultaneously.

```typescript
interface MCPAuthConfig {
  authType?: 'both';  // ⭐ Set this to 'both'

  oauth?: { enabled?: boolean; requireValidSession?: boolean; };
  jwt?: { enabled?: boolean; requiredScopes?: string[]; };
}
```

## OAuth Configuration

### Complete OAuth Setup

**Step 1: Server-Level OAuth Configuration**

Configure the OAuth server at the top level of your server config:

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8082,

  // 🔐 Server-level OAuth configuration
  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY || 'dev-key-min-32-chars-required!!',

    // Session storage options
    sessionStorage: {
      type: 'memory',  // 'memory' | 'file' | 'redis'

      // For file storage:
      // filePath: './oauth-sessions.json',

      // For Redis:
      // redis: {
      //   host: 'localhost',
      //   port: 6379,
      //   password: 'your-redis-password',
      //   db: 0,
      //   keyPrefix: 'oauth:'
      // }
    }
  },

  // 🔧 Trust proxy configuration for reverse proxies (ngrok, Cloudflare, etc.)
  trustProxy: process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true',

  // 🔧 MCP-specific OAuth configuration
  mcp: {
    enabled: true,
    auth: {
      authType: 'oauth',  // ⭐ Required: Set authentication type

      oauth: {
        enabled: true,                    // Enable OAuth for MCP
        sessionStorePath: './sessions',   // Optional: custom session path
        requireValidSession: true         // Require valid OAuth session
      },

      // Access control
      requireAuthForToolsList: false,  // tools/list is public (discovery)
      requireAuthForToolsCall: true,   // tools/call requires authentication
      publicTools: ['greeting', 'ping'] // Exception list for public tools
    }
  }
});

server.start();
```

**Step 2: Environment Variables**

Create `.env.oauth` file:

```bash
# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret

# Encryption key for token storage (min 32 characters)
ENCRYPTION_KEY=your-secure-random-key-min-32-chars-required

# Trust proxy for ngrok/CORS support
TRUST_PROXY=true
```

**Step 3: Trust Proxy Configuration (for ngrok/CORS)**

Configure trust proxy for proper CORS handling behind reverse proxies:

```bash
# Environment variable for reverse proxy support
TRUST_PROXY=true

# Or enable based on environment
NODE_ENV=production  # Automatically enables trust proxy
```

**Step 4: Google OAuth Setup**

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - Local: `http://localhost:8082/oauth/callback`
   - Ngrok: `https://your-ngrok-id.ngrok.io/oauth/callback`
4. Copy Client ID and Secret to `.env.oauth`

See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for detailed OAuth setup instructions.

### OAuth Session Storage Options

#### Memory Storage (Development)

```typescript
oauth: {
  enabled: true,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  sessionStorage: { type: 'memory' }  // ⚠️ Lost on restart
}
```

**Pros**: Fast, simple setup
**Cons**: Sessions lost on restart, not suitable for production

#### File Storage (Small Deployments)

```typescript
oauth: {
  enabled: true,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  sessionStorage: {
    type: 'file',
    filePath: './data/oauth-sessions.json'  // Persistent file storage
  }
}
```

**Pros**: Persistent across restarts, simple
**Cons**: Not suitable for multi-server deployments

#### Redis Storage (Production)

```typescript
oauth: {
  enabled: true,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  sessionStorage: {
    type: 'redis',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'oauth:session:'
    }
  }
}
```

**Pros**: Scalable, multi-server support, TTL support
**Cons**: Requires Redis server

## JWT Configuration

### Complete JWT Setup

JWT authentication is ideal for service-to-service communication and API integrations.

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8082,

  // 🔐 JWT configuration (if using OpenSaaS or custom JWT)
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-service',
    audience: 'mcp-api'
  },

  // 🔧 MCP-specific JWT configuration
  mcp: {
    enabled: true,
    auth: {
      authType: 'jwt',  // ⭐ Set authentication type to JWT

      jwt: {
        enabled: true,                      // Enable JWT authentication
        requireValidSignature: true,        // Verify JWT signature
        requiredScopes: ['mcp', 'mcp:call'], // Required scopes
        allowExpiredTokens: false           // Reject expired tokens
      },

      // Disable OAuth
      oauth: {
        enabled: false
      },

      // Access control
      requireAuthForToolsList: true,   // Require JWT for discovery
      requireAuthForToolsCall: true,   // Require JWT for execution
      publicTools: []                   // No public tools
    }
  }
});

server.start();
```

### JWT Token Format

MCP clients should send JWT tokens in the Authorization header:

```http
POST /mcp HTTP/1.1
Host: localhost:8082
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "greeting", "arguments": {} },
  "id": 1
}
```

### JWT Payload Structure

```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "scopes": ["mcp", "mcp:call", "mcp:admin"],
  "iss": "your-service",
  "aud": "mcp-api",
  "exp": 1735689600,
  "iat": 1735603200
}
```

## Dual Authentication

Support both OAuth and JWT authentication simultaneously.

### Use Cases

- **Enterprise deployments**: Web users via OAuth, services via JWT
- **Multi-client systems**: Claude Desktop (OAuth) + automation scripts (JWT)
- **Migration periods**: Gradual transition from OAuth to JWT or vice versa

### Configuration

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8082,

  // Both OAuth and JWT server configs
  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionStorage: { type: 'redis', redis: { /* ... */ } }
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-service',
    audience: 'mcp-api'
  },

  // MCP with dual authentication
  mcp: {
    enabled: true,
    auth: {
      authType: 'both',  // ⭐ Support both OAuth and JWT

      oauth: {
        enabled: true,
        requireValidSession: true
      },

      jwt: {
        enabled: true,
        requireValidSignature: true,
        requiredScopes: ['mcp'],
        allowExpiredTokens: false
      },

      // Access control (applies to both auth types)
      requireAuthForToolsList: false,  // Public discovery
      requireAuthForToolsCall: true,   // Auth required for execution
      publicTools: ['greeting']         // Public tools exception
    }
  }
});

server.start();
```

### Authentication Priority

When `authType: 'both'`, the server accepts either OAuth or JWT:

1. Check for OAuth session (if `oauth.enabled: true`)
2. Check for JWT token (if `jwt.enabled: true`)
3. If both present, both are validated
4. If neither present and auth required → 401 Unauthorized

## Authentication Flows

### OAuth Flow

```
┌─────────────┐                 ┌─────────────┐                 ┌─────────────┐
│             │                 │             │                 │             │
│  MCP Client │                 │  MCP Server │                 │   Google    │
│  (Browser)  │                 │             │                 │   OAuth2    │
│             │                 │             │                 │             │
└──────┬──────┘                 └──────┬──────┘                 └──────┬──────┘
       │                               │                               │
       │  1. Discovery Request         │                               │
       │  GET /.well-known/...         │                               │
       ├──────────────────────────────>│                               │
       │                               │                               │
       │  2. OAuth Endpoints           │                               │
       │  (authorize, token, etc.)     │                               │
       │<──────────────────────────────┤                               │
       │                               │                               │
       │  3. Redirect to /oauth/authorize                              │
       ├──────────────────────────────>│                               │
       │                               │  4. Redirect to Google        │
       │                               ├──────────────────────────────>│
       │                               │                               │
       │  5. Google Login Page                                         │
       │<──────────────────────────────────────────────────────────────┤
       │                               │                               │
       │  6. User Authenticates        │                               │
       ├──────────────────────────────────────────────────────────────>│
       │                               │                               │
       │  7. Redirect with code        │                               │
       │<──────────────────────────────────────────────────────────────┤
       │                               │                               │
       │  8. Exchange code for token   │                               │
       │  POST /oauth/token            │                               │
       ├──────────────────────────────>│                               │
       │                               │  9. Validate code with Google │
       │                               ├──────────────────────────────>│
       │                               │                               │
       │                               │  10. User info + tokens       │
       │                               │<──────────────────────────────┤
       │                               │                               │
       │  11. Access token + session   │                               │
       │<──────────────────────────────┤                               │
       │                               │                               │
       │  12. MCP Request with token   │                               │
       │  POST /mcp                    │                               │
       │  Authorization: Bearer <token>│                               │
       ├──────────────────────────────>│                               │
       │                               │                               │
       │  13. MCP Response             │                               │
       │<──────────────────────────────┤                               │
       │                               │                               │
```

### JWT Flow

```
┌─────────────┐                 ┌─────────────┐
│             │                 │             │
│  MCP Client │                 │  MCP Server │
│  (Service)  │                 │             │
│             │                 │             │
└──────┬──────┘                 └──────┬──────┘
       │                               │
       │  1. MCP Request with JWT      │
       │  POST /mcp                    │
       │  Authorization: Bearer <jwt>  │
       ├──────────────────────────────>│
       │                               │
       │                               │  2. Validate JWT
       │                               │     - Signature
       │                               │     - Expiration
       │                               │     - Scopes
       │                               │
       │  3. MCP Response              │
       │<──────────────────────────────┤
       │                               │
```

## Testing

### Local Testing with Ngrok

**Step 1: Start the server with trust proxy enabled:**

```bash
# Enable trust proxy for reverse proxy support
export TRUST_PROXY=true

# Or set in .env.oauth
echo "TRUST_PROXY=true" >> .env.oauth

# Start the OAuth-enabled server
pnpm demo:oauth
```

**Step 2: Start ngrok for local testing:**

```bash
# Install ngrok if not already installed
# npm install -g ngrok  # or download from https://ngrok.com/

# Start ngrok tunnel to your local server
ngrok http 8082
```

Ngrok will output:
```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us-cal-1)
Forwarding                    https://abc123.ngrok.io -> http://localhost:8082

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Step 3: Update Google OAuth redirect URI:**

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Edit your OAuth 2.0 Client ID
3. Add ngrok URL to authorized redirect URIs:
   - `https://abc123.ngrok.io/oauth/callback` (replace abc123 with your ngrok ID)

**Step 4: Test OAuth with ngrok URL:**

```bash
# Verify OAuth discovery works through ngrok
curl https://abc123.ngrok.io/.well-known/oauth-authorization-server
```

**Step 5: Test MCP with OAuth:**

```bash
# In a separate terminal
cd path/to/mcp-jam
npm start
```

Visit `http://localhost:4000` and connect to `https://abc123.ngrok.io/mcp`

The OAuth flow will now work correctly with ngrok because:
- `trustProxy: true` tells Express to trust `X-Forwarded-*` headers
- CORS middleware can properly validate the origin from proxy headers
- OAuth redirects use the ngrok URL instead of localhost

### OAuth Testing (Direct localhost)

**1. Start the OAuth-enabled server:**

```bash
pnpm demo:oauth
```

**2. Verify OAuth discovery endpoints:**

```bash
curl http://localhost:8082/.well-known/oauth-authorization-server
```

Expected response:
```json
{
  "issuer": "http://localhost:8082",
  "authorization_endpoint": "http://localhost:8082/oauth/authorize",
  "token_endpoint": "http://localhost:8082/oauth/token",
  "userinfo_endpoint": "http://localhost:8082/oauth/userinfo",
  "registration_endpoint": "http://localhost:8082/register",
  "jwks_uri": "http://localhost:8082/.well-known/jwks.json"
}
```

**3. Test with MCP Jam (localhost):**

```bash
# In a separate terminal
cd path/to/mcp-jam
npm start
```

Visit `http://localhost:4000` and connect to `http://localhost:8082/mcp`

### JWT Testing

**1. Generate a test JWT:**

```bash
# Using jwt.io or a JWT library
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  {
    sub: 'test-user',
    email: 'test@example.com',
    scopes: ['mcp', 'mcp:call']
  },
  'your-jwt-secret',
  {
    expiresIn: '1h',
    issuer: 'your-service',
    audience: 'mcp-api'
  }
);
console.log(token);
"
```

**2. Test MCP request with JWT:**

```bash
curl -X POST http://localhost:8082/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

### Dual Authentication Testing

Test both OAuth and JWT work simultaneously:

```bash
# Test OAuth flow (use browser)
open http://localhost:8082/oauth/authorize

# Test JWT in same server
curl -X POST http://localhost:8082/mcp \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Production Considerations

### Security Checklist

- [ ] **Use HTTPS**: Never use OAuth over plain HTTP in production
- [ ] **Strong encryption keys**: Min 32 characters, cryptographically random
- [ ] **Secure session storage**: Use Redis or database, not memory/file
- [ ] **Token rotation**: Implement refresh token rotation
- [ ] **Rate limiting**: Enable rate limiting on auth endpoints
- [ ] **Audit logging**: Enable security logging for auth events
- [ ] **Scope validation**: Require specific scopes for sensitive operations
- [ ] **Token expiration**: Set reasonable expiration times (1h access, 7d refresh)

### OAuth Production Config

```typescript
const server = createRpcAiServer({
  port: 443,  // HTTPS

  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,  // From secrets manager
    sessionStorage: {
      type: 'redis',
      redis: {
        host: process.env.REDIS_HOST,
        port: 6379,
        password: process.env.REDIS_PASSWORD,
        db: 0,
        keyPrefix: 'oauth:prod:',
        tls: true  // Enable TLS for Redis connection
      }
    }
  },

  mcp: {
    enabled: true,
    auth: {
      authType: 'oauth',
      oauth: {
        enabled: true,
        requireValidSession: true
      },
      requireAuthForToolsList: false,   // Allow public discovery
      requireAuthForToolsCall: true,    // Require auth for execution
      publicTools: []                   // No public tools in production
    },

    // Enable security features
    rateLimiting: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 100,
      maxToolCalls: 50
    },

    securityLogging: {
      enabled: true,
      logLevel: 'info',
      logToFile: true,
      logFilePath: '/var/log/mcp-security.log'
    },

    authEnforcement: {
      enabled: true,
      requireAuth: true,
      requireValidSession: true
    }
  }
});
```

### JWT Production Config

```typescript
const server = createRpcAiServer({
  port: 443,

  jwt: {
    secret: process.env.JWT_SECRET,  // From secrets manager
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE
  },

  mcp: {
    enabled: true,
    auth: {
      authType: 'jwt',
      jwt: {
        enabled: true,
        requireValidSignature: true,
        requiredScopes: ['mcp', 'mcp:call'],
        allowExpiredTokens: false
      },
      oauth: { enabled: false },
      requireAuthForToolsList: true,   // Require JWT for everything
      requireAuthForToolsCall: true,
      publicTools: []
    },

    // Security features...
    rateLimiting: { enabled: true, maxRequests: 100 },
    securityLogging: { enabled: true },
    authEnforcement: { enabled: true }
  }
});
```

### Environment Variables Best Practices

```bash
# Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
# Never commit these to version control

# OAuth
GOOGLE_CLIENT_ID=from_secrets_manager
GOOGLE_CLIENT_SECRET=from_secrets_manager
ENCRYPTION_KEY=from_secrets_manager

# JWT
JWT_SECRET=from_secrets_manager
JWT_ISSUER=your-service-name
JWT_AUDIENCE=mcp-api

# Redis
REDIS_HOST=redis.production.internal
REDIS_PORT=6379
REDIS_PASSWORD=from_secrets_manager
REDIS_TLS=true

# Server
NODE_ENV=production
TRUST_PROXY=true  # Required for reverse proxy/CDN deployments
PORT=443
LOG_LEVEL=info
```

## Troubleshooting

### Common Issues

**Problem**: "OAuth failed" with no clear error

**Solution**:
1. Check Google OAuth redirect URI matches exactly
2. Verify client ID and secret in `.env.oauth`
3. Check server is running on correct port
4. Test discovery endpoint: `curl http://localhost:8082/.well-known/oauth-authorization-server`
5. If using ngrok/CDN: Ensure `TRUST_PROXY=true` is set
6. Verify OAuth redirect URI includes the ngrok/CDN URL for proxy setups

---

**Problem**: JWT authentication fails with "Invalid signature"

**Solution**:
1. Verify JWT secret matches between client and server
2. Check JWT payload includes required scopes
3. Verify issuer and audience match configuration
4. Check token hasn't expired

---

**Problem**: "Session not found" error with OAuth

**Solution**:
1. Check session storage is properly configured
2. For Redis: verify connection with `redis-cli ping`
3. For file storage: verify write permissions
4. Check encryption key hasn't changed (invalidates old sessions)

---

**Problem**: MCP tools/call returns 401 even with valid token

**Solution**:
1. Verify `requireAuthForToolsCall: true` is set
2. Check tool isn't in `publicTools` list
3. Verify token/session is still valid
4. Check JWT scopes include 'mcp:call'

## Related Documentation

- [OAuth Setup Guide](./OAUTH_SETUP.md) - Complete OAuth setup with Google
- [MCP Security](../specs/features/mcp-oauth-authentication.md) - Security architecture
- [Server Workspaces](./SERVER_WORKSPACES_VS_MCP_ROOTS.md) - Workspace management
- [Tool Usage](./TOOL_USAGE.md) - Using MCP tools

## Reference

### Configuration Files
- **Type definitions**: [src/trpc/routers/mcp/types.ts](../src/trpc/routers/mcp/types.ts)
- **Server config**: [src/rpc-ai-server.ts:111-128](../src/rpc-ai-server.ts#L111-L128)
- **Protocol handler**: [src/trpc/routers/mcp/protocol-handler.ts](../src/trpc/routers/mcp/protocol-handler.ts)

### Test Helpers
- **OAuth config**: `createOAuthMCPConfig()` in [src/security/test-helpers.ts:187-199](../src/security/test-helpers.ts#L187-L199)
- **JWT config**: `createJWTMCPConfig()` in [src/security/test-helpers.ts:163-182](../src/security/test-helpers.ts#L163-L182)

### Examples
- **OAuth demo**: `pnpm demo:oauth` - See `examples/authentication/` directory
- **Basic server**: `examples/01-basic-server/server.js`
- **MCP server**: `examples/02-mcp-server/server.js`

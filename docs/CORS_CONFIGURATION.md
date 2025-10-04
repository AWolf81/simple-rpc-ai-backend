# CORS Configuration Guide

Complete guide for configuring Cross-Origin Resource Sharing (CORS) in the Simple RPC AI Backend.

## Table of Contents
- [What is CORS?](#what-is-cors)
- [Configuration Options](#configuration-options)
- [Understanding credentials: true](#understanding-credentials-true)
- [Common Scenarios](#common-scenarios)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## What is CORS?

**Cross-Origin Resource Sharing (CORS)** is a security feature implemented by web browsers that controls which websites can access resources from your server.

### The Same-Origin Policy Problem

By default, browsers prevent JavaScript running on `https://example.com` from making requests to `https://api.different-domain.com`. This is called the **Same-Origin Policy**.

CORS allows you to selectively relax this restriction by telling browsers which origins (domains) are allowed to access your API.

### Why You Need CORS Configuration

You need CORS when:
- Your frontend runs on a different domain than your API (e.g., `http://localhost:3000` → `http://localhost:8000`)
- You want to use web-based tools like MCP Jam, OpenRPC Playground, or tRPC Playground
- You're building a browser-based client application
- You need to send cookies or authentication headers cross-origin

## Configuration Options

### Basic Configuration

**Location**: `src/rpc-ai-server.ts:130-134`

```typescript
interface RpcAiServerConfig {
  cors?: {
    origin?: string | string[];  // Which domains can access your API
    credentials?: boolean;       // Allow cookies/auth headers
  };
}
```

### Default Configuration

**Default behavior** (if you don't specify CORS):

```typescript
cors: {
  origin: '*',           // Allow all origins (permissive)
  credentials: false     // No cookies/auth headers (safe default)
}
```

**Implementation**: [src/rpc-ai-server.ts:461-465](../src/rpc-ai-server.ts#L461-L465)

### CORS Middleware Setup

The server uses the `cors` npm package with these settings:

```typescript
app.use(cors({
  origin: config.cors.origin,        // Your configured origins
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'mcp-protocol-version',
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Origin'
  ],
  optionsSuccessStatus: 200  // Legacy browser support
}));
```

**Implementation**: [src/rpc-ai-server.ts:692-707](../src/rpc-ai-server.ts#L692-L707)

## Understanding `credentials: true`

### What Does It Do?

`credentials: true` tells the browser to include sensitive data in cross-origin requests:

- **Cookies**: Session cookies, authentication cookies
- **Authorization headers**: Bearer tokens, API keys
- **Client certificates**: TLS client certificates

### When `credentials: false` (Default)

```http
GET /api/endpoint HTTP/1.1
Host: api.example.com
Origin: https://frontend.example.com
# ❌ No cookies sent
# ❌ No Authorization header
```

**Response:**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
# ✅ Works with wildcard origin
```

### When `credentials: true`

```http
GET /api/endpoint HTTP/1.1
Host: api.example.com
Origin: https://frontend.example.com
Cookie: session=abc123
Authorization: Bearer token123
# ✅ Cookies and auth headers included
```

**Response:**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://frontend.example.com
Access-Control-Allow-Credentials: true
# ⚠️ Cannot use wildcard (*) with credentials
```

### Important Security Rules

When using `credentials: true`:

1. **Cannot use wildcard origin**: `origin: '*'` is forbidden
2. **Must specify exact origins**: Use array or specific domain
3. **Browsers enforce this**: Server will work, but browser will block the response

## Common Scenarios

### Scenario 1: Development (Allow All Origins, No Credentials)

**Use Case**: Quick development, public APIs, no authentication

```typescript
const server = createRpcAiServer({
  cors: {
    origin: '*',           // Allow any origin
    credentials: false     // No cookies/auth
  }
});
```

**Pros**:
- ✅ Works with any frontend
- ✅ Easy to test with curl, Postman, etc.
- ✅ No browser CORS errors

**Cons**:
- ❌ Cannot send cookies or auth headers
- ❌ Not suitable for authenticated APIs
- ⚠️ Less secure (anyone can call your API)

### Scenario 2: Local Development (Multiple Ports, With Authentication)

**Use Case**: Frontend on port 3000, API on port 8000, using OAuth/sessions

```typescript
const server = createRpcAiServer({
  cors: {
    origin: [
      'http://localhost:3000',           // React/Next.js frontend
      'http://localhost:8080',           // Dev panel
      'http://localhost:4000',           // MCP Jam Inspector
      'https://playground.open-rpc.org', // OpenRPC Playground
      'https://inspector.open-rpc.org'   // OpenRPC Inspector
    ],
    credentials: true  // ⭐ Allow cookies and auth headers
  }
});
```

**Pros**:
- ✅ Works with OAuth sessions
- ✅ Supports cookie-based authentication
- ✅ Allows Authorization headers
- ✅ Works with web-based tools

**Cons**:
- ⚠️ Must list all allowed origins explicitly
- ⚠️ Cannot use wildcard `*`

**Example**: [examples/02-mcp-server/server.js:370-379](../examples/02-mcp-server/server.js#L370-L379)

### Scenario 3: Production (Single Origin, Secure)

**Use Case**: Production app with single frontend domain

```typescript
const server = createRpcAiServer({
  cors: {
    origin: 'https://app.example.com',  // Your production frontend
    credentials: true                    // Allow authenticated requests
  }
});
```

**Pros**:
- ✅ Most secure (single origin)
- ✅ Supports authentication
- ✅ Clear security boundary

**Cons**:
- ❌ Only one origin allowed
- ❌ Must update for additional frontends

### Scenario 4: Multi-Tenant Production (Multiple Domains)

**Use Case**: SaaS app with multiple customer domains

```typescript
const server = createRpcAiServer({
  cors: {
    origin: [
      'https://app.example.com',
      'https://client1.example.com',
      'https://client2.example.com'
    ],
    credentials: true
  }
});
```

Or use environment variable:

```typescript
const server = createRpcAiServer({
  cors: {
    // Comma-separated list: "https://a.com,https://b.com"
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }
});
```

**Environment Variable Format**:
```bash
# .env
CORS_ORIGIN=https://app.example.com,https://client1.example.com,https://client2.example.com
```

**Automatic Parsing**: [src/rpc-ai-server.ts:360-370](../src/rpc-ai-server.ts#L360-L370)

The server automatically splits comma-separated origins into an array.

### Scenario 5: Dynamic Origin Validation (Advanced)

**Use Case**: Validate origins against a database or regex pattern

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Custom origin validation function
function validateOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) {
    // Allow requests with no origin (e.g., curl, Postman)
    callback(null, true);
    return;
  }

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
    callback(null, true);
    return;
  }

  // Check against database or regex
  if (origin.match(/^https:\/\/.*\.example\.com$/)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}

// Note: This requires modifying the server to accept a function
// Current implementation only supports string | string[]
```

**Note**: Current implementation supports `string | string[]` only. For dynamic validation, you would need to extend the server configuration.

## Security Considerations

### Best Practices

1. **Never use `credentials: true` with `origin: '*'`**
   - ❌ Browsers will block this
   - ⚠️ Huge security risk if it worked

2. **Use specific origins in production**
   ```typescript
   // ❌ Bad (production)
   cors: { origin: '*', credentials: true }

   // ✅ Good (production)
   cors: { origin: 'https://app.example.com', credentials: true }
   ```

3. **Separate development and production configs**
   ```typescript
   const isDev = process.env.NODE_ENV === 'development';

   const server = createRpcAiServer({
     cors: {
       origin: isDev
         ? '*'  // Permissive in dev
         : process.env.ALLOWED_ORIGINS?.split(','),  // Strict in prod
       credentials: !isDev  // Only in production
     }
   });
   ```

4. **Use HTTPS in production**
   - Mixed content (HTTP origin + HTTPS API) is blocked by browsers
   - Always use `https://` origins in production

5. **Minimize exposed origins**
   - Only list origins that actually need access
   - Regularly audit and remove unused origins
   - Use environment variables for flexibility

### Common Security Mistakes

❌ **Mistake 1: Wildcard with credentials**
```typescript
cors: {
  origin: '*',
  credentials: true  // ❌ Will fail in browser
}
```

❌ **Mistake 2: Hardcoded production origins in code**
```typescript
cors: {
  origin: 'https://my-app.com',  // ❌ Can't change without redeployment
  credentials: true
}
```

✅ **Better: Use environment variables**
```typescript
cors: {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}
```

❌ **Mistake 3: Including HTTP origins in production**
```typescript
cors: {
  origin: [
    'https://app.example.com',
    'http://app.example.com'  // ❌ Insecure HTTP
  ],
  credentials: true
}
```

## Troubleshooting

### Problem 1: "No 'Access-Control-Allow-Origin' header is present"

**Symptoms:**
```
Access to fetch at 'http://localhost:8000/rpc' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**Solution:**
```typescript
// Add the origin to your CORS config
cors: {
  origin: ['http://localhost:3000'],  // ⭐ Add your frontend URL
  credentials: false
}
```

### Problem 2: "Credentials flag is true, but origin is '*'"

**Symptoms:**
```
The value of the 'Access-Control-Allow-Origin' header in the response must not
be the wildcard '*' when the request's credentials mode is 'include'.
```

**Solution:**
```typescript
// Option 1: Specify exact origins
cors: {
  origin: ['http://localhost:3000'],  // ⭐ Specific origins
  credentials: true
}

// Option 2: Disable credentials
cors: {
  origin: '*',
  credentials: false  // ⭐ Turn off credentials
}
```

### Problem 3: "Credentials are not included in CORS request"

**Symptoms:**
- Cookies not sent with requests
- Authorization header missing
- Server receives unauthenticated requests

**Frontend Code (Fetch API):**
```javascript
// ❌ Wrong: No credentials
fetch('http://localhost:8000/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* ... */ })
});

// ✅ Correct: Include credentials
fetch('http://localhost:8000/rpc', {
  method: 'POST',
  credentials: 'include',  // ⭐ Include cookies/auth
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* ... */ })
});
```

**Frontend Code (Axios):**
```javascript
// ❌ Wrong: No credentials
axios.post('http://localhost:8000/rpc', data);

// ✅ Correct: Include credentials
axios.post('http://localhost:8000/rpc', data, {
  withCredentials: true  // ⭐ Include cookies/auth
});
```

**Server Config:**
```typescript
cors: {
  origin: ['http://localhost:3000'],
  credentials: true  // ⭐ Must be enabled
}
```

### Problem 4: "Preflight request failed"

**Symptoms:**
```
Access to fetch at 'http://localhost:8000/rpc' from origin 'http://localhost:3000'
has been blocked by CORS policy: Response to preflight request doesn't pass access
control check: It does not have HTTP ok status.
```

**Explanation:**
Browsers send a preflight OPTIONS request before POST/PUT/DELETE requests. The server must respond with `200 OK`.

**Solution:**
The server automatically handles OPTIONS requests. Check:
1. Server is running
2. No middleware blocking OPTIONS requests
3. No errors in server logs

### Problem 5: "Origin not in allowed list"

**Symptoms:**
```
Access to fetch at 'http://localhost:8000/rpc' from origin 'http://localhost:5173'
has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a
value 'http://localhost:3000' that is not equal to the supplied origin.
```

**Solution:**
```typescript
// Add all development ports
cors: {
  origin: [
    'http://localhost:3000',  // Create React App
    'http://localhost:5173',  // ⭐ Vite dev server
    'http://localhost:8080',  // Other tools
  ],
  credentials: true
}
```

## Testing CORS Configuration

### Test 1: Verify CORS Headers

**Using curl:**
```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8000/rpc \
     -v
```

**Expected response:**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD
Access-Control-Allow-Headers: Content-Type, Authorization, ...
Access-Control-Allow-Credentials: true
```

### Test 2: Browser Console Test

**Open browser console on `http://localhost:3000`:**

```javascript
// Test without credentials
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test with credentials
fetch('http://localhost:8000/health', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### Test 3: Check Server Logs

Enable debug logging to see CORS requests:

```bash
LOG_LEVEL=debug pnpm dev
```

Look for CORS-related log entries.

## Advanced: OAuth Discovery Endpoints

The server has special CORS handling for OAuth discovery endpoints to ensure compatibility with MCP clients:

**Implementation**: [src/rpc-ai-server.ts:910-915](../src/rpc-ai-server.ts#L910-L915)

```typescript
// OAuth discovery endpoints always allow all origins
app.options('/.well-known/oauth-authorization-server', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ...');
  res.status(200).send();
});
```

These endpoints use `Access-Control-Allow-Origin: *` regardless of your CORS configuration to ensure OAuth discovery works from any MCP client.

## Reference

### Configuration Files
- **Server config interface**: [src/rpc-ai-server.ts:130-134](../src/rpc-ai-server.ts#L130-L134)
- **Default CORS config**: [src/rpc-ai-server.ts:461-465](../src/rpc-ai-server.ts#L461-L465)
- **CORS middleware setup**: [src/rpc-ai-server.ts:692-707](../src/rpc-ai-server.ts#L692-L707)
- **Origin parsing function**: [src/rpc-ai-server.ts:360-370](../src/rpc-ai-server.ts#L360-L370)

### Example Configurations
- **MCP server example**: [examples/02-mcp-server/server.js:370-379](../examples/02-mcp-server/server.js#L370-L379)
- **Basic server example**: [examples/01-basic-server/server.js:68](../examples/01-basic-server/server.js#L68)

### Related Documentation
- [OAuth Setup](./OAUTH_SETUP.md) - OAuth authentication configuration
- [MCP OAuth Authentication](./MCP_OAUTH_AUTHENTICATION.md) - MCP-specific auth
- [Security Best Practices](../specs/features/mcp-oauth-authentication.md) - Security architecture

## Quick Reference

| Scenario | `origin` | `credentials` | Use Case |
|----------|----------|---------------|----------|
| Public API | `'*'` | `false` | No authentication, open access |
| Local Dev (no auth) | `'*'` | `false` | Quick testing, no cookies needed |
| Local Dev (with auth) | `['http://localhost:3000', ...]` | `true` | OAuth, session cookies |
| Production (single) | `'https://app.example.com'` | `true` | Single frontend domain |
| Production (multi) | `['https://a.com', 'https://b.com']` | `true` | Multiple frontend domains |
| SaaS (dynamic) | `process.env.CORS_ORIGIN` | `true` | Environment-based config |

## Summary

- **`origin`**: Controls which domains can access your API
  - `'*'` = Allow all (only use in development or public APIs)
  - `'https://example.com'` = Allow specific domain
  - `['https://a.com', 'https://b.com']` = Allow multiple domains

- **`credentials`**: Controls whether cookies and auth headers are included
  - `false` = No cookies/auth headers (default, safer)
  - `true` = Include cookies/auth headers (required for OAuth, sessions)

- **Security Rule**: When `credentials: true`, you **cannot** use `origin: '*'`

- **Best Practice**:
  - Development: `origin: '*', credentials: false`
  - Production: `origin: ['specific-domains'], credentials: true`

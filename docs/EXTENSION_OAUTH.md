# Extension OAuth - Generic OAuth Callback Handler

Simplified OAuth callback handling for any custom OAuth flow (extensions, sessions, multi-tenant, etc.)

## Overview

A flexible OAuth callback handler that:
- Detects custom OAuth flows via state parameter marker
- Handles token exchange automatically (Google, GitHub, or custom providers)
- Sends `postMessage` to opener window with results
- Provides complete state access in callbacks

**Key Feature**: You control what data flows through OAuth via the state parameter.

## Quick Start

**Server (10 lines)**
```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  oauth: {
    enabled: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
  },
  extensionOAuth: {
    enabled: true,
    onUserAuthenticated: async (stateData, userId, userInfo) => {
      // YOUR custom logic - access any data you put in state
      console.log('State:', stateData);
      console.log('User:', userInfo.email);
      
      // Do whatever your app needs
      await yourCustomLogic(stateData, userId, userInfo);
    }
  }
});
```

**Client (5 lines)**
```typescript
import { encodeOAuthState } from 'simple-rpc-ai-backend';

const state = encodeOAuthState({
  isExtensionAuth: true,  // Required marker
  // Add ANY custom data your app needs:
  sessionId: 'abc-123',
  returnPath: '/dashboard'
});

const popup = window.open(`/login/google?state=${state}`);

window.addEventListener('message', (event) => {
  if (event.data.type === 'oauth-complete' && event.data.success) {
    console.log('User:', event.data.user);
    console.log('Your state:', event.data.state);
  }
});
```

That's it! No boilerplate, no provider-specific code.

## Use Cases

### Extension UUID Linking
```typescript
// Client
const state = encodeOAuthState({
  isExtensionAuth: true,
  extensionUUID: crypto.randomUUID()
});

// Server
onUserAuthenticated: (stateData, userId, userInfo) => {
  await linkExtension(stateData.extensionUUID, userId);
}
```

### Session-Based Auth
```typescript
// Client
const state = encodeOAuthState({
  isExtensionAuth: true,
  sessionId: getSessionId(),
  deviceId: getDeviceId()
});

// Server
onUserAuthenticated: (stateData, userId, userInfo) => {
  await linkSession(stateData.sessionId, userId);
  await registerDevice(stateData.deviceId, userId);
}
```

### Multi-Tenant
```typescript
// Client
const state = encodeOAuthState({
  isExtensionAuth: true,
  tenantId: getTenantId(),
  workspaceId: getWorkspaceId(),
  inviteCode: getInviteCode()
});

// Server
onUserAuthenticated: (stateData, userId, userInfo) => {
  await addToTenant(userId, stateData.tenantId);
  await grantWorkspaceAccess(userId, stateData.workspaceId);
  await acceptInvite(stateData.inviteCode, userId);
}
```

## Data Flow

### Client → Server (via state parameter)

Send custom data to server by encoding it in the state parameter:

```typescript
// Client sends data
const state = encodeOAuthState({
  isExtensionAuth: true,        // Required marker
  extensionUUID: 'abc-123',     // Your custom data
  sessionId: 'xyz-456',         // More custom data
  anything: 'you want'          // Anything!
});

const popup = window.open(`/login/google?state=${state}`);
```

**Important:** State parameter is automatically preserved through the entire OAuth flow:
1. Your app → OAuth provider (Google/GitHub) → Your server callback
2. Server receives it in `onUserAuthenticated(stateData, ...)`
3. Server sends it back to client unchanged in `event.data.state`

### Server → Client (via return value)

Send server-generated data to client by returning it from the callback:

```typescript
// Server sends data back
extensionOAuth: {
  enabled: true,
  onUserAuthenticated: async (stateData, userId, userInfo) => {
    // Do server-side work
    const subscription = await getSubscription(userId);
    const token = await generateToken(userId);
    
    // Return data to send to client
    return {
      subscriptionTier: subscription.tier,
      apiToken: token,
      permissions: ['read', 'write'],
      serverTime: Date.now()
    };
  }
}
```

**Client receives both state and returned data:**

```typescript
window.addEventListener('message', (event) => {
  if (event.data.type === 'oauth-complete' && event.data.success) {
    
    // 1. User info + your returned data (merged together)
    console.log(event.data.user);
    // {
    //   id: '123',
    //   email: 'user@example.com',
    //   name: 'John Doe',
    //   // Your returned data merged in:
    //   subscriptionTier: 'pro',
    //   apiToken: 'token-xyz',
    //   permissions: ['read', 'write'],
    //   serverTime: 1234567890
    // }
    
    // 2. Original state (unchanged)
    console.log(event.data.state);
    // {
    //   isExtensionAuth: true,
    //   extensionUUID: 'abc-123',
    //   sessionId: 'xyz-456',
    //   anything: 'you want'
    // }
  }
});
```

### Summary

| Direction | How | What | Example |
|-----------|-----|------|---------|
| **Client → Server** | `state` parameter in URL | Read-only client data | `extensionUUID`, `sessionId` |
| **Server → Client** | Return value from callback | Server-generated data | `apiToken`, `permissions` |
| **Server → Client** | Automatic | Original state (unchanged) | Same state you sent |


## Configuration

### Basic
```typescript
extensionOAuth: {
  enabled: true,
  onUserAuthenticated: (stateData, userId, userInfo) => {
    // Your logic here
  }
}
```

### Custom Detection Logic
```typescript
extensionOAuth: {
  enabled: true,
  // Default checks state.isExtensionAuth
  isExtensionOAuth: (stateData) => {
    // Custom logic
    return stateData?.source === 'my-app' && stateData?.version >= 2;
  }
}
```

### Custom Provider
```typescript
extensionOAuth: {
  enabled: true,
  tokenExchangeHandlers: {
    microsoft: async (code, callbackUrl) => {
      const tokens = await exchangeMicrosoftTokens(code, callbackUrl);
      const user = await fetchMicrosoftUser(tokens.access_token);
      return { userId: user.id, email: user.email, ...user };
    }
  }
}
```

### Custom Templates
```typescript
extensionOAuth: {
  enabled: true,
  successTemplate: (user, stateData) => `
    <html>
      <body>
        <h1>Welcome ${user.email}!</h1>
        <p>Redirecting to ${stateData.returnPath}...</p>
        <script>
          window.opener?.postMessage({
            type: 'oauth-complete',
            success: true,
            user: ${JSON.stringify(user)},
            state: ${JSON.stringify(stateData)}
          }, '*');
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
    </html>
  `
}
```

## API Reference

### `encodeOAuthState(data: any): string`

Encodes custom data into base64 state parameter.

```typescript
const state = encodeOAuthState({
  isExtensionAuth: true,  // Required to trigger custom OAuth handler
  myCustomField: 'value',
  anotherField: 123
});
```

### `decodeOAuthState(state: string): any | null`

Decodes state parameter back to object.

```typescript
const stateData = decodeOAuthState(req.query.state);
console.log(stateData.myCustomField); // 'value'
```

### `createExtensionOAuthHandler(config)`

Creates Express middleware for OAuth callback handling.

**Config:**
```typescript
{
  enabled?: boolean;  // Default: false
  
  isExtensionOAuth?: (stateData: any) => boolean;
  // Default: (state) => !!state?.isExtensionAuth
  
  onUserAuthenticated?: (stateData: any, userId: string, userInfo: object) => void | Promise<void>;
  // Called after successful OAuth
  
  tokenExchangeHandlers?: {
    [provider: string]: (code: string, callbackUrl: string) => Promise<UserInfo>;
  };
  // Google & GitHub built-in, add others here
  
  successTemplate?: (user: object, stateData: any) => string;
  // Custom success HTML
  
  errorTemplate?: (error: string, stateData?: any) => string;
  // Custom error HTML
}
```

## How It Works

1. **Client encodes state** with `isExtensionAuth: true` + custom data
2. **User logs in** via OAuth provider (Google, GitHub, etc.)
3. **Provider redirects back** with code + state
4. **Handler decodes state**, checks if `isExtensionOAuth(stateData)` returns true
5. If true: **Exchanges code for tokens**, calls `onUserAuthenticated` with full state
6. If false: **Passes to next handler** (MCP OAuth, etc.)
7. **Sends HTML** with `postMessage` to close popup and notify client

## Comparison

| Feature | Manual Code | Extension OAuth |
|---------|-------------|-----------------|
| Lines of code | 200+ | 10-15 |
| Provider support | Manual each | Google/GitHub built-in |
| State handling | Manual encoding | Automatic |
| postMessage | Manual | Automatic |
| Error handling | Manual | Automatic |
| Templates | Manual HTML | Beautiful defaults |
| Custom data | Manual parsing | Full state access |
| Flexibility | High effort | High, low effort |

## Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth  
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OAuth base URL (for ngrok, tunneling)
OAUTH_BASE_URL=https://your-server.com
```

## Security

- ✅ Email redaction in logs
- ✅ State validation
- ✅ XSS protection in templates
- ✅ HTTPS required for production
- ✅ No token storage (exchanged & discarded)
- ✅ Customizable detection logic

## Troubleshooting

**Not working?**
1. Check state has `isExtensionAuth: true` (or customize `isExtensionOAuth`)
2. Check `enabled: true` in config
3. Check environment variables set
4. Check logs for `[Extension OAuth]` messages

**postMessage not received?**
1. Check origin in event listener
2. Check popup not blocked
3. Message sent before `window.close()`

## Related

- [OAuth Middleware](./oauth-middleware.md)
- [MCP OAuth](./MCP_OAUTH_AUTHENTICATION.md)

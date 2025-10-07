---
title: Extension OAuth
parent: Common Configurations
grand_parent: Documentation
nav_order: 5
---

# Extension OAuth - Generic OAuth Callback Handler

Simplified OAuth callback handling for any custom OAuth flow (extensions, sessions, multi-tenant, etc.).

## Overview

A flexible OAuth callback handler that:
- Detects custom OAuth flows via a state parameter marker
- Handles token exchange automatically (Google, GitHub, or custom providers)
- Sends `postMessage` to the opener window with results
- Provides full state access in callbacks

**Key Feature**: You control what data flows through OAuth via the state parameter.

## Quick Start

### Server (10 lines)

```ts
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
      console.log('State:', stateData);
      console.log('User:', userInfo.email);

      await yourCustomLogic(stateData, userId, userInfo);
    }
  }
});
```

### Client (5 lines)

```ts
import { encodeOAuthState } from 'simple-rpc-ai-backend';

const state = encodeOAuthState({
  isExtensionAuth: true,  // Required marker
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

```ts
const state = encodeOAuthState({
  isExtensionAuth: true,
  extensionUUID: crypto.randomUUID()
});

onUserAuthenticated: (stateData, userId) => {
  await linkExtension(stateData.extensionUUID, userId);
};
```

### Session-Based Auth

```ts
const state = encodeOAuthState({
  isExtensionAuth: true,
  sessionId: getSessionId(),
  deviceId: getDeviceId()
});

onUserAuthenticated: (stateData, userId) => {
  await linkSession(stateData.sessionId, userId);
  await registerDevice(stateData.deviceId, userId);
};
```

### Multi-Tenant

```ts
const state = encodeOAuthState({
  isExtensionAuth: true,
  tenantId: getTenantId(),
  workspaceId: getWorkspaceId(),
  inviteCode: getInviteCode()
});

onUserAuthenticated: (stateData, userId) => {
  await addToTenant(userId, stateData.tenantId);
  await grantWorkspaceAccess(userId, stateData.workspaceId);
  await acceptInvite(stateData.inviteCode, userId);
};
```

## Data Flow

### Client → Server (via state parameter)

Send custom data to the server by encoding it in the state parameter:

```ts
const state = encodeOAuthState({
  isExtensionAuth: true,
  extensionUUID: 'abc-123',
  sessionId: 'xyz-456',
  anything: 'you want'
});
```

### Server → Client (via `postMessage`)

The handler posts a message back to the opener window when OAuth completes:

```ts
window.addEventListener('message', (event) => {
  if (event.data?.type === 'oauth-complete') {
    if (event.data.success) {
      console.log(event.data.user);
      console.log(event.data.state);
    } else {
      console.error(event.data.error);
    }
  }
});
```

## Customizing the Handler

```ts
const server = createRpcAiServer({
  extensionOAuth: {
    enabled: true,
    isExtensionOAuth: (state) => state?.flow === 'extension',
    onUserAuthenticated: async (state, userId, user) => {
      await linkExtension(state.extensionId, userId);
    },
    successTemplate: (user, state) => `
      <html><body>
        <script>
          window.opener?.postMessage({
            type: 'oauth-complete',
            success: true,
            user: ${JSON.stringify(user)},
            state: ${JSON.stringify(state)}
          }, '*');
          setTimeout(() => window.close(), 500);
        </script>
      </body></html>
    `
  }
});
```

## API Reference

### `encodeOAuthState(data: any): string`

Encodes custom data into a Base64 state parameter.

### `decodeOAuthState(state: string): any | null`

Decodes the state parameter back to an object.

### `createExtensionOAuthHandler(config)`

Creates Express middleware for OAuth callback handling.

```ts
{
  enabled?: boolean;
  isExtensionOAuth?: (state: any) => boolean;
  onUserAuthenticated?: (state: any, userId: string, user: object) => void | Promise<void>;
  tokenExchangeHandlers?: Record<string, (code: string, callbackUrl: string) => Promise<UserInfo>>;
  successTemplate?: (user: object, state: any) => string;
  errorTemplate?: (error: string, state?: any) => string;
}
```

## Environment Variables

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

OAUTH_BASE_URL=https://your-server.com
```

## Security Checklist

- ✅ Email redaction in logs
- ✅ State validation
- ✅ HTTPS required for production
- ✅ No token storage (exchanged & discarded)
- ✅ Customizable detection logic

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `oauth-complete` not firing | Ensure state includes `isExtensionAuth: true` (or customize `isExtensionOAuth`). |
| Popup closes before message | Increase the timeout in the success template. |
| Custom provider not exchanging tokens | Add a handler under `tokenExchangeHandlers`. |

## Related

- [Authentication]({{ site.baseurl }}{% link common-configurations/authentication.md %})
- [MCP OAuth]({{ site.baseurl }}{% link common-configurations/mcp-oauth-authentication.md %})

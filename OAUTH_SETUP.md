# Google OAuth2 + MCP Authentication Setup

## Quick Start

### 1. Setup Google OAuth2 App

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create a new project or select existing
3. Enable the Google+ API (or People API)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. **Authorized redirect URIs**: `http://localhost:8082/oauth/callback`
7. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment

```bash
# Copy the example file
cp .env.oauth.example .env.oauth

# Edit .env.oauth with your Google credentials:
GOOGLE_CLIENT_ID=your_google_client_id_here.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 3. Start the OAuth-enabled MCP Server

```bash
pnpm demo:oauth
```

You should see output like:
```
🚀 MCP Server with Google OAuth2 Authentication
   Server URL: http://localhost:8082
   MCP Endpoint: http://localhost:8082/mcp
   
📋 OAuth2 Endpoints:
   Authorization: http://localhost:8082/oauth/authorize
   Token: http://localhost:8082/oauth/token
   User Info: http://localhost:8082/oauth/userinfo
   
🔍 Discovery Endpoints:
   Auth Server: http://localhost:8082/.well-known/oauth-authorization-server
   Protected Resource: http://localhost:8082/.well-known/oauth-protected-resource
```

### 4. Test with MCP Jam

1. Open [MCP Jam](http://localhost:4000) in your browser
2. Click **Connect to MCP Server**  
3. Enter URL: `http://localhost:8082/mcp`
4. MCP Jam will:
   - Discover OAuth endpoints automatically
   - Redirect you to Google for authentication
   - Exchange tokens and connect to your MCP server
   - Show authenticated MCP tools

## What Happens During OAuth Flow

```
MCP Jam → Discovery → Google OAuth2 → Token Exchange → Authenticated MCP Access
   ↓           ↓            ↓               ↓                    ↓
   📋      /.well-known    🔐 Google      🎫 Generate         ✅ MCP Tools
           discovery       login page     MCP tokens          with user context
```

## Discovery Endpoints

The server provides all the standard OAuth2/OIDC discovery endpoints that MCP clients expect:

- `/.well-known/oauth-authorization-server` - OAuth2 server metadata
- `/.well-known/oauth-protected-resource` - Protected resource metadata  
- `/.well-known/openid-configuration` - OIDC discovery
- `/register` - Dynamic client registration
- `/.well-known/jwks.json` - JSON Web Key Set (empty for opaque tokens)

Plus redirects for OIDC-style paths:
- `/oidc/.well-known/*` → `/.well-known/*`

## MCP Tools with User Context

Once authenticated, MCP tools receive the user's information:

```javascript
// Example: advancedExample tool shows authenticated user info
{
  "action": "check", 
  "user": "user@gmail.com (pro)",
  "hasApiKey": false,
  "message": "Successfully executed check"
}
```

## Debug Endpoints

During development, you can check:
- `http://localhost:8082/debug/tokens` - Active tokens
- `http://localhost:8082/debug/config` - Server configuration

## Troubleshooting

**Problem**: MCP Jam shows "OAuth failed" with no clear error

**Solution**: Check that:
1. Your Google OAuth2 redirect URI is exactly: `http://localhost:8082/oauth/callback`
2. Your `.env.oauth` file has valid Google credentials
3. The server is running on port 8082 
4. You can access discovery endpoints directly: `http://localhost:8082/.well-known/oauth-authorization-server`

**Problem**: "Requested URL: /oidc/... Matched route: (none)"

**Solution**: This is fixed! The server now handles both standard and OIDC-style discovery paths.

## Production Considerations

- Use HTTPS in production
- Store tokens in Redis/database instead of memory
- Implement token refresh
- Add proper session management
- Validate JWT tokens if using them
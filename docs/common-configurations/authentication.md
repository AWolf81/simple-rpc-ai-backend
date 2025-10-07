---
title: Authentication
parent: Common Configurations
grand_parent: Documentation
nav_order: 2
---

# Authentication

The backend ships with a Google OAuth 2.0 flow that enriches MCP tool responses with user context. Use this guide to configure local and production environments.

## Create Google OAuth Credentials

1. Visit the [Google Cloud Console](https://console.developers.google.com).
2. Create or select a project.
3. Enable the People API.
4. Navigate to **Credentials → Create Credentials → OAuth 2.0 Client ID**.
5. Choose **Web application** and add the redirect URI `http://localhost:8082/oauth/callback`.
6. Save the **Client ID** and **Client Secret**.

## Configure the Server

```bash
cp .env.oauth.example .env.oauth
```

Update the new file with your client credentials:

```bash
GOOGLE_CLIENT_ID=your_google_client_id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Launch the OAuth-Enabled Server

```bash
pnpm demo:oauth
```

Expected console output includes the base server URL, MCP endpoint, and all discovery routes.

## Enable HTTPS with ngrok

Google only accepts HTTPS origins for production callbacks. Use [ngrok](https://ngrok.com/download) to expose your local server securely when testing outside `localhost`.

```bash
brew install ngrok      # macOS
choco install ngrok     # Windows (Chocolatey)
snap install ngrok      # Linux (Snap)
```

Authenticate ngrok (first run) and forward the development port:

```bash
ngrok config add-authtoken <your-ngrok-token>
ngrok http 8082
```

Copy the `https://<random>.ngrok.app` host from the output. Add these entries to your Google OAuth client configuration:

- **Authorized redirect URI:** `https://<random>.ngrok.app/oauth/callback`
- **Authorized JavaScript origin:** `https://<random>.ngrok.app`

Restart `pnpm demo:oauth` so the server advertises the public callback in the logs. Clients can now complete the OAuth flow end-to-end over HTTPS.

## Test with MCP Jam

1. Open MCP Jam at `http://localhost:4000`.
2. Connect to the MCP server URL displayed in your console.
3. Complete the Google login flow when prompted.
4. Confirm tool responses include the authenticated user metadata.

## Discovery Endpoints

The server exposes standard OAuth2 and OIDC discovery routes:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/.well-known/openid-configuration`
- `/register`
- `/.well-known/jwks.json`

OIDC-style paths under `/oidc/.well-known/*` are automatically redirected.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| MCP Jam reports "OAuth failed" | Verify redirect URI, credentials in `.env.oauth`, and server port `8082`. |
| Requests under `/oidc/...` fail | The server already forwards these paths; confirm you are running the latest build. |

## Production Considerations

- Always serve OAuth flows over HTTPS.
- Store tokens in durable storage (Redis or a database) instead of process memory.
- Implement refresh token handling for long-lived sessions.
- Validate JWT signatures if migrating to signed tokens.

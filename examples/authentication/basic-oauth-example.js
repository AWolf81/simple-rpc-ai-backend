/**
 * MCP OIDC-compliant Authentication Example - Hybrid with Redirects
 *
 * This file uses a hybrid approach with redirects to solve the MCP auth flow:
 * 1. The oidc-provider is mounted on /oidc to handle the OIDC flow.
 * 2. Root-level discovery endpoints (/.well-known/*) are added to redirect clients
 *    to the correct discovery documents under /oidc.
 * 3. A custom middleware protects all other routes (e.g., /mcp) and provides the
 *    WWW-Authenticate header for MCP-compliant discovery.
 *
 * To run this example:
 * node examples/authentication/basic-oauth-example.js
 */

import express from 'express';
import Provider from 'oidc-provider';
import session from 'express-session';
import { createRpcAiServer } from '../../dist/index.js';

// --- Configuration ---
process.env.NODE_ENV = 'development'; // Explicitly set NODE_ENV for oidc-provider development features

const SERVER_PORT = 8082;
const ISSUER = `http://localhost:${SERVER_PORT}/oidc`;
const PROTECTED_RESOURCE_METADATA_URL = `${ISSUER}/.well-known/oauth-protected-resource`;

console.log('NODE_ENV:', process.env.NODE_ENV); // Log NODE_ENV

// --- 1. AI Server Setup ---
const aiServer = createRpcAiServer({
  port: SERVER_PORT,
  protocols: { tRpc: true },
  aiLimits: {},
  mcp: { enableMCP: true },
});

const app = aiServer.getApp();

// --- 2. Root-level Discovery Redirects ---
app.get('/.well-known/openid-configuration', (req, res) => {
  res.redirect(301, `${ISSUER}/.well-known/openid-configuration`);
});
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.redirect(301, `${ISSUER}/.well-known/oauth-authorization-server`);
});
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.redirect(301, `${ISSUER}/.well-known/oauth-protected-resource`);
});


// --- 3. Custom Authentication Middleware for MCP ---
const mcpAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`🛡️  Unauthenticated request to ${req.path}, sending WWW-Authenticate header.`);
    res.setHeader('WWW-Authenticate', `Bearer resource="${PROTECTED_RESOURCE_METADATA_URL}"`);
    return res.status(401).json({ error: 'Authentication required' });
  }

  console.log(`✅ Authenticated request to ${req.path} with token.`);
  next();
};
app.use('/mcp', mcpAuthMiddleware);


// --- 4. oidc-provider Configuration ---
const oidcConfig = {
  clients: [
    {
      client_id: 'mcp-client',
      client_secret: 'mcp-client-secret',
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: ['http://localhost:4000/oauth/callback/debug'],
      response_types: ['code'],
    },
  ],
  findAccount: async (ctx, id) => {
    if (id === 'user-123') {
      return {
        accountId: id,
        async claims(use, scope) {
          return { sub: id, name: 'Test User', email: 'test@example.com' };
        },
      };
    }
    return undefined;
  },
  features: {
    clientCredentials: { enabled: true },
    registration: { enabled: true },
    introspection: { enabled: true },
    revocation: { enabled: true },
    devInteractions: { enabled: false },
  },
  pkce: {
    required: () => true,
  },
  scopes: ['openid', 'mcp', 'offline_access'],
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
    profile: ['name', 'picture'],
  },
  // Configure oidc-provider to use express-session for cookies
  cookies: {
    long: session.Cookie,
    short: session.Cookie,
  },
  interactions: {
    url(ctx, interaction) {
      return `/oidc/interactions/${interaction.uid}`;
    },
  },
  ttl: {
    Interaction: 3600, // 1 hour in seconds
  },
};

// --- 5. Instantiate and Mount the OIDC Provider ---
const oidc = new Provider(ISSUER, oidcConfig);

// Add express-session middleware before oidc.callback()
app.use(session({
  secret: 'a-very-secret-key-for-express-session',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { secure: false }
}));

const interactions = express.Router();
interactions.get('/:uid', async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    const { uid, prompt, params } = details;

    if (prompt.name === 'login') {
      await oidc.interactionFinished(req, res, { login: { accountId: 'user-123', jti: 'mock-jti-' + Date.now() } }, { mergeWithLastSubmission: false });
    } else if (prompt.name === 'consent') {
      await oidc.interactionFinished(req, res, { consent: { grantId: details.grantId } }, { mergeWithLastSubmission: true });
    }
  } catch (err) {
    console.error('Error in interaction handler:', err);
    next(err);
  }
});

app.use('/oidc/interactions', interactions);
app.use('/oidc', oidc.callback());

// --- 6. Main Execution ---
async function main() {
  await aiServer.start();
  console.log(`🛡️  OIDC-compliant AI Server running at http://localhost:${SERVER_PORT}`);
  console.log(`   - OIDC Provider is mounted at ${ISSUER}`);
  console.log(`   - Root discovery endpoints will redirect to the OIDC provider.`);
  console.log(`   - The /mcp route is protected and will trigger the auth flow.`);
}

main().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});
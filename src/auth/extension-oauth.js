"use strict";
/**
 * Extension OAuth - Simplified OAuth flow for browser extensions and VS Code extensions
 *
 * Generic OAuth callback handler that:
 * - Detects custom OAuth flows via state parameter marker
 * - Handles token exchange automatically
 * - Sends postMessage to opener window
 * - Allows custom state data and callbacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeOAuthState = decodeOAuthState;
exports.encodeOAuthState = encodeOAuthState;
exports.createExtensionOAuthHandler = createExtensionOAuthHandler;
const redact_js_1 = require("../utils/redact.js");
/**
 * Decode OAuth state parameter
 */
function decodeOAuthState(state) {
    if (!state)
        return null;
    try {
        const decoded = Buffer.from(state, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch (e) {
        // State might be from MCP OAuth or other format
        return null;
    }
}
/**
 * Encode OAuth state
 */
function encodeOAuthState(data) {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}
/**
 * Default Google OAuth token exchange
 */
async function exchangeGoogleToken(code, callbackUrl) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code'
        })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
        throw new Error(tokens.error_description || 'Failed to get access token');
    }
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userRes.json();
    return {
        userId: String(userInfo.sub || userInfo.id),
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        ...userInfo
    };
}
/**
 * Default GitHub OAuth token exchange
 */
async function exchangeGitHubToken(code, callbackUrl) {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            code,
            client_id: process.env.GITHUB_CLIENT_ID || '',
            client_secret: process.env.GITHUB_CLIENT_SECRET || '',
            redirect_uri: callbackUrl
        })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
        throw new Error(tokens.error_description || 'Failed to get access token');
    }
    const userRes = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Accept': 'application/json'
        }
    });
    const userInfo = await userRes.json();
    return {
        userId: String(userInfo.id),
        email: userInfo.email,
        name: userInfo.name || userInfo.login,
        avatar: userInfo.avatar_url,
        ...userInfo
    };
}
/**
 * Default success HTML template
 */
function defaultSuccessTemplate(user, stateData) {
    const displayName = user.email || user.name || user.id;
    return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Authentication Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h2 { color: #2d3748; margin-top: 0; }
          p { color: #4a5568; }
          .email { font-weight: 600; color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>✅ Authentication Successful!</h2>
          <p>Logged in as <span class="email">${displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></p>
          <p>This window will close automatically...</p>
        </div>
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
  `;
}
/**
 * Default error HTML template
 */
function defaultErrorTemplate(error, stateData) {
    return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h2 { color: #c53030; margin-top: 0; }
          p { color: #4a5568; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>❌ Authentication Failed</h2>
          <p>${error.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        <script>
          window.opener?.postMessage({
            type: 'oauth-complete',
            success: false,
            error: '${error.replace(/'/g, "\\'")}',
            state: ${JSON.stringify(stateData)}
          }, '*');
        </script>
      </body>
    </html>
  `;
}
/**
 * Default detection function
 */
function defaultIsExtensionOAuth(stateData) {
    // Check for isExtensionAuth marker (flexible - any truthy value works)
    return !!(stateData && stateData.isExtensionAuth);
}
/**
 * Create extension OAuth callback middleware
 */
function createExtensionOAuthHandler(config = {}) {
    const { enabled = false, isExtensionOAuth = defaultIsExtensionOAuth, onUserAuthenticated, tokenExchangeHandlers = {}, successTemplate = defaultSuccessTemplate, errorTemplate = defaultErrorTemplate, customizePostMessage } = config;
    if (!enabled) {
        // Return passthrough middleware
        return (_req, _res, next) => next();
    }
    return async (req, res, next) => {
        const { provider } = req.params;
        const { code, state, error, error_description } = req.query;
        // Decode state
        const stateData = decodeOAuthState(state);
        const isCustomOAuth = stateData && isExtensionOAuth(stateData);
        console.log(`[Extension OAuth] Callback received for provider: ${provider}`, {
            hasCode: !!code,
            hasState: !!state,
            isCustomOAuth,
            stateKeys: stateData ? Object.keys(stateData) : []
        });
        // If not custom OAuth, pass to next handler (MCP OAuth, etc.)
        if (!isCustomOAuth) {
            console.log('[Extension OAuth] Not a custom OAuth callback, passing to next handler');
            return next();
        }
        // Handle OAuth errors
        if (error) {
            const errorMsg = String(error_description || error);
            console.error(`[Extension OAuth] OAuth error: ${errorMsg}`);
            return res.send(errorTemplate(errorMsg, stateData));
        }
        if (!code) {
            console.error('[Extension OAuth] No authorization code received');
            return res.send(errorTemplate('No authorization code received', stateData));
        }
        // Exchange code for tokens
        try {
            const oauthBaseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
            const callbackUrl = `${oauthBaseUrl}/callback/${provider}`;
            // Get token exchange handler (custom or default)
            let exchangeHandler = tokenExchangeHandlers[provider];
            if (!exchangeHandler) {
                // Use default handlers
                if (provider === 'google') {
                    exchangeHandler = exchangeGoogleToken;
                }
                else if (provider === 'github') {
                    exchangeHandler = exchangeGitHubToken;
                }
                else {
                    throw new Error(`Unsupported provider: ${provider}. Add a custom tokenExchangeHandler for '${provider}'.`);
                }
            }
            // Exchange code for user info
            const userInfo = await exchangeHandler(code, callbackUrl);
            const { userId, email, ...extraInfo } = userInfo;
            console.log(`[Extension OAuth] User authenticated: ${(0, redact_js_1.redactEmail)(email)} (provider: ${provider})`);
            // Store in session if available
            const session = req.session;
            if (session) {
                session.user = { userId, email, provider };
                session.customOAuthState = stateData;
            }
            // Call custom onUserAuthenticated callback with state data
            let customData = {};
            if (onUserAuthenticated) {
                const result = await onUserAuthenticated(stateData, userId, { email, provider, ...extraInfo });
                // If callback returns data, merge it into the response
                if (result && typeof result === 'object') {
                    customData = result;
                }
            }
            // Merge custom data into user object for template and postMessage
            const responseUser = { id: userId, email, ...userInfo, ...customData };
            // Send success response
            return res.send(successTemplate(responseUser, stateData));
        }
        catch (err) {
            console.error('[Extension OAuth] Token exchange error:', err.message);
            return res.send(errorTemplate(`Authentication failed: ${err.message}`, stateData));
        }
    };
}
//# sourceMappingURL=extension-oauth.js.map
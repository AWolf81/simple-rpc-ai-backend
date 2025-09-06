/**
 * Branded OAuth Server Example
 * 
 * Shows how to customize the OAuth login page with custom branding,
 * colors, and styling using the template engine.
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../../dist/index.js';
import { configureOAuthTemplates } from '../../dist/auth/oauth-middleware.js';
import { config } from 'dotenv';

// Load environment variables from .env.oauth if it exists
config({ path: '.env.oauth' });

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   GOOGLE_CLIENT_ID=your_client_id');
  console.error('   GOOGLE_CLIENT_SECRET=your_client_secret');
  console.error('');
  console.error('   Get these from: https://console.developers.google.com');
  console.error('   Redirect URI: http://localhost:8082/oauth/callback');
  console.error('');
  process.exit(1);
}

console.log(`
🎨 Branded OAuth Server Example

This example demonstrates customizable OAuth2 authentication pages:
✅ Custom branding and colors
✅ Corporate styling options
✅ Dark mode support
✅ Custom CSS overrides
`);

// Configure custom OAuth template branding
configureOAuthTemplates({
  branding: {
    appName: 'Acme Corp AI Platform',
    primaryColor: '#6366f1',
    secondaryColor: '#4f46e5',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    favicon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgOFY0SDhBMiAyIDAgMCAwIDYgNnYxMGEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWNmEyIDIgMCAwIDAtMi0yaC00eiIvPjxjaXJjbGUgY3g9IjkiIGN5PSIxMiIgcj0iMSIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iMTIiIHI9IjEiLz48cGF0aCBkPSJNMTIgMTZzMS0xIDMtMXMzIDEgMyAxIi8+PC9zdmc+'
  },
  
  // Custom provider icons using SVG
  variables: {
    providerIcons: {
      google: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>`
    }
  },
  customCSS: `
    /* Corporate styling overrides */
    .login-container {
      border: 3px solid #6366f1;
      background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
    }
    
    .app-logo {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 16px;
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
    }
    
    .provider-button {
      border: 2px solid #e2e8f0;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      transition: all 0.3s ease;
    }
    
    .provider-button:hover {
      border-color: #6366f1;
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
    }
    
    h1 {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `
});

// Create server with OAuth and custom branding
const server = createRpcAiServer({
  port: 8082,
  
  // Enable both protocols
  protocols: { tRpc: true, jsonRpc: true },
  
  // OAuth configuration with file storage
  oauth: {
    enabled: true,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    sessionStorage: {
      type: 'file',
      filePath: './data/branded-oauth-sessions.json'
    }
  },
  
  // Use conservative limits
  aiLimits: AI_LIMIT_PRESETS.conservative,
  
  // CORS configuration
  cors: {
    origin: [
      'http://localhost:4000',     // MCP Jam
      'http://localhost:*',        // Any localhost port
      'https://localhost:*',       // HTTPS localhost
      'https://*.ngrok.io',        // ngrok tunnels
      'https://*.ngrok-free.app',  // ngrok free tier
      'vscode-webview://*',        // VS Code extensions
      'https://inspector.open-rpc.org'  // OpenRPC tools
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'mcp-protocol-version',      // MCP specific header
      'Accept',
      'Accept-Language',
      'Content-Language',
      'Origin',
      'Cache-Control',
      'Pragma',
      'ngrok-skip-browser-warning'  // Skip ngrok browser warning
    ],
    trustProxy: true // enabled for ngrok
  },
  
  // MCP enabled
  mcp: {
    enableMCP: true,
    transports: {
      http: true,   // Standard HTTP transport - MCP Jam uses POST /mcp
      sse: false,   // Disable SSE transport - conflicts with GET /mcp requests
      stdio: false  // Keep STDIO disabled
    },
    auth: {
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true
    },
    // Admin user configuration - specific users who can access admin-restricted tools
    adminUsers: [
      'awolf2904@gmail.com'  // Add more admin emails as needed
    ]
  },
});

// Start the server
console.log('Starting branded OAuth server...');
server.start().then(() => {
  console.log(`
✅ Branded OAuth Server running!

📍 OAuth Endpoints:
   • Login Page: GET http://localhost:8082/login
   • Authorization: GET http://localhost:8082/oauth/authorize
   • Token: POST http://localhost:8082/oauth/token  
   • Discovery: GET http://localhost:8082/.well-known/oauth-authorization-server

🎨 Custom Branding Features:
   • App Name: "Acme Corp AI Platform"
   • Corporate color scheme (Indigo/Purple)
   • Custom gradients and shadows
   • Enhanced hover animations
   • Professional styling

🔐 Federated Login:
   • Google: GET http://localhost:8082/login/google
   • Callback: GET http://localhost:8082/callback/google

🚀 Other Endpoints:
   • Health: GET http://localhost:8082/health
   • MCP: POST http://localhost:8082/mcp
   • tRPC: POST http://localhost:8082/trpc/*

🧪 Test the branded login page:
   1. Open http://localhost:8082/login in your browser
   2. See the custom "Acme Corp AI Platform" branding
   3. Notice the corporate color scheme and styling
   4. Try the Google OAuth flow

💡 Customization Options:
   - Branding: App name, colors, logo, favicon
   - Styling: Custom CSS overrides
   - Themes: Corporate, dark, minimal presets
   - Icons: Per-provider custom icons
  `);
}).catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down branded OAuth server...');
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down branded OAuth server...');
  server.stop().then(() => process.exit(0));
});
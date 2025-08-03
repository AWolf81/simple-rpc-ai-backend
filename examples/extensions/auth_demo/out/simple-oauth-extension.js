"use strict";
/**
 * Simplified OAuth Extension Authentication
 *
 * Uses VS Code's built-in authentication providers.
 * No private keys, no complex signatures - just standard OAuth!
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleOAuthClient = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
/**
 * Make HTTP request using Node.js built-in modules
 */
function makeHttpRequest(url, data = null, headers = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Making HTTP request to: ${url}`);
        const urlObj = new URL(url);
        const postData = JSON.stringify(data);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname,
            method: method,
            headers: {
                ...(data ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                } : {}),
                ...headers
            }
        };
        const httpModule = urlObj.protocol === 'https:' ? https : http;
        const req = httpModule.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ data: parsedData, status: res.statusCode });
                    }
                    else {
                        console.error(`❌ HTTP Error ${res.statusCode}:`, responseData);
                        reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
                    }
                }
                catch (error) {
                    reject(new Error(`Invalid JSON response: ${responseData}`));
                }
            });
        });
        req.on('error', (error) => {
            console.error('🔥 HTTP Request Error:', error);
            reject(error);
        });
        if (data) {
            req.write(postData);
        }
        req.end();
    });
}
class SimpleOAuthClient {
    constructor(config) {
        this.serverSession = null;
        this.oauthSession = null;
        this.config = config;
    }
    /**
     * Test server connectivity
     */
    async testServerConnection() {
        try {
            console.log('🔍 Testing server connectivity...');
            const response = await makeHttpRequest(`${this.config.serverUrl}/health`, null, {}, 'GET');
            console.log('✅ Server connectivity test passed:', response.data);
            return true;
        }
        catch (error) {
            console.error('❌ Server connectivity test failed:', error);
            return false;
        }
    }
    /**
     * Authenticate using VS Code's built-in OAuth providers
     * On first use, opens browser for OAuth flow
     */
    async authenticate() {
        try {
            // First test server connectivity
            const serverReachable = await this.testServerConnection();
            if (!serverReachable) {
                throw new Error('Cannot connect to server at ' + this.config.serverUrl);
            }
            console.log(`🔄 Starting OAuth authentication with ${this.config.authProvider}...`);
            // Step 1: Get OAuth session from VS Code
            // This handles the entire OAuth flow automatically!
            this.oauthSession = await vscode.authentication.getSession(this.config.authProvider, this.config.scopes, {
                createIfNone: true, // Open browser if no session exists
                clearSessionPreference: false
            });
            console.log(`✅ Got OAuth session for ${this.oauthSession.account.label}`);
            // Step 2: Exchange OAuth token with your server
            const deviceId = this.generateDeviceId();
            console.log(`🔄 Sending OAuth token to server (token: ${this.oauthSession.accessToken.substring(0, 10)}...)`);
            console.log(`🌐 Server URL: ${this.config.serverUrl}/auth/oauth`);
            console.log(`📦 Request payload:`, {
                extensionId: this.config.extensionId,
                provider: this.config.authProvider,
                deviceId
            });
            const response = await makeHttpRequest(`${this.config.serverUrl}/auth/oauth`, {
                extensionId: this.config.extensionId,
                provider: this.config.authProvider,
                accessToken: this.oauthSession.accessToken,
                deviceId,
                userInfo: {
                    id: this.oauthSession.account.id,
                    email: this.oauthSession.account.label,
                    name: this.oauthSession.account.label
                }
            });
            if (response.data.success) {
                this.serverSession = response.data.sessionToken;
                console.log('✅ Server authentication successful!');
                console.log(`   👤 User: ${this.oauthSession.account.label}`);
                console.log(`   🎫 Session: ${this.serverSession?.substring(0, 16)}...`);
            }
            else {
                throw new Error(response.data.error || 'Server authentication failed');
            }
        }
        catch (error) {
            console.error('❌ Authentication failed:', error.message);
            // Clear stored session on failure
            if (this.oauthSession) {
                await vscode.authentication.getSession(this.config.authProvider, this.config.scopes, { clearSessionPreference: true });
            }
            throw error;
        }
    }
    /**
     * Make authenticated RPC request to your server
     */
    async makeRPCRequest(method, params = {}) {
        // Auto-authenticate if not already authenticated
        if (!this.serverSession || !this.oauthSession) {
            await this.authenticate();
        }
        try {
            const response = await makeHttpRequest(`${this.config.serverUrl}/rpc`, {
                jsonrpc: '2.0',
                id: Math.floor(Math.random() * 1000000),
                method,
                params
            }, {
                'Authorization': `Bearer ${this.serverSession}`
            });
            if (response.data.error) {
                throw new Error(`RPC Error: ${response.data.error.message}`);
            }
            return response.data.result;
        }
        catch (error) {
            if (error.message.includes('status code 401')) {
                console.warn('⚠️ Session expired. Re-authenticating...');
                // Clear sessions and retry
                this.serverSession = null;
                this.oauthSession = null;
                await this.authenticate();
                return this.makeRPCRequest(method, params);
            }
            throw error;
        }
    }
    /**
     * Execute AI request with your server
     */
    async executeAIRequest(content, systemPrompt, metadata = {}) {
        return this.makeRPCRequest('executeAIRequest', {
            userId: this.oauthSession?.account.id,
            content,
            systemPrompt,
            metadata: {
                ...metadata,
                user: this.oauthSession?.account.label,
                provider: this.config.authProvider
            }
        });
    }
    /**
     * Sign out - clears both local and server sessions
     */
    async signOut() {
        try {
            // Invalidate server session
            if (this.serverSession) {
                await makeHttpRequest(`${this.config.serverUrl}/auth/signout`, {
                    sessionToken: this.serverSession
                });
            }
            // Clear VS Code OAuth session
            if (this.oauthSession) {
                await vscode.authentication.getSession(this.config.authProvider, this.config.scopes, { clearSessionPreference: true });
            }
            this.serverSession = null;
            this.oauthSession = null;
            console.log('✅ Signed out successfully');
        }
        catch (error) {
            console.warn('⚠️ Sign out error:', error);
            // Clear local sessions anyway
            this.serverSession = null;
            this.oauthSession = null;
        }
    }
    /**
     * Get current user info
     */
    getCurrentUser() {
        if (!this.oauthSession) {
            return null;
        }
        return {
            id: this.oauthSession.account.id,
            email: this.oauthSession.account.label,
            name: this.oauthSession.account.label
        };
    }
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.serverSession && this.oauthSession);
    }
    /**
     * Generate stable device ID
     */
    generateDeviceId() {
        // Use VS Code's machine ID for stable device identification
        const machineId = vscode.env.machineId;
        const extensionId = this.config.extensionId;
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256');
        hash.update(`${machineId}-${extensionId}`);
        return `device_${hash.digest('hex').substring(0, 16)}`;
    }
}
exports.SimpleOAuthClient = SimpleOAuthClient;
/**
 * Wait for authentication provider to become available
 */
async function waitForAuthProvider(providerId, timeoutMs = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        try {
            // Try to get available providers
            const providers = await vscode.authentication.getAccounts(providerId);
            // If we get here without error, provider is available
            console.log(`✅ Authentication provider '${providerId}' is available`);
            return;
        }
        catch (error) {
            // Provider not ready yet, wait a bit
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    throw new Error(`Authentication provider '${providerId}' did not become available within ${timeoutMs}ms`);
}
/**
 * VS Code Extension Activation with Simple OAuth
 */
function activate(context) {
    console.log('🚀 Activating simple OAuth extension...');
    // Create OAuth client with GitHub (Microsoft requires Azure AD app registration)
    const authClient = new SimpleOAuthClient({
        serverUrl: 'http://localhost:8000',
        extensionId: context.extension.id,
        authProvider: 'github', // GitHub works out of the box
        scopes: ['read:user', 'user:email'] // GitHub scopes
    });
    // Register authentication command
    const authenticateCommand = vscode.commands.registerCommand('extension.authenticate', async () => {
        try {
            // First, ensure GitHub provider is available
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Waiting for GitHub authentication provider...',
                cancellable: false
            }, async () => {
                await waitForAuthProvider('github', 15000); // 15 second timeout
            });
            await authClient.authenticate();
            const user = authClient.getCurrentUser();
            vscode.window.showInformationMessage(`✅ Authenticated as ${user?.name}!`, 'Show Details').then((selection) => {
                if (selection === 'Show Details') {
                    showAuthDetails(authClient);
                }
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('did not become available')) {
                vscode.window.showErrorMessage('❌ GitHub authentication not available. Try restarting VS Code or check your internet connection.', 'Retry').then(selection => {
                    if (selection === 'Retry') {
                        vscode.commands.executeCommand('extension.authenticate');
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(`❌ Authentication failed: ${error}`);
            }
        }
    });
    // Register AI chat command
    const aiChatCommand = vscode.commands.registerCommand('extension.aiChat', async () => {
        try {
            if (!authClient.isAuthenticated()) {
                const shouldAuth = await vscode.window.showInformationMessage('Please authenticate first to use AI features.', 'Authenticate');
                if (shouldAuth === 'Authenticate') {
                    await vscode.commands.executeCommand('extension.authenticate');
                }
                return;
            }
            // Get input from user
            const userInput = await vscode.window.showInputBox({
                prompt: 'What would you like to ask the AI?',
                placeHolder: 'e.g., "Explain this code" or "Help me debug this function"'
            });
            if (!userInput)
                return;
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Getting AI response...',
                cancellable: false
            }, async () => {
                const response = await authClient.executeAIRequest(userInput, 'You are a helpful programming assistant. Provide clear, concise answers.', {
                    source: 'vscode-extension',
                    feature: 'ai-chat',
                    workspace: vscode.workspace.name
                });
                // Show response in new document
                const doc = await vscode.workspace.openTextDocument({
                    content: `# AI Response\n\n**Your question:** ${userInput}\n\n**AI Answer:**\n\n${response.result}\n\n---\n*Generated at ${new Date().toLocaleString()}*`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ AI request failed: ${error}`);
        }
    });
    // Register sign out command
    const signOutCommand = vscode.commands.registerCommand('extension.signOut', async () => {
        try {
            await authClient.signOut();
            vscode.window.showInformationMessage('✅ Signed out successfully');
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Sign out failed: ${error}`);
        }
    });
    // Register all commands
    context.subscriptions.push(authenticateCommand, aiChatCommand, signOutCommand);
    // Auto-authenticate on activation (with proper provider waiting)
    setTimeout(async () => {
        try {
            // Wait for GitHub authentication provider to be available
            await waitForAuthProvider('github', 10000); // Wait up to 10 seconds
            // Try to get existing session without prompting user
            const existingSession = await vscode.authentication.getSession('github', ['read:user', 'user:email'], { createIfNone: false, silent: true });
            if (existingSession) {
                console.log('🔄 Found existing OAuth session, authenticating...');
                await authClient.authenticate();
                console.log('✅ Auto-authentication successful');
            }
            else {
                console.log('ℹ️ No existing session found (this is normal)');
            }
        }
        catch (error) {
            console.log('⚠️ Auto-authentication failed:', error instanceof Error ? error.message : String(error));
            console.log('   This is normal - user can authenticate manually.');
        }
    }, 2000); // Give VS Code more time to initialize
    console.log('✅ Simple OAuth extension activated');
}
/**
 * Show authentication details to user
 */
function showAuthDetails(authClient) {
    const user = authClient.getCurrentUser();
    if (!user)
        return;
    const panel = vscode.window.createWebviewPanel('authDetails', 'Authentication Details', vscode.ViewColumn.One, { enableScripts: false });
    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Authentication Details</title>
        <style>
            body { font-family: system-ui; padding: 20px; }
            .success { color: #28a745; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .security-item { margin: 10px 0; }
            .security-item::before { content: "✅ "; color: #28a745; }
        </style>
    </head>
    <body>
        <h1>🔐 Authentication Successful</h1>
        
        <div class="info">
            <h3>User Information</h3>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>ID:</strong> ${user.id}</p>
        </div>

        <div class="info">
            <h3>Security Features</h3>
            <div class="security-item">No private keys stored in extension</div>
            <div class="security-item">Uses VS Code's built-in OAuth providers</div>
            <div class="security-item">Tokens are managed by VS Code securely</div>
            <div class="security-item">Server validates tokens with OAuth provider</div>
            <div class="security-item">Sessions expire automatically</div>
        </div>

        <div class="info">
            <h3>How It Works</h3>
            <ol>
                <li>Extension uses VS Code's authentication API</li>
                <li>VS Code opens browser for OAuth flow</li>
                <li>You authenticate with GitHub/Microsoft</li>
                <li>VS Code securely stores the token</li>
                <li>Extension uses token for server authentication</li>
                <li>Server validates token with OAuth provider</li>
            </ol>
        </div>

        <p class="success"><strong>Your extension is securely connected!</strong></p>
    </body>
    </html>
  `;
}
function deactivate() {
    console.log('🛑 Simple OAuth extension deactivated');
}
//# sourceMappingURL=simple-oauth-extension.js.map
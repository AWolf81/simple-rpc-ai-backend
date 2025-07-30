/**
 * Simplified OAuth Extension Authentication
 * 
 * Uses VS Code's built-in authentication providers.
 * No private keys, no complex signatures - just standard OAuth!
 */

import axios from 'axios';
import * as vscode from 'vscode';

export interface SimpleAuthConfig {
  serverUrl: string;
  extensionId: string;
  authProvider: 'github' | 'microsoft'; // VS Code has built-in support for these
  scopes: string[];
}

export class SimpleOAuthClient {
  private config: SimpleAuthConfig;
  private serverSession: string | null = null;
  private oauthSession: vscode.AuthenticationSession | null = null;

  constructor(config: SimpleAuthConfig) {
    this.config = config;
  }

  /**
   * Authenticate using VS Code's built-in OAuth providers
   * On first use, opens browser for OAuth flow
   */
  async authenticate(): Promise<void> {
    try {
      console.log(`🔄 Starting OAuth authentication with ${this.config.authProvider}...`);

      // Step 1: Get OAuth session from VS Code
      // This handles the entire OAuth flow automatically!
      this.oauthSession = await vscode.authentication.getSession(
        this.config.authProvider,
        this.config.scopes,
        { 
          createIfNone: true,  // Open browser if no session exists
          clearSessionPreference: false
        }
      );

      console.log(`✅ Got OAuth session for ${this.oauthSession.account.label}`);

      // Step 2: Exchange OAuth token with your server
      const deviceId = this.generateDeviceId();
      
      console.log(`🔄 Sending OAuth token to server (token: ${this.oauthSession.accessToken.substring(0, 10)}...)`);
      
      const response = await axios.post(`${this.config.serverUrl}/auth/oauth`, {
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
      } else {
        throw new Error(response.data.error || 'Server authentication failed');
      }

    } catch (error: any) {
      console.error('❌ Authentication failed:', error.message);
      
      // Clear stored session on failure
      if (this.oauthSession) {
        await vscode.authentication.getSession(
          this.config.authProvider,
          this.config.scopes,
          { clearSessionPreference: true }
        );
      }
      
      throw error;
    }
  }

  /**
   * Make authenticated RPC request to your server
   */
  async makeRPCRequest(method: string, params: any = {}): Promise<any> {
    // Auto-authenticate if not already authenticated
    if (!this.serverSession || !this.oauthSession) {
      await this.authenticate();
    }

    try {
      const response = await axios.post(`${this.config.serverUrl}/rpc`, {
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1000000),
        method,
        params
      }, {
        headers: {
          'Authorization': `Bearer ${this.serverSession}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;

    } catch (error: any) {
      if (error.response?.status === 401) {
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
  async executeAIRequest(content: string, systemPrompt: string, metadata: any = {}): Promise<any> {
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
  async signOut(): Promise<void> {
    try {
      // Invalidate server session
      if (this.serverSession) {
        await axios.post(`${this.config.serverUrl}/auth/signout`, {
          sessionToken: this.serverSession
        });
      }

      // Clear VS Code OAuth session
      if (this.oauthSession) {
        await vscode.authentication.getSession(
          this.config.authProvider,
          this.config.scopes,
          { clearSessionPreference: true }
        );
      }

      this.serverSession = null;
      this.oauthSession = null;

      console.log('✅ Signed out successfully');

    } catch (error) {
      console.warn('⚠️ Sign out error:', error);
      // Clear local sessions anyway
      this.serverSession = null;
      this.oauthSession = null;
    }
  }

  /**
   * Get current user info
   */
  getCurrentUser(): { id: string; email: string; name: string } | null {
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
  isAuthenticated(): boolean {
    return !!(this.serverSession && this.oauthSession);
  }

  /**
   * Generate stable device ID
   */
  private generateDeviceId(): string {
    // Use VS Code's machine ID for stable device identification
    const machineId = vscode.env.machineId;
    const extensionId = this.config.extensionId;
    
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(`${machineId}-${extensionId}`);
    return `device_${hash.digest('hex').substring(0, 16)}`;
  }
}

/**
 * Wait for authentication provider to become available
 */
async function waitForAuthProvider(providerId: string, timeoutMs: number = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try to get available providers
      const providers = await vscode.authentication.getAccounts(providerId);
      // If we get here without error, provider is available
      console.log(`✅ Authentication provider '${providerId}' is available`);
      return;
    } catch (error) {
      // Provider not ready yet, wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error(`Authentication provider '${providerId}' did not become available within ${timeoutMs}ms`);
}

/**
 * VS Code Extension Activation with Simple OAuth
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Activating simple OAuth extension...');

  // Create OAuth client
  const authClient = new SimpleOAuthClient({
    serverUrl: 'http://localhost:8000',
    extensionId: context.extension.id,
    authProvider: 'github', // or 'microsoft'
    scopes: ['read:user', 'user:email'] // GitHub scopes - read:user for basic profile
  });

  // Register authentication command
  const authenticateCommand = vscode.commands.registerCommand(
    'extension.authenticate',
    async () => {
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
        vscode.window.showInformationMessage(
          `✅ Authenticated as ${user?.name}!`,
          'Show Details'
        ).then((selection: string | undefined) => {
          if (selection === 'Show Details') {
            showAuthDetails(authClient);
          }
        });
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('did not become available')) {
          vscode.window.showErrorMessage(
            '❌ GitHub authentication not available. Try restarting VS Code or check your internet connection.',
            'Retry'
          ).then(selection => {
            if (selection === 'Retry') {
              vscode.commands.executeCommand('extension.authenticate');
            }
          });
        } else {
          vscode.window.showErrorMessage(`❌ Authentication failed: ${error}`);
        }
      }
    }
  );

  // Register AI chat command
  const aiChatCommand = vscode.commands.registerCommand(
    'extension.aiChat',
    async () => {
      try {
        if (!authClient.isAuthenticated()) {
          const shouldAuth = await vscode.window.showInformationMessage(
            'Please authenticate first to use AI features.',
            'Authenticate'
          );
          
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

        if (!userInput) return;

        // Show progress
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Getting AI response...',
          cancellable: false
        }, async () => {
          
          const response = await authClient.executeAIRequest(
            userInput,
            'You are a helpful programming assistant. Provide clear, concise answers.',
            { 
              source: 'vscode-extension',
              feature: 'ai-chat',
              workspace: vscode.workspace.name 
            }
          );

          // Show response in new document
          const doc = await vscode.workspace.openTextDocument({
            content: `# AI Response\n\n**Your question:** ${userInput}\n\n**AI Answer:**\n\n${response.result}\n\n---\n*Generated at ${new Date().toLocaleString()}*`,
            language: 'markdown'
          });
          
          await vscode.window.showTextDocument(doc);
        });

      } catch (error) {
        vscode.window.showErrorMessage(`❌ AI request failed: ${error}`);
      }
    }
  );

  // Register sign out command
  const signOutCommand = vscode.commands.registerCommand(
    'extension.signOut',
    async () => {
      try {
        await authClient.signOut();
        vscode.window.showInformationMessage('✅ Signed out successfully');
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Sign out failed: ${error}`);
      }
    }
  );

  // Register all commands
  context.subscriptions.push(
    authenticateCommand,
    aiChatCommand,
    signOutCommand
  );

  // Auto-authenticate on activation (with proper provider waiting)
  setTimeout(async () => {
    try {
      // Wait for GitHub authentication provider to be available
      await waitForAuthProvider('github', 10000); // Wait up to 10 seconds
      
      // Try to get existing session without prompting user
      const existingSession = await vscode.authentication.getSession(
        'github',
        ['user:email'],
        { createIfNone: false, silent: true }
      );
      
      if (existingSession) {
        console.log('🔄 Found existing OAuth session, authenticating...');
        await authClient.authenticate();
        console.log('✅ Auto-authentication successful');
      } else {
        console.log('ℹ️ No existing session found (this is normal)');
      }
    } catch (error) {
      console.log('⚠️ Auto-authentication failed:', error instanceof Error ? error.message : String(error));
      console.log('   This is normal - user can authenticate manually.');
    }
  }, 2000); // Give VS Code more time to initialize

  console.log('✅ Simple OAuth extension activated');
}

/**
 * Show authentication details to user
 */
function showAuthDetails(authClient: SimpleOAuthClient) {
  const user = authClient.getCurrentUser();
  if (!user) return;

  const panel = vscode.window.createWebviewPanel(
    'authDetails',
    'Authentication Details',
    vscode.ViewColumn.One,
    { enableScripts: false }
  );

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

export function deactivate() {
  console.log('🛑 Simple OAuth extension deactivated');
}
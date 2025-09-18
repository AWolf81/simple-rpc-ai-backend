/**
 * Authentication Manager for VS Code Extension
 * 
 * Handles OAuth2 flow and token management using VS Code's SecretStorage.
 */

import * as vscode from 'vscode';

const TOKEN_KEY = 'aiAssistant.authToken';
const USER_KEY = 'aiAssistant.userInfo';

export class AuthManager {
    constructor(private context: vscode.ExtensionContext) {}
    
    /**
     * Initiate OAuth2 login flow
     */
    async login(provider: 'github' | 'google'): Promise<string | null> {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8000';
        
        try {
            // Step 1: Get login URL from server
            const loginResponse = await fetch(`${serverUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider })
            });
            
            if (!loginResponse.ok) {
                throw new Error('Failed to get login URL');
            }
            
            const { loginUrl, state } = await loginResponse.json();
            
            // Step 2: Open login URL in browser
            await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
            
            // Step 3: Wait for callback (poll for token)
            const token = await this.pollForToken(serverUrl, state);
            
            if (token) {
                // Store token securely
                await this.context.secrets.store(TOKEN_KEY, token);
                
                // Get and store user info
                const userInfo = await this.getUserInfo(serverUrl, token);
                if (userInfo) {
                    await this.context.secrets.store(USER_KEY, JSON.stringify(userInfo));
                }
                
                return token;
            }
            
            return null;
            
        } catch (error: any) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }
    
    /**
     * Get stored authentication token
     */
    async getToken(): Promise<string | null> {
        return await this.context.secrets.get(TOKEN_KEY) || null;
    }
    
    /**
     * Get stored user information
     */
    async getUserInfo(): Promise<any | null> {
        const userJson = await this.context.secrets.get(USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }
    
    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getToken();
        if (!token) return false;
        
        // Verify token is still valid
        try {
            const config = vscode.workspace.getConfiguration('aiAssistant');
            const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8000';
            
            const response = await fetch(`${serverUrl}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            return response.ok;
            
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Logout and clear stored credentials
     */
    async logout(): Promise<void> {
        await this.context.secrets.delete(TOKEN_KEY);
        await this.context.secrets.delete(USER_KEY);
        
        vscode.window.showInformationMessage('Logged out successfully');
    }
    
    /**
     * Poll for authentication token after OAuth redirect
     */
    private async pollForToken(serverUrl: string, state: string): Promise<string | null> {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Login timeout - please try again'));
            }, 60000); // 1 minute timeout
            
            const pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${serverUrl}/auth/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state })
                    });
                    
                    if (response.ok) {
                        const { token } = await response.json();
                        clearInterval(pollInterval);
                        clearTimeout(timeout);
                        resolve(token);
                    } else if (response.status === 404) {
                        // Token not ready yet, continue polling
                        return;
                    } else {
                        throw new Error('Authentication failed');
                    }
                    
                } catch (error: any) {
                    clearInterval(pollInterval);
                    clearTimeout(timeout);
                    reject(error);
                }
            }, 2000); // Poll every 2 seconds
        });
    }
    
    /**
     * Fetch user information from server
     */
    private async getUserInfo(serverUrl: string, token: string): Promise<any | null> {
        try {
            const response = await fetch(`${serverUrl}/auth/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                return await response.json();
            }
            
        } catch (error) {
            console.error('Failed to fetch user info:', error);
        }
        
        return null;
    }
}
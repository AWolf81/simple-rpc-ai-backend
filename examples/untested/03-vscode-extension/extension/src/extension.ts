/**
 * VS Code Extension with MCP Integration
 * 
 * Demonstrates how to build a VS Code extension that uses
 * the MCP protocol for AI-powered features.
 */

import * as vscode from 'vscode';
import { MCPClient } from './client';
import { AuthManager } from './auth';

let client: MCPClient;
let authManager: AuthManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Assistant with MCP is now active!');
    
    // Create output channel for AI responses
    outputChannel = vscode.window.createOutputChannel('AI Assistant');
    
    // Initialize auth manager
    authManager = new AuthManager(context);
    
    // Initialize MCP client
    const config = vscode.workspace.getConfiguration('aiAssistant');
    client = new MCPClient(
        config.get('serverUrl') || 'http://localhost:8000',
        authManager
    );
    
    // Register commands
    registerCommands(context);
    
    // Check authentication status on activation
    checkAuthStatus();
}

function registerCommands(context: vscode.ExtensionContext) {
    // Ask Question Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.askQuestion', async () => {
            const question = await vscode.window.showInputBox({
                prompt: 'What would you like to ask the AI?',
                placeHolder: 'e.g., How do I use async/await in TypeScript?'
            });
            
            if (!question) return;
            
            await runGenerateText(question);
        })
    );
    
    // Explain Selection Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.explainSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showErrorMessage('No text selected');
                return;
            }
            
            const language = editor.document.languageId;
            const prompt = `Explain this ${language} code:\n\n\`\`\`${language}\n${selection}\n\`\`\``;
            
            await runGenerateText(prompt, 'Code Explanation');
        })
    );
    
    // Refactor Selection Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.refactorSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showErrorMessage('No text selected');
                return;
            }
            
            const language = editor.document.languageId;
            const prompt = `Suggest refactoring improvements for this ${language} code:\n\n\`\`\`${language}\n${selection}\n\`\`\``;
            
            await runGenerateText(prompt, 'Refactoring Suggestions');
        })
    );
    
    // Generate Tests Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showErrorMessage('No text selected');
                return;
            }
            
            const language = editor.document.languageId;
            const prompt = `Generate unit tests for this ${language} code:\n\n\`\`\`${language}\n${selection}\n\`\`\``;
            
            await runGenerateText(prompt, 'Generated Tests');
        })
    );
    
    // Login Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.login', async () => {
            const provider = await vscode.window.showQuickPick(
                ['github', 'google'],
                { placeHolder: 'Select authentication provider' }
            );
            
            if (!provider) return;
            
            try {
                const token = await authManager.login(provider);
                if (token) {
                    vscode.window.showInformationMessage('Successfully logged in!');
                    checkAuthStatus();
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Login failed: ${error.message}`);
            }
        })
    );
    
    // Check Usage Command
    context.subscriptions.push(
        vscode.commands.registerCommand('aiAssistant.checkUsage', async () => {
            try {
                const usage = await client.getTokenUsage();
                
                const message = `Token Usage:
- Used this month: ${usage.tokensUsed}
- Monthly quota: ${usage.monthlyQuota}
- Remaining: ${usage.remaining}
- Reset date: ${new Date(usage.resetDate).toLocaleDateString()}`;
                
                vscode.window.showInformationMessage(message, { modal: true });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to get usage: ${error.message}`);
            }
        })
    );
}

async function runGenerateText(prompt: string, title: string = 'AI Response') {
    // Check authentication
    if (!await authManager.isAuthenticated()) {
        const action = await vscode.window.showWarningMessage(
            'You need to login first',
            'Login'
        );
        if (action === 'Login') {
            vscode.commands.executeCommand('aiAssistant.login');
        }
        return;
    }
    
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AI Assistant',
        cancellable: true
    }, async (progress, token) => {
        progress.report({ message: 'Processing your request...' });
        
        try {
            // Get configuration
            const config = vscode.workspace.getConfiguration('aiAssistant');
            const provider = config.get<string>('defaultProvider') || 'anthropic';
            const maxTokens = config.get<number>('maxTokens') || 4096;
            
            // Execute AI request via MCP
            const response = await client.executeAI({
                content: prompt,
                provider,
                maxTokens,
                stream: false
            }, token);
            
            // Show response
            outputChannel.clear();
            outputChannel.appendLine(`=== ${title} ===`);
            outputChannel.appendLine('');
            outputChannel.appendLine(response.content);
            
            // Show token usage if enabled
            if (config.get<boolean>('showTokenUsage') && response.usage) {
                outputChannel.appendLine('');
                outputChannel.appendLine('---');
                outputChannel.appendLine(`Tokens used: ${response.usage.totalTokens}`);
                outputChannel.appendLine(`Cost: $${response.usage.cost?.toFixed(4) || '0.00'}`);
            }
            
            outputChannel.show();
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`AI request failed: ${error.message}`);
        }
    });
}

async function checkAuthStatus() {
    const isAuthenticated = await authManager.isAuthenticated();
    
    if (isAuthenticated) {
        // Update status bar
        const statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        statusBar.text = '$(sparkle) AI Ready';
        statusBar.tooltip = 'AI Assistant is connected';
        statusBar.command = 'aiAssistant.checkUsage';
        statusBar.show();
        
        // List available MCP tools
        try {
            const tools = await client.listTools();
            console.log('Available MCP tools:', tools);
        } catch (error) {
            console.error('Failed to list MCP tools:', error);
        }
    }
}

export function deactivate() {
    outputChannel.dispose();
}

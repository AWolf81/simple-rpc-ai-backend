"use strict";
/**
 * VS Code Extension Example using Progressive AI Client
 *
 * Code Review AI Extension - Shows how to integrate the progressive
 * authentication client for AI-powered code reviews with BYOK
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
exports.CodeReviewAIExtension = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const simple_rpc_ai_backend_1 = require("simple-rpc-ai-backend");
class CodeReviewAIExtension {
    constructor(context) {
        this.context = context;
        // Get device info for stable identification
        const deviceInfo = {
            machineId: vscode.env.machineId,
            hostname: require('os').hostname(),
            platform: require('os').platform(),
            vsCodeVersion: vscode.version
        };
        // Initialize AI client
        this.client = new simple_rpc_ai_backend_1.AIClient({
            baseUrl: this.getBackendUrl(),
            timeout: 60000,
            retries: 3
        }, deviceInfo);
        this.initialize();
    }
    /**
     * Initialize the extension and authentication
     */
    async initialize() {
        try {
            // Try to initialize with authentication first
            if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
                await this.client.initialize();
                const session = this.client.getSession();
                console.log(`🔐 Code Review AI initialized (${session?.authLevel})`);
                // Check if user has valid API keys
                const providers = await this.client.getConfiguredProviders();
                if (providers.length === 0) {
                    this.showApiKeySetupPrompt();
                }
                else {
                    this.showReadyMessage();
                }
            }
            else {
                // Simple client - just show ready message
                console.log(`🔐 Code Review AI initialized (simple mode)`);
                this.showReadyMessage();
            }
        }
        catch (error) {
            // If authentication fails, fall back to simple mode
            if (error.message.includes('Authentication manager not initialized') ||
                error.message.includes('status code 500')) {
                console.log('🔄 Falling back to simple client mode...');
                // Replace with simple client
                this.client = new simple_rpc_ai_backend_1.RPCClient(this.getBackendUrl());
                console.log(`🔐 Code Review AI initialized (simple mode - no auth)`);
                this.showReadyMessage();
            }
            else {
                vscode.window.showErrorMessage(`Failed to initialize Code Review AI: ${error.message}`);
            }
        }
    }
    /**
     * Show API key setup prompt for new users
     */
    async showApiKeySetupPrompt() {
        const choice = await vscode.window.showInformationMessage('🔍 Welcome to Code Review AI! Set up your AI provider to get started.', 'Configure API Keys', 'Learn More');
        if (choice === 'Configure API Keys') {
            this.openSettings();
        }
        else if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.code-review-ai.com/setup'));
        }
    }
    /**
     * Show ready message for existing users
     */
    async showReadyMessage() {
        if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
            const authStatus = await this.client.getAuthStatus();
            if (authStatus.authLevel === 'anonymous') {
                // Suggest OAuth upgrade after some usage
                setTimeout(() => this.suggestMultiDeviceUpgrade(), 60000); // After 1 minute
            }
            vscode.window.showInformationMessage(`🔍 Code Review AI ready! ${authStatus.deviceCount} device(s) connected.`);
        }
        else {
            vscode.window.showInformationMessage(`🔍 Code Review AI ready! (Simple mode - no authentication)`);
        }
    }
    /**
     * Suggest multi-device upgrade for anonymous users
     */
    async suggestMultiDeviceUpgrade() {
        if (!(this.client instanceof simple_rpc_ai_backend_1.AIClient))
            return;
        const upgrade = await this.client.checkUpgradePrompt('multi_device');
        if (!upgrade)
            return;
        const choice = await vscode.window.showInformationMessage('🔗 Sync your code review settings across devices?', 'Sign in with GitHub', 'Sign in with Google', 'Maybe later');
        if (choice && choice.includes('Sign in')) {
            const provider = choice.includes('GitHub') ? 'github' : 'google';
            await this.upgradeToOAuth(provider);
        }
    }
    /**
     * Upgrade to OAuth authentication
     */
    async upgradeToOAuth(provider) {
        try {
            // Use VS Code's built-in authentication
            const session = await vscode.authentication.getSession(provider, ['user:email'], { createIfNone: true });
            if (session) {
                if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
                    await this.client.upgradeToOAuth(provider);
                }
                vscode.window.showInformationMessage(`✅ Successfully signed in with ${provider}! Your settings will now sync across devices.`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Authentication failed: ${error.message}`);
        }
    }
    /**
     * Review current file for security issues
     */
    async reviewFileSecurity() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please open a file to review');
            return;
        }
        await this.performReview('security_review', 'Security Review', '🛡️');
    }
    /**
     * Review current file for code quality
     */
    async reviewFileQuality() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please open a file to review');
            return;
        }
        await this.performReview('code_quality', 'Code Quality Review', '✨');
    }
    /**
     * Review current file for performance issues
     */
    async reviewFilePerformance() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please open a file to review');
            return;
        }
        await this.performReview('performance_review', 'Performance Review', '⚡');
    }
    /**
     * Review selected code snippet
     */
    async reviewSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select some code to review');
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage('Please select some code to review');
            return;
        }
        const reviewType = await vscode.window.showQuickPick([
            { label: '🛡️ Security Review', value: 'security_review' },
            { label: '✨ Code Quality', value: 'code_quality' },
            { label: '⚡ Performance', value: 'performance_review' },
            { label: '📚 Best Practices', value: 'best_practices' }
        ], { placeHolder: 'What type of review would you like?' });
        if (!reviewType)
            return;
        await this.performReview(reviewType.value, reviewType.label, '', selectedText);
    }
    /**
     * Perform AI code review
     */
    async performReview(analysisType, title, icon, customCode) {
        const editor = vscode.window.activeTextEditor;
        const code = customCode || editor.document.getText();
        try {
            // Skip API key check for simple client - server handles keys
            // Only check for AIClient (BYOK mode)
            if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
                const providers = await this.client.getConfiguredProviders();
                if (providers.length === 0) {
                    this.showApiKeySetupPrompt();
                    return;
                }
            }
            // For RPCClient (simple mode), continue directly - server has the keys
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `${icon} ${title}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Analyzing code with AI...' });
                // Execute AI request - handle both client types
                let response;
                if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
                    response = await this.client.executeAIRequest(code, `Perform ${analysisType} analysis on this code`, {
                        fileName: editor.document.fileName,
                        analysisType
                    });
                }
                else {
                    // Simple RPC client - call directly
                    const requestParams = {
                        content: code,
                        systemPrompt: this.getSystemPromptForAnalysis(analysisType),
                        metadata: {
                            fileName: editor.document.fileName,
                            analysisType
                        }
                    };
                    console.log('🔍 Sending AI request:', {
                        method: 'executeAIRequest',
                        contentLength: code.length,
                        systemPrompt: requestParams.systemPrompt,
                        fileName: requestParams.metadata.fileName
                    });
                    response = await this.client.request('executeAIRequest', requestParams);
                    console.log('✅ AI request successful:', response);
                }
                progress.report({ increment: 100, message: 'Review complete!' });
                // Show result in output panel and as diagnostics
                this.showReviewResult(response, title);
            });
        }
        catch (error) {
            console.error('❌ AI request failed:', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                response: error.response?.data
            });
            if (error.message.includes('No valid API keys')) {
                this.showApiKeySetupPrompt();
            }
            else {
                vscode.window.showErrorMessage(`Review failed: ${error.message}`);
            }
        }
    }
    /**
     * Show review result in output panel and create diagnostics
     */
    async showReviewResult(response, reviewType) {
        // Show in output panel
        const outputChannel = vscode.window.createOutputChannel(`Code Review AI - ${reviewType}`);
        outputChannel.clear();
        outputChannel.appendLine(`${reviewType} Results:`);
        outputChannel.appendLine('='.repeat(50));
        outputChannel.appendLine(response.result);
        outputChannel.appendLine('\n' + '='.repeat(50));
        outputChannel.appendLine(`Analysis completed in ${response.metadata.processingTime}ms`);
        outputChannel.appendLine(`Model: ${response.metadata.model} (${response.metadata.provider})`);
        outputChannel.show();
        // Try to parse structured feedback and create diagnostics
        this.createDiagnosticsFromReview(response.result);
        // Show summary notification
        vscode.window.showInformationMessage(`✅ ${reviewType} complete! Check the output panel for details.`, 'Show Results').then(choice => {
            if (choice === 'Show Results') {
                outputChannel.show();
            }
        });
    }
    /**
     * Create VS Code diagnostics from review results
     */
    createDiagnosticsFromReview(reviewText) {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const diagnostics = [];
        const lines = reviewText.split('\n');
        // Simple parsing - look for line references and severity indicators
        for (const line of lines) {
            const lineMatch = line.match(/line\s+(\d+)/i);
            const severityMatch = line.match(/(critical|high|medium|low|error|warning|info)/i);
            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1]) - 1; // VS Code uses 0-based indexing
                const severity = this.getSeverityFromText(severityMatch?.[1] || 'info');
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNumber, 0, lineNumber, Number.MAX_SAFE_INTEGER), line.trim(), severity);
                diagnostic.source = 'Code Review AI';
                diagnostics.push(diagnostic);
            }
        }
        // Set diagnostics for the current file
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeReviewAI');
        diagnosticCollection.set(editor.document.uri, diagnostics);
    }
    /**
     * Convert text severity to VS Code diagnostic severity
     */
    getSeverityFromText(severityText) {
        switch (severityText.toLowerCase()) {
            case 'critical':
            case 'high':
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'medium':
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'low':
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }
    /**
     * Store API key for provider
     */
    async storeApiKey(provider, apiKey) {
        try {
            if (this.client instanceof simple_rpc_ai_backend_1.AIClient) {
                await this.client.storeApiKey(provider, apiKey);
            }
            vscode.window.showInformationMessage(`✅ ${provider} API key stored successfully`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to store API key: ${error.message}`);
        }
    }
    /**
     * Open extension settings
     */
    openSettings() {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codeReviewAI');
    }
    /**
     * Get backend URL from configuration
     */
    getBackendUrl() {
        const config = vscode.workspace.getConfiguration('codeReviewAI');
        return config.get('backendUrl') || 'http://localhost:8000';
    }
    getSystemPromptForAnalysis(analysisType) {
        switch (analysisType) {
            case 'security': return 'security_review';
            case 'quality': return 'code_quality';
            case 'performance': return 'architecture_review';
            default: return 'security_review';
        }
    }
    /**
     * Detect and display server type
     */
    async detectServer() {
        try {
            const response = await fetch(`${this.getBackendUrl()}/config`);
            const config = await response.json();
            const serverType = config.features?.byok ? 'BYOK Server' : 'Basic Server';
            const features = Object.entries(config.features || {})
                .filter(([, value]) => value)
                .map(([key]) => key)
                .join(', ');
            vscode.window.showInformationMessage(`🔍 Server: ${serverType} | Features: ${features} | Version: ${config.version || 'unknown'}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to detect server: ${error.message}`);
        }
    }
    /**
     * Check backend health with server detection
     */
    async checkBackend() {
        try {
            const healthResponse = await fetch(`${this.getBackendUrl()}/health`);
            const configResponse = await fetch(`${this.getBackendUrl()}/config`);
            const health = await healthResponse.json();
            const config = await configResponse.json();
            const serverType = config.features?.byok ? 'BYOK Server' : 'Basic Server';
            vscode.window.showInformationMessage(`✅ ${serverType} healthy | Service: ${health.service || 'AI Backend'}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Backend check failed: ${error.message}`);
        }
    }
    /**
     * Register all commands
     */
    registerCommands() {
        const commands = [
            vscode.commands.registerCommand('codeReviewAI.reviewSecurity', () => this.reviewFileSecurity()),
            vscode.commands.registerCommand('codeReviewAI.reviewQuality', () => this.reviewFileQuality()),
            vscode.commands.registerCommand('codeReviewAI.reviewPerformance', () => this.reviewFilePerformance()),
            vscode.commands.registerCommand('codeReviewAI.reviewSelection', () => this.reviewSelection()),
            vscode.commands.registerCommand('codeReviewAI.openSettings', () => this.openSettings()),
            vscode.commands.registerCommand('codeReviewAI.upgradeAuth', () => this.upgradeToOAuth('github')),
            vscode.commands.registerCommand('codeReviewAI.checkBackend', () => this.checkBackend()),
            vscode.commands.registerCommand('codeReviewAI.detectServer', () => this.detectServer())
        ];
        commands.forEach(cmd => this.context.subscriptions.push(cmd));
    }
    /**
     * Configuration change handler
     */
    onConfigurationChanged() {
        const config = vscode.workspace.getConfiguration('codeReviewAI');
        // Handle API key changes
        const anthropicKey = config.get('anthropicApiKey');
        const openaiKey = config.get('openaiApiKey');
        const googleKey = config.get('googleApiKey');
        if (anthropicKey)
            this.storeApiKey('anthropic', anthropicKey);
        if (openaiKey)
            this.storeApiKey('openai', openaiKey);
        if (googleKey)
            this.storeApiKey('google', googleKey);
    }
    /**
     * Dispose of resources
     */
    dispose() {
        // Cleanup if needed
    }
}
exports.CodeReviewAIExtension = CodeReviewAIExtension;
/**
 * Extension activation function
 */
function activate(context) {
    const extension = new CodeReviewAIExtension(context);
    extension.registerCommands();
    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codeReviewAI')) {
            extension.onConfigurationChanged();
        }
    }));
    return extension;
}
function deactivate() {
    // Cleanup on deactivation
}
//# sourceMappingURL=vscode-extension.js.map
import { publicProcedure, router } from "../../src/trpc/index.js";
import z from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorCode, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { ScopeHelpers, ScopeValidator, createMCPTool } from '../../auth/scopes.js';
import { MCPRateLimiter, getDefaultRateLimiter } from '../../security/rate-limiter.js';
import { SecurityLogger, getDefaultSecurityLogger } from '../../security/security-logger.js';
import { AuthEnforcer, getDefaultAuthEnforcer } from '../../security/auth-enforcer.js';
import fs from 'fs';
import path from 'path';
/**
 * MCP Protocol implementation for tRPC router
 * Provides tools/list and tools/call functionality
 */
export class MCPProtocolHandler {
    appRouter;
    adminUsers;
    jwtMiddleware;
    rateLimiter;
    securityLogger;
    authEnforcer;
    authConfig;
    extensionsConfig;
    constructor(appRouter, config) {
        this.appRouter = appRouter;
        this.adminUsers = config?.adminUsers || [];
        this.jwtMiddleware = config?.jwtMiddleware;
        // Initialize auth config with defaults
        this.authConfig = {
            requireAuthForToolsList: false, // tools/list public by default
            requireAuthForToolsCall: true, // tools/call requires auth by default  
            publicTools: ['greeting'], // greeting is public by default
            ...config?.auth
        };
        // Initialize rate limiter with custom config or defaults
        this.rateLimiter = config?.rateLimiting
            ? new MCPRateLimiter(config.rateLimiting)
            : getDefaultRateLimiter();
        // Initialize security logger with custom config or defaults
        this.securityLogger = config?.securityLogging
            ? new SecurityLogger(config.securityLogging)
            : getDefaultSecurityLogger();
        // Initialize auth enforcer with custom config or defaults
        this.authEnforcer = config?.authEnforcement
            ? new AuthEnforcer(config.authEnforcement)
            : getDefaultAuthEnforcer();
        // Store extensions configuration
        this.extensionsConfig = config?.extensions;
        // Debug: log extensions config
        console.log('🔍 MCP Extensions Config:', {
            hasExtensions: !!this.extensionsConfig,
            prompts: this.extensionsConfig?.prompts ? {
                hasCustomPrompts: !!this.extensionsConfig.prompts.customPrompts,
                customPromptsCount: this.extensionsConfig.prompts.customPrompts?.length || 0,
                customPrompts: this.extensionsConfig.prompts.customPrompts?.map(p => p.name) || []
            } : null,
            resources: this.extensionsConfig?.resources ? {
                hasCustomResources: !!this.extensionsConfig.resources.customResources,
                customResourcesCount: this.extensionsConfig.resources.customResources?.length || 0,
                customResources: this.extensionsConfig.resources.customResources?.map(r => r.name) || []
            } : null
        });
        console.log('✅ Rate limiting: MCP rate limiter initialized');
        console.log('✅ Security logging: MCP security logger initialized');
        console.log('✅ Auth enforcement: MCP auth enforcer initialized');
    }
    /**
     * Check if a user is an admin user
     */
    isAdminUser(userEmail, userId) {
        if (!userEmail && !userId)
            return false;
        if (this.adminUsers.length === 0)
            return false; // No admin users configured
        return this.adminUsers.includes(userEmail || '') || this.adminUsers.includes(userId || '');
    }
    /**
     * Send progress notification to client
     */
    sendProgressNotification(res, progressToken, progress, total, message) {
        const notification = {
            jsonrpc: '2.0',
            method: 'notifications/progress',
            params: {
                progressToken,
                progress,
                total,
                ...(message && { message })
            }
        };
        console.log('📊 Sending progress notification:', notification);
        // In a real implementation, this would be sent via WebSocket or SSE
        // For HTTP, we would need to store progress state and allow polling
        // For now, we'll just log it
    }
    /**
     * Create standardized MCP error response
     */
    createErrorResponse(id, code, message, data) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message,
                ...(data ? { data } : {})
            }
        };
    }
    /**
     * Setup MCP HTTP endpoint on Express app
     */
    setupMCPEndpoint(app, path = '/mcp') {
        // Create security middleware only if enabled
        const networkFilterMiddleware = this.securityLogger.createNetworkFilterMiddleware();
        const mcpLoggingMiddleware = this.securityLogger.createMCPLoggingMiddleware();
        const rateLimitMiddleware = this.rateLimiter.createMCPToolMiddleware();
        const authEnforcementMiddleware = this.authEnforcer.createAuthEnforcementMiddleware();
        // Check if security features are disabled
        const isRateLimitingDisabled = this.rateLimiter.config?.enabled === false;
        const isSecurityLoggingDisabled = this.securityLogger.config?.enabled === false;
        const isAuthEnforcementDisabled = this.authEnforcer.config?.enabled === false;
        // Build middleware chain based on what's enabled
        const middlewareChain = [];
        if (!isSecurityLoggingDisabled) {
            middlewareChain.push(networkFilterMiddleware);
            middlewareChain.push(mcpLoggingMiddleware);
        }
        if (!isRateLimitingDisabled) {
            middlewareChain.push(rateLimitMiddleware);
        }
        if (!isAuthEnforcementDisabled) {
            middlewareChain.push(authEnforcementMiddleware);
        }
        // Apply JWT middleware if configured
        if (this.jwtMiddleware) {
            middlewareChain.push(this.jwtMiddleware.authenticate);
        }
        // Add the main handler
        middlewareChain.push((req, res) => {
            this.handleMCPRequest(req, res);
        });
        // Apply all middleware
        app.post(path, ...middlewareChain);
        // Log configuration
        const enabledFeatures = [];
        if (!isSecurityLoggingDisabled)
            enabledFeatures.push('security logging');
        if (!isRateLimitingDisabled)
            enabledFeatures.push('rate limiting');
        if (!isAuthEnforcementDisabled)
            enabledFeatures.push('auth enforcement');
        if (this.jwtMiddleware)
            enabledFeatures.push('JWT auth');
        if (enabledFeatures.length === 0) {
            console.log(`🧪 MCP endpoint ready at ${path} (ALL SECURITY DISABLED FOR TESTING)`);
        }
        else if (this.jwtMiddleware) {
            console.log(`✅ MCP endpoint ready at ${path} (with ${enabledFeatures.join(', ')})`);
        }
        else {
            console.log(`⚠️  MCP endpoint ready at ${path} (${enabledFeatures.join(', ')} enabled, NO JWT AUTH)`);
            if (!isSecurityLoggingDisabled || !isRateLimitingDisabled || !isAuthEnforcementDisabled) {
                console.log(`🔒 SECURITY WARNING: MCP authentication is disabled!`);
                console.log(`   This allows unrestricted access to all MCP tools and data.`);
                console.log(`   For production use, enable authentication by configuring:`);
                console.log(`   • OpenSaaS JWT: Set opensaas.enabled = true with publicKey`);
                console.log(`   • Or implement custom JWT middleware`);
                console.log(`   • See docs: specs/features/mcp-oauth-authentication.md`);
            }
        }
        app.options(path, (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.status(200).send();
        });
        // Add rate limiting status endpoint for debugging (admin only)
        app.get(`${path}/rate-limit-status`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const status = this.rateLimiter.getStatus();
                res.json(status);
            }
            catch (error) {
                console.error('❌ Rate limiting: Failed to get status:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        // Add security statistics endpoint (admin only)
        app.get(`${path}/security-stats`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const stats = this.securityLogger.getSecurityStats();
                res.json(stats);
            }
            catch (error) {
                console.error('❌ Security logging: Failed to get stats:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        // Add IP management endpoint (admin only)
        app.post(`${path}/admin/block-ip`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const { ip, reason, durationMinutes } = req.body;
                if (!ip || !reason) {
                    return res.status(400).json({
                        error: 'IP address and reason are required'
                    });
                }
                this.securityLogger.blockIP(ip, reason, durationMinutes || 60);
                res.json({ success: true, message: `IP ${ip} blocked` });
            }
            catch (error) {
                console.error('❌ Security logging: Failed to block IP:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        app.post(`${path}/admin/unblock-ip`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const { ip } = req.body;
                if (!ip) {
                    return res.status(400).json({
                        error: 'IP address is required'
                    });
                }
                const wasBlocked = this.securityLogger.unblockIP(ip);
                res.json({
                    success: true,
                    message: wasBlocked ? `IP ${ip} unblocked` : `IP ${ip} was not blocked`
                });
            }
            catch (error) {
                console.error('❌ Security logging: Failed to unblock IP:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        // Add auth enforcement statistics endpoint (admin only)
        app.get(`${path}/auth-stats`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const stats = this.authEnforcer.getUsageStatistics();
                res.json(stats);
            }
            catch (error) {
                console.error('❌ Auth enforcement: Failed to get stats:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        // Add resource usage endpoint (admin only)
        app.get(`${path}/resource-usage`, (req, res) => {
            try {
                const userInfo = req.user;
                const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.userId);
                if (!isAdmin) {
                    return res.status(403).json({
                        error: 'Access denied. Admin privileges required.'
                    });
                }
                const usage = this.authEnforcer.getUsageStatistics();
                res.json(usage);
            }
            catch (error) {
                console.error('❌ Auth enforcement: Failed to get resource usage:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
    }
    /**
     * Handle incoming MCP requests
     */
    async handleMCPRequest(req, res) {
        try {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Content-Type', 'application/json');
            const mcpRequest = req.body;
            console.log('📡 MCP Request:', mcpRequest);
            let response;
            switch (mcpRequest.method) {
                case 'initialize':
                    response = this.handleInitialize(mcpRequest);
                    break;
                case 'ping':
                    response = this.handlePing(mcpRequest);
                    break;
                case 'tools/list':
                    response = await this.handleToolsList(mcpRequest, req);
                    break;
                case 'tools/call':
                    response = await this.handleToolsCall(mcpRequest, req);
                    break;
                case 'prompts/list':
                    response = await this.handlePromptsList(mcpRequest, req);
                    break;
                case 'prompts/get':
                    response = await this.handlePromptsGet(mcpRequest, req);
                    break;
                case 'resources/list':
                    response = await this.handleResourcesList(mcpRequest, req);
                    break;
                case 'resources/read':
                    response = await this.handleResourcesRead(mcpRequest, req);
                    break;
                case 'notifications/cancelled':
                    response = this.handleCancellation(mcpRequest);
                    break;
                default:
                    response = this.createErrorResponse(mcpRequest.id, ErrorCode.MethodNotFound, `Method '${mcpRequest.method}' not found`);
            }
            console.log('📤 MCP Response:', response);
            res.json(response);
        }
        catch (error) {
            console.error('❌ MCP Error:', error);
            const errorResponse = this.createErrorResponse(req.body?.id || null, ErrorCode.InternalError, 'Internal error', error instanceof Error ? error.message : String(error));
            res.status(500).json(errorResponse);
        }
    }
    /**
     * Handle MCP ping method - returns empty result
     */
    handlePing(request) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {}
        };
    }
    /**
     * Handle cancellation notifications
     */
    handleCancellation(request) {
        const { requestId, reason } = request.params || {};
        console.log(`🚫 Cancellation requested for ${requestId}: ${reason}`);
        // In a real implementation, you would:
        // 1. Find the running operation by requestId
        // 2. Cancel/abort the operation
        // 3. Clean up resources
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {}
        };
    }
    /**
     * Handle MCP initialize method
     */
    handleInitialize(request) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'Simple RPC AI Backend MCP',
                    version: '0.1.0'
                }
            }
        };
    }
    /**
     * Handle tools/list method - extract tools from tRPC with MCP metadata
     */
    async handleToolsList(request, req) {
        try {
            // Check if authentication is required for tools/list
            if (this.authConfig.requireAuthForToolsList) {
                // First extract user scopes (this processes OAuth tokens and sets user info)
                const userScopes = this.extractUserScopes(req);
                const userInfo = this.extractUserInfo(req);
                const hasValidToken = userInfo !== null && userInfo !== undefined;
                const authHeaderPresent = req?.headers?.authorization?.startsWith('Bearer ') || false;
                // If an auth header is present but token is invalid, fail immediately
                if (authHeaderPresent && !hasValidToken) {
                    throw new Error('Invalid or expired authentication token');
                }
                // If no auth header and authentication is required, fail
                if (!authHeaderPresent && !hasValidToken) {
                    throw new Error('Authentication required to list tools');
                }
            }
            const allTools = this.extractMCPToolsFromTRPC();
            // Extract user scopes from the request (if authenticated)
            const userScopes = this.extractUserScopes(req);
            // Extract user information for admin validation
            const userInfo = this.extractUserInfo(req);
            // Filter tools based on user scopes and admin restrictions
            const accessibleTools = allTools.filter(tool => {
                if (!tool.scopes) {
                    return true; // No scope requirement = public access
                }
                // Check if this tool requires admin user validation
                if (tool.scopes.requireAdminUser && this.adminUsers.length > 0) {
                    const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);
                    if (!isAdmin) {
                        return false; // User is not an admin, hide the tool
                    }
                }
                // Check scope requirements
                return ScopeValidator.hasScope(userScopes, tool.scopes, userInfo || undefined);
            }).map(tool => ({ name: tool.name, scopes: tool.scopes }));
            // Build the response with accessible tools (scope filtering already applied)
            const tools = accessibleTools.map(accessibleTool => {
                const fullTool = allTools.find(t => t.name === accessibleTool.name);
                return {
                    name: fullTool.name,
                    description: fullTool.description,
                    inputSchema: fullTool.inputSchema
                };
            });
            console.log(`🔍 MCP Tools List: ${allTools.length} total, ${tools.length} accessible for scopes:`, userScopes);
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    tools
                }
            };
        }
        catch (error) {
            return this.createErrorResponse(request.id, ErrorCode.InternalError, 'Failed to list tools', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Handle tools/call method - execute tRPC procedure
     */
    async handleToolsCall(request, req) {
        try {
            const { name, arguments: args, _meta } = request.params;
            if (!name) {
                throw new Error('Tool name is required');
            }
            const tools = this.extractMCPToolsFromTRPC();
            const tool = tools.find(t => t.name === name);
            if (!tool) {
                throw new Error(`Tool '${name}' not found`);
            }
            // Get authentication info - validate OAuth token once and use result for both scopes and user info
            let userInfo = null;
            let userScopes = [];
            // Extract OAuth token validation result
            if (req?.headers?.authorization?.startsWith('Bearer ')) {
                const token = req.headers.authorization.substring(7);
                try {
                    const validationResult = this.validateOAuthToken(token);
                    if (validationResult) {
                        userInfo = validationResult.user;
                        userScopes = validationResult.tokenInfo.scope || [];
                    }
                }
                catch (error) {
                    console.warn('⚠️ OAuth token validation failed:', error);
                }
            }
            // Fallback to existing methods if OAuth validation didn't work
            if (!userInfo) {
                userInfo = this.extractUserInfo(req);
            }
            if (userScopes.length === 0) {
                userScopes = this.extractUserScopes(req);
            }
            console.log('🔍 Debug - Tool scope check:', {
                toolName: name,
                toolScopes: tool.scopes,
                userScopes: userScopes,
                userInfo: userInfo ? { hasEmail: !!userInfo.email, hasId: !!userInfo.id } : null,
                expandedUserScopes: userScopes ? ScopeValidator.expandScopes(userScopes) : [],
                adminUsersConfigured: this.adminUsers.length > 0,
                isAdmin: this.isAdminUser(userInfo?.email, userInfo?.id)
            });
            // Check if tool is public (no authentication required)
            const isPublicTool = this.authConfig.publicTools?.includes(name);
            // For protected tools, check authentication BEFORE checking scopes
            if (tool.scopes && !isPublicTool) {
                // Security: Check authentication first - don't reveal scope requirements for invalid tokens  
                const hasValidToken = userInfo !== null && userInfo !== undefined;
                const authHeaderPresent = req?.headers?.authorization?.startsWith('Bearer ') || false;
                // If an auth header is present but token is invalid, fail immediately
                if (authHeaderPresent && !hasValidToken) {
                    throw new Error('Invalid or expired authentication token');
                }
                // If no auth header and tool requires authentication, fail with generic message
                if (!authHeaderPresent && !hasValidToken) {
                    throw new Error('Authentication required to access this tool');
                }
                // Check if this tool requires admin user validation
                const requiresAdminUser = tool.scopes.requireAdminUser;
                // First check admin user restriction if required
                if (requiresAdminUser && this.adminUsers.length > 0) {
                    const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);
                    if (!isAdmin) {
                        throw new Error(`Access denied. This tool requires administrative privileges.`);
                    }
                }
                // Then check scope requirements (user is already authenticated at this point)
                if (!ScopeValidator.hasScope(userScopes, tool.scopes, userInfo || undefined)) {
                    const missing = ScopeValidator.getMissingScopes(userScopes, tool.scopes);
                    console.log('❌ Debug - Scope validation failed:', {
                        userScopes,
                        toolScopes: tool.scopes,
                        missing: missing,
                        requiresAdminUser,
                        hasUserEmail: !!userInfo?.email,
                        adminUsersConfigured: this.adminUsers.length > 0
                    });
                    // User is authenticated but lacks required scopes - safe to tell them what's missing
                    throw new Error(`Insufficient permissions. Missing scopes: ${missing.missing.join(', ')}`);
                }
            }
            // Get metadata for progress reporting and extensions
            const meta = tool.procedure._def?.meta;
            const mcpExtensions = meta?.mcpExtensions;
            const progressToken = _meta?.progressToken;
            // Sanitize input parameters to prevent command injection
            const sanitizedArgs = this.validateToolInputs(name, args || {});
            // Execute the tRPC procedure with progress support and user context
            const userContext = {
                user: req?.user || null,
                apiKey: req?.tokenInfo?.apiKey || null,
                req: req || null,
                res: null // Not available in this context
            };
            const result = await this.executeTRPCProcedure(tool, sanitizedArgs, progressToken, mcpExtensions, userContext);
            // Format response based on result type
            let content;
            if (typeof result === 'string') {
                // Plain text response
                content = [
                    {
                        type: 'text',
                        text: result
                    }
                ];
            }
            else if (typeof result === 'object' && result !== null) {
                // Structured data - return as both JSON and formatted text
                content = [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2) // Pretty formatted JSON
                    }
                ];
                // For simple objects, also provide key-value text representation
                if (result && typeof result === 'object' && !Array.isArray(result)) {
                    const entries = Object.entries(result);
                    if (entries.length <= 5) { // Only for simple objects
                        const textSummary = entries
                            .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                            .join('\n');
                        content.unshift({
                            type: 'text',
                            text: textSummary
                        });
                    }
                }
            }
            else {
                // Fallback for other types
                content = [
                    {
                        type: 'text',
                        text: String(result)
                    }
                ];
            }
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    content
                }
            };
        }
        catch (error) {
            return this.createErrorResponse(request.id, ErrorCode.InternalError, 'Tool execution failed', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Handle prompts/list method - list available prompts
     */
    async handlePromptsList(request, req) {
        try {
            // Check authentication if required
            if (this.authConfig.requireAuthForToolsList) {
                const userInfo = this.extractUserInfo(req);
                const hasValidToken = userInfo !== null && userInfo !== undefined;
                const authHeaderPresent = req?.headers?.authorization?.startsWith('Bearer ') || false;
                if (authHeaderPresent && !hasValidToken) {
                    throw new Error('Invalid or expired authentication token');
                }
                if (!authHeaderPresent && !hasValidToken) {
                    throw new Error('Authentication required to list prompts');
                }
            }
            // Get prompts from extensions config
            const promptsConfig = this.extensionsConfig?.prompts;
            const prompts = [];
            if (promptsConfig?.customPrompts) {
                for (const customPrompt of promptsConfig.customPrompts) {
                    prompts.push({
                        name: customPrompt.name,
                        description: customPrompt.description,
                        arguments: customPrompt.arguments || []
                    });
                }
            }
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: { prompts }
            };
        }
        catch (error) {
            console.error('❌ MCP prompts/list error:', error);
            return this.createErrorResponse(request.id, ErrorCode.InternalError, `Failed to list prompts: ${error.message}`);
        }
    }
    /**
     * Handle prompts/get method - get specific prompt template
     */
    async handlePromptsGet(request, req) {
        try {
            const { name, arguments: args } = request.params;
            if (!name) {
                throw new Error('Prompt name is required');
            }
            // Get prompt template from extensions config
            const promptsConfig = this.extensionsConfig?.prompts;
            if (!promptsConfig?.customTemplates) {
                throw new Error(`Prompt '${name}' not found - no custom templates configured`);
            }
            const template = promptsConfig.customTemplates[name];
            if (!template) {
                throw new Error(`Prompt '${name}' not found in custom templates`);
            }
            // Replace template variables with provided arguments
            let processedTemplate = { ...template };
            if (args && template.messages) {
                processedTemplate.messages = template.messages.map((message) => {
                    if (message.content && typeof message.content.text === 'string') {
                        let text = message.content.text;
                        // Replace {{variable}} placeholders with argument values
                        Object.entries(args).forEach(([key, value]) => {
                            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                        });
                        return {
                            ...message,
                            content: {
                                ...message.content,
                                text
                            }
                        };
                    }
                    return message;
                });
            }
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: processedTemplate
            };
        }
        catch (error) {
            console.error('❌ MCP prompts/get error:', error);
            return this.createErrorResponse(request.id, ErrorCode.InvalidParams, `Failed to get prompt: ${error.message}`);
        }
    }
    /**
     * Handle resources/list method - list available resources
     */
    async handleResourcesList(request, req) {
        try {
            // Check authentication if required (similar to tools/list)
            if (this.authConfig.requireAuthForToolsList) {
                const userInfo = this.extractUserInfo(req);
                const hasValidToken = userInfo !== null && userInfo !== undefined;
                const authHeaderPresent = req?.headers?.authorization?.startsWith('Bearer ') || false;
                if (authHeaderPresent && !hasValidToken) {
                    throw new Error('Invalid or expired authentication token');
                }
                if (!authHeaderPresent && !hasValidToken) {
                    throw new Error('Authentication required to list resources');
                }
            }
            // Get resources from extensions config
            const resourcesConfig = this.extensionsConfig?.resources;
            const resources = [];
            if (resourcesConfig?.customResources) {
                for (const customResource of resourcesConfig.customResources) {
                    resources.push({
                        uri: customResource.uri,
                        name: customResource.name,
                        description: customResource.description,
                        mimeType: customResource.mimeType
                    });
                }
            }
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: { resources }
            };
        }
        catch (error) {
            console.error('❌ MCP resources/list error:', error);
            return this.createErrorResponse(request.id, ErrorCode.InternalError, `Failed to list resources: ${error.message}`);
        }
    }
    /**
     * Handle resources/read method - read specific resource content
     */
    async handleResourcesRead(request, req) {
        try {
            const { uri } = request.params;
            if (!uri) {
                throw new Error('Resource URI is required');
            }
            // Get resource handler from extensions config
            const resourcesConfig = this.extensionsConfig?.resources;
            if (!resourcesConfig?.customHandlers) {
                throw new Error(`Resource '${uri}' not found - no custom handlers configured`);
            }
            // Extract resource name from URI (e.g., 'file://company-handbook.json' -> 'company-handbook.json')
            const resourceName = uri.replace(/^file:\/\//, '').replace(/^https?:\/\/[^\/]+\//, '');
            const handler = resourcesConfig.customHandlers[resourceName];
            if (!handler || typeof handler !== 'function') {
                throw new Error(`Resource handler for '${resourceName}' not found`);
            }
            // Execute the handler to get resource content
            const content = await handler();
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    contents: [{
                            uri: uri,
                            mimeType: 'application/json', // Default to JSON, could be dynamic based on resource
                            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
                        }]
                }
            };
        }
        catch (error) {
            console.error('❌ MCP resources/read error:', error);
            return this.createErrorResponse(request.id, ErrorCode.InvalidParams, `Failed to read resource: ${error.message}`);
        }
    }
    /**
     * Extract user information from request for admin validation
     */
    extractUserInfo(req) {
        if (!req) {
            return null;
        }
        // Get user from OAuth validation (set by validateOAuthToken)
        const user = req.user;
        if (user) {
            return {
                email: user.email,
                id: user.id,
                name: user.name
            };
        }
        // Get user from session
        const sessionUser = req.session?.user;
        if (sessionUser) {
            return {
                email: sessionUser.email,
                id: sessionUser.id,
                name: sessionUser.name
            };
        }
        return null;
    }
    /**
     * Extract user scopes from request (OAuth token or session)
     */
    extractUserScopes(req) {
        console.log('🔍 Debug - extractUserScopes called:', {
            hasReq: !!req,
            authHeader: req?.headers?.authorization ? `Bearer ${req.headers.authorization.substring(7, 17)}...` : 'none'
        });
        if (!req) {
            console.log('❌ Debug - No request object, returning empty scopes');
            return [];
        }
        // Extract from OAuth token
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            console.log('🔍 Debug - Processing Bearer token:', token.substring(0, 20) + '...');
            // Validate token against OAuth storage and extract scopes
            try {
                const userInfo = this.validateOAuthToken(token);
                console.log('🔍 Debug - OAuth validation result:', {
                    hasUserInfo: !!userInfo,
                    user: userInfo?.user ? `${userInfo.user.name} (${userInfo.user.email})` : null,
                    scopes: userInfo?.tokenInfo?.scope
                });
                if (userInfo) {
                    // Attach user info to request for later use
                    req.user = userInfo.user;
                    req.tokenInfo = userInfo.tokenInfo;
                    const scopes = userInfo.tokenInfo.scope || [];
                    console.log('✅ Debug - Extracted scopes:', scopes);
                    return scopes;
                }
            }
            catch (error) {
                console.warn('⚠️ Invalid OAuth token:', error);
                return [];
            }
        }
        // Extract from session or other auth mechanism
        const user = req.user;
        if (user?.scopes) {
            return Array.isArray(user.scopes) ? user.scopes : [user.scopes];
        }
        // Default: no authentication = public access only
        return [];
    }
    /**
     * Validate OAuth token against stored sessions
     */
    validateOAuthToken(token) {
        // Use synchronous validation since this needs to return immediately
        return this.validateOAuthTokenSync(token);
    }
    validateOAuthTokenSync(token) {
        try {
            const sessionsPath = path.join(process.cwd(), 'data', 'oauth-sessions.json');
            console.log('🔍 Debug - Checking OAuth sessions file:', {
                path: sessionsPath,
                exists: fs.existsSync(sessionsPath)
            });
            if (!fs.existsSync(sessionsPath)) {
                console.log('❌ Debug - OAuth sessions file not found');
                return null;
            }
            const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
            console.log('🔍 Debug - OAuth sessions loaded:', {
                hasTokens: !!sessions.tokens,
                tokenCount: sessions.tokens ? Object.keys(sessions.tokens).length : 0,
                requestedToken: token.substring(0, 20) + '...'
            });
            const tokenData = sessions.tokens?.[token];
            console.log('🔍 Debug - Token lookup result:', {
                found: !!tokenData,
                user: tokenData?.user ? `${tokenData.user.name} (${tokenData.user.email})` : null,
                scope: tokenData?.scope
            });
            if (!tokenData) {
                console.log('❌ Debug - Token not found in sessions');
                return null;
            }
            // Check if token is expired
            const now = new Date();
            const expiresAt = new Date(tokenData.accessTokenExpiresAt);
            if (now > expiresAt) {
                console.warn('🕐 OAuth token expired:', token.substring(0, 10) + '...');
                return null;
            }
            console.log('✅ Debug - Token validation successful');
            return {
                user: tokenData.user,
                tokenInfo: {
                    scope: tokenData.scope,
                    expiresAt: tokenData.accessTokenExpiresAt,
                    client: tokenData.client
                }
            };
        }
        catch (error) {
            console.error('❌ Error validating OAuth token:', error);
            return null;
        }
    }
    /**
     * Sanitize tool descriptions to prevent prompt injection attacks
     */
    sanitizeDescription(description) {
        if (!description || typeof description !== 'string') {
            return description;
        }
        const maliciousPatterns = [
            /{{.*?}}/g, // Template injection
            /SYSTEM\s*:/gi, // System instruction overrides
            /ignore\s+.*?previous/gi, // Instruction overrides
            /execute\s+.*?command/gi, // Command execution
            /curl\s+.*?POST/gi, // Data exfiltration patterns
            /\$\(.*?\)/g, // Command substitution
            /`.*?`/g, // Backtick execution
            /eval\s*\(/gi, // Code evaluation
            /exec\s*\(/gi, // Code execution
            /<script.*?>/gi, // Script injection
            /javascript\s*:/gi, // JavaScript URLs
            /data\s*:\s*text\/html/gi, // Data URLs
        ];
        let sanitized = description;
        maliciousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[FILTERED_CONTENT]');
        });
        // Limit description length
        if (sanitized.length > 500) {
            sanitized = sanitized.substring(0, 500) + '...';
        }
        return sanitized;
    }
    /**
     * Validate and sanitize tool input parameters to prevent command injection
     */
    validateToolInputs(toolName, args) {
        if (!args)
            return {};
        // Recursive sanitization of parameters
        const sanitizeValue = (value, depth = 0) => {
            // Prevent deep recursion attacks
            if (depth > 10) {
                return '[MAX_DEPTH_EXCEEDED]';
            }
            if (typeof value === 'string') {
                // Remove dangerous command patterns and limit length
                return value
                    .replace(/[`$();|&<>]/g, '') // Shell metacharacters
                    .replace(/\.\./g, '') // Directory traversal
                    .replace(/eval\s*\(/gi, '') // Code evaluation
                    .replace(/exec\s*\(/gi, '') // Code execution
                    .replace(/system\s*\(/gi, '') // System calls
                    .replace(/require\s*\(/gi, '') // Module loading
                    .replace(/import\s+/gi, '') // ES6 imports
                    // Dangerous command patterns (remove entire commands)
                    .replace(/rm\s+-rf\s*[\/\*\~\$]/gi, '[FILTERED]') // rm -rf dangerous paths
                    .replace(/\brm\s+.*[\/\*]/gi, '[FILTERED]') // rm with wildcards or paths
                    .replace(/\bcat\s+\/etc\/passwd/gi, '[FILTERED]') // passwd reading
                    .replace(/\bnc\s+\w+\.\w+/gi, '[FILTERED]') // netcat connections
                    .replace(/\bwget\s+http/gi, '[FILTERED]') // wget downloads
                    .replace(/\bcurl\s+\S+/gi, '[FILTERED]') // curl downloads
                    // System instruction injection patterns
                    .replace(/SYSTEM\s*:/gi, '[FILTERED]') // System overrides
                    .replace(/ignore\s+.*previous/gi, '[FILTERED]') // Instruction ignoring
                    .replace(/\{\{.*?\}\}/g, '[FILTERED]') // Template injection
                    .replace(/INSTRUCTION_INJECTION/gi, '[FILTERED]') // Instruction injection
                    .replace(/SYSTEM_OVERRIDE/gi, '[FILTERED]') // System override attempts
                    .substring(0, 2000); // Limit string length
            }
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    // Limit array size and sanitize elements
                    return value.slice(0, 100).map(item => sanitizeValue(item, depth + 1));
                }
                else {
                    // Limit object properties and sanitize values
                    const sanitized = {};
                    const keys = Object.keys(value).slice(0, 50); // Limit properties
                    keys.forEach(key => {
                        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
                        if (sanitizedKey) {
                            sanitized[sanitizedKey] = sanitizeValue(value[key], depth + 1);
                        }
                    });
                    return sanitized;
                }
            }
            // Numbers, booleans pass through unchanged
            return value;
        };
        const sanitizedArgs = sanitizeValue(args);
        // Log potential security issues
        if (JSON.stringify(sanitizedArgs) !== JSON.stringify(args)) {
            console.warn(`🔒 MCP Security: Sanitized potentially dangerous input for tool '${toolName}'`);
        }
        return sanitizedArgs;
    }
    /**
     * Extract MCP tools from tRPC procedures with MCP metadata
     */
    extractMCPToolsFromTRPC() {
        const tools = [];
        try {
            const allProcedures = this.appRouter?._def?.procedures;
            if (!allProcedures) {
                return tools;
            }
            // Look for procedures with MCP metadata
            for (const [fullName, procedure] of Object.entries(allProcedures)) {
                const procedureAny = procedure;
                const meta = procedureAny?._def?.meta;
                if (meta?.mcp) {
                    const inputSchema = this.extractInputSchema(procedureAny);
                    // Use the MCP tool name if specified, otherwise use the procedure name
                    const mcpToolName = meta.mcp.name;
                    const procedureName = fullName.includes('.') ? fullName.split('.').pop() : fullName;
                    const toolName = mcpToolName || procedureName;
                    // Sanitize tool description to prevent prompt injection
                    const rawDescription = meta.mcp.description || `Execute ${toolName}`;
                    const sanitizedDescription = this.sanitizeDescription(rawDescription);
                    tools.push({
                        name: toolName,
                        description: sanitizedDescription,
                        inputSchema,
                        procedure: procedureAny,
                        scopes: meta.mcp.scopes // Include scope requirements
                    });
                }
            }
        }
        catch (error) {
            console.error('Error extracting MCP tools from tRPC:', error);
        }
        return tools;
    }
    /**
     * Extract JSON schema from tRPC input validator
     */
    extractInputSchema(procedure) {
        try {
            const inputParser = procedure._def?.inputs?.[0];
            if (!inputParser) {
                return {
                    type: 'object',
                    properties: {},
                    additionalProperties: false
                };
            }
            // Convert Zod schema to JSON Schema
            const schema = zodToJsonSchema(inputParser, 'InputSchema');
            // MCP expects a direct object schema, not a $ref-based one
            // Extract the actual schema from the definitions if it's using $ref
            if (schema.$ref && schema.definitions) {
                const refKey = schema.$ref.replace('#/definitions/', '');
                const actualSchema = schema.definitions[refKey];
                if (actualSchema) {
                    return actualSchema;
                }
            }
            // If it's already a direct object schema, return as-is
            if (schema.type === 'object') {
                return schema;
            }
            // Fallback: return default object schema
            return {
                type: 'object',
                properties: {},
                additionalProperties: false
            };
        }
        catch (error) {
            console.error('Failed to extract input schema:', error);
            return {
                type: 'object',
                properties: {},
                additionalProperties: false
            };
        }
    }
    /**
     * Execute a tRPC procedure with given arguments and optional progress tracking
     */
    async executeTRPCProcedure(tool, args, progressToken, meta, userContext) {
        const procedure = tool.procedure;
        console.log(`🔍 Executing tRPC procedure ${tool.name} with raw args:`, JSON.stringify(args, null, 2));
        // Validate input if parser exists
        if (procedure._def.inputs?.[0]) {
            const parser = procedure._def.inputs[0];
            // Note: Removed MCP Jam compatibility fallback since mode is now required
            // MCP clients MUST provide the mode parameter
            console.log(`📝 Parsing args with Zod schema...`);
            args = parser.parse(args);
            console.log(`✅ Parsed args:`, JSON.stringify(args, null, 2));
        }
        // Setup progress callback if supported
        let progressCallback;
        if (progressToken && meta?.supportsProgress) {
            progressCallback = (progress, total, message) => {
                // Store the callback for potential use during execution
                console.log(`📊 Progress: ${progress}/${total} - ${message || 'Processing...'}`);
            };
        }
        // Create a context for procedure execution with progress support and user info
        const ctx = {
            type: 'query',
            input: args,
            ctx: {
                progressToken,
                progress: progressCallback,
                // Pass authenticated user info from MCP auth middleware
                user: userContext?.user || null,
                apiKey: userContext?.apiKey || null,
                req: userContext?.req || null,
                res: userContext?.res || null
            }
        };
        console.log(`🔐 Procedure context:`, {
            hasUser: !!ctx.ctx.user,
            userEmail: ctx.ctx.user?.email,
            hasApiKey: !!ctx.ctx.apiKey
        });
        // Execute the resolver
        return await procedure._def.resolver(ctx);
    }
}
export function createMCPRouter(config) {
    return router({
        // Greeting tool with MCP metadata - Public tool (no auth required)
        greeting: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'greeting',
                description: 'Generate a friendly greeting message for a given name in multiple languages',
                category: 'utility',
                public: true // No authentication required
            }),
            openapi: {
                method: 'GET',
                path: '/mcp/hello',
                tags: ['MCP', 'Greetings'],
                summary: 'Generate greeting',
                description: 'Generate a friendly greeting message for a given name'
            }
        })
            .input(z.object({
            name: z.string().min(1).describe('The name to greet'),
            language: z.enum(['en', 'de', 'es']).describe('Language code for the greeting (en=English, de=German, es=Spanish)'),
        }))
            .output(z.object({ greeting: z.string() }))
            .query(({ input }) => {
            const name = input.name || 'World';
            const lang = input.language || 'en';
            let greeting;
            switch (lang) {
                case 'de':
                    greeting = `Hallo ${name}! Willkommen beim Simple RPC AI Backend.`;
                    break;
                case 'es':
                    greeting = `¡Hola ${name}! Bienvenido al Simple RPC AI Backend.`;
                    break;
                default:
                    greeting = `Hello ${name}! Welcome to Simple RPC AI Backend.`;
            }
            return { greeting };
        }),
        // Echo tool with MCP metadata - requires basic MCP access
        echo: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'echo',
                description: 'Echo back a message with optional transformation',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            })
        })
            .input(z.object({
            message: z.string().min(1).describe('Message to echo'),
            transform: z.enum(['uppercase', 'lowercase', 'reverse', 'none']).describe('How to transform the message')
        }))
            .mutation(({ input }) => {
            let result = input.message || 'Hello from MCP!'; // Handle missing parameter with default
            const transform = input.transform || 'none'; // Handle missing transform with default
            switch (transform) {
                case 'uppercase':
                    result = result.toUpperCase();
                    break;
                case 'lowercase':
                    result = result.toLowerCase();
                    break;
                case 'reverse':
                    result = result.split('').reverse().join('');
                    break;
                case 'none':
                default:
                    // No transformation
                    break;
            }
            return `Echo: ${result}`;
        }),
        // Status tool - requires system read access
        status: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'status',
                description: 'Get server status and information',
                category: 'system',
                scopes: ScopeHelpers.system('read') // Requires system:read scope
            })
        })
            .input(z.object({
            detailed: z.boolean().describe('Include detailed system information?')
        }))
            .query(({ input }) => {
            console.log('🔍 Status called with input:', JSON.stringify(input, null, 2));
            const baseStatus = {
                server: 'Simple RPC AI Backend',
                version: '0.1.0',
                status: 'healthy',
                uptime: Math.floor(process.uptime()),
                timestamp: new Date().toISOString()
            };
            // if (input.mode === 'detailed') {  // enum approach
            if (input.detailed) { // boolean approach
                return {
                    ...baseStatus,
                    details: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        memory: {
                            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                        }
                    }
                };
            }
            return baseStatus;
        }),
        // Math tool - public utility tool
        calculate: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'calculate',
                description: 'Perform basic mathematical calculations',
                category: 'utility',
                public: true // Public calculation tool
            })
        })
            .input(z.object({
            expression: z.string().min(1).describe('Mathematical expression (e.g., "2 + 3 * 4")'),
            precision: z.number().min(0).max(10).describe('Decimal precision for results')
        }))
            .mutation(({ input }) => {
            try {
                // Handle safe defaults in code
                const expression = input.expression || '2 + 2';
                const precision = input.precision ?? 2;
                // Simple expression evaluator (for demo - in production use a proper math parser)
                const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
                const result = Function('"use strict"; return (' + sanitized + ')')();
                if (typeof result !== 'number' || !isFinite(result)) {
                    throw new Error('Invalid mathematical expression');
                }
                const rounded = Number(result.toFixed(precision));
                return {
                    expression: expression,
                    result: rounded,
                    formatted: `${expression} = ${rounded}`
                };
            }
            catch (error) {
                throw new Error(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        // Long-running task with progress support
        longRunningTask: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'longRunningTask',
                description: 'Demonstrate a long-running task with progress reporting and cancellation support',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            }),
            // Custom MCP extensions - handled by our MCP processor
            mcpExtensions: {
                supportsProgress: true,
                supportsCancellation: true
            }
        })
            .input(z.object({
            duration: z.number().min(1).max(60).optional().default(5).describe('Task duration in seconds'),
            steps: z.number().min(1).max(100).optional().default(10).describe('Number of steps to complete')
        }))
            .mutation(async ({ input, ctx }) => {
            console.log('📥 Long-running task received input:', JSON.stringify(input, null, 2));
            const { duration, steps } = input;
            const stepDuration = (duration * 1000) / steps;
            // Generate a unique task ID
            const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            // Initialize global task registry if needed
            if (!global.mcpTaskRegistry) {
                global.mcpTaskRegistry = new Map();
            }
            // Register task for cancellation
            const taskData = {
                name: 'longRunningTask',
                cancelled: false,
                startTime: Date.now(),
                duration,
                steps,
                currentStep: 0
            };
            global.mcpTaskRegistry.set(taskId, taskData);
            // Access progress callback from context if available
            const progressCallback = ctx?.ctx?.progress;
            console.log(`🚀 Starting long-running task: ${taskId} (duration: ${duration}s, steps: ${steps})`);
            const progressLog = [];
            try {
                for (let i = 0; i < steps; i++) {
                    // Check for cancellation (check the global registry)
                    const currentTaskData = global.mcpTaskRegistry.get(taskId);
                    if (currentTaskData?.cancelled) {
                        console.log(`🚫 Task ${taskId} cancelled at step ${i + 1}/${steps}`);
                        return {
                            message: `Task cancelled after ${i} of ${steps} steps`,
                            taskId,
                            duration,
                            steps: i,
                            cancelled: true,
                            completed: false,
                            progressLog,
                            finalProgress: {
                                current: i,
                                total: steps,
                                percentage: Math.round((i / steps) * 100)
                            }
                        };
                    }
                    // Update current progress in registry
                    if (currentTaskData) {
                        currentTaskData.currentStep = i + 1;
                    }
                    // Simulate work
                    await new Promise(resolve => setTimeout(resolve, stepDuration));
                    // Log progress step
                    const progressMessage = `Completed step ${i + 1} of ${steps}`;
                    progressLog.push({
                        step: i + 1,
                        timestamp: new Date().toISOString(),
                        message: progressMessage
                    });
                    // Report progress if callback available
                    if (progressCallback) {
                        progressCallback(i + 1, steps, progressMessage);
                    }
                    console.log(`📊 Progress: ${i + 1}/${steps} (${Math.round(((i + 1) / steps) * 100)}%)`);
                }
                console.log(`✅ Task ${taskId} completed successfully`);
                return {
                    message: `Task completed successfully in ${duration} seconds with ${steps} steps`,
                    taskId,
                    duration,
                    steps,
                    completed: true,
                    cancelled: false,
                    progressLog,
                    finalProgress: {
                        current: steps,
                        total: steps,
                        percentage: 100
                    }
                };
            }
            finally {
                // Clean up task tracking
                global.mcpTaskRegistry?.delete(taskId);
                console.log(`🧹 Cleaned up task: ${taskId}`);
            }
        }),
        // Tool with cancellation support
        cancellableTask: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'cancellableTask',
                description: 'A task that can be cancelled mid-execution',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            }),
            // Custom MCP extensions - handled by our MCP processor
            mcpExtensions: {
                supportsCancellation: true
            }
        })
            .input(z.object({
            iterations: z.number().min(1).max(1000).default(100).describe('Number of iterations to perform')
        }))
            .mutation(async ({ input, ctx: _ctx }) => {
            const { iterations } = input;
            let completed = 0;
            for (let i = 0; i < iterations; i++) {
                // Simulate work
                await new Promise(resolve => setTimeout(resolve, 50));
                completed++;
                // Check for cancellation (in real implementation)
                // if ((_ctx as any)?.ctx?.cancelled) {
                //     return { message: `Task cancelled after ${completed} iterations`, completed };
                // }
            }
            return {
                message: `Task completed all ${iterations} iterations`,
                completed
            };
        }),
        // Cancel running task tool
        cancelTask: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'cancelTask',
                description: 'Cancel a running task by its task ID',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            })
        })
            .input(z.object({
            taskId: z.string().min(1).optional().default('demo-task').describe('ID of the task to cancel')
        }))
            .mutation(({ input }) => {
            const { taskId } = input;
            // Access the global cancellation system
            const taskData = global.mcpTaskRegistry?.get(taskId);
            if (!taskData) {
                return {
                    message: `Task ${taskId} not found or already completed`,
                    taskId,
                    cancelled: false,
                    error: 'Task not found'
                };
            }
            console.log(`🚫 Cancelling task: ${taskId} (${taskData.name})`);
            // Trigger cancellation
            taskData.cancelled = true;
            if (taskData.cancelCallback) {
                taskData.cancelCallback();
            }
            return {
                message: `Task ${taskId} has been cancelled`,
                taskId,
                taskName: taskData.name,
                cancelled: true
            };
        }),
        // List running tasks tool
        listRunningTasks: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'listRunningTasks',
                description: 'List all currently running tasks',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            })
        })
            .input(z.object({
            includeCompleted: z.boolean().default(false).describe('Include completed tasks in the list')
        }))
            .query(({ input }) => {
            // Get actual running tasks from global registry
            const registry = global.mcpTaskRegistry || new Map();
            const runningTasks = [];
            for (const [taskId, taskData] of registry.entries()) {
                const elapsedTime = Date.now() - taskData.startTime;
                const progress = taskData.currentStep || 0;
                runningTasks.push({
                    id: taskId,
                    name: taskData.name,
                    status: taskData.cancelled ? 'cancelled' : 'running',
                    progress,
                    total: taskData.steps,
                    progressPercentage: Math.round((progress / taskData.steps) * 100),
                    duration: taskData.duration,
                    elapsedTime: Math.round(elapsedTime / 1000),
                    startTime: new Date(taskData.startTime).toISOString(),
                    cancelled: taskData.cancelled
                });
            }
            // Mock completed tasks for demo
            const mockCompletedTasks = input.includeCompleted ? [
                {
                    id: 'task_completed_001',
                    name: 'Example Completed Task',
                    status: 'completed',
                    progress: 50,
                    total: 50,
                    progressPercentage: 100,
                    duration: 30,
                    elapsedTime: 30,
                    startTime: new Date(Date.now() - 60000).toISOString(),
                    endTime: new Date(Date.now() - 30000).toISOString(),
                    cancelled: false
                }
            ] : [];
            const allTasks = [...runningTasks, ...mockCompletedTasks];
            const tasks = input.includeCompleted
                ? allTasks
                : runningTasks;
            return {
                tasks,
                totalRunning: runningTasks.length,
                totalCompleted: mockCompletedTasks.length,
                registrySize: registry.size
            };
        }),
        // Example: Demonstrating flexible middleware usage with advanced scoping
        advancedExample: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'advancedExample',
                description: 'Demonstrate flexible MCP middleware patterns',
                category: 'admin',
                scopes: ScopeHelpers.custom(['admin', 'mcp:admin'], 'Advanced MCP administration features', { anyOf: true, namespace: 'mcp', privileged: true })
            })
        })
            .input(z.object({
            action: z.enum(['check', 'process']).describe('Action to perform')
        }))
            .query(({ input, ctx }) => {
            const action = input.action ?? 'check'; // Handle missing in code
            return {
                action: action,
                user: ctx.user ? `${ctx.user.email} (${ctx.user.name || 'user'})` : 'Anonymous',
                hasApiKey: !!ctx.apiKey,
                message: `Successfully executed ${action}`
            };
        }),
        // Get progress for a specific task
        getTaskProgress: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'getTaskProgress',
                description: 'Get real-time progress for a specific task',
                category: 'utility',
                scopes: ScopeHelpers.mcpCall() // Requires mcp:call scope
            })
        })
            .input(z.object({
            taskId: z.string().min(1).optional().default('demo-task').describe('ID of the task to check progress for')
        }))
            .query(({ input }) => {
            const { taskId } = input;
            const registry = global.mcpTaskRegistry || new Map();
            const taskData = registry.get(taskId);
            if (!taskData) {
                return {
                    taskId,
                    found: false,
                    error: 'Task not found or completed'
                };
            }
            const elapsedTime = Date.now() - taskData.startTime;
            const progress = taskData.currentStep || 0;
            const progressPercentage = Math.round((progress / taskData.steps) * 100);
            const estimatedTimeRemaining = progress > 0 ?
                Math.round(((taskData.steps - progress) / progress) * elapsedTime / 1000) :
                taskData.duration;
            return {
                taskId,
                found: true,
                name: taskData.name,
                status: taskData.cancelled ? 'cancelled' : 'running',
                progress: {
                    current: progress,
                    total: taskData.steps,
                    percentage: progressPercentage,
                    message: `Step ${progress} of ${taskData.steps}`
                },
                timing: {
                    startTime: new Date(taskData.startTime).toISOString(),
                    elapsedSeconds: Math.round(elapsedTime / 1000),
                    estimatedRemainingSeconds: estimatedTimeRemaining,
                    totalDurationSeconds: taskData.duration
                },
                cancelled: taskData.cancelled
            };
        }),
        // Get authenticated user information from OAuth session (Admin only)
        getUserInfo: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'getUserInfo',
                description: 'Get information about the authenticated user from OAuth session (Admin only)',
                category: 'auth',
                scopes: {
                    anyOf: ['admin', 'mcp:admin'],
                    description: 'Admin access required',
                    namespace: 'admin',
                    privileged: true,
                    requireAdminUser: true // This will be checked dynamically against adminUsers config
                }
            })
        })
            .input(z.object({
            includeTokenInfo: z.boolean().describe('Include token expiration and scopes')
        }))
            .query(({ input, ctx }) => {
            // Handle missing parameter with default
            const includeTokenInfo = input.includeTokenInfo ?? false;
            // Extract user information from context (populated by OAuth middleware)
            const req = ctx?.req;
            // Try to get user info from various sources
            // The user is set directly in ctx.user by executeTRPCProcedure
            const user = ctx?.user || req?.user || null;
            const tokenInfo = ctx?.tokenInfo || req?.tokenInfo || null;
            if (!user) {
                return {
                    authenticated: false,
                    message: 'No authenticated user found. Please complete OAuth authentication first.'
                };
            }
            // Build user information response
            const userInfo = {
                authenticated: true,
                user: {
                    id: user.id,
                    username: user.username || user.email,
                    email: user.email,
                    name: user.name,
                    provider: user.provider || 'oauth'
                }
            };
            // Add token information if requested
            if (includeTokenInfo && tokenInfo) {
                userInfo.token = {
                    scopes: tokenInfo.scope || [],
                    expiresAt: tokenInfo.accessTokenExpiresAt,
                    hasRefreshToken: !!tokenInfo.refreshToken
                };
            }
            return userInfo;
        })
    });
}

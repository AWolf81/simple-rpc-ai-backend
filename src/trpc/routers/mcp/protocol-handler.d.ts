import { Response } from 'express';
import { type AuthenticatedRequest } from '../../../auth/jwt-middleware';
import { MCPRouterConfig } from './types';
/**
 * MCP Protocol implementation for tRPC router
 * Provides tools/list and tools/call functionality
 */
/**
 * DNS rebinding protection configuration
 */
export interface DNSRebindingConfig {
    /** List of allowed host header values for DNS rebinding protection */
    allowedHosts?: string[];
    /** List of allowed origin header values for DNS rebinding protection */
    allowedOrigins?: string[];
    /** Enable DNS rebinding protection (requires allowedHosts and/or allowedOrigins to be configured) */
    enableDnsRebindingProtection?: boolean;
}
export declare class MCPProtocolHandler {
    private appRouter;
    private adminUsers;
    private jwtMiddleware?;
    private rateLimiter;
    private securityLogger;
    private authEnforcer;
    private authConfig;
    private extensionsConfig?;
    private rootManager?;
    private dnsRebindingConfig;
    private clientCapabilities;
    private aiEnabled;
    private namespaceWhitelist?;
    constructor(appRouter: any, config?: MCPRouterConfig);
    /**
     * Set the workspace manager for server-side filesystem access
     * Note: This is for server-managed directories, not MCP client roots
     */
    setWorkspaceManager(workspaceManager: any): void;
    /**
     * @deprecated Use setWorkspaceManager instead
     */
    setRootManager(rootManager: any): void;
    private logInitialization;
    /**
     * Check if a user is an admin user
     */
    private isAdminUser;
    /**
     * Apply namespace whitelist filtering to tools
     */
    private applyNamespaceWhitelist;
    private buildPromptVariableDefinitions;
    /**
     * Determine if a tool should be public based on hybrid configuration
     */
    private isToolPublic;
    /**
     * Create standardized MCP error response
     */
    private createErrorResponse;
    /**
     * Setup MCP HTTP endpoint on Express app
     */
    setupMCPEndpoint(app: any, path?: string): void;
    private logEndpointSetup;
    /**
     * Validates request headers for DNS rebinding protection.
     * Based on the official MCP SDK implementation.
     * @returns Error message if validation fails, undefined if validation passes.
     */
    private validateRequestHeaders;
    /**
     * Handle incoming MCP requests
     */
    handleMCPRequest(req: AuthenticatedRequest, res: Response): Promise<void>;
    private handlePing;
    private handleInitialize;
    private extractUserInfo;
    private extractUserScopes;
    private extractMCPToolsFromTRPC;
    /**
     * Extract MCP prompts from tRPC procedures with mcpPrompt metadata
     * Prompts are user-facing templates, distinct from internal system prompts
     */
    private extractMCPPromptsFromTRPC;
    private extractInputSchema;
    private sanitizeDescription;
    private handleToolsList;
    private handleToolsCall;
    private handlePromptsList;
    private handlePromptsGet;
    private handleLegacyPromptsList;
    private handleResourcesList;
    private handleResourcesRead;
    private handleRootsList;
    private handleCancellation;
    private handleNotificationInitialized;
    private handleRootsListChanged;
    private handleResourcesTemplatesList;
}
//# sourceMappingURL=protocol-handler.d.ts.map
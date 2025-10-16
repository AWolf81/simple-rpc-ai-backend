"use strict";
/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
exports.createAppRouter = createAppRouter;
exports.generateTRPCMethods = generateTRPCMethods;
const index_1 = require("@src-trpc/index");
const ai_1 = require("@src-trpc/routers/ai");
const ai_service_1 = require("@services/ai/ai-service");
const types_1 = require("@src-trpc/routers/ai/types");
const index_2 = require("@src-trpc/routers/mcp/index");
const system_1 = require("@src-trpc/routers/system");
const user_1 = require("@src-trpc/routers/user");
const billing_1 = require("@src-trpc/routers/billing");
const auth_1 = require("@src-trpc/routers/auth");
const admin_1 = require("@src-trpc/routers/admin");
const agents_1 = require("@src-trpc/routers/agents");
const agent_service_1 = require("@services/agents/agent-service");
const virtual_token_service_1 = require("@services/billing/virtual-token-service");
const usage_analytics_service_1 = require("@services/billing/usage-analytics-service");
const workspace_manager_1 = require("@services/resources/workspace-manager");
const logger_js_1 = require("../utils/logger.js");
/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods, mcpConfig, modelRestrictions, serverWorkspaces, customRouters, agentConfig) {
    // Initialize services if database is available
    let virtualTokenService = null;
    let usageAnalyticsService = null;
    let hybridUserService = null; // TODO: Import proper type
    if (dbAdapter) {
        usageAnalyticsService = new usage_analytics_service_1.UsageAnalyticsService(dbAdapter);
        if (tokenTrackingEnabled) {
            virtualTokenService = new virtual_token_service_1.VirtualTokenService(dbAdapter);
        }
    }
    // Initialize WorkspaceManager for server workspaces
    let workspaceManager;
    if (serverWorkspaces?.enabled) {
        const hasDefault = typeof serverWorkspaces.defaultWorkspace?.path === 'string' && serverWorkspaces.defaultWorkspace.path.trim().length > 0;
        const hasAdditional = !!serverWorkspaces.additionalWorkspaces && Object.keys(serverWorkspaces.additionalWorkspaces).length > 0;
        if (hasDefault || hasAdditional) {
            try {
                const workspaceManagerConfig = {};
                if (hasDefault && serverWorkspaces.defaultWorkspace) {
                    const normalizedDefault = {
                        ...serverWorkspaces.defaultWorkspace,
                        path: serverWorkspaces.defaultWorkspace.path.trim()
                    };
                    workspaceManagerConfig.defaultWorkspace = normalizedDefault;
                }
                if (hasAdditional && serverWorkspaces.additionalWorkspaces) {
                    const normalizedAdditional = Object.fromEntries(Object.entries(serverWorkspaces.additionalWorkspaces)
                        .filter(([, config]) => typeof config?.path === 'string' && config.path.trim().length > 0)
                        .map(([workspaceId, config]) => [
                        workspaceId,
                        {
                            ...config,
                            path: config.path.trim()
                        }
                    ]));
                    if (Object.keys(normalizedAdditional).length > 0) {
                        workspaceManagerConfig.serverWorkspaces = normalizedAdditional;
                    }
                }
                if (!workspaceManagerConfig.defaultWorkspace && !workspaceManagerConfig.serverWorkspaces) {
                    throw new Error('No valid workspace paths provided');
                }
                workspaceManager = new workspace_manager_1.WorkspaceManager(workspaceManagerConfig);
            }
            catch (error) {
                logger_js_1.logger.warn('⚠️  Failed to initialize server workspace manager:', error instanceof Error ? error.message : error);
            }
        }
        else {
            logger_js_1.logger.warn('⚠️  serverWorkspaces.enabled is true but no workspace paths are configured. Skipping workspace manager initialization.');
        }
    }
    // Create shared AI service instance for MCP and Agents
    const needsSharedAIService = mcpConfig?.ai?.enabled || agentConfig?.enabled;
    const sharedAIService = needsSharedAIService
        ? (() => {
            // Use MCP-specific configuration if useServerConfig is false
            if (mcpConfig.ai.useServerConfig === false) {
                // Use MCP-specific providers and configuration
                const mcpProviders = mcpConfig.ai.mcpProviders;
                const serviceProvidersConfig = mcpProviders
                    ? (0, types_1.createMCPServiceProvidersConfig)(mcpProviders)
                    : (0, types_1.createServiceProvidersConfig)(['anthropic']); // Default fallback
                return new ai_service_1.AIService({
                    serviceProviders: serviceProvidersConfig,
                    modelRestrictions: mcpConfig.ai.modelRestrictions || modelRestrictions,
                    ...(mcpConfig.ai.aiServiceConfig || {})
                });
            }
            else {
                // Use server configuration (current behavior)
                return new ai_service_1.AIService({
                    serviceProviders: (0, types_1.createServiceProvidersConfig)(serverProviders || ['anthropic']),
                    modelRestrictions
                });
            }
        })()
        : null;
    // Create routers
    const systemRouter = (0, system_1.createSystemRouter)(workspaceManager);
    const userRouter = (0, user_1.createUserRouter)(virtualTokenService, usageAnalyticsService, hybridUserService, byokProviders);
    const billingRouter = (0, billing_1.createBillingRouter)(virtualTokenService, usageAnalyticsService, hybridUserService);
    const authRouter = (0, auth_1.createAuthRouter)(postgresRPCMethods);
    const adminRouter = (0, admin_1.createAdminRouter)({
        adminUsers: ['admin@company.com'],
        requireAdminAuth: true,
        usageAnalyticsService,
        virtualTokenService
    });
    const aiRouter = (0, ai_1.createAIRouter)({
        config: aiConfig,
        tokenTrackingEnabled,
        dbAdapter,
        serverProviders,
        byokProviders,
        postgresRPCMethods,
        modelRestrictions
    });
    // Initialize Agent Service if enabled
    let agentService;
    if (agentConfig?.enabled && sharedAIService) {
        try {
            agentService = new agent_service_1.AgentService(sharedAIService, {
                defaultSDK: agentConfig.defaultSDK,
                enableClaudeCode: agentConfig.enableClaudeCode,
                enableOpenAI: agentConfig.enableOpenAI,
                claudeCode: agentConfig.claudeCode,
                openai: agentConfig.openai
            });
            // Initialize asynchronously - services should handle this
            agentService.initialize().catch(error => {
                logger_js_1.logger.error('Failed to initialize agent service:', error);
            });
            logger_js_1.logger.debug(`🤖 Agent service initialized`);
        }
        catch (error) {
            logger_js_1.logger.error('Failed to create agent service:', error);
        }
    }
    // Build base routers object
    const baseRouters = {
        ai: aiRouter,
        system: systemRouter,
        user: userRouter,
        billing: billingRouter,
        auth: authRouter,
        admin: adminRouter
    };
    // Only include MCP router if enabled
    if (mcpConfig?.enabled !== false) {
        const mcpRouter = (0, index_2.createMCPRouter)({
            auth: mcpConfig?.auth,
            ai: mcpConfig?.ai,
            aiService: sharedAIService,
            namespaceWhitelist: mcpConfig?.namespaceWhitelist
        });
        baseRouters.mcp = mcpRouter;
        logger_js_1.logger.debug(`🔧 MCP router included`);
    }
    else {
        logger_js_1.logger.debug(`🔧 MCP router excluded (disabled in config)`);
    }
    // Only include Agents router if enabled and agent service is available
    if (agentConfig?.enabled && agentService) {
        const agentsRouter = (0, agents_1.createAgentRouter)({
            agentService,
            agentConfig
        });
        baseRouters.agents = agentsRouter;
        logger_js_1.logger.debug(`🤖 Agents router included`);
    }
    else if (agentConfig?.enabled) {
        logger_js_1.logger.warn(`⚠️  Agents enabled but agent service not available (AI service may be missing)`);
    }
    else {
        logger_js_1.logger.debug(`🤖 Agents router excluded (disabled in config)`);
    }
    // Merge custom routers if provided
    const allRouters = customRouters ? { ...baseRouters, ...customRouters } : baseRouters;
    const appRouter = (0, index_1.router)(allRouters);
    //const mcpServer = createMcpServer(implementation, appRouter);
    // Attach the SDK integration from MCP router to the main app router
    /*const mcpSdkIntegration = (mcpRouter as any).sdkIntegration;
    if (mcpSdkIntegration) {
      (appRouter as any).sdkIntegration = mcpSdkIntegration;
      console.log('✅ SDK integration attached to app router');
    } else {
      console.warn('⚠️  No SDK integration found on MCP router');
    }*/
    return appRouter;
}
/**
 * Default app router with default configuration
 */
exports.appRouter = createAppRouter();
/**
 * Generate tRPC methods documentation
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
function generateTRPCMethods() {
    // This is now handled by the build script
    // The methods are available in dist/trpc-methods.json
    throw new Error('tRPC methods are generated at build time. Check dist/trpc-methods.json');
}
//# sourceMappingURL=root.js.map
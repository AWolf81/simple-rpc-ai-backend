/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { router } from '@src-trpc/index';
import { createAIRouter } from '@src-trpc/routers/ai';
import { AIService } from '@services/ai/ai-service';
import { createServiceProvidersConfig, createMCPServiceProvidersConfig } from '@src-trpc/routers/ai/types';
import { createMCPRouter } from '@src-trpc/routers/mcp/index';
import { createSystemRouter } from '@src-trpc/routers/system';
import { createUserRouter } from '@src-trpc/routers/user';
import { createBillingRouter } from '@src-trpc/routers/billing';
import { createAuthRouter } from '@src-trpc/routers/auth';
import { createAdminRouter } from '@src-trpc/routers/admin';
import { createAgentRouter } from '@src-trpc/routers/agents';
import { AgentService } from '@services/agents/agent-service';
import { VirtualTokenService } from '@services/billing/virtual-token-service';
import { UsageAnalyticsService } from '@services/billing/usage-analytics-service';
import { WorkspaceManager } from '@services/resources/workspace-manager';
import { logger } from '../utils/logger.js';
/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods, mcpConfig, modelRestrictions, serverWorkspaces, customRouters, agentConfig) {
    // Initialize services if database is available
    let virtualTokenService = null;
    let usageAnalyticsService = null;
    let hybridUserService = null; // TODO: Import proper type
    if (dbAdapter) {
        usageAnalyticsService = new UsageAnalyticsService(dbAdapter);
        if (tokenTrackingEnabled) {
            virtualTokenService = new VirtualTokenService(dbAdapter);
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
                workspaceManager = new WorkspaceManager(workspaceManagerConfig);
            }
            catch (error) {
                logger.warn('⚠️  Failed to initialize server workspace manager:', error instanceof Error ? error.message : error);
            }
        }
        else {
            logger.warn('⚠️  serverWorkspaces.enabled is true but no workspace paths are configured. Skipping workspace manager initialization.');
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
                    ? createMCPServiceProvidersConfig(mcpProviders)
                    : createServiceProvidersConfig(['anthropic']); // Default fallback
                return new AIService({
                    serviceProviders: serviceProvidersConfig,
                    modelRestrictions: mcpConfig.ai.modelRestrictions || modelRestrictions,
                    ...(mcpConfig.ai.aiServiceConfig || {})
                });
            }
            else {
                // Use server configuration (current behavior)
                return new AIService({
                    serviceProviders: createServiceProvidersConfig(serverProviders || ['anthropic']),
                    modelRestrictions
                });
            }
        })()
        : null;
    // Create routers
    const systemRouter = createSystemRouter(workspaceManager);
    const userRouter = createUserRouter(virtualTokenService, usageAnalyticsService, hybridUserService, byokProviders);
    const billingRouter = createBillingRouter(virtualTokenService, usageAnalyticsService, hybridUserService);
    const authRouter = createAuthRouter(postgresRPCMethods);
    const adminRouter = createAdminRouter({
        adminUsers: ['admin@company.com'],
        requireAdminAuth: true,
        usageAnalyticsService,
        virtualTokenService
    });
    const aiRouter = createAIRouter({
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
            agentService = new AgentService(sharedAIService, {
                defaultSDK: agentConfig.defaultSDK,
                enableClaudeCode: agentConfig.enableClaudeCode,
                enableOpenAI: agentConfig.enableOpenAI,
                claudeCode: agentConfig.claudeCode,
                openai: agentConfig.openai
            });
            // Initialize asynchronously - services should handle this
            agentService.initialize().catch(error => {
                logger.error('Failed to initialize agent service:', error);
            });
            logger.debug(`🤖 Agent service initialized`);
        }
        catch (error) {
            logger.error('Failed to create agent service:', error);
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
        const mcpRouter = createMCPRouter({
            auth: mcpConfig?.auth,
            ai: mcpConfig?.ai,
            aiService: sharedAIService,
            namespaceWhitelist: mcpConfig?.namespaceWhitelist
        });
        baseRouters.mcp = mcpRouter;
        logger.debug(`🔧 MCP router included`);
    }
    else {
        logger.debug(`🔧 MCP router excluded (disabled in config)`);
    }
    // Only include Agents router if enabled and agent service is available
    if (agentConfig?.enabled && agentService) {
        const agentsRouter = createAgentRouter({
            agentService,
            agentConfig
        });
        baseRouters.agents = agentsRouter;
        logger.debug(`🤖 Agents router included`);
    }
    else if (agentConfig?.enabled) {
        logger.warn(`⚠️  Agents enabled but agent service not available (AI service may be missing)`);
    }
    else {
        logger.debug(`🤖 Agents router excluded (disabled in config)`);
    }
    // Merge custom routers if provided
    const allRouters = customRouters ? { ...baseRouters, ...customRouters } : baseRouters;
    const appRouter = router(allRouters);
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
export const appRouter = createAppRouter();
/**
 * Generate tRPC methods documentation
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
export function generateTRPCMethods() {
    // This is now handled by the build script
    // The methods are available in dist/trpc-methods.json
    throw new Error('tRPC methods are generated at build time. Check dist/trpc-methods.json');
}
//# sourceMappingURL=root.js.map
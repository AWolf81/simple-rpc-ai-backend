import { router } from "../../index.js";
import { utilityProcedures } from "./methods/utility.js";
import { taskProcedures } from "./methods/task.js";
import { resourceProcedures } from "./methods/resource.js";
import { createSamplingProcedures } from "./methods/sampling.js";
import { promptProcedures } from "./methods/prompt.js";
import { adminProcedures } from "./methods/admin.js";
import { MCPProtocolHandler } from "./protocol-handler.js";
/**
 * Create MCP router with all procedure modules
 */
export function createMCPRouter(config = {}) {
    // Only enable AI-powered sampling if explicitly enabled
    const aiConfig = {
        enabled: config.ai?.enabled || false,
        useServerConfig: config.ai?.useServerConfig !== false,
        restrictToSampling: config.ai?.restrictToSampling !== false,
        allowByokOverride: config.ai?.allowByokOverride || false
    };
    // Create sampling procedures with AI service only if AI is enabled
    const samplingProcedures = (aiConfig.enabled && config.aiService)
        ? createSamplingProcedures(config.aiService, aiConfig)
        : {};
    const mcpRouter = router({
        // Utility procedures
        ...utilityProcedures,
        // Task management procedures
        ...taskProcedures,
        // Resource management procedures
        ...resourceProcedures,
        // Sampling and elicitation procedures
        ...samplingProcedures,
        // Prompt management procedures
        ...promptProcedures,
        // Administrative procedures
        ...adminProcedures,
    });
    // Initialize protocol handler with the router
    const protocolHandler = new MCPProtocolHandler(mcpRouter, config);
    // Attach protocol handler and config to the router for compatibility
    mcpRouter.protocolHandler = protocolHandler;
    mcpRouter.config = config;
    return mcpRouter;
}
// Export individual procedure modules for testing or custom composition
export { utilityProcedures, taskProcedures, resourceProcedures, createSamplingProcedures, promptProcedures, adminProcedures, MCPProtocolHandler };
// Default export for backwards compatibility
export default createMCPRouter;

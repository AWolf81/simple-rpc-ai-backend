import { router } from "../../index";
import { utilityProcedures } from "./methods/utility";
import { taskProcedures } from "./methods/task";
import { resourceProcedures } from "./methods/resource";
import { createSamplingProcedures } from "./methods/sampling";
import { promptProcedures } from "./methods/prompt";
import { adminProcedures } from "./methods/admin";
import { MCPProtocolHandler } from "./protocol-handler";
import type { MCPRouterConfig } from "./types";

/**
 * Create MCP router with all procedure modules
 */
export function createMCPRouter(config: MCPRouterConfig = {}): ReturnType<typeof router> {
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
  (mcpRouter as any).protocolHandler = protocolHandler;
  (mcpRouter as any).config = config;

  return mcpRouter;
}

// Export types for external use
export type { MCPRouterConfig, MCPAuthConfig } from "./types";

// Export individual procedure modules for testing or custom composition
export {
  utilityProcedures,
  taskProcedures,
  resourceProcedures,
  createSamplingProcedures,
  promptProcedures,
  adminProcedures,
  MCPProtocolHandler
};

// Default export for backwards compatibility
export default createMCPRouter;
/**
 * MCP Router - Refactored modular structure
 *
 * This file provides the main export for the MCP router, now organized
 * into a modular structure under ./mcp/ folder for better maintainability.
 *
 * Main exports:
 * - createMCPRouter: Main router factory function
 * - MCPRouterConfig: Configuration interface
 * - MCPAuthConfig: Authentication configuration
 * - MCPProtocolHandler: Protocol handler class
 */
// Re-export everything from the modular structure
export { createMCPRouter, MCPProtocolHandler, utilityProcedures, taskProcedures, resourceProcedures, samplingProcedures, promptProcedures, adminProcedures } from './mcp/index.js';
// Import for default export
import { createMCPRouter } from './mcp/index.js';
// Default export
export default createMCPRouter;

/**
 * Simple Server Factory
 *
 * Easy-to-use server creation with minimal configuration required.
 * Perfect for getting started quickly while still allowing advanced customization.
 */
import { createRpcAiServer } from './rpc-ai-server.js';
import { createSimpleServerConfig, simpleConfigs, createEnvBasedConfig } from './simple-server-config.js';
/**
 * Create a simple AI server with minimal configuration
 *
 * @param config Simple configuration options
 * @returns Server instance ready to start
 *
 * @example
 * ```typescript
 * // Minimal setup - just start a development server
 * const server = createSimpleAIServer();
 * server.start();
 *
 * // With basic customization
 * const server = createSimpleAIServer({
 *   port: 3000,
 *   providers: ['anthropic', 'openai'],
 *   enableMCP: true
 * });
 * server.start();
 *
 * // Production setup with database
 * const server = createSimpleAIServer({
 *   preset: 'production',
 *   providers: ['anthropic', 'openai', 'google'],
 *   auth: { type: 'both', adminUsers: ['admin@company.com'] },
 *   database: {
 *     url: process.env.DATABASE_URL,
 *     enableTokenTracking: true,
 *     enableSecretManager: true
 *   }
 * });
 * server.start();
 * ```
 */
export function createSimpleAIServer(config = {}) {
    const fullConfig = createSimpleServerConfig(config);
    return createRpcAiServer(fullConfig);
}
/**
 * Quick server presets for common scenarios
 */
export const simpleServers = {
    /**
     * Development server - permissive settings, no auth
     */
    dev: (port) => createSimpleAIServer({
        ...simpleConfigs.dev(),
        port: port || 8000
    }),
    /**
     * Production server - secure settings, full auth
     */
    prod: (port) => createSimpleAIServer({
        ...simpleConfigs.prod(),
        port: port || 8000
    }),
    /**
     * Demo server - public access, no auth required
     */
    demo: (port) => createSimpleAIServer({
        ...simpleConfigs.demo(),
        port: port || 8000
    }),
    /**
     * Enterprise server - maximum security
     */
    enterprise: (port) => createSimpleAIServer({
        ...simpleConfigs.enterprise(),
        port: port || 8000
    })
};
/**
 * Environment-aware server creation
 * Automatically configures based on NODE_ENV
 */
export function createEnvAIServer(overrides = {}) {
    const config = createEnvBasedConfig(overrides);
    return createSimpleAIServer(config);
}
/**
 * One-liner server creation and start
 *
 * @example
 * ```typescript
 * // Start a development server on port 3000
 * startSimpleAIServer({ port: 3000 });
 *
 * // Start based on environment
 * startSimpleAIServer();
 * ```
 */
export async function startSimpleAIServer(config = {}) {
    const server = createEnvAIServer(config);
    await server.start();
    return server;
}

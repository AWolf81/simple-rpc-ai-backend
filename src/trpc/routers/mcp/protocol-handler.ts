import { Request, Response } from 'express';
import { TRPCError } from '@trpc/server';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorCode, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { ScopeValidator } from '../../../auth/scopes';
import { JWTMiddleware, type AuthenticatedRequest } from '../../../auth/jwt-middleware';
import { MCPRateLimiter, getDefaultRateLimiter } from '../../../security/rate-limiter';
import { SecurityLogger, getDefaultSecurityLogger } from '../../../security/security-logger';
import { AuthEnforcer, getDefaultAuthEnforcer } from '../../../security/auth-enforcer';
import { MCPRouterConfig, MCPAuthConfig } from './types';
import { mcpResourceRegistry } from '../../../services/resources/mcp/mcp-resource-registry.js';
import { logger } from '../../../utils/logger.js';
import fs from 'fs';
import path from 'path';

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

export class MCPProtocolHandler {
  private appRouter: any;
  private adminUsers: string[];
  private jwtMiddleware?: JWTMiddleware;
  private rateLimiter: MCPRateLimiter;
  private securityLogger: SecurityLogger;
  private authEnforcer: AuthEnforcer;
  private authConfig: MCPAuthConfig;
  private extensionsConfig?: MCPRouterConfig['extensions'];
  private rootManager?: any;
  private dnsRebindingConfig: DNSRebindingConfig;
  private clientCapabilities: any = null;
  private aiEnabled: boolean;
  private namespaceWhitelist?: string[];

  constructor(appRouter: any, config?: MCPRouterConfig) {
    this.appRouter = appRouter;
    this.adminUsers = config?.adminUsers || [];
    this.jwtMiddleware = config?.jwtMiddleware;
    this.aiEnabled = config?.ai?.enabled || false;
    this.namespaceWhitelist = config?.namespaceWhitelist;

    // Initialize auth config with defaults
    this.authConfig = {
      requireAuthForToolsList: false,    // tools/list public by default
      requireAuthForToolsCall: true,     // tools/call requires auth by default
      publicTools: ['greeting'],         // greeting is public by default
      ...config?.auth
    };

    // Initialize DNS rebinding protection config
    this.dnsRebindingConfig = {
      enableDnsRebindingProtection: false, // Default to disabled for backward compatibility
      ...config?.dnsRebinding
    };

    // Initialize security components
    this.rateLimiter = config?.rateLimiting
      ? new MCPRateLimiter(config.rateLimiting)
      : getDefaultRateLimiter();

    this.securityLogger = config?.securityLogging
      ? new SecurityLogger(config.securityLogging)
      : getDefaultSecurityLogger();

    this.authEnforcer = config?.authEnforcement?.enabled
      ? new AuthEnforcer(config.authEnforcement)
      : new AuthEnforcer({ enabled: false });

    this.extensionsConfig = config?.extensions;

    this.logInitialization();
  }

  /**
   * Set the workspace manager for server-side filesystem access
   * Note: This is for server-managed directories, not MCP client roots
   */
  setWorkspaceManager(workspaceManager: any) {
    this.rootManager = workspaceManager; // Keep existing property name for compatibility
  }

  /**
   * @deprecated Use setWorkspaceManager instead
   */
  setRootManager(rootManager: any) {
    this.setWorkspaceManager(rootManager);
  }

  private logInitialization() {
    const hasExtensions = !!this.extensionsConfig;
    const prompts = this.extensionsConfig?.prompts?.customPrompts || [];
    const resources = this.extensionsConfig?.resources?.customResources || [];

    if (hasExtensions) {
      const promptSummary = prompts.length ? `${prompts.length} custom prompts (${prompts.map(p => p.name).join(', ')})` : 'no custom prompts';
      const resourceSummary = resources.length ? `${resources.length} custom resources (${resources.map(r => r.name).join(', ')})` : 'no custom resources';
      logger.debug(`🔍 MCP extensions – ${promptSummary}; ${resourceSummary}`);
    } else {
      logger.debug('🔍 MCP extensions disabled');
    }

    logger.debug('✅ Rate limiting: MCP rate limiter initialized');
    logger.debug('✅ Security logging: MCP security logger initialized');
    if (this.authEnforcer && (this.authEnforcer as any).config?.enabled !== false) {
      logger.debug('✅ Auth enforcement: MCP auth enforcer initialized');
    } else {
      logger.debug('ℹ️  Auth enforcement: Disabled (simple mode)');
    }
  }

  /**
   * Check if a user is an admin user
   */
  private isAdminUser(userEmail?: string, userId?: string): boolean {
    if (!userEmail && !userId) return false;
    if (this.adminUsers.length === 0) return false;

    return this.adminUsers.includes(userEmail || '') || this.adminUsers.includes(userId || '');
  }

  /**
   * Apply namespace whitelist filtering to tools
   */
  private applyNamespaceWhitelist(tools: Array<{ name: string; fullName: string; description: string; inputSchema: any; procedure: any; scopes?: any }>): Array<{ name: string; fullName: string; description: string; inputSchema: any; procedure: any; scopes?: any }> {
    if (!this.namespaceWhitelist || this.namespaceWhitelist.length === 0) {
      // No whitelist specified - allow all tools
      return tools;
    }

    return tools.filter(tool => {
      // Extract namespace from fullName (e.g., "math.add" -> "math")
      const namespace = tool.fullName.includes('.') ? tool.fullName.split('.')[0] : tool.fullName;
      const isWhitelisted = this.namespaceWhitelist!.includes(namespace);

      if (!isWhitelisted) {
        console.log(`🚫 Tool ${tool.fullName} filtered out: namespace "${namespace}" not in whitelist [${this.namespaceWhitelist!.join(', ')}]`);
      }

      return isWhitelisted;
    });
  }

  private buildPromptVariableDefinitions(config: {
    arguments?: Array<{ name: string; description?: string; required?: boolean; type?: string; options?: Array<string | number | boolean>; default?: unknown; example?: unknown }>;
    variables?: Record<string, any>;
  }): Record<string, any> {
    const variables: Record<string, any> = {};

    if (config.variables) {
      for (const [key, value] of Object.entries(config.variables)) {
        variables[key] = { ...value };
      }
    }

    if (config.arguments) {
      for (const arg of config.arguments) {
        const current = variables[arg.name] || {};
        variables[arg.name] = {
          type: current.type || arg.type || 'string',
          description: current.description || arg.description,
          required: current.required ?? arg.required ?? false,
          options: current.options || arg.options,
          default: current.default ?? arg.default,
          example: current.example ?? arg.example,
        };
      }
    }

    return variables;
  }

  /**
   * Determine if a tool should be public based on hybrid configuration
   */
  private isToolPublic(tool: { name: string; category?: string; public?: boolean }): boolean {
    // 1. Explicit deny always wins (security override)
    if (this.authConfig.denyPublicTools?.includes(tool.name)) {
      return false;
    }

    // 2. Explicit allow list (array of tool names)
    if (Array.isArray(this.authConfig.publicTools)) {
      return this.authConfig.publicTools.includes(tool.name);
    }

    // 3. 'default' means use tool metadata + category filtering
    if (this.authConfig.publicTools === 'default') {
      if (this.authConfig.publicCategories && tool.category) {
        if (!this.authConfig.publicCategories.includes(tool.category)) {
          return false;
        }
      }
      return tool.public === true;
    }

    // 4. Legacy support
    if (this.authConfig._legacyPublicTools?.includes(tool.name)) {
      return true;
    }

    // 5. Default: tool metadata
    return tool.public === true;
  }

  /**
   * Create standardized MCP error response
   */
  private createErrorResponse(id: any, code: ErrorCode, message: string, data?: unknown) {
    return {
      jsonrpc: '2.0' as const,
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
  setupMCPEndpoint(app: any, path: string = '/mcp') {
    // Create and apply middleware chain
    const middlewareChain: any[] = [];

    // Add security middleware if enabled
    if ((this.securityLogger as any).config?.enabled !== false) {
      middlewareChain.push(this.securityLogger.createNetworkFilterMiddleware());
      middlewareChain.push(this.securityLogger.createMCPLoggingMiddleware());
    }

    if ((this.rateLimiter as any).config?.enabled !== false) {
      middlewareChain.push(this.rateLimiter.createMCPToolMiddleware());
    }

    if ((this.authEnforcer as any).config?.enabled !== false) {
      middlewareChain.push(this.authEnforcer.createAuthEnforcementMiddleware());
    }

    if (this.jwtMiddleware) {
      middlewareChain.push(this.jwtMiddleware.authenticate);
    }

    // Add the main handler
    middlewareChain.push((req: AuthenticatedRequest, res: Response) => {
      this.handleMCPRequest(req, res);
    });

    // Apply all middleware
    app.post(path, ...middlewareChain);

    // Add CORS preflight
    app.options(path, (req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(200).send();
    });

    this.logEndpointSetup(path);
  }

  private logEndpointSetup(path: string) {
    const enabledFeatures: string[] = [];
    if ((this.securityLogger as any).config?.enabled !== false) enabledFeatures.push('security logging');
    if ((this.rateLimiter as any).config?.enabled !== false) enabledFeatures.push('rate limiting');
    if ((this.authEnforcer as any).config?.enabled !== false) enabledFeatures.push('auth enforcement');
    if (this.jwtMiddleware) enabledFeatures.push('JWT auth');

    if (enabledFeatures.length === 0) {
      console.log(`🧪 MCP endpoint ready at ${path} (ALL SECURITY DISABLED FOR TESTING)`);
    } else if (this.jwtMiddleware) {
      console.log(`✅ MCP endpoint ready at ${path} (with ${enabledFeatures.join(', ')})`);
    } else {
      console.log(`⚠️  MCP endpoint ready at ${path} (${enabledFeatures.join(', ')} enabled, NO JWT AUTH)`);
      if (enabledFeatures.length > 0) {
        console.log(`🔒 SECURITY WARNING: MCP authentication is disabled!`);
        console.log(`   This allows unrestricted access to all MCP tools and data.`);
        console.log(`   For production use, enable authentication by configuring:`);
        console.log(`   • OpenSaaS JWT: Set opensaas.enabled = true with publicKey`);
        console.log(`   • Or implement custom JWT middleware`);
        console.log(`   • See docs: specs/features/mcp-oauth-authentication.md`);
      }
    }
  }

  /**
   * Validates request headers for DNS rebinding protection.
   * Based on the official MCP SDK implementation.
   * @returns Error message if validation fails, undefined if validation passes.
   */
  private validateRequestHeaders(req: Request): string | undefined {
    // Skip validation if protection is not enabled
    if (!this.dnsRebindingConfig.enableDnsRebindingProtection) {
      return undefined;
    }

    // Validate Host header if allowedHosts is configured
    if (this.dnsRebindingConfig.allowedHosts && this.dnsRebindingConfig.allowedHosts.length > 0) {
      const hostHeader = req.headers.host;
      if (!hostHeader || !this.dnsRebindingConfig.allowedHosts.includes(hostHeader)) {
        return `Invalid Host header: ${hostHeader}`;
      }
    }

    // Validate Origin header if allowedOrigins is configured
    if (this.dnsRebindingConfig.allowedOrigins && this.dnsRebindingConfig.allowedOrigins.length > 0) {
      const originHeader = req.headers.origin;
      if (!originHeader || !this.dnsRebindingConfig.allowedOrigins.includes(originHeader)) {
        return `Invalid Origin header: ${originHeader}`;
      }
    }

    return undefined;
  }

  /**
   * Handle incoming MCP requests
   */
  public async handleMCPRequest(req: AuthenticatedRequest, res: Response) {
    try {
      // Validate request headers for DNS rebinding protection
      const validationError = this.validateRequestHeaders(req);
      if (validationError) {
        res.status(403).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: validationError
          },
          id: null
        });
        console.error(`🔒 DNS rebinding protection: ${validationError}`);
        return;
      }

      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Content-Type', 'application/json');

      const mcpRequest = req.body;
      const requestId = mcpRequest.id || 'unknown';

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
        case 'resources/templates/list':
          response = await this.handleResourcesTemplatesList(mcpRequest, req);
          break;
        case 'roots/list':
          response = await this.handleRootsList(mcpRequest, req);
          break;
        case 'notifications/cancelled':
          response = this.handleCancellation(mcpRequest);
          break;
        case 'notifications/initialized':
          response = this.handleNotificationInitialized(mcpRequest);
          break;
        case 'notifications/roots/list_changed':
          response = this.handleRootsListChanged(mcpRequest);
          break;
        default:
          response = this.createErrorResponse(
            mcpRequest.id,
            ErrorCode.MethodNotFound,
            `Method '${mcpRequest.method}' not found`
          );
      }

      res.json(response);

    } catch (error) {
      logger.error('MCP Error:', error);
      const errorResponse = this.createErrorResponse(
        req.body?.id || null,
        ErrorCode.InternalError,
        'Internal error',
        // In production, don't expose error details
        process.env.NODE_ENV === 'production'
          ? undefined
          : (error instanceof Error ? error.message : String(error))
      );
      res.status(500).json(errorResponse);
    }
  }

  // ... (continuing with the handler methods - these would be very long)
  // For now, I'll include the key ones and indicate where the others would go

  private handlePing(request: any) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {}
    };
  }

  private handleInitialize(request: any) {
    // Store client capabilities for later use
    this.clientCapabilities = request.params?.capabilities || {};

    const hasClientRootsCapability = this.clientCapabilities.roots?.listChanged === true;

    console.log('🔗 MCP Initialize:', {
      clientSupportsRoots: hasClientRootsCapability,
      clientCapabilities: this.clientCapabilities
    });

    const capabilities: any = { tools: {} };

    if (this.extensionsConfig?.prompts) {
      capabilities.prompts = {};
    }

    if (this.extensionsConfig?.resources) {
      capabilities.resources = {
        subscribe: true,
        listChanged: true
      };
    }

    // Note: Server doesn't advertise roots capability since roots are client-managed
    // The client should call roots/list on the server to discover client roots
    // We only add this for debugging/compatibility if explicitly requested
    if (hasClientRootsCapability) {
      console.log('📋 Client supports roots - server will accept roots/list calls');
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities,
        serverInfo: {
          name: 'Simple RPC AI Backend MCP',
          version: '0.1.0'
        }
      }
    };
  }

  // Extract user info and scopes (simplified versions)
  private extractUserInfo(req?: Request): { email?: string; id?: string; name?: string } | null {
    if (!req) return null;

    const user = (req as any).user;
    if (user) {
      return {
        email: user.email,
        id: user.id,
        name: user.name
      };
    }

    return null;
  }

  private extractUserScopes(req?: Request): string[] {
    if (!req) return [];

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return [];
    }

    // Simplified scope extraction - full implementation would handle JWT/OAuth
    return [];
  }

  // Tool discovery and execution methods
  private extractMCPToolsFromTRPC(): Array<{
    name: string;
    fullName: string;
    description: string;
    inputSchema: any;
    procedure: any;
    scopes?: any;
    category?: string;
    public?: boolean;
    requireAdminUser?: boolean;
  }> {
    const tools: Array<{
      name: string;
      fullName: string;
      description: string;
      inputSchema: any;
      procedure: any;
      scopes?: any;
      category?: string;
      public?: boolean;
      requireAdminUser?: boolean;
    }> = [];

    try {
      const allProcedures = this.appRouter?._def?.procedures;

      if (!allProcedures) {
        return tools;
      }

      for (const [fullName, procedure] of Object.entries(allProcedures)) {
        const procedureAny = procedure as any;
        const meta = procedureAny?._def?.meta;

        if (meta?.mcp) {
          // Skip AI tools if AI is disabled
          if (!this.aiEnabled && fullName.startsWith('ai.')) {
            continue;
          }

          const inputSchema = this.extractInputSchema(procedureAny);
          const mcpToolName = meta.mcp.name;
          const procedureName = fullName.includes('.') ? fullName.split('.').pop()! : fullName;
          const toolName = mcpToolName || procedureName;
          const sanitizedDescription = this.sanitizeDescription(meta.mcp.description || `Execute ${toolName}`);

          tools.push({
            name: toolName,
            fullName: fullName,
            description: sanitizedDescription,
            inputSchema,
            procedure: procedureAny,
            scopes: meta.mcp.scopes,
            category: meta.mcp.category,
            public: meta.mcp.public,
            requireAdminUser: meta.mcp.requireAdminUser
          });
        }
      }
    } catch (error) {
      console.error('Error extracting MCP tools from tRPC:', error);
    }

    // Apply namespace whitelist filtering
    const filteredTools = this.applyNamespaceWhitelist(tools);

    if (this.namespaceWhitelist && this.namespaceWhitelist.length > 0) {
      console.log(`🔍 Namespace filtering: ${tools.length} tools found, ${filteredTools.length} after whitelist filter [${this.namespaceWhitelist.join(', ')}]`);
    }

    return filteredTools;
  }

  /**
   * Extract MCP prompts from tRPC procedures with mcpPrompt metadata
   * Prompts are user-facing templates, distinct from internal system prompts
   */
  private extractMCPPromptsFromTRPC(): Array<{
    name: string;
    description: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean; type?: string; options?: Array<string | number | boolean>; default?: unknown; example?: unknown }>;
    template?: string;
    variables?: Record<string, any>;
    procedure: any;
    category?: string;
    public?: boolean;
    scopes?: any;
  }> {
    const prompts: Array<{
      name: string;
      description: string;
      arguments?: Array<{ name: string; description?: string; required?: boolean; type?: string; options?: Array<string | number | boolean>; default?: unknown; example?: unknown }>;
      template?: string;
      variables?: Record<string, any>;
      procedure: any;
      category?: string;
      public?: boolean;
      scopes?: any;
    }> = [];

    try {
      const allProcedures = this.appRouter?._def?.procedures;

      if (!allProcedures) {
        return prompts;
      }

      for (const [fullName, procedure] of Object.entries(allProcedures)) {
        const procedureAny = procedure as any;
        const meta = procedureAny?._def?.meta;

        if (meta?.mcpPrompt) {
          const config = meta.mcpPrompt;
          const sanitizedDescription = this.sanitizeDescription(
            config.description || `Prompt: ${config.name}`
          );

          prompts.push({
            name: config.name,
            description: sanitizedDescription,
            arguments: config.arguments || [],
            template: config.template,
            variables: config.variables,
            procedure: procedureAny,
            category: config.category,
            public: config.public,
            scopes: config.scopes
          });
        }
      }
    } catch (error) {
      console.error('Error extracting MCP prompts from tRPC:', error);
    }

    return prompts;
  }

  private extractInputSchema(procedure: any): any {
    try {
      const inputParser = procedure._def?.inputs?.[0];

      if (!inputParser) {
        return {
          type: 'object',
          properties: {},
          additionalProperties: false
        };
      }

      const schema = zodToJsonSchema(inputParser, 'InputSchema') as any;

      if (schema.$ref && schema.definitions) {
        const refKey = schema.$ref.replace('#/definitions/', '');
        const actualSchema = schema.definitions[refKey];
        if (actualSchema) {
          return actualSchema;
        }
      }

      if (schema.type === 'object') {
        return schema;
      }

      return {
        type: 'object',
        properties: {},
        additionalProperties: false
      };
    } catch (error) {
      console.error('Failed to extract input schema:', error);
      return {
        type: 'object',
        properties: {},
        additionalProperties: false
      };
    }
  }

  private sanitizeDescription(description: string): string {
    if (!description || typeof description !== 'string') {
      return description;
    }

    const maliciousPatterns = [
      /{{.*?}}/g,
      /SYSTEM\s*:/gi,
      /ignore\s+.*?previous/gi,
      /execute\s+.*?command/gi,
      /\$\(.*?\)/g,
      /<script.*?>/gi,
    ];

    let sanitized = description;
    maliciousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[FILTERED_CONTENT]');
    });

    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + '...';
    }

    return sanitized;
  }

  // MCP handler implementations
  private async handleToolsList(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      // Check auth requirements for tools/list
      if (this.authConfig.requireAuthForToolsList && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for tools/list'
        );
      }

      // Extract user info for authorization checks
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);
      const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);

      // Get all available MCP tools from tRPC procedures
      const mcpTools = this.extractMCPToolsFromTRPC();

      // Filter tools based on auth and visibility rules
      const availableTools = mcpTools
        .map(tool => {
          // Check if tool should be public
          const isPublic = this.isToolPublic({
            name: tool.name,
            public: true // Default to public for tRPC MCP tools
          });

          // Check scope requirements if defined
          let hasRequiredScopes = true;
          if (tool.scopes && userScopes.length > 0) {
            hasRequiredScopes = ScopeValidator.hasScope(userScopes, tool.scopes, userInfo);
          }

          return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            isPublic,
            hasRequiredScopes,
            procedure: tool.procedure
          };
        })
        .filter(tool => {
          // Include tool if:
          // 1. It's public, OR
          // 2. User is authenticated and has required scopes, OR
          // 3. User is admin
          return tool.isPublic || (req?.user && tool.hasRequiredScopes) || isAdmin;
        })
        .map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }));

      logger.debug(`MCP tools/list: ${availableTools.length} tools available (user: ${userInfo?.email || 'anonymous'})`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: availableTools
        }
      };

    } catch (error) {
      console.error('❌ Error in handleToolsList:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list tools',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleToolsCall(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      const { name, arguments: args } = request.params || {};

      if (!name) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          'Tool name is required'
        );
      }

      // Check auth requirements for tools/call
      if (this.authConfig.requireAuthForToolsCall && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for tools/call'
        );
      }

      // Extract user info
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);
      const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);

      // Privacy: Don't log user input - only log tool name and arg count
      logger.debug(`MCP tools/call: ${name} (${Object.keys(args || {}).length} args)`);

      // Find the requested tool
      const mcpTools = this.extractMCPToolsFromTRPC();
      const tool = mcpTools.find(t => t.name === name || t.fullName === name);

      if (!tool) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          `Tool '${name}' not found`
        );
      }

      // Check if tool is accessible to user
      const isPublic = this.isToolPublic({
        name: tool.name,
        category: tool.category,
        public: tool.public
      });

      // Check scope requirements if defined
      let hasRequiredScopes = true;
      let missingScopeInfo: { missing: string[]; type: 'required' | 'anyOf' | 'none' } = {
        missing: [],
        type: 'none'
      };

      if (tool.scopes) {
        hasRequiredScopes = ScopeValidator.hasScope(userScopes, tool.scopes, userInfo);
        if (!hasRequiredScopes) {
          missingScopeInfo = ScopeValidator.getMissingScopes(userScopes, tool.scopes);
        }
      }

      // Authorization check
      if (!isPublic && !isAdmin && (!req?.user || !hasRequiredScopes)) {
        const requiresAdminUser = tool.requireAdminUser || Boolean((tool.scopes as any)?.adminUsers);
        const responseMessage = !req?.user
          ? `Authentication required for tool '${name}'`
          : requiresAdminUser
            ? `Admin privileges required for tool '${name}'`
            : missingScopeInfo.missing.length > 0
              ? `Missing required permissions for tool '${name}': ${missingScopeInfo.missing.join(', ')}`
              : `Missing required permissions for tool '${name}'`;

        const errorData = {
          reason: !req?.user
            ? 'authentication_required'
            : requiresAdminUser
              ? 'admin_required'
              : 'insufficient_scopes',
          user: userInfo?.email || userInfo?.id || 'anonymous',
          ...(missingScopeInfo.type !== 'none'
            ? {
                missingScopes: missingScopeInfo.missing,
                missingType: missingScopeInfo.type
              }
            : {})
        };

        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidRequest,
          responseMessage,
          errorData
        );
      }

      // Execute the tRPC procedure
      const procedure = tool.procedure;
      const inputParser = procedure._def?.inputs?.[0];

      // Validate input if parser exists
      let validatedInput = args || {};
      if (inputParser) {
        try {
          validatedInput = inputParser.parse(args || {});
        } catch (error: any) {
          // Extract simple error summary for logging
          const errorSummary = error?.issues
            ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            : error instanceof Error ? error.message : String(error);

          // Debug only - MCP clients may send empty args on first call
          logger.debug(`Validation failed for ${name}: ${errorSummary}`);

          return this.createErrorResponse(
            request.id,
            ErrorCode.InvalidParams,
            `Invalid input parameters: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Create execution context
      const ctx = {
        user: req?.user,
        type: procedure._def?.type || 'mutation',
        appRouter: this.appRouter // Add appRouter for tools that need to discover procedures
      };

      // Privacy: Don't log user input - only log tool name
      logger.debug(`Executing tool ${name}`);

      // Execute the procedure resolver
      const result = await procedure._def.resolver({
        input: validatedInput,
        ctx,
        type: procedure._def?.type || 'mutation',
        path: name,
        getRawInput: () => validatedInput
      });

      logger.debug(`Tool ${name} executed successfully`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };

    } catch (error) {
      logger.error(`Error executing tool ${request.params?.name}:`, error);

      if (error instanceof TRPCError) {
        const errorCode = error.code === 'FORBIDDEN'
          ? ErrorCode.InvalidRequest
          : ErrorCode.InternalError;

        return this.createErrorResponse(
          request.id,
          errorCode,
          error.message || 'Tool execution failed',
          {
            reason: error.code,
            ...(error.cause ? { cause: String(error.cause) } : {})
          }
        );
      }

      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to execute tool',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handlePromptsList(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      // Check auth requirements if enabled
      if (this.authConfig.requireAuthForToolsList && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for prompts/list'
        );
      }

      // Extract prompts from tRPC procedures with mcpPrompt metadata
      const mcpPrompts = this.extractMCPPromptsFromTRPC();

      // Extract user info for permission checks
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);
      const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);

      // Filter prompts based on auth and permissions
      const prompts = mcpPrompts
        .filter(prompt => {
          // Check if prompt is public
          const isPublic = prompt.public === true;

          // Admin users bypass all restrictions
          if (isAdmin) return true;

          // Public prompts are always accessible
          if (isPublic) return true;

          // Check if user is authenticated
          if (!req?.user) return false;

          // Check scope requirements if defined
          if (prompt.scopes) {
            const hasRequiredScopes = ScopeValidator.hasScope(userScopes, prompt.scopes, userInfo);
            return hasRequiredScopes;
          }

          // Default to allowing if no specific restrictions
          return true;
        })
        .map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments || [],
          template: prompt.template || null,
          variables: this.buildPromptVariableDefinitions(prompt),
          category: prompt.category || 'general'
        }));

      // Track names to avoid duplicates (prefer MCP prompts over legacy)
      const promptNames = new Set(prompts.map(p => p.name));

      // Add legacy extension-based prompts if configured (skip duplicates)
      if (this.extensionsConfig?.prompts?.customPrompts) {
        for (const prompt of this.extensionsConfig.prompts.customPrompts) {
          if (!promptNames.has(prompt.name)) {
            prompts.push({
              name: prompt.name,
              description: prompt.description || `Custom prompt: ${prompt.name}`,
              arguments: prompt.arguments || [],
              template: prompt.template || null,
              variables: this.buildPromptVariableDefinitions({
                arguments: prompt.arguments,
                variables: prompt.variables
              }),
              category: prompt.category || 'general'
            });
            promptNames.add(prompt.name);
          }
        }
      }

      logger.debug(`MCP prompts/list: ${prompts.length} prompts available`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          prompts
        }
      };

    } catch (error) {
      console.error('❌ Error in handlePromptsList:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list prompts',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handlePromptsGet(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      const { name, arguments: args } = request.params || {};

      if (!name) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          'Prompt name is required'
        );
      }

      // Check auth requirements for prompts/get
      const requireAuth = this.authConfig.requireAuthForToolsCall;
      if (requireAuth && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for prompts/get'
        );
      }

      // Extract user info
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);
      const isAdmin = this.isAdminUser(userInfo?.email, userInfo?.id);

      logger.debug(`MCP prompts/get: ${name} (${Object.keys(args || {}).length} args)`);

      // Find the requested prompt from MCP prompts
      const mcpPrompts = this.extractMCPPromptsFromTRPC();
      let prompt = mcpPrompts.find(p => p.name === name);

      // Check if it's a legacy prompt from extensions
      let isLegacyPrompt = false;
      let legacyPrompt: any = null;
      if (!prompt && this.extensionsConfig?.prompts?.customPrompts) {
        legacyPrompt = this.extensionsConfig.prompts.customPrompts.find((p: any) => p.name === name);
        if (legacyPrompt) {
          isLegacyPrompt = true;
        }
      }

      if (!prompt && !legacyPrompt) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          `Prompt '${name}' not found`
        );
      }

      // Handle legacy prompts - return a message directing to the new system
      if (isLegacyPrompt && legacyPrompt) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidRequest,
          `Prompt '${name}' is a legacy extension prompt. Please migrate to tRPC-based MCP prompts using createMCPPrompt().`,
          {
            promptName: name,
            legacyInfo: {
              description: legacyPrompt.description,
              arguments: legacyPrompt.arguments || []
            },
            migrationHelp: 'See: createMCPPrompt() in src/auth/scopes.ts'
          }
        );
      }

      // Check if prompt is accessible to user
      const isPublic = prompt!.public === true;

      // At this point, prompt is guaranteed to be non-null (legacy returned early)
      const mcpPrompt = prompt!;

      // Check scope requirements if defined
      let hasRequiredScopes = true;
      let missingScopeInfo: { missing: string[]; type: 'required' | 'anyOf' | 'none' } = {
        missing: [],
        type: 'none'
      };

      if (mcpPrompt.scopes) {
        hasRequiredScopes = ScopeValidator.hasScope(userScopes, mcpPrompt.scopes, userInfo);
        if (!hasRequiredScopes) {
          missingScopeInfo = ScopeValidator.getMissingScopes(userScopes, mcpPrompt.scopes);
        }
      }

      // Authorization check
      if (!isPublic && !isAdmin && (!req?.user || !hasRequiredScopes)) {
        const responseMessage = !req?.user
          ? `Authentication required for prompt '${name}'`
          : missingScopeInfo.missing.length > 0
            ? `Missing required permissions for prompt '${name}': ${missingScopeInfo.missing.join(', ')}`
            : `Missing required permissions for prompt '${name}'`;

        const errorData = {
          reason: !req?.user ? 'authentication_required' : 'insufficient_scopes',
          user: userInfo?.email || userInfo?.id || 'anonymous',
          ...(missingScopeInfo.type !== 'none'
            ? {
                missingScopes: missingScopeInfo.missing,
                missingType: missingScopeInfo.type
              }
            : {})
        };

        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidRequest,
          responseMessage,
          errorData
        );
      }

      // Execute the tRPC procedure to get the prompt text
      const procedure = mcpPrompt.procedure;
      const inputParser = procedure._def?.inputs?.[0];

      // Validate input if parser exists
      let validatedInput = args || {};
      if (inputParser) {
        try {
          validatedInput = inputParser.parse(args || {});
        } catch (zodError: any) {
          return this.createErrorResponse(
            request.id,
            ErrorCode.InvalidParams,
            'Invalid prompt arguments',
            {
              validationErrors: zodError.errors || zodError.message,
              received: args
            }
          );
        }
      }

      // Create context for procedure execution
      const ctx = {
        user: req?.user,
        session: (req as any)?.session,
        req,
        type: procedure._def?.type || 'query'
      };

      logger.debug(`Executing prompt ${name}`);

      const variableDefinitions = this.buildPromptVariableDefinitions(mcpPrompt);

      // Execute the procedure resolver
      const result = await procedure._def.resolver({
        input: validatedInput,
        ctx,
        type: procedure._def?.type || 'query',
        path: name,
        getRawInput: () => validatedInput
      });

      logger.debug(`Prompt ${name} executed successfully`);

      // Result should be the prompt text/messages
      const promptText = typeof result === 'string' ? result : result.text || JSON.stringify(result);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          description: mcpPrompt.description,
          category: mcpPrompt.category || 'general',
          template: mcpPrompt.template || null,
          variables: variableDefinitions,
          arguments: mcpPrompt.arguments || [],
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: promptText
              }
            }
          ]
        }
      };

    } catch (error) {
      logger.error(`Error executing prompt ${request.params?.name}:`, error);

      if (error instanceof TRPCError) {
        const errorCode = error.code === 'FORBIDDEN'
          ? ErrorCode.InvalidRequest
          : ErrorCode.InternalError;

        return this.createErrorResponse(
          request.id,
          errorCode,
          error.message || 'Prompt execution failed',
          {
            reason: error.code,
            ...(error.cause ? { cause: String(error.cause) } : {})
          }
        );
      }

      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to execute prompt',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleLegacyPromptsList(request: any, req?: AuthenticatedRequest): Promise<any> {
    // Legacy implementation for extension-based prompts
    try {
      const prompts = [];

      if (this.extensionsConfig?.prompts) {
        const promptsConfig = this.extensionsConfig.prompts;

        // Add custom prompts
        if (promptsConfig.customPrompts) {
          for (const prompt of promptsConfig.customPrompts) {
            prompts.push({
              name: prompt.name,
              description: prompt.description || `Custom prompt: ${prompt.name}`,
              arguments: prompt.arguments || []
            });
          }
        }

        // Note: Built-in prompts are no longer automatically included
        // Add them manually via customPrompts if needed
        if (false) { // Disabled - only custom prompts are supported
          prompts.push(
            {
              name: "code-review",
              description: "Comprehensive code review analysis with security, performance, and maintainability insights",
              arguments: [
                {
                  name: "code",
                  description: "The code to review",
                  required: true
                },
                {
                  name: "language",
                  description: "Programming language (optional)",
                  required: false
                }
              ]
            },
            {
              name: "api-documentation",
              description: "Generate comprehensive API documentation from code",
              arguments: [
                {
                  name: "code",
                  description: "The API code to document",
                  required: true
                },
                {
                  name: "format",
                  description: "Documentation format (markdown, json, yaml)",
                  required: false
                }
              ]
            }
          );
        }
      }

      logger.debug(`MCP prompts/list (legacy): ${prompts.length} prompts available`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          prompts
        }
      };

    } catch (error) {
      console.error('❌ Error in handleLegacyPromptsList:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list prompts',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleResourcesList(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      // Check auth requirements if enabled
      if (this.authConfig.requireAuthForToolsList && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for resources/list'
        );
      }

      // Extract user info for permission checks
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);

      // Get all resources from the flexible registry
      const allResources = mcpResourceRegistry.getAllResources();

      // Filter resources based on access permissions
      const accessibleResources = allResources
        .filter(resource => {
          return mcpResourceRegistry.checkResourceAccess(resource.id, {
            email: userInfo?.email,
            scopes: userScopes
          });
        })
        .map(resource => ({
          uri: resource.uri || `mcp://internal/${resource.id}`,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType
        }));

      logger.debug(`MCP resources/list: ${accessibleResources.length} resources available (${allResources.length} total)`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          resources: accessibleResources
        }
      };

    } catch (error) {
      console.error('❌ Error in handleResourcesList:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list resources',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleResourcesRead(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      const { uri } = request.params || {};

      if (!uri) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          'Resource URI is required'
        );
      }

      // Check auth requirements (resources are typically more restricted than lists)
      const requireAuth = this.authConfig.requireAuthForToolsCall; // Use tools call auth level for resource reading
      if (requireAuth && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for resources/read'
        );
      }

      console.log(`📖 MCP Resource Read: ${uri} (user: ${req?.user?.email || 'anonymous'})`);

      // Extract user info for permission checks
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);

      // Extract resource identifier and query parameters from URI
      let resourceId: string;
      let queryParams: Record<string, string> = {};

      if (uri.startsWith('mcp://internal/')) {
        const uriWithoutScheme = uri.replace('mcp://internal/', '');

        // Split URI and query parameters
        const [baseResourceId, queryString] = uriWithoutScheme.split('?');
        resourceId = baseResourceId;

        // Parse query parameters if present
        if (queryString) {
          const urlParams = new URLSearchParams(queryString);
          for (const [key, value] of urlParams.entries()) {
            queryParams[key] = value;
          }
        }
      } else {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          `Unsupported resource URI format: ${uri}`
        );
      }

      // Check access permissions using the registry (use base resource ID without parameters)
      const hasAccess = mcpResourceRegistry.checkResourceAccess(resourceId, {
        email: userInfo?.email,
        scopes: userScopes
      });

      if (!hasAccess) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          `Access denied to resource: ${resourceId}`
        );
      }

      // Get resource content from the flexible registry
      let resourceResult;
      try {
        resourceResult = await mcpResourceRegistry.getResourceContent(resourceId, {
          user: userInfo,
          timestamp: new Date().toISOString(),
          workspaceManager: this.rootManager,  // Pass workspace manager for server workspace access
          ...queryParams  // Pass query parameters to the provider
        });
      } catch (error) {
        // Check if this is a validation error from Template Engine
        if (error instanceof Error && error.message.includes('Invalid value for')) {
          // This is a parameter validation error - return as InvalidParams
          return this.createErrorResponse(
            request.id,
            ErrorCode.InvalidParams,
            `Parameter validation failed: ${error.message}`
          );
        } else if (error instanceof Error && error.message.includes('Required parameter missing')) {
          // This is a missing required parameter error
          return this.createErrorResponse(
            request.id,
            ErrorCode.InvalidParams,
            `Missing required parameter: ${error.message}`
          );
        } else {
          // Re-throw other errors to be handled by outer catch
          throw error;
        }
      }

      if (!resourceResult) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InvalidParams,
          `Resource not found: ${resourceId}`
        );
      }

      const { content: resourceContent, mimeType } = resourceResult;

      console.log(`✅ Resource ${uri} read successfully (${resourceContent.length} chars)`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          contents: [
            {
              uri,
              mimeType,
              text: resourceContent
            }
          ]
        }
      };

    } catch (error) {
      console.error(`❌ Error reading resource ${request.params?.uri}:`, error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to read resource',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleRootsList(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      // Check if client has indicated roots capability during initialization
      const hasClientRootsCapability = this.clientCapabilities?.roots?.listChanged === true;

      if (!hasClientRootsCapability) {
        // Client does not support roots capability
        console.log('❌ MCP roots/list: Client does not support roots capability');
        return this.createErrorResponse(
          request.id,
          ErrorCode.MethodNotFound,
          'Roots not supported',
          'Client does not have roots capability'
        );
      }

      // According to MCP spec, roots/list should return client-managed directories
      // In a typical MCP setup, this would be called BY the server TO the client
      // Since this is a server implementation being called BY a client,
      // this represents a reverse scenario where the client is asking the server
      // what roots the server thinks the client has exposed.
      //
      // For now, return empty list since this server doesn't track client roots
      // In a full implementation, this might return roots that were registered
      // via the registerClientWorkspace tool.

      console.log('📋 MCP roots/list: Client supports roots capability');
      console.log('📋 Returning empty list (no client roots registered with server)');
      console.log('ℹ️  Use registerClientWorkspace tool to register client roots');
      console.log('ℹ️  For server-managed directories, use getServerWorkspaces tool instead');

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          roots: [] // Empty list - no client roots registered
        }
      };
    } catch (error) {
      console.error('❌ MCP roots/list error:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        `Failed to list roots: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleCancellation(request: any) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {}
    };
  }

  private handleNotificationInitialized(request: any) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {}
    };
  }

  private handleRootsListChanged(request: any) {
    console.log('🗂️ MCP notification/roots/list_changed received');
    console.log('📋 Client has updated their exposed workspace roots');

    // Note: This notification indicates that the client has changed their
    // list of exposed workspace roots. The server should call roots/list
    // to get the updated list if needed. However, since our implementation
    // returns an empty list (client-managed roots), we just log the event.

    return null; // Notifications don't return responses
  }

  private async handleResourcesTemplatesList(request: any, req?: AuthenticatedRequest): Promise<any> {
    try {
      // Check auth requirements if enabled
      if (this.authConfig.requireAuthForToolsList && !req?.user) {
        return this.createErrorResponse(
          request.id,
          ErrorCode.InternalError,
          'Authentication required for resources/templates/list'
        );
      }

      // Extract user info for permission checks
      const userInfo = this.extractUserInfo(req);
      const userScopes = this.extractUserScopes(req);

      // Get all registered templates from the resource registry
      const allTemplates = mcpResourceRegistry.getAllTemplates();

      // Convert templates to MCP resource template format
      const templateList = [];
      for (const [resourceId, template] of allTemplates.entries()) {
        // Get the corresponding resource to check access
        const resource = mcpResourceRegistry.getResource(resourceId);
        if (!resource) {
          continue; // Skip if resource doesn't exist
        }

        // Check if user has access to this resource template
        const hasAccess = mcpResourceRegistry.checkResourceAccess(resourceId, {
          email: userInfo?.email,
          scopes: userScopes
        });

        if (!hasAccess) {
          continue; // Skip if user doesn't have access
        }

        // Use Template Engine's URI template and parameters if available
        let uriTemplate;
        let templateMeta;

        if (template.uriTemplate && template.parameters) {
          // Template Engine provides proper URI template and parameters
          uriTemplate = template.uriTemplate;

          // Convert Template Engine parameters to MCP format
          const mcpParameters: Record<string, any> = {};
          for (const [paramName, paramConfig] of Object.entries(template.parameters)) {
            const config = paramConfig as {
              type?: string;
              description?: string;
              enum?: string[];
              required?: boolean;
              default?: any;
              min?: number;
              max?: number;
            };
            mcpParameters[paramName] = {
              type: config.type || 'string',
              description: config.description || `${paramName} parameter`,
              ...(config.enum && { enum: config.enum }),
              ...(config.required !== undefined && { required: config.required }),
              ...(config.default !== undefined && { default: config.default })
            };
          }

          templateMeta = {
            parameters: mcpParameters
          };
        } else if (resourceId === 'company-handbook') {
          // Legacy hardcoded company handbook support
          uriTemplate = `mcp://internal/company-handbook{?department,version,format}`;
          templateMeta = {
            parameters: {
              department: {
                type: "string",
                enum: ["engineering", "product", "design"],
                description: "Department-specific handbook section"
              },
              version: {
                type: "string",
                enum: ["latest", "stable"],
                description: "Handbook version to retrieve"
              },
              format: {
                type: "string",
                enum: ["md", "xml"],
                description: "Output format for the handbook content"
              }
            }
          };
        } else {
          // Fallback for resources without Template Engine data
          uriTemplate = `mcp://internal/${resourceId}{?id,format}`;
          templateMeta = {
            parameters: {
              id: {
                type: "string",
                description: "Resource identifier"
              },
              format: {
                type: "string",
                enum: ["md", "xml"],
                description: "Output format"
              }
            }
          };
        }

        templateList.push({
          name: resource.name,
          uriTemplate: uriTemplate,
          description: resource.description,
          mimeType: resource.mimeType,
          _meta: templateMeta
        });
      }

      console.log(`📋 MCP resources/templates/list: Found ${templateList.length} accessible templates (user: ${userInfo?.email || 'anonymous'})`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          resourceTemplates: templateList
        }
      };

    } catch (error) {
      console.error('❌ Error in handleResourcesTemplatesList:', error);
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list resource templates',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

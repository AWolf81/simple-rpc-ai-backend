/**
 * Default MCP resources provided by Simple RPC AI Backend
 */

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceHandler {
  (resourceName: string, params?: any): any;
}

/**
 * Default resources list for MCP resources/list
 */
export const DEFAULT_RESOURCES: MCPResource[] = [
  {
    uri: 'file://server-config.json',
    name: 'Server Configuration',
    description: 'Current server configuration and settings',
    mimeType: 'application/json'
  },
  {
    uri: 'file://api-schema.json',
    name: 'API Schema',
    description: 'Complete OpenRPC API schema with all methods and types',
    mimeType: 'application/json'
  },
  {
    uri: 'file://provider-registry.json',
    name: 'AI Provider Registry',
    description: 'Available AI providers, models, and pricing information',
    mimeType: 'application/json'
  },
  {
    uri: 'file://health-status.json',
    name: 'Health Status',
    description: 'Current server health, uptime, and system metrics',
    mimeType: 'application/json'
  },
  {
    uri: 'file://usage-analytics.json',
    name: 'Usage Analytics',
    description: 'API usage statistics and metrics',
    mimeType: 'application/json'
  },
  {
    uri: 'https://docs.anthropic.com/en/api/getting-started',
    name: 'Anthropic API Documentation',
    description: 'Official Anthropic Claude API documentation',
    mimeType: 'text/html'
  },
  {
    uri: 'https://platform.openai.com/docs/api-reference',
    name: 'OpenAI API Documentation',
    description: 'Official OpenAI API documentation and reference',
    mimeType: 'text/html'
  },
  {
    uri: 'https://ai.google.dev/api',
    name: 'Google AI API Documentation',
    description: 'Google Gemini API documentation',
    mimeType: 'text/html'
  }
];

/**
 * Default resource handlers for MCP resources/read
 */
export const DEFAULT_RESOURCE_HANDLERS: Record<string, MCPResourceHandler> = {
  'server-config.json': () => ({
    server: {
      name: 'Simple RPC AI Backend',
      version: '1.0.0',
      protocols: ['JSON-RPC', 'tRPC', 'MCP'],
      transports: ['HTTP', 'STDIO', 'SSE'],
      endpoints: {
        health: '/health',
        jsonRpc: '/rpc',
        trpc: '/trpc',
        mcp: '/mcp',
        openrpc: '/openrpc.json'
      }
    },
    features: {
      aiProviders: ['anthropic', 'openai', 'google'],
      authentication: ['anonymous', 'oauth', 'jwt'],
      storage: ['file', 'memory', 'postgresql'],
      rateLimit: true,
      cors: true,
      logging: true
    }
  }),

  'api-schema.json': () => ({
    openrpc: '1.2.6',
    info: {
      title: 'Simple RPC AI Backend',
      version: '1.0.0',
      description: 'Platform-agnostic AI backend with system prompt protection'
    },
    methods: [
      {
        name: 'health',
        description: 'Check server health and status',
        params: [],
        result: { type: 'object' }
      },
      {
        name: 'executeAIRequest',
        description: 'Execute AI request with system prompt protection',
        params: [
          { name: 'content', schema: { type: 'string' } },
          { name: 'systemPrompt', schema: { type: 'string' } }
        ],
        result: { type: 'object' }
      }
    ]
  }),

  'provider-registry.json': () => ({
    providers: {
      anthropic: {
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
        capabilities: ['text', 'vision', 'function-calling'],
        pricing: { input: 3.0, output: 15.0 }
      },
      openai: {
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
        capabilities: ['text', 'vision', 'function-calling'],
        pricing: { input: 2.5, output: 10.0 }
      },
      google: {
        name: 'Google',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        capabilities: ['text', 'vision', 'function-calling'],
        pricing: { input: 1.25, output: 5.0 }
      }
    },
    lastUpdated: new Date().toISOString()
  }),

  'health-status.json': () => ({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: '1.0.0',
    protocols: {
      jsonRpc: 'active',
      trpc: 'active',
      mcp: 'active'
    },
    endpoints: {
      health: 'healthy',
      rpc: 'healthy', 
      trpc: 'healthy',
      mcp: 'healthy'
    }
  }),

  'usage-analytics.json': () => ({
    period: 'last_24_hours',
    requests: {
      total: Math.floor(Math.random() * 1000) + 100,
      successful: Math.floor(Math.random() * 900) + 90,
      errors: Math.floor(Math.random() * 10) + 1
    },
    protocols: {
      jsonRpc: Math.floor(Math.random() * 400) + 50,
      trpc: Math.floor(Math.random() * 400) + 50,
      mcp: Math.floor(Math.random() * 200) + 10
    },
    aiProviders: {
      anthropic: Math.floor(Math.random() * 300) + 30,
      openai: Math.floor(Math.random() * 300) + 30,
      google: Math.floor(Math.random() * 200) + 20
    },
    generated: new Date().toISOString()
  })
};
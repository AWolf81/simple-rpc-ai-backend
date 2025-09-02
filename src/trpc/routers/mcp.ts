import { publicProcedure, router, withMCPAuth } from "../index.js";
import z from "zod";
import { Request, Response } from 'express';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorCode, McpError, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

export interface MCPRouterConfig {
  enableMCP?: boolean;
  mcpService?: any;
  refIntegration?: any;
  defaultConfig?: any;
}

/**
 * MCP Protocol implementation for tRPC router
 * Provides tools/list and tools/call functionality
 */
export class MCPProtocolHandler {
  private appRouter: any;
  private progressCallbacks: Map<string, (progress: number, total: number, message?: string) => void> = new Map();
  private runningTasks: Map<string, { cancel: () => void; status: string; taskName: string }> = new Map();

  constructor(appRouter: any) {
    this.appRouter = appRouter;
  }

  /**
   * Send progress notification to client
   */
  private sendProgressNotification(res: Response, progressToken: string, progress: number, total: number, message?: string) {
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
    app.post(path, (req: Request, res: Response) => {
      this.handleMCPRequest(req, res);
    });

    app.options(path, (req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(200).send();
    });

    console.log(`✅ MCP endpoint ready at ${path}`);
  }

  /**
   * Handle incoming MCP requests
   */
  private async handleMCPRequest(req: Request, res: Response) {
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
          response = await this.handleToolsList(mcpRequest);
          break;
        case 'tools/call':
          response = await this.handleToolsCall(mcpRequest, req);
          break;
        case 'notifications/cancelled':
          response = this.handleCancellation(mcpRequest);
          break;
        default:
          response = this.createErrorResponse(
            mcpRequest.id,
            ErrorCode.MethodNotFound,
            `Method '${mcpRequest.method}' not found`
          );
      }

      console.log('📤 MCP Response:', response);
      res.json(response);

    } catch (error) {
      console.error('❌ MCP Error:', error);
      const errorResponse = this.createErrorResponse(
        req.body?.id || null,
        ErrorCode.InternalError,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      );
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Handle MCP ping method - returns empty result
   */
  private handlePing(request: any) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {}
    };
  }

  /**
   * Handle cancellation notifications
   */
  private handleCancellation(request: any) {
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
  private handleInitialize(request: any) {
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
  private async handleToolsList(request: any) {
    try {
      const tools = this.extractMCPToolsFromTRPC();
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Failed to list tools',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle tools/call method - execute tRPC procedure
   */
  private async handleToolsCall(request: any, req?: Request) {
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

      // Get metadata for progress reporting and extensions
      const meta = tool.procedure._def?.meta;
      const mcpExtensions = meta?.mcpExtensions;
      const progressToken = _meta?.progressToken;
      
      // Execute the tRPC procedure with progress support and user context
      const userContext = {
        user: (req as any)?.user || null,
        apiKey: (req as any)?.tokenInfo?.apiKey || null,
        req: req || null,
        res: null // Not available in this context
      };
      const result = await this.executeTRPCProcedure(tool, args || {}, progressToken, mcpExtensions, userContext);

      // Format response based on result type
      let content: any[];
      
      if (typeof result === 'string') {
        // Plain text response
        content = [
          {
            type: 'text',
            text: result
          }
        ];
      } else if (typeof result === 'object' && result !== null) {
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
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
            
            content.unshift({
              type: 'text',
              text: textSummary
            });
          }
        }
      } else {
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
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        ErrorCode.InternalError,
        'Tool execution failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Extract MCP tools from tRPC procedures with MCP metadata
   */
  private extractMCPToolsFromTRPC(): Array<{ name: string; description: string; inputSchema: any; procedure: any }> {
    const tools: Array<{ name: string; description: string; inputSchema: any; procedure: any }> = [];
    
    try {
      const allProcedures = this.appRouter?._def?.procedures;
      
      if (!allProcedures) {
        return tools;
      }

      // Look for procedures with MCP metadata
      for (const [fullName, procedure] of Object.entries(allProcedures)) {
        const procedureAny = procedure as any;
        const meta = procedureAny?._def?.meta;
        
        if (meta?.mcp) {
          const inputSchema = this.extractInputSchema(procedureAny);
          
          // Remove router prefix if present (e.g., 'mcp.hello' -> 'hello')
          const toolName = fullName.includes('.') ? fullName.split('.').pop()! : fullName;
          
          tools.push({
            name: toolName,
            description: meta.mcp.description || `Execute ${toolName}`,
            inputSchema,
            procedure: procedureAny
          });
        }
      }
    } catch (error) {
      console.error('Error extracting MCP tools from tRPC:', error);
    }
    
    return tools;
  }

  /**
   * Extract JSON schema from tRPC input validator
   */
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

      // Convert Zod schema to JSON Schema
      const schema = zodToJsonSchema(inputParser, 'InputSchema') as any;
      
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
    } catch (error) {
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
  private async executeTRPCProcedure(tool: any, args: any, progressToken?: string, meta?: any, userContext?: any): Promise<any> {
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
    let progressCallback: ((progress: number, total: number, message?: string) => void) | undefined;
    if (progressToken && meta?.supportsProgress) {
      progressCallback = (progress: number, total: number, message?: string) => {
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

export function createMCPRouter() {
    return router({
        // Greeting tool with MCP metadata
        hello: publicProcedure
            .meta({ 
                mcp: { 
                    name: 'greeting',
                    description: 'Generate a friendly greeting message for a given name'
                },
                openapi: { 
                    method: 'GET', 
                    path: '/mcp/hello', 
                    tags: ['MCP', 'Greetings'], 
                    summary: 'Generate greeting',
                    description: 'Generate a friendly greeting message for a given name'
                } 
            })
            .input(z.object({ 
                name: z.string().min(1).optional().default('World').describe('The name to greet')
            }))
            .output(z.object({ greeting: z.string() }))
            .query(({ input }) => {
                return { greeting: `Hello ${input.name}! Welcome to Simple RPC AI Backend.` };
            }),

        // Echo tool with MCP metadata - returns plain text
        echo: publicProcedure
            .meta({
                mcp: {
                    name: 'echo',
                    description: 'Echo back a message with optional transformation'
                }
            })
            .input(z.object({
                message: z.string().min(1).optional().default('Hello from MCP!').describe('Message to echo'),
                transform: z.enum(['uppercase', 'lowercase', 'reverse', 'none']).default('none').describe('How to transform the message')
            }))
            .mutation(({ input }) => {
                let result = input.message;
                
                switch (input.transform) {
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

        // Status tool - returns structured data 
        status: publicProcedure
            .meta({
                mcp: {
                    name: 'status',
                    description: 'Get server status and information'
                }
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
                if (input.detailed) {  // boolean approach
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

        // Math tool - returns a simple calculation result
        calculate: publicProcedure
            .meta({
                mcp: {
                    name: 'calculate',
                    description: 'Perform basic mathematical calculations'
                }
            })
            .input(z.object({
                expression: z.string().min(1).optional().default('2 + 2').describe('Mathematical expression (e.g., "2 + 3 * 4")'),
                precision: z.number().min(0).max(10).default(2).describe('Decimal precision for results')
            }))
            .mutation(({ input }) => {
                try {
                    // Simple expression evaluator (for demo - in production use a proper math parser)
                    const sanitized = input.expression.replace(/[^0-9+\-*/().\s]/g, '');
                    const result = Function('"use strict"; return (' + sanitized + ')')();
                    
                    if (typeof result !== 'number' || !isFinite(result)) {
                        throw new Error('Invalid mathematical expression');
                    }

                    const rounded = Number(result.toFixed(input.precision));
                    
                    return {
                        expression: input.expression,
                        result: rounded,
                        formatted: `${input.expression} = ${rounded}`
                    };
                } catch (error) {
                    throw new Error(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }),

        // Long-running task with progress support
        longRunningTask: publicProcedure
            .meta({
                mcp: {
                    name: 'longRunningTask',
                    description: 'Demonstrate a long-running task with progress reporting and cancellation support'
                },
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
                if (!(global as any).mcpTaskRegistry) {
                    (global as any).mcpTaskRegistry = new Map();
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
                (global as any).mcpTaskRegistry.set(taskId, taskData);
                
                // Access progress callback from context if available
                const progressCallback = (ctx as any)?.ctx?.progress;
                
                console.log(`🚀 Starting long-running task: ${taskId} (duration: ${duration}s, steps: ${steps})`);
                
                const progressLog: Array<{step: number; timestamp: string; message: string}> = [];
                
                try {
                    for (let i = 0; i < steps; i++) {
                        // Check for cancellation (check the global registry)
                        const currentTaskData = (global as any).mcpTaskRegistry.get(taskId);
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
                } finally {
                    // Clean up task tracking
                    (global as any).mcpTaskRegistry?.delete(taskId);
                    console.log(`🧹 Cleaned up task: ${taskId}`);
                }
            }),

        // Tool with cancellation support
        cancellableTask: publicProcedure
            .meta({
                mcp: {
                    name: 'cancellableTask',
                    description: 'A task that can be cancelled mid-execution'
                },
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
                mcp: {
                    name: 'cancelTask',
                    description: 'Cancel a running task by its task ID'
                }
            })
            .input(z.object({
                taskId: z.string().min(1).optional().default('demo-task').describe('ID of the task to cancel')
            }))
            .mutation(({ input }) => {
                const { taskId } = input;
                
                // Access the global cancellation system
                const taskData = (global as any).mcpTaskRegistry?.get(taskId);
                
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
                mcp: {
                    name: 'listRunningTasks',
                    description: 'List all currently running tasks'
                }
            })
            .input(z.object({
                includeCompleted: z.boolean().default(false).describe('Include completed tasks in the list')
            }))
            .query(({ input }) => {
                // Get actual running tasks from global registry
                const registry = (global as any).mcpTaskRegistry as Map<string, any> || new Map();
                const runningTasks: any[] = [];
                
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

        // Example: Demonstrating flexible middleware usage (auth policies defined in ai-server-example)
        advancedExample: publicProcedure
            .meta({
                mcp: {
                    name: 'advancedExample', 
                    description: 'Demonstrate flexible MCP middleware patterns'
                }
            })
            .input(z.object({
                action: z.enum(['check', 'process']).describe('Action to perform')
            }))
            .query(({ input, ctx }) => {
                const action = input.action ?? 'check'; // Handle missing in code
                return {
                    action: action,
                    user: ctx.user ? `${ctx.user.email} (${ctx.user.subscriptionTier})` : 'Anonymous',
                    hasApiKey: !!ctx.apiKey,
                    message: `Successfully executed ${action}`
                };
            }),

        // Get progress for a specific task
        getTaskProgress: publicProcedure
            .meta({
                mcp: {
                    name: 'getTaskProgress',
                    description: 'Get real-time progress for a specific task'
                }
            })
            .input(z.object({
                taskId: z.string().min(1).optional().default('demo-task').describe('ID of the task to check progress for')
            }))
            .query(({ input }) => {
                const { taskId } = input;
                const registry = (global as any).mcpTaskRegistry as Map<string, any> || new Map();
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
            })
    });
}
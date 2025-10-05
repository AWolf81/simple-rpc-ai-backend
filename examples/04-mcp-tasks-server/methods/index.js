/**
 * Task Management MCP Tools
 *
 * This module provides comprehensive task management capabilities
 * moved from the core to keep it clean and focused.
 */

import { router, publicProcedure, createMCPTool, createAdminMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

// Task interface with mutable properties
const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Simple in-memory task storage for demo purposes
// In production, you would use a database or persistent storage
const tasks = new Map();

/**
 * Task Management Router - Comprehensive task lifecycle management
 */
export const taskManagementRouter = router({
  // Long running task example with progress tracking
  longRunningTask: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'longRunningTask',
        description: 'Start a long-running task with progress tracking and cancellation support',
        category: 'task'
      })
    })
    .input(z.object({
      name: z.string().min(1).describe('Task name'),
      duration: z.number().min(1000).max(60000).default(10000).describe('Task duration in milliseconds'),
      shouldFail: z.boolean().default(false).describe('Whether the task should fail for testing'),
    }))
    .mutation(async ({ input }) => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const task = {
        id: taskId,
        name: input.name,
        status: TaskStatus.PENDING,
        progress: 0,
        createdAt: new Date(),
        duration: input.duration,
        shouldFail: input.shouldFail
      };

      tasks.set(taskId, task);
      console.log(`📝 Task created: ${taskId} (${input.name})`);

      // Start the task asynchronously
      setImmediate(async () => {
        try {
          task.status = TaskStatus.RUNNING;
          task.startedAt = new Date();
          console.log(`🚀 Task started: ${taskId}`);

          const steps = 10;
          const stepDuration = input.duration / steps;

          for (let i = 0; i < steps; i++) {
            // Check current task status from the map (it might have been cancelled)
            const currentTask = tasks.get(taskId);
            if (!currentTask || currentTask.status === TaskStatus.CANCELLED) {
              console.log(`⏹️ Task cancelled during execution: ${taskId}`);
              return;
            }

            await new Promise(resolve => setTimeout(resolve, stepDuration));
            task.progress = Math.round(((i + 1) / steps) * 100);
            console.log(`📊 Task progress: ${taskId} - ${task.progress}%`);

            if (input.shouldFail && i === Math.floor(steps / 2)) {
              task.status = TaskStatus.FAILED;
              task.error = 'Simulated task failure';
              task.completedAt = new Date();
              console.log(`❌ Task failed: ${taskId} - ${task.error}`);
              return;
            }
          }

          task.status = TaskStatus.COMPLETED;
          task.result = { message: `Task "${input.name}" completed successfully`, finalProgress: 100 };
          task.completedAt = new Date();
          console.log(`✅ Task completed: ${taskId}`);
        } catch (error) {
          task.status = TaskStatus.FAILED;
          task.error = error instanceof Error ? error.message : 'Unknown error';
          task.completedAt = new Date();
          console.log(`❌ Task error: ${taskId} - ${task.error}`);
        }
      });

      return {
        taskId,
        message: `Task "${input.name}" started`,
        estimatedDuration: input.duration,
        timestamp: new Date().toISOString()
      };
    }),

  // Cancellable task
  cancellableTask: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'cancellableTask',
        description: 'Start a task that can be cancelled mid-execution',
        category: 'task'
      })
    })
    .input(z.object({
      name: z.string().min(1).describe('Task name'),
      steps: z.number().min(3).max(20).default(10).describe('Number of processing steps'),
    }))
    .mutation(async ({ input }) => {
      const taskId = `cancellable_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const task = {
        id: taskId,
        name: input.name,
        status: TaskStatus.RUNNING,
        progress: 0,
        createdAt: new Date(),
        startedAt: new Date(),
        totalSteps: input.steps
      };

      tasks.set(taskId, task);
      console.log(`📝 Cancellable task created: ${taskId} (${input.name})`);

      // Start processing steps
      setImmediate(async () => {
        try {
          for (let step = 1; step <= input.steps; step++) {
            // Check if task was cancelled
            const currentTask = tasks.get(taskId);
            if (!currentTask || currentTask.status === TaskStatus.CANCELLED) {
              console.log(`⏹️ Cancellable task cancelled: ${taskId}`);
              return;
            }

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update progress
            task.progress = Math.round((step / input.steps) * 100);
            console.log(`📊 Cancellable task progress: ${taskId} - Step ${step}/${input.steps} (${task.progress}%)`);
          }

          task.status = TaskStatus.COMPLETED;
          task.result = { message: `Cancellable task "${input.name}" completed all ${input.steps} steps` };
          task.completedAt = new Date();
          console.log(`✅ Cancellable task completed: ${taskId}`);
        } catch (error) {
          task.status = TaskStatus.FAILED;
          task.error = error instanceof Error ? error.message : 'Unknown error';
          task.completedAt = new Date();
          console.log(`❌ Cancellable task error: ${taskId} - ${task.error}`);
        }
      });

      return {
        taskId,
        message: `Cancellable task "${input.name}" started with ${input.steps} steps`,
        timestamp: new Date().toISOString()
      };
    }),

  // Cancel a running task
  cancelTask: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'cancelTask',
        description: 'Cancel a running task by ID',
        category: 'task'
      })
    })
    .input(z.object({
      taskId: z.string().min(1).describe('ID of the task to cancel'),
    }))
    .mutation(({ input }) => {
      const task = tasks.get(input.taskId);

      if (!task) {
        return {
          success: false,
          message: `Task ${input.taskId} not found`,
          timestamp: new Date().toISOString()
        };
      }

      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
        return {
          success: false,
          message: `Task ${input.taskId} is already ${task.status}`,
          taskStatus: task.status,
          timestamp: new Date().toISOString()
        };
      }

      if (task.status === TaskStatus.CANCELLED) {
        return {
          success: false,
          message: `Task ${input.taskId} is already cancelled`,
          taskStatus: task.status,
          timestamp: new Date().toISOString()
        };
      }

      task.status = TaskStatus.CANCELLED;
      task.completedAt = new Date();
      console.log(`⏹️ Task cancelled: ${input.taskId}`);

      return {
        success: true,
        message: `Task ${input.taskId} has been cancelled`,
        taskStatus: TaskStatus.CANCELLED,
        timestamp: new Date().toISOString()
      };
    }),

  // List running tasks
  listRunningTasks: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'listRunningTasks',
        description: 'List all currently running or recent tasks',
        category: 'task'
      })
    })
    .input(z.object({
      includeCompleted: z.boolean().default(true).describe('Include completed tasks in the list'),
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of tasks to return'),
    }))
    .query(({ input }) => {
      let taskList = Array.from(tasks.values());

      // Filter based on includeCompleted
      if (!input.includeCompleted) {
        taskList = taskList.filter(task =>
          task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING
        );
      }

      // Sort by creation date (newest first)
      taskList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply limit
      taskList = taskList.slice(0, input.limit);

      const formattedTasks = taskList.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        progress: task.progress,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        duration: task.completedAt && task.startedAt
          ? task.completedAt.getTime() - task.startedAt.getTime()
          : undefined,
        error: task.error
      }));

      console.log(`📊 Listed ${formattedTasks.length} tasks (total: ${tasks.size})`);

      return {
        tasks: formattedTasks,
        total: Array.from(tasks.values()).length,
        timestamp: new Date().toISOString()
      };
    }),

  // Get task progress
  getTaskProgress: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'getTaskProgress',
        description: 'Get detailed progress information for a specific task',
        category: 'task'
      })
    })
    .input(z.object({
      taskId: z.string().min(1).describe('ID of the task to check'),
    }))
    .query(({ input }) => {
      const task = tasks.get(input.taskId);

      if (!task) {
        return {
          found: false,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`🔍 Progress check: ${input.taskId} - ${task.status} (${task.progress}%)`);

      return {
        found: true,
        task: {
          id: task.id,
          name: task.name,
          status: task.status,
          progress: task.progress,
          createdAt: task.createdAt.toISOString(),
          startedAt: task.startedAt?.toISOString(),
          completedAt: task.completedAt?.toISOString(),
          duration: task.completedAt && task.startedAt
            ? task.completedAt.getTime() - task.startedAt.getTime()
            : undefined,
          result: task.result,
          error: task.error
        },
        timestamp: new Date().toISOString()
      };
    }),
});

/**
 * Administrative Tools Router - System monitoring and management
 */
export const adminToolsRouter = router({
  // Server status with detailed information
  status: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'status',
        description: 'Get detailed server status and health information',
        category: 'system'
      })
    })
    .input(z.object({
      detailed: z.boolean().default(false).describe('Include detailed system information'),
    }))
    .query(({ input }) => {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;

      const baseStatus = {
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: {
          used: usedMem,
          total: totalMem,
          percentage: Math.round((usedMem / totalMem) * 100)
        },
        tasks: {
          total: tasks.size,
          running: Array.from(tasks.values()).filter(t => t.status === TaskStatus.RUNNING).length,
          completed: Array.from(tasks.values()).filter(t => t.status === TaskStatus.COMPLETED).length,
          failed: Array.from(tasks.values()).filter(t => t.status === TaskStatus.FAILED).length,
          cancelled: Array.from(tasks.values()).filter(t => t.status === TaskStatus.CANCELLED).length
        },
        mcp: {
          enabled: true,
          version: '2024-11-05',
          tools: 8 // Number of task management tools
        },
        timestamp: new Date().toISOString()
      };

      if (input.detailed) {
        return {
          ...baseStatus,
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            pid: process.pid
          }
        };
      }

      return baseStatus;
    }),

  // Advanced example with admin privileges
  advancedExample: publicProcedure
    .meta({
      ...createAdminMCPTool({
        name: 'advancedExample',
        description: 'Advanced administrative tool with enhanced capabilities',
        category: 'admin',
        adminUsers: ['admin@company.com'] // Example admin users
      })
    })
    .input(z.object({
      operation: z.enum(['status', 'config', 'metrics', 'tasks']).describe('Operation to perform'),
    }))
    .query(({ input }) => {
      let result;

      switch (input.operation) {
        case 'status':
          result = {
            server: 'operational',
            services: ['mcp', 'trpc', 'jsonrpc', 'tasks'],
            healthChecks: 'all_passed',
            taskManager: 'active'
          };
          break;
        case 'config':
          result = {
            environment: process.env.NODE_ENV || 'development',
            features: ['mcp', 'task_management', 'progress_tracking'],
            limits: { maxTasks: 100, maxDuration: 60000 }
          };
          break;
        case 'metrics':
          result = {
            requests: { total: 0, successful: 0, failed: 0 },
            performance: { avgResponseTime: 0, p95: 0 },
            resources: { cpu: 0, memory: process.memoryUsage() },
            tasks: {
              total: tasks.size,
              byStatus: Object.fromEntries(
                Object.values(TaskStatus).map(status => [
                  status,
                  Array.from(tasks.values()).filter(t => t.status === status).length
                ])
              )
            }
          };
          break;
        case 'tasks':
          result = {
            taskCount: tasks.size,
            recentTasks: Array.from(tasks.values())
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 5)
              .map(task => ({
                id: task.id,
                name: task.name,
                status: task.status,
                progress: task.progress
              }))
          };
          break;
        default:
          result = { error: 'Unknown operation' };
      }

      return {
        operation: input.operation,
        result,
        adminLevel: true,
        timestamp: new Date().toISOString()
      };
    }),

  // Get user information (admin only)
  getUserInfo: publicProcedure
    .meta({
      ...createAdminMCPTool({
        name: 'getUserInfo',
        description: 'Get detailed user information and permissions',
        category: 'admin',
        adminUsers: ['admin@company.com'] // Example admin users
      })
    })
    .input(z.object({
      userId: z.string().optional().describe('User ID to lookup (admin only)'),
      includePermissions: z.boolean().default(false).describe('Include detailed permissions'),
    }))
    .query(({ input, ctx: _ctx }) => {
      // In a real implementation, this would check admin permissions
      // and query actual user data from the database

      const userId = input.userId || 'anonymous';
      const isAdmin = true; // This would be determined by checking JWT scopes

      return {
        user: {
          id: userId,
          type: isAdmin ? 'admin' : 'user',
          permissions: input.includePermissions
            ? ['mcp:read', 'mcp:call', 'task:manage', 'admin:read']
            : undefined,
          lastAccess: new Date().toISOString(),
          taskAccess: 'full'
        },
        adminQuery: !!input.userId,
        timestamp: new Date().toISOString()
      };
    }),
});

/**
 * Get all task management routers
 */
export function getTaskRouters() {
  return {
    tasks: taskManagementRouter,
    admin: adminToolsRouter
  };
}
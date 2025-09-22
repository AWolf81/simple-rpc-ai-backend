import { publicProcedure } from "../../../index.js";
import z from "zod";
import { createMCPTool } from '../../../../auth/scopes.js';
// Simple in-memory task storage for demo purposes
const tasks = new Map();
/**
 * Task management procedures for MCP
 */
export const taskProcedures = {
    // Long running task example with progress tracking
    longRunningTask: publicProcedure
        .meta({
        ...createMCPTool({
            name: 'longRunningTask',
            description: 'Start a long-running task with progress tracking and cancellation support',
            category: 'task'
        }),
        openapi: {
            method: 'POST',
            path: '/mcp/tasks/start',
            tags: ['MCP', 'Tasks'],
            summary: 'Start long-running task'
        }
    })
        .input(z.object({
        name: z.string().min(1).describe('Task name'),
        duration: z.number().min(1000).max(60000).default(10000).describe('Task duration in milliseconds'),
        shouldFail: z.boolean().default(false).describe('Whether the task should fail for testing'),
    }))
        .output(z.object({
        taskId: z.string(),
        message: z.string(),
        estimatedDuration: z.number()
    }))
        .mutation(async ({ input }) => {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const task = {
            id: taskId,
            name: input.name,
            status: 'pending',
            progress: 0,
            createdAt: new Date()
        };
        tasks.set(taskId, task);
        // Start the task asynchronously
        setImmediate(async () => {
            try {
                task.status = 'running';
                task.startedAt = new Date();
                const steps = 10;
                const stepDuration = input.duration / steps;
                for (let i = 0; i < steps; i++) {
                    // Check current task status from the map (it might have been cancelled)
                    const currentTask = tasks.get(taskId);
                    if (!currentTask || currentTask.status === 'cancelled') {
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, stepDuration));
                    task.progress = Math.round(((i + 1) / steps) * 100);
                    if (input.shouldFail && i === Math.floor(steps / 2)) {
                        task.status = 'failed';
                        task.error = 'Simulated task failure';
                        task.completedAt = new Date();
                        return;
                    }
                }
                task.status = 'completed';
                task.result = { message: `Task "${input.name}" completed successfully`, finalProgress: 100 };
                task.completedAt = new Date();
            }
            catch (error) {
                task.status = 'failed';
                task.error = error instanceof Error ? error.message : 'Unknown error';
                task.completedAt = new Date();
            }
        });
        return {
            taskId,
            message: `Task "${input.name}" started`,
            estimatedDuration: input.duration
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
        .output(z.object({
        taskId: z.string(),
        message: z.string()
    }))
        .mutation(async ({ input }) => {
        const taskId = `cancellable_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const task = {
            id: taskId,
            name: input.name,
            status: 'running',
            progress: 0,
            createdAt: new Date(),
            startedAt: new Date()
        };
        tasks.set(taskId, task);
        // Start processing steps
        setImmediate(async () => {
            try {
                for (let step = 1; step <= input.steps; step++) {
                    // Check if task was cancelled
                    const currentTask = tasks.get(taskId);
                    if (!currentTask || currentTask.status === 'cancelled') {
                        return;
                    }
                    // Simulate processing time
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Update progress
                    task.progress = Math.round((step / input.steps) * 100);
                }
                task.status = 'completed';
                task.result = { message: `Cancellable task "${input.name}" completed all ${input.steps} steps` };
                task.completedAt = new Date();
            }
            catch (error) {
                task.status = 'failed';
                task.error = error instanceof Error ? error.message : 'Unknown error';
                task.completedAt = new Date();
            }
        });
        return {
            taskId,
            message: `Cancellable task "${input.name}" started with ${input.steps} steps`
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
        .output(z.object({
        success: z.boolean(),
        message: z.string(),
        taskStatus: z.string().optional()
    }))
        .mutation(({ input }) => {
        const task = tasks.get(input.taskId);
        if (!task) {
            return {
                success: false,
                message: `Task ${input.taskId} not found`
            };
        }
        if (task.status === 'completed' || task.status === 'failed') {
            return {
                success: false,
                message: `Task ${input.taskId} is already ${task.status}`,
                taskStatus: task.status
            };
        }
        if (task.status === 'cancelled') {
            return {
                success: false,
                message: `Task ${input.taskId} is already cancelled`,
                taskStatus: task.status
            };
        }
        task.status = 'cancelled';
        task.completedAt = new Date();
        return {
            success: true,
            message: `Task ${input.taskId} has been cancelled`,
            taskStatus: 'cancelled'
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
        .output(z.object({
        tasks: z.array(z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            progress: z.number(),
            createdAt: z.string(),
            startedAt: z.string().optional(),
            completedAt: z.string().optional(),
            duration: z.number().optional(),
            error: z.string().optional()
        })),
        total: z.number()
    }))
        .query(({ input }) => {
        let taskList = Array.from(tasks.values());
        // Filter based on includeCompleted
        if (!input.includeCompleted) {
            taskList = taskList.filter(task => task.status === 'running' || task.status === 'pending');
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
        return {
            tasks: formattedTasks,
            total: Array.from(tasks.values()).length
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
        .output(z.object({
        task: z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            progress: z.number(),
            createdAt: z.string(),
            startedAt: z.string().optional(),
            completedAt: z.string().optional(),
            duration: z.number().optional(),
            result: z.any().optional(),
            error: z.string().optional()
        }).optional(),
        found: z.boolean()
    }))
        .query(({ input }) => {
        const task = tasks.get(input.taskId);
        if (!task) {
            return { found: false };
        }
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
            }
        };
    }),
};

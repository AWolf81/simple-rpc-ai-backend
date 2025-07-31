/**
 * Orchestration Engine for Agent-like RPC Backend
 *
 * Enables complex multi-step workflows, chained function calls, and
 * intelligent decision-making for AI-powered operations.
 */
import { FunctionRegistry } from './function-registry.js';
import { ContextManager, AIRequestContext } from './context-manager.js';
import { ResponseFormat } from './response-parser.js';
import { AIService } from './ai-service.js';
export type WorkflowStepType = 'function' | 'decision' | 'parallel' | 'loop' | 'condition';
export interface WorkflowStep {
    id: string;
    type: WorkflowStepType;
    name: string;
    description?: string;
    functionName?: string;
    parameters?: any;
    decisionPrompt?: string;
    decisionBranches?: {
        [key: string]: string;
    };
    nextStep?: string;
    onSuccess?: string;
    onError?: string;
    parallelSteps?: string[];
    waitForAll?: boolean;
    loopCondition?: string;
    maxIterations?: number;
    condition?: string;
    ifTrue?: string;
    ifFalse?: string;
}
export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    startStep: string;
    steps: WorkflowStep[];
    globalContext?: any;
    maxExecutionTime?: number;
    responseFormat?: ResponseFormat;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    currentStep: string;
    context: any;
    results: {
        [stepId: string]: any;
    };
    errors: {
        [stepId: string]: string;
    };
    startTime: Date;
    endTime?: Date;
    executionTrace: Array<{
        stepId: string;
        timestamp: Date;
        status: 'started' | 'completed' | 'failed';
        result?: any;
        error?: string;
    }>;
}
export declare class OrchestrationEngine {
    private functionRegistry;
    private contextManager;
    private responseParser;
    private aiService;
    private workflows;
    private executions;
    constructor(functionRegistry: FunctionRegistry, contextManager: ContextManager, aiService: AIService);
    /**
     * Register a workflow definition
     */
    registerWorkflow(definition: WorkflowDefinition): void;
    /**
     * Execute a workflow with context
     */
    executeWorkflow(workflowId: string, initialContext: AIRequestContext, parameters?: any): Promise<WorkflowExecution>;
    /**
     * Run workflow execution logic
     */
    private runWorkflow;
    /**
     * Execute a single workflow step
     */
    private executeStep;
    /**
     * Execute function step
     */
    private executeFunctionStep;
    /**
     * Execute decision step using AI
     */
    private executeDecisionStep;
    /**
     * Execute parallel steps
     */
    private executeParallelStep;
    /**
     * Execute condition step
     */
    private executeConditionStep;
    /**
     * Execute loop step
     */
    private executeLoopStep;
    /**
     * Determine next step based on current step and result
     */
    private getNextStep;
    /**
     * Resolve parameters with context substitution
     */
    private resolveParameters;
    /**
     * Simple variable substitution
     */
    private substituteVariables;
    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue;
    /**
     * Simple condition evaluation
     */
    private evaluateCondition;
    /**
     * Add trace entry to execution
     */
    private addTraceEntry;
    /**
     * Validate workflow definition
     */
    private validateWorkflow;
    /**
     * Generate unique execution ID
     */
    private generateExecutionId;
    /**
     * Get execution status
     */
    getExecution(executionId: string): WorkflowExecution | null;
    /**
     * List available workflows
     */
    listWorkflows(): Array<Omit<WorkflowDefinition, 'steps'>>;
    /**
     * Initialize default workflows
     */
    private initializeDefaultWorkflows;
}
export default OrchestrationEngine;
//# sourceMappingURL=orchestration-engine.d.ts.map
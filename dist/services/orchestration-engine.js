/**
 * Orchestration Engine for Agent-like RPC Backend
 *
 * Enables complex multi-step workflows, chained function calls, and
 * intelligent decision-making for AI-powered operations.
 */
import { ResponseParser } from './response-parser.js';
export class OrchestrationEngine {
    functionRegistry;
    contextManager;
    responseParser;
    aiService;
    workflows = new Map();
    executions = new Map();
    constructor(functionRegistry, contextManager, aiService) {
        this.functionRegistry = functionRegistry;
        this.contextManager = contextManager;
        this.responseParser = new ResponseParser();
        this.aiService = aiService;
        this.initializeDefaultWorkflows();
    }
    /**
     * Register a workflow definition
     */
    registerWorkflow(definition) {
        this.validateWorkflow(definition);
        this.workflows.set(definition.id, definition);
    }
    /**
     * Execute a workflow with context
     */
    async executeWorkflow(workflowId, initialContext, parameters = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }
        const executionId = this.generateExecutionId();
        const execution = {
            id: executionId,
            workflowId,
            status: 'running',
            currentStep: workflow.startStep,
            context: {
                ...workflow.globalContext,
                ...parameters,
                initialContext
            },
            results: {},
            errors: {},
            startTime: new Date(),
            executionTrace: []
        };
        this.executions.set(executionId, execution);
        try {
            await this.runWorkflow(execution, workflow);
            execution.status = 'completed';
        }
        catch (error) {
            execution.status = 'failed';
            this.addTraceEntry(execution, execution.currentStep, 'failed', undefined, error.message);
        }
        finally {
            execution.endTime = new Date();
        }
        return execution;
    }
    /**
     * Run workflow execution logic
     */
    async runWorkflow(execution, workflow) {
        const maxTime = workflow.maxExecutionTime || 5 * 60 * 1000; // 5 minutes default
        const startTime = Date.now();
        while (execution.status === 'running' && execution.currentStep) {
            // Check timeout
            if (Date.now() - startTime > maxTime) {
                throw new Error('Workflow execution timeout');
            }
            const step = workflow.steps.find(s => s.id === execution.currentStep);
            if (!step) {
                throw new Error(`Step '${execution.currentStep}' not found`);
            }
            this.addTraceEntry(execution, step.id, 'started');
            try {
                const result = await this.executeStep(step, execution);
                execution.results[step.id] = result;
                this.addTraceEntry(execution, step.id, 'completed', result);
                // Determine next step
                execution.currentStep = this.getNextStep(step, result, execution);
            }
            catch (error) {
                execution.errors[step.id] = error.message;
                this.addTraceEntry(execution, step.id, 'failed', undefined, error.message);
                if (step.onError) {
                    execution.currentStep = step.onError;
                }
                else {
                    throw error;
                }
            }
        }
    }
    /**
     * Execute a single workflow step
     */
    async executeStep(step, execution) {
        switch (step.type) {
            case 'function':
                return this.executeFunctionStep(step, execution);
            case 'decision':
                return this.executeDecisionStep(step, execution);
            case 'parallel':
                return this.executeParallelStep(step, execution);
            case 'condition':
                return this.executeConditionStep(step, execution);
            case 'loop':
                return this.executeLoopStep(step, execution);
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }
    /**
     * Execute function step
     */
    async executeFunctionStep(step, execution) {
        if (!step.functionName) {
            throw new Error('Function name required for function step');
        }
        // Resolve parameters with context substitution
        const parameters = this.resolveParameters(step.parameters || {}, execution.context);
        return this.functionRegistry.executeFunction(step.functionName, parameters);
    }
    /**
     * Execute decision step using AI
     */
    async executeDecisionStep(step, execution) {
        if (!step.decisionPrompt) {
            throw new Error('Decision prompt required for decision step');
        }
        const context = JSON.stringify(execution.context, null, 2);
        const content = `Current context: ${context}`;
        const prompt = this.resolveParameters(step.decisionPrompt, execution.context);
        const response = await this.aiService.execute({
            content,
            systemPrompt: prompt,
            metadata: {
                stepType: 'decision',
                stepId: step.id,
                workflowId: execution.workflowId
            }
        });
        return {
            decision: response.content,
            reasoning: 'AI decision based on context'
        };
    }
    /**
     * Execute parallel steps
     */
    async executeParallelStep(step, execution) {
        if (!step.parallelSteps || step.parallelSteps.length === 0) {
            throw new Error('Parallel steps required for parallel step');
        }
        const workflow = this.workflows.get(execution.workflowId);
        const parallelPromises = step.parallelSteps.map(async (stepId) => {
            const parallelStep = workflow.steps.find(s => s.id === stepId);
            if (!parallelStep) {
                throw new Error(`Parallel step '${stepId}' not found`);
            }
            return this.executeStep(parallelStep, execution);
        });
        if (step.waitForAll) {
            return Promise.all(parallelPromises);
        }
        else {
            return Promise.allSettled(parallelPromises);
        }
    }
    /**
     * Execute condition step
     */
    async executeConditionStep(step, execution) {
        if (!step.condition) {
            throw new Error('Condition required for condition step');
        }
        const condition = this.resolveParameters(step.condition, execution.context);
        const result = this.evaluateCondition(condition, execution.context);
        return {
            condition: step.condition,
            result,
            nextPath: result ? step.ifTrue : step.ifFalse
        };
    }
    /**
     * Execute loop step
     */
    async executeLoopStep(step, execution) {
        const results = [];
        const maxIterations = step.maxIterations || 10;
        let iteration = 0;
        while (iteration < maxIterations) {
            if (step.loopCondition) {
                const shouldContinue = this.evaluateCondition(this.resolveParameters(step.loopCondition, execution.context), execution.context);
                if (!shouldContinue)
                    break;
            }
            // Execute loop body (could be another workflow step)
            const loopResult = {
                iteration,
                timestamp: new Date(),
                context: { ...execution.context, iteration }
            };
            results.push(loopResult);
            iteration++;
        }
        return {
            iterations: iteration,
            results
        };
    }
    /**
     * Determine next step based on current step and result
     */
    getNextStep(step, result, execution) {
        switch (step.type) {
            case 'decision':
                if (step.decisionBranches && result.decision) {
                    for (const [outcome, nextStep] of Object.entries(step.decisionBranches)) {
                        if (result.decision.toLowerCase().includes(outcome.toLowerCase())) {
                            return nextStep;
                        }
                    }
                }
                return step.nextStep || '';
            case 'condition':
                return result.nextPath || step.nextStep || '';
            case 'parallel':
                return step.onSuccess || step.nextStep || '';
            default:
                return step.onSuccess || step.nextStep || '';
        }
    }
    /**
     * Resolve parameters with context substitution
     */
    resolveParameters(params, context) {
        if (typeof params === 'string') {
            return this.substituteVariables(params, context);
        }
        if (Array.isArray(params)) {
            return params.map(p => this.resolveParameters(p, context));
        }
        if (typeof params === 'object' && params !== null) {
            const resolved = {};
            for (const [key, value] of Object.entries(params)) {
                resolved[key] = this.resolveParameters(value, context);
            }
            return resolved;
        }
        return params;
    }
    /**
     * Simple variable substitution
     */
    substituteVariables(template, context) {
        return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, path) => {
            const value = this.getNestedValue(context, path);
            return value !== undefined ? String(value) : match;
        });
    }
    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    /**
     * Simple condition evaluation
     */
    evaluateCondition(condition, context) {
        // Simple boolean evaluation - could be enhanced with expression parser
        try {
            // Replace context variables
            const resolved = this.substituteVariables(condition, context);
            // Basic comparisons
            if (resolved.includes('==')) {
                const [left, right] = resolved.split('==').map(s => s.trim());
                return left === right;
            }
            if (resolved.includes('!=')) {
                const [left, right] = resolved.split('!=').map(s => s.trim());
                return left !== right;
            }
            if (resolved.includes('>')) {
                const [left, right] = resolved.split('>').map(s => s.trim());
                return Number(left) > Number(right);
            }
            if (resolved.includes('<')) {
                const [left, right] = resolved.split('<').map(s => s.trim());
                return Number(left) < Number(right);
            }
            // Boolean values
            if (resolved.toLowerCase() === 'true')
                return true;
            if (resolved.toLowerCase() === 'false')
                return false;
            // Truthy evaluation
            return Boolean(resolved);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Add trace entry to execution
     */
    addTraceEntry(execution, stepId, status, result, error) {
        execution.executionTrace.push({
            stepId,
            timestamp: new Date(),
            status,
            result,
            error
        });
    }
    /**
     * Validate workflow definition
     */
    validateWorkflow(workflow) {
        if (!workflow.steps.find(s => s.id === workflow.startStep)) {
            throw new Error(`Start step '${workflow.startStep}' not found in workflow`);
        }
        for (const step of workflow.steps) {
            if (step.type === 'function' && !step.functionName) {
                throw new Error(`Function step '${step.id}' missing function name`);
            }
            if (step.type === 'decision' && !step.decisionPrompt) {
                throw new Error(`Decision step '${step.id}' missing decision prompt`);
            }
        }
    }
    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get execution status
     */
    getExecution(executionId) {
        return this.executions.get(executionId) || null;
    }
    /**
     * List available workflows
     */
    listWorkflows() {
        return Array.from(this.workflows.values()).map(({ steps, ...info }) => info);
    }
    /**
     * Initialize default workflows
     */
    initializeDefaultWorkflows() {
        // Code Review Workflow
        this.registerWorkflow({
            id: 'complete-code-review',
            name: 'Complete Code Review',
            description: 'Comprehensive code review including analysis, security, and testing',
            startStep: 'analyze',
            responseFormat: 'xml',
            steps: [
                {
                    id: 'analyze',
                    type: 'function',
                    name: 'Code Analysis',
                    functionName: 'analyzeCode',
                    parameters: {
                        content: '{initialContext.content}',
                        language: '{initialContext.metadata.language}'
                    },
                    nextStep: 'security'
                },
                {
                    id: 'security',
                    type: 'function',
                    name: 'Security Review',
                    functionName: 'securityReview',
                    parameters: {
                        content: '{initialContext.content}'
                    },
                    nextStep: 'decision'
                },
                {
                    id: 'decision',
                    type: 'decision',
                    name: 'Review Decision',
                    decisionPrompt: 'Based on the analysis and security review, should this code be approved? Answer with "approve", "reject", or "needs_changes".',
                    decisionBranches: {
                        'approve': 'generate_tests',
                        'reject': 'end',
                        'needs_changes': 'suggest_improvements'
                    }
                },
                {
                    id: 'suggest_improvements',
                    type: 'function',
                    name: 'Performance Optimization',
                    functionName: 'optimizePerformance',
                    parameters: {
                        content: '{initialContext.content}'
                    },
                    nextStep: 'end'
                },
                {
                    id: 'generate_tests',
                    type: 'function',
                    name: 'Generate Tests',
                    functionName: 'generateTests',
                    parameters: {
                        content: '{initialContext.content}'
                    },
                    nextStep: 'end'
                },
                {
                    id: 'end',
                    type: 'function',
                    name: 'Completion',
                    functionName: 'generateDocs',
                    parameters: {
                        content: 'Review completed for {initialContext.metadata.fileName}'
                    }
                }
            ]
        });
        // Development Pipeline Workflow
        this.registerWorkflow({
            id: 'dev-pipeline',
            name: 'Development Pipeline',
            description: 'Complete development pipeline from code to documentation',
            startStep: 'parallel_analysis',
            responseFormat: 'xml',
            steps: [
                {
                    id: 'parallel_analysis',
                    type: 'parallel',
                    name: 'Parallel Analysis',
                    parallelSteps: ['analyze', 'security'],
                    waitForAll: true,
                    nextStep: 'generate_tests'
                },
                {
                    id: 'analyze',
                    type: 'function',
                    name: 'Code Analysis',
                    functionName: 'analyzeCode',
                    parameters: {
                        content: '{initialContext.content}'
                    }
                },
                {
                    id: 'security',
                    type: 'function',
                    name: 'Security Review',
                    functionName: 'securityReview',
                    parameters: {
                        content: '{initialContext.content}'
                    }
                },
                {
                    id: 'generate_tests',
                    type: 'function',
                    name: 'Generate Tests',
                    functionName: 'generateTests',
                    parameters: {
                        content: '{initialContext.content}'
                    },
                    nextStep: 'generate_docs'
                },
                {
                    id: 'generate_docs',
                    type: 'function',
                    name: 'Generate Documentation',
                    functionName: 'generateDocs',
                    parameters: {
                        content: '{initialContext.content}'
                    }
                }
            ]
        });
    }
}
export default OrchestrationEngine;
//# sourceMappingURL=orchestration-engine.js.map
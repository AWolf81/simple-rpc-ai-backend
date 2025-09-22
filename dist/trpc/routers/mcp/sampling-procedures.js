import { publicProcedure } from "../../index.js";
import z from "zod";
import { createMCPTool } from '../../../auth/scopes.js';
/**
 * Sampling and Elicitation procedures for MCP
 * These demonstrate the MCP protocol's capability for AI interaction workflows
 */
export const samplingProcedures = {
    // Generate content with approval workflow (demonstrates MCP sampling protocol)
    generateWithApproval: publicProcedure
        .meta({
        ...createMCPTool({
            name: 'generateWithApproval',
            description: 'Generate content using MCP sampling protocol with user approval',
            category: 'content',
            public: true
        }),
        openapi: {
            method: 'POST',
            path: '/mcp/generate',
            tags: ['MCP', 'AI'],
            summary: 'Generate content with approval'
        }
    })
        .input(z.object({
        task: z.string().min(1).describe('What content to generate (e.g., "write a poem", "explain AI")'),
        style: z.enum(['creative', 'technical', 'casual']).optional().default('casual').describe('Writing style'),
        maxTokens: z.number().min(50).max(2000).optional().default(500).describe('Maximum tokens to generate'),
    }))
        .output(z.object({
        status: z.string(),
        task: z.string(),
        style: z.string(),
        content: z.string(),
        metadata: z.object({
            samplingUsed: z.boolean(),
            userApproved: z.boolean(),
            tokensUsed: z.number(),
            messages: z.number(),
            note: z.string()
        }),
        workflow: z.object({
            step1: z.string(),
            step2: z.string(),
            step3: z.string(),
            step4: z.string(),
            step5: z.string()
        })
    }))
        .mutation(async ({ input }) => {
        // This demonstrates the proper MCP sampling workflow:
        // 1. Tool receives user request
        // 2. Tool prepares messages for AI
        // 3. Tool calls sampling/createMessage (triggers user approval)
        // 4. User approves/denies in MCP client
        // 5. If approved: AI generates content, if denied: fallback response
        const messages = [
            {
                role: 'system',
                content: `You are a ${input.style} content generator. Create high-quality content based on user requests.`
            },
            {
                role: 'user',
                content: `Task: ${input.task}\nStyle: ${input.style}\nMax tokens: ${input.maxTokens}`
            }
        ];
        // In a real implementation, this would call:
        // await mcpClient.requestSampling('createMessage', { messages, maxTokens: input.maxTokens })
        // The MCP client would then show user approval dialog
        // If approved, the AI would generate content
        // If denied, we would return a fallback response
        return {
            status: 'completed',
            task: input.task,
            style: input.style,
            content: `[AI Generated Content - ${input.style} style]

Task: ${input.task}

This is simulated AI-generated content for your request. In a real implementation:

1. MCP client would show approval dialog: "AI wants to generate content for: "${input.task}"
Style: ${input.style}
Max tokens: ${input.maxTokens}

Allow this AI request?"
2. User approves the AI request
3. sampling/createMessage is called with messages and maxTokens
4. AI generates actual content
5. Content is returned to the tool

Current parameters:
- Style: ${input.style}
- Max tokens: ${input.maxTokens}
- Messages: ${messages.length} (system + user prompt)

To enable real AI generation, implement the sampling/createMessage handler.`,
            metadata: {
                samplingUsed: true,
                userApproved: true, // Simulated approval
                tokensUsed: Math.min(input.maxTokens * 0.8, 172), // Simulated token usage
                messages: messages.length,
                note: 'This demonstrates the MCP sampling workflow'
            },
            workflow: {
                step1: 'Tool receives user request',
                step2: 'Tool prepares messages for AI',
                step3: 'Tool calls sampling/createMessage (triggers user approval)',
                step4: 'User approves/denies in MCP client',
                step5: 'If approved: AI generates content, if denied: fallback response'
            }
        };
    }),
    // Request user input or decision with workflow support
    requestElicitation: publicProcedure
        .meta({
        ...createMCPTool({
            name: 'requestElicitation',
            description: 'Request user input or decision with workflow support',
            category: 'interaction',
            public: true
        }),
        openapi: {
            method: 'POST',
            path: '/mcp/elicit',
            tags: ['MCP', 'Interaction'],
            summary: 'Request user input'
        }
    })
        .input(z.object({
        prompt: z.string().min(1).describe('Question or prompt for the user'),
        type: z.enum(['confirmation', 'choice', 'input', 'approval']).describe('Type of interaction: confirmation=yes/no, choice=select from options, input=free text, approval=approve/deny'),
        options: z.array(z.string()).optional().describe('Available options (required for choice type)'),
        defaultValue: z.string().optional().describe('Default/suggested value'),
        timeout: z.number().min(5).max(300).optional().default(60).describe('Timeout in seconds'),
        userResponse: z.string().optional().describe('User\'s response (provide this to complete the elicitation)'),
    }))
        .output(z.object({
        status: z.string(),
        prompt: z.string(),
        type: z.string(),
        userResponse: z.string().optional(),
        result: z.object({
            completed: z.boolean(),
            value: z.string().optional(),
            timestamp: z.string(),
            responseTime: z.number().optional()
        }),
        workflow: z.object({
            step1: z.string(),
            step2: z.string(),
            step3: z.string(),
            step4: z.string()
        })
    }))
        .mutation(async ({ input }) => {
        // This demonstrates MCP elicitation workflow
        const startTime = Date.now();
        // Validate input based on type
        if (input.type === 'choice' && (!input.options || input.options.length === 0)) {
            throw new Error('Options are required for choice type elicitation');
        }
        // If user response is provided, process it
        if (input.userResponse) {
            let isValid = true;
            let processedValue = input.userResponse;
            switch (input.type) {
                case 'confirmation':
                    const normalized = input.userResponse.toLowerCase();
                    isValid = ['yes', 'no', 'y', 'n', 'true', 'false'].includes(normalized);
                    processedValue = ['yes', 'y', 'true'].includes(normalized) ? 'yes' : 'no';
                    break;
                case 'choice':
                    isValid = input.options?.includes(input.userResponse) || false;
                    break;
                case 'approval':
                    const approvalNormalized = input.userResponse.toLowerCase();
                    isValid = ['approve', 'deny', 'approved', 'denied', 'yes', 'no'].includes(approvalNormalized);
                    processedValue = ['approve', 'approved', 'yes'].includes(approvalNormalized) ? 'approved' : 'denied';
                    break;
                case 'input':
                    isValid = input.userResponse.trim().length > 0;
                    processedValue = input.userResponse.trim();
                    break;
            }
            if (!isValid) {
                throw new Error(`Invalid response for ${input.type} type elicitation`);
            }
            const responseTime = Date.now() - startTime;
            return {
                status: 'completed',
                prompt: input.prompt,
                type: input.type,
                userResponse: input.userResponse,
                result: {
                    completed: true,
                    value: processedValue,
                    timestamp: new Date().toISOString(),
                    responseTime
                },
                workflow: {
                    step1: 'Elicitation request received with user response',
                    step2: 'Response validated against type constraints',
                    step3: 'Response processed and normalized',
                    step4: 'Result returned to requesting tool'
                }
            };
        }
        // No user response provided - return pending elicitation
        return {
            status: 'pending',
            prompt: input.prompt,
            type: input.type,
            result: {
                completed: false,
                timestamp: new Date().toISOString()
            },
            workflow: {
                step1: 'Elicitation request created',
                step2: 'Waiting for user response',
                step3: 'MCP client should prompt user',
                step4: 'Call again with userResponse to complete'
            }
        };
    }),
};

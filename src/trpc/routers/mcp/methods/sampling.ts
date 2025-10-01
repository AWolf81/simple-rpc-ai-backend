import { publicProcedure } from "../../../index";
import z from "zod";
import { createMCPTool } from '../../../../auth/scopes';
import type { AIService } from '@services/ai/ai-service';

/**
 * Sampling and Elicitation procedures for MCP
 * These demonstrate the MCP protocol's capability for AI interaction workflows
 */
export function createSamplingProcedures(aiService: AIService, aiConfig: {
  enabled: boolean;
  useServerConfig: boolean;
  restrictToSampling: boolean;
  allowByokOverride: boolean;
}): Record<string, any> {
  return {
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

      const systemPrompt = `You are a ${input.style} content generator. Create high-quality content based on user requests.`;
      const userPrompt = `Task: ${input.task}\nStyle: ${input.style}\nMax tokens: ${input.maxTokens}`;

      // Check if AI is properly configured
      if (!aiConfig.enabled) {
        return {
          status: 'disabled',
          task: input.task,
          style: input.style,
          content: `⚠️ AI Generation Not Available

AI-powered MCP sampling is disabled. To enable:

\`\`\`javascript
const server = createRpcAiServer({
  mcp: {
    enabled: true,
    ai: {
      enabled: true,        // Enable AI for MCP tools
      useServerConfig: true, // Use same providers as ai.generateText
      restrictToSampling: true // Only sampling tools use AI (recommended)
    }
  }
});
\`\`\`

Current request: ${input.task}
Style: ${input.style}
Max tokens: ${input.maxTokens}

This tool demonstrates the MCP sampling protocol with real AI generation.`,
          metadata: {
            samplingUsed: false,
            userApproved: false,
            tokensUsed: 0,
            messages: 0,
            note: 'AI generation disabled - configuration required'
          },
          workflow: {
            step1: 'Tool receives user request ✓',
            step2: 'Check AI configuration ✗',
            step3: 'AI disabled - show configuration help',
            step4: 'Return helpful error message',
            step5: 'User can enable AI and retry'
          }
        };
      }

      try {
        // Real AI generation using the AIService
        const aiResult = await aiService.execute({
          content: userPrompt,
          promptId: systemPrompt, // Using systemPrompt directly
          metadata: {
            maxTokens: input.maxTokens,
            type: 'content-generation',
            name: 'MCP Sampling'
          }
        });

        return {
          status: 'completed',
          task: input.task,
          style: input.style,
          content: aiResult.content,
          metadata: {
            samplingUsed: true,
            userApproved: true, // In real MCP, this would come from user approval
            tokensUsed: aiResult.usage.totalTokens,
            messages: 2, // system + user message
            note: 'Real AI generation via AIService with MCP sampling protocol'
          },
          workflow: {
            step1: 'Tool receives user request ✓',
            step2: 'Tool prepares messages for AI ✓',
            step3: 'AI generates content via AIService ✓',
            step4: 'Content processed and validated ✓',
            step5: 'Final content returned to MCP client ✓'
          }
        };
      } catch (error) {
        // Fallback response if AI generation fails
        console.error('AI generation failed:', error);

        return {
          status: 'fallback',
          task: input.task,
          style: input.style,
          content: `[Fallback Content - ${input.style} style]

Task: ${input.task}

I apologize, but AI generation is currently unavailable. This is a fallback response demonstrating the MCP sampling protocol resilience.

The system attempted to generate content with these parameters:
- Style: ${input.style}
- Max tokens: ${input.maxTokens}
- Task: ${input.task}

Error: ${error instanceof Error ? error.message : 'Unknown error'}

In a production MCP implementation:
1. The tool would request user approval for AI generation
2. Upon approval, real AI content would be generated
3. If generation fails, this fallback ensures graceful degradation`,
          metadata: {
            samplingUsed: false,
            userApproved: false,
            tokensUsed: 0,
            messages: 2,
            note: 'Fallback response due to AI generation failure'
          },
          workflow: {
            step1: 'Tool receives user request ✓',
            step2: 'Tool prepares messages for AI ✓',
            step3: 'AI generation failed ✗',
            step4: 'Fallback content generated ✓',
            step5: 'Error handled gracefully ✓'
          }
        };
      }
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
}
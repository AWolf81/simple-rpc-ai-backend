import { publicProcedure } from "../../../index";
import z from "zod";
import { createMCPTool } from '../../../../auth/scopes';

/**
 * Prompt management procedures for MCP
 */
export const promptProcedures: Record<string, any> = {
  // Get available prompts
  getPrompts: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'getPrompts',
        description: 'List available MCP prompt templates with metadata',
        category: 'prompt',
        public: true
      }),
      openapi: {
        method: 'GET',
        path: '/mcp/prompts',
        tags: ['MCP', 'Prompts'],
        summary: 'List MCP prompt templates'
      }
    })
    .input(z.object({
      category: z.string().optional().describe('Filter prompts by category'),
      search: z.string().optional().describe('Search prompts by name or description'),
    }))
    .output(z.object({
      prompts: z.array(z.object({
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
        arguments: z.array(z.object({
          name: z.string(),
          description: z.string(),
          required: z.boolean()
        }))
      })),
      total: z.number()
    }))
    .query(({ input, ctx }) => {
      // Define built-in prompts
      let prompts = [
        {
          name: 'code-review',
          description: 'AI-powered code review with security focus',
          category: 'development',
          arguments: [
            { name: 'code', description: 'Code to review', required: true },
            { name: 'language', description: 'Programming language', required: true },
            { name: 'focus_area', description: 'Focus area (security, performance, etc.)', required: false }
          ]
        },
        {
          name: 'incident-response',
          description: 'Guide incident response procedures',
          category: 'operations',
          arguments: [
            { name: 'description', description: 'Incident description', required: true },
            { name: 'severity', description: 'Incident severity (critical, high, medium, low)', required: true },
            { name: 'status', description: 'Current incident status', required: false }
          ]
        },
        {
          name: 'documentation',
          description: 'Generate technical documentation',
          category: 'development',
          arguments: [
            { name: 'topic', description: 'Topic to document', required: true },
            { name: 'audience', description: 'Target audience (developers, users, etc.)', required: true },
            { name: 'format', description: 'Output format (markdown, html, etc.)', required: false }
          ]
        },
        {
          name: 'explain-concept',
          description: 'Explain technical concepts clearly',
          category: 'education',
          arguments: [
            { name: 'concept', description: 'Concept to explain', required: true },
            { name: 'level', description: 'Complexity level (beginner, intermediate, advanced)', required: true },
            { name: 'examples', description: 'Include examples', required: false }
          ]
        }
      ];

      // Add custom prompts from extensions if available
      const mcpConfig = (ctx as any)?.mcpConfig;
      if (mcpConfig?.extensions?.prompts?.customPrompts) {
        const customPrompts = mcpConfig.extensions.prompts.customPrompts.map((prompt: any) => ({
          name: prompt.name,
          description: prompt.description || 'Custom prompt template',
          category: prompt.category || 'custom',
          arguments: prompt.arguments || []
        }));
        prompts = [...prompts, ...customPrompts];
      }

      // Apply filters
      if (input.category) {
        prompts = prompts.filter(p => p.category === input.category);
      }

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        prompts = prompts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      return {
        prompts,
        total: prompts.length
      };
    }),

  // Get a specific prompt template
  getPromptTemplate: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'getPromptTemplate',
        description: 'Get a specific prompt template with its messages and structure',
        category: 'prompt'
      }),
      openapi: {
        method: 'GET',
        path: '/mcp/prompts/{name}',
        tags: ['MCP', 'Prompts'],
        summary: 'Get prompt template'
      }
    })
    .input(z.object({
      name: z.string().min(1).describe('Name of the prompt template to retrieve'),
      arguments: z.record(z.string()).optional().describe('Arguments to populate in the template'),
    }))
    .output(z.object({
      name: z.string(),
      description: z.string(),
      category: z.string().optional(),
      messages: z.array(z.object({
        role: z.string(),
        content: z.object({
          type: z.string(),
          text: z.string()
        })
      })),
      arguments: z.array(z.object({
        name: z.string(),
        description: z.string(),
        required: z.boolean()
      })),
      populated: z.boolean()
    }))
    .query(({ input, ctx }) => {
      const { name, arguments: args = {} } = input;

      // Get prompt template
      const template = getPromptTemplate(name, ctx);
      if (!template) {
        throw new Error(`Prompt template '${name}' not found`);
      }

      // Populate template with arguments if provided
      const populated = Object.keys(args).length > 0;
      const messages = populated ? populateTemplate(template.messages, args) : template.messages;

      return {
        name: template.name,
        description: template.description,
        category: template.category,
        messages,
        arguments: template.arguments,
        populated
      };
    }),
};

function getPromptTemplate(name: string, ctx: any) {
  const builtInTemplates: Record<string, any> = {
    'code-review': {
      name: 'code-review',
      description: 'AI-powered code review with security focus',
      category: 'development',
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'You are a senior software engineer conducting a thorough code review. Focus on {{focus_area}} and provide specific, actionable feedback.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please review this {{language}} code: {{code}}. Pay special attention to {{focus_area}}.'
          }
        }
      ],
      arguments: [
        { name: 'code', description: 'Code to review', required: true },
        { name: 'language', description: 'Programming language', required: true },
        { name: 'focus_area', description: 'Focus area (security, performance, etc.)', required: false }
      ]
    },
    'incident-response': {
      name: 'incident-response',
      description: 'Guide incident response procedures',
      category: 'operations',
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'You are an incident response coordinator. Help prioritize and coordinate response to {{severity}} incidents.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'We have a {{severity}} incident: {{description}}. Current status: {{status}}. What should we do next?'
          }
        }
      ],
      arguments: [
        { name: 'description', description: 'Incident description', required: true },
        { name: 'severity', description: 'Incident severity (critical, high, medium, low)', required: true },
        { name: 'status', description: 'Current incident status', required: false }
      ]
    },
    'documentation': {
      name: 'documentation',
      description: 'Generate technical documentation',
      category: 'development',
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'You are a technical writer creating {{format}} documentation for {{audience}}.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Create documentation for: {{topic}}. Target audience: {{audience}}. Format: {{format}}.'
          }
        }
      ],
      arguments: [
        { name: 'topic', description: 'Topic to document', required: true },
        { name: 'audience', description: 'Target audience (developers, users, etc.)', required: true },
        { name: 'format', description: 'Output format (markdown, html, etc.)', required: false }
      ]
    },
    'explain-concept': {
      name: 'explain-concept',
      description: 'Explain technical concepts clearly',
      category: 'education',
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'You are an educator explaining technical concepts at a {{level}} level. Use clear language and {{examples}}.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Explain this concept: {{concept}}. Level: {{level}}. Include examples: {{examples}}.'
          }
        }
      ],
      arguments: [
        { name: 'concept', description: 'Concept to explain', required: true },
        { name: 'level', description: 'Complexity level (beginner, intermediate, advanced)', required: true },
        { name: 'examples', description: 'Include examples', required: false }
      ]
    }
  };

  // Check built-in templates first
  if (builtInTemplates[name]) {
    return builtInTemplates[name];
  }

  // Check custom templates from extensions
  const mcpConfig = (ctx as any)?.mcpConfig;
  if (mcpConfig?.extensions?.prompts?.customTemplates?.[name]) {
    return mcpConfig.extensions.prompts.customTemplates[name];
  }

  return null;
}

function populateTemplate(messages: any[], args: Record<string, string>) {
  return messages.map(message => ({
    ...message,
    content: {
      ...message.content,
      text: message.content.text.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
        return args[key] || match; // Keep placeholder if argument not provided
      })
    }
  }));
}
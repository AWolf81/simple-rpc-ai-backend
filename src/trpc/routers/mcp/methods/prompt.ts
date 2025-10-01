import { publicProcedure } from "../../../index";
import z from "zod";
import { createMCPPrompt } from '../../../../auth/scopes';

/**
 * Prompt management procedures for MCP
 *
 * NOTE: getPrompts/getPromptTemplate tools have been moved to examples to be less opinionated.
 * See: examples/02-mcp-server/methods/prompt-access.js for reference implementation
 */
export const promptProcedures: Record<string, any> = {};

/**
 * Direct MCP Prompt Procedures (exposed via prompts/list and prompts/get)
 * These use createMCPPrompt() metadata and return prompt text directly
 */
export const mcpPromptProcedures: Record<string, any> = {
  // Code Review Prompt
  codeReviewPrompt: publicProcedure
    .meta(createMCPPrompt({
      name: 'code-review',
      description: 'Comprehensive code review with security, performance, and maintainability analysis',
      arguments: [
        { name: 'code', description: 'The code to review', required: true, type: 'string' },
        { name: 'language', description: 'Programming language (e.g., typescript, python, go)', required: true, type: 'string' },
        { name: 'focusArea', description: 'Specific focus area (security, performance, maintainability)', required: false, type: 'string' }
      ],
      template: `You are a senior software engineer conducting a thorough code review. Analyze the provided {language} code and respond with:

1. **Code Quality Assessment** - Overall quality, style, and conventions
2. **Potential Issues** - Bugs, security vulnerabilities, performance problems
3. **Improvement Suggestions** - Specific refactoring recommendations
4. **Summary** - Key findings with priority levels (High/Medium/Low)

Focus area: {focusArea}

Code to review:
\`\`\`{language}
{code}
\`\`\`

Provide concise, actionable feedback tailored to the requested focus area.`,
      variables: {
        code: {
          type: 'string',
          description: 'Source code to review',
          required: true,
          example: 'function add(a, b) { return a + b; }'
        },
        language: {
          type: 'string',
          description: 'Programming language for the code sample',
          required: true,
          example: 'typescript'
        },
        focusArea: {
          type: 'string',
          description: 'Optional focus area to emphasize (e.g., security, performance). Use "general best practices" when no specific focus is needed.',
          required: false,
          default: 'general best practices'
        }
      },
      category: 'review',
      public: true
    }))
    .input(z.object({
      code: z.string().describe('Code to review'),
      language: z.string().describe('Programming language'),
      focusArea: z.string().optional().describe('Focus area')
    }))
    .query(({ input }) => {
      const focusText = input.focusArea ? ` with special attention to ${input.focusArea}` : '';
      return `You are a senior software engineer conducting a thorough code review${focusText}. Review this ${input.language} code and provide:

1. **Code Quality Assessment** - Overall quality, style, and conventions
2. **Potential Issues** - Bugs, security vulnerabilities, performance problems
3. **Improvement Suggestions** - Specific refactoring recommendations
4. **Summary** - Key findings with priority levels (High/Medium/Low)

Code to review:
\`\`\`${input.language}
${input.code}
\`\`\`

Provide concise, actionable feedback.`;
    }),

  // API Documentation Prompt
  apiDocumentationPrompt: publicProcedure
    .meta(createMCPPrompt({
      name: 'api-documentation',
      description: 'Generate comprehensive API documentation from code',
      arguments: [
        { name: 'code', description: 'API code or endpoint definitions', required: true, type: 'string' },
        { name: 'format', description: 'Documentation format (markdown, openapi, json)', required: false, type: 'enum', options: ['markdown', 'openapi', 'json'], default: 'markdown' }
      ],
      template: `You are a technical writer generating API documentation in {format} format. Using the provided code sample, produce:

1. **API Overview** - Purpose and capabilities
2. **Endpoints** - Available endpoints with HTTP methods
3. **Parameters** - Request parameters, body fields, and headers
4. **Responses** - Status codes, payloads, and examples
5. **Authentication** - Required auth or security schemes
6. **Usage Examples** - Practical examples for consumers

Code to document:
\`\`\`
{code}
\`\`\`

Ensure the documentation respects the conventions of the chosen {format} format.`,
      variables: {
        code: {
          type: 'string',
          description: 'API source code or endpoint definition to document',
          required: true
        },
        format: {
          type: 'enum',
          description: 'Preferred documentation output format',
          required: false,
          default: 'markdown',
          options: ['markdown', 'openapi', 'json']
        }
      },
      category: 'documentation',
      public: true
    }))
    .input(z.object({
      code: z.string().describe('API code to document'),
      format: z.enum(['markdown', 'openapi', 'json']).default('markdown').describe('Output format')
    }))
    .query(({ input }) => {
      return `You are a technical writer generating API documentation in ${input.format} format. Analyze this code and create:

1. **API Overview** - Purpose and capabilities
2. **Endpoints** - All available endpoints with HTTP methods
3. **Parameters** - Request parameters, body, and headers
4. **Responses** - Response formats, status codes, and examples
5. **Authentication** - Auth requirements if applicable
6. **Usage Examples** - Code examples in multiple languages

Code to document:
\`\`\`
${input.code}
\`\`\`

Generate clear, comprehensive documentation in ${input.format} format.`;
    }),

  // Explain Concept Prompt
  explainConceptPrompt: publicProcedure
    .meta(createMCPPrompt({
      name: 'explain-concept',
      description: 'Explain technical concepts clearly at different skill levels',
      arguments: [
        {
          name: 'concept',
          description: 'The concept to explain',
          required: true,
          type: 'string'
        },
        {
          name: 'level',
          description: 'Skill level: beginner | intermediate | advanced',
          required: true,
          type: 'enum',
          options: ['beginner', 'intermediate', 'advanced']
        },
        {
          name: 'includeExamples',
          description: 'Include code examples: yes | no (default: yes)',
          required: false,
          type: 'enum',
          options: ['yes', 'no'],
          default: 'yes'
        }
      ],
      template: `Explain the concept of {concept} to a {level} learner. Include practical examples: {includeExamples}. Cover the following:

1. Clear definition in accessible language
2. Why the concept matters and common use cases
3. How it works for developers at the {level} stage
4. Practical examples when {includeExamples} is "yes"
5. Common pitfalls or misunderstandings

Keep the tone encouraging and adapt depth to the {level} audience.`,
      variables: {
        concept: {
          type: 'string',
          description: 'The concept to explain, such as “recursion” or “event loop”',
          required: true
        },
        level: {
          type: 'enum',
          description: 'Audience proficiency level',
          required: true,
          options: ['beginner', 'intermediate', 'advanced'],
          example: 'beginner'
        },
        includeExamples: {
          type: 'enum',
          description: 'Whether to include code examples',
          required: false,
          options: ['yes', 'no'],
          default: 'yes'
        }
      },
      category: 'general',
      public: true
    }))
    .input(z.object({
      concept: z.string().describe('Concept to explain'),
      level: z.enum(['beginner', 'intermediate', 'advanced']).describe('Skill level'),
      includeExamples: z.enum(['yes', 'no']).default('yes').describe('Include examples')
    }))
    .query(({ input }) => {
      const examplesText = input.includeExamples === 'yes' ? ' with practical examples' : '';
      return `You are an educator explaining technical concepts at a ${input.level} level. Explain the following concept${examplesText}:

**Concept**: ${input.concept}
**Target Audience**: ${input.level}

Structure your explanation:
1. **Simple Definition** - What it is in plain language
2. **Why It Matters** - Real-world applications and benefits
3. **How It Works** - Core mechanics appropriate for ${input.level} level
${input.includeExamples === 'yes' ? '4. **Examples** - Practical code examples with explanations' : ''}
5. **Common Pitfalls** - What to watch out for

Make it accessible and engaging for ${input.level} developers.`;
    }),

  // Incident Response Prompt
  incidentResponsePrompt: publicProcedure
    .meta(createMCPPrompt({
      name: 'incident-response',
      description: 'Guide incident response procedures and provide action steps',
      arguments: [
        { name: 'description', description: 'Description of the incident', required: true, type: 'string' },
        { name: 'severity', description: 'Incident severity (critical, high, medium, low)', required: true, type: 'enum', options: ['critical', 'high', 'medium', 'low'] },
        { name: 'status', description: 'Current incident status', required: false, type: 'string' }
      ],
      template: `You are an incident response coordinator handling a {severity} severity incident. Context:

- Incident description: {description}
- Current status: {status}

Provide:
1. Immediate actions required for {severity} severity
2. Key assessment steps to collect details
3. Mitigation plan to contain and resolve the incident
4. Communication guidance (stakeholders, frequency, messaging)
5. Follow-up activities once the incident is resolved

Keep the plan actionable and tailored to the {severity} severity level.`,
      variables: {
        description: {
          type: 'string',
          description: 'Summary of what happened',
          required: true
        },
        severity: {
          type: 'enum',
          description: 'Severity level of the incident',
          required: true,
          options: ['critical', 'high', 'medium', 'low'],
          example: 'high'
        },
        status: {
          type: 'string',
          description: 'Current status or phase of the incident (optional)',
          required: false,
          default: 'investigating'
        }
      },
      category: 'analysis',
      public: false // Requires authentication
    }))
    .input(z.object({
      description: z.string().describe('Incident description'),
      severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Severity level'),
      status: z.string().optional().describe('Current status')
    }))
    .query(({ input }) => {
      const statusText = input.status ? `\nCurrent Status: ${input.status}` : '';
      return `You are an incident response coordinator handling a ${input.severity} severity incident. Provide structured guidance:

**Incident**: ${input.description}
**Severity**: ${input.severity}${statusText}

Provide:
1. **Immediate Actions** - Critical steps to take right now (for ${input.severity} incidents)
2. **Assessment** - What information to gather
3. **Mitigation** - Steps to contain and resolve the issue
4. **Communication** - Who to notify and what to communicate
5. **Follow-up** - Post-incident actions and documentation

Be specific and actionable for ${input.severity} severity incidents.`;
    })
};

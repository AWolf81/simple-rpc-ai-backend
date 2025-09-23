/**
 * MCP Prompts Configuration
 *
 * This module sets up MCP prompt templates and management
 */

/**
 * Sample prompt templates for MCP
 * These will be available to MCP clients for discovery and use
 */
export const promptTemplates = {
  codeReview: {
    id: 'code-review',
    name: 'Code Review Assistant',
    description: 'Helps with thorough code review focusing on best practices',
    template: `Please review the following code for:
- Code quality and readability
- Performance considerations
- Security vulnerabilities
- Best practices adherence
- Potential bugs or edge cases

Code to review:
\`\`\`{{language}}
{{code}}
\`\`\`

Please provide specific, actionable feedback.`,
    variables: [
      {
        name: 'language',
        description: 'Programming language of the code',
        required: true
      },
      {
        name: 'code',
        description: 'The code to review',
        required: true
      }
    ],
    category: 'development'
  },

  documentation: {
    id: 'documentation-writer',
    name: 'Documentation Writer',
    description: 'Generates comprehensive documentation for code or APIs',
    template: `Generate clear, comprehensive documentation for the following:

{{content_type}}: {{name}}

{{#if description}}
Description: {{description}}
{{/if}}

Content to document:
{{content}}

Please include:
- Clear overview and purpose
- Usage examples
- Parameter/argument documentation
- Return value descriptions
- Any important notes or caveats`,
    variables: [
      {
        name: 'content_type',
        description: 'Type of content (function, API, class, etc.)',
        required: true
      },
      {
        name: 'name',
        description: 'Name of the item being documented',
        required: true
      },
      {
        name: 'description',
        description: 'Brief description of the item',
        required: false
      },
      {
        name: 'content',
        description: 'The actual content to document',
        required: true
      }
    ],
    category: 'documentation'
  },

  bugAnalysis: {
    id: 'bug-analysis',
    name: 'Bug Analysis Assistant',
    description: 'Helps analyze and debug issues in code',
    template: `Analyze the following bug report and provide debugging guidance:

Issue: {{issue_title}}

{{#if error_message}}
Error Message: {{error_message}}
{{/if}}

{{#if steps_to_reproduce}}
Steps to Reproduce:
{{steps_to_reproduce}}
{{/if}}

{{#if code_context}}
Relevant Code:
\`\`\`{{language}}
{{code_context}}
\`\`\`
{{/if}}

Please provide:
1. Possible root causes
2. Debugging steps to narrow down the issue
3. Potential solutions
4. Prevention strategies for similar issues`,
    variables: [
      {
        name: 'issue_title',
        description: 'Brief title describing the bug',
        required: true
      },
      {
        name: 'error_message',
        description: 'Any error messages encountered',
        required: false
      },
      {
        name: 'steps_to_reproduce',
        description: 'Steps to reproduce the issue',
        required: false
      },
      {
        name: 'code_context',
        description: 'Relevant code where the issue occurs',
        required: false
      },
      {
        name: 'language',
        description: 'Programming language',
        required: false
      }
    ],
    category: 'debugging'
  }
};

/**
 * Setup MCP prompt configuration
 */
export function setupPrompts() {
  // Future: Register prompts with MCP system when prompt capability is fully implemented
  console.log('📝 Prompt templates prepared:', Object.keys(promptTemplates).length);

  return {
    templates: promptTemplates,
    categories: ['development', 'documentation', 'debugging'],
    count: Object.keys(promptTemplates).length
  };
}

/**
 * Get prompt template by ID
 */
export function getPromptTemplate(id) {
  return promptTemplates[id] || null;
}

/**
 * Get all prompt templates for a category
 */
export function getPromptsByCategory(category) {
  return Object.values(promptTemplates).filter(prompt => prompt.category === category);
}
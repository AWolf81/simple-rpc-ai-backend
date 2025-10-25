/**
 * Agent User Interaction Example
 *
 * Demonstrates how agents can use the user-interaction skill
 * to create interactive CLI experiences in simple-agent.
 */

import { createRpcAiServer } from '../dist/index.js';
import { createTypedAIClient } from '../dist/client.js';
import { httpLink } from '@trpc/client';

/**
 * Example: Agent that helps create files with user interaction
 */
async function fileCreationAgentExample() {
  // 1. Create server with user-interaction skill
  const server = createRpcAiServer({
    port: 8000,
    agents: {
      enabled: true,
      skills: {
        sources: [
          { type: 'builtin', name: 'user-interaction' },
          { type: 'builtin', name: 'file-handling' }
        ]
      }
    }
  });

  await server.start();
  console.log('Server started on http://localhost:8000');

  // 2. Create client
  const client = createTypedAIClient({
    links: [httpLink({ url: 'http://localhost:8000/trpc' })]
  }) as any;

  // 3. Execute agent with user interaction
  try {
    const result = await client.agents.execute.mutate({
      systemPrompt: `You are a file creation assistant. When asked to create files:
1. Use the user_interaction_select tool to ask what type of file to create
2. Use the user_interaction_input tool to get the filename
3. Use the user_interaction_confirm tool to confirm before creating
4. Create the file using file_handling_write

Always use the user interaction tools to confirm before making changes.`,
      messages: [
        {
          role: 'user',
          content: 'Help me create a new TypeScript file'
        }
      ],
      model: 'claude-3-5-sonnet-20241022'
    });

    console.log('Agent response:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await server.stop();
  }
}

/**
 * Example: How the agent would structure interaction tool calls
 */
const exampleToolCalls = {
  // Step 1: Select file type
  selectFileType: {
    toolName: 'user_interaction_select',
    arguments: {
      title: 'Choose File Type',
      message: 'What type of TypeScript file would you like to create?',
      options: [
        'React Component (.tsx)',
        'TypeScript Module (.ts)',
        'Test File (.test.ts)',
        'Type Definitions (.d.ts)'
      ]
    }
    // Returns: Selected option as string
  },

  // Step 2: Get filename with AI interpretation
  getFilename: {
    toolName: 'user_interaction_input',
    arguments: {
      title: 'Enter Filename',
      message: 'What should we name the file?',
      'default-value': 'MyComponent.tsx',
      'enable-ai-interpretation': true,
      'ai-context': 'User is naming a new React component file'
    }
    // Returns: Filename (AI can interpret variations like "my component" → "MyComponent.tsx")
  },

  // Step 3: Confirm with custom responses allowed
  confirmCreation: {
    toolName: 'user_interaction_confirm',
    arguments: {
      message: 'Create MyComponent.tsx in the current directory?',
      'enable-ai-interpretation': true,
      'ai-context': 'Creating new React component file MyComponent.tsx'
    }
    // Returns: "yes", "no", or custom response like "yes but add PropTypes"
  },

  // Step 4: Select multiple options
  selectFeatures: {
    toolName: 'user_interaction_select',
    arguments: {
      title: 'Component Features',
      message: 'Select features to include (use Space to toggle, Enter to confirm):',
      options: [
        'TypeScript props interface',
        'useState hook',
        'useEffect hook',
        'CSS modules',
        'Unit tests'
      ],
      'multi-select': true
    }
    // Returns: Array of selected options
  }
};

/**
 * Example: How simple-agent UI renders these interactions
 */
const simpleAgentUIExample = {
  // When agent calls user_interaction_select, simple-agent shows:
  selectDialog: `
┌─────────────────────────────────────────────────────────┐
│ 📋 Choose File Type                                     │
│                                                          │
│ What type of TypeScript file would you like to create?  │
│ ────────────────────────────────────────────────────────│
│                                                          │
│  ▶ 1. React Component (.tsx)                            │
│    2. TypeScript Module (.ts)                           │
│    3. Test File (.test.ts)                              │
│    4. Type Definitions (.d.ts)                          │
│                                                          │
│ ────────────────────────────────────────────────────────│
│ Use ↑↓ to select, Enter to confirm                      │
└─────────────────────────────────────────────────────────┘
  `,

  // When agent calls user_interaction_input with AI interpretation:
  inputDialog: `
┌─────────────────────────────────────────────────────────┐
│ ✏️  Enter Filename                                       │
│                                                          │
│ What should we name the file?                           │
│ ────────────────────────────────────────────────────────│
│                                                          │
│ > MyComponent.tsx_                                       │
│                                                          │
│ 💡 AI will interpret your response - you can say:       │
│    "yes", "no", "do it", "don't do it", etc.            │
│                                                          │
│ ────────────────────────────────────────────────────────│
│ Type your response, Enter to submit                     │
└─────────────────────────────────────────────────────────┘
  `,

  // When agent calls user_interaction_confirm:
  confirmDialog: `
┌─────────────────────────────────────────────────────────┐
│ ❓ Confirm Action                                        │
│                                                          │
│ Create MyComponent.tsx in the current directory?        │
│ ────────────────────────────────────────────────────────│
│                                                          │
│  ▶ Yes (y)      No (n)      Custom (c)                  │
│                                                          │
│ 💡 Press 'c' for custom response with AI interpretation │
│                                                          │
│ ────────────────────────────────────────────────────────│
│ Use ↑↓ or y/n, c for custom, Enter to confirm          │
└─────────────────────────────────────────────────────────┘
  `
};

/**
 * Example: Agent system prompt for interactive file manager
 */
const interactiveFileManagerPrompt = `You are an interactive file management assistant with access to:

**User Interaction Tools:**
- user_interaction_select: Ask user to choose from options
- user_interaction_input: Get free-form user input (supports AI interpretation)
- user_interaction_confirm: Get yes/no confirmation (supports AI interpretation)

**File Handling Tools:**
- file_handling_read: Read file contents
- file_handling_write: Create/update files
- file_handling_grep: Search in files
- file_handling_search_files: Find files by pattern

**Workflow Guidelines:**

1. **Always confirm destructive operations:**
   - Use user_interaction_confirm before deleting files
   - Use user_interaction_confirm before overwriting files
   - Enable AI interpretation to allow conditional responses

2. **Use select for choices:**
   - File type selection
   - Action selection (edit/delete/create)
   - Multi-select for batch operations

3. **Use input for free-form responses:**
   - Filenames (enable AI interpretation for smart naming)
   - Search patterns
   - File content

4. **Handle user responses intelligently:**
   - If user says "yes but X first", do X before proceeding
   - If user says "not now", explain what you were going to do
   - If user provides conditions, incorporate them

**Example Interaction Flow:**

User: "Create a new React component for a login form"

You:
1. Call user_interaction_input to get component name
   - Enable AI interpretation so "login form" → "LoginForm"
2. Call user_interaction_select for features
   - Options: Props interface, Form validation, CSS modules, etc.
   - Use multi-select
3. Call user_interaction_confirm before creating files
   - Enable AI interpretation for conditional approval
4. Create files based on selections
5. Report success with file locations

Remember: The user interaction tools make the experience interactive and user-friendly!`;

// Export examples
export {
  fileCreationAgentExample,
  exampleToolCalls,
  simpleAgentUIExample,
  interactiveFileManagerPrompt
};

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fileCreationAgentExample().catch(console.error);
}

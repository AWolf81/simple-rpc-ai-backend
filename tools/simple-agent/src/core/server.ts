/**
 * Server management for Simple Agent CLI
 */

import { createRpcAiServer, RpcAiServer } from 'simple-rpc-ai-backend';
import { AgentSkill } from '../../../../dist/services/agents/types';

// Define skills
const codeReviewSkill: AgentSkill = {
  id: 'code-reviewer',
  name: 'Code Review Expert',
  description: 'Analyzes code for best practices, bugs, and security issues',
  level: 2,
  instructions: `
## Code Review Guidelines

You are an expert code reviewer. When reviewing code:

1. **Best Practices** - Check naming conventions, code organization, duplication
2. **Security** - SQL injection, XSS, authentication issues, sensitive data
3. **Performance** - Algorithm efficiency, memory usage, query optimization
4. **Maintainability** - Code comments, documentation, test coverage

Provide specific, actionable feedback with code examples.
  `
};

const fileHandlingSkill: AgentSkill = {
  id: 'file-handler',
  name: 'File System Expert',
  description: 'Manages files and directories with permission-based safeguards',
  level: 3,
  instructions: `
## File System Operations

You are an expert file system manager with comprehensive capabilities.

**READ Operations (No permission required):**
1. List Files, Read File, Search in Files, Search Files, List Folders, File Info

**WRITE Operations (⚠️ REQUIRE USER PERMISSION):**
1. Create/Update/Delete File, Rename File, Create/Delete/Rename Folder, Copy File/Folder

### Permission Request Protocol

**CRITICAL: Before any WRITE operation, you MUST:**

1. Clearly state the operation
2. Show the exact path(s) affected
3. Provide a preview of changes
4. Explain the reason
5. Wait for explicit user approval

**Format:**
\`\`\`
🔒 PERMISSION REQUIRED

Operation: [CREATE/UPDATE/DELETE/RENAME/COPY]
Path: [file or folder path]
Reason: [why this change is needed]

Preview:
[show relevant content/diff/list]

Do you approve this operation? (yes/no)
\`\`\`

**NEVER perform write operations without explicit user confirmation.**
  `
};

const apiDesignSkill: AgentSkill = {
  id: 'api-designer',
  name: 'API Design Expert',
  description: 'Designs RESTful APIs following industry best practices',
  level: 2,
  instructions: `
## API Design Principles

1. **Resource-Based Design** - Use nouns for endpoints
2. **HTTP Methods** - GET, POST, PUT, PATCH, DELETE
3. **Status Codes** - 2xx success, 4xx client errors, 5xx server errors
4. **Versioning** - Include API version in URL or headers
5. **Documentation** - Use OpenAPI/Swagger, provide clear examples
  `
};

let serverInstance:(RpcAiServer|null) = null;

export async function startServer() {
  if (serverInstance) {
    return serverInstance;
  }

  serverInstance = createRpcAiServer({
    port: 8001,
    serverProviders: ['anthropic'],

    agents: {
      enabled: true,
      defaultSDK: 'claude-code',
      enableClaudeCode: true,
      enableOpenAI: false,

      claudeCode: {
        enableSkills: true,
        defaultSkills: [codeReviewSkill, fileHandlingSkill, apiDesignSkill]
      }
    },

    mcp: {
      enabled: false
    },

    protocols: {
      jsonRpc: true,
      tRpc: true
    }
  });

  await serverInstance.start();
  return serverInstance;
}

export async function stopServer() {
  if (serverInstance) {
    await serverInstance.stop();
    serverInstance = null;
  }
}

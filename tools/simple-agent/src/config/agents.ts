import { loadMainAgentSkill, type AgentSkill } from 'simple-rpc-ai-backend/types/agents';

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

const fileHandlingAgentSkill: AgentSkill = {
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
\u0060\u0060\u0060
🔒 PERMISSION REQUIRED

Operation: [CREATE/UPDATE/DELETE/RENAME/COPY]
Path: [file or folder path]
Reason: [why this change is needed]

Preview:
[show relevant content/diff/list]

Do you approve this operation? (yes/no)
\u0060\u0060\u0060

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

/**
 * Get default agent skills for simple-agent CLI
 *
 * IMPORTANT: main-agent skill MUST be first - it provides core agentic behavior
 * including proper tool usage patterns, iteration logic, and stop conditions.
 */
export function getDefaultAgentSkills(): AgentSkill[] {
  return [
    loadMainAgentSkill(),  // MANDATORY: Core agent behavior (tool iteration, stop logic)
    codeReviewSkill,
    fileHandlingAgentSkill,
    apiDesignSkill
  ];
}

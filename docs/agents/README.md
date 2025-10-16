# Agent Abstraction - Claude Code SDK & OpenAI Agents SDK

Unified agent abstraction that supports both Claude Code SDK (with skills) and OpenAI Agents SDK, reusing existing AI provider infrastructure.

## Overview

The agent system provides:
- **Dual SDK Support**: Claude Code SDK and OpenAI Agents SDK through a unified interface
- **Skills System**: Claude's progressive disclosure model for modular capabilities (Level 1/2/3)
- **AI Provider Reuse**: Leverages existing AIService for provider management
- **Tool Integration**: Share tools across both SDKs
- **Type Safety**: Full TypeScript support with Zod validation

## Architecture

```
┌─────────────────────────────────────────────────┐
│            AgentService                          │
│  (Unified agent management)                      │
└─────────────┬───────────────────────────────────┘
              │
     ┌────────┴────────┐
     │                 │
┌────▼─────┐    ┌─────▼──────┐
│  Claude  │    │   OpenAI   │
│   Code   │    │   Agents   │
│ Adapter  │    │  Adapter   │
└────┬─────┘    └─────┬──────┘
     │                │
     └────────┬────────┘
              │
         ┌────▼─────┐
         │ AIService│
         │ (Vercel  │
         │ AI SDK)  │
         └──────────┘
```

## Quick Start

### 1. Enable Agents in Server Config

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  serverProviders: ['anthropic', 'openai'],

  // Enable agents
  agents: {
    enabled: true,
    defaultSDK: 'claude-code',        // Default to Claude Code
    enableClaudeCode: true,
    enableOpenAI: true,

    // Claude Code configuration
    claudeCode: {
      enableSkills: true,
      skillsDirectory: './skills',    // Optional: Load skills from directory
      defaultSkills: [
        {
          id: 'code-reviewer',
          name: 'Code Review Expert',
          description: 'Analyzes code for best practices and issues',
          level: 2,
          instructions: `You are an expert code reviewer...`
        }
      ]
    },

    // OpenAI configuration
    openai: {
      assistantId: 'asst_...',        // Optional: Use specific assistant
      instructions: 'You are a helpful coding assistant...'
    }
  }
});

server.start();
```

### 2. Use Agents via tRPC

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
});

// Execute agent request
const result = await client.agents.execute.mutate({
  prompt: 'Review this code for security issues',
  systemPrompt: 'You are a security expert',
  sdk: 'claude-code',              // or 'openai'
  context: {
    skills: ['code-reviewer']       // Claude Code only
  }
});

console.log(result.content);
console.log('Skills used:', result.skillsTriggered);
```

### 3. Use Agents via JSON-RPC

```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.execute",
    "params": {
      "prompt": "Explain this Python code",
      "systemPrompt": "You are a Python expert",
      "sdk": "claude-code"
    },
    "id": 1
  }'
```

## Claude Code Skills System

### Progressive Disclosure Model

Claude Code uses a three-level progressive disclosure model:

**Level 1: Metadata (~100 tokens)**
- Always loaded in system prompt
- Name and description only
- Helps agent decide when to trigger skill

**Level 2: Instructions (<5k tokens)**
- Loaded when skill is triggered
- Detailed guidance and workflows
- Best practices and examples

**Level 3: Resources (unlimited)**
- Loaded on-demand
- Scripts, files, reference materials
- Execute without consuming context

### Creating Skills

#### Programmatic Skill Creation

```typescript
const skill: AgentSkill = {
  id: 'api-designer',
  name: 'API Design Expert',
  description: 'Designs RESTful APIs following industry best practices',
  level: 2,
  instructions: `
## API Design Principles

1. **Resource-Based**: Design around resources, not actions
2. **HTTP Methods**: Use standard methods correctly (GET, POST, PUT, DELETE)
3. **Status Codes**: Return appropriate status codes
4. **Versioning**: Include version in URL or headers

## Workflow

1. Identify resources and relationships
2. Define endpoints and HTTP methods
3. Design request/response formats
4. Document with OpenAPI/Swagger
  `,
  resources: [
    {
      type: 'reference',
      path: 'https://restfulapi.net/',
      content: 'REST API best practices'
    }
  ]
};

// Add to server
await client.agents.addSkill.mutate(skill);
```

#### File-Based Skills (SKILL.md)

Create a directory with `SKILL.md`:

```
skills/
└── api-designer/
    └── SKILL.md
```

**SKILL.md Format:**
```markdown
---
name: API Design Expert
description: Designs RESTful APIs following industry best practices
level: 2
---

## API Design Principles

1. **Resource-Based**: Design around resources, not actions
2. **HTTP Methods**: Use standard methods correctly
...
```

Load from directory:
```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    claudeCode: {
      enableSkills: true,
      skillsDirectory: './skills'  // Auto-loads all SKILL.md files
    }
  }
});
```

### Skill Best Practices

1. **Start with evaluation**: Identify agent capability gaps
2. **Think from Claude's perspective**: Write metadata that helps Claude decide when to use skill
3. **Keep Level 1 concise**: Name and description under 100 tokens
4. **Structure Level 2 carefully**: Under 5k tokens, clear workflows
5. **Use Level 3 for bulk content**: Scripts, examples, reference materials

## Tool Management

### Adding Tools

Tools work with both Claude Code and OpenAI Agents:

```typescript
const searchTool: AgentTool = {
  name: 'web_search',
  description: 'Search the web for current information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      max_results: { type: 'number', description: 'Maximum results', default: 5 }
    },
    required: ['query']
  },
  execute: async (args) => {
    // Your search implementation
    return { results: [...] };
  }
};

// Add tool server-side (in custom router or server initialization)
agentService.addTool(searchTool);
```

### MCP Integration

Tools can also be exposed via MCP for Claude Desktop:

```typescript
import { createMCPTool } from 'simple-rpc-ai-backend';

newProcedure: publicProcedure
  .meta({
    mcp: createMCPTool({
      title: 'Search Web',
      description: 'Search the web for information',
      category: 'tools'
    })
  })
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input }) => {
    // Implementation
  })
```

## API Reference

### Agent Methods

#### `agents.execute`
Execute an agent request with SDK selection

```typescript
interface AgentExecuteRequest {
  prompt: string;                    // User query
  systemPrompt?: string;             // System instructions
  messages?: AgentMessage[];         // Conversation history
  sdk?: 'claude-code' | 'openai';   // SDK to use
  model?: string;                    // Model override
  provider?: string;                 // Provider override
  maxTokens?: number;
  temperature?: number;
  context?: {
    userId?: string;
    sessionId?: string;
    skills?: string[];               // Skill IDs to use (Claude only)
    tools?: AgentTool[];             // Additional tools
  };
}

interface AgentExecuteResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  sdk: 'claude-code' | 'openai';
  skillsTriggered?: string[];        // Claude Code only
  toolCalls?: Array<{...}>;
  finishReason?: string;
  requestId: string;
}
```

#### `agents.listSDKs`
Get available agent SDKs

```typescript
const { sdks, default: defaultSDK } = await client.agents.listSDKs.query();
// sdks: ['claude-code', 'openai']
// default: 'claude-code'
```

#### `agents.addSkill` / `agents.removeSkill`
Manage skills (Claude Code only)

```typescript
await client.agents.addSkill.mutate(skill);
await client.agents.removeSkill.mutate({ skillId: 'api-designer' });
```

#### `agents.listSkills`
List all skills

```typescript
const { skills, count } = await client.agents.listSkills.query();
```

#### `agents.addTool` / `agents.removeTool`
Manage tools

```typescript
await client.agents.addTool.mutate(tool);
await client.agents.removeTool.mutate({ name: 'web_search' });
```

#### `agents.listTools`
List available tools

```typescript
const { tools, count } = await client.agents.listTools.query({ sdk: 'claude-code' });
```

## Examples

### Example 1: Code Review Agent with Skills

```typescript
// Configure server with code review skill
const server = createRpcAiServer({
  agents: {
    enabled: true,
    claudeCode: {
      enableSkills: true,
      defaultSkills: [{
        id: 'security-reviewer',
        name: 'Security Review',
        description: 'Reviews code for security vulnerabilities',
        level: 2,
        instructions: `
          Analyze code for:
          - SQL injection risks
          - XSS vulnerabilities
          - Authentication issues
          - Sensitive data exposure
          - Dependency vulnerabilities
        `
      }]
    }
  }
});

// Use the agent
const result = await client.agents.execute.mutate({
  prompt: `Review this authentication code:

    app.post('/login', (req, res) => {
      const query = "SELECT * FROM users WHERE email = '" + req.body.email + "'";
      db.query(query, (err, results) => {
        // ... handle results
      });
    });
  `,
  systemPrompt: 'You are a security expert. Use the Security Review skill.',
  sdk: 'claude-code'
});

console.log(result.content);
// "⚠️ SQL Injection Vulnerability Detected..."
```

### Example 2: Multi-Turn Conversation

```typescript
const messages: AgentMessage[] = [];

// Turn 1
let result = await client.agents.execute.mutate({
  prompt: 'Explain REST APIs',
  messages,
  sdk: 'claude-code'
});

messages.push(
  { role: 'user', content: 'Explain REST APIs' },
  { role: 'assistant', content: result.content }
);

// Turn 2
result = await client.agents.execute.mutate({
  prompt: 'Now show me an example',
  messages,
  sdk: 'claude-code'
});
```

### Example 3: Custom Tool Integration

```typescript
// Define custom tool
const codeAnalyzerTool: AgentTool = {
  name: 'analyze_complexity',
  description: 'Analyze code complexity metrics',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string' }
    },
    required: ['code']
  },
  execute: async ({ code, language }) => {
    // Run complexity analysis
    return {
      cyclomaticComplexity: 5,
      cognitiveComplexity: 8,
      linesOfCode: 42
    };
  }
};

// Add to agent service (server-side)
agentService.addTool(codeAnalyzerTool);

// Use in agent request
const result = await client.agents.execute.mutate({
  prompt: 'Analyze the complexity of this code: function foo() { ... }',
  sdk: 'claude-code',
  context: {
    tools: [codeAnalyzerTool]
  }
});
```

## Configuration Options

### Server Configuration

```typescript
interface AgentConfig {
  enabled?: boolean;                      // Enable agents (default: false)
  defaultSDK?: 'claude-code' | 'openai'; // Default SDK (default: 'claude-code')
  enableClaudeCode?: boolean;             // Enable Claude Code (default: true)
  enableOpenAI?: boolean;                 // Enable OpenAI (default: true)

  claudeCode?: {
    enableSkills?: boolean;               // Enable skills (default: true)
    skillsDirectory?: string;             // Load skills from directory
    defaultSkills?: AgentSkill[];         // Pre-configured skills
  };

  openai?: {
    assistantId?: string;                 // OpenAI Assistant ID
    instructions?: string;                // Default instructions
  };
}
```

### Environment Variables

```bash
# AI Provider Keys (reused from existing configuration)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional: OpenAI Assistant ID
OPENAI_ASSISTANT_ID=asst_...
```

## Best Practices

1. **Skill Design**: Follow progressive disclosure (Level 1 → 2 → 3)
2. **Tool Naming**: Use clear, descriptive names with underscores
3. **Error Handling**: Implement robust error handling in tool execute functions
4. **Context Management**: Reuse conversation history for multi-turn interactions
5. **SDK Selection**: Use Claude Code for complex workflows with skills, OpenAI for simpler tasks
6. **Security**: Validate tool inputs and sanitize outputs
7. **Performance**: Monitor token usage and optimize system prompts

## Troubleshooting

### Skills Not Loading

```typescript
// Check if skills are enabled
const config = await client.agents.getConfig.query();
console.log('Skills enabled:', config.claudeCode?.enableSkills);

// List available skills
const { skills } = await client.agents.listSkills.query();
console.log('Available skills:', skills);
```

### SDK Not Available

```typescript
// Check SDK availability
const available = await client.agents.isSDKAvailable.query({ sdk: 'claude-code' });
if (!available) {
  console.error('SDK not initialized - check server configuration');
}
```

### Agent Execution Fails

```typescript
try {
  const result = await client.agents.execute.mutate({...});
} catch (error) {
  console.error('Agent execution failed:', error);
  // Check:
  // 1. AI provider API keys configured
  // 2. SDK is initialized (enableClaudeCode/enableOpenAI)
  // 3. Model restrictions don't block the model
}
```

## Roadmap

- [ ] Streaming support for agent responses
- [ ] Skill marketplace/repository
- [ ] Advanced tool chaining
- [ ] Multi-agent collaboration
- [ ] Agent memory/state persistence
- [ ] Performance monitoring dashboard

## References

- [Claude Agent Skills Documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Anthropic Engineering Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [OpenAI Agents Documentation](https://platform.openai.com/docs/agents)

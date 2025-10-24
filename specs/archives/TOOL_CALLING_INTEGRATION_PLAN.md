# Tool Calling Integration Plan for Skills

## Current State

✅ **AIService already supports tool calling!**
- Line 505-514: Tools are added to `generateOptions.tools`
- Line 531-545: Tool calls are executed via `executeToolCalls()`
- Tool format: `{ name, description, parameters }` (JSON Schema)

## What's Missing

The agent adapter doesn't pass tools to AIService. Skills exist but aren't converted to callable tools.

## Implementation Plan

### Step 1: Extend ExecuteRequest Interface

**File**: `src/services/ai/ai-service.ts`

```typescript
export interface ExecuteRequest {
  content: string;
  promptId?: string;
  systemPrompt?: string;
  // ADD THIS:
  tools?: Array<{
    name: string;
    description: string;
    parameters: any; // JSON Schema
    execute?: (args: any) => Promise<any>; // Optional execution function
  }>;
  metadata?: {
    // ... existing fields
  };
  options?: {
    // ... existing fields
  };
  apiKey?: string;
}
```

### Step 2: Modify prepareAIExecution

**File**: `src/services/ai/ai-service.ts` (line 942)

```typescript
private async prepareAIExecution(
  systemPrompt: string,
  executionConfig: any,
  customTools?: any[] // ADD THIS parameter
): Promise<{ enhancedSystemPrompt: string; availableTools: any[] }> {
  let enhancedSystemPrompt = systemPrompt;
  let availableTools: any[] = [];

  // ADD: Include custom tools first
  if (customTools && customTools.length > 0) {
    availableTools = [...customTools];
  }

  // ... rest of existing logic for web search tools

  return { enhancedSystemPrompt, availableTools };
}
```

### Step 3: Pass Custom Tools in execute()

**File**: `src/services/ai/ai-service.ts` (line 484)

```typescript
const { enhancedSystemPrompt, availableTools } = await this.prepareAIExecution(
  systemPrompt,
  executionConfig,
  request.tools // ADD THIS - pass custom tools
);
```

### Step 4: Create Skill-to-Tool Converter

**New File**: `src/services/agents/skills/tools-converter.ts`

```typescript
import { SkillManager } from './manager';

export class SkillsToolConverter {
  constructor(private skillManager: SkillManager) {}

  /**
   * Convert skill scripts to AI SDK tool format
   */
  convertSkillsToTools(skillIds?: string[]): Array<{
    name: string;
    description: string;
    parameters: any;
    execute: (args: any) => Promise<any>;
  }> {
    const skills = skillIds
      ? skillIds.map(id => this.skillManager.getSkill(id)).filter(Boolean)
      : this.skillManager.listSkills().skills;

    const tools: any[] = [];

    for (const skill of skills) {
      if (!skill.scripts) continue;

      // Convert each script to a tool
      for (const script of skill.scripts) {
        tools.push({
          name: `${skill.id}_${script.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          description: `${skill.description} - ${script.description}`,
          parameters: {
            type: 'object',
            properties: {
              args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Script arguments'
              }
            }
          },
          execute: async (toolArgs: any) => {
            const result = await this.skillManager.executeScript(skill.id, {
              scriptName: script.path,
              args: toolArgs.args || []
            });
            return {
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr
            };
          }
        });
      }
    }

    return tools;
  }
}
```

### Step 5: Update Agent Adapter

**File**: `src/services/agents/adapters/ai-agent-adapter.ts`

```typescript
import { SkillsToolConverter } from '../skills/tools-converter';

export class AIAgentAdapter implements IAgentAdapter {
  private skillsToolConverter?: SkillsToolConverter;

  async initialize(): Promise<void> {
    // ... existing initialization

    // ADD: Initialize skills tool converter if skills are available
    if (this.skillsManager) {
      this.skillsToolConverter = new SkillsToolConverter(this.skillsManager);
    }
  }

  async execute(request: AgentExecuteRequest): Promise<AgentExecuteResult> {
    // ... existing code

    // ADD: Convert skills to tools
    let tools: any[] = request.context?.tools || [];

    if (this.skillsToolConverter && request.context?.skills) {
      const skillTools = this.skillsToolConverter.convertSkillsToTools(
        request.context.skills.map(s => s.id)
      );
      tools = [...tools, ...skillTools];
    }

    // Execute AI request with tools
    const result = await this.aiService.execute({
      content: request.prompt,
      systemPrompt: systemPrompt,
      tools: tools.length > 0 ? tools : undefined, // ADD THIS
      metadata: {
        provider: request.provider || 'anthropic',
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature
      }
    });
  }
}
```

### Step 6: Handle Tool Execution in AIService

**File**: `src/services/ai/ai-service.ts` (line 1112)

```typescript
private async executeToolCalls(toolCalls: any[], customTools?: any[]): Promise<any[]> {
  const toolResults: any[] = [];

  for (const toolCall of toolCalls) {
    logger.debug(`🔧 Executing tool: ${toolCall.toolName}`);

    try {
      let result;

      // ADD: Check if it's a custom tool first
      const customTool = customTools?.find(t => t.name === toolCall.toolName);
      if (customTool && customTool.execute) {
        result = await customTool.execute(toolCall.args);
      } else if (this.mcpService) {
        // Execute via MCP service
        const mcpResult = await this.mcpService.executeToolForAI({
          name: toolCall.toolName,
          arguments: toolCall.args
        });
        result = mcpResult.success ? mcpResult.result : { error: mcpResult.error };
      } else {
        result = { error: 'No tool execution handler available' };
      }

      toolResults.push({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        result: JSON.stringify(result)
      });
    } catch (error) {
      // ... error handling
    }
  }

  return toolResults;
}
```

## Testing Plan

1. **Unit Test**: Skill to tool conversion
2. **Integration Test**: Agent execution with skill tools
3. **E2E Test**: Natural language "List files in examples" → Tool call → Results

## Expected Behavior After Implementation

```
You: What files are in the examples folder?

[AI generates tool call]
Tool: file-handling_scripts_search_files_ts
Args: { args: ["*", "examples"] }

[Server executes skill script]
Result: { exitCode: 0, stdout: "01-basic-server\n02-mcp-server\n..." }

Agent: The examples folder contains:
- 01-basic-server/
- 02-mcp-server/
- 03-agents-basic/
...
```

## Files to Modify

1. ✅ `src/services/ai/ai-service.ts` - Add tools to ExecuteRequest, pass to prepareAIExecution, handle custom tool execution
2. ✅ `src/services/agents/skills/tools-converter.ts` - NEW: Convert skills to tools
3. ✅ `src/services/agents/adapters/ai-agent-adapter.ts` - Use converter, pass tools to AIService
4. ✅ `src/trpc/routers/agents/index.ts` - No changes needed (context.skills already supported)
5. ✅ `tools/simple-agent/src/components/App.tsx` - Already passing skills in context

## Estimated Effort

- **Code Changes**: ~200 lines across 3 files
- **Testing**: 30-60 minutes
- **Total**: 2-3 hours

This will enable full natural language skill invocation! 🎉

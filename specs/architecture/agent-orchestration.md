# Agent Orchestration Architecture

## Overview

This document defines the architecture for the agent system, including the main agent, sub-agents, skill integration, and orchestration patterns.

---

## Core Concepts

### 1. Main Agent (Coordinator)

The **main agent** is the primary AI agent that:
- Receives user requests
- Coordinates sub-agents and skills
- Maintains conversation context
- Makes high-level decisions
- Returns final responses to users

**Built-in Skill:** `main-agent`
- Type: Built-in system skill
- Purpose: Defines core agentic behavior
- Location: `src/services/agents/skills/builtin/main-agent/`

### 2. Sub-Agents (Specialists)

**Sub-agents** are skill-based agents that:
- Execute specific tasks in parallel
- Have specialized capabilities
- Run independently
- Report results back to main agent

**Key Principle:** Each skill CAN become a sub-agent when needed.

### 3. Skills (Tools)

Skills are:
- Executable capabilities (scripts, tools, prompts)
- Discoverable via metadata
- Progressive disclosure (3 levels)
- Can be used by any agent

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN AGENT                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ main-agent skill (built-in system prompt)                │   │
│  │ - Agentic reasoning                                      │   │
│  │ - Skill discovery & selection                            │   │
│  │ - Sub-agent orchestration                                │   │
│  │ - Permission management                                  │   │
│  │ - Tool usage coordination                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  User-configured system prompt + main-agent behavior            │
└────┬────────────────────────┬────────────────────────┬──────────┘
     │                        │                        │
     ▼                        ▼                        ▼
┌─────────┐            ┌─────────┐             ┌─────────┐
│ Skill 1 │            │ Skill 2 │             │ Skill N │
│ (Tool)  │            │(Sub-Ag) │             │ (Tool)  │
└─────────┘            └────┬────┘             └─────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Sandbox      │
                    │  Execution    │
                    └───────────────┘
```

---

## Main Agent Skill: System Prompt Design

### Minimal Default System Prompt

**Philosophy:** Start minimal, let users customize.

**Default Prompt** (`main-agent/SKILL.md`):

```markdown
# Main Agent

You are an AI agent with access to skills and tools.

## Core Responsibilities

1. **Understand** user requests thoroughly
2. **Discover** available skills using `agents.skills.list` and `agents.skills.match`
3. **Execute** appropriate skills to complete tasks
4. **Coordinate** multiple skills when needed
5. **Report** results clearly to the user

## Skill Usage

- List skills: Use `agents.skills.list` to see all available capabilities
- Find skills: Use `agents.skills.match({ capabilities: [...] })` to find specific skills
- Get details: Use `agents.skills.get({ skillId })` for full instructions
- Execute: Use `agents.skills.executeScript({ skillId, scriptName, args })`

## Best Practices

- Always verify skill availability before use
- Handle execution errors gracefully
- Provide clear explanations of actions taken
- Ask for clarification when uncertain

## Constraints

- Respect skill sandbox restrictions
- Follow allowed paths: /workspace, /tmp
- Honor timeout limits (default: 30s)
- Report security violations
```

**Token Count:** ~200 tokens (minimal overhead)

### Extended System Prompt Integration

Users can extend the main agent with custom behavior:

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    systemPrompt: {
      type: 'extend', // or 'replace'
      promptId: 'custom-agent-behavior',
      content: `
# Custom Agent Behavior

You are a brand compliance agent. Always:
- Check brand guidelines before creating content
- Use brand-guidelines skill for color/font validation
- Maintain consistent tone and style
      `
    }
  }
});
```

**Merge Strategy:**
- `extend`: main-agent prompt + custom prompt
- `replace`: custom prompt only (advanced users)

---

## Sub-Agent Orchestration Patterns

### Pattern 1: Sequential Execution

Main agent executes skills one after another.

```
User: "Validate this JSON, then greet the user"

Main Agent:
  1. Execute validate-json.ts → Result A
  2. Execute greet.ts → Result B
  3. Combine results → Final response
```

**Use Case:** Dependencies between tasks

### Pattern 2: Parallel Execution

Main agent spawns multiple sub-agents simultaneously.

```
User: "Check brand compliance for colors, fonts, and images"

Main Agent:
  ├─ Sub-Agent 1: validate-colors.ts (parallel)
  ├─ Sub-Agent 2: validate-fonts.ts (parallel)
  └─ Sub-Agent 3: validate-images.ts (parallel)

  Wait for all → Combine results → Report
```

**Use Case:** Independent, parallelizable tasks

**Implementation:**
```typescript
const results = await Promise.all([
  skillManager.executeScript({ skillId: 'brand-guidelines', scriptName: 'validate-colors.ts', args: [file] }),
  skillManager.executeScript({ skillId: 'brand-guidelines', scriptName: 'validate-fonts.ts', args: [file] }),
  skillManager.executeScript({ skillId: 'brand-guidelines', scriptName: 'validate-images.ts', args: [file] })
]);
```

### Pattern 3: Conditional Branching

Main agent decides which skills to use based on intermediate results.

```
User: "Process this file"

Main Agent:
  1. Detect file type → JSON
  2. IF JSON → validate-json.ts
  3. IF valid → transform-data.ts
  4. ELSE → report error
```

**Use Case:** Decision trees, error handling

### Pattern 4: Iterative Refinement

Main agent repeatedly executes skills until goal met.

```
User: "Optimize this image until < 100KB"

Main Agent:
  WHILE file_size > 100KB:
    1. Execute compress-image.ts
    2. Check size
    3. Adjust quality if needed

  Report final result
```

**Use Case:** Optimization, iterative improvement

---

## Sub-Agent Implementation

### Skill-Based Sub-Agents

Every skill CAN be a sub-agent. The main agent decides:

**As Tool (Direct):**
```typescript
// Main agent executes skill directly
const result = await skillManager.executeScript({
  skillId: 'hello-world',
  scriptName: 'greet.ts',
  args: ['Alice']
});
```

**As Sub-Agent (Autonomous):**
```typescript
// Sub-agent gets its own AI context
const subAgent = await agentOrchestrator.createSubAgent({
  skillId: 'brand-guidelines',
  goal: 'Validate all brand compliance',
  context: { file: '/workspace/design.html' }
});

const result = await subAgent.execute();
```

### Sub-Agent Characteristics

**Autonomous:**
- Has own AI context
- Makes decisions within skill scope
- Can call multiple scripts from same skill
- Reports results back to main agent

**Constrained:**
- Limited to skill's capabilities
- Inherits skill's sandbox restrictions
- Cannot create other sub-agents (no recursion by default)

---

## Orchestration Best Practices

### 1. Main Agent as Coordinator

**✅ DO:**
- Main agent decides task decomposition
- Main agent manages dependencies
- Main agent aggregates results

**❌ DON'T:**
- Sub-agents shouldn't coordinate other sub-agents (avoid deep nesting)
- Skills shouldn't spawn agents (use scripts only)

### 2. Parallel vs Sequential

**Parallel when:**
- Tasks are independent
- No shared state
- Time-sensitive (performance)

**Sequential when:**
- Tasks depend on previous results
- Shared state modification
- Order matters

### 3. Error Handling

**Main agent should:**
- Catch sub-agent failures
- Retry with different approach
- Report clear errors to user
- Maintain conversation context even on failure

### 4. Resource Management

**Limits:**
- Max 5 parallel sub-agents (configurable)
- Shared timeout pool (sum of all agents <= total timeout)
- Memory limits apply to all agents combined

---

## Configuration

### Server Configuration

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,

    // Main agent configuration
    mainAgent: {
      skillId: 'main-agent',        // Built-in skill
      systemPromptId: 'default',    // Or custom ID
      extendSystemPrompt: true       // Merge with user prompt
    },

    // Sub-agent configuration
    subAgents: {
      enabled: true,
      maxParallel: 5,
      maxDepth: 1,                   // No nested sub-agents by default
      sharedTimeoutPool: true
    },

    // Skills configuration
    skills: {
      enabled: true,
      sources: [
        { type: 'builtin', name: 'main-agent' },  // Required
        { type: 'builtin', name: 'file-handling' },
        { type: 'local', path: './skills/custom' }
      ],
      sandbox: {
        allowedPaths: ['/workspace', '/tmp'],
        timeout: 30000,
        maxMemory: 512 * 1024 * 1024
      }
    }
  }
});
```

### System Prompt Configuration

```typescript
// Default (minimal)
systemPromptId: 'default'  // Uses main-agent/SKILL.md only (~200 tokens)

// Extended (user adds to main-agent)
systemPrompt: {
  type: 'extend',
  content: 'Custom agent behavior...'
}

// Replaced (advanced users)
systemPrompt: {
  type: 'replace',
  content: 'Completely custom agent system prompt...'
}

// From configuration service
systemPromptId: 'brand-compliance-agent'  // Loads from systemPrompts config
```

---

## Implementation Roadmap

### Phase 1: Main Agent Skill (Current Focus)
- [x] Create `main-agent` built-in skill
- [x] Define minimal default system prompt
- [x] Implement system prompt extension
- [x] Add configuration options

### Phase 2: Orchestration Layer
- [ ] Create `AgentOrchestrator` class
- [ ] Implement parallel execution
- [ ] Add error handling and retries
- [ ] Resource management (limits)

### Phase 3: Sub-Agent System
- [ ] Skill-to-sub-agent conversion
- [ ] Autonomous execution context
- [ ] Result aggregation
- [ ] Nested execution control

### Phase 4: Advanced Features
- [ ] Conditional branching
- [ ] Iterative refinement
- [ ] Multi-turn sub-agent conversations
- [ ] Performance optimization

---

## Security Considerations

### 1. Permission Model

**Main Agent:**
- Full access to all skills
- Can create sub-agents
- Inherits user permissions

**Sub-Agents:**
- Limited to skill's declared capabilities
- Sandbox restrictions enforced
- Cannot escalate permissions

### 2. Resource Limits

- Timeout: 30s per skill (default), 300s total (configurable)
- Memory: 512MB per sandbox, 2GB total (configurable)
- Parallel: Max 5 sub-agents
- Depth: Max 1 level (no recursive sub-agents)

### 3. Audit Trail

All agent actions logged:
- Skill selections
- Sub-agent creations
- Execution results
- Error conditions

---

## Examples

### Example 1: Simple Skill Usage

```typescript
// User: "Greet Alice"
// Main agent uses skill directly

const result = await client.ai.generateText.mutate({
  content: "Greet Alice",
  enableSkills: true
});

// Main agent internally:
// 1. agents.skills.match({ capabilities: ['greeting'] })
// 2. agents.skills.executeScript({ skillId: 'hello-world', scriptName: 'greet.ts', args: ['Alice'] })
// 3. Return result to user
```

### Example 2: Parallel Sub-Agents

```typescript
// User: "Validate all brand compliance for design.html"
// Main agent creates parallel sub-agents

const result = await client.ai.generateText.mutate({
  content: "Validate all brand compliance for /workspace/design.html",
  enableSkills: true
});

// Main agent internally:
// 1. Identify skill: brand-guidelines
// 2. Create sub-agents:
//    - Sub-agent A: validate-colors.ts
//    - Sub-agent B: validate-fonts.ts
//    - Sub-agent C: validate-layout.ts
// 3. Execute in parallel
// 4. Aggregate results
// 5. Report to user
```

### Example 3: Sequential with Dependencies

```typescript
// User: "Process the data file: validate, transform, save"

// Main agent internally:
// 1. validate-json.ts → valid=true
// 2. IF valid → transform-data.ts → transformed
// 3. IF transformed → save-file.ts → saved
// 4. Report complete workflow
```

---

## Conclusion

The agent orchestration architecture provides:

✅ **Minimal Default:** ~200 token system prompt
✅ **Extensible:** Users can customize behavior
✅ **Flexible:** Skills as tools OR sub-agents
✅ **Safe:** Sandboxed, limited, audited
✅ **Scalable:** Parallel execution support
✅ **Simple:** Main agent coordinates everything

**Next Steps:** Implement `main-agent` skill, then build orchestration layer.

---
name: agent-creator
description: Create and orchestrate specialized AI sub-agents that can work together to accomplish complex tasks. This skill helps design agents with specific roles, knowledge, and tools that can collaborate through various patterns like sequential, parallel, or supervisor workflows.
version: 1.0.0
author: Simple RPC AI Backend Team
license: MIT
capabilities:
  - agent-creation
  - agent-orchestration
  - task-delegation
  - multi-agent-workflows
scripts:
  - path: scripts/create-agent.ts
    runtime: typescript
    description: Create a new sub-agent with specific role, tools, and knowledge
    args:
      - name: role
        description: The role or purpose of the agent (e.g., "code-reviewer", "data-analyst", "documentation-writer")
        type: string
        required: true
      - name: tools
        description: Comma-separated list of tools the agent should have access to
        type: string
      - name: knowledge
        description: Specific knowledge or instructions to give the agent
        type: string
  - path: scripts/orchestrate-agents.ts
    runtime: typescript
    description: Coordinate multiple agents to work together on a task
    args:
      - name: workflow
        description: The workflow pattern to use (sequential, parallel, supervisor)
        type: string
        enum: ["sequential", "parallel", "supervisor", "round-robin"]
        required: true
      - name: agents
        description: Comma-separated list of agent IDs to coordinate
        type: string
        required: true
      - name: task
        description: The task to delegate to the agents
        type: string
        required: true
  - path: scripts/validate-agent.ts
    runtime: typescript
    description: Validate an agent's configuration and capabilities
    args:
      - name: agentId
        description: ID of the agent to validate
        type: string
        required: true
---
# Agent Creator Skill

## Purpose

This skill enables the creation and orchestration of specialized sub-agents that work together to accomplish complex tasks. It implements various multi-agent patterns from the AI SDK including sequential workflows, parallel processing, supervisor patterns, and task delegation.

## Core Operations

### Creating Sub-Agents

To create a new specialized agent:
```bash
tsx scripts/create-agent.ts --role "code-reviewer" --tools "file-handling,git-commit-helper" --knowledge "You are an expert code reviewer. Focus on security issues, performance, and maintainability."
```

### Coordinating Agent Workflows

Coordinate multiple agents using different patterns:

**Sequential Workflow** (one agent after another):
```bash
tsx scripts/orchestrate-agents.ts --workflow sequential --agents "researcher,summarizer,editor" --task "Create a technical article about AI safety"
```

**Parallel Processing** (multiple agents work simultaneously):
```bash
tsx scripts/orchestrate-agents.ts --workflow parallel --agents "analyst1,analyst2,analyst3" --task "Analyze different aspects of the quarterly report"
```

**Supervisor Pattern** (one agent coordinates others):
```bash
tsx scripts/orchestrate-agents.ts --workflow supervisor --agents "project-manager,researcher,writer,reviewer" --task "Complete a research project"
```

**Round-Robin** (tasks distributed among agents cyclically):
```bash
tsx scripts/orchestrate-agents.ts --workflow round-robin --agents "qa1,qa2,qa3" --task "Test the new features"
```

### Validating Agents

Check an agent's configuration:
```bash
tsx scripts/validate-agent.ts --agentId "code-reviewer"
```

## Agent Patterns Implementation

### Sequential Workflow
- Agents execute in a defined order
- Each agent's output becomes the next agent's input
- Useful for multi-step processes where each step depends on the previous

### Parallel Processing
- Multiple agents work on different parts of a task simultaneously
- Results are aggregated when all agents complete their work
- Useful for tasks that can be divided into independent subtasks

### Supervisor Pattern
- One supervisor agent coordinates specialized worker agents
- Supervisor delegates tasks and aggregates results
- Useful for complex tasks requiring different expertise areas

### Task Delegation
- Agents can delegate subtasks to other specialized agents
- Enables dynamic task routing based on capabilities
- Allows for flexible and efficient resource utilization

## Built-in Agent Types

### Pre-defined Agent Roles
- `researcher`: Specialized for information gathering and analysis
- `writer`: Focused on content creation and documentation
- `reviewer`: Designed for quality assurance and validation
- `analyst`: Optimized for data analysis and insights
- `manager`: Coordinating and supervising other agents
- `code-assistant`: Focused on coding tasks and code reviews
- `planner`: Specialized in planning and scheduling

## Security Guidelines

1. **Agent Permissions**: Each agent has limited access based on its role
2. **Tool Access**: Agents can only use tools they are explicitly granted
3. **Knowledge Boundaries**: Agents operate within defined knowledge parameters
4. **Task Validation**: All orchestrated tasks are validated before execution
5. **Result Verification**: Outputs from multi-agent workflows are verified for consistency

## Example Usage

**Create a specialized agent:**
```
Create a research agent that can analyze market trends and generate reports
```

**Orchestrate agents for a complex task:**
```
Use a researcher agent to gather data, a data analyst agent to process it, and a writer agent to create a report
```

## Error Handling

Agents return:
- Exit code 0: Success
- Exit code 1: Validation error (invalid configuration, unauthorized access)
- Exit code 2: Execution error (failed to complete task, timeout)
- Exit code 3: Communication error (failed to coordinate with other agents)

## Best Practices

1. Define clear roles and responsibilities for each agent
2. Choose the appropriate workflow pattern for your task
3. Validate agent configurations before deployment
4. Monitor agent coordination and handle failures gracefully
5. Use supervisor patterns for complex, multi-step tasks
6. Implement proper fallback mechanisms for agent failures
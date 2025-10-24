# Agent Creator Skill - Manual Test Plan

## Overview
This document outlines the manual test plan for the agent-creator skill, which enables the creation and orchestration of specialized AI sub-agents that can work together to accomplish complex tasks.

## Test Environment Setup

### Prerequisites
- Node.js 18+ installed
- pnpm installed
- Simple RPC AI backend running
- Access to the agent creator skill scripts in `src/services/agents/skills/builtin/agent-creator/scripts/`

### Setup Steps
1. Clone the repository: `git clone <repo-url>`
2. Install dependencies: `pnpm install`
3. Start the backend server: `pnpm dev:server`
4. Ensure TypeScript is available: `npm install -g tsx`

## Test Cases

### 1. Create-Agent Functionality

#### 1.1 Basic Agent Creation
- **Objective**: Verify that agents can be created with a role
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "test-agent"`
  2. Observe the output
- **Expected Result**: 
  - Agent is created with a unique ID
  - Success message is returned in JSON format
  - Agent object contains all required fields (id, role, tools, createdAt)

#### 1.2 Agent Creation with Tools
- **Objective**: Verify that agents can be created with specified tools
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "code-analyzer" --tools "file-handling,git-commit-helper"`
  2. Observe the output
- **Expected Result**:
  - Agent is created with specified tools
  - Tools array contains the correct values
  - Success message includes agent details

#### 1.3 Agent Creation with Knowledge
- **Objective**: Verify that agents can be created with specific knowledge
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "documentation-writer" --knowledge "You are an expert technical writer. Focus on clarity and readability."`
  2. Observe the output
- **Expected Result**:
  - Agent is created with the specified knowledge
  - Knowledge field contains the provided text
  - Success message includes agent details

#### 1.4 Agent Creation with All Parameters
- **Objective**: Verify that agents can be created with all parameters
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "security-analyst" --tools "file-handling,skill-creator" --knowledge "Specialized in security analysis and vulnerability detection"`
  2. Observe the output
- **Expected Result**:
  - Agent is created with all specified parameters
  - All fields (role, tools, knowledge) are correctly set
  - Success message includes complete agent details

#### 1.5 Error Handling - Missing Role
- **Objective**: Verify proper error handling when role is missing
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts`
  2. Observe the output
- **Expected Result**:
  - Error message indicating that role is required
  - Process exits with code 1
  - Error message in JSON format

#### 1.6 Error Handling - Invalid Parameters
- **Objective**: Verify proper error handling for invalid parameters
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --invalid-param "value"`
  2. Observe the output
- **Expected Result**:
  - Error message about required parameters
  - Process exits with appropriate error code

### 2. Orchestrate-Agents Functionality

#### 2.1 Sequential Workflow
- **Objective**: Verify sequential workflow execution
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow sequential --agents "researcher-1,writer-1" --task "Create a summary of AI trends"`
  2. Observe the output
- **Expected Result**:
  - Workflow executes agents in sequential order
  - Each agent processes the output of the previous agent
  - Results are returned in the correct sequence
  - Success message includes workflow details and results

#### 2.2 Parallel Workflow
- **Objective**: Verify parallel workflow execution
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow parallel --agents "analyst-1,researcher-1" --task "Analyze the market"`
  2. Observe the output
- **Expected Result**:
  - All agents execute simultaneously
  - Results from all agents are collected
  - Success message includes results from all agents

#### 2.3 Supervisor Workflow
- **Objective**: Verify supervisor workflow execution
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow supervisor --agents "manager-1,analyst-1,researcher-1" --task "Prepare quarterly report"`
  2. Observe the output
- **Expected Result**:
  - First agent acts as supervisor
  - Supervisor delegates tasks to other agents
  - Results are aggregated and synthesized by supervisor
  - Success message includes supervisor's synthesized output

#### 2.4 Round-Robin Workflow
- **Objective**: Verify round-robin workflow execution
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow round-robin --agents "qa1-1,qa2-1,qa3-1" --task "Test the new features"`
  2. Observe the output
- **Expected Result**:
  - Tasks are distributed cyclically among agents
  - Each agent receives a portion of the task
  - Results from all agents are collected

#### 2.5 Error Handling - Invalid Workflow Type
- **Objective**: Verify error handling for invalid workflow types
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow invalid-type --agents "test1,test2" --task "test"`
  2. Observe the output
- **Expected Result**:
  - Error message indicating invalid workflow type
  - Process exits with code 1 or 2
  - Error details in JSON format

#### 2.6 Error Handling - No Agents Specified
- **Objective**: Verify error handling when no agents are specified
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow sequential --task "test"`
  2. Observe the output
- **Expected Result**:
  - Error message indicating agents are required
  - Process exits with code 1
  - Error details in JSON format

#### 2.7 Supervisor Pattern - Insufficient Agents
- **Objective**: Verify error handling for supervisor pattern with insufficient agents
- **Steps**:
  1. Execute: `tsx scripts/orchestrate-agents.ts --workflow supervisor --agents "single-agent" --task "test"`
  2. Observe the output
- **Expected Result**:
  - Error message indicating supervisor pattern requires at least 2 agents
  - Process exits with appropriate error code

### 3. Validate-Agent Functionality

#### 3.1 Valid Agent Validation
- **Objective**: Verify that valid agents can be validated successfully
- **Steps**:
  1. Execute: `tsx scripts/validate-agent.ts --agentId "researcher-1"`
  2. Observe the output
- **Expected Result**:
  - Agent details are returned
  - Success message indicates validation passed
  - No validation errors or warnings

#### 3.2 Agent with Warnings Validation
- **Objective**: Verify that agents with warnings are validated correctly
- **Steps**:
  1. Execute: `tsx scripts/validate-agent.ts --agentId "analyst-1"` (if it has no knowledge)
  2. Observe the output
- **Expected Result**:
  - Agent details are returned
  - Success message indicates validation passed
  - Warnings are included in the response

#### 3.3 Non-existent Agent Validation
- **Objective**: Verify error handling for non-existent agents
- **Steps**:
  1. Execute: `tsx scripts/validate-agent.ts --agentId "non-existent-agent"`
  2. Observe the output
- **Expected Result**:
  - Error message indicating agent not found
  - Process exits with code 1
  - Error details in JSON format

#### 3.4 Invalid Agent ID Format
- **Objective**: Verify error handling for invalid agent ID formats
- **Steps**:
  1. Execute: `tsx scripts/validate-agent.ts --agentId ""`
  2. Observe the output
- **Expected Result**:
  - Error message indicating the agent does not exist
  - Process exits with appropriate error code

### 4. Integration Tests

#### 4.1 Full Workflow Test
- **Objective**: Verify end-to-end workflow using all agent-creator functions
- **Steps**:
  1. Create a new agent: `tsx scripts/create-agent.ts --role "report-writer" --tools "file-handling" --knowledge "Specialized in creating detailed reports"`
  2. Note the created agent ID
  3. Validate the agent: `tsx scripts/validate-agent.ts --agentId "[created-agent-id]"`
  4. Orchestrate with other agents: `tsx scripts/orchestrate-agents.ts --workflow sequential --agents "[created-agent-id],researcher-1" --task "Create a market analysis report"`
  5. Observe the outputs from each step
- **Expected Result**:
  - Agent is successfully created
  - Agent is successfully validated
  - Orchestration completes successfully with expected results

#### 4.2 Error Recovery Test
- **Objective**: Verify the system handles errors gracefully and recovers properly
- **Steps**:
  1. Execute invalid command: `tsx scripts/orchestrate-agents.ts --workflow invalid --agents "test" --task "test"`
  2. Execute valid command: `tsx scripts/validate-agent.ts --agentId "researcher-1"`
  3. Confirm the valid command works after the error
- **Expected Result**:
  - Invalid command returns proper error
  - Valid command works correctly after the error
  - No state pollution between commands

### 5. Edge Cases

#### 5.1 Maximum Agent Name Length
- **Objective**: Test agent creation with very long role names
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "very-long-agent-role-name-that-exceeds-normal-parameters"`
  2. Observe the output
- **Expected Result**:
  - Agent is created successfully
  - Agent ID is properly generated from the long role name

#### 5.2 Empty Tools List
- **Objective**: Test agent creation with an empty tools list
- **Steps**:
  1. Execute: `tsx scripts/create-agent.ts --role "observer-agent" --tools ""`
  2. Validate the created agent
  3. Observe the validation output
- **Expected Result**:
  - Agent is created with empty tools array
  - Validation may return warnings about missing tools
  - No critical errors

#### 5.3 Large Task Description
- **Objective**: Test orchestration with a very long task description
- **Steps**:
  1. Create a long task string (e.g., 500+ characters)
  2. Execute: `tsx scripts/orchestrate-agents.ts --workflow parallel --agents "researcher-1,analyst-1" --task "[long-task-description]"`
  3. Observe the output
- **Expected Result**:
  - Orchestration executes successfully
  - Task is properly passed to agents
  - Results are returned without truncation issues

## Test Execution Checklist

- [ ] All basic functionality tests pass
- [ ] All error handling tests work correctly
- [ ] Integration tests complete successfully
- [ ] Edge case tests handle appropriately
- [ ] JSON output format is consistent across all scripts
- [ ] Error codes are correct (0 for success, 1 for validation errors, 2 for execution errors)
- [ ] Agent IDs are properly generated and unique
- [ ] Workflow patterns execute as expected
- [ ] Validation correctly identifies valid and invalid agents

## Expected Outcomes

Upon successful completion of this test plan:
- The agent-creator skill can reliably create specialized agents with specific roles, tools, and knowledge
- Multiple workflow patterns (sequential, parallel, supervisor, round-robin) execute correctly
- Agent validation properly assesses agent configurations
- Error handling is robust and informative
- Integration between different functions works seamlessly
- All functionality adheres to the AI SDK patterns and the existing skill system architecture

## Notes for Testers

- Pay special attention to JSON output format consistency
- Verify that all error messages are clear and actionable
- Confirm that agent IDs are properly generated and can be used across different functions
- Test with the actual agent system if possible to verify real-world integration
- Document any performance considerations when executing complex orchestrations
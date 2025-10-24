#!/usr/bin/env tsx

/**
 * Orchestrate Agents Script
 *
 * Coordinates multiple agents to work together using various workflow patterns.
 * Supports sequential, parallel, supervisor, and round-robin patterns.
 */

import { z } from 'zod';

// Define the workflow schema
const WorkflowSchema = z.enum(['sequential', 'parallel', 'supervisor', 'round-robin']);

// Define the orchestrate schema
const OrchestrateSchema = z.object({
  workflow: WorkflowSchema,
  agents: z.array(z.string()),
  task: z.string()
});

type Orchestration = z.infer<typeof OrchestrateSchema>;

// In-memory storage for agent configurations
const agentsStorage: Map<string, any> = new Map();

// For this example, we'll add some mock agents to simulate the system
const mockAgents = [
  {
    id: "code-reviewer-1",
    role: "code-reviewer",
    tools: ["file-handling", "git-commit-helper"],
    knowledge: "Expert in code review, security, and performance. Always check for security vulnerabilities, performance bottlenecks, and maintainability issues."
  },
  {
    id: "researcher-1", 
    role: "researcher",
    tools: ["file-handling", "skill-creator"],
    knowledge: "Specialized in information gathering and analysis. Always provide sources and verify information."
  },
  {
    id: "writer-1",
    role: "writer",
    tools: ["file-handling"],
    knowledge: "Expert in creating clear, concise, and well-structured documents. Focus on readability and proper formatting."
  },
  {
    id: "analyst-1",
    role: "analyst",
    tools: ["file-handling"],
    knowledge: "Specialized in data analysis and insights. Always provide quantitative analysis and metrics."
  }
];

// Initialize mock agents
mockAgents.forEach(agent => agentsStorage.set(agent.id, agent));

/**
 * Execute a task for a specific agent using the AI service
 */
const executeAgentTask = async (agentId: string, task: string): Promise<any> => {
  const agent = agentsStorage.get(agentId);
  
  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  console.log(`Agent ${agentId} (${agent.role}) is processing task: ${task.substring(0, 50)}...`);
  
  // In a real implementation, we would use the AgentService
  // For this demo, we'll simulate the response based on the agent's role
  let systemPrompt = `You are a ${agent.role}. ${agent.knowledge || ''}`;
  
  // Mock response based on role
  let result;
  switch(agent.role) {
    case 'code-reviewer':
      result = `Code review completed for: ${task.substring(0, 30)}...\n- No critical security issues found\n- Performance looks good\n- Suggest minor refactoring for readability`;
      break;
    case 'researcher':
      result = `Research completed on: ${task.substring(0, 30)}...\n- Found 3 relevant sources\n- Key findings: [findings here]\n- Sources: [source list]`;
      break;
    case 'writer':
      result = `Document drafted for: ${task.substring(0, 30)}...\n[Draft content would go here with proper structure and formatting]`;
      break;
    case 'analyst':
      result = `Analysis completed for: ${task.substring(0, 30)}...\n- Key metrics: [metrics here]\n- Trends: [trends here]\n- Recommendations: [recommendations here]`;
      break;
    default:
      result = `Task completed for: ${task.substring(0, 30)}... by ${agent.role}`;
  }
  
  return {
    agentId,
    role: agent.role,
    result,
    status: 'completed'
  };
};

/**
 * Execute agents in sequential order
 * Each agent's output becomes the next agent's input
 */
const executeSequential = async (agents: string[], task: string): Promise<any[]> => {
  let currentTask = task;
  const results: any[] = [];
  
  for (const agentId of agents) {
    console.log(`Step ${results.length + 1}: Executing ${agentId} with task: ${currentTask.substring(0, 50)}...`);
    const result = await executeAgentTask(agentId, currentTask);
    results.push(result);
    // Pass the result of this agent as the input to the next agent
    currentTask = result.result;
  }
  
  return results;
};

/**
 * Execute agents in parallel
 * All agents work on the same task simultaneously
 */
const executeParallel = async (agents: string[], task: string): Promise<any[]> => {
  console.log(`Executing ${agents.length} agents in parallel on task: ${task.substring(0, 50)}...`);
  
  const promises = agents.map(agentId => executeAgentTask(agentId, task));
  const results = await Promise.all(promises);
  
  return results;
};

/**
 * Execute with supervisor pattern
 * One agent delegates tasks to others and aggregates results
 */
const executeSupervisor = async (agents: string[], task: string): Promise<any[]> => {
  if (agents.length < 2) {
    throw new Error('Supervisor pattern requires at least 2 agents (1 supervisor + 1 worker)');
  }
  
  const supervisorId = agents[0];
  const workerAgents = agents.slice(1);
  
  console.log(`Supervisor ${supervisorId} delegating task to ${workerAgents.length} workers:`, workerAgents);
  
  // Supervisor delegates tasks to workers  
  const workerResults = await executeParallel(workerAgents, task);
  
  // Supervisor aggregates and synthesizes results
  console.log(`Supervisor ${supervisorId} is aggregating results from workers...`);
  
  // Create a synthetic summary combining all worker results
  const aggregatedResult = {
    agentId: supervisorId,
    role: 'supervisor',
    delegatedTo: workerAgents,
    task,
    workerResults,
    result: `Supervisor aggregated the following results from ${workerAgents.length} workers:\n${workerResults.map(r => `- ${r.agentId}: ${r.result.substring(0, 60)}...`).join('\n')}\n\nSYNTHESIZED OUTCOME: [Combined insights from all workers]`,
    status: 'completed'
  };
  
  return [aggregatedResult];
};

/**
 * Execute with round-robin pattern
 * Distribute subtasks cyclically among agents
 */
const executeRoundRobin = async (agents: string[], task: string): Promise<any[]> => {
  console.log(`Distributing task via round-robin among ${agents.length} agents:`, agents);
  
  // For simplicity, we'll split the task equally among agents
  const results: any[] = [];
  
  for (let i = 0; i < agents.length; i++) {
    const agentId = agents[i];
    const subtask = `${task} - aspect ${i + 1}/${agents.length} (assigned to ${agentId})`;
    
    console.log(`Assigning subtask to ${agentId}: ${subtask.substring(0, 50)}...`);
    const result = await executeAgentTask(agentId, subtask);
    results.push(result);
  }
  
  return results;
};

/**
 * Orchestrate agents based on the specified workflow
 */
const orchestrateAgents = async (workflow: 'sequential' | 'parallel' | 'supervisor' | 'round-robin', agents: string[], task: string): Promise<any[]> => {
  try {
    console.log(`Starting ${workflow} workflow with agents: [${agents.join(', ')}] for task: ${task.substring(0, 100)}...`);
    
    let results: any[];
    
    switch (workflow) {
      case 'sequential':
        results = await executeSequential(agents, task);
        break;
      case 'parallel':
        results = await executeParallel(agents, task);
        break;
      case 'supervisor':
        results = await executeSupervisor(agents, task);
        break;
      case 'round-robin':
        results = await executeRoundRobin(agents, task);
        break;
      default:
        throw new Error(`Unknown workflow type: ${workflow}`);
    }
    
    console.log(JSON.stringify({
      success: true,
      workflow,
      agents,
      task,
      results,
      message: `Successfully executed ${workflow} workflow with ${agents.length} agents`
    }));
    
    return results;
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: `Failed to execute ${workflow} workflow`
    }));
    process.exit(2);
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const argsMap: Record<string, string | string[]> = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  
  if (key === 'agents' && value) {
    // Parse comma-separated agents
    argsMap[key] = value.split(',').map(agent => agent.trim()).filter(agent => agent);
  } else {
    argsMap[key] = value;
  }
}

// Validate required arguments
if (!argsMap.workflow || !argsMap.agents || !argsMap.task) {
  console.error(JSON.stringify({
    success: false,
    error: 'workflow, agents, and task are required',
    message: 'Usage: tsx orchestrate-agents.ts --workflow [sequential|parallel|supervisor|round-robin] --agents "agent1,agent2" --task "task description"'
  }));
  process.exit(1);
}

// Validate workflow type
const workflowResult = WorkflowSchema.safeParse(argsMap.workflow);
if (!workflowResult.success) {
  console.error(JSON.stringify({
    success: false,
    error: workflowResult.error.message,
    message: 'Invalid workflow type'
  }));
  process.exit(1);
}

// Validate agents array
if (!Array.isArray(argsMap.agents) || argsMap.agents.length === 0) {
  console.error(JSON.stringify({
    success: false,
    error: 'At least one agent is required',
    message: 'Invalid agents list'
  }));
  process.exit(1);
}

// Execute the orchestration
orchestrateAgents(
  argsMap.workflow as 'sequential' | 'parallel' | 'supervisor' | 'round-robin',
  argsMap.agents as string[],
  argsMap.task as string
)
.then(() => {
  process.exit(0);
})
.catch(error => {
  console.error('Unexpected error:', error);
  process.exit(2);
});
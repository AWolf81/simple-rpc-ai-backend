#!/usr/bin/env tsx

/**
 * Validate Agent Script
 *
 * Validates an agent's configuration, tools, and capabilities.
 */

import { z } from 'zod';

// Define the agent schema
const AgentSchema = z.object({
  id: z.string(),
  role: z.string(),
  tools: z.array(z.string()),
  knowledge: z.string().optional(),
  createdAt: z.string(),
  config: z.record(z.string(), z.unknown()).optional()
});

type Agent = z.infer<typeof AgentSchema>;

// In-memory storage (same as in create-agent)
const agentsStorage: Map<string, Agent> = new Map();

// For this example, we'll add some mock agents to validate
// In a real implementation, agents would be persisted
const mockAgents: Agent[] = [
  {
    id: "code-reviewer-1",
    role: "code-reviewer",
    tools: ["file-handling", "git-commit-helper"],
    knowledge: "Expert in code review, security, and performance",
    createdAt: new Date().toISOString(),
    config: { maxIterations: 10, timeout: 30000 }
  },
  {
    id: "researcher-1", 
    role: "researcher",
    tools: ["file-handling", "skill-creator"],
    knowledge: "Specialized in information gathering and analysis",
    createdAt: new Date().toISOString(),
    config: { maxIterations: 15, timeout: 45000 }
  },
  {
    id: "writer-1",
    role: "writer",
    tools: ["file-handling"],
    knowledge: "Expert in creating clear, concise, and well-structured documents",
    createdAt: new Date().toISOString(),
    config: { maxIterations: 8, timeout: 25000 }
  },
  {
    id: "analyst-1",
    role: "analyst",
    tools: ["file-handling"],
    knowledge: "Specialized in data analysis and insights",
    createdAt: new Date().toISOString(),
    config: { maxIterations: 12, timeout: 35000 }
  }
];

// Initialize mock agents
mockAgents.forEach(agent => agentsStorage.set(agent.id, agent));

/**
 * Validate an agent's configuration and capabilities
 */
const validateAgent = async (agentId: string): Promise<Agent | null> => {
  try {
    const agent = agentsStorage.get(agentId);
    
    if (!agent) {
      console.error(JSON.stringify({
        success: false,
        error: `Agent with ID ${agentId} not found`,
        message: 'Agent does not exist'
      }));
      process.exit(1);
    }
    
    // Validate the agent structure
    const validatedAgent = AgentSchema.parse(agent);
    
    // Perform additional validation checks
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];
    
    // Check if role is defined
    if (!validatedAgent.role || validatedAgent.role.trim() === '') {
      validationErrors.push('Agent role is not defined');
    }
    
    // Check if tools array is not empty
    if (!validatedAgent.tools || validatedAgent.tools.length === 0) {
      validationWarnings.push('Agent has no tools assigned');
    }
    
    // Check if createdAt is a valid date
    const date = new Date(validatedAgent.createdAt);
    if (isNaN(date.getTime())) {
      validationErrors.push('Invalid creation date');
    }
    
    // Check if knowledge is provided (optional but recommended)
    if (!validatedAgent.knowledge || validatedAgent.knowledge.trim() === '') {
      validationWarnings.push('Agent has no specific knowledge defined (recommended for specialization)');
    }
    
    const result: any = {
      success: true,
      agent: validatedAgent,
      message: `Agent ${agentId} validated successfully`
    };
    
    if (validationWarnings.length > 0) {
      result.warnings = validationWarnings;
      result.message += ' with warnings';
    }
    
    if (validationErrors.length > 0) {
      result.success = false;
      result.validationErrors = validationErrors;
      result.message = 'Agent validation failed';
      
      console.error(JSON.stringify(result));
      process.exit(2);
    }
    
    console.log(JSON.stringify(result));
    
    return validatedAgent;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({
        success: false,
        error: 'Validation failed',
        issues: error.issues,
        message: 'Agent structure is invalid'
      }));
      process.exit(2);
    } else {
      console.error(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to validate agent'
      }));
      process.exit(2);
    }
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const argsMap: Record<string, string> = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  argsMap[key] = value;
}

// Validate required arguments
if (!argsMap.agentId) {
  console.error(JSON.stringify({
    success: false,
    error: 'agentId is required',
    message: 'Usage: tsx validate-agent.ts --agentId "agent-id"'
  }));
  process.exit(1);
}

// Execute the validation
validateAgent(argsMap.agentId)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(2);
  });
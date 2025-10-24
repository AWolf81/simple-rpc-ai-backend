#!/usr/bin/env tsx

/**
 * Create a new specialized agent
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

// In-memory storage for simplicity (in production, use persistent storage)
const agentsStorage: Map<string, Agent> = new Map();
const agentCounter: { count: number } = { count: 0 };

/**
 * Create a new specialized agent
 */
const createAgent = async (role: string, tools: string[], knowledge?: string): Promise<Agent> => {
  try {
    // Create a unique agent ID
    const agentId = `${role.toLowerCase().replace(/\s+/g, '-')}-${++agentCounter.count}`;
    
    // Create the agent object
    const newAgent: Agent = {
      id: agentId,
      role,
      tools,
      knowledge,
      createdAt: new Date().toISOString(),
      config: {
        tools,
        maxIterations: 10,
        timeout: 30000 // 30 seconds
      }
    };

    // Validate the agent
    const validatedAgent = AgentSchema.parse(newAgent);
    
    // Store the agent
    agentsStorage.set(agentId, validatedAgent);
    
    console.log(JSON.stringify({
      success: true,
      agent: validatedAgent,
      message: `Successfully created agent: ${agentId}`
    }));
    
    return validatedAgent;
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to create agent'
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
  
  if (key === 'tools' && value) {
    // Parse comma-separated tools
    argsMap[key] = value.split(',').map(tool => tool.trim()).filter(tool => tool);
  } else {
    argsMap[key] = value;
  }
}

// Validate required arguments
if (!argsMap.role) {
  console.error(JSON.stringify({
    success: false,
    error: 'Role is required',
    message: 'Usage: tsx create-agent.ts --role "role" [--tools "tool1,tool2"] [--knowledge "knowledge"]'
  }));
  process.exit(1);
}

// Execute the function
createAgent(
  argsMap.role as string, 
  Array.isArray(argsMap.tools) ? argsMap.tools : [], 
  argsMap.knowledge as string | undefined
)
  .then(agent => {
    // Successfully created
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(2);
  });
/**
 * Server management for Simple Agent CLI
 */

import { createRpcAiServer, RpcAiServer } from 'simple-rpc-ai-backend';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDefaultSkillSources } from '../config/skills.js';
import { getDefaultAgentSkills } from '../config/agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../../');

let serverInstance:(RpcAiServer|null) = null;

export async function startServer() {
  if (serverInstance) {
    return serverInstance;
  }

  serverInstance = createRpcAiServer({
    port: 8001,
    autoKillExistingServer: true,  // Auto-kill old server on restart
    serverProviders: ['openrouter', 'anthropic'],

    agents: {
      enabled: true,
      agent: {
        defaultSkills: getDefaultAgentSkills()
      },
      skills: {
        enabled: true,
        sources: getDefaultSkillSources(projectRoot),
        sandbox: {
          allowedPaths: ['/workspace', '/tmp', projectRoot],
          timeout: 30000,
          maxMemory: 512 * 1024 * 1024
        },
        validation: {
          enabled: true,
          maxTokens: { level1: 100, level2: 5000 }
        }
      }
    },

    mcp: {
      enabled: true,
      defaultConfig: {
        enableFilesystemTools: true,
        enableRefTools: false,
        enableWebSearchTool: false
      },
      transports: {
        http: true,
        sse: true,
        stdio: false
      },
      suppressAuthWarning: true
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

/**
 * Check if a server is running at the given URL
 */
export async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const healthUrl = `${url}/health`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'ok' || data.status === 'healthy';
    }

    return false;
  } catch (error) {
    // Server not running or not responding
    return false;
  }
}

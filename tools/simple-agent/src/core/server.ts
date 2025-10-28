/**
 * Server management for Simple Agent CLI
 */

import { createRpcAiServer, RpcAiServer } from 'simple-rpc-ai-backend';
import { createInteractiveApprovalCallback } from '../../../../dist/services/agents/skills/utils/interactive-approval-callback.js';
import { setLogFilePath } from '../../../../dist/utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDefaultSkillSources } from '../config/skills.js';
import { getDefaultAgentSkills } from '../config/agents.js';
import { CwdManager } from '../utils/cwd-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../../');

let serverInstance:(RpcAiServer|null) = null;
let cwdManager: CwdManager | null = null;

export async function startServer(workspaceDir?: string) {
  if (serverInstance) {
    return serverInstance;
  }

  // Enable file logging to /tmp/server.log
  setLogFilePath('/tmp/server.log');
  console.log('📝 Server logs enabled: /tmp/server.log');

  // Create CWD manager for workspace directory
  const workspace = workspaceDir || process.cwd();
  cwdManager = new CwdManager(workspace);
  cwdManager.initialize();

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
          allowedPaths: ['/workspace', '/tmp', projectRoot, workspace],
          cwdFilePath: cwdManager.getFilePath(),
          timeout: 30000,
          maxMemory: 512 * 1024 * 1024
        },
        validation: {
          enabled: true,
          maxTokens: { level1: 100, level2: 5000 }
        },
        // Interactive approval callback - uses user-interaction skill for consistent UI
        // This bridges the low-level safety system with high-level user-interaction dialogs
        approvalCallback: createInteractiveApprovalCallback({
          approvalOptions: [
            'Allow',
            'Allow (don\'t ask again)',
            'Deny (don\'t ask again)',
            'Deny',
            'Custom response'
          ],
          allowCustomReason: true,
          timeout: 0  // No timeout - wait for user input
        })
      } as any  // Type will be correct at runtime from dist
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

  // Cleanup CWD manager temp file
  if (cwdManager) {
    cwdManager.cleanup();
    cwdManager = null;
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

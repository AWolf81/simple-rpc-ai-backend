/**
 * Development Panel Utilities for Package Consumers
 *
 * Provides utilities for package consumers to start the development panel
 * for their RPC AI servers.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export interface DevPanelConfig {
  port?: number;
  serverPort?: number;
  autoOpen?: boolean;
}

/**
 * Start the development panel for a running RPC AI server
 *
 * @param config Configuration for the dev panel
 * @returns Promise that resolves when the panel is ready
 */
export async function startDevPanel(config: DevPanelConfig = {}): Promise<{
  url: string;
  stop: () => void;
}> {
  const {
    port = 8080,
    serverPort = 8000,
    autoOpen = false
  } = config;

  return new Promise((resolve, reject) => {
    // Get the path to the dev-panel script
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const devPanelScript = path.join(__dirname, '..', 'tools', 'dev-panel.js');

    // Set environment variables
    const env = {
      ...process.env,
      DEV_PANEL_PORT: port.toString(),
      AI_SERVER_PORT: serverPort.toString()
    };

    // Spawn the dev panel process
    const child: ChildProcess = spawn('node', [devPanelScript], {
      env,
      stdio: 'pipe'
    });

    let resolved = false;

    // Handle stdout to detect when the panel is ready
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[Dev Panel] ${output.trim()}`);

      // Look for the ready message
      if (output.includes('Development Panel ready') && !resolved) {
        resolved = true;
        const url = `http://localhost:${port}`;

        // Auto-open browser if requested
        if (autoOpen) {
          console.log(`💡 Open your browser to: ${url}`);
          // Note: Browser auto-open disabled to avoid TypeScript module resolution errors
          // Package consumers can install 'open' package and customize this behavior
        }

        resolve({
          url,
          stop: () => {
            child.kill();
          }
        });
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[Dev Panel Error] ${data.toString().trim()}`);
    });

    // Handle process exit
    child.on('exit', (code) => {
      if (code !== 0 && !resolved) {
        reject(new Error(`Dev panel exited with code ${code}`));
      }
    });

    // Handle errors
    child.on('error', (error) => {
      if (!resolved) {
        reject(error);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('Dev panel startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Create a combined server with dev panel
 *
 * This is a convenience function that starts both the RPC AI server
 * and the development panel together.
 */
export async function createServerWithDevPanel(
  serverFactory: () => Promise<{ start: () => Promise<void>; stop: () => Promise<void> }>,
  devPanelConfig: DevPanelConfig = {}
) {
  console.log('🚀 Starting RPC AI server...');
  const server = await serverFactory();
  await server.start();

  console.log('🎛️ Starting development panel...');
  const devPanel = await startDevPanel({
    autoOpen: true,
    ...devPanelConfig
  });

  console.log(`✅ Server and dev panel ready!`);
  console.log(`   • Server: http://localhost:${devPanelConfig.serverPort || 8000}`);
  console.log(`   • Dev Panel: ${devPanel.url}`);

  return {
    server,
    devPanel,
    async stop() {
      console.log('🛑 Stopping dev panel...');
      devPanel.stop();

      console.log('🛑 Stopping server...');
      await server.stop();

      console.log('✅ Everything stopped cleanly');
    }
  };
}

/**
 * Utility to check if a dev panel is already running
 */
export async function checkDevPanelRunning(port: number = 8080): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
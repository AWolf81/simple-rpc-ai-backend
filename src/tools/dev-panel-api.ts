/**
 * Dev Panel API - Programmatic interface for starting the development panel
 *
 * This allows package consumers to start the dev panel programmatically
 * without needing to manually run build commands or figure out paths.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export interface DevPanelConfig {
  /** Port for the dev panel (default: 8080) */
  port?: number;
  /** Port of the AI server to connect to (default: auto-discover) */
  serverPort?: number;
  /** Open browser automatically (default: true) */
  openBrowser?: boolean;
  /** Working directory for tRPC methods discovery (default: process.cwd()) */
  workingDir?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Start the development panel programmatically
 */
export async function startDevPanel(config: DevPanelConfig = {}): Promise<{
  stop: () => void;
  url: string;
  port: number;
}> {
  const {
    port = 8080,
    serverPort,
    openBrowser = true,
    workingDir = process.cwd(),
    env = {}
  } = config;

  // Get the path to the dev-panel.js script
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const devPanelScript = path.resolve(__dirname, 'dev-panel.js');

  // Build environment
  const devPanelEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    DEV_PANEL_PORT: port.toString(),
    DEV_PANEL_OPEN_BROWSER: openBrowser.toString(),
    ...env
  };

  if (serverPort) {
    devPanelEnv.AI_SERVER_PORT = serverPort.toString();
  }

  console.log(`🎨 Starting dev panel on port ${port}...`);

  // Start the dev panel process
  const childProcess = spawn('node', [devPanelScript], {
    cwd: workingDir,
    env: devPanelEnv,
    stdio: 'inherit'
  });

  const url = `http://localhost:${port}`;

  // Open browser if requested
  if (openBrowser) {
    setTimeout(async () => {
      try {
        // Try to dynamically import open (graceful fallback if not installed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openModule = await import('open' as any).catch(() => null);
        if (openModule?.default) {
          await openModule.default(url);
          console.log(`🌐 Browser opened to ${url}`);
        } else {
          console.log(`💡 Install 'open' package for auto-browser opening`);
          console.log(`🌐 Dev panel available at ${url}`);
        }
      } catch (error) {
        console.log(`🌐 Dev panel available at ${url}`);
      }
    }, 2000);
  }

  return {
    stop: () => {
      childProcess.kill();
    },
    url,
    port
  };
}

/**
 * Quick start function for the most common use case
 */
export async function quickStartDevPanel(serverPort?: number): Promise<{ stop: () => void; url: string; port: number; }> {
  const devPanel = await startDevPanel({
    serverPort,
    openBrowser: true
  });

  console.log(`🚀 Dev panel started at ${devPanel.url}`);
  console.log('Press Ctrl+C to stop');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping dev panel...');
    devPanel.stop();
    process.exit(0);
  });

  return devPanel;
}
/**
 * Remote MCP Client - Connect to external MCP servers
 *
 * Supports multiple connection types:
 * - uvx: Python packages via UV
 * - npx: Node.js packages via npm
 * - docker: Containerized servers
 * - http/https: Remote web servers
 */

import { spawn, ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { createHash } from 'crypto';
import { homedir } from 'os';
import path from 'path';
import Docker from 'dockerode';
import type { DockerOptions } from 'dockerode';
import { resolveNodePackageRunner } from '../utils/node-package-runner.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '../utils/logger.js';

export type RemoteMCPTransport = 'uvx' | 'npx' | 'npm-exec' | 'docker' | 'http' | 'https' | 'streamableHttp';

export interface RemoteMCPServerConfig {
  name: string;
  transport: RemoteMCPTransport;

  // For uvx/npx
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // For docker
  image?: string;
  containerArgs?: string[];

  // For http/https
  url?: string;
  headers?: Record<string, string>;

  // Authentication
  auth?: {
    type: 'bearer' | 'basic' | 'none';
    token?: string;
    username?: string;
    password?: string;
  };

  // Optional settings
  prefixToolNames?: boolean;  // Prefix tool names with server name (default: true)
  runnerArgs?: string[];      // Additional args passed to runner (e.g. npx -y)
  containerName?: string;     // Friendly name for docker containers (default: mcp-<name>)
  dockerCommand?: string[];   // Override command when running Docker image
  reuseContainer?: boolean;   // Attempt to reuse existing Docker container (default: false)
  dockerHost?: string;        // Preferred Docker host/socket (e.g. unix:///path/to/docker.sock)
  removeOnExit?: boolean;     // Remove Docker container on exit (default: !reuseContainer)
  startupDelayMs?: number;    // Optional delay before performing handshake (useful for slow-starting servers)
  startupRetries?: number;    // Number of handshake retries after delay
  autoStart?: boolean;
  timeout?: number;
  retries?: number;
  
  // Ping/Keepalive configuration - only applicable for streamable HTTP transports
  ping?: {
    enabled?: boolean;
    intervalMs?: number; // in milliseconds
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

type DockerCandidateSource = 'config' | 'env' | 'detected' | 'default';

interface DockerCandidate {
  options?: DockerOptions;
  description: string;
  source: DockerCandidateSource;
}

export class RemoteMCPClient extends EventEmitter {
  private config: RemoteMCPServerConfig;
  private process: (ChildProcess & { dispose?: () => Promise<void> }) | null = null;
  private connected = false;
  private containerId: string | null = null;
  private dockerClient: Docker | null = null;
  private dockerCandidates: DockerCandidate[] | null = null;
  private dockerCandidateIndex = 0;
  private messageId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private cachedTools: any = null;  // Cached tools list from initialization
  private cachedToolsTimestamp = 0;
  private mcpClient: Client | null = null;  // Official MCP SDK client for SSE transport

  constructor(config: RemoteMCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Expose readonly config for manager-level decisions
   */
  getConfig(): RemoteMCPServerConfig {
    return { ...this.config };
  }

  /**
   * Strip sensitive query parameters from URLs before logging
   */
  private formatUrlForLogging(url?: string): string {
    if (!url) {
      return '';
    }

    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      const [base] = url.split('?');
      return base || url;
    }
  }

  /**
   * Sanitize command-line args for safe logging (mask secrets like api keys)
   */
  private sanitizeArgsForLogging(args: string[]): string[] {
    const sensitiveFlags = new Set(['--api-key', '--token', '--auth', '--password', '--secret']);
    const sanitized: string[] = [];

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      const [flag, value] = arg.split('=');

      if (value !== undefined && sensitiveFlags.has(flag)) {
        sanitized.push(`${flag}=***`);
        continue;
      }

      sanitized.push(arg);

      if (sensitiveFlags.has(arg) && i + 1 < args.length) {
        sanitized.push('***');
        i += 1; // Skip actual value
      }
    }

    return sanitized;
  }

  /**
   * Convert an arbitrary error into a concise, log-safe message
   */
  private formatErrorForLogging(error: unknown): string {
    let message: string;

    if (error instanceof Error && error.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }

    let trimmed = message.trim();

    if (!trimmed) {
      return 'Unknown error';
    }

    const htmlIndex = trimmed.search(/<\s*(?:!doctype|html|head|body|div|span|p)[\s>]/i);
    if (htmlIndex !== -1) {
      const prefix = trimmed.slice(0, htmlIndex).replace(/\s*[:\-–]+\s*$/, '');
      trimmed = `${prefix || 'Received HTML response'} (response body omitted)`;
    }

    const maxLength = 500;
    if (trimmed.length > maxLength) {
      trimmed = `${trimmed.slice(0, maxLength)}…`;
    }

    return trimmed;
  }

  private async postStdioHandshake(label: 'UVX' | 'NodePkg' | 'Docker'): Promise<void> {
    logger.debug(`📝 [${label} ${this.config.name}] Sending initialization handshake`);

    await this.sendStdioRequest({
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'simple-rpc-ai-backend-remote-client',
          version: '1.0.0'
        }
      }
    });

    await this.sendStdioRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    });

    const tools = await this.sendStdioRequest({
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'tools/list'
    });

    this.cachedTools = tools;
    this.cachedToolsTimestamp = Date.now();
    const toolNames = Array.isArray(tools?.tools) ? tools.tools.map((tool: any) => tool.name).filter(Boolean) : [];
    logger.debug(`📋 [${label} ${this.config.name}] tools/list returned ${toolNames.length} tool(s)${toolNames.length ? `: ${toolNames.join(', ')}` : ''}`);
  }

  /**
   * Connect to the remote MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    switch (this.config.transport) {
      case 'uvx':
        await this.connectViaUvx();
        break;
      case 'npx':
      case 'npm-exec':
        await this.connectViaNodePackage(this.config.transport);
        break;
      case 'docker':
        await this.connectViaDocker();
        break;
      case 'http':
      case 'https':
        await this.connectViaHttp();
        break;
      case 'streamableHttp':
        await this.connectViaStreamableHttp();
        break;
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }

    this.connected = true;
    this.emit('connected');
  }

  /**
   * Connect via uvx (Python/UV)
   */
  private async connectViaUvx(): Promise<void> {
    if (!this.config.command) {
      throw new Error('uvx transport requires command');
    }

    const args = ['uvx', this.config.command, ...(this.config.args || [])];
    const sanitizedArgs = this.sanitizeArgsForLogging(args);
    logger.debug(`🔌 [UVX ${this.config.name}] Spawning ${sanitizedArgs.join(' ')}`);
    logger.debug(`🔧 [UVX ${this.config.name}] Working directory: ${process.cwd()}`);

    this.process = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    logger.debug(`🔌 [UVX ${this.config.name}] Spawned process PID ${this.process.pid ?? 'unknown'}`);
    logger.debug(`🔍 [UVX ${this.config.name}] Env overrides: ${JSON.stringify(this.config.env || {}, null, 2)}`);

    const uvxLogBuffer: string[] = [];

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const output = chunk.toString().trim();
      if (output) {
        uvxLogBuffer.push(`[stderr] ${output}`);
      }
    });

    this.process.on('close', (code) => {
      logger.debug(`🏁 [UVX ${this.config.name}] Process exited with code ${code}`);
    });

    this.process.on('error', (error) => {
      logger.error(`❌ [UVX ${this.config.name}] Process error:`, error);
    });

    this.setupProcessHandlers();

    const flushLogs = (suffix: string, includeEmpty = false) => {
      const labelSuffix = suffix ? ` ${suffix}` : '';
      if (uvxLogBuffer.length) {
        logger.debug(`📝 [UVX ${this.config.name}] Startup log${labelSuffix}:\n${uvxLogBuffer.join('\n')}`);
        uvxLogBuffer.length = 0;
      } else if (includeEmpty) {
        logger.debug(`📝 [UVX ${this.config.name}] Startup log${labelSuffix}: (no output captured)`);
      }
    };

    try {
      await this.postStdioHandshake('UVX');
      flushLogs('');
    } catch (error) {
      flushLogs(' (partial)', true);
      logger.warn(`⚠️  [UVX ${this.config.name}] Handshake failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Connect via Node-based package runner (npx or npm exec)
   */
  private async connectViaNodePackage(preference: 'npx' | 'npm-exec'): Promise<void> {
    if (!this.config.command) {
      throw new Error(`${preference} transport requires command`);
    }

    const runner = resolveNodePackageRunner(preference);
    const runnerArgs = this.config.runnerArgs ? [...this.config.runnerArgs] : [];
    const commandArgs = this.config.args ? [...this.config.args] : [];
    const args = [...runner.args, ...runnerArgs, this.config.command, ...commandArgs];
    const sanitizedArgs = this.sanitizeArgsForLogging(args);
    logger.debug(`🔌 [NodePkg ${this.config.name}] Spawning ${runner.command} ${sanitizedArgs.join(' ')}`);
    logger.debug(`🔧 [NodePkg ${this.config.name}] Working directory: ${process.cwd()}`);

    this.process = spawn(runner.command, args, {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    logger.debug(`🔌 [NodePkg ${this.config.name}] Spawned process PID ${this.process.pid ?? 'unknown'}`);
    logger.debug(`🔍 [NodePkg ${this.config.name}] Env overrides: ${JSON.stringify(this.config.env || {}, null, 2)}`);
    const nodeLogBuffer: string[] = [];

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const output = chunk.toString().trim();
      if (output) {
        nodeLogBuffer.push(`[stderr] ${output}`);
      }
    });

    this.setupProcessHandlers();
    await this.waitForReady(this.config.timeout);
    await this.postStdioHandshake('NodePkg');

    if (nodeLogBuffer.length) {
      logger.debug(`📝 [NodePkg ${this.config.name}] Startup log:\n${nodeLogBuffer.join('\n')}`);
    }
  }

  private getDockerClient(): Docker {
    this.ensureDockerCandidates();
    if (!this.dockerClient) {
      const candidate = this.getCurrentDockerCandidate();
      if (candidate?.options) {
        this.dockerClient = new Docker(candidate.options);
      } else {
        this.dockerClient = new Docker();
      }

      if (candidate) {
        logger.debug(`🛠️  [Docker ${this.config.name}] Using Docker host ${candidate.description}`);
      }
    }
    return this.dockerClient;
  }

  private ensureDockerCandidates(): void {
    if (!this.dockerCandidates) {
      this.dockerCandidates = this.buildDockerClientCandidates();
      if (this.dockerCandidates.length === 0) {
        this.dockerCandidates.push({
          description: 'dockerode default context',
          source: 'default'
        });
      }
      this.dockerCandidateIndex = 0;
    }
  }

  private getCurrentDockerCandidate(): DockerCandidate | null {
    if (!this.dockerCandidates || this.dockerCandidateIndex >= this.dockerCandidates.length) {
      return null;
    }
    return this.dockerCandidates[this.dockerCandidateIndex];
  }

  private buildDockerClientCandidates(): DockerCandidate[] {
    const candidates: DockerCandidate[] = [];

    const explicitHost = this.config.dockerHost?.trim();
    if (explicitHost) {
      candidates.push({
        options: this.parseDockerHost(explicitHost),
        description: explicitHost,
        source: 'config'
      });
      return candidates;
    }

    const envHost = process.env.DOCKER_HOST?.trim();
    if (envHost) {
      candidates.push({
        options: this.parseDockerHost(envHost),
        description: envHost,
        source: 'env'
      });
      return candidates;
    }

    const discoveredSockets = this.getDefaultDockerSocketCandidates();
    for (const raw of discoveredSockets) {
      const options = this.parseDockerHost(raw);
      if (options.socketPath && existsSync(options.socketPath)) {
        candidates.push({
          options,
          description: raw,
          source: 'detected'
        });
      }
    }

    const defaultSocket = 'unix:///var/run/docker.sock';
    if (!candidates.some((candidate) => candidate.description === defaultSocket)) {
      const options = this.parseDockerHost(defaultSocket);
      candidates.push({
        options,
        description: defaultSocket,
        source: 'detected'
      });
    }

    candidates.push({
      description: 'dockerode default context',
      source: 'default'
    });

    return candidates;
  }

  private getDefaultDockerSocketCandidates(): string[] {
    const sockets = new Set<string>();
    const home = homedir();
    const addSocket = (socketPath: string | null | undefined) => {
      if (!socketPath) {
        return;
      }
      if (socketPath.startsWith('unix://')) {
        sockets.add(socketPath);
      } else if (socketPath.startsWith('/')) {
        sockets.add(`unix://${socketPath}`);
      }
    };

    if (home) {
      addSocket(path.join(home, '.docker', 'desktop', 'docker.sock'));
      addSocket(path.join(home, '.docker', 'run', 'docker.sock'));
      addSocket(path.join(home, '.docker', 'docker.sock'));
    }

    if (typeof process.getuid === 'function') {
      const uid = process.getuid();
      addSocket(`/run/user/${uid}/docker.sock`);
    }

    addSocket('/var/run/docker.sock');

    return Array.from(sockets);
  }

  private parseDockerHost(host: string): DockerOptions {
    const trimmed = host.trim();
    if (trimmed.startsWith('unix://')) {
      return { socketPath: trimmed.replace('unix://', '') };
    }
    if (trimmed.startsWith('npipe://')) {
      return { socketPath: trimmed };
    }
    if (
      trimmed.startsWith('tcp://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('ssh://')
    ) {
      try {
        const url = new URL(trimmed);
        const rawProtocol = url.protocol.replace(':', '');
        let protocol: 'http' | 'https' | 'ssh' | undefined;

        switch (rawProtocol) {
          case 'tcp':
          case 'http':
            protocol = 'http';
            break;
          case 'https':
            protocol = 'https';
            break;
          case 'ssh':
            protocol = 'ssh';
            break;
          default:
            protocol = undefined;
        }

        return {
          protocol,
          host: url.hostname,
          port: url.port ? Number(url.port) : undefined
        };
      } catch {
        // Fall through to default handling
      }
    }
    if (trimmed.startsWith('/')) {
      return { socketPath: trimmed };
    }
    return { socketPath: trimmed };
  }

  private tryAdvanceDockerCandidate(error: unknown): boolean {
    if (!this.dockerCandidates) {
      return false;
    }

    const current = this.getCurrentDockerCandidate();
    if (!current) {
      return false;
    }

    if (current.source === 'config' || current.source === 'env') {
      return false;
    }

    if (this.dockerCandidateIndex >= this.dockerCandidates.length - 1) {
      return false;
    }

    const errno = (error as NodeJS.ErrnoException)?.code;
    const retryableCodes = new Set(['ENOENT', 'ECONNREFUSED', 'ECONNRESET', 'EPERM', 'EACCES']);
    if (errno && !retryableCodes.has(errno)) {
      return false;
    }

    const next = this.dockerCandidates[this.dockerCandidateIndex + 1];
    logger.info(
      `♻️  [Docker ${this.config.name}] Unable to reach Docker host ${current.description}: ${this.formatErrorForLogging(error)}. Trying ${next.description}`
    );

    this.dockerCandidateIndex += 1;
    this.dockerClient = null;
    return true;
  }

  /**
   * Connect via Docker using dockerode for container lifecycle management.
   * Falls back to the legacy CLI implementation if unsupported flags are detected.
   */
  private async connectViaDocker(): Promise<void> {
    if (!this.config.image) {
      throw new Error('docker transport requires image');
    }

    const reuse = this.config.reuseContainer ?? false;
    let containerName = this.config.containerName;
    if (!containerName && (reuse || this.config.removeOnExit === false)) {
      containerName = `mcp-${this.config.name}`;
    }

    const removeOnExit = this.config.removeOnExit ?? !reuse;
    let docker = this.getDockerClient();

    await this.ensureDockerAccessibility(docker);
    docker = this.getDockerClient(); // ensure we use any socket fallback the accessibility check selected
    await this.ensureDockerImageAvailable(docker);

    const parseResult = this.buildDockerCreateOptions({
      containerArgs: this.config.containerArgs || [],
      containerName,
      removeOnExit
    });

    if (parseResult.unsupported.length > 0) {
      throw new Error(
        `Unsupported Docker option(s) for ${this.config.name}: ${parseResult.unsupported.join(', ')}`
      );
    }

    const createOptions = parseResult.options;
    const autoRemove = !!createOptions.HostConfig?.AutoRemove;
    const signature = this.computeDockerConfigSignature(createOptions);

    createOptions.Labels = {
      ...(createOptions.Labels || {}),
      'simple-rpc-ai-backend.managed': 'true',
      'simple-rpc-ai-backend.server': this.config.name,
      'simple-rpc-ai-backend.signature': signature
    };

    let container: Docker.Container;
    let inspectInfo: Docker.ContainerInspectInfo | null = null;

    if (containerName) {
      const existing = await this.findManagedDockerContainer(containerName);
      if (existing) {
        inspectInfo = existing.inspect;
        this.containerId = inspectInfo.Id;

        if (!reuse) {
          logger.debug(`🔁 [Docker ${this.config.name}] Removing existing managed container ${containerName} (reuse disabled)`);
          await this.safeRemoveContainer(existing.container);
          container = await docker.createContainer(createOptions);
        } else if (inspectInfo.Config?.Labels?.['simple-rpc-ai-backend.signature'] !== signature) {
          logger.debug(`🔁 [Docker ${this.config.name}] Container config changed; recreating ${containerName}`);
          await this.safeRemoveContainer(existing.container);
          container = await docker.createContainer(createOptions);
        } else {
          container = existing.container;
          if (inspectInfo.State?.Running) {
            await this.safeStopContainer(container);
          }
        }
      } else {
        container = await docker.createContainer(createOptions);
      }
    } else {
      container = await docker.createContainer(createOptions);
    }

    this.containerId = container.id;

    logger.debug(`🧲 [Docker ${this.config.name}] Attaching to container IO streams`);
    const attachStream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true
    });
    logger.debug(`🧲 [Docker ${this.config.name}] Attach established`);
    
    try {
      logger.debug(`🚀 [Docker ${this.config.name}] Starting container ${containerName || container.id}`);
      await container.start();
      logger.info(`🚀 [Docker ${this.config.name}] Container ${containerName || container.id} started`);
    } catch (error) {
      if (typeof (attachStream as any)?.destroy === 'function') {
        (attachStream as any).destroy();
      } else if (typeof attachStream.end === 'function') {
        attachStream.end();
      }
      await this.stopAndCleanupDockerContainer(container, {
        remove: removeOnExit,
        autoRemove
      });
      throw new Error(
        `Failed to start Docker container ${containerName || container.id}: ${this.formatErrorForLogging(error)}`
      );
    }

    const stdout = new PassThrough();
    const stderr = new PassThrough();

    if (typeof (container.modem as any)?.demuxStream === 'function') {
      container.modem.demuxStream(attachStream, stdout, stderr);
    } else {
      attachStream.on('data', (chunk: Buffer) => stdout.write(chunk));
      attachStream.on('end', () => {
        stdout.end();
        stderr.end();
      });
    }

    const dockerProcess = Object.assign(new EventEmitter(), {
      stdin: attachStream as NodeJS.WritableStream,
      stdout,
      stderr,
      kill: () => {
        void cleanupDocker(true);
        return true;
      },
      dispose: async () => {
        await cleanupDocker(false);
      }
    }) as unknown as ChildProcess & {
      stdout: PassThrough;
      stderr: PassThrough;
      dispose?: () => Promise<void>;
    };

    attachStream.on('error', (error) => {
      (dockerProcess as unknown as EventEmitter).emit('error', error);
    });

    const cleanupDocker = async (fromKill: boolean): Promise<void> => {
      if (typeof (attachStream as any)?.destroy === 'function') {
        (attachStream as any).destroy();
      } else {
        attachStream.end();
      }
      try {
        await this.stopAndCleanupDockerContainer(container, {
          remove: removeOnExit,
          autoRemove
        });
      } catch (error) {
        if (!fromKill) {
          throw error;
        }
      }
    };

    void container.wait()
      .then((result) => {
        stdout.end();
        stderr.end();
        const status = result?.StatusCode ?? 0;
        (dockerProcess as unknown as EventEmitter).emit('exit', status);
        (dockerProcess as unknown as EventEmitter).emit('close', status);
        return cleanupDocker(false);
      })
      .catch((error) => {
        (dockerProcess as unknown as EventEmitter).emit('error', error);
      });

    logger.debug(`[Docker ${this.config.name}] stdin writable:`, dockerProcess.stdin.writable);
    logger.debug(`[Docker ${this.config.name}] stdin destroyed:`, (dockerProcess.stdin as any).destroyed);
    
    const dockerLogBuffer: string[] = [];
    const maxLogEntries = 20;
    const pushDockerLog = (stream: 'stdout' | 'stderr', chunk: string) => {
      const lines = chunk.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const entry = `${stream}> ${line}`;
        dockerLogBuffer.push(entry.length > 500 ? `${entry.slice(0, 500)}…` : entry);
        if (dockerLogBuffer.length > maxLogEntries) {
          dockerLogBuffer.shift();
        }
        if (stream === 'stderr') {
          logger.debug(`🪵 [Docker ${this.config.name}] ${stream}: ${line}`);
        }
      }
    };

    dockerProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.trim()) {
        pushDockerLog('stdout', text);
      }
    });

    dockerProcess.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.trim()) {
        pushDockerLog('stderr', text);
      }
    });

    this.process = dockerProcess;
    this.setupProcessHandlers();

    const startupDelay = Math.max(0, this.config.startupDelayMs ?? 0);
    const startupRetries = Math.max(1, this.config.startupRetries ?? 3);

    try {
      let attempt = 0;
      await this.delay(startupDelay);
      while (attempt < startupRetries) {
        attempt += 1;
        const attemptLabel = `${attempt}/${startupRetries}`;
        logger.debug(`🤝 [Docker ${this.config.name}] Starting handshake attempt ${attemptLabel}`);

        try {
          if (attempt > 1) {
            await this.waitForReady(this.config.timeout);
          }
          await this.postStdioHandshake('Docker');
          logger.info(`✅ [Docker ${this.config.name}] Handshake succeeded on attempt ${attemptLabel}`);
          break;
        } catch (handshakeError) {
          const formatted = this.formatErrorForLogging(handshakeError);
          if (attempt >= startupRetries) {
            logger.error(`❌ [Docker ${this.config.name}] Handshake failed after ${attemptLabel} attempts: ${formatted}`);
            throw handshakeError;
          }

          const retryDelay = Math.max(startupDelay, 1000);
          logger.warn(
            `⚠️  [Docker ${this.config.name}] Handshake attempt ${attemptLabel} failed: ${formatted}. Retrying in ${retryDelay}ms...`
          );
          await this.delay(retryDelay);
        }
      }
    } catch (error) {
      if (dockerLogBuffer.length) {
        logger.warn(
          `📄 [Docker ${this.config.name}] Recent container output before failure:\n${dockerLogBuffer.join('\n')}`
        );
      }
      await cleanupDocker(false).catch(() => {});
      this.process = null;
      this.containerId = null;
      throw error;
    }
  }

  /**
   * Ensure the Docker image exists locally; pull it when missing.
   */
  private async ensureDockerImageAvailable(docker: Docker): Promise<void> {
    const imageName = this.config.image!;
    try {
      await docker.getImage(imageName).inspect();
      return;
    } catch (error: any) {
      const formatted = this.formatErrorForLogging(error);
      const notFound =
        (typeof error?.statusCode === 'number' && error.statusCode === 404) ||
        /not\s+found/i.test(formatted) ||
        /no such image/i.test(formatted);
      if (!notFound) {
        throw new Error(`Unable to inspect Docker image ${imageName}: ${formatted}`);
      }
    }

    logger.info(`⬇️  [Docker ${this.config.name}] Pulling image ${imageName} (not found locally)`);

    await new Promise<void>((resolve, reject) => {
      docker.pull(imageName, (err, stream) => {
        if (err || !stream) {
          reject(
            new Error(
              `Failed to pull Docker image ${imageName}: ${this.formatErrorForLogging(err)}`
            )
          );
          return;
        }

        docker.modem.followProgress(
          stream,
          (pullErr) => {
            if (pullErr) {
              reject(
                new Error(
                  `Failed to pull Docker image ${imageName}: ${this.formatErrorForLogging(pullErr)}`
                )
              );
            } else {
              logger.info(`✅ [Docker ${this.config.name}] Pulled image ${imageName}`);
              resolve();
            }
          },
          (event) => {
            if (event?.status) {
              logger.debug(
                `⬇️  [Docker ${this.config.name}] ${imageName}: ${event.status}${
                  event.progress ? ` ${event.progress}` : ''
                }`
              );
            }
          }
        );
      });
    });
  }

  private buildDockerCreateOptions(params: {
    containerArgs: string[];
    containerName?: string;
    removeOnExit: boolean;
  }): { options: Docker.ContainerCreateOptions; unsupported: string[] } {
    const { containerArgs, containerName, removeOnExit } = params;
    const envFromConfig: string[] = [];
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        envFromConfig.push(`${key}=${value}`);
      }
    }

    const options: Docker.ContainerCreateOptions = {
      Image: this.config.image!,
      name: containerName,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: false,
      Tty: false,
      Env: [],
      HostConfig: {
        AutoRemove: removeOnExit,
        Binds: [],
        Mounts: []
      }
    };

    if (this.config.dockerCommand?.length) {
      options.Cmd = [...this.config.dockerCommand];
    }

    const env: string[] = [...envFromConfig];
    const hostConfig = options.HostConfig!;
    const unsupported: string[] = [];

    const args = [...containerArgs];
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      switch (arg) {
        case '--rm':
          hostConfig.AutoRemove = true;
          break;
        case '-i':
        case '--interactive':
          break;
        case '-t':
        case '--tty':
          options.Tty = true;
          break;
        case '--mount': {
          const spec = args[i + 1];
          if (!spec) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          const mount = this.parseMountSpec(spec);
          if (mount) {
            hostConfig.Mounts = hostConfig.Mounts || [];
            hostConfig.Mounts.push(mount);
          } else {
            unsupported.push(`${arg}=${spec}`);
          }
          break;
        }
        case '-v':
        case '--volume': {
          const spec = args[i + 1];
          if (!spec) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.Binds = hostConfig.Binds || [];
          hostConfig.Binds.push(spec);
          break;
        }
        case '--tmpfs': {
          const spec = args[i + 1];
          if (!spec) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          const tmpfsConfig = (hostConfig.Tmpfs ?? {}) as Record<string, string>;
          const [target, opts] = spec.split(':');
          if (target) {
            tmpfsConfig[target] = opts ?? '';
            hostConfig.Tmpfs = tmpfsConfig;
          } else {
            unsupported.push(`${arg}=${spec}`);
          }
          break;
        }
        case '-e':
        case '--env': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          env.push(value);
          break;
        }
        case '--env-file': {
          const file = args[i + 1];
          if (!file) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          try {
            const fileEnv = this.parseEnvFile(file);
            env.push(...fileEnv);
          } catch (error) {
            unsupported.push(`${arg}=${file} (${error instanceof Error ? error.message : String(error)})`);
          }
          break;
        }
        case '--network': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.NetworkMode = value;
          break;
        }
        case '--user':
        case '-u': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          options.User = value;
          break;
        }
        case '--workdir':
        case '-w': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          options.WorkingDir = value;
          break;
        }
        case '--entrypoint': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          options.Entrypoint = value.split(' ').filter(Boolean);
          break;
        }
        case '--privileged':
          hostConfig.Privileged = true;
          break;
        case '--gpus': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.DeviceRequests = hostConfig.DeviceRequests || [];
          if (value === 'all') {
            hostConfig.DeviceRequests.push({
              Count: -1,
              Capabilities: [['gpu']]
            });
          } else if (value.startsWith('device=')) {
            const ids = value.slice('device='.length).split(',').map((v) => v.trim()).filter(Boolean);
            hostConfig.DeviceRequests.push({
              Capabilities: [['gpu']],
              DeviceIDs: ids
            });
          } else {
            const count = Number.parseInt(value, 10);
            if (Number.isNaN(count)) {
              unsupported.push(`${arg}=${value}`);
            } else {
              hostConfig.DeviceRequests.push({
                Count: count,
                Capabilities: [['gpu']]
              });
            }
          }
          break;
        }
        case '--shm-size': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          const parsed = this.parseByteSize(value);
          if (parsed !== null) {
            hostConfig.ShmSize = parsed;
          } else {
            unsupported.push(`${arg}=${value}`);
          }
          break;
        }
        case '--add-host': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.ExtraHosts = hostConfig.ExtraHosts || [];
          hostConfig.ExtraHosts.push(value);
          break;
        }
        case '--security-opt': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.SecurityOpt = hostConfig.SecurityOpt || [];
          hostConfig.SecurityOpt.push(value);
          break;
        }
        case '--sysctl': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          const sysctls = (hostConfig.Sysctls ?? {}) as Record<string, string>;
          const [sysctlKey, sysctlValue] = value.split('=');
          if (sysctlKey && sysctlValue !== undefined) {
            sysctls[sysctlKey] = sysctlValue;
            hostConfig.Sysctls = sysctls;
          } else {
            unsupported.push(`${arg}=${value}`);
          }
          break;
        }
        case '--cap-add':
        case '--cap-drop': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          if (arg === '--cap-add') {
            hostConfig.CapAdd = hostConfig.CapAdd ? [...hostConfig.CapAdd, value] : [value];
          } else {
            hostConfig.CapDrop = hostConfig.CapDrop ? [...hostConfig.CapDrop, value] : [value];
          }
          break;
        }
        case '--ipc': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.IpcMode = value;
          break;
        }
        case '--pid': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          hostConfig.PidMode = value;
          break;
        }
        case '--name':
          // Name is handled via configuration; skip CLI override
          i += 1;
          break;
        case '--label':
        case '-l': {
          const value = args[i + 1];
          if (!value) {
            unsupported.push(arg);
            break;
          }
          i += 1;
          options.Labels = options.Labels || {};
          const [labelKey, labelValue] = value.split('=');
          if (labelKey) {
            options.Labels[labelKey] = labelValue ?? '';
          }
          break;
        }
        default:
          if (arg.startsWith('-')) {
            unsupported.push(arg);
            if (arg.includes('=')) {
              // value already embedded
            }
          } else {
            unsupported.push(arg);
          }
          break;
      }
    }

    const uniqueEnv = Array.from(new Set(env));
    if (uniqueEnv.length > 0) {
      options.Env = uniqueEnv;
    } else {
      delete options.Env;
    }

    if (hostConfig.Binds && hostConfig.Binds.length === 0) {
      delete hostConfig.Binds;
    }

    if (hostConfig.Mounts && hostConfig.Mounts.length === 0) {
      delete hostConfig.Mounts;
    }

    if (hostConfig.DeviceRequests && hostConfig.DeviceRequests.length === 0) {
      delete hostConfig.DeviceRequests;
    }

    if (hostConfig.ExtraHosts && hostConfig.ExtraHosts.length === 0) {
      delete hostConfig.ExtraHosts;
    }

    if (hostConfig.SecurityOpt && hostConfig.SecurityOpt.length === 0) {
      delete hostConfig.SecurityOpt;
    }

    if (hostConfig.CapAdd && hostConfig.CapAdd.length === 0) {
      delete hostConfig.CapAdd;
    }

    if (hostConfig.CapDrop && hostConfig.CapDrop.length === 0) {
      delete hostConfig.CapDrop;
    }

    if (hostConfig.Tmpfs && Object.keys(hostConfig.Tmpfs).length === 0) {
      delete hostConfig.Tmpfs;
    }

    if (options.Cmd && options.Cmd.length === 0) {
      delete options.Cmd;
    }

    return { options, unsupported };
  }

  private parseMountSpec(spec: string): Docker.MountSettings | null {
    const mount: Docker.MountSettings = {
      Type: 'volume',
      Target: '',
      Source: ''
    };

    const parts = spec.split(',').map((segment) => segment.trim()).filter(Boolean);
    for (const part of parts) {
      const [rawKey, rawValue] = part.includes('=') ? part.split('=') : [part, 'true'];
      const key = rawKey.toLowerCase();
      const value = rawValue;

      switch (key) {
        case 'type':
          mount.Type = value as Docker.MountType;
          break;
        case 'source':
        case 'src':
          mount.Source = value;
          break;
        case 'target':
        case 'dst':
        case 'destination':
          mount.Target = value;
          break;
        case 'readonly':
        case 'ro':
          mount.ReadOnly = true;
          break;
        case 'rw':
          mount.ReadOnly = false;
          break;
        case 'consistency':
          mount.Consistency = value as Docker.MountConsistency;
          break;
        case 'propagation':
          mount.BindOptions = {
            Propagation: value as Docker.MountPropagation
          };
          break;
        default:
          break;
      }
    }

    if (!mount.Target) {
      return null;
    }

    if (mount.Type === 'bind' && !mount.Source) {
      return null;
    }

    return mount;
  }

  private parseEnvFile(filePath: string): string[] {
    try {
      const contents = readFileSync(filePath, 'utf-8');
      return contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    } catch (error) {
      throw new Error(this.formatErrorForLogging(error));
    }
  }

  private parseByteSize(value: string): number | null {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)([kKmMgGtTpPeE]?)[bB]?$/);
    if (!match) {
      return null;
    }
    const numeric = Number.parseFloat(match[1]);
    if (Number.isNaN(numeric)) {
      return null;
    }

    const unit = match[2].toUpperCase();
    const multipliers: Record<string, number> = {
      '': 1,
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
      P: 1024 ** 5,
      E: 1024 ** 6
    };

    const multiplier = multipliers[unit];
    if (!multiplier) {
      return null;
    }

    return Math.floor(numeric * multiplier);
  }

  private computeDockerConfigSignature(options: Docker.ContainerCreateOptions): string {
    const hostConfig = options.HostConfig || {};
    const sortedMounts = (hostConfig.Mounts || [])
      .map((mount) => ({
        Type: mount.Type,
        Source: mount.Source,
        Target: mount.Target,
        ReadOnly: mount.ReadOnly ?? false,
        Consistency: mount.Consistency || '',
        Propagation: mount.BindOptions?.Propagation || ''
      }))
      .sort((a, b) => `${a.Type}:${a.Source}:${a.Target}`.localeCompare(`${b.Type}:${b.Source}:${b.Target}`));

    const sortedBinds = (hostConfig.Binds || []).slice().sort();

    const sortedEnv = (options.Env || []).slice().sort();
    const entrypoint = Array.isArray(options.Entrypoint) ? options.Entrypoint : options.Entrypoint ? [options.Entrypoint] : [];
    const cmd = Array.isArray(options.Cmd) ? options.Cmd : options.Cmd ? [options.Cmd] : [];

    const payload = {
      image: options.Image,
      env: sortedEnv,
      mounts: sortedMounts,
      binds: sortedBinds,
      networkMode: hostConfig.NetworkMode || '',
      privileged: !!hostConfig.Privileged,
      user: options.User || '',
      workingDir: options.WorkingDir || '',
      entrypoint,
      cmd
    };

    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }

  private async findManagedDockerContainer(containerName: string): Promise<{
    container: Docker.Container;
    inspect: Docker.ContainerInspectInfo;
  } | null> {
    const docker = this.getDockerClient();
    try {
      const container = docker.getContainer(containerName);
      const inspect = await container.inspect();
      const labels = inspect.Config?.Labels || {};
      if (
        labels['simple-rpc-ai-backend.managed'] === 'true' &&
        labels['simple-rpc-ai-backend.server'] === this.config.name
      ) {
        return { container, inspect };
      }
    } catch (error) {
      const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode as number : undefined;
      if (statusCode !== 404) {
        logger.debug(
          `ℹ️  [Docker ${this.config.name}] Unable to inspect container ${containerName}: ${this.formatErrorForLogging(error)}`
        );
      }
    }
    return null;
  }

  private async safeStopContainer(container: Docker.Container): Promise<void> {
    try {
      await container.stop({ t: 0 });
    } catch (error) {
      const rawStatus = (error as any)?.statusCode;
      const statusCode = typeof rawStatus === 'number' ? rawStatus : undefined;
      if (statusCode !== 304 && statusCode !== 404) {
        logger.debug(
          `ℹ️  [Docker ${this.config.name}] Failed to stop container ${container.id}: ${this.formatErrorForLogging(error)}`
        );
      }
    }
  }

  private async safeRemoveContainer(container: Docker.Container): Promise<void> {
    try {
      await container.remove({ force: true });
    } catch (error) {
      const rawStatus = (error as any)?.statusCode;
      const statusCode = typeof rawStatus === 'number' ? rawStatus : undefined;
      if (statusCode !== 404) {
        logger.debug(
          `ℹ️  [Docker ${this.config.name}] Failed to remove container ${container.id}: ${this.formatErrorForLogging(error)}`
        );
      }
    }
  }

  private async stopAndCleanupDockerContainer(
    container: Docker.Container,
    options: { remove: boolean; autoRemove: boolean }
  ): Promise<void> {
    await this.safeStopContainer(container);
    if (options.remove) {
      await this.safeRemoveContainer(container);
    }
  }

  private async ensureDockerAccessibility(docker: Docker): Promise<void> {
    // Attempt to ping the daemon; on failure fall back through detected sockets.
    /* eslint-disable no-constant-condition */
    while (true) {
      try {
        await docker.ping();
        return;
      } catch (error) {
        if (this.tryAdvanceDockerCandidate(error)) {
          docker = this.getDockerClient();
          continue;
        }

        const errno = (error as NodeJS.ErrnoException)?.code;
        const formatted = this.formatErrorForLogging(error);
        if (errno === 'EACCES') {
          const candidate = this.getCurrentDockerCandidate();
          const socketPath =
            (await this.resolveDockerSocketPath(docker)) ||
            candidate?.description ||
            process.env.DOCKER_HOST ||
            '/var/run/docker.sock';
          throw new Error(
            `Permission denied accessing Docker socket (${socketPath}). Add the current user to the Docker group or adjust permissions. Details: ${formatted}`
          );
        }
        throw new Error(`Unable to reach Docker daemon: ${formatted}`);
      }
    }
    /* eslint-enable no-constant-condition */
  }

  private async resolveDockerSocketPath(docker: Docker): Promise<string | null> {
    const modem = (docker as any)?.modem;
    if (!modem) return null;
    const raw = modem.socketPath ?? modem.host;
    if (typeof raw === 'string') {
      return raw;
    }
    if (typeof raw === 'function') {
      try {
        const result = raw();
        if (typeof result === 'string') {
          return result;
        }
        if (result && typeof result.then === 'function') {
          const awaited = await result;
          if (typeof awaited === 'string') {
            return awaited;
          }
        }
      } catch {
        // Ignore and fall back to default
      }
    }
    return null;
  }

  /**
   * Connect via HTTP/HTTPS
   */
  private async connectViaHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('http/https transport requires url');
    }

    const safeUrl = this.formatUrlForLogging(this.config.url);

    // HTTP transport doesn't need a process
    // Validate the URL is accessible
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',  // Required for SSE-capable servers like Smithery
        ...(this.config.headers || {})
      };

      if (this.config.auth) {
        if (this.config.auth.type === 'bearer' && this.config.auth.token) {
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
        } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
          const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'simple-rpc-ai-backend-remote-client',
              version: '1.0.0'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP connection failed: ${response.status} ${response.statusText}`);
      }

      // MCP spec requires sending notifications/initialized after successful initialize
      // This is a notification (no id, no response expected)
      await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {}
        })
      }).catch(() => {
        // Ignore errors from notification - it's fire-and-forget
      });
      // Mark as connected and start ping if enabled
      this.connected = true;
    } catch (error) {
      const formattedError = this.formatErrorForLogging(error);
      throw new Error(`Failed to connect to ${safeUrl}: ${formattedError}`);
    }
  }

  /**
   * Connect via Streamable HTTP transport using official MCP SDK
   * Used for stateful HTTP-based MCP servers like Smithery
   */
  private async connectViaStreamableHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('streamableHttp transport requires url');
    }

    const safeUrl = this.formatUrlForLogging(this.config.url);
    logger.debug(`🔌 [StreamHTTP ${this.config.name}] Starting connection to ${safeUrl}`);

    try {
      // Create transport with optional headers
      const transportOptions: any = {};
      if (this.config.headers) {
        transportOptions.headers = this.config.headers;
      }

      // Create StreamableHTTPClientTransport from official SDK
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url),
        transportOptions
      );

      // Create MCP client
      this.mcpClient = new Client({
        name: 'simple-rpc-ai-backend-remote-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      logger.debug(`🔗 [StreamHTTP ${this.config.name}] Connecting via official MCP SDK...`);

      // Connect to the server
      await this.mcpClient.connect(transport);

      logger.info(`✅ [StreamHTTP ${this.config.name}] Connected successfully`);

      // Fetch and cache tools list
      const toolsResult = await this.mcpClient.listTools();
      this.cachedTools = toolsResult;
      logger.debug(`📋 [StreamHTTP ${this.config.name}] Cached ${toolsResult.tools?.length || 0} tools`);

      // Mark as connected
      this.connected = true;

    } catch (error) {
      const formattedError = this.formatErrorForLogging(error);
      logger.error(`❌ [StreamHTTP ${this.config.name}] Connection error: ${formattedError}`);
      if (error instanceof Error && error.stack) {
        const [firstLine, ...rest] = error.stack.split('\n');
        const sanitizedFirstLine = this.formatErrorForLogging(firstLine);
        const limitedStack = [sanitizedFirstLine, ...rest.slice(0, 20)].join('\n');
        logger.debug(`📚 [StreamHTTP ${this.config.name}] Stack trace:\n${limitedStack}`);
      }
      throw new Error(`Failed to connect via streamableHttp to ${safeUrl}: ${formattedError}`);
    }
  }




  /**
   * Setup process event handlers for stdio-based transports
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    let buffer = '';

    this.process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON-RPC messages (line-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: MCPMessage = JSON.parse(line);
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse message: ${line}`));
          }
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString());
    });

    this.process.on('exit', (code) => {
      this.connected = false;
      this.emit('disconnected', code);

      // Reject all pending requests
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [_, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Process exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming MCP message
   */
  private handleMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification or request from server
      this.emit('notification', message);
    }
  }

  /**
   * Start ping/keepalive mechanism if enabled in config
   */
  // private startPing() {
  //   // Check if ping is enabled in the config
  //   const pingConfig = this.config.ping;
  //   if (!pingConfig || !pingConfig.enabled) {
  //     return;
  //   }

  //   const intervalMs = pingConfig.intervalMs || 25000; // Default: 25 seconds
  //   const logLevel = pingConfig.logLevel || 'info';

  //   if (logLevel === 'info' || logLevel === 'debug') {
  //     console.log(`📡 [SSE ${this.config.name}] Starting ping mechanism, interval: ${intervalMs}ms`);
  //   }

  //   // Clear any existing ping interval
  //   if (this.pingIntervalId) {
  //     clearInterval(this.pingIntervalId);
  //   }

  //   this.pingIntervalId = setInterval(async () => {
  //     if (!this.connected) {
  //       if (logLevel === 'debug') {
  //         console.log(`⏸️ [SSE ${this.config.name}] Client not connected, skipping ping`);
  //       }
  //       return;
  //     }

  //     try {
  //       if (logLevel === 'debug') {
  //         console.log(`📡 [SSE ${this.config.name}] Sending ping...`);
  //       }
        
  //       // Send a ping request to keep the connection alive
  //       await this.request('ping', {});
        
  //       this.lastPingTime = Date.now();
        
  //       if (logLevel === 'info' || logLevel === 'debug') {
  //         console.log(`✅ [SSE ${this.config.name}] Ping successful`);
  //       }
  //     } catch (error) {
  //       if (logLevel === 'warn' || logLevel === 'error' || logLevel === 'info') {
  //         console.warn(`❌ [SSE ${this.config.name}] Ping failed:`, error instanceof Error ? error.message : String(error));
  //       }
        
  //       // Ping failure might indicate connection issues, but we don't disconnect
  //       // since other requests might still work
  //     }
  //   }, intervalMs);
  // }
  // /**
  //  * Stop ping/keepalive mechanism
  //  */
  // private stopPing() {
  //   if (this.pingIntervalId) {
  //     if (this.config.ping?.logLevel !== 'debug') {
  //       console.log(`📡 [SSE ${this.config.name}] Stopping ping mechanism`);
  //     }
  //     clearInterval(this.pingIntervalId);
  //     this.pingIntervalId = null;
  //   }
  // }
  /**
   * Wait for the server to be ready
   */
  private async waitForReady(timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const label = this.config.transport === 'uvx'
        ? 'UVX'
        : (this.config.transport === 'npx' || this.config.transport === 'npm-exec')
          ? 'NodePkg'
          : this.config.transport === 'docker'
            ? 'Docker'
            : 'Process';

      const readyTimeout = timeout ?? this.config.timeout ?? 30000;
      const timer = setTimeout(() => {
        cleanup();
        logger.warn(`⚠️  [${label} ${this.config.name}] Ready signal timeout after ${readyTimeout}ms`);
        reject(new Error('Connection timeout'));
      }, readyTimeout);

      const cleanup = () => {
        clearTimeout(timer);
        if (this.process) {
          this.process.stdout?.removeListener('data', onStdoutData);
          this.process.stderr?.removeListener('data', onStderrData);
          this.process.removeListener('exit', onExit);
        }
      };

      const markReady = (source: 'stdout' | 'stderr') => {
        cleanup();
        logger.debug(`✅ [${label} ${this.config.name}] Ready signal received from ${source}`);
        resolve();
      };

      const onStdoutData = (data: Buffer) => {
        if (data?.toString().trim().length > 0) {
          markReady('stdout');
        }
      };

      const onStderrData = (data: Buffer) => {
        if (data?.toString().trim().length > 0) {
          markReady('stderr');
        }
      };

      const onExit = (code?: number) => {
        cleanup();
        reject(new Error(`Process exited before ready (code ${code ?? 'unknown'})`));
      };

      // For process-based transports, wait for first output
      if (this.process) {
        this.process.stdout?.on('data', onStdoutData);
        this.process.stderr?.on('data', onStderrData);
        this.process.once('exit', onExit);
      } else {
        // For HTTP, already validated in connectViaHttp
        cleanup();
        resolve();
      }
    });
  }

  /**
   * Send a request to the MCP server
   */
  async request(method: string, params?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // For streamable HTTP transport using SDK, use the SDK client methods directly
    if (this.config.transport === 'streamableHttp' && this.mcpClient) {
      // The SDK client handles the request internally
      // This method shouldn't be called directly for streamable HTTP - use specific methods like listTools(), callTool()
      throw new Error('For streamableHttp transport, use specific methods like listTools() or callTool()');
    }

    const id = ++this.messageId;
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    if (this.config.transport === 'http' || this.config.transport === 'https') {
      return this.sendHttpRequest(message);
    } else {
      return this.sendStdioRequest(message);
    }
  }

  /**
   * Send request via HTTP
   */
  private async sendHttpRequest(message: MCPMessage): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',  // Required for SSE-capable servers like Smithery
      ...(this.config.headers || {})
    };

    if (this.config.auth) {
      if (this.config.auth.type === 'bearer' && this.config.auth.token) {
        headers['Authorization'] = `Bearer ${this.config.auth.token}`;
      } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
        const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
    }

    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    const result: MCPMessage = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Send request via stdio
   */
  private async sendStdioRequest(message: MCPMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(message) + '\n';
      const stdin = this.process?.stdin;

      if (!stdin || !stdin.writable) {
        reject(new Error('Stdin stream is not writable'));
        return;
      }

      if (message.id === undefined || message.id === null) {
        this.writeToProcessStdin(payload)
          .then(() => resolve(undefined))
          .catch((error) => {
            const formatted = this.formatErrorForLogging(error);
            logger.warn(
              `⚠️  [${this.getTransportLabel()} ${this.config.name}] Fire-and-forget write failed: ${formatted}`
            );
            reject(error);
          });
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id!);
        reject(new Error('Request timeout'));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(message.id!, { resolve, reject, timeout });
      this.writeToProcessStdin(payload).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(message.id!);
        reject(error);
      });
    });
  }

  /**
   * Write to the underlying stdio stream, handling backpressure and errors.
   */
  private writeToProcessStdin(payload: string): Promise<void> {
    const stdin = this.process?.stdin;
    if (!stdin || !stdin.writable) {
      return Promise.reject(new Error('Stdin stream is not writable'));
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        stdin.removeListener('error', onError);
        stdin.removeListener('drain', onDrain);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onDrain = () => {
        cleanup();
        resolve();
      };

      stdin.once('error', onError);

      const flushed = stdin.write(payload, (err) => {
        if (err) {
          cleanup();
          reject(err);
        }
      });

      if (flushed) {
        cleanup();
        resolve();
      } else {
        stdin.once('drain', onDrain);
      }
    });
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: any): Promise<any> {
    // For SSE transport using SDK, use the SDK client
    if (this.config.transport === 'streamableHttp' && this.mcpClient) {
      logger.debug(`🔧 [StreamHTTP ${this.config.name}] Calling tool: ${name}`);
      return this.mcpClient.callTool({ name, arguments: args });
    }

    return this.request('tools/call', { name, arguments: args });
  }

  private getTransportLabel(): string {
    switch (this.config.transport) {
      case 'docker':
        return 'Docker';
      case 'npx':
      case 'npm-exec':
        return 'NodePkg';
      case 'uvx':
        return 'UVX';
      case 'streamableHttp':
        return 'StreamHTTP';
      default:
        return 'Process';
    }
  }

  /**
   * List available tools
   * For streamable HTTP transport, returns cached tools from initialization
   */
  async listTools(): Promise<any> {
    // For streamable HTTP, return cached tools from initialization
    const cacheIsFresh = this.cachedTools && (Date.now() - this.cachedToolsTimestamp) < 1000;
    if (cacheIsFresh) {
      logger.debug(`📋 [${this.getTransportLabel()} ${this.config.name}] Returning cached tools list (${this.cachedTools.tools?.length || 0} tools)`);
      return this.cachedTools;
    }

    if (this.config.transport === 'streamableHttp' && this.cachedTools) {
      logger.debug(`📋 [StreamHTTP ${this.config.name}] Returning cached tools list (${this.cachedTools.tools?.length || 0} tools)`);
      return this.cachedTools;
    }

    // For other transports or if cache is empty, make a request
    const result = await this.request('tools/list');
    if (Array.isArray(result?.tools)) {
      const toolNames = result.tools.map((tool: any) => tool.name).filter(Boolean);
      logger.debug(`📋 [NodePkg ${this.config.name}] tools/list returned ${toolNames.length} tool(s)${toolNames.length ? `: ${toolNames.join(', ')}` : ''}`);
    }
    this.cachedTools = result;
    this.cachedToolsTimestamp = Date.now();
    return result;
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    if (this.process) {
      const processAny = this.process as any;
      if (typeof processAny.dispose === 'function') {
        await processAny.dispose();
      } else {
        this.process.kill();
      }
      this.process = null;
      this.containerId = null;
    }

    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }

    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a remote MCP client from config
 */
export function createRemoteMCPClient(config: RemoteMCPServerConfig): RemoteMCPClient {
  return new RemoteMCPClient(config);
}

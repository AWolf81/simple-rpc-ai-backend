import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';
import { RemoteMCPClient, createRemoteMCPClient } from '../../src/mcp/remote-mcp-client';
import * as nodePackageRunner from '../../src/utils/node-package-runner';

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn(),
    spawnSync: vi.fn()
  };
});

function createMockProcess(overrides: Record<string, unknown> = {}) {
  const mockProcess: any = new EventEmitter();
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = Object.assign(new EventEmitter(), {
    write: vi.fn().mockReturnValue(true),
    writable: true
  });
  mockProcess.kill = vi.fn();
  return Object.assign(mockProcess, overrides);
}

describe('RemoteMCPClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should throw for unsupported transport', async () => {
    const client = createRemoteMCPClient({
      name: 'invalid',
      transport: 'docker' as any,
      autoStart: false
    });

    await expect(client.connect()).rejects.toThrow('docker transport requires image');
  });

  it('should initialize SSE transport and cache tools', async () => {
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockListTools = vi.fn().mockResolvedValue({ tools: [{ name: 'tool', description: 'desc' }] });
    const mockClose = vi.fn();
    const mockClient = function () {
      this.connect = mockConnect;
      this.listTools = mockListTools;
      this.callTool = vi.fn();
      this.close = mockClose;
    };

    vi.doMock('@modelcontextprotocol/sdk/client/index.js', () => ({
      Client: mockClient
    }));

    const mockTransportConstructor = vi.fn().mockImplementation(() => ({}));
    vi.doMock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
      StreamableHTTPClientTransport: mockTransportConstructor
    }));

    const { RemoteMCPClient: MockedClient } = await import('../../src/mcp/remote-mcp-client');

    const client = new MockedClient({
      name: 'sse-client',
      transport: 'streamableHttp',
      url: 'https://example.com/mcp',
      autoStart: true
    });

    await client.connect();

    expect(mockTransportConstructor).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
    expect(mockListTools).toHaveBeenCalled();
    expect(client.isConnected()).toBe(true);

    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(1);
  });

  it('should fall back to HTTP request for listTools', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ result: { tools: [{ name: 'http-tool' }] } })
      } as any);
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({})
    } as any));

    globalThis.fetch = fetchMock;

    const client = new RemoteMCPClient({
      name: 'http-client',
      transport: 'http',
      url: 'https://example.com/mcp'
    });

    await client.connect();
    const tools = await client.listTools();

    expect(fetchMock).toHaveBeenCalled();
    expect(tools.tools).toHaveLength(1);

    globalThis.fetch = originalFetch;
  });

  it('should sanitize URLs for logging when parse fails', async () => {
    const client = new RemoteMCPClient({
      name: 'logger-test',
      transport: 'http',
      url: 'https://example.com'
    });

    const sanitized = (client as any).formatUrlForLogging('not-a-url?token=secret');
    expect(sanitized).toBe('not-a-url');
  });

  it('should throw when requesting while disconnected', async () => {
    const client = new RemoteMCPClient({
      name: 'request-test',
      transport: 'http',
      url: 'https://example.com'
    });

    await expect(client.request('tools/list')).rejects.toThrow('Not connected');
  });

  it('should delegate HTTP request when connected', async () => {
    const client = new RemoteMCPClient({
      name: 'http-request',
      transport: 'http',
      url: 'https://example.com'
    });

    (client as any).connected = true;
    const sendHttpSpy = vi.spyOn(client as any, 'sendHttpRequest').mockResolvedValue({ tools: [] });

    const result = await client.request('tools/list');
    expect(sendHttpSpy).toHaveBeenCalledWith(expect.objectContaining({ method: 'tools/list' }));
    expect(result).toEqual({ tools: [] });
  });

  it('should throw when HTTP response is not ok', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Error'
    } as any);
    globalThis.fetch = fetchMock;

    const client = new RemoteMCPClient({
      name: 'error-http',
      transport: 'http',
      url: 'https://example.com'
    });

    await expect((client as any).sendHttpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    })).rejects.toThrow('HTTP request failed: 500 Internal Error');

    globalThis.fetch = originalFetch;
  });

  it('should close resources on disconnect', async () => {
    const client = new RemoteMCPClient({
      name: 'disconnect-test',
      transport: 'streamableHttp',
      url: 'https://example.com'
    });

    (client as any).process = {
      kill: vi.fn(),
      stdout: null
    };
    const closeMock = vi.fn();
    (client as any).mcpClient = { close: closeMock };
    (client as any).connected = true;

    await client.disconnect();

    expect((client as any).process).toBeNull();
    expect(closeMock).toHaveBeenCalled();
    expect((client as any).mcpClient).toBeNull();
    expect(client.isConnected()).toBe(false);
  });

  it('should call streamable client for tool execution', async () => {
    const client = new RemoteMCPClient({
      name: 'stream-call',
      transport: 'streamableHttp',
      url: 'https://example.com'
    });

    (client as any).mcpClient = { callTool: vi.fn().mockResolvedValue({}) };
    (client as any).connected = true;

    await client.callTool('test-tool', { foo: 'bar' });
    expect((client as any).mcpClient.callTool).toHaveBeenCalledWith({ name: 'test-tool', arguments: { foo: 'bar' } });
  });

  it('should connect via npx transport with runnerArgs', async () => {
    vi.spyOn(nodePackageRunner, 'resolveNodePackageRunner').mockReturnValue({
      command: 'npx',
      args: [],
      runner: 'npx'
    });
    const mockProcess = createMockProcess();
    const spawnMock = vi.mocked(childProcess.spawn);
    spawnMock.mockReturnValue(mockProcess);

    const client = new RemoteMCPClient({
      name: 'npx-client',
      transport: 'npx',
      command: '@upstash/context7-mcp',
      runnerArgs: ['-y'],
      args: ['--api-key', 'dummy'],
      timeout: 5000
    });

    (client as any).waitForReady = vi.fn().mockResolvedValue(undefined);
    (client as any).postStdioHandshake = vi.fn().mockResolvedValue(undefined);

    const connectPromise = client.connect();
    await connectPromise;

    expect(spawnMock).toHaveBeenCalled();
    const spawnArgs = spawnMock.mock.calls[0][1];
    expect(spawnArgs.slice(0, 3)).toEqual(['-y', '@upstash/context7-mcp', '--api-key']);
    expect((client as any).waitForReady).toHaveBeenCalled();
    expect((client as any).postStdioHandshake).toHaveBeenCalledWith('NodePkg');
    expect(client.isConnected()).toBe(true);
  });

  it('should resolve stdio requests via handleMessage', async () => {
    const client = new RemoteMCPClient({
      name: 'stdio-client',
      transport: 'npx',
      command: 'mcp-cli'
    });

    (client as any).process = { stdin: createMockProcess().stdin };

    const promise = (client as any).sendStdioRequest({
      jsonrpc: '2.0',
      id: 42,
      method: 'ping'
    });

    (client as any).handleMessage({
      jsonrpc: '2.0',
      id: 42,
      result: { ok: true }
    });

    await expect(promise).resolves.toEqual({ ok: true });
  });
});

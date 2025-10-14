import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RemoteMCPManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize and connect to servers', async () => {
    const connectMock = vi.fn().mockResolvedValue(undefined);
    const listToolsMock = vi.fn().mockResolvedValue({ tools: [{ name: 'remote-tool' }] });

    const clientMock = vi.fn().mockImplementation(() => ({
      connect: connectMock,
      listTools: listToolsMock,
      disconnect: vi.fn(),
      isConnected: () => true,
      on: vi.fn(),
      getConfig: () => ({ prefixToolNames: true })
    }));

    vi.doMock('../../src/mcp/remote-mcp-client', () => ({
      createRemoteMCPClient: () => new (clientMock as any)()
    }));

    const { createRemoteMCPManager: mockedCreateManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = mockedCreateManager({
      servers: [
        {
          name: 'test-server',
          transport: 'http',
          url: 'https://example.com/mcp',
          autoStart: true
        }
      ]
    });

    await manager.initialize();

    expect(connectMock).toHaveBeenCalled();
    const tools = await manager.listAllTools();
    const toolList = tools.get('test-server');
    expect(toolList).toHaveLength(1);
    expect(toolList?.[0].prefixToolNames).toBe(true);
  });

  it('should handle disconnected servers when listing tools', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');

    const manager = createRemoteMCPManager({
      servers: []
    });

    (manager as any).clients.set('disconnected', {
      isConnected: () => false
    });

    const tools = await manager.listAllTools();
    expect(tools.size).toBe(0);
  });

  it('should call remote tool via manager', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');

    const callToolMock = vi.fn().mockResolvedValue({ success: true });
    const manager = createRemoteMCPManager({
      servers: []
    });

    (manager as any).clients.set('server', {
      isConnected: () => true,
      callTool: callToolMock
    });

    const result = await manager.callTool('server', 'test-tool', { foo: 'bar' });
    expect(callToolMock).toHaveBeenCalledWith('test-tool', { foo: 'bar' });
    expect(result).toEqual({ success: true });
  });

  it('should throw when calling tool on disconnected server', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');

    const manager = createRemoteMCPManager({
      servers: []
    });

    (manager as any).clients.set('server', {
      isConnected: () => false
    });

    await expect(manager.callTool('server', 'test-tool', {})).rejects.toThrow('Server server is not connected');
  });

  it('should remove server and emit event', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [] });
    const disconnectMock = vi.fn().mockResolvedValue(undefined);

    (manager as any).clients.set('removable', {
      disconnect: disconnectMock
    });
    (manager as any).serverStatus.set('removable', {
      name: 'removable',
      transport: 'http',
      connected: true
    });

    const emitSpy = vi.spyOn(manager as any, 'emit');

    await manager.removeServer('removable');

    expect(disconnectMock).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('serverRemoved', 'removable');
    expect((manager as any).clients.size).toBe(0);
  });

  it('should throw when removing unknown server', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [] });

    await expect(manager.removeServer('missing')).rejects.toThrow('Server missing not found');
  });

  it('should handle errors during listAllTools', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [] });
    const failingError = new Error('list failure');

    (manager as any).clients.set('failing', {
      isConnected: () => true,
      listTools: vi.fn().mockRejectedValue(failingError)
    });

    const emitSpy = vi.spyOn(manager as any, 'emit');

    const result = await manager.listAllTools();
    expect(result.get('failing')).toEqual([]);
    expect(emitSpy).toHaveBeenCalledWith('serverError', {
      server: 'failing',
      error: 'list failure'
    });
  });

  it('should respect global prefixToolNames configuration', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [], prefixToolNames: false });

    (manager as any).clients.set('global', {
      isConnected: () => true,
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'foo' }] }),
      getConfig: () => ({ prefixToolNames: false })
    });

    const tools = await manager.listAllTools();
    const toolList = tools.get('global');
    expect(toolList?.[0].prefixToolNames).toBe(false);
    expect(toolList?.[0].displayName).toBe('foo');
    expect(toolList?.[0].fullName).toBe('global__foo');
  });

  it('should allow per-server prefixToolNames override', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [], prefixToolNames: false });

    (manager as any).clients.set('override', {
      isConnected: () => true,
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'bar' }] }),
      getConfig: () => ({ prefixToolNames: true })
    });

    const tools = await manager.listAllTools();
    const toolList = tools.get('override');
    expect(toolList?.[0].prefixToolNames).toBe(true);
    expect(toolList?.[0].displayName).toBe('override__bar');
    expect(toolList?.[0].fullName).toBe('override__bar');
  });

  it('should expose server status snapshot', async () => {
    const { createRemoteMCPManager } = await import('../../src/mcp/remote-mcp-manager');
    const manager = createRemoteMCPManager({ servers: [] });

    (manager as any).serverStatus.set('status-server', {
      name: 'status-server',
      transport: 'http',
      connected: true,
      lastCheck: new Date()
    });

    const statuses = manager.getServerStatus();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].name).toBe('status-server');
  });
});

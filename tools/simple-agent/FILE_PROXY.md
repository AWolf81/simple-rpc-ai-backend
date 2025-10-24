# File Proxy for Remote Servers

The file proxy enables simple-agent to work with **remote servers** while keeping your files local. This is crucial for security and privacy when using cloud-hosted AI backends.

## How It Works

```
┌─────────────────────────────────────┐
│  Your Machine (simple-agent)        │
│  ├─ Local files in workspace        │
│  ├─ File proxy intercepts requests  │
│  └─ Sends file content to server    │
└──────────────┬──────────────────────┘
               │ HTTPS/tRPC
               ▼
┌─────────────────────────────────────┐
│  Remote Server (cloud)              │
│  ├─ Receives file operations        │
│  ├─ Processes with AI               │
│  └─ NO access to your filesystem    │
└─────────────────────────────────────┘
```

## When Is It Used?

The file proxy is **automatically enabled** when:
- You connect to a remote server URL (not localhost)
- Example: `simple-agent --url https://api.example.com`

The file proxy is **NOT used** when:
- Running with local server (default)
- Connecting to `localhost` or `127.0.0.1`

## Usage Examples

### Remote Server (File Proxy Enabled)

```bash
# Connect to remote server
simple-agent --url https://my-ai-backend.com

# With verbose mode to see proxy activity
simple-agent --url https://my-ai-backend.com --verbose
```

Output:
```
🔗 Connecting to external server: https://my-ai-backend.com
📁 Registering local workspace: /home/you/project
✅ Workspace registered: workspace-1234567890
📁 File proxy enabled for remote server
   Workspace: /home/you/project
   ID: workspace-1234567890
```

### Local Server (No Proxy)

```bash
# Default - uses local server
simple-agent

# Explicit localhost
simple-agent --url http://localhost:8000
```

No file proxy messages - server has direct filesystem access.

## Security Features

### Path Validation
All file operations are validated to ensure they stay within the workspace:

```typescript
// ✅ Allowed
fileProxy.readFile('src/index.ts')         // /workspace/src/index.ts
fileProxy.readFile('./config.json')        // /workspace/config.json

// ❌ Blocked - path traversal attempt
fileProxy.readFile('../../../etc/passwd')  // Error: Access denied
```

### Workspace Isolation
- Only files within the registered workspace can be accessed
- Path traversal attempts are blocked
- Server cannot access arbitrary files on your machine

## Configuration

### Via Command Line

```bash
# Custom workspace directory
simple-agent --url https://remote-server.com
# Uses current working directory by default

# With verbose logging
simple-agent --url https://remote-server.com --verbose
```

### Via Config File

`~/.simple-agent/config.json`:
```json
{
  "serverUrl": "https://my-backend.com",
  "workspaceDir": "/home/you/project"
}
```

## API Methods

The file proxy uses these tRPC methods:

### Register Workspace
```typescript
await client.request('system.registerClientWorkspace', {
  id: 'workspace-123',
  uri: 'file:///home/you/project',
  name: 'My Project',
  description: 'Local workspace proxied by simple-agent'
});
```

### File Operations
```typescript
// List files
fileProxy.listFiles('src')

// Read file
const content = fileProxy.readFile('README.md')

// Write file
fileProxy.writeFile('output.txt', 'Hello World')

// Check existence
const exists = fileProxy.pathExists('package.json')
```

### Cleanup
```typescript
// Automatically called on exit
await client.request('system.unregisterClientWorkspace', {
  id: 'workspace-123'
});
```

## Architecture Details

### MCP Roots vs Server Workspaces

The file proxy implements the **MCP roots** concept:

- **MCP Roots (Client-Managed)** - Your local files exposed via proxy
  - Controlled by simple-agent
  - Registered via `registerClientWorkspace`
  - Server queries via `roots/list` (MCP protocol)

- **Server Workspaces (Server-Managed)** - Server's own directories
  - Configured in server config
  - Direct filesystem access
  - NOT accessible from remote clients

See [docs/WORKSPACE_QUICK_REFERENCE.md](../../docs/WORKSPACE_QUICK_REFERENCE.md) for more details.

## Troubleshooting

### Workspace Not Registered

**Symptom**: File operations fail with "workspace not found"

**Solution**: Check verbose output to verify registration:
```bash
simple-agent --url https://server.com --verbose
```

Look for: `✅ Workspace registered: workspace-xxx`

### Path Access Denied

**Symptom**: `Error: Access denied: Path outside workspace`

**Cause**: Trying to access files outside the registered workspace

**Solution**: Ensure all file paths are relative to workspace root

### Remote Server Can't Find Files

**Symptom**: Server says files don't exist, but they're on your machine

**Cause**: File proxy might not be enabled or failed to initialize

**Solution**:
1. Verify using remote URL (not localhost)
2. Check verbose output for proxy initialization
3. Ensure tRPC methods are available on server

## Performance Considerations

- **File Content Transfer**: Each file read sends content over network
- **Caching**: Currently no caching - each read hits disk and network
- **Large Files**: Be mindful of file sizes - content is sent in requests

## Future Enhancements

Potential improvements:
- File caching to reduce network round-trips
- Batch operations for multiple files
- File watching/syncing capabilities
- Compression for large file transfers
- Binary file support (currently text-only)

## Related Documentation

- [MCP Roots Specification](https://modelcontextprotocol.io/docs/concepts/roots)
- [Workspace Concepts](../../docs/WORKSPACE_QUICK_REFERENCE.md)
- [Server Configuration](../../docs/server-api/configuration.md)

---
layout: default
title: Workspaces
parent: Common Configurations
grand_parent: Documentation
nav_order: 3
---

# Workspaces

Understand the distinction between server-managed workspaces and client-supplied MCP roots to configure access safely.

## Concepts at a Glance

| Aspect | Server Workspaces | MCP Roots |
| --- | --- | --- |
| Owner | Server administrator | Client / end user |
| Configuration | Server config (`serverWorkspaces`) | MCP capability negotiation |
| Purpose | Templates, shared resources, sandbox directories | User project folders |
| Access Control | Enforced by server policies | Granted by the client |
| MCP Role | Not part of `roots/list` | Exposed via `roots/list` |

## Server Workspaces

Server workspaces are directories registered by the server to expose curated content. They are available via tRPC and MCP tools like `getServerWorkspaces`, `listFiles`, and `readFile`.

### Example Configuration

```typescript
const server = createRpcAiServer({
  serverWorkspaces: {
    enableAPI: true,
    templates: {
      path: '/opt/templates',
      name: 'Server Templates',
      description: 'Pre-built project templates',
      readOnly: true,
      allowedExtensions: ['.js', '.ts', '.json', '.md']
    },
    sandbox: {
      path: '/tmp/workspace',
      name: 'Sandbox',
      readOnly: false,
      allowedPaths: ['**/*.txt', '**/*.json'],
      blockedPaths: ['**/node_modules', '**/.git'],
      maxFileSize: 5 * 1024 * 1024,
      followSymlinks: false
    }
  }
});
```

### Security Checklist

- Default to `readOnly: true` unless write access is essential.
- Restrict file types with `allowedExtensions` and `blockedExtensions`.
- Limit path traversal with `allowedPaths` and `blockedPaths`.
- Set `followSymlinks: false` to avoid symlink escapes.
- Impose `maxFileSize` limits for uploads or writes.

## MCP Roots

MCP roots represent client-controlled folders. Clients register them with the server and expose them via the MCP `roots/list` exchange.

```typescript
await client.registerClientWorkspace({
  id: 'project',
  uri: 'file:///home/user/projects/sample',
  name: 'Sample Project'
});

const roots = await server.mcpCall('roots/list');
// Returns client-advertised directories
```

### Best Practices

- Prompt users for explicit consent before sharing directories.
- Validate incoming `file://` URIs on the client side.
- Monitor access patterns and audit when sensitive files are involved.
- Ensure MCP clients advertise the `roots` capability (`{"roots": {"listChanged": true}}`).

## Migration Notes

Legacy `rootFolders` configurations should be replaced with the `serverWorkspaces` structure. Combine server-managed directories with client registrations to achieve the full MCP experience.

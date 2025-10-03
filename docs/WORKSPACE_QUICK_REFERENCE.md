# Server Workspaces vs MCP Roots: Quick Reference

## TL;DR

- **Server Workspaces** = Server admin configures directories for server resources
- **MCP Roots** = Client/user exposes their own directories via MCP protocol
- **Different concepts** = Don't mix them together!

## Quick Comparison

| | Server Workspaces | MCP Roots |
|---|---|---|
| **Who controls it?** | Server admin | Client/user |
| **Where configured?** | Server config file | Client capability + registration |
| **What's it for?** | Templates, shared resources | User projects, documents |
| **MCP protocol role?** | Not part of roots/list | Part of roots/list |
| **Security model?** | Server-side restrictions | Client-side permissions |

## Configuration Cheat Sheet

### Server Workspaces (Secure by Default)

```typescript
const server = createRpcAiServer({
  serverWorkspaces: {
    enabled: true,  // Default: false

    templates: {
      path: '/opt/templates',
      name: 'Server Templates',
      readOnly: true,                         // ✅ Secure default
      allowedExtensions: ['.js', '.md'],      // ✅ Restrict file types
      maxFileSize: 1048576                    // ✅ 1MB limit
    },

    work: {
      path: '/tmp/workspace',
      name: 'Work Area',
      readOnly: false,                        // ✅ Explicit write access
      allowedPaths: ['**/*.txt'],             // ✅ Path restrictions
      blockedPaths: ['**/.*']                 // ✅ Block hidden files
    }
  }
});
```

### MCP Roots (Client Registration)

```typescript
// Client registers their workspace
await client.registerClientWorkspace({
  id: 'my-project',
  uri: 'file:///home/user/projects/my-project',
  name: 'My Project'
});

// MCP protocol flow
const roots = await server.mcpCall('roots/list');
// Returns client-exposed directories
```

## Available Tools by Type

### Server Workspace Tools
- `getServerWorkspaces` - List configured server workspaces
- `listFiles` - List files in server workspace
- `readFile` - Read from server workspace
- `writeFile` - Write to server workspace
- `addServerWorkspace` - Add new server workspace
- `removeServerWorkspace` - Remove server workspace

### MCP Root Tools
- `registerClientWorkspace` - Register client workspace
- `unregisterClientWorkspace` - Remove client workspace
- `listClientWorkspaces` - List registered client workspaces
- `roots/list` (MCP) - Query client for exposed roots

## Security Checklist

### ✅ Server Workspace Security
- [ ] Use `readOnly: true` by default
- [ ] Specify `allowedExtensions`
- [ ] Set `maxFileSize` limits
- [ ] Use `allowedPaths` restrictions
- [ ] Block dangerous paths with `blockedPaths`
- [ ] Set `followSymlinks: false`

### ✅ MCP Root Security
- [ ] Client prompts user for consent
- [ ] Validate file:// URIs
- [ ] Check client capabilities
- [ ] Monitor access patterns
- [ ] Implement proper error handling

## Common Patterns

### Read-Only Resources
```typescript
serverWorkspaces: {
  docs: {
    path: '/company/docs',
    readOnly: true,
    allowedExtensions: ['.md', '.pdf']
  }
}
```

### Sandboxed Work Area
```typescript
serverWorkspaces: {
  sandbox: {
    path: '/tmp/sandbox',
    readOnly: false,
    allowedPaths: ['**/*.txt', '**/*.json'],
    maxFileSize: 5242880  // 5MB
  }
}
```

### Development Environment
```typescript
serverWorkspaces: {
  enabled: true,
  examples: { path: './examples', readOnly: true },
  playground: { path: './playground', readOnly: false }
}
```

## Troubleshooting

### "No workspaces available"
**Problem:** No `serverWorkspaces` configured
**Solution:** Add workspace configuration

### "Access denied"
**Problem:** Too restrictive security settings
**Solution:** Check `readOnly`, `allowedExtensions`, `allowedPaths`

### "MCP roots not working"
**Problem:** Client missing roots capability
**Solution:** Client must send `{"roots": {"listChanged": true}}`

## Migration from Legacy

### Old (Deprecated)
```typescript
rootFolders: {
  defaultFolder: { path: './workspace' },
  additionalFolders: {
    templates: { path: './templates' }
  }
}
```

### New (Recommended)
```typescript
serverWorkspaces: {
  defaultWorkspace: {
    path: './workspace',
    name: 'Default Workspace'
  },
  templates: {
    path: './templates',
    name: 'Templates',
    readOnly: true
  }
}
```

## Key Takeaways

1. **🔐 Security First**: Server workspaces are secure by default (API enabled, but explicit workspace config required)
2. **🎯 Clear Purpose**: Server workspaces = server resources, MCP roots = client folders
3. **📋 MCP Compliance**: Proper roots/list implementation follows MCP specification
4. **🔄 Backward Compatible**: Legacy `rootFolders` still works but is deprecated
5. **🛠️ Rich Tools**: Both patterns have dedicated tools for their specific use cases

---
**See [SERVER_WORKSPACES_VS_MCP_ROOTS.md](./SERVER_WORKSPACES_VS_MCP_ROOTS.md) for detailed documentation.**

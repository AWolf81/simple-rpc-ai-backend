# MCP Advanced Resource Protocols

## Overview

The Simple RPC AI Backend provides an extensible resource system that allows consumers to add support for custom file protocols (SMB, SFTP, HTTP, etc.) without modifying core code. This guide shows how to extend the resource system with custom protocol handlers.

## Table of Contents

1. [Architecture](#architecture)
2. [Basic Usage](#basic-usage)
3. [Protocol Examples](#protocol-examples)
4. [Security Considerations](#security-considerations)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

## Architecture

The resource system uses a plugin-based approach with protocol handlers:

```javascript
// Core API
registerProtocolHandler(protocol, handler, matcher)
addFileResource(id, name, filePath, options)
```

### How It Works

1. **Protocol Detection**: When a file is accessed, the system checks registered protocol handlers first
2. **Handler Execution**: If a protocol matches, its custom handler processes the file
3. **Fallback**: If no handler matches, built-in file system access is used
4. **Error Handling**: Protocol-specific error messages guide users to solutions

## Basic Usage

### Step 1: Register Protocol Handler

```javascript
import { registerProtocolHandler } from 'simple-rpc-ai-backend';

registerProtocolHandler(
  'protocol-name',           // Protocol identifier
  async (filePath) => {      // Handler function
    // Your custom file reading logic
    return fileContent;
  },
  (path) => boolean          // Matcher function
);
```

### Step 2: Use with Resources

```javascript
// Works with any registered protocol
addFileResource('resource-id', 'Display Name', 'protocol://server/path/file.txt', {
  description: 'File accessed via custom protocol',
  category: 'network'
});
```

## Protocol Examples

### SMB Protocol Support

Add support for SMB shares using the `@marsaud/smb2` library:

```javascript
// Install dependency
// npm install @marsaud/smb2

import SMB2 from '@marsaud/smb2';
import { registerProtocolHandler, addFileResource } from 'simple-rpc-ai-backend';

// Register SMB protocol handler
registerProtocolHandler('smb', async (filePath) => {
  // Parse SMB URL: smb://server/share/path/file.txt
  const url = new URL(filePath);
  const server = url.hostname;
  const [, share, ...pathParts] = url.pathname.split('/');
  const relativePath = pathParts.join('/');

  // Create SMB client
  const smb2Client = new SMB2({
    share: `\\\\${server}\\${share}`,
    domain: process.env.SMB_DOMAIN || 'WORKGROUP',
    username: process.env.SMB_USERNAME,
    password: process.env.SMB_PASSWORD
  });

  try {
    const content = await smb2Client.readFile(relativePath, 'utf8');
    await smb2Client.disconnect();
    return content;
  } catch (error) {
    await smb2Client.disconnect();
    throw new Error(`SMB read failed: ${error.message}`);
  }
}, (path) => path.startsWith('smb://'));

// Use SMB resources
addFileResource('network-config', 'Network Configuration',
  'smb://fileserver/configs/network.json', {
    description: 'Network configuration from SMB share',
    category: 'network'
  });
```

### SFTP Protocol Support

Add support for SFTP using the `ssh2-sftp-client` library:

```javascript
// Install dependency
// npm install ssh2-sftp-client

import Client from 'ssh2-sftp-client';
import { registerProtocolHandler } from 'simple-rpc-ai-backend';

registerProtocolHandler('sftp', async (filePath) => {
  // Parse SFTP URL: sftp://user@server/path/file.txt
  const url = new URL(filePath);
  const sftp = new Client();

  try {
    await sftp.connect({
      host: url.hostname,
      port: url.port || 22,
      username: url.username || process.env.SFTP_USERNAME,
      password: process.env.SFTP_PASSWORD,
      privateKey: process.env.SFTP_PRIVATE_KEY ?
        require('fs').readFileSync(process.env.SFTP_PRIVATE_KEY) : undefined
    });

    const content = await sftp.get(url.pathname, null, 'utf8');
    return content;
  } finally {
    await sftp.end();
  }
}, (path) => path.startsWith('sftp://'));

// Use SFTP resources
addFileResource('remote-logs', 'Remote Server Logs',
  'sftp://admin@server.com/var/log/application.log', {
    description: 'Application logs from remote server',
    category: 'logs'
  });
```

### HTTP/HTTPS Protocol Support

Add support for web resources using built-in `fetch`:

```javascript
registerProtocolHandler('http', async (filePath) => {
  const response = await fetch(filePath, {
    headers: {
      'User-Agent': 'Simple-RPC-AI-Backend/1.0',
      'Authorization': process.env.HTTP_AUTH_HEADER
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}, (path) => path.startsWith('http://') || path.startsWith('https://'));

// Use HTTP resources
addFileResource('remote-config', 'Remote Configuration',
  'https://api.example.com/config.json', {
    description: 'Configuration from REST API',
    category: 'api'
  });
```

### Database Protocol Support

Access data from databases as "file" resources:

```javascript
import { Pool } from 'pg';

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

registerProtocolHandler('db', async (filePath) => {
  // Parse database URL: db://table/query-name
  const [, table, queryName] = filePath.replace('db://', '').split('/');

  const queries = {
    'users': 'SELECT * FROM users ORDER BY created_at DESC LIMIT 100',
    'config': 'SELECT key, value FROM app_config WHERE active = true'
  };

  const query = queries[queryName];
  if (!query) {
    throw new Error(`Unknown query: ${queryName}`);
  }

  const result = await dbPool.query(query);
  return JSON.stringify(result.rows, null, 2);
}, (path) => path.startsWith('db://'));

// Use database resources
addFileResource('user-data', 'Recent Users',
  'db://users/users', {
    description: 'Recent user registrations from database',
    category: 'database',
    mimeType: 'application/json'
  });
```

## Security Considerations

### Environment Variables
Store sensitive credentials in environment variables, never in code:

```bash
# .env
SMB_USERNAME=admin
SMB_PASSWORD=secretpassword
SMB_DOMAIN=COMPANY
SFTP_USERNAME=deploy
SFTP_PRIVATE_KEY=/home/user/.ssh/id_rsa
HTTP_AUTH_HEADER=Bearer token123
DATABASE_URL=postgresql://user:pass@localhost/db
```

### Connection Pooling
Reuse connections when possible to avoid resource exhaustion:

```javascript
// Good: Reuse connection pool
const connectionPool = new Map();

registerProtocolHandler('smb', async (filePath) => {
  const server = getServerFromPath(filePath);

  if (!connectionPool.has(server)) {
    connectionPool.set(server, new SMB2({ /* config */ }));
  }

  const client = connectionPool.get(server);
  return await client.readFile(/* ... */);
}, matcher);
```

### Input Validation
Validate and sanitize file paths:

```javascript
registerProtocolHandler('custom', async (filePath) => {
  // Validate path format
  if (!/^custom:\/\/[\w.-]+\/[\w\/.-]+$/.test(filePath)) {
    throw new Error('Invalid custom protocol path format');
  }

  // Prevent path traversal
  if (filePath.includes('..') || filePath.includes('~')) {
    throw new Error('Path traversal not allowed');
  }

  // Your protocol logic here
}, matcher);
```

## Error Handling

### Graceful Degradation
Provide helpful error messages when protocols aren't available:

```javascript
registerProtocolHandler('smb', async (filePath) => {
  try {
    // SMB logic here
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`SMB server unavailable at ${getServerFromPath(filePath)}. Check network connectivity and SMB service status.`);
    }
    if (error.code === 'EACCES') {
      throw new Error(`SMB authentication failed. Check SMB_USERNAME and SMB_PASSWORD environment variables.`);
    }
    throw error;
  }
}, matcher);
```

### Fallback Resources
Provide alternative resources when network resources fail:

```javascript
// Primary resource
addFileResource('config-remote', 'Remote Config',
  'https://api.example.com/config.json');

// Fallback resource
addFileResource('config-local', 'Local Config Backup',
  '/opt/app/config/default.json', {
    description: 'Local configuration backup (use when remote fails)'
  });
```

## Best Practices

### 1. Use Descriptive Protocol Names
```javascript
// Good
registerProtocolHandler('company-smb', handler, matcher);
registerProtocolHandler('staging-api', handler, matcher);

// Less clear
registerProtocolHandler('p1', handler, matcher);
registerProtocolHandler('custom', handler, matcher);
```

### 2. Implement Proper Cleanup
```javascript
registerProtocolHandler('sftp', async (filePath) => {
  const sftp = new Client();
  try {
    await sftp.connect(config);
    return await sftp.get(path);
  } finally {
    await sftp.end(); // Always cleanup
  }
}, matcher);
```

### 3. Add Protocol-Specific Logging
```javascript
registerProtocolHandler('smb', async (filePath) => {
  console.log(`📡 SMB: Reading ${filePath}`);
  const startTime = Date.now();

  try {
    const content = await smbRead(filePath);
    console.log(`✅ SMB: Read ${filePath} (${Date.now() - startTime}ms)`);
    return content;
  } catch (error) {
    console.error(`❌ SMB: Failed ${filePath} - ${error.message}`);
    throw error;
  }
}, matcher);
```

### 4. Handle Large Files
```javascript
registerProtocolHandler('http', async (filePath) => {
  const response = await fetch(filePath);

  // Check file size
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    throw new Error('File too large (>10MB). Use streaming for large files.');
  }

  return await response.text();
}, matcher);
```

## Integration with MCP Resources

Protocol handlers work seamlessly with the MCP resource system:

```javascript
// 1. Register your protocol
registerProtocolHandler('myprotocol', handler, matcher);

// 2. Add resources using your protocol
addFileResource('remote-data', 'Remote Data', 'myprotocol://server/data.json');

// 3. Resources are automatically available via MCP
// - resources/list will show the resource
// - resources/read will use your protocol handler
```

## Conclusion

The extensible protocol system allows you to integrate any file source into your MCP resources without modifying core code. This keeps the base system lightweight while enabling powerful integrations for enterprise environments that need SMB, SFTP, database access, and custom protocols.
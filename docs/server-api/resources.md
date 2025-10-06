---
layout: default
title: Resources
parent: Server API
grand_parent: Documentation
nav_order: 2
---

# Resource Protocols

Extend the backend with custom resource handlers so MCP clients can read files over non-standard transports.

## Architecture

```typescript
registerProtocolHandler(protocol, handler, matcher);
addFileResource(id, name, filePath, options);
```

1. The server checks registered protocol handlers before default file I/O.
2. Matching handlers fetch content using provider-specific logic.
3. If no handler matches, local filesystem access is used.

## Register a Protocol Handler

```typescript
import { registerProtocolHandler } from 'simple-rpc-ai-backend';

registerProtocolHandler(
  'protocol-name',
  async (filePath) => {
    // custom read logic
    return fileContent;
  },
  (path) => boolean
);
```

## Use the Handler with Resources

```typescript
addFileResource('resource-id', 'Display Name', 'protocol://server/path/file.txt', {
  description: 'Resource served over custom protocol',
  category: 'network'
});
```

## Protocol Examples

### SMB

```typescript
import SMB2 from '@marsaud/smb2';
import { registerProtocolHandler } from 'simple-rpc-ai-backend';

registerProtocolHandler('smb', async (filePath) => {
  const url = new URL(filePath);
  const [, share, ...pathParts] = url.pathname.split('/');
  const smb2Client = new SMB2({
    share: `\\\\${url.hostname}\\${share}`,
    domain: process.env.SMB_DOMAIN ?? 'WORKGROUP',
    username: process.env.SMB_USERNAME,
    password: process.env.SMB_PASSWORD
  });

  try {
    const content = await smb2Client.readFile(pathParts.join('/'), 'utf8');
    await smb2Client.disconnect();
    return content;
  } catch (error) {
    await smb2Client.disconnect();
    throw new Error(`SMB read failed: ${error.message}`);
  }
}, (path) => path.startsWith('smb://'));
```

### SFTP

```typescript
import Client from 'ssh2-sftp-client';

registerProtocolHandler('sftp', async (filePath) => {
  const url = new URL(filePath);
  const sftp = new Client();

  try {
    await sftp.connect({
      host: url.hostname,
      port: Number(url.port || 22),
      username: url.username || process.env.SFTP_USERNAME,
      password: process.env.SFTP_PASSWORD,
      privateKey: process.env.SFTP_PRIVATE_KEY
        ? require('fs').readFileSync(process.env.SFTP_PRIVATE_KEY)
        : undefined
    });

    return await sftp.get(url.pathname, null, 'utf8');
  } finally {
    await sftp.end();
  }
}, (path) => path.startsWith('sftp://'));
```

### HTTP/HTTPS

```typescript
registerProtocolHandler('http', async (filePath) => {
  const response = await fetch(filePath, {
    headers: {
      'User-Agent': 'Simple-RPC-AI-Backend/1.0',
      Authorization: process.env.HTTP_AUTH_HEADER
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}, (path) => path.startsWith('http://') || path.startsWith('https://'));
```

## Security Considerations

- Validate hostnames and paths before making network calls.
- Store protocol credentials (SMB, SFTP) in secure secrets management.
- Handle timeouts and retries gracefully to avoid blocking tool calls.
- Log access attempts for auditing without exposing sensitive data.

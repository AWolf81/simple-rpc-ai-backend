---
name: file-handling
description: Read, write, search, and manage files safely within the workspace. Use for file operations, content analysis, and file system tasks.
version: 1.0.0
author: Simple RPC AI Backend Team
license: MIT
capabilities:
  - file-read
  - file-write
  - file-search
  - directory-operations
scripts:
  - path: scripts/safe-read.ts
    runtime: typescript
    description: Safely read file contents with size limits
  - path: scripts/search-files.ts
    runtime: typescript
    description: Search for files matching patterns
  - path: scripts/validate-path.ts
    runtime: typescript
    description: Validate file path is safe and accessible
allowedPaths:
  - /workspace
  - /tmp
---

# File Handling Skill

## Purpose

This skill provides safe file system operations within the workspace directory. It includes validation, size limits, and security checks to prevent unauthorized access.

## Core Operations

### Reading Files

To read a file:
1. Validate the path is within workspace
2. Check file size (< 10MB for direct reading)
3. Read contents and return

Use the `safe-read.ts` script for automatic validation:
```bash
tsx scripts/safe-read.ts <file-path>
```

### Writing Files

To write a file:
1. Validate path is within workspace
2. Create parent directories if needed
3. Write contents with atomic operation
4. Set appropriate permissions

### Searching Files

To search for files:
```bash
tsx scripts/search-files.ts <pattern> [directory]
```

Supports glob patterns like `*.ts`, `**/*.md`, etc.

### Path Validation

Always validate paths before operations:
```bash
tsx scripts/validate-path.ts <path>
```

Returns: `safe` or `unsafe` with reason

## Security Guidelines

1. **Never access paths outside workspace**: All operations restricted to `/workspace` and `/tmp`
2. **Size limits**: Files > 10MB require streaming or chunking
3. **File types**: Validate file extensions for write operations
4. **Permissions**: Read-only for system files, write allowed in workspace

## Example Usage

**Read configuration file:**
```
tsx scripts/safe-read.ts /workspace/config.json
```

**Search for TypeScript files:**
```
tsx scripts/search-files.ts "**/*.ts" /workspace/src
```

**Validate path before operation:**
```
tsx scripts/validate-path.ts /workspace/data/users.json
```

## Error Handling

Scripts return:
- Exit code 0: Success
- Exit code 1: Validation error (path unsafe, file not found, etc.)
- Exit code 2: Operation error (read failed, write failed, etc.)

Error messages always written to stderr for easy parsing.

## Best Practices

1. Always validate paths first
2. Check file size before reading
3. Use atomic writes for safety
4. Handle errors gracefully
5. Log all file operations for audit trail

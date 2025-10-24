---
name: file-handling
description: Read, write, search, and manage files safely within the project root. Use for file operations, content analysis, and file system tasks. Relative paths resolve from project root automatically.
version: 1.0.0
level: 2
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
    args:
      - name: pattern
        description: Glob pattern (first argument) to match file names (e.g. **/*.ts)
        type: string
        required: true
      - name: directory
        description: Base directory (second argument) to search within; defaults to project root
        type: string
  - path: scripts/validate-path.ts
    runtime: typescript
    description: Validate file path is safe and accessible
---

# File Handling Skill

## Purpose

This skill provides safe file system operations within the project root directory. Relative paths are automatically resolved from the project root. It includes validation, size limits, and security checks to prevent unauthorized access.

## Typical Workflows

### Workflow 1: Find and Read a File
When you need to read a file but don't know its exact path:
1. **Search** for the file: Use `search-files.ts` with the filename pattern
2. **Read** the file: Use `safe-read.ts` with the absolute path from search results
3. Never search for the same file twice - use the result from step 1

Example:
```bash
# Step 1: Find the file
tsx scripts/search-files.ts "CLAUDE.md"
# Returns: /home/user/project/CLAUDE.md

# Step 2: Read the file using the path from step 1
tsx scripts/safe-read.ts /home/user/project/CLAUDE.md
```

### Workflow 2: Read a Known File
When you already know the exact path:
- **Skip searching** - directly use `safe-read.ts` with the path

Example:
```bash
tsx scripts/safe-read.ts ./README.md
```

## Core Operations

### Reading Files

To read a file:
1. Validate the path is within project root (relative paths are resolved from project root automatically)
2. Check file size (< 10MB for direct reading)
3. Read contents and return

Use the `safe-read.ts` script for automatic validation:
```bash
tsx scripts/safe-read.ts <file-path>
```

**Path Resolution**:
- Relative paths (e.g., `./CLAUDE.md`, `src/file.ts`) are resolved from the project root
- Absolute paths must be within the project root or `/tmp`
- Do NOT prepend `/workspace` - just use relative paths

### Writing Files

To write a file:
1. Validate path is within project root
2. Create parent directories if needed
3. Write contents with atomic operation
4. Set appropriate permissions

### Searching Files

To search for files:
```bash
tsx scripts/search-files.ts <pattern> [directory]
```

Supports glob patterns like `*.ts`, `**/*.md`, etc.

- Always pass the glob as the first argument and the base directory as the second (if omitted, project root is used).
- The script resolves the directory you supply and then applies the glob pattern relative to that root; do **not** prepend the directory to the pattern.
- Example (project root):
  ```
  tsx scripts/search-files.ts "**/*.ts" ./src
  ```
- Example (tmp via tRPC):
  ```typescript
  await trpc.agents.skills.executeScript.mutate({
    skillId: 'file-handling',
    scriptName: 'scripts/search-files.ts',
    args: ['**/*.py', '/tmp']
  });
  ```
  This returns absolute paths (e.g. `/tmp/test-python.py`) on stdout when matches are found.
- Passing an absolute glob without the directory (e.g. `"/tmp/**/*.py"`) is also supported; the script derives `/tmp` as the base and uses `**/*.py` as the pattern automatically.

### Path Validation

Always validate paths before operations:
```bash
tsx scripts/validate-path.ts <path>
```

Returns: `safe` or `unsafe` with reason

## Security Guidelines

1. **Never access paths outside project root**: All operations restricted to project root and `/tmp`
2. **Size limits**: Files > 10MB require streaming or chunking
3. **File types**: Validate file extensions for write operations
4. **Permissions**: Read-only for system files, write allowed in project root

## Example Usage

**Read configuration file:**
```
tsx scripts/safe-read.ts ./config.json
```
or
```
tsx scripts/safe-read.ts CLAUDE.md
```

**Search for TypeScript files:**
```
tsx scripts/search-files.ts "**/*.ts" ./src
```

**Validate path before operation:**
```
tsx scripts/validate-path.ts ./data/users.json
```

**Important**: Use relative paths (e.g., `./file.txt`, `src/file.ts`, `CLAUDE.md`) which resolve from the project root. Do NOT use `/workspace` prefix.

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

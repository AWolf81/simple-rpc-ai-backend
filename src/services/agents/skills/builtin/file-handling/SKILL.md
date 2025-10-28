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
  - file-delete
  - file-search
  - directory-operations
scripts:
  - path: scripts/read.ts
    runtime: typescript
    description: Read file contents with optional line-based offset and limit
    args:
      - name: file-path
        description: Path to file (relative to project root or absolute)
        type: string
        required: true
      - name: offset
        flag: --offset
        description: Start reading from line number (1-indexed, default 1)
        type: number
      - name: limit
        flag: --limit
        description: Max number of lines to read (default unlimited)
        type: number
      - name: max-size
        flag: --max-size
        description: Max file size in bytes (default 10MB)
        type: number
  - path: scripts/grep.ts
    runtime: typescript
    description: Search for regex patterns in file, returns matching lines with numbers
    args:
      - name: file-path
        description: Path to file to search
        type: string
        required: true
      - name: pattern
        description: Regex pattern to search for
        type: string
        required: true
      - name: context
        flag: --context
        description: Number of context lines before/after match (default 0)
        type: number
      - name: max-matches
        flag: --max-matches
        description: Maximum matches to return (default 100)
        type: number
      - name: case-sensitive
        flag: --case-sensitive
        description: Enable case-sensitive search
        type: boolean
  - path: scripts/write.ts
    runtime: typescript
    description: Write content to a file (creates directories if needed)
    args:
      - name: file-path
        description: Path to file to write
        type: string
        required: true
      - name: content
        description: Content to write to file
        type: string
        required: true
  - path: scripts/delete.ts
    runtime: typescript
    description: Delete a file
    safety:
      level: low
      requiresApproval: true
    args:
      - name: file-path
        description: Path to file to delete
        type: string
        required: true
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
2. **Read** the file: Use `read.ts` with the absolute path from search results

Example:
```bash
# Step 1: Find the file
tsx scripts/search-files.ts "CLAUDE.md"
# Returns: /home/user/project/CLAUDE.md

# Step 2: Read the file (first 20 lines)
tsx scripts/read.ts /home/user/project/CLAUDE.md --limit 20

# Step 3: Read specific section (lines 10-30)
tsx scripts/read.ts /home/user/project/CLAUDE.md --offset 10 --limit 20
```

### Workflow 2: Find Pattern then Read Context
When you want to check if a pattern exists and read the context:
1. **Grep** for pattern: Use `grep.ts` to find if pattern exists
2. **Read** specific lines: Use line numbers from grep output with `read.ts`

Example:
```bash
# Step 1: Find where "TODO" appears
tsx scripts/grep.ts ./file.txt "TODO" --context 2
# Returns: Line 45:> TODO: Fix this bug

# Step 2: Read that section with more context
tsx scripts/read.ts ./file.txt --offset 40 --limit 15
```

### Workflow 3: Read a Known File
When you already know the exact path:
- **Skip searching** - directly use `read.ts` with the path

Example:
```bash
tsx scripts/read.ts ./README.md --limit 50  # First 50 lines
```

## Core Operations

### Reading Files

To read a file:
1. Validate the path is within project root (relative paths are resolved from project root automatically)
2. Check file size and offset validity
3. Read contents with optional offset and limit

Use the `read.ts` script for automatic validation:
```bash
tsx scripts/read.ts <file-path> [--offset <line>] [--limit <lines>] [--max-size <bytes>]

# Examples:
tsx scripts/read.ts ./README.md                      # Read entire file (up to 10MB)
tsx scripts/read.ts ./large-file.log --limit 50      # Read first 50 lines
tsx scripts/read.ts ./data.json --offset 10 --limit 20  # Read lines 10-29
```

### Searching File Content

Use the `grep.ts` script to search for patterns:
```bash
tsx scripts/grep.ts <file-path> <pattern> [--context <lines>] [--max-matches <n>]

# Examples:
tsx scripts/grep.ts ./file.txt "error"                 # Find "error" (case-insensitive)
tsx scripts/grep.ts ./file.txt "TODO" --context 3     # Show 3 lines before/after
tsx scripts/grep.ts ./file.txt "^import" --max-matches 10  # First 10 import statements
tsx scripts/grep.ts ./file.txt "Error" --case-sensitive    # Case-sensitive search
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
tsx scripts/read.ts ./config.json
tsx scripts/read.ts CLAUDE.md --limit 30  # First 30 lines
```

**Search then read:**
```
tsx scripts/grep.ts ./app.ts "function.*login"  # Find login functions
tsx scripts/read.ts ./app.ts --offset 45 --limit 10  # Read that section
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

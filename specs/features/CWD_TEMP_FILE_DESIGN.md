# Working Directory Temporary File System

## Problem

Currently, we use `PROJECT_ROOT` environment variable to communicate the working directory to skill scripts. This has several issues:
1. Pollutes the environment
2. Doesn't support multiple parallel simple-agent instances
3. Environment variables persist across process boundaries

## Solution: Temporary File Approach

Use a temporary file in `/tmp` to store the working directory. Each simple-agent instance gets its own file with a random ID.

### Why Random ID?

From Claude Code issue #8856 (different use case but same principle):
- Supports **multiple parallel instances** with different working directories
- Each instance has isolation - they don't interfere with each other
- Example: `/tmp/simple-agent-abc123-cwd` vs `/tmp/simple-agent-def456-cwd`

### Our Use Case vs Claude Code

**Claude Code (#8856):**
- Appends `pwd -P >| ${tempfile}` to every Bash command
- Tracks where `cd` commands left the shell
- Creates/reads temp file **per command** (needs immediate cleanup)
- Problem: Missing cleanup causes accumulation

**Our Use Case:**
- Create temp file **once per simple-agent session**
- Pass file path to server via config
- Server sets `CWD_FILE` env var for skill scripts
- Scripts read from temp file to get working directory
- Cleanup on **server exit** (not per-command)

### File Format

**File Path:**
```
/tmp/simple-agent-{randomId}-cwd
```

**File Content:**
```
/home/user/project
```
(Just the absolute path, single line)

### Random ID Generation

```typescript
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 8); // 6 chars, e.g., "abc123"
}
```

## Implementation Plan

### 1. CWD Manager Utility

**File:** `tools/simple-agent/src/utils/cwd-manager.ts`

```typescript
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export class CwdManager {
  private filePath: string;
  private cwd: string;

  constructor(cwd: string) {
    const randomId = Math.random().toString(36).substring(2, 8);
    this.filePath = `/tmp/simple-agent-cwd-${randomId}`;
    this.cwd = cwd;
  }

  /**
   * Write CWD to temp file
   */
  initialize(): void {
    writeFileSync(this.filePath, this.cwd, 'utf-8');
  }

  /**
   * Get the temp file path (for passing to server)
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Get the CWD
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * Cleanup temp file
   */
  cleanup(): void {
    if (existsSync(this.filePath)) {
      try {
        unlinkSync(this.filePath);
      } catch (error) {
        console.error(`Failed to cleanup CWD file: ${error}`);
      }
    }
  }
}

/**
 * Read CWD from temp file (for scripts)
 */
export function readCwdFromFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8').trim();
}
```

### 2. Simple-Agent Integration

**File:** `tools/simple-agent/src/cli.ts` (or wherever simple-agent starts)

```typescript
import { CwdManager } from './utils/cwd-manager';

async function main() {
  const workspaceDir = options.workspace || process.cwd();

  // Create CWD manager
  const cwdManager = new CwdManager(workspaceDir);
  cwdManager.initialize();

  // Cleanup on exit
  const cleanup = () => {
    cwdManager.cleanup();
    // ... other cleanup
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  // Start server with CWD file path
  const server = await createRpcAiServer({
    skillsConfig: {
      cwdFilePath: cwdManager.getFilePath()  // Pass file path instead of cwd
    }
  });

  // ... rest of setup
}
```

### 3. Server Configuration

**File:** `src/services/agents/skills/types.ts`

```typescript
export interface SkillsConfig {
  // ... existing config
  cwdFilePath?: string;  // Path to temp file containing CWD
  // OR keep backward compatibility:
  workspaceDir?: string;  // Direct CWD (legacy)
}
```

### 4. Skill Execution Integration

**File:** `src/services/agents/skills/providers/local-sandbox.ts`

Update to read from temp file before execution:

```typescript
import { readFileSync, existsSync } from 'fs';

async function executeScript(args) {
  // Read CWD from temp file if provided
  let actualCwd = this.config.workspaceDir || process.cwd();

  if (this.config.cwdFilePath && existsSync(this.config.cwdFilePath)) {
    try {
      actualCwd = readFileSync(this.config.cwdFilePath, 'utf-8').trim();
    } catch (error) {
      logger.warn(`Failed to read CWD from file: ${error.message}`);
    }
  }

  // Execute with actualCwd
  const result = await exec(command, {
    cwd: actualCwd,
    env: {
      ...process.env,
      // Don't need PROJECT_ROOT anymore!
    }
  });
}
```

### 5. Skills Helper Function

For skills that need to resolve `./` paths:

**File:** `src/services/agents/skills/builtin/file-handling/scripts/utils/resolve-path.ts`

```typescript
import { readFileSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Resolve path relative to project root
 * Reads CWD from temp file if CWD_FILE env var is set
 */
export function resolveProjectPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  // Get project root from temp file or fall back to process.cwd()
  let projectRoot = process.cwd();

  const cwdFile = process.env.CWD_FILE;
  if (cwdFile) {
    try {
      projectRoot = readFileSync(cwdFile, 'utf-8').trim();
    } catch (error) {
      // Fall back to process.cwd()
    }
  }

  return resolve(projectRoot, path);
}
```

### 6. Update Skill Scripts

**Example:** `src/services/agents/skills/builtin/file-handling/scripts/read.ts`

```typescript
import { resolveProjectPath } from './utils/resolve-path';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Resolve relative paths
  const absolutePath = resolveProjectPath(args.filePath);

  // ... rest of script
}
```

## Benefits

1. **No environment pollution** - Clean environment
2. **Multiple instances** - Each has its own temp file
3. **Automatic cleanup** - Removed on exit
4. **Backward compatible** - Can still support direct CWD
5. **Simple** - Just a file with a path in it

## Migration Path

1. Create CwdManager utility
2. Update simple-agent to use CwdManager
3. Update server config to accept cwdFilePath
4. Update local-sandbox to read from file
5. Create resolveProjectPath helper
6. Update skill scripts to use helper
7. Test with multiple parallel instances

## Testing Parallel Instances

```bash
# Terminal 1
cd /home/user/project1
pnpm exec simple-agent

# Terminal 2
cd /home/user/project2
pnpm exec simple-agent

# Both should work independently with their own working directories!
```

## File Cleanup

- **On normal exit**: cleanup() called
- **On SIGINT (Ctrl+C)**: cleanup() called
- **On SIGTERM**: cleanup() called
- **On crash**: File left in /tmp (not ideal but harmless)
- **OS cleanup**: /tmp is typically cleared on reboot

## Security Considerations

- Temp files are in `/tmp` (world-readable on Unix)
- Content is just a path (not sensitive)
- Random ID prevents collisions but isn't cryptographically secure
- Could use `mkstemp` for more security if needed

## Alternative: Use Process ID

Instead of random ID, could use process ID:

```typescript
this.filePath = `/tmp/simple-agent-cwd-${process.pid}`;
```

**Pros:**
- Guaranteed unique per process
- Easy to identify which process owns which file
- OS cleans up on process death

**Cons:**
- PID can be reused after process dies
- Predictable (not a security issue here though)

**Recommendation:** Use random ID like Claude Code does.

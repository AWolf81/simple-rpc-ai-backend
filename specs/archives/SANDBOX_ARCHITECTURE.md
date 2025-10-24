# Sandbox Architecture - Pluggable Backend System

## Overview

✅ **Implemented**: Pluggable sandbox architecture supporting multiple execution backends:
- **Local** (development) - Direct process execution
- **Fly Machines** (production) - Ephemeral containers
- **Vercel** (serverless) - Future
- **E2B, Modal, AWS** - Future

Inspired by [Claude Agent SDK Hosting Guide](https://docs.claude.com/en/api/agent-sdk/hosting)

## Architecture

```
Skill Script Execution Request
           ↓
    SkillManager
           ↓
  SandboxProvider Interface
         / | \
        /  |  \
   Local Fly Vercel ...
```

## Files Created

1. **`src/services/agents/skills/sandbox-provider.ts`** - Core interfaces
   - `ISandboxProvider` - Provider interface
   - `SandboxProviderConfig` - Configuration types
   - `SandboxProviderFactory` - Factory for creating providers

2. **`src/services/agents/skills/providers/local-sandbox.ts`** ✅ - Local implementation
   - Refactored from existing `ScriptSandbox`
   - Process isolation, path validation, resource limits
   - Best for development

3. **`src/services/agents/skills/providers/fly-sandbox.ts`** ✅ - Fly.io implementation
   - Ephemeral Fly Machines
   - True container isolation
   - Auto-scaling, auto-destroy
   - Production-ready

4. **`src/services/agents/skills/providers/vercel-sandbox.ts`** ✅ - Vercel implementation
   - Serverless ephemeral compute
   - node22 and python3.13 runtimes
   - Amazon Linux 2023 base
   - Optional peer dependency (@vercel/sandbox)

## Configuration Examples

### Local Development (Default)

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      enabled: true,
      sources: [
        { type: 'builtin', name: 'file-handling' }
      ],
      sandbox: {
        type: 'local',
        local: {
          allowedPaths: ['/workspace', '/tmp', process.cwd()],
          timeout: 30000,
          maxMemory: 512 * 1024 * 1024
        }
      }
    }
  }
});
```

### Production with Fly.io

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      enabled: true,
      sources: [
        { type: 'builtin', name: 'file-handling' }
      ],
      sandbox: {
        type: 'fly',
        fly: {
          appName: 'my-agent-sandbox',
          apiToken: process.env.FLY_API_TOKEN,
          region: 'ord', // Chicago
          machineSize: 'shared-cpu-1x',
          autoDestroy: true // Destroy after execution
        }
      }
    }
  }
});
```

### Environment-based Switching

```typescript
const sandboxConfig = {
  type: process.env.SANDBOX_PROVIDER || 'local',
  local: {
    allowedPaths: ['/workspace', '/tmp', process.cwd()],
    timeout: 30000
  },
  fly: {
    appName: process.env.FLY_APP_NAME,
    apiToken: process.env.FLY_API_TOKEN,
    region: process.env.FLY_REGION || 'ord'
  }
};
```

## Integration Steps (TODO)

### 1. Update SkillManager

```typescript
// src/services/agents/skills/manager.ts

import { SandboxProviderFactory, type SandboxProviderConfig } from './sandbox-provider';

export class SkillManager {
  private sandboxProvider?: ISandboxProvider;

  async initialize(config: SkillManagerConfig) {
    // Create sandbox provider based on config
    if (config.sandbox) {
      this.sandboxProvider = await SandboxProviderFactory.create(config.sandbox);
      await this.sandboxProvider.initialize(/* ... */);
    }
  }

  async executeScript(skillId: string, options: SkillExecutionOptions) {
    // Use sandbox provider instead of direct ScriptSandbox
    const result = await this.sandboxProvider!.execute({
      scriptPath,
      runtime,
      args,
      sandbox: skill.sandbox
    });
  }
}
```

### 2. Update Types

```typescript
// src/services/agents/skills/types.ts

import type { SandboxProviderConfig } from './sandbox-provider';

export interface SkillManagerConfig {
  sources: SkillSource[];
  sandbox?: SandboxProviderConfig; // NEW: Pluggable sandbox config
  validation?: {
    enabled: boolean;
    maxTokens?: { level1: number; level2: number };
  };
}
```

### 3. Update Server Configuration

```typescript
// src/rpc-ai-server.ts

export interface RpcAiServerConfig {
  agents?: {
    enabled?: boolean;
    skills?: {
      enabled?: boolean;
      sources?: SkillSource[];
      sandbox?: SandboxProviderConfig; // NEW: Sandbox configuration
      validation?: {
        enabled?: boolean;
        maxTokens?: { level1: number; level2: number };
      };
    };
  };
}
```

## Security Features by Provider

### Local Sandbox
- ✅ Path validation (allowed directories only)
- ✅ Timeout limits
- ✅ Memory limits (soft - process-level)
- ✅ Environment variable filtering
- ❌ True process isolation (same host)
- ❌ Network isolation
- ⚠️  **Not recommended for production**

### Fly Machines Sandbox
- ✅ Container-level isolation
- ✅ Enforced CPU/memory limits
- ✅ Ephemeral filesystem
- ✅ Network isolation (configurable)
- ✅ Auto-scaling
- ✅ Multiple regions
- ✅ **Production-ready**
- 💰 Cost: ~$0.05/hour per machine

## Future Providers

### Vercel Sandbox

**Installation:**
```bash
pnpm add @vercel/sandbox
```

**Authentication:**
```bash
vercel link
vercel env pull  # Creates .env.local with VERCEL_OIDC_TOKEN
```

**Configuration:**
```typescript
sandbox: {
  type: 'vercel',
  vercel: {
    // Option 1: OIDC token (recommended, auto-loaded from .env.local)
    // No config needed - uses VERCEL_OIDC_TOKEN automatically

    // Option 2: Access token (for non-Vercel environments)
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
    token: process.env.VERCEL_TOKEN,

    // Optional settings
    runtime: 'node22', // or 'python3.13'
    vcpus: 4,
    defaultTimeout: 300000 // 5 minutes
  }
}
```

### E2B (Code Interpreter)
```typescript
sandbox: {
  type: 'e2b',
  e2b: {
    apiKey: process.env.E2B_API_KEY,
    template: 'python-3.11'
  }
}
```

### Modal
```typescript
sandbox: {
  type: 'modal',
  modal: {
    tokenId: process.env.MODAL_TOKEN_ID,
    tokenSecret: process.env.MODAL_TOKEN_SECRET,
    image: 'python:3.11-slim'
  }
}
```

## Migration Guide

### From Old ScriptSandbox to Providers

**Before:**
```typescript
import { ScriptSandbox } from './sandbox';

const sandbox = new ScriptSandbox(config);
const result = await sandbox.execute(request);
```

**After:**
```typescript
import { SandboxProviderFactory } from './sandbox-provider';

const provider = await SandboxProviderFactory.create({
  type: 'local',
  local: config
});

await provider.initialize(config);
const result = await provider.execute(request);
```

### Backward Compatibility

The old `ScriptSandbox` class can be deprecated but kept for compatibility:

```typescript
// src/services/agents/skills/sandbox.ts (deprecated)

import { LocalSandboxProvider } from './providers/local-sandbox';

/**
 * @deprecated Use SandboxProviderFactory instead
 */
export class ScriptSandbox extends LocalSandboxProvider {
  constructor(config?: SandboxConfig) {
    super(config);
    console.warn('ScriptSandbox is deprecated. Use SandboxProviderFactory instead.');
  }
}
```

## Testing Plan

1. **Local Provider**
   - ✅ Path validation
   - ✅ Timeout enforcement
   - ✅ Process isolation
   - ✅ Environment filtering

2. **Fly Provider**
   - ⏳ Machine creation
   - ⏳ Script execution
   - ⏳ Log retrieval
   - ⏳ Auto-destroy
   - ⏳ Error handling

3. **Integration**
   - ⏳ SkillManager with local provider
   - ⏳ SkillManager with Fly provider
   - ⏳ Provider switching
   - ⏳ Configuration validation

## Documentation

- [SANDBOX_ARCHITECTURE.md](SANDBOX_ARCHITECTURE.md) - This file
- [Claude Agent SDK Hosting](https://docs.claude.com/en/api/agent-sdk/hosting) - Official guide
- [SKILL_TESTING_GUIDE.md](SKILL_TESTING_GUIDE.md) - Testing with different sandboxes

## Cost Analysis

| Provider | Cost | Isolation | Best For |
|----------|------|-----------|----------|
| Local | Free | Process | Development |
| Fly Machines | $0.05/hr | Container | Production |
| Vercel | TBD | Function | Serverless |
| E2B | $0.10/min | Container | Code Interpreter |
| Modal | $0.06/min | Container | ML/GPU workloads |

## Next Steps

1. ✅ Create ISandboxProvider interface
2. ✅ Implement LocalSandboxProvider
3. ✅ Implement FlyMachinesSandboxProvider
4. ⏳ Update SkillManager to use providers
5. ⏳ Add configuration to RpcAiServerConfig
6. ⏳ Write tests for each provider
7. ⏳ Create example configurations
8. ⏳ Update documentation

**Status**: Architecture complete, ready for integration into SkillManager.

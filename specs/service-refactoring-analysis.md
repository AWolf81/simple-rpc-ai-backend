# Service Refactoring Analysis

## Current State: 25 Services in Flat Structure

### ❌ Unused Services (Can be Removed)
1. **APITokenManager.ts** - Not imported anywhere
2. **context-manager.ts** - Not imported anywhere
3. **free-tier-service.ts** - Not imported anywhere
4. **hybrid-user-service.ts** - Not imported anywhere
5. **response-parser.ts** - Not imported anywhere

**Action**: Move to `archived/` or delete if no future use planned

---

## Service Domain Analysis

### 🤖 AI Domain (7 services)
**Core AI functionality and model management**

- `ai-service.ts` (60KB) - Main AI service with Vercel AI SDK
- `ai-validator.ts` - API key validation
- `model-registry.ts` (35KB) - Model registry with 1,700+ models
- `hybrid-model-registry.ts` - Hybrid model provider registry
- `mcp-ai-service.ts` - MCP-specific AI service
- `prompt-manager.ts` - System prompt management
- `function-registry.ts` - Function/tool registry

**Consolidation Opportunity**:
```
src/services/ai/
├── ai-service.ts          # Main service
├── model-registry.ts      # Model management
├── validator.ts           # Validation
├── prompt-manager.ts      # Prompts
├── function-registry.ts   # Functions
└── mcp-ai-service.ts      # MCP integration
```

---

### 📁 File System & Resources Domain (6 services)
**File operations, templates, and MCP resources**

- `file-reader-helper.ts` - File reading utilities
- `template-engine.ts` (17KB) - Template engine for dynamic content
- `mcp-resource-registry.ts` (23KB) - MCP resource management
- `mcp-resource-helpers.ts` - MCP resource utilities
- `root-manager.ts` (17KB) - Root folder management
- `workspace-manager.ts` (18KB) - Workspace management

**Consolidation Opportunity**:
```
src/services/resources/
├── file-reader.ts         # File operations
├── template-engine.ts     # Templates
├── root-manager.ts        # Root folders
├── workspace-manager.ts   # Workspaces
└── mcp/
    ├── registry.ts        # MCP resource registry
    └── helpers.ts         # MCP helpers
```

---

### 🔌 MCP Domain (3 services)
**Model Context Protocol integration**

- `mcp-service.ts` - Core MCP service
- `mcp-registry.ts` (17KB) - MCP server registry
- `ref-mcp-integration.ts` (14KB) - Reference MCP integration

**Consolidation Opportunity**:
```
src/services/mcp/
├── service.ts             # Core MCP service
├── registry.ts            # Server registry
├── ref-integration.ts     # Reference integration
└── ai-service.ts          # Already in AI domain, keep there
```

---

### 💰 Billing & Analytics Domain (2 services)
**Usage tracking and token management**

- `virtual-token-service.ts` - Virtual token management
- `usage-analytics-service.ts` - Usage analytics and tracking

**Consolidation Opportunity**:
```
src/services/billing/
├── token-service.ts       # Virtual tokens
└── analytics.ts           # Usage analytics
```

---

### 🔐 Security Domain (1 service)
**Secret management and encryption**

- `PostgreSQLSecretManager.ts` - PostgreSQL-backed secret storage

**Current Location**: Good as-is, or move to:
```
src/services/security/
└── postgres-secret-manager.ts
```

---

## Proposed Directory Structure

```
src/services/
├── ai/                    # AI & Model Management
│   ├── ai-service.ts      # Main AI service (60KB)
│   ├── model-registry.ts  # Model registry (35KB)
│   ├── validator.ts       # API key validation
│   ├── prompt-manager.ts  # Prompt management
│   ├── function-registry.ts # Function/tool registry
│   └── mcp-ai-service.ts  # MCP AI integration
│
├── resources/             # File System & Resources
│   ├── file-reader.ts     # File operations
│   ├── template-engine.ts # Template engine (17KB)
│   ├── root-manager.ts    # Root folders (17KB)
│   ├── workspace-manager.ts # Workspaces (18KB)
│   └── mcp/
│       ├── registry.ts    # MCP resources (23KB)
│       └── helpers.ts     # MCP utilities
│
├── mcp/                   # Model Context Protocol
│   ├── service.ts         # Core MCP service
│   ├── registry.ts        # Server registry (17KB)
│   └── ref-integration.ts # Reference integration (14KB)
│
├── billing/               # Billing & Analytics
│   ├── token-service.ts   # Virtual tokens
│   └── analytics.ts       # Usage analytics
│
├── security/              # Security & Secrets
│   └── postgres-secret-manager.ts
│
└── archived/              # Unused services (for reference)
    ├── APITokenManager.ts
    ├── context-manager.ts
    ├── free-tier-service.ts
    ├── hybrid-user-service.ts
    └── response-parser.ts
```

---

## Benefits of Refactoring

### ✅ Reduced Complexity
- **Before**: 25 services in flat structure
- **After**: ~20 services in 5 domain folders
- **Reduction**: 5 unused services removed

### ✅ Better Organization
- Related services grouped together
- Clear domain boundaries
- Easier to find services by purpose

### ✅ Improved Maintainability
- Domain-specific changes isolated
- Easier onboarding for new developers
- Clearer dependencies

### ✅ Better Import Paths
```typescript
// Before
import { AIService } from '@services/ai-service';
import { ModelRegistry } from '@services/model-registry';
import { VirtualTokenService } from '@services/virtual-token-service';

// After
import { AIService, ModelRegistry } from '@services/ai';
import { VirtualTokenService } from '@services/billing';
```

---

## Migration Strategy

### Phase 1: Non-Breaking (Archive Unused)
1. Create `src/services/archived/` directory
2. Move 5 unused services to `archived/`
3. Update `specs/tech-debt.md` to remove unused service item
4. No code changes required (zero risk)

### Phase 2: Domain Grouping (Breaking Changes)
1. Create domain directories: `ai/`, `resources/`, `mcp/`, `billing/`, `security/`
2. Move services to respective domains
3. Update all imports across codebase
4. Update `tsconfig.json` path aliases
5. Run tests to verify

### Phase 3: Index Files (Developer Experience)
1. Add `index.ts` to each domain folder
2. Re-export all services from domain index
3. Allow imports from domain root: `import { AIService } from '@services/ai'`

---

## Implementation Checklist

### Phase 1: Archive Unused (Low Risk)
- [ ] Create `src/services/archived/` directory
- [ ] Move `APITokenManager.ts` to `archived/`
- [ ] Move `context-manager.ts` to `archived/`
- [ ] Move `free-tier-service.ts` to `archived/`
- [ ] Move `hybrid-user-service.ts` to `archived/`
- [ ] Move `response-parser.ts` to `archived/`
- [ ] Update tech debt document
- [ ] Commit changes

### Phase 2: Domain Grouping (High Risk - Optional)
- [ ] Create domain directories
- [ ] Update imports (bulk find-replace)
- [ ] Update path aliases in `tsconfig.json`
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Commit changes

---

## Recommendation

**Immediate Action**: Implement Phase 1 (archive unused services)
- **Risk**: Very low (no code changes)
- **Benefit**: Removes confusion, reduces tech debt
- **Effort**: 15 minutes

**Future Consideration**: Implement Phase 2 (domain grouping)
- **Risk**: Medium (requires updating ~50+ imports)
- **Benefit**: Better organization, maintainability
- **Effort**: 2-3 hours
- **Best Time**: During next major refactoring or when adding significant new services

---

## Impact on Tech Debt

### Removes from tech-debt.md:
- ✅ "Unused Client Code" (partially addressed)
- ✅ Reduces "Maintainability" concerns
- ✅ Improves code organization

### Current Tech Debt Score: 7/10
**After Phase 1**: 7.5/10 (minor improvement)
**After Phase 2**: 8/10 (significant improvement)

---

## Files Requiring Import Updates (Phase 2)

If proceeding with domain grouping, these files need updates:

### AI Domain Imports (~30 files)
- `src/rpc-ai-server.ts`
- `src/trpc/routers/ai/**/*.ts`
- `src/monetization/opensaas-server.ts`
- All files importing `ai-service`, `model-registry`, etc.

### Billing Domain Imports (~15 files)
- `src/trpc/routers/billing/**/*.ts`
- `src/trpc/routers/ai/methods/*.ts`
- `src/trpc/routers/user/**/*.ts`

### Resources Domain Imports (~10 files)
- `src/trpc/routers/system/**/*.ts`
- `src/index.ts` (exports)

### MCP Domain Imports (~5 files)
- `src/trpc/routers/mcp/**/*.ts`
- `src/index.ts` (exports)

---

**Last Updated**: 2025-09-30
**Status**: Proposal - awaiting review

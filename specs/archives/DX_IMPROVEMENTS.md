# Developer Experience Improvements

## Current Issues

### 1. Build Process Confusion
- `pnpm build` generates `dist/trpc-methods.json` using example 02's custom routers
- Package consumers don't get these routers - they must create their own
- Build output shows 61 procedures, but base package only has ~30

### 2. Example Server Discoverability
- Hard to know which server has which features
- `math.add` exists in example 02 but not example 01
- No clear "quick start" path

### 3. Missing Development Commands
- No single command to "try everything"
- Unclear which example to run for testing specific features

## Proposed Solutions

### Solution 1: Separate Base and Example Builds

**Change build to only include base routers:**
```json
"scripts": {
  "build": "npm run copy-assets && tsc && tsc-alias && npm run build:base-methods",
  "build:base-methods": "node tools/generate-trpc-methods.js --base-only",
  "build:examples": "node tools/generate-examples-docs.js"
}
```

**Benefits:**
- `dist/trpc-methods.json` only shows what's in the package
- Examples get separate documentation
- Clear separation between package and examples

### Solution 2: Improve Example Documentation

**Add to each example's README.md:**
- Available custom routers
- Available MCP tools
- Example curl commands
- Feature matrix (AI, MCP, Auth, Database)

**Create `examples/README.md` feature matrix:**
```markdown
| Example | Custom Routers | MCP Tools | Features |
|---------|---------------|-----------|----------|
| 01-basic | test | 0 | AI only, minimal config |
| 02-mcp | math, utility, file, prompts | 30+ | Full MCP, custom tools |
| 03-vscode | - | - | VS Code extension |
| 04-tasks | tasks | 10+ | Task management |
| 05-resources | - | 20+ | Local file resources |
```

### Solution 3: Add Quick Start Commands

```json
"scripts": {
  // Quick discovery
  "examples": "node tools/list-examples.js",
  "examples:features": "node tools/list-examples.js --features",

  // Try specific features
  "try:ai": "tsx examples/01-basic-server/server.js",
  "try:mcp": "tsx examples/02-mcp-server/server.js",
  "try:full": "tsx examples/02-mcp-server/server.js",

  // Test endpoints
  "test:math": "curl -X POST http://localhost:8001/rpc -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"math.add\",\"params\":{\"a\":1,\"b\":2},\"id\":1}'",
  "test:ai": "curl -X POST http://localhost:8000/rpc -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"ai.generateText\",\"params\":{\"content\":\"Hello\",\"systemPrompt\":\"default\"},\"id\":1}'"
}
```

### Solution 4: Create Interactive CLI Tool

```bash
pnpm start
# Shows menu:
# 1. Basic AI Server (minimal)
# 2. Full MCP Server (recommended)
# 3. Tasks Server
# 4. VS Code Extension
# 5. List available endpoints
```

### Solution 5: Fix README Quick Start

**Current problem:** README doesn't clearly show which example is running

**Fix:**
```markdown
## Quick Start

### Option 1: Basic AI Server (Minimal)
```bash
pnpm dev:server:basic  # Port 8000, AI only
# Test: curl http://localhost:8000/health
# Available: ai.*, system.*, admin.*, test.simulateAI
```

### Option 2: Full MCP Server (Recommended)
```bash
pnpm dev:server  # Port 8001, AI + MCP + Custom Tools
# Test: curl http://localhost:8001/health
# Available: ai.*, mcp.*, math.*, utility.*, file.*, prompts.*
```

## Implementation Priority

1. **High Priority:**
   - [ ] Fix build to only include base methods
   - [ ] Add feature matrix to examples/README.md
   - [ ] Update main README quick start

2. **Medium Priority:**
   - [ ] Add `pnpm examples` command
   - [ ] Add test commands for common endpoints
   - [ ] Document which server has which custom routers

3. **Low Priority:**
   - [ ] Interactive CLI menu
   - [ ] Auto-generated example documentation

## Example: Current vs Improved Experience

### Current (Confusing)
```bash
# User installs package
npm install simple-rpc-ai-backend

# User sees in docs: "61 procedures available"
# User tries: math.add
# Error: Method not found
# Why? math.add is in example 02, not base package
```

### Improved (Clear)
```bash
# User installs package
npm install simple-rpc-ai-backend

# Docs clearly show:
# "Base package: 31 procedures (ai.*, mcp.*, system.*, admin.*, auth.*, billing.*, user.*)"
# "Custom routers: See examples/ for math, utility, file, prompts"

# User creates custom router:
import { router, publicProcedure } from 'simple-rpc-ai-backend';
const mathRouter = router({ add: ... });

# Or copies from examples/02-mcp-server/methods/
```

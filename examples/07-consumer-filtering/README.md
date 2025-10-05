# Example 07: Consumer App with Configuration File

This example demonstrates how to use `simple-rpc-ai-backend` in a consuming application with:
- **📄 Configuration file**: `.simplerpcaibackendrc` for clean, declarative config
- **🎯 Smart defaults**: AI + MCP enabled, other base routers disabled
- **🔧 Custom namespaces**: Only expose `math` and `demo` routers
- **✨ Zero command-line args**: Just `npx simple-rpc-gen-methods`

## Expected Output

When you generate methods with the RC config, you should see:
- ✅ **AI namespace**: 6 core AI tools (generateText, listProviders, etc.)
- ✅ **MCP namespace**: 6 core protocol tools (initialize, tools/list, tools/call, etc.)
- ✅ **math namespace**: 2 tools (add, multiply)
- ✅ **demo namespace**: 2 tools (echo, status)
- ❌ **NO system.*** methods (disabled in config)
- ❌ **NO user.*** methods (disabled in config)
- ❌ **NO billing.*** methods (disabled in config)
- ❌ **NO auth.*** methods (disabled in config)
- ❌ **NO admin.*** methods (disabled in config)

**Total**: ~16 procedures (AI + MCP + custom routers only)

## Quick Start

### 1. Install Dependencies
```bash
cd examples/07-consumer-filtering
pnpm install
```

### 2. Generate Methods (Uses `.simplerpcaibackendrc`)
```bash
pnpm gen:methods
# Or just: npx simple-rpc-gen-methods
```

### 3. Start the Server
```bash
pnpm start
```

### 4. Open Dev Panel
```bash
pnpm dev-panel
```

## Configuration File

This example uses `.simplerpcaibackendrc` for clean configuration:

```json
{
  "trpcMethodGen": {
    "customRoutersPath": "./methods/index.js",
    "enableAI": true,
    "enableMCP": true,
    "enableMCPAI": true,
    "enableSystem": false,
    "enableUser": false,
    "enableBilling": false,
    "enableAuth": false,
    "enableAdmin": false
  },
  "devPanel": {
    "autoOpenBrowser": false,
    "port": 8081
  },
  "server": {
    "port": 8081,
    "logLevel": "info"
  }
}
```

**Benefits:**
- ✅ No environment variables needed in commands
- ✅ Version-controlled configuration
- ✅ Easy to share across team
- ✅ Environment variables still override when needed

## Environment Variable Overrides

Environment variables override RC config values:

```bash
# Override to disable MCP temporarily
TRPC_GEN_MCP_ENABLED=false pnpm gen:methods

# Generate AI-only methods
TRPC_GEN_MCP_ENABLED=false pnpm gen:methods:ai-only

# Override custom routers path
TRPC_GEN_CUSTOM_ROUTERS=./other-methods.js pnpm gen:methods
```

**All available environment variables:**
- `TRPC_GEN_CUSTOM_ROUTERS` - Path to custom routers file
- `TRPC_GEN_AI_ENABLED` - Enable/disable AI router (default: true)
- `TRPC_GEN_MCP_ENABLED` - Enable/disable MCP router (default: true)
- `TRPC_GEN_MCP_AI_ENABLED` - Enable/disable AI tools in MCP (default: true)
- `TRPC_GEN_SYSTEM_ENABLED` - Enable/disable System router (default: false)
- `TRPC_GEN_USER_ENABLED` - Enable/disable User router (default: false)
- `TRPC_GEN_BILLING_ENABLED` - Enable/disable Billing router (default: false)
- `TRPC_GEN_AUTH_ENABLED` - Enable/disable Auth router (default: false)
- `TRPC_GEN_ADMIN_ENABLED` - Enable/disable Admin router (default: false)

## How It Works

### 1. Server Configuration ([server.js](./server.js))
```javascript
import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { getCustomRouters } from './methods/index.js';

const server = createRpcAiServer({
  port: 8002,
  ai: { enabled: false },  // Disable AI
  mcp: {
    enableMCP: true,  // Keep MCP protocol
    ai: { enabled: false }  // No AI tools in MCP
  },
  customRouters: getCustomRouters()  // Add custom routers
});
```

### 2. Custom Routers ([methods/index.js](./methods/index.js))
```javascript
export function getCustomRouters() {
  return {
    math: mathRouter,    // math.add, math.multiply
    demo: demoRouter     // demo.echo, demo.status
  };
}
```

### 3. Method Generation
The environment variables tell the generator to:
1. Skip base routers (AI, System, User, etc.)
2. Include MCP router (protocol support)
3. Load and include custom routers from `methods/index.js`

### 4. Result
**dist/trpc-methods.json** contains:
```json
{
  "stats": {
    "totalProcedures": 14,
    "mcpMethods": 4
  },
  "procedures": {
    "mcp.initialize": { ... },
    "mcp.toolsList": { ... },
    "math.add": { ... },
    "math.multiply": { ... },
    "demo.echo": { ... },
    "demo.status": { ... }
  }
}
```

## Testing

### Verify Filtering Worked
```bash
# Generate methods
pnpm gen:methods

# Check the output
cat ../../dist/trpc-methods.json | grep -E '"(ai|system|user|billing|auth|admin)\.' || echo "✅ Base routers successfully filtered out"
cat ../../dist/trpc-methods.json | grep -E '"(mcp|math|demo)\.' && echo "✅ MCP + custom namespaces present"
```

### Check Procedure Count
```bash
# Should show ~14 procedures instead of 59
cat ../../dist/trpc-methods.json | jq '.stats.totalProcedures'
```

## Binary Usage in Consuming Projects

When this package is installed in a consuming project:

```bash
# In your consuming project's package.json:
{
  "scripts": {
    "gen:methods": "TRPC_GEN_AI_ENABLED=false ... npx simple-rpc-gen-methods"
  }
}
```

The binary automatically:
1. Reads env variables for filtering
2. Discovers your custom routers
3. Generates filtered trpc-methods.json
4. Logs the configuration being used

## Troubleshooting

### All base routers still showing up?
- Check env variables are set: `echo $TRPC_GEN_AI_ENABLED`
- Make sure you're running the generation script, not the base build

### Custom routers not showing up?
- Verify `TRPC_GEN_CUSTOM_ROUTERS` points to the right file
- Check `getCustomRouters()` export exists
- Look for errors in generator output

### Dev panel not reflecting changes?
- Regenerate methods: `pnpm gen:methods`
- Restart server: `pnpm start`
- Hard refresh dev panel: Ctrl+Shift+R

## Related Examples

- [Example 02: MCP Server](../02-mcp-server/) - Full MCP implementation
- [Example 01: Basic Server](../01-basic-server/) - Minimal setup

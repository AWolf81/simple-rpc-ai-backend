# MCP Methods & Tools Module

This module provides custom tRPC routers that automatically become MCP tools through metadata decoration.

## Files

- `index.js` - Main methods configuration module
- `README.md` - This documentation

## What This Module Provides

The `index.js` file exports tRPC routers that define MCP tools:

### Math Tools Router
- `add` - Add two numbers together
- `multiply` - Multiply two numbers
- `calculate` - Evaluate mathematical expressions safely

### Utility Tools Router
- `greeting` - Generate personalized greetings with language support
- `status` - Get server status information (basic or detailed)

## Usage

This module is automatically imported and used by the main server:

```javascript
// In server.js
import { getCustomRouters } from './methods/index.js';

// During server configuration
const customRouters = getCustomRouters();
// Routers are passed to the server config
```

## Key Features

- ✅ Automatic MCP tool generation from tRPC procedures
- ✅ Type-safe input validation with Zod schemas
- ✅ Comprehensive tool metadata with categories
- ✅ Multi-language support in greeting tool
- ✅ Configurable detail levels in status tool
- ✅ Safe mathematical expression evaluation
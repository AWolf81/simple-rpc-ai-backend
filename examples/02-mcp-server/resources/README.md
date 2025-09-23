# MCP Resources Module

This module provides the resource configuration for the MCP server using the flexible resource registry system.

## Files

- `index.js` - Main resources configuration module
- `README.md` - This documentation

## What This Module Provides

The `index.js` file exports functions that set up:

### File Reader Resources
- Secure file access with rootManager integration
- Root folder configuration (project-root, examples, source)
- Path traversal protection
- Global filesystem resource templates

### Custom Resources
- Package information resource with project metadata
- Built-in resource templates
- Dynamic content generation

## Usage

This module is automatically imported and used by the main server:

```javascript
// In server.js
import { setupAllResources } from './resources/index.js';

// During server startup
setupAllResources(); // Sets up all resource configurations
```

## Key Features

- ✅ Secure filesystem access with rootsManager
- ✅ Configurable root folders with readonly protection
- ✅ Dynamic resource registration
- ✅ Template-based resource providers
- ✅ Package metadata extraction
- ✅ Global resource template integration
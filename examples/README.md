# Examples

Five focused examples demonstrating different use cases of the simple-rpc-ai-backend package.

## 📁 Example Structure

```
examples/
├── 01-basic-server/         # Simple AI server for quick prototyping
├── 02-mcp-server/           # Production server with OAuth2 + MCP + tracking
├── 03-vscode-extension/     # VS Code extension with MCP integration
│   ├── extension/           # VS Code extension code
│   └── server -> ../02-mcp-server  # Symbolic link to shared server
├── 04-mcp-tasks-server/     # MCP server with AI-powered task management
└── 05-local-resources-server/  # File reading and template engine demo
```

> **Note**: Example 3 uses the same production server as Example 2 via a symbolic link. This demonstrates how a single backend can serve multiple client applications.

## 🚀 Getting Started

### Prerequisites
- **Node.js 22.18.0+** (required by tRPC v11)
- AI provider API keys (Anthropic, OpenAI, or Google)
- PostgreSQL (for examples 2 & 3)

### ⚠️ Important: Build First
**Before running any example, build the main package:**

```bash
# From the project root
pnpm build
```

This compiles TypeScript and generates the `dist/` files that examples import from.

### Import Strategy
Each example uses the local package via `"simple-rpc-ai-backend": "file:../../"` in package.json. This approach:
- ✅ **Works like real usage** - import statements match what users will write
- ✅ **TypeScript support** - full IntelliSense and type checking
- ✅ **Always current** - uses your latest local changes
- ✅ **Best practice** - mirrors how libraries should be used

### Quick Start Guide

1. **Basic Server** (5 minutes)
   ```bash
   # Build the package first (from project root)
   pnpm build
   
   # Then run the example
   cd examples/01-basic-server
   npm install
   export ANTHROPIC_API_KEY="your-key"
   npm start
   ```

2. **Production MCP Server** (15 minutes)
   ```bash
   # Build the package first (from project root)
   pnpm build
   
   # Then run the example
   cd examples/02-mcp-server
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm start
   ```

3. **VS Code Extension** (20 minutes)
   ```bash
   # Build the package first (from project root)
   pnpm build
   
   # Start the server (shared with Example 2)
   cd examples/02-mcp-server
   npm install
   npm start
   
   # Then, in a new terminal, build the extension
   cd ../03-vscode-extension/extension
   npm install
   npm run compile
   # Press F5 in VS Code to run
   ```

## 📖 Example Details

### [Example 1: Basic Server](./01-basic-server/)
Perfect for getting started quickly.

**Features:**
- ✅ Simple AI execution
- ✅ System prompt protection  
- ✅ No authentication required
- ✅ Multi-provider support

**Use cases:** Prototyping, local development, learning

---

### [Example 2: MCP Server](./02-mcp-server/)
Production-ready server with full authentication.

**Features:**
- ✅ OAuth2 authentication (GitHub, Google)
- ✅ tRPC for type-safe APIs
- ✅ Token usage tracking with PostgreSQL
- ✅ MCP protocol support
- ✅ Rate limiting and quotas

**Use cases:** Production deployment, team environments, commercial apps

---

### [Example 3: VS Code Extension](./03-vscode-extension/)
Complete VS Code extension demonstrating client integration with the production server.

**Features:**
- ✅ VS Code commands (Ask AI, Explain Code, etc.)
- ✅ OAuth2 authentication flow
- ✅ MCP tool discovery and execution
- ✅ Token usage tracking
- ✅ Type-safe client integration
- ✅ **Shares server with Example 2** (via symbolic link)

**Architecture:** Extension client → Production server (from Example 2) → AI providers

**Use cases:** VS Code extensions, IDE integrations, development tools

---

### [Example 4: MCP Tasks Server](./04-mcp-tasks-server/)
MCP server with AI-powered task management and custom tools.

**Features:**
- ✅ Task creation, listing, and updates
- ✅ AI-powered task suggestions
- ✅ Custom MCP tools with validation
- ✅ Multiple output formats (JSON, Markdown)

**Use cases:** Task management tools, AI assistants, workflow automation

---

### [Example 5: Local Resources Server](./05-local-resources-server/)
Demonstrates file reading and template engine for dynamic MCP resources.

**Features:**
- ✅ Secure file access with root folder management
- ✅ File readers (text, code, directory browsing)
- ✅ Template engine (Markdown, JSON, CSV, HTML)
- ✅ Dynamic content generation
- ✅ MCP resource auto-discovery

**Use cases:** Documentation systems, file management, data transformation

## 🔧 Development Workflow

1. **Start with Example 1** to understand the basics
2. **Move to Example 2** for production features  
3. **Use Example 3** to learn client integration

Each example builds on the previous one, showing progressively more advanced features.

## 📚 Related Documentation

- [Main README](../README.md) - Package overview
- [CLAUDE.md](../CLAUDE.md) - Detailed development guide
- [API Documentation](../docs/) - Complete API reference

## 🔧 Troubleshooting

### Port Already in Use Error

If you see this error:
```
❌ Failed to start server: Error: listen EADDRINUSE: address already in use :::8000
```

**Solution: Kill the process using port 8000**

#### Option 1: Quick Kill (Recommended)
```bash
# From project root - kills all development ports
pnpm kill-ports
```

#### Option 2: Kill Specific Port
```bash
# Find process using port 8000
lsof -ti :8000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or do both in one command
lsof -ti :8000 | xargs kill -9
```

#### Option 3: Kill All Node Processes (Nuclear Option)
```bash
# ⚠️ Warning: This kills ALL Node.js processes
pkill -f node
```

#### Option 4: Use Different Port
```bash
# Set custom port via environment variable
PORT=8001 npm start
```

### Other Common Issues

**Build Errors**: Make sure to run `pnpm build` from project root before running examples.

**Permission Errors**: Try running with `sudo` or check file permissions.

**Import Errors**: Verify you're in the correct directory and ran `npm install`.

## 🆘 Support

- **Issues:** [GitHub Issues](https://github.com/AWolf81/simple-rpc-ai-backend/issues)
- **Discussions:** [GitHub Discussions](https://github.com/AWolf81/simple-rpc-ai-backend/discussions)
- **Documentation:** [Package Docs](../README.md)
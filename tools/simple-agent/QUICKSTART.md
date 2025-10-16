# Quick Start Guide for simple-agent

## Run Locally (Without Building)

Since the TypeScript build has module resolution issues, here's how to run it directly with tsx:

### 1. Check Available Providers

```bash
cd tools/simple-agent
npm run providers
```

This will show which AI providers are detected from your environment variables.

### 2. Run Interactive Chat

```bash
npm run chat
```

OR with a specific API key:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run chat
```

### 3. Execute Single Command

```bash
npm run exec "Explain async/await in JavaScript"
```

### 4. Check Configuration

```bash
npm run config show
```

### 5. Set Configuration

```bash
npm run config set provider.default anthropic
npm run config set provider.anthropic.apiKey sk-ant-...
```

## Using the Free Model (No API Key)

The CLI defaults to `qwen/qwen-2.5-coder-32b-instruct:free` via OpenRouter, which requires no API key:

```bash
# Just run - it will use the free model
npm run chat
```

## Environment Variables

The CLI auto-detects these environment variables:

- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models  
- `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini
- `OPENROUTER_API_KEY` - For OpenRouter models

## MCP Server Registration

```bash
# Register an MCP server
npm run dev -- mcp register my-server "node /path/to/server.js"

# List registered servers
npm run dev -- mcp list

# Unregister a server
npm run dev -- mcp unregister my-server
```

## Configuration File

Config is stored in: `~/.simple-agent/config.json`

You can edit it directly or use the CLI commands.

## Troubleshooting

### "Cannot find module" errors

Make sure you've installed dependencies:
```bash
npm install
```

### Port already in use

Change the port:
```bash
npm run config set server.port 8001
```

### Provider not detected

Check environment variables:
```bash
echo $ANTHROPIC_API_KEY
```

Or set it explicitly:
```bash
npm run config set provider.anthropic.apiKey sk-ant-...
```

## Next Steps

Once the TypeScript build is fixed, you'll be able to:
- Run `npx simple-agent` from anywhere
- Publish to npm
- Use as a global CLI tool

For now, use `npm run` commands from the `tools/simple-agent` directory.

# simple-agent

Terminal-based AI coding agent powered by [simple-rpc-ai-backend](../../README.md).

## Features

- 🤖 **Interactive Chat**: Terminal-based conversational AI coding assistant
- 🆓 **Free by Default**: Uses Qwen Coder (32B) via OpenRouter - no API key required
- 🔄 **Multi-Provider**: Supports Anthropic, OpenAI, Google, and OpenRouter
- 🎯 **Auto-Detection**: Automatically detects API keys from environment
- 📝 **MCP Support**: Register and manage Model Context Protocol servers
- ⚙️ **Configurable**: Persistent configuration in `~/.simple-agent/`

## Quick Start

```bash
# Install from parent project
cd tools/simple-agent
pnpm install
pnpm build

# Start interactive chat (uses free qwen-coder by default)
pnpm start chat

# Or with npx (when published)
npx simple-agent chat
```

## Usage

### Interactive Chat

```bash
simple-agent chat
```

Starts an interactive chat session with the agent. Type your questions and get AI-powered responses.

**Commands in chat:**
- `/clear` - Clear conversation history
- `/help` - Show help
- `exit` or `quit` - Exit chat

### Execute Single Command

```bash
simple-agent exec "Explain how to use async/await in JavaScript"
```

Execute a single prompt and get a response.

### Configuration

**Show current configuration:**
```bash
simple-agent config show
```

**Set configuration value:**
```bash
simple-agent config set provider.default anthropic
simple-agent config set provider.anthropic.apiKey sk-ant-...
simple-agent config set provider.anthropic.model claude-3-5-sonnet-20241022
```

**Reset to defaults:**
```bash
simple-agent config reset
```

### Provider Management

**Detect available providers:**
```bash
simple-agent providers
```

Shows all providers detected from environment variables.

**Provider Priority:**
1. Environment variables (auto-detected)
2. Configured provider in config
3. Default: qwen-coder:free (no API key needed)

**Supported Environment Variables:**
- `OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`

### MCP Server Management

**Register an MCP server:**
```bash
simple-agent mcp register my-server "node /path/to/server.js" \
  --args arg1 arg2 \
  --env KEY1=value1 KEY2=value2
```

**List registered servers:**
```bash
simple-agent mcp list
```

**Unregister a server:**
```bash
simple-agent mcp unregister my-server
```

## Configuration

Configuration is stored in `~/.simple-agent/config.json`.

### Default Configuration

```json
{
  "server": {
    "port": 8000,
    "host": "localhost",
    "autoStart": true
  },
  "provider": {
    "default": "openrouter",
    "openrouter": {
      "model": "qwen/qwen-2.5-coder-32b-instruct:free"
    }
  },
  "agent": {
    "defaultSDK": "claude-code",
    "enableSkills": true
  },
  "mcp": {
    "enabled": false,
    "servers": []
  },
  "ui": {
    "theme": "dark",
    "verbose": false
  }
}
```

## Examples

### Using with Anthropic Claude

```bash
# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start chat (automatically detects and uses Anthropic)
simple-agent chat
```

### Using with OpenAI

```bash
# Set API key
export OPENAI_API_KEY=sk-...

# Start chat
simple-agent chat
```

### Using Free Model (No API Key)

```bash
# Just run - uses qwen-coder:free by default
simple-agent chat
```

### Configure Custom Model

```bash
# Use a specific model
simple-agent config set provider.openrouter.model "deepseek/deepseek-chat:free"
simple-agent chat
```

### Execute Single Commands

```bash
# Get a quick answer
simple-agent exec "Write a function to sort an array in JavaScript"

# Code review
simple-agent exec "Review this code: $(cat myfile.js)"

# Explain code
simple-agent exec "Explain what this regex does: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/"
```

## Architecture

```
┌─────────────────────────────────────┐
│        simple-agent CLI             │
│  (Terminal Interface)               │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│     Server Manager                   │
│  (Starts/Stops Backend)              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│   simple-rpc-ai-backend Server       │
│  (Agent Abstraction + AI Providers)  │
│                                      │
│  • Claude Code SDK                   │
│  • OpenAI Agents SDK                 │
│  • Skills System                     │
│  • MCP Integration                   │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼───┐      ┌────▼────┐
   │OpenRouter│    │Anthropic│
   │ (Free)   │    │ Claude  │
   └──────────┘    └─────────┘
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev chat

# Run built version
pnpm start chat
```

## Why Qwen Coder?

**Default Model**: `qwen/qwen-2.5-coder-32b-instruct:free`

- ✅ **Free**: No API key required via OpenRouter
- ✅ **Code-Specialized**: Trained specifically for coding tasks
- ✅ **Large Context**: 32B parameters for complex reasoning
- ✅ **Fast**: Optimized for quick responses
- ✅ **Open**: Based on open-source Qwen model

Perfect for getting started without any setup!

## Comparison with OpenAI Codex

| Feature | simple-agent | OpenAI Codex |
|---------|-------------|--------------|
| Free Option | ✅ qwen-coder | ❌ Requires API key |
| Multi-Provider | ✅ 4 providers | ❌ OpenAI only |
| Skills System | ✅ Claude Code | ❌ Not available |
| MCP Support | ✅ Full support | ✅ Supported |
| Self-Hosted | ✅ Yes | ❌ Cloud only |
| Open Source | ✅ Yes | ❌ Closed |

## Troubleshooting

### Server won't start

**Check if port is already in use:**
```bash
lsof -i :8000
```

**Change port:**
```bash
simple-agent config set server.port 8001
```

### Provider not detected

**Check environment variables:**
```bash
simple-agent providers
```

**Manually configure:**
```bash
simple-agent config set provider.anthropic.apiKey sk-ant-...
simple-agent config set provider.default anthropic
```

### Connection errors

**Test server manually:**
```bash
curl http://localhost:8000/health
```

**Check configuration:**
```bash
simple-agent config show
```

## Contributing

This tool is part of the [simple-rpc-ai-backend](../../README.md) project. See the main repository for contribution guidelines.

## License

MIT

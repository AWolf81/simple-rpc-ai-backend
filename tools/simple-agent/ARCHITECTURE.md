# Simple Agent CLI - Architecture

## Overview

Lightweight AI agent CLI built with **Ink** (React for terminal), using your existing `simple-rpc-ai-backend` infrastructure. **Zero dependency on Codex or Claude Code CLI**.

## Why This Approach?

### ❌ Why Not Existing CLIs?

**Codex CLI:**
- Slash commands not fully supported (still feature requests)
- MCP integration immature
- Custom tools require config file editing
- Less flexible

**Claude Code CLI:**
- No custom base URL support anymore
- Changes frequently, unstable
- Heavy overhead
- Hard to customize

### ✅ Our Solution

Build our own lightweight wrapper using:
- **Ink** - Reactive terminal UI (React components)
- **Commander.js** - Command parsing
- **Plugin system** - Extensible slash commands
- **Existing backend** - Your AgentService + AI Service

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Terminal (Ink UI)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  App Component (src/components/App.js)           │  │
│  │  - Input handling                                 │  │
│  │  - Message history                                │  │
│  │  - Slash command detection                        │  │
│  └──────────────┬────────────────────────────────────┘  │
│                 │                                        │
│                 ▼                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Plugin Manager (src/core/plugin-manager.js)     │  │
│  │  - Load plugins from plugins/                    │  │
│  │  - Execute slash commands                         │  │
│  │  - Provide context (client, model, history)      │  │
│  └──────────────┬────────────────────────────────────┘  │
└─────────────────┼─────────────────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  Server Manager (src/core/server.js)    │
   │  - Start/stop backend server            │
   │  - Configure agents & skills            │
   │  - Silent mode support                  │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │    simple-rpc-ai-backend (Backend)      │
   │  ┌────────────────────────────────────┐  │
   │  │  AgentService (agents.execute)    │  │
   │  │  - Claude Code adapter            │  │
   │  │  - OpenAI adapter                 │  │
   │  │  - Skill system                   │  │
   │  └────────────────────────────────────┘  │
   │  ┌────────────────────────────────────┐  │
   │  │  AIService (ai.generateText)      │  │
   │  │  - Vercel AI SDK                  │  │
   │  │  - Multi-provider support         │  │
   │  │  - Streaming support              │  │
   │  └────────────────────────────────────┘  │
   │  ┌────────────────────────────────────┐  │
   │  │  tRPC Methods (tools)             │  │
   │  │  - mcp.*, system.*, admin.*       │  │
   │  │  - File operations                │  │
   │  │  - Resource management            │  │
   │  └────────────────────────────────────┘  │
   └──────────────────────────────────────────┘
```

## Core Components

### 1. CLI Entry Point (`src/cli.js`)

```javascript
import { Command } from 'commander';
import { render } from 'ink';
import App from './components/App.js';

program
  .command('chat')
  .action(() => render(<App />));
```

**Responsibilities:**
- Parse command-line arguments
- Start backend server
- Render Ink UI
- Handle exit/cleanup

### 2. App Component (`src/components/App.js`)

**Ink React component** that renders the terminal UI:

```jsx
<Box flexDirection="column">
  {/* Header with model info */}
  <Box borderStyle="round">
    <Text>🤖 Simple Agent CLI ({model})</Text>
  </Box>

  {/* Chat history */}
  <ChatHistory messages={messages} />

  {/* Loading indicator */}
  {isLoading && <Spinner />}

  {/* Input box */}
  <Box borderStyle="round">
    <TextInput onSubmit={handleSubmit} />
  </Box>
</Box>
```

**Features:**
- ✅ Reactive updates (messages appear instantly)
- ✅ Slash command detection
- ✅ Loading spinner during AI processing
- ✅ Clean input/output separation

### 3. Plugin Manager (`src/core/plugin-manager.js`)

Dynamic plugin loading system:

```javascript
export async function loadPlugins() {
  // Scan plugins/ directory
  // Load all .js files
  // Return array of plugin objects
}

export async function executePlugin(command, args, context) {
  const plugin = findPlugin(command);
  return await plugin.handler(args, context);
}
```

**Plugin Interface:**
```javascript
export default {
  command: 'review',      // Slash command trigger
  description: '...',     // Help text
  async handler(args, context) {
    // args: ['file.js']
    // context: { client, model, provider, messages }
    return 'Result text';
  }
};
```

### 4. Server Manager (`src/core/server.js`)

Backend server lifecycle management:

```javascript
export async function startServer() {
  const server = createRpcAiServer({
    port: 8001,
    serverProviders: ['anthropic'],
    agents: {
      enabled: true,
      defaultSDK: 'claude-code',
      claudeCode: {
        enableSkills: true,
        defaultSkills: [
          codeReviewSkill,
          fileHandlingSkill,
          apiDesignSkill
        ]
      }
    }
  });

  await server.start();
  return server;
}
```

## Plugin System

### Creating a Plugin

1. Create `plugins/mycommand.js`:

```javascript
export default {
  command: 'mycommand',
  description: 'What it does',

  async handler(args, context) {
    // Use the agent
    const result = await context.client.request('agents.execute', {
      prompt: `Do something with ${args[0]}`,
      model: context.model,
      sdk: 'claude-code'
    });

    return result.content;
  }
};
```

2. Plugin automatically loaded on next CLI start

3. Use with `/mycommand <args>`

### Built-in Plugins

| Plugin | Command | Description |
|--------|---------|-------------|
| help.js | `/help` | Show commands and usage |
| review.js | `/review <file>` | Code review with agent |
| search.js | `/search <pattern>` | Find files or content |
| diff.js | `/diff [file]` | Analyze git changes |

### Plugin Context

Every plugin receives:

```javascript
context = {
  client: RPCClient,        // Backend API client
  model: string,            // Current AI model
  provider: string,         // Current provider
  messages: Array           // Chat history
}
```

## Built-in Slash Commands

| Command | Handler | Description |
|---------|---------|-------------|
| `/exit`, `/quit` | Built-in | Exit CLI |
| `/clear` | Built-in | Clear chat history |
| `/model <name>` | Built-in | Switch AI model |
| `/help` | Plugin | Show help |
| `/review <file>` | Plugin | Review code |
| `/search <pattern>` | Plugin | Search files |
| `/diff [file]` | Plugin | Git diff analysis |

## Data Flow

### Regular Prompt

```
User types: "Review the code in app.js"
             ↓
App.handleSubmit()
             ↓
client.request('agents.execute', {
  prompt: "Review the code in app.js",
  sdk: 'claude-code'
})
             ↓
AgentService.execute()
             ↓
ClaudeCodeAdapter.execute()
             ↓
AIService.execute()
             ↓
Vercel AI SDK → Anthropic API
             ↓
Response displayed in ChatHistory
```

### Slash Command

```
User types: "/review app.js"
             ↓
App detects slash command
             ↓
parseSlashCommand()
  → command: 'review'
  → args: ['app.js']
             ↓
executePlugin('review', ['app.js'], context)
             ↓
review.js handler()
  → reads file
  → calls agent with file contents
             ↓
Response displayed in ChatHistory
```

## Tool Integration

Plugins can use **any tRPC method** as tools:

```javascript
// Use existing tRPC methods
await context.client.request('system.listFiles', {
  path: '/src'
});

await context.client.request('system.readFile', {
  path: 'package.json'
});

await context.client.request('admin.status', {});
```

**Available tool namespaces:**
- `mcp.*` - MCP protocol methods
- `system.*` - File operations, workspace management
- `admin.*` - Status, statistics, config
- `agents.*` - Agent execution
- `ai.*` - Direct AI text generation

## Skills Integration

The backend is pre-configured with 3 skills:

1. **Code Review Expert** - Analyzes code
2. **File System Expert** - Manages files (with permission)
3. **API Design Expert** - Designs APIs

These are available to the agent automatically. The agent will use the appropriate skill based on the prompt.

## Streaming Support (TODO)

Currently using non-streaming `agents.execute`. To add streaming:

```javascript
// In App.js
const subscription = client.agents.executeStream.subscribe({
  prompt: userMessage,
  sdk: 'claude-code'
}, {
  onData: (data) => {
    if (!data.done) {
      setStreamingText(prev => prev + data.chunk);
    }
  }
});
```

See `STREAMING_FEATURE.md` for implementation details.

## Advantages Over Existing CLIs

| Feature | Codex | Claude Code | Simple Agent |
|---------|-------|-------------|--------------|
| Custom base URL | ❌ | ❌ | ✅ |
| Slash commands | ⚠️ Partial | ✅ | ✅ |
| Plugin system | ⚠️ Config | ❌ | ✅ |
| Stable | ✅ | ❌ | ✅ |
| Lightweight | ✅ | ❌ | ✅ |
| Reactive UI | ❌ | ❌ | ✅ (Ink) |
| Streaming | ✅ | ✅ | 🚧 TODO |
| Custom skills | ⚠️ | ⚠️ | ✅ |
| Permission system | ❌ | ❌ | ✅ |
| tRPC tools | ❌ | ❌ | ✅ |

## Dependencies

```json
{
  "ink": "^5.1.0",              // React for terminal
  "ink-text-input": "^6.0.0",   // Input component
  "ink-spinner": "^5.0.0",      // Loading spinner
  "react": "^18.3.1",           // Ink dependency
  "commander": "^12.1.0",       // CLI arg parsing
  "chalk": "^5.4.1"             // Colors
}
```

**Total size**: ~2MB (vs Codex/Claude Code ~20-50MB)

## Extending

### Add New Skill

Edit `src/core/server.js`:

```javascript
const myNewSkill = {
  id: 'my-skill',
  name: 'My Expert',
  description: 'What it does',
  level: 2,
  instructions: `...`
};

// Add to defaultSkills
defaultSkills: [codeReviewSkill, fileHandlingSkill, myNewSkill]
```

### Add New Tool

Create tRPC procedure in backend, then use in plugins:

```javascript
// Plugin uses existing tRPC method
await context.client.request('myNamespace.myMethod', { ... });
```

### Add New Command

Create `plugins/mycommand.js` - that's it!

## Production Deployment

### As Global CLI

```bash
npm link
agent chat
```

### As Package Binary

```json
{
  "bin": {
    "agent": "./src/cli.js"
  }
}
```

Then:
```bash
npm install -g simple-agent-cli
agent chat
```

## Testing

```bash
# Interactive
npm start

# One-shot
node src/cli.js exec "What files are in src/?"

# List plugins
node src/cli.js plugins
```

## Future Enhancements

- [ ] True streaming via tRPC subscriptions
- [ ] History persistence (SQLite)
- [ ] Config file support (`~/.agentrc`)
- [ ] Plugin marketplace
- [ ] Multi-turn context management
- [ ] Export chat as markdown
- [ ] Tool call visualization
- [ ] Custom themes

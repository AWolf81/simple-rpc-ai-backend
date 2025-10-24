# Simple Agent CLI

Lightweight AI agent CLI with reactive terminal UI and plugin system.

## Features

✨ **Core Features:**
- 🎨 Reactive terminal UI powered by Ink
- 🔌 Plugin system for slash commands
- 🤖 Agent with skills (code review, file handling, API design)
- 📡 Streaming responses (coming soon)
- 🛠️ tRPC tool integration
- 🔒 Permission system for file operations

## Installation

```bash
npm install
```

## Usage

### Interactive Chat

```bash
npm start
# or
node src/cli.js
```

### One-shot Execution

```bash
node src/cli.js exec "Review the code in app.js"
```

### List Plugins

```bash
node src/cli.js plugins
```

## Built-in Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/skills` | List available skills with details |
| `/exit`, `/quit` | Exit the CLI |
| `/clear` | Clear chat history |
| `/model <name>` | Switch AI model |
| `/review <file>` | Review code in file |
| `/search <pattern>` | Search for files |
| `/search <pattern> --in-files` | Search in file contents |
| `/diff [file]` | Show and analyze git diff |

## Plugin System

### Creating a Plugin

Create a new file in `plugins/`:

```javascript
// plugins/mycommand.js
export default {
  command: 'mycommand',
  description: 'What my command does',

  async handler(args, context) {
    // args: Array of command arguments
    // context: { client, model, provider, messages }

    // Use the agent
    const result = await context.client.request('agents.execute', {
      prompt: 'Your prompt here',
      model: context.model,
      sdk: 'claude-code'
    });

    return result.content;
  }
};
```

### Plugin Context

Plugins receive a context object with:
- `client`: RPCClient instance for making requests
- `model`: Current AI model
- `provider`: Current AI provider
- `messages`: Chat history

## Agent Skills

The agent has access to a skills system that provides specialized capabilities. Skills are loaded automatically on startup.

📖 **For detailed information on using skills, see [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md)**

### Built-in Skills

#### 1. file-handling (Built-in)
- **Purpose**: Safely read, write, search, and manage files
- **Capabilities**: file-read, file-write, file-search, directory-operations
- **Scripts**: safe-read.ts, search-files.ts, validate-path.ts

#### 2. hello-world (Test Skill)
- **Purpose**: Demonstrate skill structure and script execution
- **Capabilities**: testing, demonstration
- **Scripts**: greet.ts, validate-json.ts

### Using Skills

Ask the agent naturally:
```
You: Read the file at /workspace/config.json
You: Find all TypeScript files in the project
You: Generate a greeting for Alice
```

Or use the `/skills` command to see what's available.

**Example:**
```
You: Review the authentication logic in auth.js
```

### 2. File System Expert
Manages files with permission-based safeguards.

**Read Operations (no permission):**
- List files, read contents, search in files

**Write Operations (requires permission):**
- Create, update, delete, rename files/folders

**Example:**
```
You: List all TypeScript files in src/
You: Create a new config.json with default settings
```

### 3. API Design Expert
Designs RESTful APIs following best practices.

**Example:**
```
You: Design a REST API for a blog with posts and comments
```

## Architecture

```
examples/04-simple-agent-cli/
├── src/
│   ├── cli.js                 # Main entry point
│   ├── components/
│   │   ├── App.js             # Main Ink component
│   │   └── ChatHistory.js     # Chat history display
│   └── core/
│       ├── server.js          # Backend server management
│       └── plugin-manager.js  # Plugin loading/execution
├── plugins/
│   ├── help.js                # Help command
│   ├── review.js              # Code review command
│   ├── search.js              # File search command
│   └── diff.js                # Git diff analysis
└── package.json
```

## Development

### Watch Mode

```bash
npm run dev
```

### Adding Dependencies

Since this uses workspace:*, you need to install in the root:

```bash
cd ../../..
pnpm add <package> --filter simple-agent-cli
```

## Tips

1. **Use natural language** - The agent understands context
2. **File operations require permission** - The agent will ask first
3. **Slash commands are quick** - Use `/review` instead of "review the file..."
4. **Create custom plugins** - Extend functionality easily

## Roadmap

- [ ] True streaming with tRPC subscriptions
- [ ] History persistence
- [ ] Config file support
- [ ] Plugin marketplace
- [ ] Multi-turn conversation context
- [ ] Tool call visualization
- [ ] Export chat as markdown

## License

MIT

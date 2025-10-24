# Simple Agent - Skills Usage Guide

This guide shows how to use the built-in skills system with `simple-agent`.

## Available Built-in Skills

When you start `simple-agent`, it automatically loads these skills:

### 1. file-handling (Built-in)
**Purpose**: Safely read, write, search, and manage files

**Available Scripts**:
- `safe-read.ts` - Read file contents with size limits
- `search-files.ts` - Search for files matching patterns
- `validate-path.ts` - Validate file path is safe

**Capabilities**: file-read, file-write, file-search, directory-operations

### 2. hello-world (Test Skill)
**Purpose**: Demonstrate skill structure and script execution

**Available Scripts**:
- `greet.ts` - Generate personalized greetings
- `validate-json.ts` - Validate JSON file syntax

**Capabilities**: testing, demonstration

## How to Use Skills in Simple Agent

### Method 1: Natural Language (AI-Powered)

Simply ask the agent to use the skill:

```
You: Read the file at /workspace/config.json
```

The agent will:
1. Recognize this is a file operation
2. Use the `file-handling` skill
3. Execute the appropriate script
4. Return the results

```
You: Greet me formally
```

The agent will:
1. Use the `hello-world` skill
2. Execute `greet.ts` with --formal flag
3. Return "Good day, [your name]. How may I assist you?"

### Method 2: Slash Commands

Use the `/skills` command to see what's available:

```
You: /skills
```

Output:
```
📚 Available Skills:

### file-handling
**Description:** Read, write, search, and manage files safely
**Capabilities:** file-read, file-write, file-search, directory-operations
**Tokens:** L1: 176, L2: 510

### hello-world
**Description:** Simple test skill demonstrating structure and execution
**Capabilities:** testing, demonstration
**Tokens:** L1: 116, L2: 270
```

### Method 3: Direct Script Execution via Agent

Ask the agent to execute specific scripts:

```
You: Execute the greet script from hello-world skill with argument "Alice"
```

The agent will call:
```javascript
await agents.skills.executeScript({
  skillId: 'hello-world',
  scriptName: 'scripts/greet.ts',
  args: ['Alice']
})
```

## Example Conversations

### Example 1: File Operations

```
You: Can you help me read a file?

Agent: Yes! I have the file-handling skill that can safely read files.
What file would you like me to read? Please provide the path (must be
within /workspace or /tmp).

You: Read /workspace/package.json

Agent: I'll use the file-handling skill to read that file...
[Executes scripts/safe-read.ts]
[Returns file contents]
```

### Example 2: Testing the Greeting Skill

```
You: Generate a greeting for Bob

Agent: I'll use the hello-world skill to generate a greeting...
[Executes scripts/greet.ts with args: ['Bob']]

Hello, Bob!

You: Now make it formal

Agent: [Executes scripts/greet.ts with args: ['Bob', '--formal']]

Good day, Bob. How may I assist you?
```

### Example 3: File Search

```
You: Find all TypeScript files in the workspace

Agent: I'll use the file-handling skill to search for TypeScript files...
[Executes scripts/search-files.ts with pattern: "**/*.ts"]

Found 47 TypeScript files:
- src/index.ts
- src/server.ts
- src/client.ts
[...]
```

## Skill Restrictions & Security

All skills operate within security boundaries:

- **Allowed Paths**: Skills can only access `/workspace` and `/tmp`
- **Size Limits**: Files > 10MB require special handling
- **Validation**: All paths validated before operations
- **Sandboxing**: Scripts run in isolated environments

## Troubleshooting

### Skills Not Loading

If you see "0 skills" in the header or get generic AI responses:

1. **Check the header**: Should show `🤖 Simple Agent CLI (model) • N skills`
2. **Look for startup message**: Should see `✅ Loaded N skill(s): ...`
3. **Try `/skills` command**: Should list available skills

If skills aren't loading:
```bash
# Check if the server has skills enabled
curl http://localhost:8001/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.list","params":{},"id":1}'
```

### Agent Not Using Skills

If the agent gives generic answers instead of using skills:

1. **Be specific**: "Use the file-handling skill to read..."
2. **Mention the skill**: "With your file-handling skill, can you..."
3. **Use `/skills`**: Check which skills are actually loaded

### Script Execution Errors

If you get script execution errors:

1. **Check paths**: Must be within `/workspace` or `/tmp`
2. **Check arguments**: Make sure you're passing the right arguments
3. **Check permissions**: Some operations may require write permissions

## Advanced Usage

### Custom Skills

You can add custom skills by:

1. Creating a skill directory with `SKILL.md`
2. Adding scripts in the `scripts/` subdirectory
3. Configuring the server to load your custom skill:

```typescript
// In server config
agents: {
  enabled: true,
  skills: {
    enabled: true,
    sources: [
      { type: 'builtin', name: 'file-handling' },
      { type: 'local', path: '/path/to/custom-skill' }
    ]
  }
}
```

### Viewing Skill Details

Ask the agent:
```
You: Show me details about the file-handling skill
```

The agent can query:
```javascript
await agents.skills.get({ skillId: 'file-handling' })
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `List available skills` | See what skills are loaded |
| `/skills` | Detailed skill listing |
| `/help` | Show all available commands |
| `Read /workspace/file.txt` | Use file-handling to read a file |
| `Greet me` | Use hello-world greeting |
| `Search for *.json files` | Use file-handling search |

## Resources

- **Skill System Documentation**: See `SKILL_TESTING_GUIDE.md`
- **API Reference**: See `CLAUDE.md` for agents configuration
- **Examples**: See `examples/03-agents-basic/` for skill examples

---

💡 **Pro Tip**: The agent is smart! You don't need to memorize commands. Just ask naturally:
- "Can you help me find JSON files?"
- "Read the config file for me"
- "What skills do you have?"

The system prompt ensures the agent knows about its loaded skills and will use them appropriately.

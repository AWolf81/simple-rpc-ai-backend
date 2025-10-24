# Simple Agent - Configuration Guide

## Overview

Simple Agent uses a hierarchical configuration discovery system inspired by AWS CLI, Git, and Docker best practices. Configuration can come from multiple sources with clear precedence rules.

---

## Configuration Hierarchy

Configuration is loaded in the following order (highest to lowest priority):

```
1. Command-line arguments     ← Highest priority (overrides everything)
2. Environment variables
3. Project .env file           (current working directory)
4. User config directory       (~/.simple-agent/.env)
5. User home .env file         (~/.simple-agent.env)
6. System defaults             ← Lowest priority
```

---

## Quick Start

### 1. Initialize Configuration

```bash
# Create user config directory and example .env file
simple-agent init

# Output:
# ✅ Created config directory: ~/.simple-agent
# ✅ Created example config: ~/.simple-agent/.env
```

### 2. Add API Key

Edit `~/.simple-agent/.env` and add your OpenRouter key (create one at https://openrouter.ai/keys):

```bash
nano ~/.simple-agent/.env
# Set your key on the existing line:
OPENROUTER_API_KEY=your-key-here
```

### 3. Verify Configuration

```bash
# Show configuration discovery and current settings
simple-agent config

# Output shows which files exist and are being used
```

### 4. Run Simple Agent

```bash
# Now runs with your configured API key
simple-agent
```

---

## Configuration File Locations

### User Config Directory (Recommended)

**Path:** `~/.simple-agent/.env`

**Best for:** Personal API keys, global defaults

**Example:**
```bash
# Simple Agent Configuration (defaults created by simple-agent init)
OPENROUTER_API_KEY=your-key-here
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3-7-sonnet
LOG_LEVEL=info
# Optional: add other provider keys if you want to switch providers
```

**Benefits:**
- ✅ Centralized configuration for all projects
- ✅ Not accidentally committed to git
- ✅ Easy to manage and edit

### Project .env File

**Path:** `./.env` (current working directory)

**Best for:** Project-specific settings, team sharing (gitignored)

**Example:**
```bash
# Project-specific configuration
AI_MODEL=gpt-4
SERVER_URL=http://localhost:8000
LOG_LEVEL=debug
```

**Benefits:**
- ✅ Per-project customization
- ✅ Can be shared with team (without secrets)
- ✅ Overrides user config for this project

### Environment Variables

**Best for:** Temporary overrides, CI/CD pipelines

**Example:**
```bash
# One-time override (current shell only)
OPENROUTER_API_KEY=sk-or-temp simple-agent

# Or export for session
export OPENROUTER_API_KEY=sk-or-...
simple-agent
```

### Command-Line Arguments

**Best for:** Testing different models/providers quickly

**Example:**
```bash
# Override model and provider for this run
simple-agent --model gpt-4 --provider openai

# Connect to different server
simple-agent --url http://staging.example.com:8000
```

---

## Configuration Options

### API Keys (Required - at least one)

```bash
# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (GPT)
OPENAI_API_KEY=sk-...

# Google (Gemini)
GOOGLE_API_KEY=...
```

### AI Provider Settings

```bash
# Default provider (init sets this to openrouter)
AI_PROVIDER=openrouter  # override with: anthropic, openai, google

# Default model (init sets this to Anthropic Claude via OpenRouter)
AI_MODEL=anthropic/claude-3-7-sonnet
```

### Server Connection

```bash
# Server URL (auto-detects localhost:8000 if not set)
SERVER_URL=http://localhost:8000

# Server port (for auto-discovery)
SERVER_PORT=8000
```

### Logging

```bash
# Log level
LOG_LEVEL=info  # options: debug, info, warn, error, silent
```

---

## CLI Commands

### Configuration Management

```bash
# Initialize user config
simple-agent init

# Show current configuration
simple-agent config

# Show configuration with API keys (⚠️ security warning!)
simple-agent config --show-keys

# Show detailed help
simple-agent help-config

# Show verbose discovery info during run
simple-agent --verbose
```

### Running with Different Configs

```bash
# Default: Uses all configured sources
simple-agent

# Override model
simple-agent --model gpt-4

# Override provider
simple-agent --provider openai

# Connect to different server
simple-agent --port 8001
simple-agent --url https://api.example.com

# Silent mode (no server logs)
simple-agent --silent
```

---

## Best Practices

### ✅ DO

1. **Use user config for API keys**
   ```bash
   # Store API keys in ~/.simple-agent/.env
   echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.simple-agent/.env
   ```

2. **Use project .env for project settings**
   ```bash
   # Store project-specific config in ./.env
   echo "AI_MODEL=gpt-4" > .env
   echo ".env" >> .gitignore
   ```

3. **Use environment variables for temporary overrides**
   ```bash
   # Test with different key temporarily
   ANTHROPIC_API_KEY=sk-ant-test simple-agent
   ```

4. **Use command-line args for one-off changes**
   ```bash
   # Quick test with different model
   simple-agent --model gpt-4 --provider openai
   ```

### ❌ DON'T

1. **Don't commit API keys to git**
   ```bash
   # Always add .env to .gitignore
   echo ".env" >> .gitignore
   ```

2. **Don't hardcode API keys in code**
   ```javascript
   // ❌ BAD
   const apiKey = 'sk-ant-...';

   // ✅ GOOD
   const apiKey = process.env.ANTHROPIC_API_KEY;
   ```

3. **Don't share API keys in plain text**
   - Use environment variables or config files
   - Use secret management tools for production

---

## Examples

### Example 1: Personal Development Setup

```bash
# 1. Initialize config
simple-agent init

# 2. Add your personal API key
cat > ~/.simple-agent/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-personal-key
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-3-7
LOG_LEVEL=info
EOF

# 3. Use simple-agent in any project
cd ~/my-project
simple-agent
```

### Example 2: Project-Specific Configuration

```bash
# In your project directory
cd ~/my-ai-project

# Create project .env
cat > .env << 'EOF'
# Use GPT-4 for this project
AI_PROVIDER=openai
AI_MODEL=gpt-4

# Connect to staging server
SERVER_URL=http://staging.example.com:8000

# Debug logging for development
LOG_LEVEL=debug
EOF

# Add to gitignore
echo ".env" >> .gitignore

# Run - uses project config + user API key
simple-agent
```

### Example 3: Team Setup (Shared Project Config)

```bash
# Create .env.example for team (no secrets)
cat > .env.example << 'EOF'
# Copy this to .env and add your API key

# Recommended provider for this project
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-3-7

# Connect to local dev server
SERVER_PORT=8000

# Logging
LOG_LEVEL=info

# Your API key (REQUIRED - add below)
# ANTHROPIC_API_KEY=your_key_here
EOF

# Add to git
git add .env.example
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add config template"

# Team members copy and fill in:
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
```

### Example 4: CI/CD Pipeline

```bash
# In CI/CD, use environment variables
# .github/workflows/test.yml
steps:
  - name: Run AI agent tests
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      LOG_LEVEL: silent
    run: |
      simple-agent exec "Run all tests"
```

---

## Troubleshooting

### No API Key Found

**Error:**
```
❌ Configuration Error:
No AI provider API key found. Please configure one of:
  - ANTHROPIC_API_KEY
  - OPENAI_API_KEY
  - GOOGLE_API_KEY
```

**Solution:**
```bash
# Initialize config
simple-agent init

# Add your API key
echo "ANTHROPIC_API_KEY=your_key" >> ~/.simple-agent/.env

# Verify
simple-agent config
```

### API Key Not Being Used

**Check configuration discovery:**
```bash
# Show which files are being loaded
simple-agent config

# Output shows:
# ✅ [Priority 1] Project .env
#    /home/user/project/.env
# ✅ [Priority 2] User config directory
#    /home/user/.simple-agent/.env
```

**Verify:**
```bash
# Check if key is set
simple-agent config --show-keys
```

### Wrong Configuration Being Used

**Debug with verbose mode:**
```bash
# Show full configuration discovery
simple-agent --verbose

# Shows:
# - Which files exist
# - Priority order
# - Effective configuration
```

**Override for testing:**
```bash
# Use command-line to override
simple-agent --model gpt-4 --provider openai
```

---

## Migration from Old Setup

### If you were using environment variables:

```bash
# Old way (still works)
export ANTHROPIC_API_KEY=sk-ant-...
simple-agent

# New way (recommended)
simple-agent init
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.simple-agent/.env
simple-agent
```

### If you have .env in current directory:

```bash
# Your existing .env still works! (higher priority than user config)
# Nothing to change

# But consider moving personal keys to user config:
mv .env ~/.simple-agent/.env

# And use project .env only for project-specific settings
```

---

## Security Recommendations

### API Key Storage

1. **Personal Development:**
   - Store in `~/.simple-agent/.env`
   - Keep file permissions strict: `chmod 600 ~/.simple-agent/.env`

2. **Project Development:**
   - Use `.env` (gitignored)
   - Provide `.env.example` template for team

3. **Production:**
   - Use environment variables
   - Use secret management (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Never commit to version control

### File Permissions

```bash
# Protect your config directory
chmod 700 ~/.simple-agent
chmod 600 ~/.simple-agent/.env

# Verify
ls -la ~/.simple-agent
# drwx------  .simple-agent
# -rw-------  .env
```

---

## Advanced Usage

### Multiple Profiles

You can maintain multiple configurations using environment variable switching:

```bash
# ~/.simple-agent/.env.personal
ANTHROPIC_API_KEY=sk-ant-personal...

# ~/.simple-agent/.env.work
ANTHROPIC_API_KEY=sk-ant-work...

# Switch profiles
ln -sf ~/.simple-agent/.env.personal ~/.simple-agent/.env  # Use personal
ln -sf ~/.simple-agent/.env.work ~/.simple-agent/.env      # Use work
```

### Project-Specific Servers

```bash
# Project A: Local development
cd ~/project-a
echo "SERVER_PORT=8000" > .env

# Project B: Staging server
cd ~/project-b
echo "SERVER_URL=https://staging.example.com" > .env
```

---

## Reference

### All Configuration Options

| Option | Environment Variable | CLI Flag | Config File | Default |
|--------|---------------------|----------|-------------|---------|
| API Key (Anthropic) | `ANTHROPIC_API_KEY` | - | ✅ | - |
| API Key (OpenAI) | `OPENAI_API_KEY` | - | ✅ | - |
| API Key (Google) | `GOOGLE_API_KEY` | - | ✅ | - |
| Provider | `AI_PROVIDER` | `--provider` | ✅ | (auto) |
| Model | `AI_MODEL` | `--model` | ✅ | claude-sonnet-3-7 |
| Server URL | `SERVER_URL` | `--url` | ✅ | - |
| Server Port | `SERVER_PORT` | `--port` | ✅ | 8000 |
| Log Level | `LOG_LEVEL` | `--silent` | ✅ | info |

### Config File Paths

| Priority | Location | Use Case |
|----------|----------|----------|
| 1 | `./.env` | Project-specific config |
| 2 | `~/.simple-agent/.env` | User personal config (recommended) |
| 3 | `~/.simple-agent.env` | Alternative user config |
| 4 | `~/.simple-agent/config.json` | JSON format config |

---

## Support

- **Documentation:** [Simple Agent CLI docs](../README.md)
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Help:** Run `simple-agent help-config`

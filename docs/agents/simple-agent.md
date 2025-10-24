---
title: Simple Agent CLI (Experimental)
nav_order: 2
parent: Agents
grand_parent: Server API
---

# Simple Agent CLI (Experimental)

> ⚠️ **Experimental:** The `simple-agent` CLI is a minimal reference client built on top of this repository. Expect rough edges while the skill system and sandbox are iterated on.

## Overview

- Runs entirely on the local `simple-rpc-ai-backend` and reuses the server-side skill system – no direct Anthropic Claude Code SDK or Codex SDK integration.
- Ships with a handful of built-in skills (code review, file handling, API design) to showcase progressive disclosure.
- Provides a lightweight Ink-based terminal UI with slash commands and plugin hooks.
- Starts an embedded backend on port `8001` by default, so you can experiment without wiring an external service.

## Quick Start

```bash
pnpm install                              # Install repo dependencies
pnpm exec simple-agent init               # Scaffold ~/.simple-agent/.env
nano ~/.simple-agent/.env                 # Paste your OPENROUTER_API_KEY
pnpm exec simple-agent chat               # Launch interactive session
```

> Need an API key? Grab one from https://openrouter.ai/keys and drop it into `OPENROUTER_API_KEY`.

What happens during startup?

1. The CLI discovers configuration from CLI flags → env vars → `./.env` → `~/.simple-agent/.env`.
2. An embedded `createRpcAiServer` instance boots with agents + skills enabled (port `8001`).
3. The Ink UI connects to that local server and streams responses with skill results rendered separately.

> Need to point at an existing backend? Use `pnpm exec simple-agent chat --url http://localhost:8000` and the embedded server will be skipped.

## Working with Skills

- Use `/skills` to list everything the CLI has loaded.
- Run skill-specific prompts naturally, e.g. `Generate an OpenAPI spec for a todo service`.
- File system operations require approval; the CLI will surface permission prompts before writing.

The CLI loads:

- `main-agent` (core orchestration)
- `file-handling` (secure FS access with sandbox guards)
- `hello-world` (example custom skill mounted from `examples/03-agents-basic/`)

Additional skills can be mounted by editing `tools/simple-agent/src/core/server.ts` or by pointing to new directories in your config.

## Slash Commands & Plugins

- `/model`, `/provider`, and `/config` let you switch runtime settings without restarting.
- Plugins live under `tools/simple-agent/plugins/` and receive the same client+skill context available to slash commands.

Refer to `tools/simple-agent/README.md` for deeper architecture notes and plugin examples.

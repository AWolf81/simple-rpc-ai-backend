---
title: Remote MCP Integrations
parent: Getting Started
nav_order: 5
---

# Remote MCP Integrations

Connect your Simple RPC AI Backend to external MCP servers to expand its tool catalog. We support multiple transports (stdio, streamable HTTP, Docker) and provide battle-tested configuration examples below.

## Prerequisites

- A working Simple RPC AI Backend instance (see the [Quickstart]({{ site.baseurl }}{% link getting-started/quickstart.md %})).
- Node.js 22+ installed locally.
- For uvx-based integrations, install [uv](https://github.com/astral-sh/uv):
  ```bash
  # macOS/Linux
  curl -fsSL https://astral.sh/uv/install.sh | sh

  # Windows PowerShell
  iwr -useb https://astral.sh/uv/install.ps1 | iex
  ```
  Make sure `uvx --help` works before you continue.

## Example Configurations

Add entries under `remoteMcpServers.servers` in your server config to enable external MCP providers.

### Popular MCP Registries

Looking for new tools? These public registries curate Model Context Protocol servers that often work out of the box with our remote transport options:

- [MCP Servers Directory](https://mcpservers.org/) – community-maintained catalogue with tags, transport details, and quick install notes.
- [Smithery Registry](https://smithery.ai/) – hosted/managed MCP servers that can be consumed over streamable HTTP (used in our DuckDuckGo example).
- [MCP Market](https://mcpmarket.com/) – marketplace focused on production-ready MCP integrations with usage stats.
- [Awesome MCP Servers](https://github.com/modelcontextprotocol/awesome-mcp-servers) – GitHub list of open-source servers and companion tooling.

If you need a working end-to-end reference, check the [`examples/02-mcp-server` project](https://github.com/awolf81/simple-rpc-ai-backend/tree/develop/examples/02-mcp-server). It wires together local tools plus several remote registries (DuckDuckGo, Context7, timestamp, git) and shows how to expose them securely.

### Smithery (streamableHttp)

```js
{
  name: 'duckduckgo-search',
  transport: 'streamableHttp',
  url: `https://server.smithery.ai/@nickclyde/duckduckgo-mcp-server/mcp?api_key=${process.env.SMITHERY_API_KEY}&profile=${process.env.SMITHERY_PROFILE}`,
  autoStart: false,
  timeout: 30000
}
```

- Requires a Smithery API key and profile.
- Uses the official Streamable HTTP transport from the MCP SDK.

### Context7 Documentation (npx stdio)

```js
{
  name: 'context7',
  transport: 'npx',
  command: '@upstash/context7-mcp',
  runnerArgs: ['-y'],
  args: ['--api-key', process.env.CONTEXT7_API_KEY || ''],
  autoStart: true,
  timeout: 60000
}
```

- Installs and runs the CLI via `npx`.
- Set `CONTEXT7_API_KEY` in your environment.
- The CLI emits readiness messages on stderr; our client detects them automatically.
- Tools will be exposed as `context7__<toolname>` unless you disable namespacing per server.
  - Tools are exposed as `context7__<toolname>` by default. To keep the original names (e.g. bare `resolve-library-id`), set `prefixToolNames: false` on this server and add the plain names to your `mcp.auth.publicTools` list.

### Timestamp Server (uvx stdio)

```js
{
  name: 'timestamp',
  transport: 'uvx',
  command: 'mcp-server-time',
  autoStart: true,
  timeout: 20000
}
```

- Requires `uvx` (see prerequisites).
- Provides handy time utilities over stdio.
- Default tools are `timestamp__get_current_time` and `timestamp__convert_time` after namespacing.

## Tips

- Each transport has its own startup characteristics; increase `timeout` when necessary.
- Enable debug logging (`LOG_LEVEL=debug`) to watch startup messages, stdout/stderr output, and discovered tools.
- You can mix transports freely—stdio, HTTP, and Docker clients can all run concurrently.
- For Docker transports, configure `containerOptions` (name prefix, reuse, removeOnExit) to control lifecycle behaviour across environments. Leaving `namePrefix` empty uses the server name directly (e.g., `git-mcp`).
- Docker transports require access to the Docker socket. Run `docker ps` and `groups | grep docker` to ensure your user can reach `/var/run/docker.sock` without sudo. If you see `Permission denied accessing Docker socket`, add the user to the `docker` group and re-login.

For deeper reference on remote MCP management, visit the [Remote MCP Servers]({{ site.baseurl }}{% link common-configurations/mcp-remote.md %}) configuration guide.

### Namespacing vs. Plain Tool Names

The manager prefixes remote tools with their server name to avoid collisions. You can opt out per server. Here’s the Context7 example rewritten without the prefix:

```js
{
  name: 'context7',
  transport: 'npx',
  command: '@upstash/context7-mcp',
  runnerArgs: ['-y'],
  args: ['--api-key', process.env.CONTEXT7_API_KEY || ''],
  autoStart: true,
  timeout: 60000,
  prefixToolNames: false
}
```

With `prefixToolNames: false`, the backend exposes tools exactly as the remote server reports them (e.g. `resolve-library-id`). Remember to list those names in `mcp.auth.publicTools` (or grant access through your auth rules) so clients can call them:

```js
mcp: {
  enabled: true,
  auth: {
    requireAuthForToolsCall: false,
    publicTools: [
      'context7__resolve-library-id', // when prefixing
      'resolve-library-id'            // when prefixToolNames is false
    ]
  }
}
```

> **Note:** The `publicTools` list controls which remote tools are callable without additional authentication. Update it whenever you add or rename remote MCP tools.

> **Reminder:** Only public remote tools are supported right now. The `publicTools` list controls which remote MCP tools can be invoked. Add every exposed tool—prefixed or not—to that list.

Prefer a global toggle? Set `remoteMcpServers.prefixToolNames = false` in your server config to make plain names the default, and override per server when you need a prefix.

### Git MCP Server (Docker)

```js
{
  name: 'git',
  transport: 'docker',
  image: 'mcp/git',
  containerArgs: [
    '--rm',
    '-i',
    '--mount', `type=bind,src=/ABSOLUTE/HOST/PATH,dst=/workspace`
  ],
  autoStart: true,
  timeout: 45000
}
```

- Use an absolute host path that exists, is writable, and already contains a Git repository (the mounted folder should include a `.git/` directory). Point it at one of your real projects; the Git MCP image expects a working tree with history to function correctly.
- Place a `git-mcp-config.json` in the mounted directory to define allowed repos/commands.
- Containers run with your filesystem mounted; review security before exposing secrets.
- Set environment variables like `GIT_MCP_HOST_DIR` and `GIT_MCP_REUSE=true` to control host mounts and reuse behaviour.

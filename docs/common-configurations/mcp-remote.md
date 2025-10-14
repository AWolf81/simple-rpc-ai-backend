---
title: Remote MCP Servers
parent: Common Configurations
nav_order: 6
---

# Remote MCP Servers

Remote MCP servers let you extend your toolset by delegating work to external providers. The Simple RPC AI Backend ships with a `RemoteMCPManager` that understands multiple transports and standardizes logging, reconnection, and tool discovery.

| Transport | Use Case | Key Fields |
|-----------|----------|------------|
| `streamableHttp` | Hosted MCP services (e.g. Smithery) | `url`, `headers`, `timeout`, `autoStart` |
| `npx` / `npm-exec` | Node-based CLIs published on npm | `command`, `runnerArgs`, `args`, `timeout` |
| `uvx` | Python MCP servers packaged for uv | `command`, `args`, `timeout` |
| `docker` | Containerized MCPs with custom runtime deps | `image`, `containerArgs`, `timeout` |

## Installation Checklist

Before enabling remote MCP servers:

- Ensure `LOG_LEVEL=debug` during first setup to inspect stdout/stderr.
- Install prerequisites per transport:
  - `streamableHttp`: no extra installs (uses HTTP).
  - `npx`: Node.js >= 18 (npx ships with npm).
  - `uvx`: Install [uv](https://github.com/astral-sh/uv) and verify `uvx --help`.
  - `docker`: Install Docker Desktop/daemon and verify `docker ps` works.
- Add any API keys (e.g. `SMITHERY_API_KEY`, `CONTEXT7_API_KEY`) to your `.env` or deployment secrets.
- For Docker transports, no extra backend configuration is required—the manager reuses the same Docker socket your user already uses (e.g. Docker Desktop). Configure bind mounts only if your remote tool needs files from the host.

## Configuration Templates

Each example below maps directly to the `remoteMcpServers.servers` array.

### Smithery DuckDuckGo (streamableHttp)
```ts
{
  name: 'duckduckgo-search',
  transport: 'streamableHttp',
  url: `https://server.smithery.ai/@nickclyde/duckduckgo-mcp-server/mcp?api_key=${process.env.SMITHERY_API_KEY}&profile=${process.env.SMITHERY_PROFILE}`,
  autoStart: false,
  timeout: 30000
}
```
**Setup:** Obtain Smithery credentials, export them as environment variables, and let the manager connect.

### Context7 Documentation (npx)
```ts
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
**Setup:** Install Node.js, set `CONTEXT7_API_KEY`, and optionally increase the timeout for slower startups.

### Timestamp Utility (uvx)
```ts
{
  name: 'timestamp',
  transport: 'uvx',
  command: 'mcp-server-time',
  autoStart: true,
  timeout: 20000
}
```
**Setup:** Install uv, confirm `uvx` is accessible in PATH, and restart the server.

### Git MCP (Docker)
```ts
{
  name: 'git',
  transport: 'docker',
  image: 'mcp/git',
  containerArgs: [
    '--mount', `type=bind,src=/Users/username/projects,dst=/workspace`
  ],
  containerName: 'mcp-git',
  reuseContainer: true,
  removeOnExit: false,
  autoStart: true,
  timeout: 30000
}
```
**Setup:** Ensure Docker is running; adjust the bind mount paths to align with your filesystem.

**Container management:** Use `remoteMcpServers.containerOptions` to set defaults such as `namePrefix`, `reuse`, and `removeOnExit` so every Docker transport follows the same lifecycle rules. Leave `namePrefix` empty to reuse the server name directly (e.g., `git-mcp`).

### Docker permissions checklist

By default the backend uses whatever Docker socket your current user already has access to (e.g. Docker Desktop’s user-level socket), so you typically do **not** need to tweak permissions or set `DOCKER_HOST`. Containers launched by the manager will show up in Docker Desktop automatically. Double-check only when you intentionally switch to a protected system socket such as `/var/run/docker.sock`:

- Confirm the daemon responds without sudo:
  ```bash
  docker ps
  ```
- If you change `DOCKER_HOST` to point at a root-owned socket (`/var/run/docker.sock`), make sure your user belongs to the `docker` group:
  ```bash
  groups | grep docker
  ```
  Missing output means you should run `sudo usermod -aG docker $USER` and then log out/in (or reboot) to refresh group membership.
- When permissions are missing, the backend logs:
  ```
  ❌ Remote MCP server error (git-mcp): Permission denied accessing Docker socket (/var/run/docker.sock)…
  ```
  Treat that as a hint to revert to the default socket or adjust group membership/`DOCKER_HOST` accordingly.

## Operational Tips

- **Logging:** The manager prints child process stdout/stderr (sanitized). If initialization hangs, inspect the logs for authentication prompts or missing binaries.
- **Timeouts:** Increase `timeout` for transports with heavy initialization (npm downloads, container pulls).
- **Reconnection:** `RemoteMCPManager` automatically retries when `autoStart` is true; tune `retryDelay` and `maxRetries` in `remoteMcpServers` if needed.
- **Tool discovery:** Both the manager and protocol handler log discovered tools; verify that `tools/list` shows your remote abilities inside the dev panel.
- **Namespacing:** Remote tools are automatically prefixed with their server name (e.g. `context7__search`). Keep prefixes enabled to avoid collisions and to make origin obvious.
- **Tool naming:** Use `remoteMcpServers.prefixToolNames=false` to disable prefixes globally, or set `prefixToolNames: false` on individual servers for selective overrides.
- **Public access:** Remote tools currently require inclusion in `mcp.auth.publicTools` to be callable (`context7__resolve-library-id`, `timestamp__get_current_time`, etc.). Authenticated-only remote tools are on the roadmap but not yet supported.

Need more? Check the [Remote MCP Integrations]({{ site.baseurl }}{% link getting-started/remote-mcp.md %}) guide for step-by-step instructions.

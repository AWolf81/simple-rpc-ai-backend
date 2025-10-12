---
title: Overview
parent: Server API
grand_parent: Documentation
nav_order: 1
---

# Server API Overview

The backend exposes a tRPC router and MCP-compatible transport for assistants. Key capabilities include:

- **AI Provider Operations** – request completion, provider metadata, and billing hints.
- **Workspace Tools** – list, read, write, and manage server workspaces.
- **Registry Management** – query live and fallback model metadata.
- **Resource Protocols** – load content via custom schemes (SMB, SFTP, HTTP, etc.).

## HTTP Endpoints

| Endpoint | Description | Enablement |
| --- | --- | --- |
| `POST /mcp` | HTTP transport for the Model Context Protocol. MCP clients post tool invocations and resource requests to this endpoint. | Set `mcp: { enabled: true }` and ensure the HTTP transport is not disabled (`transports.http` defaults to `true`). |
| `GET /trpc/<procedure>` (queries) / `POST /trpc/<procedure>` (mutations) | Raw tRPC endpoints used by SDK clients and the dev panel. Queries are encoded as GET requests; mutations send a SuperJSON payload with POST. | Enable the protocol with `protocols: { tRpc: true }` (or via `.simplerpcaibackendrc` → `trpc.protocols.tRpc`). |
| `POST /rpc` | JSON-RPC 2.0 bridge that exposes tRPC procedures for compatibility with OpenRPC tooling. | Leave `protocols.jsonRpc` at the default (`true`) or set it explicitly. |

Example requests:

```bash
# tRPC immutably encodes the input argument
curl 'http://localhost:8000/trpc/system.health?input=%7B%7D'

# JSON-RPC bridge
curl -X POST http://localhost:8000/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","method":"ai.listProviders","params":{"provider":"anthropic"},"id":1}'
```

### Method Namespaces

The default router ships with these namespaces (all available under both `/trpc` and `/rpc`):

- `ai.*` – model management, text generation, provider metadata.
- `mcp.*` – MCP tool catalogues and resource helpers.
- `system.*` – server workspace utilities and filesystem helpers.
- `admin.*` – health checks, status pages, configuration diagnostics.
- `auth.*` – OAuth and API-key helpers.
- `billing.*` – usage analytics and virtual token APIs.
- `user.*` – BYOK management and user profile settings.


A complete list of procedures, grouped by namespace, is available inside the dev panel and in the generated [Methods]({{ site.baseurl }}{% link server-api/methods.md %}) reference.

Review the sections below for implementation details and integration examples:

- [Resources]({{ site.baseurl }}{% link server-api/resources.md %})
- [Tools]({{ site.baseurl }}{% link server-api/tools.md %})
- [Registry]({{ site.baseurl }}{% link server-api/registry.md %})
- [Methods]({{ site.baseurl }}{% link server-api/methods.md %})

For configuration options, see [Common Configurations]({{ site.baseurl }}{% link common-configurations/index.md %}).
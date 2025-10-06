---
layout: default
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

Review the sections below for implementation details and integration examples:

- [Resources](resources.md)
- [Tools](tools.md)
- [Registry](registry.md)

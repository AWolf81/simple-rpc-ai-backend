---
layout: default
title: Installation
parent: Getting Started
grand_parent: Documentation
nav_order: 2
---

# Installation

> ⚠️ **This guide is for contributors and package developers.**  
> If you only consume the npm package, head to the [Quickstart](quickstart.md) instead.

Follow these steps to install and verify the Simple RPC AI Backend locally from the repository.

## Prerequisites

- **Node.js** 22.0.0 or newer (tRPC compatibility)
- **pnpm** 7.0.0 or newer (Corepack recommended)
- **Python** 3.8+ when building optional native modules

## Standard Installation

```bash
corepack enable
pnpm install
pnpm build
```

The install script pulls model registry data and compiles the TypeScript server output in `dist/`.

## Safe Installation Mode

If you hit native build issues (for example with `bcrypt`, `cpu-features`, or `ssh2`), run the safe installer which swaps in JavaScript fallbacks and ignores optional dependency failures.

```bash
pnpm run install:safe
```

## Verify the Build

```bash
pnpm build
node -e "const pkg = require('./package.json'); console.log('✅', pkg.name, pkg.version);"
```

## System Notes

- Native module failures are non-blocking for runtime features.
- The `copy-assets` script ensures all JSON data files are shipped with the build output.

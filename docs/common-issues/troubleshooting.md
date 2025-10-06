---
layout: default
title: Troubleshooting
parent: Common Issues
grand_parent: Documentation
nav_order: 1
---

# Troubleshooting

Solutions to the most common setup and runtime problems.

## Installation Failures

### Python `distutils` Missing (Python 3.12+)

Install the compatibility packages:

```bash
sudo apt-get install python3-distutils
python3 -m pip install setuptools
pnpm run install:safe
```

### Native Module Build Errors (`gyp ERR!`)

- Native dependencies such as `bcrypt`, `cpu-features`, and `ssh2` are optional.
- Use `pnpm run install:safe` to fall back to JavaScript implementations.
- Confirm you are running Node.js 22+ and pnpm 7+.

## Missing JSON Data Files

Ensure the asset copy script runs during the build:

```bash
pnpm build
```

The `copy-assets` step includes `src/data/*` in the final `dist/` directory.

## Verification Checklist

```bash
pnpm build
node -e "const pkg = require('./package.json'); console.log('✅', pkg.name, pkg.version);"
```

## Manual Workarounds

```bash
pnpm install --ignore-scripts
pnpm build

export PYTHON=python3.11
pnpm install

docker run -v $(pwd):/app -w /app node:22 \
  sh -c "corepack enable && pnpm install && pnpm build"
```

## `ERR_MODULE_NOT_FOUND` When Starting the Server

If Node reports `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../dist/index.js`, confirm the project is marked as an ES module. The root `package.json` must contain `"type": "module"`; some scaffolding tools overwrite this flag.

```bash
pnpm pkg set type=module
pnpm install
```

Restart the server after restoring the module type so ESM imports resolve correctly.

## Getting Help

1. Confirm Node.js and Python versions with `node --version` and `python3 --version`.
2. Capture the failing command output.
3. Open an issue with system details and logs so we can investigate quickly.

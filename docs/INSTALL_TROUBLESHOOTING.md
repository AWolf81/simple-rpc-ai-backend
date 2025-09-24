# Installation Troubleshooting

This document provides solutions for common installation issues when installing `simple-rpc-ai-backend` from GitHub.

## Quick Solutions

### GitHub Installation (Recommended)
```bash
# Method 1: Standard install (should work with our fixes)
pnpm add git+https://github.com/AWolf81/simple-rpc-ai-backend.git

# Method 2: If you encounter native module build errors
cd /path/to/your/project
git clone https://github.com/AWolf81/simple-rpc-ai-backend.git
cd simple-rpc-ai-backend
pnpm run install:safe
```

## Common Issues & Solutions

### Issue 1: Python distutils Missing (Python 3.12+)

**Error:** `ModuleNotFoundError: No module named 'distutils'`

**Cause:** Python 3.12+ removed the `distutils` module, but some native Node.js modules still depend on it.

**Solutions:**

1. **Install distutils (Ubuntu/Debian):**
   ```bash
   sudo apt-get install python3-distutils
   ```

2. **Install setuptools (All platforms):**
   ```bash
   python3 -m pip install setuptools
   ```

3. **Use our automated fallback (Recommended):**
   ```bash
   pnpm run install:safe
   ```

### Issue 2: Native Module Build Failures

**Error:** `gyp ERR! configure error` or `Failed to execute`

**Affected modules:** `bcrypt`, `cpu-features`, `ssh2`

**Solutions Applied:**

1. **bcrypt → bcryptjs:** We replaced native `bcrypt` with pure JS `bcryptjs`
2. **Optional dependencies:** `cpu-features` and `ssh2` are dev dependencies and failures are handled gracefully
3. **Build configuration:** Added `.npmrc` with `ignore-build-errors=true`

### Issue 3: Missing JSON Data Files

**Error:** `Cannot find module '../data/production-models.json'`

**Solution Applied:** Fixed `copy-assets` script to include `src/data/*` files in build output.

## System Requirements

- **Node.js:** >= 22.0.0 (required for tRPC)
- **pnpm:** >= 7.0.0
- **Python:** 3.8+ (for native modules, if needed)

## Verification

After installation, verify everything works:

```bash
# Check build
pnpm build

# Check basic functionality
node -e "const pkg = require('./package.json'); console.log('✅', pkg.name, pkg.version);"
```

## Manual Workarounds

If automated solutions don't work:

1. **Skip optional dependencies:**
   ```bash
   pnpm install --ignore-scripts
   pnpm build
   ```

2. **Use different Python version:**
   ```bash
   export PYTHON=python3.11  # or another version with distutils
   pnpm install
   ```

3. **Docker-based install:**
   ```bash
   docker run -v $(pwd):/app -w /app node:22 sh -c "corepack enable && pnpm install && pnpm build"
   ```

## Development Notes

- Native module failures for `ssh2` and `cpu-features` are non-critical (they're for optional crypto bindings in test containers)
- The main application uses pure JavaScript dependencies for maximum compatibility
- All critical functionality works without native modules

## Getting Help

If you still have installation issues:

1. Check your Node.js version: `node --version` (should be >= 22.0.0)
2. Check your Python version: `python3 --version`
3. Try the manual workarounds above
4. Create an issue with your system details and error messages
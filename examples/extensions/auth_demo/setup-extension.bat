@echo off
echo Setting up VS Code OAuth Extension Demo...
echo.

echo Creating standalone node_modules...
if not exist "node_modules" (
    echo Installing dependencies locally...
    npm install --no-workspaces
) else (
    echo Dependencies already installed.
)

echo.
echo Compiling TypeScript...
npx tsc -p ./

echo.
if exist "out\simple-oauth-extension.js" (
    echo ✅ Extension compiled successfully!
    echo.
    echo 🔧 IMPORTANT: GitHub Auth Provider Fix Applied
    echo    - Added proper provider waiting logic
    echo    - Handles authentication provider registration timeout
    echo    - Includes better error messages and retry options
    echo.
    echo 📋 Next steps:
    echo 1. Start the OAuth server: 
    echo    cd ../../servers
    echo    node simple-oauth-server.js
    echo.
    echo 2. Open this folder (auth_demo) in VS Code
    echo 3. Press F5 to launch Extension Development Host
    echo 4. Wait for "Extension Host" to fully load (may take 10-30 seconds)
    echo 5. In the new VS Code window, open Command Palette (Ctrl+Shift+P)
    echo 6. Run: "OAuth Test: Authenticate with GitHub"
    echo.
    echo 🔐 The extension will:
    echo    - Wait for GitHub authentication provider to be ready
    echo    - Show progress notification
    echo    - Open GitHub OAuth in your browser
    echo    - Handle authentication provider timeouts gracefully
    echo.
    echo 🚨 If you get authentication provider errors:
    echo    1. Wait a bit longer - GitHub provider can take time to register
    echo    2. Try the authenticate command again
    echo    3. Check your internet connection
    echo    4. Restart VS Code Extension Development Host if needed
) else (
    echo ❌ Compilation failed. 
    echo.
    echo Try manual installation:
    echo npm install @types/vscode@^1.74.0 @types/node@^18.0.0 typescript@^5.0.0 axios@^1.6.0
    echo npx tsc -p ./
)

echo.
pause
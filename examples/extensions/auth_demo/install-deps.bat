@echo off
echo Installing VS Code extension dependencies...
echo.

echo Installing npm dependencies...
npm install

echo.
echo Compiling TypeScript...
npx tsc -p ./

echo.
if exist "out\simple-oauth-extension.js" (
    echo ✅ Compilation successful!
    echo Ready to test in VS Code Extension Development Host
    echo.
    echo Next steps:
    echo 1. Open this folder in VS Code
    echo 2. Press F5 to launch Extension Development Host
    echo 3. Test the OAuth commands in the new VS Code window
) else (
    echo ❌ Compilation failed. Check for errors above.
)

pause
# VS Code Launch Configuration Guide

## 🚀 Quick Start

### **1. One-Click Setup**
```bash
# Run this first
setup-extension.bat
```

### **2. Launch Extension in VS Code**
1. **Open `auth_demo` folder in VS Code**
2. **Press F5** or use "Run > Start Debugging"
3. **Select**: "🚀 Launch OAuth Extension" (default)
4. **New VS Code window opens** - this is your test environment

## 🎯 Available Launch Configurations

### **🚀 Launch OAuth Extension (Clean)** (Recommended - Default F5)
- **What it does**: Compiles extension and launches with **ALL OTHER EXTENSIONS DISABLED**
- **Pre-launch**: Automatically runs `npm run compile`
- **Use when**: Normal development and testing (CLEANEST experience)
- **Benefits**: No noise from Continue, YAML, or other extensions
- **Includes**: Only GitHub authentication provider and core VS Code features

### **🧪 Test Extension (Clean + Auth Debug)**
- **What it does**: Launches without compilation, **ALL OTHER EXTENSIONS DISABLED**
- **Pre-launch**: None (faster startup)
- **Use when**: Quick testing after manual compilation
- **Benefits**: Clean environment + extra auth debugging
- **Includes**: `VSCODE_DEBUG_AUTH=true` for detailed authentication logs

### **🔧 Full Debug (Clean + Verbose)**
- **What it does**: Maximum debugging with **ALL OTHER EXTENSIONS DISABLED**
- **Pre-launch**: None
- **Use when**: Troubleshooting complex extension issues
- **Benefits**: Clean + verbose VS Code logging + internal console
- **Includes**: All debugging features, internal console opens automatically

### **🌐 Test with Other Extensions**
- **What it does**: Launches with all your installed extensions enabled
- **Pre-launch**: Compiles extension
- **Use when**: Testing compatibility with other extensions
- **Note**: Will show errors from Continue, YAML, and other extensions

## 📋 Available Tasks (Ctrl+Shift+P > "Tasks: Run Task")

### **Build Tasks:**
- `npm: compile` - Compile TypeScript to JavaScript
- `npm: watch` - Watch and auto-compile on changes
- `📦 Install Extension Dependencies` - Install npm packages
- `🔧 Setup Extension` - Run complete setup script

### **Server Tasks:**
- `🚀 Start OAuth Server` - Start the OAuth server in background
- `🧪 Test Server Connection` - Test if server is working

## 🔍 Troubleshooting Launch Issues

### **Issue: "Cannot find module 'vscode'"**
**Solution:**
1. Make sure you ran `setup-extension.bat` first
2. Check that `node_modules/@types/vscode` exists
3. Try: `npm install --no-workspaces`

### **Issue: "preLaunchTask 'npm: compile' not found"**
**Solution:**
1. Use "🔧 Debug Extension (No Compile)" instead
2. Or manually run: `npx tsc -p ./`

### **Issue: Extension doesn't activate**
**Solution:**
1. Check VS Code's Developer Tools (Help > Developer Tools)
2. Look for errors in Console tab
3. Make sure `out/simple-oauth-extension.js` exists

### **Issue: GitHub authentication timeout**
**Solution:**
1. Wait longer - Extension Host can take 30+ seconds to initialize
2. Try the authenticate command again after full startup
3. Check internet connection

## 🎯 Complete Testing Workflow

### **Step 1: Setup**
```bash
cd auth_demo
setup-extension.bat
```

### **Step 2: Start Server**
In VS Code:
- **Ctrl+Shift+P** > "Tasks: Run Task" > "🚀 Start OAuth Server"
- **Wait for**: "Server running on port 8000"

### **Step 3: Launch Extension** 
- **Press F5** or use "🚀 Launch OAuth Extension"
- **Wait for Extension Host** to fully load (10-30 seconds)

### **Step 4: Test Authentication**
In the new VS Code window:
- **Ctrl+Shift+P** > "OAuth Test: Authenticate with GitHub"
- **Follow GitHub OAuth flow** in browser
- **Verify authentication success**

### **Step 5: Test AI Integration**
- **Ctrl+Shift+P** > "OAuth Test: Ask AI Assistant"
- **Enter a question** and verify AI response

## 🚨 Common Gotchas

1. **Extension Host Loading**: Can take 10-30 seconds to fully initialize
2. **GitHub Provider**: May need additional time to register after Extension Host loads
3. **Server Dependency**: OAuth server must be running before testing authentication
4. **Compilation**: Always compile before launching (F5 does this automatically)
5. **Node Modules**: Must be installed locally, not just in workspace root

## 💡 Pro Tips

- **Use F5** for normal development (auto-compiles)
- **Use "🧪 Test Extension"** for quick testing after manual compilation
- **Check Developer Tools** (Help > Developer Tools) for debugging
- **Keep OAuth server running** in a separate terminal/task
- **Wait for full Extension Host initialization** before testing auth

This configuration provides a smooth development experience for testing OAuth authentication with the AI backend server! 🎉
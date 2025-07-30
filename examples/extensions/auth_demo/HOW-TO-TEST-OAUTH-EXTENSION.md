# How to Test Simple OAuth Extension

This guide walks you through testing the `simple-oauth-extension.ts` with the OAuth server, demonstrating secure authentication without private keys.

## 🎯 Overview

The simple OAuth extension demonstrates:
- **VS Code built-in OAuth** (no private keys needed!)
- **Secure server authentication** with GitHub/Microsoft
- **Corporate-friendly architecture** (system prompts stay server-side)
- **Automatic session management** and token refresh

## 📋 Prerequisites

### 1. Server Setup
First, make sure the OAuth server is running:

```bash
cd examples/servers
node simple-oauth-server.js
```

**Expected output:**
```
🚀 Simple OAuth Server - Starting Simple OAuth Server...
🔐 OAuth authentication enabled
   📋 Allowed providers: github
   👥 User restrictions: Any authenticated user
   🏢 Org restrictions: None
   📧 Require verified email: Yes
   ⏱️  Session duration: 24 hours
🚀 Progressive AI Backend Server
🌐 Server running on port 8000
```

### 2. Extension Dependencies
The extension needs these dependencies:

```bash
cd examples/extensions
npm install axios @types/vscode
```

### 3. VS Code Extension Setup
You'll need:
- **VS Code** with extension development capabilities
- **GitHub account** (for OAuth testing)
- **Extension Development Host** (new VS Code window for testing)

## 🧪 Testing Steps

### Step 1: Prepare Extension for Testing

1. **Create VS Code Extension Project**:
```bash
cd examples/extensions
npm init
```

2. **Create package.json**:
```json
{
  "name": "simple-oauth-test",
  "displayName": "Simple OAuth Test",
  "description": "Test OAuth authentication with AI backend",
  "version": "0.0.1",
  "engines": { "vscode": "^1.74.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/simple-oauth-extension.js",
  "contributes": {
    "commands": [
      {
        "command": "extension.authenticate",
        "title": "🔐 Authenticate with GitHub",
        "category": "OAuth Test"
      },
      {
        "command": "extension.aiChat",
        "title": "🤖 Ask AI Assistant",
        "category": "OAuth Test"
      },
      {
        "command": "extension.signOut",
        "title": "🚪 Sign Out",
        "category": "OAuth Test"
      }
    ]
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "typescript": "^5.0.0"
  }
}
```

3. **Create tsconfig.json**:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": ".",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

4. **Compile the Extension**:
```bash
npx tsc -p ./
```

### Step 2: Launch Extension Development Host

1. **Open VS Code** in the extension directory
2. **Press F5** or use "Run > Start Debugging"
3. **Select "VS Code Extension Development"**
4. **New VS Code window opens** - this is your test environment

### Step 3: Test Authentication Flow

#### 3.1 Manual Authentication
1. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. **Type**: `OAuth Test: Authenticate with GitHub`
3. **Press Enter**

**Expected Flow:**
```
🔄 Starting OAuth authentication with github...
[Browser opens for GitHub OAuth]
[User signs in to GitHub]
✅ Got OAuth session for your-email@example.com
✅ Server authentication successful!
   👤 User: your-email@example.com
   🎫 Session: oauth_1703123456789_abc123def...
```

#### 3.2 Verify Authentication Success
- **Information popup** appears: "✅ Authenticated as Your Name!"
- **Click "Show Details"** to see authentication information
- **Webview panel opens** showing user details and security features

### Step 4: Test AI Integration

#### 4.1 Make AI Request
1. **Open Command Palette**
2. **Type**: `OAuth Test: Ask AI Assistant`
3. **Enter a question**: "What is TypeScript?"

**Expected Flow:**
```
🤖 Processing AI request
✅ AI request completed in 1500ms
```

#### 4.2 Verify AI Response
- **Progress notification** shows "Getting AI response..."
- **New Markdown document opens** with:
  - Your question
  - AI response
  - Timestamp
  - Authentication details

### Step 5: Test Session Management

#### 5.1 Test Auto-Reconnection
1. **Restart VS Code Extension Host** (close and reopen)
2. **Extension auto-activates**
3. **Check console** for auto-authentication:

```
🔄 Found existing OAuth session, authenticating...
✅ Auto-authentication successful
```

#### 5.2 Test Sign Out
1. **Open Command Palette**
2. **Type**: `OAuth Test: Sign Out`
3. **Verify sign out**:

```
✅ Signed out successfully
```

### Step 6: Test Error Scenarios

#### 6.1 Server Offline Test
1. **Stop the OAuth server** (`Ctrl+C`)
2. **Try authentication**
3. **Expected error**: "❌ Authentication failed: connect ECONNREFUSED"

#### 6.2 Invalid Token Test
1. **Start server again**
2. **Manually invalidate session** (server restart clears sessions)
3. **Try AI request**
4. **Should auto-reconnect**: "⚠️ Session expired. Re-authenticating..."

## 🔍 Debugging Guide

### View Extension Logs
1. **Open Developer Tools**: `Help > Developer Tools`
2. **Console tab** shows extension logs
3. **Look for** 🔐, ✅, ❌ prefixed messages

### Common Issues

#### Issue: "GitHub authentication failed"
**Solution:**
- Check internet connection
- Ensure GitHub account has verified email
- Try signing out of GitHub in browser first

#### Issue: "Server authentication failed"
**Solution:**
- Verify server is running on port 8000
- Check server logs for OAuth errors
- Ensure `allowedUsers` config allows your email

#### Issue: "AI request failed"
**Solution:**
- Set `ANTHROPIC_API_KEY` environment variable
- Check server logs for AI service errors
- Verify API key is valid

### Server Logs to Monitor
```bash
# In server terminal, watch for:
🔐 OAuth authentication enabled
✅ OAuth session validated for user@example.com
🤖 Processing AI request
✅ AI request completed in 1200ms
```

## 🧪 Advanced Testing

### Test Multiple Users
1. **Use different GitHub accounts**
2. **Test `allowedUsers` configuration**
3. **Verify user restrictions work**

### Test Organization Restrictions
1. **Configure `allowedOrgs` in server**
2. **Test with users from different GitHub orgs**
3. **Verify org-based access control**

### Test Session Expiration
1. **Set short `sessionExpirationMs`** (5 minutes)
2. **Wait for expiration**
3. **Verify auto-reconnection works**

### Test Corporate Proxy Scenario
1. **Configure corporate proxy**
2. **Verify GitHub OAuth works through proxy**
3. **Check server receives requests properly**

## 🎯 Success Criteria

### ✅ Authentication Tests Pass
- [x] GitHub OAuth flow opens browser
- [x] User can authenticate successfully  
- [x] Server receives and validates token
- [x] Session token is returned
- [x] User info is displayed correctly

### ✅ AI Integration Tests Pass
- [x] AI requests work with authentication
- [x] System prompts are protected server-side
- [x] Responses are properly formatted
- [x] Metadata is included correctly

### ✅ Security Tests Pass
- [x] No private keys in extension code
- [x] Tokens are managed by VS Code
- [x] Server validates tokens with GitHub
- [x] Sessions expire properly
- [x] Sign out clears all sessions

### ✅ Error Handling Tests Pass
- [x] Network errors are handled gracefully
- [x] Token expiration triggers re-authentication
- [x] Server errors are displayed to user
- [x] OAuth failures are recoverable

## 📝 Test Report Template

```markdown
# OAuth Extension Test Report

**Date:** [Date]
**Tester:** [Name]
**Server Version:** [Version]
**VS Code Version:** [Version]

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| GitHub OAuth Flow | ✅/❌ | |
| Server Authentication | ✅/❌ | |
| AI Request Execution | ✅/❌ | |
| Auto-Reconnection | ✅/❌ | |
| Session Management | ✅/❌ | |
| Error Handling | ✅/❌ | |

## Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description

## Security Verification
- [ ] No private keys in extension
- [ ] OAuth tokens secured by VS Code
- [ ] Server validates tokens properly
- [ ] System prompts protected
```

## 🔧 Troubleshooting

### Extension Won't Activate
1. Check `package.json` activation events
2. Verify TypeScript compilation succeeded
3. Look for syntax errors in console

### OAuth Flow Doesn't Open
1. Check VS Code version (needs 1.74.0+)
2. Verify internet connection
3. Try different OAuth provider

### Server Connection Issues
1. Verify server URL in extension config
2. Check CORS configuration
3. Test server endpoints with curl

This comprehensive testing guide ensures your OAuth extension works correctly with the secure authentication flow! 🚀
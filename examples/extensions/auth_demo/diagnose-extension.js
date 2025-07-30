// Quick diagnostic for OAuth extension in VS Code Extension Development Host
// Run this in VS Code's integrated terminal to check extension status

console.log('🔍 OAuth Extension Diagnostics');
console.log('==============================\n');

// Check if we're in Extension Development Host
const isExtensionHost = process.env.VSCODE_PID !== undefined;
console.log(`📍 Running in Extension Host: ${isExtensionHost ? '✅ Yes' : '❌ No'}`);

if (isExtensionHost) {
  console.log(`   Process ID: ${process.env.VSCODE_PID}`);
  console.log(`   Node Environment: ${process.env.NODE_ENV || 'not set'}`);
}

// Check if VS Code API is available (this will only work if run from extension context)
try {
  const vscode = require('vscode');
  console.log('📦 VS Code API: ✅ Available');
  
  // Check available authentication providers
  if (vscode.authentication) {
    console.log('🔐 Authentication API: ✅ Available');
    
    // Try to get available providers (this might not work in all contexts)
    setTimeout(async () => {
      try {
        console.log('🔍 Checking for GitHub authentication provider...');
        // This will help us see if GitHub provider is available
        const providers = await vscode.authentication.getAccounts('github');
        console.log('✅ GitHub provider is accessible');
      } catch (error) {
        console.log('⚠️  GitHub provider check:', error.message);
        console.log('   This is normal if GitHub provider is still initializing');
      }
    }, 1000);
  } else {
    console.log('❌ Authentication API: Not available');
  }
  
} catch (error) {
  console.log('📦 VS Code API: ❌ Not available');
  console.log('   This script should be run from VS Code Extension Development Host');
}

// Check if axios is available
try {
  const axios = require('axios');
  console.log('🌐 Axios HTTP client: ✅ Available');
} catch (error) {
  console.log('🌐 Axios HTTP client: ❌ Not found');
  console.log('   Run: npm install axios');
}

// Check compiled extension
const fs = require('fs');
const path = require('path');

const extensionPath = path.join(__dirname, 'out', 'simple-oauth-extension.js');
if (fs.existsSync(extensionPath)) {
  console.log('📄 Compiled extension: ✅ Found');
  const stats = fs.statSync(extensionPath);
  console.log(`   File size: ${Math.round(stats.size / 1024)}KB`);
  console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
} else {
  console.log('📄 Compiled extension: ❌ Not found');
  console.log('   Run: npx tsc -p ./');
}

// Check package.json commands
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log('📋 Extension Commands:');
  if (pkg.contributes && pkg.contributes.commands) {
    pkg.contributes.commands.forEach(cmd => {
      console.log(`   • ${cmd.title} (${cmd.command})`);
    });
  }
}

console.log('\n🎯 Next Steps:');
console.log('1. Make sure OAuth server is running: node ../../servers/simple-oauth-server.js');
console.log('2. In VS Code Extension Development Host, open Command Palette (Ctrl+Shift+P)');
console.log('3. Look for "OAuth Test" commands');
console.log('4. Try: "OAuth Test: 🔐 Authenticate with GitHub"');
console.log('\n💡 Ignore unrelated extension errors (Continue, YAML, etc.)');
console.log('   Focus only on OAuth extension console messages');
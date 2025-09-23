/**
 * File Reader Helper Usage Examples
 *
 * This file demonstrates how to easily set up file reading capabilities
 * with secure root folder management.
 */

import {
  createRpcAiServer,
  createRootManager,
  FileReaderHelpers,
  TemplateRegistry,
  createFileReader,
  createDirectoryLister,
  mcpResourceRegistry
} from 'simple-rpc-ai-backend';

// Create root manager with safe directories
const rootManager = createRootManager({
  defaultRoots: {
    'project': {
      path: '/home/user/projects',
      name: 'Project Files',
      description: 'Source code and project files'
    },
    'docs': {
      path: '/home/user/documents',
      name: 'Documentation',
      description: 'Documentation and text files'
    },
    'config': {
      path: '/etc/myapp',
      name: 'Configuration',
      description: 'Application configuration files'
    }
  }
});

// Example 1: Quick helpers for common cases
const textReader = FileReaderHelpers.textFileReader(rootManager, 'text-files');
const codeReader = FileReaderHelpers.codeFileReader(rootManager, 'source-code');
const configReader = FileReaderHelpers.configFileReader(rootManager, 'app-config');
const dirBrowser = FileReaderHelpers.directoryBrowser(rootManager, 'file-browser');

// Example 2: Custom file reader with specific requirements
const customReader = createFileReader({
  id: 'log-file-reader',
  name: 'Log File Reader',
  description: 'Read application log files with filtering',
  rootManager,
  allowedExtensions: ['.log', '.txt'],
  maxFileSize: 50 * 1024 * 1024, // 50MB for log files
  includeMetadata: true
});

// Example 3: Specialized directory lister for images
const imageBrowser = createDirectoryLister({
  id: 'image-browser',
  name: 'Image File Browser',
  description: 'Browse image files in directories',
  rootManager,
  includeMetadata: true
});

// Register all templates
const templateRegistry = new TemplateRegistry()
  .registerMany(
    textReader,
    codeReader,
    configReader,
    dirBrowser,
    customReader,
    imageBrowser
  );

// Apply to MCP registry
templateRegistry.applyTo(mcpResourceRegistry);

// Create server
const server = createRpcAiServer({
  port: 8001,
  mcp: {
    enableMCP: true,
    extensions: {
      resources: {
        includeDefaults: true
      }
    }
  }
});

console.log('📁 File Reader Helper Usage Examples');
console.log('🗂️ Configured Root Folders:');
Object.entries(rootManager.getClientRootFolders()).forEach(([id, folder]) => {
  console.log(`   • ${id}: ${folder.name} (${folder.description})`);
});

console.log('\\n📋 Available File Readers:');
templateRegistry.getAllConfigs().forEach(config => {
  console.log(`   • ${config.name}: ${config.uriTemplate || config.id}`);
});

console.log('\\n🧪 Example Usage:');

console.log('\\n1. Read a text file:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=docs&path=readme.txt&format=raw&encoding=utf8"}}\'');

console.log('\\n2. Read source code with metadata:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"mcp://internal/source-code?rootId=project&path=src/main.js&format=json"}}\'');

console.log('\\n3. Browse directory contents:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"mcp://internal/file-browser?rootId=project&path=src&format=tree&filter=files"}}\'');

console.log('\\n4. Read configuration file:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"mcp://internal/app-config?rootId=config&path=app.json&format=json"}}\'');

console.log('\\n5. Read log file in base64:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"mcp://internal/log-file-reader?rootId=project&path=logs/app.log&format=base64"}}\'');

console.log('\\n6. Filter directory by extension:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":6,"method":"resources/read","params":{"uri":"mcp://internal/image-browser?rootId=docs&path=images&format=json&filter=files&extension=.jpg"}}\'');

console.log('\\n7. Get file metadata only:');
console.log('   curl -X POST http://localhost:8001/mcp \\\\');
console.log('     -H "Content-Type: application/json" \\\\');
console.log('     -d \'{"jsonrpc":"2.0","id":7,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=docs&path=large-file.txt&format=metadata"}}\'');

console.log('\\n🔐 Security Features:');
console.log('   • All file access is restricted to configured root folders');
console.log('   • Path traversal attacks are prevented');
console.log('   • File size limits protect against large file attacks');
console.log('   • File extension filtering provides additional security');
console.log('   • Metadata includes size and modification time');

console.log('\\n🎯 Easy Integration:');
console.log('   • FileReaderHelpers.textFileReader(rootManager) - Quick text file access');
console.log('   • FileReaderHelpers.codeFileReader(rootManager) - Source code reading');
console.log('   • FileReaderHelpers.configFileReader(rootManager) - Config file access');
console.log('   • FileReaderHelpers.directoryBrowser(rootManager) - Directory listing');
console.log('   • createFileReader(config) - Custom file reader with specific requirements');

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  server.start();
}
/**
 * Example 5: Local Resources Server
 *
 * Demonstrates file reading and template engine capabilities
 * for creating dynamic MCP resources from local files and templates.
 */

import {
  createRpcAiServer,
  createRootManager,
  FileReaderHelpers,
  createTemplate,
  QuickTemplates,
  TemplateRegistry,
  mcpResourceRegistry
} from 'simple-rpc-ai-backend';

// 1. Configure root manager with secure file access
const rootManager = createRootManager({
  defaultRoots: {
    'project': {
      path: process.cwd(),
      name: 'Project Files',
      description: 'Current working directory'
    },
    'data': {
      path: './data',
      name: 'Data Files',
      description: 'JSON and Markdown resources'
    },
    'examples': {
      path: './examples',
      name: 'Example Files',
      description: 'Example code and resources'
    }
  }
});

// 2. Create file readers using helpers
const textReader = FileReaderHelpers.textFileReader(rootManager, 'text-files');
const codeReader = FileReaderHelpers.codeFileReader(rootManager, 'source-code');
const dirBrowser = FileReaderHelpers.directoryBrowser(rootManager, 'file-browser');

// 3. Create custom file reader for specific use case
const logReader = {
  id: 'log-reader',
  name: 'Log File Reader',
  description: 'Read application log files with filtering',
  uriTemplate: 'mcp://internal/log-reader?rootId={rootId}&path={path}&format={format}',
  arguments: [
    { name: 'rootId', description: 'Root folder ID', required: true },
    { name: 'path', description: 'File path', required: true },
    { name: 'format', description: 'Output format (raw/json/base64)', required: false }
  ],
  mimeType: 'text/plain',
  async handler(args) {
    const { rootId, path, format = 'raw' } = args;
    // Implementation would use rootManager to read files
    return {
      content: `Log file content for ${path} in format ${format}`,
      mimeType: format === 'json' ? 'application/json' : 'text/plain'
    };
  }
};

// 4. Create template resources
const projectDocs = createTemplate('project-docs')
  .name('Project Documentation')
  .description('Generate project documentation in multiple formats')
  .enumParameter('section', ['readme', 'api', 'guide'], 'Documentation section')
  .enumParameter('format', ['md', 'html', 'json'], 'Output format')
  .markdown(async (params) => {
    const { section } = params;
    return {
      content: `# ${section.toUpperCase()} Documentation\n\nGenerated documentation for ${section}...`
    };
  })
  .json(async (params) => {
    const { section } = params;
    return {
      content: JSON.stringify({
        section,
        title: `${section} Documentation`,
        content: 'Documentation content...',
        lastUpdated: new Date().toISOString()
      }, null, 2)
    };
  });

// 5. Create API documentation template using QuickTemplates
const apiDocs = QuickTemplates.apiDocsTemplate(
  'api-endpoints',
  'API Endpoints Documentation',
  'List and document available API endpoints'
);

// 6. Create custom database query template
const dbQuery = createTemplate('database-query')
  .name('Database Query Tool')
  .description('Query database tables with flexible output')
  .stringParameter('table', 'Table name', true)
  .enumParameter('format', ['json', 'csv', 'markdown'], 'Output format')
  .numberParameter('limit', 'Row limit', 1, 1000, 50)
  .generator(async (params) => {
    const { table, format, limit } = params;

    // Mock database query
    const mockData = [
      { id: 1, name: 'Item 1', status: 'active' },
      { id: 2, name: 'Item 2', status: 'inactive' }
    ];

    if (format === 'json') {
      return {
        content: JSON.stringify({
          table,
          limit,
          rows: mockData.slice(0, limit),
          count: mockData.length
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    if (format === 'csv') {
      const headers = Object.keys(mockData[0]).join(',');
      const rows = mockData.slice(0, limit).map(row =>
        Object.values(row).join(',')
      ).join('\n');
      return {
        content: `${headers}\n${rows}`,
        mimeType: 'text/csv'
      };
    }

    // Markdown format
    return {
      content: `# Query Results: ${table}\n\n${mockData.slice(0, limit).map((row, i) =>
        `${i + 1}. ${row.name} (${row.status})`
      ).join('\n')}`,
      mimeType: 'text/markdown'
    };
  });

// 7. Register all resources
const templateRegistry = new TemplateRegistry()
  .registerMany(
    textReader,
    codeReader,
    dirBrowser,
    logReader,
    projectDocs,
    apiDocs,
    dbQuery
  );

// Apply to MCP resource registry
templateRegistry.applyTo(mcpResourceRegistry);

// 8. Create server with MCP enabled
const server = createRpcAiServer({
  port: 8005,
  mcp: {
    enabled: true,
    extensions: {
      resources: {
        // No includeDefaults option - resources are added via templateRegistry.applyTo()
        customResources: [], // Optional: add additional custom resources
        customHandlers: {}   // Optional: add additional custom handlers
      }
    }
  }
});

// Display information
console.log('📦 Local Resources Server');
console.log('🗂️  Configured Root Folders:');
Object.entries(rootManager.getClientRootFolders()).forEach(([id, folder]) => {
  console.log(`   • ${id}: ${folder.name} (${folder.path})`);
});

console.log('\n📋 Available Resources:');
templateRegistry.getAllConfigs().forEach(config => {
  console.log(`   • ${config.name}`);
  if (config.uriTemplate) {
    console.log(`     URI: ${config.uriTemplate}`);
  }
});

console.log('\n🧪 Example Requests:');

console.log('\n1. Read JSON data file:');
console.log('   curl -X POST http://localhost:8005/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=data&path=users.json&format=json"}}\'');

console.log('\n2. Read Markdown documentation:');
console.log('   curl -X POST http://localhost:8005/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=data&path=documentation.md&format=raw"}}\'');

console.log('\n3. Browse data directory:');
console.log('   curl -X POST http://localhost:8005/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"mcp://internal/file-browser?rootId=data&path=.&format=tree"}}\'');

console.log('\n4. Generate project documentation (Markdown):');
console.log('   curl -X POST http://localhost:8005/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"mcp://internal/project-docs?section=readme&format=md"}}\'');

console.log('\n5. Query database (JSON mock):');
console.log('   curl -X POST http://localhost:8005/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"mcp://internal/database-query?table=users&format=json&limit=10"}}\'');

console.log('\n🔐 Security Features:');
console.log('   • File access restricted to configured root folders');
console.log('   • Path traversal prevention built-in');
console.log('   • Template parameters validated automatically');
console.log('   • File size limits protect against large files');

console.log('\n📚 Key Concepts:');
console.log('   • Root Manager: Secure file access with root folder configuration');
console.log('   • File Readers: Pre-built helpers for common file operations');
console.log('   • Templates: Dynamic content generation with multiple formats');
console.log('   • Template Registry: Central registration and discovery');

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  server.start();
}

export { server, rootManager, templateRegistry };

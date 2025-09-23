/**
 * Template Engine Usage Examples
 *
 * This file demonstrates how to use the Template Engine API
 * to create flexible, reusable MCP resource templates.
 */

import {
  createTemplate,
  QuickTemplates,
  TemplateRegistry,
  createRpcAiServer,
  mcpResourceRegistry
} from 'simple-rpc-ai-backend';

// Example 1: Simple template with enum parameters
const companyHandbook = createTemplate('company-handbook-v2')
  .name('Company Handbook (Template Engine)')
  .description('Dynamic company handbook with department-specific content')
  .enumParameter('department', ['engineering', 'product', 'design'], 'Department section')
  .enumParameter('version', ['latest', 'stable'], 'Handbook version')
  .enumParameter('format', ['md', 'xml', 'json'], 'Output format')
  .markdown(async (params) => {
    const { department, version } = params;
    return {
      content: `# ${department.charAt(0).toUpperCase() + department.slice(1)} Handbook (${version})\n\nDepartment-specific guidelines and best practices...`
    };
  })
  .xml(async (params) => {
    const { department, version } = params;
    return {
      content: `<?xml version="1.0"?>\n<handbook department="${department}" version="${version}">\n  <title>Department Guidelines</title>\n</handbook>`
    };
  })
  .json(async (params) => {
    const { department, version } = params;
    return {
      content: JSON.stringify({
        department,
        version,
        guidelines: ['Follow best practices', 'Document everything'],
        lastUpdated: new Date().toISOString()
      }, null, 2)
    };
  });

// Example 2: File system template using QuickTemplates
const fileTemplate = QuickTemplates.fileTemplate(
  'secure-file-reader',
  'Secure File Reader',
  'Read files from configured root directories with format conversion'
);

// Example 3: Database template
const dbTemplate = QuickTemplates.databaseTemplate(
  'database-query',
  'Database Query Tool',
  'Query database tables with configurable output formats'
);

// Example 4: API documentation template
const apiDocsTemplate = QuickTemplates.apiDocsTemplate(
  'api-documentation',
  'API Documentation',
  'Generate API documentation in multiple formats'
);

// Example 5: Custom Redis template
const redisTemplate = createTemplate('redis-cache')
  .name('Redis Cache Inspector')
  .description('Inspect Redis cache with pattern matching and formatting')
  .stringParameter('pattern', 'Key pattern (supports wildcards)', false, '*')
  .enumParameter('operation', ['keys', 'get', 'info'], 'Redis operation', true)
  .enumParameter('format', ['json', 'raw', 'pretty'], 'Output format')
  .numberParameter('limit', 'Maximum keys to return', 1, 1000, 100)
  .generator(async (params) => {
    const { pattern, operation, format, limit } = params;

    // Mock Redis operations
    const mockData = {
      operation,
      pattern,
      results: [`key:${pattern}:1`, `key:${pattern}:2`],
      count: 2,
      limit
    };

    if (format === 'json') {
      return {
        content: JSON.stringify(mockData, null, 2),
        mimeType: 'application/json'
      };
    }

    if (format === 'pretty') {
      return {
        content: `Redis ${operation.toUpperCase()} Results:\nPattern: ${pattern}\nFound: ${mockData.count} keys\n${mockData.results.join('\n')}`,
        mimeType: 'text/plain'
      };
    }

    return {
      content: mockData.results.join('\n'),
      mimeType: 'text/plain'
    };
  });

// Example 6: Vector database template
const vectorDbTemplate = createTemplate('vector-search')
  .name('Vector Database Search')
  .description('Search vector database with semantic similarity')
  .stringParameter('query', 'Search query text', true)
  .numberParameter('limit', 'Maximum results', 1, 100, 10)
  .numberParameter('threshold', 'Similarity threshold', 0.0, 1.0, 0.8)
  .enumParameter('format', ['json', 'markdown', 'csv'], 'Output format')
  .json(async (params) => {
    const { query, limit, threshold } = params;
    return {
      content: JSON.stringify({
        query,
        limit,
        threshold,
        results: [
          { content: 'Similar document 1', score: 0.95 },
          { content: 'Similar document 2', score: 0.87 }
        ]
      }, null, 2)
    };
  })
  .markdown(async (params) => {
    const { query, limit, threshold } = params;
    return {
      content: `# Vector Search Results\n\n**Query:** ${query}\n**Limit:** ${limit}\n**Threshold:** ${threshold}\n\n## Results\n\n1. Similar document 1 (score: 0.95)\n2. Similar document 2 (score: 0.87)`
    };
  })
  .format('csv', 'text/csv', async (params) => {
    const { query } = params;
    return {
      content: `query,content,score\n"${query}","Similar document 1",0.95\n"${query}","Similar document 2",0.87`
    };
  });

// Create template registry and register all templates
const templateRegistry = new TemplateRegistry()
  .registerMany(
    companyHandbook,
    fileTemplate,
    dbTemplate,
    apiDocsTemplate,
    redisTemplate,
    vectorDbTemplate
  );

// Apply templates to MCP resource registry
templateRegistry.applyTo(mcpResourceRegistry);

// Create server with templates
const server = createRpcAiServer({
  port: 8001,
  mcp: {
    enableMCP: true,
    extensions: {
      resources: {
        includeDefaults: true,
        // Templates are automatically included via templateRegistry.applyTo()
      }
    }
  }
});

console.log('🎯 Template Engine Usage Examples');
console.log('📋 Registered Templates:');
templateRegistry.getAllConfigs().forEach(config => {
  console.log(`   • ${config.name}: ${config.uriTemplate || config.id}`);
});

console.log('\n🧪 Test Commands:');
console.log('1. Company Handbook (Engineering, Latest, Markdown):');
console.log('   curl -X POST http://localhost:8001/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"mcp://internal/company-handbook-v2?department=engineering&version=latest&format=md"}}\'');

console.log('\n2. Database Query (JSON format):');
console.log('   curl -X POST http://localhost:8001/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"mcp://internal/database-query?table=users&format=json&limit=50"}}\'');

console.log('\n3. Redis Cache (Pretty format):');
console.log('   curl -X POST http://localhost:8001/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"mcp://internal/redis-cache?pattern=user:*&operation=keys&format=pretty&limit=20"}}\'');

console.log('\n4. Vector Search (Markdown format):');
console.log('   curl -X POST http://localhost:8001/mcp \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"mcp://internal/vector-search?query=machine learning&format=markdown&limit=5&threshold=0.8"}}\'');

if (import.meta.url === `file://${process.argv[1]}`) {
  server.start();
}
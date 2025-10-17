# Example 5: Local Resources Server

Demonstrates how to create an MCP server with file reading and template engine capabilities for dynamic resource generation.

## Features

- **Secure File Access**: Root folder management with path traversal prevention
- **File Readers**: Pre-built helpers for text, code, and directory browsing
- **Template Engine**: Generate dynamic content in multiple formats (Markdown, JSON, CSV, HTML)
- **MCP Integration**: All resources auto-discovered via MCP protocol

## What's Included

### File Readers
- `text-files`: Read text files with format conversion
- `source-code`: Read source code with metadata
- `file-browser`: Browse directories with filtering
- `log-reader`: Custom log file reader

### Templates
- `project-docs`: Generate project documentation (Markdown/JSON/HTML)
- `api-endpoints`: API documentation generator
- `database-query`: Database query tool with flexible output

## Running the Example

```bash
cd examples/05-local-resources-server
node server.js
```

Server starts at `http://localhost:8005`

## Testing

### 1. List Available Resources

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}'
```

### 2. Read JSON Data File

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=data&path=users.json&format=json"}}'
```

### 3. Read Markdown Documentation

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"mcp://internal/text-files?rootId=data&path=documentation.md&format=raw"}}'
```

### 4. Browse Data Directory

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"mcp://internal/file-browser?rootId=data&path=.&format=tree"}}'
```

### 5. Generate Project Documentation

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"mcp://internal/project-docs?section=readme&format=md"}}'
```

### 6. Query Database (Mock)

```bash
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"resources/read","params":{"uri":"mcp://internal/database-query?table=users&format=json&limit=10"}}'
```

## Key Concepts

### Root Manager
Manages secure file access with configured root folders:

```javascript
const rootManager = createRootManager({
  defaultRoots: {
    'project': { path: process.cwd(), name: 'Project Files' },
    'examples': { path: './examples', name: 'Example Files' }
  }
});
```

### File Reader Helpers
Pre-built readers for common use cases:

```javascript
const textReader = FileReaderHelpers.textFileReader(rootManager, 'text-files');
const codeReader = FileReaderHelpers.codeFileReader(rootManager, 'source-code');
const dirBrowser = FileReaderHelpers.directoryBrowser(rootManager, 'file-browser');
```

### Template Engine
Create dynamic resources with multiple output formats:

```javascript
const template = createTemplate('docs')
  .name('Documentation')
  .enumParameter('section', ['readme', 'api'], 'Section')
  .enumParameter('format', ['md', 'json'], 'Format')
  .markdown(async (params) => ({ content: '# Docs...' }))
  .json(async (params) => ({ content: JSON.stringify({...}) }));
```

### Template Registry
Central registration and MCP integration:

```javascript
const registry = new TemplateRegistry()
  .registerMany(textReader, codeReader, template);

// Apply to MCP resource registry
registry.applyTo(mcpResourceRegistry);
```

## Configuration Notes

The `includeDefaults` option mentioned in older examples no longer exists. Resources are now registered via:

1. **TemplateRegistry.applyTo()** - Main registration method
2. **extensions.resources.customResources** - Additional custom resources
3. **extensions.resources.customHandlers** - Additional custom handlers

```javascript
mcp: {
  enableMCP: true,
  extensions: {
    resources: {
      customResources: [],  // Optional additional resources
      customHandlers: {}    // Optional additional handlers
    }
  }
}
```

## Security

- ✅ File access restricted to configured root folders
- ✅ Path traversal prevention built-in
- ✅ Template parameters validated automatically
- ✅ File size limits protect against large files
- ✅ Extension filtering for file types

## Advanced: PostgreSQL Database Resources

While not implemented in this example, here's how you could create PostgreSQL database resources:

### 1. Install PostgreSQL Client

```bash
npm install pg
```

### 2. Create Database Resource Template

```javascript
import pg from 'pg';
import { createTemplate } from 'simple-rpc-ai-backend';

// Create PostgreSQL connection pool
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'myapp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 10,
  idleTimeoutMillis: 30000
});

// Create database query template
const dbQueryTemplate = createTemplate('postgres-query')
  .name('PostgreSQL Query')
  .description('Query PostgreSQL database with parameterized queries')
  .stringParameter('table', 'Table name', true)
  .stringParameter('columns', 'Columns to select (comma-separated)', false, '*')
  .stringParameter('where', 'WHERE clause (without WHERE keyword)', false, '')
  .numberParameter('limit', 'Row limit', 1, 1000, 50)
  .numberParameter('offset', 'Row offset', 0, 10000, 0)
  .enumParameter('format', ['json', 'csv', 'markdown'], 'Output format')
  .generator(async (params) => {
    const { table, columns, where, limit, offset, format } = params;

    // Security: Validate table name (whitelist approach recommended)
    const allowedTables = ['users', 'posts', 'comments', 'products'];
    if (!allowedTables.includes(table)) {
      throw new Error(`Table '${table}' is not allowed. Allowed: ${allowedTables.join(', ')}`);
    }

    // Security: Use parameterized queries to prevent SQL injection
    let query = `SELECT ${columns} FROM ${table}`;
    const queryParams = [];
    let paramCount = 1;

    if (where) {
      // Parse WHERE clause safely (basic example)
      query += ` WHERE ${where}`;
    }

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    queryParams.push(limit, offset);

    try {
      const result = await pool.query(query, queryParams);

      if (format === 'json') {
        return {
          content: JSON.stringify({
            table,
            columns: columns.split(',').map(c => c.trim()),
            rows: result.rows,
            count: result.rowCount,
            limit,
            offset
          }, null, 2),
          mimeType: 'application/json'
        };
      }

      if (format === 'csv') {
        if (result.rows.length === 0) {
          return { content: '', mimeType: 'text/csv' };
        }

        const headers = Object.keys(result.rows[0]).join(',');
        const rows = result.rows.map(row =>
          Object.values(row).map(v =>
            typeof v === 'string' && v.includes(',') ? `"${v}"` : v
          ).join(',')
        ).join('\n');

        return {
          content: `${headers}\n${rows}`,
          mimeType: 'text/csv'
        };
      }

      // Markdown format
      if (result.rows.length === 0) {
        return {
          content: `# Query Results: ${table}\n\nNo results found.`,
          mimeType: 'text/markdown'
        };
      }

      const headers = Object.keys(result.rows[0]);
      const headerRow = `| ${headers.join(' | ')} |`;
      const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
      const dataRows = result.rows.map(row =>
        `| ${headers.map(h => row[h] || '').join(' | ')} |`
      ).join('\n');

      return {
        content: `# Query Results: ${table}\n\n${headerRow}\n${separatorRow}\n${dataRows}\n\n**Total:** ${result.rowCount} rows`,
        mimeType: 'text/markdown'
      };
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  });
```

### 3. Register Database Template

```javascript
const templateRegistry = new TemplateRegistry()
  .registerMany(
    // ... other templates
    dbQueryTemplate
  );

templateRegistry.applyTo(mcpResourceRegistry);
```

### 4. Usage Example

```bash
# Query users table as JSON
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"mcp://internal/postgres-query?table=users&columns=id,name,email&limit=10&format=json"}}'

# Query with WHERE clause
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"mcp://internal/postgres-query?table=users&where=status=active&format=markdown"}}'

# Export as CSV
curl -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"mcp://internal/postgres-query?table=products&format=csv&limit=100"}}'
```

### 5. Security Best Practices

**Table Whitelisting:**
```javascript
const allowedTables = ['users', 'posts', 'comments', 'products'];
if (!allowedTables.includes(table)) {
  throw new Error(`Table '${table}' not allowed`);
}
```

**Parameterized Queries:**
```javascript
// ✅ Safe: Parameterized query
await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ Unsafe: String concatenation (SQL injection risk)
await pool.query(`SELECT * FROM users WHERE id = ${userId}`);
```

**Column Validation:**
```javascript
const allowedColumns = {
  users: ['id', 'name', 'email', 'role', 'created_at'],
  posts: ['id', 'title', 'content', 'author_id', 'published_at']
};

const requestedColumns = columns.split(',').map(c => c.trim());
const validColumns = requestedColumns.every(col =>
  allowedColumns[table]?.includes(col)
);

if (!validColumns) {
  throw new Error('Invalid column names');
}
```

**Connection Pool Limits:**
```javascript
const pool = new pg.Pool({
  max: 10,              // Maximum connections
  idleTimeoutMillis: 30000,  // Close idle connections
  connectionTimeoutMillis: 5000  // Connection timeout
});
```

**Rate Limiting:**
Use the built-in rate limiting to prevent database overload:

```javascript
const server = createRpcAiServer({
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100  // 100 requests per 15 min per IP
  }
});
```

### 6. Environment Variables

```bash
# .env file
DB_HOST=localhost
DB_DATABASE=myapp
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_PORT=5432
```

### 7. Error Handling

```javascript
.generator(async (params) => {
  try {
    const result = await pool.query(query, queryParams);
    return { content: JSON.stringify(result.rows), mimeType: 'application/json' };
  } catch (error) {
    // Log error securely (don't expose SQL details to client)
    console.error('Database error:', error);

    // Return user-friendly error
    throw new Error('Database query failed. Please check your parameters.');
  }
});
```

### 8. Advanced Features

**Stored Procedures:**
```javascript
const result = await pool.query('CALL get_user_stats($1, $2)', [userId, startDate]);
```

**Transactions:**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET status = $1 WHERE id = $2', ['active', userId]);
  await client.query('INSERT INTO audit_log (user_id, action) VALUES ($1, $2)', [userId, 'activated']);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

**Views:**
```javascript
// Create a view for safe querying
await pool.query(`
  CREATE OR REPLACE VIEW user_public_info AS
  SELECT id, name, email, role, created_at
  FROM users
  WHERE status = 'active'
`);

// Query the view instead of the table
const allowedTables = ['user_public_info', 'post_summaries'];
```

## Related Examples

- **Example 2**: Basic MCP server with custom tools
- **Example 4**: MCP tasks server with AI integration

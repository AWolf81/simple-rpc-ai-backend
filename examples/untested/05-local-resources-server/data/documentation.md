# Local Resources Server Documentation

## Overview

This server demonstrates how to create MCP resources from local files and templates.

## Features

### File Reading
- Read text files with multiple formats (raw, JSON, base64)
- Browse directories with filtering
- Secure access via root folder management

### Template Engine
- Generate dynamic content in multiple formats
- Support for Markdown, JSON, CSV, HTML
- Parameterized resources with validation

### Security
- Path traversal prevention
- File size limits
- Extension filtering
- Root folder restrictions

## Usage

### Reading Files

Use the `text-files` resource to read text files:

```
mcp://internal/text-files?rootId=data&path=users.json&format=json
```

### Browsing Directories

Use the `file-browser` resource to list directory contents:

```
mcp://internal/file-browser?rootId=data&path=.&format=tree
```

### Generating Documentation

Use the `project-docs` template to generate documentation:

```
mcp://internal/project-docs?section=readme&format=md
```

## Configuration

Root folders are configured in the server:

```javascript
const rootManager = createRootManager({
  defaultRoots: {
    'data': {
      path: './data',
      name: 'Data Files',
      description: 'JSON and Markdown resources'
    }
  }
});
```

## Extension Ideas

- **Database Integration**: Query PostgreSQL/MySQL
- **API Proxies**: Fetch data from external APIs
- **Data Transformation**: Convert between formats
- **Caching**: Cache frequently accessed resources

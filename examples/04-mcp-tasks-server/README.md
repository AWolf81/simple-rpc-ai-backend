# Task Management MCP Server Example

This example demonstrates comprehensive task management capabilities using the Model Context Protocol (MCP). It showcases task lifecycle management, progress tracking, and administrative tools that were moved from the core library to keep it clean and focused.

## Features

### Task Management Tools
- **Long Running Tasks**: Start tasks with progress tracking and cancellation support
- **Cancellable Tasks**: Step-based tasks that can be cancelled mid-execution
- **Task Monitoring**: List active/completed tasks and get detailed progress information
- **Task Control**: Cancel running tasks with proper state management

### Administrative Tools
- **System Status**: Detailed server health and task statistics
- **Advanced Admin**: Operations for configuration, metrics, and task overview
- **User Management**: User information and permissions (admin-only)

### Technical Capabilities
- **Progress Tracking**: Real-time progress updates for long-running operations
- **State Management**: Proper task lifecycle with pending → running → completed/failed/cancelled
- **Error Handling**: Robust error handling with detailed error messages
- **Graceful Shutdown**: Proper cleanup and task cancellation on server shutdown

## Quick Start

1. **Install dependencies:**
   ```bash
   cd examples/04-mcp-tasks-server
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Server will start on port 8002** with endpoints:
   - Main Server: `http://localhost:8002`
   - MCP Protocol: `http://localhost:8002/mcp`
   - tRPC API: `http://localhost:8002/trpc`
   - JSON-RPC: `http://localhost:8002/rpc`

## Available MCP Tools

### Task Management
| Tool | Description | Category |
|------|-------------|----------|
| `longRunningTask` | Start a long-running task with progress tracking | task |
| `cancellableTask` | Start a task that can be cancelled mid-execution | task |
| `cancelTask` | Cancel a running task by ID | task |
| `listRunningTasks` | List all currently running or recent tasks | task |
| `getTaskProgress` | Get detailed progress information for a specific task | task |

### Administrative
| Tool | Description | Category |
|------|-------------|----------|
| `status` | Get detailed server status and health information | system |
| `advancedExample` | Advanced administrative tool with enhanced capabilities | admin |
| `getUserInfo` | Get detailed user information and permissions | admin |

## Usage Examples

### 1. Start a Long-Running Task

```bash
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "longRunningTask",
      "arguments": {
        "name": "Data Processing Task",
        "duration": 15000,
        "shouldFail": false
      }
    }
  }'
```

### 2. Check Task Progress

```bash
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getTaskProgress",
      "arguments": {
        "taskId": "TASK_ID_FROM_PREVIOUS_CALL"
      }
    }
  }'
```

### 3. List All Tasks

```bash
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "listRunningTasks",
      "arguments": {
        "includeCompleted": true,
        "limit": 10
      }
    }
  }'
```

### 4. Cancel a Task

```bash
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "cancelTask",
      "arguments": {
        "taskId": "TASK_ID_TO_CANCEL"
      }
    }
  }'
```

### 5. Get Server Status

```bash
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "status",
      "arguments": {
        "detailed": true
      }
    }
  }'
```

## Task Lifecycle

```
pending → running → completed
                 → failed
                 → cancelled
```

- **Pending**: Task created but not yet started
- **Running**: Task is actively executing
- **Completed**: Task finished successfully
- **Failed**: Task encountered an error
- **Cancelled**: Task was manually cancelled

## Development

### Environment Variables

```bash
# Optional - for AI integration
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional - server configuration
PORT=8002
LOG_LEVEL=info
NODE_ENV=development
```

### Testing with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Connect to the server
npx @modelcontextprotocol/inspector http://localhost:8002/mcp
```

## Architecture

### Task Storage
- In-memory Map for demo purposes
- Production: Use Redis, PostgreSQL, or other persistent storage
- Task IDs are unique with timestamp and random suffix

### Progress Tracking
- Real-time progress updates during task execution
- Progress reported as percentage (0-100)
- Step-based progress for cancellable tasks

### Error Handling
- Comprehensive error catching and reporting
- Graceful degradation for invalid operations
- Detailed error messages for debugging

## Production Considerations

1. **Persistent Storage**: Replace in-memory Map with database
2. **Task Queue**: Use Redis Queue or similar for scalability
3. **Authentication**: Enable JWT-based authentication
4. **Monitoring**: Add proper logging and metrics
5. **Limits**: Implement task count and duration limits
6. **Cleanup**: Add periodic cleanup of old completed tasks

## Related Examples

- **02-mcp-server**: Basic MCP tools (greeting, time, calculate, file operations)
- **03-mcp-ai-server**: AI-powered MCP tools and sampling

This example demonstrates how to build specialized MCP servers for specific use cases while maintaining clean separation of concerns.
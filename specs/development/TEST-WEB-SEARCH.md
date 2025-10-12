# Web Search Testing Guide

## ⚠️ Current Status: Partially Implemented

**✅ Working:** Schema validation for web search parameters
**❌ Not Working:** Actual web search execution (both native and MCP)
**📝 See below** for detailed status and implementation path

## Prerequisites

1. **Running Server**
   ```bash
   # From examples/02-mcp-server
   npm start
   ```

2. **API Keys**
   - Set `ANTHROPIC_API_KEY` in `.env`

## Test 1: Anthropic Native Web Search ❌

### Current Status: NOT WORKING

**Error:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "AI service error: anthropic API error: Unsupported tool type: web_search_20250305"
  }
}
```

**Root Cause:**
- Anthropic's `web_search_20250305` is a very new feature (March 2025)
- Requires special API tier/access (not available on all accounts)
- May need newer Vercel AI SDK version

### Command (for testing when API access is available)
```bash
curl -X POST http://localhost:8001/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "What are the top 3 AI news stories from this week?",
      "systemPrompt": "default",
      "provider": "anthropic",
      "metadata": {
        "useWebSearch": true,
        "webSearchPreference": "ai-web-search",
        "maxWebSearches": 3
      }
    },
    "id": 1
  }' | jq .
```

### What Should Happen (when working)
1. Server sends request to Claude with `web_search_20250305` tool
2. Claude executes web search internally via Brave Search
3. Claude incorporates results into response
4. ~2-4 seconds total response time

## Test 2: DuckDuckGo MCP Search

### Prerequisites
First, you need an MCP server running. You have two options:

#### Option A: Use our built-in MCP service (if configured)
```javascript
// Check server.js has:
mcpConfig: {
  enableWebSearch: true
}
```

#### Option B: Run external DuckDuckGo MCP server
```bash
# In a separate terminal
npx @modelcontextprotocol/server-duckduckgo
```

### Command
```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "What are the top 3 AI news stories from this week?",
    "systemPrompt": "default",
    "provider": "anthropic",
    "metadata": {
      "useWebSearch": true,
      "webSearchPreference": "mcp",
      "maxWebSearches": 3
    }
  }'
```

### Expected Response
```json
{
  "result": {
    "data": {
      "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "I'll search for recent AI news... [search results] Here are the top 3 stories...",
      "usage": {
        "promptTokens": 200,
        "completionTokens": 400,
        "totalTokens": 600
      },
      "model": "claude-3-7-sonnet-20250219",
      "provider": "anthropic"
    }
  }
}
```

### What Happens
1. ✅ AI receives MCP tool schema
2. ✅ AI decides to use web search tool
3. ✅ Server intercepts tool call
4. ✅ MCP server executes DuckDuckGo search
5. ✅ Results sent back to AI
6. ✅ AI generates final response
7. ⏱️ ~4-8 seconds total

### Debugging
```bash
# Check server logs for:
# "🔍 Using MCP web search tools"
# "🔧 AI requested X MCP tool calls"
# "📡 Calling MCP web search server"
```

## Comparison Test

Run both back-to-back with the same query:

```bash
# Native (save to file)
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Latest AI breakthroughs",
    "systemPrompt": "default",
    "provider": "anthropic",
    "metadata": {
      "useWebSearch": true,
      "webSearchPreference": "ai-web-search"
    }
  }' | jq . > native-result.json

# MCP (save to file)
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Latest AI breakthroughs",
    "systemPrompt": "default",
    "provider": "anthropic",
    "metadata": {
      "useWebSearch": true,
      "webSearchPreference": "mcp"
    }
  }' | jq . > mcp-result.json

# Compare
diff native-result.json mcp-result.json
```

## Common Issues

### Issue: "MCP service not initialized"
**Solution:**
```javascript
// Add to server.js config:
mcpConfig: {
  enableWebSearch: true
}
```

### Issue: "Provider 'anthropic' is not allowed"
**Solution:**
```javascript
// Check server.js has:
providers: ['anthropic', 'openai', 'google']
```

### Issue: "Invalid API key"
**Solution:**
```bash
# Check .env file:
ANTHROPIC_API_KEY=sk-ant-...
```

### Issue: Native search not working
**Symptoms:** No web results in response

**Solution:** Check that:
1. Using Claude 3.7+ (supports web_search_20250305)
2. `webSearchPreference` is exactly `"ai-web-search"`
3. `useWebSearch` is `true`

### Issue: MCP search failing
**Symptoms:** Error about MCP tools

**Solution:**
1. Check MCP server is running
2. Verify `mcpConfig.enableWebSearch: true`
3. Check server logs for MCP initialization

## Performance Benchmarking

```bash
# Benchmark native search
time curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content":"AI news","systemPrompt":"default","provider":"anthropic","metadata":{"useWebSearch":true,"webSearchPreference":"ai-web-search"}}'

# Benchmark MCP search
time curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content":"AI news","systemPrompt":"default","provider":"anthropic","metadata":{"useWebSearch":true,"webSearchPreference":"mcp"}}'
```

## Next Steps

1. **Try different providers:**
   - Google: `"provider": "google"` (uses `googleSearch`)
   - OpenAI: `"provider": "openai"` (uses native search)

2. **Customize search:**
   ```json
   "metadata": {
     "useWebSearch": true,
     "webSearchPreference": "ai-web-search",
     "maxWebSearches": 5,
     "allowedDomains": ["github.com", "arxiv.org"],
     "blockedDomains": ["example.com"]
   }
   ```

3. **Test with streaming:**
   ```bash
   curl -X POST http://localhost:8000/rpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "AI news",
       "provider": "anthropic",
       "metadata": {
         "useWebSearch": true,
         "webSearchPreference": "ai-web-search"
       },
       "options": {
         "stream": true
       }
     }'
   ```

## Documentation

For more details, see:
- [Tool Execution Flow](../../docs/architecture/tool-execution-flow.md)
- [Main README](./README.md)
- [Architecture Documentation](../../docs/architecture/)

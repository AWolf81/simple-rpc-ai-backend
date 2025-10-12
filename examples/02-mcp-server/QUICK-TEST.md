# Quick Web Search Testing

Fast guide to test web search. Make sure the server is running first!

## Start Server

```bash
cd examples/02-mcp-server
npm start
```

Server should start on `http://localhost:8000`

## Test 1: Anthropic Native Web Search (Fastest)

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
        "webSearchPreference": "ai-web-search",
        "maxWebSearches": 3
      }
    },
    "id": 1
  }' | jq .
```

**Expected:** Response in ~2-4 seconds with current AI news

## Test 2: MCP Web Search (Flexible)

**Note:** Requires MCP configuration in server.js:
```javascript
mcpConfig: {
  enableWebSearch: true
}
```

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
    },
    "id": 1
  }' | jq .
```

**Expected:** Response in ~4-8 seconds with search results from MCP

## Troubleshooting

### Connection Refused
```bash
# Check if server is running
curl http://localhost:8000/health
```

If not running:
```bash
cd examples/02-mcp-server
npm start
```

### "Provider 'anthropic' is not allowed"
Check `.env` file has:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

And `server.js` has:
```javascript
providers: ['anthropic', 'openai', 'google']
```

### "Invalid API key"
Your `ANTHROPIC_API_KEY` in `.env` is invalid or missing.

### No web search results
For native search, ensure:
- Using Claude 3.7+ model (default)
- `webSearchPreference` is exactly `"ai-web-search"`
- `useWebSearch` is `true`

For MCP search, ensure:
- `mcpConfig.enableWebSearch: true` in server.js
- MCP service initialized (check server logs)

## Quick Comparison

Run both and time them:

```bash
echo "=== Native Search ===" && \
time curl -s -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ai.generateText","params":{"content":"Latest AI news","systemPrompt":"default","provider":"anthropic","metadata":{"useWebSearch":true,"webSearchPreference":"ai-web-search"}},"id":1}' | jq -r '.result.content' | head -20

echo -e "\n\n=== MCP Search ===" && \
time curl -s -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ai.generateText","params":{"content":"Latest AI news","systemPrompt":"default","provider":"anthropic","metadata":{"useWebSearch":true,"webSearchPreference":"mcp"}},"id":1}' | jq -r '.result.content' | head -20
```

You should see native search is ~2x faster!

# Example 1: Basic AI Server

A minimal server demonstrating core AI execution functionality with system prompt protection.

## Features
- ✅ Simple AI request execution
- ✅ System prompt protection (server-side only)
- ✅ Multiple AI provider support (Anthropic, OpenAI, Google, OpenRouter)
- ✅ No authentication required (for development/testing)

## Quick Start

```bash
# First, build the main package (from project root)
cd ../..
pnpm build

# Then run the example
cd examples/01-basic-server
npm install

# Set your API key (at least one required)
export ANTHROPIC_API_KEY="your-key-here"
# OR
export OPENAI_API_KEY="your-key-here"
# OR
export GOOGLE_API_KEY="your-key-here"
# OR
export OPENROUTER_API_KEY="your-key-here"

# Run the server
npm start

# Server starts at http://localhost:8000
```

> **⚠️ Important**: You must run `pnpm build` from the project root before running examples, as they import from the compiled `dist/` directory.

## Testing the Server

### Using curl
```bash
# Test AI execution
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "What is 2+2?",
      "provider": "anthropic"
    },
    "id": 1
  }'

# Check health
curl http://localhost:8000/health
```

### Using the client
```javascript
import { RPCClient } from 'simple-rpc-ai-backend';

const client = new RPCClient('http://localhost:8000');
const result = await client.request('ai.generateText', {
  content: 'What is 2+2?',
  provider: 'anthropic'
});
```

## Configuration

The server uses environment variables for configuration:

- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `OPENAI_API_KEY` - OpenAI GPT API key  
- `GOOGLE_API_KEY` - Google Gemini API key
- `OPENROUTER_API_KEY` - OpenRouter API key (access to 100+ models)
- `PORT` - Server port (default: 8000)

## System Prompts

System prompts are protected on the server side. The server includes a default helpful assistant prompt, but you can customize it in the server code.

## Use Cases

This basic server is perfect for:
- Quick prototyping
- Local development
- Testing AI integrations
- Learning the API structure
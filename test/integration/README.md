# Integration Tests

This directory contains integration tests that verify the AI RPC server works correctly with real AI providers.

## Prerequisites

1. **Real API Key**: You need a valid Anthropic API key
2. **Running Server**: The AI server must be running on localhost:8000
3. **Built Code**: Run `pnpm build` to compile TypeScript

## Setup

1. Set your API key:
   ```bash
   export ANTHROPIC_API_KEY=your_key_here
   ```

2. Or create a `.env` file in the project root:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

## Running Tests

### Method 1: npm script (recommended)
```bash
# Start the server (in terminal 1)
pnpm build && node examples/servers/basic-server.js

# Run integration tests (in terminal 2)
pnpm test:integration
```

### Method 2: Direct execution
```bash
node test/integration/index.js
```

### Method 3: Custom server URL
```bash
AI_SERVER_URL=http://localhost:3000 pnpm test:integration
```

## What It Tests

### ✅ Core Functionality
- Health check endpoint
- AI request execution with managed prompts (`promptId`)
- AI request execution with direct system prompts
- Response parsing and validation

### ✅ Security Features
- System prompt protection (prompts never exposed to client)
- Server-side prompt resolution
- Error handling for invalid prompt IDs

### ✅ Managed Prompts
Tests all built-in prompts:
- `analyze-code` - Code quality analysis
- `generate-tests` - Test generation
- `security-review` - Security vulnerability analysis
- `optimize-performance` - Performance optimization suggestions

### ✅ Error Handling
- Empty content rejection
- Invalid prompt ID rejection
- Missing prompt specification

## Expected Output

```
🧪 Testing Simple RPC AI Backend Integration...

1️⃣ Testing health check...
✅ Health check passed

2️⃣ Testing code analysis with managed prompt...
⏱️ Request completed in 2847ms
✅ Code analysis successful!
🎯 Found 4/4 expected sections: Code Quality, Issues, Improvement, Summary

3️⃣ Testing direct system prompt...
✅ Direct system prompt works: 234 chars

4️⃣ Testing other managed prompts...
✅ generate-tests prompt works (1456 chars)
✅ security-review prompt works (892 chars)
✅ optimize-performance prompt works (1123 chars)

5️⃣ Testing error handling...
✅ Correctly rejected empty content
✅ Correctly rejected invalid prompt ID
✅ Correctly rejected missing prompt

🎉 All integration tests passed!
```

## Troubleshooting

### Server Connection Issues
```
❌ Cannot reach server: connect ECONNREFUSED 127.0.0.1:8000
```
**Solution**: Make sure the server is running with `node examples/servers/basic-server.js`

### API Key Issues
```
❌ AI execution failed: Invalid API key
```
**Solution**: Set `ANTHROPIC_API_KEY` environment variable

### Empty Response
```
⚠️ WARNING: Empty response from AI provider!
```
**Solution**: 
1. Check API key validity
2. Check server logs for errors
3. Verify system prompt resolution

### Prompt Not Found
```
❌ Failed to resolve prompt ID 'analyze-code'
```
**Solution**: Make sure server has default prompts loaded (check server startup logs)

## Performance Expectations

- Health check: < 100ms
- AI requests: 1-5 seconds (depends on model and prompt complexity)
- Total test runtime: 10-30 seconds

## Security Verification

The test verifies that:
- ✅ System prompts are never exposed in API responses
- ✅ Prompt resolution happens server-side only
- ✅ Invalid prompt IDs are properly rejected
- ✅ Client cannot enumerate available prompts

This ensures corporate-friendly deployment where proprietary prompts remain secure.
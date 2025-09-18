# Example 2: Production MCP Server

Full-featured server with OAuth2, tRPC, token tracking, and MCP (Model Context Protocol) support.

## Features
- ✅ OAuth2 authentication (GitHub, Google)
- ✅ tRPC for type-safe APIs
- ✅ Token usage tracking with PostgreSQL
- ✅ MCP protocol support for AI tool discovery
- ✅ Rate limiting and quota management
- ✅ Multi-tenant API key management

## Prerequisites

1. PostgreSQL database
2. OAuth2 app credentials (GitHub or Google)
3. AI provider API keys

## Setup

### 1. Database Setup
```bash
# Start PostgreSQL with Docker
docker-compose -f docker-compose.postgres.yml up -d

# Database will be initialized automatically with migrations
```

### 2. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials:
# - OAuth2 credentials (GITHUB_CLIENT_ID, etc.)
# - AI API keys (ANTHROPIC_API_KEY, etc.)
# - Database URL (default: postgresql://postgres:postgres@localhost:5432/ai_backend)
```

### 3. Start the Server
```bash
# First, build the main package (from project root)
cd ../..
pnpm build

# Then run the example
cd examples/02-mcp-server
npm install

# Run the production server
npm start

# Server starts at http://localhost:8000
```

> **⚠️ Important**: You must run `pnpm build` from the project root before running examples.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client Apps   │────▶│  MCP Server  │────▶│ AI Providers│
│  (VS Code, Web) │     │   OAuth2     │     │  (Claude,   │
└─────────────────┘     │   tRPC       │     │   GPT-4)    │
                        │   PostgreSQL │     └─────────────┘
                        └──────────────┘
```

## API Access

### tRPC Endpoint
```typescript
// Type-safe client
import { createTRPCClient } from '@trpc/client';

const client = createTRPCClient({
  url: 'http://localhost:8000/trpc',
  headers: { authorization: `Bearer ${token}` }
});

// Execute AI request with token tracking
const result = await client.ai.executeAIRequest.mutate({
  content: 'Explain quantum computing',
  provider: 'anthropic'
});
```

### MCP Protocol
```bash
# List available tools
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"method": "tools/list"}'

# Execute tool
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "executeAI",
      "arguments": {
        "content": "Hello, AI!"
      }
    }
  }'
```

## OAuth2 Flow

1. **Login**: `GET /auth/login?provider=github`
2. **Callback**: Handled automatically
3. **Token**: JWT returned in response
4. **Use**: Include token in Authorization header

## Token Tracking

The server tracks token usage per user:
- Input/output tokens counted
- Monthly quotas enforced
- Usage analytics available
- Cost tracking by provider

## Database Schema

```sql
-- Users table
users (
  id, email, provider, subscription_tier, 
  monthly_token_quota, tokens_used_this_month
)

-- API keys table (encrypted)
api_keys (
  id, user_id, provider, encrypted_key
)

-- Usage tracking
usage_logs (
  id, user_id, provider, model, 
  input_tokens, output_tokens, cost
)
```

## Rate Limits

Default limits by subscription tier:
- **Free**: 10 RPM, 1K tokens/min
- **Pro**: 100 RPM, 10K tokens/min  
- **Enterprise**: 1000 RPM, 100K tokens/min

## Monitoring

Access the dev panel for monitoring:
```bash
# Start monitoring panel
npm run dev:panel

# Open http://localhost:8080
```

## Production Deployment

For production deployment:
1. Use proper SSL certificates
2. Set secure OAuth redirect URLs
3. Configure rate limiting
4. Enable monitoring/logging
5. Set up database backups
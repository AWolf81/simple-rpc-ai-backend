# Test Plans

This directory contains manual test plans for the agent system components.

## Test Plan Index

### Skills System
- **[skill-testing-plan.md](./skill-testing-plan.md)** - Complete manual testing guide for the skills system
  - Skill loading and validation
  - Script execution
  - Progressive disclosure
  - Security restrictions
  - Agent integration tests

### Sandbox Providers

Each sandbox provider has a dedicated test plan covering setup, execution, security, and performance:

- **[sandbox-provider-local.md](./sandbox-provider-local.md)** - Local execution (default)
  - Native process isolation
  - Path/timeout/memory restrictions
  - Platform: Linux/macOS
  - Prerequisites: Python 3, Node.js 22+, Bash

- **[sandbox-provider-vercel.md](./sandbox-provider-vercel.md)** - Vercel Sandbox
  - Ephemeral serverless containers
  - Platform: Vercel infrastructure
  - Prerequisites: `@vercel/sandbox`, Vercel authentication

- **[sandbox-provider-daytona.md](./sandbox-provider-daytona.md)** - Daytona Sandbox
  - Persistent development environments
  - Session management
  - Prerequisites: `@daytonaio/sdk`, Daytona API key

- **[sandbox-provider-cloudflare.md](./sandbox-provider-cloudflare.md)** - Cloudflare Sandbox
  - Edge-native containers (Durable Objects)
  - Global distribution
  - Prerequisites: `@cloudflare/sandbox`, Cloudflare Workers, Docker (dev)

## Quick Start

### 1. Skills System Testing

**Option A: Direct RPC Testing (Recommended for validation)**
```bash
# Start the agent server
pnpm build
node examples/03-agents-basic/server.js

# Run tests from skill-testing-plan.md using curl
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.list","params":{},"id":1}' | jq
```

**Option B: AI-Powered Testing (Natural Language)**
```bash
# 1. Start server (same as above)
node examples/03-agents-basic/server.js

# 2. Set API key
export ANTHROPIC_API_KEY=your_key_here

# 3. Use simple-agent CLI
simple-agent
> List all available skills
> Tell me about file-handling skill
```

**See**: [SIMPLE_AGENT_USAGE.md](./SIMPLE_AGENT_USAGE.md) for detailed CLI guide

### 2. Sandbox Provider Testing

Each provider has specific setup requirements. Refer to the individual test plans for:
- Installation instructions
- Authentication setup
- Configuration examples
- Test procedures

## Test Coverage

### Skills System
- ✅ Skill discovery (list, get, match)
- ✅ Metadata validation
- ✅ Script execution (Python, TypeScript, JavaScript, Shell)
- ✅ Progressive disclosure (3 levels)
- ✅ Security (path restrictions, timeouts)
- ✅ Agent integration (AI-powered skill usage)

### Sandbox Providers
- ✅ Runtime support (Python, Node, TypeScript, Shell)
- ✅ Script upload and execution
- ✅ File system operations
- ✅ Environment variables
- ✅ Timeout enforcement
- ✅ Error handling
- ✅ Resource limits

## Comparison Matrix

| Feature | Local | Vercel | Daytona | Cloudflare |
|---------|-------|--------|---------|------------|
| **Session Type** | Ephemeral | Ephemeral | Persistent | Persistent |
| **Cold Start** | None | 15-30s | 5-10s | 2-3min (first deploy) |
| **Warm Start** | <500ms | 2-5s | <1s | <500ms |
| **State Persistence** | No | No | Yes (optional) | Yes (Durable Objects) |
| **Network Access** | Controlled | Yes | Yes | Yes |
| **Platform** | Any (Linux/macOS) | Vercel Cloud | Daytona Cloud | Cloudflare Workers |
| **Cost** | Free (local) | Pay-per-use | Metered | Workers pricing |
| **Setup Complexity** | Low | Medium | Medium | High |
| **Best For** | Development, testing | Serverless tasks | Dev environments | Edge execution |

## Test Execution Order

1. **Local Provider** (baseline)
   - Verify basic functionality
   - Establish performance benchmarks
   - Test security restrictions

2. **Cloud Providers** (optional)
   - Vercel: Serverless execution
   - Daytona: Persistent sessions
   - Cloudflare: Edge distribution

3. **Agent Integration**
   - AI-powered skill discovery
   - Multi-skill workflows
   - Error handling

## Continuous Integration

### Automated Tests
- Unit tests: `pnpm test`
- Coverage: `pnpm test:coverage`
- Type checking: `pnpm typecheck`

### Manual Tests
- Follow test plans for comprehensive validation
- Document results in test plan files
- Report issues via GitHub

## Contributing

When adding new features:
1. Update relevant test plans
2. Add new test cases
3. Document expected results
4. Update comparison matrix if applicable

## References

- **Architecture**: [specs/architecture/agent-orchestration.md](../architecture/agent-orchestration.md)
- **Feature Specs**: [specs/features/](../features/)
- **Examples**: [examples/03-agents-basic/](../../examples/03-agents-basic/)

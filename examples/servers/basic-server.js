/**
 * Basic AI Backend Server Example
 * 
 * Simple server setup where the service provider supplies AI keys.
 * Perfect for prototyping, free AI providers, or paid AI services.
 * 
 * Use this approach when:
 * - You want to provide AI as a paid service (users don't need their own keys)
 * - Simple single-provider setup for prototyping
 * - Using free AI providers or want centralized billing
 * - No multi-device sync needed
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../../dist/rpc-ai-server.js';

console.log(`
🚀 Basic AI Server - Service Provider Keys

This example shows centralized AI key management.
For BYOK (Bring Your Own Key) support, see ai-server-example.js

⚠️  REQUIRED: Set environment variable ANTHROPIC_API_KEY=your-key
   Get your API key from: https://console.anthropic.com/
`);

// System prompts - keep these secure on your server!
const prompts = {
  security_review: `
You are a senior security engineer reviewing code for vulnerabilities.

Analyze the provided code for:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) issues  
- Authentication and authorization flaws
- Input validation problems
- Sensitive data exposure
- Insecure cryptographic practices
- Business logic vulnerabilities

Provide specific findings with:
- Severity level (Critical/High/Medium/Low)
- Exact line numbers where issues occur
- Concrete remediation steps
- Code examples showing the fix

Focus on actionable, specific recommendations.
  `.trim(),

  code_quality: `
You are a senior software architect reviewing code quality.

Analyze the provided code for:
- Code complexity and maintainability
- SOLID principles adherence  
- Design patterns usage
- Performance considerations
- Error handling practices
- Code documentation quality
- Testing coverage opportunities

Provide specific recommendations with:
- Priority level (High/Medium/Low)
- Specific line references
- Refactoring suggestions with examples
- Best practices to implement

Focus on making the code more maintainable and robust.
  `.trim(),

  architecture_review: `
You are a principal architect reviewing system design.

Analyze the provided code for:
- Overall architectural patterns
- Component coupling and cohesion
- Scalability considerations
- Data flow and state management
- API design quality
- Separation of concerns
- Dependency management

Provide architectural recommendations with:
- System design improvements
- Pattern suggestions with examples
- Scalability enhancements
- Technical debt identification
- Long-term maintainability advice

Focus on high-level design improvements.
  `.trim()
};

// Create and start the server with unified RPC backend
const server = createRpcAiServer({
  // Conservative limits for basic usage
  aiLimits: AI_LIMIT_PRESETS.conservative,
  port: 8000,
  cors: {
    origin: ['vscode-webview://*', 'http://localhost:*'],
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // max 100 requests per windowMs
  }
});

// Start the server
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  server.stop();
  process.exit(0);
});

console.log(`
📘 Unified RPC AI Server Features:
✅ JSON-RPC protocol (universal compatibility)
✅ Conservative AI limits (cost control)
✅ System prompt protection
✅ Corporate proxy bypass
✅ Rate limiting and CORS
✅ Perfect for simple AI applications
✅ Client-managed API keys (pass in requests)
✅ Works with VS Code extensions, web apps, CLI tools

🚀 For tRPC and advanced features, see other examples
`);
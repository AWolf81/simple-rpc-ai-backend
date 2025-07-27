/**
 * AI Backend Server Example
 * 
 * Shows how to set up a server with BYOK and progressive authentication
 */

import { createAIServer } from '../../dist/index.js';

// Server configuration with BYOK support
const server = createAIServer({
  port: 8000,
  
  // Database configuration (SQLite for development)
  database: {
    type: 'sqlite',
    path: './ai-backend.db' // Use ':memory:' for in-memory database
  },
  
  // Master encryption key for BYOK (use strong random key in production)
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY || 'your-super-secret-master-key-change-me',
  
  // System prompts (these live in your application, not the package)
  prompts: {
    'security_review': `You are a security expert reviewing code for vulnerabilities.
    
Analyze the code and provide:
1. Critical security vulnerabilities (if any)
2. Potential security risks
3. Best practice recommendations
4. Specific code line references
5. Severity levels (Critical/High/Medium/Low)

Be thorough but practical in your assessment. Focus on:
- Input validation and sanitization
- Authentication and authorization flaws
- SQL injection and XSS vulnerabilities
- Insecure cryptographic practices
- Sensitive data exposure
- Security misconfigurations`,

    'code_quality': `You are a senior developer reviewing code quality.
    
Evaluate:
1. Code structure and organization
2. Readability and maintainability
3. Performance considerations
4. Best practices adherence
5. Design patterns usage
6. Error handling
7. Testing considerations

Provide actionable feedback with specific improvements and line references.`,

    'performance_review': `You are a performance expert analyzing code efficiency.

Focus on:
1. Time complexity analysis
2. Memory usage optimization
3. Database query efficiency
4. Caching opportunities
5. Algorithmic improvements
6. Resource management
7. Scalability concerns

Provide specific recommendations with performance impact estimates.`,

    'best_practices': `You are a code standards expert reviewing adherence to best practices.

Evaluate:
1. Coding standards compliance
2. Naming conventions
3. Code organization
4. Documentation quality
5. Error handling patterns
6. Testing coverage
7. Dependency management

Provide specific suggestions for improvement with examples.`
  },
  
  // OAuth providers (optional - for multi-device support)
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret'
    }
  },
  
  // Service providers (for users without their own keys) - Mixed format example
  serviceProviders: [
    {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022' // Custom model for primary provider
    },
    'openai',  // Uses defaults (OPENAI_API_KEY env + default model)
    'google'   // Uses defaults (GOOGLE_GENERATIVE_AI_API_KEY env + default model)
  ],
  
  // Payment verification (enabled by default)
  requirePayment: {
    enabled: true, // Users must be Pro to use service keys
    errorMessage: 'Please upgrade to Pro or configure your own API keys to continue.'
  },
  
  // CORS configuration
  cors: {
    origin: [
      'vscode-webview://*',
      'http://localhost:*',
      'https://localhost:*',
      'https://your-domain.com'
    ],
    credentials: true
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // requests per window per IP
  }
});

// Start the server
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

console.log(`
🎯 AI Backend Server Example - Generic AI Processing

Features enabled:
✅ BYOK (Bring Your Own Key) support
✅ Progressive authentication (anonymous → OAuth → Pro)
✅ Multi-device sync
✅ Secure key storage with AES-256-GCM encryption
✅ AI provider validation
✅ Rate limiting and CORS protection

Usage:
1. Users start anonymous (zero config)
2. Enter AI keys in VS Code extension settings
3. Optionally upgrade to OAuth for multi-device sync
4. Optionally upgrade to Pro for premium features

Code Review Types Available:
🛡️ Security Review - Vulnerability detection
✨ Code Quality - Structure and maintainability
⚡ Performance Review - Efficiency optimization
📚 Best Practices - Standards compliance

The server handles all the complexity while your code review app
focuses on the core functionality.
`);
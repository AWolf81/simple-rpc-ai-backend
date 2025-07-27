# Feature: Universal VS Code Crypto Backend - Reusable RPC Server

**Status**: 🔍 Planning

**Priority**: High

**Security Risk Level**: Low (Improves reusability without compromising security)

**Cryptographic Operations**: Architecture Enhancement

**MCP Integration**: Server

**Estimated Effort**: 12 hours

**Created**: 2025-07-25

**Last Updated**: 2025-07-25

## Problem Statement
The current `vscode-crypto-backend` is hardcoded for a specific use case (code analysis with 3 analysis types). Every VS Code extension that needs secure AI processing would have to duplicate this backend code and customize it. This leads to:

1. **Code Duplication**: Same RPC server logic copied across projects
2. **Maintenance Overhead**: Security updates must be applied to multiple backends
3. **Customization Complexity**: Hard to modify prompt configurations and RPC methods
4. **Enterprise Barrier**: Each team must rebuild secure infrastructure from scratch

We need a **Universal VS Code Crypto Backend** that can be easily configured for different use cases while maintaining the same security properties.

## Requirements
- The backend SHALL support pluggable RPC method handlers
- The system SHALL allow configurable system prompts via files, environment variables, or external sources
- The backend SHALL maintain the same security isolation properties
- Configuration SHALL be declarative (JSON/YAML) without requiring code changes
- The system SHALL support custom authentication schemes per deployment
- Hot-reloading SHALL be supported for prompt and configuration updates
- The backend SHALL be deployable as both standalone service and npm package

## Target Users
- VS Code extension developers needing secure AI processing
- Enterprise teams requiring customized code analysis
- Security-conscious developers wanting to protect proprietary prompts
- DevOps teams deploying centralized AI backends

## Cryptographic Context
- **Algorithms Involved**: Same as current (AES-256-GCM, ECDH P-256)
- **Key Types**: Session keys managed by Universal AI Crypto MCP
- **Data Sensitivity**: System prompts and business logic protected server-side
- **MCP Operations**: All existing crypto MCP tools remain unchanged

## Success Criteria
- [ ] Single backend codebase supports multiple VS Code extension use cases
- [ ] Configuration-driven prompt management (no code changes needed)
- [ ] Plugin system for custom RPC methods
- [ ] Backward compatibility with existing vscode-crypto-backend API
- [ ] Documentation with examples for common use cases
- [ ] npm package for easy deployment
- [ ] Docker container for enterprise deployment

## Architecture Impact
**Components Affected**:
- `examples/vscode-crypto-backend/` - Convert to universal backend
- New `src/universal-backend/` - Core reusable backend logic
- Configuration system for prompts and RPC methods
- Plugin architecture for extensibility

**New Dependencies**:
- Configuration loader (supports JSON/YAML/JS)
- Plugin system (dynamic RPC method loading)
- Hot-reload capability
- Template engine for prompt composition

## Universal Backend Architecture

### 1. Configuration-Driven Design
```typescript
interface BackendConfig {
  server: {
    port: number;
    cors: CorsOptions;
    rateLimit: RateLimitOptions;
  };
  
  prompts: {
    [promptName: string]: {
      source: 'file' | 'env' | 'url' | 'inline';
      location: string;
      fallback?: string;
      template?: boolean; // Support templating
    };
  };
  
  rpcMethods: {
    [methodName: string]: {
      handler: string; // Path to handler function
      auth?: string[]; // Required auth scopes
      rateLimit?: RateLimitOptions;
    };
  };
  
  auth: {
    type: 'bearer' | 'api-key' | 'oauth' | 'none';
    config: AuthConfig;
  };
}
```

### 2. Plugin System for RPC Methods
```typescript
interface RPCMethodHandler {
  name: string;
  description: string;
  params: JSONSchema;
  handler: (params: any, context: RPCContext) => Promise<any>;
  auth?: string[];
}

// Example custom handler
const customAnalysisHandler: RPCMethodHandler = {
  name: 'customCodeReview',
  description: 'Custom enterprise code review',
  params: { type: 'object', properties: { code: { type: 'string' } } },
  handler: async (params, context) => {
    const prompt = await context.getPrompt('custom_review_prompt');
    return await context.aiService.analyze(params.code, prompt);
  }
};
```

### 3. Universal Prompt Management
```yaml
prompts:
  security_review:
    source: file
    location: ./prompts/security-review.md
    template: true
    
  custom_review:
    source: env
    location: CUSTOM_REVIEW_PROMPT
    fallback: "Basic custom review prompt"
    
  enterprise_standards:
    source: url
    location: https://internal.company.com/ai-prompts/standards.txt
    auth: bearer
```

### 4. Hot-Reload Support
```typescript
class UniversalCryptoBackend {
  async reloadConfig() {
    const newConfig = await this.loadConfig();
    await this.updatePrompts(newConfig.prompts);
    await this.updateRPCMethods(newConfig.rpcMethods);
    console.log('🔄 Configuration reloaded successfully');
  }
  
  watchConfigChanges() {
    // File system watcher for config changes
    // HTTP endpoint for triggering reload
    // Signal handling for graceful reload
  }
}
```

## Reusability Patterns

### 1. Common Use Cases Templates
```javascript
// Code Analysis Backend (current example)
const codeAnalysisConfig = {
  prompts: {
    security_review: { source: 'file', location: './prompts/security.md' },
    architecture_review: { source: 'file', location: './prompts/architecture.md' },
    code_quality: { source: 'file', location: './prompts/quality.md' }
  },
  rpcMethods: {
    analyzeCode: { handler: 'handlers/code-analysis.js' },
    getSupportedAnalysisTypes: { handler: 'handlers/analysis-types.js' }
  }
};

// Documentation Assistant Backend
const docsAssistantConfig = {
  prompts: {
    generate_docs: { source: 'env', location: 'DOCS_GENERATION_PROMPT' },
    improve_docs: { source: 'env', location: 'DOCS_IMPROVEMENT_PROMPT' }
  },
  rpcMethods: {
    generateDocs: { handler: 'handlers/docs-generation.js' },
    improveDocs: { handler: 'handlers/docs-improvement.js' }
  }
};

// Enterprise Compliance Backend  
const complianceConfig = {
  prompts: {
    gdpr_check: { source: 'url', location: 'https://company.com/prompts/gdpr.txt' },
    sox_review: { source: 'url', location: 'https://company.com/prompts/sox.txt' }
  },
  rpcMethods: {
    checkCompliance: { handler: 'handlers/compliance-check.js' },
    generateReport: { handler: 'handlers/compliance-report.js' }
  },
  auth: { type: 'oauth', config: { issuer: 'https://company.com/oauth' } }
};
```

### 2. Extension Integration
```typescript
// VS Code Extension using Universal Backend
import { UniversalCryptoRPCClient } from 'universal-ai-encryption-mcp/rpc-client';

const client = new UniversalCryptoRPCClient('http://localhost:8000');

// Works with any configured RPC method
await client.call('analyzeCode', { code, analysisType: 'security_review' });
await client.call('generateDocs', { code, docType: 'api' });
await client.call('checkCompliance', { code, standard: 'gdpr' });
```

## Implementation Plan

### Phase 1: Core Universal Backend
1. Extract reusable components from current vscode-crypto-backend
2. Create configuration schema and loader
3. Implement plugin system for RPC methods
4. Add universal prompt management

### Phase 2: Deployment & Packaging
1. Create npm package for universal backend
2. Docker container with example configurations
3. CLI tool for generating backend configurations
4. Migration guide from hardcoded backends

### Phase 3: Advanced Features
1. Hot-reload support for configurations
2. Multi-tenant support (different configs per tenant)
3. Monitoring and metrics integration
4. Advanced authentication schemes

## Migration Strategy

### Backward Compatibility
```javascript
// Existing extensions continue to work
const legacyConfig = {
  // Auto-detect legacy vscode-crypto-backend usage
  // Map to universal backend configuration
  prompts: extractLegacyPrompts(),
  rpcMethods: mapLegacyMethods(),
  // Maintain same API endpoints
};
```

### Gradual Migration
1. **Drop-in replacement**: Universal backend supports existing API
2. **Enhanced configuration**: Migrate to config-driven approach
3. **Custom extensions**: Add new RPC methods and prompts
4. **Enterprise features**: Authentication, monitoring, multi-tenancy

## Security Considerations

### Security Properties Maintained
✅ **Process Isolation**: Same RPC server architecture  
✅ **Prompt Protection**: System prompts still server-side only  
✅ **Crypto Security**: Universal AI Crypto MCP unchanged  
✅ **Session Management**: Same timeout and cleanup mechanisms  

### New Security Features
✅ **Configuration Validation**: Schema validation for all configs  
✅ **Plugin Sandboxing**: RPC method handlers run in controlled context  
✅ **Authentication Flexibility**: Support for enterprise auth schemes  
✅ **Audit Logging**: Track configuration changes and method usage  

## Deployment Options

### 1. NPM Package
```bash
npm install universal-vscode-crypto-backend
npx universal-crypto-backend --config my-config.yaml
```

### 2. Docker Container
```bash
docker run -v ./config:/config -p 8000:8000 universal-crypto-backend
```

### 3. Embedded in Applications
```javascript
import { UniversalCryptoBackend } from 'universal-vscode-crypto-backend';
const backend = new UniversalCryptoBackend(myConfig);
await backend.start();
```

## Configuration Examples

### Minimal Configuration
```yaml
server:
  port: 8000
  
prompts:
  basic_prompt:
    source: inline
    content: "Analyze this code and provide feedback"
    
rpcMethods:
  analyze:
    handler: built-in/simple-analysis
```

### Enterprise Configuration
```yaml
server:
  port: 8000
  cors:
    origin: ["vscode-webview://*"]
  rateLimit:
    windowMs: 900000
    max: 50

auth:
  type: oauth
  config:
    issuer: "https://company.com/oauth"
    audience: "crypto-backend"

prompts:
  security_standards:
    source: url
    location: "https://internal.company.com/security-standards.md"
    auth: bearer
    cache: 3600
    
  compliance_check:
    source: file
    location: "./enterprise-prompts/compliance.md"
    template: true
    
rpcMethods:
  securityReview:
    handler: "./handlers/security-review.js"
    auth: ["security:read"]
    rateLimit: { max: 10, windowMs: 60000 }
    
  complianceCheck:
    handler: "./handlers/compliance.js" 
    auth: ["compliance:read", "security:read"]
```

## Notes & Decisions

**Key Design Decisions**:
1. **Configuration-First**: No code changes needed for most customizations
2. **Plugin Architecture**: Custom RPC methods without forking backend
3. **Security Preservation**: All existing security properties maintained
4. **Backward Compatibility**: Existing extensions work without changes
5. **Enterprise Ready**: Authentication, monitoring, multi-tenancy support

This universal backend approach transforms the VS Code crypto backend from a single-use example into a production-ready, reusable service that can support diverse AI-powered VS Code extensions while maintaining the same security guarantees.
# Prompt Provider Plugin System

**Status**: 📝 Future Feature  
**Priority**: Medium  
**Complexity**: High  
**Dependencies**: Core prompt system (✅ Complete)

## Overview

Extensible plugin system for loading system prompts from external sources like Notion, Confluence, Google Docs, GitHub, and custom APIs.

## Current State

✅ **Basic prompt loading**:
- Inline strings in config
- Local markdown files  
- DB structure ready (not implemented)

## Proposed Architecture

### Plugin-Based Design
```typescript
interface PromptProvider {
  name: string;
  load(config: ProviderConfig): Promise<PromptTemplate>;
  validate?(config: ProviderConfig): Promise<boolean>;
  refresh?(config: ProviderConfig): Promise<PromptTemplate>;
}

// Usage
const server = await createAIServerAsync({
  systemPrompts: {
    'code-review': {
      provider: 'notion',
      config: { pageId: 'abc123', token: 'secret' }
    },
    'security-audit': {
      provider: 'confluence', 
      config: { baseUrl: 'company.atlassian.net', pageId: '456' }
    }
  }
});
```

## Recommended Providers (Priority Order)

### 1. GitHub/Git Provider 🥇
- **Pros**: Version control, developer workflow, security, free
- **Cons**: Technical barrier for non-developers
- **Use Cases**: Developer teams, open source, version-controlled prompts

### 2. Confluence Provider 🥈  
- **Pros**: Enterprise integration, collaboration, page history
- **Cons**: Atlassian licensing, complex auth
- **Use Cases**: Corporate environments with existing Atlassian

### 3. Notion Provider 🥉
- **Pros**: User-friendly, real-time collaboration, rich formatting
- **Cons**: No proper version control, API limitations
- **Use Cases**: Non-technical teams, rapid prototyping

### 4. Database Provider
- **Pros**: Full control, audit trails, complex queries
- **Cons**: Infrastructure overhead, custom implementation
- **Use Cases**: Enterprise with specific compliance needs

## Implementation Plan

### Phase 1: Plugin Infrastructure
- [ ] `PromptProvider` interface
- [ ] `PromptProviderRegistry` 
- [ ] Caching and refresh mechanisms
- [ ] Error handling and fallbacks

### Phase 2: Core Providers
- [ ] GitHub/Git provider (start here - most valuable)
- [ ] Simple HTTP URL provider
- [ ] Database provider

### Phase 3: Enterprise Providers  
- [ ] Confluence provider
- [ ] Notion provider
- [ ] Google Docs provider (if demand exists)

### Phase 4: Advanced Features
- [ ] Webhook refresh triggers
- [ ] Multi-source prompt composition
- [ ] A/B testing for prompts
- [ ] Prompt analytics and usage tracking

## Security Considerations

### Authentication
- OAuth flows for external services
- Secure token storage (encrypted)
- Scoped permissions (read-only where possible)
- Token rotation support

### Access Control
- Role-based prompt access
- Environment-specific prompts (dev/staging/prod)
- Audit logging for prompt changes
- Content validation and sanitization

### Corporate Requirements
- Air-gapped deployment support
- SSO integration
- Compliance logging (SOX, GDPR, etc.)
- Data residency controls

## Configuration Examples

### GitHub Integration
```typescript
systemPrompts: {
  'code-review': {
    provider: 'github',
    config: {
      repo: 'company/ai-prompts',
      path: 'prompts/code-review.md',
      branch: 'main',
      auth: { token: process.env.GITHUB_TOKEN }
    },
    cache: { ttl: 3600 }, // 1 hour
    metadata: {
      category: 'code-quality',
      version: 'auto' // use git commit hash
    }
  }
}
```

### Confluence Integration
```typescript
systemPrompts: {
  'security-audit': {
    provider: 'confluence',
    config: {
      baseUrl: 'https://company.atlassian.net',
      spaceKey: 'AI',
      pageId: '123456789',
      auth: { token: process.env.CONFLUENCE_TOKEN }
    },
    cache: { ttl: 1800 }, // 30 minutes
    webhooks: ['page-updated'] // refresh on changes
  }
}
```

## Benefits Analysis

### Version Control & Collaboration
- **Git**: ✅ Full VCS, branching, PRs, blame
- **Confluence**: ⚠️ Page history only
- **Notion**: ❌ No proper versioning
- **Google Docs**: ⚠️ Manual version management

### Developer Experience  
- **Git**: ✅ Native workflow, IDE integration
- **Confluence**: ⚠️ Web-only editing
- **Notion**: ⚠️ Web-only, learning curve
- **Google Docs**: ❌ Poor for code/technical content

### Enterprise Readiness
- **Git**: ✅ Self-hosted options, security
- **Confluence**: ✅ Enterprise features, SSO
- **Notion**: ⚠️ Limited enterprise features
- **Google Docs**: ⚠️ Consumer-focused

## Decision Framework

### Choose GitHub/Git when:
- Technical team
- Version control important
- Open source or developer-focused
- Security and compliance critical

### Choose Confluence when:
- Existing Atlassian infrastructure
- Non-technical stakeholders involved
- Enterprise environment
- Documentation already in Confluence

### Choose Notion when:
- Design/product teams
- Rapid iteration needed
- Visual collaboration important
- Simple, user-friendly interface priority

### Choose Database when:
- Complex access controls needed
- High-volume prompt management
- Custom audit requirements
- Integration with existing systems

## Migration Strategy

1. **Start with file-based** (current implementation)
2. **Add GitHub provider** for developer teams
3. **Add database provider** for enterprise scale
4. **Add external providers** based on user demand

## Implementation Notes

- Keep current file/string API unchanged (backward compatibility)
- Plugin system should be opt-in addon
- Fail gracefully with meaningful error messages
- Cache aggressively to avoid API rate limits
- Support both pull and push refresh patterns

## Success Metrics

- Reduced prompt deployment friction
- Increased prompt iteration velocity  
- Better collaboration between technical/non-technical teams
- Fewer production prompt issues due to version control
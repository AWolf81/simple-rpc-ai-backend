# Archived Services

This directory contains services that are not currently used in the codebase but are preserved for future reference and potential ideas.

## Why Archive Instead of Delete?

These services represent valuable exploration and experimentation. While not actively used, they contain:
- Design patterns that might be useful later
- Alternative implementation approaches
- Ideas for future features
- Code that may be revisited when requirements change

## Archived Services

### 1. **APITokenManager.ts** (10KB)
**Original Purpose**: Manage API tokens with encryption and storage

**Key Features**:
- Token generation and validation
- Encrypted storage with AES-256-GCM
- Token rotation and expiration
- User-based token management

**Why Archived**:
- Functionality moved to `PostgreSQLSecretManager`
- Duplicate of secret management capabilities
- Not imported or used in current codebase

**Potential Future Use**:
- JWT token management system
- Session token handling
- API key rotation service
- Multi-tenant token isolation

---

### 2. **context-manager.ts** (9KB)
**Original Purpose**: Manage conversation context and history

**Key Features**:
- Context window management
- Message history tracking
- Token counting for context limits
- Context pruning strategies

**Why Archived**:
- Context management now handled by AI providers directly
- Vercel AI SDK manages context internally
- Not needed for stateless RPC calls

**Potential Future Use**:
- Conversation history persistence
- Multi-turn dialogue management
- Context-aware prompt engineering
- RAG (Retrieval-Augmented Generation) integration

---

### 3. **free-tier-service.ts** (9KB)
**Original Purpose**: Manage free tier quotas and limitations

**Key Features**:
- Free tier quota tracking
- Usage limits per user
- Upgrade prompts and suggestions
- Grace period management

**Why Archived**:
- Free tier not currently implemented
- Focus on BYOK (Bring Your Own Key) model
- Virtual token service handles quota management

**Potential Future Use**:
- Platform-managed free tier (100 free requests/month)
- Trial period management
- Freemium model implementation
- Usage-based pricing tiers

**Implementation Notes**:
```typescript
// Example integration for future use
const freeTierService = new FreeTierService({
  quotas: {
    free: { requests: 100, tokens: 10000 },
    pro: { requests: 10000, tokens: 1000000 }
  },
  gracePeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

---

### 4. **hybrid-user-service.ts** (18KB)
**Original Purpose**: Unified user management across multiple backends

**Key Features**:
- PostgreSQL and Redis user storage
- Hybrid query patterns (SQL + cache)
- User profile management
- Session management

**Why Archived**:
- Current focus on stateless RPC calls
- Authentication handled by separate auth system
- User management delegated to OAuth providers

**Potential Future Use**:
- User profile system
- Preferences and settings storage
- Multi-tenant user isolation
- Admin user management dashboard

**Architecture Notes**:
- Good example of hybrid storage patterns
- Shows PostgreSQL + Redis caching integration
- Useful reference for building user systems

---

### 5. **response-parser.ts** (8KB)
**Original Purpose**: Parse and format AI provider responses

**Key Features**:
- Response normalization across providers
- Error extraction and formatting
- Metadata parsing (tokens, timing, model info)
- Streaming response handling

**Why Archived**:
- Vercel AI SDK provides standardized response format
- Provider-specific parsing handled by SDK
- Not needed with current architecture

**Potential Future Use**:
- Custom response transformations
- Provider-agnostic response interface
- Response caching and deduplication
- Custom error handling logic

**Implementation Example**:
```typescript
// Useful pattern for response transformation
interface NormalizedResponse {
  text: string;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  timing: { startTime: number; endTime: number; duration: number };
  metadata: Record<string, any>;
}
```

---

## Design Patterns to Learn From

### 1. **Service Pattern**
All archived services follow a consistent pattern:
- Constructor with configuration object
- Public methods for core functionality
- Private methods for internal logic
- Error handling with typed errors
- TypeScript interfaces for contracts

### 2. **Storage Abstraction**
`hybrid-user-service.ts` shows excellent storage abstraction:
```typescript
interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

class HybridStorage implements StorageAdapter {
  constructor(
    private sql: PostgreSQLAdapter,
    private cache: RedisAdapter
  ) {}
}
```

### 3. **Token Management**
`APITokenManager.ts` demonstrates secure token handling:
- Cryptographic hashing (SHA-256)
- Encrypted storage (AES-256-GCM)
- Token expiration and rotation
- Revocation support

### 4. **Quota Management**
`free-tier-service.ts` shows quota tracking patterns:
- Time-based quotas (per hour/day/month)
- Usage counters with atomic operations
- Grace period handling
- Upgrade path management

---

## Migration History

**Archived Date**: 2025-09-30
**Archived By**: Tech debt cleanup initiative
**Reason**: Services not imported or used in current codebase

**Dependencies Check**: ✅ None of these services are imported by active code

---

## When to Resurrect a Service

Consider moving a service back to active development if:

1. **Feature Request**: New feature requires archived functionality
2. **Architecture Change**: System architecture evolves to need it
3. **Performance**: Optimization requires the patterns demonstrated
4. **Business Model**: New business model (e.g., freemium) requires free-tier service

## Restoration Process

If you need to restore a service:

1. Review the service code for compatibility with current codebase
2. Update dependencies (especially if they've changed)
3. Add tests to ensure functionality
4. Update imports in files that will use it
5. Move file back to `src/services/`
6. Update documentation

---

## Related Documentation

- [Service Refactoring Analysis](../../../specs/service-refactoring-analysis.md)
- [Technical Debt Tracking](../../../specs/tech-debt.md)
- [Architecture Documentation](../../../docs/)

---

## Contact

If you're considering using or restoring any of these services, please review:
1. Current architecture and how it might fit
2. Alternative modern implementations
3. Whether the functionality is already provided elsewhere

**Questions?** Open an issue or discussion on GitHub.

---

**Last Updated**: 2025-09-30
**Status**: Archived for future reference
**Active Services**: 20 services in parent directory

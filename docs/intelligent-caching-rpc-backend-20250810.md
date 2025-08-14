# Intelligent Caching for SimpleRPCAiBackend

**Date**: 2025-08-10  
**Status**: Feature Specification  
**Target**: SimpleRPCAiBackend integration for ThatMaps.ai  

## Overview

Add intelligent file content caching to SimpleRPCAiBackend to optimize token usage, reduce API costs, and improve response times for repeated context-heavy requests in the @ file selection feature.

## Current Problem

- ThatMaps.ai's @ file selection feature sends raw file content to AI providers
- Large context requests result in high token costs and slow responses
- Repeated requests for same files waste tokens and API calls
- No intelligent content summarization or relevance filtering

## Solution: Smart Context Caching Service

### Core Features

#### 1. File Content Caching

**Cache Entry Structure:**
```javascript
{
  id: "uuid",
  path: "file/path",
  hash: "content-hash", // mtime + size based for invalidation
  content: "raw file content",
  summary: "intelligent summary", 
  tokenCount: 1500,
  lastAccessed: timestamp,
  accessCount: 3,
  relevanceScore: 0.85,
  fileType: ".ts",
  size: 12543
}
```

#### 2. Intelligent Summarization

**By File Type:**
- **Code files (.js, .ts, .py)**: Extract imports, exports, function/class definitions, comments
- **Markdown (.md)**: Headers, lists, key structural elements  
- **JSON**: Key-value structure summary (name, version, scripts, dependencies)
- **Text files**: First/last paragraphs with keyword extraction
- **Config files**: Key configuration parameters and structure

**Example Code Summarization:**
```typescript
// Original: 500 lines
// Summary: 50 lines with key structures
import { vscode } from 'vscode';
export class CacheService {
  // Core caching functionality
  async getOrCache(filePath: string): Promise<CacheEntry>
  getCacheStats(): CacheStats
  recordTokenUsage(inputTokens: number, outputTokens: number)
}
```

#### 3. Context Optimization Engine

**Token Budget Management:**
- Fit context within model limits (4K, 8K, 128K tokens)
- Dynamic content selection based on relevance scores
- Intelligent truncation strategies

**Relevance Scoring Algorithm:**
```javascript
function calculateRelevance(entry, query) {
  let score = 0;
  
  // Keyword matching in content + summary
  score += countKeywordMatches(entry.content + entry.summary, query);
  
  // File name/path relevance bonus
  if (entry.path.toLowerCase().includes(queryWord)) score += 5;
  
  // Recency bonus (recently accessed files)
  if (daysSinceAccess < 1) score += 2;
  else if (daysSinceAccess < 7) score += 1;
  
  // Frequency bonus (often accessed files)  
  score += Math.min(entry.accessCount * 0.1, 2);
  
  return score;
}
```

**Smart Content Selection:**
- Use full content for small, highly relevant files
- Use summaries for large files with moderate relevance
- Skip irrelevant files entirely
- Prioritize recently modified/accessed files

#### 4. RPC API Methods

```javascript
// Get optimized context for AI prompt
await rpcClient.request('getOptimizedContext', {
  filePaths: ['src/app.js', 'README.md', 'package.json'],
  query: 'authentication system implementation',
  maxTokens: 4000,
  provider: 'anthropic', // for accurate token counting
  preferSummaries: false // force full content when possible
});

// Response format
{
  optimizedContent: "## File: app.js\n[content]\n---\n## File: README.md (summary)\n[summary]",
  totalTokens: 3850,
  filesIncluded: 3,
  filesSkipped: 0,
  cacheHits: 2,
  cacheMisses: 1
}

// Cache management methods  
await rpcClient.request('getCacheStats', {});
await rpcClient.request('clearCache', {});
await rpcClient.request('evictStaleEntries', { maxAge: '7d' });
```

#### 5. Performance Benefits

**Token Reduction:**
- 50-80% reduction for repeated context requests
- Intelligent summarization reduces large files by 80-90%
- Relevance filtering eliminates irrelevant content

**Response Speed:**
- Sub-second response for cached content
- Background cache warming for frequently accessed files
- Async summarization doesn't block requests

**Cost Optimization:**
- Significant API cost reduction through token optimization
- Smart caching reduces redundant API calls
- Provider-specific token counting for accurate budgeting

#### 6. Implementation Architecture

**Storage Strategy:**
- In-memory Map for fast access
- Periodic filesystem persistence (JSON files)
- Configurable cache location and limits

**Cache Invalidation:**
- Hash-based: `${filepath}-${mtime}-${size}`
- Automatic invalidation on file changes
- Manual cache clearing for development

**Size & Performance Limits:**
- 50MB total cache size
- 1MB per individual file
- 1000 entries maximum
- LRU with frequency-based eviction

**Background Processing:**
- Async file summarization
- Periodic cache maintenance
- Stale entry cleanup

### Integration with ThatMaps.ai

#### @ File Selection Enhancement

**Current Flow:**
```
User selects @file1.js @file2.md 
→ Raw content sent to AI (5000 tokens)
→ High API costs, slow response
```

**Enhanced Flow:**
```
User selects @file1.js @file2.md @package.json
→ RPC: getOptimizedContext(files, query, maxTokens: 4000)
→ Cache hit: file1.js summary (200 tokens)
→ Cache miss: file2.md → summarize → cache (300 tokens)  
→ Cache hit: package.json summary (100 tokens)
→ Optimized context (600 tokens vs 5000)
→ Faster, cheaper AI response
```

#### Configuration Options

**Via VS Code Settings:**
```json
{
  "thatmaps-ai.cache.enabled": true,
  "thatmaps-ai.cache.maxTokens": 4000,
  "thatmaps-ai.cache.preferSummaries": "auto", // "always", "never", "auto"
  "thatmaps-ai.cache.maxFileSize": 1048576, // 1MB
  "thatmaps-ai.cache.ttl": 604800 // 7 days in seconds
}
```

### Technical Specifications

#### Dependencies
- Node.js crypto module for hashing
- File system watching for invalidation
- JSON-RPC 2.0 for client/server communication

#### Error Handling
- Graceful fallback to raw content on cache errors
- Timeout handling for summarization
- Partial success responses when some files fail

#### Monitoring & Analytics
- Cache hit/miss rates
- Token savings metrics
- File access patterns
- Performance benchmarks

## Implementation Phases

### Phase 1: Core Caching (Week 1)
- Basic file caching with hash-based invalidation
- Simple text summarization
- RPC method stubs

### Phase 2: Intelligent Features (Week 2)  
- Advanced summarization by file type
- Relevance scoring algorithm
- Context optimization engine

### Phase 3: Integration (Week 3)
- ThatMaps.ai extension integration
- VS Code settings configuration
- Performance monitoring

### Phase 4: Optimization (Week 4)
- Background processing improvements
- Advanced eviction strategies
- Production performance tuning

## Success Metrics

- **Token Reduction**: 50%+ reduction in average context size
- **Response Speed**: Sub-second cached context retrieval
- **Cost Savings**: 40%+ reduction in AI API costs for repeat requests
- **Cache Efficiency**: 80%+ cache hit rate for frequent files
- **User Experience**: Seamless @ file selection performance

## Future Enhancements

- **Semantic Similarity**: Vector embeddings for content similarity
- **Learning Algorithms**: ML-based relevance scoring improvements
- **Cross-Session Caching**: Persistent cache across extension restarts
- **Distributed Caching**: Multi-workspace cache sharing
- **AI-Generated Summaries**: Use AI to create better file summaries

---

This intelligent caching system would transform ThatMaps.ai's @ file selection from a token-heavy feature into an efficient, cost-effective context management solution.
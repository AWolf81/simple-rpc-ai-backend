# AI Tool Usage Guide

This document explains how the AI service now supports MCP tools and provider-native capabilities.

## Overview

The AI service now provides three levels of web search and tool integration:

1. **MCP Tools** - AI can call MCP tools directly during conversation
2. **Provider-Native Tools** - Use Claude/GPT/Gemini built-in capabilities  
3. **Legacy Mode** - Pre-fetch search results (backward compatibility)

## Configuration

### 1. MCP Tools (Most Flexible)
```typescript
const aiService = new AIService({
  // ... other config
  mcpConfig: { 
    enableWebSearch: true,
    enableRefTools: true 
  }
});
```

### 2. Provider-Native Tools (Anthropic/OpenAI)
```typescript
const aiService = new AIService({
  // ... other config
  // No MCP config needed - uses provider's native capabilities
});
```

### Usage Examples

#### Anthropic Native Web Search ⭐
```typescript
const result = await aiService.execute({
  content: "What are the latest developments in AI for 2024?",
  promptId: "research_assistant",
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search', // Use Claude's native search
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxWebSearches: 3,
    allowedDomains: ['arxiv.org', 'openai.com', 'anthropic.com'],
    userLocation: {
      type: 'approximate',
      country: 'US',
      timezone: 'America/New_York'
    }
  }
});
```

#### MCP Tool Calling
```typescript
const result = await aiService.execute({
  content: "Research the latest JavaScript framework trends",
  promptId: "research_assistant", 
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'mcp', // Let AI decide when to search via MCP
    provider: 'anthropic'
  }
});
```

#### OpenAI Native Web Search ⭐
```typescript
const result = await aiService.execute({
  content: "What are the current stock market trends?",
  promptId: "research_assistant",
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search',
    provider: 'openai', 
    model: 'gpt-4o',
    maxWebSearches: 5,
    allowedDomains: ['bloomberg.com', 'reuters.com']
  }
});
```

#### Google Gemini Native Web Search ⭐
```typescript
const result = await aiService.execute({
  content: "Latest climate change research findings",
  promptId: "research_assistant",
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search',
    provider: 'google',
    model: 'gemini-2.5-flash'
  }
});
```

#### OpenRouter with Native Web Search ⭐
```typescript
const aiService = new AIService({
  serviceProviders: {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      priority: 1
    }
  }
});

const result = await aiService.execute({
  content: "Compare the latest AI models from different companies",
  promptId: "tech_analysis",
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search', // OpenRouter native web search via Exa.ai
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-sonnet', // Will become 'anthropic/claude-3.5-sonnet:online'
    maxWebSearches: 5
  }
});

// Or use models with built-in online capabilities
const perplexityResult = await aiService.execute({
  content: "What are today's top tech news stories?",
  promptId: "news_summary",
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search',
    provider: 'openrouter', 
    model: 'perplexity/llama-3.1-sonar-large-128k-online' // Already has online search built-in
  }
});
```

## Web Search Preferences

### `'mcp'` - MCP Tool Calling (Recommended)
- AI receives tool descriptions in system prompt
- AI decides when to call search tools based on user questions
- Supports multiple search rounds if needed
- More intelligent and context-aware

**Example System Prompt Enhancement:**
```
## Available Tools

You have access to the following tools:
- **web_search**: Search the web for current information

### When to Use Tools:
- Use web search when you need current information, recent news, or to verify facts
- Only call tools when they would genuinely improve your response
```

### `'ai-web-search'` - Provider Native ⭐ **NEW**
- **Anthropic**: Uses Claude's native `web_search_20250305` tool
- **OpenAI**: Uses GPT's native web search capabilities  
- Handled directly by the AI provider
- Most seamless integration, no external MCP servers needed
- Supports advanced features like domain filtering and location targeting

### `'duckduckgo'` - Legacy Mode  
- Pre-fetches search results before AI generation
- Injects results into system prompt
- Maintains backward compatibility
- Less intelligent (always searches)

## How Tool Calling Works

1. **Tool Discovery**: MCP service discovers available tools from servers
2. **System Prompt**: AI receives tool descriptions and usage guidelines
3. **Intelligent Calling**: AI decides when tools would improve the response
4. **Tool Execution**: System executes tools via MCP protocol
5. **Response Integration**: AI incorporates tool results into final response

## Example Conversation Flow

**User**: "What's the current price of Tesla stock?"

**AI Internal Process**:
1. Recognizes need for current information
2. Calls `web_search` tool with query "Tesla stock price current"
3. Receives search results from MCP server
4. Integrates results into response

**AI Response**: "Based on current market data, Tesla (TSLA) is trading at $248.50, up 2.3% from yesterday's close..."

## MCP Tool Support

### Available Tools
- **web_search** (via open-webSearch MCP server)
- **ref_search_documentation** (via ref-tools MCP server)  
- **ref_read_url** (via ref-tools MCP server)
- Custom MCP servers can add more tools

### Tool Parameters
```typescript
// Web search tool
{
  name: "web_search",
  parameters: {
    query: "string",      // Search query
    max_results: "number", // Optional, defaults to 5
    safe_search: "string"  // Optional: 'strict', 'moderate', 'off'
  }
}
```

## Web Search Capability Detection

### Automatic Capability Detection
```typescript
const aiService = new AIService({ provider: 'anthropic' });

// Check if provider supports native web search
const supportsNative = aiService.supportsNativeWebSearch(); // true for Anthropic

// Get comprehensive capability info
const capabilities = aiService.getWebSearchCapabilities();
console.log(capabilities);
// {
//   supportsNative: true,
//   supportsMCP: true,
//   recommendedPreference: 'ai-web-search',
//   description: 'Claude has excellent native web search with domain filtering'
// }

// Get full config including capabilities
const config = aiService.getConfig();
console.log(config.webSearchCapabilities);
```

### Per-Provider Capabilities

| Provider | Native Web Search | MCP Support | Recommended | Notes |
|----------|------------------|-------------|-------------|-------|
| **Anthropic** | ✅ `web_search_20250305` | ✅ | `ai-web-search` | Domain filtering, location targeting |
| **OpenAI** | ✅ Native browsing | ✅ | `ai-web-search` | Built-in web capabilities |
| **Google** | ✅ `googleSearch` | ✅ | `ai-web-search` | Google Search grounding |
| **OpenRouter** | ✅ Universal via Exa.ai | ✅ | `ai-web-search` | 400+ models, `:online` suffix, $4/1000 results |

## OpenRouter Web Search Deep Dive

### Universal Web Search Support
OpenRouter provides web search capabilities across **ALL 400+ models** via their partnership with Exa.ai:

#### Automatic Model Modification
```typescript
// Input model
model: 'anthropic/claude-3.5-sonnet'

// Automatically becomes when web search is enabled
model: 'anthropic/claude-3.5-sonnet:online'
```

#### Built-in Online Models
Some models already have web search capabilities built-in:
- `perplexity/llama-3.1-sonar-large-128k-online`
- `perplexity/llama-3.1-sonar-small-128k-online`

#### Pricing Structure
- **Cost**: $4 per 1,000 web search results
- **Default**: Up to 5 results per request (≈$0.02 per search)
- **Provider**: Exa.ai integration

#### Detection Logic
```typescript
// The system automatically detects and handles web search
const aiService = new AIService({ provider: 'openrouter' });

// Check capabilities
console.log(aiService.supportsNativeWebSearch()); // true
console.log(aiService.getWebSearchCapabilities());
// {
//   supportsNative: true,
//   supportsMCP: true, 
//   recommendedPreference: 'ai-web-search',
//   description: 'OpenRouter has universal web search via Exa.ai across 400+ models ($4 per 1000 results)'
// }

// Model transformation happens automatically
await aiService.execute({
  model: 'openai/gpt-4o', // Becomes 'openai/gpt-4o:online' when web search enabled
  metadata: { useWebSearch: true, webSearchPreference: 'ai-web-search' }
});
```

## Benefits of Tool Calling

### ✅ **Intelligent Usage**
- AI only searches when actually needed
- Can perform multiple searches for complex queries
- Adapts search queries based on initial results

### ✅ **Better Context**
- AI understands what information it's searching for
- Can refine searches based on partial results
- Integrates multiple sources intelligently

### ✅ **Flexible & Extensible**
- Easy to add new MCP tools
- AI automatically discovers new capabilities
- Works with any MCP-compatible tool

### ✅ **Robust Error Handling**
- Gracefully handles tool failures
- Falls back to knowledge-based responses
- Provides clear error messages

## Migration from Legacy Mode

### Before (Legacy)
```typescript
// Always performs search, whether needed or not
metadata: {
  useWebSearch: true,
  webSearchPreference: 'duckduckgo'
}
```

### After (Tool Calling)
```typescript
// AI decides when to search
metadata: {
  useWebSearch: true,
  webSearchPreference: 'mcp'
}
```

## Best Practices

1. **Use 'mcp' preference** for most intelligent behavior
2. **Configure appropriate system prompts** to guide tool usage
3. **Monitor tool usage** via console logs for debugging
4. **Handle tool failures gracefully** in your application
5. **Consider token costs** - tool calling uses more tokens

## Debugging

Enable verbose logging to see tool execution:
```bash
# Console output shows:
🔍 Using MCP web search tools
🔧 AI requested 1 tool calls
🔧 Executing tool: web_search with args: {"query": "Tesla stock price"}
✅ Tool execution completed successfully
```
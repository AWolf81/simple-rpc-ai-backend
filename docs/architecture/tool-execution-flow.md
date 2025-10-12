---
title: Tool Execution Flow
parent: Architecture
nav_order: 1
has_toc: true
---

# Tool Execution Flow Architecture
{: .no_toc }

<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Overview

The AIService supports two fundamentally different approaches to tool execution:
1. **Provider-Native Tools** - Executed directly by the AI provider
2. **MCP Tools** - Executed by our MCP server after AI requests them

## Provider-Native Tools Flow (`ai-web-search`)

```mermaid
sequenceDiagram
    participant Client
    participant AIService
    participant VercelSDK as Vercel AI SDK
    participant Provider as AI Provider<br/>(Claude/GPT/Gemini)

    Client->>AIService: execute({ useWebSearch: true,<br/>webSearchPreference: 'ai-web-search' })

    AIService->>AIService: prepareAIExecution()<br/>→ getProviderNativeTools()
    Note over AIService: Returns: [web_search_20250305]

    AIService->>VercelSDK: generateText({<br/>  tools: [native tools]<br/>})

    VercelSDK->>Provider: API call with<br/>native tool config

    Note over Provider: Provider executes<br/>web search internally

    Provider-->>VercelSDK: Response with<br/>search results

    VercelSDK-->>AIService: Final result

    AIService-->>Client: Response (single call)

    Note over Client,Provider: ✅ Single API call<br/>✅ Provider handles everything
```

## MCP Tools Flow (`mcp` / `duckduckgo`)

```mermaid
sequenceDiagram
    participant Client
    participant AIService
    participant VercelSDK as Vercel AI SDK
    participant Provider as AI Provider
    participant MCP as MCP Server

    Client->>AIService: execute({ useWebSearch: true,<br/>webSearchPreference: 'mcp' })

    AIService->>MCP: getAvailableToolsForAI()
    MCP-->>AIService: [{name, description, params}]

    AIService->>AIService: convertMCPToolsToAISDKFormat()
    Note over AIService: Tool schemas ready

    AIService->>VercelSDK: generateText({<br/>  tools: [MCP tool schemas],<br/>  toolChoice: 'auto'<br/>})

    VercelSDK->>Provider: API call with<br/>tool schemas

    Note over Provider: AI sees available tools<br/>and requests tool call

    Provider-->>VercelSDK: result.toolCalls = [...]

    VercelSDK-->>AIService: Result with tool calls

    Note over AIService: Line 590: Check for<br/>result.toolCalls

    AIService->>AIService: executeToolCalls(result.toolCalls)

    loop For each tool call
        AIService->>MCP: executeToolForAI({<br/>  name, arguments<br/>})
        MCP-->>AIService: Tool result
    end

    AIService->>AIService: continueWithToolResults()

    AIService->>VercelSDK: generateText({<br/>  messages: [...original, tool results],<br/>  tools: []<br/>})

    VercelSDK->>Provider: Second API call<br/>with tool results

    Provider-->>VercelSDK: Final response

    VercelSDK-->>AIService: Final result

    AIService-->>Client: Response (two API calls)

    Note over Client,MCP: ⚠️ Multiple API calls<br/>✅ Flexible tool execution
```

## Proactive Tool Discovery

### Why Pass MCP Tools to AI SDK?

```mermaid
graph TD
    A[Client Request:<br/>'Search for latest news'] --> B{Pass tools<br/>to AI SDK?}

    B -->|No| C[AI Response:<br/>'I cannot search']
    C --> D[❌ Poor UX]

    B -->|Yes| E[AI knows tools available]
    E --> F[AI returns:<br/>result.toolCalls]
    F --> G[We execute via MCP]
    G --> H[Continue with results]
    H --> I[✅ Good UX]

    style D fill:#ffcccc
    style I fill:#ccffcc
```

### Benefit: No Separate Discovery Call

```mermaid
graph LR
    subgraph Traditional MCP
        A1[Client] --> B1[tools/list]
        B1 --> C1[MCP Server]
        C1 --> D1[Return tools]
        D1 --> E1[Tell AI]
        E1 --> F1[AI decides]
    end

    subgraph Our Approach
        A2[Client] --> B2[AI already<br/>knows tools]
        B2 --> C2[AI decides<br/>immediately]
    end

    style A2 fill:#ccffcc
    style B2 fill:#ccffcc
    style C2 fill:#ccffcc
```

## Code Flow Reference

### Line 560-574: Tool Configuration Decision

```typescript
if (availableTools.length > 0) {
  if (executionConfig.webSearchPreference === 'ai-web-search') {
    // Provider-native: AI SDK passes to provider for native execution
    generateOptions.tools = availableTools;
  } else {
    // MCP: AI SDK gets schemas, we execute after AI requests
    generateOptions.tools = availableTools;
    generateOptions.toolChoice = 'auto';
    // executeToolCalls() at line 590 intercepts and executes via MCP
  }
}
```

### Line 590-604: MCP Tool Execution Interception

```typescript
// Only for MCP tools (not ai-web-search)
if (result.toolCalls && result.toolCalls.length > 0
    && executionConfig.webSearchPreference !== 'ai-web-search') {

  // Execute via MCP server
  const toolResults = await this.executeToolCalls(result.toolCalls);

  // Continue conversation with results
  const finalResult = await this.continueWithToolResults(
    generateOptions, result, toolResults
  );

  return this.formatExecuteResult(finalResult, executionConfig);
}
```

### Line 1084-1126: MCP Tool Execution Implementation

```typescript
private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
  const toolResults: any[] = [];

  for (const toolCall of toolCalls) {
    if (this.mcpService) {
      const mcpResult = await this.mcpService.executeToolForAI({
        name: toolCall.toolName,
        arguments: toolCall.args
      });

      toolResults.push({
        toolCallId: toolCall.toolCallId,
        result: mcpResult.success ? mcpResult.result : { error: mcpResult.error }
      });
    }
  }

  return toolResults;
}
```

## Architecture Decision Matrix

```mermaid
graph TD
    Start[Tool Execution Needed] --> Q1{Provider<br/>supports<br/>native tool?}

    Q1 -->|Yes| Q2{Need custom<br/>control or<br/>logging?}
    Q1 -->|No| MCP[Use MCP Tools]

    Q2 -->|No| Native[Use Provider-Native]
    Q2 -->|Yes| MCP

    Native --> N1[✅ Single API call]
    Native --> N2[✅ Fastest execution]
    Native --> N3[✅ Provider-optimized]

    MCP --> M1[✅ Custom tools]
    MCP --> M2[✅ Provider-agnostic]
    MCP --> M3[✅ Full observability]
    MCP --> M4[⚠️ Two API calls]

    style Native fill:#e1f5e1
    style MCP fill:#e1e5f5
```

## Configuration Examples

### Provider-Native Tools

```typescript
const service = new AIService({
  serviceProviders: [
    { name: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
  ]
  // No mcpConfig needed
});

await service.execute({
  content: 'Search for latest AI news',
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'ai-web-search'  // Native execution
  }
});
```

### MCP Tools

```typescript
const service = new AIService({
  serviceProviders: [
    { name: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
  ],
  mcpConfig: {
    enableWebSearch: true  // Enable MCP tools
  }
});

await service.execute({
  content: 'Search for latest AI news',
  metadata: {
    useWebSearch: true,
    webSearchPreference: 'mcp'  // MCP execution
  }
});
```

## Performance Comparison

```mermaid
graph LR
    subgraph Provider-Native
        PN1[Request] --> PN2[API Call 1]
        PN2 --> PN3[Response]
        PN3 -.-> PN4[~2-4 seconds]
    end

    subgraph MCP Tools
        MC1[Request] --> MC2[API Call 1<br/>Tool Request]
        MC2 --> MC3[Execute MCP]
        MC3 --> MC4[API Call 2<br/>With Results]
        MC4 --> MC5[Response]
        MC5 -.-> MC6[~4-8 seconds]
    end

    style PN4 fill:#ccffcc
    style MC6 fill:#ffffcc
```

| Aspect | Provider-Native | MCP Tools |
|--------|----------------|-----------|
| **Latency** | ~2-4 seconds | ~4-8 seconds |
| **API Calls** | 1 | 2 |
| **Token Usage** | Standard | Standard + Continuation |
| **Customization** | Limited | Full |
| **Observability** | Provider-level | Full control |

## When to Use Each Approach

### Use Provider-Native (`ai-web-search`) When:

✅ Provider supports native tool (Claude, GPT-4, Gemini)
✅ Performance is critical (single API call)
✅ Want provider-optimized execution
✅ Don't need custom tool control

### Use MCP (`mcp`/`duckduckgo`) When:

✅ Need custom tool implementations
✅ Want provider-agnostic tools
✅ Need audit/logging of tool calls
✅ Want centralized tool management
✅ Provider doesn't support native tools

## Summary

The current architecture is **correct and intentional**:

1. **Both approaches use `generateOptions.tools = availableTools`**
   - For native: Provider executes during initial API call
   - For MCP: We intercept `result.toolCalls` and execute via MCP

2. **Proactive Tool Discovery**
   - AI knows available tools upfront (no separate `tools/list` call)
   - Better UX - single user request triggers everything
   - AI can intelligently decide to use tools

3. **Clean Separation**
   - Line 560-574: Configure tools
   - Line 590-604: Intercept and execute MCP tools
   - Line 1084-1126: Execute via MCP server

This design provides:
- ✅ **Flexibility** - Support both native and MCP tools
- ✅ **Transparency** - AI knows available tools
- ✅ **Control** - Full observability for MCP tools
- ✅ **Performance** - Native tools execute in one call

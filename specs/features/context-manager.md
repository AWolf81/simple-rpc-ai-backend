# Feature: Context Manager for Platform-Agnostic AI Requests
**Status**: 📝 Draft
**Priority**: Medium
**Security Risk Level**: Low
**Cryptographic Operations**: None
**MCP Integration**: None
**Estimated Effort**: 2-3 days
**Created**: 2025-01-26
**Last Updated**: 2025-01-26

## Problem Statement
The current AI request interface assumes VS Code file access, making it platform-specific. The package should be **platform-agnostic** and work across:
- VS Code extensions (file/selection context)
- Web applications (text input context)
- CLI tools (file system context)
- API services (webhook/URL context)
- Mobile/desktop apps (various input contexts)

## Requirements
- The system SHALL provide a generic AI request interface that works across platforms
- The system SHALL support different context types (file, selection, manual input, URL, etc.)
- The system SHALL allow platform-specific metadata without breaking compatibility
- The system SHALL be extensible for new platforms and context types

## Target Users
- Developers building AI applications across multiple platforms
- VS Code extension developers
- Web application developers
- CLI tool developers  
- API service developers
- Mobile/desktop app developers

## Context Types Supported
```typescript
interface AIRequestContext {
  type: 'file' | 'selection' | 'manual' | 'url' | 'clipboard' | 'stream';
  content: string;
  metadata?: {
    fileName?: string;
    language?: string;
    lineNumbers?: [number, number];
    sessionId?: string;
    url?: string;
    timestamp?: Date;
    [key: string]: any; // Extensible
  };
}

class ContextManager {
  static fromVSCodeSelection(editor: any): AIRequestContext;
  static fromWebInput(content: string, metadata?: any): AIRequestContext;
  static fromFile(filePath: string, content: string): AIRequestContext;
  static fromURL(url: string, content: string): AIRequestContext;
}
```

## Platform Usage Examples
```typescript
// VS Code Extension
const context = ContextManager.fromVSCodeSelection(editor);
await client.processAIRequest({ userId, promptType: 'create_mindmap', context });

// Web Application  
const context = ContextManager.fromWebInput(userText);
await client.processAIRequest({ userId, promptType: 'create_mindmap', context });

// CLI Tool
const context = ContextManager.fromFile(filePath, fileContent);  
await client.processAIRequest({ userId, promptType: 'security_review', context });
```

## Implementation Plan
1. **Context Interface Design**: Create generic AIRequestContext interface
2. **ContextManager Implementation**: Platform-specific context creation utilities
3. **Server Handler Updates**: Make AI request handlers context-agnostic
4. **Client Library Updates**: Use context-based requests
5. **Platform Examples**: VS Code, Web, CLI usage examples

## Benefits
- **Platform Agnostic**: Same backend works across all platforms
- **Extensible**: Easy to add new platforms and context types
- **Rich Metadata**: Platform-specific context information
- **Type Safe**: Clear interfaces prevent runtime errors
- **Future Proof**: Support for new platforms without breaking changes
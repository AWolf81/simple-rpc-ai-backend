# OpenAPI tRPC Compatibility Report

## Summary
Both major OpenAPI generation packages for tRPC are **incompatible** with tRPC v11.x, which we're currently using.

## Packages Tested

### 1. `trpc-to-openapi@3.0.1`
- **Error**: `[mutation.test] - Input parser expects a Zod validator`
- **Issue**: Cannot recognize Zod validators properly, even with `z.void()`, `z.string()`, and `z.object({})`
- **Status**: Actively maintained but has fundamental parsing issues

### 2. `trpc-openapi@1.2.0` (Official)
- **Error**: `Unknown procedure type`
- **Issue**: Expects tRPC v10.x, incompatible with tRPC v11.x procedure types
- **Status**: Official package but outdated for current tRPC version

## Root Cause Analysis

### tRPC v11 Breaking Changes Affecting OpenAPI Generation

The core issue is that **tRPC v11 introduced fundamental changes** to how input parsing works:

#### 1. `rawInput` → `getRawInput()` Function
**v10 (Old)**:
```javascript
// Middleware could access rawInput directly
const middleware = ({ next, rawInput }) => {
  // rawInput was available as property
}
```

**v11 (New)**:
```javascript  
// rawInput is now a function that must be called
const middleware = ({ next, getRawInput }) => {
  const rawInput = await getRawInput(); // Now async function
}
```

#### 2. Lazy Input Materialization
- **v10**: Inputs were parsed immediately
- **v11**: "Inputs are now materialized lazily when required by the procedure"
- This breaks libraries that expect immediate access to input schemas

#### 3. Procedure Type Changes
- **v11**: "Simplified procedure type emissions, now only emitting input and output"
- OpenAPI generators rely on inspecting procedure internals for schema extraction

### Specific Impact on `trpc-to-openapi@3.0.1`
The error `"Input parser expects a Zod validator"` occurs because:
1. The library tries to access input parsers using v10 APIs
2. v11's lazy input materialization means parsers aren't immediately available
3. The schema extraction logic fails, thinking no Zod validator exists

### Specific Impact on `trpc-openapi@1.2.0`  
The error `"Unknown procedure type"` occurs because:
1. v11 changed internal procedure type representations
2. The library's procedure type detection logic is hardcoded for v10 types
3. Cannot recognize v11's simplified procedure emissions

We're using `@trpc/server@11.5.0`, but:
- `trpc-openapi` expects `@trpc/server@^10.0.0` (peer dependency mismatch)
- `trpc-to-openapi` has input parser detection bugs due to v11's lazy materialization

## Solutions

### Option 1: Downgrade tRPC (Not Recommended)
- Downgrade to `@trpc/server@^10.x` to use `trpc-openapi@1.2.0`
- **Risk**: Lose tRPC v11 features and improvements

### Option 2: Wait for Updates
- Wait for `trpc-openapi` to support tRPC v11
- Monitor `trpc-to-openapi` for bug fixes

### Option 3: Alternative Documentation
- Use tRPC Panel for development (already working)
- Generate OpenAPI manually or with custom tooling
- Document APIs with traditional tools (Swagger, etc.)

### Option 4: Fork and Fix
- Fork `trpc-to-openapi` and update the input parser detection logic for v11
- Update procedure introspection to use v11's simplified emissions
- Replace `rawInput` access with `getRawInput()` async calls
- Contribute back to the community

### Option 5: Alternative OpenAPI Libraries
- Look for newer libraries that support tRPC v11
- Consider `@trpc/openapi` alternatives or community forks
- Evaluate custom OpenAPI generation from tRPC schemas

## Current Workaround
We're using a dummy OpenAPI document as a fallback:

```javascript
// Fallback OpenAPI doc when generation fails
const openApiDoc = {
  openapi: '3.0.0',
  info: {
    title: 'My Awesome API',
    version: '1.2.3',
    description: 'Documentation for AI and MCP endpoints'
  },
  paths: {} // Empty - would need manual population
};
```

## Recommendation
For now, **continue with tRPC Panel** for development and wait for OpenAPI package updates. The tRPC Panel provides excellent runtime documentation and testing capabilities without the compatibility issues.

## Test Files Created
- `/examples/openapi-test.js` - Standalone test for OpenAPI generation
- `/src/trpc/test-router.ts` - Minimal router for compatibility testing

## Date
Generated: $(date)
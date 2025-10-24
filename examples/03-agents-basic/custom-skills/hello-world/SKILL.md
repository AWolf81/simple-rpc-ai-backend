---
name: hello-world
description: Simple test skill that demonstrates skill structure, progressive disclosure, and script execution
version: 1.0.0
author: Test
license: MIT
capabilities:
  - testing
  - demonstration
scripts:
  - path: scripts/greet.ts
    runtime: typescript
    description: Generate a personalized greeting
    args:
      - name: name
        description: Name to greet
        type: string
        required: true
      - name: formal
        description: Use a formal greeting (adds --formal flag)
        type: boolean
        flag: --formal
  - path: scripts/validate-json.ts
    runtime: typescript
    description: Validate JSON file syntax
allowedPaths:
  - /workspace
  - /tmp
---

# Hello World Skill

## Purpose

This is a simple test skill to demonstrate:
1. Progressive disclosure (3 levels)
2. Script execution with TypeScript
3. Input validation and output formatting

## Instructions

### Tool Identifiers

The following MCP tool identifiers are exposed for this skill. Use these exact names when invoking tools or describing capabilities:

- **hello-world_greet** — Executes `scripts/greet.ts` to generate a personalized greeting.
- **hello-world_validate-json** — Executes `scripts/validate-json.ts` to validate JSON syntax.

Tools may also appear with underscores instead of hyphens (for backwards compatibility), but prefer the hyphenated identifiers above when calling them.

### Greeting Command

Generate a personalized greeting:
```bash
tsx scripts/greet.ts <name> [--formal]
```

When calling the `hello-world_greet` tool, provide structured arguments:

```json
{
  "name": "Charlie",
  "formal": false
}
```

Examples:
- `tsx scripts/greet.ts Alice` → "Hello, Alice!"
- `tsx scripts/greet.ts Bob --formal` → "Good day, Bob. How may I assist you?"

### JSON Validation

Validate JSON file syntax:
```bash
tsx scripts/validate-json.ts <file-path>
```

Example:
- `tsx scripts/validate-json.ts /workspace/config.json`

## Token Usage

- **Level 1** (Metadata): ~85 tokens
- **Level 2** (This file): ~200 tokens
- **Level 3** (Scripts loaded on-demand): 0 tokens until executed

## Testing Checklist

- [ ] Load skill via agents.skills.list
- [ ] Get skill details via agents.skills.get
- [ ] Validate skill via agents.skills.validate
- [ ] Check metrics via agents.skills.metrics
- [ ] Execute greet script
- [ ] Execute validate-json script
- [ ] Match skill by capability

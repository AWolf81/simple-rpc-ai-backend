# Agent Skills System

## Overview

The Agent Skills System provides a comprehensive, Vercel AI SDK-based implementation for extending agent capabilities through modular skills. This system is compatible with Claude's agent skills architecture without using Anthropic proprietary code.

## Status

- **Status**: 🔄 In Development
- **Target Version**: 0.2.0
- **Priority**: High
- **Dependencies**: Vercel AI SDK, agent service

## Design Principles

1. **Vercel AI SDK Only**: No Anthropic Claude Code or Codex SDK dependencies
2. **Multi-Source Support**: Load skills from GitHub, npm, local folders, URLs, and zip files
3. **Sandboxed Execution**: Scripts run in isolated environments with workspace restrictions
4. **Progressive Disclosure**: Three-level context loading (metadata → instructions → resources)
5. **Token Efficiency**: Optimal context window usage through lazy loading
6. **Standards Compliance**: Compatible with Anthropic's skill structure (SKILL.md, frontmatter, etc.)

## Motivation

### Problems Solved

1. **Legal Compliance**: Avoid Anthropic SDK licensing restrictions for competing products
2. **Vendor Lock-In**: Use any AI provider (Anthropic, OpenAI, Google) with same skills
3. **Skill Distribution**: Load skills from multiple sources (GitHub, npm, zip, etc.)
4. **Security**: Sandboxed script execution with strict path and resource limits
5. **Performance**: Progressive disclosure prevents context window bloat

### Use Cases

- Building AI-powered tools (like Claude Code) without proprietary SDKs
- Creating reusable skill libraries for teams
- Distributing skills via npm packages or GitHub
- Running skills with different AI providers
- Sandboxed code execution in agent workflows

## Skill Structure

### Directory Layout

```
skill-name/
├── SKILL.md           # Main instructions with frontmatter (Level 2)
├── references/        # Additional documentation (Level 3)
│   ├── api.md
│   └── examples.md
├── scripts/          # Executable code (Level 3)
│   ├── validate.py
│   ├── process.ts
│   └── helper.sh
├── commands/         # Slash commands (Level 3)
│   └── format.md
├── templates/        # File templates (Level 3)
│   └── template.json
└── examples/         # Usage examples (Level 3)
    └── demo.md
```

### SKILL.md Format

```yaml
---
name: skill-name
description: What this skill does and when to use it (max 1024 chars)
version: 1.0.0
author: Author Name
license: MIT
capabilities:
  - capability1
  - capability2
scripts:
  - path: scripts/validate.py
    runtime: python
    description: Validation script
  - path: scripts/process.ts
    runtime: typescript
    description: Processing script
allowedPaths:
  - /workspace
  - /tmp
---

# Skill Name

## Instructions

Detailed instructions for using this skill...

## Usage

Examples and usage patterns...
```

## Progressive Disclosure System

### Level 1: Metadata (Always Loaded)
- **Source**: YAML frontmatter only
- **Token Budget**: ~100 tokens per skill
- **Purpose**: Skill discovery and matching
- **Fields**: name, description, capabilities
- **Loading**: At agent startup

### Level 2: Instructions (Triggered)
- **Source**: SKILL.md body content
- **Token Budget**: <5k tokens (~500 lines recommended)
- **Purpose**: Core skill guidance
- **Loading**: When skill matches user request

### Level 3: Resources (On-Demand)
- **Source**: All other files (references/, scripts/, etc.)
- **Token Budget**: Unlimited (loaded only when accessed)
- **Purpose**: Deep documentation, executable code
- **Loading**: Explicitly referenced by agent

## Multi-Source Skill Loading

### Supported Sources

#### 1. GitHub Repositories
```typescript
{
  type: 'github',
  url: 'https://github.com/org/repo',
  path: 'skills/skill-name', // optional subdirectory
  ref: 'main' // optional branch/tag
}
```

#### 2. npm Packages
```typescript
{
  type: 'npm',
  package: '@org/skills',
  version: 'latest', // or specific version
  path: 'dist/skills/skill-name' // optional path within package
}
```

#### 3. Local Folders
```typescript
{
  type: 'local',
  path: '/path/to/skill'
}
```

#### 4. Custom URLs
```typescript
{
  type: 'url',
  url: 'https://example.com/skills/skill-name.zip'
}
```

#### 5. Zip Files
```typescript
{
  type: 'zip',
  path: '/path/to/skill.zip',
  autoExtract: true // automatically extract to temp directory
}
```

### Loading Pipeline

```
Source Definition → Download/Locate → Extract (if zip) → Validate → Parse → Cache → Load
```

## Sandboxed Script Execution

### Supported Runtimes

- **Python**: `python3` with stdlib only (no network access)
- **TypeScript**: `tsx` or `ts-node` with Node.js stdlib
- **JavaScript**: `node` with Node.js stdlib
- **Shell**: `bash` with standard utilities

### Security Model

```typescript
interface SandboxConfig {
  allowedPaths: string[];     // Workspace and temp only
  timeout: number;            // Max execution time (default: 30s)
  maxMemory: number;          // Memory limit (default: 512MB)
  networkAccess: false;       // Always disabled
  environmentVars: Record<string, string>; // Whitelisted env vars
}
```

### Execution Flow

1. **Validate Script Path**: Must be within skill directory
2. **Check Allowed Paths**: Verify script can only access workspace/temp
3. **Prepare Sandbox**: Create isolated environment
4. **Execute**: Run with timeout and memory limits
5. **Capture Output**: Only stdout/stderr enters context
6. **Cleanup**: Remove temporary files

## Configuration

### Server Configuration

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      enabled: true,
      sources: [
        // Built-in core skills (shipped with library)
        { type: 'builtin', name: 'file-handling' },
        { type: 'builtin', name: 'code-analysis' },

        // GitHub skills
        {
          type: 'github',
          url: 'https://github.com/your-org/custom-skills',
          path: 'skills'
        },

        // npm package skills
        {
          type: 'npm',
          package: '@your-org/skills',
          version: 'latest'
        },

        // Local development skills
        {
          type: 'local',
          path: './local-skills'
        },

        // Remote zip skills
        {
          type: 'url',
          url: 'https://cdn.example.com/skills/pack.zip'
        }
      ],

      // Sandbox configuration
      sandbox: {
        allowedPaths: ['/workspace', '/tmp'],
        timeout: 30000,
        maxMemory: 512 * 1024 * 1024,
        networkAccess: false
      },

      // Validation
      validation: {
        enabled: true,
        maxTokens: {
          level1: 100,    // Metadata
          level2: 5000,   // Instructions
        },
        requireLicense: false,
        allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause']
      }
    }
  }
});
```

## Built-In Core Skills

The library ships with essential skills in `src/services/agents/skills/builtin/`:

### 1. File Handling (`file-handling`)
- Read, write, search files
- Directory operations
- File validation
- Safe path handling

### 2. Code Analysis (`code-analysis`)
- Syntax checking
- Dependency analysis
- Code metrics
- Pattern detection

### 3. Git Operations (`git-operations`)
- Status, diff, log
- Commit, branch management
- Safe operations only (no force push)
- Repository analysis

### 4. Testing (`testing`)
- Test execution
- Coverage analysis
- Test generation
- Assertion validation

### 5. Documentation (`documentation`)
- Doc generation
- API extraction
- Markdown formatting
- Link validation

## Skill Validation

### Dev Panel Integration

The dev panel provides skill validation at `http://localhost:8080/skills/validate` with:

#### 1. Structure Validation
- SKILL.md format compliance
- Frontmatter schema validation
- Required fields verification
- File organization check

#### 2. Token Usage Analysis
- Level 1 token count (should be ~100)
- Level 2 token count (should be <5k)
- Level 3 file listing (loaded on-demand)
- Recommendations for optimization

#### 3. Best Practices Checks
- File organization (references/, scripts/, etc.)
- Naming conventions (SKILL.md, *.md, etc.)
- Script permissions and safety
- Documentation completeness

#### 4. Security Audit
- Allowed paths configuration
- Script runtime detection
- Network access attempts
- Dependency requirements
- Timeout and memory limits

### Validation API

```typescript
// tRPC endpoint: agents.validateSkill
await client.agents.validateSkill.query({
  skillId: 'brand-guidelines',
  source: './skills/brand-guidelines' // optional
});

// Response
{
  valid: true,
  errors: [],
  warnings: ['SKILL.md body exceeds 4k tokens (4,234 tokens)'],
  metrics: {
    level1Tokens: 87,
    level2Tokens: 4234,
    level3Files: 12,
    scripts: [
      {
        path: 'scripts/validate-colors.ts',
        runtime: 'typescript',
        safe: true,
        allowedPaths: ['/workspace'],
        timeout: 30000
      }
    ]
  },
  recommendations: [
    'Consider moving detailed examples to references/ directory',
    'Script validate-colors.ts uses safe path handling'
  ]
}
```

## Token Usage Optimization

### Guidelines

- **Metadata**: ~100 tokens (name + description)
- **Instructions**: <5k tokens (~500 lines max)
- **References**: Lazy load (zero until accessed)
- **Scripts**: Output only (code doesn't enter context)

### Best Practices

1. **Concise Metadata**: Assume agent has baseline knowledge
2. **Progressive Structure**: High-level overview in SKILL.md, details in references/
3. **Table of Contents**: For files >100 lines
4. **Script Output**: Only stdout/stderr enters context, not script code
5. **On-Demand Resources**: Reference additional files only when needed

### Measurement

```typescript
interface TokenMetrics {
  skill: string;
  level1: number;  // Frontmatter
  level2: number;  // SKILL.md body
  level3: number;  // Resources (when loaded)
  total: number;   // Actual usage in conversation
}
```

## Implementation

### Phase 1: Core Infrastructure (Week 1)
- [ ] Skill loader with multi-source support
- [ ] SKILL.md parser with frontmatter
- [ ] Progressive disclosure system
- [ ] Token counting and metrics

### Phase 2: Sandboxing (Week 2)
- [ ] Script execution sandbox
- [ ] Runtime detection (Python, TypeScript, JavaScript, Shell)
- [ ] Path restriction enforcement
- [ ] Timeout and memory limits

### Phase 3: Built-In Skills (Week 3)
- [ ] File handling skill
- [ ] Code analysis skill
- [ ] Git operations skill
- [ ] Testing skill
- [ ] Documentation skill

### Phase 4: Validation & Dev Panel (Week 4)
- [ ] Skill validation API
- [ ] Dev panel UI for skill management
- [ ] Token usage analysis
- [ ] Security audit
- [ ] Best practices checker

## API Reference

### tRPC Endpoints

```typescript
// Load skills
await client.agents.loadSkills.mutation({
  sources: [
    { type: 'github', url: 'https://github.com/org/skills' },
    { type: 'local', path: './skills' }
  ]
});

// List loaded skills
const skills = await client.agents.listSkills.query();

// Get skill details
const skill = await client.agents.getSkill.query({
  skillId: 'file-handling'
});

// Execute agent with skills
const result = await client.agents.execute.mutation({
  prompt: 'Analyze this code',
  skills: ['code-analysis', 'file-handling'],
  context: {
    workspace: '/project'
  }
});

// Validate skill
const validation = await client.agents.validateSkill.query({
  skillId: 'custom-skill',
  source: './skills/custom'
});

// Get skill metrics
const metrics = await client.agents.getSkillMetrics.query({
  skillId: 'file-handling'
});
```

## Example: Creating a Custom Skill

### 1. Create Skill Directory

```bash
mkdir -p ./skills/brand-guidelines/{references,scripts,templates}
```

### 2. Create SKILL.md

```markdown
---
name: brand-guidelines
description: Apply consistent brand guidelines to content including colors, fonts, tone, and messaging
version: 1.0.0
author: Your Team
license: MIT
capabilities:
  - content-validation
  - style-checking
scripts:
  - path: scripts/validate-colors.ts
    runtime: typescript
    description: Validate brand color usage
allowedPaths:
  - /workspace
---

# Brand Guidelines Skill

## Purpose

This skill ensures all content follows brand guidelines.

## Instructions

When reviewing content, check:
1. Color usage (see references/colors.md)
2. Typography (see references/fonts.md)
3. Tone and voice (see references/voice.md)

Run validation: `tsx scripts/validate-colors.ts <file>`

## Color Palette

Primary: #0066CC
Secondary: #FF6600
```

### 3. Add Validation Script

```typescript
// scripts/validate-colors.ts
import fs from 'fs';

const ALLOWED_COLORS = ['#0066CC', '#FF6600', '#333333'];

const file = process.argv[2];
const content = fs.readFileSync(file, 'utf-8');

const colorRegex = /#[0-9A-Fa-f]{6}/g;
const colors = content.match(colorRegex) || [];

const invalid = colors.filter(c => !ALLOWED_COLORS.includes(c.toUpperCase()));

if (invalid.length > 0) {
  console.log(`❌ Invalid colors found: ${invalid.join(', ')}`);
  process.exit(1);
}

console.log('✅ All colors valid');
```

### 4. Add to Server Configuration

```typescript
const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      enabled: true,
      sources: [
        { type: 'local', path: './skills/brand-guidelines' }
      ]
    }
  }
});
```

### 5. Validate Skill

```typescript
const validation = await client.agents.validateSkill.query({
  skillId: 'brand-guidelines',
  source: './skills/brand-guidelines'
});

console.log(validation);
// {
//   valid: true,
//   metrics: { level1Tokens: 92, level2Tokens: 345, ... },
//   recommendations: ['Add table of contents for references/']
// }
```

## Migration Path

### From Claude Code

Existing Claude Code skills work with minimal changes:

1. **Compatible**: Existing SKILL.md files work as-is
2. **Enhanced**: Add sandbox config via frontmatter
3. **Flexible**: Choose any AI provider (not just Anthropic)
4. **Portable**: Skills work across different AI backends

### Migration Steps

1. Copy skill directory to new location
2. Add `scripts` and `allowedPaths` to frontmatter if using scripts
3. Test with Vercel AI SDK providers
4. Validate using dev panel
5. Deploy

## Security Considerations

1. **No Network Access**: Scripts cannot make HTTP requests
2. **Path Restrictions**: Only workspace and temp directories accessible
3. **Timeout Protection**: Scripts auto-terminate after 30s
4. **Memory Limits**: Prevent resource exhaustion
5. **Validation**: All skills validated before loading
6. **Sandboxing**: OS-level isolation for script execution
7. **License Checking**: Optional license validation for compliance

## Performance

- **Lazy Loading**: Resources loaded only when needed
- **Caching**: Parsed skills cached in memory
- **Streaming**: Large files streamed, not loaded entirely
- **Parallel**: Multiple skills loaded concurrently
- **Smart Matching**: Efficient skill selection algorithm
- **Token Optimization**: Progressive disclosure minimizes context usage

## Testing

```typescript
// test/agents/skills.test.ts
describe('Agent Skills System', () => {
  it('loads skill from local directory', async () => {
    const loader = new SkillLoader();
    const skill = await loader.load({
      type: 'local',
      path: './test/fixtures/sample-skill'
    });

    expect(skill.name).toBe('sample-skill');
    expect(skill.level1Tokens).toBeLessThan(100);
  });

  it('validates skill structure', async () => {
    const validator = new SkillValidator();
    const result = await validator.validate(skill);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('executes script in sandbox', async () => {
    const sandbox = new ScriptSandbox();
    const result = await sandbox.execute({
      script: 'scripts/validate.py',
      runtime: 'python',
      timeout: 5000
    });

    expect(result.exitCode).toBe(0);
  });
});
```

## Documentation

- Architecture: `specs/architecture.md` (Agent Skills section)
- API Reference: `docs/agents/skills-api.md`
- Examples: `examples/04-agent-skills/`
- Best Practices: `docs/agents/skills-best-practices.md`

## Future Enhancements

1. **Skill Marketplace**: Central repository of community skills
2. **Auto-Update**: Automatic skill version updates
3. **Analytics**: Skill usage tracking and optimization
4. **IDE Integration**: VS Code skill management UI
5. **Cloud Skills**: Shared skills across team/organization
6. **Skill Composition**: Combine multiple skills into workflows
7. **Hot Reload**: Update skills without server restart
8. **Skill Templates**: Starter templates for common patterns

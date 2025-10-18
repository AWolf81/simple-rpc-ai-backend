---
name: brand-guidelines
description: Apply consistent brand guidelines to content including colors, fonts, tone, and messaging
version: 1.0.0
author: Example Team
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

## Usage

Validate colors in files:
```bash
tsx scripts/validate-colors.ts /workspace/landing-page.html
```

## Approved Colors

- Brand Blue: `#0066CC`
- Brand Orange: `#FF6600`
- Dark Gray: `#333333`
- White: `#FFFFFF`

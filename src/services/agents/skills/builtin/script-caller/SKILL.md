---
name: script-caller
description: Run workspace scripts with sandboxed runtimes (JavaScript, TypeScript, Python).
version: 1.0.0
author: Simple RPC AI Backend Team
license: MIT
capabilities:
  - script-execution
  - developer-automation
scripts:
  - path: scripts/run-script.ts
    runtime: typescript
    description: Execute a workspace script with the requested runtime (javascript, typescript, python)
---

## Usage

Provide a `scriptInvocation` object describing the script to execute. This field is required for the script-caller skill. The runner infers the runtime from the extension when omitted and streams stdout/stderr back to the caller.

### Example (path execution)

```typescript
await trpc.agents.skills.executeScript.mutation({
  skillId: 'script-caller',
  scriptInvocation: {
    mode: 'path',                   // Read an existing file from the sandbox
    scriptPath: './scripts/demo.py', // Relative to project root
    runtime: 'python',              // Optional; inferred from extension when omitted
    args: ['--dry-run']             // Optional CLI arguments forwarded to the script
  }
});
```

### Runtime inference

- `.js`, `.mjs`, `.cjs` → `node`
- `.ts`, `.tsx` → `npx tsx`
- `.py` → `python3`

`scriptName` should be omitted when using this skill—the server automatically targets the internal runner script.

### Tool invocation (AI agents)

- Tool identifier: `script-caller_run-script`
- Always pass a JSON payload through `stdin`:
  ```json
  {
    "mode": "path",
    "scriptPath": "./scripts/demo.py",
    "runtime": "python",
    "args": ["--dry-run"]
  }
  ```
- Inline snippets use:
  ```json
  {
    "mode": "inline",
    "runtime": "python",
    "source": "print('Hello world')"
  }
  ```
- Do **not** echo the raw JSON back to the user—summarize what was run and highlight key stdout/stderr lines instead.

### Inline snippets

Run quick experiments without creating a file by switching to inline mode:

```typescript
await trpc.agents.skills.executeScript.mutation({
  skillId: 'script-caller',
  scriptInvocation: {
    mode: 'inline',
    runtime: 'python',
    source: `print("Hello world")\nprint("from inline")`,
    args: []
  }
});
```

Inline snippets require specifying the runtime explicitly. The source is written to a temporary file inside the sandbox before execution, and any `args` are forwarded to the runtime unchanged.

## Dependency Management

Installing packages on the fly (`pip install`, `npm install`, etc.) is intentionally unsupported to keep sandbox runs deterministic and fast. Recommended approaches:

- Vendor the dependencies or pre-build artifacts into the repository or workspace.
- Prepare bespoke scripts that rely only on standard libraries or existing project dependencies.
- Use dedicated tooling outside the sandbox to manage virtual environments, then point the runner at the prepared entry points.

## Best-Fit Scenarios

- Smoke-test a helper function or snippet the AI just generated.
- Run focused maintenance scripts (data migrations, log scrapers) without launching the full application.
- Compare the behaviour of multiple implementations by swapping the target script and arguments.

For long-running services or interactive REPLs, create a custom skill that manages lifecycle and state explicitly; the script-caller is optimized for short-lived executions.

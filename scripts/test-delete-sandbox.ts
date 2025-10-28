import { ScriptSandbox, DEFAULT_SANDBOX_CONFIG } from '../src/services/agents/skills/sandbox';
import path from 'path';

async function main() {
  const sandbox = new ScriptSandbox({
    ...DEFAULT_SANDBOX_CONFIG,
    allowedPaths: [process.cwd(), '/tmp'],
    allowedReadPaths: [process.cwd(), '/tmp'],
    allowedWritePaths: [process.cwd(), '/tmp'],
    projectRoot: process.cwd()
  } as any);

  const result = await sandbox.execute({
    scriptPath: path.join(process.cwd(), 'src/services/agents/skills/builtin/file-handling/scripts/delete.ts'),
    runtime: 'typescript',
    args: ['/tmp/test_delete_approval_v2.md']
  });

  console.log(result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

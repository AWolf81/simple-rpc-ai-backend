import { spawnSync } from 'child_process';

export type NodePackageRunner = {
  command: string;
  args: string[];
  runner: 'npx' | 'npm-exec';
};

let cachedRunner: NodePackageRunner | null = null;

function commandExists(command: string, args: string[] = ['--version']): boolean {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });

  if (result.error) {
    return false;
  }

  // npm exec --version exits with code 0 but prints usage; treat 0 as success
  return result.status === 0;
}

export function resolveNodePackageRunner(preferred?: 'npx' | 'npm-exec'): NodePackageRunner {
  if (cachedRunner && !preferred) {
    return { ...cachedRunner };
  }

  const hasNpx = commandExists('npx');
  const hasNpm = commandExists('npm', ['--version']);

  if (preferred === 'npx' && hasNpx) {
    cachedRunner = { command: 'npx', args: [], runner: 'npx' };
    return { ...cachedRunner };
  }

  if (preferred === 'npm-exec' && hasNpm) {
    return { command: 'npm', args: ['exec'], runner: 'npm-exec' };
  }

  if (hasNpx) {
    cachedRunner = { command: 'npx', args: [], runner: 'npx' };
    return { ...cachedRunner };
  }

  if (hasNpm) {
    cachedRunner = { command: 'npm', args: ['exec'], runner: 'npm-exec' };
    return { ...cachedRunner };
  }

  throw new Error('Neither npx nor npm exec is available on PATH. Install npm 7+ to use npm exec.');
}

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

type SupportedRuntime = 'javascript' | 'typescript' | 'python';

type InvocationPayload =
  | {
      mode: 'path';
      scriptPath: string;
      runtime?: SupportedRuntime;
      args?: string[];
    }
  | {
      mode: 'inline';
      runtime: SupportedRuntime;
      source: string;
      args?: string[];
    };

interface ScriptInvocation {
  runtime: SupportedRuntime;
  scriptPath: string;
  scriptArgs: string[];
  cleanupDir?: string;
}

const SUPPORTED_RUNTIMES: SupportedRuntime[] = ['javascript', 'typescript', 'python'];

async function main(): Promise<void> {
  const stdinPayload = await readInvocationFromStdin();
  const cliTokens = process.argv.slice(2);

  if (!stdinPayload && cliTokens.length === 0) {
    printUsage();
    process.exit(1);
  }

  let cleanupDir: string | undefined;

  try {
    const invocation = stdinPayload
      ? await buildInvocationFromPayload(stdinPayload)
      : await buildInvocationFromArgs(cliTokens);

    cleanupDir = invocation.cleanupDir;

    const { command, args } = buildCommand(invocation.runtime, invocation.scriptPath, invocation.scriptArgs);

    console.log(`🔧 script-caller: running ${invocation.runtime} script "${invocation.scriptPath}"`);

    await execute(command, args);
  } finally {
    if (cleanupDir) {
      await cleanupTemporaryDir(cleanupDir);
    }
  }
}

async function readInvocationFromStdin(): Promise<InvocationPayload | undefined> {
  if (process.stdin.isTTY) {
    return undefined;
  }

  process.stdin.setEncoding('utf-8');
  const chunks: string[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = chunks.join('').trim();

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as InvocationPayload | undefined;
    if (!parsed || typeof parsed !== 'object' || !('mode' in parsed)) {
      throw new Error('Invalid payload');
    }
    return normalizeInvocationPayload(parsed);
  } catch (error) {
    console.error('Failed to parse script invocation payload from stdin:', error);
    process.exit(1);
    return undefined;
  }
}

function normalizeInvocationPayload(payload: InvocationPayload): InvocationPayload {
  if (payload.mode === 'path') {
    return {
      mode: 'path',
      scriptPath: payload.scriptPath,
      runtime: payload.runtime ? normalizeRuntime(payload.runtime) : undefined,
      args: payload.args ?? []
    };
  }

  return {
    mode: 'inline',
    runtime: normalizeRuntime(payload.runtime),
    source: payload.source,
    args: payload.args ?? []
  };
}

async function buildInvocationFromPayload(payload: InvocationPayload): Promise<ScriptInvocation> {
  if (payload.mode === 'path') {
    const scriptPath = path.resolve(payload.scriptPath);
    await ensureScriptExists(scriptPath);
    const runtime = payload.runtime ?? detectRuntime(scriptPath);
    return {
      runtime,
      scriptPath,
      scriptArgs: payload.args ?? []
    };
  }

  const { dir, scriptPath } = await createInlineScript(payload.source, payload.runtime);

  return {
    runtime: payload.runtime,
    scriptPath,
    scriptArgs: payload.args ?? [],
    cleanupDir: dir
  };
}

async function buildInvocationFromArgs(tokens: string[]): Promise<ScriptInvocation> {
  const args = [...tokens];
  let mode: 'file' | 'inline' = 'file';

  if (args[0] === '--inline' || args[0] === '-i') {
    mode = 'inline';
    args.shift();
  }

  if (mode === 'inline') {
    if (args.length < 2) {
      console.error('Inline mode requires a runtime and a source string.');
      printUsage();
      process.exit(1);
    }

    const runtimeToken = args.shift()!;
    const runtime = normalizeRuntime(runtimeToken);
    const inlineSource = args.shift();

    if (inlineSource === undefined) {
      console.error('Inline mode expects the script source as the next argument.');
      printUsage();
      process.exit(1);
    }

    const { dir, scriptPath } = await createInlineScript(inlineSource, runtime);

    return {
      runtime,
      scriptPath,
      scriptArgs: args,
      cleanupDir: dir
    };
  }

  const rawScriptPath = args.shift();
  if (!rawScriptPath) {
    printUsage();
    process.exit(1);
  }

  const scriptPath = path.resolve(rawScriptPath);
  await ensureScriptExists(scriptPath);

  let runtime: SupportedRuntime;
  if (args.length > 0 && isSupportedRuntime(args[0])) {
    runtime = normalizeRuntime(args.shift()!);
  } else {
    runtime = detectRuntime(scriptPath);
  }

  return {
    runtime,
    scriptPath,
    scriptArgs: args
  };
}

async function ensureScriptExists(scriptPath: string): Promise<void> {
  try {
    await fs.access(scriptPath);
  } catch {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }
}

function detectRuntime(scriptPath: string): SupportedRuntime {
  const ext = path.extname(scriptPath).toLowerCase();

  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.py':
      return 'python';
    default:
      return 'javascript';
  }
}

function isSupportedRuntime(value: string): boolean {
  return SUPPORTED_RUNTIMES.includes(value.toLowerCase() as SupportedRuntime);
}

function normalizeRuntime(value: string): SupportedRuntime {
  const normalized = value.toLowerCase();
  if (!isSupportedRuntime(normalized)) {
    console.error(`Unsupported runtime "${value}". Expected one of: ${SUPPORTED_RUNTIMES.join(', ')}`);
    process.exit(1);
  }
  return normalized as SupportedRuntime;
}

async function createInlineScript(
  source: string,
  runtime: SupportedRuntime
): Promise<{ dir: string; scriptPath: string }> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'script-caller-'));
  const extension = runtime === 'python' ? '.py' : runtime === 'typescript' ? '.ts' : '.js';
  const scriptPath = path.join(dir, `inline${extension}`);

  await fs.writeFile(scriptPath, source, 'utf-8');

  return { dir, scriptPath };
}

function buildCommand(
  runtime: SupportedRuntime,
  scriptPath: string,
  scriptArgs: string[]
): { command: string; args: string[] } {
  switch (runtime) {
    case 'python':
      return { command: 'python3', args: [scriptPath, ...scriptArgs] };
    case 'typescript':
      return { command: 'npx', args: ['tsx', scriptPath, ...scriptArgs] };
    case 'javascript':
    default:
      return { command: 'node', args: [scriptPath, ...scriptArgs] };
  }
}

function execute(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', error => {
      console.error(`Failed to start command "${command}":`, error);
      reject(error);
    });

    child.on('close', code => {
      if (code && code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function cleanupTemporaryDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`⚠️  Failed to clean up temporary directory "${dir}":`, error);
  }
}

function printUsage(): void {
  console.error(
    [
      'Usage:',
      '  run-script <scriptPath> [runtime] [...args]',
      '  run-script --inline <runtime> <source> [...args]',
      '',
      'When invoked via scriptInvocation (preferred):',
      '  mode: "path" | "inline"',
      '  scriptPath / source: target script or inline snippet',
      '  runtime: javascript | typescript | python',
      '  args: additional CLI arguments',
      ''
    ].join('\n')
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

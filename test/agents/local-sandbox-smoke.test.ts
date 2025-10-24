/**
 * LocalSandboxProvider smoke tests for Ubuntu/Linux environments.
 *
 * These tests exercise core isolation guarantees:
 *  - Read/write restrictions
 *  - Network egress blocking
 *  - Script path validation
 *
 * NOTE: Network access and Node permission enforcement rely on Node >= 20
 *       and are currently validated only on Linux. Additional platform
 *       coverage (macOS, Windows/WSL) will be added via CI smoke jobs.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';
import { promises as fs } from 'fs';
import { LocalSandboxProvider } from '../../src/services/agents/skills/providers/local-sandbox';
import { getNodePermissionFlags } from '../../src/services/agents/skills/utils/node-permissions';

const isLinux = process.platform === 'linux';
const permissionFlags = getNodePermissionFlags();
const supportsNodePermissions = isLinux && Boolean(permissionFlags && permissionFlags.length);

describe.skipIf(!isLinux)('LocalSandboxProvider smoke (Linux)', () => {
  let workspaceDir: string;
  let scriptsDir: string;
  let writableDir: string;
  let provider: LocalSandboxProvider;

  const scripts: Record<string, string> = {};

  beforeAll(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'local-sandbox-smoke-'));
    scriptsDir = path.join(workspaceDir, 'scripts');
    writableDir = path.join(workspaceDir, 'tmp');

    await fs.mkdir(scriptsDir, { recursive: true });
    await fs.mkdir(writableDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'allowed.txt'), 'sandbox-ok');

    scripts.read = path.join(scriptsDir, 'read-file.js');
    scripts.write = path.join(scriptsDir, 'write-file.js');
    scripts.net = path.join(scriptsDir, 'network-check.js');

    await fs.writeFile(
      scripts.read,
      `
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const target = process.argv[2];
const outputDir = process.argv[3];

try {
  const content = readFileSync(target, 'utf-8');
  const outputPath = path.join(outputDir, 'read-result.txt');
  writeFileSync(outputPath, content);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('READ_ERROR', message);
  process.exit(1);
}
`.trimStart()
    );

    await fs.writeFile(
      scripts.write,
      `
const { writeFileSync } = require('fs');

const target = process.argv[2];

try {
  writeFileSync(target, 'forbidden');
  console.log('WRITE_OK');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('WRITE_BLOCKED', message);
  process.exit(1);
}
`.trimStart()
    );

    await fs.writeFile(
      scripts.net,
      `
const target = process.argv[2] || 'https://example.com';

(async () => {
try {
  const response = await fetch(target, { signal: AbortSignal.timeout(2000) });
  console.log('NETWORK_STATUS', response.status);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('NETWORK_BLOCKED', message);
  process.exit(1);
}
})();
`.trimStart()
    );

    provider = new LocalSandboxProvider({
      allowedPaths: [workspaceDir, writableDir],
      allowedReadPaths: [workspaceDir],
      allowedWritePaths: [writableDir],
      timeout: 4000,
      maxMemory: 64 * 1024 * 1024,
      networkAccess: false,
      allowedEnvVars: ['PATH', 'HOME', 'USER', 'TMPDIR', 'TMP', 'PWD'],
      monitorViolations: false,
      environmentVars: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        USER: process.env.USER ?? '',
        TMPDIR: process.env.TMPDIR ?? tmpdir(),
        TMP: process.env.TMP ?? tmpdir(),
        PWD: workspaceDir
      }
    });

    await provider.initialize({
      allowedPaths: [workspaceDir, writableDir],
      allowedReadPaths: [workspaceDir],
      allowedWritePaths: [writableDir],
      timeout: 4000,
      maxMemory: 64 * 1024 * 1024,
      networkAccess: false,
      allowedEnvVars: ['PATH', 'HOME', 'USER', 'TMPDIR', 'TMP', 'PWD'],
      monitorViolations: false,
      environmentVars: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        USER: process.env.USER ?? '',
        TMPDIR: process.env.TMPDIR ?? tmpdir(),
        TMP: process.env.TMP ?? tmpdir(),
        PWD: workspaceDir
      }
    });
  });

  afterAll(async () => {
    if (provider) {
      await provider.shutdown();
    }
    if (workspaceDir) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('executes JavaScript inside the allowed workspace', async () => {
    const result = await provider.execute({
      scriptPath: scripts.read,
      runtime: 'javascript',
      args: [path.join(workspaceDir, 'allowed.txt'), writableDir],
      cwd: workspaceDir
    });

    expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(0);
    expect(result.timedOut, JSON.stringify(result, null, 2)).toBe(false);
    const output = await fs.readFile(path.join(writableDir, 'read-result.txt'), 'utf-8');
    expect(output.trim()).toBe('sandbox-ok');
  });

  const isolationTest = supportsNodePermissions ? it : it.skip;

  isolationTest('denies reading files outside allowed paths', async () => {
    const result = await provider.execute({
      scriptPath: scripts.read,
      runtime: 'javascript',
      args: ['/etc/passwd', writableDir],
      cwd: workspaceDir
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/READ_ERROR/i);
    expect(result.stderr).toMatch(/denied|restricted|allow/i);
  });

  isolationTest('blocks writes outside allowed write paths', async () => {
    const forbiddenPath = path.join(workspaceDir, 'forbidden.txt');

    const result = await provider.execute({
      scriptPath: scripts.write,
      runtime: 'javascript',
      args: [forbiddenPath],
      cwd: workspaceDir
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/WRITE_BLOCKED/i);

    await expect(fs.access(forbiddenPath)).rejects.toThrow();
  });

  isolationTest('prevents outbound network access by default', async () => {
    const result = await provider.execute({
      scriptPath: scripts.net,
      runtime: 'javascript',
      args: ['https://example.com'],
      cwd: workspaceDir
    });

    expect(result.exitCode).not.toBe(0);
    const networkErrorOutput = (result.stderr || '') + (result.stdout || '');
    expect(networkErrorOutput).toMatch(/(fetch failed|ENOTFOUND|EAI_AGAIN|network|blocked)/i);
  });

  isolationTest('rejects scripts located outside allowedPaths', async () => {
    const outsideScript = path.join(tmpdir(), 'outside-sandbox-script.js');
    await fs.writeFile(outsideScript, 'console.log("outside");');

    try {
      await expect(
        provider.execute({
          scriptPath: outsideScript,
          runtime: 'javascript',
          cwd: workspaceDir
        })
      ).rejects.toThrow(/outside allowed paths/i);
    } finally {
      await fs.rm(outsideScript, { force: true });
    }
  });
});

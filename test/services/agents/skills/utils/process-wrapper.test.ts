import path from 'path';
import os from 'os';
import {
  chmodSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { SandboxConfig } from '../../../../../src/services/agents/skills/types';
import {
  augmentSandboxForCommand,
  wrapSkillCommandWithBwrap
} from '../../../../../src/services/agents/skills/utils/process-wrapper';

// Mock must be defined inline in the factory to avoid hoisting issues
vi.mock('../../../../../src/utils/bwrap-runner', () => ({
  wrapCommandWithBwrap: vi.fn()
}));

// Import the mocked function after the mock definition
import { wrapCommandWithBwrap } from '../../../../../src/utils/bwrap-runner';

const createdDirs: string[] = [];

const createSandbox = (overrides: Partial<SandboxConfig> = {}): SandboxConfig => ({
  allowedPaths: ['/workspace', '/tmp'],
  allowedReadPaths: ['/workspace', '/opt/shared'],
  allowedWritePaths: ['/workspace', '/tmp/runtime'],
  timeout: 1000,
  maxMemory: 64 * 1024 * 1024,
  networkAccess: false,
  allowedNetworkHosts: [],
  blockedNetworkHosts: [],
  allowedUnixSockets: [],
  allowChildProcesses: false,
  allowedEnvVars: [],
  monitorViolations: false,
  environmentVars: {},
  ...overrides
});

describe('process-wrapper utilities', () => {
  beforeEach(() => {
    vi.mocked(wrapCommandWithBwrap).mockReset();
    vi.mocked(wrapCommandWithBwrap).mockImplementation((command: string, args: string[]) => ({
      command: 'bwrap',
      args: ['--', command, ...args]
    }));
  });

  afterEach(() => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it.skipIf(process.platform === 'win32')('resolves bare commands via PATH entries', () => {
    const sandbox = createSandbox();
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'process-wrapper-'));
    createdDirs.push(tempDir);

    const commandPath = path.join(tempDir, 'mycmd');
    writeFileSync(commandPath, '#!/bin/sh\n');
    chmodSync(commandPath, 0o755);

    const env = { PATH: `${tempDir}${path.delimiter}/usr/bin` };

    wrapSkillCommandWithBwrap({
      command: 'mycmd',
      args: [],
      cwd: tempDir,
      env,
      sandbox
    });

    expect(vi.mocked(wrapCommandWithBwrap)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(wrapCommandWithBwrap).mock.calls[0];
    expect(call[0]).toBe(path.resolve(commandPath));

    const options = call[2];
    expect(options.readOnlyPaths).toEqual(
      expect.arrayContaining([
        path.resolve(commandPath),
        path.resolve(tempDir)
      ])
    );
  });

  it('enables registry network access for npx', () => {
    const sandbox = createSandbox();
    const updated = augmentSandboxForCommand(sandbox, 'npx');

    expect(updated).not.toBe(sandbox);
    expect(updated.networkAccess).toBe(true);
    expect(updated.allowedNetworkHosts).toEqual(
      expect.arrayContaining(['registry.npmjs.org', 'registry.npmjs.org:443'])
    );
    expect(sandbox.networkAccess).toBe(false);
    expect(sandbox.allowedNetworkHosts).toHaveLength(0);
  });

  it('leaves sandbox untouched for safe commands', () => {
    const sandbox = createSandbox();
    const updated = augmentSandboxForCommand(sandbox, 'python3');
    expect(updated).toBe(sandbox);
  });

  it('wraps commands with bwrap using sandbox paths', () => {
    const sandbox = createSandbox({ networkAccess: true });
    const env = { PATH: '/usr/bin' };

    const result = wrapSkillCommandWithBwrap({
      command: '/usr/bin/python3',
      args: ['script.py'],
      cwd: '/workspace/app',
      env,
      sandbox
    });

    expect(result).toEqual({ command: 'bwrap', args: ['--', '/usr/bin/python3', 'script.py'] });
    expect(vi.mocked(wrapCommandWithBwrap)).toHaveBeenCalledTimes(1);

    const call = vi.mocked(wrapCommandWithBwrap).mock.calls[0];
    expect(call[0]).toBe('/usr/bin/python3');
    expect(call[1]).toEqual(['script.py']);
    expect(call[2]).toMatchObject({
      cwd: '/workspace/app',
      env,
      allowNetwork: true
    });

    const options = call[2];
    expect(options.writablePaths).toEqual(
      [path.resolve('/workspace'), path.resolve('/tmp/runtime')]
    );
    expect(options.readOnlyPaths).toEqual(
      expect.arrayContaining([
        path.resolve('/opt/shared'),
        path.resolve('/usr/bin'),
        path.resolve('/usr/bin/python3')
      ])
    );
  });
});

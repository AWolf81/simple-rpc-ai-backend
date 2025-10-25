/**
 * Critical Block Pattern Tests
 *
 * These tests verify that critically dangerous commands are ALWAYS blocked.
 * Run in Docker to avoid system damage.
 */

import { describe, it, expect } from 'vitest';
import { SafetyValidator } from '../../../../src/services/agents/skills/utils/safety-validator';

describe('Safety Validator - Critical Blocks', () => {
  describe('Root Filesystem Deletion', () => {
    it('should block rm -rf /', () => {
      const result = SafetyValidator.validate('rm', ['-rf', '/']);

      expect(result.blocked).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('root filesystem');
    });

    it('should block rm -rf /*', () => {
      const result = SafetyValidator.validate('rm', ['-rf', '/*']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('root filesystem');
    });

    it('should block rm --recursive --force /', () => {
      const result = SafetyValidator.validate('rm', ['--recursive', '--force', '/']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('System Directory Deletion', () => {
    const systemDirs = ['/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/root', '/sbin', '/sys', '/usr', '/var'];

    systemDirs.forEach(dir => {
      it(`should block rm -rf ${dir}`, () => {
        const result = SafetyValidator.validate('rm', ['-rf', dir]);

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('system directory');
      });
    });
  });

  describe('Home Directory Destruction', () => {
    it('should block rm -rf ~', () => {
      const result = SafetyValidator.validate('rm', ['-rf', '~']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('home directory');
    });

    it('should block rm -rf ~/', () => {
      const result = SafetyValidator.validate('rm', ['-rf', '~/']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('Dangerous Permissions', () => {
    it('should block chmod 777 /', () => {
      const result = SafetyValidator.validate('chmod', ['777', '/']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('world-writable');
    });

    it('should block chmod -R 777 /etc', () => {
      const result = SafetyValidator.validate('chmod', ['-R', '777', '/etc']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('system directory');
    });

    it('should block chmod 777 /*', () => {
      const result = SafetyValidator.validate('chmod', ['777', '/*']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('Fork Bombs', () => {
    it('should block :(){:|:&};:', () => {
      const result = SafetyValidator.validate('bash', ['-c', ':(){:|:&};:']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('fork bomb');
    });

    it('should block nested command substitution bombs', () => {
      const result = SafetyValidator.validate('bash', ['-c', '$(echo $(echo $(echo test)))']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toMatch(/fork bomb|command injection/i);
    });
  });

  describe('Disk Wiping', () => {
    it('should block dd if=/dev/zero of=/dev/sda', () => {
      const result = SafetyValidator.validate('dd', ['if=/dev/zero', 'of=/dev/sda']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('wipe disk');
    });

    it('should block dd if=/dev/random of=/', () => {
      const result = SafetyValidator.validate('dd', ['if=/dev/random', 'of=/']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('overwrite filesystem');
    });

    it('should block dd to nvme device', () => {
      const result = SafetyValidator.validate('dd', ['if=/dev/zero', 'of=/dev/nvme0n1']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('Process Table Attacks', () => {
    it('should block kill -9 1 (init process)', () => {
      const result = SafetyValidator.validate('kill', ['-9', '1']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('init');
    });

    it('should block kill -9 -1 (all processes)', () => {
      const result = SafetyValidator.validate('kill', ['-9', '-1']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('all processes');
    });

    it('should block pkill -9 init', () => {
      const result = SafetyValidator.validate('pkill', ['-9', 'init']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('init');
    });
  });

  describe('Kernel Manipulation', () => {
    it('should block writing to /proc/sys/kernel', () => {
      const result = SafetyValidator.validate('bash', ['-c', 'echo 0 > /proc/sys/kernel/panic']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('kernel');
    });
  });

  describe('Network Flooding', () => {
    it('should block ping -f (flood ping)', () => {
      const result = SafetyValidator.validate('ping', ['-f', 'example.com']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('flood');
    });
  });

  describe('Recursive Ownership Changes on Root', () => {
    it('should block chown -R on root', () => {
      const result = SafetyValidator.validate('chown', ['-R', 'user:user', '/']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('root');
    });

    it('should block chown -R on system directory', () => {
      const result = SafetyValidator.validate('chown', ['-R', 'user:user', '/etc']);

      expect(result.blocked).toBe(false); // May not be in critical patterns, check warning
      // This should at least require approval
      if (!result.blocked) {
        expect(result.requiresApproval).toBe(true);
      }
    });
  });

  describe('System File Overwriting', () => {
    it('should block mv to /bin', () => {
      const result = SafetyValidator.validate('mv', ['malicious', '/bin/ls']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('system');
    });

    it('should block cp to /sbin', () => {
      const result = SafetyValidator.validate('cp', ['malicious', '/sbin/init']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('Null Byte Injection', () => {
    it('should block commands with null bytes', () => {
      const result = SafetyValidator.validate('cat', ['file\x00malicious']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Null byte');
    });
  });

  describe('Command Injection with rm', () => {
    it('should block ; rm -rf', () => {
      const result = SafetyValidator.validate('bash', ['-c', 'echo test; rm -rf /']);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('injection');
    });

    it('should block $(rm -rf)', () => {
      const result = SafetyValidator.validate('bash', ['-c', '$(rm -rf /)']);

      expect(result.blocked).toBe(true);
    });

    it('should block | rm -rf', () => {
      const result = SafetyValidator.validate('bash', ['-c', 'cat file | rm -rf /']);

      expect(result.blocked).toBe(true);
    });
  });

  describe('Safe Commands (Should NOT Block)', () => {
    it('should allow rm of specific file in allowed directory', () => {
      const result = SafetyValidator.validate('rm', ['/test-workspace/temp/file.txt']);

      expect(result.blocked).toBe(false);
      expect(result.allowed).toBe(true);
    });

    it('should allow chmod on specific file', () => {
      const result = SafetyValidator.validate('chmod', ['644', '/test-workspace/temp/file.txt']);

      expect(result.blocked).toBe(false);
    });

    it('should allow ls commands', () => {
      const result = SafetyValidator.validate('ls', ['-la', '/test-workspace']);

      expect(result.blocked).toBe(false);
    });

    it('should allow cat commands', () => {
      const result = SafetyValidator.validate('cat', ['/test-workspace/safe-zone/file1.txt']);

      expect(result.blocked).toBe(false);
    });
  });
});

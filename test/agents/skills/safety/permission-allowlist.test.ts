/**
 * Permission Allowlist Tests
 *
 * Tests the Claude Code-style permission system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionAllowlist } from '../../../../src/services/agents/skills/utils/permission-allowlist';

describe('Permission Allowlist', () => {
  describe('Exact Match', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: ['Bash(ls -la)', 'Bash(pwd)'],
        deny: [],
        ask: []
      });
    });

    it('should allow exact match', () => {
      const result = allowlist.check('Bash(ls -la)');

      expect(result.result).toBe('allow');
      expect(result.matched).toBe(true);
      expect(result.matchedPattern).toBe('Bash(ls -la)');
    });

    it('should not allow non-exact match', () => {
      const result = allowlist.check('Bash(ls -l)');

      expect(result.result).toBe('ask');
      expect(result.matched).toBe(false);
    });
  });

  describe('Wildcard Match', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: [
          'Bash(pnpm build:*)',
          'Bash(npm run *)',
          'Bash(git add:*)'
        ],
        deny: [],
        ask: []
      });
    });

    it('should allow wildcard match - pnpm build:cjs', () => {
      const result = allowlist.check('Bash(pnpm build:cjs)');

      expect(result.result).toBe('allow');
      expect(result.matched).toBe(true);
    });

    it('should allow wildcard match - pnpm build:esm', () => {
      const result = allowlist.check('Bash(pnpm build:esm)');

      expect(result.result).toBe('allow');
    });

    it('should allow wildcard match - npm run test', () => {
      const result = allowlist.check('Bash(npm run test)');

      expect(result.result).toBe('allow');
    });

    it('should not allow different command', () => {
      const result = allowlist.check('Bash(pnpm test)');

      expect(result.result).toBe('ask');
    });
  });

  describe('Glob Pattern Match', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: [
          'Read(/test-workspace/**)',
          'Read(/tmp/**)',
          'Write(/test-workspace/output/**)'
        ],
        deny: [],
        ask: []
      });
    });

    it('should allow glob match - nested path', () => {
      const result = allowlist.check('Read(/test-workspace/safe-zone/file1.txt)');

      expect(result.result).toBe('allow');
      expect(result.matched).toBe(true);
    });

    it('should allow glob match - deep nested', () => {
      const result = allowlist.check('Read(/test-workspace/a/b/c/d/file.txt)');

      expect(result.result).toBe('allow');
    });

    it('should allow glob match - tmp directory', () => {
      const result = allowlist.check('Read(/tmp/test/data.json)');

      expect(result.result).toBe('allow');
    });

    it('should not allow outside glob pattern', () => {
      const result = allowlist.check('Read(/etc/passwd)');

      expect(result.result).toBe('ask');
    });

    it('should allow write in allowed directory', () => {
      const result = allowlist.check('Write(/test-workspace/output/result.txt)');

      expect(result.result).toBe('allow');
    });

    it('should not allow write outside allowed directory', () => {
      const result = allowlist.check('Write(/test-workspace/safe-zone/file.txt)');

      expect(result.result).toBe('ask');
    });
  });

  describe('Domain Allowlist', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: [
          'WebFetch(domain:github.com)',
          'WebFetch(domain:*.api.example.com)'
        ],
        deny: [],
        ask: []
      });
    });

    it('should allow exact domain match', () => {
      const result = allowlist.check('WebFetch(domain:github.com)');

      expect(result.result).toBe('allow');
      expect(result.matched).toBe(true);
    });

    it('should allow wildcard subdomain match', () => {
      const result = allowlist.check('WebFetch(domain:v1.api.example.com)');

      expect(result.result).toBe('allow');
    });

    it('should not allow different domain', () => {
      const result = allowlist.check('WebFetch(domain:malicious.com)');

      expect(result.result).toBe('ask');
    });
  });

  describe('Deny List Override', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: ['Bash(rm:*)'],
        deny: ['Bash(rm -rf /*)'],
        ask: []
      });
    });

    it('should allow safe rm command', () => {
      const result = allowlist.check('Bash(rm:/test-workspace/temp/file.txt)');

      expect(result.result).toBe('allow');
    });

    it('should deny dangerous rm command (deny overrides allow)', () => {
      const result = allowlist.check('Bash(rm -rf /*)');

      expect(result.result).toBe('deny');
      expect(result.matched).toBe(true);
      expect(result.reason).toContain('denied');
    });

    it('should deny even with wildcard in allow', () => {
      const result = allowlist.check('Bash(rm -rf /test)');

      expect(result.result).toBe('deny');
    });
  });

  describe('Ask List', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: ['Bash(pnpm build)'],
        deny: [],
        ask: ['Bash(pnpm add *)', 'Bash(pnpm remove *)']
      });
    });

    it('should allow commands in allow list', () => {
      const result = allowlist.check('Bash(pnpm build)');

      expect(result.result).toBe('allow');
    });

    it('should require approval for commands in ask list', () => {
      const result = allowlist.check('Bash(pnpm add express)');

      expect(result.result).toBe('ask');
      expect(result.matched).toBe(true);
      expect(result.matchedPattern).toBe('Bash(pnpm add *)');
    });

    it('should require approval for remove commands', () => {
      const result = allowlist.check('Bash(pnpm remove lodash)');

      expect(result.result).toBe('ask');
      expect(result.matched).toBe(true);
    });

    it('should require approval for unmatched commands', () => {
      const result = allowlist.check('Bash(pnpm test)');

      expect(result.result).toBe('ask');
      expect(result.matched).toBe(false);
      expect(result.reason).toContain('No matching permission');
    });
  });

  describe('Priority Order: Deny > Ask > Allow', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: ['Bash(*)'],  // Allow everything
        deny: ['Bash(rm -rf *)'],  // Deny dangerous rm
        ask: ['Bash(rm *)']  // Ask for rm
      });
    });

    it('should deny first (highest priority)', () => {
      const result = allowlist.check('Bash(rm -rf /test)');

      expect(result.result).toBe('deny');
    });

    it('should ask second (medium priority)', () => {
      const result = allowlist.check('Bash(rm /test/file.txt)');

      expect(result.result).toBe('ask');
    });

    it('should allow last (lowest priority)', () => {
      const result = allowlist.check('Bash(ls -la)');

      expect(result.result).toBe('allow');
    });
  });

  describe('Dynamic Pattern Addition', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: [],
        deny: [],
        ask: []
      });
    });

    it('should add allow pattern dynamically', () => {
      allowlist.addAllowPattern('Bash(echo *)');

      const result = allowlist.check('Bash(echo hello)');
      expect(result.result).toBe('allow');
    });

    it('should add deny pattern dynamically', () => {
      allowlist.addDenyPattern('Bash(rm -rf *)');

      const result = allowlist.check('Bash(rm -rf /test)');
      expect(result.result).toBe('deny');
    });

    it('should add ask pattern dynamically', () => {
      allowlist.addAskPattern('Bash(git push *)');

      const result = allowlist.check('Bash(git push origin main)');
      expect(result.result).toBe('ask');
    });
  });

  describe('Permission Building and Parsing', () => {
    it('should build permission string', () => {
      const permission = PermissionAllowlist.buildPermission('Bash', 'ls -la');

      expect(permission).toBe('Bash(ls -la)');
    });

    it('should parse permission string', () => {
      const parsed = PermissionAllowlist.parsePermission('Bash(ls -la)');

      expect(parsed).toEqual({
        type: 'Bash',
        value: 'ls -la'
      });
    });

    it('should handle complex WebFetch permission', () => {
      const parsed = PermissionAllowlist.parsePermission('WebFetch(domain:api.github.com)');

      expect(parsed).toEqual({
        type: 'WebFetch',
        value: 'domain:api.github.com'
      });
    });

    it('should return null for invalid format', () => {
      const parsed = PermissionAllowlist.parsePermission('invalid-format');

      expect(parsed).toBeNull();
    });
  });

  describe('Real-World Examples', () => {
    let allowlist: PermissionAllowlist;

    beforeEach(() => {
      allowlist = new PermissionAllowlist({
        allow: [
          'Bash(pnpm build:*)',
          'Bash(pnpm test:*)',
          'Bash(git add:*)',
          'Bash(git commit:*)',
          'Bash(npm run build:*)',
          'Read(/home/user/project/**)',
          'Write(/home/user/project/dist/**)',
          'WebFetch(domain:github.com)',
          'WebFetch(domain:*.npmjs.org)'
        ],
        deny: [
          'Bash(rm -rf /)',
          'Bash(rm -rf /*)',
          'Bash(chmod 777 /)'
        ],
        ask: [
          'Bash(git push:*)',
          'Bash(pnpm add:*)',
          'Bash(pnpm remove:*)'
        ]
      });
    });

    it('should allow build command', () => {
      expect(allowlist.check('Bash(pnpm build:esm)').result).toBe('allow');
    });

    it('should allow test command', () => {
      expect(allowlist.check('Bash(pnpm test:unit)').result).toBe('allow');
    });

    it('should allow git add', () => {
      expect(allowlist.check('Bash(git add:src/)').result).toBe('allow');
    });

    it('should ask for git push', () => {
      const result = allowlist.check('Bash(git push:origin main)');
      expect(result.result).toBe('ask');
      expect(result.matched).toBe(true);
    });

    it('should ask for package add', () => {
      expect(allowlist.check('Bash(pnpm add:express)').result).toBe('ask');
    });

    it('should deny rm -rf /', () => {
      expect(allowlist.check('Bash(rm -rf /)').result).toBe('deny');
    });

    it('should allow reading project files', () => {
      expect(allowlist.check('Read(/home/user/project/src/index.ts)').result).toBe('allow');
    });

    it('should allow writing to dist', () => {
      expect(allowlist.check('Write(/home/user/project/dist/bundle.js)').result).toBe('allow');
    });

    it('should allow GitHub fetch', () => {
      expect(allowlist.check('WebFetch(domain:github.com)').result).toBe('allow');
    });

    it('should allow npm registry fetch', () => {
      expect(allowlist.check('WebFetch(domain:registry.npmjs.org)').result).toBe('allow');
    });
  });
});

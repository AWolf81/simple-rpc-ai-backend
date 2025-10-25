/**
 * Network Operation Safety Tests
 *
 * Verifies that POST/PUT/PATCH/DELETE require approval while GET is safe
 */

import { describe, it, expect } from 'vitest';
import { SafetyValidator } from '../../../../src/services/agents/skills/utils/safety-validator';

describe('Network Operation Safety', () => {
  describe('GET Requests (Safe - No Approval)', () => {
    it('should allow GET without approval', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'GET',
        'https://api.example.com/data',
        true
      );

      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(result.safetyLevel).toBe('low');
    });

    it('should allow HEAD without approval', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'HEAD',
        'https://api.example.com/health',
        true
      );

      expect(result.requiresApproval).toBe(false);
    });

    it('should allow OPTIONS without approval', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'OPTIONS',
        'https://api.example.com/cors',
        true
      );

      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('POST Requests (Requires Approval)', () => {
    it('should require approval for POST', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.example.com/data',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(true);
      expect(result.safetyLevel).toBe('medium');
      expect(result.warnings).toContain('⚠️  POST request to external server: https://api.example.com/data');
    });

    it('should warn about data modification', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.example.com/users',
        true
      );

      expect(result.warnings).toContain('⚠️  This operation may modify data on the remote server');
    });
  });

  describe('PUT Requests (Requires Approval)', () => {
    it('should require approval for PUT', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'PUT',
        'https://api.example.com/data/1',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.safetyLevel).toBe('medium');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH Requests (Requires Approval)', () => {
    it('should require approval for PATCH', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'PATCH',
        'https://api.example.com/data/1',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.safetyLevel).toBe('medium');
    });
  });

  describe('DELETE Requests (Requires Approval)', () => {
    it('should require approval for DELETE', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'DELETE',
        'https://api.example.com/data/1',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.safetyLevel).toBe('medium');
      expect(result.warnings).toContain('⚠️  DELETE request to external server: https://api.example.com/data/1');
    });
  });

  describe('Localhost Safety (Lower Risk)', () => {
    it('should warn but allow localhost POST', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://localhost:3000/api/data',
        true
      );

      expect(result.requiresApproval).toBe(true);
      // Should NOT have the external server warning
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });

    it('should recognize 127.0.0.1 as localhost', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://127.0.0.1:8080/api',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });

    it('should recognize ::1 as localhost (IPv6)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://[::1]:3000/api',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });
  });

  describe('Private IP Safety (Internal Network)', () => {
    it('should recognize 10.x.x.x as private IP', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://10.0.1.100:8000/api',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });

    it('should recognize 192.168.x.x as private IP', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://192.168.1.1:80/api',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });

    it('should recognize 172.16-31.x.x as private IP', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'http://172.20.0.1/api',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('non-localhost'))).toBe(false);
    });
  });

  describe('External Server Warnings', () => {
    it('should warn about external POST', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.github.com/repos/user/repo/issues',
        true
      );

      expect(result.warnings).toContain('⚠️  Request to external (non-localhost) server');
    });

    it('should warn about external PUT', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'PUT',
        'https://api.example.com/data/1',
        true
      );

      expect(result.warnings.some(w => w.includes('external'))).toBe(true);
    });

    it('should warn about external DELETE', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'DELETE',
        'https://api.example.com/data/1',
        true
      );

      expect(result.warnings.some(w => w.includes('external'))).toBe(true);
    });
  });

  describe('Disable Approval for Mutations (Testing Mode)', () => {
    it('should skip approval if disabled', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.example.com/data',
        false  // Disable approval
      );

      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
    });

    it('should skip approval for DELETE if disabled', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'DELETE',
        'https://api.example.com/data/1',
        false
      );

      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle lowercase method', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'post',
        'https://api.example.com/data',
        true
      );

      expect(result.requiresApproval).toBe(true);
    });

    it('should handle mixed case method', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'PoSt',
        'https://api.example.com/data',
        true
      );

      expect(result.requiresApproval).toBe(true);
    });

    it('should handle uppercase method', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.example.com/data',
        true
      );

      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should allow GitHub API GET (read repo info)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'GET',
        'https://api.github.com/repos/user/repo',
        true
      );

      expect(result.requiresApproval).toBe(false);
    });

    it('should require approval for GitHub API POST (create issue)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.github.com/repos/user/repo/issues',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should require approval for Stripe API POST (charge customer)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://api.stripe.com/v1/charges',
        true
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.safetyLevel).toBe('medium');
    });

    it('should require approval for database UPDATE (via API)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'PUT',
        'https://api.myapp.com/database/users/123',
        true
      );

      expect(result.requiresApproval).toBe(true);
    });

    it('should allow npm registry GET (fetch package info)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'GET',
        'https://registry.npmjs.org/express',
        true
      );

      expect(result.requiresApproval).toBe(false);
    });

    it('should require approval for npm publish (POST)', () => {
      const result = SafetyValidator.validateNetworkOperation(
        'POST',
        'https://registry.npmjs.org/my-package',
        true
      );

      expect(result.requiresApproval).toBe(true);
    });
  });
});

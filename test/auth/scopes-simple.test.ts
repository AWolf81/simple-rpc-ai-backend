import { describe, it, expect } from 'vitest';
import { createAdminMCPTool } from '../../src/auth/scopes';

describe('Scopes - createAdminMCPTool', () => {
  it('should create admin MCP tool with required config', () => {
    const tool = createAdminMCPTool({
      name: 'test_admin_tool',
      description: 'Test admin tool',
      adminUsers: ['admin@test.com']
    });
    
    expect(tool).toBeDefined();
    expect(tool.mcp).toBeDefined();
    expect(tool.mcp.name).toBe('test_admin_tool');
    expect(tool.mcp.description).toBe('Test admin tool');
    expect(tool.mcp.requireAdminUser).toBe(true);
    expect(tool.mcp.scopes).toBeDefined();
  });

  it('should handle adminUsers as "any"', () => {
    const tool = createAdminMCPTool({
      name: 'any_admin_tool',
      description: 'Tool for any admin',
      adminUsers: 'any'
    });
    
    expect(tool.mcp.scopes?.adminUsers).toBe('any');
  });

  it('should apply base scopes when provided', () => {
    const baseScopes = { required: ['custom:scope'] };
    const tool = createAdminMCPTool({
      name: 'custom_tool',
      description: 'Custom tool',
      adminUsers: ['admin@test.com'],
      baseScopes
    });
    
    expect(tool.mcp.scopes?.required).toContain('custom:scope');
  });

  it('should handle multiple admin users', () => {
    const tool = createAdminMCPTool({
      name: 'multi_admin_tool',
      description: 'Tool for multiple admins',
      adminUsers: ['admin1@test.com', 'admin2@test.com']
    });
    
    expect(Array.isArray(tool.mcp.scopes?.adminUsers)).toBe(true);
    expect(tool.mcp.scopes?.adminUsers).toHaveLength(2);
  });

  it('should set requireAdminUser to true', () => {
    const tool = createAdminMCPTool({
      name: 'admin_required_tool',
      description: 'Tool requiring admin',
      adminUsers: ['admin@test.com']
    });
    
    expect(tool.mcp.requireAdminUser).toBe(true);
  });
});
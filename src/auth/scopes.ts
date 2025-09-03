/**
 * OAuth 2.0 Scope System for MCP Tools
 * 
 * Provides a flexible, hierarchical scope system for controlling access to MCP tools.
 * Supports common OAuth patterns and MCP-specific requirements.
 */

export type ScopePattern = 
  // Standard OAuth scopes
  | 'read' | 'write' | 'admin' | 'user'
  // MCP-specific scopes  
  | 'mcp' | 'mcp:tools' | 'mcp:call' | 'mcp:list'
  // Resource-specific scopes (namespace:action format)
  | 'ai:execute' | 'ai:configure' | 'ai:read' 
  | 'tools:call' | 'tools:list' | 'tools:admin'
  | 'billing:read' | 'billing:write'
  | 'profile:read' | 'profile:write'
  // Administrative scopes
  | 'system:admin' | 'system:read' | 'system:health'
  // Custom scopes (string literal for extensibility)
  | string;

export type ScopeRequirement = {
  /** Required scopes - user must have ALL of these */
  required?: ScopePattern[];
  /** Optional scopes - user must have AT LEAST ONE of these */
  anyOf?: ScopePattern[];
  /** Scope namespace for grouping related permissions */
  namespace?: string;
  /** Human-readable description of what this scope grants */
  description?: string;
  /** Whether this is a privileged scope requiring explicit consent */
  privileged?: boolean;
};

/**
 * MCP Tool Scope Configuration
 * Extended metadata for MCP tools with scope-based access control
 */
export interface MCPToolScope {
  /** Tool name/identifier */
  name?: string;
  /** Tool description */
  description: string;
  /** Scope requirements for this tool */
  scopes?: ScopeRequirement;
  /** Tool category for organization */
  category?: 'utility' | 'ai' | 'data' | 'admin' | 'system' | string;
  /** Whether tool is public (no auth required) */
  public?: boolean;
  /** Custom permissions beyond scopes */
  permissions?: string[];
}

/**
 * Scope Helper Functions
 * Provides convenient builders for common scope patterns
 */
export class ScopeHelpers {
  /** Read-only access to a resource */
  static read(resource?: string): ScopeRequirement {
    return {
      required: resource ? [`${resource}:read`] : ['read'],
      description: `Read access${resource ? ` to ${resource}` : ''}`,
      namespace: resource
    };
  }

  /** Write access to a resource */
  static write(resource?: string): ScopeRequirement {
    return {
      required: resource ? [`${resource}:write`] : ['write'],
      description: `Write access${resource ? ` to ${resource}` : ''}`,
      namespace: resource
    };
  }

  /** Full access (read + write) to a resource */
  static readWrite(resource?: string): ScopeRequirement {
    const base = resource || '';
    return {
      required: resource ? [`${resource}:read`, `${resource}:write`] : ['read', 'write'],
      description: `Full access${resource ? ` to ${resource}` : ''}`,
      namespace: resource
    };
  }

  /** Execute/call access for tools and APIs */
  static execute(resource?: string): ScopeRequirement {
    return {
      required: resource ? [`${resource}:execute`] : ['mcp:call'],
      description: `Execute access${resource ? ` to ${resource}` : ' to tools'}`,
      namespace: resource || 'mcp'
    };
  }

  /** Administrative access */
  static admin(resource?: string): ScopeRequirement {
    return {
      required: resource ? [`${resource}:admin`] : ['admin'],
      description: `Administrative access${resource ? ` to ${resource}` : ''}`,
      namespace: resource || 'system',
      privileged: true
    };
  }

  /** MCP tool access (list tools) */
  static mcpList(): ScopeRequirement {
    return {
      anyOf: ['mcp:list', 'mcp:tools', 'mcp'],
      description: 'List available MCP tools',
      namespace: 'mcp'
    };
  }

  /** MCP tool execution */
  static mcpCall(): ScopeRequirement {
    return {
      anyOf: ['mcp:call', 'mcp:tools', 'mcp'],
      description: 'Execute MCP tools',
      namespace: 'mcp'
    };
  }

  /** Public tool (no authentication required) */
  static public(): ScopeRequirement {
    return {
      description: 'Public access - no authentication required'
    };
  }

  /** AI service access */
  static ai(action: 'execute' | 'configure' | 'read' = 'execute'): ScopeRequirement {
    return {
      required: [`ai:${action}`],
      description: `AI service ${action} access`,
      namespace: 'ai'
    };
  }

  /** User profile access */
  static profile(action: 'read' | 'write' = 'read'): ScopeRequirement {
    return {
      required: [`profile:${action}`],
      description: `Profile ${action} access`,
      namespace: 'profile'
    };
  }

  /** Billing/subscription access */
  static billing(action: 'read' | 'write' = 'read'): ScopeRequirement {
    return {
      required: [`billing:${action}`],
      description: `Billing ${action} access`,
      namespace: 'billing'
    };
  }

  /** System health and status */
  static system(action: 'read' | 'admin' = 'read'): ScopeRequirement {
    return {
      required: [`system:${action}`],
      description: `System ${action} access`,
      namespace: 'system',
      privileged: action === 'admin'
    };
  }

  /** Custom scope requirement */
  static custom(scopes: ScopePattern[], description: string, options?: {
    anyOf?: boolean;
    namespace?: string; 
    privileged?: boolean;
  }): ScopeRequirement {
    return {
      ...(options?.anyOf ? { anyOf: scopes } : { required: scopes }),
      description,
      namespace: options?.namespace,
      privileged: options?.privileged
    };
  }
}

/**
 * Scope Validation and Checking
 */
export class ScopeValidator {
  /**
   * Check if user scopes satisfy the requirement
   */
  static hasScope(userScopes: string[], requirement: ScopeRequirement): boolean {
    // Public access - no scopes required
    if (!requirement.required && !requirement.anyOf) {
      return true;
    }

    // Expand user scopes to include hierarchical scopes
    const expandedUserScopes = ScopeValidator.expandScopes(userScopes);

    // Check required scopes (ALL must be present)
    if (requirement.required) {
      const hasAllRequired = requirement.required.every(scope => 
        expandedUserScopes.includes(scope)
      );
      if (!hasAllRequired) {
        return false;
      }
    }

    // Check anyOf scopes (AT LEAST ONE must be present)
    if (requirement.anyOf) {
      const hasAnyOf = requirement.anyOf.some(scope => 
        expandedUserScopes.includes(scope)
      );
      if (!hasAnyOf) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a scope pattern matches a user scope (supports wildcards)
   */
  static matchesPattern(userScope: string, pattern: string): boolean {
    // Exact match
    if (userScope === pattern) {
      return true;
    }

    // Wildcard support (e.g., "mcp:*" matches "mcp:call", "mcp:list")
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return userScope.startsWith(`${prefix}:`);
    }

    // Hierarchical scope support (e.g., "admin" grants "user", "write" grants "read")
    const hierarchies: Record<string, string[]> = {
      'admin': ['user', 'read', 'write'],
      'write': ['read'],
      'mcp': ['mcp:list', 'mcp:call', 'mcp:tools'],
      'mcp:tools': ['mcp:list', 'mcp:call'],
      'ai:admin': ['ai:execute', 'ai:configure', 'ai:read'],
      'ai:configure': ['ai:read'],
      'system:admin': ['system:read', 'system:health']
    };

    if (hierarchies[userScope]) {
      return hierarchies[userScope].includes(pattern);
    }

    return false;
  }

  /**
   * Get missing scopes for a requirement
   */
  static getMissingScopes(userScopes: string[], requirement: ScopeRequirement): {
    missing: string[];
    type: 'required' | 'anyOf' | 'none';
  } {
    if (this.hasScope(userScopes, requirement)) {
      return { missing: [], type: 'none' };
    }

    // Expand user scopes to include hierarchical scopes
    const expandedUserScopes = ScopeValidator.expandScopes(userScopes);

    // Check which required scopes are missing
    if (requirement.required) {
      const missing = requirement.required.filter(scope => 
        !expandedUserScopes.some(userScope => this.matchesPattern(userScope, scope))
      );
      if (missing.length > 0) {
        return { missing, type: 'required' };
      }
    }

    // Check if anyOf requirements are not met
    if (requirement.anyOf) {
      const hasAny = requirement.anyOf.some(scope =>
        expandedUserScopes.some(userScope => this.matchesPattern(userScope, scope))
      );
      if (!hasAny) {
        return { missing: requirement.anyOf, type: 'anyOf' };
      }
    }

    return { missing: [], type: 'none' };
  }

  /**
   * Filter tools based on user scopes
   */
  static filterToolsByScope(tools: Array<{ name: string; scopes?: ScopeRequirement }>, userScopes: string[]): Array<{ name: string; scopes?: ScopeRequirement }> {
    return tools.filter(tool => {
      if (!tool.scopes) {
        return true; // No scope requirement = public access
      }
      return this.hasScope(userScopes, tool.scopes);
    });
  }

  /**
   * Get effective scopes after applying hierarchy rules
   */
  static expandScopes(userScopes: string[]): string[] {
    const expanded = new Set(userScopes);

    for (const scope of userScopes) {
      // Add hierarchical permissions
      if (scope === 'admin') {
        expanded.add('user').add('read').add('write');
      } else if (scope === 'write') {
        expanded.add('read');
      } else if (scope === 'mcp') {
        expanded.add('mcp:list').add('mcp:call').add('mcp:tools');
      } else if (scope === 'mcp:tools') {
        expanded.add('mcp:list').add('mcp:call');
      }
      // Add more hierarchies as needed
    }

    return Array.from(expanded);
  }
}

/**
 * Default scope configurations for common use cases
 */
export const DefaultScopes = {
  // Public tools - no authentication
  PUBLIC: ScopeHelpers.public(),
  
  // Basic MCP access
  MCP_LIST: ScopeHelpers.mcpList(),
  MCP_CALL: ScopeHelpers.mcpCall(),
  
  // AI service access
  AI_EXECUTE: ScopeHelpers.ai('execute'),
  AI_CONFIGURE: ScopeHelpers.ai('configure'),
  AI_READ: ScopeHelpers.ai('read'),
  
  // System access
  SYSTEM_READ: ScopeHelpers.system('read'),
  SYSTEM_ADMIN: ScopeHelpers.system('admin'),
  
  // User data access
  PROFILE_READ: ScopeHelpers.profile('read'),
  PROFILE_WRITE: ScopeHelpers.profile('write'),
  BILLING_READ: ScopeHelpers.billing('read'),
  BILLING_WRITE: ScopeHelpers.billing('write'),
  
  // Administrative access
  ADMIN: ScopeHelpers.admin(),
  USER: ScopeHelpers.custom(['user'], 'Standard user access'),
  READ_ONLY: ScopeHelpers.read(),
} as const;

/**
 * Utility function to create MCP metadata with scopes
 */
export function createMCPTool(config: MCPToolScope): { mcp: MCPToolScope } {
  return {
    mcp: {
      ...config,
      // If marked as public, ensure no scope requirements
      ...(config.public && { scopes: DefaultScopes.PUBLIC })
    }
  };
}
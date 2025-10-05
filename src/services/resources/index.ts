// Resources Domain - File system, templates, and workspaces
export * from './file-reader-helper.js';
export * from './template-engine.js';

// Root Manager exports (including FileInfo from root-manager)
export {
  RootManager,
  createRootManager,
  defaultRootManager,
  type RootFolderConfig,
  type ClientRootFolderInfo,
  type FileInfo as RootFileInfo,
  type RootManagerConfig
} from './root-manager.js';

// Workspace Manager exports (renamed FileInfo to avoid conflict)
export {
  WorkspaceManager,
  createWorkspaceManager,
  defaultWorkspaceManager,
  type ServerWorkspaceConfig,
  type ClientWorkspaceInfo,
  type FileInfo as WorkspaceFileInfo,
  type WorkspaceManagerConfig
} from './workspace-manager.js';

// MCP Resources subdomain
export * from './mcp/mcp-resource-registry.js';
export * from './mcp/mcp-resource-helpers.js';

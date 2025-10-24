// Resources Domain - File system, templates, and workspaces
export * from './file-reader-helper';
export * from './template-engine';

// Root Manager exports (including FileInfo from root-manager)
export {
  RootManager,
  createRootManager,
  defaultRootManager,
  type RootFolderConfig,
  type ClientRootFolderInfo,
  type FileInfo as RootFileInfo,
  type RootManagerConfig
} from './root-manager';

// Workspace Manager exports (renamed FileInfo to avoid conflict)
export {
  WorkspaceManager,
  createWorkspaceManager,
  defaultWorkspaceManager,
  type ServerWorkspaceConfig,
  type ClientWorkspaceInfo,
  type FileInfo as WorkspaceFileInfo,
  type WorkspaceManagerConfig
} from './workspace-manager';

// MCP Resources subdomain
export * from './mcp/mcp-resource-registry';
export * from './mcp/mcp-resource-helpers';

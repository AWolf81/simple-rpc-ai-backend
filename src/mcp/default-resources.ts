/**
 * MCP Resource interfaces for Simple RPC AI Backend
 * No default resources are provided - users should define their own via customResources
 */

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceHandler {
  (resourceName: string, params?: any): any;
}
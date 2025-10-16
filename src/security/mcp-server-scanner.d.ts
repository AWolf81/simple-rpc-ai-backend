/**
 * MCP Server Security Scanner
 *
 * Analyzes MCP server packages for security risks before installation/use.
 * Supports both PyPI (Python) and npm (Node.js) packages.
 *
 * Security Levels:
 * - GREEN: Minimal risk, safe to use
 * - YELLOW: Suspicious patterns found, manual review recommended
 * - RED: High-risk patterns found, use with extreme caution
 */
export interface PackageMetadata {
    name: string;
    version?: string;
    homepage?: string;
    repository?: string;
    author?: string;
    releaseDate?: string;
    downloadUrl?: string;
    language: 'python' | 'javascript';
}
export interface SecurityMatch {
    pattern: string;
    description: string;
    line?: number;
    file?: string;
}
export interface SecurityScanResult {
    level: 'GREEN' | 'YELLOW' | 'RED';
    reasons: string[];
    redFlags: SecurityMatch[];
    yellowFlags: SecurityMatch[];
    metadata: PackageMetadata;
    scannedFiles: number;
    timestamp: Date;
    extractionPath?: string;
}
export interface MCPServerSecurityConfig {
    name: string;
    command: string;
    args: string[];
}
/**
 * Scan an MCP server package for security issues
 */
export declare function scanMCPServerPackage(packageName: string, command: 'uvx' | 'npx' | 'npm-exec'): Promise<SecurityScanResult>;
/**
 * Scan MCP server configuration (for Claude config format)
 */
export declare function scanMCPServerConfig(serverConfig: MCPServerSecurityConfig): Promise<SecurityScanResult>;
/**
 * Format scan result for console output
 */
export declare function formatScanResult(result: SecurityScanResult): string;
//# sourceMappingURL=mcp-server-scanner.d.ts.map
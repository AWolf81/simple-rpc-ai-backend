/**
 * Workspace Resolver Utility
 *
 * Provides functionality to resolve the project/workspace root directory
 * and resolve paths relative to that root.
 */
/**
 * Find the project root by looking for package.json
 * Traverses up the directory tree from a starting point
 */
export declare function findProjectRoot(fromDir?: string): string;
/**
 * Resolve a path relative to the project root
 * If the path is absolute, returns it as-is
 * If the path is relative, resolves it from the project root
 */
export declare function resolveFromProjectRoot(relativePath: string, projectRoot: string): string;
/**
 * Get the project root for the current application instance
 * This can be cached for performance
 */
export declare class WorkspaceResolver {
    private static instance;
    private projectRoot;
    private constructor();
    static getInstance(): WorkspaceResolver;
    getProjectRoot(): string;
    resolvePath(relativePath: string): string;
    /**
     * Check if a path is within allowed directories
     */
    isPathAllowed(targetPath: string, additionalAllowedPaths?: string[]): boolean;
}

/**
 * Root Manager - Server and Client Root Folder Configuration
 *
 * Manages root folder configuration for both server-side operations and client applications.
 * Provides secure file access, path validation, and cross-platform compatibility.
 * Supports VS Code extensions, web applications, and CLI tools.
 */
import { EventEmitter } from 'events';
export interface RootFolderConfig {
    /** Primary root folder path - base for all operations */
    path: string;
    /** Display name for the root folder */
    name?: string;
    /** Description of the root folder purpose */
    description?: string;
    /** Whether this root folder is read-only */
    readOnly?: boolean;
    /** Additional allowed folder patterns (relative to root) */
    allowedPaths?: string[];
    /** Explicitly blocked paths (for security) */
    blockedPaths?: string[];
    /** Maximum file size to read (in bytes) */
    maxFileSize?: number;
    /** Allowed file extensions (without dot, e.g., ['ts', 'js', 'md']) */
    allowedExtensions?: string[];
    /** Blocked file extensions (for security) */
    blockedExtensions?: string[];
    /** Whether to follow symbolic links */
    followSymlinks?: boolean;
    /** Custom metadata for the root folder */
    metadata?: Record<string, any>;
    /** Whether to watch for file changes */
    enableWatching?: boolean;
    /** Watch ignore patterns (glob patterns) */
    watchIgnore?: string[];
}
export interface ClientRootFolderInfo {
    /** Root folder ID for client reference */
    id: string;
    /** Display name for the client */
    name: string;
    /** Description shown to users */
    description?: string;
    /** Whether the folder is currently accessible */
    accessible: boolean;
    /** Last access time */
    lastAccessed?: Date;
    /** Folder statistics */
    stats?: {
        totalFiles: number;
        totalSize: number;
        lastModified: Date;
    };
    /** Configuration hints for clients */
    clientHints?: {
        /** Suggested file extensions to show */
        preferredExtensions?: string[];
        /** Default search patterns */
        searchPatterns?: string[];
        /** Whether folder supports real-time updates */
        supportsWatching?: boolean;
    };
}
export interface FileInfo {
    /** Absolute file path */
    path: string;
    /** Relative path from root folder */
    relativePath: string;
    /** File name */
    name: string;
    /** File extension */
    extension: string;
    /** File size in bytes */
    size: number;
    /** Last modified time */
    lastModified: Date;
    /** Whether it's a directory */
    isDirectory: boolean;
    /** MIME type (if determinable) */
    mimeType?: string;
    /** Whether file is readable */
    readable: boolean;
    /** Whether file is writable */
    writable: boolean;
}
export interface RootManagerConfig {
    /** Default root folder configuration */
    defaultRoot?: RootFolderConfig;
    /** Multiple root folder configurations */
    roots?: Record<string, RootFolderConfig>;
    /** Global security settings */
    security?: {
        /** Maximum total file size for operations */
        maxTotalFileSize?: number;
        /** Maximum files to process in one operation */
        maxFilesPerOperation?: number;
        /** Whether to enable strict path validation */
        strictPathValidation?: boolean;
        /** Allowed protocols for external resources */
        allowedProtocols?: string[];
    };
    /** Default client configuration */
    clientDefaults?: {
        /** Default file size limit for client operations */
        maxFileSize?: number;
        /** Default extensions to show */
        defaultExtensions?: string[];
        /** Default search depth */
        maxSearchDepth?: number;
    };
}
export declare class RootManager extends EventEmitter {
    private config;
    private roots;
    private watchers;
    constructor(config?: RootManagerConfig);
    private initializeRoots;
    /**
     * Add a new root folder configuration
     */
    addRoot(id: string, config: RootFolderConfig): void;
    /**
     * Remove a root folder configuration
     */
    removeRoot(id: string): boolean;
    /**
     * Get all configured root folders for client consumption
     */
    getClientRootFolders(): Record<string, ClientRootFolderInfo>;
    /**
     * Validate and resolve a file path within a root folder
     */
    validatePath(rootId: string, relativePath: string): string;
    /**
     * List files in a root folder
     */
    listFiles(rootId: string, relativePath?: string, options?: {
        recursive?: boolean;
        includeDirectories?: boolean;
    }): Promise<FileInfo[]>;
    /**
     * Read file content from a root folder
     */
    readFile(rootId: string, relativePath: string, options?: {
        encoding?: BufferEncoding;
    }): Promise<string | Buffer>;
    /**
     * Write file content to a root folder (if not read-only)
     */
    writeFile(rootId: string, relativePath: string, content: string | Buffer): Promise<void>;
    /**
     * Get root folder configuration
     */
    getRootConfig(rootId: string): RootFolderConfig | undefined;
    /**
     * Get all root folder IDs
     */
    getRootIds(): string[];
    /**
     * Check if a file/path exists in a root folder
     */
    pathExists(rootId: string, relativePath: string): Promise<boolean>;
    private setupWatcher;
    private getRootStats;
    private getFileInfo;
    private isPathBlocked;
    private matchesPattern;
    private getMimeType;
    /**
     * Clean up resources
     */
    destroy(): void;
}
export declare const defaultRootManager: RootManager;
export declare function createRootManager(config?: RootManagerConfig): RootManager;
//# sourceMappingURL=root-manager.d.ts.map
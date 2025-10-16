/**
 * Session Storage Implementations
 *
 * Provides three storage backends for OAuth sessions and tokens:
 * - In-Memory: Fast, dev-friendly, data lost on restart
 * - File: Persistent, dev-friendly, single-server only (with AES-256-GCM encryption)
 * - Redis: Production-ready, scalable, shared across servers
 *
 * Security Features:
 * - File storage uses AES-256-GCM encryption by default to protect OAuth tokens and user data
 * - Encryption can be disabled for testing with `encryptionEnabled: false`
 * - Custom encryption passwords supported via `encryptionPassword` option
 * - Automatic migration from plaintext to encrypted format
 *
 * Usage Examples:
 *
 * ```typescript
 * // Production: Encrypted file storage
 * const storage = createSessionStorage({
 *   type: 'file',
 *   filePath: './data/oauth-sessions.json',
 *   encryptionPassword: process.env.OAUTH_ENCRYPTION_KEY
 * });
 *
 * // Development: Use default password (shows warning)
 * const storage = createSessionStorage({
 *   type: 'file',
 *   filePath: './data/oauth-sessions.json'
 * });
 *
 * // Testing: Disable encryption for easy inspection
 * const storage = createSessionStorage({
 *   type: 'file',
 *   filePath: './test-oauth-sessions.json',
 *   encryptionEnabled: false
 * });
 * ```
 */
import * as OAuth2Server from '@node-oauth/oauth2-server';
export interface SessionData {
    clients: Map<string, OAuth2Server.Client>;
    tokens: Map<string, OAuth2Server.Token>;
    authorizationCodes: Map<string, any>;
    users: Map<string, OAuth2Server.User>;
}
export interface SessionStorage {
    setClient(clientId: string, client: OAuth2Server.Client): Promise<void>;
    getClient(clientId: string): Promise<OAuth2Server.Client | null>;
    deleteClient(clientId: string): Promise<boolean>;
    setToken(tokenId: string, token: OAuth2Server.Token): Promise<void>;
    getToken(tokenId: string): Promise<OAuth2Server.Token | null>;
    deleteToken(tokenId: string): Promise<boolean>;
    setAuthCode(codeId: string, code: any): Promise<void>;
    getAuthCode(codeId: string): Promise<any | null>;
    deleteAuthCode(codeId: string): Promise<boolean>;
    setUser(userId: string, user: OAuth2Server.User): Promise<void>;
    getUser(userId: string): Promise<OAuth2Server.User | null>;
    deleteUser(userId: string): Promise<boolean>;
    setItem(key: string, value: string, ttlSeconds?: number): Promise<void>;
    getItem(key: string): Promise<string | null>;
    deleteItem(key: string): Promise<boolean>;
    initialize(): Promise<void>;
    close(): Promise<void>;
    clear(): Promise<void>;
}
/**
 * In-Memory Session Storage
 * Fast and simple, but data is lost on server restart
 */
export declare class InMemorySessionStorage implements SessionStorage {
    private clients;
    private tokens;
    private authorizationCodes;
    private users;
    private items;
    initialize(): Promise<void>;
    close(): Promise<void>;
    clear(): Promise<void>;
    setClient(clientId: string, client: OAuth2Server.Client): Promise<void>;
    getClient(clientId: string): Promise<OAuth2Server.Client | null>;
    deleteClient(clientId: string): Promise<boolean>;
    setToken(tokenId: string, token: OAuth2Server.Token): Promise<void>;
    getToken(tokenId: string): Promise<OAuth2Server.Token | null>;
    deleteToken(tokenId: string): Promise<boolean>;
    setAuthCode(codeId: string, code: any): Promise<void>;
    getAuthCode(codeId: string): Promise<any | null>;
    deleteAuthCode(codeId: string): Promise<boolean>;
    setUser(userId: string, user: OAuth2Server.User): Promise<void>;
    getUser(userId: string): Promise<OAuth2Server.User | null>;
    deleteUser(userId: string): Promise<boolean>;
    setItem(key: string, value: string, ttlSeconds?: number): Promise<void>;
    getItem(key: string): Promise<string | null>;
    deleteItem(key: string): Promise<boolean>;
}
/**
 * File-based Session Storage
 * Persistent across restarts, good for development
 *
 * Security: Uses AES-256-GCM encryption by default to protect OAuth tokens and user data.
 * The encryption key is derived from a master password or generated randomly.
 */
export declare class FileSessionStorage implements SessionStorage {
    private filePath;
    private encryptionEnabled;
    private encryptionKey;
    private needsMigration;
    private clients;
    private tokens;
    private authorizationCodes;
    private users;
    private items;
    constructor(options?: {
        filePath?: string;
        encryptionEnabled?: boolean;
        encryptionPassword?: string;
    });
    /**
     * Derive a consistent encryption key from password using PBKDF2
     */
    private deriveEncryptionKey;
    /**
     * Encrypt data using AES-256-GCM
     */
    private encryptData;
    /**
     * Decrypt data using AES-256-GCM
     */
    private decryptData;
    initialize(): Promise<void>;
    private saveToFile;
    close(): Promise<void>;
    clear(): Promise<void>;
    setClient(clientId: string, client: OAuth2Server.Client): Promise<void>;
    getClient(clientId: string): Promise<OAuth2Server.Client | null>;
    deleteClient(clientId: string): Promise<boolean>;
    setToken(tokenId: string, token: OAuth2Server.Token): Promise<void>;
    getToken(tokenId: string): Promise<OAuth2Server.Token | null>;
    deleteToken(tokenId: string): Promise<boolean>;
    setAuthCode(codeId: string, code: any): Promise<void>;
    getAuthCode(codeId: string): Promise<any | null>;
    deleteAuthCode(codeId: string): Promise<boolean>;
    setUser(userId: string, user: OAuth2Server.User): Promise<void>;
    getUser(userId: string): Promise<OAuth2Server.User | null>;
    deleteUser(userId: string): Promise<boolean>;
    setItem(key: string, value: string, ttlSeconds?: number): Promise<void>;
    getItem(key: string): Promise<string | null>;
    deleteItem(key: string): Promise<boolean>;
}
/**
 * Redis Session Storage
 * Production-ready, scalable, shared across multiple servers
 */
export declare class RedisSessionStorage implements SessionStorage {
    private redis;
    private keyPrefix;
    constructor(options?: {
        redis?: any;
        keyPrefix?: string;
        host?: string;
        port?: number;
        password?: string;
        db?: number;
    });
    initialize(): Promise<void>;
    close(): Promise<void>;
    clear(): Promise<void>;
    private getKey;
    setClient(clientId: string, client: OAuth2Server.Client): Promise<void>;
    getClient(clientId: string): Promise<OAuth2Server.Client | null>;
    deleteClient(clientId: string): Promise<boolean>;
    setToken(tokenId: string, token: OAuth2Server.Token): Promise<void>;
    getToken(tokenId: string): Promise<OAuth2Server.Token | null>;
    deleteToken(tokenId: string): Promise<boolean>;
    setAuthCode(codeId: string, code: any): Promise<void>;
    getAuthCode(codeId: string): Promise<any | null>;
    deleteAuthCode(codeId: string): Promise<boolean>;
    setUser(userId: string, user: OAuth2Server.User): Promise<void>;
    getUser(userId: string): Promise<OAuth2Server.User | null>;
    deleteUser(userId: string): Promise<boolean>;
    setItem(key: string, value: string, ttlSeconds?: number): Promise<void>;
    getItem(key: string): Promise<string | null>;
    deleteItem(key: string): Promise<boolean>;
}
/**
 * Session Storage Factory
 * Creates the appropriate storage backend based on configuration
 */
export declare function createSessionStorage(config: {
    type: 'memory' | 'file' | 'redis';
    filePath?: string;
    encryptionEnabled?: boolean;
    encryptionPassword?: string;
    redis?: {
        host?: string;
        port?: number;
        password?: string;
        db?: number;
        keyPrefix?: string;
        instance?: any;
    };
}): SessionStorage;
//# sourceMappingURL=session-storage.d.ts.map
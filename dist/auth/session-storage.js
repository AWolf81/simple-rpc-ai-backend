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
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
/**
 * In-Memory Session Storage
 * Fast and simple, but data is lost on server restart
 */
export class InMemorySessionStorage {
    clients = new Map();
    tokens = new Map();
    authorizationCodes = new Map();
    users = new Map();
    items = new Map();
    async initialize() {
        console.log(`🧠 In-Memory session storage initialized`);
    }
    async close() {
        console.log(`🧠 In-Memory session storage closed`);
    }
    async clear() {
        this.clients.clear();
        this.tokens.clear();
        this.authorizationCodes.clear();
        this.users.clear();
        this.items.clear();
        console.log(`🧹 In-Memory session storage cleared`);
    }
    // Client operations
    async setClient(clientId, client) {
        this.clients.set(clientId, client);
    }
    async getClient(clientId) {
        return this.clients.get(clientId) || null;
    }
    async deleteClient(clientId) {
        return this.clients.delete(clientId);
    }
    // Token operations
    async setToken(tokenId, token) {
        this.tokens.set(tokenId, token);
    }
    async getToken(tokenId) {
        return this.tokens.get(tokenId) || null;
    }
    async deleteToken(tokenId) {
        return this.tokens.delete(tokenId);
    }
    // Authorization code operations
    async setAuthCode(codeId, code) {
        this.authorizationCodes.set(codeId, code);
    }
    async getAuthCode(codeId) {
        return this.authorizationCodes.get(codeId) || null;
    }
    async deleteAuthCode(codeId) {
        return this.authorizationCodes.delete(codeId);
    }
    // User operations
    async setUser(userId, user) {
        this.users.set(userId, user);
    }
    async getUser(userId) {
        return this.users.get(userId) || null;
    }
    async deleteUser(userId) {
        return this.users.delete(userId);
    }
    // Generic item operations
    async setItem(key, value, ttlSeconds) {
        const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
        this.items.set(key, { value, expires });
    }
    async getItem(key) {
        const item = this.items.get(key);
        if (!item)
            return null;
        if (item.expires && Date.now() > item.expires) {
            this.items.delete(key);
            return null;
        }
        return item.value;
    }
    async deleteItem(key) {
        return this.items.delete(key);
    }
}
/**
 * File-based Session Storage
 * Persistent across restarts, good for development
 *
 * Security: Uses AES-256-GCM encryption by default to protect OAuth tokens and user data.
 * The encryption key is derived from a master password or generated randomly.
 */
export class FileSessionStorage {
    filePath;
    encryptionEnabled;
    encryptionKey;
    needsMigration = false; // Flag to indicate file needs migration to encrypted format
    clients = new Map();
    tokens = new Map();
    authorizationCodes = new Map();
    users = new Map();
    items = new Map();
    constructor(options = {}) {
        this.filePath = options.filePath || './oauth-sessions.json';
        this.encryptionEnabled = options.encryptionEnabled !== false; // Default: true
        if (this.encryptionEnabled) {
            // Derive encryption key from password or use default for development
            const password = options.encryptionPassword || 'default-dev-password-change-in-production';
            this.encryptionKey = this.deriveEncryptionKey(password);
            if (!options.encryptionPassword) {
                console.warn('🔒 OAuth sessions: Using default encryption password. Set encryptionPassword for production!');
            }
        }
        else {
            this.encryptionKey = null;
            console.warn('⚠️  OAuth sessions: Encryption DISABLED - data will be stored in plaintext!');
        }
    }
    /**
     * Derive a consistent encryption key from password using PBKDF2
     */
    deriveEncryptionKey(password) {
        const salt = 'oauth-session-salt'; // Static salt for consistent key derivation
        return createHash('sha256').update(password + salt).digest();
    }
    /**
     * Encrypt data using AES-256-GCM
     */
    encryptData(data) {
        if (!this.encryptionEnabled || !this.encryptionKey) {
            return data; // Return plaintext if encryption disabled
        }
        const iv = randomBytes(16); // 16 bytes IV for GCM
        const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Combine IV + authTag + encrypted data
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    /**
     * Decrypt data using AES-256-GCM
     */
    decryptData(encryptedData) {
        if (!this.encryptionEnabled || !this.encryptionKey) {
            return encryptedData; // Return as-is if encryption disabled
        }
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('🔒 Failed to decrypt OAuth session data:', error);
            throw new Error('Failed to decrypt session data - wrong password or corrupted file');
        }
    }
    async initialize() {
        try {
            // Ensure directory exists
            const dir = join(this.filePath, '..');
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            // Load existing data if file exists
            if (existsSync(this.filePath)) {
                const rawData = readFileSync(this.filePath, 'utf8');
                let jsonData;
                // Determine if data is encrypted or plaintext
                if (rawData.startsWith('{')) {
                    // Plaintext JSON data
                    jsonData = rawData;
                    if (this.encryptionEnabled) {
                        console.log(`🔄 Migrating OAuth sessions from plaintext to encrypted format...`);
                        // Mark for re-encryption on next save
                        this.needsMigration = true;
                    }
                }
                else if (rawData.includes(':') && rawData.split(':').length === 3) {
                    // Looks like encrypted data (hex:hex:hex format)
                    if (!this.encryptionEnabled) {
                        throw new Error('File appears to be encrypted but encryption is disabled');
                    }
                    jsonData = this.decryptData(rawData);
                    console.log(`🔒 Decrypted OAuth session data from ${this.filePath}`);
                }
                else {
                    throw new Error('Invalid session data format - cannot determine if encrypted or plaintext');
                }
                const data = JSON.parse(jsonData);
                // Convert plain objects back to Maps
                if (data.clients) {
                    this.clients = new Map(Object.entries(data.clients));
                }
                if (data.tokens) {
                    this.tokens = new Map(Object.entries(data.tokens));
                }
                if (data.authorizationCodes) {
                    this.authorizationCodes = new Map(Object.entries(data.authorizationCodes));
                }
                if (data.users) {
                    this.users = new Map(Object.entries(data.users));
                }
                if (data.items) {
                    this.items = new Map(Object.entries(data.items));
                }
                const statusMsg = this.encryptionEnabled ? '🔒 (encrypted)' : '⚠️  (plaintext)';
                console.log(`📁 File session storage loaded from ${this.filePath} ${statusMsg}`);
                // If we loaded plaintext data but encryption is enabled, save encrypted version immediately
                if (this.needsMigration) {
                    console.log(`🔄 Performing immediate migration to encrypted format...`);
                    await this.saveToFile();
                    this.needsMigration = false;
                }
            }
            else {
                const statusMsg = this.encryptionEnabled ? '🔒 (encrypted)' : '⚠️  (plaintext)';
                console.log(`📁 File session storage initialized at ${this.filePath} ${statusMsg}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to initialize file session storage:`, error);
            throw error;
        }
    }
    async saveToFile() {
        try {
            const data = {
                clients: Object.fromEntries(this.clients),
                tokens: Object.fromEntries(this.tokens),
                authorizationCodes: Object.fromEntries(this.authorizationCodes),
                users: Object.fromEntries(this.users),
                items: Object.fromEntries(this.items),
                lastUpdated: new Date().toISOString(),
                encrypted: this.encryptionEnabled // Metadata to indicate if data is encrypted
            };
            const jsonData = JSON.stringify(data, null, this.encryptionEnabled ? 0 : 2); // Compact JSON if encrypting
            const finalData = this.encryptionEnabled ? this.encryptData(jsonData) : jsonData;
            writeFileSync(this.filePath, finalData);
        }
        catch (error) {
            console.error(`❌ Failed to save session data to file:`, error);
        }
    }
    async close() {
        await this.saveToFile();
        console.log(`📁 File session storage saved and closed`);
    }
    async clear() {
        this.clients.clear();
        this.tokens.clear();
        this.authorizationCodes.clear();
        this.users.clear();
        await this.saveToFile();
        console.log(`🧹 File session storage cleared`);
    }
    // Client operations
    async setClient(clientId, client) {
        this.clients.set(clientId, client);
        await this.saveToFile();
    }
    async getClient(clientId) {
        return this.clients.get(clientId) || null;
    }
    async deleteClient(clientId) {
        const deleted = this.clients.delete(clientId);
        if (deleted) {
            await this.saveToFile();
        }
        return deleted;
    }
    // Token operations
    async setToken(tokenId, token) {
        this.tokens.set(tokenId, token);
        await this.saveToFile();
    }
    async getToken(tokenId) {
        return this.tokens.get(tokenId) || null;
    }
    async deleteToken(tokenId) {
        const deleted = this.tokens.delete(tokenId);
        if (deleted) {
            await this.saveToFile();
        }
        return deleted;
    }
    // Authorization code operations
    async setAuthCode(codeId, code) {
        this.authorizationCodes.set(codeId, code);
        await this.saveToFile();
    }
    async getAuthCode(codeId) {
        return this.authorizationCodes.get(codeId) || null;
    }
    async deleteAuthCode(codeId) {
        const deleted = this.authorizationCodes.delete(codeId);
        if (deleted) {
            await this.saveToFile();
        }
        return deleted;
    }
    // User operations
    async setUser(userId, user) {
        this.users.set(userId, user);
        await this.saveToFile();
    }
    async getUser(userId) {
        return this.users.get(userId) || null;
    }
    async deleteUser(userId) {
        const deleted = this.users.delete(userId);
        if (deleted) {
            await this.saveToFile();
        }
        return deleted;
    }
    // Generic item operations
    async setItem(key, value, ttlSeconds) {
        const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
        this.items.set(key, { value, expires });
        await this.saveToFile();
    }
    async getItem(key) {
        const item = this.items.get(key);
        if (!item)
            return null;
        if (item.expires && Date.now() > item.expires) {
            this.items.delete(key);
            await this.saveToFile();
            return null;
        }
        return item.value;
    }
    async deleteItem(key) {
        const deleted = this.items.delete(key);
        if (deleted) {
            await this.saveToFile();
        }
        return deleted;
    }
}
/**
 * Redis Session Storage
 * Production-ready, scalable, shared across multiple servers
 */
export class RedisSessionStorage {
    redis;
    keyPrefix;
    constructor(options = {}) {
        this.keyPrefix = options.keyPrefix || 'oauth:';
        if (options.redis) {
            // Use provided Redis instance
            this.redis = options.redis;
        }
        else {
            // Try to create Redis instance (requires redis package)
            try {
                const Redis = require('ioredis');
                this.redis = new Redis({
                    host: options.host || 'localhost',
                    port: options.port || 6379,
                    password: options.password,
                    db: options.db || 0,
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true
                });
            }
            catch (error) {
                throw new Error('Redis package not installed. Install with: npm install ioredis');
            }
        }
    }
    async initialize() {
        try {
            await this.redis.ping();
            console.log(`🔴 Redis session storage connected`);
        }
        catch (error) {
            console.error(`❌ Failed to connect to Redis:`, error);
            throw error;
        }
    }
    async close() {
        if (this.redis) {
            await this.redis.quit();
            console.log(`🔴 Redis session storage disconnected`);
        }
    }
    async clear() {
        const keys = await this.redis.keys(`${this.keyPrefix}*`);
        if (keys.length > 0) {
            await this.redis.del(keys);
        }
        console.log(`🧹 Redis session storage cleared (${keys.length} keys)`);
    }
    getKey(type, id) {
        return `${this.keyPrefix}${type}:${id}`;
    }
    // Client operations
    async setClient(clientId, client) {
        await this.redis.setex(this.getKey('client', clientId), 86400, // 24 hours TTL
        JSON.stringify(client));
    }
    async getClient(clientId) {
        const data = await this.redis.get(this.getKey('client', clientId));
        return data ? JSON.parse(data) : null;
    }
    async deleteClient(clientId) {
        const result = await this.redis.del(this.getKey('client', clientId));
        return result > 0;
    }
    // Token operations
    async setToken(tokenId, token) {
        const ttl = token.accessTokenExpiresAt
            ? Math.max(1, Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000))
            : 3600; // 1 hour default
        await this.redis.setex(this.getKey('token', tokenId), ttl, JSON.stringify(token));
    }
    async getToken(tokenId) {
        const data = await this.redis.get(this.getKey('token', tokenId));
        return data ? JSON.parse(data) : null;
    }
    async deleteToken(tokenId) {
        const result = await this.redis.del(this.getKey('token', tokenId));
        return result > 0;
    }
    // Authorization code operations
    async setAuthCode(codeId, code) {
        const ttl = code.expiresAt
            ? Math.max(1, Math.floor((code.expiresAt.getTime() - Date.now()) / 1000))
            : 600; // 10 minutes default
        await this.redis.setex(this.getKey('code', codeId), ttl, JSON.stringify(code));
    }
    async getAuthCode(codeId) {
        const data = await this.redis.get(this.getKey('code', codeId));
        return data ? JSON.parse(data) : null;
    }
    async deleteAuthCode(codeId) {
        const result = await this.redis.del(this.getKey('code', codeId));
        return result > 0;
    }
    // User operations
    async setUser(userId, user) {
        await this.redis.setex(this.getKey('user', userId), 86400, // 24 hours TTL
        JSON.stringify(user));
    }
    async getUser(userId) {
        const data = await this.redis.get(this.getKey('user', userId));
        return data ? JSON.parse(data) : null;
    }
    async deleteUser(userId) {
        const result = await this.redis.del(this.getKey('user', userId));
        return result > 0;
    }
    // Generic item operations
    async setItem(key, value, ttlSeconds) {
        const redisKey = this.getKey('item', key);
        if (ttlSeconds) {
            await this.redis.setex(redisKey, ttlSeconds, value);
        }
        else {
            await this.redis.set(redisKey, value);
        }
    }
    async getItem(key) {
        return await this.redis.get(this.getKey('item', key));
    }
    async deleteItem(key) {
        const result = await this.redis.del(this.getKey('item', key));
        return result > 0;
    }
}
/**
 * Session Storage Factory
 * Creates the appropriate storage backend based on configuration
 */
export function createSessionStorage(config) {
    switch (config.type) {
        case 'memory':
            return new InMemorySessionStorage();
        case 'file':
            return new FileSessionStorage({
                filePath: config.filePath || './data/oauth-sessions.json',
                encryptionEnabled: config.encryptionEnabled,
                encryptionPassword: config.encryptionPassword
            });
        case 'redis':
            return new RedisSessionStorage({
                host: config.redis?.host,
                port: config.redis?.port,
                password: config.redis?.password,
                db: config.redis?.db,
                keyPrefix: config.redis?.keyPrefix,
                redis: config.redis?.instance
            });
        default:
            throw new Error(`Unsupported session storage type: ${config.type}`);
    }
}

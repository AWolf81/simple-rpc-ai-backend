/**
 * Session Storage Implementations
 *
 * Provides three storage backends for OAuth sessions and tokens:
 * - In-Memory: Fast, dev-friendly, data lost on restart
 * - File: Persistent, dev-friendly, single-server only
 * - Redis: Production-ready, scalable, shared across servers
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
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
 */
export class FileSessionStorage {
    filePath;
    clients = new Map();
    tokens = new Map();
    authorizationCodes = new Map();
    users = new Map();
    items = new Map();
    constructor(options = {}) {
        this.filePath = options.filePath || './oauth-sessions.json';
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
                const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
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
                console.log(`📁 File session storage loaded from ${this.filePath}`);
            }
            else {
                console.log(`📁 File session storage initialized at ${this.filePath}`);
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
                lastUpdated: new Date().toISOString()
            };
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
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
                filePath: config.filePath || './data/oauth-sessions.json'
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

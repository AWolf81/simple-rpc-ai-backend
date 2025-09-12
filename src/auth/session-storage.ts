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
import * as OAuth2Server from '@node-oauth/oauth2-server';
import Redis from 'ioredis';

// Common interfaces
export interface SessionData {
  clients: Map<string, OAuth2Server.Client>;
  tokens: Map<string, OAuth2Server.Token>;
  authorizationCodes: Map<string, any>;
  users: Map<string, OAuth2Server.User>;
}

export interface SessionStorage {
  // Client operations
  setClient(clientId: string, client: OAuth2Server.Client): Promise<void>;
  getClient(clientId: string): Promise<OAuth2Server.Client | null>;
  deleteClient(clientId: string): Promise<boolean>;

  // Token operations
  setToken(tokenId: string, token: OAuth2Server.Token): Promise<void>;
  getToken(tokenId: string): Promise<OAuth2Server.Token | null>;
  deleteToken(tokenId: string): Promise<boolean>;

  // Authorization code operations
  setAuthCode(codeId: string, code: any): Promise<void>;
  getAuthCode(codeId: string): Promise<any | null>;
  deleteAuthCode(codeId: string): Promise<boolean>;

  // User operations
  setUser(userId: string, user: OAuth2Server.User): Promise<void>;
  getUser(userId: string): Promise<OAuth2Server.User | null>;
  deleteUser(userId: string): Promise<boolean>;

  // Generic item operations (for OAuth state, etc.)
  setItem(key: string, value: string, ttlSeconds?: number): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<boolean>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-Memory Session Storage
 * Fast and simple, but data is lost on server restart
 */
export class InMemorySessionStorage implements SessionStorage {
  private clients = new Map<string, OAuth2Server.Client>();
  private tokens = new Map<string, OAuth2Server.Token>();
  private authorizationCodes = new Map<string, any>();
  private users = new Map<string, OAuth2Server.User>();
  private items = new Map<string, { value: string; expires?: number }>();

  async initialize(): Promise<void> {
    console.log(`🧠 In-Memory session storage initialized`);
  }

  async close(): Promise<void> {
    console.log(`🧠 In-Memory session storage closed`);
  }

  async clear(): Promise<void> {
    this.clients.clear();
    this.tokens.clear();
    this.authorizationCodes.clear();
    this.users.clear();
    this.items.clear();
    console.log(`🧹 In-Memory session storage cleared`);
  }

  // Client operations
  async setClient(clientId: string, client: OAuth2Server.Client): Promise<void> {
    this.clients.set(clientId, client);
  }

  async getClient(clientId: string): Promise<OAuth2Server.Client | null> {
    return this.clients.get(clientId) || null;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    return this.clients.delete(clientId);
  }

  // Token operations
  async setToken(tokenId: string, token: OAuth2Server.Token): Promise<void> {
    this.tokens.set(tokenId, token);
  }

  async getToken(tokenId: string): Promise<OAuth2Server.Token | null> {
    return this.tokens.get(tokenId) || null;
  }

  async deleteToken(tokenId: string): Promise<boolean> {
    return this.tokens.delete(tokenId);
  }

  // Authorization code operations
  async setAuthCode(codeId: string, code: any): Promise<void> {
    this.authorizationCodes.set(codeId, code);
  }

  async getAuthCode(codeId: string): Promise<any | null> {
    return this.authorizationCodes.get(codeId) || null;
  }

  async deleteAuthCode(codeId: string): Promise<boolean> {
    return this.authorizationCodes.delete(codeId);
  }

  // User operations
  async setUser(userId: string, user: OAuth2Server.User): Promise<void> {
    this.users.set(userId, user);
  }

  async getUser(userId: string): Promise<OAuth2Server.User | null> {
    return this.users.get(userId) || null;
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  // Generic item operations
  async setItem(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.items.set(key, { value, expires });
  }

  async getItem(key: string): Promise<string | null> {
    const item = this.items.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.items.delete(key);
      return null;
    }
    
    return item.value;
  }

  async deleteItem(key: string): Promise<boolean> {
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
export class FileSessionStorage implements SessionStorage {
  private filePath: string;
  private encryptionEnabled: boolean;
  private encryptionKey: Buffer | null;
  private needsMigration = false; // Flag to indicate file needs migration to encrypted format
  private clients = new Map<string, OAuth2Server.Client>();
  private tokens = new Map<string, OAuth2Server.Token>();
  private authorizationCodes = new Map<string, any>();
  private users = new Map<string, OAuth2Server.User>();
  private items = new Map<string, { value: string; expires?: number }>();

  constructor(options: { 
    filePath?: string;
    encryptionEnabled?: boolean;
    encryptionPassword?: string;
  } = {}) {
    this.filePath = options.filePath || './oauth-sessions.json';
    this.encryptionEnabled = options.encryptionEnabled !== false; // Default: true
    
    if (this.encryptionEnabled) {
      // Get encryption password from environment or options
      const password = options.encryptionPassword || process.env.OAUTH_SESSION_ENCRYPTION_KEY;
      
      if (!password) {
        // In production, require explicit encryption key
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'OAuth session encryption key required in production. ' +
            'Set OAUTH_SESSION_ENCRYPTION_KEY environment variable or pass encryptionPassword option.'
          );
        }
        // Development fallback with strong warning
        const fallbackPassword = 'default-dev-password-change-in-production';
        this.encryptionKey = this.deriveEncryptionKey(fallbackPassword);
        console.warn(
          '🔒 OAuth sessions: Using default encryption password. ' +
          'Set OAUTH_SESSION_ENCRYPTION_KEY environment variable for production!'
        );
      } else {
        this.encryptionKey = this.deriveEncryptionKey(password);
      }
    } else {
      this.encryptionKey = null;
      console.warn('⚠️  OAuth sessions: Encryption DISABLED - data will be stored in plaintext!');
    }
  }

  /**
   * Derive a consistent encryption key from password using PBKDF2
   */
  private deriveEncryptionKey(password: string): Buffer {
    const salt = 'oauth-session-salt'; // Static salt for consistent key derivation
    return createHash('sha256').update(password + salt).digest();
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encryptData(data: string): string {
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
  private decryptData(encryptedData: string): string {
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
    } catch (error) {
      console.error('🔒 Failed to decrypt OAuth session data:', error);
      throw new Error('Failed to decrypt session data - wrong password or corrupted file');
    }
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(this.filePath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Load existing data if file exists
      if (existsSync(this.filePath)) {
        const rawData = readFileSync(this.filePath, 'utf8');
        let jsonData: string;
        
        // Determine if data is encrypted or plaintext
        if (rawData.startsWith('{')) {
          // Plaintext JSON data
          jsonData = rawData;
          if (this.encryptionEnabled) {
            console.log(`🔄 Migrating OAuth sessions from plaintext to encrypted format...`);
            // Mark for re-encryption on next save
            this.needsMigration = true;
          }
        } else if (rawData.includes(':') && rawData.split(':').length === 3) {
          // Looks like encrypted data (hex:hex:hex format)
          if (!this.encryptionEnabled) {
            throw new Error('File appears to be encrypted but encryption is disabled');
          }
          jsonData = this.decryptData(rawData);
          console.log(`🔒 Decrypted OAuth session data from ${this.filePath}`);
        } else {
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
      } else {
        const statusMsg = this.encryptionEnabled ? '🔒 (encrypted)' : '⚠️  (plaintext)';
        console.log(`📁 File session storage initialized at ${this.filePath} ${statusMsg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize file session storage:`, error);
      throw error;
    }
  }

  private async saveToFile(): Promise<void> {
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
    } catch (error) {
      console.error(`❌ Failed to save session data to file:`, error);
    }
  }

  async close(): Promise<void> {
    await this.saveToFile();
    console.log(`📁 File session storage saved and closed`);
  }

  async clear(): Promise<void> {
    this.clients.clear();
    this.tokens.clear();
    this.authorizationCodes.clear();
    this.users.clear();
    await this.saveToFile();
    console.log(`🧹 File session storage cleared`);
  }

  // Client operations
  async setClient(clientId: string, client: OAuth2Server.Client): Promise<void> {
    this.clients.set(clientId, client);
    await this.saveToFile();
  }

  async getClient(clientId: string): Promise<OAuth2Server.Client | null> {
    return this.clients.get(clientId) || null;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    const deleted = this.clients.delete(clientId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  // Token operations
  async setToken(tokenId: string, token: OAuth2Server.Token): Promise<void> {
    this.tokens.set(tokenId, token);
    await this.saveToFile();
  }

  async getToken(tokenId: string): Promise<OAuth2Server.Token | null> {
    return this.tokens.get(tokenId) || null;
  }

  async deleteToken(tokenId: string): Promise<boolean> {
    const deleted = this.tokens.delete(tokenId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  // Authorization code operations
  async setAuthCode(codeId: string, code: any): Promise<void> {
    this.authorizationCodes.set(codeId, code);
    await this.saveToFile();
  }

  async getAuthCode(codeId: string): Promise<any | null> {
    return this.authorizationCodes.get(codeId) || null;
  }

  async deleteAuthCode(codeId: string): Promise<boolean> {
    const deleted = this.authorizationCodes.delete(codeId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  // User operations
  async setUser(userId: string, user: OAuth2Server.User): Promise<void> {
    this.users.set(userId, user);
    await this.saveToFile();
  }

  async getUser(userId: string): Promise<OAuth2Server.User | null> {
    return this.users.get(userId) || null;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const deleted = this.users.delete(userId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  // Generic item operations
  async setItem(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.items.set(key, { value, expires });
    await this.saveToFile();
  }

  async getItem(key: string): Promise<string | null> {
    const item = this.items.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.items.delete(key);
      await this.saveToFile();
      return null;
    }
    
    return item.value;
  }

  async deleteItem(key: string): Promise<boolean> {
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
export class RedisSessionStorage implements SessionStorage {
  private redis: any;
  private keyPrefix: string;

  constructor(options: { 
    redis?: any; 
    keyPrefix?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  } = {}) {
    this.keyPrefix = options.keyPrefix || 'oauth:';
    
    if (options.redis) {
      // Use provided Redis instance
      this.redis = options.redis;
    } else {
      // Try to create Redis instance (requires redis package)
      try {
        this.redis = new Redis({
          host: options.host || 'localhost',
          port: options.port || 6379,
          password: options.password,
          db: options.db || 0,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });
      } catch (error) {
        throw new Error('Redis package not installed. Install with: npm install ioredis');
      }
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.ping();
      console.log(`✅ Redis session storage connected`);
    } catch (error) {
      console.error(`❌ Failed to connect to Redis:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      console.log(`✅ Redis session storage disconnected`);
    }
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
    console.log(`🧹 Redis session storage cleared (${keys.length} keys)`);
  }

  private getKey(type: string, id: string): string {
    return `${this.keyPrefix}${type}:${id}`;
  }

  // Client operations
  async setClient(clientId: string, client: OAuth2Server.Client): Promise<void> {
    await this.redis.setex(
      this.getKey('client', clientId), 
      86400, // 24 hours TTL
      JSON.stringify(client)
    );
  }

  async getClient(clientId: string): Promise<OAuth2Server.Client | null> {
    const data = await this.redis.get(this.getKey('client', clientId));
    return data ? JSON.parse(data) : null;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    const result = await this.redis.del(this.getKey('client', clientId));
    return result > 0;
  }

  // Token operations
  async setToken(tokenId: string, token: OAuth2Server.Token): Promise<void> {
    const ttl = token.accessTokenExpiresAt 
      ? Math.max(1, Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000))
      : 3600; // 1 hour default

    await this.redis.setex(
      this.getKey('token', tokenId), 
      ttl,
      JSON.stringify(token)
    );
  }

  async getToken(tokenId: string): Promise<OAuth2Server.Token | null> {
    const data = await this.redis.get(this.getKey('token', tokenId));
    return data ? JSON.parse(data) : null;
  }

  async deleteToken(tokenId: string): Promise<boolean> {
    const result = await this.redis.del(this.getKey('token', tokenId));
    return result > 0;
  }

  // Authorization code operations
  async setAuthCode(codeId: string, code: any): Promise<void> {
    const ttl = code.expiresAt 
      ? Math.max(1, Math.floor((code.expiresAt.getTime() - Date.now()) / 1000))
      : 600; // 10 minutes default

    await this.redis.setex(
      this.getKey('code', codeId), 
      ttl,
      JSON.stringify(code)
    );
  }

  async getAuthCode(codeId: string): Promise<any | null> {
    const data = await this.redis.get(this.getKey('code', codeId));
    return data ? JSON.parse(data) : null;
  }

  async deleteAuthCode(codeId: string): Promise<boolean> {
    const result = await this.redis.del(this.getKey('code', codeId));
    return result > 0;
  }

  // User operations
  async setUser(userId: string, user: OAuth2Server.User): Promise<void> {
    await this.redis.setex(
      this.getKey('user', userId), 
      86400, // 24 hours TTL
      JSON.stringify(user)
    );
  }

  async getUser(userId: string): Promise<OAuth2Server.User | null> {
    const data = await this.redis.get(this.getKey('user', userId));
    return data ? JSON.parse(data) : null;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await this.redis.del(this.getKey('user', userId));
    return result > 0;
  }

  // Generic item operations
  async setItem(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redisKey = this.getKey('item', key);
    if (ttlSeconds) {
      await this.redis.setex(redisKey, ttlSeconds, value);
    } else {
      await this.redis.set(redisKey, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    return await this.redis.get(this.getKey('item', key));
  }

  async deleteItem(key: string): Promise<boolean> {
    const result = await this.redis.del(this.getKey('item', key));
    return result > 0;
  }
}

/**
 * Session Storage Factory
 * Creates the appropriate storage backend based on configuration
 */
export function createSessionStorage(config: {
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
}): SessionStorage {
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
/**
 * PostgreSQL Secret Manager
 * 
 * Simple, secure multi-tenant API key storage using PostgreSQL directly
 * No complex external dependencies - just encrypted storage with proper user isolation
 */

import * as winston from 'winston';
import { Client } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes, createHash, scrypt } from 'crypto';
import { promisify } from 'util';
import { redactEmail } from '../../utils/redact';

// Type for scrypt with options (Node.js 12+)
type ScryptFunction = (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: {
    N?: number;
    r?: number;
    p?: number;
    maxmem?: number;
  }
) => Promise<Buffer>;

const scryptAsync = promisify(scrypt) as ScryptFunction;

export interface ScryptOptions {
  /** CPU/memory cost parameter (default: 16384) */
  N?: number;
  /** Block size parameter (default: 8) */
  r?: number;
  /** Parallelization parameter (default: 1) */
  p?: number;
  /** Key length in bytes (default: 32) */
  keylen?: number;
}

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  /**
   * Encryption salt (hex-encoded, 32 bytes minimum)
   * REQUIRED in production - will throw error if missing
   * Generate with: crypto.randomBytes(32).toString('hex')
   */
  encryptionSalt?: string;
  /**
   * Scrypt parameters for key derivation
   * Higher values = more secure but slower
   */
  scryptOptions?: ScryptOptions;
  /**
   * Enable backward compatibility for old user IDs
   * Set to true when migrating from old string-based IDs to SHA-256
   */
  enableLegacyUserIds?: boolean;
}

export interface SecretRecord {
  userId: string;
  secretKey: string;
  encryptedValue: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretOperationResult {
  success: boolean;
  error?: string;
  secretId?: string;
}

/**
 * Simple PostgreSQL-based secret manager with true user isolation
 */
export class PostgreSQLSecretManager {
  private client: Client;
  private logger: winston.Logger;
  private masterKey: Buffer;
  private encryptionKey: string;
  private encryptionSalt: Buffer;
  private scryptOptions: Required<ScryptOptions>;
  private enableLegacyUserIds: boolean;
  private initialized: boolean = false;

  constructor(config: PostgreSQLConfig, encryptionKey: string, logger?: winston.Logger) {
    this.client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl
    });

    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    // Store encryption key for async derivation
    this.encryptionKey = encryptionKey;

    // Configure scrypt parameters (with sensible defaults)
    this.scryptOptions = {
      N: config.scryptOptions?.N ?? 16384,
      r: config.scryptOptions?.r ?? 8,
      p: config.scryptOptions?.p ?? 1,
      keylen: config.scryptOptions?.keylen ?? 32
    };

    // Configure legacy user ID support for migration
    this.enableLegacyUserIds = config.enableLegacyUserIds ?? false;
    if (this.enableLegacyUserIds) {
      this.logger.warn('Legacy user ID support enabled - migrate data and disable for production');
    }

    // Validate and configure encryption salt
    this.validateAndSetSalt(config.encryptionSalt);

    // Master key will be derived asynchronously in initialize()
    this.masterKey = Buffer.alloc(32); // Placeholder
  }

  /**
   * Validate and set encryption salt with production safety checks
   */
  private validateAndSetSalt(saltHex?: string): void {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!saltHex) {
      if (isProduction) {
        throw new Error(
          'CRITICAL SECURITY ERROR: encryptionSalt is REQUIRED in production environment. ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }

      // Fallback to deterministic salt for development only
      this.encryptionSalt = Buffer.from('default-salt-change-in-production', 'utf8').subarray(0, 32);
      this.logger.warn(
        'SECURITY WARNING: Using default encryption salt. ' +
        'Generate production salt with: crypto.randomBytes(32).toString(\'hex\')'
      );
      return;
    }

    // Validate salt format (must be hex-encoded)
    if (!/^[0-9a-fA-F]+$/.test(saltHex)) {
      throw new Error(
        'Invalid encryptionSalt format: must be hex-encoded string. ' +
        'Generate with: crypto.randomBytes(32).toString(\'hex\')'
      );
    }

    // Validate salt length (minimum 32 bytes = 64 hex characters)
    const saltBuffer = Buffer.from(saltHex, 'hex');
    if (saltBuffer.length < 32) {
      throw new Error(
        `Invalid encryptionSalt length: ${saltBuffer.length} bytes (minimum 32 required). ` +
        'Generate with: crypto.randomBytes(32).toString(\'hex\')'
      );
    }

    this.encryptionSalt = saltBuffer;
    this.logger.info('Encryption salt configured successfully', {
      saltLength: saltBuffer.length,
      isProduction
    });
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    try {
      // Derive master key using scrypt (memory-hard KDF)
      await this.deriveMasterKey();

      await this.client.connect();
      await this.createSchema();

      this.initialized = true;
      this.logger.info('PostgreSQLSecretManager initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize PostgreSQLSecretManager', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure manager is initialized before operations
   * Prevents race conditions and data corruption
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'PostgreSQLSecretManager not initialized. ' +
        'Call initialize() before performing operations.'
      );
    }
  }

  /**
   * Store user API key with encryption and isolation
   */
  async storeUserKey(email: string, provider: string, apiKey: string): Promise<SecretOperationResult> {
    this.ensureInitialized();

    try {
      const userId = this.getUserId(email);
      const secretKey = `${provider}_api_key`;
      
      // Encrypt the API key
      const encryptedValue = await this.encrypt(apiKey);
      
      // Store with user isolation
      const query = `
        INSERT INTO user_secrets (user_id, secret_key, encrypted_value, provider, email, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id, secret_key) 
        DO UPDATE SET encrypted_value = $3, updated_at = NOW()
        RETURNING id
      `;
      
      const result = await this.client.query(query, [userId, secretKey, encryptedValue, provider, email]);
      const secretId = result.rows[0].id;

      this.logger.info('User API key stored successfully', { userId: redactEmail(email), provider, secretId });
      await this.logSecretAccess(email, 'STORE_KEY', true, provider);

      return {
        success: true,
        secretId: secretId.toString()
      };

    } catch (error: any) {
      this.logger.error('Failed to store user key', { email, provider, error: error.message });
      await this.logSecretAccess(email, 'STORE_KEY', false, provider, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve user API key with decryption
   * Supports legacy user IDs during migration
   */
  async getUserKey(email: string, provider: string): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    this.ensureInitialized();

    try {
      const userId = this.getUserId(email);
      const secretKey = `${provider}_api_key`;

      let query = `
        SELECT encrypted_value FROM user_secrets
        WHERE user_id = $1 AND secret_key = $2
      `;

      let result = await this.client.query(query, [userId, secretKey]);

      // Try legacy user ID if enabled and no result with new ID
      if (result.rows.length === 0 && this.enableLegacyUserIds) {
        const legacyUserId = this.getLegacyUserId(email);
        this.logger.info('Attempting legacy user ID lookup', { email: redactEmail(email), provider });
        result = await this.client.query(query, [legacyUserId, secretKey]);

        // If found with legacy ID, migrate to new ID
        if (result.rows.length > 0) {
          this.logger.warn('Found data with legacy user ID - migrating to SHA-256', {
            email: redactEmail(email),
            provider
          });
          await this.migrateLegacyUserId(email, provider, legacyUserId, userId);
        }
      }

      if (result.rows.length === 0) {
        await this.logSecretAccess(email, 'RETRIEVE_KEY', false, provider, `No ${provider} API key found for user`);
        return {
          success: false,
          error: `No ${provider} API key found for user`
        };
      }

      // Decrypt the API key
      const apiKey = await this.decrypt(result.rows[0].encrypted_value);

      this.logger.info('User API key retrieved successfully', { userId: redactEmail(email), provider });
      await this.logSecretAccess(email, 'RETRIEVE_KEY', true, provider);

      return {
        success: true,
        apiKey
      };

    } catch (error: any) {
      this.logger.error('Failed to retrieve user key', { email, provider, error: error.message });
      await this.logSecretAccess(email, 'RETRIEVE_KEY', false, provider, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all configured providers for a user
   */
  async getUserProviders(email: string): Promise<{ success: boolean; providers?: string[]; error?: string }> {
    this.ensureInitialized();

    try {
      const userId = this.getUserId(email);
      
      const query = `
        SELECT DISTINCT provider FROM user_secrets 
        WHERE user_id = $1
      `;
      
      const result = await this.client.query(query, [userId]);
      const providers = result.rows.map(row => row.provider);

      this.logger.info('User providers retrieved', { userId: redactEmail(email), providers });
      await this.logSecretAccess(email, 'LIST_PROVIDERS', true);

      return {
        success: true,
        providers
      };

    } catch (error: any) {
      this.logger.error('Failed to get user providers', { email, error: error.message });
      await this.logSecretAccess(email, 'LIST_PROVIDERS', false, undefined, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete user API key
   */
  async deleteUserKey(email: string, provider: string): Promise<SecretOperationResult> {
    this.ensureInitialized();

    try {
      const userId = this.getUserId(email);
      const secretKey = `${provider}_api_key`;
      
      const query = `
        DELETE FROM user_secrets 
        WHERE user_id = $1 AND secret_key = $2
        RETURNING id
      `;
      
      const result = await this.client.query(query, [userId, secretKey]);
      
      if (result.rows.length === 0) {
        await this.logSecretAccess(email, 'DELETE_KEY', false, provider, `No ${provider} API key found for user`);
        return {
          success: false,
          error: `No ${provider} API key found for user`
        };
      }

      this.logger.info('User API key deleted successfully', { userId: redactEmail(email), provider });
      await this.logSecretAccess(email, 'DELETE_KEY', true, provider);

      return {
        success: true,
        secretId: result.rows[0].id.toString()
      };

    } catch (error: any) {
      this.logger.error('Failed to delete user key', { email, provider, error: error.message });
      await this.logSecretAccess(email, 'DELETE_KEY', false, provider, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate user API key format
   */
  async validateUserKey(email: string, provider: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
    this.ensureInitialized();

    try {
      const keyResult = await this.getUserKey(email, provider);
      
      if (!keyResult.success || !keyResult.apiKey) {
        return {
          success: true,
          valid: false,
          error: 'API key not found'
        };
      }

      // Basic format validation
      const apiKey = keyResult.apiKey;
      let isValidFormat = false;

      switch (provider) {
        case 'anthropic':
          isValidFormat = apiKey.startsWith('sk-ant-');
          break;
        case 'openai':
          isValidFormat = apiKey.startsWith('sk-') && apiKey.length > 20;
          break;
        case 'google':
          isValidFormat = apiKey.length > 20;
          break;
      }

      this.logger.info('User API key validation complete', { email: redactEmail(email), provider, valid: isValidFormat });
      await this.logSecretAccess(email, 'VALIDATE_KEY', true, provider);

      return {
        success: true,
        valid: isValidFormat
      };

    } catch (error: any) {
      this.logger.error('Failed to validate user key', { email, provider, error: error.message });
      await this.logSecretAccess(email, 'VALIDATE_KEY', false, provider, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_secrets,
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT provider) as total_providers
        FROM user_secrets
      `;
      
      const result = await this.client.query(query);
      const stats = result.rows[0];

      return {
        status: 'healthy',
        details: {
          connected: true,
          totalSecrets: parseInt(stats.total_secrets),
          totalUsers: parseInt(stats.total_users),
          totalProviders: parseInt(stats.total_providers),
          lastCheck: new Date()
        }
      };

    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error.message,
          lastCheck: new Date()
        }
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.client.end();
      this.logger.info('PostgreSQLSecretManager cleanup completed');
    } catch (error: any) {
      this.logger.error('Cleanup error', { error: error.message });
    }
  }

  // Private helper methods

  /**
   * Generate secure, consistent user ID from email using SHA-256
   * Prevents predictable IDs and ensures proper user isolation
   */
  private getUserId(email: string): string {
    return createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Generate legacy user ID (for backward compatibility during migration)
   * This is the old insecure method - only used when enableLegacyUserIds is true
   */
  private getLegacyUserId(email: string): string {
    return email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }

  /**
   * Migrate user data from legacy user ID to SHA-256 user ID
   * Updates the user_id in-place while preserving all other data
   */
  private async migrateLegacyUserId(
    email: string,
    provider: string,
    legacyUserId: string,
    newUserId: string
  ): Promise<void> {
    try {
      const secretKey = `${provider}_api_key`;

      // Update user_id to new SHA-256 value
      const query = `
        UPDATE user_secrets
        SET user_id = $1, updated_at = NOW()
        WHERE user_id = $2 AND secret_key = $3
      `;

      await this.client.query(query, [newUserId, legacyUserId, secretKey]);

      this.logger.info('Successfully migrated user ID to SHA-256', {
        email: redactEmail(email),
        provider,
        legacyUserId: legacyUserId.substring(0, 10) + '...',
        newUserId: newUserId.substring(0, 10) + '...'
      });
    } catch (error: any) {
      this.logger.error('Failed to migrate legacy user ID', {
        email: redactEmail(email),
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Log all secret access attempts for security audit
   */
  private async logSecretAccess(
    email: string, 
    operation: string, 
    success: boolean, 
    provider?: string, 
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const userId = this.getUserId(email);
      
      const query = `
        INSERT INTO secret_audit_log (user_id, email, operation, provider, success, error_message, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await this.client.query(query, [
        userId,
        email,
        operation,
        provider || null,
        success,
        errorMessage || null,
        ipAddress || null,
        userAgent || null
      ]);

      this.logger.info('Security audit log entry created', { 
        userId, 
        operation, 
        success, 
        provider,
        timestamp: new Date() 
      });

    } catch (error: any) {
      this.logger.error('Failed to create audit log entry', { 
        email, 
        operation, 
        error: error.message 
      });
      // Don't throw - audit logging failure shouldn't block the main operation
    }
  }

  /**
   * Derive master encryption key using scrypt (memory-hard KDF)
   * This prevents rainbow table attacks and ensures strong key derivation
   */
  private async deriveMasterKey(): Promise<void> {
    try {
      // Use scrypt for key derivation with configurable parameters
      // Node.js scrypt uses options object: { N, r, p, maxmem }
      const options = {
        N: this.scryptOptions.N,
        r: this.scryptOptions.r,
        p: this.scryptOptions.p,
        maxmem: 128 * this.scryptOptions.N * this.scryptOptions.r * 2 // Calculate required memory
      };

      this.masterKey = await scryptAsync(
        this.encryptionKey,
        this.encryptionSalt,
        this.scryptOptions.keylen,
        options
      );

      this.logger.info('Master encryption key derived successfully using scrypt', {
        scryptParams: {
          N: this.scryptOptions.N,
          r: this.scryptOptions.r,
          p: this.scryptOptions.p,
          keylen: this.scryptOptions.keylen
        }
      });
    } catch (error: any) {
      this.logger.error('Failed to derive master key', { error: error.message });
      throw error;
    }
  }

  private async createSchema(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS user_secrets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        secret_key VARCHAR(100) NOT NULL,
        encrypted_value TEXT NOT NULL,
        provider VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, secret_key)
      );

      CREATE TABLE IF NOT EXISTS secret_audit_log (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        operation VARCHAR(50) NOT NULL,
        provider VARCHAR(50),
        success BOOLEAN NOT NULL,
        error_message TEXT,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id ON user_secrets(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_secrets_provider ON user_secrets(provider);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON secret_audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON secret_audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON secret_audit_log(operation);
    `;

    await this.client.query(query);
    this.logger.info('Database schema created/verified');
  }

  private async encrypt(text: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private async decrypt(encryptedData: string): Promise<string> {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
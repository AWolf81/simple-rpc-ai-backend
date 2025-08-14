/**
 * PostgreSQL Secret Manager
 * 
 * Simple, secure multi-tenant API key storage using PostgreSQL directly
 * No complex external dependencies - just encrypted storage with proper user isolation
 */

import * as winston from 'winston';
import { Client } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
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

    // Derive encryption key
    this.masterKey = Buffer.from(encryptionKey, 'utf8').subarray(0, 32);
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      await this.createSchema();
      this.logger.info('PostgreSQLSecretManager initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize PostgreSQLSecretManager', { error: error.message });
      throw error;
    }
  }

  /**
   * Store user API key with encryption and isolation
   */
  async storeUserKey(email: string, provider: string, apiKey: string): Promise<SecretOperationResult> {
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

      this.logger.info('User API key stored successfully', { userId, provider, secretId });
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
   */
  async getUserKey(email: string, provider: string): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    try {
      const userId = this.getUserId(email);
      const secretKey = `${provider}_api_key`;
      
      const query = `
        SELECT encrypted_value FROM user_secrets 
        WHERE user_id = $1 AND secret_key = $2
      `;
      
      const result = await this.client.query(query, [userId, secretKey]);
      
      if (result.rows.length === 0) {
        await this.logSecretAccess(email, 'RETRIEVE_KEY', false, provider, `No ${provider} API key found for user`);
        return {
          success: false,
          error: `No ${provider} API key found for user`
        };
      }

      // Decrypt the API key
      const apiKey = await this.decrypt(result.rows[0].encrypted_value);

      this.logger.info('User API key retrieved successfully', { userId, provider });
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
    try {
      const userId = this.getUserId(email);
      
      const query = `
        SELECT DISTINCT provider FROM user_secrets 
        WHERE user_id = $1
      `;
      
      const result = await this.client.query(query, [userId]);
      const providers = result.rows.map(row => row.provider);

      this.logger.info('User providers retrieved', { userId, providers });
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

      this.logger.info('User API key deleted successfully', { userId, provider });
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

      this.logger.info('User API key validation complete', { email, provider, valid: isValidFormat });
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

  private getUserId(email: string): string {
    // Generate consistent user ID from email
    return email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
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
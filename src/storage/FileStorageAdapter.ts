/**
 * File-based Storage Adapter
 * 
 * Simple, encrypted file storage for API keys
 * Perfect for development and small deployments
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageAdapter } from './StorageAdapter.js';
import * as winston from 'winston';

export interface FileStorageData {
  version: string;
  keys: Record<string, {
    provider: string;
    userId?: string;
    encryptedKey: string;
    nonce: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export class FileStorageAdapter implements StorageAdapter {
  private logger: winston.Logger;
  private data: FileStorageData = { version: '1.0', keys: {} };
  private isInitialized = false;
  private readonly algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer;

  constructor(
    private filePath: string,
    private masterKey: string,
    logger?: winston.Logger
  ) {
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });

    // Derive encryption key from master key
    this.encryptionKey = crypto.pbkdf2Sync(masterKey, 'simple-rpc-salt', 100000, 32, 'sha256');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing data or create new file
      if (fs.existsSync(this.filePath)) {
        const encryptedData = fs.readFileSync(this.filePath, 'utf8');
        if (encryptedData.trim()) {
          this.data = this.decryptData(encryptedData);
        }
      }

      // Ensure data structure is correct
      if (!this.data.version) {
        this.data = { version: '1.0', keys: {} };
      }

      this.isInitialized = true;
      this.logger.info('File storage initialized', { 
        path: this.filePath,
        keyCount: Object.keys(this.data.keys).length 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize file storage', { error: errorMessage });
      throw new Error(`File storage initialization failed: ${errorMessage}`);
    }
  }

  async storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string> {
    this.ensureInitialized();
    
    const keyId = this.generateKeyId(provider, userId);
    const { encrypted, nonce } = this.encryptApiKey(apiKey);
    
    this.data.keys[keyId] = {
      provider,
      userId,
      encryptedKey: encrypted,
      nonce,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.save();

    this.logger.info('API key stored in file', {
      provider,
      userId,
      keyId,
    });

    return keyId;
  }

  async getApiKey(provider: string, userId?: string): Promise<string | null> {
    this.ensureInitialized();
    
    const keyId = this.generateKeyId(provider, userId);
    const keyData = this.data.keys[keyId];
    
    if (!keyData) {
      return null;
    }

    try {
      return this.decryptApiKey(keyData.encryptedKey, keyData.nonce);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to decrypt API key', {
        provider,
        userId,
        error: errorMessage
      });
      return null;
    }
  }

  async deleteApiKey(provider: string, userId?: string): Promise<boolean> {
    this.ensureInitialized();
    
    const keyId = this.generateKeyId(provider, userId);
    
    if (!this.data.keys[keyId]) {
      return false;
    }

    delete this.data.keys[keyId];
    await this.save();

    this.logger.info('API key deleted from file', {
      provider,
      userId,
      keyId,
    });

    return true;
  }

  async listProviders(userId?: string): Promise<Array<{provider: string, hasKey: boolean}>> {
    this.ensureInitialized();

    const providers = ['anthropic', 'openai', 'google', 'deepseek', 'openrouter'];
    
    return providers.map(provider => ({
      provider,
      hasKey: !!this.data.keys[this.generateKeyId(provider, userId)]
    }));
  }

  async rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string> {
    // Store new key (will update if exists)
    return await this.storeApiKey(provider, newApiKey, userId);
  }

  async validateApiKey(provider: string, userId?: string): Promise<boolean> {
    const apiKey = await this.getApiKey(provider, userId);
    return !!apiKey;
  }

  async healthCheck(): Promise<{status: 'healthy' | 'unhealthy', details: any}> {
    try {
      this.ensureInitialized();
      
      // Check if file is readable/writable
      fs.accessSync(this.filePath, fs.constants.R_OK | fs.constants.W_OK);
      
      return {
        status: 'healthy',
        details: {
          type: 'file',
          path: this.filePath,
          keyCount: Object.keys(this.data.keys).length,
          version: this.data.version,
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'unhealthy',
        details: {
          type: 'file',
          error: errorMessage,
          path: this.filePath,
        }
      };
    }
  }

  getType(): 'file' {
    return 'file';
  }

  /**
   * Export keys for backup (encrypted)
   */
  async exportKeys(): Promise<string> {
    this.ensureInitialized();
    return this.encryptData(this.data);
  }

  /**
   * Import keys from backup
   */
  async importKeys(encryptedData: string): Promise<void> {
    this.ensureInitialized();
    
    const importedData = this.decryptData(encryptedData);
    
    // Merge with existing data
    this.data.keys = { ...this.data.keys, ...importedData.keys };
    
    await this.save();
    
    this.logger.info('Keys imported successfully', {
      importedCount: Object.keys(importedData.keys).length,
      totalCount: Object.keys(this.data.keys).length,
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('File storage not initialized. Call initialize() first.');
    }
  }

  private generateKeyId(provider: string, userId?: string): string {
    return userId ? `${provider}-${userId}` : `${provider}-default`;
  }

  private encryptApiKey(apiKey: string): { encrypted: string; nonce: string } {
    const nonce = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('api-key'));
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      nonce: nonce.toString('hex')
    };
  }

  private decryptApiKey(encryptedData: string, nonceHex: string): string {
    const [encrypted, authTagHex] = encryptedData.split(':');
    const nonce = Buffer.from(nonceHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('api-key'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private encryptData(data: FileStorageData): string {
    const jsonString = JSON.stringify(data);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('file-data'));
    
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      nonce: nonce.toString('hex'),
      encrypted: encrypted + ':' + authTag.toString('hex'),
    });
  }

  private decryptData(encryptedData: string): FileStorageData {
    const parsed = JSON.parse(encryptedData);
    const [encrypted, authTagHex] = parsed.encrypted.split(':');
    const nonce = Buffer.from(parsed.nonce, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('file-data'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  private async save(): Promise<void> {
    const encryptedData = this.encryptData(this.data);
    fs.writeFileSync(this.filePath, encryptedData, 'utf8');
  }
}
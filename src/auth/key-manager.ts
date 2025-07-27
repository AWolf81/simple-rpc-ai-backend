/**
 * Simple Key Manager - Secure BYOK key storage with AES-256-GCM encryption
 * 
 * Stores user API keys securely with per-user isolation
 */

import { createCipher, createDecipher, randomBytes, createHash } from 'crypto';

export interface UserKey {
  userId: string;
  provider: 'anthropic' | 'openai' | 'google';
  encryptedApiKey: string;
  nonce: string;
  isValid: boolean;
  lastValidated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyValidationResult {
  isValid: boolean;
  error?: string;
  provider: string;
  model?: string;
}

export interface KeyStorageAdapter {
  storeKey(keyData: UserKey): Promise<void>;
  getKey(userId: string, provider: string): Promise<UserKey | null>;
  getUserKeys(userId: string): Promise<UserKey[]>;
  updateKey(userId: string, provider: string, updates: Partial<UserKey>): Promise<UserKey>;
  deleteKey(userId: string, provider: string): Promise<void>;
}

export interface AIProviderValidator {
  validateKey(provider: string, apiKey: string): Promise<KeyValidationResult>;
}

export class SimpleKeyManager {
  private encryptionKey: Buffer;

  constructor(
    private storage: KeyStorageAdapter,
    private validator: AIProviderValidator,
    masterKey: string
  ) {
    // Derive encryption key from master key
    this.encryptionKey = createHash('sha256')
      .update(masterKey)
      .digest();
  }

  /**
   * Encrypt API key with AES-256-GCM
   */
  private encryptApiKey(apiKey: string): { encrypted: string; nonce: string } {
    const algorithm = 'aes-256-gcm';
    const nonce = randomBytes(12); // 96-bit nonce for GCM
    const cipher = require('crypto').createCipher(algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('api-key')); // Additional authenticated data
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      nonce: nonce.toString('hex')
    };
  }

  /**
   * Decrypt API key with AES-256-GCM
   */
  private decryptApiKey(encryptedData: string, nonceHex: string): string {
    const algorithm = 'aes-256-gcm';
    const [encrypted, authTagHex] = encryptedData.split(':');
    const nonce = Buffer.from(nonceHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = require('crypto').createDecipher(algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('api-key'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store user API key with validation
   */
  async storeUserKey(userId: string, provider: string, apiKey: string): Promise<void> {
    if (!userId || !provider || !apiKey) {
      throw new Error('Missing required parameters: userId, provider, apiKey');
    }

    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Validate API key before storing
    const validationResult = await this.validator.validateKey(provider, apiKey);
    if (!validationResult.isValid) {
      throw new Error(`Invalid API key for ${provider}: ${validationResult.error}`);
    }

    // Encrypt the API key
    const { encrypted, nonce } = this.encryptApiKey(apiKey);

    // Store encrypted key
    const keyData: UserKey = {
      userId,
      provider: provider as any,
      encryptedApiKey: encrypted,
      nonce,
      isValid: true,
      lastValidated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storage.storeKey(keyData);
  }

  /**
   * Get user API key (decrypted)
   */
  async getUserKey(userId: string, provider: string): Promise<string | null> {
    if (!userId || !provider) {
      throw new Error('Missing required parameters: userId, provider');
    }

    const keyRecord = await this.storage.getKey(userId, provider);
    if (!keyRecord) {
      return null;
    }

    if (!keyRecord.isValid) {
      throw new Error(`API key for ${provider} is marked as invalid`);
    }

    try {
      return this.decryptApiKey(keyRecord.encryptedApiKey, keyRecord.nonce);
    } catch (error: any) {
      throw new Error(`Failed to decrypt API key: ${error.message}`);
    }
  }

  /**
   * Get all providers configured for user
   */
  async getUserProviders(userId: string): Promise<string[]> {
    if (!userId) {
      throw new Error('Missing required parameter: userId');
    }

    const keys = await this.storage.getUserKeys(userId);
    return keys
      .filter(key => key.isValid)
      .map(key => key.provider);
  }

  /**
   * Validate user API key (re-test with provider)
   */
  async validateUserKey(userId: string, provider: string): Promise<boolean> {
    const apiKey = await this.getUserKey(userId, provider);
    if (!apiKey) {
      return false;
    }

    try {
      const result = await this.validator.validateKey(provider, apiKey);
      
      // Update validation status in storage
      await this.storage.updateKey(userId, provider, {
        isValid: result.isValid,
        lastValidated: new Date(),
        updatedAt: new Date()
      });

      return result.isValid;
    } catch (error) {
      // Mark key as invalid on validation error
      await this.storage.updateKey(userId, provider, {
        isValid: false,
        lastValidated: new Date(),
        updatedAt: new Date()
      });
      return false;
    }
  }

  /**
   * Rotate user API key
   */
  async rotateUserKey(userId: string, provider: string, newApiKey: string): Promise<void> {
    // Validate new key first
    const validationResult = await this.validator.validateKey(provider, newApiKey);
    if (!validationResult.isValid) {
      throw new Error(`Invalid new API key for ${provider}: ${validationResult.error}`);
    }

    // Encrypt new key
    const { encrypted, nonce } = this.encryptApiKey(newApiKey);

    // Update stored key
    await this.storage.updateKey(userId, provider, {
      encryptedApiKey: encrypted,
      nonce,
      isValid: true,
      lastValidated: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Delete user API key
   */
  async deleteUserKey(userId: string, provider: string): Promise<void> {
    if (!userId || !provider) {
      throw new Error('Missing required parameters: userId, provider');
    }

    await this.storage.deleteKey(userId, provider);
  }

  /**
   * Get key metadata (without decrypting)
   */
  async getKeyMetadata(userId: string, provider: string): Promise<Omit<UserKey, 'encryptedApiKey' | 'nonce'> | null> {
    const keyRecord = await this.storage.getKey(userId, provider);
    if (!keyRecord) {
      return null;
    }

    const { encryptedApiKey, nonce, ...metadata } = keyRecord;
    return metadata;
  }

  /**
   * Validate all user keys (maintenance operation)
   */
  async validateAllUserKeys(userId: string): Promise<{ [provider: string]: boolean }> {
    const keys = await this.storage.getUserKeys(userId);
    const results: { [provider: string]: boolean } = {};

    for (const key of keys) {
      try {
        results[key.provider] = await this.validateUserKey(userId, key.provider);
      } catch (error) {
        results[key.provider] = false;
      }
    }

    return results;
  }

  /**
   * Get usage statistics for user keys
   */
  async getKeyUsageStats(userId: string): Promise<{
    totalKeys: number;
    validKeys: number;
    invalidKeys: number;
    providers: string[];
    lastValidated?: Date;
  }> {
    const keys = await this.storage.getUserKeys(userId);
    
    const validKeys = keys.filter(k => k.isValid);
    const invalidKeys = keys.filter(k => !k.isValid);
    const lastValidated = keys
      .filter(k => k.lastValidated)
      .map(k => k.lastValidated!)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      totalKeys: keys.length,
      validKeys: validKeys.length,
      invalidKeys: invalidKeys.length,
      providers: keys.map(k => k.provider),
      lastValidated
    };
  }

  /**
   * Check if user has any valid keys
   */
  async hasValidKeys(userId: string): Promise<boolean> {
    const keys = await this.storage.getUserKeys(userId);
    return keys.some(key => key.isValid);
  }

  /**
   * Get preferred provider for user (most recently validated)
   */
  async getPreferredProvider(userId: string): Promise<string | null> {
    const keys = await this.storage.getUserKeys(userId);
    const validKeys = keys.filter(k => k.isValid && k.lastValidated);
    
    if (validKeys.length === 0) {
      return null;
    }

    // Sort by last validated, most recent first
    validKeys.sort((a, b) => {
      const aTime = a.lastValidated?.getTime() || 0;
      const bTime = b.lastValidated?.getTime() || 0;
      return bTime - aTime;
    });

    return validKeys[0].provider;
  }
}
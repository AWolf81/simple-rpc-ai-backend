/**
 * Simple Key Manager - Secure BYOK key storage with AES-256-GCM encryption
 *
 * Stores user API keys securely with per-user isolation
 */
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
export declare class SimpleKeyManager {
    private storage;
    private validator;
    private encryptionKey;
    constructor(storage: KeyStorageAdapter, validator: AIProviderValidator, masterKey: string);
    /**
     * Encrypt API key with AES-256-GCM
     */
    private encryptApiKey;
    /**
     * Decrypt API key with AES-256-GCM
     */
    private decryptApiKey;
    /**
     * Store user API key with validation
     */
    storeUserKey(userId: string, provider: string, apiKey: string): Promise<void>;
    /**
     * Get user API key (decrypted)
     */
    getUserKey(userId: string, provider: string): Promise<string | null>;
    /**
     * Get all providers configured for user
     */
    getUserProviders(userId: string): Promise<string[]>;
    /**
     * Validate user API key (re-test with provider)
     */
    validateUserKey(userId: string, provider: string): Promise<boolean>;
    /**
     * Rotate user API key
     */
    rotateUserKey(userId: string, provider: string, newApiKey: string): Promise<void>;
    /**
     * Delete user API key
     */
    deleteUserKey(userId: string, provider: string): Promise<void>;
    /**
     * Get key metadata (without decrypting)
     */
    getKeyMetadata(userId: string, provider: string): Promise<Omit<UserKey, 'encryptedApiKey' | 'nonce'> | null>;
    /**
     * Validate all user keys (maintenance operation)
     */
    validateAllUserKeys(userId: string): Promise<{
        [provider: string]: boolean;
    }>;
    /**
     * Get usage statistics for user keys
     */
    getKeyUsageStats(userId: string): Promise<{
        totalKeys: number;
        validKeys: number;
        invalidKeys: number;
        providers: string[];
        lastValidated?: Date;
    }>;
    /**
     * Check if user has any valid keys
     */
    hasValidKeys(userId: string): Promise<boolean>;
    /**
     * Get preferred provider for user (most recently validated)
     */
    getPreferredProvider(userId: string): Promise<string | null>;
}
//# sourceMappingURL=key-manager.d.ts.map
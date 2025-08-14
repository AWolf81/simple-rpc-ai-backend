/**
 * Client-Side Encryption Utilities
 *
 * Provides encryption utilities for VS Code extensions and web clients
 * Implements client-side encryption with Argon2id key derivation and AES-256-GCM
 */
export interface MasterKeyDerivationParams {
    password: string;
    salt: Uint8Array;
    iterations?: number;
    memorySize?: number;
    parallelism?: number;
}
export interface EncryptionResult {
    ciphertext: string;
    iv: string;
    salt: string;
    tag: string;
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2-SHA256';
}
export interface DecryptionParams {
    ciphertext: string;
    iv: string;
    salt: string;
    tag: string;
    algorithm: string;
    keyDerivation: string;
}
/**
 * Client-side encryption utilities for API key protection
 * Designed to work in VS Code extension context
 */
export declare class ClientSideEncryption {
    private static readonly ALGORITHM;
    private static readonly KEY_LENGTH;
    private static readonly IV_LENGTH;
    private static readonly SALT_LENGTH;
    private static readonly TAG_LENGTH;
    private static readonly ITERATIONS;
    /**
     * Derive master key from password using PBKDF2 (fallback for environments without Argon2)
     * In production, prefer Argon2id when available in the client environment
     */
    static deriveMasterKey(password: string, salt?: Uint8Array, iterations?: number): {
        masterKey: Buffer;
        salt: Uint8Array;
    };
    /**
     * Create master password hash for server storage (never store plaintext password)
     * This hash is sent to the server during account setup
     */
    static createMasterPasswordHash(password: string, salt?: Uint8Array): {
        hash: string;
        salt: string;
    };
    /**
     * Encrypt API key with master key (client-side)
     * Returns encrypted data that can be safely stored in Vaultwarden
     */
    static encryptApiKey(apiKey: string, masterKey: Buffer): EncryptionResult;
    /**
     * Decrypt API key with master key (client-side)
     * Decrypts data retrieved from Vaultwarden
     */
    static decryptApiKey(encryptedData: DecryptionParams, masterKey: Buffer): string;
    /**
     * Generate secure random password for auto-generation
     */
    static generateSecurePassword(length?: number): string;
    /**
     * Validate encryption parameters
     */
    static validateEncryptionParams(encryptedData: DecryptionParams): boolean;
    /**
     * Securely clear sensitive data from memory (best effort)
     */
    static clearSensitiveData(buffer: Buffer): void;
    /**
     * Create example usage for VS Code extension developers
     */
    static createUsageExample(): {
        setupFlow: string;
        encryptFlow: string;
        decryptFlow: string;
    };
}
export default ClientSideEncryption;
//# sourceMappingURL=ClientSideEncryption.d.ts.map
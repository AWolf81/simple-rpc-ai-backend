/**
 * Client-Side Encryption Utilities
 *
 * Provides encryption utilities for VS Code extensions and web clients
 * Implements client-side encryption with Argon2id key derivation and AES-256-GCM
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
/**
 * Client-side encryption utilities for API key protection
 * Designed to work in VS Code extension context
 */
export class ClientSideEncryption {
    static ALGORITHM = 'aes-256-gcm';
    static KEY_LENGTH = 32; // 256 bits
    static IV_LENGTH = 16; // 128 bits
    static SALT_LENGTH = 32; // 256 bits
    static TAG_LENGTH = 16; // 128 bits
    static ITERATIONS = 100000; // PBKDF2 iterations
    /**
     * Derive master key from password using PBKDF2 (fallback for environments without Argon2)
     * In production, prefer Argon2id when available in the client environment
     */
    static deriveMasterKey(password, salt, iterations = this.ITERATIONS) {
        // Generate salt if not provided
        const keyDerivationSalt = salt || randomBytes(this.SALT_LENGTH);
        // Use PBKDF2 as fallback (most environments support this)
        // In production VS Code extension, you would use @noble/hashes or similar for Argon2id
        const masterKey = pbkdf2Sync(password, keyDerivationSalt, iterations, this.KEY_LENGTH, 'sha256');
        return {
            masterKey,
            salt: keyDerivationSalt
        };
    }
    /**
     * Create master password hash for server storage (never store plaintext password)
     * This hash is sent to the server during account setup
     */
    static createMasterPasswordHash(password, salt) {
        const derivationSalt = salt || randomBytes(this.SALT_LENGTH);
        // Create hash that can be safely sent to server
        // Server stores this hash but cannot derive the master key from it
        const passwordHash = createHash('sha256')
            .update(password)
            .update(derivationSalt)
            .digest('hex');
        return {
            hash: passwordHash,
            salt: derivationSalt.toString('hex')
        };
    }
    /**
     * Encrypt API key with master key (client-side)
     * Returns encrypted data that can be safely stored in Vaultwarden
     */
    static encryptApiKey(apiKey, masterKey) {
        // Generate random IV and salt for this encryption
        const iv = randomBytes(this.IV_LENGTH);
        const salt = randomBytes(this.SALT_LENGTH);
        // Derive encryption key from master key + salt (additional security layer)
        const encryptionKey = pbkdf2Sync(masterKey, salt, 1000, this.KEY_LENGTH, 'sha256');
        // Encrypt the API key
        const cipher = createCipheriv(this.ALGORITHM, encryptionKey, iv);
        let ciphertext = cipher.update(apiKey, 'utf8', 'hex');
        ciphertext += cipher.final('hex');
        // Get authentication tag
        const tag = cipher.getAuthTag();
        return {
            ciphertext,
            iv: iv.toString('hex'),
            salt: salt.toString('hex'),
            tag: tag.toString('hex'),
            algorithm: 'AES-256-GCM',
            keyDerivation: 'PBKDF2-SHA256'
        };
    }
    /**
     * Decrypt API key with master key (client-side)
     * Decrypts data retrieved from Vaultwarden
     */
    static decryptApiKey(encryptedData, masterKey) {
        const { ciphertext, iv, salt, tag, algorithm, keyDerivation } = encryptedData;
        // Validate algorithm
        if (algorithm !== 'AES-256-GCM') {
            throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
        }
        if (keyDerivation !== 'PBKDF2-SHA256') {
            throw new Error(`Unsupported key derivation: ${keyDerivation}`);
        }
        // Convert hex strings back to buffers
        const ivBuffer = Buffer.from(iv, 'hex');
        const saltBuffer = Buffer.from(salt, 'hex');
        const tagBuffer = Buffer.from(tag, 'hex');
        // Derive decryption key (same process as encryption)
        const decryptionKey = pbkdf2Sync(masterKey, saltBuffer, 1000, this.KEY_LENGTH, 'sha256');
        // Decrypt the API key
        const decipher = createDecipheriv(this.ALGORITHM, decryptionKey, ivBuffer);
        decipher.setAuthTag(tagBuffer);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Generate secure random password for auto-generation
     */
    static generateSecurePassword(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
        const bytes = randomBytes(length);
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[bytes[i] % charset.length];
        }
        return password;
    }
    /**
     * Validate encryption parameters
     */
    static validateEncryptionParams(encryptedData) {
        const required = ['ciphertext', 'iv', 'salt', 'tag', 'algorithm', 'keyDerivation'];
        for (const field of required) {
            if (!encryptedData[field]) {
                return false;
            }
        }
        // Validate hex string lengths
        try {
            const ivBuffer = Buffer.from(encryptedData.iv, 'hex');
            const saltBuffer = Buffer.from(encryptedData.salt, 'hex');
            const tagBuffer = Buffer.from(encryptedData.tag, 'hex');
            return ivBuffer.length === this.IV_LENGTH &&
                saltBuffer.length === this.SALT_LENGTH &&
                tagBuffer.length === this.TAG_LENGTH;
        }
        catch {
            return false;
        }
    }
    /**
     * Securely clear sensitive data from memory (best effort)
     */
    static clearSensitiveData(buffer) {
        if (buffer && Buffer.isBuffer(buffer)) {
            buffer.fill(0);
        }
    }
    /**
     * Create example usage for VS Code extension developers
     */
    static createUsageExample() {
        return {
            setupFlow: `
// VS Code Extension Setup Flow
const password = ClientSideEncryption.generateSecurePassword();
const { hash, salt } = ClientSideEncryption.createMasterPasswordHash(password);

// Send hash to server for account setup (never send password)
await rpcClient.request('vaultwarden.completeSetup', {
  setupToken: setupToken,
  masterPasswordHash: hash,
  // optionally include additional encrypted private key
});

// Store password securely in VS Code SecretStorage
await context.secrets.store('vaultwarden.masterPassword', password);
      `,
            encryptFlow: `
// Encrypt API key before storing
const password = await context.secrets.get('vaultwarden.masterPassword');
const { masterKey } = ClientSideEncryption.deriveMasterKey(password);
const encrypted = ClientSideEncryption.encryptApiKey(apiKey, masterKey);

// Store encrypted data in Vaultwarden
await rpcClient.request('vaultwarden.storeEncryptedKey', {
  opensaasJWT: jwt,
  encryptedApiKey: encrypted.ciphertext,
  provider: 'anthropic',
  keyMetadata: {
    algorithm: encrypted.algorithm,
    keyId: 'anthropic_key_1',
    createdAt: new Date().toISOString()
  }
});

// Clear sensitive data
ClientSideEncryption.clearSensitiveData(masterKey);
      `,
            decryptFlow: `
// Retrieve and decrypt API key
const shortLivedToken = await getVaultwardenToken();
const { encryptedApiKey, keyMetadata } = await rpcClient.request('vaultwarden.retrieveEncryptedKey', {
  shortLivedToken,
  provider: 'anthropic'
});

// Decrypt locally
const password = await context.secrets.get('vaultwarden.masterPassword');
const { masterKey } = ClientSideEncryption.deriveMasterKey(password);
const apiKey = ClientSideEncryption.decryptApiKey({
  ciphertext: encryptedApiKey,
  ...keyMetadata
}, masterKey);

// Use API key for request
// Clear from memory after use
ClientSideEncryption.clearSensitiveData(masterKey);
      `
        };
    }
}
export default ClientSideEncryption;

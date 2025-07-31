/**
 * Nonce Management Service
 *
 * Manages short-lived nonces for extension authentication challenges.
 * Provides secure nonce generation, validation, and automatic cleanup.
 */
import { randomBytes } from 'crypto';
export class NonceManager {
    nonces = new Map();
    cleanupInterval;
    expirationMs;
    constructor(expirationMs = 30000) {
        this.expirationMs = expirationMs;
        // Cleanup expired nonces every 30 seconds
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredNonces();
        }, 30000);
    }
    /**
     * Generate a new nonce for extension authentication
     */
    generateNonce() {
        const nonce = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + this.expirationMs);
        this.nonces.set(nonce, {
            value: nonce,
            expiresAt,
            used: false
        });
        return { nonce, expiresAt };
    }
    /**
     * Validate and consume a nonce
     */
    validateNonce(nonceValue) {
        const nonce = this.nonces.get(nonceValue);
        if (!nonce) {
            return false; // Nonce not found
        }
        if (nonce.used) {
            return false; // Nonce already used
        }
        if (nonce.expiresAt < new Date()) {
            this.nonces.delete(nonceValue);
            return false; // Nonce expired
        }
        // Mark as used and remove
        nonce.used = true;
        this.nonces.delete(nonceValue);
        return true;
    }
    /**
     * Check if nonce exists and is valid (without consuming)
     */
    isValidNonce(nonceValue) {
        const nonce = this.nonces.get(nonceValue);
        if (!nonce || nonce.used) {
            return false;
        }
        if (nonce.expiresAt < new Date()) {
            this.nonces.delete(nonceValue);
            return false;
        }
        return true;
    }
    /**
     * Get nonce statistics for monitoring
     */
    getStats() {
        const now = new Date();
        let expired = 0;
        let valid = 0;
        for (const nonce of this.nonces.values()) {
            if (nonce.expiresAt < now || nonce.used) {
                expired++;
            }
            else {
                valid++;
            }
        }
        return {
            totalNonces: this.nonces.size,
            expiredNonces: expired,
            validNonces: valid
        };
    }
    /**
     * Clean up expired nonces (maintenance task)
     */
    cleanupExpiredNonces() {
        const now = new Date();
        let cleaned = 0;
        for (const [nonceValue, nonce] of this.nonces.entries()) {
            if (nonce.expiresAt < now || nonce.used) {
                this.nonces.delete(nonceValue);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired nonces`);
        }
        return cleaned;
    }
    /**
     * Force cleanup all nonces (for testing or shutdown)
     */
    clearAllNonces() {
        this.nonces.clear();
    }
    /**
     * Shutdown cleanup
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clearAllNonces();
    }
}
//# sourceMappingURL=nonce-manager.js.map
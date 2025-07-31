/**
 * Nonce Management Service
 *
 * Manages short-lived nonces for extension authentication challenges.
 * Provides secure nonce generation, validation, and automatic cleanup.
 */
export interface Nonce {
    value: string;
    expiresAt: Date;
    used: boolean;
}
export interface NonceResult {
    nonce: string;
    expiresAt: Date;
}
export declare class NonceManager {
    private nonces;
    private cleanupInterval;
    private readonly expirationMs;
    constructor(expirationMs?: number);
    /**
     * Generate a new nonce for extension authentication
     */
    generateNonce(): NonceResult;
    /**
     * Validate and consume a nonce
     */
    validateNonce(nonceValue: string): boolean;
    /**
     * Check if nonce exists and is valid (without consuming)
     */
    isValidNonce(nonceValue: string): boolean;
    /**
     * Get nonce statistics for monitoring
     */
    getStats(): {
        totalNonces: number;
        expiredNonces: number;
        validNonces: number;
    };
    /**
     * Clean up expired nonces (maintenance task)
     */
    private cleanupExpiredNonces;
    /**
     * Force cleanup all nonces (for testing or shutdown)
     */
    clearAllNonces(): void;
    /**
     * Shutdown cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=nonce-manager.d.ts.map
/**
 * JWT Token Management Service
 *
 * Handles JWT token generation, validation, and extension claim management
 * for secure extension authentication.
 */
export interface ExtensionClaims {
    userId: string;
    deviceId: string;
    extensionId: string;
    extensionVersion: string;
    authLevel: 'anonymous' | 'sso' | 'pro';
    iat: number;
    exp: number;
}
export interface JWTConfig {
    secret: string;
    expirationMs: number;
    issuer?: string;
    audience?: string;
}
export declare class JWTManager {
    private config;
    constructor(config: JWTConfig);
    /**
     * Generate JWT token for extension authentication
     */
    generateToken(claims: Omit<ExtensionClaims, 'iat' | 'exp'>): string;
    /**
     * Validate and decode JWT token
     */
    validateToken(token: string): ExtensionClaims | null;
    /**
     * Check if token is expired (without full validation)
     */
    isTokenExpired(token: string): boolean;
    /**
     * Extract claims without validation (for debugging)
     */
    decodeClaims(token: string): ExtensionClaims | null;
    /**
     * Get time until token expiration
     */
    getTimeToExpiration(token: string): number | null;
    /**
     * Refresh token if close to expiration
     */
    refreshTokenIfNeeded(token: string, refreshThresholdMs?: number): string | null;
    /**
     * Extract extension context for logging/audit
     */
    getExtensionContext(token: string): {
        extensionId: string;
        extensionVersion: string;
        userId: string;
        deviceId: string;
    } | null;
    /**
     * Create JWT for different auth levels
     */
    createAnonymousToken(userId: string, deviceId: string, extensionId: string, extensionVersion: string): string;
    createSSOToken(userId: string, deviceId: string, extensionId: string, extensionVersion: string): string;
    createProToken(userId: string, deviceId: string, extensionId: string, extensionVersion: string): string;
}
//# sourceMappingURL=jwt-manager.d.ts.map
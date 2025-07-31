/**
 * JWT Token Management Service
 *
 * Handles JWT token generation, validation, and extension claim management
 * for secure extension authentication.
 */
import jwt from 'jsonwebtoken';
export class JWTManager {
    config;
    constructor(config) {
        this.config = {
            issuer: 'simple-rpc-ai-backend',
            audience: 'vscode-extensions',
            ...config
        };
        // Set default expiration if not provided
        if (!this.config.expirationMs) {
            this.config.expirationMs = 600000; // 10 minutes default
        }
        if (!this.config.secret) {
            throw new Error('JWT secret is required');
        }
    }
    /**
     * Generate JWT token for extension authentication
     */
    generateToken(claims) {
        const now = Math.floor(Date.now() / 1000);
        const exp = Math.floor((Date.now() + this.config.expirationMs) / 1000);
        const payload = {
            ...claims,
            iat: now,
            exp
        };
        return jwt.sign(payload, this.config.secret, {
            issuer: this.config.issuer,
            audience: this.config.audience,
            algorithm: 'HS256'
        });
    }
    /**
     * Validate and decode JWT token
     */
    validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.secret, {
                issuer: this.config.issuer,
                audience: this.config.audience,
                algorithms: ['HS256']
            });
            // Additional validation
            if (!decoded.userId || !decoded.deviceId || !decoded.extensionId) {
                console.warn('⚠️ JWT token missing required claims');
                return null;
            }
            return decoded;
        }
        catch (error) {
            console.warn(`⚠️ JWT validation failed: ${error.message}`);
            return null;
        }
    }
    /**
     * Check if token is expired (without full validation)
     */
    isTokenExpired(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp < now;
        }
        catch {
            return true;
        }
    }
    /**
     * Extract claims without validation (for debugging)
     */
    decodeClaims(token) {
        try {
            const decoded = jwt.decode(token);
            return decoded;
        }
        catch {
            return null;
        }
    }
    /**
     * Get time until token expiration
     */
    getTimeToExpiration(token) {
        const claims = this.decodeClaims(token);
        if (!claims || !claims.exp) {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        const timeToExp = claims.exp - now;
        return timeToExp > 0 ? timeToExp * 1000 : 0; // Return milliseconds
    }
    /**
     * Refresh token if close to expiration
     */
    refreshTokenIfNeeded(token, refreshThresholdMs = 120000 // 2 minutes
    ) {
        const timeToExp = this.getTimeToExpiration(token);
        if (timeToExp === null || timeToExp <= 0) {
            return null; // Token invalid or expired
        }
        if (timeToExp <= refreshThresholdMs) {
            const claims = this.validateToken(token);
            if (claims) {
                // Generate new token with same claims
                const { iat, exp, ...claimsWithoutTiming } = claims;
                return this.generateToken(claimsWithoutTiming);
            }
        }
        return token; // Token still valid, no refresh needed
    }
    /**
     * Extract extension context for logging/audit
     */
    getExtensionContext(token) {
        const claims = this.validateToken(token);
        if (!claims) {
            return null;
        }
        return {
            extensionId: claims.extensionId,
            extensionVersion: claims.extensionVersion,
            userId: claims.userId,
            deviceId: claims.deviceId
        };
    }
    /**
     * Create JWT for different auth levels
     */
    createAnonymousToken(userId, deviceId, extensionId, extensionVersion) {
        return this.generateToken({
            userId,
            deviceId,
            extensionId,
            extensionVersion,
            authLevel: 'anonymous'
        });
    }
    createSSOToken(userId, deviceId, extensionId, extensionVersion) {
        return this.generateToken({
            userId,
            deviceId,
            extensionId,
            extensionVersion,
            authLevel: 'sso'
        });
    }
    createProToken(userId, deviceId, extensionId, extensionVersion) {
        return this.generateToken({
            userId,
            deviceId,
            extensionId,
            extensionVersion,
            authLevel: 'pro'
        });
    }
}
//# sourceMappingURL=jwt-manager.js.map
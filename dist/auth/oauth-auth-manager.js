/**
 * Simplified OAuth Authentication Manager
 *
 * Uses VS Code's built-in authentication providers instead of private keys.
 * Much simpler and more secure approach using standard OAuth flows.
 */
import axios from 'axios';
import { createHash } from 'crypto';
export class OAuthAuthManager {
    config;
    activeSessions = new Map();
    dbAdapter; // Database adapter for persistence
    // Admin security tracking (in-memory for performance, backed by DB)
    dynamicBlacklist = new Set(); // Runtime blacklist
    dynamicAllowlist = new Set(); // Runtime allowlist override
    requestCounts = new Map(); // User request tracking
    violationCounts = new Map(); // Violation tracking for auto-blacklist
    // Role management
    userRoles = new Map(); // email -> roles mapping
    // User limits tracking
    registeredUsers = new Set(); // All users who have ever authenticated (by email)
    waitlist = new Map(); // Waiting users when limit reached
    constructor(config) {
        this.config = {
            sessionExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
            requireVerifiedEmail: true,
            ...config
        };
        // Initialize roles from config
        this.initializeRoles();
    }
    /**
     * Initialize roles from configuration
     */
    initializeRoles() {
        const now = new Date();
        // Set super admins from config
        this.config.superAdmins?.forEach(email => {
            this.userRoles.set(email, {
                email,
                roles: ['super_admin', 'admin', 'user'],
                grantedBy: 'system',
                grantedAt: now
            });
            console.log(`🔱 Super admin configured: ${email}`);
        });
        // Set initial admins from config
        this.config.initialAdmins?.forEach(email => {
            if (!this.userRoles.has(email)) { // Don't override super admins
                this.userRoles.set(email, {
                    email,
                    roles: ['admin', 'user'],
                    grantedBy: 'system',
                    grantedAt: now
                });
                console.log(`👑 Admin configured: ${email}`);
            }
        });
    }
    /**
     * Authenticate extension using OAuth token from VS Code
     */
    async authenticateWithOAuth(extensionId, provider, accessToken, deviceId) {
        // 1. Validate provider is allowed
        if (!this.config.allowedProviders.includes(provider)) {
            throw new Error(`OAuth provider '${provider}' not allowed`);
        }
        // 2. Validate token and get user info
        const userInfo = await this.validateOAuthToken(provider, accessToken);
        // 3. Check user is not blacklisted
        if (this.isUserBlacklisted(userInfo.email, userInfo.id)) {
            console.warn(`🚫 Blacklisted user attempted authentication: ${userInfo.email}`);
            throw new Error(`User '${userInfo.email}' is blacklisted`);
        }
        // 4. Check rate limiting
        this.checkRateLimit(userInfo);
        // 5. Check access control based on mode
        const accessMode = this.config.accessMode || 'open';
        switch (accessMode) {
            case 'allowlist':
                // Only explicitly allowed users can access
                if (!this.isUserAllowed(userInfo.email, userInfo.id)) {
                    throw new Error(`User '${userInfo.email}' not authorized for this server`);
                }
                break;
            case 'development':
                // Only configured developers can access
                if (!this.config.allowedUsers?.some(allowed => allowed === userInfo.email || allowed === userInfo.id)) {
                    throw new Error(`Development server: User '${userInfo.email}' not in developer list`);
                }
                break;
            case 'open':
            default:
                // Anyone can access (subject to blacklist only)
                break;
        }
        // 4. Check organization membership (if configured)
        if (this.config.allowedOrgs?.length && provider === 'github') {
            const userOrgs = await this.getUserOrganizations(provider, accessToken);
            const hasAllowedOrg = this.config.allowedOrgs.some(org => userOrgs.includes(org));
            if (!hasAllowedOrg) {
                throw new Error(`User not member of allowed organizations`);
            }
        }
        // 5. Check email verification
        if (this.config.requireVerifiedEmail && !userInfo.email) {
            throw new Error('Verified email required but not available');
        }
        // 6. Check user limits (public beta functionality)
        await this.checkUserLimits(userInfo.email, provider);
        // 7. Determine user roles
        const userRoles = this.getUserRoles(userInfo.email);
        // 8. Create session
        const session = {
            userId: userInfo.id,
            deviceId,
            extensionId,
            authLevel: 'oauth',
            provider,
            accessToken,
            userInfo,
            isValid: true,
            expiresAt: new Date(Date.now() + this.config.sessionExpirationMs),
            lastActivity: new Date(),
            roles: userRoles
        };
        // 9. Store session and register user
        const sessionToken = this.generateSessionToken(session);
        this.activeSessions.set(sessionToken, session);
        // Add user to registered users set (for user limit tracking)
        this.registeredUsers.add(userInfo.email);
        console.log(`✅ OAuth authentication successful`);
        console.log(`   👤 User: ${userInfo.name} (${userInfo.email})`);
        console.log(`   🔐 Provider: ${provider}`);
        console.log(`   🎯 Extension: ${extensionId}`);
        return { session, sessionToken };
    }
    /**
     * Validate OAuth token with provider
     */
    async validateOAuthToken(provider, accessToken) {
        try {
            switch (provider) {
                case 'github': {
                    const response = await axios.get('https://api.github.com/user', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    const user = response.data;
                    return {
                        id: user.id.toString(),
                        email: user.email,
                        name: user.name || user.login,
                        avatar: user.avatar_url
                    };
                }
                case 'google': {
                    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    const user = response.data;
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        avatar: user.picture
                    };
                }
                case 'microsoft': {
                    console.log(`🔍 Microsoft token structure:`, {
                        length: accessToken.length,
                        prefix: accessToken.substring(0, 20),
                        isJWT: accessToken.includes('.')
                    });
                    // For VS Code's Microsoft provider, extract user info from JWT instead of API call
                    if (accessToken.includes('.')) {
                        try {
                            const parts = accessToken.split('.');
                            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                            console.log(`🔍 JWT payload extracted:`, {
                                name: payload.name,
                                preferred_username: payload.preferred_username,
                                unique_name: payload.unique_name,
                                upn: payload.upn
                            });
                            // Extract user info directly from JWT
                            return {
                                id: payload.oid || payload.sub,
                                email: payload.preferred_username || payload.upn || payload.unique_name,
                                name: payload.name || payload.preferred_username,
                                avatar: undefined // No avatar available from JWT
                            };
                        }
                        catch (decodeError) {
                            console.log(`⚠️ Could not decode JWT:`, decodeError);
                            // Fall back to API call if JWT decode fails
                        }
                    }
                    // Fallback: try API call (will likely fail but good to try)
                    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    const user = response.data;
                    return {
                        id: user.id,
                        email: user.mail || user.userPrincipalName,
                        name: user.displayName,
                        avatar: user.photo?.['@odata.mediaContentType'] ?
                            `https://graph.microsoft.com/v1.0/me/photo/$value` : undefined
                    };
                }
                default:
                    throw new Error(`Unsupported OAuth provider: ${provider}`);
            }
        }
        catch (error) {
            console.error(`❌ OAuth token validation failed for ${provider}:`, error.message);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Response:`, error.response.data);
            }
            throw new Error(`Invalid OAuth token for ${provider}`);
        }
    }
    /**
     * Get user's organizations (GitHub only for now)
     */
    async getUserOrganizations(provider, accessToken) {
        if (provider !== 'github') {
            return []; // Only GitHub orgs supported for now
        }
        try {
            const response = await axios.get('https://api.github.com/user/orgs', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return response.data.map((org) => org.login);
        }
        catch (error) {
            console.warn('⚠️ Could not fetch user organizations:', error);
            return [];
        }
    }
    /**
     * Generate session token
     */
    generateSessionToken(session) {
        const tokenData = [
            session.userId,
            session.deviceId,
            session.extensionId,
            session.provider,
            Date.now()
        ].join('|');
        const hash = createHash('sha256');
        hash.update(tokenData);
        return `oauth_${hash.digest('hex').substring(0, 32)}`;
    }
    /**
     * Validate session token
     */
    validateSession(sessionToken) {
        const session = this.activeSessions.get(sessionToken);
        if (!session || !session.isValid) {
            return null;
        }
        // Check expiration
        if (session.expiresAt && session.expiresAt < new Date()) {
            session.isValid = false;
            this.activeSessions.delete(sessionToken);
            return null;
        }
        // Update last activity
        session.lastActivity = new Date();
        return session;
    }
    /**
     * Get session by token
     */
    getSession(sessionToken) {
        return this.validateSession(sessionToken);
    }
    /**
     * Invalidate session
     */
    invalidateSession(sessionToken) {
        const session = this.activeSessions.get(sessionToken);
        if (session) {
            session.isValid = false;
            this.activeSessions.delete(sessionToken);
        }
    }
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        let cleaned = 0;
        const now = new Date();
        for (const [token, session] of this.activeSessions) {
            if (session.expiresAt && session.expiresAt < now) {
                this.activeSessions.delete(token);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired OAuth sessions`);
        }
        return cleaned;
    }
    /**
     * Get authentication statistics
     */
    getStats() {
        const stats = {
            activeSessions: this.activeSessions.size,
            sessionsByProvider: {},
            sessionsByExtension: {},
            sessionsByUser: {}
        };
        for (const session of this.activeSessions.values()) {
            // Count by provider
            stats.sessionsByProvider[session.provider] =
                (stats.sessionsByProvider[session.provider] || 0) + 1;
            // Count by extension
            stats.sessionsByExtension[session.extensionId] =
                (stats.sessionsByExtension[session.extensionId] || 0) + 1;
            // Count by user
            stats.sessionsByUser[session.userInfo.email] =
                (stats.sessionsByUser[session.userInfo.email] || 0) + 1;
        }
        return stats;
    }
    /**
     * Check if user is blacklisted
     */
    isUserBlacklisted(email, userId) {
        // Check static blacklist
        if (this.config.blacklistedUsers?.some(blocked => blocked === email || blocked === userId)) {
            return true;
        }
        // Check dynamic blacklist
        return this.dynamicBlacklist.has(email) || this.dynamicBlacklist.has(userId);
    }
    /**
     * Admin: Blacklist a user
     */
    blacklistUser(emailOrId, reason = 'Admin action') {
        this.dynamicBlacklist.add(emailOrId);
        console.log(`🚫 User blacklisted: ${emailOrId} (${reason})`);
        // Invalidate all sessions for blacklisted user
        for (const [token, session] of this.activeSessions) {
            if (session.userInfo.email === emailOrId || session.userId === emailOrId) {
                this.invalidateSession(token);
                console.log(`🔒 Invalidated session for blacklisted user: ${emailOrId}`);
            }
        }
    }
    /**
     * Admin: Remove user from blacklist
     */
    unblacklistUser(emailOrId) {
        this.dynamicBlacklist.delete(emailOrId);
        this.violationCounts.delete(emailOrId);
        console.log(`✅ User removed from blacklist: ${emailOrId}`);
    }
    /**
     * Check if user is in allowlist (static config + dynamic)
     */
    isUserAllowed(email, userId) {
        // Check dynamic allowlist (admin added)
        if (this.dynamicAllowlist.has(email) || this.dynamicAllowlist.has(userId)) {
            return true;
        }
        // Check static allowlist (config)
        if (this.config.allowedUsers?.some(allowed => allowed === email || allowed === userId)) {
            return true;
        }
        return false;
    }
    /**
     * Admin: Add user to allowlist (for allowlist mode)
     */
    allowUser(emailOrId, reason = 'Admin approval') {
        this.dynamicAllowlist.add(emailOrId);
        console.log(`✅ User added to allowlist: ${emailOrId} (${reason})`);
    }
    /**
     * Admin: Remove user from allowlist
     */
    disallowUser(emailOrId) {
        this.dynamicAllowlist.delete(emailOrId);
        console.log(`❌ User removed from allowlist: ${emailOrId}`);
    }
    /**
     * Admin: Change access mode on the fly
     */
    setAccessMode(mode) {
        this.config.accessMode = mode;
        console.log(`🔧 Access mode changed to: ${mode}`);
        // Log what this means
        switch (mode) {
            case 'open':
                console.log('   📖 Anyone can authenticate (subject to blacklist)');
                break;
            case 'allowlist':
                console.log('   🔐 Only explicitly allowed users can authenticate');
                break;
            case 'development':
                console.log('   🚧 Only configured developers can authenticate');
                break;
        }
    }
    /**
     * Get user roles
     */
    getUserRoles(email) {
        const roleInfo = this.userRoles.get(email);
        return roleInfo ? roleInfo.roles : ['user']; // Default role is 'user'
    }
    /**
     * Check if user has specific role
     */
    hasRole(email, role) {
        return this.getUserRoles(email).includes(role);
    }
    /**
     * Check if user is admin (admin or super_admin)
     */
    isAdmin(email) {
        return this.hasRole(email, 'admin') || this.hasRole(email, 'super_admin');
    }
    /**
     * Check if user is super admin
     */
    isSuperAdmin(email) {
        return this.hasRole(email, 'super_admin');
    }
    /**
     * Admin: Grant role to user (requires appropriate permissions)
     */
    grantRole(targetEmail, role, grantedByEmail) {
        // Permission check
        if (role === 'super_admin' && !this.isSuperAdmin(grantedByEmail)) {
            throw new Error('Only super admins can grant super admin role');
        }
        if (role === 'admin' && !this.isSuperAdmin(grantedByEmail)) {
            throw new Error('Only super admins can grant admin role');
        }
        // Get existing roles or create new
        const existingRoles = this.userRoles.get(targetEmail);
        const currentRoles = existingRoles ? [...existingRoles.roles] : ['user'];
        // Add role if not already present
        if (!currentRoles.includes(role)) {
            currentRoles.push(role);
            this.userRoles.set(targetEmail, {
                email: targetEmail,
                roles: currentRoles,
                grantedBy: grantedByEmail,
                grantedAt: new Date()
            });
            console.log(`👑 Role '${role}' granted to ${targetEmail} by ${grantedByEmail}`);
            // Update existing sessions
            this.updateSessionRoles(targetEmail, currentRoles);
        }
    }
    /**
     * Admin: Revoke role from user (requires appropriate permissions)
     */
    revokeRole(targetEmail, role, revokedByEmail) {
        // Permission check
        if (role === 'super_admin' && !this.isSuperAdmin(revokedByEmail)) {
            throw new Error('Only super admins can revoke super admin role');
        }
        if (role === 'admin' && !this.isSuperAdmin(revokedByEmail)) {
            throw new Error('Only super admins can revoke admin role');
        }
        // Can't revoke from yourself if you're the last super admin
        if (role === 'super_admin' && targetEmail === revokedByEmail) {
            const superAdminCount = Array.from(this.userRoles.values())
                .filter(roleInfo => roleInfo.roles.includes('super_admin')).length;
            if (superAdminCount <= 1) {
                throw new Error('Cannot revoke super admin role from yourself - you are the last super admin');
            }
        }
        const roleInfo = this.userRoles.get(targetEmail);
        if (roleInfo && roleInfo.roles.includes(role)) {
            const updatedRoles = roleInfo.roles.filter(r => r !== role);
            if (updatedRoles.length === 0) {
                updatedRoles.push('user'); // Always have at least 'user' role
            }
            this.userRoles.set(targetEmail, {
                ...roleInfo,
                roles: updatedRoles
            });
            console.log(`❌ Role '${role}' revoked from ${targetEmail} by ${revokedByEmail}`);
            // Update existing sessions
            this.updateSessionRoles(targetEmail, updatedRoles);
        }
    }
    /**
     * Update roles in existing sessions
     */
    updateSessionRoles(email, newRoles) {
        for (const session of this.activeSessions.values()) {
            if (session.userInfo.email === email) {
                session.roles = newRoles;
            }
        }
    }
    /**
     * Get all user roles (admin function)
     */
    getAllUserRoles() {
        return Array.from(this.userRoles.values());
    }
    /**
     * Check rate limiting and auto-blacklist
     */
    checkRateLimit(userInfo) {
        if (!this.config.rateLimiting)
            return;
        const userId = userInfo.email;
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        // Check request count
        const userRequests = this.requestCounts.get(userId);
        if (!userRequests || now > userRequests.resetTime) {
            this.requestCounts.set(userId, { count: 1, resetTime: now + hourMs });
            return;
        }
        userRequests.count++;
        // Check if over limit
        if (this.config.rateLimiting.maxRequestsPerHour &&
            userRequests.count > this.config.rateLimiting.maxRequestsPerHour) {
            // Track violation
            const violations = (this.violationCounts.get(userId) || 0) + 1;
            this.violationCounts.set(userId, violations);
            console.warn(`⚠️ Rate limit exceeded for ${userId}: ${userRequests.count} requests/hour`);
            // Auto-blacklist if threshold reached
            if (this.config.rateLimiting.autoBlacklistThreshold &&
                violations >= this.config.rateLimiting.autoBlacklistThreshold) {
                this.blacklistUser(userId, `Auto-blacklisted after ${violations} rate limit violations`);
            }
            throw new Error('Rate limit exceeded');
        }
    }
    /**
     * Admin: Get security statistics
     */
    getSecurityStats() {
        const now = Date.now();
        const requestStats = {};
        for (const [userId, data] of this.requestCounts) {
            if (now < data.resetTime) {
                requestStats[userId] = {
                    count: data.count,
                    resetsIn: Math.round((data.resetTime - now) / 1000)
                };
            }
        }
        // Find suspicious activity
        const suspicious = [];
        for (const [userId, violations] of this.violationCounts) {
            if (violations > 0) {
                suspicious.push(`${userId}: ${violations} violations`);
            }
        }
        return {
            blacklistedUsers: Array.from(this.dynamicBlacklist),
            activeViolations: Object.fromEntries(this.violationCounts),
            requestCounts: requestStats,
            suspiciousActivity: suspicious
        };
    }
    /**
     * Check user limits for public beta launches
     */
    async checkUserLimits(email, provider) {
        const userLimits = this.config.userLimits;
        // If no user limits configured, allow all users
        if (!userLimits || !userLimits.maxUsers || userLimits.maxUsers <= 0) {
            return;
        }
        // Check if user is already registered (returning users are always allowed)
        if (this.registeredUsers.has(email)) {
            return;
        }
        // Check if user is admin and admin bypass is enabled (default: true)
        const adminBypass = userLimits.adminBypassLimits !== false; // default true
        if (adminBypass && this.isAdmin(email)) {
            console.log(`👑 Admin user ${email} bypassing user limits`);
            return;
        }
        // Check if user is in dynamic allowlist (admin granted access above limit)
        if (this.dynamicAllowlist.has(email)) {
            console.log(`✨ Special access granted to ${email} (above limit)`);
            return;
        }
        // Check current user count against limit
        const currentUserCount = this.registeredUsers.size;
        if (currentUserCount >= userLimits.maxUsers) {
            console.warn(`🚫 User limit reached: ${currentUserCount}/${userLimits.maxUsers} users`);
            // Handle waitlist if enabled
            if (userLimits.waitlistEnabled) {
                this.addToWaitlist(email, provider);
                throw new Error(`User limit reached (${userLimits.maxUsers} users). You have been added to the waitlist.`);
            }
            else {
                throw new Error(`Public beta is full (${userLimits.maxUsers} users). Please try again later.`);
            }
        }
        console.log(`📊 User count: ${currentUserCount + 1}/${userLimits.maxUsers} (new user: ${email})`);
    }
    /**
     * Add user to waitlist when user limit is reached
     */
    addToWaitlist(email, provider) {
        this.waitlist.set(email, {
            email,
            requestedAt: new Date(),
            provider
        });
        console.log(`📝 Added ${email} to waitlist (${this.waitlist.size} waiting)`);
    }
    /**
     * Admin: Get user statistics including limits
     */
    getUserStats() {
        const userLimits = this.config.userLimits;
        const maxUsers = userLimits?.maxUsers || null;
        const maxActiveUsers = userLimits?.maxActiveUsers || null;
        const currentUsers = this.registeredUsers.size;
        const activeUsers = this.activeSessions.size;
        return {
            currentUsers,
            maxUsers,
            activeUsers,
            maxActiveUsers,
            waitlistCount: this.waitlist.size,
            limitReached: maxUsers ? currentUsers >= maxUsers : false,
            limitsEnabled: !!(userLimits?.maxUsers && userLimits.maxUsers > 0)
        };
    }
    /**
     * Admin: Set user limit (runtime configuration)
     */
    setUserLimit(newLimit, changedByEmail) {
        // Permission check
        if (!this.isAdmin(changedByEmail)) {
            throw new Error('Only admins can change user limits');
        }
        if (!this.config.userLimits) {
            this.config.userLimits = {};
        }
        const oldLimit = this.config.userLimits.maxUsers || 0;
        this.config.userLimits.maxUsers = newLimit;
        console.log(`📊 User limit changed from ${oldLimit} to ${newLimit} by ${changedByEmail}`);
        // If limit was increased, process waitlist
        if (newLimit > oldLimit && this.waitlist.size > 0) {
            this.processWaitlist();
        }
    }
    /**
     * Admin: Add more user slots temporarily
     */
    addUserSlots(additionalSlots, grantedByEmail) {
        // Permission check
        if (!this.isAdmin(grantedByEmail)) {
            throw new Error('Only admins can add user slots');
        }
        if (!this.config.userLimits || !this.config.userLimits.maxUsers) {
            throw new Error('User limits not configured');
        }
        const oldLimit = this.config.userLimits.maxUsers;
        this.config.userLimits.maxUsers += additionalSlots;
        console.log(`📈 Added ${additionalSlots} user slots (${oldLimit} → ${this.config.userLimits.maxUsers}) by ${grantedByEmail}`);
        // Process waitlist with new slots
        if (this.waitlist.size > 0) {
            this.processWaitlist();
        }
    }
    /**
     * Admin: Get waitlist
     */
    getWaitlist() {
        return Array.from(this.waitlist.values())
            .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime()); // FIFO order
    }
    /**
     * Admin: Process waitlist when slots become available
     */
    processWaitlist() {
        const userLimits = this.config.userLimits;
        if (!userLimits?.maxUsers)
            return;
        const currentUsers = this.registeredUsers.size;
        const availableSlots = userLimits.maxUsers - currentUsers;
        if (availableSlots <= 0 || this.waitlist.size === 0)
            return;
        const processed = [];
        // Process waitlist in FIFO order
        for (const [email, entry] of this.waitlist) {
            if (processed.length >= availableSlots)
                break;
            // Add user to registered users (they can now authenticate)
            this.registeredUsers.add(email);
            processed.push(email);
            this.waitlist.delete(email);
            console.log(`✅ Processed waitlist: ${email} can now authenticate`);
        }
        if (processed.length > 0) {
            console.log(`📝 Processed ${processed.length} users from waitlist. ${this.waitlist.size} still waiting.`);
        }
    }
    /**
     * Admin: Remove user from waitlist
     */
    removeFromWaitlist(email, removedByEmail) {
        // Permission check
        if (!this.isAdmin(removedByEmail)) {
            throw new Error('Only admins can remove users from waitlist');
        }
        const removed = this.waitlist.delete(email);
        if (removed) {
            console.log(`❌ Removed ${email} from waitlist by ${removedByEmail}`);
        }
        return removed;
    }
    /**
     * Admin: Grant special access to user (above user limit)
     * This allows specific users to authenticate even when the user limit is reached
     */
    grantSpecialAccess(email, reason, grantedByEmail) {
        // Permission check
        if (!this.isAdmin(grantedByEmail)) {
            throw new Error('Only admins can grant special access');
        }
        // Add to dynamic allowlist (this bypasses user limits)
        this.dynamicAllowlist.add(email);
        console.log(`✨ Special access granted to ${email} by ${grantedByEmail} (${reason})`);
        // Remove from waitlist if they were waiting
        if (this.waitlist.has(email)) {
            this.waitlist.delete(email);
            console.log(`📝 Removed ${email} from waitlist (granted special access)`);
        }
    }
    /**
     * Admin: Promote user from waitlist to access (above limit)
     * This is a convenience method for granting access to specific waitlisted users
     */
    promoteFromWaitlist(email, promotedByEmail) {
        // Permission check
        if (!this.isAdmin(promotedByEmail)) {
            throw new Error('Only admins can promote users from waitlist');
        }
        // Check if user is in waitlist
        if (!this.waitlist.has(email)) {
            return false;
        }
        // Grant special access
        this.grantSpecialAccess(email, 'Promoted from waitlist', promotedByEmail);
        return true;
    }
    /**
     * Admin: Revoke special access (user goes back to normal limit rules)
     */
    revokeSpecialAccess(email, revokedByEmail) {
        // Permission check
        if (!this.isAdmin(revokedByEmail)) {
            throw new Error('Only admins can revoke special access');
        }
        const removed = this.dynamicAllowlist.delete(email);
        if (removed) {
            console.log(`❌ Revoked special access for ${email} by ${revokedByEmail}`);
            // Check if user should be added back to waitlist if limits are still reached
            const userLimits = this.config.userLimits;
            if (userLimits?.maxUsers && this.registeredUsers.size >= userLimits.maxUsers && userLimits.waitlistEnabled) {
                console.log(`📝 User ${email} may need to rejoin waitlist on next authentication attempt`);
            }
        }
        return removed;
    }
    /**
     * Admin: Get list of users with special access
     */
    getSpecialAccessUsers() {
        return Array.from(this.dynamicAllowlist);
    }
    /**
     * Admin: Bulk grant access to multiple users (e.g., coworkers, friends)
     */
    bulkGrantSpecialAccess(emails, reason, grantedByEmail) {
        // Permission check
        if (!this.isAdmin(grantedByEmail)) {
            throw new Error('Only admins can grant special access');
        }
        const granted = [];
        const skipped = [];
        for (const email of emails) {
            if (this.dynamicAllowlist.has(email) || this.registeredUsers.has(email)) {
                skipped.push(email);
            }
            else {
                this.dynamicAllowlist.add(email);
                granted.push(email);
                // Remove from waitlist if they were waiting
                if (this.waitlist.has(email)) {
                    this.waitlist.delete(email);
                }
            }
        }
        console.log(`✨ Bulk special access granted to ${granted.length} users by ${grantedByEmail} (${reason})`);
        if (granted.length > 0) {
            console.log(`   Granted: ${granted.join(', ')}`);
        }
        if (skipped.length > 0) {
            console.log(`   Skipped (already have access): ${skipped.join(', ')}`);
        }
        return { granted, skipped };
    }
    /**
     * Refresh OAuth token if needed
     */
    async refreshTokenIfNeeded(sessionToken) {
        const session = this.activeSessions.get(sessionToken);
        if (!session) {
            return false;
        }
        // Check if token is close to expiring (1 hour threshold)
        const oneHour = 60 * 60 * 1000;
        if (session.expiresAt && (session.expiresAt.getTime() - Date.now()) < oneHour) {
            try {
                // Validate current token is still good
                await this.validateOAuthToken(session.provider, session.accessToken);
                // Update expiration
                session.expiresAt = new Date(Date.now() + this.config.sessionExpirationMs);
                session.lastActivity = new Date();
                console.log(`🔄 Refreshed session for ${session.userInfo.email}`);
                return true;
            }
            catch (error) {
                console.warn(`⚠️ Token refresh failed for ${session.userInfo.email}:`, error);
                this.invalidateSession(sessionToken);
                return false;
            }
        }
        return true; // Token still valid
    }
}
//# sourceMappingURL=oauth-auth-manager.js.map
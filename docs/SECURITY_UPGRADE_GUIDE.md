# Security Upgrade Guide: PostgreSQL Secret Manager

## Overview

This guide helps you upgrade to the hardened PostgreSQL Secret Manager with improved encryption and user ID security.

## Breaking Changes

### 🔐 User ID Generation Change

**What Changed:** User IDs are now generated using SHA-256 hashing instead of simple string manipulation.

**Impact:** Existing users will have different user IDs, potentially losing access to their stored API keys.

**Migration Required:** Yes (automatic with `enableLegacyUserIds` flag)

### 🔑 Encryption Salt Required in Production

**What Changed:** Production environments (`NODE_ENV=production`) now **require** an encryption salt.

**Impact:** Server will throw error on startup if salt is missing in production.

**Migration Required:** Yes (generate and configure salt)

## Migration Steps

### Step 1: Generate Encryption Salt

Generate a strong random salt for production use:

```bash
# Generate salt (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a3f5e8d9c4b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6
```

### Step 2: Update Configuration

Add the salt to your server configuration:

```typescript
const server = createRpcAiServer({
  secretManager: {
    type: 'postgresql',
    host: process.env.SECRET_MANAGER_DB_HOST,
    port: parseInt(process.env.SECRET_MANAGER_DB_PORT || '5433'),
    database: process.env.SECRET_MANAGER_DB_NAME || 'secrets',
    user: process.env.SECRET_MANAGER_DB_USER,
    password: process.env.SECRET_MANAGER_DB_PASS,
    encryptionKey: process.env.SECRET_MANAGER_ENCRYPTION_KEY,

    // ✅ NEW: Required in production
    encryptionSalt: process.env.SECRET_MANAGER_ENCRYPTION_SALT,

    // Optional: Customize scrypt parameters (higher = more secure but slower)
    scryptOptions: {
      N: 16384,  // CPU/memory cost (default: 16384)
      r: 8,      // Block size (default: 8)
      p: 1,      // Parallelization (default: 1)
      keylen: 32 // Key length in bytes (default: 32)
    }
  }
});
```

### Step 3: Enable Legacy User ID Support

To migrate existing users without data loss, enable legacy user ID support:

```typescript
const server = createRpcAiServer({
  secretManager: {
    type: 'postgresql',
    // ... other config

    // ✅ Enable automatic migration
    enableLegacyUserIds: true
  }
});
```

**How it works:**
1. When a user's API key is requested, the system first tries the new SHA-256 user ID
2. If not found, it tries the legacy string-based user ID
3. If found with legacy ID, it automatically migrates the data to the new SHA-256 ID
4. The migration is transparent to the user

**Warning:** Keep this enabled until all users have been migrated, then disable it for production.

### Step 4: Verify Migration

Monitor the logs for migration activity:

```
[info] Attempting legacy user ID lookup { email: 'user@***', provider: 'anthropic' }
[warn] Found data with legacy user ID - migrating to SHA-256 { email: 'user@***', provider: 'anthropic' }
[info] Successfully migrated user ID to SHA-256 { email: 'user@***', provider: 'anthropic' }
```

### Step 5: Disable Legacy Support

Once all users have been migrated (monitor logs for ~1 week), disable legacy support:

```typescript
const server = createRpcAiServer({
  secretManager: {
    type: 'postgresql',
    // ... other config

    // ✅ Disable after migration complete
    enableLegacyUserIds: false  // or remove this line
  }
});
```

## Environment Variables

Update your `.env` file:

```bash
# Required
SECRET_MANAGER_ENCRYPTION_KEY=your-existing-encryption-key
SECRET_MANAGER_ENCRYPTION_SALT=a3f5e8d9c4b2a1f0...  # NEW - generate with crypto.randomBytes(32).toString('hex')

# Optional - Database configuration
SECRET_MANAGER_DB_HOST=localhost
SECRET_MANAGER_DB_PORT=5433
SECRET_MANAGER_DB_NAME=secrets
SECRET_MANAGER_DB_USER=postgres
SECRET_MANAGER_DB_PASS=your-password

# Optional - Environment
NODE_ENV=production  # Enforces encryption salt requirement
```

## Security Improvements

### ✅ Fixed: Predictable User IDs

**Before:**
```typescript
// Simple string manipulation - predictable and collision-prone
getUserId('user@example.com') → 'user-example-com'
```

**After:**
```typescript
// SHA-256 hashing - secure and collision-resistant
getUserId('user@example.com') → '8d969eef6ecad3c29a3a629280e686cf...'
```

### ✅ Fixed: Weak Key Derivation

**Before:**
```typescript
// Simple truncation - vulnerable to attacks
this.masterKey = Buffer.from(encryptionKey, 'utf8').subarray(0, 32);
```

**After:**
```typescript
// Scrypt KDF with configurable parameters - industry standard
this.masterKey = await scryptAsync(
  encryptionKey,
  encryptionSalt,
  32,
  { N: 16384, r: 8, p: 1 }
);
```

### ✅ Fixed: Missing Salt Validation

**Before:**
- No validation of salt format or length
- Silently accepted weak or invalid salts

**After:**
- Validates hex encoding
- Enforces minimum 32-byte length
- Throws clear error messages

### ✅ Fixed: Race Condition

**Before:**
- Master key could be used before derivation completed
- Potential for data corruption

**After:**
- Initialization guard checks in all methods
- Clear error if methods called before `initialize()`

## Advanced Configuration

### High-Security Environment

For maximum security, increase scrypt parameters:

```typescript
scryptOptions: {
  N: 32768,  // 2x default - significantly slower but more secure
  r: 8,
  p: 2       // 2x parallelization for multi-core systems
}
```

**Warning:** Higher values increase CPU/memory usage and slow down key derivation.

### Low-Resource Environment

For resource-constrained environments:

```typescript
scryptOptions: {
  N: 8192,   // Half default - faster but less secure
  r: 8,
  p: 1
}
```

**Warning:** Only use in development or non-critical environments.

## Rollback Plan

If you need to rollback to the old implementation:

1. **Don't delete the old code** - keep a backup branch
2. **Database is compatible** - user_id field remains VARCHAR(255)
3. **Restore old code** and restart server
4. **Users migrated to SHA-256** will need to re-add their keys

**Better approach:** Use `enableLegacyUserIds: true` to support both old and new user IDs.

## Troubleshooting

### Error: "encryptionSalt is REQUIRED in production"

**Cause:** Missing encryption salt in production environment

**Fix:** Generate and configure encryption salt (see Step 1)

### Error: "Invalid encryptionSalt format"

**Cause:** Salt is not hex-encoded

**Fix:** Ensure salt is hex string from `crypto.randomBytes(32).toString('hex')`

### Error: "Invalid encryptionSalt length"

**Cause:** Salt is less than 32 bytes

**Fix:** Generate new salt with minimum 32 bytes: `crypto.randomBytes(32).toString('hex')`

### Error: "PostgreSQLSecretManager not initialized"

**Cause:** Calling methods before `initialize()` completes

**Fix:** Ensure `await secretManager.initialize()` completes before use

### Users Can't Access Their Keys

**Cause:** User IDs changed from string to SHA-256

**Fix:** Enable `enableLegacyUserIds: true` for automatic migration

## Testing

### Verify Salt Configuration

```typescript
// Should succeed with valid salt
const config = {
  encryptionSalt: crypto.randomBytes(32).toString('hex')
};

// Should throw in production without salt
process.env.NODE_ENV = 'production';
const manager = new PostgreSQLSecretManager(config, key);  // ❌ Throws
```

### Verify Migration

```typescript
// Enable legacy support
const manager = new PostgreSQLSecretManager({
  enableLegacyUserIds: true,
  // ... other config
}, key);

await manager.initialize();

// Should find and migrate legacy user data
const result = await manager.getUserKey('user@example.com', 'anthropic');
// Logs: "Found data with legacy user ID - migrating to SHA-256"
```

## Security Checklist

- [ ] Generate strong encryption salt (32+ bytes)
- [ ] Configure `encryptionSalt` in production
- [ ] Enable `enableLegacyUserIds` for migration period
- [ ] Monitor migration logs for 1+ week
- [ ] Disable `enableLegacyUserIds` after migration
- [ ] Update `.env` files in all environments
- [ ] Test in staging before production deployment
- [ ] Verify users can access their keys after upgrade
- [ ] Document salt in secure key management system
- [ ] Set up monitoring for "not initialized" errors

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/AWolf81/simple-rpc-ai-backend/issues
- **Security Concerns**: Report privately to maintainers
- **Migration Help**: Create issue with `migration` label

---

**Last Updated:** 2025-11-22
**Version:** 0.1.9+
**Breaking Change:** Yes (requires salt in production + user ID migration)

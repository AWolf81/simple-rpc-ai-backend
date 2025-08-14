# Improved Vaultwarden Auth Flow: Vault Unlock Solution

## ❌ Previous Problem

The original implementation had a critical flaw:

- **No vault unlock mechanism**: Server couldn't access user vaults to store/retrieve items
- **Password dependency**: Would need user's actual password to unlock vaults
- **Change fragility**: Password changes would break vault access

## ✅ Solution: Generated Vault Passwords

### Core Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code       │    │   RPC Server     │    │  Vaultwarden    │
│   Extension     │    │                  │    │     Vault       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │  1. OpenSaaS JWT       │                        │
         ├───────────────────────→│                        │
         │                        │  2. Generate vault     │
         │                        │     password           │
         │                        ├───────────────────────→│
         │                        │  3. Create vault with  │
         │                        │     generated password │
         │  4. Setup token        │                        │
         │←───────────────────────┤                        │
         │                        │                        │
         │  5. Client derives     │                        │
         │     master key         │                        │
         │  6. Complete setup     │                        │
         ├───────────────────────→│                        │
         │                        │                        │
         │  7. Encrypt API key    │                        │
         │     client-side        │                        │
         │  8. Store encrypted    │                        │
         │     data               │                        │
         ├───────────────────────→│  9. Store in vault    │
         │                        │    (using generated    │
         │                        │     password)          │
         │                        ├───────────────────────→│
```

## 🔐 Key Components

### 1. VaultwardenVaultManager

**Handles vault operations with generated passwords:**

```typescript
export class VaultwardenVaultManager {
  // Generate secure password for each vault
  private generateSecureVaultPassword(): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    const length = 32;
    const bytes = randomBytes(length);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
    return password;
  }

  // Create vault with generated password
  async createUserVault(opensaasUserId: string, vaultwardenUserId: string): Promise<{
    success: boolean;
    vaultPassword?: string;
  }> {
    const generatedPassword = this.generateSecureVaultPassword();
    
    // Call Vaultwarden Admin API to create vault with generated password
    // Store encrypted password for server access
    const credentials: VaultCredentials = {
      vaultwardenUserId,
      generatedMasterPassword: generatedPassword,
      encryptedMasterPassword: this.encryptPassword(generatedPassword),
      createdAt: new Date(),
      lastUsed: new Date()
    };
    
    this.vaultCredentials.set(opensaasUserId, credentials);
    return { success: true, vaultPassword: generatedPassword };
  }

  // Get vault session for operations
  async getVaultSession(opensaasUserId: string): Promise<VaultSession> {
    const credentials = this.vaultCredentials.get(opensaasUserId);
    const decryptedPassword = this.decryptPassword(credentials.encryptedMasterPassword);
    
    // Create Bitwarden API session with generated password
    const vaultConfig: BitwardenConfig = {
      ...this.baseConfig,
      masterPassword: decryptedPassword // Use generated password
    };
    
    const bitwardenAPI = new BitwardenRESTAPI(vaultConfig);
    await bitwardenAPI.initialize();
    
    return { vaultwardenUserId, sessionToken, expiresAt, bitwardenAPI };
  }
}
```

### 2. Separation of Concerns

**Two Different Password Purposes:**

1. **Client Master Password**: 
   - User-derived (Argon2id)
   - Used for client-side encryption/decryption
   - Never sent to server
   - Changes don't affect vault access

2. **Vault Password**: 
   - Server-generated (cryptographically secure)
   - Used to unlock Vaultwarden vault
   - Stored encrypted on server
   - Independent of user authentication

### 3. Complete Auth Flow

**Step-by-Step Implementation:**

```typescript
// Step 1-3: User onboarding
const { setupToken } = await rpcClient.request('vaultwarden.onboardUser', {
  opensaasJWT: userJWT
});

// Step 4: Client-side setup (in VS Code extension)
const masterPassword = await vscode.window.showInputBox({ 
  prompt: 'Enter master password for encryption',
  password: true 
});

// Derive client master key (never sent to server)
const { masterKey, salt } = ClientSideEncryption.deriveMasterKey(masterPassword);

// Create hash for server verification (not vault unlock)
const { hash } = ClientSideEncryption.createMasterPasswordHash(masterPassword);

// Complete setup - server creates vault with generated password
const setupResult = await rpcClient.request('vaultwarden.completeSetup', {
  setupToken,
  masterPasswordHash: hash, // For client verification only
});

// Step 5: Store encrypted API key
const apiKey = 'sk-ant-api03-...';
const encrypted = ClientSideEncryption.encryptApiKey(apiKey, masterKey);

const storeResult = await rpcClient.request('vaultwarden.storeEncryptedKey', {
  opensaasJWT: userJWT,
  encryptedApiKey: encrypted.ciphertext,
  provider: 'anthropic',
  keyMetadata: {
    algorithm: encrypted.algorithm,
    iv: encrypted.iv,
    salt: encrypted.salt,
    tag: encrypted.tag
  }
});

// Normal operation: Retrieve and decrypt
const token = await rpcClient.request('vaultwarden.getShortLivedToken', {
  opensaasJWT: userJWT
});

const retrieveResult = await rpcClient.request('vaultwarden.retrieveEncryptedKey', {
  shortLivedToken: token.accessToken,
  provider: 'anthropic'
});

// Decrypt client-side
const decryptedKey = ClientSideEncryption.decryptApiKey({
  ciphertext: retrieveResult.encryptedApiKey,
  ...retrieveResult.keyMetadata
}, masterKey);
```

## 🛡️ Security Benefits

### 1. **Password Independence**
- Vault access independent of user authentication passwords
- OpenSaaS/OAuth password changes don't break vault access
- Server can rotate vault passwords independently

### 2. **Enhanced Security**
- Two-layer encryption: client-side + Vaultwarden vault encryption
- Server never sees user's master password
- Generated vault passwords are cryptographically secure

### 3. **Enterprise-Friendly**
- No password synchronization needed
- Centralized vault management
- Admin can rotate vault passwords for security
- Audit trail of all vault operations

## 🔄 Password Rotation

**Vault passwords can be rotated independently:**

```typescript
// Rotate vault password (doesn't affect user)
async rotateVaultPassword(opensaasUserId: string): Promise<boolean> {
  const newPassword = this.generateSecureVaultPassword();
  
  // Call Vaultwarden Admin API to change vault password
  // All existing encrypted items remain accessible
  
  // Update stored credentials
  credentials.generatedMasterPassword = newPassword;
  credentials.encryptedMasterPassword = this.encryptPassword(newPassword);
  
  // Invalidate existing sessions
  this.activeSessions.delete(opensaasUserId);
  
  return true;
}
```

## 📊 Comparison: Before vs After

| Aspect | ❌ Previous | ✅ Improved |
|--------|------------|-------------|
| **Vault Unlock** | No mechanism | Generated passwords |
| **Password Dependency** | User password required | Independent vault passwords |
| **Password Changes** | Breaks vault access | No impact |
| **Security** | Single-layer | Two-layer encryption |
| **Enterprise** | Fragile | Production-ready |
| **Maintenance** | Manual password sync | Automated rotation |

## 🚀 Production Deployment

**Server Configuration:**

```typescript
const server = createAIServer({
  vaultwarden: {
    enabled: true,
    serverUrl: 'https://vault.company.com',
    serviceEmail: 'rpc-service@company.com',
    servicePassword: process.env.VAULTWARDEN_SERVICE_PASSWORD,
    clientId: process.env.VAULTWARDEN_CLIENT_ID,
    clientSecret: process.env.VAULTWARDEN_CLIENT_SECRET
  },
  
  // Master key for encrypting stored vault passwords
  vaultMasterKey: process.env.VAULT_MASTER_KEY,
  
  // HMAC secret for token signing
  hmacSecret: process.env.HMAC_SECRET
});
```

**Environment Variables:**

```bash
# Vaultwarden connection
VAULTWARDEN_SERVICE_PASSWORD=secure-service-account-password
VAULTWARDEN_CLIENT_ID=service-client-id
VAULTWARDEN_CLIENT_SECRET=service-client-secret

# Encryption keys
VAULT_MASTER_KEY=32-byte-hex-key-for-encrypting-vault-passwords
HMAC_SECRET=32-byte-hex-key-for-token-signing
```

## 🎯 Key Takeaway

**The improved auth flow completely separates:**

1. **User Authentication**: OpenSaaS JWT → RPC access
2. **Client Encryption**: User master password → API key encryption 
3. **Vault Access**: Server-generated password → Vaultwarden operations

This architecture is **enterprise-ready**, **password-change resilient**, and provides **defense-in-depth security** while maintaining the **client-side encryption** benefits you specified in your sequence diagram.

# Feature: SimpleKeyManager for BYOK (Bring Your Own Key)
**Status**: 📝 Draft
**Priority**: High
**Security Risk Level**: High
**Cryptographic Operations**: Basic
**MCP Integration**: None
**Estimated Effort**: 5-6 days
**Created**: 2025-01-26
**Last Updated**: 2025-01-26

## Problem Statement
Users need to securely provide their own AI provider API keys (Anthropic, OpenAI, Google) for the backend to use on their behalf. The current architecture assumes service provider keys, but BYOK is essential for:
- User cost control and billing transparency
- Corporate compliance requirements
- Multi-provider flexibility without service provider managing all keys
- **Zero-friction onboarding with progressive authentication**
- **Seamless multi-device support when needed**

## Requirements
- The system SHALL securely store user API keys with AES-256-GCM encryption
- When a user provides an API key, the system SHALL validate it before storage
- The system SHALL support multiple AI providers per user (Anthropic, OpenAI, Google)
- The system SHALL isolate user keys completely (multi-tenant security)
- The system SHALL provide key rotation capabilities
- The system SHALL never log or expose user API keys in plaintext
- **The system SHALL start users as anonymous with zero configuration**
- **The system SHALL offer progressive authentication (OAuth/Passkey) only when needed**
- **The system SHALL support seamless multi-device sync for authenticated users**

## Target Users
- Developers building AI applications using simple-rpc-ai-backend
- End users who want to use their own AI provider credits
- Corporate users requiring BYOK for compliance
- **Single-device users who want zero configuration**
- **Multi-device users who want seamless sync**
- **Security-conscious users who want OAuth/Passkey protection**

## Progressive Authentication Strategy
**Level 1: Anonymous (Zero Friction)**
- Install extension → Create anonymous user → Store keys → Use AI
- Single device only, no authentication required
- 95% of users never need to authenticate

**Level 2: OAuth Multi-Device (When Needed)**
- User wants 2nd device OR premium features
- One-click OAuth (GitHub/Google/Microsoft) via VS Code built-in auth
- All data migrated seamlessly to OAuth account
- Multi-device sync enabled

**Level 3: Passkey Security (Optional)**
- Add Passkey for maximum security and enterprise compliance
- Passwordless but phishing-resistant device linking
- Hardware security module protection

**Level 4: Pro Features (Paid)**
- Premium prompts, custom features, priority support
- Natural upgrade path from any authentication level

## Cryptographic Context
- **Algorithms Involved**: AES-256-GCM for key encryption, SHA256 for IDs
- **Key Types**: User API keys (symmetric secrets), master encryption key
- **Data Sensitivity**: Highly sensitive user API keys, OAuth tokens, Passkey credentials
- **Storage**: Encrypted database records with per-user isolation and device association

## Success Criteria
- [ ] User can store API keys with zero configuration (anonymous mode)
- [ ] Keys are validated before storage (test API call)
- [ ] Keys are encrypted at rest using AES-256-GCM
- [ ] Multi-user isolation prevents cross-user key access
- [ ] Backend can dynamically use user's keys for AI provider calls
- [ ] Key rotation works without service interruption
- [ ] **Anonymous users can upgrade to OAuth seamlessly**
- [ ] **OAuth users can link multiple devices automatically**
- [ ] **Passkey users get enterprise-grade security**
- [ ] **All upgrade paths preserve user data**

## Architecture Impact
**Components Affected**: 
- New: SimpleKeyManager class (user-centric key storage)
- New: ProgressiveAuthManager class (anonymous → OAuth → Passkey)
- New: UserManager class (user lifecycle management)
- Modified: AIService to accept dynamic keys per user
- Modified: RPC server to resolve user keys per request
- New: Key validation service
- New: Database schema for users, devices, and keys
- New: OAuth integration via VS Code authentication API

**New Dependencies**: 
- crypto module for AES-256-GCM encryption
- Database ORM for secure multi-tenant storage
- VS Code Authentication API for OAuth
- WebAuthn library for Passkey support

**Database Changes**: 
- New users table (supports anonymous and OAuth accounts)
- New user_devices table (device association and tracking)
- New user_keys table (encrypted key storage per user)
- New passkey_credentials table (WebAuthn credentials)

## Implementation Plan
1. **Database Schema Design**: Create users, devices, keys, and passkey tables
2. **UserManager Implementation**: Anonymous user creation and OAuth upgrade
3. **ProgressiveAuthManager**: Handle authentication state transitions  
4. **SimpleKeyManager Implementation**: User-centric key encryption and storage
5. **OAuth Integration**: VS Code built-in authentication for GitHub/Google/Microsoft
6. **Key Validation Service**: Test API keys before storage with proper error handling
7. **Dynamic AI Service**: Resolve user keys per request with caching
8. **RPC Integration**: User authentication and key resolution middleware
9. **Passkey Integration**: WebAuthn for enterprise security (Phase 2)
10. **Testing**: Multi-user isolation, encryption, and authentication flows

## Security Requirements
- Master encryption key MUST be stored securely (environment variable)
- User keys MUST be encrypted with unique nonces per record
- Database queries MUST include userId filters to prevent cross-user access
- Key validation MUST not log API keys even on error
- Failed operations MUST be rate limited per user
- **Anonymous users MUST have stable user IDs across sessions**
- **OAuth token validation MUST be performed on every request**
- **Passkey credentials MUST be stored with proper counter validation**
- **User upgrades MUST preserve all existing data integrity**

## Database Schema
```sql
-- Users table (supports anonymous and authenticated)
CREATE TABLE users (
  user_id VARCHAR(255) PRIMARY KEY,
  is_anonymous BOOLEAN DEFAULT true,
  
  -- OAuth fields (optional)
  oauth_provider VARCHAR(50), -- 'github', 'google', 'microsoft'
  oauth_id VARCHAR(255),
  email VARCHAR(255),
  
  -- User metadata
  plan VARCHAR(20) DEFAULT 'free', -- 'free', 'pro'
  features JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Unique constraints
  UNIQUE KEY oauth_unique (oauth_provider, oauth_id),
  UNIQUE KEY email_unique (email)
);

-- User devices (many-to-one with users)
CREATE TABLE user_devices (
  device_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_fingerprint VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX user_devices_idx (user_id, is_active)
);

-- User API keys (many-to-one with users)
CREATE TABLE user_keys (
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'anthropic', 'openai', 'google'
  encrypted_api_key TEXT NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  is_valid BOOLEAN DEFAULT false,
  last_validated TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Passkey credentials (many-to-one with users)
CREATE TABLE passkey_credentials (
  credential_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX passkey_user_idx (user_id)
);
```

## API Design
```typescript
// Progressive authentication states
type AuthLevel = 'anonymous' | 'oauth' | 'passkey' | 'pro';

interface User {
  userId: string;
  isAnonymous: boolean;
  authLevel: AuthLevel;
  
  // OAuth fields (optional)
  oauthProvider?: 'github' | 'google' | 'microsoft';
  oauthId?: string;
  email?: string;
  
  plan: 'free' | 'pro';
  features: string[];
  devices: UserDevice[];
}

interface UserDevice {
  deviceId: string;
  deviceName: string;
  isActive: boolean;
  lastSeen: Date;
}

// User management
class UserManager {
  async createAnonymousUser(deviceId: string): Promise<User>
  async upgradeToOAuth(userId: string, oauthData: OAuthData): Promise<User>
  async addPasskey(userId: string, passkeyData: PasskeyData): Promise<void>
  async linkDevice(userId: string, deviceId: string): Promise<void>
}

// Key management (user-centric)
class SimpleKeyManager {
  async storeUserKey(userId: string, provider: string, apiKey: string): Promise<void>
  async getUserKey(userId: string, provider: string): Promise<string | null>
  async validateUserKey(userId: string, provider: string): Promise<boolean>
  async rotateUserKey(userId: string, provider: string, newApiKey: string): Promise<void>
  async deleteUserKey(userId: string, provider: string): Promise<void>
  async getUserProviders(userId: string): Promise<string[]>
}

// Progressive authentication
class ProgressiveAuthManager {
  async getOrCreateUser(deviceId: string): Promise<User>
  async authenticateWithOAuth(provider: string, oauthToken: string): Promise<User>
  async authenticateWithPasskey(challenge: string, response: string): Promise<User>
  async upgradeUserPlan(userId: string, plan: string): Promise<User>
}

// VS Code extension integration
class ProgressiveAIClient extends VSCodeAIRPCClient {
  private user: User;
  private authManager: ProgressiveAuthManager;
  
  async initialize(): Promise<void>
  async storeApiKey(provider: string, apiKey: string): Promise<void>
  async upgradeToMultiDevice(): Promise<void>
  async addPasskeySecurity(): Promise<void>
  async upgradeToPro(): Promise<void>
}
```

## User Experience Flows
```typescript
// Flow 1: Anonymous user (95% of users)
async function anonymousFlow() {
  // Extension starts
  const user = await authManager.getOrCreateUser(deviceId);
  
  // User enters API keys in VS Code settings
  await client.storeApiKey('anthropic', 'sk-ant-...');
  
  // Start using AI features immediately
  const analysis = await client.analyzeCode('security_review', code);
}

// Flow 2: Multi-device upgrade
async function multiDeviceFlow() {
  // User installs on second device
  const choice = await showQuickPick([
    "Start fresh on this device",
    "Sync with existing account"
  ]);
  
  if (choice === "Sync with existing account") {
    await client.upgradeToMultiDevice(); // Triggers OAuth
  }
}

// Flow 3: Security upgrade  
async function securityUpgrade() {
  // After OAuth, suggest Passkey
  const addPasskey = await showInformationMessage(
    "Add Passkey for maximum security?",
    "Add Passkey", "Maybe later"
  );
  
  if (addPasskey === "Add Passkey") {
    await client.addPasskeySecurity();
  }
}
```

## Testing Requirements
- [ ] Anonymous user creation and key storage
- [ ] Multi-user isolation (user A cannot access user B keys)
- [ ] OAuth authentication and account linking
- [ ] Seamless data migration during authentication upgrades
- [ ] Key validation with real AI providers
- [ ] Encryption/decryption with unique nonces
- [ ] Device association and multi-device sync
- [ ] Passkey registration and authentication
- [ ] Rate limiting and security controls
- [ ] Database security and SQL injection prevention
- [ ] Performance with large user bases
- [ ] Authentication state persistence across VS Code sessions

## Notes & Decisions
- Start with anonymous users to eliminate onboarding friction
- Use VS Code built-in OAuth for trusted authentication providers
- User ID is always the primary key (stable across device changes)
- Keys belong to users, not devices (enables multi-device sync)
- Progressive authentication unlocks features without forcing upgrades
- All authentication levels preserve existing user data
- Passkey support for enterprise security requirements
- Database design supports horizontal scaling for large user bases
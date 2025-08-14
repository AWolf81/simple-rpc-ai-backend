/**
 * Multiple User ID Support Example
 * 
 * Demonstrates how the SecureVaultManager handles users with multiple IDs
 * from different auth providers and scenarios
 */

import { SecureVaultManager } from '../src/auth/SecureVaultManager.js';

// Example: User authenticates through different methods over time
async function demonstrateMultipleUserIds() {
  const vaultManager = new SecureVaultManager({
    bitwardenConfig: {
      serverUrl: 'http://localhost:8081',
      serviceEmail: 'service@company.com',
      servicePassword: 'secure-password'
    },
    databaseMasterKey: 'your-64-char-hex-master-key-here',
    userBridge: {} // UserIdentityBridge instance
  });

  console.log('🎭 Demonstrating Multiple User ID Support\n');

  // Scenario 1: User first signs up with email/password
  console.log('📧 Scenario 1: Initial email/password signup');
  const emailSignupJWT = `
    {
      "iss": "https://auth.your-company.com",
      "sub": "user-12345",
      "userId": "user-12345", 
      "email": "john@company.com",
      "iat": ${Math.floor(Date.now() / 1000)},
      "exp": ${Math.floor(Date.now() / 1000) + 3600}
    }
  `;

  await vaultManager.storeApiKey(
    Buffer.from(emailSignupJWT).toString('base64'),
    'sk-ant-initial-key-12345',
    'anthropic'
  );
  // User onboarded with primaryUserId: "user-12345"

  // Scenario 2: Same user later connects Google OAuth
  console.log('\n🔗 Scenario 2: User adds Google OAuth');
  const googleOAuthJWT = `
    {
      "iss": "https://auth.your-company.com",
      "sub": "user-12345",
      "userId": "user-12345",
      "googleId": "google-oauth-98765", 
      "email": "john@company.com",
      "iat": ${Math.floor(Date.now() / 1000)},
      "exp": ${Math.floor(Date.now() / 1000) + 3600}
    }
  `;

  const aiResult1 = await vaultManager.executeAIRequestWithAutoKey(
    Buffer.from(googleOAuthJWT).toString('base64'),
    'function test() { return "hello"; }',
    'code_review',
    'anthropic'
  );
  // Same user recognized, Google ID added to alternateUserIds

  // Scenario 3: User connects GitHub OAuth
  console.log('\n🐙 Scenario 3: User adds GitHub OAuth');
  const githubOAuthJWT = `
    {
      "iss": "https://auth.your-company.com", 
      "sub": "user-12345",
      "userId": "user-12345",
      "googleId": "google-oauth-98765",
      "githubId": "github-oauth-54321",
      "email": "john@company.com",
      "iat": ${Math.floor(Date.now() / 1000)},
      "exp": ${Math.floor(Date.now() / 1000) + 3600}
    }
  `;

  const aiResult2 = await vaultManager.executeAIRequestWithAutoKey(
    Buffer.from(githubOAuthJWT).toString('base64'),
    'const api = require("express");',
    'security_review',
    'anthropic'
  );
  // GitHub ID added to same user's alternateUserIds

  // Scenario 4: User switches to different auth provider (Auth0)
  console.log('\n🔄 Scenario 4: User migrates to Auth0');
  const auth0JWT = `
    {
      "iss": "https://company.auth0.com",
      "sub": "auth0|original-user-12345",
      "email": "john@company.com", 
      "custom_user_id": "user-12345",
      "iat": ${Math.floor(Date.now() / 1000)},
      "exp": ${Math.floor(Date.now() / 1000) + 3600}
    }
  `;

  const aiResult3 = await vaultManager.executeAIRequestWithAutoKey(
    Buffer.from(auth0JWT).toString('base64'),
    'SELECT * FROM users WHERE active = 1',
    'code_quality',
    'anthropic'
  );
  // Same user recognized via email matching and custom_user_id

  console.log('\n✅ All scenarios completed - same user, same vault, multiple IDs!');

  // Scenario 5: Enterprise SSO with different user format
  console.log('\n🏢 Scenario 5: Enterprise SSO (SAML/OIDC)');
  const enterpriseSSOJWT = `
    {
      "iss": "https://sso.enterprise.com",
      "sub": "enterprise-sso-john.doe.ext",
      "email": "john@company.com",
      "employee_id": "EMP123456",
      "department": "engineering", 
      "original_user_mapping": "user-12345",
      "iat": ${Math.floor(Date.now() / 1000)},
      "exp": ${Math.floor(Date.now() / 1000) + 3600}
    }
  `;

  const aiResult4 = await vaultManager.executeAIRequestWithAutoKey(
    Buffer.from(enterpriseSSOJWT).toString('base64'),
    'import pandas as pd',
    'code_review',
    'anthropic'
  );

  console.log('\n📊 Final User State:');
  const stats = vaultManager.getStats();
  console.log(`Total Users: ${stats.totalUsers}`);
  console.log(`Active Users: ${stats.activeUsers}`);
  console.log('\n🎉 One user, multiple auth methods, seamless experience!');
}

// Example: Handling edge cases
async function demonstrateEdgeCases() {
  console.log('\n🚨 Edge Case Scenarios\n');

  // Edge Case 1: User changes email address
  console.log('📧 Edge Case 1: Email address change');
  const emailChangeScenario = `
    User has primaryUserId: "user-12345" with email: "john@company.com"
    Later, user changes email to: "john.doe@company.com" 
    
    Solution: Email matching is secondary to user ID matching.
    Primary user ID remains stable across email changes.
  `;
  console.log(emailChangeScenario);

  // Edge Case 2: Account merge scenario
  console.log('\n🔀 Edge Case 2: Account merge');
  const accountMergeScenario = `
    User accidentally creates two accounts:
    - Account A: primaryUserId "user-12345" 
    - Account B: primaryUserId "user-67890"
    
    Solution: Business logic can merge accounts by:
    1. Copying all alternateUserIds from Account B to Account A
    2. Migrating API keys from Account B vault to Account A vault
    3. Updating userIdIndex to point all Account B IDs to Account A primary
    4. Deleting Account B mapping and vault
  `;
  console.log(accountMergeScenario);

  // Edge Case 3: Auth provider migration
  console.log('\n🏃 Edge Case 3: Auth provider migration');
  const providerMigrationScenario = `
    Company migrates from OpenSaaS to Auth0:
    
    Before: JWT has userId from OpenSaaS format
    After: JWT has userId from Auth0 format
    
    Solution: Include migration mapping in JWT:
    {
      "iss": "https://company.auth0.com", 
      "sub": "auth0|new-format-id",
      "legacy_user_id": "opensaas-user-12345",  // Maps to existing vault
      "email": "john@company.com"
    }
    
    System recognizes user via legacy_user_id and adds Auth0 ID as alternate.
  `;
  console.log(providerMigrationScenario);
}

// Example: Production considerations
function demonstrateProductionConsiderations() {
  console.log('\n🏭 Production Considerations\n');

  const considerations = `
  1. **Database Storage**: 
     - Store userMappings in PostgreSQL/MongoDB, not in-memory Map
     - Index on all user IDs for fast lookups
     - Use database transactions for user ID updates

  2. **Performance Optimization**:
     - Cache frequently accessed mappings in Redis
     - Use connection pooling for Vaultwarden API calls
     - Implement rate limiting per user (not per user ID)

  3. **Monitoring & Alerting**:
     - Track user ID additions/changes
     - Monitor for duplicate account creation attempts
     - Alert on unusual authentication patterns

  4. **Data Migration**:
     - Provide tools to merge duplicate accounts
     - Support bulk user ID mapping updates
     - Handle auth provider migrations gracefully

  5. **Compliance & Auditing**:
     - Log all user ID associations with timestamps
     - Support GDPR right to be forgotten across all user IDs
     - Maintain audit trail of account merges/changes

  6. **Security Considerations**:
     - Validate that new user IDs truly belong to the same person
     - Implement checks against account hijacking via ID manipulation
     - Use secure user ID extraction from JWTs with proper validation
  `;

  console.log(considerations);
}

// Run examples
if (require.main === module) {
  console.log('🚀 Multiple User ID Support Examples\n');
  
  demonstrateMultipleUserIds()
    .then(() => demonstrateEdgeCases())
    .then(() => demonstrateProductionConsiderations())
    .then(() => console.log('\n✨ Examples completed!'))
    .catch(error => console.error('❌ Error:', error));
}
#!/usr/bin/env ts-node

/**
 * Setup Service Account in Vaultwarden
 * 
 * Uses admin token to create the service account automatically
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load Vaultwarden configuration
dotenv.config({ path: '.env.vaultwarden' });

const ADMIN_CONFIG = {
  serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
  adminToken: process.env.VW_ADMIN_TOKEN,
  serviceEmail: process.env.VW_SERVICE_EMAIL || 'service@simple-rpc-ai.local',
  servicePassword: process.env.VW_SERVICE_PASSWORD,
};

console.log('🛠️  Vaultwarden Service Account Setup');
console.log('🔗 Server:', ADMIN_CONFIG.serverUrl);
console.log('👤 Service Email:', ADMIN_CONFIG.serviceEmail);

/**
 * Create service account using admin API
 */
async function createServiceAccount(): Promise<boolean> {
  console.log('\n👤 1. Creating service account...');
  
  if (!ADMIN_CONFIG.adminToken) {
    console.error('❌ VW_ADMIN_TOKEN not set in .env.vaultwarden');
    return false;
  }
  
  if (!ADMIN_CONFIG.servicePassword) {
    console.error('❌ VW_SERVICE_PASSWORD not set in .env.vaultwarden');
    return false;
  }

  try {
    // Check if user already exists
    const checkResponse = await axios.get(
      `${ADMIN_CONFIG.serverUrl}/admin/users`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_CONFIG.adminToken}`,
        }
      }
    );
    
    const existingUsers = checkResponse.data;
    const userExists = existingUsers.some((user: any) => 
      user.email === ADMIN_CONFIG.serviceEmail
    );
    
    if (userExists) {
      console.log('✅ Service account already exists');
      return true;
    }
    
    // Create new user
    const createResponse = await axios.post(
      `${ADMIN_CONFIG.serverUrl}/admin/users`,
      {
        email: ADMIN_CONFIG.serviceEmail,
        password: ADMIN_CONFIG.servicePassword,
        confirmed: true,
        enabled: true,
        emailVerified: true
      },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_CONFIG.adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Service account created successfully');
    console.log('📋 User info:', {
      id: createResponse.data.id,
      email: createResponse.data.email,
      enabled: createResponse.data.enabled
    });
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Failed to create service account:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Admin token invalid or expired');
    } else if (error.response?.status === 404) {
      console.log('💡 Admin API endpoint not available');
    }
    
    return false;
  }
}

/**
 * Create organization for service account
 */
async function createOrganization(): Promise<string | null> {
  console.log('\n🏢 2. Creating organization...');
  
  try {
    // First authenticate as service account to create org
    const loginResponse = await axios.post(
      `${ADMIN_CONFIG.serverUrl}/identity/connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        username: ADMIN_CONFIG.serviceEmail,
        password: ADMIN_CONFIG.servicePassword!,
        scope: 'api offline_access',
        client_id: 'web',
        deviceType: '10',
        deviceName: 'Simple-RPC-AI-Backend-Setup',
        deviceIdentifier: 'simple-rpc-ai-backend-setup-001'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );
    
    const accessToken = loginResponse.data.access_token;
    
    // Check existing organizations
    const orgsResponse = await axios.get(
      `${ADMIN_CONFIG.serverUrl}/api/organizations`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );
    
    const organizations = orgsResponse.data?.data || [];
    
    if (organizations.length > 0) {
      console.log('✅ Organization already exists:', organizations[0].name);
      return organizations[0].id;
    }
    
    // Create new organization
    const createOrgResponse = await axios.post(
      `${ADMIN_CONFIG.serverUrl}/api/organizations`,
      {
        name: 'Simple RPC AI Backend',
        businessName: 'Simple RPC AI Backend',
        billingEmail: ADMIN_CONFIG.serviceEmail,
        planType: 0, // Free plan
        seats: 10,
        maxCollections: 10,
        maxStorageGb: 1,
        selfHost: true,
        useGroups: false,
        useDirectory: false,
        useEvents: false,
        useTotp: false,
        use2fa: false,
        useApi: true,
        usePolicies: false,
        useBusinessPortal: false
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const orgId = createOrgResponse.data.id;
    console.log('✅ Organization created:', createOrgResponse.data.name);
    console.log('📋 Organization ID:', orgId);
    
    return orgId;
    
  } catch (error: any) {
    console.error('❌ Failed to create organization:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main setup function
 */
async function setupServiceAccount(): Promise<void> {
  console.log('🚀 Starting Service Account Setup\n');
  
  // Create service account
  const accountCreated = await createServiceAccount();
  if (!accountCreated) {
    console.log('\n❌ Cannot proceed without service account');
    process.exit(1);
  }
  
  // Create organization
  const orgId = await createOrganization();
  
  console.log('\n🎉 Service account setup completed!');
  
  if (orgId && !process.env.SIMPLE_RPC_ORG_ID) {
    console.log('\n📝 Add this to your .env.vaultwarden:');
    console.log(`SIMPLE_RPC_ORG_ID=${orgId}`);
  }
  
  console.log('\n📚 Next steps:');
  console.log('   1. Add SIMPLE_RPC_ORG_ID to .env.vaultwarden if shown above');
  console.log('   2. Run: npx ts-node test-vaultwarden-auth.ts');
  console.log('   3. Run: npx ts-node test-vaultwarden-direct.ts');
}

// Run the setup
setupServiceAccount().catch(error => {
  console.error('💥 Service account setup failed:', error);
  process.exit(1);
});
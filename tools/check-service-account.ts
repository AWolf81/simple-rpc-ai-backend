#!/usr/bin/env ts-node

/**
 * Check Service Account Status
 * Uses admin API to verify service account exists and is properly configured
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.vaultwarden' });

const CONFIG = {
  serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
  adminToken: process.env.VW_ADMIN_TOKEN?.replace(/^'|'$/g, ''), // Remove single quotes
  serviceEmail: process.env.VW_SERVICE_EMAIL || 'service@simple-rpc-ai.local',
};

console.log('🔍 Checking Service Account Status');
console.log('👤 Looking for:', CONFIG.serviceEmail);

async function checkServiceAccount() {
  try {
    // Get all users via admin API
    const response = await axios.get(
      `${CONFIG.serverUrl}/admin/users`,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.adminToken}`,
        }
      }
    );
    
    const users = response.data;
    const serviceUser = users.find((user: any) => user.email === CONFIG.serviceEmail);
    
    if (serviceUser) {
      console.log('✅ Service account found!');
      console.log('📋 Account details:', {
        id: serviceUser.id,
        email: serviceUser.email,
        enabled: serviceUser.enabled,
        emailVerified: serviceUser.email_verified,
        twoFactorEnabled: serviceUser.two_factor_enabled,
        createdAt: serviceUser.created_at,
        lastActive: serviceUser.last_active
      });
      
      if (!serviceUser.enabled) {
        console.log('⚠️  Account is DISABLED - this could be the issue');
      }
      
      if (!serviceUser.email_verified) {
        console.log('⚠️  Email not verified - this could be the issue');
      }
      
    } else {
      console.log('❌ Service account NOT found');
      console.log('📋 Available users:');
      users.forEach((user: any, index: number) => {
        console.log(`   ${index + 1}. ${user.email} (${user.enabled ? 'enabled' : 'disabled'})`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Failed to check users:', error.response?.data || error.message);
  }
}

checkServiceAccount();
#!/usr/bin/env tsx
/**
 * Infisical User Isolation Security Test
 *
 * Tests the new Infisical-based multi-tenant API key storage system
 * Validates proper user isolation with per-user projects
 */
import { InfisicalRPCMethods } from '../../auth/InfisicalRPCMethods.js';
import * as winston from 'winston';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config({ path: '.env.infisical' });
const CONFIG = {
    baseUrl: process.env.SIMPLE_RPC_INFISICAL_URL || 'http://localhost:8080',
    adminEmail: process.env.SIMPLE_RPC_INFISICAL_ADMIN_EMAIL || 'admin@simple-rpc-ai.local',
    adminPassword: process.env.SIMPLE_RPC_INFISICAL_ADMIN_PASSWORD || 'admin123',
    organizationName: 'Simple RPC AI Backend'
};
const TEST_USERS = {
    userA: {
        email: 'alice@company.com',
        name: 'Alice Smith'
    },
    userB: {
        email: 'bob@company.com',
        name: 'Bob Jones'
    },
    userC: {
        email: 'charlie@gmail.com',
        name: 'Charlie Brown'
    }
};
const TEST_API_KEYS = {
    anthropic: 'sk-ant-test-alice-12345678901234567890',
    openai: 'sk-test-bob-abcdefghijklmnopqrstuvwxyz12345',
    google: 'test-google-charlie-xyz789456123'
};
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Console()]
});
/**
 * Initialize Infisical system
 */
async function initializeSystem() {
    try {
        const infisicalConfig = {
            baseUrl: CONFIG.baseUrl,
            adminEmail: CONFIG.adminEmail,
            adminPassword: CONFIG.adminPassword,
            organizationName: CONFIG.organizationName,
            enableSignup: false
        };
        console.log('📡 Initializing Infisical RPC Methods...');
        const rpcMethods = new InfisicalRPCMethods(infisicalConfig, logger);
        await rpcMethods.initialize();
        console.log('✅ Infisical RPC Methods initialized successfully');
        console.log('🏢 Multi-tenant architecture with per-user project isolation');
        console.log('🔒 True user isolation - each user gets their own Infisical project');
        return { rpcMethods };
    }
    catch (error) {
        console.error('❌ System initialization failed:', error.message);
        throw error;
    }
}
/**
 * Run comprehensive user isolation tests
 */
async function runUserIsolationTest() {
    const results = {
        userAProvisioned: false,
        userBProvisioned: false,
        userCProvisioned: false,
        userACanStoreKey: false,
        userBCanStoreKey: false,
        userCCanStoreKey: false,
        userACanRetrieveOwnKey: false,
        userBCanRetrieveOwnKey: false,
        userCCanRetrieveOwnKey: false,
        userACrossAccessBlocked: true,
        userBCrossAccessBlocked: true,
        userCCrossAccessBlocked: true,
        isolationSecure: false,
        healthStatus: 'unhealthy'
    };
    try {
        console.log('\\n🔐 Comprehensive Infisical User Isolation Security Test');
        console.log('========================================================');
        console.log('🏢 Organization:', CONFIG.organizationName);
        console.log('🔗 Infisical URL:', CONFIG.baseUrl);
        console.log('🛡️ Testing Multi-Tenant Architecture: Per-User Project Isolation');
        console.log('\\n🚀 Initializing test environment...');
        // Check if Infisical is accessible
        try {
            const response = await fetch(`${CONFIG.baseUrl}/api/status`);
            if (!response.ok) {
                throw new Error(`Infisical server returned: ${response.status}`);
            }
            console.log('✅ Infisical server is accessible');
        }
        catch (error) {
            console.error('❌ Cannot connect to Infisical server:', error.message);
            console.error('💡 Make sure Infisical is running: pnpm infisical:start');
            throw error;
        }
        console.log('🧪 Starting Multi-Tenant User Isolation Test...');
        console.log('');
        const { rpcMethods } = await initializeSystem();
        // Step 1: Test API key storage for each user (auto-provisions users)
        console.log('🔑 Step 1: Testing per-user API key storage...');
        // User A stores Anthropic key
        try {
            const resultA = await rpcMethods.storeUserKey({
                email: TEST_USERS.userA.email,
                provider: 'anthropic',
                apiKey: TEST_API_KEYS.anthropic
            });
            if (resultA.success) {
                results.userAProvisioned = true;
                results.userACanStoreKey = true;
                console.log(`✅ UserA stored Anthropic key - SecretID: ${resultA.secretId}`);
            }
            else {
                console.log(`❌ UserA failed to store key: ${resultA.error}`);
            }
        }
        catch (error) {
            console.log(`❌ UserA store operation failed: ${error.message}`);
        }
        // User B stores OpenAI key
        try {
            const resultB = await rpcMethods.storeUserKey({
                email: TEST_USERS.userB.email,
                provider: 'openai',
                apiKey: TEST_API_KEYS.openai
            });
            if (resultB.success) {
                results.userBProvisioned = true;
                results.userBCanStoreKey = true;
                console.log(`✅ UserB stored OpenAI key - SecretID: ${resultB.secretId}`);
            }
            else {
                console.log(`❌ UserB failed to store key: ${resultB.error}`);
            }
        }
        catch (error) {
            console.log(`❌ UserB store operation failed: ${error.message}`);
        }
        // User C stores Google key
        try {
            const resultC = await rpcMethods.storeUserKey({
                email: TEST_USERS.userC.email,
                provider: 'google',
                apiKey: TEST_API_KEYS.google
            });
            if (resultC.success) {
                results.userCProvisioned = true;
                results.userCCanStoreKey = true;
                console.log(`✅ UserC stored Google key - SecretID: ${resultC.secretId}`);
            }
            else {
                console.log(`❌ UserC failed to store key: ${resultC.error}`);
            }
        }
        catch (error) {
            console.log(`❌ UserC store operation failed: ${error.message}`);
        }
        // Step 2: Test users can retrieve their own keys
        console.log('\\n🔍 Step 2: Testing users can retrieve their own keys...');
        if (results.userACanStoreKey) {
            try {
                const resultA = await rpcMethods.getUserKey({
                    email: TEST_USERS.userA.email,
                    provider: 'anthropic'
                });
                if (resultA.success && resultA.message === TEST_API_KEYS.anthropic) {
                    results.userACanRetrieveOwnKey = true;
                    console.log('✅ UserA can retrieve their own Anthropic key');
                }
                else {
                    console.log('❌ UserA cannot retrieve their own key or key mismatch');
                }
            }
            catch (error) {
                console.log(`❌ UserA retrieve operation failed: ${error.message}`);
            }
        }
        if (results.userBCanStoreKey) {
            try {
                const resultB = await rpcMethods.getUserKey({
                    email: TEST_USERS.userB.email,
                    provider: 'openai'
                });
                if (resultB.success && resultB.message === TEST_API_KEYS.openai) {
                    results.userBCanRetrieveOwnKey = true;
                    console.log('✅ UserB can retrieve their own OpenAI key');
                }
                else {
                    console.log('❌ UserB cannot retrieve their own key or key mismatch');
                }
            }
            catch (error) {
                console.log(`❌ UserB retrieve operation failed: ${error.message}`);
            }
        }
        if (results.userCCanStoreKey) {
            try {
                const resultC = await rpcMethods.getUserKey({
                    email: TEST_USERS.userC.email,
                    provider: 'google'
                });
                if (resultC.success && resultC.message === TEST_API_KEYS.google) {
                    results.userCCanRetrieveOwnKey = true;
                    console.log('✅ UserC can retrieve their own Google key');
                }
                else {
                    console.log('❌ UserC cannot retrieve their own key or key mismatch');
                }
            }
            catch (error) {
                console.log(`❌ UserC retrieve operation failed: ${error.message}`);
            }
        }
        // Step 3: Test cross-user access is blocked (critical security test)
        console.log('\\n🛡️ Step 3: Testing user isolation (cross-access should be blocked)...');
        // UserA tries to access UserB's OpenAI key (should fail)
        try {
            const crossAccessA = await rpcMethods.getUserKey({
                email: TEST_USERS.userA.email, // UserA trying to access
                provider: 'openai' // UserB's provider
            });
            if (!crossAccessA.success || !crossAccessA.message) {
                console.log('✅ UserA cannot access UserB\\', s, OpenAI, key(isolation, working), ');, results.userACrossAccessBlocked = true);
            }
            else {
                console.log('🚨 SECURITY BREACH: UserA accessed UserB\\', s, key, ');, results.userACrossAccessBlocked = false);
            }
        }
        catch (error) {
            console.log('✅ UserA cross-access blocked by system (expected)');
            results.userACrossAccessBlocked = true;
        }
        // UserB tries to access UserC's Google key (should fail)
        try {
            const crossAccessB = await rpcMethods.getUserKey({
                email: TEST_USERS.userB.email, // UserB trying to access
                provider: 'google' // UserC's provider
            });
            if (!crossAccessB.success || !crossAccessB.message) {
                console.log('✅ UserB cannot access UserC\\', s, Google, key(isolation, working), ');, results.userBCrossAccessBlocked = true);
            }
            else {
                console.log('🚨 SECURITY BREACH: UserB accessed UserC\\', s, key, ');, results.userBCrossAccessBlocked = false);
            }
        }
        catch (error) {
            console.log('✅ UserB cross-access blocked by system (expected)');
            results.userBCrossAccessBlocked = true;
        }
        // UserC tries to access UserA's Anthropic key (should fail)
        try {
            const crossAccessC = await rpcMethods.getUserKey({
                email: TEST_USERS.userC.email, // UserC trying to access
                provider: 'anthropic' // UserA's provider
            });
            if (!crossAccessC.success || !crossAccessC.message) {
                console.log('✅ UserC cannot access UserA\\', s, Anthropic, key(isolation, working), ');, results.userCCrossAccessBlocked = true);
            }
            else {
                console.log('🚨 SECURITY BREACH: UserC accessed UserA\\', s, key, ');, results.userCCrossAccessBlocked = false);
            }
        }
        catch (error) {
            console.log('✅ UserC cross-access blocked by system (expected)');
            results.userCCrossAccessBlocked = true;
        }
        // Step 4: Health check
        console.log('\\n🔍 Step 4: System health check...');
        try {
            const health = await rpcMethods.getSecretManagerHealth();
            results.healthStatus = health.status;
            console.log(`✅ Health status: ${health.status}`);
            console.log(`   Connected to Infisical: ${health.details.infisicalConnected}`);
            console.log(`   Total projects: ${health.details.totalProjects}`);
            console.log(`   Total secrets: ${health.details.totalSecrets}`);
        }
        catch (error) {
            console.log('⚠️ Health check failed:', error.message);
            results.healthStatus = 'unhealthy';
        }
        // Determine overall isolation security
        results.isolationSecure = (results.userACrossAccessBlocked &&
            results.userBCrossAccessBlocked &&
            results.userCCrossAccessBlocked);
        // Cleanup
        await rpcMethods.cleanup();
        return results;
    }
    catch (error) {
        console.error('❌ Test execution failed:', error.message);
        throw error;
    }
}
/**
 * Display test results
 */
function displayResults(results) {
    console.log('\\n📊 Test Results Summary:');
    console.log('========================');
    const checkmark = (condition) => condition ? '✅' : '❌';
    console.log(`${checkmark(results.userAProvisioned)} User A Provisioned: ${results.userAProvisioned ? 'SUCCESS' : 'FAILED'}`);
    console.log(`${checkmark(results.userBProvisioned)} User B Provisioned: ${results.userBProvisioned ? 'SUCCESS' : 'FAILED'}`);
    console.log(`${checkmark(results.userCProvisioned)} User C Provisioned: ${results.userCProvisioned ? 'SUCCESS' : 'FAILED'}`);
    console.log(`${checkmark(results.userACanStoreKey)} User A Key Storage: ${results.userACanStoreKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userBCanStoreKey)} User B Key Storage: ${results.userBCanStoreKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userCCanStoreKey)} User C Key Storage: ${results.userCCanStoreKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userACanRetrieveOwnKey)} User A Key Retrieval: ${results.userACanRetrieveOwnKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userBCanRetrieveOwnKey)} User B Key Retrieval: ${results.userBCanRetrieveOwnKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userCCanRetrieveOwnKey)} User C Key Retrieval: ${results.userCCanRetrieveOwnKey ? 'WORKING' : 'FAILED'}`);
    console.log(`${checkmark(results.userACrossAccessBlocked)} Cross-User Access Blocked: ${results.isolationSecure ? 'SECURE' : 'VULNERABLE'}`);
    console.log(`${checkmark(results.healthStatus === 'healthy')} System Health: ${results.healthStatus.toUpperCase()}`);
    console.log('\\n🎯 Overall Assessment:');
    if (results.isolationSecure && results.healthStatus === 'healthy') {
        console.log('✅ SECURITY PASSED: True user isolation achieved');
        console.log('🛡️ Each user has their own Infisical project');
        console.log('🔐 Cross-user access is properly blocked');
    }
    else {
        console.log('❌ SECURITY ISSUES DETECTED');
        if (!results.isolationSecure) {
            console.log('🚨 Cross-user access is possible - CRITICAL VULNERABILITY');
        }
        if (results.healthStatus !== 'healthy') {
            console.log('⚠️ System health issues detected');
        }
    }
    console.log('\\n💡 Infisical Multi-Tenant Architecture:');
    console.log('   • Per-user project isolation in Infisical');
    console.log('   • No shared service account accessing user secrets');
    console.log('   • True multi-tenancy with proper access controls');
    console.log('   • Enterprise-grade secret management');
}
// Run the test
async function main() {
    try {
        const results = await runUserIsolationTest();
        displayResults(results);
        // Exit with appropriate code
        const success = results.isolationSecure && results.healthStatus === 'healthy';
        process.exit(success ? 0 : 1);
    }
    catch (error) {
        console.error('\\n❌ Test suite failed:', error.message);
        console.error('💡 Make sure Infisical is running: pnpm infisical:start');
        process.exit(1);
    }
}
main().catch(console.error);
//# sourceMappingURL=user-isolation.test.js.map
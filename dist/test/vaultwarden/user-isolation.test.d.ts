#!/usr/bin/env ts-node
/**
 * Comprehensive Vaultwarden User Isolation Security Test
 *
 * Tests the secure user isolation architecture where:
 * - Service account can ONLY provision users
 * - Service account CANNOT access user secrets
 * - Each user has isolated Vaultwarden account
 * - Users authenticate with their own credentials
 */
interface IsolationTestResults {
    userAProvisioned: boolean;
    userBProvisioned: boolean;
    userCProvisioned: boolean;
    userACanAccessOwnKey: boolean;
    userBCanAccessOwnKey: boolean;
    userCCanAccessOwnKey: boolean;
    userACanAccessUserBKey: boolean;
    userBCanAccessUserAKey: boolean;
    userACanAccessUserCKey: boolean;
    userCCanAccessUserAKey: boolean;
    crossAccessBlocked: boolean;
    isolationVerified: boolean;
}
/**
 * Test token-based user isolation with encrypted access tokens
 * This demonstrates proper user isolation without storing passwords
 */
declare function testUserIsolation(): Promise<IsolationTestResults>;
/**
 * Analyze results and provide architecture assessment
 */
declare function analyzeResults(results: IsolationTestResults): void;
export { testUserIsolation, analyzeResults };
//# sourceMappingURL=user-isolation.test.d.ts.map
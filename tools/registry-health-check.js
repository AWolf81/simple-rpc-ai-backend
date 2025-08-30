/**
 * Example: Registry Health Check
 * 
 * Checks the AI model registry health status and reports
 * current availability and configuration.
 */

import { ProviderRegistryService } from '../dist/services/provider-registry.js';

async function checkRegistryHealth() {
  console.log('🏥 Registry Health Check\n');

  // Create provider registry service
  const registry = new ProviderRegistryService(
    ['anthropic', 'openai', 'google'], // service providers
    ['anthropic', 'openai', 'google']  // byok providers
  );

  try {
    // Get registry health status
    console.log('🔍 Checking AI model registry health...');
    const health = await registry.getHealthStatus();
    
    console.log('📊 Registry Health Status:');
    console.log('─'.repeat(50));
    
    // Status overview
    const statusEmoji = {
      'healthy': '✅',
      'degraded': '⚠️',
      'unavailable': '❌',
      'unknown': '❓',
      'error': '💥'
    };
    
    console.log(`Status: ${statusEmoji[health.status]} ${health.status.toUpperCase()}`);
    console.log(`Available: ${health.available ? '✅ Yes' : '❌ No'}`);
    console.log(`Last Update: ${health.lastUpdate || 'Never'}`);
    console.log(`Response Time: ${health.performance.responseTimeMs}ms`);
    console.log('');

    // Provider information
    console.log('🔌 Provider Status:');
    console.log(`  Configured: ${health.providers.configured.length} (${health.providers.configured.join(', ')})`);
    console.log(`  Available: ${health.providers.available.length} (${health.providers.available.join(', ')})`);
    
    if (health.providers.failed.length > 0) {
      console.log(`  Failed: ${health.providers.failed.length} (${health.providers.failed.join(', ')})`);
    }
    console.log('');

    // Pricing information
    console.log('💰 Pricing Overrides:');
    console.log(`  Override Keys: ${health.pricing.overrides}`);
    console.log(`  Total Overrides: ${health.pricing.totalOverrideCount}`);
    console.log('');

    // Performance metrics
    console.log('⚡ Performance:');
    console.log(`  Response Time: ${health.performance.responseTimeMs}ms`);
    console.log(`  Cache Hit: ${health.performance.cacheHit ? '✅ Yes' : '❌ No'}`);
    console.log('');

    // Errors (if any)
    if (health.errors.length > 0) {
      console.log('🚨 Errors:');
      health.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log('');
    }

    // Health recommendations
    console.log('💡 Recommendations:');
    if (health.status === 'healthy') {
      console.log('  ✅ Registry is operating normally');
    } else if (health.status === 'degraded') {
      console.log('  ⚠️  Some providers are failing - check error details');
      console.log('  📋 Some providers may have connectivity issues');
    } else if (health.status === 'unavailable') {
      console.log('  ❌ Registry is unavailable - using fallback data');
      console.log('  🔄 Check network connectivity and @anolilab/ai-model-registry package');
      console.log('  ✅ Application will still work with built-in fallback models');
    }

    if (health.performance.responseTimeMs > 5000) {
      console.log('  🐌 Slow response time - consider caching optimization');
    }

    if (health.pricing.overrides > 0) {
      console.log(`  💰 ${health.pricing.overrides} pricing overrides active`);
    }

    return health;

  } catch (error) {
    console.error('❌ Failed to check registry health:', error.message);
    console.log('\n💡 This indicates a problem with the @anolilab/ai-model-registry package or network connectivity');
    return null;
  }
}

// Command line usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Registry Health Check

Usage:
  node registry-health-check.js        # Check registry health
  node registry-health-check.js --help # Show this help

Examples:
  pnpm registry:health
  node tools/registry-health-check.js
`);
  } else {
    checkRegistryHealth().catch(console.error);
  }
}

export { checkRegistryHealth };
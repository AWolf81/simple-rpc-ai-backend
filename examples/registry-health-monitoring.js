/**
 * Example: Registry Health Monitoring
 * 
 * Demonstrates how to monitor the AI model registry health status
 * for operational monitoring and alerting.
 */

import { createTypedAIClient } from '../dist/index.js';
import { httpBatchLink } from '@trpc/client';

async function monitorRegistryHealth() {
  console.log('🏥 Registry Health Monitoring Demo\n');

  // Create typed tRPC client
  const client = createTypedAIClient({
    links: [
      httpBatchLink({ 
        url: 'http://localhost:8000/trpc'
      })
    ]
  });

  try {
    // Get registry health status
    const health = await client.ai.getRegistryHealth.query();
    
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
    console.log(`Checked At: ${health.checkedAt}`);
    console.log(`Version: ${health.version}`);
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
      console.log('  📋 Consider running: pnpm run registry:setup');
    } else if (health.status === 'unavailable') {
      console.log('  ❌ Registry is unavailable - using fallback data');
      console.log('  🔄 Check network connectivity');
      console.log('  📋 Verify @anolilab/ai-model-registry installation');
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
    console.log('\n💡 Make sure the server is running with:');
    console.log('   pnpm dev:server');
    return null;
  }
}

/**
 * Continuous monitoring function
 */
async function continuousMonitoring(intervalMinutes = 5) {
  console.log(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)...\n`);
  
  const monitor = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Checking registry health...`);
    
    const health = await monitorRegistryHealth();
    
    if (health) {
      // Simple alerting logic
      if (health.status === 'unavailable') {
        console.log('🚨 ALERT: Registry is unavailable!');
        // In production, send to monitoring system
      } else if (health.status === 'degraded') {
        console.log('⚠️  WARNING: Registry is degraded');
      }
    }
    
    console.log('─'.repeat(80));
  };

  // Initial check
  await monitor();
  
  // Set up interval
  setInterval(monitor, intervalMinutes * 60 * 1000);
}

// Command line usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const args = process.argv.slice(2);
  
  if (args.includes('--continuous')) {
    const interval = parseInt(args[args.indexOf('--continuous') + 1]) || 5;
    continuousMonitoring(interval).catch(console.error);
  } else if (args.includes('--help')) {
    console.log(`
Registry Health Monitoring

Usage:
  node registry-health-monitoring.js                    # Single check
  node registry-health-monitoring.js --continuous [5]   # Continuous monitoring (minutes)
  node registry-health-monitoring.js --help             # Show this help

Examples:
  node registry-health-monitoring.js
  node registry-health-monitoring.js --continuous 10
`);
  } else {
    monitorRegistryHealth().catch(console.error);
  }
}

export { monitorRegistryHealth, continuousMonitoring };
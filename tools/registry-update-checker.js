/**
 * Example: Registry Update Checker
 * 
 * Checks for new models, pricing changes, or other updates
 * in the AI model registry and reports findings.
 */

import { ProviderRegistryService } from '../dist/services/provider-registry.js';

async function checkForUpdates() {
  console.log('🔄 Registry Update Checker\n');

  try {
    console.log('🔍 Testing direct registry access...');
    
    // Test direct registry access first
    const registryModule = await import('@anolilab/ai-model-registry');
    const allProviders = registryModule.getProviders();
    const allModels = registryModule.getAllModels();
    
    console.log(`✅ Registry accessible: ${allProviders.length} providers, ${allModels.length} total models\n`);
    
    // Show available providers
    console.log('🔌 Available Provider Names in Registry:');
    console.log('─'.repeat(50));
    const mainProviders = ['Anthropic', 'OpenAI', 'Google', 'OpenRouter'].filter(p => allProviders.includes(p));
    mainProviders.forEach(provider => {
      const models = registryModule.getModelsByProvider(provider);
      console.log(`✅ ${provider}: ${models.length} models`);
      if (models.length > 0) {
        console.log(`   Latest: ${models[0]?.name || models[0]?.id}`);
      }
    });
    
    console.log('\n📋 Registry Model Summary:');
    console.log('─'.repeat(30));
    const providerStats = registryModule.getProviderStats();
    Object.entries(providerStats).forEach(([provider, count]) => {
      if (mainProviders.includes(provider)) {
        console.log(`${provider}: ${count} models`);
      }
    });

    // Create provider registry service
    const registry = new ProviderRegistryService(
      ['anthropic', 'openai', 'google'], // service providers
      ['anthropic', 'openai', 'google']  // byok providers
    );

    console.log('\n📡 Checking provider registry service integration...');
    
    // Get current registry health and data
    const health = await registry.getHealthStatus();
    console.log(`📊 Registry Status: ${health.status.toUpperCase()}`);
    console.log(`⚡ Response Time: ${health.performance.responseTimeMs}ms\n`);

    // Check for pricing changes
    const pricingChanges = await registry.checkForPricingChanges();
    
    console.log('💰 Pricing Update Check:');
    console.log('─'.repeat(40));
    
    if (pricingChanges.hasChanges) {
      console.log('🚨 PRICING CHANGES DETECTED:');
      pricingChanges.changes.forEach((change, index) => {
        console.log(`   ${index + 1}. ${change}`);
      });
      console.log('\n⚠️  Consider reviewing and updating any pricing overrides');
    } else {
      console.log('✅ No pricing changes detected');
    }

    // Get provider information
    console.log('\n🔌 Provider Update Status:');
    console.log('─'.repeat(40));
    
    for (const providerName of health.providers.configured) {
      try {
        const providers = await registry.getConfiguredProviders('all');
        const provider = providers.find(p => p.name === providerName);
        
        if (provider) {
          console.log(`✅ ${provider.displayName}: ${provider.models.length} models available`);
          
          // Show latest models (last 3)
          const sortedModels = provider.models.sort((a, b) => (b.contextLength || 0) - (a.contextLength || 0));
          const latestModels = sortedModels.slice(0, 3);
          latestModels.forEach(model => {
            console.log(`   • ${model.name} (${model.contextLength?.toLocaleString() || 'unknown'} context)`);
          });
        } else {
          console.log(`⚠️  ${providerName}: No data available`);
        }
      } catch (error) {
        console.log(`❌ ${providerName}: Error - ${error.message}`);
      }
    }

    // Registry metadata check
    console.log('\n📋 Registry Information:');
    console.log('─'.repeat(40));
    console.log(`Last Update: ${health.lastUpdate || 'Unknown'}`);
    console.log(`Available Providers: ${health.providers.available.length}`);
    console.log(`Failed Providers: ${health.providers.failed.length}`);
    console.log(`Pricing Overrides: ${health.pricing.overrides}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('─'.repeat(40));
    
    if (health.status === 'healthy') {
      console.log('✅ Registry is up to date and working well');
    } else if (health.status === 'degraded') {
      console.log('⚠️  Some providers have issues - check network connectivity');
    } else if (health.status === 'unavailable') {
      console.log('❌ Registry unavailable - using fallback data');
      console.log('   The @anolilab/ai-model-registry package may need updating');
      console.log('   Try: npm update @anolilab/ai-model-registry');
    }

    if (pricingChanges.hasChanges) {
      console.log('💰 Review pricing changes and update overrides if needed');
    }

    console.log('\n✅ Update check complete');
    return true;

  } catch (error) {
    console.error('❌ Failed to check for updates:', error.message);
    console.log('\n💡 This may indicate:');
    console.log('   • Network connectivity issues');
    console.log('   • @anolilab/ai-model-registry package problems');
    console.log('   • Configuration issues with providers');
    return false;
  }
}

// Command line usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Registry Update Checker

Usage:
  node registry-update-checker.js        # Check for updates
  node registry-update-checker.js --help # Show this help

Examples:
  pnpm registry:check-updates
  node tools/registry-update-checker.js

What it checks:
  • New models from providers
  • Pricing changes
  • Registry connectivity
  • Provider status updates
`);
  } else {
    checkForUpdates().catch(console.error);
  }
}

export { checkForUpdates };
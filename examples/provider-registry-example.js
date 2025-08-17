/**
 * Example: Enhanced Provider Registry Usage
 * 
 * Demonstrates the new AI model registry integration with filtering
 * and pricing override capabilities.
 */

import { createTypedAIClient } from '../dist/index.js';
import { httpBatchLink } from '@trpc/client';

async function demonstrateProviderRegistry() {
  console.log('🚀 Enhanced Provider Registry Demo\n');

  // Create typed tRPC client
  const client = createTypedAIClient({
    links: [
      httpBatchLink({ 
        url: 'http://localhost:8000/trpc'
      })
    ]
  });

  try {
    // Get service providers (filtered from registry)
    console.log('📋 Service Providers:');
    const serviceProviders = await client.ai.listProviders.query();
    console.log(JSON.stringify(serviceProviders, null, 2));
    console.log('\n');

    // Get BYOK providers (filtered from registry)
    console.log('🔑 BYOK Providers:');
    const byokProviders = await client.ai.listProvidersBYOK.query();
    console.log(JSON.stringify(byokProviders, null, 2));
    console.log('\n');

    // Show enhanced provider information
    if (serviceProviders.providers.length > 0) {
      const firstProvider = serviceProviders.providers[0];
      console.log('🔍 Enhanced Provider Details:');
      console.log(`Name: ${firstProvider.name}`);
      console.log(`Display Name: ${firstProvider.displayName}`);
      console.log(`Priority: ${firstProvider.priority}`);
      console.log(`Service Provider: ${firstProvider.isServiceProvider}`);
      console.log(`BYOK Provider: ${firstProvider.isByokProvider}`);
      console.log(`Models: ${firstProvider.models.length}`);
      
      if (firstProvider.models.length > 0) {
        console.log('\n📊 Model Information:');
        firstProvider.models.forEach(model => {
          console.log(`  • ${model.name} (${model.id})`);
          console.log(`    Context: ${model.contextLength} tokens`);
          console.log(`    Capabilities: ${model.capabilities.join(', ')}`);
          if (model.inputCostPer1k) {
            console.log(`    Input Cost: $${model.inputCostPer1k}/1k tokens`);
          }
          if (model.outputCostPer1k) {
            console.log(`    Output Cost: $${model.outputCostPer1k}/1k tokens`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error fetching providers:', error.message);
    console.log('\n💡 Make sure the server is running with:');
    console.log('   pnpm dev:server');
  }
}

// Command line usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  demonstrateProviderRegistry().catch(console.error);
}

export { demonstrateProviderRegistry };
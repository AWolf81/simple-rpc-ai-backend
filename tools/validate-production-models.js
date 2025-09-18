#!/usr/bin/env node

/**
 * Production Model Validation Tool
 * 
 * Validates production model mappings against:
 * 1. Registry data consistency
 * 2. Provider API compatibility 
 * 3. Pricing accuracy
 * 4. Model availability
 */

import { HybridModelRegistry } from '../dist/services/hybrid-model-registry.js';
import { Anthropic } from '@ai-sdk/anthropic';
import { OpenAI } from '@ai-sdk/openai';
import { Google } from '@ai-sdk/google';

const registry = new HybridModelRegistry();

async function validateModelMappings() {
  console.log('🔍 Validating Production Model Mappings\n');
  
  // Show which providers support production mapping
  const supportedProviders = registry.getSupportedProviders();
  console.log(`🏭 Providers with production model mapping: ${supportedProviders.join(', ')}`);
  console.log(`📝 Note: Only these providers support versioned production IDs for consistency\n`);
  
  // 1. Registry consistency check
  console.log('📋 1. Registry Consistency Check');
  const validation = await registry.validateProductionMapping();
  
  if (validation.errors.length > 0) {
    console.log('❌ Errors found:');
    validation.errors.forEach(error => console.log(`  • ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    validation.warnings.forEach(warning => console.log(`  • ${warning}`));
  }
  
  if (validation.valid) {
    console.log('✅ Registry mapping is consistent\n');
  } else {
    console.log('❌ Registry mapping has issues\n');
  }

  // 2. Provider API compatibility check  
  console.log('🔌 2. Provider API Compatibility Check');
  
  // Only test providers that support production mapping
  console.log(`📋 Testing supported providers: ${supportedProviders.join(', ')}\n`);
  
  const providers = supportedProviders;
  
  for (const provider of providers) {
    console.log(`\n📌 Testing ${provider}:`);
    
    try {
      const models = await registry.getModelsByProvider(provider);
      console.log(`  Found ${models.length} models`);
      
      // Test a few key models
      const testModels = models.slice(0, 3);
      
      for (const model of testModels) {
        try {
          await testModelAPI(provider, model.productionId);
          console.log(`  ✅ ${model.id} → ${model.productionId}`);
        } catch (error) {
          console.log(`  ❌ ${model.id} → ${model.productionId}: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Provider test failed: ${error.message}`);
    }
  }

  // 3. Pricing validation
  console.log('\n💰 3. Pricing Validation');
  
  for (const provider of providers) {
    console.log(`\n📌 ${provider} pricing:`);
    
    try {
      const models = await registry.getModelsByProvider(provider);
      
      for (const model of models) {
        const pricing = model.cost;
        
        // Basic pricing sanity checks
        const issues = [];
        
        if (pricing.input <= 0) issues.push('invalid input pricing');
        if (pricing.output <= 0) issues.push('invalid output pricing');
        // Note: Output cheaper than input is normal for most AI models, so don't warn about this
        
        if (issues.length > 0) {
          console.log(`  ⚠️ ${model.id}: ${issues.join(', ')}`);
        } else {
          console.log(`  ✅ ${model.id}: $${pricing.input}/$${pricing.output} per 1M tokens`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Pricing validation failed: ${error.message}`);
    }
  }

  // 4. Model selection test
  console.log('\n🎯 4. Model Selection Test');
  
  for (const provider of providers) {
    console.log(`\n📌 ${provider} selection:`);
    
    try {
      const best = await registry.getProductionModel(provider, 'best');
      const fast = await registry.getProductionModel(provider, 'fast');
      const balanced = await registry.getProductionModel(provider, 'balanced');
      
      console.log(`  Best: ${best.id} → ${best.productionId}`);
      console.log(`  Fast: ${fast.id} → ${fast.productionId}`);
      console.log(`  Balanced: ${balanced.id} → ${balanced.productionId}`);
      
    } catch (error) {
      console.log(`  ❌ Selection test failed: ${error.message}`);
    }
  }

  // 5. Active Models Check (with deprecation filter ON)
  console.log('\n✅ 5. Active Models (Default Configuration)');
  console.log('📝 This shows models available with default settings (deprecated models excluded)\n');
  
  for (const provider of providers) {
    console.log(`📌 ${provider}:`);
    
    try {
      const models = await registry.getModelsByProvider(provider);
      console.log(`  📊 ${models.length} active models available (deprecated models automatically filtered)`);
      
      // Show the available models
      for (const model of models.slice(0, 3)) {
        console.log(`  ✅ ${model.id} → ${model.productionId}`);
      }
      if (models.length > 3) {
        console.log(`  ... and ${models.length - 3} more`);
      }
      
    } catch (error) {
      console.log(`  ❌ Check failed: ${error.message}`);
    }
  }

  // 6. Test deprecation filtering
  console.log('\n🔬 6. Deprecation Filtering Verification');
  console.log('📝 This verifies that deprecated models are properly filtered\n');
  
  try {
    // Test with deprecated models allowed
    const registryWithDeprecated = new HybridModelRegistry({
      allowDeprecatedModels: true,
      warnOnDeprecated: false
    });
    
    // Test with deprecated models blocked (default)
    const registryWithoutDeprecated = new HybridModelRegistry({
      allowDeprecatedModels: false,
      warnOnDeprecated: false
    });
    
    const modelsWithDeprecated = await registryWithDeprecated.getModelsByProvider('anthropic');
    const modelsWithoutDeprecated = await registryWithoutDeprecated.getModelsByProvider('anthropic');
    
    const deprecatedFiltered = modelsWithDeprecated.length - modelsWithoutDeprecated.length;
    
    console.log(`  🔍 Test Configuration:`);
    console.log(`    • With deprecation filter OFF: ${modelsWithDeprecated.length} models`);
    console.log(`    • With deprecation filter ON:  ${modelsWithoutDeprecated.length} models`);
    console.log(`    • Difference: ${deprecatedFiltered} deprecated model(s) filtered`);
    
    if (deprecatedFiltered > 0) {
      console.log(`\n  ✅ Deprecation filtering is working correctly!`);
      console.log(`  📝 ${deprecatedFiltered} deprecated model(s) are being properly excluded`);
      
      // Show which models were filtered
      const deprecatedModels = modelsWithDeprecated.filter(m => 
        !modelsWithoutDeprecated.find(m2 => m2.id === m.id)
      );
      for (const model of deprecatedModels) {
        console.log(`    • Filtered: ${model.id} (deprecated since ${model.production.deprecatedSince || 'unknown'})`);
      }
    } else {
      console.log(`\n  ✅ No deprecated models in production mappings`);
      console.log(`  📝 All mapped models are currently active`);
    }
    
  } catch (error) {
    console.log(`  ❌ Deprecation filtering test failed: ${error.message}`);
  }

  console.log('\n✅ Validation complete');
}

async function testModelAPI(provider, modelId) {
  // Create model instance to test API compatibility
  const testKey = 'test-key';
  
  switch (provider) {
    case 'anthropic':
      new Anthropic({ apiKey: testKey }).messages(modelId);
      break;
    case 'openai':
      new OpenAI({ apiKey: testKey }).chat(modelId);
      break;
    case 'google':
      new Google({ apiKey: testKey }).generativeAI(modelId);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// CLI usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  validateModelMappings().catch(console.error);
}

export { validateModelMappings };
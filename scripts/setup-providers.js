#!/usr/bin/env node

/**
 * Setup AI Provider Registry
 * 
 * Downloads and prepares AI model registry data for only the providers
 * configured in the RPC AI backend (serviceProviders and byokProviders).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Default provider configuration
const DEFAULT_SERVICE_PROVIDERS = ['anthropic', 'openai', 'google'];
const DEFAULT_BYOK_PROVIDERS = ['anthropic', 'openai', 'google'];

/**
 * Get configured providers from server configuration
 */
function getConfiguredProviders() {
  try {
    // Try to read from environment or config file
    const serviceProviders = process.env.AI_SERVICE_PROVIDERS?.split(',') || DEFAULT_SERVICE_PROVIDERS;
    const byokProviders = process.env.AI_BYOK_PROVIDERS?.split(',') || DEFAULT_BYOK_PROVIDERS;
    
    // Combine and deduplicate
    const allProviders = [...new Set([...serviceProviders, ...byokProviders])];
    
    return {
      serviceProviders,
      byokProviders,
      allProviders
    };
  } catch (error) {
    console.warn('Could not read provider configuration, using defaults:', error.message);
    return {
      serviceProviders: DEFAULT_SERVICE_PROVIDERS,
      byokProviders: DEFAULT_BYOK_PROVIDERS,
      allProviders: [...new Set([...DEFAULT_SERVICE_PROVIDERS, ...DEFAULT_BYOK_PROVIDERS])]
    };
  }
}

/**
 * Download provider data
 */
function downloadProviderData(providers) {
  console.log('📡 Downloading AI provider data...');
  
  for (const provider of providers) {
    try {
      console.log(`  Downloading ${provider}...`);
      execSync(`npx ai-model-registry download --provider ${provider}`, { 
        stdio: 'inherit',
        timeout: 30000 // 30 second timeout per provider
      });
    } catch (error) {
      console.warn(`  ⚠️  Failed to download ${provider}:`, error.message);
      // Continue with other providers
    }
  }
}

/**
 * Aggregate and process data
 */
function aggregateData() {
  console.log('🔄 Aggregating provider data...');
  try {
    execSync('npx ai-model-registry aggregate', { 
      stdio: 'inherit',
      timeout: 60000 // 1 minute timeout
    });
  } catch (error) {
    console.warn('⚠️  Failed to aggregate data:', error.message);
    throw error;
  }
}

/**
 * Generate provider icons
 */
function generateIcons() {
  console.log('🎨 Generating provider icons...');
  try {
    execSync('npx ai-model-registry generate-icons', { 
      stdio: 'inherit',
      timeout: 30000 // 30 second timeout
    });
  } catch (error) {
    console.warn('⚠️  Failed to generate icons:', error.message);
    // Non-critical, continue
  }
}

/**
 * Check for pricing changes
 */
function checkPricingChanges() {
  console.log('💰 Checking for pricing changes...');
  
  const changesFile = path.join(process.cwd(), 'provider-changes.json');
  if (fs.existsSync(changesFile)) {
    try {
      const changes = JSON.parse(fs.readFileSync(changesFile, 'utf8'));
      if (changes.pricing && changes.pricing.length > 0) {
        console.warn('⚠️  PRICING CHANGES DETECTED:');
        changes.pricing.forEach(change => {
          console.warn(`   • ${change.provider}${change.model ? ':' + change.model : ''}: ${change.description}`);
        });
        console.warn('   Please review these changes and update pricing overrides if needed.');
      }
    } catch (error) {
      console.warn('Failed to read pricing changes:', error.message);
    }
  }
}

/**
 * Main setup function
 */
function main() {
  console.log('🚀 Setting up AI Provider Registry for RPC AI Backend\n');
  
  const { serviceProviders, byokProviders, allProviders } = getConfiguredProviders();
  
  console.log('📋 Configuration:');
  console.log(`   Service Providers: ${serviceProviders.join(', ')}`);
  console.log(`   BYOK Providers: ${byokProviders.join(', ')}`);
  console.log(`   Total Providers: ${allProviders.length}\n`);
  
  try {
    // Download data for configured providers
    downloadProviderData(allProviders);
    
    // Aggregate and process
    aggregateData();
    
    // Generate icons
    generateIcons();
    
    // Check for pricing changes
    checkPricingChanges();
    
    console.log('\n✅ Provider registry setup complete!');
    console.log('💡 Run "npm run build" to complete the build process.');
    
  } catch (error) {
    console.error('\n❌ Provider registry setup failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
AI Provider Registry Setup

Usage: node scripts/setup-providers.js [options]

Options:
  --help, -h          Show this help message
  --provider <name>   Download data for specific provider only
  --env <file>        Load environment variables from file

Environment Variables:
  AI_SERVICE_PROVIDERS    Comma-separated list of service providers
  AI_BYOK_PROVIDERS      Comma-separated list of BYOK providers

Examples:
  node scripts/setup-providers.js
  node scripts/setup-providers.js --provider anthropic
  AI_SERVICE_PROVIDERS=anthropic,openai node scripts/setup-providers.js
`);
  process.exit(0);
}

// Handle single provider download
const providerIndex = process.argv.indexOf('--provider');
if (providerIndex !== -1 && process.argv[providerIndex + 1]) {
  const singleProvider = process.argv[providerIndex + 1];
  console.log(`🎯 Downloading data for ${singleProvider} only...`);
  downloadProviderData([singleProvider]);
  console.log('✅ Single provider download complete!');
  process.exit(0);
}

// Run main setup
main();
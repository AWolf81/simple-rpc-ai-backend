/**
 * Example: Custom Subscription Tiers Configuration
 * 
 * This example demonstrates how to configure custom subscription tiers for different business models.
 * The system supports any tier names and configurations you need.
 */

import { 
  createMonetizedAIServer, 
  createOpenSaaSConfig, 
  type SubscriptionTierConfig 
} from '../../src/index.js';

// Example 1: SaaS Business Model with 5 tiers
const saasBusinessTiers: Record<string, SubscriptionTierConfig> = {
  free: {
    name: 'Free Trial',
    monthlyTokenQuota: 1000,
    rpmLimit: 5,
    tpmLimit: 100,
    concurrentRequests: 1,
    features: ['basic_ai']
  },
  
  starter: {
    name: 'Starter',
    monthlyTokenQuota: 25000,
    rpmLimit: 30,
    tpmLimit: 3000,
    concurrentRequests: 3,
    features: ['basic_ai', 'email_support']
  },
  
  professional: {
    name: 'Professional', 
    monthlyTokenQuota: 150000,
    rpmLimit: 150,
    tpmLimit: 15000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics']
  },
  
  business: {
    name: 'Business',
    monthlyTokenQuota: 500000,
    rpmLimit: 500,
    tpmLimit: 50000,
    concurrentRequests: 25,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'team_management', 'api_access']
  },
  
  enterprise: {
    name: 'Enterprise',
    monthlyTokenQuota: 2000000,
    rpmLimit: 2000,
    tpmLimit: 200000,
    concurrentRequests: 100,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'team_management', 'api_access', 'custom_models', 'sla', 'dedicated_support']
  }
};

// Example 2: Education/Non-Profit Model
const educationTiers: Record<string, SubscriptionTierConfig> = {
  student: {
    name: 'Student (Free)',
    monthlyTokenQuota: 5000,
    rpmLimit: 10,
    tpmLimit: 500,
    concurrentRequests: 2,
    features: ['basic_ai', 'educational_content']
  },
  
  educator: {
    name: 'Educator',
    monthlyTokenQuota: 50000,
    rpmLimit: 100,
    tpmLimit: 5000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'educational_content', 'classroom_management']
  },
  
  institution: {
    name: 'Educational Institution',
    monthlyTokenQuota: 1000000,
    rpmLimit: 1000,
    tpmLimit: 100000,
    concurrentRequests: 50,
    features: ['basic_ai', 'advanced_ai', 'educational_content', 'classroom_management', 'analytics', 'bulk_management']
  }
};

// Example 3: API-as-a-Service Model with usage-based tiers
const apiServiceTiers: Record<string, SubscriptionTierConfig> = {
  developer: {
    name: 'Developer',
    monthlyTokenQuota: 10000,
    rpmLimit: 60, // 1 request per second
    tpmLimit: 1000,
    concurrentRequests: 5,
    features: ['basic_ai', 'api_access', 'documentation']
  },
  
  startup: {
    name: 'Startup',
    monthlyTokenQuota: 100000,
    rpmLimit: 300, // 5 requests per second
    tpmLimit: 10000,
    concurrentRequests: 15,
    features: ['basic_ai', 'advanced_ai', 'api_access', 'documentation', 'webhook_support']
  },
  
  scale: {
    name: 'Scale',
    monthlyTokenQuota: 1000000,
    rpmLimit: 1800, // 30 requests per second
    tpmLimit: 100000,
    concurrentRequests: 50,
    features: ['basic_ai', 'advanced_ai', 'api_access', 'documentation', 'webhook_support', 'priority_support', 'analytics']
  },
  
  enterprise_api: {
    name: 'Enterprise API',
    monthlyTokenQuota: 10000000,
    rpmLimit: 6000, // 100 requests per second
    tpmLimit: 1000000,
    concurrentRequests: 200,
    features: ['basic_ai', 'advanced_ai', 'api_access', 'documentation', 'webhook_support', 'priority_support', 'analytics', 'custom_models', 'dedicated_support', 'sla']
  }
};

// Example server configuration with custom tiers
async function createCustomTierServer(tierConfig: Record<string, SubscriptionTierConfig>, businessModel: string) {
  const opensaasConfig = createOpenSaaSConfig({
    opensaasPublicKey: process.env.OPENSAAS_PUBLIC_KEY!,
    audience: 'ai-backend.yourcompany.com',
    issuer: 'https://auth.yourcompany.com',
    customTiers: tierConfig,
    platformFeePercentage: 15,
    redisUrl: process.env.REDIS_URL,
    billingProvider: 'opensaas'
  });

  const serverConfig = {
    port: 8000,
    database: { path: `./data/${businessModel}-ai.db` },
    serviceProviders: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
    },
    opensaasMonetization: opensaasConfig
  };

  const server = await createMonetizedAIServer(serverConfig);
  
  console.log(`🚀 ${businessModel} AI Backend Server started`);
  console.log(`📊 Subscription tiers: ${Object.keys(tierConfig).join(', ')}`);
  
  return server;
}

// Example usage for different business models
export async function startSaaSServer() {
  return createCustomTierServer(saasBusinessTiers, 'SaaS');
}

export async function startEducationServer() {
  return createCustomTierServer(educationTiers, 'Education');
}

export async function startAPIServiceServer() {
  return createCustomTierServer(apiServiceTiers, 'API-Service');
}

// Example: Dynamic tier validation in middleware
export function createTierValidationMiddleware(tiers: Record<string, SubscriptionTierConfig>) {
  return (req: any, res: any, next: any) => {
    const userTier = req.authContext?.subscriptionTier;
    const method = req.body?.method;
    
    // Custom business logic based on tier
    if (method === 'executeAIRequest') {
      const tierConfig = tiers[userTier];
      
      if (!tierConfig) {
        return res.status(403).json({
          error: {
            code: -32003,
            message: 'Invalid subscription tier',
            data: { availableTiers: Object.keys(tiers) }
          }
        });
      }
      
      // Check feature access
      const requestFeatures = req.body.params?.features || ['basic_ai'];
      const hasAccess = requestFeatures.every((feature: string) => 
        tierConfig.features.includes(feature)
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          error: {
            code: -32003,
            message: 'Feature not available in your subscription tier',
            data: {
              currentTier: userTier,
              currentFeatures: tierConfig.features,
              requiredFeatures: requestFeatures,
              upgradeUrl: '/billing/upgrade'
            }
          }
        });
      }
    }
    
    next();
  };
}

// Example: Tier-specific system prompts
export const tierSpecificPrompts = {
  // Basic AI prompts (available to all tiers)
  'basic-chat': {
    content: 'You are a helpful AI assistant. Provide clear and concise responses.',
    features: ['basic_ai']
  },
  
  // Advanced AI prompts (pro+ tiers only)
  'code-review': {
    content: 'You are an expert code reviewer. Analyze code for best practices, security, and performance.',
    features: ['advanced_ai']
  },
  
  // Educational prompts (education tiers)
  'tutor': {
    content: 'You are a patient educational tutor. Explain concepts clearly with examples.',
    features: ['educational_content']
  },
  
  // API-specific prompts
  'api-documentation': {
    content: 'You are an API documentation expert. Create clear, comprehensive API docs.',
    features: ['api_access', 'documentation']
  },
  
  // Enterprise-only prompts
  'custom-model': {
    content: 'You are a specialized AI model trained for enterprise use cases.',
    features: ['custom_models']
  }
};

// Export tier configurations for reuse
export {
  saasBusinessTiers,
  educationTiers,
  apiServiceTiers
};
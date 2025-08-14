/**
 * Flexible Plan Configuration Examples
 * 
 * Shows how to configure different user plans with custom quotas,
 * providers, and reset intervals
 */

import { FlexiblePlanConfig, PlanConfig } from '../src/auth/FlexiblePlanManager.js';

// Example 1: Standard SaaS Configuration
export const standardSaaSConfig: FlexiblePlanConfig = {
  defaultPlan: 'free',
  
  plans: {
    // Free Plan - BYOK default, opt-in server keys with trial limits
    free: {
      planId: 'free',
      displayName: 'Free Plan',
      description: 'Bring your own API keys or try our service with limited tokens',
      
      keySource: 'server_optional', // ✅ Can use BYOK OR server keys
      allowedProviders: ['anthropic', 'openai'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 10000, // 10K tokens per month (trial)
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 5000, // 5K tokens per month (trial)
          resetInterval: 'monthly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 5,
        requestsPerHour: 20,
        requestsPerDay: 100
      },
      
      features: {
        systemPrompts: ['code_review', 'code_quality'],
        maxPromptLength: 4000,
        maxResponseLength: 2000,
        priorityQueue: false,
        analyticsAccess: false,
        customSystemPrompts: false
      },
      
      costLimits: {
        maxCostPerRequest: 0.50,
        maxDailyCost: 2.00,
        maxMonthlyCost: 10.00
      }
    },
    
    // Pro Plan - Server-provided keys with higher limits
    pro: {
      planId: 'pro',
      displayName: 'Pro Plan',
      description: 'Server-provided API keys with generous quotas',
      
      keySource: 'server_provided', // ✅ Server keys only
      allowedProviders: ['anthropic', 'openai', 'google'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 100000, // 100K tokens per month
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 75000, // 75K tokens per month
          resetInterval: 'monthly'
        },
        google: {
          maxTokensPerPeriod: 50000, // 50K tokens per month
          resetInterval: 'monthly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        requestsPerDay: 2000
      },
      
      features: {
        systemPrompts: ['code_review', 'code_quality', 'security_audit', 'architecture_review'],
        maxPromptLength: 16000,
        maxResponseLength: 8000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: false
      },
      
      costLimits: {
        maxCostPerRequest: 5.00,
        maxDailyCost: 50.00,
        maxMonthlyCost: 500.00
      }
    },
    
    // Enterprise Plan - Unlimited with custom features
    enterprise: {
      planId: 'enterprise',
      displayName: 'Enterprise Plan',
      description: 'Unlimited usage with custom system prompts and priority support',
      
      keySource: 'server_provided', // ✅ Server keys only
      allowedProviders: ['anthropic', 'openai', 'google', 'azure', 'aws'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 1000000, // 1M tokens per month
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 1000000, // 1M tokens per month
          resetInterval: 'monthly'
        },
        google: {
          maxTokensPerPeriod: 500000, // 500K tokens per month
          resetInterval: 'monthly'
        },
        azure: {
          maxTokensPerPeriod: 500000, // 500K tokens per month
          resetInterval: 'monthly'
        },
        aws: {
          maxTokensPerPeriod: 250000, // 250K tokens per month
          resetInterval: 'monthly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 10000
      },
      
      features: {
        systemPrompts: ['*'], // All system prompts
        maxPromptLength: 32000,
        maxResponseLength: 16000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: true
      },
      
      costLimits: {
        maxCostPerRequest: 20.00,
        maxDailyCost: 500.00,
        maxMonthlyCost: 5000.00
      }
    }
  },
  
  serverApiKeys: {
    anthropic: {
      apiKey: process.env.SERVER_ANTHROPIC_KEY!,
      maxCostPerDay: 200.00,
      enabled: true
    },
    openai: {
      apiKey: process.env.SERVER_OPENAI_KEY!,
      maxCostPerDay: 150.00,
      enabled: true
    },
    google: {
      apiKey: process.env.SERVER_GOOGLE_KEY!,
      maxCostPerDay: 100.00,
      enabled: true
    },
    azure: {
      apiKey: process.env.SERVER_AZURE_KEY!,
      maxCostPerDay: 100.00,
      enabled: true
    },
    aws: {
      apiKey: process.env.SERVER_AWS_KEY!,
      maxCostPerDay: 75.00,
      enabled: false // Disabled for now
    }
  },
  
  settings: {
    enableUsageTracking: true,
    enableCostTracking: true,
    defaultResetTime: '00:00',
    gracePeriodHours: 24
  }
};

// Example 2: Custom Three-Tier Configuration
export const customThreeTierConfig: FlexiblePlanConfig = {
  defaultPlan: 'starter',
  
  plans: {
    // Starter Plan - Very limited trial
    starter: {
      planId: 'starter',
      displayName: 'Starter Plan',
      description: '7-day trial with server keys',
      
      keySource: 'server_provided',
      allowedProviders: ['anthropic'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 2500, // 2.5K tokens per week
          resetInterval: 'weekly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 2,
        requestsPerHour: 10,
        requestsPerDay: 50
      },
      
      features: {
        systemPrompts: ['code_review'],
        maxPromptLength: 2000,
        maxResponseLength: 1000,
        priorityQueue: false,
        analyticsAccess: false,
        customSystemPrompts: false
      },
      
      costLimits: {
        maxCostPerRequest: 0.25,
        maxDailyCost: 1.00,
        maxMonthlyCost: 5.00
      }
    },
    
    // Growth Plan - BYOK encouraged, server keys available
    growth: {
      planId: 'growth',
      displayName: 'Growth Plan',
      description: 'Flexible key management for growing teams',
      
      keySource: 'server_optional', // ✅ BYOK or server keys
      allowedProviders: ['anthropic', 'openai', 'google'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 50000, // 50K tokens per month (when using server keys)
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 40000, // 40K tokens per month
          resetInterval: 'monthly'
        },
        google: {
          maxTokensPerPeriod: 30000, // 30K tokens per month
          resetInterval: 'monthly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 20,
        requestsPerHour: 300,
        requestsPerDay: 1500
      },
      
      features: {
        systemPrompts: ['code_review', 'code_quality', 'security_audit'],
        maxPromptLength: 8000,
        maxResponseLength: 4000,
        priorityQueue: false,
        analyticsAccess: true,
        customSystemPrompts: false
      },
      
      costLimits: {
        maxCostPerRequest: 2.00,
        maxDailyCost: 25.00,
        maxMonthlyCost: 200.00
      }
    },
    
    // Scale Plan - Enterprise features
    scale: {
      planId: 'scale',
      displayName: 'Scale Plan',
      description: 'Enterprise-grade features and unlimited usage',
      
      keySource: 'server_provided',
      allowedProviders: ['anthropic', 'openai', 'google', 'azure'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 500000, // 500K tokens per month
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 400000, // 400K tokens per month
          resetInterval: 'monthly'
        },
        google: {
          maxTokensPerPeriod: 300000, // 300K tokens per month
          resetInterval: 'monthly'
        },
        azure: {
          maxTokensPerPeriod: 200000, // 200K tokens per month
          resetInterval: 'monthly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1500,
        requestsPerDay: 8000
      },
      
      features: {
        systemPrompts: ['*'], // All prompts
        maxPromptLength: 24000,
        maxResponseLength: 12000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: true
      },
      
      costLimits: {
        maxCostPerRequest: 10.00,
        maxDailyCost: 300.00,
        maxMonthlyCost: 3000.00
      }
    }
  },
  
  serverApiKeys: {
    anthropic: {
      apiKey: process.env.SERVER_ANTHROPIC_KEY!,
      maxCostPerDay: 500.00,
      enabled: true
    },
    openai: {
      apiKey: process.env.SERVER_OPENAI_KEY!,
      maxCostPerDay: 400.00,
      enabled: true
    },
    google: {
      apiKey: process.env.SERVER_GOOGLE_KEY!,
      maxCostPerDay: 300.00,
      enabled: true
    },
    azure: {
      apiKey: process.env.SERVER_AZURE_KEY!,
      maxCostPerDay: 200.00,
      enabled: true
    }
  },
  
  settings: {
    enableUsageTracking: true,
    enableCostTracking: true,
    defaultResetTime: '00:00',
    gracePeriodHours: 12
  }
};

// Example 3: Daily Reset Configuration (for high-usage scenarios)
export const dailyResetConfig: FlexiblePlanConfig = {
  defaultPlan: 'daily_free',
  
  plans: {
    daily_free: {
      planId: 'daily_free',
      displayName: 'Daily Free',
      description: 'Free daily allowance with server keys',
      
      keySource: 'server_optional',
      allowedProviders: ['anthropic'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 1000, // 1K tokens per day
          resetInterval: 'daily'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerHour: 50,
        requestsPerDay: 200
      },
      
      features: {
        systemPrompts: ['code_review', 'code_quality'],
        maxPromptLength: 4000,
        maxResponseLength: 2000,
        priorityQueue: false,
        analyticsAccess: false,
        customSystemPrompts: false
      }
    },
    
    daily_pro: {
      planId: 'daily_pro',
      displayName: 'Daily Pro',
      description: 'Higher daily limits with priority access',
      
      keySource: 'server_provided',
      allowedProviders: ['anthropic', 'openai', 'google'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 10000, // 10K tokens per day
          resetInterval: 'daily'
        },
        openai: {
          maxTokensPerPeriod: 8000, // 8K tokens per day
          resetInterval: 'daily'
        },
        google: {
          maxTokensPerPeriod: 6000, // 6K tokens per day
          resetInterval: 'daily'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 50,
        requestsPerHour: 500,
        requestsPerDay: 2000
      },
      
      features: {
        systemPrompts: ['*'],
        maxPromptLength: 12000,
        maxResponseLength: 6000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: true
      }
    }
  },
  
  serverApiKeys: {
    anthropic: {
      apiKey: process.env.SERVER_ANTHROPIC_KEY!,
      maxCostPerDay: 100.00,
      enabled: true
    },
    openai: {
      apiKey: process.env.SERVER_OPENAI_KEY!,
      maxCostPerDay: 80.00,
      enabled: true
    },
    google: {
      apiKey: process.env.SERVER_GOOGLE_KEY!,
      maxCostPerDay: 60.00,
      enabled: true
    }
  },
  
  settings: {
    enableUsageTracking: true,
    enableCostTracking: true,
    defaultResetTime: '00:00',
    gracePeriodHours: 2
  }
};

// Example 4: Enterprise Multi-Reset Configuration
export const enterpriseMultiResetConfig: FlexiblePlanConfig = {
  defaultPlan: 'team',
  
  plans: {
    team: {
      planId: 'team',
      displayName: 'Team Plan',
      description: 'Weekly resets for team collaboration',
      
      keySource: 'server_provided',
      allowedProviders: ['anthropic', 'openai'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 25000, // 25K tokens per week
          resetInterval: 'weekly'
        },
        openai: {
          maxTokensPerPeriod: 20000, // 20K tokens per week
          resetInterval: 'weekly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 25,
        requestsPerHour: 300,
        requestsPerDay: 1000
      },
      
      features: {
        systemPrompts: ['code_review', 'code_quality', 'security_audit', 'architecture_review'],
        maxPromptLength: 10000,
        maxResponseLength: 5000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: false
      }
    },
    
    organization: {
      planId: 'organization',
      displayName: 'Organization Plan',
      description: 'Monthly resets with annual overrides',
      
      keySource: 'server_provided',
      allowedProviders: ['anthropic', 'openai', 'google', 'azure'],
      
      tokenQuotas: {
        anthropic: {
          maxTokensPerPeriod: 200000, // 200K tokens per month
          resetInterval: 'monthly'
        },
        openai: {
          maxTokensPerPeriod: 150000, // 150K tokens per month
          resetInterval: 'monthly'
        },
        google: {
          maxTokensPerPeriod: 100000, // 100K tokens per month
          resetInterval: 'monthly'
        },
        azure: {
          maxTokensPerPeriod: 1000000, // 1M tokens per year
          resetInterval: 'yearly'
        }
      },
      
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 5000
      },
      
      features: {
        systemPrompts: ['*'],
        maxPromptLength: 32000,
        maxResponseLength: 16000,
        priorityQueue: true,
        analyticsAccess: true,
        customSystemPrompts: true
      }
    }
  },
  
  serverApiKeys: {
    anthropic: {
      apiKey: process.env.SERVER_ANTHROPIC_KEY!,
      maxCostPerDay: 300.00,
      enabled: true
    },
    openai: {
      apiKey: process.env.SERVER_OPENAI_KEY!,
      maxCostPerDay: 250.00,
      enabled: true
    },
    google: {
      apiKey: process.env.SERVER_GOOGLE_KEY!,
      maxCostPerDay: 200.00,
      enabled: true
    },
    azure: {
      apiKey: process.env.SERVER_AZURE_KEY!,
      maxCostPerDay: 400.00,
      enabled: true
    }
  },
  
  settings: {
    enableUsageTracking: true,
    enableCostTracking: true,
    defaultResetTime: '00:00',
    gracePeriodHours: 48
  }
};

export default {
  standardSaaSConfig,
  customThreeTierConfig,
  dailyResetConfig,
  enterpriseMultiResetConfig
};
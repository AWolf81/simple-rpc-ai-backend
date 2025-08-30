/**
 * RPC Method Constants
 * 
 * Centralized constants for all RPC method names to avoid hardcoding
 * throughout the codebase. These names correspond to the methods defined
 * in openrpc.json schema.
 */

// Core RPC method names from openRPC.json schema
export const RPC_METHODS = {
  // Core AI Methods
  HEALTH: 'health',
  EXECUTE_AI_REQUEST: 'executeAIRequest',
  
  // Authentication Methods
  INITIALIZE_SESSION: 'initializeSession',
  
  // Built-in AI Functions
  LIST_CUSTOM_FUNCTIONS: 'listCustomFunctions',
  ANALYZE_CODE: 'analyzeCode',
  GENERATE_TESTS: 'generateTests',
  SECURITY_REVIEW: 'securityReview',
  
  // Provider Management
  LIST_PROVIDERS: 'listProviders',
  
  // BYOK Key Management Methods
  STORE_USER_KEY: 'storeUserKey',
  GET_USER_KEY: 'getUserKey',
  GET_USER_PROVIDERS: 'getUserProviders',
  VALIDATE_USER_KEY: 'validateUserKey',
  ROTATE_USER_KEY: 'rotateUserKey',
  DELETE_USER_KEY: 'deleteUserKey',
  
  // OpenRPC Discovery
  RPC_DISCOVER: 'rpc.discover'
} as const;

// tRPC method names (prefixed with router namespace)
export const TRPC_METHODS = {
  // AI Router methods
  AI_HEALTH: 'ai.health',
  AI_EXECUTE_AI_REQUEST: 'ai.executeAIRequest',
  AI_LIST_PROVIDERS: 'ai.listProviders',
  AI_LIST_PROVIDERS_BYOK: 'ai.listProvidersBYOK',
  AI_GET_REGISTRY_HEALTH: 'ai.getRegistryHealth',
  AI_VALIDATE_PROVIDER: 'ai.validateProvider',
  
  // AI User Management (tRPC only)
  AI_GET_USER_PROFILE: 'ai.getUserProfile',
  AI_UPDATE_USER_PREFERENCES: 'ai.updateUserPreferences',
  AI_CONFIGURE_BYOK: 'ai.configureBYOK',
  AI_GET_BYOK_STATUS: 'ai.getBYOKStatus',
  AI_GET_USER_TOKEN_BALANCES: 'ai.getUserTokenBalances',
  AI_PLAN_CONSUMPTION: 'ai.planConsumption',
  AI_GET_CONSUMPTION_HISTORY: 'ai.getConsumptionHistory',
  AI_GET_TOKEN_BALANCE: 'ai.getTokenBalance',
  AI_GET_USAGE_HISTORY: 'ai.getUsageHistory',
  AI_GET_TOPUP_HISTORY: 'ai.getTopupHistory',
  AI_GET_USER_STATUS: 'ai.getUserStatus',
  AI_GET_USAGE_ANALYTICS: 'ai.getUsageAnalytics',
  AI_GET_PURCHASE_HISTORY: 'ai.getPurchaseHistory',
  AI_CHECK_REQUEST_ELIGIBILITY: 'ai.checkRequestEligibility',
  
  // AI BYOK Key Management (tRPC)
  AI_STORE_USER_KEY: 'ai.storeUserKey',
  AI_GET_USER_KEY: 'ai.getUserKey',
  AI_GET_USER_PROVIDERS: 'ai.getUserProviders',
  AI_VALIDATE_USER_KEY: 'ai.validateUserKey',
  AI_ROTATE_USER_KEY: 'ai.rotateUserKey',
  AI_DELETE_USER_KEY: 'ai.deleteUserKey'
} as const;

// System prompt types from openRPC schema
export const SYSTEM_PROMPT_TYPES = {
  SECURITY_REVIEW: 'security_review',
  CODE_QUALITY: 'code_quality', 
  ARCHITECTURE_REVIEW: 'architecture_review'
} as const;

// AI provider names from openRPC schema
export const AI_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google'
} as const;

// Authentication levels from openRPC schema
export const AUTH_LEVELS = {
  ANONYMOUS: 'anonymous',
  OAUTH: 'oauth',
  PRO: 'pro'
} as const;

// Export type-safe arrays for iteration
export const RPC_METHOD_LIST = Object.values(RPC_METHODS);
export const TRPC_METHOD_LIST = Object.values(TRPC_METHODS);
export const SYSTEM_PROMPT_TYPE_LIST = Object.values(SYSTEM_PROMPT_TYPES);
export const AI_PROVIDER_LIST = Object.values(AI_PROVIDERS);
export const AUTH_LEVEL_LIST = Object.values(AUTH_LEVELS);

// Helper functions
export const isValidRPCMethod = (method: string): method is typeof RPC_METHODS[keyof typeof RPC_METHODS] => {
  return RPC_METHOD_LIST.includes(method as any);
};

export const isValidTRPCMethod = (method: string): method is typeof TRPC_METHODS[keyof typeof TRPC_METHODS] => {
  return TRPC_METHOD_LIST.includes(method as any);
};

export const isValidSystemPrompt = (prompt: string): prompt is typeof SYSTEM_PROMPT_TYPES[keyof typeof SYSTEM_PROMPT_TYPES] => {
  return SYSTEM_PROMPT_TYPE_LIST.includes(prompt as any);
};

export const isValidAIProvider = (provider: string): provider is typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS] => {
  return AI_PROVIDER_LIST.includes(provider as any);
};
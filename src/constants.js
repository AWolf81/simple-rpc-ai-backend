"use strict";
/**
 * RPC Method Constants
 *
 * Centralized constants for all RPC method names to avoid hardcoding
 * throughout the codebase. These names correspond to the methods defined
 * in openrpc.json schema.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAIProvider = exports.isValidSystemPrompt = exports.isValidTRPCMethod = exports.isValidRPCMethod = exports.AUTH_LEVEL_LIST = exports.AI_PROVIDER_LIST = exports.SYSTEM_PROMPT_TYPE_LIST = exports.TRPC_METHOD_LIST = exports.RPC_METHOD_LIST = exports.AUTH_LEVELS = exports.AI_PROVIDERS = exports.SYSTEM_PROMPT_TYPES = exports.TRPC_METHODS = exports.RPC_METHODS = void 0;
// Core RPC method names from openRPC.json schema
exports.RPC_METHODS = {
    // Core AI Methods
    HEALTH: 'health',
    GENERATE_TEXT: 'ai.generateText',
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
};
// tRPC method names (prefixed with router namespace)
exports.TRPC_METHODS = {
    // AI Router methods
    AI_HEALTH: 'ai.health',
    AI_GENERATE_TEXT: 'ai.generateText',
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
};
// System prompt types from openRPC schema
exports.SYSTEM_PROMPT_TYPES = {
    SECURITY_REVIEW: 'security_review',
    CODE_QUALITY: 'code_quality',
    ARCHITECTURE_REVIEW: 'architecture_review'
};
// AI provider names from openRPC schema
exports.AI_PROVIDERS = {
    ANTHROPIC: 'anthropic',
    OPENAI: 'openai',
    GOOGLE: 'google'
};
// Authentication levels from openRPC schema
exports.AUTH_LEVELS = {
    ANONYMOUS: 'anonymous',
    OAUTH: 'oauth',
    PRO: 'pro'
};
// Export type-safe arrays for iteration
exports.RPC_METHOD_LIST = Object.values(exports.RPC_METHODS);
exports.TRPC_METHOD_LIST = Object.values(exports.TRPC_METHODS);
exports.SYSTEM_PROMPT_TYPE_LIST = Object.values(exports.SYSTEM_PROMPT_TYPES);
exports.AI_PROVIDER_LIST = Object.values(exports.AI_PROVIDERS);
exports.AUTH_LEVEL_LIST = Object.values(exports.AUTH_LEVELS);
// Helper functions
const isValidRPCMethod = (method) => {
    return exports.RPC_METHOD_LIST.includes(method);
};
exports.isValidRPCMethod = isValidRPCMethod;
const isValidTRPCMethod = (method) => {
    return exports.TRPC_METHOD_LIST.includes(method);
};
exports.isValidTRPCMethod = isValidTRPCMethod;
const isValidSystemPrompt = (prompt) => {
    return exports.SYSTEM_PROMPT_TYPE_LIST.includes(prompt);
};
exports.isValidSystemPrompt = isValidSystemPrompt;
const isValidAIProvider = (provider) => {
    return exports.AI_PROVIDER_LIST.includes(provider);
};
exports.isValidAIProvider = isValidAIProvider;
//# sourceMappingURL=constants.js.map
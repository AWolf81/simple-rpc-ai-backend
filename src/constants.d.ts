/**
 * RPC Method Constants
 *
 * Centralized constants for all RPC method names to avoid hardcoding
 * throughout the codebase. These names correspond to the methods defined
 * in openrpc.json schema.
 */
export declare const RPC_METHODS: {
    readonly HEALTH: "health";
    readonly GENERATE_TEXT: "ai.generateText";
    readonly INITIALIZE_SESSION: "initializeSession";
    readonly LIST_CUSTOM_FUNCTIONS: "listCustomFunctions";
    readonly ANALYZE_CODE: "analyzeCode";
    readonly GENERATE_TESTS: "generateTests";
    readonly SECURITY_REVIEW: "securityReview";
    readonly LIST_PROVIDERS: "listProviders";
    readonly STORE_USER_KEY: "storeUserKey";
    readonly GET_USER_KEY: "getUserKey";
    readonly GET_USER_PROVIDERS: "getUserProviders";
    readonly VALIDATE_USER_KEY: "validateUserKey";
    readonly ROTATE_USER_KEY: "rotateUserKey";
    readonly DELETE_USER_KEY: "deleteUserKey";
    readonly RPC_DISCOVER: "rpc.discover";
};
export declare const TRPC_METHODS: {
    readonly AI_HEALTH: "ai.health";
    readonly AI_GENERATE_TEXT: "ai.generateText";
    readonly AI_LIST_PROVIDERS: "ai.listProviders";
    readonly AI_LIST_PROVIDERS_BYOK: "ai.listProvidersBYOK";
    readonly AI_GET_REGISTRY_HEALTH: "ai.getRegistryHealth";
    readonly AI_VALIDATE_PROVIDER: "ai.validateProvider";
    readonly AI_GET_USER_PROFILE: "ai.getUserProfile";
    readonly AI_UPDATE_USER_PREFERENCES: "ai.updateUserPreferences";
    readonly AI_CONFIGURE_BYOK: "ai.configureBYOK";
    readonly AI_GET_BYOK_STATUS: "ai.getBYOKStatus";
    readonly AI_GET_USER_TOKEN_BALANCES: "ai.getUserTokenBalances";
    readonly AI_PLAN_CONSUMPTION: "ai.planConsumption";
    readonly AI_GET_CONSUMPTION_HISTORY: "ai.getConsumptionHistory";
    readonly AI_GET_TOKEN_BALANCE: "ai.getTokenBalance";
    readonly AI_GET_USAGE_HISTORY: "ai.getUsageHistory";
    readonly AI_GET_TOPUP_HISTORY: "ai.getTopupHistory";
    readonly AI_GET_USER_STATUS: "ai.getUserStatus";
    readonly AI_GET_USAGE_ANALYTICS: "ai.getUsageAnalytics";
    readonly AI_GET_PURCHASE_HISTORY: "ai.getPurchaseHistory";
    readonly AI_CHECK_REQUEST_ELIGIBILITY: "ai.checkRequestEligibility";
    readonly AI_STORE_USER_KEY: "ai.storeUserKey";
    readonly AI_GET_USER_KEY: "ai.getUserKey";
    readonly AI_GET_USER_PROVIDERS: "ai.getUserProviders";
    readonly AI_VALIDATE_USER_KEY: "ai.validateUserKey";
    readonly AI_ROTATE_USER_KEY: "ai.rotateUserKey";
    readonly AI_DELETE_USER_KEY: "ai.deleteUserKey";
};
export declare const SYSTEM_PROMPT_TYPES: {
    readonly SECURITY_REVIEW: "security_review";
    readonly CODE_QUALITY: "code_quality";
    readonly ARCHITECTURE_REVIEW: "architecture_review";
};
export declare const AI_PROVIDERS: {
    readonly ANTHROPIC: "anthropic";
    readonly OPENAI: "openai";
    readonly GOOGLE: "google";
};
export declare const AUTH_LEVELS: {
    readonly ANONYMOUS: "anonymous";
    readonly OAUTH: "oauth";
    readonly PRO: "pro";
};
export declare const RPC_METHOD_LIST: ("health" | "rpc.discover" | "ai.generateText" | "initializeSession" | "listCustomFunctions" | "analyzeCode" | "generateTests" | "securityReview" | "listProviders" | "storeUserKey" | "getUserKey" | "getUserProviders" | "validateUserKey" | "rotateUserKey" | "deleteUserKey")[];
export declare const TRPC_METHOD_LIST: ("ai.generateText" | "ai.health" | "ai.listProviders" | "ai.listProvidersBYOK" | "ai.getRegistryHealth" | "ai.validateProvider" | "ai.getUserProfile" | "ai.updateUserPreferences" | "ai.configureBYOK" | "ai.getBYOKStatus" | "ai.getUserTokenBalances" | "ai.planConsumption" | "ai.getConsumptionHistory" | "ai.getTokenBalance" | "ai.getUsageHistory" | "ai.getTopupHistory" | "ai.getUserStatus" | "ai.getUsageAnalytics" | "ai.getPurchaseHistory" | "ai.checkRequestEligibility" | "ai.storeUserKey" | "ai.getUserKey" | "ai.getUserProviders" | "ai.validateUserKey" | "ai.rotateUserKey" | "ai.deleteUserKey")[];
export declare const SYSTEM_PROMPT_TYPE_LIST: ("security_review" | "code_quality" | "architecture_review")[];
export declare const AI_PROVIDER_LIST: ("anthropic" | "openai" | "google")[];
export declare const AUTH_LEVEL_LIST: ("pro" | "oauth" | "anonymous")[];
export declare const isValidRPCMethod: (method: string) => method is (typeof RPC_METHODS)[keyof typeof RPC_METHODS];
export declare const isValidTRPCMethod: (method: string) => method is (typeof TRPC_METHODS)[keyof typeof TRPC_METHODS];
export declare const isValidSystemPrompt: (prompt: string) => prompt is (typeof SYSTEM_PROMPT_TYPES)[keyof typeof SYSTEM_PROMPT_TYPES];
export declare const isValidAIProvider: (provider: string) => provider is (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];
//# sourceMappingURL=constants.d.ts.map
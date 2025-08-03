import type { Express } from 'express';
import type { Server } from 'http';
import { RateLimiter } from '../middleware/rate-limiter.js';
import { UsageTracker } from '../billing/usage-tracker.js';
import { BillingEngine } from '../billing/billing-engine.js';
import { FunctionRegistry } from '../services/function-registry.js';
import { PromptManager } from '../services/prompt-manager.js';
import type { MonetizedAIServerConfig } from './opensaas-config.js';
export interface MonetizedServerInstance {
    app: Express;
    functionRegistry: FunctionRegistry;
    promptManager: PromptManager;
    usageTracker: UsageTracker;
    billingEngine: BillingEngine;
    rateLimiter: RateLimiter;
    start: (port?: number) => Server;
    stop: () => Promise<void>;
}
/**
 * Create a monetized AI server with OpenSaaS integration
 */
export declare function createMonetizedAIServer(config: MonetizedAIServerConfig): Promise<MonetizedServerInstance>;
//# sourceMappingURL=opensaas-server.d.ts.map
/**
 * Free Tier Service Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FreeTierService } from '../src/services/free-tier-service.js';
describe('FreeTierService', () => {
    let freeTierService;
    beforeEach(() => {
        freeTierService = new FreeTierService({
            enabled: true,
            serverApiKeys: {
                openai: 'test-openai-key',
                google: 'test-google-key'
            }
        });
    });
    describe('isEnabled', () => {
        it('should return true when free tier is enabled', () => {
            expect(freeTierService.isEnabled()).toBe(true);
        });
        it('should return false when free tier is disabled by default', () => {
            const disabledService = new FreeTierService();
            expect(disabledService.isEnabled()).toBe(false);
        });
        it('should return false when explicitly disabled', () => {
            const disabledService = new FreeTierService({ enabled: false });
            expect(disabledService.isEnabled()).toBe(false);
        });
    });
    describe('getAvailableModels', () => {
        it('should return available free models when enabled and API keys are configured', () => {
            const models = freeTierService.getAvailableModels();
            expect(models).toHaveLength(1); // Only default minimal model
            expect(models[0].id).toBe('gpt-4o-mini');
            expect(models[0].enabled).toBe(true);
            expect(models[0].limits.tokensPerDay).toBe(8000); // Minimal limits
        });
        it('should return empty array when free tier is disabled', () => {
            const serviceDisabled = new FreeTierService({ enabled: false });
            const models = serviceDisabled.getAvailableModels();
            expect(models).toHaveLength(0);
        });
        it('should only return models with configured API keys', () => {
            const serviceWithoutKeys = new FreeTierService({ enabled: true });
            const models = serviceWithoutKeys.getAvailableModels();
            expect(models).toHaveLength(0);
        });
        it('should only return OpenAI models when only OpenAI key is configured', () => {
            const serviceWithOpenAI = new FreeTierService({
                enabled: true,
                serverApiKeys: { openai: 'test-key' }
            });
            const models = serviceWithOpenAI.getAvailableModels();
            expect(models).toHaveLength(1);
            expect(models[0].provider).toBe('openai');
        });
    });
    describe('canMakeRequest', () => {
        it('should reject request when free tier is disabled', async () => {
            const disabledService = new FreeTierService({ enabled: false });
            const result = await disabledService.canMakeRequest('user1', 'gpt-4o-mini', 1000);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Free tier is disabled');
        });
        it('should allow request within limits', async () => {
            const result = await freeTierService.canMakeRequest('user1', 'gpt-4o-mini', 1000);
            expect(result.allowed).toBe(true);
            expect(result.limits).toBeDefined();
        });
        it('should reject request for non-existent model', async () => {
            const result = await freeTierService.canMakeRequest('user1', 'invalid-model', 1000);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not found');
        });
        it('should reject request exceeding token limit per request', async () => {
            const result = await freeTierService.canMakeRequest('user1', 'gpt-4o-mini', 5000);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Request too large');
        });
        it('should reject request when daily limit would be exceeded', async () => {
            // First, consume most of the daily limit (8000 tokens/day for minimal)
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 7500);
            // Try to make a request that would exceed daily limit
            const result = await freeTierService.canMakeRequest('user1', 'gpt-4o-mini', 1000);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily limit exceeded');
        });
        it('should reject request when hourly rate limit is exceeded', async () => {
            // Simulate 20 requests in current hour (minimal limit)
            for (let i = 0; i < 20; i++) {
                await freeTierService.recordUsage('user1', 'gpt-4o-mini', 100);
            }
            const result = await freeTierService.canMakeRequest('user1', 'gpt-4o-mini', 100);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Rate limit exceeded');
        });
    });
    describe('recordUsage', () => {
        it('should record usage correctly', async () => {
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 1000);
            const usage = await freeTierService.getUserUsage('user1', 'gpt-4o-mini');
            expect(usage.tokensUsedToday).toBe(1000);
            expect(usage.tokensUsedThisMonth).toBe(1000);
            expect(usage.requestsThisHour).toBe(1);
        });
        it('should accumulate usage for multiple requests', async () => {
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 1000);
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 500);
            const usage = await freeTierService.getUserUsage('user1', 'gpt-4o-mini');
            expect(usage.tokensUsedToday).toBe(1500);
            expect(usage.requestsThisHour).toBe(2);
        });
    });
    describe('getUserSummary', () => {
        it('should provide usage summary for user', async () => {
            // Record some usage - 8000 * 0.5 = 4000 (50% of daily limit)
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 4000);
            const summary = await freeTierService.getUserSummary('user1');
            expect(summary.models).toHaveLength(1); // Only default minimal model
            expect(summary.models[0].percentUsed.daily).toBe(50);
            expect(summary.recommendUpgrade).toBe(false);
        });
        it('should recommend upgrade when usage is high', async () => {
            // Record high usage (80% of daily limit) - 8000 * 0.8 = 6400
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 6400);
            const summary = await freeTierService.getUserSummary('user1');
            expect(summary.recommendUpgrade).toBe(true);
        });
    });
    describe('estimateTokens', () => {
        it('should estimate tokens correctly', () => {
            const content = 'Hello, this is a test message!';
            const estimated = freeTierService.estimateTokens(content);
            // Rough approximation: 1 token ≈ 4 characters
            expect(estimated).toBe(Math.ceil(content.length / 4));
        });
        it('should handle empty content', () => {
            const estimated = freeTierService.estimateTokens('');
            expect(estimated).toBe(0);
        });
    });
    describe('getServerApiKey', () => {
        it('should return configured API key for any provider', () => {
            const openaiKey = freeTierService.getServerApiKey('openai');
            const googleKey = freeTierService.getServerApiKey('google');
            expect(openaiKey).toBe('test-openai-key');
            expect(googleKey).toBe('test-google-key');
        });
        it('should return undefined for unconfigured provider', () => {
            const unknownKey = freeTierService.getServerApiKey('anthropic');
            expect(unknownKey).toBeUndefined();
            const serviceWithoutKeys = new FreeTierService({ enabled: true });
            const missingKey = serviceWithoutKeys.getServerApiKey('openai');
            expect(missingKey).toBeUndefined();
        });
    });
    describe('addFreeModel', () => {
        it('should add custom models to free tier', () => {
            freeTierService.addFreeModel({
                id: 'claude-3-haiku',
                name: 'Claude 3 Haiku (Free)',
                provider: 'anthropic',
                contextLength: 200000,
                limits: {
                    tokensPerDay: 10000,
                    tokensPerMonth: 100000,
                    requestsPerHour: 30,
                    maxTokensPerRequest: 4096
                },
                capabilities: ['text', 'reasoning'],
                enabled: true
            });
            // Configure anthropic API key
            freeTierService.configureServerKeys({ anthropic: 'test-anthropic-key' });
            const models = freeTierService.getAvailableModels();
            const claudeModel = models.find(m => m.id === 'claude-3-haiku');
            expect(claudeModel).toBeDefined();
            expect(claudeModel?.provider).toBe('anthropic');
        });
        it('should throw error when trying to add model to disabled free tier', () => {
            const disabledService = new FreeTierService({ enabled: false });
            expect(() => {
                disabledService.addFreeModel({
                    id: 'test-model',
                    name: 'Test Model',
                    provider: 'test',
                    contextLength: 4096,
                    limits: {
                        tokensPerDay: 1000,
                        tokensPerMonth: 10000,
                        requestsPerHour: 10,
                        maxTokensPerRequest: 1024
                    },
                    capabilities: ['text'],
                    enabled: true
                });
            }).toThrow('Free tier must be enabled to add models');
        });
    });
    describe('setModelEnabled', () => {
        it('should enable/disable models', () => {
            freeTierService.setModelEnabled('gpt-4o-mini', false);
            const models = freeTierService.getAvailableModels();
            const gptModel = models.find(m => m.id === 'gpt-4o-mini');
            expect(gptModel).toBeUndefined(); // Disabled models are filtered out
        });
    });
    describe('counter resets', () => {
        it('should reset daily counters on new day', async () => {
            // Record usage
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 1000);
            const usage = await freeTierService.getUserUsage('user1', 'gpt-4o-mini');
            expect(usage.tokensUsedToday).toBe(1000);
            // Simulate day change by manually adjusting last reset
            usage.lastReset.daily = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            // Get usage again (this should trigger reset)
            const newUsage = await freeTierService.getUserUsage('user1', 'gpt-4o-mini');
            expect(newUsage.tokensUsedToday).toBe(0);
            expect(newUsage.tokensUsedThisMonth).toBe(1000); // Monthly should persist
        });
    });
    describe('different models for same user', () => {
        it('should track usage separately for different models', async () => {
            await freeTierService.recordUsage('user1', 'gpt-4o-mini', 1000);
            await freeTierService.recordUsage('user1', 'gemini-2.0-flash', 2000);
            const gptUsage = await freeTierService.getUserUsage('user1', 'gpt-4o-mini');
            const geminiUsage = await freeTierService.getUserUsage('user1', 'gemini-2.0-flash');
            expect(gptUsage.tokensUsedToday).toBe(1000);
            expect(geminiUsage.tokensUsedToday).toBe(2000);
        });
    });
});

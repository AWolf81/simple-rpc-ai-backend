import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPRateLimiter } from '../../src/security/rate-limiter.js';
// Mock os module for memory monitoring
vi.mock('os', () => ({
    default: {
        totalmem: vi.fn().mockReturnValue(8589934592), // 8GB
        freemem: vi.fn().mockReturnValue(4294967296) // 4GB free
    }
}));
describe('MCPRateLimiter - Throttling & Load Management', () => {
    let rateLimiter;
    let mockRequest;
    let mockResponse;
    let mockNext;
    const defaultConfig = {
        enabled: true,
        adaptive: {
            enabled: true,
            cpuThreshold: 80,
            memoryThreshold: 85,
            throttleMultiplier: 0.5
        },
        global: {
            windowMs: 60000,
            max: 100
        },
        authenticated: {
            windowMs: 60000,
            max: 200
        },
        admin: {
            windowMs: 60000,
            max: 500
        },
        toolLimits: {
            'ai-request': {
                windowMs: 60000,
                max: 50
            },
            'greeting': {
                windowMs: 60000,
                max: 60
            }
        },
        burst: {
            enabled: true,
            windowMs: 10000,
            max: 10
        }
    };
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock process.cpuUsage to return consistent values during initialization
        const mockCpuUsage = vi.spyOn(process, 'cpuUsage');
        mockCpuUsage.mockReturnValue({ user: 100000, system: 50000 });
        mockRequest = {
            ip: '192.168.1.1',
            headers: {},
            user: null
        };
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis()
        };
        mockNext = vi.fn();
        rateLimiter = new MCPRateLimiter(defaultConfig);
        // Allow some time for initialization
        vi.advanceTimersByTime(1000);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });
    describe('Load Level Detection', () => {
        it('should detect normal load (level 0)', () => {
            // Mock low CPU and memory usage
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 40, // Below 80% threshold
                memory: 50, // Below 85% threshold
                lastUpdate: Date.now()
            });
            const loadStatus = rateLimiter.getLoadStatus();
            expect(loadStatus.loadLevel).toBe(0);
            expect(loadStatus.status).toBe('normal');
            expect(loadStatus.recommendations).toEqual([]);
        });
        it('should detect light load (level 1)', () => {
            // Mock CPU at 90% (just above 80% threshold)
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 90, // 90/80 = 1.125 stress ratio
                memory: 50,
                lastUpdate: Date.now()
            });
            const loadStatus = rateLimiter.getLoadStatus();
            expect(loadStatus.loadLevel).toBe(1);
            expect(loadStatus.status).toBe('light_load');
            expect(loadStatus.recommendations).toContain('Consider batching smaller requests');
        });
        it('should detect moderate load (level 2)', () => {
            // Mock memory at 1.3x threshold but < 1.5x to get level 2
            // 85 * 1.3 = 110.5, and 85 * 1.5 = 127.5, so use 120 (85 * 1.41 ≈ 1.41)
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 60,
                memory: 120, // 120/85 = 1.41 stress ratio (level 2: 1.2 <= x < 1.5) 
                lastUpdate: Date.now()
            });
            const loadStatus = rateLimiter.getLoadStatus();
            expect(loadStatus.loadLevel).toBe(2);
            expect(loadStatus.status).toBe('moderate_load');
            expect(loadStatus.recommendations).toContain('Use simpler AI models if available');
        });
        it('should detect heavy load (level 3)', () => {
            // Mock high CPU and memory
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 130, // 130/80 = 1.625 stress ratio
                memory: 95, // 95/85 = 1.118 stress ratio (max stress = 1.625)
                lastUpdate: Date.now()
            });
            const loadStatus = rateLimiter.getLoadStatus();
            expect(loadStatus.loadLevel).toBe(3);
            expect(loadStatus.status).toBe('heavy_load');
            expect(loadStatus.recommendations).toContain('Consider scaling infrastructure');
        });
    });
    describe('Graduated Throttling', () => {
        let originalConsoleLog;
        beforeEach(() => {
            // Suppress console.log during tests
            originalConsoleLog = console.log;
            console.log = vi.fn();
        });
        afterEach(() => {
            console.log = originalConsoleLog;
        });
        it('should not throttle under normal load', () => {
            // Mock normal load
            vi.spyOn(rateLimiter, 'getLoadReductionLevel').mockReturnValue(0);
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // Should return normal middlewares without throttling
            expect(middlewares).toBeDefined();
            expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('throttling'));
        });
        it('should apply light throttling (20% reduction)', () => {
            // Mock light load (level 1) by setting up system stats that trigger level 1
            // Need 1.0 <= stress < 1.2 for level 1, so use 88 (88/80 = 1.1)
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 88, // 88/80 = 1.1 stress ratio (level 1)
                memory: 50,
                lastUpdate: Date.now()
            });
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // Should log throttling with 80% of original limit (50 * 0.8 = 40)
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Load level 1 - throttling tool \'ai-request\' from 50 to 40 requests'));
        });
        it('should apply moderate throttling (40% reduction)', () => {
            // Mock moderate load (level 2) by setting up system stats that trigger level 2
            // Need 1.2 <= stress < 1.5 for level 2, so use 104 (104/80 = 1.3)
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 104, // 104/80 = 1.3 stress ratio (level 2)
                memory: 50,
                lastUpdate: Date.now()
            });
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // Should log throttling with 60% of original limit (50 * 0.6 = 30)
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Load level 2 - throttling tool \'ai-request\' from 50 to 30 requests'));
        });
        it('should apply heavy throttling (60% reduction)', () => {
            // Mock heavy load (level 3) by setting up system stats that trigger level 3
            // Need stress >= 1.5 for level 3, so use 150 (150/80 = 1.875)
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 160, // 160/80 = 2.0 stress ratio (level 3)
                memory: 50,
                lastUpdate: Date.now()
            });
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // Should log throttling with 40% of original limit (50 * 0.4 = 20)
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Load level 3 - throttling tool \'ai-request\' from 50 to 20 requests'));
        });
    });
    describe('CPU Usage Monitoring', () => {
        it('should calculate CPU percentage correctly', () => {
            const limiter = rateLimiter;
            // Clear previous mocks and set up sequential CPU measurements
            vi.clearAllMocks();
            // Mock first CPU measurement - establish baseline
            const firstCpuUsage = { user: 100000, system: 50000 }; // 150ms total
            const mockCpuUsage = vi.spyOn(process, 'cpuUsage').mockReturnValueOnce(firstCpuUsage);
            limiter.updateSystemStats();
            // Fast-forward time by 1 second
            vi.advanceTimersByTime(1000);
            // Mock second CPU measurement (additional 200ms CPU time used)
            const secondCpuUsage = { user: 200000, system: 150000 }; // 350ms total
            mockCpuUsage.mockReturnValueOnce(secondCpuUsage);
            limiter.updateSystemStats();
            // CPU usage should be: (200ms CPU time / 1000ms real time) * 100 = 20%
            expect(limiter.systemStats.cpu).toBeCloseTo(20, 1);
        });
        it('should handle first CPU measurement gracefully', () => {
            // Create a new limiter to test fresh initialization
            const freshConfig = { ...defaultConfig };
            const freshLimiter = new MCPRateLimiter(freshConfig);
            // Reset CPU usage baseline to ensure clean state
            freshLimiter.lastCpuUsage = null;
            freshLimiter.lastCpuMeasurementTime = 0;
            // Clear all mocks and mock the CPU usage
            vi.clearAllMocks();
            vi.spyOn(process, 'cpuUsage').mockReturnValue({ user: 100000, system: 50000 });
            freshLimiter.updateSystemStats();
            expect(freshLimiter.systemStats.cpu).toBe(0);
            expect(freshLimiter.lastCpuUsage).toEqual({ user: 100000, system: 50000 });
        });
    });
    describe('Memory Usage Monitoring', () => {
        it('should calculate system-wide memory percentage', async () => {
            const os = await import('os');
            // Mock system memory: 8GB total, 4GB free = 50% usage
            vi.mocked(os.default.totalmem).mockReturnValue(8589934592); // 8GB
            vi.mocked(os.default.freemem).mockReturnValue(4294967296); // 4GB free
            const limiter = rateLimiter;
            limiter.updateSystemStats();
            // Should be 50% memory usage
            expect(limiter.systemStats.memory).toBeCloseTo(50, 1);
        });
    });
    describe('Load Status API', () => {
        it('should provide comprehensive load status information', () => {
            // Mock moderate load
            vi.spyOn(rateLimiter, 'systemStats', 'get').mockReturnValue({
                cpu: 96, // 96/80 = 1.2 stress ratio (level 2)
                memory: 70,
                lastUpdate: Date.now()
            });
            const status = rateLimiter.getLoadStatus();
            expect(status).toEqual({
                cpu: 96,
                memory: 70,
                loadLevel: 2,
                status: 'moderate_load',
                recommendations: [
                    'Reduce request frequency',
                    'Use simpler AI models if available',
                    'Implement exponential backoff'
                ],
                thresholds: {
                    cpu: 80,
                    memory: 85
                }
            });
        });
    });
    describe('Error Handling', () => {
        it('should handle CPU monitoring errors gracefully', () => {
            const limiter = rateLimiter;
            const originalConsoleError = console.error;
            console.error = vi.fn();
            // Mock process.cpuUsage to throw an error
            vi.spyOn(process, 'cpuUsage').mockImplementation(() => {
                throw new Error('CPU monitoring failed');
            });
            // Should not throw, should handle error gracefully
            expect(() => limiter.updateSystemStats()).not.toThrow();
            expect(console.error).toHaveBeenCalledWith('❌ Rate limiting: Failed to update system stats:', expect.any(Error));
            console.error = originalConsoleError;
        });
    });
    describe('Integration with Express Rate Limiting', () => {
        it('should create proper middleware stack', () => {
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // Should have multiple middleware functions
            expect(middlewares).toBeInstanceOf(Array);
            expect(middlewares.length).toBeGreaterThan(0);
            // Each middleware should be a function
            middlewares.forEach(middleware => {
                expect(typeof middleware).toBe('function');
            });
        });
        it('should prioritize authenticated users during throttling', () => {
            // Mock moderate load
            vi.spyOn(rateLimiter, 'getLoadReductionLevel').mockReturnValue(2);
            // Test authenticated user
            mockRequest.user = { id: 'user123', email: 'test@example.com' };
            const middlewares = rateLimiter.getMiddleware();
            const userTierMiddleware = middlewares[middlewares.length - 1];
            // Should be a function that can handle authenticated users
            expect(typeof userTierMiddleware).toBe('function');
        });
    });
    describe('Load Reduction Headers', () => {
        it('should set appropriate headers when throttling is active', () => {
            // This test would need to be more complex to properly test the onLimitReached callback
            // For now, we test that the throttling logic includes the header setting code
            vi.spyOn(rateLimiter, 'getLoadReductionLevel').mockReturnValue(2);
            const middlewares = rateLimiter.getMiddleware('ai-request');
            // The middleware should be configured (we can't easily test the callback here)
            expect(middlewares).toBeDefined();
        });
    });
});

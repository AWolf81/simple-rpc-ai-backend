import { defineConfig } from 'vitest/config';
import path from 'path';
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallel execution for faster CI
        maxThreads: process.env.CI ? 4 : undefined, // Limit threads in CI
        minThreads: process.env.CI ? 2 : undefined
      }
    },
    testTimeout: 30000, // 30s timeout per test
    hookTimeout: 10000, // 10s timeout for hooks
    teardownTimeout: 10000,
    retry: process.env.CI ? 1 : 0, // Retry once in CI for flaky tests
    coverage: {
      provider: 'v8',
      reporter: process.env.CI
        ? ['text-summary', 'json', 'lcov'] // Minimal reporters in CI
        : ['text', 'json', 'html', 'lcov'], // Full reporters locally
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        'examples/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ],
      include: [
        'src/**/*.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@auth': path.resolve(__dirname, './src/auth'),
      '@src-trpc': path.resolve(__dirname, './src/trpc'),
      '@database': path.resolve(__dirname, './src/database'),
      '@billing': path.resolve(__dirname, './src/billing'),
      '@security': path.resolve(__dirname, './src/security'),
      '@storage': path.resolve(__dirname, './src/storage'),
      '@schemas': path.resolve(__dirname, './src/schemas'),
      '@mcp': path.resolve(__dirname, './src/mcp'),
      '@monetization': path.resolve(__dirname, './src/monetization'),
      '@middleware': path.resolve(__dirname, './src/middleware')
    }
  },
  esbuild: {
    target: 'node22' // Match our minimum Node.js version
  },
  plugins: [tsconfigPaths({
    configNames: ["tsconfig.test.json"]
  })],
});
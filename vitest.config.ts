import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for network operations
    hookTimeout: 30000,
    setupFiles: ['./tests/setup/devnet.ts'],
    retry: 2, // Retry failed tests due to network issues
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      exclude: ['tests/**', 'dist/**', 'node_modules/**'],
      reporter: ['text', 'json', 'html']
    },
    sequence: {
      shuffle: false, // Run tests in order for better debugging
      concurrent: false // Force sequential execution of test files
    },
    // Force sequential execution for integration tests
    poolOptions: {
      threads: {
        singleThread: true // Run all tests in a single thread
      }
    },
    // Ensure integration tests run one file at a time
    maxConcurrency: 1,
    fileParallelism: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
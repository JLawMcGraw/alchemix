import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: process.cwd(),
    setupFiles: [path.resolve(__dirname, './src/tests/setup.ts')],
    env: {
      JWT_SECRET: 'test-jwt-secret-key-for-unit-tests-only-minimum-32-characters',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

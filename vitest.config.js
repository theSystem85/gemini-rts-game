import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Enable globals for describe, it, expect, etc.
    globals: true,

    // Use jsdom environment for DOM manipulation needed by the game
    environment: 'jsdom',

    // Include test files
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],

    // Setup files to run before tests
    setupFiles: ['./tests/setup.js'],

    // Timeout for integration tests that run the game loop
    testTimeout: 30000,

    // Use forks pool for isolation (Vitest 4 uses top-level options)
    pool: 'forks',

    // Run tests sequentially to avoid state conflicts
    sequence: {
      shuffle: false
    },

    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/rendering/**', 'src/ui/**', 'src/sound.js']
    }
  },

  // Resolve configuration to match Vite
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})

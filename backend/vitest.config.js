const { defineConfig } = require('vitest/config');
module.exports = defineConfig({
  test: { globals: true, setupFiles: ['./tests/env.js'], fileParallelism: false, testTimeout: 20000, hookTimeout: 20000, include: ['tests/**/*.test.js'] },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      PORT: '0',
    },
    include: ['tests/**/*.test.ts'],
  },
});

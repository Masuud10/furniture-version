import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Node, not jsdom: everything under test here is a pure function. If a unit
    // test ever needs a DOM or a mock, the logic is in the wrong place.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});

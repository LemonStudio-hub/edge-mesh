import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_SIGNALING_URL': JSON.stringify('http://localhost:8787'),
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['test/setup.ts'],
  },
});

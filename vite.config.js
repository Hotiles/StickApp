import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' gör att bygget funkar både på GitHub Pages (/StickApp/) och lokalt.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});

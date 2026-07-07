import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Stämplar sw.js med en unik version per bygge (commit-SHA i CI, annars
 * tidsstämpel). Då blir varje deploy en byte-skild service worker som
 * webbläsaren upptäcker, och gamla cachar rensas automatiskt hos användarna.
 */
function stampServiceWorkerVersion() {
  return {
    name: 'stamp-sw-version',
    apply: 'build',
    closeBundle() {
      const swPath = fileURLToPath(new URL('./dist/sw.js', import.meta.url));
      const version = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 10);
      const stamped = readFileSync(swPath, 'utf8').replace('__BUILD_VERSION__', version);
      if (!stamped.includes(version)) throw new Error('Hittade inte __BUILD_VERSION__ i sw.js');
      writeFileSync(swPath, stamped);
    },
  };
}

// base './' gör att bygget funkar både på GitHub Pages (/StickApp/) och lokalt.
export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorkerVersion()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});

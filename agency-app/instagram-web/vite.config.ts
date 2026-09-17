import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The app is served from the `/insta/*` CloudFront behavior on the CRM
 * distribution, not from a root domain, so every emitted asset URL must be
 * prefixed. `base` and the router `basename` in App.tsx must stay in sync.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT) || 3100;

  return {
    base: '/insta/',
    plugins: [react({ jsxRuntime: 'automatic' })],
    server: {
      port,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});

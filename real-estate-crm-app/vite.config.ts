import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT) || 3000;

  return {
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

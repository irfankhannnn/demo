import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Compiles Tailwind (src/styles.css, imported by src/main.js) into a single
// dist/assets/main.css that replaces the Tailwind CDN used in the LP HTML.
// PostCSS plugins (tailwindcss, autoprefixer) are picked up from postcss.config.js.
export default defineConfig({
  root: __dirname,
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.js'),
      output: {
        entryFileNames: 'assets/build-entry.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/main.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});

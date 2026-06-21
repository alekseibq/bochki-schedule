import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@bochki/ui': fileURLToPath(
        new URL('../../packages/ui/src/index.ts', import.meta.url)
      ),
      '@bochki/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url)
      )
    }
  }
});

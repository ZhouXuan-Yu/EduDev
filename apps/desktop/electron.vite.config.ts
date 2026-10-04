import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts'), 'document-worker': resolve('src/main/xiaozhi-agent/document-worker.ts'), 'image-worker': resolve('src/main/xiaozhi-agent/image-worker.ts'), 'office-generator': resolve('src/main/xiaozhi-agent/office-generator.ts') }, output: { chunkFileNames: '[name]-[hash].js' } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), 'browser-status': resolve('src/renderer/browser-status.html') } } },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [react()],
  },
});

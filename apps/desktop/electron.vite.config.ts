import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import {nativeComponentBoundary} from './scripts/css-native-boundary';

export default defineConfig(({ command }) => ({
  main: {
    // A release entry never follows an inherited URL to another renderer revision.
    define: command === 'build' ? { 'process.env.ELECTRON_RENDERER_URL': 'undefined' } : {},
    plugins: [externalizeDepsPlugin(),{
      name:'xiaozhi-education-source-assets',
      writeBundle(options){
        if(!options.dir)throw new Error('Education capability output directory unavailable');
        fs.copyFileSync(resolve('src/main/education/reading-worker.py'),resolve(options.dir,'reading-worker.py'));
        fs.mkdirSync(resolve(options.dir,'vendor/deeptutor-reading'),{recursive:true});
        for(const file of ['search.py','models.py','LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/education/vendor/deeptutor-reading',file),resolve(options.dir,'vendor/deeptutor-reading',file));
        fs.copyFileSync(resolve('src/main/education/learning-worker.py'),resolve(options.dir,'learning-worker.py'));
        fs.mkdirSync(resolve(options.dir,'vendor/deeptutor-learning'),{recursive:true});
        for(const file of ['mastery.py','scheduler.py','grading.py','models.py','policy.py','LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/education/vendor/deeptutor-learning',file),resolve(options.dir,'vendor/deeptutor-learning',file));
        fs.copyFileSync(resolve('src/main/education/question-worker.py'),resolve(options.dir,'question-worker.py'));
        fs.mkdirSync(resolve(options.dir,'vendor/deeptutor-question'),{recursive:true});
        for(const file of ['pipeline.py','LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/education/vendor/deeptutor-question',file),resolve(options.dir,'vendor/deeptutor-question',file));
        fs.copyFileSync(resolve('src/main/education/math-worker.py'),resolve(options.dir,'math-worker.py'));
        fs.mkdirSync(resolve(options.dir,'vendor/math'),{recursive:true});
        for(const file of ['sympy-1.14.0-py3-none-any.whl','mpmath-1.3.0-py3-none-any.whl','SymPy.LICENSE','mpmath.LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/education/vendor/math',file),resolve(options.dir,'vendor/math',file));
      },
    }],
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
    css: {postcss: {plugins:[nativeComponentBoundary(resolve('src/renderer'))]}},
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), 'browser-status': resolve('src/renderer/browser-status.html') } } },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [react()],
  },
}));

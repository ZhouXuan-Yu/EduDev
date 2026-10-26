import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import {nativeComponentBoundary} from './scripts/css-native-boundary';
import {buildClassroomPreview} from './scripts/education/classroom-preview-bundle.mjs';

export default defineConfig(({ command }) => ({
  main: {
    // A release entry never follows an inherited URL to another renderer revision.
    define: command === 'build' ? { 'process.env.ELECTRON_RENDERER_URL': 'undefined' } : {},
    plugins: [externalizeDepsPlugin(),{
      name:'xiaozhi-education-source-assets',
      async writeBundle(options){
        if(!options.dir)throw new Error('Education capability output directory unavailable');
        fs.writeFileSync(resolve(options.dir,'classroom-preview.json'),JSON.stringify(await buildClassroomPreview()));
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
        fs.cpSync(resolve('src/main/education/vendor/openmaic'),resolve(options.dir,'vendor/openmaic'),{recursive:true});
        fs.mkdirSync(resolve(options.dir,'vendor/harness-openmaic'),{recursive:true});
        fs.mkdirSync(resolve(options.dir,'vendor/harness-mu'),{recursive:true});
        fs.mkdirSync(resolve(options.dir,'vendor/anatomy'),{recursive:true});
        for(const file of ['LICENSE','source-manifest.json'])fs.copyFileSync(resolve('src/main/xiaozhi-agent/vendor/anatomy',file),resolve(options.dir,'vendor/anatomy',file));
        for(const file of ['LICENSE','source-manifest.json'])fs.copyFileSync(resolve('src/main/xiaozhi-agent/vendor/mu-decisions',file),resolve(options.dir,'vendor/harness-mu',file));
        for(const file of ['LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/xiaozhi-agent/vendor/openmaic',file),resolve(options.dir,'vendor/harness-openmaic',file));
        fs.mkdirSync(resolve(options.dir,'vendor/math'),{recursive:true});
        for(const file of ['sympy-1.14.0-py3-none-any.whl','mpmath-1.3.0-py3-none-any.whl','SymPy.LICENSE','mpmath.LICENSE','source-manifest.json'])
          fs.copyFileSync(resolve('src/main/education/vendor/math',file),resolve(options.dir,'vendor/math',file));
      },
    }],
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts'), 'retrieval-worker':resolve('src/main/retrieval/vector-worker.ts'), 'education-runtime': resolve('src/main/education/worker-host.ts'), 'ocr-runtime': resolve('src/main/xiaozhi-agent/ocr-host.ts'), 'document-worker': resolve('src/main/xiaozhi-agent/document-worker.ts'), 'image-worker': resolve('src/main/xiaozhi-agent/image-worker.ts'), 'office-generator': resolve('src/main/xiaozhi-agent/office-generator.ts') }, output: { chunkFileNames: '[name]-[hash].js' } } },
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
      dedupe:['react','react-dom'],
      alias: {
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [react(),{name:'xiaozhi-sandbox-classroom-preview',resolveId(id){if(id==='virtual:classroom-preview')return '\0xiaozhi-classroom-preview';},async load(id){if(id==='\0xiaozhi-classroom-preview'){const payload=await buildClassroomPreview();return `export const classroomPreviewScript=${JSON.stringify(payload.script)};export const classroomPreviewCss=${JSON.stringify(payload.css)};`;}}}],
  },
}));

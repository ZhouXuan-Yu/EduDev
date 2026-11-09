/** Node-only deterministic compiler checks. Electron uses its frozen Vite build.
 * Node's default strip-only loader cannot load constructor parameter properties
 * in the current template repository. Transform unchanged local TS, including
 * its dependency closure, without installing hooks in the product process.
 */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks, stripTypeScriptTypes} from 'node:module';
import '../office-agent/register-source.mjs';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
registerHooks({load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.ts')) {
    const file = fileURLToPath(url);
    if (file.startsWith(sourceRoot)) return {format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(fs.readFileSync(file, 'utf8'), {mode: 'transform', sourceUrl: url})};
  }
  return next(url, context);
}});

export const loadPaperOfficeCompiler = () => import('../../src/main/education/paper-export.ts');

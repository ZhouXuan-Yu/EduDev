// Node 24 source-only smoke loader. Production resolution belongs to electron-vite.
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
    return next(`${specifier}.ts`, context);
  }
} });

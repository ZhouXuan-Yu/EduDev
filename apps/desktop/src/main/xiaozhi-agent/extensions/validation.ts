import {EXTENSION_HOOKS, type ExtensionManifest, type ExtensionView} from './types';
import {permissionHash, plain, exact} from '../permissions/validation';

export const EXTENSION_MAX_BYTES = 65536;
export function boundedJson(value: unknown): boolean {
  let nodes = 0;
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 4096 || depth > 16) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'string') return item.length <= 32768;
    if (Array.isArray(item)) return item.length <= 256 && item.every(child => visit(child, depth + 1));
    return plain(item) && Object.keys(item).length <= 128
      && Object.entries(item).every(([key, child]) => key.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(key) && visit(child, depth + 1));
  };
  return visit(value, 0) && Buffer.byteLength(JSON.stringify(value)) <= EXTENSION_MAX_BYTES;
}
export function validManifest(value: unknown): value is ExtensionManifest {
  if (!plain(value) || !exact(value, ['schemaVersion', 'extensionId', 'version', 'source', 'sourceHash', 'license', 'licenseHash', 'artifactId', 'hooks'])) return false;
  return value.schemaVersion === 1 && typeof value.extensionId === 'string' && /^[a-z][a-z0-9_.-]{0,79}$/u.test(value.extensionId)
    && typeof value.version === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/u.test(value.version)
    && typeof value.source === 'string' && value.source.length <= 2048 && validSource(value.source)
    && typeof value.sourceHash === 'string' && /^[a-f0-9]{64}$/u.test(value.sourceHash)
    && typeof value.licenseHash === 'string' && /^[a-f0-9]{64}$/u.test(value.licenseHash)
    && typeof value.artifactId === 'string' && /^[a-f0-9]{64}$/u.test(value.artifactId)
    && typeof value.license === 'string' && /^[A-Za-z0-9 .+()-]{1,100}$/u.test(value.license) && value.license.trim() === value.license
    && Array.isArray(value.hooks) && value.hooks.length > 0 && value.hooks.length <= EXTENSION_HOOKS.length
    && new Set(value.hooks).size === value.hooks.length && value.hooks.every(hook => EXTENSION_HOOKS.includes(hook));
}
function validSource(value: string) {
  try {const source = new URL(value); return !source.username && !source.password && !source.hash && (source.protocol === 'https:'
    || source.protocol === 'edudev-local:' && source.hostname === 'extensions' && !source.search && /^\/[a-z][a-z0-9_.-]{0,79}$/u.test(source.pathname));}
  catch {return false;}
}
/** Local identity is a dependency namespace and carries no network authority. */
export function extensionDependencySource(value: string) {
  if (!validSource(value)) throw Error('invalid_input');
  const source = new URL(value);
  return source.protocol === 'edudev-local:' ? 'edudev-local://extensions' : source.origin;
}
export function validView(value: unknown): value is ExtensionView {
  return plain(value) && exact(value, ['schemaVersion', 'extensionId', 'revision', 'enabled', 'activeVersion', 'versions'])
    && value.schemaVersion === 1 && typeof value.extensionId === 'string' && /^[a-z][a-z0-9_.-]{0,79}$/u.test(value.extensionId)
    && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0 && typeof value.enabled === 'boolean'
    && Array.isArray(value.versions) && value.versions.length <= 64 && new Set(value.versions.map(item => item?.manifest?.version)).size === value.versions.length
    && value.versions.every(item => plain(item) && exact(item, ['manifest', 'healthAt', 'revokedAt']) && validManifest(item.manifest)
      && item.manifest.extensionId === value.extensionId && typeof item.healthAt === 'string' && Number.isFinite(Date.parse(item.healthAt))
      && (item.revokedAt === null || typeof item.revokedAt === 'string' && Number.isFinite(Date.parse(item.revokedAt))))
    && (value.activeVersion === null || value.versions.some(item => item.manifest.version === value.activeVersion && item.revokedAt === null))
    && (!value.enabled || value.activeVersion !== null);
}
export const extensionSchemaHash = (manifest: ExtensionManifest) => permissionHash({schemaVersion: 1, hooks: manifest.hooks});

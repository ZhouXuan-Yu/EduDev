import {maxSatisfying, valid, validRange, satisfies} from 'semver';
import {protocolHash} from '../validation';
import {hashCapabilityBytes} from './file-hash';

export type LockedNpmPackage = {
  name: string;
  version: string;
  path: string;
  tarball: string;
  integrity: string;
  license: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  engines: Record<string, string>;
  repository: string | null;
  manifestHash: string;
};
export type PublicFetch = (url: string, signal: AbortSignal, maximumBytes: number, accept?: string) => Promise<Buffer>;
export const validPackageName = (name: string) => /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name) && name.length <= 214;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fields = (value: unknown): Record<string, string> => {
  if (value === undefined) return {};
  if (!record(value) || Object.keys(value).length > 128 || Object.entries(value).some(([key, item]) => key.length > 214 || typeof item !== 'string' || item.length > 2048)) throw Error('invalid_metadata');
  return value as Record<string, string>;
};
export function npmManifestHash(value: Record<string, unknown>) {
  return protocolHash(Object.fromEntries(['name', 'version', 'license', 'dependencies', 'optionalDependencies', 'peerDependencies',
    'peerDependenciesMeta', 'scripts', 'engines', 'main', 'module', 'type', 'bin', 'exports'].map(key => [key, value[key] ?? null])));
}

/** Resolve a bounded lock before installing bytes. Every selected version is exact. */
export async function lockNpmGraph(name: string, version: string, fetcher: PublicFetch, signal: AbortSignal) {
  if (!validPackageName(name) || !valid(version)) throw Error('invalid_input');
  const locked: LockedNpmPackage[] = [];
  const metadata = new Map<string, Promise<Record<string, unknown>>>();
  const get = (url: string, abbreviated = false) => {
    let request = metadata.get(url);
    if (!request) {
      request = fetcher(url, signal, 24 * 1048576, abbreviated ? 'application/vnd.npm.install-v1+json' : 'application/json')
        .then(bytes => {const parsed: unknown = JSON.parse(bytes.toString('utf8')); if (!record(parsed)) throw Error('invalid_metadata'); return parsed;});
      metadata.set(url, request);
    }
    return request;
  };
  async function resolve(packageName: string, range: string, directory: string, ancestors: LockedNpmPackage[], depth: number) {
    signal.throwIfAborted();
    if (!validPackageName(packageName) || !validRange(range) || depth > 24 || locked.length >= 128) throw Error('unsupported_dependency');
    if (ancestors.some(entry => entry.name === packageName && satisfies(entry.version, range))) return;
    const base = 'https://registry.npmjs.org/' + encodeURIComponent(packageName);
    let exact = valid(range);
    if (!exact) {
      const packument = await get(base, true);
      if (!record(packument.versions)) throw Error('invalid_metadata');
      exact = maxSatisfying(Object.keys(packument.versions), range);
      if (!exact) throw Error('missing_dependency');
    }
    const value = await get(base + '/' + encodeURIComponent(exact));
    if (value.name !== packageName || value.version !== exact || !record(value.dist)
        || typeof value.dist.tarball !== 'string' || typeof value.dist.integrity !== 'string'
        || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(value.dist.integrity)) throw Error('invalid_metadata');
    const archive = new URL(value.dist.tarball);
    if (archive.origin !== 'https://registry.npmjs.org' || archive.username || archive.password || archive.search || archive.hash) throw Error('source_untrusted');
    const manifestHash = npmManifestHash(value);
    const dependencies = {...fields(value.dependencies)};
    const peer = fields(value.peerDependencies);
    const optionalPeer = record(value.peerDependenciesMeta) ? value.peerDependenciesMeta : {};
    for (const [id, constraint] of Object.entries(peer)) {
      if (!dependencies[id] && !(record(optionalPeer[id]) && optionalPeer[id].optional === true)) dependencies[id] = constraint;
    }
    const repository = typeof value.repository === 'string' ? value.repository : record(value.repository) && typeof value.repository.url === 'string' ? value.repository.url : null;
    const entry: LockedNpmPackage = {name: packageName, version: exact, path: directory, tarball: archive.href,
      integrity: value.dist.integrity, license: typeof value.license === 'string' ? value.license : '', dependencies,
      scripts: fields(value.scripts), engines: fields(value.engines), repository, manifestHash};
    locked.push(entry);
    for (const [id, constraint] of Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right))) {
      await resolve(id, constraint, directory + '/node_modules/' + id, [...ancestors, entry], depth + 1);
    }
  }
  await resolve(name, version, 'package', [], 0);
  return locked;
}

export async function verifyNpmIntegrity(bytes: Buffer, integrity: string) {
  const actual = 'sha512-' + (await hashCapabilityBytes(bytes, 'SHA-512')).toString('base64');
  if (actual !== integrity) throw Error('checksum_mismatch');
}

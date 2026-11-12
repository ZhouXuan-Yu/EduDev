import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compileFunction } from 'node:vm';
import { createNativeStatRequire } from './native-stat-require';
import manifest from './generated/native-stat-manifest.json' with { type: 'json' };
import type { executeNativeStat } from './native-stat-artifact-entry';
import type { ProviderManifest } from './types';
export type NativeStatArtifactManifest = {
    schemaVersion: number;
    file: string;
    sha256: string;
    version: string;
    sources: {
        reference: string;
        sha256: string;
    }[];
};
export type NativeStatExecutable = {
    version: string;
    hash: string;
    reference: string;
    kind: 'hana' | 'workspace';
    execute: typeof executeNativeStat;
};
export const currentNativeStatArtifact = manifest as NativeStatArtifactManifest;
const verifiedExecutables = new WeakSet<object>();
export const isVerifiedNativeStatExecutable = (value: unknown): value is NativeStatExecutable => !!value && typeof value === 'object' && verifiedExecutables.has(value);
function artifactDirectory() {
    const here = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
    const candidates = [path.join(here, 'capability-artifacts'), path.join(here, 'generated'), path.resolve('src/main/xiaozhi-agent/capabilities/generated')];
    const directory = candidates.find(candidate => fs.existsSync(path.join(candidate, manifest.file)));
    if (!directory) {
        throw Error('provider_version_unavailable');
    }
    return directory;
}
/** Only reviewed native build artifacts use this loader. No model or IPC path enters it. */
export function loadNativeStatExecutable(kind: 'hana' | 'workspace', descriptor: NativeStatArtifactManifest = currentNativeStatArtifact, directory = artifactDirectory()): NativeStatExecutable {
    const supportedKind = ['hana', 'workspace'].includes(kind);
    const validDigest = /^[a-f0-9]{64}$/u.test(descriptor.sha256);
    const matchingFilename = descriptor.file === `native-stat-${descriptor.sha256}.cjs`;
    const validVersion = /^\d+\.\d+\.\d+\+[a-f0-9]{12}$/u.test(descriptor.version)
        && descriptor.version.endsWith('+' + descriptor.sha256.slice(0, 12));
    const hasSourceManifest = Array.isArray(descriptor.sources) && descriptor.sources.length > 0;
    if (!supportedKind || descriptor.schemaVersion !== 1 || !validDigest
        || !matchingFilename || !validVersion || !hasSourceManifest) {
        throw Error('capability_invalid_artifact');
    }
    const filename = path.join(directory, descriptor.file);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 2 * 1024 * 1024) {
        throw Error('capability_invalid_artifact');
    }
    const bytes = fs.readFileSync(filename);
    if (createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) {
        throw Error('capability_invalid_artifact');
    }
    // Compile exactly the verified bytes. Later file replacement cannot alter this closure.
    const module = {
        exports: {} as {
            executeNativeStat?: typeof executeNativeStat;
        }
    };
    compileFunction(bytes.toString('utf8'), [
        'exports', 'require', 'module', '__filename', '__dirname'
    ], {
        filename
    })(module.exports, createNativeStatRequire(), module, filename, path.dirname(filename));
    if (typeof module.exports.executeNativeStat !== 'function') {
        throw Error('capability_invalid_artifact');
    }
    const executable = Object.freeze({
        version: descriptor.version,
        hash: descriptor.sha256,
        reference: `native-artifact:${descriptor.sha256}#${kind}`,
        kind,
        execute: module.exports.executeNativeStat
    });
    verifiedExecutables.add(executable);
    return executable;
}
export function retainNativeStatArtifact(descriptor: NativeStatArtifactManifest, directory: string, destination: string) {
    const bytes = fs.readFileSync(path.join(directory, descriptor.file));
    if (createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) {
        throw Error('capability_invalid_artifact');
    }
    fs.mkdirSync(destination, {
        recursive: true
    });
    const target = path.join(destination, descriptor.file);
    if (!fs.existsSync(target)) {
        fs.writeFileSync(target, bytes, {
            flag: 'wx'
        });
    }
    if (createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== descriptor.sha256) {
        throw Error('capability_invalid_artifact');
    }
    const metadata = path.join(destination, descriptor.sha256 + '.json');
    if (!fs.existsSync(metadata)) {
        fs.writeFileSync(metadata, JSON.stringify(descriptor), {
            flag: 'wx'
        });
    }
}
export function loadRetainedNativeStatExecutable(provider: ProviderManifest, directory?: string): NativeStatExecutable | null {
    if (!directory) {
        return null;
    }
    try {
        const hash = provider.source.packageHash;
        if (!/^[a-f0-9]{64}$/u.test(hash)) {
            return null;
        }
        const descriptor = JSON.parse(fs.readFileSync(path.join(directory, hash + '.json'), 'utf8')) as NativeStatArtifactManifest;
        if (descriptor.sha256 !== hash) {
            return null;
        }
        const kind = provider.source.reference === `native-artifact:${hash}#hana` ? 'hana' : provider.source.reference === `native-artifact:${hash}#workspace` ? 'workspace' : null;
        if (!kind) {
            return null;
        }
        return loadNativeStatExecutable(kind, {
            ...descriptor,
            version: provider.version
        }, directory);
    }
    catch {
        return null;
    }
}

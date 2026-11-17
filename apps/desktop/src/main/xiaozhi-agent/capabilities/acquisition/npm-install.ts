import fs from 'node:fs/promises';
import path from 'node:path';
import {satisfies} from 'semver';
import {build} from 'esbuild';
import {digest, containsPath} from '../../permissions/resources';
import {extractCapabilityPackage} from './package-archive';
import {npmManifestHash, verifyNpmIntegrity, type LockedNpmPackage, type PublicFetch} from './npm-source';
import {FILESYSTEM_RECIPE, NODE_RECIPE, PERMISSIVE_LICENSES} from './recipes';
import {hashCapabilityFile} from './file-hash';
import {prepareManagedNode} from './node-runtime';

const licenseName = /^(?:licen[cs]e|copying|copyright)(?:[._-].*)?$/iu;
export type InstalledPackageFile = {path: string; bytes: number; sha256: string};

export async function capabilityPackageFiles(directory: string): Promise<InstalledPackageFile[]> {
  const pending = [''];
  const files: InstalledPackageFile[] = [];
  let total = 0;
  while (pending.length) {
    const relative = pending.shift()!;
    for (const entry of await fs.readdir(path.join(directory, relative), {withFileTypes: true})) {
      const name = path.join(relative, entry.name);
      const filename = path.join(directory, name);
      const stat = await fs.lstat(filename);
      if (stat.isSymbolicLink() || !stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)) throw Error('source_changed');
      if (stat.isDirectory()) pending.push(name);
      else {
        total += stat.size;
        if (files.length >= 20000 || total > 512 * 1048576) throw Error('resource_budget');
        files.push({path: name.split(path.sep).join('/'), bytes: stat.size, sha256: await hashCapabilityFile(filename)});
      }
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

/** Execute no package code or lifecycle scripts during download, extraction or bundling. */
export async function installLockedNpmCapability(options: {
  lock: LockedNpmPackage[];
  stage: string;
  fetcher: PublicFetch;
  signal: AbortSignal;
  assert: () => Promise<void>;
  localNode?: string;
  progress?: (phase: string, packageName?: string) => void;
  onStageCreated?: () => void;
}) {
  const {lock, stage, fetcher, signal} = options;
  const root = lock[0];
  if (!root || root.name !== FILESYSTEM_RECIPE.name || root.version !== FILESYSTEM_RECIPE.version
      || root.integrity !== FILESYSTEM_RECIPE.integrity) throw Error('source_untrusted');
  for (const [index, entry] of lock.entries()) {
    if (entry.engines.node && !satisfies(NODE_RECIPE.version, entry.engines.node)) throw Error('unsupported_runtime');
    if (['preinstall', 'install', 'postinstall'].some(key => entry.scripts[key])) throw Error('install_scripts_require_review');
    if (index !== 0 && !PERMISSIVE_LICENSES.has(entry.license)) throw Error('license_requires_review');
  }
  const licenseEvidence: {package: string; version: string; license: string; files: {path: string; sha256: string}[]}[] = [];
  await fs.mkdir(stage, {recursive: false});
  options.onStageCreated?.();
  const archives = path.join(stage, '.archives');
  await fs.mkdir(archives);
  try {
    const free = await fs.statfs(stage);
    if (Number(free.bavail) * Number(free.bsize) < 768 * 1048576) throw Error('no_space');
    for (let index = 0; index < lock.length; index++) {
      const entry = lock[index];
      await options.assert();
      signal.throwIfAborted();
      options.progress?.('downloading', entry.name);
      const bytes = await fetcher(entry.tarball, signal, 32 * 1048576, 'application/octet-stream');
      await verifyNpmIntegrity(bytes, entry.integrity);
      await options.assert();
      const archive = path.join(archives, index + '.tgz');
      await fs.writeFile(archive, bytes, {flag: 'wx'});
      const destination = path.resolve(stage, entry.path);
      if (!containsPath(stage, destination)) throw Error('archive_invalid');
      await fs.mkdir(path.dirname(destination), {recursive: true});
      await extractCapabilityPackage(archive, destination, signal);
      const metadata = JSON.parse(await fs.readFile(path.join(destination, 'package.json'), 'utf8')) as Record<string, unknown>;
      if (npmManifestHash(metadata) !== entry.manifestHash) throw Error('source_changed');
      const licenses = [];
      for (const file of await fs.readdir(destination)) {
        if (!licenseName.test(file)) continue;
        const filename = path.join(destination, file);
        const stat = await fs.lstat(filename);
        if (!stat.isFile() || stat.size < 32 || stat.size > 512 * 1024) throw Error('license_requires_review');
        licenses.push({path: entry.path + '/' + file, sha256: digest(await fs.readFile(filename))});
      }
      if (index === 0) {
        const license = await fetcher(FILESYSTEM_RECIPE.licenseUrl, signal, 512 * 1024, 'text/plain');
        if (digest(license) !== FILESYSTEM_RECIPE.licenseHash) throw Error('source_changed');
        await fs.writeFile(path.join(destination, 'SOURCE-LICENSE.txt'), license, {flag: 'wx'});
        licenses.push({path: entry.path + '/SOURCE-LICENSE.txt', sha256: digest(license)});
      }
      if (!licenses.length) throw Error('license_requires_review');
      licenseEvidence.push({package: entry.name, version: entry.version, license: index === 0 ? FILESYSTEM_RECIPE.license : entry.license, files: licenses});
      await fs.unlink(archive);
    }
    await fs.rmdir(archives);
    options.progress?.('preparing_runtime');
    await prepareManagedNode({directory: stage, fetcher, signal, assert: options.assert, localNode: options.localNode});
    await options.assert();
    options.progress?.('bundling');
    // Invoke the package's documented main export. Its CLI entrypoint realpath
    // probe traverses Windows ancestors that the zero-capability container cannot list.
    const bundled = await build({absWorkingDir: stage,
      stdin: {contents: `import {main} from './${FILESYSTEM_RECIPE.entry}'; await main();`, resolveDir: stage, loader: 'js'}, bundle: true,
      platform: 'node', format: 'esm', target: 'node24', write: false, metafile: true, logLevel: 'silent',
      banner: {js: 'import {createRequire as __eduCreateRequire} from "node:module";const require=__eduCreateRequire(import.meta.url);'}});
    for (const reference of Object.keys(bundled.metafile!.inputs)) {
      if (reference !== '<stdin>' && !containsPath(stage, path.resolve(stage, reference))) throw Error('source_changed');
    }
    if (bundled.outputFiles.length !== 1 || bundled.outputFiles[0].contents.length > 32 * 1048576) throw Error('resource_budget');
    await fs.writeFile(path.join(stage, 'server.mjs'), bundled.outputFiles[0].contents, {flag: 'wx'});
    await fs.copyFile(path.join(stage, 'package/package.json'), path.join(stage, 'package.json'), fs.constants.COPYFILE_EXCL);
    await fs.writeFile(path.join(stage, 'dependency-lock.json'), JSON.stringify({schemaVersion: 1, packages: lock, licenseEvidence}, null, 2), {flag: 'wx'});
    await options.assert();
    const files = await capabilityPackageFiles(stage);
    return {files, licenseEvidence, installedBytes: files.reduce((sum, entry) => sum + entry.bytes, 0)};
  } catch (error) {
    options.progress?.(signal.aborted ? 'cancelled' : 'failed');
    throw error;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

export async function buildCoreToolManifest() {
  const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const reference = 'src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json';
  const output = path.join(desktop, reference);
  if (!fs.existsSync(output)) fs.writeFileSync(output, JSON.stringify({schemaVersion: 1, sourceHash: '0'.repeat(64), sources: []}));
  const result = await build({absWorkingDir: desktop, entryPoints: ['src/main/xiaozhi-agent/production-host.ts'],
    bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', write: false, metafile: true, logLevel: 'silent'});
  const inputs = [...new Set([...Object.keys(result.metafile.inputs).map(file => file.replace(/ with \{.*\}$/u, ''))
    .filter(file => file !== reference), 'package-lock.json'])].sort();
  const sources = inputs.map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(path.resolve(desktop, file))).digest('hex')}));
  const sourceHash = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
  const manifest = {schemaVersion: 1, sourceHash, sources};
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildCoreToolManifest();
  console.log(JSON.stringify({coreToolSourceHash: manifest.sourceHash, sources: manifest.sources.length}));
}

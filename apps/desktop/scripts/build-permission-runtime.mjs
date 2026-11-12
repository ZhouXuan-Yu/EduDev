import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function buildPermissionRuntime() {
  const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = path.join(desktop, 'src/main/xiaozhi-agent/permissions/windows');
  const generated = path.join(source, 'generated');
  const manifestFile = path.join(generated, 'sandbox-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const sourceFiles = ['NativeSandbox.cs', 'PlatformInfo.cs'].map(file => ({file, sha256: sha256(fs.readFileSync(path.join(source, file)))}));
  const sourceHash = sha256(JSON.stringify(sourceFiles));
  const adapterFiles = ['windows/launcher.ts', 'windows/projection.ts', 'windows/operations.ts', 'windows/broker.ts',
    'windows/runtime.ts', 'current.ts', 'engine.ts', 'resources.ts', 'summary.ts', 'tool-runtime.ts', '../tools/terminal.ts']
    .map(file => ({file, sha256: sha256(fs.readFileSync(path.join(source, '..', file)))}));
  const adapterSourceSha256 = sha256(JSON.stringify(adapterFiles));
  const pins = fs.readFileSync(path.join(source, 'TrustedRuntimes.cs'));
  const executable = path.join(generated, 'xiaozhi-sandbox.exe');
  const unchanged = manifest.sourceSha256 === sourceHash && manifest.pinsSourceSha256 === sha256(pins)
    && fs.existsSync(executable) && manifest.helperSha256 === sha256(fs.readFileSync(executable));
  if (unchanged) {
    const next = {...manifest, adapterFiles, adapterSourceSha256};
    if (JSON.stringify(next) !== JSON.stringify(manifest)) fs.writeFileSync(manifestFile, JSON.stringify(next, null, 2) + '\n');
    return {manifest: next, generated, source, reused: true};
  }
  if (process.platform !== 'win32' || !fs.existsSync(manifest.compilerPath)) throw Error('Permission runtime rebuild requires the verified Windows Framework compiler');
  const arguments_ = ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/checked+', '/warn:4',
    '/out:' + executable, ...sourceFiles.map(entry => path.join(source, entry.file)), path.join(source, 'TrustedRuntimes.cs')];
  const compiled = spawnSync(manifest.compilerPath, arguments_, {windowsHide: true, cwd: source, encoding: 'utf8', timeout: 30000, maxBuffer: 1048576});
  if (compiled.error || compiled.status !== 0) throw Error('Permission runtime compilation failed\n' + (compiled.stdout || '') + (compiled.stderr || ''));
  const bytes = fs.readFileSync(executable);
  const next = {...manifest, sourceFiles, sourceSha256: sourceHash, adapterFiles, adapterSourceSha256, pinsSourceSha256: sha256(pins),
    helperSha256: sha256(bytes), helperBytes: bytes.length, buildTime: new Date().toISOString()};
  fs.writeFileSync(manifestFile, JSON.stringify(next, null, 2) + '\n');
  return {manifest: next, generated, source, reused: false};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = buildPermissionRuntime();
  console.log(JSON.stringify({permissionRuntime: built.manifest.helperSha256, bytes: built.manifest.helperBytes, reused: built.reused}));
}

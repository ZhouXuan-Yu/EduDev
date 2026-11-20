import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fingerprint, sha256} from './evidence.mjs';
import {buildNativeStatArtifact} from '../build-capability-artifacts.mjs';
import {buildPermissionRuntime} from '../build-permission-runtime.mjs';

const task = process.argv[2];
if (!/^harness-[a-z0-9-]+$/.test(task || '')) throw Error('Owned task name required');

const desktop = path.resolve(import.meta.dirname, '../..');
if (process.cwd() !== desktop) throw Error('Run the isolated build from apps/desktop');
const repo = path.resolve(desktop, '../..');
const root = path.join(desktop, 'test-results/goal', task);
const product = path.join(root, 'build-isolated');
fs.mkdirSync(root, {recursive:true});
if (fs.existsSync(product)) throw Error('Refuse to overwrite build evidence');

const git = (...args) => execFileSync('git', args, {cwd:repo, encoding:'utf8', maxBuffer:4 * 1024 * 1024});
const commit = git('rev-parse', 'HEAD').trim();
const sourceScope = [
  'apps/desktop/src', 'apps/desktop/scripts', 'apps/desktop/electron.vite.config.ts',
  'apps/desktop/package.json', 'apps/desktop/package-lock.json', 'third_party/openhanako/LICENSE',
];
const trackedFiles = () => git('ls-files', '-z', '--', ...sourceScope).split('\0').filter(Boolean);
// Prepare the same generated manifests used by the original Vite config before freezing inputs.
await buildNativeStatArtifact();
buildPermissionRuntime();
const trackedBefore = trackedFiles();
if (trackedBefore.length === 0) throw Error('Build source inventory is empty');

const digest = file => sha256(fs.readFileSync(file));
const before = trackedBefore.map(relative => {
  const file = path.join(repo, relative);
  return {file, sha256:digest(file)};
});
const config = path.join(root, 'build.config.ts');
const importPath = name => JSON.stringify(name.replaceAll('\\','/'));
fs.writeFileSync(config, [
  'import original from ' + importPath(path.join(desktop, 'electron.vite.config.ts')),
  'const out = ' + importPath(product),
  'export default async (env: any) => {',
  '  const settings = typeof original === "function" ? await original(env) : await original;',
  '  const result = {...settings};',
  '  for (const target of ["main", "preload", "renderer"] as const) {',
  '    result[target] = {...settings[target], build: {...settings[target]?.build, outDir: out + "/" + target}};',
  '  }',
  '  return result;',
  '};',
].join('\n') + '\n');

const cli = fileURLToPath(new URL('../../node_modules/electron-vite/bin/electron-vite.js',import.meta.url));
const log = fs.openSync(path.join(root, 'isolated-build.log'), 'w');
let exit;
try {
  const child = spawn(process.execPath,[cli,'build','--config',config],{
    cwd:desktop, env:process.env, windowsHide:true, stdio:['ignore',log,log],
  });
  exit = await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
} finally {
  fs.closeSync(log);
}
if (exit !== 0) {
  console.log(JSON.stringify({exit,root}));
  process.exitCode = exit || 1;
} else {
  const after = before.map(row=>({...row,currentSha256:fs.existsSync(row.file)?digest(row.file):null}));
  const sourceUnchanged = commit === git('rev-parse','HEAD').trim()
    && trackedBefore.join('\0') === trackedFiles().join('\0')
    && after.every(row=>row.sha256===row.currentSha256);
  const result = fingerprint(product);
  fs.writeFileSync(path.join(root,'build-isolated.json'),JSON.stringify({
    root:product, commit, sha256:result.sha256, count:result.files.length, exitCode:exit,
    source:after, sourceUnchanged, sourceScope,
  },null,2));
  console.log(JSON.stringify({exit,commit,build:result.sha256,files:result.files.length,sourceUnchanged}));
  if (!sourceUnchanged) process.exitCode = 1;
}

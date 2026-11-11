import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fingerprint} from '../../scripts/acceptance/evidence.mjs';

const desktop = path.resolve(import.meta.dirname,'../..');
const sourceRoot = path.join(desktop,'src');
const file = path.join(import.meta.dirname,'after-inputs.json');
if (process.argv[2] === 'start') {
  const source = fingerprint(sourceRoot);
  fs.writeFileSync(file,JSON.stringify(source,null,2));
  console.log(JSON.stringify({stage:'build inputs',source:source.sha256}));
} else {
  const inputs = JSON.parse(fs.readFileSync(file));
  const current = fingerprint(sourceRoot);
  const before = JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'before-pins.json')));
  const protectedFiles = before.protectedFiles.filter(item=>item.file.startsWith('renderer/'));
  const byPath = new Map(current.files.map(item=>[item.file,item.sha256]));
  const changedProtected = protectedFiles.filter(item=>byPath.get(item.file)!==item.sha256);
  const directory = process.argv[3] || 'after-verified-out';
  if (!/^after-[a-z0-9-]+$/.test(directory)) throw new Error('Invalid owned build directory');
  const buildRoot = path.join(import.meta.dirname,directory);
  const build = fingerprint(buildRoot);
  const pins = {root:desktop,buildRoot,source:current.sha256,build:build.sha256,
    sourceStable:inputs.sha256===current.sha256,protectedFiles:protectedFiles.length,changedProtected};
  fs.writeFileSync(path.join(import.meta.dirname,'after-pins.json'),JSON.stringify(pins,null,2));
  console.log(JSON.stringify(pins));
  assert.equal(pins.sourceStable,true,'Concurrent source change during build');
  assert.equal(changedProtected.length,0,'Protected composer/vendor source changed');
}

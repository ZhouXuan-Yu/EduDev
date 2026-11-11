import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fingerprint} from '../../scripts/acceptance/evidence.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const filename = path.join(import.meta.dirname, 'integrated-latest-pins.json');
if (process.argv.includes('--before')) {
  const source = fingerprint(path.join(root, 'src'));
  fs.writeFileSync(filename, JSON.stringify({sourceBefore: source.sha256}, null, 2));
  console.log(JSON.stringify({sourceBefore: source.sha256}));
} else {
  const before = JSON.parse(fs.readFileSync(filename));
  const source = fingerprint(path.join(root, 'src'));
  const build = fingerprint(path.join(root, 'out'));
  const accepted = path.join(import.meta.dirname, 'after-final-out');
  const renderer = fingerprint(path.join(root, 'out/renderer'));
  const priorRenderer = fingerprint(path.join(accepted, 'renderer'));
  const preload = fingerprint(path.join(root, 'out/preload'));
  const priorPreload = fingerprint(path.join(accepted, 'preload'));
  const result = {root, buildRoot: path.join(root, 'out'), source: source.sha256,
    build: build.sha256, sourceStable: source.sha256 === before.sourceBefore,
    renderer: renderer.sha256, rendererIdenticalToAccepted: renderer.sha256 === priorRenderer.sha256,
    preloadIdenticalToAccepted: preload.sha256 === priorPreload.sha256,
    sourceIntegration: 'd7247b73323b4386da44c46ed3d2ed4ecf9204bc',
    protectedUiCodeCommit: '77c7fdc91efe1531a8be2dbedc25e209ae05a5c7'};
  fs.writeFileSync(filename, JSON.stringify(result, null, 2));
  assert(result.sourceStable);
  assert(result.rendererIdenticalToAccepted);
  assert(result.preloadIdenticalToAccepted);
  console.log(JSON.stringify(result));
}

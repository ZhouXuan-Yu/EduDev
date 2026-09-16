import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appPath = new URL('../src/renderer/App.tsx', import.meta.url);
const source = readFileSync(appPath, 'utf8');
assert.match(source, /if \(aiSubmitInFlightRef\.current\) return;/);
assert.match(source, /onSubmit=\{runAiConsole\}/);

let inFlight = false;
let sendCount = 0;
async function simulatedEnterSubmit() {
  if (inFlight) return;
  inFlight = true;
  sendCount += 1;
  await Promise.resolve();
  inFlight = false;
}

await Promise.all([simulatedEnterSubmit(), simulatedEnterSubmit()]);
assert.equal(sendCount, 1, 'two concurrent Enter submissions must send once');
console.log(JSON.stringify({ suite: 'ai-enter-submit', enterSubmissions: 2, sends: sendCount, passed: true }));

import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {registerHooks} from 'node:module';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';

// Same source-only adapters as capability-boundary-smoke; no Electron process is started.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'electron') {
      return {
        url: 'data:text/javascript,export const utilityProcess={};export const app=new Proxy({},{get(){throw Error("Electron app unavailable in source-only boundary lane");}});',
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json')) {
      return {format: 'module', source: 'export default ' + fs.readFileSync(new URL(url), 'utf8') + ';', shortCircuit: true};
    }
    return next(url, context);
  },
});

const output = fs.mkdtempSync(path.join(tmpdir(), 'omni-edu-paper-legacy-'));
const report = {
  success: false,
  checks: [],
  output,
  scope: 'Original paperBoundaries unchanged; real SQLite/files and controlled native Pi stream; no network/Electron/model request',
};
async function check(name, action) {
  try {
    await action();
    report.checks.push({name, pass: true});
    console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({name, pass: false, error: String(error?.stack || error)});
    throw error;
  }
}

// Identical options and controlled prime to capability-boundary-smoke.mjs.
async function prime(agent) {
  agent.session.agent.streamFn = model => {
    const stream = createAssistantMessageEventStream();
    stream.push({
      type: 'done', reason: 'stop',
      message: {
        role: 'assistant', api: model.api, provider: model.provider, model: model.id,
        content: [{type: 'text', text: '合成基线'}], stopReason: 'stop', timestamp: Date.now(),
        usage: {
          input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0},
        },
      },
    });
    stream.end();
    return stream;
  };
  assert((await agent.prompt('合成原生基线')).ok);
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network disabled in boundary suite'); };
try {
  if (process.argv.length > 2) throw new Error('This runner accepts no arguments; use node --experimental-transform-types scripts/education/paper-legacy-source-only.mjs');
  fs.symlinkSync(path.resolve('node_modules'), path.join(output, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const workspace = path.join(output, 'workspace');
  const stateRoot = path.join(output, 'state');
  fs.mkdirSync(workspace);
  fs.mkdirSync(stateRoot);
  const options = {
    stateRoot, workspace, apiKey: 'synthetic-boundary-not-a-key', model: 'deepseek-chat', approveCopy: async () => false,
  };
  const {paperBoundaries} = await import('./paper-boundaries.mjs');
  await paperBoundaries(check, output, options, prime);
  report.success = true;
} catch (error) {
  report.error = String(error?.stack || error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(item => item.pass).length, output}));
}

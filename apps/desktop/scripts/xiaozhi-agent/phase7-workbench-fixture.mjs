import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {_electron as electron} from 'playwright';
import {testMain} from '../acceptance/build-root.mjs';

export async function startWorkbenchFixture(options = {}) {
  const main = testMain(process.cwd());
  // The seed bundles source, while the app runs the selected frozen build.
  const manifest = JSON.parse(fs.readFileSync('src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json', 'utf8'));
  assert(typeof manifest.sourceHash === 'string' && /^[a-f0-9]{64}$/u.test(manifest.sourceHash)
    && fs.readFileSync(main).includes(manifest.sourceHash), 'Workbench seed and selected build have different core provider manifests');
  const prefix = options.background ? 'omni-edu-xiaozhi-phase7-workbench-ui-' : 'xiaozhi-phase7-workbench-ui-';
  const root = options.root || fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep), 'Owned C TEMP fixture only');
  assert(path.basename(root).startsWith(prefix) && /^[A-Za-z0-9]+$/u.test(path.basename(root).slice(prefix.length))
    && !fs.lstatSync(root).isSymbolicLink(), 'Exact owned fixture root');
  const token = randomUUID(), log = [], requests = [], queue = [];
  const output = path.join(root, 'evidence'); fs.mkdirSync(output, {recursive: true});
  let nextReply;
  function holdNextReply(prompt) {
    assert(!nextReply && typeof prompt === 'string' && prompt.length > 0);
    const arrived = Promise.withResolvers();
    const released = Promise.withResolvers();
    nextReply = {prompt, arrived, released};
    return {arrived: arrived.promise, release: released.resolve};
  }
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === '/fixture/control') {
        assert.equal(request.headers['x-fixture-token'], token); let raw = ''; for await (const chunk of request) raw += chunk;
        const value = JSON.parse(raw); assert(Array.isArray(value.tools)); queue.splice(0, queue.length, ...value.tools); response.writeHead(200).end('{}'); return;
      }
      if (request.url === '/v1/models') {request.resume(); response.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text']}]})); return;}
      assert.equal(request.url, '/v1/chat/completions'); let raw = ''; for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw); requests.push(body); fs.writeFileSync(path.join(output, 'model-requests.json'), JSON.stringify(requests, null, 2));
      let tool = queue.shift();
      const lastUser = [...(body.messages || [])].reverse().find(item => item.role === 'user');
      const last = body.messages?.at(-1);
      const userText = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content || '');
      if (!tool && last?.role === 'user' && userText.includes('FIXTURE_PTY'))
        tool = {name: 'exec_command', input: {cmd: "$global:phase7Value=40; Write-Output ('PHASE7_'+'READY')", tty: true, background: true, yield_time_ms: 1000}};
      if (!tool && last?.role === 'user' && userText.includes('继续已批准的文件复制'))
        tool = {name: 'office_copy_file', input: {source: 'source.txt', target: 'legacy-pending.txt'}};
      const base = {id: 'phase7-fixture', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
      response.writeHead(200, {'content-type': 'text/event-stream'}); response.flushHeaders();
      const delayFile = path.join(root, 'stream-delay-ms.txt'), delay = fs.existsSync(delayFile) ? Math.max(0, Math.min(3000, Number(fs.readFileSync(delayFile, 'utf8')) || 0)) : 0;
      const deltas = tool ? [{role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]}]
        : ['已核对合成要求。', '保留原任务与来源。', '请教师检查当前结果。'].map(content => ({role: 'assistant', content}));
      const held = nextReply && userText.includes(nextReply.prompt) && last?.role === 'user' ? nextReply : undefined;
      if (held) nextReply = undefined;
      for (const [index, delta] of deltas.entries()) {
        if (response.destroyed) return;
        response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
        if (index === 0 && held) {
          response.once('close', held.released.resolve);
          held.arrived.resolve();
          await held.released.promise;
          response.removeListener('close', held.released.resolve);
        }
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (!response.destroyed) response.end('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\ndata: [DONE]\n\n');
    } catch (error) {log.push(String(error.stack)); if (!response.headersSent) response.writeHead(500); response.end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port;
  const bundle = path.join(root, 'seed.mjs');
  await build({entryPoints: ['scripts/xiaozhi-agent/phase7-workbench-fixture-seed.ts'], outfile: bundle, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', logLevel: 'warning'});
  fs.copyFileSync('package.json', path.join(root, 'package.json')); if (!fs.existsSync(path.join(root, 'node_modules'))) fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'junction');
  const approvalDetailDelayMs = options.approvalDetailDelayMs ?? 0;
  assert(Number.isInteger(approvalDetailDelayMs) && approvalDetailDelayMs >= 0 && approvalDetailDelayMs <= 5000);
  const delayApprovalDetail = approvalDetailDelayMs ? `
    const handle = ipcMain.handle.bind(ipcMain);
    ipcMain.handle = (channel, original) => handle(channel, channel === 'xiaozhi:workbench-summary'
      ? async (event, query) => {
        if (query?.kind !== 'approval_detail') return original(event, query);
        await new Promise(resolve => setTimeout(resolve, ${approvalDetailDelayMs}));
        try { return await original(event, query); }
        finally { globalThis.phase7ApprovalDetailsSettled = (globalThis.phase7ApprovalDetailsSettled || 0) + 1; }
      }
      : original);
  ` : '';
  const bootstrap = path.join(root, 'bootstrap.cjs');
  fs.writeFileSync(bootstrap, `const fs=require('node:fs');const {app,net,ipcMain}=require('electron');${delayApprovalDetail}app.setPath('userData',${JSON.stringify(path.join(root, 'profile'))});net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin!=='https://api.deepseek.com')throw Error('fixture_external_network_forbidden');return fetch(${JSON.stringify(origin)}+url.pathname,init);};app.whenReady().then(async()=>{try{if(!fs.existsSync(${JSON.stringify(path.join(root, 'FIXTURE_IDS.json'))})){const seed=await import(${JSON.stringify(pathToFileURL(bundle).href)});await seed.seedWorkbenchFixture(${JSON.stringify(root)},${JSON.stringify(origin + '/fixture/control')},${JSON.stringify(token)},${options.capabilityControls === true});}await import(${JSON.stringify(pathToFileURL(main).href)});}catch(error){fs.writeFileSync(${JSON.stringify(path.join(output, 'bootstrap-error.txt'))},String(error.stack));console.error(error);app.exit(1);}});`);
  const env = {...process.env, OMNI_EDU_DATA_ROOT: path.join(root, 'data'), OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: 'synthetic-phase7-loopback', DEEPSEEK_MODEL: 'deepseek-flash'};
  if (options.background) {
    fs.mkdirSync(env.OMNI_EDU_DATA_ROOT, {recursive: true});
    fs.mkdirSync(path.join(root, 'profile'), {recursive: true});
    env.OMNI_EDU_E2E_VISIBLE = '0';
  }
  for (const key of Object.keys(env)) {
    if (key !== 'DEEPSEEK_API_KEY' && /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/iu.test(key)) delete env[key];
  }
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  let application;
  try {
    application = await electron.launch({args: [bootstrap, '--force-device-scale-factor=1'], env, timeout: 180000});
    application.process().stdout?.on('data', bytes => fs.appendFileSync(path.join(output, 'electron.log'), bytes));
    application.process().stderr?.on('data', bytes => fs.appendFileSync(path.join(output, 'electron.log'), bytes));
    const page = await application.firstWindow({timeout: 180000});
    if (options.onPageError) page.on('pageerror', options.onPageError);
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 60000});
    if (options.background) assert.equal(await application.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
    await application.evaluate(({BrowserWindow}, title) => {BrowserWindow.getAllWindows()[0].setTitle(title);}, 'Phase7 Synthetic Workbench · ' + path.basename(root));
    const ids = JSON.parse(fs.readFileSync(path.join(root, 'FIXTURE_IDS.json'), 'utf8'));
    fs.writeFileSync(path.join(root, 'RUNNING.json'), JSON.stringify({root, dataRoot: path.join(root, 'data'), profileRoot: path.join(root, 'profile'), pid: application.process().pid,
      title: 'Phase7 Synthetic Workbench · ' + path.basename(root), modelOrigin: origin, paidCalls: 0, ids: path.join(root, 'FIXTURE_IDS.json')}, null, 2));
    return {root, output, main, application, page, ids, requests, log, holdNextReply,
      scenario: tools => {queue.splice(0, queue.length, ...tools);},
      close: async () => {await application.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(root, 'STOPPED.json'), JSON.stringify({paidCalls: 0, modelCalls: requests.length, errors: log}, null, 2));}};
  } catch (error) {await application?.close().catch(() => {}); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); throw error;}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv[2] === '--stay', 'Use --stay for independent page acceptance');
  assert(process.argv.length === 3 || process.argv.length === 5 && process.argv[3] === '--root', 'Use --stay [--root exact-owned-root]');
  const fixture = await startWorkbenchFixture(process.argv[4] ? {root: path.resolve(process.argv[4])} : {}); console.log(JSON.stringify({ready: true, root: fixture.root, ids: path.join(fixture.root, 'FIXTURE_IDS.json'), pid: fixture.application.process().pid}));
  const stop = path.join(fixture.root, 'STOP');
  if (fs.existsSync(stop)) fs.unlinkSync(stop);
  await new Promise(resolve => {const timer = setInterval(() => {if (fs.existsSync(stop) || fixture.application.process().exitCode !== null) {clearInterval(timer); resolve();}}, 250);});
  await fixture.close().catch(error => {console.error(error); process.exitCode = 1;});
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-extension-'));
const output = path.join(root, 'evidence'); fs.mkdirSync(output);
await build({stdin: {contents: `export {createExtensionService} from './src/main/xiaozhi-agent/extensions/service.ts';
export {createExtensionState} from './src/main/xiaozhi-agent/extensions/state.ts';
export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {createPermissionRuntimeManager} from './src/main/xiaozhi-agent/permissions/windows/runtime.ts';
export {filesystemScope} from './src/main/xiaozhi-agent/permissions/resources.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';`, resolveDir: process.cwd(), loader: 'ts'},
  outfile: path.join(output, 'extension.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24',
  plugins: [{name: 'installed-dependencies', setup(build) {build.onResolve({filter: /^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/},
    args => ({path: import.meta.resolve(args.path), external: true}));}}]});
const api = await import(pathToFileURL(path.join(output, 'extension.mjs')).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const sql = {all: async (query, values = []) => db.prepare(query).all(...values), run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes)};
sql.transaction = async action => {db.exec('BEGIN IMMEDIATE'); try {const result = await action(sql); db.exec('COMMIT'); return result;} catch (error) {db.exec('ROLLBACK'); throw error;}};
const store = api.createPermissionStore(sql); await store.migrate();
let owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'e'.repeat(64), runId: 'run_extension_fixture', generation: 1};
const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
const outside = path.join(root, 'outside-private.txt'); fs.writeFileSync(outside, 'synthetic-only-outside-private');
const manager = api.createPermissionRuntimeManager({root: path.join(root, 'runtime'), store});
const permissions = api.createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => owner,
  archived: async () => false, workspace: async () => ({path: workspace})});
const controller = new AbortController();
const context = {owner: () => owner, signal: controller.signal, workspace, requirementsVersion: () => 1};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async filename => {const hash = createHash('sha256'); for await (const bytes of fs.createReadStream(filename)) hash.update(bytes); return hash.digest('hex');};
const bindings = new Map();
const extensionId = 'owned.extension';
let service = api.createExtensionService({sql, permissions, store, runtime: manager, binding: async manifest => {
  const recipe = bindings.get(manifest.version); assert(recipe); return recipe;
}, timeoutMs: 1000});
const checks = [];
const report = {success: false, root, output, checks, paidCalls: 0, failure: undefined,
  sources: fs.readdirSync('src/main/xiaozhi-agent/extensions').filter(name=>name.endsWith('.ts')).map(name=>({
    path:'src/main/xiaozhi-agent/extensions/'+name,sha256:digest(fs.readFileSync('src/main/xiaozhi-agent/extensions/'+name))})),
  scriptSha256:digest(fs.readFileSync(new URL(import.meta.url))),
  boundary: 'Actual service, original PermissionEngine/Sql CAS, real Windows AppContainer Node Job. Synthetic packages. Host/Pi/UI integration is owned by core.'};
const socketServer = http.createServer((_request, response) => response.end('unexpected socket'));
let connections = 0; socketServer.on('connection', () => connections++);
await new Promise(resolve => socketServer.listen(0, '127.0.0.1', resolve));
const port = socketServer.address().port;
const worker = String.raw`
const fs = require('node:fs');
const readline = require('node:readline');
const net = require('node:net');
const config = JSON.parse(fs.readFileSync(__dirname + '/fixture.json', 'utf8'));
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const respond = (id, result) => send({jsonrpc:'2.0', id, result});
const hostPending = new Map();
readline.createInterface({input:process.stdin}).on('line', async line => {
  const request = JSON.parse(line);
  if (!request.method) {hostPending.get(request.id)?.(request.error?.message); hostPending.delete(request.id); return;}
  if (request.method === 'extensions/health') {
    respond(request.id, {schemaVersion:1,status:'ready',extensionId:config.extensionId,version:config.version,sourceHash:config.sourceHash,hooks:config.hooks}); return;
  }
  const {hook,payload} = request.params;
  if (payload?.mode === 'timeout') return;
  if (payload?.mode === 'wrong_id') {respond('unknown_response', {}); return;}
  if (payload?.mode === 'malformed') {process.stdout.write('{malformed-json\n'); return;}
  if (payload?.mode === 'oversize') {respond(request.id, 'x'.repeat(70000)); return;}
  if (payload?.mode === 'flood') {for(let i=0;i<100;i++) send({jsonrpc:'2.0',method:'extensions/log',params:{schemaVersion:1,level:'info',code:'started'}}); return;}
  if (payload?.mode === 'bad_log') {send({jsonrpc:'2.0',method:'extensions/log',params:{schemaVersion:1,level:'info',code:'synthetic-secret-token'}}); return;}
  if (payload?.mode === 'host') {
    const error = await new Promise(resolve => {hostPending.set('host_1', resolve); send({jsonrpc:'2.0',id:'host_1',method:'host.filesystem.read',params:{path:config.outside}});});
    respond(request.id, {schemaVersion:1,hook,value:{error}}); return;
  }
  if (payload?.mode === 'os') {
    let filesystemDenied = false;
    try {fs.readFileSync(config.outside);} catch(error) {filesystemDenied = ['EACCES','EPERM'].includes(error.code);}
    const socketDenied = await new Promise(resolve => {const socket = net.connect({host:'127.0.0.1',port:config.port});
      const timer = setTimeout(() => {socket.destroy();resolve(true);}, 500);
      socket.on('error', () => {clearTimeout(timer);resolve(true);});socket.on('connect',()=>{clearTimeout(timer);socket.destroy();resolve(false);});});
    respond(request.id,{schemaVersion:1,hook,value:{filesystemDenied,socketDenied}});return;
  }
  send({jsonrpc:'2.0',method:'extensions/log',params:{schemaVersion:1,level:'info',code:'hook_completed'}});
  respond(request.id, {schemaVersion:1,hook,value:hook === 'event.observe' ? null : payload});
});
`;
async function fixture(version, badHealth = false) {
  const directory = path.join(root, 'package-' + version); fs.mkdirSync(directory);
  await fs.promises.copyFile('D:/Node/node.exe', path.join(directory, 'node.exe'));
  const nodeHash = await fileHash(path.join(directory, 'node.exe'));
  assert.equal(nodeHash, '2ffe3acc0458fdde999f50d11809bbe7c9b7ef204dcf17094e325d26ace101d8');
  const sourceHash = digest(worker + version);
  const manifest = {schemaVersion: 1, extensionId, version, source: 'https://example.invalid/owned-extension', sourceHash,
    license: 'MIT', licenseHash: digest('owned MIT fixture'), artifactId: digest(sourceHash + nodeHash), hooks: ['context.transform', 'event.observe']};
  fs.writeFileSync(path.join(directory, 'worker.cjs'), worker);
  fs.writeFileSync(path.join(directory, 'fixture.json'), JSON.stringify({...manifest, version: badHealth ? '0.0.0' : version, outside, port}));
  const files = await Promise.all(['node.exe', 'worker.cjs', 'fixture.json'].map(async name => ({path: name,
    sha256: await fileHash(path.join(directory, name)), bytes: fs.statSync(path.join(directory, name)).size})));
  const binding = {artifactId: manifest.artifactId, version, directory, source: new URL(manifest.source).origin, package: 'owned-extension-fixture',
    packageHash: digest(JSON.stringify(files)), files, executable: {path: path.join(directory, 'node.exe'), sha256: nodeHash, packagePath: 'node.exe'},
    arguments: ['--no-addons', '--preserve-symlinks', '--preserve-symlinks-main', '$PACKAGE/worker.cjs'], workspaceActions: ['read'], limits: {memoryBytes: 536870912,cpuRate: 5000,userTimeMs: 0,leaseMs: 120000,
      maxInputBytes: 4194304,maxOutputBytes: 4194304,maxProcesses: 2}};
  bindings.set(version, binding);
  await store.issue(owner.sessionId, [api.filesystemScope(workspace, ['read']),
    {kind:'process',backend:'appcontainer',executable:binding.executable.path,executableHash:nodeHash,workspace},
    {kind:'dependency',source:binding.source,package:binding.package,version,sha256:binding.packageHash,environment:directory,installScripts:false}],
  {kind:'teacher',reference:'owned-extension-base'});
  return manifest;
}
async function check(name, action) {const start = performance.now(); await action(); checks.push({name,pass:true,durationMs:performance.now()-start});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report,null,2)); console.log('PASS ' + name);}
async function idle() {for(let i=0;i<100 && permissions.engine.activeCount();i++) await new Promise(resolve=>setTimeout(resolve,50)); assert.equal(permissions.engine.activeCount(),0);}
async function open() {return service.open(extensionId, context);}
try {
  const runtimeRecipe = manager.recipe(); await store.issue(owner.sessionId,[runtimeRecipe],{kind:'teacher',reference:'owned-runtime'});
  const request = {schemaVersion:2,owner,requirementsVersion:1,callId:'extension_runtime',action:'environment_repair',inputDigest:api.permissionHash(runtimeRecipe),
    purpose:'合成扩展受控运行时',scopes:[runtimeRecipe],files:[],provider:null,classification:'redacted',expiresAt:new Date(Date.now()+300000).toISOString()};
  await check('Original authorized runtime recipe prepares and validates actual helper',async()=>{
    const prepared=await permissions.engine.run(request,context.signal,authority=>manager.prepare({request,...authority},runtimeRecipe.sha256));
    report.helperHash=prepared.runtime.manifest.helperSha256;
  });
  const v1=await fixture('1.0.0'); const v2=await fixture('2.0.0'); const v3=await fixture('3.0.0',true);
  await check('Base process/filesystem/dependency grants cannot authorize Extension install',async()=>{
    await assert.rejects(service.install(v1,0,context),/permission_pending/); assert.equal((await service.view(extensionId)).revision,0); await idle();
  });
  const extensionGrants=await store.issue(owner.sessionId,[v1,v2,v3].map(manifest=>({kind:'extension',extensionId,sourceHash:manifest.sourceHash,actions:['install','run']})),
    {kind:'teacher',reference:'owned-extension-specific'});
  let view;
  await check('Isolated health installs immutable versions and CAS-selects an active version',async()=>{
    view=await service.install(v1,0,context); assert.equal(view.enabled,false); view=await service.select(extensionId,'1.0.0',view.revision,context); await idle();
  });
  await check('Actual Node hooks return Unicode and public event acknowledgement with bounded code-only logs',async()=>{
    const session=await open(); try {assert.deepEqual(await session.invoke('context.transform',{text:'教师上下文🙂'}),{text:'教师上下文🙂'});
      assert.equal(await session.invoke('event.observe',{type:'turn.complete'}),null); assert.equal(session.logs()[0].code,'hook_completed');
      await assert.rejects(session.invoke('tools.register',{}),/unsupported_extension_hook/);
    }finally{await session.close();}await idle();
  });
  await check('Failed isolated health leaves the selected version and CAS revision intact',async()=>{
    await assert.rejects(service.install(v3,view.revision,context),/extension_health_failed/);
    assert.deepEqual(await service.view(extensionId),view);await idle();
  });
  await check('Source byte drift and unsupported manifest hooks reject before launching a guest',async()=>{
    await assert.rejects(service.install({...v1,hooks:['tools.register']},view.revision,context),/invalid_input/);
    const filename=path.join(bindings.get('1.0.0').directory,'worker.cjs');const original=fs.readFileSync(filename);
    fs.appendFileSync(filename,'\n// owned source drift');try{await assert.rejects(open(),/source_changed/);}finally{fs.writeFileSync(filename,original);}await idle();
  });
  await check('Real AppContainer denies outside filesystem and loopback socket; guest host RPC is unsupported',async()=>{
    const session=await open();try {assert.deepEqual(await session.invoke('context.transform',{mode:'os'}),{filesystemDenied:true,socketDenied:true});
      assert.deepEqual(await session.invoke('context.transform',{mode:'host'}),{error:'unsupported_host_method'});assert.equal(connections,0);
    }finally{await session.close();}await idle();
  });
  for(const mode of ['wrong_id','malformed','oversize','flood','bad_log','timeout']) await check('Protocol fail-closed and exact cleanup for '+mode,async()=>{
    const session=await open();try{await assert.rejects(session.invoke('context.transform',{mode}),/extension_/);}finally{await session.close();}await idle();
  });
  await check('Oversize caller payload rejects before dispatch and session remains usable',async()=>{
    const session=await open();try{await assert.rejects(session.invoke('context.transform',{text:'x'.repeat(70000)}),/extension_message_limit/);
      assert.deepEqual(await session.invoke('context.transform',{after:'rejection'}),{after:'rejection'});}finally{await session.close();}await idle();
  });
  await check('Disable interrupts in-flight request and preserves disabled state after service reconstruction',async()=>{
    const session=await open();const pending=session.invoke('context.transform',{mode:'timeout'});const settled=assert.rejects(pending,/extension_/);
    view=await service.disable(extensionId,view.revision);await settled;await session.close();await idle();
    await service.dispose();service=api.createExtensionService({sql,permissions,store,runtime:manager,binding:async manifest=>bindings.get(manifest.version),timeoutMs:1000});
    assert.equal((await service.view(extensionId)).enabled,false);await assert.rejects(open(),/extension_disabled/);
  });
  await check('Version upgrade and explicit rollback retain immutable readback and reject stale revision/source changes',async()=>{
    view=await service.install(v2,view.revision,context);view=await service.select(extensionId,'2.0.0',view.revision,context);
    assert.equal(view.activeVersion,'2.0.0');view=await service.select(extensionId,'1.0.0',view.revision,context);assert.equal(view.activeVersion,'1.0.0');
    await assert.rejects(service.disable(extensionId,view.revision-1),/extension_revision_conflict/);
    await assert.rejects(service.install({...v1,sourceHash:'b'.repeat(64)},view.revision,context),/source_changed/);await idle();
  });
  await check('Per-call cancellation closes the whole guest service and original leases',async()=>{
    const session=await open();const cancel=new AbortController();const pending=session.invoke('context.transform',{mode:'timeout'},cancel.signal);
    const settled=assert.rejects(pending,/extension_/);cancel.abort('owned-cancel');await settled;await session.close();await idle();
  });
  await check('Original Extension Grant revoke terminates an idle guest without a later invocation',async()=>{
    const session=await open();await permissions.engine.revoke(owner.sessionId,extensionGrants[0].grantId,extensionGrants[0].revision);await idle();
    await assert.rejects(session.invoke('context.transform',{}),/extension_|permission/);await session.close();
  });
  await check('Version revoke persists and blocks future selection',async()=>{
    view=await service.revoke(extensionId,'1.0.0',view.revision);assert.equal(view.enabled,false);
    await assert.rejects(service.select(extensionId,'1.0.0',view.revision,context),/extension_unavailable/);
    view=await service.select(extensionId,'2.0.0',view.revision,context);
  });
  await check('Owner generation invalidation stops an idle process and clears all original leases',async()=>{
    const session=await open();owner={...owner,generation:2};await idle();await assert.rejects(session.invoke('context.transform',{}),/extension_|permission/);await session.close();
  });
  await check('Every actual native receipt has zero Job children, removed profile, and zero owned ACEs',async()=>{
    const rows=await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");assert(rows.length>=15);
    report.receipts=rows.map(row=>JSON.parse(row.metadata_json).result);
    for(const receipt of report.receipts){assert.equal(receipt.cleanup.jobActiveProcesses,0);assert.equal(receipt.cleanup.profileRemoved,true);assert.equal(receipt.cleanup.remainingOwnedAces,0);}
    assert(!JSON.stringify(await service.list()).includes('synthetic-secret-token'));report.nativeExecutions=rows.length;
  });
  report.success=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{await service.dispose();await new Promise(resolve=>socketServer.close(resolve));db.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:checks.length,root,output,failure:report.failure}));}

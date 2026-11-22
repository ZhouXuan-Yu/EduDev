import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createCapabilityRegistry} from '../../src/main/xiaozhi-agent/capabilities/registry.ts';
import {nativeStatDeclarations, createNativeStatService} from '../../src/main/xiaozhi-agent/capabilities/native-stat.ts';
import {createCapabilityResolver} from '../../src/main/xiaozhi-agent/capabilities/resolver.ts';
import {createAdapterRegistry} from '../../src/main/xiaozhi-agent/capabilities/adapters/registry.ts';
import {registerCoreAdapters, CORE_ADAPTER_VERSION, nativeStatAdapterSchemas} from '../../src/main/xiaozhi-agent/capabilities/adapters/core.ts';
import {ADAPTER_CONTRACT} from '../../src/main/xiaozhi-agent/capabilities/adapters/contract.ts';
import {adapterIsolation} from '../../src/main/xiaozhi-agent/capabilities/adapters/security.ts';
import {providerResult} from '../../src/main/xiaozhi-agent/capabilities/provider-contract.ts';
import {providerDefinition} from '../../src/main/xiaozhi-agent/capabilities/provider-instances.ts';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation.ts';

const root = mkdtempSync(path.join(tmpdir(), 'xiaozhi-d1-'));
const database = path.join(root, 'fixture.db');
const source = nativeStatDeclarations()[0];
const checks = [];
let db;
function open(file) {
  db = new DatabaseSync(file);
  const sql = {
    run: async (query, args = []) => db.prepare(query).run(...args),
    change: async (query, args = []) => db.prepare(query).run(...args).changes,
    all: async (query, args = []) => db.prepare(query).all(...args),
    transaction: async action => {
      db.exec('BEGIN IMMEDIATE');
      try {const value = await action(sql); db.exec('COMMIT'); return value;}
      catch (error) {db.exec('ROLLBACK'); throw error;}
    },
  };
  return createCapabilityRegistry(sql, {officialProviderIds: [source.provider.id, 'edu.native.education-d1']});
}
async function check(name, fn) {
  await fn(); checks.push(name); console.log('PASS ' + name);
}
function capability(name) {
  return {...structuredClone(source.definition), id: 'edu.document.' + name, name,
    requirements: {required: [{id:'read', description:'verified document result'}], optional: [], conditional: []},
    inputSchemaRef: 'fixture:' + name + ':input', outputSchemaRef: 'fixture:' + name + ':output'};
}
function binding(def, provider, supported = true) {
  return {...structuredClone(source.binding), capabilityId: def.id, providerId: provider.id, providerVersion: provider.version,
    providerHash: provider.source.packageHash, conformance:{...structuredClone(source.binding.conformance), capabilityId:def.id,
      level: supported ? 'full' : 'incompatible', limitations:supported ? [] : ['missing_probe'],
      evidence:[{requirementId:'read', supported, kind:'automated_test', reference:'d1:test:' + def.id}]}};
}
const native = {...structuredClone(source.provider), id:'edu.native.education-d1'};
const mcp = {...structuredClone(source.provider), id:'mcp.fixture.pdf_reader', type:'mcp', runtime:'isolated',
  publisher:{id:'fixture', official:false}, permissions:['workspace.file.read'], toolRefs:['read_pdf']};
const pdf = capability('pdf-body'), ocr = capability('ocr'), table = capability('table');
function requirement(def) {
  return {capabilityId:def.id, contractVersion:def.contractVersion, required:[], optional:[], conditions:[],
    localOnly:true, platform:process.platform, budget:{latencyMs:30000, resourceUnits:1}};
}
function input(id, mode = 'enabled', health = 'ready') {
  return {id, configurationRef:'config.'+id, connectionRef:'connection.'+id, authorityRef:'authority.'+id, state:mode, health};
}

try {
  let registry = open(database);
  await check('D1-001/017 old Registry and business data survive additive idempotent migration', async () => {
    db.exec('CREATE TABLE xiaozhi_capability_registry_v1(id INTEGER PRIMARY KEY,revision INTEGER,document_json TEXT,document_hash TEXT)');
    db.exec("CREATE TABLE original_tasks(id TEXT PRIMARY KEY,status TEXT); INSERT INTO original_tasks VALUES('task-original','completed')");
    const doc = {revision:7, definitions:[source.definition], providers:[source.provider], bindings:[source.binding]};
    db.prepare('INSERT INTO xiaozhi_capability_registry_v1 VALUES(1,?,?,?)').run(7, JSON.stringify(doc), protocolHash(doc));
    const old = db.prepare('SELECT * FROM xiaozhi_capability_registry_v1').get();
    await registry.migrate(); await registry.migrate();
    assert.deepEqual(await registry.snapshot(), doc);
    assert.deepEqual(db.prepare('SELECT * FROM xiaozhi_capability_registry_v1').get(), old);
    assert.equal(db.prepare("SELECT status FROM original_tasks WHERE id='task-original'").get().status,'completed');
    assert.equal((await registry.providerInstances(source.provider.id))[0].id,'default');
    assert(await registry.providerVersion(source.provider.id, source.provider.version, source.definition.id));
  });

  await check('D1-002/004/005/006 real SQLite runs PDF Native+MCP and PDF/OCR/table edges independently', async () => {
    for (const def of [pdf,ocr,table]) await registry.registerDefinition(def);
    for (const provider of [native,mcp]) {
      await registry.registerProviderDefinition(providerDefinition(provider), {
        health:provider.health, cost:provider.cost, availableDependencies:provider.dependencies.filter(item=>item.available).map(item=>item.id),
      });
    }
    assert.equal((await registry.snapshot()).bindings.filter(item=>item.capabilityId===pdf.id).length,0);
    for (const def of [pdf,ocr,table]) await registry.registerBinding(binding(def,native,def!==ocr));
    await registry.registerBinding(binding(pdf,mcp));
    const seen = (await registry.providerDefinitions()).find(item=>item.id===native.id);
    assert.equal(seen.adapterId,'edu.adapter.native'); assert.equal(Object.hasOwn(seen,'health'),false);
    assert.equal((await registry.snapshot()).definitions.filter(item=>item.id===pdf.id).length,1);
    assert.equal((await registry.snapshot()).bindings.filter(item=>item.providerId===native.id).length,3);
    const resolver=createCapabilityResolver(registry,async()=>true);
    const choices=await resolver.resolve(requirement(pdf));
    assert.deepEqual(new Set([...choices.selectedProviders,...choices.alternatives].map(row=>row.providerId)),new Set([native.id,mcp.id]));
    assert.equal((await registry.verifyBinding(ocr.id,native.id)).verified,false);
    assert.equal((await resolver.resolve(requirement(ocr))).selectedProviders.length,0);
    assert.equal((await resolver.resolve(requirement(table))).selectedProviders[0].providerId,native.id);
    await assert.rejects(registry.registerBinding({...binding(pdf,mcp),contractVersion:'2.0.0',
      conformance:{...binding(pdf,mcp).conformance,contractVersion:'2.0.0'}}),/contract_mismatch/);
    await registry.setBindingState(pdf.id,mcp.id,'disabled');
    assert.equal((await registry.verifyBinding(pdf.id,mcp.id)).state,'disabled');
    assert.equal((await resolver.resolve(requirement(pdf))).selectedProviders[0].providerId,native.id);
    await registry.setBindingState(pdf.id,mcp.id,'enabled');
    await registry.setBindingState(ocr.id,native.id,'revoked');
    assert.equal((await registry.verifyBinding(ocr.id,native.id)).state,'revoked');
    assert.equal((await registry.verifyBinding(table.id,native.id)).verified,true);
  });

  await check('D1-003 two instances retain separate config, connection, authority and health after reopen', async () => {
    const first=await registry.putProviderInstance(native.id,input('alpha'),0);
    const second=await registry.putProviderInstance(native.id,input('beta','disabled','unavailable'),0);
    assert.notEqual(first.configurationRef,second.configurationRef);
    assert.notEqual(first.connectionRef,second.connectionRef);
    assert.notEqual(first.authorityRef,second.authorityRef);
    await registry.executionBinding(table.id,native.id,native.version,native.source.packageHash,'alpha');
    await assert.rejects(registry.executionBinding(table.id,native.id,native.version,native.source.packageHash,'beta'),/provider_unavailable/);
    await assert.rejects(registry.putProviderInstance(native.id,input('alpha'),0),/instance_conflict/);
    const after=await registry.putProviderInstance(native.id,input('alpha','revoked','revoked'),1);
    db.close(); registry=open(database); await registry.migrate();
    assert.deepEqual((await registry.providerInstances(native.id)).filter(item=>item.id!=='default'),[after,second]);
    await assert.rejects(registry.putProviderInstance(native.id,input('alpha'),2),/capability_revoked/);
  });

  await check('D1-004 version change preserves the archive and needs fresh evidence for each edge', async () => {
    const next={...native,version:'2.0.0',source:{...native.source,packageHash:'a'.repeat(64)}};
    await registry.register(pdf,next,binding(pdf,next));
    assert((await registry.providerVersion(native.id,native.version,table.id))?.binding.enabled);
    assert.equal((await registry.verifyBinding(table.id,native.id)).state,'needs_review');
    await assert.rejects(registry.executionBinding(table.id,native.id,native.version,native.source.packageHash),/provider_unavailable/);
    const reviewed=binding(table,next);
    reviewed.conformance.evidence[0].reference='d1:test:reviewed-v2';
    await registry.registerBinding(reviewed);
    assert.equal((await registry.verifyBinding(table.id,native.id)).evidence[0].reference,'d1:test:reviewed-v2');
    await assert.rejects(registry.registerBinding(binding(ocr,next)),/capability_revoked/);
    assert.equal((await registry.verifyBinding(pdf.id,native.id)).verified,true);
  });

  const core = createAdapterRegistry();
  const version = CORE_ADAPTER_VERSION;
  const coreId = 'edu.adapter.native';
  const ctx = {taskId:'task_d1',sessionId:'aisession_00000000-0000-0000-0000-000000000007',runId:'run_d1',generation:1,
    stepId:null,callId:'core_registered',signal:new AbortController().signal,
    snapshot:{schema:'xiaozhi.capability-snapshot.v1',snapshotId:'snap_d1',capabilityId:source.definition.id,registryRevision:3,
      selection:{providerId:source.provider.id,providerVersion:source.provider.version,contractVersion:source.definition.contractVersion,level:'full',missingRequirements:[]},
      providerHash:source.provider.source.packageHash}, grantRef:'granted-by-host',idempotencyKey:'case-d1',budget:{timeoutMs:3000,resourceUnits:1}};
  const file = 'fixture.txt';
  writeFileSync(path.join(root,file),'D1 synthetic teaching data');
  const target = await registry.executionBinding(source.definition.id,source.provider.id,source.provider.version,source.provider.source.packageHash);
  const service = createNativeStatService({registry,resolveWorkspace:async()=>({path:root,label:'fixture',version:'fixture'}),
    isCurrent:()=>true});
  const options = {context:ctx,input:{path:file},schemas:nativeStatAdapterSchemas,authorize:async()=>{},
    connect:async scoped=>({execute:async value=>providerResult(scoped,
      await service.execute(scoped,source.provider.id,requirement(source.definition),value))})};

  await check('D1-007/008/009 official registered adapter executes original Native Provider and validates full envelope', async () => {
    await registerCoreAdapters(core,coreId);
    assert.equal(core.find(coreId,version).isolation.tier,'T0');
    assert(core.list().some(entry=>entry.id===coreId));
    const result=await core.execute(target,version,options);
    assert.equal(result.status,'completed'); assert.equal(result.data.path,file); assert.equal(result.data.size,26);
    await assert.rejects(core.execute(target,version,{...options,input:{path:file,unknown:true}}),/invalid_input/);
    await assert.rejects(core.execute(target,version,{...options,connect:async scoped=>({execute:async()=>({
      ...providerResult(scoped,{status:'completed',data:{path:file,size:0,version:'a'.repeat(64)}}),data:{lying:true}
    })})}),/invalid_output/);
  });

  await check('D1-010/011 Host attestation gates state transitions, disconnects and rejects retired adapters', async () => {
    const candidate={id:'community.teaching-fixture',version:'1.0.0',kind:'community',contractVersion:ADAPTER_CONTRACT,
      transport:'extension_rpc',publisher:'local-import',artifactHash:'a'.repeat(64)};
    const controlled=createAdapterRegistry();
    assert.equal(controlled.register(candidate).state,'discovered');
    assert.throws(()=>controlled.transition(candidate.id,candidate.version,'activated'),/adapter_transition/);
    assert.throws(()=>controlled.transition(candidate.id,candidate.version,'validated'),/adapter_unverified/);
    await assert.rejects(controlled.admit(candidate,async()=>false),/adapter_unverified/);
    assert.throws(()=>controlled.register({...candidate,artifactHash:'b'.repeat(64)}),/version_conflict/);
    assert.throws(()=>controlled.register({...candidate,tier:'T0'}),/invalid_adapter/);
    const unsupported=createAdapterRegistry({platform:'linux'});
    await assert.rejects(unsupported.admit(candidate,async()=>true),/permission_denied/);
    assert.equal(unsupported.find(candidate.id,candidate.version).state,'registered');
    if (process.platform==='win32') {
      assert.equal((await controlled.admit(candidate,async()=>true)).state,'available');
      controlled.transition(candidate.id,candidate.version,'suspended');
      assert.equal(controlled.find(candidate.id,candidate.version).state,'suspended');
      await controlled.admit(candidate,async()=>true);
      controlled.transition(candidate.id,candidate.version,'revoked');
      await assert.rejects(controlled.admit(candidate,async()=>true),/capability_revoked/);
      controlled.transition(candidate.id,candidate.version,'uninstalled');
      assert.equal(controlled.find(candidate.id,candidate.version),null);
    }
    let entered, closed=0;
    const started=new Promise(resolve=>{entered=resolve;});
    const pending=core.execute(target,version,{...options,connect:async scoped=>({
      execute:()=>new Promise((_resolve,reject)=>{
        scoped.signal.addEventListener('abort',()=>reject(scoped.signal.reason),{once:true});
        entered();
      }),
      close:async()=>{closed++;},
    })});
    const cancelled=assert.rejects(pending,/cancelled/);
    await started;
    core.transition(coreId,version,'suspended');
    await cancelled;
    assert.equal(closed,1);
    await assert.rejects(core.execute(target,version,options),/provider_unavailable/);
    core.transition(coreId,version,'revoked');
    core.transition(coreId,version,'uninstalled');
  });

  await check('D1-012/013 Developer ceilings run before user authority and before new connections', async () => {
    const audit=[];
    const governed=createAdapterRegistry({audit:async(_context,id,code)=>{audit.push([id,code]);}});
    await registerCoreAdapters(governed,coreId);
    let authorized=0, connected=0;
    const permissive={...options,authorize:async()=>{authorized++;},connect:async()=>{connected++;throw Error('unreachable');}};
    await assert.rejects(governed.execute({...target,provider:{...target.provider,permissions:['workspace.file.write']}},version,permissive),/permission_denied/);
    assert.equal(authorized,0); assert.equal(connected,0);
    await assert.rejects(governed.execute(target,version,{...permissive,authorize:async()=>{throw Error('permission_denied');}}),/permission_denied/);
    assert.equal(connected,0); assert.deepEqual(audit,[[coreId,'permission_denied'],[coreId,'permission_denied']]);
    assert.equal(adapterIsolation({kind:'core',transport:'worker'},process.platform).isolation,'process');
    assert.equal(adapterIsolation({kind:'community',transport:'extension_rpc'},'linux').tier,'T3');
    assert.equal(adapterIsolation({kind:'community',transport:'extension_rpc'},'win32').tier,'T2');
    assert.equal((await createCapabilityResolver(registry,async()=>false).resolve(requirement(pdf))).selectedProviders.length,0);
  });

  await check('D1-017 corrupt legacy hash diagnoses failure without publishing write-side tables', async () => {
    db.close(); registry=open(path.join(root,'bad.db'));
    db.exec("CREATE TABLE xiaozhi_capability_registry_v1(id INTEGER PRIMARY KEY,revision INTEGER,document_json TEXT,document_hash TEXT); INSERT INTO xiaozhi_capability_registry_v1 VALUES(1,2,'{}','invalid')");
    await assert.rejects(registry.migrate(),/registry_corrupt/);
    assert.equal(db.prepare('SELECT revision FROM xiaozhi_capability_registry_v1').get().revision,2);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='xiaozhi_capability_provider_instances_v1'").get(),undefined);
  });
} catch(error) {
  console.error(error.stack); process.exitCode=1;
} finally {
  db?.close();
  const report={checks,passed:checks.length,root,ok:!process.exitCode};
  writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}

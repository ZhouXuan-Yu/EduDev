import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import sqlite3 from 'sqlite3';
const {createCapabilityRegistry} = await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {createCapabilityResolver,selectEligibleProvider} = await import('../../src/main/xiaozhi-agent/capabilities/resolver.ts');
const {nativeStatDeclarations,NATIVE_STAT_PROVIDER_IDS,NATIVE_STAT_CAPABILITY,createNativeStatService,registerNativeStatProviders} = await import('../../src/main/xiaozhi-agent/capabilities/native-stat.ts');
const {validCapabilityDefinition,validProviderManifest,validCapabilityBinding,validCapabilityConformance,validCapabilityRequirement,validCapabilityResolution} = await import('../../src/main/xiaozhi-agent/capabilities/validation.ts');
const {serializeStateWrites} = await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {createHanaOfficeTools} = await import('../../src/main/office-agent/hana-tool-adapter.ts');
const {fileVersion} = await import('../../src/main/xiaozhi-agent/workspace-files.ts');

const output = fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-capability-phase1-'));
const checks = [];
const connections = new Set();
const request = () => ({capabilityId:NATIVE_STAT_CAPABILITY.id,contractVersion:'1.0.0',required:[],optional:[],conditions:[],localOnly:true,platform:process.platform,budget:{latencyMs:30000,resourceUnits:1}});
async function open(filename = ':memory:') {
  const db = await new Promise((resolve,reject) => { const connection = new sqlite3.Database(filename,error => error ? reject(error) : resolve(connection)); });
  connections.add(db);
  const sql = {
    run:(query,values=[]) => new Promise((resolve,reject) => db.run(query,values,error => error ? reject(error) : resolve(undefined))),
    change:(query,values=[]) => new Promise((resolve,reject) => db.run(query,values,function(error) { error ? reject(error) : resolve(this.changes); })),
    all:(query,values=[]) => new Promise((resolve,reject) => db.all(query,values,(error,rows) => error ? reject(error) : resolve(rows))),
  };
  sql.transaction = async action => {
    await sql.run('BEGIN IMMEDIATE');
    try { const result = await action(sql); await sql.run('COMMIT'); return result; }
    catch(error) { await sql.run('ROLLBACK'); throw error; }
  };
  const shared = serializeStateWrites(sql);
  const registry = createCapabilityRegistry(shared,{officialProviderIds:NATIVE_STAT_PROVIDER_IDS});
  await registry.migrate();
  await registerNativeStatProviders(registry);
  return {registry,sql:shared,db};
}
async function close(db) {
  await new Promise((resolve,reject) => db.close(error => error ? reject(error) : resolve()));
  connections.delete(db);
}
async function check(name,action) {
  await action(); checks.push({name,pass:true}); console.log('PASS '+name);
}
async function update(registry,index,action) {
  const snapshot = await registry.snapshot();
  const provider = snapshot.providers.find(item => item.id === NATIVE_STAT_PROVIDER_IDS[index]);
  const binding = snapshot.bindings.find(item => item.providerId === provider.id);
  const definition = snapshot.definitions[0];
  action({provider,binding,definition});
  return registry.register(definition,provider,binding);
}
const noNetwork = globalThis.fetch;
globalThis.fetch = async () => { throw Error('Network forbidden in Phase1 suite'); };
const report = {success:false,checks,output,boundaries:['Phase1 main-only pilot, no Dispatcher or dynamic Pi refresh','Synthetic local files, no real provider/model requests']};
try {
  await check('C01 strict five protocol objects reject extra fields and official impersonation',async () => {
    const {definition,provider,binding} = nativeStatDeclarations()[0];
    for (const [value,validate] of [[definition,validCapabilityDefinition],[provider,validProviderManifest],[binding,validCapabilityBinding],[binding.conformance,validCapabilityConformance],[request(),validCapabilityRequirement]]) {
      assert(validate(value)); assert(!validate({...value,credentials:'secret'}));
    }
    assert(!validCapabilityDefinition({...definition,id:'edu.read'}));
    assert(validCapabilityDefinition({...definition,id:'edu.question.extract'}));
    assert(!validProviderManifest({...provider,type:'mcp'}));
    assert(!validProviderManifest({...provider,publisher:{id:'outsider',official:true}}));
    const {sql} = await open();
    const registry = createCapabilityRegistry(sql);
    await assert.rejects(registry.register(definition,provider,binding),/source_untrusted/);
  });
  await check('C02 real SQLite binds both production Native implementations, idempotent migration and startup',async () => {
    const {registry} = await open(); const before = await registry.snapshot();
    assert.equal(before.providers.length,2); assert.equal(before.bindings.length,2); assert.equal(before.definitions.length,1);
    await registry.migrate(); await registerNativeStatProviders(registry);
    assert.deepEqual(await registry.snapshot(),before);
    const resolution = await createCapabilityResolver(registry,async () => true).resolve(request());
    assert(validCapabilityResolution(resolution)); assert.equal(resolution.selectedProviders.length+resolution.alternatives.length,2);
  });
  await check('C03 missing Required and self-declared evidence are hard exclusions',async () => {
    const {registry} = await open();
    await update(registry,0,({binding}) => binding.conformance.evidence = []);
    await update(registry,1,({binding}) => binding.conformance.evidence[0].kind='self_declared');
    const result = await createCapabilityResolver(registry,async () => true).resolve(request());
    assert.equal(result.status,'no_compatible_provider'); assert(result.excludedProviders.every(item => item.reasons.includes('missing_required')));
  });
  await check('C04 R06 optional gaps disclosed and conformance recomputed from evidence',async () => {
    const {registry} = await open();
    const result = await createCapabilityResolver(registry,async () => true).resolve({...request(),optional:['thumbnail']});
    assert.equal(result.status,'partial'); assert(result.selectedProviders[0].missingRequirements.includes('mime')); assert(result.acceptedLimitations.includes('missing:thumbnail'));
  });
  await check('C05 triggered Conditional excludes the actual workspace Provider and selects actual Hana',async () => {
    const {registry} = await open();
    const result = await createCapabilityResolver(registry,async () => true).resolve({...request(),conditions:['require_mime']});
    assert.equal(result.selectedProviders[0].providerId,NATIVE_STAT_PROVIDER_IDS[0]);
    assert(result.excludedProviders.some(item => item.providerId===NATIVE_STAT_PROVIDER_IDS[1] && item.reasons.includes('missing_conditional')));
  });
  await check('C06 incompatible Contract is blocked at registration and resolution',async () => {
    const {registry} = await open();
    await assert.rejects(update(registry,0,({binding}) => { binding.contractVersion='2.0.0'; binding.conformance.contractVersion='2.0.0'; }),/contract_mismatch/);
    const result = await createCapabilityResolver(registry,async () => true).resolve({...request(),contractVersion:'2.0.0'});
    assert.equal(result.selectedProviders.length,0); assert(result.excludedProviders.every(item => item.reasons.includes('contract_mismatch')));
  });
  await check('G1-F01 published Definition is immutable across provider registration',async () => {
    const {registry} = await open();
    const before=await registry.snapshot();
    const external=nativeStatDeclarations()[0];
    external.provider={...external.provider,id:'mcp.outsider.stat',type:'mcp',runtime:'managed',publisher:{id:'outsider',official:false}};
    external.binding={...external.binding,providerId:external.provider.id,conformance:{...external.binding.conformance,evidence:[]}};
    for(const change of [definition=>definition.requirements.required=[],definition=>definition.inputSchemaRef='external#input',definition=>definition.outputSchemaRef='external#output',definition=>definition.contractVersion='2.0.0']){
      const changed=structuredClone(external);change(changed.definition);
      await assert.rejects(registry.register(changed.definition,changed.provider,changed.binding),/definition_immutable/);
      assert.deepEqual(await registry.snapshot(),before);
    }
    await registry.register(external.definition,external.provider,external.binding);
    const result=await createCapabilityResolver(registry,async()=>true).resolve(request());
    assert(result.excludedProviders.some(item=>item.providerId===external.provider.id&&item.reasons.includes('missing_required')));
    assert.equal(result.selectedProviders.length+result.alternatives.length,2);
    assert.deepEqual((await registry.snapshot()).definitions,before.definitions);
  });
  await check('G1-F02 Provider type locks namespace while external Binding retains core Capability mapping',async () => {
    const {registry}=await open();
    const declaration=nativeStatDeclarations()[0];
    const impostor={...declaration.provider,type:'mcp',runtime:'managed',publisher:{id:'outsider',official:false}};
    assert(!validProviderManifest(impostor));
    await assert.rejects(registry.register(declaration.definition,impostor,declaration.binding),/invalid_metadata/);
    const external={...impostor,id:'mcp.outsider.file-stat'};
    assert(validProviderManifest(external));
    const binding={...declaration.binding,providerId:external.id};
    await registry.register(declaration.definition,external,binding);
    const result=await createCapabilityResolver(registry,async()=>true).resolve(request());
    assert([...result.selectedProviders,...result.alternatives].some(item=>item.providerId===external.id));
    for(const type of ['mcp','extension','remote','skill'])assert(!validProviderManifest({...impostor,type}));
  });
  await check('C07 manifest hash mismatch and persisted JSON tampering fail closed',async () => {
    const {registry,sql} = await open();
    await assert.rejects(update(registry,0,({binding}) => binding.providerHash='0'.repeat(64)),/contract_mismatch/);
    await sql.run("UPDATE xiaozhi_capability_registry_v1 SET document_json=replace(document_json,'ready','revoked') WHERE id=1");
    await assert.rejects(registry.snapshot(),/registry_corrupt/);
  });
  await check('C08 revocation persists through restart and rejects stale re-registration',async () => {
    const filename = path.join(output,'restart.sqlite');
    let state = await open(filename); await state.registry.revokeProvider(NATIVE_STAT_PROVIDER_IDS[0]); const revision = (await state.registry.snapshot()).revision;
    await close(state.db); state = await open(filename);
    assert.equal((await state.registry.snapshot()).revision,revision);
    const declaration = nativeStatDeclarations()[0];
    await assert.rejects(state.registry.register(declaration.definition,declaration.provider,declaration.binding),/capability_revoked/);
    const result = await createCapabilityResolver(state.registry,async () => true).resolve(request());
    assert(result.excludedProviders[0].reasons.includes('provider_revoked')); assert.equal(result.selectedProviders[0].providerId,NATIVE_STAT_PROVIDER_IDS[1]);
  });
  await check('revoked Capability cannot be resurrected by startup',async () => {
    const {registry} = await open(); await registry.revokeCapability(NATIVE_STAT_CAPABILITY.id); await registerNativeStatProviders(registry);
    const result = await createCapabilityResolver(registry,async () => true).resolve(request());
    assert.equal(result.selectedProviders.length,0); assert(result.excludedProviders.every(item => item.reasons.includes('capability_revoked')));
  });
  await check('R01 R02 R03 denied pinned Provider stays outside AI eligible set',async () => {
    const {registry} = await open(); await update(registry,0,({binding}) => binding.userPinned=true);
    const result = await createCapabilityResolver(registry,async provider => provider.id!==NATIVE_STAT_PROVIDER_IDS[0]).resolve(request());
    assert.equal(result.selectedProviders[0].providerId,NATIVE_STAT_PROVIDER_IDS[1]);
    assert.throws(() => selectEligibleProvider(result,NATIVE_STAT_PROVIDER_IDS[0]),/selection_ineligible/);
    assert.throws(() => selectEligibleProvider(result,'extension.bad.provider'),/selection_ineligible/);
    assert.equal(selectEligibleProvider(result,NATIVE_STAT_PROVIDER_IDS[1]).providerId,NATIVE_STAT_PROVIDER_IDS[1]);
  });
  await check('permission callback failures fail closed with structured blocked reasons',async () => {
    const {registry} = await open();
    const result = await createCapabilityResolver(registry,async () => { throw Error('private-secret'); }).resolve(request());
    assert.equal(result.status,'blocked_permission'); assert.deepEqual(result.blockedReasons,['permission_denied']); assert(!JSON.stringify(result).includes('private-secret'));
  });
  for (const [name,change,reason] of [
    ['source',({provider}) => provider.source.verification='failed','source_unverified'],
    ['platform',({provider}) => provider.platforms=['unsupported'],'platform_incompatible'],
    ['dependency',({provider}) => provider.dependencies=[{id:'local-engine',available:false}],'missing_dependency'],
    ['health',({provider}) => provider.health='degraded','unhealthy'],
    ['local residency',({provider}) => provider.locality='remote','data_residency'],
    ['budget',({provider}) => provider.cost.resourceUnits=2,'budget_exceeded'],
    ['disabled',({binding}) => binding.enabled=false,'disabled'],
  ]) await check('hard exclusion '+name+' overrides pinning',async () => {
    const {registry} = await open(); await update(registry,0,value => {value.binding.userPinned=true;change(value);});
    const result = await createCapabilityResolver(registry,async () => true).resolve(request());
    assert.equal(result.selectedProviders[0].providerId,NATIVE_STAT_PROVIDER_IDS[1]); assert(result.excludedProviders[0].reasons.includes(reason));
  });
  await check('registry CAS serializes concurrent writes and rejects stale expected revision',async () => {
    const {registry} = await open(); const before = await registry.snapshot();
    const results = await Promise.allSettled([registry.revokeProvider(NATIVE_STAT_PROVIDER_IDS[0],before.revision),registry.revokeProvider(NATIVE_STAT_PROVIDER_IDS[1],before.revision)]);
    assert.equal(results.filter(item => item.status==='fulfilled').length,1); assert.equal((await registry.snapshot()).revision,before.revision+1);
  });
  await check('reviewed Native package update refreshes source hash while preserving disabled preference',async () => {
    const {registry} = await open();
    await update(registry,0,({provider,binding}) => {provider.version='1.1.0';binding.providerVersion=provider.version;provider.source.packageHash='f'.repeat(64);binding.providerHash=provider.source.packageHash;provider.health='disabled';binding.enabled=false;binding.userPinned=true;});
    const before=await registry.snapshot();await registerNativeStatProviders(registry);const after=await registry.snapshot();
    assert.equal(after.revision,before.revision+1);assert.equal(after.providers[0].source.packageHash,nativeStatDeclarations()[0].provider.source.packageHash);
    assert.equal(after.providers[0].health,'disabled');assert.equal(after.bindings[0].enabled,false);assert.equal(after.bindings[0].userPinned,true);
  });
  await check('revocation during asynchronous permission check invalidates the old resolution',async () => {
    const {registry} = await open(); let revoked=false;
    await assert.rejects(createCapabilityResolver(registry,async () => { if(!revoked){revoked=true;await registry.revokeProvider(NATIVE_STAT_PROVIDER_IDS[0]);} return true; }).resolve(request()),/registry_changed/);
  });
  await check('missing Capability and missing Provider explain the next blocked state',async () => {
    const {registry} = await open();
    const result = await createCapabilityResolver(registry,async () => true).resolve({...request(),capabilityId:'edu.workspace.other.read'});
    assert.equal(result.status,'missing'); assert.deepEqual(result.blockedReasons,['capability_missing']);
  });
  await check('metadata accessors are rejected before execution',async () => {
    const {registry} = await open(); let accesses=0;
    const evil=Object.defineProperty(request(),'capabilityId',{get(){accesses++;return NATIVE_STAT_CAPABILITY.id;},enumerable:true});
    await assert.rejects(createCapabilityResolver(registry,async () => true).resolve(evil),/invalid_input/); assert.equal(accesses,0);
  });
  const {registry} = await open();
  const workspace = path.join(output,'workspace'); fs.mkdirSync(workspace); fs.writeFileSync(path.join(workspace,'资料.txt'),'synthetic metadata'); fs.writeFileSync(path.join(workspace,'.env'),'PRIVATE');
  const sessionId='aisession_'+randomUUID(); let granted=true,current=true,leaseVersion='a'.repeat(64);
  const service=createNativeStatService({registry,resolveWorkspace:async id => {assert.equal(id,sessionId);if(!granted)throw Error('permission_denied');return{path:workspace,label:'合成目录',version:leaseVersion};},isCurrent:() => current});
  const context=() => ({sessionId,runId:'synthetic-run',callId:randomUUID(),signal:new AbortController().signal});
  await check('two real Native adapters inspect the same file with identical common Contract',async () => {
    const results=[];
    for(const providerId of NATIVE_STAT_PROVIDER_IDS){const result=await service.execute(context(),providerId,request(),{path:'资料.txt'});assert(['completed','partial'].includes(result.status),JSON.stringify(result));results.push(result);}
    assert.equal(results[0].data.size,fs.statSync(path.join(workspace,'资料.txt')).size);assert.equal(results[0].data.version,results[1].data.version);assert.equal(results[0].data.path,results[1].data.path);
    assert(results[0].data.mime);assert.equal(results[1].data.mime,undefined);assert(results[1].conformance.missingRequirements.includes('mime'));
  });
  await check('P01 original Hana tool retains original schema and result',async () => {
    const tool=createHanaOfficeTools({workspace,sessionId,runId:'native',networkAllowed:false,fileVersion});
    const result=await tool.execute('office_file_stat',randomUUID(),{path:'资料.txt'});
    assert(result.success);assert.equal(result.tool,'office_file_stat');assert.equal(result.data.version,fileVersion(fs.statSync(path.join(workspace,'资料.txt'))));assert.equal(result.data.source,'资料.txt');
  });
  await check('Native cancellation, run fencing and main grant override caller authorized flag',async () => {
    const abort=new AbortController();abort.abort();assert.equal((await service.execute({...context(),signal:abort.signal},NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt'})).status,'cancelled');
    current=false;assert.equal((await service.execute({...context(),authorized:true},NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt'})).error.code,'permission_denied');current=true;
    granted=false;assert.equal((await service.execute(context(),NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt'})).status,'failed');granted=true;
    assert.equal((await service.execute(context(),NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt',authorized:true})).error.code,'invalid_input');
  });
  await check('Native traversal, secrets, invalid paths, missing files and folders return safe failures',async () => {
    for(const providerId of NATIVE_STAT_PROVIDER_IDS)for(const file of ['../outside.txt','C:/private','.env','missing.txt','.']){
      const result=await service.execute(context(),providerId,request(),{path:file});assert.equal(result.status,'failed');assert(!JSON.stringify(result).includes(workspace));assert(!JSON.stringify(result).includes('PRIVATE'));
    }
  });
  await check('Native source substitution is hard excluded against trusted executable declarations',async () => {
    const fixture = await open();
    await assert.rejects(update(fixture.registry,0,({provider}) => provider.source.reference='extension/foreign/stat'),/provider_version_immutable/);
    await update(fixture.registry,0,({provider}) => provider.source.verification='failed');
    const native=createNativeStatService({registry:fixture.registry,resolveWorkspace:async () => ({path:workspace,label:'合成',version:leaseVersion}),isCurrent:() => true});
    const result=await native.resolve(sessionId,request());
    assert(result.excludedProviders.some(item => item.providerId===NATIVE_STAT_PROVIDER_IDS[0] && item.reasons.includes('source_unverified')));
    assert.equal((await native.execute(context(),NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt'})).status,'failed');
  });
  await check('Native provider revocation blocks a previously resolved selection',async () => {
    const old=await service.resolve(sessionId,request());assert(old.selectedProviders.some(item => item.providerId===NATIVE_STAT_PROVIDER_IDS[1]));
    await registry.revokeProvider(NATIVE_STAT_PROVIDER_IDS[1]);
    assert.equal((await service.execute(context(),NATIVE_STAT_PROVIDER_IDS[1],request(),{path:'资料.txt'})).status,'failed');
  });
  await check('real SQLite readback contains references and zero schemas, body or credentials',async () => {
    const raw=JSON.stringify(await registry.snapshot());assert(!raw.includes('inputSchema"'));assert(!raw.includes('PRIVATE'));assert(!raw.includes('synthetic metadata'));assert(!raw.includes(workspace));
  });
  const start=performance.now();for(let index=0;index<100;index++)await service.resolve(sessionId,request());
  const resolutionTotalMs=performance.now()-start;
  const original=createHanaOfficeTools({workspace,sessionId,runId:'performance',networkAllowed:false,fileVersion});
  const directSamples=[],adapterSamples=[];
  for(let index=0;index<50;index++){
    let begin=performance.now();
    assert((await original.execute('office_file_stat',randomUUID(),{path:'资料.txt'})).success);
    directSamples.push(performance.now()-begin);
    begin=performance.now();
    assert(['completed','partial'].includes((await service.execute(context(),NATIVE_STAT_PROVIDER_IDS[0],request(),{path:'资料.txt'})).status));
    adapterSamples.push(performance.now()-begin);
  }
  const timing=samples=>({samples:samples.length,meanMs:samples.reduce((sum,value)=>sum+value,0)/samples.length,p95Ms:[...samples].sort((a,b)=>a-b)[Math.ceil(samples.length*0.95)-1]});
  report.performance={resolution:{samples:100,totalMs:resolutionTotalMs,meanMs:resolutionTotalMs/100},originalNative:timing(directSamples),adaptedNative:timing(adapterSamples),comparison:'Same synthetic file, interleaved direct original Native and Phase1 adapter with real SQLite resolution. Existing named tool path unchanged. No rendered/provider latency comparison.'};
  report.success=true;console.log(JSON.stringify({success:true,passed:checks.length,performance:report.performance,output}));
} catch(error) {
  report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;
} finally {
  globalThis.fetch=noNetwork;
  for(const db of [...connections])await close(db);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
}

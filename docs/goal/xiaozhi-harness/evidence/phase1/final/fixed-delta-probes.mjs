import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='D:/WorkProject/EduProject-harness/apps/desktop';
await import(pathToFileURL(root+'/scripts/office-agent/register-source.mjs'));
const require=createRequire(root+'/package.json');
const sqlite3=require('sqlite3');
const {createCapabilityRegistry}=await import(pathToFileURL(root+'/src/main/xiaozhi-agent/capabilities/registry.ts'));
const {createCapabilityResolver}=await import(pathToFileURL(root+'/src/main/xiaozhi-agent/capabilities/resolver.ts'));
const {nativeStatDeclarations,NATIVE_STAT_PROVIDER_IDS,registerNativeStatProviders}=await import(pathToFileURL(root+'/src/main/xiaozhi-agent/capabilities/native-stat.ts'));
const {serializeStateWrites}=await import(pathToFileURL(root+'/src/main/xiaozhi-agent/serialized-state-sql.ts'));
const {validProviderManifest,protocolHash}=await import(pathToFileURL(root+'/src/main/xiaozhi-agent/capabilities/validation.ts'));
const output=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
const checks=[];const observations=[];
const filename=path.join(output,'fixed-registry.sqlite');
async function open(){
 const db=await new Promise((resolve,reject)=>{const conn=new sqlite3.Database(filename,error=>error?reject(error):resolve(conn));});
 const sql={run:(query,values=[])=>new Promise((resolve,reject)=>db.run(query,values,error=>error?reject(error):resolve())),change:(query,values=[])=>new Promise((resolve,reject)=>db.run(query,values,function(error){error?reject(error):resolve(this.changes);})),all:(query,values=[])=>new Promise((resolve,reject)=>db.all(query,values,(error,rows)=>error?reject(error):resolve(rows)))};
 sql.transaction=async action=>{await sql.run('BEGIN IMMEDIATE');try{const r=await action(sql);await sql.run('COMMIT');return r;}catch(e){await sql.run('ROLLBACK');throw e;}};
 const registry=createCapabilityRegistry(serializeStateWrites(sql),{officialProviderIds:NATIVE_STAT_PROVIDER_IDS});await registry.migrate();return{db,sql,registry};
}
const first=await open();
try{
 await registerNativeStatProviders(first.registry);
 const baseline=await first.registry.snapshot();
 for(const field of ['required','inputSchemaRef','outputSchemaRef','contractVersion']){
  const d=nativeStatDeclarations()[0];
  if(field==='required')d.definition.requirements.required=[];
  else if(field==='contractVersion'){d.definition.contractVersion='2.0.0';d.binding.contractVersion='2.0.0';d.binding.conformance.contractVersion='2.0.0';}
  else d.definition[field]='foreign.ts#changed';
  await assert.rejects(first.registry.register(d.definition,d.provider,d.binding));
  assert.deepEqual(await first.registry.snapshot(),baseline);
  checks.push('Registry rejects '+field+' contract replacement without changing revision or Definition');
 }
 for(const type of ['mcp','extension']){
  const bad=nativeStatDeclarations()[0].provider;bad.type=type;bad.runtime='managed';bad.publisher={id:'outsider',official:false};
  assert.equal(validProviderManifest(bad),false);
  checks.push(type+' Provider cannot occupy edu.native built-in namespace');
 }
 const external=nativeStatDeclarations()[0];external.provider.id='mcp.outsider.stat';external.provider.type='mcp';external.provider.publisher={id:'outsider',official:false};external.provider.runtime='managed';external.binding.providerId=external.provider.id;external.binding.conformance.evidence=[];external.binding.conformance.level='incompatible';
 assert(validProviderManifest(external.provider));
 await first.registry.register(external.definition,external.provider,external.binding);
 assert.equal((await first.registry.snapshot()).providers.length,3);
 checks.push('External Provider with its own namespace may bind unchanged core Capability');
 const request={capabilityId:external.definition.id,contractVersion:'1.0.0',required:[],optional:[],conditions:[],localOnly:true,platform:process.platform,budget:{latencyMs:30000,resourceUnits:1}};
 const resolution=await createCapabilityResolver(first.registry,async()=>true).resolve(request);
 assert(resolution.excludedProviders.some(item=>item.providerId===external.provider.id&&item.reasons.includes('missing_required')));
 assert(![...resolution.selectedProviders,...resolution.alternatives].some(item=>item.providerId===external.provider.id));
 checks.push('Empty-evidence external Binding remains hard-excluded for missing Required');
 await registerNativeStatProviders(first.registry);
 assert.deepEqual((await first.registry.snapshot()).definitions,baseline.definitions);
 checks.push('Idempotent native startup preserves published Definition after external Binding registration');
 const report={success:true,checks,sourceHead:'4e8873065f6c4b0e30cd8b403668c5a08f63ad40',scope:'Independent Gate1 fixed-delta assertions on real SQLite, zero model calls'};
 fs.writeFileSync(path.join(output,'fixed-probe-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,passed:checks.length,checks},null,2));
}finally{await new Promise((resolve,reject)=>first.db.close(error=>error?reject(error):resolve()));}

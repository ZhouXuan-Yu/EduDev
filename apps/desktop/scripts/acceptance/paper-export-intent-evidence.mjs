/** D1 QA only: read-only observations and pure assertions. No product mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sha256} from './evidence.mjs';

export const budget=Object.freeze({successSends:1,competitionSends:1,retries:0,actualFiles:1});
export const successSpec=Object.freeze({kind:'teacher',audience:'teacher',format:'docx',template:'paper'});
export const competitionSpec=Object.freeze({kind:'student',audience:'student',format:'pdf',template:'paper'});
export const terminal=turn=>!!turn&&['completed','failed','interrupted'].includes(turn.status);
// Optional top-level bindings can legitimately be absent on both sides. Preserve
// undefined as absence; do not coerce it to null or weaken the existing JSON comparison.
const jsonComparable=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
export const jsonEqual=(actual,expected,label)=>assert.deepEqual(jsonComparable(actual),jsonComparable(expected),label);

export async function until(predicate,label,timeout=30000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) {
    const value=await predicate();
    if(value===true)return;
    assert.equal(value,false,'D1 readiness must resolve to a boolean: '+label);
    await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(1,end-Date.now()))));
  }
  throw new Error('D1 timeout: '+label);
}
export function readPort(dbPath) {
  return (sql,args=[])=>{
    assert(/^SELECT\b/i.test(sql),'D1 QA database port is SELECT-only');
    const db=new DatabaseSync(dbPath,{readOnly:true});
    try{return db.prepare(sql).all(...args);}finally{db.close();}
  };
}
export function assertIntentIdentity(intent,paper,spec,validate) {
  assert(intent&&typeof intent==='object'&&!Array.isArray(intent),'Actual typed paperExportIntent is required');
  const keys=Object.keys(intent);
  assert(keys.every(key=>['schemaVersion','paperId','digest','audience','format','template'].includes(key)),'Unexpected intent payload');
  assert.equal(typeof intent.schemaVersion,'string');assert(intent.schemaVersion.length>0&&intent.schemaVersion.length<=128);
  if(validate)assert.equal(validate(intent),true,'Actual production intent validator rejected the UI binding');
  jsonEqual({paperId:intent.paperId,digest:intent.digest,audience:intent.audience,format:intent.format,template:intent.template??'paper'},
    {paperId:paper.id,digest:paper.digest,audience:spec.audience,format:spec.format,template:spec.template??'paper'},'UI text and exact paper/spec binding differ');
}
/** Only inspect the owned session's composer record; never write localStorage. */
export async function observeDraft(page,sessionId) {
  const result=await page.evaluate(id=>{
    const records=Object.keys(localStorage).filter(key=>/^xiaozhi\.composer-draft\.v\d+:/.test(key)&&key.endsWith(':'+id))
      .map(key=>({key,value:JSON.parse(localStorage.getItem(key)||'null')})).filter(row=>row.value);
    const root=[...document.querySelectorAll('.office-composer-container')].find(node=>node.getAttribute('data-session-id')===id&&node.getClientRects().length);
    const input=root?.querySelector('[data-testid="office-prompt-input"]');
    return {records,visible:!!input,text:input?.value};
  },sessionId);
  assert(result.records.length<=1,'Multiple owned saved composer drafts');
  if(!result.records.length)return {visible:result.visible,pending:true,storedRecords:[]};
  const {key,value}=result.records[0];
  assert.equal(typeof value.text,'string');
  return {key,text:value.text,paperExportIntent:value.paperExportIntent,visible:result.visible,pending:result.visible&&result.text!==value.text,storedRecords:result.records};
}
export function publicDraft(draft) {
  return {key:draft.key,textSha256:sha256(draft.text),paperExportIntent:draft.paperExportIntent};
}
export function deliveryFacts(read) {
  return {artifacts:read('SELECT * FROM document_artifacts ORDER BY id'),
    lineage:read('SELECT * FROM document_artifact_paper_sources ORDER BY artifact_id'),
    genericSources:read('SELECT * FROM document_artifact_sources ORDER BY artifact_id')};
}
export function readOutputGrants(read,owner) {
  return {workspaces:read('SELECT * FROM xiaozhi_pi_workspaces WHERE conversation_id=?',[owner]),
    paperOutputs:read('SELECT * FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[owner])};
}
export function assertOwnOutput(grants,workspace) {
  assert.equal(grants.paperOutputs.length,1,'An actual persisted output grant is required; a display label is insufficient');
  const expected=fs.realpathSync(workspace);
  for(const row of [...grants.workspaces,...grants.paperOutputs])assert.equal(fs.realpathSync(row.path),expected,'Every persisted binding must name this exact OWN directory');
}
export function assertOutputCanceled(before,after) {
  for(const key of ['owner','paper','basket','page','grants','drafts','commands','model','deliveries','files']) {
    assert(Object.hasOwn(before,key)&&Object.hasOwn(after,key),'Missing cancel observation: '+key);
    jsonEqual(after[key],before[key],'Canceled explicit chooser changed '+key);
  }
}
/** Current D1 start validates the exact source BEFORE claimCommand/model/run.
 * Verify that explicit UI rejection; never infer success from any failed run. */
export function assertCompetitionRefused({snapshot,paperA,paperB,beforeFacts,afterFacts,files,beforeModel,afterModel,commands,seedBefore,seedAfter,notice,expectedNotice}) {
  assert.equal(paperA.exportCurrent,false,'A must actually be superseded');
  assert.equal(paperB.exportCurrent,true,'B must actually be the current confirmed paper');
  assert.notEqual(paperA.id,paperB.id);assert.notEqual(paperA.digest,paperB.digest);
  assert.equal(snapshot.running,false);
  assert.equal(typeof expectedNotice,'string');assert(expectedNotice.length>0);assert.equal(notice,expectedNotice,'Require the actual host conflict notice, not an assistant/provider error');
  assert.deepEqual(commands,[],'Pre-admission stale intent must not claim a command');
  assert.deepEqual(snapshot.projection.turns,[],'Pre-admission stale intent must not create a turn');
  assert.deepEqual(snapshot.officeArtifacts??[],[],'Stale intent must not create an Office draft from A or B');
  jsonEqual(afterModel,beforeModel,'Competition called a model or created a run/message');
  jsonEqual(seedAfter,seedBefore,'Rejected send must keep the original text and binding');
  jsonEqual(afterFacts,beforeFacts,'Competition published or changed delivery/source facts');
  assert.deepEqual(files,[],'Competition wrote a file');
  return {stage:'production-start-exact-source-preflight',admitted:false,runId:null,modelCalls:0,refusal:notice,draftRetained:true};
}
/** Reuse the independent reader's per-file verifier, preserving its old SIX gate. */
export async function readSingleFile({file,expectations,workspace,output,python}) {
  fs.mkdirSync(output,{recursive:true});
  const manifest=path.join(output,'manifest.json'),report=path.join(output,'readback.json');
  assert(!fs.existsSync(report)&&!fs.existsSync(manifest),'Refusing to overwrite readback evidence');
  fs.writeFileSync(manifest,JSON.stringify({schemaVersion:'u4d1.single-file-readback.v1',workspace:fs.realpathSync(workspace),file:{...file,...expectations}},null,2),{flag:'wx'});
  const verifier=fileURLToPath(new URL('./paper-instance-export-readback.py',import.meta.url));
  const code=`import sys, json, pathlib, importlib.util\nsys.dont_write_bytecode=True\nspec=importlib.util.spec_from_file_location('existing_office_readback',sys.argv[1])\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nsource=pathlib.Path(sys.argv[2]);target=pathlib.Path(sys.argv[3]);v=json.loads(source.read_text(encoding='utf-8'))\nassert v['schemaVersion']=='u4d1.single-file-readback.v1'\nr={'scope':'independent-D1-single-file-XML-readback','success':False,'productAcceptance':False,'manifestSha256':m.sha(source.read_bytes())}\ntry:\n r['file']=m.verify_file(v['file'],pathlib.Path(v['workspace']).resolve(strict=True),target.parent,False);r['success']=True\nexcept Exception as e:\n r['error']=str(e);raise\nfinally:\n target.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')\n`;
  await promisify(execFile)(python,['-c',code,verifier,manifest,report],{windowsHide:true,timeout:60000,maxBuffer:1024*1024});
  const result=JSON.parse(fs.readFileSync(report,'utf8'));assert.equal(result.success,true);return result;
}

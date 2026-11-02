/** Read-only diagnosis/regression against a preserved failed Office attempt.
 * No app, build, model, authorization changes or product acceptance claim.
 * The public snapshot below is source-shaped; the actual facts are SQLite,
 * profile identity trace, files and the original report, clearly kept separate.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {fingerprint,sha256} from './evidence.mjs';
import {ledger} from './paper-basket-ui-driver.mjs';
import {readFreshOfficeSession,assertFreshOfficeSession} from './paper-instance-office-fixture-ui.mjs';
import {conversationOutputLocation} from '../../src/main/xiaozhi-agent/conversation-output-path.ts';
import {authorizedWorkspace} from '../../src/main/xiaozhi-agent/workspace-authority.ts';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const argument=process.argv.slice(2);
assert.equal(argument.length,1,'Use --attempt=test-results/ui-goal-paper-instance-office-live-<id>');
assert(argument[0].startsWith('--attempt='));
const attempt=fs.realpathSync(path.resolve(desktop,argument[0].slice(10)));
assert.equal(path.dirname(attempt),fs.realpathSync(path.join(desktop,'test-results')));
assert(/^ui-goal-paper-instance-office-live-[\w-]+$/.test(path.basename(attempt)));
const before=fingerprint(attempt),failed=JSON.parse(fs.readFileSync(path.join(attempt,'report.json'),'utf8'));
assert.equal(failed.success,false);assert.equal(failed.checks.length,0);
assert.match(failed.error.message,/Fresh session must have no bound original workspace/);
const source=fs.realpathSync(failed.original),sourceBefore=fingerprint(path.join(source,'data'));
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-paper-office-session-'));
const report={success:false,scope:'offline-read-only-actual-failed-attempt-plus-source-shaped-public-snapshot',productAcceptance:false,attempt,output,attemptBefore:before.sha256,sourceBefore:sourceBefore.sha256,checks:[]};
const check=(name,fn)=>{const facts=fn();report.checks.push({name,pass:true,...(facts?{facts}:{})});console.log('PASS '+name);};
const rows=(file,query)=>{const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare(query).all();}finally{db.close();}};
const dbPath=path.join(attempt,'data/app.db'),sourceDb=path.join(source,'data/app.db');
const existing=rows(sourceDb,'SELECT id FROM ai_conversation_sessions ORDER BY id').map(r=>r.id);
const added=rows(dbPath,'SELECT id FROM ai_conversation_sessions ORDER BY id').map(r=>r.id).filter(id=>!existing.includes(id));
let observation;
try {
  check('Actual preserved attempt failed before any new model work or original-owner authorization change',()=>{
    assert.deepEqual(failed.modelBefore,failed.modelAfterClose);assert.deepEqual(ledger(path.join(attempt,'data')),failed.modelBefore);
    for(const table of ['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs'])assert.deepEqual(rows(dbPath,'SELECT * FROM '+table+' ORDER BY conversation_id'),rows(sourceDb,'SELECT * FROM '+table+' ORDER BY conversation_id'));
    assert.equal(failed.buildBefore,failed.buildAfter);assert.equal(failed.sourceBefore,failed.sourceAfter);
    return {originalError:failed.error,requestCount:failed.modelAfterClose.ai_agent_run_requests.count};
  });
  check('Actual copied SQLite fresh identity agrees with fresh-profile UI current-session trace',()=>{
    assert.equal(added.length,1);const sessionId=added[0];
    const directory=path.join(attempt,'profile/Local Storage/leveldb'),trace=[];
    for(const file of fs.readdirSync(directory).filter(n=>/\.(log|ldb)$/.test(n))){
      const bytes=fs.readFileSync(path.join(directory,file));
      for(const encoding of ['utf8','utf16le']){
        const text=bytes.toString(encoding);let offset=-1;
        while((offset=text.indexOf('xiaozhi.current-session.v1',offset+1))>=0){
          const sessionIds=[...new Set(text.slice(offset,offset+350).match(/aisession_[a-f0-9-]{36}/gi)||[])];
          if(sessionIds.length)trace.push({file,encoding,offset,sessionIds});
        }
      }
    }
    assert(trace.some(t=>t.sessionIds.includes(sessionId)),'Fresh profile must identify the actually new SQLite session');
    assert(trace.every(t=>t.sessionIds.every(id=>id===sessionId)),'This failed fresh profile must contain only the new current-session identity');
    const persisted=readFreshOfficeSession(dbPath,sessionId);
    // These public fields reflect the production source contract, not captured
    // IPC from the failed app. Future live attempts record actual IPC themselves.
    const snapshot={projection:{threadId:sessionId,turns:[]},running:false,workspace:{label:'小智生成文件'}};
    observation={sessionId,previousSessionId:existing[0],existingSessionIds:existing,snapshot,persisted};
    report.actualFreshSession={sessionId,trace,persisted};return report.actualFreshSession;
  });
  check('Production default is a public label with no persisted binding; computed fallback and explicit OWN workspace are independent',()=>{
    const host=fs.readFileSync(path.join(desktop,'src/main/xiaozhi-agent/production-host.ts'),'utf8');
    const defaults=fs.readFileSync(path.join(desktop,'src/main/xiaozhi-agent/conversation-output.ts'),'utf8');
    assert(host.includes('await store.xiaozhiState.workspace(id) || {label:CONVERSATION_OUTPUT_LABEL}'));
    assert(host.includes('workspace: { label: workspace.label }'));
    assert(defaults.includes("CONVERSATION_OUTPUT_LABEL='小智生成文件'"));
    const data=path.join(attempt,'data'),location=conversationOutputLocation(data);
    const generated=path.join(location.path,observation.sessionId),relative=path.relative(attempt,generated);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.notEqual(location.path,conversationOutputLocation(path.join(source,'data')).path);
    const own=authorizedWorkspace(path.join(attempt,'teacher-workspace'),data);
    const original=rows(sourceDb,'SELECT path FROM xiaozhi_pi_workspaces');assert(original.length>0);
    for(const row of original){assert.notEqual(own.toLowerCase(),fs.realpathSync(row.path).toLowerCase());assert.notEqual(generated.toLowerCase(),fs.realpathSync(row.path).toLowerCase());}
    return {defaultWorkspaceComputationOnly:generated,ownWorkspaceValidatedReadOnly:own,authorizationStillRequiredThroughUi:true,sourceHashes:{productionHost:sha256(host),conversationOutput:sha256(defaults)}};
  });
  check('Old presence-of-workspace assertion fails; repaired guard accepts actual unbound SQLite plus source-shaped default label',()=>{
    assert.throws(()=>assert(!observation.snapshot.workspace));assertFreshOfficeSession(observation);
    return {actualSnapshotCaptured:false,publicSnapshotScope:'source-shaped guard regression; not actual IPC acceptance'};
  });
  check('Guard still rejects original/inherited bindings, foreign UI identities, grants and any prior run/message',()=>{
    const original=rows(sourceDb,'SELECT conversation_id,path,label FROM xiaozhi_pi_workspaces')[0];
    const invalid=[
      o=>{o.existingSessionIds.push(o.sessionId);},
      o=>{o.previousSessionId=o.sessionId;},
      o=>{o.snapshot.projection.threadId=original.conversation_id;},
      o=>{o.persisted.session.id=original.conversation_id;},
      o=>{o.persisted.workspaces=[{...original,conversation_id:o.sessionId}];},
      o=>{o.persisted.workspaces=[{conversation_id:o.sessionId,path:path.join(attempt,'teacher-workspace'),label:'teacher-workspace'}];},
      o=>{o.persisted.paperOutputs=[{...original,conversation_id:o.sessionId}];},
      o=>{o.persisted.commands=[{command_id:'prior',run_id:'prior',status:'completed'}];},
      o=>{o.persisted.runs=[{id:'prior',status:'completed'}];},
      o=>{o.persisted.messageCount=1;},
      o=>{o.snapshot.workspace={label:'teacher-workspace'};},
      o=>{o.snapshot.workspace.path=original.path;},
      o=>{o.snapshot.running=true;},
      o=>{o.snapshot.paperOutput={label:'teacher-workspace'};},
      o=>{o.snapshot.projection.turns=[{id:'prior'}];},
    ];
    for(const mutate of invalid){const broken=structuredClone(observation);mutate(broken);assert.throws(()=>assertFreshOfficeSession(broken));}
    return {rejectedCases:invalid.length};
  });
  report.success=true;
} catch(error) {report.error={name:error.name,message:error.message};process.exitCode=1;}
finally {
  report.attemptAfter=fingerprint(attempt).sha256;report.sourceAfter=fingerprint(path.join(source,'data')).sha256;
  if(report.attemptAfter!==before.sha256 || report.sourceAfter!==sourceBefore.sha256){report.success=false;report.integrityFailed=true;process.exitCode=1;}
  report.scriptHashes=Object.fromEntries(['../ui-goal-paper-instance-office-live.mjs','./paper-instance-office-fixture-ui.mjs','./paper-instance-office-session-selftest.mjs','./paper-instance-ui-driver.mjs','./paper-instance-ui-wait.mjs'].map(relative=>{const file=fileURLToPath(new URL(relative,import.meta.url));return [path.relative(desktop,file),sha256(fs.readFileSync(file))];}));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}

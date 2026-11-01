import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {copyExternalOutputs,readExternalOutputsBackup,EXTERNAL_OUTPUT_PREFIX}=await import('../../src/main/backup/external-outputs.ts');
const {copyConversationOutputs}=await import('../../src/main/backup/conversation-outputs.ts');
const {collectDataBackupEntries}=await import('../../src/main/backup/data-root-files.ts');
const {prepareBackupRestore,verifyPreparedBackupRestore}=await import('../../src/main/backup/restore.ts');
const {conversationOutputLocation}=await import('../../src/main/xiaozhi-agent/conversation-output-path.ts');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-external-backup-'));
const data=path.join(root,'data'),backup=path.join(root,'backup'),target=path.join(root,'restore-parent'),a=path.join(root,'workspace-a'),b=path.join(root,'workspace-b'),old=path.join(root,'old-output'),paper=path.join(root,'paper-output');
for(const p of [data,backup,target,a,b,old,paper])await fs.mkdir(p);
const report={ok:false,root,checks:[],scope:'Actual filesystem/SQLite snapshot/manifest/new-instance restore; domain fixture only, not formal Pi generation or full C03 acceptance.'};
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
const readDb=(file,q)=>{const d=new DatabaseSync(file,{readOnly:true});try{return d.prepare(q).all();}finally{d.close();}};
const sourceDb=path.join(data,'app.db'),db=new DatabaseSync(sourceDb),defaults=path.join(conversationOutputLocation(data).path,'s0');
await fs.mkdir(defaults,{recursive:true});await fs.writeFile(path.join(defaults,'default.md'),'default');
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT);CREATE TABLE xiaozhi_pi_workspaces(conversation_id TEXT,path TEXT);CREATE TABLE xiaozhi_pi_paper_outputs(conversation_id TEXT,workspace_hash TEXT,path TEXT);
 CREATE TABLE xiaozhi_pi_text_changes(id TEXT,conversation_id TEXT,workspace_hash TEXT,relative_path TEXT,state TEXT,after_bytes BLOB);
 CREATE TABLE xiaozhi_pi_office_drafts(conversation_id TEXT,workspace_hash TEXT,relative_path TEXT,result_path TEXT,state TEXT);
 CREATE TABLE document_artifacts(id TEXT,file_path TEXT);CREATE TABLE teacher_resources(local_path TEXT);CREATE TABLE ai_confirmation_items(id TEXT,session_id TEXT,action_type TEXT,payload_json TEXT);
 CREATE TABLE xiaozhi_event_journal(event_hash TEXT,event_json TEXT);`);
for(const id of ['s0','s1','s2'])db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
db.prepare('INSERT INTO xiaozhi_pi_workspaces VALUES(?,?)').run('s1',a);db.prepare('INSERT INTO xiaozhi_pi_workspaces VALUES(?,?)').run('s2',b);
db.prepare('INSERT INTO xiaozhi_pi_paper_outputs VALUES(?,?,?)').run('s1',hash(paper),paper);
const contentA='<!doctype html><p>教师在外部修改后的实际内容</p>',contentB='<!doctype html><p>第二个目录的同名文件</p>';
for(const [dir,name,text]of [[a,'lesson.html',contentA],[b,'lesson.html',contentB],[a,'copy.txt','approved copy'],[old,'legacy.pptx','owned binary fixture'],[old,'notes.md','legacy root text'],[paper,'paper.docx','owned paper fixture'],[a,'registered-original.txt','registered teacher original'],[a,'unregistered.txt','never copied']])await fs.writeFile(path.join(dir,name),text);
for(const [id,session,dir,name]of [['default','s0',defaults,'default.md'],['a','s1',a,'lesson.html'],['b','s2',b,'lesson.html'],['old','s1',old,'notes.md'],['missing','s1',a,'missing.txt'],['unknown','s1',path.join(root,'unknown'),'unknown.md']])db.prepare('INSERT INTO xiaozhi_pi_text_changes VALUES(?,?,?,?,?,?)').run(id,session,hash(dir),name,'applied',Buffer.from('original ledger bytes'));
for(const [id,dir,name]of [['old-office',old,'legacy.pptx'],['paper',paper,'paper.docx']]){db.prepare('INSERT INTO document_artifacts VALUES(?,?)').run(id,path.join(dir,name));db.prepare('INSERT INTO xiaozhi_pi_office_drafts VALUES(?,?,?,?,?)').run('s1',hash(dir),name,path.join(dir,name),'saved');}
db.prepare('INSERT INTO teacher_resources VALUES(?)').run(path.join(a,'registered-original.txt'));
db.prepare('INSERT INTO ai_confirmation_items VALUES(?,?,?,?)').run('copy','s1','pi_office_copy',JSON.stringify({workspaceHash:hash(a),target:'copy.txt',state:'executed'}));
const event='immutable event';db.prepare('INSERT INTO xiaozhi_event_journal VALUES(?,?)').run(hash(event),event);db.close();
const sourceHash=hash(await fs.readFile(sourceDb));await fs.copyFile(sourceDb,path.join(backup,'app.db'));let external,conversation,files;
try{
 await check('Snapshot facts copy exact external targets, inferred old Office root and registered originals without scanning unrelated files',async()=>{
  conversation=await copyConversationOutputs(data,backup);external=await copyExternalOutputs(data,backup);assert.equal(external.fileCount,7);assert.equal(external.roots.length,4);assert.equal(external.omittedCount,2);
  assert.equal(await fs.readFile(path.join(backup,EXTERNAL_OUTPUT_PREFIX,hash(a),'lesson.html'),'utf8'),contentA);assert.equal(await fs.readFile(path.join(backup,EXTERNAL_OUTPUT_PREFIX,hash(b),'lesson.html'),'utf8'),contentB);
  await assert.rejects(fs.lstat(path.join(backup,EXTERNAL_OUTPUT_PREFIX,hash(a),'unregistered.txt')),e=>e.code==='ENOENT');assert.equal(conversation.fileCount,1);
 });
 await check('Teacher outside edits are preserved byte-for-byte without rewriting the old saved-byte evidence or source database',async()=>{
  assert.equal(hash(await fs.readFile(sourceDb)),sourceHash);assert.equal(Buffer.from(readDb(path.join(backup,'app.db'),"SELECT after_bytes FROM xiaozhi_pi_text_changes WHERE id='a'")[0].after_bytes).toString(),'original ledger bytes');
  assert(external.omitted.some(t=>t.includes('missing.txt')));assert(external.omitted.some(t=>t.includes('unknown')));
 });
 await check('Optional extension validates exact counts, roots, duplicate keys and descriptive source identities',async()=>{
  files=await collectDataBackupEntries(backup);assert.deepEqual(readExternalOutputsBackup(external,files.map(f=>f.path)),external);assert.equal(readExternalOutputsBackup(undefined,[]),undefined);
  for(const bad of [{...external,fileCount:999},{...external,roots:[external.roots[0],...external.roots]},{...external,roots:[{...external.roots[0],prefix:'../escape'},...external.roots.slice(1)]},{...external,omittedCount:0}])assert.throws(()=>readExternalOutputsBackup(bad,files.map(f=>f.path)));
 });
 const envelope={schemaVersion:'omni-edu-backup-manifest.v1',files,conversationOutputs:conversation,externalOutputs:external};await fs.writeFile(path.join(backup,'omni-edu-backup-manifest.v1.json'),JSON.stringify(envelope));
 const verify=async()=>{const current=await collectDataBackupEntries(backup),same=JSON.stringify(current)===JSON.stringify(files);return{backupPath:backup,manifestPath:path.join(backup,'omni-edu-backup-manifest.v1.json'),verified:same,fileCount:files.length,missingFiles:[],changedFiles:[],unexpectedFiles:[],conversationOutputs:conversation,externalOutputs:external};};
 let restored;
 await check('Restoration creates independent owned workspaces and relocates only copied files; original data and native event facts remain unchanged',async()=>{
  restored=await prepareBackupRestore({backupPath:backup,parent:target,currentDataRoot:data,verify});await verifyPreparedBackupRestore(restored);
  const resultDb=path.join(restored.dataRoot,'app.db'),outputRoot=conversationOutputLocation(restored.dataRoot).path;
  const rows=readDb(resultDb,'SELECT * FROM xiaozhi_pi_workspaces');const ra=rows.find(r=>r.conversation_id==='s1').path,rb=rows.find(r=>r.conversation_id==='s2').path;
  assert(ra.startsWith(outputRoot+path.sep)&&rb.startsWith(outputRoot+path.sep));assert.notEqual(ra,a);assert.notEqual(rb,b);
  assert.equal(await fs.readFile(path.join(ra,'lesson.html'),'utf8'),contentA);assert.equal(await fs.readFile(path.join(rb,'lesson.html'),'utf8'),contentB);
  const p=readDb(resultDb,'SELECT * FROM xiaozhi_pi_paper_outputs')[0];assert.equal(p.workspace_hash,hash(p.path));assert.equal(await fs.readFile(path.join(p.path,'paper.docx'),'utf8'),'owned paper fixture');
  const text=readDb(resultDb,"SELECT workspace_hash FROM xiaozhi_pi_text_changes WHERE id='a'")[0];assert.equal(text.workspace_hash,hash(ra));
  const resource=readDb(resultDb,'SELECT local_path FROM teacher_resources')[0];assert.equal(await fs.readFile(resource.local_path,'utf8'),'registered teacher original');assert(resource.local_path.startsWith(outputRoot+path.sep));
  assert.deepEqual(readDb(resultDb,'SELECT * FROM xiaozhi_event_journal'),readDb(sourceDb,'SELECT * FROM xiaozhi_event_journal'));assert.equal(hash(await fs.readFile(sourceDb)),sourceHash);
  assert(restored.warnings.some(t=>t.includes('2 项')));report.restored=restored;
 });
 await check('Prepared-copy verification detects subsequent external-copy corruption before activation',async()=>{
  const row=readDb(path.join(restored.dataRoot,'app.db'),"SELECT path FROM xiaozhi_pi_workspaces WHERE conversation_id='s1'")[0];await fs.appendFile(path.join(row.path,'lesson.html'),'tamper');await assert.rejects(verifyPreparedBackupRestore(restored),/变化/);assert.equal(hash(await fs.readFile(sourceDb)),sourceHash);
 });
 await check('An actual link in a recorded output is rejected without following or copying its target',async()=>{
  const isolated=path.join(root,'linked-backup');await fs.mkdir(isolated);await fs.copyFile(sourceDb,path.join(isolated,'app.db'));
  const saved=path.join(a,'lesson.html'),original=await fs.readFile(saved);await fs.rename(saved,saved+'.kept');await fs.link(path.join(a,'unregistered.txt'),saved);
  try{await assert.rejects(copyExternalOutputs(data,isolated),/独立普通文件/);assert.equal(await fs.readFile(path.join(a,'unregistered.txt'),'utf8'),'never copied');}finally{await fs.unlink(saved);await fs.rename(saved+'.kept',saved);assert.deepEqual(await fs.readFile(saved),original);}
 });
 await check('A recorded file changing during its copy aborts the backup instead of certifying mixed bytes',async()=>{
  const changing=path.join(root,'changing-backup');await fs.mkdir(changing);await fs.copyFile(sourceDb,path.join(changing,'app.db'));
  const recorded=path.join(a,'lesson.html'),original=await fs.readFile(recorded),copy=fs.copyFile;let changed=false;
  fs.copyFile=async(from,to,...args)=>{await copy(from,to,...args);if(from===recorded&&!changed){changed=true;await fs.appendFile(recorded,'changed during copy');}};
  try{await assert.rejects(copyExternalOutputs(data,changing),/备份期间变化/);assert(changed);}finally{fs.copyFile=copy;await fs.writeFile(recorded,original);}
  assert.equal(hash(await fs.readFile(sourceDb)),sourceHash);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}
finally{await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}

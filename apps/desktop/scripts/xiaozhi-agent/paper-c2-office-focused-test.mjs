// Focused source integration; no Electron/provider/build, not formal Pi acceptance.
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
const {compilePaperOffice,assertPaperOffice}=await import('../../src/main/education/paper-export.ts');
const {PAPER_C2_OFFICE_SCHEMA,isPaperOfficeSchema,isRichPaperOfficeSchema,isMathPaperOfficeSchema}=await import('../../src/shared/paper-export.ts');
const {validOfficeDraft,validOfficeDraftFormat}=await import('../../src/shared/xiaozhi-office-draft.ts');
const {generateOfficeDocument}=await import('../../src/main/xiaozhi-agent/office-generator.ts');
const {paperLayoutHtml}=await import('../../src/main/xiaozhi-agent/paper-layout-html.ts');
const id=()=>randomUUID(),digest='a'.repeat(64);
const paper={id:'xipaper_'+id(),sessionId:'aisession_'+id(),title:'集成卷',state:'confirmed',complete:true,sourceCurrent:true,exportCurrent:true,digest,totalPoints:5,blueprint:{grade:'初二',subject:'数学',durationMinutes:90,sections:[{id:'a',label:'解答题',points:5}]},selection:{items:[{entryId:'entry1',number:1,points:5,sectionId:'a',source:{version:digest},question:{id:'question_'+id(),stem:'题面',answer:'秘密答案',analysis:'秘密解析',sourceTitle:'教师'}}]},basket:{},snapshotSchema:'xiaozhi.paper-basket-snapshot.c2.v1',c2:{entryPoints:{entry1:5},retainedSections:[]},templateSources:[]};
const base=structuredClone(paper);delete base.snapshotSchema;delete base.c2;delete base.templateSources;
const old=JSON.stringify(compilePaperOffice(base,'student'));
let count=0;
for(const orientation of ['portrait','landscape'])for(const columns of [1,2]){
 const p=structuredClone(paper);p.c2.layout={schemaVersion:'xiaozhi.paper-layout.v1',paper:'A4',orientation,columns,margins:{top:200,right:200,bottom:200,left:200},columnGap:100};p.c2.layoutTemplate={templateId:'xitemplate_'+id(),version:1,digest};p.templateSources=[{template:p.c2.layoutTemplate,candidateDigest:digest,source:{}}];
 for(const template of ['paper','answer_sheet']){
 const d=compilePaperOffice(p,'student',template);assert.equal(d.schemaVersion,PAPER_C2_OFFICE_SCHEMA);assert(validOfficeDraft(d));assertPaperOffice(p,d);assert(!JSON.stringify(d).includes('秘密'));
 const bytes=await generateOfficeDocument('docx',d,{dataRoot:process.cwd()}),zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string');assert.equal((xml.match(/<w:sectPr>/g)||[]).length,2);assert(xml.includes('w:num="'+columns+'"'));count++;
 for(const mutate of [x=>x.title+='伪',x=>x.paperSource.layout.columns=3,x=>x.paperSource.digest='b'.repeat(64),x=>x.sections[0].paragraphs[0]='伪']){const bad=structuredClone(d);mutate(bad);assert.throws(()=>assertPaperOffice(p,bad));}
 }
 assert(paperLayoutHtml(p.c2.layout,[],[{kind:'table',rows:[['$x^2$'],['$y$']],math:true}]).includes('<math'));
}
const teacher=compilePaperOffice(paper,'teacher');assert(JSON.stringify(teacher).includes('秘密答案'));assertPaperOffice(paper,teacher);assert.throws(()=>compilePaperOffice(paper,'teacher','answer_sheet'));
const noLayout=compilePaperOffice(paper,'student');assert(validOfficeDraft(noLayout));assert.equal(noLayout.paperSource.layout,undefined);assertPaperOffice(paper,noLayout);
for(const f of [isPaperOfficeSchema,isRichPaperOfficeSchema,isMathPaperOfficeSchema])assert(f(PAPER_C2_OFFICE_SCHEMA));assert(!validOfficeDraftFormat(PAPER_C2_OFFICE_SCHEMA,'xlsx'));assert.equal(JSON.stringify(compilePaperOffice(base,'student')),old);
const changed=structuredClone(paper);changed.exportCurrent=false;assert.throws(()=>assertPaperOffice(changed,noLayout));
const oldBytes=await generateOfficeDocument('docx',compilePaperOffice(base,'student'),{dataRoot:process.cwd()}),newBytes=await generateOfficeDocument('docx',noLayout,{dataRoot:process.cwd()});assert.equal(await (await JSZip.loadAsync(oldBytes)).file('word/document.xml').async('string'),await (await JSZip.loadAsync(newBytes)).file('word/document.xml').async('string'));
console.log('PASS C2 compiler -> real generator: '+count+' DOCX/XML; source/title/content/layout tamper, answer isolation, no-layout, classifier and legacy stability. No PDF/Pi acceptance.');
if(!process.argv.includes('--compiler-only')){
const {DatabaseSync}=await import('node:sqlite');
const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'c2-office-focused-')),workspace=path.join(root,'workspace'),dataRoot=path.join(root,'data');fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
const db=new DatabaseSync(path.join(root,'app.db'));db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,title TEXT,artifact_type TEXT,file_name TEXT,mime_type TEXT,description TEXT,content_md TEXT,file_path TEXT,file_size INTEGER,content_hash TEXT,status TEXT,error_message TEXT,created_at TEXT,updated_at TEXT);`);db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(paper.sessionId);
const sql={run:async(s,p=[])=>db.prepare(s).run(...p),all:async(s,p=[])=>db.prepare(s).all(...p),change:async(s,p=[])=>Number(db.prepare(s).run(...p).changes)};const state=createOfficeArtifactState(sql);await state.migrate();let live=true,workspaceAllowed=true,stageHook=async()=>{};let activePaper=paper,validated=0,resolved=0,committed=0;
const validate=async(s,d)=>{assert.equal(s,paper.sessionId);assertPaperOffice(activePaper,d);validated++;};
const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>workspace,paperWorkspace:async()=>workspaceAllowed?workspace:undefined,isCurrent:()=>live,afterStage:async step=>stageHook(step),validatePaperDraft:validate,resolvePaperImages:async(s,d)=>{await validate(s,d);resolved++;return new Map();},commitPaperDraft:async(s,d,install)=>{await validate(s,d);committed++;install();}});
const propose=async name=>service.propose(paper.sessionId,'run',id(),{path:name+'.docx',format:'docx',draft:noLayout,sources:[]});
const approve=async row=>service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:paper.sessionId,draftId:row.id,revision:row.revision,action:'approve'});
try{const row=await propose('success');await approve(row);const saved=await service.apply(paper.sessionId,row.id);assert.equal(saved.state,'saved');assert.equal(committed,1);assert(resolved>0&&validated>3);assert(fs.existsSync(path.join(workspace,'success.docx')));
const triggers=()=>db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'xiaozhi_office_paper_lineage_v%' ORDER BY name").all();
const before=triggers();assert.equal(before.length,6);await state.migrate();assert.deepEqual(triggers(),before);
const lineage=db.prepare('SELECT * FROM document_artifact_paper_sources WHERE draft_id=?').get(row.id);assert.equal(lineage.paper_id,paper.id);assert.equal(lineage.paper_digest,paper.digest);assert.equal(lineage.audience,'student');assert.equal(db.prepare('SELECT count(*) n FROM document_artifact_sources WHERE artifact_id=?').get(saved.artifactId).n,0);
const prefix=db.prepare('SELECT generator_version FROM xiaozhi_pi_office_drafts WHERE id=?').get(row.id).generator_version;assert(prefix.startsWith('paper-office7:'));
const {OFFICE_GENERATOR_VERSION}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');const legacyVersion='paper-office2:'+OFFICE_GENERATOR_VERSION;
db.prepare('UPDATE xiaozhi_pi_office_drafts SET generator_version=? WHERE id=?').run(legacyVersion,row.id);await state.migrate();assert.equal((await state.get(row.id)).state,'saved');assert.equal(db.prepare('SELECT generator_version FROM xiaozhi_pi_office_drafts WHERE id=?').get(row.id).generator_version,legacyVersion);
db.prepare('UPDATE xiaozhi_pi_office_drafts SET generator_version=? WHERE id=?').run('unknown-generator',row.id);await assert.rejects(()=>state.get(row.id),/configuration/);db.prepare('UPDATE xiaozhi_pi_office_drafts SET generator_version=? WHERE id=?').run(legacyVersion,row.id);
for(const [schema,expected]of [['xiaozhi.office-draft.v1',OFFICE_GENERATOR_VERSION],['xiaozhi.office-paper-draft.v2','paper-office2:'+OFFICE_GENERATOR_VERSION],['xiaozhi.office-paper-draft.v3','paper-office3:'+OFFICE_GENERATOR_VERSION],['xiaozhi.office-paper-draft.v4','paper-office4:katex0.16.47:'+OFFICE_GENERATOR_VERSION],['xiaozhi.office-paper-draft.v5','paper-office5:marked17.0.6:katex0.16.47:'+OFFICE_GENERATOR_VERSION],['xiaozhi.office-paper-draft.v6','paper-office2:'+OFFICE_GENERATOR_VERSION]]){
 let d=schema==='xiaozhi.office-draft.v1'?{schemaVersion:schema,title:'普通旧稿',sections:[{heading:'标题',paragraphs:['正文']}]}:compilePaperOffice(base,'student',schema.endsWith('.v6')?'answer_sheet':'paper');d.schemaVersion=schema;
 if(schema.endsWith('.v3'))d.sections[0].figures=[{questionId:'question_'+id(),version:digest,blockId:'source_img',role:'question',assetId:'asset_'+id(),sha256:digest,width:1,height:1,afterParagraph:0}];
 const r=await state.create({sessionId:paper.sessionId,runId:'compat',callId:id(),workspaceHash:digest,inputHash:digest,path:'legacy-'+id()+'.docx',format:'docx',draft:d,sources:[],parentArtifactId:null});assert.equal(db.prepare('SELECT generator_version FROM xiaozhi_pi_office_drafts WHERE id=?').get(r.id).generator_version,expected);
 if(schema.endsWith('.v2')){db.prepare('UPDATE xiaozhi_pi_office_drafts SET generator_version=? WHERE id=?').run(prefix,r.id);await assert.rejects(()=>state.get(r.id),/configuration/);db.prepare('UPDATE xiaozhi_pi_office_drafts SET generator_version=? WHERE id=?').run(expected,r.id);}
}
const verify=async r=>service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:paper.sessionId,draftId:r.id,revision:r.revision,action:'verify'});
const uncertain=async name=>{activePaper=paper;live=true;workspaceAllowed=true;stageHook=async step=>{if(step==='file')throw Error('cancelled');};const r=await propose(name);await approve(r);await assert.rejects(()=>service.apply(paper.sessionId,r.id),/cancelled/);stageHook=async()=>{};const u=await state.get(r.id);assert.equal(u.state,'uncertain');assert(fs.existsSync(path.join(workspace,name+'.docx')));return u;};
const same=await uncertain('recover-same'),samePath=path.join(workspace,'recover-same.docx'),sameBytes=fs.readFileSync(samePath);assert.equal((await verify(same)).state,'saved');assert.deepEqual(fs.readFileSync(samePath),sameBytes);
const staleRecovery=await uncertain('recover-stale'),stalePath=path.join(workspace,'recover-stale.docx'),staleBytes=fs.readFileSync(stalePath);activePaper={...paper,sourceCurrent:false};await assert.rejects(()=>verify(staleRecovery),/conflict/);assert.equal((await state.get(staleRecovery.id)).state,'uncertain');assert.deepEqual(fs.readFileSync(stalePath),staleBytes);activePaper=paper;
const denied=await uncertain('recover-permission');workspaceAllowed=false;await assert.rejects(()=>verify(denied),/permission_denied/);workspaceAllowed=true;assert.equal((await state.get(denied.id)).state,'uncertain');assert(fs.existsSync(path.join(workspace,'recover-permission.docx')));
const cancelled=await uncertain('recover-cancelled');live=false;await assert.rejects(()=>verify(cancelled),/permission_denied/);live=true;assert.equal((await state.get(cancelled.id)).state,'uncertain');assert(fs.existsSync(path.join(workspace,'recover-cancelled.docx')));
const changedFile=await uncertain('recover-different'),changedPath=path.join(workspace,'recover-different.docx');fs.writeFileSync(changedPath,'externally changed');assert.equal((await verify(changedFile)).state,'conflict');assert.equal(fs.readFileSync(changedPath,'utf8'),'externally changed');
const absent=await uncertain('recover-absent');fs.unlinkSync(path.join(workspace,'recover-absent.docx'));assert.equal((await verify(absent)).state,'interrupted');assert(!fs.existsSync(path.join(workspace,'recover-absent.docx')));
const committedBefore=committed;
const stale=await propose('stale');await approve(stale);activePaper={...paper,sourceCurrent:false};await assert.rejects(()=>service.apply(paper.sessionId,stale.id));assert(!fs.existsSync(path.join(workspace,'stale.docx')));assert.equal(committed,committedBefore);console.log('PASS v7 existing service callbacks, real authorized-directory DOCX installation and stale rejection; owned SQLite fixture '+root);
fs.writeFileSync(path.join(root,'report.json'),JSON.stringify({success:true,batch:'S3 2/2',checks:['legacy v1-v6 generator values unchanged/v7 alias not accepted for legacy','v7 saved paper lineage/no AI fallback','idempotent migrate/old triggers retained','v7 generator prefix','legacy v7 exact prefix read/no rewrite','unknown version refused','same hash recovery saved','stale source remains uncertain','permission revoked remains uncertain','cancelled run remains uncertain','different hash conflict preserves bytes','absent interrupted/no creation','pre-install stale refused'],boundary:'source-only real SQLite/DOCX; no Electron/provider/build'},null,2));console.log('REPORT '+path.join(root,'report.json'));}finally{db.close();}

}

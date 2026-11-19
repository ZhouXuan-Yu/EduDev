import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';

const data=fs.realpathSync(process.argv[2]);
assert.equal(path.basename(path.dirname(data)),'flow-1gb-20261111','Run only on the dedicated natural acceptance library');
assert.equal(path.basename(data),'data');
const output=fs.mkdtempSync(path.resolve('test-results','next-parent-ui-'));
console.log('OUTPUT '+output);
// Keep the tested PDF identities intact. Copying a file changes its Windows
// inode/ctime and correctly invalidates the immutable AI input stamp.
const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
const sql=(statement,params=[])=>db.prepare(statement).all(...params);
const auditById=id=>sql("SELECT name FROM sqlite_master WHERE name='material_ai_next_parent_rechecks'").length
 ?sql('SELECT * FROM material_ai_next_parent_rechecks WHERE question_id=?',[id])[0]:undefined;
await backup(db,path.join(output,'pre-action.sqlite'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[];
const report={output,success:false,checks,writes:[],rendererErrors:[],cloudCalls:0,buildSha256:sha(fs.readFileSync('out/main/index.js'))};
const targets=[
 {id:'question_e36ad30a-2dd3-4ce3-b53d-7cbdd09652ac',issues:['missing_grade','answer_conflict'],query:'F甲<F乙'},
 {id:'question_e57f8f6b-6d64-47c3-8a21-28572a258260',issues:[],query:'逐渐增大'}];
for(const target of targets){
 Object.assign(target,sql(`SELECT m.batch_id batchId,r.id resourceId,r.title,r.local_path file
  FROM material_ai_members m JOIN material_ai_batches b ON b.id=m.batch_id JOIN teacher_resources r ON r.id=b.resource_id WHERE m.question_id=?`,[target.id])[0]);
 assert.equal(path.dirname(target.file),path.join(data,'teacher_resources'));
}
const byId=id=>sql('SELECT * FROM question_bank_items WHERE id=?',[id])[0];
const immutable=()=>({
 responses:sha(JSON.stringify(sql('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal'))),
 paid:sha(JSON.stringify(sql('SELECT id,calls FROM material_ai_batches ORDER BY id'))),
 sources:sha(JSON.stringify(sql('SELECT * FROM material_pdf_pages ORDER BY generation,page'))),
 oldAudits:sha(JSON.stringify(sql('SELECT * FROM material_ai_choice_rechecks ORDER BY question_id'))),
 unrelated:sha(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id NOT IN (?,?) ORDER BY id',targets.map(t=>t.id)))),
 files:targets.map(t=>sha(fs.readFileSync(t.file)))});
const before=targets.map(t=>{const question=byId(t.id),audit=auditById(t.id);return audit?{...question,archive_json:audit.before_archive_json}:question;});
const untouched=immutable();
assert.equal(sql("SELECT COUNT(*) n FROM material_ai_batches WHERE status IN ('running','pending')")[0].n,0);
assert.equal(sql("SELECT COUNT(*) n FROM material_folder_ai WHERE status='running'")[0].n,0);
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const key of ['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','OMNI_EDU_AI_NEXT_PARENT_BOUNDARY'])delete env[key];
 app=await electron.launch({args:[path.resolve('out/main/index.js'),'--user-data-dir='+path.join(output,'profile')],env,cwd:process.cwd(),timeout:90000});
 await app.evaluate(({net})=>{
  globalThis.__nextParentCloud=0;
  for(const owner of [net,globalThis]){
   const invoke=owner.fetch.bind(owner);
   owner.fetch=(url,options)=>{
    if(String(url).includes('api.deepseek.com')){
     globalThis.__nextParentCloud++;
     throw Error('This offline test never calls DeepSeek');
    }
    return invoke(url,options);
   };
  }
 });
 page=await app.firstWindow();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
}
async function until(predicate,millis=45000){
 const deadline=Date.now()+millis;
 while(Date.now()<deadline){
  const value=await predicate();
  if(value)return value;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Local review did not reach its persisted state');
}
async function openBatch(target){
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(target.title);
 await page.getByTestId('materials-refresh').click();
 await page.getByTestId('material-'+target.resourceId).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 await openMaterialDisclosure(page.getByTestId('material-structure-panel'));
 const panel=page.getByTestId('material-ai-panel');
 await openMaterialDisclosure(panel);
 return panel.locator('[data-batch-id="'+target.batchId+'"]');
}
async function archiveProof(target){
 const row=byId(target.id),archive=JSON.parse(row.archive_json);
 assert.deepEqual(archive.issues,target.issues);
 assert.equal(archive.state,target.issues.length?'ai_needs_review':'ai_final');
 assert.equal(archive.sourceChecked,false);
 const q=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),target.id);
 const source=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),
  {schemaVersion:'xiaozhi.education.question-context.v1',questionId:target.id,version:questionVersion(q)});
 assert(source.ok,JSON.stringify(source));
 return q;
}
try{
 await launch();
 for(const [i,target] of targets.entries()){
  let audit=auditById(target.id);
  const start=performance.now();
  if(!audit){
   const batch=await openBatch(target);
   await batch.getByTestId('material-ai-recheck-source-layout').click();
   audit=await until(()=>auditById(target.id));
  }
  const after=byId(target.id);
  assert.equal(audit.before_archive_json,before[i].archive_json);
  assert.equal(audit.after_archive_json,after.archive_json);
  assert.equal(JSON.parse(audit.next_source_json).page,2);
  assert.deepEqual({...after,archive_json:before[i].archive_json},{...before[i]});
  report.writes.push({elapsedMs:Math.round(performance.now()-start),state:JSON.parse(after.archive_json).state,issues:target.issues});
 }
 assert.deepEqual(immutable(),untouched);
 checks.push('Original Materials action updates both authentic archives and preserves every other question, episode and page receipt');
 report.cloudCalls+=await app.evaluate(()=>globalThis.__nextParentCloud);
 await app.close();app=undefined;await launch();
 const ready=await archiveProof(targets[1]),held=await archiveProof(targets[0]);
 assert.equal(ready.archive.issues.length,0);assert(held.archive.issues.includes('answer_conflict'));
 await productEntry(page,'teaching').click();
 await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
 await page.getByTestId('question-notebook-filter-toggle').click();
 await page.getByTestId('question-notebook-source-candidates').check();
 await page.getByTestId('question-notebook-search').fill(targets[0].query);
 const item=page.getByTestId('question-notebook-card-'+targets[0].id);
 await item.getByTestId('question-original-open').click();
 const images=item.getByTestId('question-original-image'),hashes=held.document.context.sourceContent.crops.map(c=>c.sha256);
 await until(async()=>await images.count()>=hashes.length);
 const recovered=await images.evaluateAll(all=>all.map(image=>image.getAttribute('src')));
 assert(hashes.every(hash=>recovered.some(src=>src?.startsWith('data:image/png;base64,')&&sha(Buffer.from(src.split(',')[1],'base64'))===hash)));
 assert.deepEqual(immutable(),untouched);
 report.cloudCalls+=await app.evaluate(()=>globalThis.__nextParentCloud);
 assert.equal(report.cloudCalls,0);
 assert.deepEqual(report.rendererErrors,[]);
 checks.push('Restart reads both current-source results and opens the correct original diagram crops from the actual notebook; unrelated database rows remain unchanged');
 report.success=true;
}catch(error){
 report.error=String(error.stack||error);process.exitCode=1;
 if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
 await app?.close();db.close();
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const root=fs.realpathSync(process.argv[2]),old=process.argv[3],run=process.argv.includes('--desktop');
assert(path.basename(root).startsWith('kb-structure-batch-'));
assert.match(old,/^[0-9a-f-]{36}$/);
const data=path.join(root,'data'),filename=path.join(data,'app.db');
const read=(sql,args=[])=>{
 const db=new DatabaseSync(filename,{readOnly:true,timeout:5000});
 try{return db.prepare(sql).all(...args);}finally{db.close();}
};
const sha=value=>createHash('sha256').update(value).digest('hex');
const pageRows=generation=>read('SELECT * FROM material_structure_pages WHERE generation=? ORDER BY page',[generation]);
const questionRows=generation=>read('SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid',[generation]);
const original=pageRows(old),oldQuestions=questionRows(old);
assert.equal(original.length,5);
assert.equal(oldQuestions.length,8);
const before=original.map(row=>JSON.parse(row.body_json));
const v9=oldQuestions.map(row=>JSON.parse(row.body_json));
const [resource]=read('SELECT id,content_hash,title,local_path FROM teacher_resources WHERE id=?',[before[0].resourceId]);
assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
const {recoverStructurePage,StructureQuestionAssembler}=await import('../../src/main/assets/material-document-structure.ts');
const after=before.map(page=>recoverStructurePage({...page,lines:page.lines.filter(line=>!line.origin).map(line=>({
 id:line.sourceId,text:line.text,score:line.score,kind:'text',normalizedQuad:line.quad,quad:line.quad,needsReview:true,
}))}));
const builder=new StructureQuestionAssembler(),groups=[...after.flatMap(page=>builder.push(page)),...builder.end()];
const expected=[...Array.from({length:5},(_,i)=>String(i+1)),...Array.from({length:18},(_,i)=>String(i+8))];
const labels=groups=>groups.filter(q=>q.number!=='0').map(q=>q.number);
const summary=groups=>({
 groups:groups.length,numbered:labels(groups).length,held:groups.filter(q=>q.status==='needs_review').length,
 unnumbered:groups.filter(q=>q.number==='0').length,administration:groups.filter(q=>/铅笔作答选择题/u.test(q.stem)).length,
});
assert.deepEqual(after.map(page=>page.rawText),before.map(page=>page.rawText));
assert.deepEqual(after.map(page=>page.lines),before.map(page=>page.lines));
assert.deepEqual(labels(groups),expected);
assert.equal(summary(v9).administration,1);
assert.equal(summary(groups).administration,0);
assert.equal(groups.find(group=>group.number==='5').status,'needs_review');
assert(groups.some(group=>group.number==='0'&&group.issues.includes('missing_question_start')));
assert.deepEqual(groups.find(group=>group.number==='1').options.map(option=>option.label),Array.from('ABCD'));
assert(!groups.find(group=>group.number==='1').stem.includes('2 − x'));
assert(groups.find(group=>group.number==='2').stem.includes('2 − x'));
assert(groups.find(group=>group.number==='2').issues.includes('ambiguous_asset'));
assert.deepEqual(groups.find(group=>group.number==='21').subquestions.map(child=>child.label),['1','2']);
const report={root,replay:{before:summary(v9),after:summary(groups),rawLines:before.reduce((sum,page)=>sum+page.lines.length,0)}};
if(!run){console.log(JSON.stringify({ok:true,...report}));process.exit(0);}

const sessionFacts=()=>read(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
 AND (json_extract(archive_json,'$.state')='teacher_edited' OR json_extract(archive_json,'$.sourceChecked')=1) ORDER BY id`);
const budget=()=>read('SELECT id,calls FROM material_ai_batches ORDER BY id');
const frozenFacts=sessionFacts(),frozenBudget=budget();
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
report.buildSha256=sha(fs.readFileSync(entry));
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_VISIBLE:'0'};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
const app=await _electron.launch({args:[entry,'--user-data-dir='+path.join(root,'profile')],cwd:root,env,timeout:90000});
try{
 await app.evaluate(({net})=>{
  globalThis.printedNumberProviderCalls=0;
  for(const owner of [globalThis,net]){
   const fetch=owner.fetch.bind(owner);
   owner.fetch=async(input,options)=>{
    const address=new URL(typeof input==='string'?input:input.url??input.href);
    if(address.hostname==='api.deepseek.com'){globalThis.printedNumberProviderCalls++;throw Error('Only local parsing is authorized for this run.');}
    return fetch(input,options);
   };
  }
 });
 const page=await app.firstWindow();
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(resource.title);
 await page.getByTestId('material-'+resource.id).getByRole('button').click();
 await page.getByTestId('materials-section-questions').click();
 const panel=page.getByTestId('material-structure-panel');
 await openMaterialDisclosure(panel);
 const began=Date.now();
 await panel.getByTestId('structure-rebuild').click();
 const job=()=>read('SELECT * FROM material_structure_jobs WHERE resource_id=?',[resource.id])[0];
 const until=async predicate=>{
  const deadline=Date.now()+210000;
  while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,600));}
  throw Error('Timed out waiting for the rebuilt structure');
 };
 await until(()=>job().generation!==old);
 await page.evaluate(input=>window.omniEdu.controlMaterialTask(input),{
  schemaVersion:'xiaozhi.material-parse-task.v1',resourceId:resource.id,version:resource.content_hash,action:'prioritize',
 });
 const published=await until(()=>['partial','complete'].includes(job().status)?job():false);
 report.publishMs=Date.now()-began;
 const current=questionRows(published.generation).map(row=>JSON.parse(row.body_json));
 assert.equal(published.engine,'layout-paragraph-question.v11');
 assert.deepEqual(labels(current),expected);
 assert.equal(summary(current).administration,0);
 assert.equal(current.find(q=>q.number==='5').status,'needs_review');
 assert.deepEqual(pageRows(old),original);
 assert.deepEqual(questionRows(old),oldQuestions);
 assert.deepEqual(sessionFacts(),frozenFacts);
 assert.deepEqual(budget(),frozenBudget);
 assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
 const notebook=async query=>page.evaluate(async query=>(await window.omniEdu.listQuestionNotebook({query,limit:30})).items,query);
 const archived=await until(async()=>{
  const found=(await notebook('那么下列正确的是')).filter(item=>item.archive?.structure?.generation===published.generation);
  return found.length?found:false;
 });
 assert(archived.every(item=>item.archive?.state==='rule_extracted'&&!item.archive?.sourceChecked));
 const formal=await page.evaluate(()=>window.omniEdu.searchQuestionBank({query:'那么下列正确的是',limit:30}));
 assert(!formal.some(item=>item.archive?.structure?.generation===published.generation));
 const excluded=(await notebook('铅笔作答选择题')).filter(item=>item.archive?.structure?.resourceId===resource.id);
 assert.equal(excluded.length,0);
 assert(!current.find(q=>q.number==='1').stem.includes('2 − x'));
 assert(current.find(q=>q.number==='2').stem.includes('2 − x'));
 report.providerCalls=await app.evaluate(()=>globalThis.printedNumberProviderCalls);
 assert.equal(report.providerCalls,0);
 report.desktop={...summary(current),notebookHits:archived.length,formalHits:0,excludedInstructionHits:excluded.length};
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
 await app.close();
 const file=path.join(root,'printed-assessment-numbering-report-'+Date.now()+'.json');
 fs.writeFileSync(file,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,file}));
}

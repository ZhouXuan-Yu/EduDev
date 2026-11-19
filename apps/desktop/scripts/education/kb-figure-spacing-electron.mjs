import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const configured=process.env.EDU_FIGURE_TEST_DATA;
assert(configured&&path.isAbsolute(configured));
const data=fs.realpathSync(configured);
assert.equal(path.basename(path.dirname(data)),'flow-1gb-20261111','Use only the dedicated natural corpus test root');
assert.equal(path.basename(data),'data');
const batch='aibatch_905bfe20-82d3-42c8-8cad-3c393f2e227e';
const result=fs.mkdtempSync(path.resolve('test-results','figure-spacing-ui-'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tree=dir=>{
 const list=[];
 const visit=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  const file=path.join(folder,entry.name);assert(!entry.isSymbolicLink());
  if(entry.isDirectory())visit(file);
  else if(entry.isFile())list.push([path.relative(dir,file).replaceAll('\\','/'),sha(fs.readFileSync(file))]);
 }};
 visit(dir);return {count:list.length,sha:sha(JSON.stringify(list))};
};
const out=path.resolve('out'), identity=tree(out), frozen=path.join(result,'out');
fs.cpSync(out,frozen,{recursive:true});assert.deepEqual(tree(frozen),identity);
const main=path.join(frozen,'main','index.js');
const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
const query=(sql,args=[])=>db.prepare(sql).all(...args);
const resource=query('SELECT r.* FROM teacher_resources r JOIN material_ai_batches b ON b.resource_id=r.id WHERE b.id=?',[batch])[0];
assert(resource&&path.dirname(resource.local_path)===path.join(data,'teacher_resources'));
const qid=query("SELECT question_id FROM material_ai_members WHERE batch_id=? AND ordinal=1 AND number='2'",[batch])[0].question_id;
const question=()=>query('SELECT * FROM question_bank_items WHERE id=?',[qid])[0];
const subset=()=>({
 paid:query('SELECT id,status,calls FROM material_ai_batches ORDER BY id'),
 originalInput:query('SELECT * FROM material_ai_units WHERE batch_id=? ORDER BY ordinal',[batch]),
 originalCrops:query('SELECT * FROM material_ai_page_crops WHERE batch_id=? ORDER BY ordinal,number',[batch]),
 originalReceipts:query('SELECT * FROM material_ai_response_receipts WHERE batch_id=? ORDER BY id',[batch]),
 unrelated:sha(JSON.stringify(query('SELECT * FROM question_bank_items WHERE id<>? ORDER BY id',[qid]))),
 originalPdf:sha(fs.readFileSync(resource.local_path))
});
assert.equal(query("SELECT count(*) n FROM material_folder_ai WHERE status='running'")[0].n,0);
assert.equal(query("SELECT count(*) n FROM material_ai_batches WHERE status IN ('running','pending')")[0].n,0);
const report={ok:false,checks:[],runtime:identity,mainSha:sha(fs.readFileSync(main)),addedCalls:0,errors:[]};
const save=()=>fs.writeFileSync(path.join(result,'summary.json'),JSON.stringify(report,null,2));
const pass=text=>{report.checks.push(text);save();console.log('PASS '+text);};
const audit=()=>query('SELECT * FROM material_ai_choice_rechecks WHERE question_id=?',[qid])[0];
const wait=async(fn)=>{
 for(let i=0;i<240;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,250));}
 throw Error('Fixture did not reach expected local audit');
};
await backup(db,path.join(result,'pre-action.sqlite'));
const immutable=subset(),before=question();
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const key of ['DEEPSEEK_API_KEY','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'])delete env[key];
 app=await electron.launch({args:[main,'--user-data-dir='+path.join(result,'profile')],env,cwd:process.cwd(),timeout:90000});
 page=await app.firstWindow();
 page.setDefaultTimeout(45000);page.on('pageerror',error=>report.errors.push(error.message));
}
async function openBatch(){
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(resource.title);
 await page.getByTestId('materials-refresh').click();
 await page.getByTestId('material-'+resource.id).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 await openMaterialDisclosure(page.getByTestId('material-structure-panel'));
 const panel=page.getByTestId('material-ai-panel');await openMaterialDisclosure(panel);
 const card=panel.locator('[data-batch-id="'+batch+'"]');await card.waitFor();return card;
}
try{
 await launch();
 const card=await openBatch();
 if(!audit()){
  assert.equal(before.document_json,'');
  const t=performance.now();const action=card.getByTestId('material-ai-recheck-source-layout');await action.click();
  await wait(()=>audit()?.policy==='figure-label-spacing.v1');report.localActionMs=Math.round(performance.now()-t);
 }
 assert.equal(audit().policy,'figure-label-spacing.v1');
 const q=question(),{archive_json:_,document_json:__,...after}=q;
 const old=JSON.parse(audit().before_json);
 const {archive_json:___,document_json:____,...oldFields}=old;
 assert.deepEqual({...after},oldFields);
 const archive=JSON.parse(q.archive_json), doc=JSON.parse(q.document_json);
 assert.equal(archive.state,'ai_needs_review');assert.equal(archive.sourceChecked,false);
 assert(archive.issues.includes('incomplete_question'));assert(doc.context.sourceContent.crops.length===2);
 assert.deepEqual(subset(),immutable);
 pass('Existing Materials action derives the single illustrated document and protects all original responses and other questions.');
 await app.close();app=undefined;await launch();
 await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).click();
 await page.getByTestId('question-notebook-filter-toggle').click();
 await page.getByTestId('question-notebook-source-candidates').check();
 await page.getByTestId('question-notebook-search').fill('F甲<F乙');
 const item=page.getByTestId('question-notebook-card-'+qid);
 await item.waitFor();await item.getByTestId('question-original-open').click();
 const images=item.getByTestId('question-original-image');
 await wait(async()=>await images.count()>=2);
 const recovered=await images.evaluateAll(all=>all.map(i=>i.getAttribute('src')));
 const expected=doc.context.sourceContent.crops.map(c=>c.sha256);
 assert(expected.every(s=>recovered.some(src=>src?.startsWith('data:image/png;base64,')&&sha(Buffer.from(src.split(',')[1],'base64'))===s)));
 assert.deepEqual(subset(),immutable);
 assert.deepEqual(report.errors,[]);
 pass('Restart and the actual notebook validate the same two PNGs while retaining genuine review issues.');
 report.ok=true;save();console.log(JSON.stringify({result, ...report}));
}catch(error){save();console.error('Evidence directory '+result);throw error;}
finally{await app?.close();db.close();}

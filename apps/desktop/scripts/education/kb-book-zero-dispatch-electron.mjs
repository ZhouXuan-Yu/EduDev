import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const root=fs.realpathSync(process.argv[2]),isolated=path.relative(fs.realpathSync(os.tmpdir()),root);
assert(isolated.startsWith('kb-structure-batch-')&&!isolated.includes(path.sep),'Use the cumulative isolated test library');
const baseline=process.argv.includes('--baseline'),verifyExisting=process.argv.includes('--verify-existing');
assert(!(baseline&&verifyExisting));
const data=path.join(root,'data'),dbFile=path.join(data,'app.db');
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const sha=content=>createHash('sha256').update(content).digest('hex');
const all=(sql,...params)=>{
 const db=new DatabaseSync(dbFile,{readOnly:true,timeout:5000});
 try{return db.prepare(sql).all(...params).map(row=>({...row}));}finally{db.close();}
};
function resource(suffix,search=suffix){
 const [r]=all('SELECT id,content_hash version,local_path FROM teacher_resources WHERE original_file_name LIKE ?','%'+suffix);
 assert(r,'Missing real test resource: '+suffix);
 const original=fs.realpathSync(r.local_path);
 assert.equal(path.dirname(original).toLowerCase(),path.join(data,'teacher_resources').toLowerCase());
 assert.equal(sha(fs.readFileSync(original)),r.version);
 return {...r,search};
}
const paper=resource('2025年上海高考数学试卷.pdf','2025年上海高考数学试卷');
const key=resource('2025年上海高考数学答案.pdf','2025年上海高考数学答案');
const processedPaper=resource('buoyantforce.pdf');
const processedKey=resource('buoyantforce_answer.pdf');
const [failure]=all(`SELECT b.id,b.status batchStatus,b.calls,u.status,u.error,u.dispatched_at
 FROM material_ai_batches b JOIN material_ai_units u ON u.batch_id=b.id WHERE b.resource_id=?`,key.id);
assert.deepEqual({...failure,id:undefined},
 {id:undefined,batchStatus:'attention',calls:0,status:'failed',error:'privacy_blocked',dispatched_at:0});
assert.equal(all('SELECT COUNT(*) n FROM material_ai_response_receipts WHERE batch_id=?',failure.id)[0].n,0);
assert(all('SELECT SUM(calls) n FROM material_ai_batches WHERE resource_id=?',processedKey.id)[0].n>0);
const history=()=>sha(JSON.stringify([
 all('SELECT * FROM material_ai_batches WHERE resource_id IN (?,?) ORDER BY id',key.id,processedKey.id),
 all('SELECT u.* FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id WHERE b.resource_id IN (?,?) ORDER BY u.batch_id,u.ordinal',key.id,processedKey.id),
 all('SELECT * FROM material_ai_task_keys WHERE batch_id=?',failure.id),
 all('SELECT * FROM material_folder_ai_units WHERE ai_batch_id=?',failure.id),
 all('SELECT * FROM material_ai_response_receipts WHERE batch_id=?',failure.id),
 all('SELECT id,calls FROM material_ai_batches ORDER BY id'),
]));
const originalHistory=history(),originalPairs=all('SELECT * FROM material_book_pairs');
assert.equal(originalPairs.length,verifyExisting?1:0);
let app;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),
  OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await electron.launch({args:[entry,'--user-data-dir='+path.join(root,'profile'),
  '--host-resolver-rules=MAP api.deepseek.com ~NOTFOUND'],cwd:root,env,timeout:90000});
 const page=await app.firstWindow();
 page.setDefaultTimeout(20000);
 await productEntry(page,'materials').click();
 return page;
}
async function open(page,source){
 await page.getByTestId('materials-search').fill(source.search);
 await page.getByTestId('material-'+source.id).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 const panel=page.getByTestId('material-book-panel');
 await openMaterialDisclosure(panel);
 return panel;
}
async function link(page,source,answer){
 const panel=await open(page,source);
 await panel.getByTestId('material-book-query').fill(answer.search);
 await panel.getByTestId('material-book-search').click();
 await panel.getByTestId('material-book-select').selectOption(answer.id);
 await panel.getByTestId('material-book-link').click();
 return panel;
}
async function bothRoles(page){
 const pairs=await page.evaluate(ids=>Promise.all(ids.map(id=>window.omniEdu.getMaterialBookPair(id))),[paper.id,key.id]);
 for(const [i,kind] of ['questions','answers'].entries()){
  assert(pairs[i].current);
  assert.deepEqual(pairs[i].role,{kind,questionId:paper.id,questionVersion:paper.version,answerId:key.id,answerVersion:key.version,revision:1});
 }
}
try{
 let page=await launch();
 const paid=await link(page,processedPaper,processedKey);
 await paid.getByRole('alert').filter({hasText:'已有未完成AI任务或按其他角色整理'}).waitFor();
 if(baseline){
  const refused=await link(page,paper,key);
  await refused.getByRole('alert').filter({hasText:'已有未完成AI任务或按其他角色整理'}).waitFor();
  assert.deepEqual(all('SELECT * FROM material_book_pairs'),originalPairs);
 }else{
  const linked=verifyExisting?await open(page,paper):await link(page,paper,key);
  await linked.getByTestId('material-book-linked').waitFor();
  await bothRoles(page);
  assert.equal(all('SELECT COUNT(*) n FROM material_book_pairs WHERE active=1')[0].n,1);
  await app.close();app=undefined;
  page=await launch();
  const counterpart=await open(page,key);
  await counterpart.getByTestId('material-book-linked').waitFor();
  await bothRoles(page);
 }
 assert.equal(history(),originalHistory);
 console.log(JSON.stringify({ok:true,baseline,newPair:baseline?0:1,paidHistoryBlocked:true,
  oldHistoryPreserved:true,providerCalls:0,buildSha256:sha(fs.readFileSync(entry))}));
}finally{
 await app?.close();
}

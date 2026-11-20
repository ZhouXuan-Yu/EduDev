import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

const root=fs.realpathSync(process.argv[2]);
const isolated=path.relative(fs.realpathSync(os.tmpdir()),root);
assert(isolated.startsWith('kb-structure-batch-')&&!isolated.includes(path.sep),
  'Use the cumulative isolated directory recovery fixture');
const data=path.join(root,'data');
const file=path.join(data,'app.db');
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const baseline=process.argv.includes('--baseline');
const verifyExisting=process.argv.includes('--verify-existing');
function all(sql,...args){
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...args).map(row=>({...row}));}finally{db.close();}
}
const rows=()=>all(`SELECT q.*,r.original_file_name, s.engine,c.document_json frozen_document,
  json_extract(q.archive_json,'$.number') number
  FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
  JOIN material_structure_jobs s ON s.resource_id=m.resource_id
  JOIN teacher_resources r ON r.id=m.resource_id
  JOIN material_structure_questions c ON c.generation=s.generation AND
    c.id=CASE WHEN json_valid(q.archive_json) THEN json_extract(q.archive_json,'$.structure.candidateId') END
  WHERE CASE WHEN json_valid(q.archive_json) THEN
    json_extract(q.archive_json,'$.structure.generation')=s.generation
    AND json_extract(q.archive_json,'$.state')='rule_extracted'
  ELSE 0 END AND NOT EXISTS(SELECT 1 FROM material_structure_hidden_questions h WHERE h.question_id=q.id)
  AND (r.original_file_name LIKE '%2024年上海市初中学业水平考试数学试卷%LaTeX重排.pdf'
    OR r.original_file_name LIKE '%2022年上海中考数学真题及答案.docx')
  ORDER BY q.id`);
const frozen=()=>all(`SELECT id,archive_json,document_json,question_type,updated_at FROM question_bank_items
  WHERE CASE WHEN json_valid(archive_json) THEN json_extract(archive_json,'$.sourceChecked')=1 ELSE 0 END ORDER BY id`);
const bills=()=>all('SELECT id,calls FROM material_ai_batches ORDER BY id');
const expected = new Map();
for(const row of rows()){
  const isPdf=row.original_file_name.endsWith('.pdf');
  if(isPdf&&['1','3','4','9'].includes(row.number))expected.set(row.id,{old:row,type:row.number==='9'?'填空题':'选择题'});
  if(!isPdf&&['7','8','9','10'].includes(row.number))expected.set(row.id,{old:row,type:'填空题'});
}
assert.equal(expected.size,8);
const before=rows();
assert.equal([...expected.values()].filter(({old,type})=>old.question_type!==type).length,verifyExisting?0:8);
const checked=frozen();
const originalBills=bills();
let app;
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),
    OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
  for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
  app=await electron.launch({args:[entry,'--user-data-dir='+path.join(root,'profile'),
    '--host-resolver-rules=MAP api.deepseek.com ~NOTFOUND'],env,cwd:root,timeout:90000});
  const page=await app.firstWindow();
  page.setDefaultTimeout(25000);
  return page;
}
const current=()=>rows().filter(row=>expected.has(row.id));
async function waitForTypes(){
  const end=Date.now()+35000;
  do{
    const found=current();
    if(found.length===expected.size&&found.every(row=>row.question_type===expected.get(row.id).type))return found;
    await delay(250);
  }while(Date.now()<end);
  throw Error('Printed question type mismatch: '+JSON.stringify(current().map(row=>[row.original_file_name,row.number,row.question_type])));
}
async function notebook(page,row,expectedType){
  const query=row.stem.split('\n')[0].slice(0,12);
  await page.getByTestId('question-notebook-search').fill(query);
  await page.getByTestId('question-notebook-card-'+row.id).waitFor();
  const read=await page.evaluate(async ({query,id,expectedType})=>{
    const notebook=await window.omniEdu.listQuestionNotebook({query});
    const typed=await window.omniEdu.listQuestionNotebook({query,questionType:expectedType});
    const other=await window.omniEdu.listQuestionNotebook({query,questionType:expectedType==='填空题'?'选择题':'填空题'});
    const formal=await window.omniEdu.searchQuestionBank({query});
    return {type:notebook.items.find(item=>item.id===id)?.questionType,
      typed:typed.items.some(item=>item.id===id),other:other.items.some(item=>item.id===id),
      formal:formal.some(item=>item.id===id)};
  },{query,id:row.id,expectedType});
  assert.deepEqual(read,{type:expectedType,typed:true,other:false,formal:false});
}
try{
  let page=await launch();
  await productEntry(page,'teaching').click();
  await page.getByRole('button',{name:'题本',exact:true}).click();
  if(baseline){
    await delay(2500);
    assert.deepEqual(rows(),before);
    await notebook(page,before.find(row=>row.number==='9'&&row.original_file_name.endsWith('.pdf')),'');
    console.log(JSON.stringify({baseline:true,unchanged:expected.size}));
  }else{
    const updated=await waitForTypes();
    for(const row of updated){
      const {old,type}=expected.get(row.id);
      const oldArchive=JSON.parse(old.archive_json);
      const newArchive=JSON.parse(row.archive_json);
      assert.deepEqual(newArchive,{...oldArchive,issues:oldArchive.issues.filter(issue=>issue!=='missing_type')});
      assert.deepEqual({...row,archive_json:old.archive_json,question_type:old.question_type,updated_at:old.updated_at},old);
      assert.equal(row.document_json,row.frozen_document);
      assert.equal(newArchive.sourceChecked,false);
      assert.equal(newArchive.state,'rule_extracted');
      await notebook(page,row,type);
    }
    assert.deepEqual(rows().filter(row=>!expected.has(row.id)),before.filter(row=>!expected.has(row.id)));
    await app.close(); app=undefined;
    page=await launch();
    assert.deepEqual(current(),updated);
    assert.deepEqual(frozen(),checked);
    console.log(JSON.stringify({ok:true,corrected:updated.length,unchangedChecked:checked.length,
      formalNew:0,restarted:true,buildSha256:createHash('sha256').update(fs.readFileSync(entry)).digest('hex')}));
  }
  assert.deepEqual(bills(),originalBills);
}finally{
  await app?.close();
}

import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
const {WORD_PREAMBLE_EXPANDED_QUESTION_POLICY,WORD_PREAMBLE_QUESTION_POLICY}=await import('../../src/shared/material-word.ts');

const root=fs.realpathSync(process.argv[2]),isolated=path.relative(fs.realpathSync(os.tmpdir()),root);
assert(isolated.startsWith('kb-structure-batch-')&&!isolated.includes(path.sep),'Use the cumulative isolated test directory');
const data=path.join(root,'data'),dbFile=path.join(data,'app.db');
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const verifyExisting=process.argv.includes('--verify-existing');
const read=(sql,...args)=>{
 const db=new DatabaseSync(dbFile,{readOnly:true,timeout:5000});
 try{return db.prepare(sql).all(...args).map(row=>({...row}));}finally{db.close();}
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const [resource]=read("SELECT id,content_hash version,local_path FROM teacher_resources WHERE original_file_name LIKE '%2022年上海中考数学真题及答案.docx'");
assert(resource);
const originalPath=fs.realpathSync(resource.local_path);
assert(path.dirname(originalPath).toLowerCase()===path.join(data,'teacher_resources').toLowerCase());
assert.equal(hash(fs.readFileSync(originalPath)),resource.version);
const current=()=>read('SELECT digest,document_json FROM material_word_documents WHERE resource_id=?',resource.id)[0];
const historical=()=>read(`SELECT digest,document_json FROM material_word_document_versions
 WHERE resource_id=? AND version=? AND json_extract(document_json,'$.questionPolicy')=?`,resource.id,resource.version,WORD_PREAMBLE_EXPANDED_QUESTION_POLICY)[0];
const before=verifyExisting?historical():current();
assert(before);
const baseline=JSON.parse(before.document_json),beforeIndex=indexWordQuestions(baseline);
assert.equal(baseline.questionPolicy,WORD_PREAMBLE_EXPANDED_QUESTION_POLICY);
assert.equal(beforeIndex.questionTotal,25);
const expected=['B','D','B','D','A','C'];
const status=()=>({
 chunks:hash(JSON.stringify(read('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY id',resource.id))),
 teacher:hash(JSON.stringify(read("SELECT * FROM question_bank_items WHERE json_valid(archive_json) AND json_extract(archive_json,'$.sourceChecked')=1 ORDER BY id"))),
 receipts:hash(JSON.stringify(read("SELECT batch_id,ordinal,input_json,first_json,final_json,image_sha FROM material_ai_units WHERE batch_id IN(SELECT id FROM material_ai_batches WHERE resource_id=?) ORDER BY batch_id,ordinal",resource.id))),
 calls:read('SELECT id,calls FROM material_ai_batches ORDER BY id'),
});
const saved=status();
let app;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),
  OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await electron.launch({args:[entry,'--user-data-dir='+path.join(root,'profile'),
  '--host-resolver-rules=MAP api.deepseek.com ~NOTFOUND'],cwd:root,env,timeout:90000});
 const page=await app.firstWindow();
 page.setDefaultTimeout(25000);
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill('2022年上海中考数学真题及答案');
 await page.getByTestId('material-'+resource.id).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 await page.getByTestId('word-question-toggle').waitFor();
 return page;
}
const query=(page,ordinal)=>page.evaluate(({resource,ordinal})=>window.omniEdu.getMaterialWordQuestions({
 schemaVersion:'xiaozhi.word-question-source.v1',resourceId:resource.id,version:resource.version,ordinal,offset:ordinal-1,
}),{resource,ordinal});
async function recall(page){
 for(const [index,answer] of expected.entries()){
  const ordinal=index+1,item=await query(page,ordinal);
  const {source}=item;
  assert.equal(item.questionTotal,25);
  assert.equal(source.indexPolicy,WORD_PREAMBLE_QUESTION_POLICY);
  assert.equal(source.number,String(ordinal));
  assert.equal(source.canonical.answer,answer);
  assert.equal(source.canonical.analysis,'');
  assert.deepEqual(source.parts.question,beforeIndex.read(ordinal).parts.question);
  const [span]=source.parts.answer;
  assert.equal(source.parts.answer.length,1);
  const block=baseline.blocks.find(item=>item.id===span.blockId);
  assert(block&&block.kind==='paragraph');
  const literal=block.inlines.map(inline=>inline.text).join('');
  assert.equal(literal.slice(span.from,span.to),answer);
  assert(!source.issues.includes('separate_answers'));
 }
 assert.equal((await query(page,7)).source.canonical.answer,'');
}
try{
 let page=await launch();
 if(!verifyExisting){
  assert.equal((await query(page,1)).source.canonical.answer,'');
  await page.getByTestId('word-source-rebuild').click();
  await page.getByTestId('word-source-rebuild-status').filter({hasText:'Word 图文已整理'}).waitFor({timeout:240000});
 }
 await recall(page);
 await page.getByTestId('word-question-toggle').click();
 await page.getByTestId('word-question-select-1').click();
 await page.getByTestId('word-question-role-answer').click();
 assert.deepEqual((await page.getByTestId('word-question-role-content').innerText()).trim().split(/\n+/u),
  ['B','原文件来源']);
 assert.deepEqual(historical(),before);
 assert.notEqual(current().digest,before.digest);
 const updated=JSON.parse(current().document_json);
 for(const field of ['blocks','assets','warnings','unscopedWarnings'])
  assert.equal(hash(JSON.stringify(updated[field])),hash(JSON.stringify(baseline[field])),field);
 assert.deepEqual(status(),saved);
 const migrated=current().digest;
 assert.equal(hash(fs.readFileSync(originalPath)),resource.version);
 await app.close();app=undefined;
 page=await launch();
 assert.equal((await query(page,6)).source.canonical.answer,'C');
 assert.equal(current().digest,migrated);
 assert.deepEqual(historical(),before);
 assert.deepEqual(status(),saved);
 console.log(JSON.stringify({ok:true,total:25,withPrintedAnswers:expected.length,frozenOld:true,coldRead:true,
  providerCalls:0,buildSha256:hash(fs.readFileSync(entry))}));
}finally{
 await app?.close();
}

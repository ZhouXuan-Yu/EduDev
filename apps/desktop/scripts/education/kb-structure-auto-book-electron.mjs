import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";

const seed=fs.realpathSync(process.argv[2]);
assert.equal(path.dirname(seed).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());
assert.match(path.basename(seed),/^omni-folder-books-[a-z0-9]+$/i);
const fixture=JSON.parse(fs.readFileSync(path.join(seed,"report.json"),"utf8"));
assert(fixture.folderPairs&&fixture.cloudRequests===0);
// Answer receipts authenticate the file's physical identity. Use the owned fixture with its original files.
const root=fs.mkdtempSync(path.join(seed,"structure-auto-book-"));
const data=path.join(seed,"data"),dbPath=path.join(data,"app.db");
const snapshot=new DatabaseSync(dbPath,{readOnly:true});
try{snapshot.exec("VACUUM INTO '"+path.join(root,"before.db").replaceAll("'","''")+"'");}finally{snapshot.close();}

const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||"out","main/index.js");
const buildSha256=createHash("sha256").update(fs.readFileSync(entry)).digest("hex");
function read(statement,values=[]){
  const db=new DatabaseSync(dbPath,{readOnly:true,timeout:3000});
  try{return db.prepare(statement).all(...values);}finally{db.close();}
}
const [question]=read(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
  AND json_type(archive_json,'$.structure') IS NOT NULL AND json_extract(archive_json,'$.number')='1'`);
assert(question.stem.includes("观察烧杯")&&question.answer===""&&question.analysis==="");
const canonical=()=>read("SELECT * FROM question_bank_items WHERE id=?",[question.id])[0];
const originals=()=>read("SELECT * FROM material_ai_page_units ORDER BY rowid");
const calls=()=>read("SELECT id,calls FROM material_ai_batches ORDER BY id");
const sourceReceipts=originals(), providerLedger=calls();
const {questionVersion}=await import("../../src/main/education/question-context-provider.ts");
let app,requests=0;
async function launch(paused){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:"1",OMNI_EDU_E2E_VISIBLE:"0",
    OMNI_EDU_XIAOZHI_PI:"1",OMNI_EDU_SKIP_DOTENV:"1",OMNI_EDU_BOOK_ANSWER_WRITEBACK:paused?"0":"1"};
  for(const k of ["ELECTRON_RUN_AS_NODE","ELECTRON_RENDERER_URL","NODE_OPTIONS","DEEPSEEK_API_KEY"])delete env[k];
  app=await electron.launch({args:[entry,"--user-data-dir="+path.join(root,"profile")],env,timeout:90000});
  await app.evaluate(({net})=>{
    globalThis.autoBookTestRequests=0;
    for(const owner of [globalThis,net])owner.fetch=async url=>{
      if(String(url).includes("/chat/completions"))globalThis.autoBookTestRequests++;
      throw Error("Local book acceptance uses saved receipts");
    };
  });
  const page=await app.firstWindow();
  page.setDefaultTimeout(30000);
  return page;
}
async function close(){
  if(!app)return;
  requests+=await app.evaluate(()=>globalThis.autoBookTestRequests);
  await app.close();
  app=undefined;
}
async function until(readValue){
  const deadline=Date.now()+30000;
  do{
    const result=await readValue();
    if(result)return result;
    await delay(150);
  }while(Date.now()<deadline);
  throw Error("The background work did not reach the expected state");
}
async function notebook(page){
  await productEntry(page,"teaching").click();
  await page.getByRole("button",{name:"题本",exact:true}).filter({visible:true}).click();
  await page.getByTestId("question-notebook-search").fill(question.stem.slice(0,18));
  const card=page.getByTestId("question-notebook-card-"+question.id);
  await card.waitFor();
  return card;
}

try{
  let page=await launch(true);
  let card=await notebook(page);
  if(!JSON.parse(canonical().archive_json).sourceChecked){
    await card.getByTestId("question-original-open").click();
    await card.getByTestId("question-original-image").first().evaluate(image=>image.decode());
    await card.getByTestId("question-archive-edit-"+question.id).click();
    for(const [key,value] of Object.entries({subject:"物理",grade:"八年级",knowledgePoint:"沸点",questionType:"解答题"}))
      await card.getByTestId("question-archive-"+key).fill(value);
    await card.getByTestId("question-archive-difficulty").selectOption("easy");
    await card.getByTestId("question-archive-source-checked").check();
    await card.getByTestId("question-archive-save").click();
    await card.getByTestId("question-archive-save").waitFor({state:"hidden"});
  }
  if(JSON.parse(canonical().document_json).schemaVersion==="xiaozhi.question-document.v1"){
    await card.getByTestId("question-context-open").click();
    const fields={statement:question.stem,figures:"原图为盛水的烧杯。",subquestions:question.stem.split("\n").slice(1).join("\n")};
    for(const role of ["statement","formulas","tables","figures","choices","subquestions"]){
      if(fields[role])await card.getByTestId("projection-"+role+"-text").fill(fields[role]);
      await card.getByTestId("projection-"+role+"-state").selectOption(fields[role]?"provided":"not_applicable");
    }
    const checkbox=card.getByTestId("question-context-complete");
    await checkbox.locator("[data-slot=checkbox-content]").click();
    assert(await checkbox.getByRole("checkbox").isChecked());
    await card.getByTestId("question-context-save").click();
    await card.getByTestId("question-context-save").waitFor({state:"hidden"});
  }
  const before=canonical(),beforeDocument=JSON.parse(before.document_json);
  assert.equal(beforeDocument.schemaVersion,"xiaozhi.question-document.v2");
  assert.equal(before.answer,"");
  const pending=await until(()=>read("SELECT * FROM material_structure_book_work_v1 WHERE question_id=?",[question.id])[0]);
  await close();
  assert.equal(read("SELECT ticket FROM material_structure_book_work_v1 WHERE question_id=?",[question.id])[0].ticket,pending.ticket);
  const started=performance.now();
  page=await launch(false);
  card=await notebook(page);
  await card.getByTestId("question-notebook-answer-fold-"+question.id).getByRole("button").first().click();
  const match=card.getByTestId("structure-book-matches");
  await match.scrollIntoViewIfNeeded();
  const applied=match.locator('[data-testid="material-book-match-row"][data-state="applied"]');
  await applied.waitFor();
  await card.getByTestId("question-answer-origin").filter({hasText:"答案册原文"}).waitFor();
  const automaticMs=Math.round(performance.now()-started);
  const after=canonical(),document=JSON.parse(after.document_json);
  assert.match(after.answer,/100℃.*温度保持不变/u);
  assert.equal(document.answer.origin,"book_extracted");
  assert.equal(document.analysis.origin,"book_extracted");
  assert.deepEqual(document.context,beforeDocument.context);
  assert.deepEqual(document.blocks,beforeDocument.blocks);
  await applied.getByTestId("material-book-source-open").click();
  await applied.getByTestId("material-ai-page-text").waitFor();
  const saved=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),question.id);
  const evidence=await page.evaluate(query=>window.omniEdu.getQuestionContextSource(query),{
    schemaVersion:"xiaozhi.education.question-context.v1",questionId:question.id,version:questionVersion(saved),
  });
  assert(evidence.ok,JSON.stringify(evidence));
  assert.equal(evidence.value.question.answer,after.answer);
  assert.equal(read("SELECT count(*) n FROM material_book_answer_journal_v1 WHERE question_id=?",[question.id])[0].n,1);
  assert.deepEqual(originals(),sourceReceipts);
  assert.deepEqual(calls(),providerLedger);
  assert.equal(read("PRAGMA integrity_check")[0].integrity_check,"ok");
  await close();
  assert.equal(requests,0);
  console.log(JSON.stringify({ok:true,checks:3,root,buildSha256,automaticMs,newProviderRequests:requests,
    answerPage:document.answer.book?.source.page,answerBook:true}));
}finally{
  await close();
}

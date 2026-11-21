import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { _electron as electron } from "playwright";
import { DOCUMENT_STRUCTURE_ENGINE } from "../../src/shared/material-document-structure.ts";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const source=fs.realpathSync(process.argv[2]);
const verifyJoinedNumber=process.argv.includes("--joined-number");
assert.equal(path.extname(source).toLowerCase(),".pdf");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kb-wrapped-heading-"));
const data=path.join(root,"data"),profile=path.join(root,"profile"),folder=path.join(root,"资料");
const file=path.join(data,"app.db");
fs.mkdirSync(folder);
const input=path.join(folder,path.basename(source));
fs.copyFileSync(source,input);
const sha=filePath=>createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||"out","main/index.js");
const report={root,buildSha:sha(main),inputSha:sha(input),externalRequests:0,rendererErrors:[]};
function read(query,...args){
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  try{return db.prepare(query).all(...args);}finally{db.close();}
}
async function until(check){
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){
    const value=check();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error("Document structure did not reach a terminal state");
}
let app,page;
async function launch(width,height){
  const env={...process.env};
  for(const key of Object.keys(env)){
    if(/KEY|TOKEN|SECRET|CREDENTIAL/i.test(key)||key.startsWith("OMNI_EDU_")||
       ["NODE_OPTIONS","ELECTRON_RUN_AS_NODE","ELECTRON_RENDERER_URL"].includes(key))delete env[key];
  }
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve("../.."),
    OMNI_EDU_SKIP_DOTENV:"1",OMNI_EDU_E2E_DIALOG_MODE:"1",OMNI_EDU_E2E_VISIBLE:"0"});
  app=await electron.launch({args:[main,"--user-data-dir="+profile,"--host-resolver-rules=MAP * ~NOTFOUND"],cwd:root,env,timeout:90000});
  await app.evaluate(({net})=>{
    globalThis.externalRequests=0;
    globalThis.fetch=net.fetch=async()=>{globalThis.externalRequests++;throw Error("Local PDF test");};
  });
  page=await app.firstWindow();
  page.setDefaultTimeout(45000);
  page.on("pageerror",error=>report.rendererErrors.push(error.message));
  await page.setViewportSize({width,height});
  await productEntry(page,"materials").click();
}
async function close(){
  if(!app)return;
  report.externalRequests+=await app.evaluate(()=>globalThis.externalRequests);
  await app.close();
  app=undefined;
}
async function inspect(resourceId,heading,image){
  await page.getByTestId("material-"+resourceId).getByRole("button").click();
  await page.getByTestId("materials-section-questions").click();
  const structure=page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(structure);
  await structure.getByTestId("structure-paragraphs").getByText(heading.text,{exact:true}).waitFor();
  if(verifyJoinedNumber)
    await structure.getByTestId("structure-questions").getByText(/^题 9 · 第 1 页/).waitFor();
  if(image){
    await structure.getByRole("button",{name:"对照原始页图"}).click();
    await structure.getByTestId("structure-source-image").evaluate(img=>img.decode());
  }
}
try{
  await launch(1366,768);
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},folder);
  await page.getByTestId("materials-import-folder").click();
  const parsed=await until(()=>{
    const batch=read("SELECT status,error FROM material_import_batches WHERE root_path=?",folder)[0];
    if(batch?.status==="failed")throw Error(batch.error);
    const job=read("SELECT * FROM material_structure_jobs WHERE version=?",report.inputSha)[0];
    if(job?.status==="failed")throw Error(job.error);
    return ["partial","complete"].includes(job?.status)?job:undefined;
  });
  assert.equal(parsed.engine,DOCUMENT_STRUCTURE_ENGINE);
  const pages=read("SELECT body_json FROM material_structure_pages WHERE generation=? ORDER BY page",parsed.generation).map(row=>JSON.parse(row.body_json));
  const groups=read("SELECT body_json FROM material_structure_questions WHERE generation=? ORDER BY rowid",parsed.generation).map(row=>JSON.parse(row.body_json));
  const headings=pages.flatMap(p=>p.paragraphs.filter(h=>h.role==="heading"&&h.lineIds.length>1&&/^([一二三四]+)[、．.](填空题|选择题)/u.test(h.text)));
  assert(headings.some(h=>h.anchor.page===1&&h.text.startsWith("一、填空题")));
  assert(headings.some(h=>h.anchor.page===2&&h.text.startsWith("二、选择题")));
  for(const h of headings){
    const physical=pages[h.anchor.page-1].lines.filter(l=>h.lineIds.includes(l.id));
    assert.equal(physical.length,h.lineIds.length);
    assert(groups.every(q=>!q.paragraphIds.includes(h.id)));
    assert(groups.some(q=>q.section===h.text));
    assert.equal(h.rawText,h.lineIds.map(id=>physical.find(l=>l.id===id).text).join("\n"));
  }
  if(verifyJoinedNumber){
    const original=pages[0].lines.find(line=>line.text.startsWith("9.4个家长"));
    assert(original);
    const ninth=pages[0].paragraphs.find(h=>h.marker?.kind==="parent"&&h.marker.label==="9");
    const after=groups.find(q=>q.number==="9"),before=groups.find(q=>q.number==="8");
    assert(ninth.lineIds.includes(original.id));
    assert(after.stem.startsWith("4个家长"));
    assert(after.paragraphIds.includes(ninth.id)&&!before.paragraphIds.includes(ninth.id));
    assert(!before.stem.includes("9.4个家长"));
    report.separatedQuestion=true;
    report.extractedGroups=groups.length;
  }
  await inspect(parsed.resource_id,headings[0],true);
  await close();
  await launch(1920,1080);
  await inspect(parsed.resource_id,headings[0],false);
  assert.equal(read("SELECT generation FROM material_structure_jobs WHERE resource_id=?",parsed.resource_id)[0].generation,parsed.generation);
  await close();
  const [resource]=read("SELECT local_path FROM teacher_resources WHERE id=?",parsed.resource_id);
  assert.equal(sha(resource.local_path),report.inputSha);
  assert.equal(report.externalRequests,0);
  assert.deepEqual(report.rendererErrors,[]);
  Object.assign(report,{ok:true,pages:pages.length,headings:headings.length,assignedGroups:groups.filter(q=>headings.some(h=>q.section===h.text)).length});
}catch(error){
  report.error=String(error.stack||error);
  if(page)await page.screenshot({path:path.join(root,"failure.png")}).catch(()=>{});
  process.exitCode=1;
}finally{
  await close();
  fs.writeFileSync(path.join(root,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}

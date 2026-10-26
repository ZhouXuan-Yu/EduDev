import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(tmpdir(),'omni-edu-ai-batch-'));
const folder=path.join(output,'教师资料'),data=path.join(output,'data'),profile=path.join(output,'profile');fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder,'初二算术.md'),'学科：数学\n年级：初二\n知识点：算术\n题型：解答题\n难度：中等\n\n第1题 计算 7 + 8。\n【答案】15\n【解析】7与8相加得到15。\n\n第2题 计算 12 - 5。\n\n第3题 如图，求三角形面积。\n【答案】6\n【解析】底乘高除以2。');
const base={subject:'数学',grade:'初二',knowledgePoint:'四则运算',questionType:'解答题',difficulty:'medium',answerOrigin:'source',analysisOrigin:'source',requiresImage:false,issues:[]};
const result={schemaVersion:'xiaozhi.material-ai-response.v1',outcome:'questions',questions:[
  {...base,number:'1',stem:'计算 7 + 8。',answer:'15',analysis:'7与8相加得到15。'},
  {...base,number:'2',stem:'计算 12 - 5。',answer:'7',analysis:'12减5等于7。',answerOrigin:'ai_generated',analysisOrigin:'ai_generated'},
  {...base,number:'3',stem:'如图，求三角形面积。',answer:'6',analysis:'底乘高除以2。',requiresImage:true,issues:['requires_image']}
]};
let app,page,id;const report={output,checks:[],rendererErrors:[],starts:0,scope:'Real Electron UI, encrypted Windows settings, repository/SQLite/source/paper/readback. Qwen HTTP intercepted in the isolated test process with synthetic responses; no real model call or quality claim.'};
const note=s=>{report.checks.push(s);console.log('PASS '+s);};
async function until(fn,ms=90000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await delay(150);}throw Error('Timed out');}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data};for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'});
  app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});report.starts++;
  await app.evaluate((_electron,result)=>{
    globalThis.__aiBatchProbe={mode:'normal',calls:0,payloads:[]};const ordinary=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{
      if(String(url)!=='https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')return ordinary(url,options);
      const state=globalThis.__aiBatchProbe,body=JSON.parse(options.body);state.calls++;state.payloads.push(body);
      const content=JSON.parse(body.messages[1].content[0].text);
      if(state.mode==='hold_final'&&content.firstDraft)await new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('controlled interruption')),{once:true});});
      const payload=body.messages[1].content.some(v=>v.type==='image_url')?{schemaVersion:'xiaozhi.material-ai-response.v1',outcome:'needs_review',questions:[]}:result;
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(payload)}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    };
  },result);
  page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});
}
const ai=()=>page.locator('[data-testid="material-ai-panel"]:visible');
const nav=space=>page.locator(`[data-testid="product-nav-${space}"]:visible`).click();
const batches=()=>page.evaluate(id=>window.omniEdu.getMaterialAiBatches(id),id);
const entries=()=>page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:30}));
const notebook=async()=>{await nav('teaching');await page.getByTestId('nav-question_notebook').click();};
async function openAi(){await nav('materials');await page.getByTestId('material-'+id).click();await ai().locator('summary').click();}
async function consent(){await ai().getByTestId('material-ai-public').check();await ai().getByTestId('material-ai-consent').check();await ai().getByTestId('material-ai-create').click();}
try{
  await launch();await nav('materials');await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByTestId('materials-import-folder').click();
  id=await until(async()=>{const r=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));return r.resources.find(r=>r.parseStatus==='ready')?.id;});
  await page.getByTestId('material-'+id).click();await until(async()=>await ai().count()===1);await delay(1800);assert.equal(await ai().count(),1);await ai().locator('summary').click();
  assert(await ai().getByTestId('material-ai-create').isDisabled());assert.equal(await app.evaluate(()=>globalThis.__aiBatchProbe.calls),0);
  await ai().getByTestId('material-ai-key').fill('synthetic-private-test-key');await ai().getByTestId('material-ai-save-settings').click();
  await until(async()=>await page.evaluate(()=>window.omniEdu.getMaterialAiSettings()).then(s=>s.configured));assert.equal(await ai().getByTestId('material-ai-key').inputValue(),'');
  assert(await ai().getByTestId('material-ai-create').isDisabled());await consent();
  const first=await until(async()=>{const rows=await batches();return rows[0]?.status==='attention'?rows[0]:null;});assert.equal(first.calls,2);assert.equal(first.questions,3);assert.equal(first.review,1);
  const initial=(await entries()).items.filter(q=>q.archive?.ai?.batchId===first.id);assert.equal(initial.length,3);assert.equal(initial.filter(q=>q.archive.state==='ai_final').length,2);assert(initial.find(q=>q.archive.number==='3').archive.issues.includes('requires_image'));
  note('Teacher configures encrypted model, explicitly authorizes one batch and receives 2 complete AI text questions plus 1 isolated figure question');
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const raw=db.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.material-ai.v1'").get().value_json;assert(!raw.includes('synthetic-private-test-key'));assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_units WHERE first_json<>\'\' AND final_json<>\'\'').get().n,1);}finally{db.close();}
  await notebook();await page.getByTestId('question-ai-provenance').first().waitFor();const visual=initial.find(q=>q.archive.number==='3');await page.getByTestId('question-archive-edit-'+visual.id).click();await page.getByTestId('question-archive-save').click();await until(async()=>(await entries()).items.find(q=>q.id===visual.id)?.archive.state==='teacher_edited');assert((await entries()).items.find(q=>q.id===visual.id).archive.issues.includes('requires_image'));
  await page.getByTestId('question-archive-'+initial[0].id).getByTestId('pi-material-source-open').click();await page.getByTestId('materials-detail').waitFor();
  note('AI provenance and raw drafts persist; routine teacher save cannot clear figure restriction, and source link opens real original context');
  await notebook();await page.getByTestId('nav-paper').click();await page.getByTestId('paper-grade').fill('初二');await page.getByRole('button',{name:'移除此部分',exact:true}).nth(2).click();await page.getByRole('button',{name:'移除此部分',exact:true}).nth(1).click();
  await page.getByTestId('paper-section-type').fill('解答题');await page.getByTestId('paper-section-kp').fill('四则运算');await page.getByTestId('paper-section-count').fill('2');await page.getByTestId('paper-section-points').fill('5');await page.getByTestId('paper-total').fill('10');await page.getByTestId('paper-generate').click();
  await until(async()=>(await page.getByTestId('paper-summary').innerText()).includes('2 题'));assert.equal(await page.getByTestId('paper-question').count(),2);await page.getByTestId('paper-confirm').click();await page.getByTestId('paper-confirmed').waitFor();
  note('Existing paper UI selects the 2 source-validated AI questions and requires one whole-paper teacher confirmation');
  await openAi();await app.evaluate(()=>{globalThis.__aiBatchProbe.mode='hold_final';});await consent();
  const second=await until(async()=>{const rows=await batches();return rows.find(r=>r.id!==first.id&&r.calls===2);});
  await ai().getByTestId('material-ai-batch').filter({hasText:'正在整理'}).getByRole('button',{name:'暂停此批次'}).click();await until(async()=>(await batches()).find(b=>b.id===second.id)?.unknown===1);
  const before=await app.evaluate(()=>globalThis.__aiBatchProbe.calls);await delay(2000);assert.equal(await app.evaluate(()=>globalThis.__aiBatchProbe.calls),before);
  await page.screenshot({path:path.join(output,'ai-paused-1366.png'),fullPage:true});await app.close();app=undefined;await launch();await openAi();await delay(1800);assert.equal(await app.evaluate(()=>globalThis.__aiBatchProbe.calls),0);
  assert.equal((await batches()).find(b=>b.id===second.id).unknown,1);await ai().getByTestId('material-ai-retry-unknown').click();await until(async()=>{const b=(await batches()).find(b=>b.id===second.id);return b?.status==='attention'&&b.calls===3&&b.questions===3;});assert.equal(await app.evaluate(()=>globalThis.__aiBatchProbe.calls),1);
  note('Pause during final response persists unknown state across restart; no automatic repeat, explicit duplicate-charge retry sends only final phase');
  await page.setViewportSize({width:1920,height:1080});await ai().getByTestId('material-ai-create').scrollIntoViewIfNeeded();const box=await ai().getByTestId('material-ai-create').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=1920);await page.screenshot({path:path.join(output,'ai-readback-1920.png'),fullPage:true});
  await notebook();await page.getByTestId('nav-paper').click();await page.getByTestId('paper-saved').first().click();await page.getByTestId('paper-confirmed').waitFor();assert.equal((await entries()).items.filter(q=>q.archive?.ai).length,6);assert.deepEqual(report.rendererErrors,[]);
  note('Cold readback retains both AI batches, six provenance-bearing questions and centrally confirmed paper; controls remain reachable at both desktop sizes');
  // Own tiny valid PDF. This is a page/PNG/privacy transport check, not a model-quality fixture.
  const pdfFile=path.join(output,'owned-page.pdf'),lines=['1. Calculate 7 + 8?', 'Answer: 15.', 'Explanation: Add seven and eight.', ...Array.from({length:12},(_,i)=>'Teaching material paragraph '+i+' for local original preview.')];
  const stream='BT /F1 14 Tf 48 760 Td '+lines.map((line,i)=>(i?'0 -24 Td ':'')+'('+line+') Tj').join('\n')+' ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream'];
  let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';fs.writeFileSync(pdfFile,pdf);
  await nav('materials');await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},pdfFile);await page.getByTestId('materials-import').click();
  const pdfId=await until(async()=>{const rows=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));return rows.resources.find(r=>r.originalFileName==='owned-page.pdf')?.id;});
  await until(async()=>await page.evaluate(id=>window.omniEdu.getMaterialPdfStatus(id),pdfId).then(s=>s?.state==='complete'),180000);await page.getByTestId('material-'+pdfId).click();await ai().locator('summary').click();
  await ai().getByTestId('material-ai-images').check();await consent();
  const visualBatch=await until(async()=>{const rows=await page.evaluate(id=>window.omniEdu.getMaterialAiBatches(id),pdfId);return rows[0]?.status==='attention'?rows[0]:null;},180000);assert.equal(visualBatch.calls,2);
  const sent=await app.evaluate(()=>globalThis.__aiBatchProbe.payloads.filter(b=>b.messages[1].content.some(v=>v.type==='image_url')).map(b=>b.messages[1].content.find(v=>v.type==='image_url').image_url.url));assert.equal(sent.length,2);assert.equal(sent[0],sent[1]);const png=Buffer.from(sent[0].split(',')[1],'base64');assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert(png.readUInt32BE(16)>0);assert(png.length<4*1048576);
  note('Explicit page-image batch renders the actual managed PDF through frozen worker and delivers identical bounded PNG plus OCR/native text to both intercepted model phases');
  report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

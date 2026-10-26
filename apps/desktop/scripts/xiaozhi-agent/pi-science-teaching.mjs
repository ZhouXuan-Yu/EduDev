import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
const {renderScienceFigure}=await import('../../src/main/xiaozhi-agent/science-figure.ts');
const {reopenScienceDemo}=await import('../../src/main/xiaozhi-agent/science-demo.ts');
const {readScienceTeaching}=await import('../../src/main/xiaozhi-agent/science-teaching.ts');
const {validScienceTeaching}=await import('../../src/shared/science-teaching.ts');
const {validScienceFigure}=await import('../../src/shared/science-figure.ts');
const {createTextChangeState}=await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/science-teaching-'));
const teaching={schemaVersion:'xiaozhi.science-teaching.v1',audience:'八年级',objective:'解释散热片增加表面积有助于散热',observation:'比较平整底板和多片肋片，哪种接触空气的面积更大？',steps:[
 {part:'底板',explanation:'底板与发热物体接触，热量通过热传导传到肋片。',question:'热量从哪里传到肋片？',notes:'先请学生指出热源与底板的接触面，不把热量传递说成温度流动。'},
 {part:'散热肋片',explanation:'在其他条件相近时，肋片增加与空气接触的表面积，有助于向周围散热。',question:'如果材料相同，把底板做成多片肋片有什么好处？',notes:'提醒学生还受空气流动、温差和材料影响，不能只凭片数判断散热快慢。'}],
 check:{question:'同样材料和温差下，为什么散热片通常设计成许多薄肋片？',answer:'参考答案专属：增大与空气接触的面积，在其他条件相近时有助于散热。'}};
const figure={path:'教学散热片.html',title:'散热片为什么有很多肋片',caption:'原理示意，不代表温度测量或散热仿真。',parts:[{kind:'box',x:0,y:0,z:0,w:120,d:60,h:4,tone:'lo',label:'底板'},{kind:'box',x:0,y:5,z:4,w:1.5,d:50,h:24,tone:'lit',label:'散热肋片',repeat:{count:40,dx:3,dy:0,dz:0}}],teaching};
const report={success:false,checks:[],boundary:'Validated teaching data, real geometry and sandboxed Chromium only. Authored educational fixture, no new model or teacher acceptance.'};
let browser;
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 await check('Teaching schema rejects unknown fields, missing/blank text, excess steps, raw markup and future versions',()=>{
  assert(validScienceTeaching(teaching));
  for(const bad of [{...teaching,schemaVersion:'future'},{...teaching,objective:' '},{...teaching,extra:true},{...teaching,steps:[]},{...teaching,steps:Array(5).fill(teaching.steps[0])},{...teaching,steps:[{...teaching.steps[0],notes:'<script>'}]},{...teaching,check:{...teaching.check,answer:'x'.repeat(141)}}])assert(!validScienceTeaching(bad));
 });
 await check('Actual approval ledger rejects the first draft, previews the corrected teaching and saves only its confirmed exact bytes',async()=>{
  const workspace=path.join(output,'workspace'),dataRoot=path.join(output,'data');fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
  const db=new DatabaseSync(path.join(output,'approval.db')),sessionId='aisession_'+randomUUID();
  const sql={run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),all:async(s,v=[])=>db.prepare(s).all(...v)};
  try{
   db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY)');db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);
   const state=createTextChangeState(sql);await state.migrate();const service=createTextChangeService({state,dataRoot,workspace:async()=>workspace,isCurrent:()=>true});
   const decision=(row,action)=>service.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action});
   const first=await service.propose(sessionId,'teaching-run','first-draft',figure,undefined,true);assert.deepEqual(fs.readdirSync(workspace),[]);
   await decision(first,'reject');assert.deepEqual(fs.readdirSync(workspace),[]);
   const corrected={...figure,path:'审阅后教学散热片.html',teaching:{...teaching,objective:'比较接触空气的面积，解释散热片的作用'}};
   const row=await service.propose(sessionId,'corrected-run','corrected-draft',corrected,undefined,true),preview=await service.review(sessionId,row.id);
   assert.equal(preview.after,renderScienceFigure(corrected).content);assert.deepEqual(fs.readdirSync(workspace),[]);
   const approved=await decision(row,'approve');await service.apply(sessionId,approved.id);
   const saved=path.join(workspace,corrected.path);assert.equal(fs.readFileSync(saved,'utf8'),preview.after);
   report.approvedSource=saved;report.correctedTeaching=corrected.teaching;
  }finally{db.close();}
 });
 await check('Figure validates teaching against actual part categories and rejects imaginary/malformed teaching',()=>{
  assert(validScienceFigure(figure));
  assert(!validScienceFigure({...figure,teaching:{...teaching,steps:[{...teaching.steps[0],part:'不存在的装置'}]}}));
  assert(!validScienceFigure({...figure,teaching:undefined}));
 });
 let html;
 await check('Approved bytes carry the identical versioned teaching data through save/reopen; old HTML remains supported',()=>{
  html=renderScienceFigure(figure).content;fs.writeFileSync(path.join(output,figure.path),html);fs.writeFileSync(path.join(output,'fixture.json'),JSON.stringify(figure,null,2));
  assert(Buffer.byteLength(html)<=65536);assert.equal(reopenScienceDemo(html),html);
  const svg=renderScienceFigure({...figure,path:'教学.svg'}).content;assert.deepEqual(readScienceTeaching(svg),teaching);
  const {teaching:_,...legacy}=figure;assert.equal(readScienceTeaching(renderScienceFigure({...legacy,path:'old.svg'}).content),undefined);
  const old=renderScienceFigure(legacy).content;assert.equal(reopenScienceDemo(old),old);
  const entry=svg.match(/<metadata id="science-teaching">[\s\S]*?<\/metadata>/)[0];
  assert.throws(()=>readScienceTeaching(svg.replace(entry,entry+entry)),/unsupported/);
  assert.throws(()=>readScienceTeaching(svg.replace(entry,'<metadata id="science-teaching">e30=</metadata>')),/unsupported/);
 });
 browser=await chromium.launch();const page=await browser.newPage();const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.setContent('<iframe sandbox="allow-scripts" style="width:100%;height:850px"></iframe>');await page.locator('iframe').evaluate((f,html)=>f.srcdoc=html,html);const frame=page.frameLocator('iframe');
 await check('Teacher preview shows audience, objective and exact explanation, with reference answers collapsed',async()=>{
  await frame.getByRole('button',{name:'讲解2 · 散热肋片',exact:true}).click();assert.equal(await frame.locator('#lesson-explanation').innerText(),teaching.steps[1].explanation);
  assert.equal(await frame.locator('#lesson-question').innerText(),teaching.steps[1].question);assert.equal(await frame.locator('details').getAttribute('open'),null);
  assert(!await frame.getByText(teaching.check.answer,{exact:true}).isVisible());
  await frame.getByText('教师讲解建议与参考答案',{exact:true}).click();assert(await frame.getByText(teaching.check.answer,{exact:true}).isVisible());
  await frame.getByText('教师讲解建议与参考答案',{exact:true}).click();assert.match(await frame.locator('output').innerText(),/讲解2.*散热肋片/);
 });
 await check('Teaching navigation works on a narrow classroom view and requests zero HTTP',async()=>{
  for(const [w,h] of [[1366,768],[1920,1080]]){await page.setViewportSize({width:w,height:h});await page.screenshot({path:path.join(output,`teaching-${w}.png`),fullPage:true});assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await frame.getByRole('button',{name:'查看全貌',exact:true}).click();assert.match(await frame.locator('output').innerText(),/完整结构/);assert.deepEqual(requests,[]);
 });
 report.success=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}

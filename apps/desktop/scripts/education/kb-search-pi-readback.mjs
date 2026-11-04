import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

// Continue the completed real-provider conversation. Never repeat paid ingestion/search.
const source=fs.realpathSync(process.argv[2]),run=fs.realpathSync(process.argv[3]);
for(const[root,prefix]of[[source,'omni-book-document-'],[run,'kb-search-pi-']])assert(path.dirname(root)===fs.realpathSync(os.tmpdir())&&path.basename(root).startsWith(prefix));
const first=JSON.parse(fs.readFileSync(path.join(run,'report.json'),'utf8'));
const figureReport=path.join(run,process.argv[4]||'resume-report-1.json');assert(path.dirname(figureReport)===run);
const figure=JSON.parse(fs.readFileSync(figureReport,'utf8'));
assert(first.checks.length>=2&&figure.sessionId&&figure.requests.length>0&&figure.requests.length<=20&&figure.requests.every(r=>r.status===200));
assert(figure.readResults.some(r=>r.question?.context?.figures.text==='原图为盛水的烧杯。'&&r.question.bookSources?.answer));
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(run,'readback-')),data=path.join(source,'data'),profile=path.join(run,'figure-profile');
const sql=(query,values=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all(...values);}finally{db.close();}};
const canonical=JSON.stringify(sql('SELECT * FROM question_bank_items ORDER BY id')),paid=sql('SELECT id,calls FROM material_ai_batches ORDER BY id');
const originals=sql('SELECT local_path,content_hash FROM teacher_resources');
const report={success:false,output,checks:[],rendererErrors:[],modelRequests:0,scope:'Existing real DeepSeek conversation restored without any network/model replay; local synthetic source images, canonical facts, source provenance and both viewport sizes only. Not data migration or natural quality acceptance.'};
report.buildMainSha256=createHash('sha256').update(fs.readFileSync(path.join(desktop,'out/main/index.js'))).digest('hex');
let app,page;
const until=async action=>{const end=Date.now()+30000;while(Date.now()<end){const value=await action();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('Saved session restore timed out');};
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'0'};
 for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','DEEPSEEK_API_KEY','ELECTRON_RENDERER_URL'])delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.kbReadbackRequests=0;for(const owner of [globalThis,net])owner.fetch=async input=>{const url=new URL(typeof input==='string'?input:input.url||input.href);if(/chat\/completions/.test(url.pathname))globalThis.kbReadbackRequests++;throw Error('Readback network disabled');};});
 page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
 await productEntry(page,'ask').click();await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===figure.sessionId);
}
async function close(){if(app){report.modelRequests+=await app.evaluate(()=>globalThis.kbReadbackRequests);await app.close();app=undefined;}}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),figure.sessionId);
async function images(prefix){
 const sources=page.getByTestId('reply-sources').last(),trigger=sources.getByRole('button',{name:/本轮读取的资料/});await trigger.waitFor();
 if((await trigger.getAttribute('aria-expanded'))!=='true')await trigger.click();
 await sources.getByTestId('pi-question-source-open').filter({hasText:'沸点'}).last().click();
 const dialog=page.getByTestId('pi-question-source-dialog');await dialog.waitFor();assert.match(await dialog.getByTestId('pi-question-context-figures').innerText(),/盛水的烧杯/);
 assert.equal(await dialog.getByTestId('material-ai-page-panel').count(),0,'Source dialog must remain read-only');
 await dialog.getByTestId('question-original-open').click();const imgs=dialog.getByTestId('question-original-image');await imgs.nth(1).waitFor();assert(await imgs.count()>=2);
 for(const[width,height]of[[1366,768],[1920,1080]]){
  const win=await app.browserWindow(page);await win.evaluate((w,size)=>w.setContentSize(...size),[width,height]);await page.waitForFunction(size=>innerWidth===size[0]&&innerHeight===size[1],[width,height]);
  for(const img of await imgs.all()){await img.scrollIntoViewIfNeeded();assert(await img.evaluate(x=>x.complete&&x.naturalWidth>0));}
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await dialog.getByTestId('pi-question-source-close').scrollIntoViewIfNeeded();assert(await dialog.getByTestId('pi-question-source-close').isVisible());await page.screenshot({path:path.join(output,`${prefix}-${width}.png`)});
 }
 await dialog.getByTestId('pi-question-source-close').click();
}
try{
 await launch();const before=await snapshot();assert(!before.running);const turns=JSON.stringify(before.projection.turns);
 await images('restored');report.checks.push('Saved real Pi read opens all local figure crops and full figure transcription in the original read-only source dialog at both sizes');
 await close();await launch();assert.equal(JSON.stringify((await snapshot()).projection.turns),turns);await images('cold');
 assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items ORDER BY id')),canonical);assert.deepEqual(sql('SELECT id,calls FROM material_ai_batches ORDER BY id'),paid);
 for(const row of originals)assert.equal(createHash('sha256').update(fs.readFileSync(row.local_path)).digest('hex'),row.content_hash);
 assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');assert.deepEqual(report.rendererErrors,[]);await close();assert.equal(report.modelRequests,0);
 report.checks.push('Cold restart preserves exact completed turns, every canonical question and ingestion paid ledger; original hashes match, zero model replay and renderer errors');report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

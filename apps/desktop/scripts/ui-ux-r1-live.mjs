import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';

// Real official provider, original Pi and typed host. No intercepted model responses.
// Fictional teacher-created bank entries are test inputs, never production content.
const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const output=fs.mkdtempSync(path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/live-'));
const owned=path.join(desktop,'test-results',path.basename(output)),data=path.join(owned,'data'),profile=path.join(owned,'profile'),workspace=path.join(owned,'teaching');
for(const d of [data,profile,workspace])fs.mkdirSync(d,{recursive:true});
const key=process.env.DEEPSEEK_API_KEY;assert(key,'Inherited provider credential required');
const main=path.join(desktop,'out/main/index.js');
const report={success:false,source:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),sourceFingerprint:fingerprint(path.join(desktop,'src')).sha256,build:fingerprint(path.join(desktop,'out')).sha256,output,data,profile,workspace,checks:[],requests:[],errors:[],steps:[],boundary:'Real official DeepSeek and original Pi/IPC/SQLite/Office. Isolated fictional teacher inputs. Dialog chooser points only to owned test workspace. No provider mocks or production user data.'};
let app,page,session,stage='launch';
const safe=s=>String(s).replaceAll(key,'[credential]').replace(/sk-[\w-]+/g,'[credential]');
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push(name);save();console.log('PASS '+name);};
const until=async(fn,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout at '+stage);};
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
async function shot(name){await page.screenshot({path:path.join(output,name+'.png')});}
async function nav(id){await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-'+id).click();}
async function send(text){report.steps.push({stage,text});save();await page.getByTestId('office-prompt-input').fill(text);await page.getByTestId('office-prompt-input').press('Enter');}
try{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  report.identity=await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net,dialog},directory)=>{
    const fetch=net.fetch.bind(net);globalThis.__r1Requests=[];
    net.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;const tracked=/api\.deepseek\.com.*chat\/completions/.test(url);const row=tracked?{time:new Date().toISOString(),status:null}:null;if(row)globalThis.__r1Requests.push(row);try{const r=await fetch(input,init);if(row)row.status=r.status;return r;}catch(e){if(row)row.error=String(e).slice(0,150);throw e;}};
    const original=dialog.showOpenDialog;dialog.showOpenDialog=async function(...args){const options=args.length>1?args[1]:args[0];if(/教学工作目录|试卷保存文件夹/.test(options?.title||''))return{canceled:false,filePaths:[directory]};return original.apply(this,args);};
  },workspace);
  page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(safe(e.message)));
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});await until(()=>page.getByTestId('office-prompt-input').isEnabled());
  session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');report.session=session;
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1366,768);w.focus();});
  stage='teacher-bank-input';await nav('teaching');await page.getByTestId('hub-entry-question_notebook').click();await page.getByTestId('question-notebook-new').click();
  const questions=[{stem:'解方程：3(x－2)＝12。',answer:'x＝6',analysis:'两边同除以3得x－2＝4，两边加2得x＝6。'},{stem:'解方程：2x＋5＝17。',answer:'x＝6',analysis:'两边减5得2x＝12，两边同除以2得x＝6。'}];
  for(const q of questions){
    for(const [field,value] of Object.entries({subject:'数学',grade:'八年级','knowledge-point':'一元一次方程',type:'解答题',...q,tags:'UIR1教师输入'}))await page.getByTestId('question-notebook-new-'+field).fill(value);
    await page.getByTestId('question-notebook-new-difficulty').selectOption('medium');await page.getByTestId('question-notebook-create-question').click();
    await until(async()=>await page.getByTestId('question-notebook-new-stem').inputValue()==='');
  }
  const bank=await page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:50,offset:0}));report.bank=bank;
  assert.equal(bank.items.length,2);for(const q of questions)assert(bank.items.some(saved=>saved.stem===q.stem));
  await shot('question-bank-real');check('Two teacher-created questions are saved by the visible form and read back from the original bank');
  await nav('ai-workspace');stage='condition-extraction';
  await send('请从本地题本中找出八年级数学、一元一次方程、中等难度的两道解答题，使用现有原题，不生成新题、不放宽条件。展示题目和来源，并提供进入题目工作面的入口。');
  await until(async()=>{const s=await snap();return !s.running&&s.projection.turns.length>0;},300000);
  const extracted=await snap();report.extraction={task:extracted.task,turns:extracted.projection.turns.map(t=>({id:t.id,status:t.status})),publicText:await page.locator('.office-conversation').innerText().catch(()=>page.locator('main').innerText())};
  await shot('condition-result');
  const sources=page.getByTestId('reply-sources').first();
  await sources.locator('[data-slot="chat-sources-trigger"]').click();
  const source=page.getByTestId('pi-question-source-open').first();await source.click();
  const sourceDialog=page.getByTestId('pi-question-source-dialog');await sourceDialog.waitFor();
  report.extraction.sourceView=await sourceDialog.innerText();assert(questions.some(q=>report.extraction.sourceView.includes(q.stem)));
  await shot('condition-question-surface');await page.getByTestId('pi-question-source-close').click();await sourceDialog.waitFor({state:'hidden'});
  assert.equal(await page.locator('.office-composer-container:visible').getAttribute('data-session-id'),session);
  check('Real condition-matched question source opens the existing question surface and returns to the same conversation');
  // Do not invent an entry if the actual product has no result-to-workspace action.
  const entry=page.locator('[data-testid*="question"][data-testid*="open"]:visible,[data-testid*="question"][data-testid*="view"]:visible');
  report.extraction.entryCandidates=await entry.evaluateAll(els=>els.map(el=>({testId:el.getAttribute('data-testid'),label:el.textContent?.slice(0,120)})));
  save();
  stage='choose-workspace';await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap()).workspace));
  check('Actual directory permission is chosen through the existing menu');
  stage='ppt-generation';await send('为八年级数学制作一份可编辑的3页PPT，主题是一元一次方程：第1页引入，第2页给出3(x－2)＝12的例题，第3页给出一道练习。请使用现有PPT工具实际起草文件，保存路径为UIR1方程课.pptx，等待我审阅和确认。不要只输出文字提纲。');
  let artifact;
  await until(async()=>{const s=await snap();artifact=s.officeArtifacts?.find(a=>a.format==='pptx'&&a.state==='pending');if(artifact)return true;if(!s.running&&s.projection.turns.length>=2)throw Error('Real PPT turn ended without an Office review artifact');return false;},300000);
  report.ppt={initial:artifact};save();
  const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${artifact.id}"]`).filter({visible:true});
  await card.getByTestId('pi-office-review').waitFor();await shot('ppt-preview');
  await card.getByRole('tab',{name:'修改拟内容',exact:true}).click();await card.getByTestId('pi-office-title').fill('一元一次方程 · 教师修订');await card.getByTestId('pi-office-save-draft').click();
  await until(()=>card.getByTestId('pi-office-approve').isEnabled());await shot('ppt-edited');
  const artifactId=artifact.id;await card.getByTestId('pi-office-approve').click();
  await until(async()=>{const s=await snap();const current=s.officeArtifacts?.find(a=>a.id===artifactId);if(current)artifact=current;return current?.state==='saved';},300000);
  report.ppt.saved=artifact;const actual=path.join(workspace,artifact.path);assert(fs.existsSync(actual));report.ppt.file={path:actual,size:fs.statSync(actual).size,sha256:sha256(fs.readFileSync(actual))};assert.equal(fs.readFileSync(actual).subarray(0,2).toString(),'PK');
  const parsed=execFileSync('python',['-c','import sys,json,zipfile,xml.etree.ElementTree as E;z=zipfile.ZipFile(sys.argv[1]);n=[s for s in z.namelist() if s.startswith("ppt/slides/slide") and s.endswith(".xml")];print(json.dumps({"slides":len(n),"texts":["".join(E.fromstring(z.read(s)).itertext()) for s in n]},ensure_ascii=False))',actual],{encoding:'utf8',windowsHide:true});report.ppt.readback=JSON.parse(parsed);assert(JSON.stringify(report.ppt.readback).includes('教师修订'));
  await shot('ppt-saved');check('Real provider PPT is edited, explicitly approved, generated and independently read back from its ZIP/XML bytes');
  const open=card.getByTestId('pi-office-open');if(await open.count())await open.click();else await card.getByRole('button',{name:/打开/}).first().click();
  await page.getByTestId('pi-file-document').waitFor();assert((await page.getByTestId('pi-file-document').innerText()).includes('教师修订'));await shot('ppt-file-preview');await page.getByTestId('pi-files-close').click();
  assert.equal(await page.locator('.office-composer-container:visible').getAttribute('data-session-id'),session);check('Saved PPT opens the original local file preview and returns to the exact source conversation');
  assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.failure={stage,error:safe(error.stack||error)};process.exitCode=1;await shot('failure').catch(()=>{});if(page)report.failure.publicText=await page.locator('body').innerText().then(s=>safe(s).slice(-16000)).catch(()=>undefined);}
finally{if(app){report.requests=await app.evaluate(()=>globalThis.__r1Requests||[]).catch(()=>[]);await app.close();}save();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure?.error}));}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'..');
const output=path.join(desktop,'test-results/ui-implementation-20261024/navigation');
fs.mkdirSync(output,{recursive:true});
const previous=JSON.parse(fs.readFileSync(path.join(desktop,'test-results/desktop-process-XAeXw5/report.json'),'utf8'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-ui-production-')),data=path.join(temp,'data');fs.mkdirSync(data);
for(const entry of fs.readdirSync(path.join(previous.temp,'data'))){if(entry.startsWith('app.db'))continue;fs.cpSync(path.join(previous.temp,'data',entry),path.join(data,entry),{recursive:true});}
const source=new DatabaseSync(path.join(previous.temp,'data/app.db'),{readOnly:true});await backup(source,path.join(data,'app.db'));source.close();
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),NODE_ENV:'development'};
for(const name of Object.keys(env))if(name.startsWith('OMNI_EDU_E2E_'))delete env[name];
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'])delete env[key];
const config=fs.readFileSync(process.env.XIAOZHI_AUDIT_ENV||'D:/WorkProject/EduProject/apps/desktop/.env.local','utf8');
for(const key of ['DEEPSEEK_API_KEY','DEEPSEEK_MODEL'])if(!env[key])env[key]=config.match(new RegExp('^'+key+'\\s*=\\s*(.*?)\\s*$','m'))?.[1]?.replace(/^['"]|['"]$/g,'');
const launch=()=>electron.launch({args:[path.join(desktop,'out/main/index.js'),'--force-device-scale-factor=1','--user-data-dir='+path.join(temp,'profile')],cwd:desktop,env,timeout:60000});
let app=await launch(),page=await app.firstWindow();const checks=[],errors=[],geometries=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,fn=()=>{})=>{fn();checks.push(name);console.log('PASS '+name);};
const shell=()=>page.locator('.edu-shell:visible');
async function shot(name){const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));}
async function navigate(view){await shell().getByTestId(view==='ai'?'nav-ai-workspace':'nav-'+view).click();await page.locator('.edu-shell[data-view="'+view+'"]:visible').waitFor();}
const views=['ai','knowledge','artifacts','notebook','book','question_notebook','paper','students','search','intake','mistakes','mastery','review','analytics','settings'];
try{
 await page.getByTestId('office-prompt-input').waitFor({timeout:90000});
 for(const width of [1366,1920]){
  const height=width===1366?768:1080;
  await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];if(w.isMaximized())w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(size.width,size.height);w.setTitle('自动验收 · 正式工作台重建 · 非样张');}, {width,height});
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  geometries.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));
  for(const view of views){
   await navigate(view);
   if(view==='ai')await page.getByTestId('office-conversation').waitFor({state:'visible',timeout:60000});
   await page.waitForTimeout(300);
   assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),{width,height},'Viewport changed after navigation');
   const layout=await shell().evaluate(e=>({count:document.querySelectorAll('.edu-navigation').length,active:[...document.querySelectorAll('.edu-shell')].filter(n=>n.getBoundingClientRect().width).length,overflow:document.documentElement.scrollWidth>innerWidth,rect:e.getBoundingClientRect().toJSON(),theme:e.dataset.theme,nav:getComputedStyle(e.querySelector('.edu-navigation')).backgroundColor}));
   check(view+' real page '+width,()=>{assert.equal(layout.active,1);assert.equal(layout.overflow,false);assert.equal(layout.theme,'light');assert.equal(layout.nav,'rgb(247, 247, 246)');});
   await shot(view+'-'+width);
  }
 }
 await navigate('knowledge');
 const fixture=path.join(temp,'课堂教学资料.txt');fs.writeFileSync(fixture,'一元一次方程教学目标：理解等式两边同时进行相同运算。示例：3(2x-1)=15，解为x=3。');
 await app.evaluate(({dialog},fixture)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});},fixture);
 await page.getByTestId('materials-import').click();
 await page.getByText('课堂教学资料',{exact:false}).first().waitFor({timeout:60000});
 check('teacher imports actual local text through the page');
 await shot('knowledge-imported');
 const read=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 const persisted=read.prepare("SELECT COUNT(*) n FROM teacher_resources WHERE original_file_name LIKE ?").get('%课堂教学资料%');read.close();
 check('import has a durable SQLite source',()=>assert(persisted.n>0));
 await app.close();app=await launch();page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor({timeout:90000});await navigate('knowledge');
 await page.getByText('课堂教学资料',{exact:false}).first().waitFor({timeout:60000});
 check('cold restart preserves the imported resource in the visible library');
 await shot('knowledge-import-restarted');
 await navigate('settings');
 for(const tab of ['skills','permissions','interface','archives','backup','models']){
  await page.getByTestId('pi-settings-tab-'+tab).click();await page.locator('[data-testid="pi-settings-workspace"][data-tab="'+tab+'"]').waitFor();
  check('real settings tab '+tab);await shot('settings-'+tab);
 }
 await navigate('ai');
 await page.getByTestId('pi-sidebar-toggle').click();await page.getByTestId('edu-history-panel').waitFor();
 check('real conversation history remains reachable');
 await shot('history-open');
 await page.getByRole('button',{name:'关闭对话记录',exact:true}).click();
 await page.getByTestId('pi-aside-toggle').click();await page.getByTestId('xiaozhi-pi-inspector').waitFor();
 check('task, goal and source controls remain reachable');
 await shot('task-panel');
 check('no renderer exceptions',()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success:true,build:'out/main/index.js',temp,output,checks,geometries,errors,modelTasksSubmitted:0},null,2));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,errors,temp},null,2));throw error;}
finally{await app.close();}

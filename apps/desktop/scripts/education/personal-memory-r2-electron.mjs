import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { testMain, assertIsolatedPiMain } from '../acceptance/build-root.mjs';

const desktop = path.resolve(import.meta.dirname,'../..');
const evidence = process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const modelKey = process.env.DEEPSEEK_API_KEY;
assert(evidence && modelKey,'Isolated evidence directory and configured DeepSeek are required');
const main = testMain(desktop);
const root = fs.mkdtempSync(path.join(evidence,'r2-fast-path-electron-'));
const data = path.join(root,'data');
const profile = path.join(root,'profile');
const sha256 = createHash('sha256').update(fs.readFileSync(main)).digest('hex');
const report = { model:'deepseek-flash', modelRequests:[], checks:[], main, root, sha256 };
const prefix = 'xiaozhi.teacher-preference.v1';
let app, page;

async function until(read, timeout=90000) {
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
    const value=await read();
    if(value)return value;
    await wait(140);
  }
  throw Error('The Electron action did not reach the expected state');
}

async function launch() {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',
    DEEPSEEK_MODEL:report.model,DEEPSEEK_API_KEY:modelKey};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  await app.evaluate(({net})=>{
    const fetch=net.fetch.bind(net);
    globalThis.r2Wire=[];
    net.fetch=async (input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.hostname!=='api.deepseek.com'||!url.pathname.endsWith('/chat/completions'))return fetch(input,init);
      if(globalThis.r2Wire.length>=8)throw Error('R2 fast-path run request cap reached');
      const body=JSON.parse(init.body);
      const strings=body.messages.map(m=>typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.map(c=>c.text).join(' '):'');
      const preference=strings.filter(text=>text.includes('当前教师表达偏好')||text.includes('[教师偏好操作结果]'));
      const row={model:body.model,status:0,preference,startedAt:new Date().toISOString()};
      globalThis.r2Wire.push(row);
      const started=performance.now();
      const response=await fetch(input,init);
      row.status=response.status;
      void response.clone().text().then(output=>{
        for(const line of output.split('\n').filter(v=>v.startsWith('data: {'))){
          const json=JSON.parse(line.slice(6));
          if(json.usage)row.usage=json.usage;
        }
        row.elapsedMs=Math.round(performance.now()-started);
      }).catch(()=>{});
      return response;
    };
  });
  page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();
  await assertIsolatedPiMain(app,main,profile);
}

function currentHead(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try {
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(prefix+':head');
    return row?JSON.parse(row.value_json):null;
  }finally{db.close();}
}

const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const active=()=>until(async()=>{const id=await session();return id?.startsWith('aisession_')?id:null;});
const input=()=>page.getByTestId('office-prompt-input');
const wire=()=>app.evaluate(()=>globalThis.r2Wire);
async function send(text){
  const id=await active();
  const prior=(await snapshot(id)).projection.turns.at(-1)?.id;
  await input().fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const turn=await until(async()=>{
    const value=await snapshot(id);
    const turn=value.projection.turns.at(-1);
    return !value.running&&turn?.id!==prior&&['completed','failed','interrupted'].includes(turn?.status)?turn:null;
  });
  assert.equal(turn.status,'completed',turn.error);
  return turn;
}
async function fresh(){
  const old=await active();
  await page.getByTestId('pi-new-session').click();
  await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==old?id:null;});
}
function check(name,value){
  report.checks.push({name,value});
  console.log('PASS '+name);
}
async function close(){
  report.modelRequests.push(...await wire());
  await app.close();
  app=undefined;
}
try{
  await launch();
  assert.equal(currentHead(),null);
  const explicit='请记住，以后讲解先提示再给答案。请简单确认。';
  const initial=await send(explicit);
  const head=currentHead();
  assert(head?.revision===1);
  const actualAfterSave=(await wire()).flatMap(r=>r.preference);
  assert(actualAfterSave.some(message=>message.includes('宿主已保存本次明确的长期表达偏好')));
  check('Pi receives the host save receipt after the durable preference is committed',{revision:head.revision,runId:initial.id});
  await fresh();
  const before=(await wire()).length;
  const follow=await send('请讲解为什么凸透镜能在纸上形成太阳的像。');
  assert((await wire()).slice(before).some(r=>r.preference.some(message=>message.includes('先给提示，再给答案'))));
  check('a separate teaching conversation receives the committed preference',{runId:follow.id});
  await fresh();
  const narrow=await send('以后高一三班的讲义优先用表格并先给答案。请简单回应。');
  assert.deepEqual(currentHead(),head);
  const reply=narrow.items.filter(i=>i.role==='assistant').map(i=>i.text??'').join('\n');
  assert(!/已(?:经)?(?:记住|保存|记录)/.test(reply),'The assistant claimed a scoped preference was persisted');
  check('a class-specific request does not alter the app-wide SQLite head',{runId:narrow.id,revision:head.revision,response:reply});
  await send('请撤销上次记住的教学偏好。');
  const after=currentHead();
  assert(after?.revision>head.revision);
  await close();
  await launch();
  assert.deepEqual(currentHead(),after);
  check('the explicit rollback persists across a fresh Electron process',{revision:after.revision});
  await page.screenshot({path:path.join(root,'restart.png')});
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  process.exitCode=1;
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
}finally{
  if(app)await close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok??false,root,checks:report.checks.length,requests:report.modelRequests.length,error:report.error}));
}

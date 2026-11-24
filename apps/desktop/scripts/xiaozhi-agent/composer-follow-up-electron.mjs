import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
assert(acceptance);
const output=fs.mkdtempSync(path.join(acceptance,'composer-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),main=testMain(desktop);
const report={output,main,mainSha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),ok:false,checks:[],errors:[]};
const focusText='现在改用纸条演示，仍面向五年级。';
const firstText='随后列出一项课后练习。',secondText='随后整理成板书关键词。',revised='随后给出三条板书关键词。';
const promoted='把两个例子的分母保持相同。';
let app,page,session;
const check=label=>{report.checks.push(label);console.log('PASS '+label);};
const input=()=>page.getByTestId('office-prompt-input');
const composer=()=>page.getByTestId('office-composer');
const queue=()=>page.getByTestId('pi-composer-queue');
const row=id=>page.locator(`[data-testid="pi-queued-instruction"][data-control-id="${id}"]`);
const queued=()=>read("SELECT id,payload_json FROM xiaozhi_pi_controls WHERE kind='instruction' ORDER BY rowid").map(x=>JSON.parse(x.payload_json));
function read(sql,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:3000});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
}
async function until(fn,label,timeout=60000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const result=await fn();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,160));
  }
  throw Error('Timed out: '+label);
}
async function launch(cold=false){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'composer-test-local',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({cwd:desktop,args:[main,'--user-data-dir='+profile],env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net},cold)=>{
    const state=globalThis.composerWire={requests:[],errors:[],mutations:[],release:null};
    net.fetch=async(address,init)=>{
      const url=new URL(typeof address==='string'?address:address.url);
      if(url.hostname==='api.deepseek.com'&&url.pathname.endsWith('/models'))return Response.json({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]});
      if(cold||url.hostname!=='api.deepseek.com'||!url.pathname.endsWith('/chat/completions')){
        state.errors.push(url.origin+url.pathname);throw Error('External network forbidden in composer test');
      }
      const request=JSON.parse(init.body),sequence=state.requests.length;
      const latest=request.messages.filter(message=>message.role==='user').at(-1)?.content;
      state.requests.push(latest);
      if(sequence===0)await new Promise(resolve=>{state.release=resolve;});
      if(sequence>7)throw Error('Unexpected provider replay');
      const part=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'composer-'+sequence,object:'chat.completion.chunk',
        model:request.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
      return new Response(part({role:'assistant',content:''})+part({content:'已处理该次教学请求。'})+part({},'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },cold);
  page=await app.firstWindow({timeout:60000});
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.setDefaultTimeout(30000);
  await input().waitFor();
  await until(async()=>!await input().isDisabled(),'composer ready');
  await app.evaluate(({ipcMain})=>{
    const channel='xiaozhi:queue-mutate';
    const handle=ipcMain._invokeHandlers.get(channel);
    if(!handle)throw Error('Queue IPC handle is missing');
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,input)=>{
      const result=await handle(event,input);
      globalThis.composerWire.mutations.push({action:input.action,result});
      return result;
    });
  });
}
async function type(text,key='Enter'){
  await input().fill(text);
  await input().press(key);
}
async function settings(){
  await input().fill('/permissions');
  await page.getByTestId('pi-slash-permissions').waitFor();
  await until(async()=>!await page.getByTestId('pi-slash-permissions').isDisabled(),'permissions command ready');
  await input().press('Enter');
  await page.getByTestId('pi-settings-workspace').waitFor();
  await page.getByTestId('pi-settings-tab-interface').click();
  await page.getByTestId('pi-queue-mode').waitFor();
}
async function leaveSettings(){
  await page.getByRole('button',{name:'返回对话',exact:true}).click();
  await input().waitFor();
  await until(async()=>!await input().isDisabled(),'return to conversation');
}
const wire=()=>app.evaluate(()=>({requests:globalThis.composerWire.requests,errors:globalThis.composerWire.errors,mutations:globalThis.composerWire.mutations}));
const sessionId=()=>page.locator('.office-composer-container').getAttribute('data-session-id');

try{
  await launch();
  const original=await sessionId();
  await input().fill('/');
  const popup=page.getByTestId('pi-slash-commands');
  await popup.waitFor();
  assert.match(await popup.innerText(),/新建对话.*\/new/s);
  const floating=await popup.evaluate(el=>getComputedStyle(el).position);
  assert.equal(floating,'absolute');
  await page.screenshot({path:path.join(output,'slash-menu.png')});
  await input().press('ArrowDown');
  assert.match(await input().getAttribute('aria-activedescendant'),/-compact$/);
  await input().press('Escape');
  await popup.waitFor({state:'hidden'});
  assert.equal(await input().inputValue(),'/');
  await input().fill('／状态');
  assert.match(await popup.innerText(),/查看对话状态/);
  await input().press('Enter');
  await page.getByTestId('pi-composer-status').waitFor();
  await page.getByTestId('pi-composer-status').getByRole('button',{name:'关闭'}).click();
  await type('/goal 整理三份分数练习');
  await page.getByTestId('pi-goal-dialog').waitFor();
  assert.equal(await page.getByTestId('pi-goal-objective').inputValue(),'整理三份分数练习');
  await page.getByTestId('pi-goal-dialog').getByRole('button',{name:'取消'}).click();
  await type('/new');
  await until(async()=>await sessionId()!==original,'new conversation');
  session=await sessionId();
  assert.equal((await wire()).requests.length,0);
  check('Slash autocomplete, Chinese search, arrow selection, Esc retention, goal argument, and new conversation all run locally');

  await settings();
  const mode=page.getByTestId('pi-queue-mode');
  assert.equal(await page.evaluate(()=>localStorage.getItem('edudev.composer.follow-up.v1'))||'followUp','followUp');
  await mode.click();await page.getByRole('option',{name:'补充到本轮',exact:true}).click();
  await leaveSettings();
  await settings();
  assert.equal(await page.evaluate(()=>localStorage.getItem('edudev.composer.follow-up.v1')),'steer');
  await mode.click();await page.getByRole('option',{name:'本轮结束后发送',exact:true}).click();
  await leaveSettings();
  check('Follow-up default can be changed and is read back by the real settings page');
  await input().fill('设计五年级分数课的导入，请给两句话。');
  const send=composer().getByRole('button',{name:'发送消息',exact:true});
  await send.waitFor();
  await until(async()=>!await send.isDisabled(),'ready to send after settings');
  await input().press('Enter');
  await until(async()=>await page.getByTestId('pi-queue-shortcuts').isVisible(),'active composition');
  await until(async()=>(await wire()).requests.length===1,'first model response held open');
  await input().fill('输入法尚未选字');
  await composer().getByRole('button',{name:'停止本轮',exact:true}).waitFor();
  await composer().getByTestId('pi-queue-submit').waitFor();
  await input().evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));
  assert.equal(queued().length,0);
  assert.equal(await input().inputValue(),'输入法尚未选字');
  await input().press('Shift+Enter');
  assert.match(await input().inputValue(),/\n/);
  await type(firstText);
  await until(async()=>queued().length===1&&await input().inputValue()==='','default follow-up acknowledged');
  await type(secondText);
  await until(async()=>queued().length===2&&await input().inputValue()==='','second follow-up acknowledged');
  await type(focusText,'Control+Enter');
  await until(async()=>queued().length===3&&await input().inputValue()==='','one-shot steer acknowledged');
  assert.deepEqual(queued().map(item=>item.mode),['followUp','followUp','steer']);
  await queue().waitFor();
  const [,second,steer]=queued();
  assert.equal(await queue().locator('[data-control-id]').first().getAttribute('data-control-id'),steer.id);
  check('Enter queues, Ctrl+Enter steers, Shift+Enter inserts a line, and IME confirmation keeps the text');

  await row(second.id).getByTestId('pi-instruction-up').click();
  await until(()=>queued().find(item=>item.id===second.id)?.revision===1,'reordered revision');
  await row(second.id).getByTestId('pi-instruction-edit').click();
  report.indicatorGeometry=await queue().locator('select[data-native-indicator]').evaluateAll(elements=>elements.map(el=>{
    const read=()=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return{width:r.width,height:r.height,font:c.font,border:c.border,color:c.color,background:c.backgroundColor,appearance:c.appearance,backgroundImage:c.backgroundImage};};
    const after=read();el.removeAttribute('data-native-indicator');const before=read();el.setAttribute('data-native-indicator','chevron');
    const r=el.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
    const overlaps=[...document.querySelectorAll('button,input,textarea,select,a[href]')].filter(other=>{
      if(other===el||other.disabled||!other.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;
      const b=other.getBoundingClientRect();if(b.width<2||b.height<2)return false;
      if(b.width<24||b.height<24)return (b.x+b.width/2-cx)**2+(b.y+b.height/2-cy)**2<24**2;
      const dx=Math.max(b.left-cx,0,cx-b.right),dy=Math.max(b.top-cy,0,cy-b.bottom);return dx*dx+dy*dy<12**2;
    }).map(other=>other.dataset.testid||other.getAttribute('aria-label')||other.tagName);
    return{before,after,spacing:{criterion:'WCAG 2.5.8 spacing exception for preserved compact native target',diameter:24,overlaps}};
  }));
  assert(report.indicatorGeometry.length>0,'Measure a real visible protected selector');
  for(const item of report.indicatorGeometry)assert.deepEqual(item.spacing.overlaps,[],'Preserved compact target meets the 24px circle spacing exception');
  for(const item of report.indicatorGeometry)for(const key of ['width','height','font','border','color','background'])assert.equal(item.after[key],item.before[key],'Indicator decoration preserves protected '+key);


  await row(second.id).getByTestId('pi-instruction-text').fill(revised);
  await row(second.id).getByTestId('pi-instruction-save').click();
  await until(()=>queued().find(item=>item.id===second.id)?.revision===2,'edited revision');
  assert.equal(await queue().locator('[data-control-id]').nth(1).getAttribute('data-control-id'),second.id);
  await type('这条只用来核对删除。');
  const deleted=await until(async()=>queued().length===4&&await input().inputValue()===''&&queued()[3],'deletable row acknowledged');
  await row(deleted.id).getByTestId('pi-instruction-withdraw').click();
  const withdrawal=await until(async()=>(await wire()).mutations.find(item=>item.action==='withdraw'),'withdrawal receipt');
  assert.deepEqual(withdrawal.result,{ok:true});
  assert.equal(queued().find(item=>item.id===deleted.id)?.state,'withdrawn');
  await type(promoted);
  const promotedRow=await until(async()=>await input().inputValue()===''&&queued().find(item=>item.text===promoted),'promotable row acknowledged');
  await row(promotedRow.id).getByTestId('pi-instruction-steer').click();
  await until(()=>queued().find(item=>item.id===promotedRow.id)?.mode==='steer','promoted row');
  assert.equal(await queue().locator('[data-control-id]').count(),4);
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},[w,h])=>BrowserWindow.getAllWindows()[0].setContentSize(w,h),[width,height]);
    await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
    const measure=await queue().boundingBox();
    const field=await composer().boundingBox();
    assert(measure&&field&&measure.y>=0&&measure.y+measure.height<=field.y+1);
    await page.screenshot({path:path.join(output,`queue-${width}.png`)});
  }
  check('Live queue panels above the composer persist reordering, revision edits, and deletion at both window sizes');

  await until(async()=>(await wire()).requests.length===1,'provider held');
  await app.evaluate(()=>globalThis.composerWire.release?.());
  await until(()=>queued().every(item=>['applied','withdrawn'].includes(item.state)),'native delivery');
  await until(()=>read("SELECT status FROM ai_agent_runs WHERE session_id=?",session).at(-1)?.status==='succeeded','terminal run');
  const requests=(await wire()).requests.map(value=>typeof value==='string'?value:JSON.stringify(value));
  assert.deepEqual(requests.slice(1).map(value=>[focusText,promoted,revised,firstText].find(text=>value.includes(text))),[focusText,promoted,revised,firstText]);
  assert(!JSON.stringify(requests).includes('这条只用来核对删除'));
  assert.deepEqual((await wire()).errors,[]);
  report.requests=requests;
  report.session=session;
  const before=queued();
  await app.close();app=undefined;
  await launch(true);
  if(await sessionId()!==session)await page.getByTestId(`ai-conversation-session-${session}`).click();
  await until(async()=>await sessionId()===session&&!await input().isDisabled(),'cold conversation');
  assert.deepEqual(queued(),before);
  assert.equal(await queue().count(),0);
  assert.deepEqual((await wire()).requests,[]);
  assert.deepEqual(report.errors,[]);
  check('Original Pi receives steer first, then the two reordered replies exactly once; restart replays nothing');
  report.ok=true;
}catch(error){
  report.error=String(error.stack);
  if(app)report.failureWire=await wire().catch(()=>null);
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}finally{
  if(app)await app.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,ok:report.ok,checks:report.checks.length,error:report.error}));
}

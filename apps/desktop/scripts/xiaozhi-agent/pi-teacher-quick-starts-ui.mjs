import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {fingerprint} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-teacher-quick-starts-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const attachmentPath=path.join(output,'教师附件.txt');
fs.writeFileSync(attachmentPath,'五年级数学课堂资料。\n');
const report={
  success:false,
  checks:[],
  errors:[],
  launches:[],
  boundary:'Actual isolated Electron empty-chat UI. Clicks only seed the existing composer draft; no model request, typed task IPC, file access, daily profile or teacher acceptance claim.',
};
let app,page,session;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=30000){
  const end=Date.now()+ms;
  while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error('quick-start condition timed out');
}
async function launch(){
  const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  delete env.DEEPSEEK_API_KEY;
  app=await electron.launch({args:[testMain(process.cwd()),`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
  report.launches.push(await assertIsolatedPiMain(app,testMain(process.cwd()),profile));
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},attachmentPath);
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
  assert.match(session,/^aisession_[0-9a-f-]{36}$/i);
}
async function snapshot(){
  assert(session);
  return page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
}
async function showStarts(){
  await page.getByTestId('office-prompt-input').fill('');
  await until(async()=>await page.getByTestId('teacher-quick-starts').isVisible());
}
function messageCount(){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare('SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id=?').get(session).count;}
  finally{db.close();}
}

try{
  await launch();
  const initial=await snapshot();
  assert.equal(initial.projection.turns.length,0);
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-testid^="teacher-quick-start-"]').count(),3);
  const labels=await page.locator('[data-testid^="teacher-quick-start-"] strong').allInnerTexts();
  assert.deepEqual(labels,['根据资料备课','讲清一道错题','做一份课堂课件']);
  check('An empty teacher conversation exposes exactly the three focused workflows');

  await page.getByRole('button',{name:'添加本地附件',exact:true}).click();
  await until(async()=>(await page.getByTestId('pi-attachment-count').innerText()).includes('1/8'));
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-testid^="teacher-quick-start-"]').count(),3);
  await page.getByTestId('teacher-quick-start-materials').click();
  await until(async()=>await page.getByTestId('office-prompt-input').inputValue().then(value=>value.includes('先读取资料')));
  assert.equal(await page.getByTestId('pi-attachment-count').innerText(),'附件 1/8 · 待发送');
  assert.equal((await snapshot()).projection.turns.length,0);
  check('Attachment-first teacher flow keeps quick starts visible and seeds a draft without losing the attachment');
  await showStarts();

  const cases=[
    ['materials','先读资料','请根据我添加的教学资料'],
    ['mistakes','本机识别','请先确认我添加的学生错题图片'],
    ['classroom','课堂课件','请根据我说明的年级、学科和知识点'],
  ];
  for(const [id,visibleText,promptPrefix] of cases){
    const button=page.getByTestId(`teacher-quick-start-${id}`);
    assert.match(await button.innerText(),new RegExp(visibleText));
    await button.click();
    const input=page.getByTestId('office-prompt-input');
    await until(async()=>await input.inputValue().then(value=>value.startsWith(promptPrefix)));
    const seeded=await input.inputValue();
    if(id==='mistakes')assert(!seeded.includes('如果还没添加，我会随后补充')&&seeded.includes('如果尚未附上，请提示我补充'));
    if(id==='classroom')assert(!seeded.includes('八年级')&&seeded.includes('一次性集中询问'));
    await until(()=>page.evaluate(()=>document.activeElement?.getAttribute('data-testid')==='office-prompt-input'));
    assert.equal(await page.getByTestId('teacher-quick-starts').count(),0);
    assert.equal((await snapshot()).projection.turns.length,0);
    check(`Teacher click seeds editable ${id} request, focuses the original composer and sends nothing`);
    await showStarts();
  }
  assert.equal(messageCount(),0);
  check('Quick-start clicks create no user message, assistant message or tool-turn fact');

  await page.getByTestId('office-prompt-input').fill('教师已经输入的草稿不能覆盖');
  assert.equal(await page.getByTestId('teacher-quick-starts').count(),0);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'教师已经输入的草稿不能覆盖');
  check('Existing teacher draft suppresses quick starts and remains unchanged');
  await showStarts();

  for(const [width,height,theme] of [[1366,768,'light'],[1920,1080,'dark']]){
    await page.emulateMedia({colorScheme:theme});
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await until(()=>page.evaluate(({width,height})=>innerWidth===width&&innerHeight===height,{width,height}));
    await page.getByTestId('teacher-quick-starts').scrollIntoViewIfNeeded();
    const boxes=await page.locator('[data-testid^="teacher-quick-start-"]').evaluateAll(nodes=>nodes.map(node=>{
      const box=node.getBoundingClientRect();
      return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
    }));
    assert.equal(boxes.length,3);
    assert(boxes.every(box=>box.x>=0&&box.y>=0&&box.right<=width&&box.bottom<=height&&box.width>=180));
    const contrasts=await page.locator('[data-testid^="teacher-quick-start-"]').evaluateAll(nodes=>{
      const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      const luminance=value=>{
        const channels=rgb(value).map(channel=>{const normalized=channel/255;return normalized<=.03928?normalized/12.92:Math.pow((normalized+.055)/1.055,2.4);});
        return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
      };
      const ratio=(foreground,background)=>{
        const a=luminance(foreground),b=luminance(background);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      };
      return nodes.flatMap(node=>{
        const background=getComputedStyle(node).backgroundColor;
        return [...node.querySelectorAll('strong,small')].map(child=>({text:child.textContent,color:getComputedStyle(child).color,background,ratio:ratio(getComputedStyle(child).color,background)}));
      });
    });
    assert(contrasts.every(item=>item.ratio>=4.5),JSON.stringify(contrasts));
    await page.screenshot({path:path.join(output,`quick-starts-${width}x${height}-${theme}.png`)});
    report.views=[...(report.views||[]),{width,height,theme,boxes,contrasts}];
  }
  check('All three teacher workflows remain reachable and readable at 1366x768 and 1920x1080');

  await showStarts();
  const turnsBefore=(await snapshot()).projection.turns.length;
  await app.close();
  app=undefined;
  await launch();
  assert.equal((await snapshot()).projection.turns.length,turnsBefore);
  assert.equal(messageCount(),0);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  check('Cold restart preserves zero task replay and restores the empty-chat entry state');

  assert.deepEqual(report.errors,[]);
  report.build=fingerprint(path.dirname(path.dirname(testMain(process.cwd())))).sha256;
  report.session=session;
  report.success=true;
}catch(error){
  report.error=String(error.stack||error);
  process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
  await app?.close().catch(()=>{});
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}

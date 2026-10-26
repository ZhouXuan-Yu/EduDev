import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-narrow-interface-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const buildRoot=path.dirname(path.dirname(testMain(process.cwd())));
const fixed=fingerprint(buildRoot);
const report={
  schema:'h09.narrow-interface-ui.v1',
  success:false,
  phase:'launch',
  build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},
  scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  views:[],
  keyboard:[],
  errors:[],
  boundary:'Actual isolated Electron and production renderer with the production minimum width. Synthetic empty conversation and draft-only keyboard interaction; no model request, approval, file effect, daily profile or screen-reader human claim.',
};
let app,page,session;

async function until(fn,ms=30000){
  const end=Date.now()+ms;
  while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error(`condition timed out: ${report.phase}`);
}

async function launch(){
  const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  delete env.DEEPSEEK_API_KEY;
  delete env.OMNI_EDU_TEST_BUILD_ROOT;
  app=await electron.launch({args:[testMain(process.cwd()),`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
  report.main=await assertIsolatedPiMain(app,testMain(process.cwd()),profile);
  page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  await page.locator('.office-model-picker').waitFor({state:'visible',timeout:60000});
  report.window=await app.evaluate(({BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows()[0],bounds=window.getContentBounds(),minimum=window.getMinimumSize();
    return {bounds:{width:bounds.width,height:bounds.height},minimum:{width:minimum[0],height:minimum[1]}};
  });
  if(report.window.minimum.width!==390)throw Error(`unexpected production minimum width ${report.window.minimum.width}`);
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
  if(!/^aisession_[0-9a-f-]{36}$/i.test(session||''))throw Error('session id unavailable');
}

async function collectView(width,height,theme,label='',forcedColors=false){
  report.phase=`view-${label?label+'-':''}${width}x${height}-${theme}`;
  await page.emulateMedia({colorScheme:theme,forcedColors:forcedColors?'active':'none'});
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await until(()=>page.evaluate(({width,height})=>innerWidth===width&&innerHeight===height,{width,height}));
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'}).catch(()=>undefined);
  const dataView=await page.evaluate(({width,height})=>{
    const selectors=[
      'xiaozhi-pi-workspace',
      'office-conversation',
      'office-prompt-input',
      'teacher-quick-starts',
      'teacher-quick-start-materials',
      'teacher-quick-start-mistakes',
      'teacher-quick-start-classroom',
      'pi-sidebar-toggle',
      'pi-permission-picker',
      'pi-skill-picker',
      'office-model-picker',
      'prompt-input-send',
    ];
    const rect=node=>{
      if(!node)return null;
      const box=node.getBoundingClientRect(),style=getComputedStyle(node);
      return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom,display:style.display,visibility:style.visibility,overflow:style.overflow};
    };
    const controls=[...document.querySelectorAll('button,[role="button"],textarea,input,[tabindex]')].filter(node=>rect(node)?.width&&rect(node)?.height).map(node=>({
      tag:node.tagName.toLowerCase(),
      testid:node.getAttribute('data-testid'),
      role:node.getAttribute('role'),
      aria:node.getAttribute('aria-label'),
      text:String(node.textContent||'').trim().slice(0,80),
      disabled:node.matches(':disabled')||node.getAttribute('aria-disabled')==='true',
      rect:rect(node),
      inViewport:Boolean(rect(node)&&rect(node).x>=0&&rect(node).y>=0&&rect(node).right<=width&&rect(node).bottom<=height),
    }));
    return {
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,forcedColors:matchMedia('(forced-colors: active)').matches},
      document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight},
      nodes:Object.fromEntries(selectors.map(selector=>{
        const node=selector==='office-model-picker'?document.querySelector('.office-model-picker'):selector==='prompt-input-send'?document.querySelector('[data-slot="prompt-input-send"]'):document.querySelector(`[data-testid="${selector}"]`);
        return [selector,rect(node)];
      })),
      activeElement:document.activeElement?.getAttribute('data-testid')||document.activeElement?.tagName,
      controls,
    };
  },{width,height});
  const screenshot=path.join(output,`${label?label+'-':'narrow-'}${width}x${height}-${theme}.png`);
  await page.screenshot({path:screenshot,animations:'disabled'});
  const row={label,width,height,theme,screenshot,data:dataView};
  report.views.push(row);
  assertView(row);
  return row;
}

async function keyboardProbe(){
  report.phase='keyboard';
  const pageCdp=await page.context().newCDPSession(page);
  const pageAx=await pageCdp.send('Accessibility.getFullAXTree');
  report.accessibilityPage=pageAx.nodes.filter(node=>!node.ignored&&['main','textbox','button'].includes(node.role?.value)).map(node=>({role:node.role?.value,name:node.name?.value||'',disabled:node.properties?.find(property=>property.name==='disabled')?.value?.value??false}));
  const named=(role,name)=>report.accessibilityPage.some(node=>node.role===role&&node.name.includes(name));
  for(const name of ['给小智发送消息','添加本地附件','教师资料 · 只读','选择教育技能','发送消息'])if(!named('textbox',name)&&!named('button',name))throw Error(`accessibility tree missing ${name}`);
  if(!report.accessibilityPage.some(node=>node.role==='main'))throw Error('accessibility tree missing main landmark');
  const input=page.getByTestId('office-prompt-input');
  await input.fill('窄屏键盘可达性探针');
  await input.focus();
  for(let index=0;index<8;index++){
    await page.keyboard.press('Tab');
    report.keyboard.push(await page.evaluate(()=>{
      const node=document.activeElement;
      if(!(node instanceof HTMLElement))return {tag:node?.nodeName||null};
      const box=node.getBoundingClientRect();
      return {
        tag:node.tagName.toLowerCase(),
        testid:node.getAttribute('data-testid'),
        role:node.getAttribute('role'),
        aria:node.getAttribute('aria-label'),
        className:node.className,
        slot:node.getAttribute('data-slot'),
        text:String(node.textContent||'').trim().slice(0,80),
        rect:{x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom},
        inViewport:box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,
      };
    }));
  }
  const sequence=report.keyboard.map(row=>row.testid||row.aria||row.slot||row.className||row.tag);
  for(const expected of ['添加本地附件','pi-permission-picker','pi-skill-picker','发送消息']){
    if(!sequence.some(value=>String(value).includes(expected)))throw Error(`keyboard sequence missing ${expected}: ${JSON.stringify(sequence)}`);
  }
  await input.fill('');
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  await page.getByTestId('teacher-quick-start-materials').focus();
  await page.keyboard.press('Enter');
  await until(async()=>await input.inputValue().then(value=>value.includes('先读取资料')));
  await until(()=>page.evaluate(()=>document.activeElement?.getAttribute('data-testid')==='office-prompt-input'));
  report.quickStartKeyboard=true;
  await input.fill('');
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  const toggle=page.getByTestId('pi-sidebar-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  const mobileSidebar=page.getByRole('dialog').getByTestId('ai-conversation-sidebar');
  report.mobileSidebarDebug=await mobileSidebar.evaluate(node=>{
    const style=getComputedStyle(node),box=node.getBoundingClientRect(),parent=node.parentElement?getComputedStyle(node.parentElement):null;
    const ancestors=[];for(let item=node.parentElement;item&&ancestors.length<8;item=item.parentElement){const itemStyle=getComputedStyle(item);ancestors.push({tag:item.tagName,className:item.className,display:itemStyle.display,visibility:itemStyle.visibility,width:itemStyle.width,height:itemStyle.height});}
    return {display:style.display,visibility:style.visibility,position:style.position,width:style.width,height:style.height,translate:style.translate,rect:{x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom},parent:parent?{tag:node.parentElement?.tagName,className:node.parentElement?.className,display:parent.display,visibility:parent.visibility,width:parent.width,height:parent.height}:null,ancestors};
  });
  await mobileSidebar.waitFor({state:'visible'});
  const mobileDialog=page.getByRole('dialog');
  report.mobileSidebarFocus=await page.evaluate(()=>{
    const active=document.activeElement;
    const dialog=active?.closest('[role="dialog"]');
    return {insideDialog:Boolean(dialog),tag:active?.tagName||null,testid:active?.getAttribute?.('data-testid')||null,aria:active?.getAttribute?.('aria-label')||null};
  });
  if(!report.mobileSidebarFocus.insideDialog)throw Error(`mobile sidebar did not receive focus: ${JSON.stringify(report.mobileSidebarFocus)}`);
  const cdp=await page.context().newCDPSession(page);
  const {nodes}=await cdp.send('Accessibility.getFullAXTree');
  report.accessibilityDialog=nodes.filter(node=>!node.ignored&&['dialog','button'].includes(node.role?.value)).map(node=>({role:node.role?.value,name:node.name?.value||'',disabled:node.properties?.find(property=>property.name==='disabled')?.value?.value??false}));
  if(!report.accessibilityDialog.some(node=>node.role==='dialog'))throw Error('accessibility tree missing dialog role');
  await page.screenshot({path:path.join(output,'narrow-390x844-dark-sidebar.png'),animations:'disabled'});
  report.sidebarOpenedByKeyboard=true;
  await page.keyboard.press('Escape');
  await until(async()=>!(await mobileSidebar.isVisible()));
  await until(()=>page.evaluate(()=>document.activeElement?.getAttribute('data-testid')==='pi-sidebar-toggle'));
  report.sidebarEscapeReturnedFocus=true;
}

try{
  await launch();
  await collectView(1366,768,'light');
  await collectView(768,1024,'light');
  await collectView(390,844,'dark');
  await keyboardProbe();
  assertDeepNoErrors();
  await collectView(390,844,'dark','forced',true);
  await page.emulateMedia({forcedColors:'none'});
  report.phase='cold-restart';
  await app.close();
  app=undefined;
  await launch();
  await page.getByTestId('teacher-quick-starts').waitFor({state:'visible'});
  await collectView(390,844,'dark','cold');
  assertDeepNoErrors();
  const database=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{report.messageRows=database.prepare('SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id=?').get(session).count;}
  finally{database.close();}
  if(report.messageRows!==0)throw Error(`draft-only narrow test created ${report.messageRows} message rows`);
  report.success=true;
}catch(error){
  report.error=String(error.stack||error);
  process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>undefined);
}finally{
  await app?.close().catch(()=>undefined);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,phase:report.phase,output,error:report.error,views:report.views.length,keyboard:report.keyboard.length}));
}

function assertDeepNoErrors(){
  if(report.errors.length)throw Error('renderer errors: '+report.errors.join(' | '));
  if(fingerprint(buildRoot).sha256!==fixed.sha256)throw Error('build changed during probe');
}

function assertView(row){
  const {width,height,data}=row;
  if(data.document.scrollWidth>data.document.clientWidth)throw Error(`${width}x${height} horizontal overflow ${data.document.scrollWidth}/${data.document.clientWidth}`);
  if(row.label==='forced'&&!data.viewport.forcedColors)throw Error('forced-colors probe did not activate');
  const required=['xiaozhi-pi-workspace','office-conversation','office-prompt-input','teacher-quick-starts','teacher-quick-start-materials','teacher-quick-start-mistakes','teacher-quick-start-classroom','pi-sidebar-toggle','pi-permission-picker','pi-skill-picker','office-model-picker','prompt-input-send'];
  for(const selector of required){
    const box=data.nodes[selector];
    if(!box||box.width<=0||box.height<=0||box.x<0||box.y<0||box.right>width||box.bottom>height)throw Error(`${width}x${height} ${selector} is missing or clipped: ${JSON.stringify(box)}`);
  }
}

import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {imageSize} from 'image-size';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain, testMain} from '../acceptance/build-root.mjs';
import {fingerprint, sha256} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-dpi-interface-ui-'));
const report={schema:'h09.dpi-interface-ui.v1',success:false,checks:[],views:[],errors:[],build:null,
  scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),
  boundary:'Actual isolated Electron and production renderer under forced 125/150 percent DPI. Empty synthetic conversation only; no provider request, approval, file effect, screen-reader human review, classroom projection or installer claim.'};
const main=testMain(process.cwd()),build=fingerprint(path.dirname(path.dirname(main)));
report.build={root:path.dirname(path.dirname(main)),sha256:build.sha256,files:build.files.length};
const check=name=>{report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
const until=async(fn,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('DPI UI condition timed out');};

async function launch(scale){
  const directory=path.join(output,`dpi-${scale}`),data=path.join(directory,'data'),profile=path.join(directory,'profile');
  fs.mkdirSync(directory,{recursive:true});
  const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.DEEPSEEK_API_KEY;delete env.DEEPSEEK_MODEL;delete env.OMNI_EDU_TEST_BUILD_ROOT;
  const app=await electron.launch({args:[main,`--user-data-dir=${profile}`,`--force-device-scale-factor=${scale}`],env,timeout:60000});
  const page=await app.firstWindow();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(()=>page.evaluate(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled));
  await until(async()=>/^aisession_[a-f0-9-]{36}$/i.test(await page.locator('.office-composer-container').getAttribute('data-session-id')||''));
  const launch=await assertIsolatedPiMain(app,main,profile);
  const dpr=await page.evaluate(()=>devicePixelRatio);
  assert(Math.abs(dpr-scale)<0.02,`requested DPR ${scale}, actual ${dpr}`);
  return {app,page,data,profile,launch,dpr,directory};
}

function rect(node){
  const box=node?.getBoundingClientRect();
  return box?{x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom}:null;
}

async function inspect(page,scale,dpr,width,height,theme){
  await page.getByTestId('office-prompt-input').fill('');
  if(await page.locator('.office-model-picker').count()===0)await page.getByTestId('pi-permission-picker').waitFor();
  const themeResult=await page.evaluate(theme=>({emulated:matchMedia(`(prefers-color-scheme: ${theme})`).matches,colorScheme:getComputedStyle(document.documentElement).colorScheme}),theme);
  const data=await page.evaluate(({width,height})=>{
    const find=id=>document.querySelector(`[data-testid="${id}"]`);
    const model=document.querySelector('.office-model-picker');
    const send=document.querySelector('[data-slot="prompt-input-send"]');
    const box=node=>{const r=node?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};
    const attach=document.querySelector('button[aria-label="添加本地附件"]');
    const controls={input:box(find('office-prompt-input')),attach:box(attach),permission:box(find('pi-permission-picker')),skill:box(find('pi-skill-picker')),model:box(model),send:box(send),quick:box(find('teacher-quick-starts'))};
    const visible=node=>{if(!(node instanceof HTMLElement))return false;const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    return{inner:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},document:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,clientHeight:document.documentElement.clientHeight,scrollHeight:document.documentElement.scrollHeight},controls,quick:controls.quick,quickVisible:visible(find('teacher-quick-starts')),inputVisible:visible(find('office-prompt-input')),sendVisible:visible(send),messages:document.querySelectorAll('.office-turn').length};
  },{width,height});
  assert(Math.abs(data.inner.width-width)<=2,`CSS width ${data.inner.width} for ${width}`);
  assert(Math.abs(data.inner.height-height)<=2,`CSS height ${data.inner.height} for ${height}`);
  assert.equal(data.inner.dpr,dpr);
  assert(data.document.scrollWidth<=data.document.clientWidth+1);
  for(const [name,box] of Object.entries(data.controls))if(name!=='quick')assert(box&&box.x>=0&&box.y>=0&&box.right<=width+1&&box.bottom<=height+1,`${name} outside ${width}x${height}: ${JSON.stringify(box)}`);
  if(!data.quick)throw Error(`Quick starts missing at scale=${scale} ${width}x${height} ${theme}: ${JSON.stringify(data.controls)}`);
  assert(data.quickVisible&&data.quick.y>=0&&data.quick.bottom<=height+1);
  assert(data.inputVisible&&data.sendVisible);assert.equal(data.messages,0);
  assert(themeResult.emulated,`theme ${theme} did not match`);
  const shot=path.join(output,`dpi-${scale}-${theme}-${width}x${height}.png`);
  await page.screenshot({path:shot,animations:'disabled'});
  const image=imageSize(fs.readFileSync(shot));
  assert(Math.abs(image.width-width*dpr)<=2,`physical width ${image.width}`);
  assert(Math.abs(image.height-height*dpr)<=2,`physical height ${image.height}`);
  report.views.push({scale,dpr,theme,width,height,shot:path.relative(output,shot),physical:{width:image.width,height:image.height},themeResult,data});
}

try{
  for(const scale of [1.25,1.5]){
    const session=await launch(scale);
    try{
      for(const theme of ['light','dark']){
        await session.page.emulateMedia({colorScheme:theme,forcedColors:'none',reducedMotion:'no-preference'});
        await session.page.waitForFunction(value=>matchMedia(`(prefers-color-scheme: ${value})`).matches,theme);
        for(const [width,height] of [[1366,768],[1920,1080]]){
          await session.app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
          await session.page.waitForTimeout(350);
          const actual=await session.page.evaluate(()=>({innerWidth,innerHeight,devicePixelRatio}));
          if(Math.abs(actual.innerWidth-width)>2||Math.abs(actual.innerHeight-height)>2||actual.devicePixelRatio!==session.dpr)throw Error(`DPI size mismatch scale=${scale} requested=${width}x${height} actual=${JSON.stringify(actual)}`);
          await inspect(session.page,scale,session.dpr,width,height,theme);
        }
      }
      check(`Actual 125/150 percent DPI matrix keeps the teacher workspace reachable (${scale})`);
    }finally{
      await session.app.close().catch(()=>undefined);
    }
  }
  assert.equal(report.views.length,8);
  assert.equal(report.errors.length,0);
  assert.equal(fingerprint(path.dirname(path.dirname(main))).sha256,build.sha256);
  report.success=true;
}catch(error){
  report.error=String(error.stack||error).slice(0,5000);
  process.exitCode=1;
}finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,views:report.views.length,output,error:report.error}));
}

import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {withStaticOfficePage} from '../office-pdf-renderer';
import {prepareHtmlArtifact} from '../../../shared/html-artifact';
import type {CheckFinding,FileCheckRules} from '../../../shared/xiaozhi-delivery-checks';
import {scienceExpected} from '../../../shared/xiaozhi-science-check';
import {createHtmlInput} from './html-input';

export type HtmlCheckData={text:string;notes:string;observations:Record<string,string[]>;findings:CheckFinding[];renderedPages:number[];screenshots:{viewport:string;bytes:Buffer}[]};
/** Host-owned declarations in an isolated world. Page code has no host/IPC authority. */
export async function inspectInteractiveHtml(html:string,rules:FileCheckRules,options:{dataRoot:string;signal?:AbortSignal}):Promise<HtmlCheckData>{
 let blocked=false;
 return withStaticOfficePage(prepareHtmlArtifact(html),{...options,deadlineMs:20000,inlineResources:true,onBlockedResource:()=>{blocked=true;}},async({Window,htmlPath})=>{
  const win=new Window({show:false,width:1366,height:768,useContentSize:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:true,backgroundThrottling:false}});
  let errors=0;win.webContents.on('console-message',event=>{if(event.level==='error')errors++;});
  // Expected host-side validation failures cross the isolated world as data. Throwing there
  // hides the reason behind Electron's generic error and falsely counts as a page script bug.
  const evaluate=async<T>(code:string):Promise<T>=>{const result=await win.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:`(async()=>{try{return{ok:true,value:await (${code})};}catch(error){return{ok:false,error:String(error?.message||'control_unavailable')};}})()`}]) as {ok:true;value:T}|{ok:false;error:string};if(!result.ok)throw Error(result.error);return result.value;};
  // Hidden or locked desktops may suspend RAF; DOM/layout can still be inspected.
  const settle=()=>evaluate<void>('new Promise(resolve=>{const timer=setTimeout(resolve,50);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve();}));})');
  const load=async()=>{options.signal?.throwIfAborted();await win.loadURL(pathToFileURL(htmlPath).href);await settle();options.signal?.throwIfAborted();};
  const observe=async(selector:string)=>{
   const data=await evaluate<{text:string;graphic:boolean;x:number;y:number;width:number;height:number}>(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing_observation');e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect(),x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y));return{text:e instanceof HTMLInputElement||e instanceof HTMLSelectElement||e instanceof HTMLTextAreaElement?e.value:e.textContent||'',graphic:['CANVAS','SVG','IMG'].includes(e.tagName.toUpperCase()),x,y,width:Math.floor(Math.min(r.right,innerWidth)-x),height:Math.floor(Math.min(r.bottom,innerHeight)-y)};})()`);
   if(!data.graphic)return{text:data.text,effect:data.text};
   if(data.width<1||data.height<1)throw Error('observation_not_visible');await settle();const image=await win.webContents.capturePage({x:data.x,y:data.y,width:data.width,height:data.height},{stayHidden:true,stayAwake:true});
   return{text:data.text,effect:createHash('sha256').update(image.resize({width:64,height:64}).toBitmap()).digest('hex')};
  };
  await load();
  const base=await evaluate<{text:string;notes:string;controls:number}>(`(()=>({text:document.body.innerText.slice(0,60000),notes:[...document.querySelectorAll('details')].map(e=>e.textContent||'').join('\\n').slice(0,30000),controls:document.querySelectorAll('button,input,select,textarea,summary,a[href],[role="button"]').length}))()`);
  if(await evaluate<boolean>(`document.body.innerText.length>60000||[...document.querySelectorAll('details')].reduce((n,e)=>n+(e.textContent||'').length,0)>30000`))throw Error('too_large');
  const result:HtmlCheckData={text:base.text,notes:base.notes,observations:{},findings:[],renderedPages:[],screenshots:[]};
  for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){
   options.signal?.throwIfAborted();win.setContentSize(viewport.width,viewport.height);await settle();
   const layout=await evaluate<{clipped:number;overflow:boolean;empty:boolean}>(`(()=>{let clipped=0;for(const e of [...document.querySelectorAll('h1,h2,h3,p,label,button,output,td,th')].slice(0,3000)){const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none')continue;if((s.overflowX==='hidden'||s.overflowX==='clip')&&e.scrollWidth>e.clientWidth+2||(s.overflowY==='hidden'||s.overflowY==='clip')&&e.scrollHeight>e.clientHeight+2)clipped++;}return{clipped,overflow:document.documentElement.scrollWidth>innerWidth+2,empty:!document.body.innerText.trim()&&!document.querySelector('canvas,svg,img,video')};})()`);
   if(layout.clipped||layout.overflow)result.findings.push({kind:'visual',state:'failed',code:'html_clipping',message:`${viewport.width}×${viewport.height}：${layout.clipped}处文字容器裁切${layout.overflow?'，页面超出可视宽度':''}。`});
   if(layout.empty)result.findings.push({kind:'visual',state:'failed',code:'empty_render',message:'实际加载后页面没有可见内容。'});
   const image=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),bytes=image.toPNG();if(bytes.length>3*1048576)throw Error('too_large');
   result.screenshots.push({viewport:`${viewport.width}x${viewport.height}`,bytes});
  }
  result.renderedPages=[1];
  if(!result.findings.some(f=>f.kind==='visual'))result.findings.push({kind:'visual',state:'passed',code:'html_viewports',message:'实际渲染1366×768和1920×1080；已检查页面宽度与文字容器裁切，未涵盖任意语义遮挡或未展开区域。'});
  for(const rule of rules.numbers||[]){if(rule.source.kind!=='selector')continue;
   const source=JSON.stringify(rule.source);
   result.observations[rule.id]=await evaluate<string[]>(`(()=>{const r=${source};return [...document.querySelectorAll(r.selector)].slice(0,200).map(e=>r.attribute?e.getAttribute(r.attribute)||'':e instanceof HTMLInputElement||e instanceof HTMLSelectElement?e.value:e.textContent||'');})()`);
  }
  for(const rule of rules.facts||[])if(rule.source.kind==='selector'){const values=await evaluate<string[]>(`[...document.querySelectorAll(${JSON.stringify(rule.source.selector)})].slice(0,2).map(e=>e.textContent||'')`);result.observations['fact:'+rule.id]=values;}
  for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){
   if(!rules.interactions?.length)break;
   options.signal?.throwIfAborted();win.setContentSize(viewport.width,viewport.height);await settle();
   const label=`${viewport.width}×${viewport.height}`;
   for(const scenario of rules.interactions){
   await load();let before={text:'',effect:''},after={text:'',effect:''},changed=false;
   try{
    before=await observe(scenario.observe);
    const input=createHtmlInput(win.webContents,evaluate,settle,options.signal);
    try{for(const action of scenario.actions){await input.perform(action);const intermediate=await observe(scenario.observe);changed ||=intermediate.effect!==before.effect;}}finally{input.close();}
    after=await observe(scenario.observe);
    const numeric=/^[\s]*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/.exec(after.text),r=scenario,expected=r.expectedFrom?scienceExpected(r.expectedFrom).value:r.expectedNumber;
    const pass=(r.expectedText===undefined||after.text.includes(r.expectedText))&&(expected===undefined||!!numeric&&Math.abs(Number(numeric[1])-expected)<=(r.tolerance??1e-9))&&(r.mustChange===false||changed||before.effect!==after.effect);
    result.findings.push({kind:'interaction',state:pass?'passed':'failed',code:pass?'control_observed':'control_result',ruleId:scenario.id,message:label+'：'+(pass?'实际操作控件后，可观测结果符合声明。':'控件操作后结果未变化或不符合声明。')});
   }catch(error){options.signal?.throwIfAborted();const raw=error instanceof Error?error.message:'',code=['control_missing','control_ambiguous','control_hidden','control_disabled','control_readonly','control_covered','control_focus','control_option','control_value','input_unsupported','input_unavailable','input_budget'].find(c=>raw.includes(c))||'control_unavailable',unchecked=code.startsWith('input_');result.findings.push({kind:'interaction',state:unchecked?'unchecked':'failed',code,ruleId:scenario.id,message:label+'：'+(unchecked?'当前控件或操作超出本地输入支持范围、预算，或输入通道不可用；交互未检查，不当作通过。':'控件不存在、不唯一、不可见、禁用、只读、被遮挡，或真实操作未达到目标值；请修复后重新检查。')});}
   }
  }
  if(await evaluate<boolean>(`!!document.querySelector('canvas')`)&&!result.findings.some(f=>f.kind==='interaction'&&f.state==='passed'))result.findings.push({kind:'visual',state:'unchecked',code:'canvas_content_unverified',message:'页面含画布，但尚无实际控件到画面变化的验证，未把空白画布当作通过。'});
  if(!rules.interactions?.length)result.findings.push({kind:'interaction',state:base.controls?'unchecked':'not_applicable',code:'interaction_contract',message:base.controls?'发现控件，但尚未提供操作与观察结果的检查约定。':'当前页面没有可操作控件。'});
  if(errors)result.findings.push({kind:'interaction',state:'failed',code:'script_error',message:`实际页面执行记录到${errors}条脚本或控制台错误。`});
  if(blocked)result.findings.push({kind:'structure',state:'failed',code:'external_resource',message:'页面依赖未打包的外部资源，离线预览已阻止该请求。'});
  options.signal?.throwIfAborted();return result;
 });
}

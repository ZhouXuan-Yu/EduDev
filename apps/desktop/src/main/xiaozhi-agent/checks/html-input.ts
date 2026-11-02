import type {WebContents} from 'electron';
import type {InteractionCheck} from '../../../shared/xiaozhi-delivery-checks';

type Evaluate=<T>(code:string)=>Promise<T>;
type Target={x:number;y:number;tag:string;type:string;value:string;min:string;max:string;step:string;values:string[]};
const keyCodes:Record<string,[string,number]>={ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],ArrowUp:['ArrowUp',38],ArrowDown:['ArrowDown',40],Home:['Home',36],End:['End',35],Enter:['Enter',13],' ':['Space',32],Tab:['Tab',9]};
/** Chromium's input transport targets this private page without showing/focusing its native window. */
export function createHtmlInput(contents:WebContents,evaluate:Evaluate,settle:()=>Promise<void>,signal?:AbortSignal){
 let attached=false,commands=0;
 const send=async(method:string,params:Record<string,unknown>)=>{
  signal?.throwIfAborted();if(++commands>600)throw Error('input_budget');
  try{if(!attached){contents.debugger.attach('1.3');attached=true;}await contents.debugger.sendCommand(method,params);}catch{signal?.throwIfAborted();throw Error('input_unavailable');}
 };
 const press=async(key:string)=>{
  const code=keyCodes[key];if(!code)throw Error('input_unsupported');
  const params={key,code:code[0],windowsVirtualKeyCode:code[1],nativeVirtualKeyCode:code[1],...(key===' '?{text:' ',unmodifiedText:' '}:key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})};
  await send('Input.dispatchKeyEvent',{type:'keyDown',...params});await send('Input.dispatchKeyEvent',{type:'keyUp',...params});
 };
 const target=async(selector:string,set=false):Promise<Target>=>{
  await evaluate<void>(`(()=>{const es=document.querySelectorAll(${JSON.stringify(selector)});if(!es.length)throw Error('control_missing');if(es.length!==1)throw Error('control_ambiguous');es[0].scrollIntoView({block:'center',inline:'center',behavior:'instant'});})()`);await settle();
  return evaluate<Target>(`(()=>{
   const es=document.querySelectorAll(${JSON.stringify(selector)});if(!es.length)throw Error('control_missing');if(es.length!==1)throw Error('control_ambiguous');const e=es[0];
   if(e.matches(':disabled')||e.closest('[inert]'))throw Error('control_disabled');
   for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)throw Error('control_hidden');if(p.getAttribute('aria-disabled')?.toLowerCase()==='true')throw Error('control_disabled');}
   if(${set}&&'readOnly'in e&&e.readOnly)throw Error('control_readonly');
   let point;for(const r of e.getClientRects()){const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);if(right-left<1||bottom-top<1)continue;for(const fy of [.5,.2,.8])for(const fx of [.5,.2,.8]){const x=Math.floor(left+(right-left)*fx),y=Math.floor(top+(bottom-top)*fy),hit=document.elementFromPoint(x,y);if(hit&&(hit===e||e.contains(hit))){point={x,y};break;}}if(point)break;}
   if(!point)throw Error(e.getClientRects().length?'control_covered':'control_hidden');
   return{...point,tag:e.tagName,type:e.type||'',value:e.value||'',min:e.getAttribute('min')||'',max:e.getAttribute('max')||'',step:e.getAttribute('step')||'',values:e instanceof HTMLSelectElement?[...e.options].filter(o=>!o.disabled&&!o.closest('optgroup[disabled]')).map(o=>o.value):[]};
  })()`);
 };
 const focus=async(selector:string)=>{
  const ok=await evaluate<boolean>(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('control_missing');e.focus({preventScroll:true});return document.activeElement===e;})()`);if(!ok)throw Error('control_focus');
 };
 const click=async(selector:string)=>{
  let point=await target(selector);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});await settle();
  // Hover handlers may replace/cover the control; recheck before pressing the pointer.
  point=await target(selector);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
 };
 const value=async(selector:string,requested:string)=>{
  const info=await target(selector,true);
  if(info.tag==='SELECT'){
   if(info.type!=='select-one'||info.values.length>200)throw Error('input_unsupported');const index=info.values.indexOf(requested);if(index<0)throw Error('control_option');if(index>100)throw Error('input_budget');
   await focus(selector);await press('Home');for(let i=0;i<index;i++)await press('ArrowDown');
  }else if(info.tag==='INPUT'&&info.type==='range'){
   if(info.step==='any')throw Error('input_unsupported');
   const min=info.min===''?0:Number(info.min),max=info.max===''?100:Number(info.max),step=info.step===''?1:Number(info.step),desired=Number(requested),count=Math.floor((max-min)/step+1e-8),index=Math.round((desired-min)/step);
   if(!requested.trim()||![min,max,step,desired,count,index].every(Number.isFinite)||max<min||step<=0||desired<min||desired>max||Math.abs(min+index*step-desired)>1e-7||index<0||index>count)throw Error('control_value');
   const fromEnd=count-index<index,steps=fromEnd?count-index:index;if(steps>100)throw Error('input_budget');await focus(selector);await press(fromEnd?'End':'Home');for(let i=0;i<steps;i++)await press(fromEnd?'ArrowLeft':'ArrowRight');
  }else if(info.tag==='TEXTAREA'||info.tag==='INPUT'&&['text','search','number','email','url','tel','password'].includes(info.type)){
   await click(selector);await focus(selector);const all={key:'a',code:'KeyA',windowsVirtualKeyCode:65,nativeVirtualKeyCode:65,modifiers:2};await send('Input.dispatchKeyEvent',{type:'keyDown',...all});await send('Input.dispatchKeyEvent',{type:'keyUp',...all});
   if(requested)await send('Input.insertText',{text:requested});else{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});}
  }else throw Error('input_unsupported');
  await settle();const actual=await evaluate<string>(`document.querySelector(${JSON.stringify(selector)})?.value`);if(actual!==requested&&!(info.type==='range'&&Number(actual)===Number(requested)))throw Error('control_value');
  // Native editing commits its own change event on blur; never dispatch synthetic input/change.
  await evaluate<void>(`document.querySelector(${JSON.stringify(selector)})?.blur()`);
 };
 return{
  async perform(action:InteractionCheck['actions'][number]){signal?.throwIfAborted();if(action.kind==='click')await click(action.selector);else if(action.kind==='set')await value(action.selector,action.value);else{await target(action.selector);await focus(action.selector);await press(action.key);}await settle();signal?.throwIfAborted();},
  close(){if(attached&&!contents.isDestroyed()&&contents.debugger.isAttached())contents.debugger.detach();attached=false;},
 };
}

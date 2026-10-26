import {BrowserWindow,session,nativeImage} from 'electron';
import {randomUUID} from 'node:crypto';
import PptxGenJS from 'pptxgenjs';
import gifenc from 'gifenc';
const {GIFEncoder,quantize,applyPalette}=gifenc;
import {reopenScienceDemo} from './science-demo';
import {readScienceTeaching} from './science-teaching';

/** Serialized only after TypeScript compilation, so syntax is checked by the
 * production build. Arguments are JSON data, never interpolated as code. */
async function renderFrame(encoded:string,step:number,label:string) {
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'image/svg+xml');
 const groups=[...doc.querySelectorAll<SVGGElement>('g[data-science-part]')];
 groups.forEach((g,i)=>{
  const text=g.querySelector('title')?.textContent||'部件',category=text.replace(/[\s#]*[0-9０-９]+$/u,'')||text;
  const active=label?category===label:i===step-1;
  g.setAttribute('opacity',step===0&&!label?'1':active?'1':label?'0.12':i<step?'0.5':'0.05');
  if(label&&!active)g.querySelectorAll('.iso-fill,.iso-shade,.iso-top').forEach(face=>face.setAttribute('style','fill:none;stroke:none'));
  if(active&&(step||label))g.querySelector('.iso-edge')?.setAttribute('style','stroke:#176c50;stroke-width:2');
 });
 const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc));await image.decode();
 const canvas=document.querySelector('canvas')!,context=canvas.getContext('2d')!;
 context.fillStyle='#fff';context.fillRect(0,0,960,720);
 const scale=Math.min(960/image.naturalWidth,720/image.naturalHeight);
 context.drawImage(image,(960-image.naturalWidth*scale)/2,(720-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
 return canvas.toDataURL('image/png');
}

/** This page never receives a preload or a live SVG DOM. Only the fixed host
 * program reads inert XML and paints its serialized SVG into an image/canvas. */
export async function scienceClassroomMedia(html:string,format:'pptx'|'gif',signal:AbortSignal) {
 const rebuilt=reopenScienceDemo(html);
 const encoded=rebuilt.match(/<script id="science-data" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/)![1];
 const teaching=readScienceTeaching(Buffer.from(encoded,'base64').toString('utf8'));
 const isolated=session.fromPartition(`science-export-${randomUUID()}`);
 isolated.setPermissionRequestHandler((_web,_permission,done)=>done(false));isolated.setPermissionCheckHandler(()=>false);isolated.on('will-download',event=>event.preventDefault());
 isolated.webRequest.onBeforeRequest((detail,done)=>done({cancel:!detail.url.startsWith('data:')}));
 const win=new BrowserWindow({show:false,width:960,height:720,webPreferences:{session:isolated,sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.on('will-redirect',event=>event.preventDefault());
 const stop=()=>{if(!win.isDestroyed())win.destroy();};signal.addEventListener('abort',stop,{once:true});
 // Destroying a WebContents can leave executeJavaScript's promise pending.
 // Race its lifetime explicitly so Cancel always reaches a terminal result.
 async function bounded<T>(work:Promise<T>):Promise<T>{
  signal.throwIfAborted();let abort:()=>void=()=>{};
  const cancelled=new Promise<never>((_resolve,reject)=>{abort=()=>reject(Error('cancelled'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
  try{return await Promise.race([work,cancelled]);}finally{signal.removeEventListener('abort',abort);}
 }
 try{
  signal.throwIfAborted();await bounded(win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';img-src data:;style-src \'unsafe-inline\';script-src \'none\';base-uri \'none\';form-action \'none\'"><canvas width="960" height="720"></canvas>')));
  const meta=await bounded(win.webContents.executeJavaScript(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0));const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'image/svg+xml');const groups=[...doc.querySelectorAll('g[data-science-part]')];if(groups.length<40||groups.length>80||doc.querySelector('parsererror'))throw Error('unsupported');const labels=groups.map(g=>(g.querySelector('title')?.textContent||'部件').slice(0,64));return {count:groups.length,labels,title:doc.documentElement.getAttribute('aria-label')?.slice(0,80)||'科普结构演示',caption:[...doc.querySelectorAll('svg>text')].map(t=>t.textContent).join(' ').slice(0,600)};})()`));
  const width=960,height=720;
  async function frame(step:number,label=''){
   signal.throwIfAborted();
   const png=await bounded(win.webContents.executeJavaScript(`(${renderFrame.toString()})(${JSON.stringify(encoded)},${step},${JSON.stringify(label)})`));
   const image=nativeImage.createFromDataURL(png);if(image.isEmpty()||image.getSize().width!==width||image.getSize().height!==height)throw Error('read_failed');
   const bgra=image.toBitmap(),rgba=Buffer.alloc(bgra.length);for(let i=0;i<bgra.length;i+=4){rgba[i]=bgra[i+2];rgba[i+1]=bgra[i+1];rgba[i+2]=bgra[i];rgba[i+3]=255;}
   return {png:image.toPNG(),rgba};
  }
  const full=await frame(0),encoder=GIFEncoder(),palette=quantize(full.rgba,128);let frames=0;
  const add=(rgba:Uint8Array,delay:number)=>{encoder.writeFrame(applyPalette(rgba,palette),width,height,{palette,delay,repeat:0});frames++;};
  add(full.rgba,1800);
  const stride=Math.ceil(meta.count/36);
  for(let i=1;i<=meta.count;i+=stride){const f=await frame(i);signal.throwIfAborted();add(f.rgba,180);}
  add(full.rgba,2200);encoder.finish();const gif=Buffer.from(encoder.bytes());if(gif.length>16*1048576)throw Error('too_large');
  if(format==='gif')return {bytes:gif,frames,slides:0};
  const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='小智教育智能体';ppt.subject='教师备课：结构演示';ppt.title=meta.title;
  let slides=0;
  function slide(title:string,image:Buffer,kind:'png'|'gif',tip:string,explanation?:string,notes?:string){
   const s=ppt.addSlide();slides++;s.background={color:'F8FAF8'};
   const heading=Array.from(title);s.addText(heading.length>28?heading.slice(0,27).join('')+'…':title,{x:.55,y:.35,w:12.2,h:.6,fontFace:'Microsoft YaHei',fontSize:28,bold:true,color:'173E30',margin:0});
   s.addImage({data:`image/${kind};base64,`+image.toString('base64'),x:.55,y:1.15,w:7.8,h:5.85,altText:meta.title});
   s.addText(tip,{x:9,y:1.35,w:3.75,h:2.5,fontFace:'Microsoft YaHei',fontSize:teaching?18:20,color:'24332D',margin:0,breakLine:false});
   s.addText(explanation??('教师备课提示\n'+(meta.caption.length>240?meta.caption.slice(0,240)+'…（完整说明见备注）':meta.caption)),{x:9,y:4.1,w:3.75,h:2.5,fontFace:'Microsoft YaHei',fontSize:teaching?18:12,color:'52645A',margin:0,fit:'shrink'});
   s.addText(`${slides}  ·  结构示意，科学含义由教师核对`,{x:.55,y:7.15,w:12.2,h:.2,fontFace:'Microsoft YaHei',fontSize:10,color:'647068',margin:0});
   s.addNotes(`${title}\n小智科普结构演示。标题与提示可编辑，结构图为图片。${kind==='gif'?'本页内嵌GIF，桌面PowerPoint放映时循环，非HTML交互；可用后续逐步页暂停讲解。':'用前后翻页控制讲解；部件观察页淡化其他部件表面以辅助定位。'}\n${teaching?'授课对象：'+teaching.audience+'\n学习目标：'+teaching.objective+'\n'+(notes||''):meta.caption}`);
  }
  if(teaching){
   slide('观察结构 · '+meta.title,full.png,'png',teaching.observation,'学习目标\n'+teaching.objective,'先让学生观察，不提前透露参考答案。');
   slide('结构变化演示',gif,'gif','观察动图\n'+teaching.observation,'按后续讲解页停留观察。\n'+teaching.audience,'本页表示结构高亮顺序，不表示实际温度或热量变化。');
   for(const step of teaching.steps){const f=await frame(0,step.part);slide('观察部件 · '+step.part,f.png,'png',step.question,step.explanation,step.notes);}
   slide('想一想 · 理解检查',full.png,'png',teaching.check.question,'先说说你的理由，再与同学讨论。','参考答案：'+teaching.check.answer);
  }else{
  slide('观察结构 · '+meta.title,full.png,'png','先观察整体\n\n说一说：你能找到哪些部件？');
  slide('结构变化演示',gif,'gif','放映本页查看结构变化\n\n需要停下来讲解时，使用后面的逐步讲解页。');
  const labels=[...new Set<string>(meta.labels.map((text:string)=>text.replace(/[\s#]*[0-9０-９]+$/u,'')||text))].slice(0,6);
  for(const label of labels){const f=await frame(0,label);slide('观察部件 · '+label,f.png,'png',`重点观察：${label}\n\n它与其他部件怎样连接？\n它在这个结构中有什么作用？`);}
  }
  signal.throwIfAborted();const bytes=Buffer.from(await bounded(ppt.write({outputType:'nodebuffer',compression:true})) as Buffer);if(bytes.length>24*1048576)throw Error('too_large');return {bytes,frames,slides};
 }finally{signal.removeEventListener('abort',stop);stop();isolated.webRequest.onBeforeRequest(null);await isolated.clearStorageData();}
}

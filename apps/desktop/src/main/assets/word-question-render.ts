import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';
import {withStaticOfficePage} from '../xiaozhi-agent/office-pdf-renderer';
import {reserveLocalWorker} from '../xiaozhi-agent/local-utility-host';
import {WORD_QUESTION_ROLES,type WordQuestionSource,type WordQuestionRole} from '../../shared/material-word-question';
import {WORD_LAYOUT_VERSION,WORD_LAYOUT_WIDTH,WORD_LAYOUT_HEIGHT,buildWordQuestionLayout,wordPageSlices,type WordAtomicRect} from './word-question-layout';
import {fontGlyphCoverage,assertWordGlyphs} from './word-font-coverage';

export type WordProofEnvironment={renderer:typeof WORD_LAYOUT_VERSION;fontDigest:string;engine:string;scale:number;width:typeof WORD_LAYOUT_WIDTH;pageHeight:typeof WORD_LAYOUT_HEIGHT};
export type WordProofCoverage={span:number;blockId:string;kind:'paragraph'|'row';row?:number;top:number;bottom:number;text:string};
export type WordRenderedPage={role:WordQuestionRole;index:number;top:number;width:number;height:number;bytes:Buffer;coverage:WordProofCoverage[]};
export type WordRenderedProof={environment:WordProofEnvironment;sourceDigest:string;pages:WordRenderedPage[]};
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const fontCache=new Map<string,{stamp:string;digest:string;has:(cp:number)=>boolean}>();let active=false;

async function fonts(){
 const root=path.join(process.env.SystemRoot||process.env.WINDIR||'C:/Windows','Fonts'),values=[];
 for(const name of ['simsun.ttc','cambria.ttc']){
  const file=path.join(root,name);let stat;try{stat=await fs.stat(file);}catch{throw Error('font_unavailable');}
  if(!stat.isFile()||stat.size>64*1048576)throw Error('font_unavailable');
  const stamp=stat.size+':'+stat.mtimeMs+':'+stat.ctimeMs,cached=fontCache.get(file);
  if(cached?.stamp===stamp){values.push(cached);continue;}
  const bytes=await fs.readFile(file),after=await fs.stat(file);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs)throw Error('font_unavailable');
  const value={stamp,digest:sha(bytes),has:fontGlyphCoverage(bytes)};fontCache.set(file,value);values.push(value);
 }
 return {environment:{renderer:WORD_LAYOUT_VERSION,fontDigest:sha(JSON.stringify(values.map(v=>v.digest))),engine:process.versions.electron+':'+process.versions.chrome,scale:1,width:WORD_LAYOUT_WIDTH,pageHeight:WORD_LAYOUT_HEIGHT} satisfies WordProofEnvironment,coverage:values.map(v=>v.has)};
}
export async function wordProofEnvironment(){return (await fonts()).environment;}

/** Private fixed-page layout, no arbitrary paths/HTML/URLs are accepted from a renderer or model. */
export async function renderWordQuestionProof(source:WordQuestionSource,images:ReadonlyMap<string,Buffer>,options:{dataRoot:string;signal:AbortSignal;deadlineMs?:number}):Promise<WordRenderedProof>{
 if(options.signal.aborted)throw Error('cancelled');if(active)throw Error('busy');
 const release=reserveLocalWorker();if(!release)throw Error('busy');active=true;
 const timeout=AbortSignal.timeout(options.deadlineMs??60000),signal=AbortSignal.any([options.signal,timeout]);
 try{
  const font=await fonts();signal.throwIfAborted();const layout=buildWordQuestionLayout(source,images);
  const pages:WordRenderedPage[]=[];let totalBytes=0,totalPixels=0;
  await withStaticOfficePage(layout.html,{dataRoot:options.dataRoot,signal,deadlineMs:options.deadlineMs??60000,imageResources:layout.imageResources},async({Window,htmlPath})=>{
   const win=new Window({show:false,width:1320,height:1900,useContentSize:true,webPreferences:{sandbox:true,javascript:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:{useSharedTexture:false,deviceScaleFactor:1}}});
   win.webContents.setZoomFactor(1);
   await win.loadURL(pathToFileURL(htmlPath).href);
   win.setContentSize(1320,1900);
   for(const role of WORD_QUESTION_ROLES){
    if(!source.parts[role].length)continue;signal.throwIfAborted();
    const geometry:{height:number;atomics:WordAtomicRect[];coverage:WordProofCoverage[];text:string;scale:number}=await win.webContents.executeJavaScript(`(async()=>{
     const content=document.getElementById('content'),template=document.getElementById(${JSON.stringify(role)});
     document.body.style.height='auto';content.style.transform='none';content.replaceChildren(template.content.cloneNode(true));window.scrollTo(0,0);
     await document.fonts.ready;await Promise.all([...content.querySelectorAll('img')].map(async i=>{await i.decode();if(!i.complete||!i.naturalWidth||!i.naturalHeight||i.naturalWidth*i.naturalHeight!==Number(i.dataset.nativeWidth)*Number(i.dataset.nativeHeight))throw Error('source_incomplete');}));
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     const root=content.getBoundingClientRect(),height=Math.ceil(root.height);if(Math.abs(root.width-1240)>.1||content.scrollWidth>1240||[...content.querySelectorAll('p,table,math,img')].some(e=>{const b=e.getBoundingClientRect();return b.left<root.left-.5||b.right>root.right+.5;}))throw Error('too_large');
     const atomics=[],coverage=[],rect=e=>{const r=e.getBoundingClientRect();return {top:Math.ceil(r.top-root.top),bottom:Math.ceil(r.bottom-root.top)};};
     [...content.children].forEach(element=>{const span=Number(element.dataset.nativeSpan),blockId=element.dataset.nativeBlock;
      if(element.tagName==='TABLE'){
       [...element.querySelectorAll(':scope>tbody>tr')].forEach((tr,row)=>{const r=rect(tr);if(r.bottom>r.top)atomics.push(r);coverage.push({span,blockId,kind:'row',row,...r,text:tr.textContent});});
       [...element.querySelectorAll(':scope>tbody>tr>td[rowspan]')].filter(c=>Number(c.rowSpan)>1).forEach(td=>{const r=rect(td);if(r.bottom>r.top)atomics.push(r);});
      }else{const r=rect(element);if(r.bottom>r.top)atomics.push(r);coverage.push({span,blockId,kind:'paragraph',...r,text:element.textContent});}
     });return {height,atomics,coverage,text:content.textContent,scale:window.devicePixelRatio};
    })()`);
    if(geometry.scale!==font.environment.scale)throw Error('configuration');assertWordGlyphs(geometry.text,font.coverage);const slices=wordPageSlices(geometry.height,geometry.atomics);
    if(pages.length+slices.length>8)throw Error('too_large');
    const assigned=new Set<number>();
    for(const [index,slice] of slices.entries()){
     signal.throwIfAborted();
     // Move the fixed source surface instead of scrolling: Windows fractional DPI snaps scrollY.
     const actual=await win.webContents.executeJavaScript(`(()=>{window.scrollTo(0,0);const e=document.getElementById('content');e.style.transform='translateY(-${slice.top}px)';return e.getBoundingClientRect().top;})()`);
     if(Math.abs(actual+slice.top)>.01)throw Object.assign(Error('source_incomplete'),{cause:Error('capture_position:'+actual+':'+slice.top)});
     const image=await win.webContents.capturePage({x:0,y:0,width:WORD_LAYOUT_WIDTH,height:slice.height},{stayHidden:true,stayAwake:true}),bytes=image.toPNG({scaleFactor:1}),size=imageSize(bytes);
     if(size.width!==WORD_LAYOUT_WIDTH||size.height!==slice.height)throw Object.assign(Error('too_large'),{cause:Error('capture_size:'+size.width+':'+size.height+':'+slice.height)});
     if(bytes.length>4*1048576||(totalBytes+=bytes.length)>16*1048576||(totalPixels+=size.width*size.height)>32000000)throw Error('too_large');
     const coverage=geometry.coverage.filter((c,i)=>{const belongs=c.top>=slice.top&&c.bottom<=slice.top+slice.height&&!assigned.has(i);if(belongs)assigned.add(i);return belongs;});
     pages.push({role,index,top:slice.top,width:size.width,height:size.height,bytes,coverage});
    }
    if(assigned.size!==geometry.coverage.length)throw Object.assign(Error('source_incomplete'),{cause:Error('capture_coverage:'+assigned.size+':'+geometry.coverage.length)});
   }
  });
  signal.throwIfAborted();if(JSON.stringify(await wordProofEnvironment())!==JSON.stringify(font.environment))throw Error('font_unavailable');
  if(!pages.length)throw Error('source_incomplete');return {environment:font.environment,sourceDigest:layout.sourceDigest,pages};
 }catch(error){
  if(options.signal.aborted)throw Error('cancelled');if(timeout.aborted)throw Error('timeout');
  let reason:unknown=error;for(let i=0;i<8&&reason instanceof Error;i++,reason=(reason as Error&{cause?:unknown}).cause){if(['configuration','busy','too_large','source_changed','source_incomplete','font_unavailable','font_missing_glyph','cancelled','timeout'].includes(reason.message))throw Object.assign(Error(reason.message),{cause:error});}
  throw Object.assign(Error('generation_failed'),{cause:error});
 }finally{active=false;release();}
}

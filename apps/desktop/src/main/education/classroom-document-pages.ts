import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validClassroomOfficeSource,type ClassroomOfficeSource} from '../../shared/classroom-export';
import {withStaticOfficePage,type OfficeMathImage} from '../xiaozhi-agent/office-pdf-renderer';

/** Same fixed, local OpenMAIC SlideCanvas as the teacher preview. No model HTML,
 * network, preload, file authority or second runtime. Images exist only in memory. */
export async function renderClassroomDocumentPages(source:ClassroomOfficeSource,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number}){
 if(!validClassroomOfficeSource(source)||!source.purpose)throw Error('invalid_input');
 const payload=JSON.parse(fs.readFileSync(path.join(__dirname,'classroom-preview.json'),'utf8')) as {script:string;css:string};
 if(typeof payload.script!=='string'||typeof payload.css!=='string'||payload.script.length>8*1048576||payload.css.length>8*1048576)throw Error('configuration');
 const nonce=randomUUID(),fonts=[...payload.css.matchAll(/data:(?:font\/[^;,\s)"']+|application\/(?:font-woff|x-font-ttf));base64,[A-Za-z0-9+/=]+/g)].map(m=>m[0]);
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>${payload.css.replace(/<\/style/gi,'<\\/style')}</style></head><body><div id="root"></div><script nonce="${nonce}">window.__classroomReady=false;window.addEventListener('message',e=>{if(e.source===window&&e.data?.type==='xiaozhi-classroom-ready')window.__classroomReady=true;});${payload.script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
 return withStaticOfficePage(html,{...options,fontResources:fonts},async({Window,htmlPath})=>{
  const win=new Window({show:false,width:1200,height:800,useContentSize:true,webPreferences:{javascript:true,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await win.loadURL(pathToFileURL(htmlPath).href);
  const ready=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(window.__classroomReady)return resolve(true);if(Date.now()-start>10000)return reject(Error('renderer_not_ready'));setTimeout(check,20);};check();})`);
  if(!ready)throw Error('generation_failed');
  const pages=new Map<string,OfficeMathImage>();let total=0;
  for(const [index,scene]of source.document.scenes.entries()){
   if(scene.type!=='slide')continue;options.signal?.throwIfAborted();
   const width=Math.ceil(scene.content.canvas.viewportSize),height=Math.ceil(width*scene.content.canvas.viewportRatio),token=randomUUID();
   win.setContentSize(width,height);
   await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('message',done);reject(Error('render_timeout'));},15000);function done(e){if(e.source!==window||e.data?.type!=='xiaozhi-classroom-rendered'||e.data.token!==${JSON.stringify(token)})return;window.removeEventListener('message',done);clearTimeout(timer);Promise.all(Array.from(document.fonts).filter(f=>f.family.includes('KaTeX')).map(f=>f.load())).then(()=>document.fonts.ready).then(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).catch(reject);}window.addEventListener('message',done);window.postMessage(${JSON.stringify({type:'xiaozhi-classroom-slide',scene,editing:false,token})},'*');})`);
   const geometry=await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.classroom-canvas').getBoundingClientRect();return{x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
   if(geometry.x!==0||geometry.y!==0||geometry.width!==width||geometry.height!==height)throw Error('generation_failed');
   const image=await win.webContents.capturePage(geometry,{stayHidden:true,stayAwake:true}),bytes=image.toPNG();total+=bytes.length;
   if(!bytes.length||bytes.length>4*1048576||total>16*1048576)throw Error('too_large');
   const scale=Math.min(600/width,720/height,1);
   // Section zero is the document's audience/version notice.
   pages.set(String(index+1),{bytes,width:width*scale,height:height*scale});
  }
  return pages;
 });
}

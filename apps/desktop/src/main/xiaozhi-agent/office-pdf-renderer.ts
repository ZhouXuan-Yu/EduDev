import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {BrowserWindow,session} from 'electron';
import {renderHanaPdfJob} from './vendor/hana/office-pdf/render-job';
import {isMathPaperOfficeSchema} from '../../shared/paper-export';
import {officeMathHtml,officeMathParts} from '../../shared/office-math';
import type {OfficeDraft} from '../../shared/xiaozhi-office-draft';
import {officeImageSnapshot,officeFigureSize} from './office-images';
const escape=(value:unknown)=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Static document data, never arbitrary HTML or resource URLs supplied by a tool. */
export function officeDraftHtml(draft:OfficeDraft,images:ReadonlyMap<string,Buffer>=new Map()):string{
 const cellText=(value:unknown)=>isMathPaperOfficeSchema(draft.schemaVersion)?officeMathHtml(String(value)):escape(value);
 const paragraphs=(values:string[])=>values.map(value=>`<p>${isMathPaperOfficeSchema(draft.schemaVersion)?officeMathHtml(value):escape(value).replace(/\n/g,'<br>')}</p>`).join('');
 const body=(section:OfficeDraft['sections'][number])=>Array.from({length:section.paragraphs.length+1},(_,i)=>{
  const pictures=(section.figures?.filter(f=>f.afterParagraph===i)||[]).map(f=>{const size=officeFigureSize(f),bytes=images.get(f.assetId);if(!bytes)throw new Error('configuration');return `<figure style="margin:8pt 0;break-inside:avoid"><img alt="教师确认的原图" style="display:block;max-width:100%;width:${size.width}px;height:auto" width="${size.width}" height="${size.height}" src="data:image/png;base64,${bytes.toString('base64')}"></figure>`;}).join('');
  return pictures+(i<section.paragraphs.length?paragraphs([section.paragraphs[i]]):'');
 }).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(draft.title)}</title><style>@page{size:A4;margin:20mm}body{font-family:SimSun,"Microsoft YaHei",sans-serif;font-size:11pt;line-height:1.6;color:#111;overflow-wrap:anywhere}h1{font-size:20pt;text-align:center}h2{font-size:15pt;break-after:avoid}p{white-space:normal}math{font-family:"Cambria Math",math}math[display="block"]{margin:6pt 0;break-inside:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:10pt 0}thead{display:table-header-group}tr{break-inside:avoid}td,th{border:1px solid #aaa;padding:6pt;vertical-align:top;white-space:pre-wrap}th{background:#eee}section{break-inside:auto}</style></head><body><h1>${escape(draft.title)}</h1>${draft.sections.map(section=>`<section><h2>${escape(section.heading)}</h2>${body(section)}${section.table?`<table><thead><tr>${section.table.columns.map(cell=>`<th>${cellText(cell)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${cellText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:''}</section>`).join('')}</body></html>`;
}
/** Main-only private staging. The original Hana helper owns printToPDF and normal destruction. */
async function withStaticOfficePage<T>(html:string,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number;images?:ReadonlyMap<string,Buffer>},run:(context:{Window:typeof BrowserWindow;htmlPath:string;outputPath:string;deadline:number})=>Promise<T>):Promise<T>{
 if(options.signal?.aborted)throw new Error('cancelled');
 if(!path.isAbsolute(options.dataRoot))throw new Error('configuration');
 if(process.platform==='win32'){
  const fonts=path.join(process.env.SystemRoot||process.env.WINDIR||'C:/Windows','Fonts');
  if(!['simsun.ttc','msyh.ttc'].some(name=>{try{return fs.statSync(path.join(fonts,name)).isFile();}catch{return false;}}))throw new Error('configuration');
 }
 const images=options.images||new Map<string,Buffer>(),allowedImages=new Set([...images.values()].map(bytes=>'data:image/png;base64,'+bytes.toString('base64')));
 const root=fs.realpathSync(options.dataRoot),staging=fs.mkdtempSync(path.join(root,'office-render-'));
 const htmlPath=path.join(staging,'input.html'),outputPath=path.join(staging,'output.pdf'),url=pathToFileURL(htmlPath).href;
 const privateSession=session.fromPartition(`office-render-${randomUUID()}`);let window:BrowserWindow|undefined,reason:string|undefined;
 privateSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));privateSession.setPermissionCheckHandler(()=>false);
 privateSession.webRequest.onBeforeRequest({urls:['<all_urls>']},(details,callback)=>callback({cancel:details.url!==url&&!allowedImages.has(details.url)}));
 privateSession.on('will-download',event=>event.preventDefault());
 const stop=(code:string)=>{reason??=code;if(window&&!window.isDestroyed())window.destroy();};
 const abort=()=>stop('cancelled'),deadline=options.deadlineMs??60000;
 const timer=setTimeout(()=>stop('timeout'),deadline);options.signal?.addEventListener('abort',abort,{once:true});
 // Constructor injection only. The four upstream function bodies stay unchanged.
 class IsolatedWindow{
  constructor(input:Electron.BrowserWindowConstructorOptions){
   window=new BrowserWindow({...input,show:false,webPreferences:{...input.webPreferences,session:privateSession,javascript:input.webPreferences?.javascript??false,sandbox:true,nodeIntegration:false,contextIsolation:true}});
   window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-redirect',event=>event.preventDefault());window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   if(reason||options.signal?.aborted)stop(reason||'cancelled');return window;
  }
 }
 try{
  fs.writeFileSync(htmlPath,html,{flag:'wx',mode:0o600});
  if(options.signal?.aborted)abort();if(reason)throw new Error(reason);
  const result=await run({Window:IsolatedWindow as unknown as typeof BrowserWindow,htmlPath,outputPath,deadline});
  if(reason||options.signal?.aborted)throw new Error(reason||'cancelled');
  return result;
 }catch(error){throw Object.assign(new Error(reason||(options.signal?.aborted?'cancelled':'generation_failed')),{cause:error});}
 finally{
  clearTimeout(timer);options.signal?.removeEventListener('abort',abort);if(window&&!window.isDestroyed())window.destroy();
  privateSession.webRequest.onBeforeRequest(null);await privateSession.clearStorageData();
  // Two fixed owned files only; no recursive deletion or user-directory traversal.
  for(const file of [htmlPath,outputPath])try{fs.unlinkSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('cleanup_failed');}
  fs.rmdirSync(staging);
 }
}

/** Same static sandbox and unmodified Hana PDF job as v1–v3. */
export async function renderOfficePdf(draft:OfficeDraft,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number;images?:ReadonlyMap<string,Buffer>}):Promise<Buffer>{
 const images=officeImageSnapshot(draft,options.images);
 return withStaticOfficePage(officeDraftHtml(draft,images),{...options,images},async({Window,htmlPath,outputPath,deadline})=>{
  await renderHanaPdfJob({htmlPath,outputPath,viewport:{width:1280,height:900},embedHanaFonts:false,allowJavaScript:false,timeoutMs:deadline,settleMs:0,pageSize:'A4',preferCSSPageSize:true,printBackground:true,landscape:false},Window);
  return fs.readFileSync(outputPath);
 });
}
export type OfficeMathImage={bytes:Buffer;width:number;height:number};
/** Host-owned DOM measurement only; generated CSP still forbids every page script/resource.
 * Only fixed MathML from approved text is rasterized. No file/URL/asset identifiers are accepted. */
export async function renderOfficeMathImages(draft:OfficeDraft,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number}):Promise<Map<string,OfficeMathImage>>{
 const paragraphs=draft.sections.flatMap((s,si)=>s.paragraphs.flatMap((p,pi)=>officeMathParts(p).some(v=>v.kind==='math')?[{key:`${si}:${pi}`,text:p,width:1240}]:[]).concat(s.table?[s.table.columns,...s.table.rows].flatMap((row,ri)=>row.flatMap((cell,ci)=>officeMathParts(String(cell)).some(v=>v.kind==='math')?[{key:`${si}:table:${ri}:${ci}`,text:String(cell),width:Math.floor(1200/s.table!.columns.length)}]:[])):[]));
 if(paragraphs.length>200)throw Error('too_large');const result=new Map<string,OfficeMathImage>();if(!paragraphs.length)return result;
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'none';font-src 'none';base-uri 'none'"><style>body{margin:0;background:white;color:black;font:32px/1.6 SimSun,"Microsoft YaHei",sans-serif}.paragraph{width:1240px;padding:16px;box-sizing:border-box;overflow-wrap:anywhere}math{font-family:"Cambria Math",math}math[display="block"]{margin:16px 0}</style></head><body>${paragraphs.map((p,i)=>`<div class="paragraph" style="width:${p.width}px" id="p${i}">${officeMathHtml(p.text)}</div>`).join('')}</body></html>`;
 return withStaticOfficePage(html,options,async({Window,htmlPath})=>{
  const win=new Window({show:false,width:1320,height:1900,useContentSize:true,webPreferences:{sandbox:true,javascript:true,contextIsolation:true,nodeIntegration:false}});
  await win.loadURL(pathToFileURL(htmlPath).href);let total=0;
  for(let i=0;i<paragraphs.length;i++){
   options.signal?.throwIfAborted();
   const geometry=await win.webContents.executeJavaScript(`(()=>{document.querySelectorAll('.paragraph').forEach((e,j)=>{e.hidden=j!==${i};});window.scrollTo(0,0);const e=document.getElementById('p${i}');const r=e.getBoundingClientRect();return{x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height),scrollWidth:e.scrollWidth};})()`);
   if(geometry.width!==paragraphs[i].width||geometry.scrollWidth>paragraphs[i].width||geometry.height<1||geometry.height>1760||geometry.y<0)throw Error('too_large');
   const image=await win.webContents.capturePage({x:geometry.x,y:geometry.y,width:geometry.width,height:geometry.height},{stayHidden:true,stayAwake:true});
   const bytes=image.toPNG();total+=bytes.length;if(bytes.length>4*1048576||total>16*1048576)throw Error('too_large');
   result.set(paragraphs[i].key,{bytes,width:geometry.width/2,height:geometry.height/2});
  }
  return result;
 });
}

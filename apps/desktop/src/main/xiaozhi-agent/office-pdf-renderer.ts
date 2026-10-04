import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {BrowserWindow,session} from 'electron';
import {renderHanaPdfJob} from './vendor/hana/office-pdf/render-job';
import type {OfficeDraft} from '../../shared/xiaozhi-office-draft';
const escape=(value:unknown)=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Static document data, never arbitrary HTML or resource URLs supplied by a tool. */
export function officeDraftHtml(draft:OfficeDraft):string{
 const paragraphs=(values:string[])=>values.map(value=>`<p>${escape(value).replace(/\n/g,'<br>')}</p>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(draft.title)}</title><style>@page{size:A4;margin:20mm}body{font-family:SimSun,"Microsoft YaHei",sans-serif;font-size:11pt;line-height:1.6;color:#111;overflow-wrap:anywhere}h1{font-size:20pt;text-align:center}h2{font-size:15pt;break-after:avoid}p{white-space:normal}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:10pt 0}thead{display:table-header-group}tr{break-inside:avoid}td,th{border:1px solid #aaa;padding:6pt;vertical-align:top;white-space:pre-wrap}th{background:#eee}section{break-inside:auto}</style></head><body><h1>${escape(draft.title)}</h1>${draft.sections.map(section=>`<section><h2>${escape(section.heading)}</h2>${paragraphs(section.paragraphs)}${section.table?`<table><thead><tr>${section.table.columns.map(cell=>`<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:''}</section>`).join('')}</body></html>`;
}
/** Main-only private staging. The original Hana helper owns printToPDF and normal destruction. */
export async function renderOfficePdf(draft:OfficeDraft,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number}):Promise<Buffer>{
 if(options.signal?.aborted)throw new Error('cancelled');
 if(!path.isAbsolute(options.dataRoot))throw new Error('configuration');
 if(process.platform==='win32'){
  const fonts=path.join(process.env.SystemRoot||process.env.WINDIR||'C:/Windows','Fonts');
  if(!['simsun.ttc','msyh.ttc'].some(name=>{try{return fs.statSync(path.join(fonts,name)).isFile();}catch{return false;}}))throw new Error('configuration');
 }
 const root=fs.realpathSync(options.dataRoot),staging=fs.mkdtempSync(path.join(root,'office-render-'));
 const htmlPath=path.join(staging,'input.html'),outputPath=path.join(staging,'output.pdf'),url=pathToFileURL(htmlPath).href;
 const privateSession=session.fromPartition(`office-render-${randomUUID()}`);let window:BrowserWindow|undefined,reason:string|undefined;
 privateSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));privateSession.setPermissionCheckHandler(()=>false);
 privateSession.webRequest.onBeforeRequest({urls:['<all_urls>']},(details,callback)=>callback({cancel:details.url!==url}));
 privateSession.on('will-download',event=>event.preventDefault());
 const stop=(code:string)=>{reason??=code;if(window&&!window.isDestroyed())window.destroy();};
 const abort=()=>stop('cancelled'),deadline=options.deadlineMs??60000;
 const timer=setTimeout(()=>stop('timeout'),deadline);options.signal?.addEventListener('abort',abort,{once:true});
 // Constructor injection only. The four upstream function bodies stay unchanged.
 class IsolatedWindow{
  constructor(input:Electron.BrowserWindowConstructorOptions){
   window=new BrowserWindow({...input,show:false,webPreferences:{...input.webPreferences,session:privateSession,javascript:false,sandbox:true,nodeIntegration:false,contextIsolation:true}});
   window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-redirect',event=>event.preventDefault());window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   if(reason||options.signal?.aborted)stop(reason||'cancelled');return window;
  }
 }
 try{
  fs.writeFileSync(htmlPath,officeDraftHtml(draft),{flag:'wx',mode:0o600});
  if(options.signal?.aborted)abort();if(reason)throw new Error(reason);
  await renderHanaPdfJob({htmlPath,outputPath,viewport:{width:1280,height:900},embedHanaFonts:false,allowJavaScript:false,
   timeoutMs:deadline,settleMs:0,pageSize:'A4',preferCSSPageSize:true,printBackground:true,landscape:false},IsolatedWindow);
  if(reason||options.signal?.aborted)throw new Error(reason||'cancelled');
  return fs.readFileSync(outputPath);
 }catch(error){throw Object.assign(new Error(reason||(options.signal?.aborted?'cancelled':'generation_failed')),{cause:error});}
 finally{
  clearTimeout(timer);options.signal?.removeEventListener('abort',abort);if(window&&!window.isDestroyed())window.destroy();
  privateSession.webRequest.onBeforeRequest(null);await privateSession.clearStorageData();
  // Two fixed owned files only; no recursive deletion or user-directory traversal.
  for(const file of [htmlPath,outputPath])try{fs.unlinkSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('cleanup_failed');}
  fs.rmdirSync(staging);
 }
}

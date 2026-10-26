import type {IpcMain} from 'electron';
import {dialog,shell} from 'electron';
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {approvedFile} from './workspace-authority';
import {SCIENCE_EXPORT_SCHEMA} from '../../shared/science-export';
import type {ScienceExportOutput} from '../../shared/science-export';
import {createScienceExport,scienceExportRequest} from './science-export';
import type {WorkspaceLease} from './workspace-files';
export function registerScienceExportIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;resolve:(id:string)=>Promise<WorkspaceLease>}) {
  const run=createScienceExport({resolve:options.resolve,chooseMergeTarget:async()=>{
   const result=await dialog.showOpenDialog({title:'选择要追加到副本的已有课堂课件',buttonLabel:'生成课件副本',properties:['openFile'],filters:[{name:'PowerPoint 演示文稿',extensions:['pptx']}]});
   return result.canceled?undefined:result.filePaths[0];
  }}),requests=new Map<string,{sessionId:string;abort:AbortController}>();
 const completed=new Map<string,{sessionId:string;workspaceVersion:string;output:ScienceExportOutput}>();
 options.ipcMain.handle('xiaozhi:science-export',async(event,input)=>{
  const fail=(error:string)=>({ok:false,schemaVersion:SCIENCE_EXPORT_SCHEMA,error});
  if(!options.allowed(event))return fail('permission_denied');if(!scienceExportRequest(input))return fail('invalid_input');if(requests.size)return fail('busy');
  const abort=new AbortController();requests.set(input.requestId,{sessionId:input.sessionId,abort});
  const timer=setTimeout(()=>abort.abort('timeout'),90000);
  try{const result=await run(input,abort.signal);if(result.ok){if(completed.size>=64)completed.delete(completed.keys().next().value!);completed.set(input.requestId,{sessionId:input.sessionId,workspaceVersion:input.workspaceVersion,output:result.data});}return result;}finally{clearTimeout(timer);requests.delete(input.requestId);}
 });
 options.ipcMain.handle('xiaozhi:science-export-cancel',(event,input)=>{
  if(!options.allowed(event)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['sessionId','requestId'].includes(k))||typeof input.sessionId!=='string'||typeof input.requestId!=='string')return {ok:false};
  const request=requests.get(input.requestId);if(request&&request.sessionId===input.sessionId)request.abort.abort('cancelled');return {ok:true};
 });
 options.ipcMain.handle('xiaozhi:science-export-reveal',async(event,input)=>{
  if(!options.allowed(event)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['sessionId','requestId'].includes(k)))return {ok:false};
  const row=completed.get(input.requestId);if(!row||row.sessionId!==input.sessionId)return {ok:false};
  try{const lease=await options.resolve(row.sessionId);if(lease.version!==row.workspaceVersion)return {ok:false};const file=approvedFile(lease.path,row.output.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==row.output.bytes||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==row.output.sha256)return {ok:false};shell.showItemInFolder(file);return {ok:true};}catch{return {ok:false};}
 });
}

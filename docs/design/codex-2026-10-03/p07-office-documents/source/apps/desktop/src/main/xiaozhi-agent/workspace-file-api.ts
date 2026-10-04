import type { IpcMain } from 'electron';
import { XIAOZHI_FILES_SCHEMA, type XiaozhiFileError } from '../../shared/xiaozhi-files';
import { createWorkspaceFiles, validFileRequest, type WorkspaceLease } from './workspace-files';
import { DOCUMENT_TIMEOUT,isOfficeDocument } from '../../shared/xiaozhi-documents';

export function registerWorkspaceFileIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;resolve:(sessionId:string)=>Promise<WorkspaceLease>}) {
  const files=createWorkspaceFiles(options.resolve),requests=new Map<string,{sessionId:string;abort:AbortController}>();
  const fail=(input:unknown,error:XiaozhiFileError)=>({ok:false,schemaVersion:XIAOZHI_FILES_SCHEMA,requestId:typeof (input as {requestId?:unknown})?.requestId==='string'?String((input as {requestId:string}).requestId).slice(0,64):'',error});
  for(const method of ['list','preview'] as const)options.ipcMain.handle(`xiaozhi:files-${method}`,async(event,input)=>{
    if(!options.allowed(event))return fail(input,'permission_denied');
    if(!validFileRequest(input,method==='preview'))return fail(input,'invalid_input');
    if(requests.has(input.requestId)||requests.size>=8)return fail(input,'busy');
    const abort=new AbortController();requests.set(input.requestId,{sessionId:input.sessionId,abort});const timer=setTimeout(()=>abort.abort('timeout'),method==='preview'&&isOfficeDocument(input.path)?DOCUMENT_TIMEOUT+1000:10000);
    const work=files[method](input,abort.signal);
    let onAbort:()=>void=()=>{};
    const stopped=new Promise<ReturnType<typeof fail>>(resolve=>{onAbort=()=>resolve(fail(input,abort.signal.reason==='timeout'?'timeout':'cancelled'));abort.signal.addEventListener('abort',onAbort,{once:true});});
    // Return a terminal receipt even if an OS read is pending. Keep its slot reserved
    // until native work settles so cancelling cannot create unlimited background IO.
    const cleanup=()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);requests.delete(input.requestId);};
    void work.then(cleanup,cleanup);
    return Promise.race([work,stopped]);
  });
  options.ipcMain.handle('xiaozhi:files-cancel',(event,input)=>{
    if(!options.allowed(event))return {ok:false};
    if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['sessionId','requestId'].includes(key))
      || typeof input.sessionId!=='string' || !/^aisession_[a-f0-9-]{36}$/i.test(input.sessionId) || typeof input.requestId!=='string' || !/^xifile_[a-f0-9-]{36}$/i.test(input.requestId))return {ok:false};
    const current=requests.get(input.requestId);if(current&&current.sessionId===input.sessionId)current.abort.abort('cancelled');return {ok:true};
  });
}

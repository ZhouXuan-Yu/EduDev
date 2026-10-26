import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {dialog,type BrowserWindow,type IpcMain} from 'electron';
import type {OmniEduStore} from '../db';
import {validReplyExport,type ReplyExportInput,type ReplyExportResult} from '../../shared/reply-export';
import {authorizedWorkspace} from './workspace-authority';
import type {OfficeProjectedItem} from '../../shared/office-agent';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
/** Teacher-confirmed local copy into the existing artifact library; no model rewrite. */
export function registerReplyExport({ipcMain,store,window,dataRoot}:{ipcMain:IpcMain;store:OmniEduStore;window:()=>BrowserWindow|undefined;dataRoot:string}){
  let busy=false;
  async function source(input:ReplyExportInput){
    const detail=await store.getAiConversationSession(input.sessionId);
    if(detail.session.archivedAt)throw Error('permission_denied');
    const row=detail.messages.find(message=>message.role==='assistant'&&message.metadata.agentRunId===input.runId&&message.metadata.piVersion==='xiaozhi.pi.education.v1');
    const item=(row?.metadata.publicItems as OfficeProjectedItem[]|undefined)?.find(item=>item.id===input.itemId&&item.kind==='message'&&item.role==='assistant');
    if(!row||!item?.text?.trim()||hash(item.text)!==input.contentHash)throw Error('changed');
    return {row,item};
  }
  ipcMain.handle('xiaozhi:reply-export',async(event,raw:unknown):Promise<ReplyExportResult>=>{
    const win=window();if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'permission_denied'};
    if(!validReplyExport(raw))return {ok:false,error:'invalid_input'};
    if(busy)return {ok:false,error:'busy'};busy=true;
    try{
      const initial=await source(raw),artifactId='artifact_'+hash(raw.requestId);
      const existing=await store.getDocumentArtifact(artifactId);
      if(existing){
        try{
          const stat=lstatSync(existing.filePath);
          const same=existing.status==='exported'&&existing.title===raw.title.trim()&&existing.contentMd===initial.item.text&&existing.sessionId===raw.sessionId&&existing.messageId===initial.row.id
            &&stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=1048576&&hash(readFileSync(existing.filePath).toString('utf8'))===existing.contentHash;
          return same?{ok:true,artifact:existing}:{ok:false,error:'changed'};
        }catch{return {ok:false,error:'changed'};}
      }
      const chosen=await dialog.showOpenDialog(win,{title:'确认保存教学内容：选择本地文件夹',properties:['openDirectory','createDirectory']});
      if(chosen.canceled||!chosen.filePaths[0])return {ok:false,error:'cancelled'};
      if(win.isDestroyed())return {ok:false,error:'cancelled'};
      const directory=authorizedWorkspace(chosen.filePaths[0],dataRoot),current=await source(raw);
      const artifact=await store.exportDocumentArtifact({artifactId,sessionId:raw.sessionId,messageId:current.row.id,title:raw.title.trim(),type:'markdown',fileName:raw.title.trim()+'.md',contentMd:current.item.text!,destinationRoot:directory,description:current.item.phase==='partial_answer'?'教师确认保存的部分回复，内容尚未完成。':'教师确认保存的小智回复，答案仍需教师核对。'});
      return {ok:true,artifact};
    }catch(error){const code=(error as Error).message;return {ok:false,error:code==='changed'||code==='permission_denied'?code:'failed'};}
    finally{busy=false;}
  });
}

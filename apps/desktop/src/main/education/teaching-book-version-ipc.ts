import type {IpcMain,IpcMainInvokeEvent} from 'electron';
import type {TeachingBookVersionResult} from '../../shared/teaching-book-version';
import type {createTeachingBookVersions} from './teaching-book-versions';

type Repository=ReturnType<typeof createTeachingBookVersions>;
const messages:Record<string,string>={
  invalid_input:'讲义版本请求不完整，请重新打开讲义。',
  permission_denied:'当前窗口不能操作讲义版本。',
  book_unavailable:'讲义暂时无法打开，或已归档。',
  version_unavailable:'讲义历史版本暂时无法读取。',
  version_conflict:'讲义在预览后发生了变化，请刷新讲义并重新核对。',
  source_changed:'讲义引用的资料已变化，请核对当前原文后再确认。',
  draft_incomplete:'请先补全章节、页面和内容块，再确认整理完成的讲义。',
  version_too_large:'讲义正文或补丁记录超过单个版本的容量，请拆分后重试。',
};
const bookId=(value:unknown):value is string=>typeof value==='string'&&/^teaching_book_[a-f0-9-]{36}$/u.test(value);
const versionId=(value:unknown):value is string=>typeof value==='string'&&/^teaching_version_[a-f0-9-]{36}$/u.test(value);
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);

function args(value:unknown,allowedKeys:string[]):Record<string,unknown>&{bookId:string} {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowedKeys.includes(key)))
    throw Error('invalid_input');
  const input=value as Record<string,unknown>;
  if(!bookId(input.bookId))throw Error('invalid_input');
  return {...input,bookId:input.bookId};
}

export function registerTeachingBookVersionIpc(ipc:Pick<IpcMain,'handle'>,allowed:(event:IpcMainInvokeEvent)=>boolean,state:Repository) {
  function handle<T>(name:string,action:(raw:unknown)=>Promise<T>) {
    ipc.handle('teachingBook:'+name,async(event,input):Promise<TeachingBookVersionResult<T>>=>{
      try{
        if(!allowed(event))throw Error('permission_denied');
        return {ok:true,value:await action(input)};
      }catch(error){
        const raw=error instanceof Error?error.message:'',code=Object.hasOwn(messages,raw)?raw:'version_unavailable';
        return {ok:false,error:code,message:messages[code]};
      }
    });
  }
  handle('versionHistory',raw=>{
    const input=args(raw,['bookId','before']);
    const before=input.before;
    if(before!==undefined&&(typeof before!=='number'||!Number.isSafeInteger(before)||before<1))throw Error('invalid_input');
    return state.history(input.bookId,before);
  });
  handle('versionPreview',raw=>{
    const input=args(raw,['bookId','versionId']);
    const id=input.versionId;
    if(id!==undefined&&!versionId(id))throw Error('invalid_input');
    return state.preview({bookId:input.bookId,versionId:id});
  });
  handle('versionConfirm',raw=>{
    const input=args(raw,['bookId','digest']);
    if(!digest(input.digest))throw Error('invalid_input');
    return state.confirm({bookId:input.bookId,digest:input.digest});
  });
  handle('versionRestore',raw=>{
    const input=args(raw,['bookId','currentDigest','versionId','versionDigest']);
    if(!digest(input.currentDigest)||!digest(input.versionDigest)||!versionId(input.versionId))throw Error('invalid_input');
    return state.restore({bookId:input.bookId,currentDigest:input.currentDigest,versionId:input.versionId,versionDigest:input.versionDigest});
  });
}

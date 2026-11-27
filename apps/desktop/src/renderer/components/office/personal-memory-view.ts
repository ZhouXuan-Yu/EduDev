import {useCallback, useEffect, useRef, useState} from 'react';
import type {PersonalMemoryError, PersonalMemoryResult, PersonalMemoryScope} from '../../../shared/xiaozhi-personal-memory';

const scopeNames = {teacher:'教师',class:'班级',course:'课程',task:'任务',artifact:'成果'} satisfies Record<PersonalMemoryScope['kind'],string>;
const failureText:Partial<Record<PersonalMemoryError,string>> = {
  revision_conflict:'记录已有新版本。请刷新后重新核对。',
  source_changed:'原话或授权已经变化，请刷新后重新核对。',
  stale_policy:'记忆设置已经变化，请刷新后重新核对。',
  cancelled:'自动处理已暂停，这次采用未保存。',
  command_conflict:'这次操作与已记录的请求不一致，请刷新后核对。',
  busy:'小智正在处理其他操作，请稍后重试。',
  permission_denied:'当前授权或内容限制了这项操作。个人记忆不能保存学生个人记录或凭据。',
};

export function scopeText(scope:PersonalMemoryScope,term:string) {
  const range=scope.kind==='teacher'?scopeNames.teacher:scopeNames[scope.kind]+' '+scope.id;
  return range+' · '+(term==='unknown'?'有效期限待核对':term);
}

export function replyValue<T>(reply:PersonalMemoryResult<T>|undefined):T {
  if (!reply?.ok) throw Error(reply?.error ?? 'configuration');
  return reply.value;
}

export type PerformMemoryAction = (action:(refresh:()=>Promise<void>)=>Promise<string|undefined>)=>Promise<void>;

export async function afterMemoryCommit(message:string,reload:()=>Promise<void>) {
  try {await reload();}
  catch {return message+'列表更新失败，请刷新。';}
  return message;
}

export function usePersonalMemoryView<T>(read:(()=>Promise<PersonalMemoryResult<T>>|undefined)|undefined) {
  const [view,setView]=useState<T>();
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<{message:string;error:boolean}>();
  const pending=useRef(false);
  const generation=useRef(0);

  const perform=useCallback<PerformMemoryAction>(async action=>{
    if (pending.current) return;
    pending.current=true;
    const request=++generation.current;
    setBusy(true);
    setFeedback(undefined);
    try {
      const notice=await action(async()=>{
        const next=replyValue(await read?.());
        if (request===generation.current) setView(next);
      });
      if (notice && request===generation.current) setFeedback({message:notice,error:false});
    } catch (error) {
      const code=(error instanceof Error?error.message:'') as PersonalMemoryError;
      if (request===generation.current) setFeedback({message:failureText[code]??'暂时无法完成记忆操作，请刷新后重试。',error:true});
    } finally {
      if (request===generation.current) {
        pending.current=false;
        setBusy(false);
      }
    }
  },[read]);

  useEffect(()=>()=>{generation.current++;pending.current=false;},[]);
  const refresh=useCallback(()=>perform(async reload=>{await reload();return undefined;}),[perform]);
  return {view,busy,feedback,perform,refresh};
}

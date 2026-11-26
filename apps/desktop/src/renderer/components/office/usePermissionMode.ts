import {useEffect, useRef, useState} from 'react';
import type {PermissionProfile} from '../../../shared/xiaozhi-permissions';
import {writePiPermissionMode, type PiPermissionMode} from './permissionModes';

export function usePermissionMode(sessionId: string, onError: (message: string) => void) {
  const [profile, setProfile] = useState<PermissionProfile>();
  const current = useRef(sessionId);
  current.current = sessionId;
  const changing = useRef(false);
  const request=useRef(0);
  function accept(next:PermissionProfile){
    if(current.current!==next.sessionId)return;
    setProfile(previous=>previous?.sessionId===next.sessionId&&previous.revision>next.revision?previous:next);
  }
  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    const read=()=>{
      const own=++request.current;
      if(sessionId)void window.omniEdu?.getXiaozhiPermissions?.(sessionId).then(result=>{
        if(!cancelled&&current.current===sessionId&&own===request.current&&result.ok)accept(result.value.profile);
      }).catch(()=>undefined);
    };
    read();
    const changed=window.settingsHost?.onChanged(read);
    return () => {cancelled = true;request.current++;changed?.();};
  }, [sessionId]);
  async function setMode(mode: PiPermissionMode) {
    if (!profile || changing.current) return;
    const target = sessionId;
    changing.current = true;
    request.current++;
    try {
      const result = await window.omniEdu?.setXiaozhiPermissionMode?.({sessionId: target, revision: profile.revision, mode});
      if (current.current !== target) return;
      if (!result?.ok) throw Error('permission');
      accept(result.value.profile);
      writePiPermissionMode(result.value.profile.mode);
    } catch { if (current.current === target) onError('权限模式未保存，请从资料与权限页刷新后重试。'); }
    finally {changing.current = false;}
  }
  return {permissionMode: profile?.mode || 'request', setPermissionMode: (mode: PiPermissionMode) => {void setMode(mode);}};
}

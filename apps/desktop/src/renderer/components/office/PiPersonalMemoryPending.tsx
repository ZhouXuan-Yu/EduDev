import {useCallback,useEffect} from 'react';
import {Button} from '@heroui/react';
import {PiPersonalMemoryCandidates} from './PiPersonalMemoryCandidates';
import {SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';
import {usePersonalMemoryView} from './personal-memory-view';

export function PiPersonalMemoryPending({sessionId,onClose}:{sessionId:string;onClose:()=>void}) {
  const read=useCallback(()=>window.omniEdu?.personalMemory?.queue(sessionId),[sessionId]);
  const {view,busy,feedback,perform,refresh}=usePersonalMemoryView(read);

  useEffect(()=>{void refresh();},[refresh]);
  return <SettingsStack gap="sm" data-testid="personal-memory-conversation-review">
    <SettingsInline>
      <Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>void refresh()}>刷新建议</Button>
      <Button size="sm" variant="ghost" onPress={onClose}>关闭核对</Button>
    </SettingsInline>
    {busy&&<p role="status">正在处理记忆建议…</p>}
    {feedback&&<p role={feedback.error?'alert':'status'}>{feedback.message}</p>}
    {view&&<PiPersonalMemoryCandidates queue={view} busy={busy} perform={perform}/>}
  </SettingsStack>;
}

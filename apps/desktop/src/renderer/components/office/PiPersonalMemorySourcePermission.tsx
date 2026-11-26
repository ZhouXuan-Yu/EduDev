import {useEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import type {HistorySourceRef} from '../../../shared/xiaozhi-history-memory';
import type {PersonalMemorySourcePermission} from '../../../shared/xiaozhi-personal-memory';
import {SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';

export function PiPersonalMemorySourcePermission({source,disabled}: {source:HistorySourceRef; disabled:boolean}) {
  const [grant,setGrant]=useState<PersonalMemorySourcePermission>();
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const pending=useRef(false);
  const api=window.omniEdu?.personalMemory;
  useEffect(()=>{
    let current=true;
    void api?.sourceStatus(source).then(result=>{if (current && result.ok) setGrant(result.value);}).catch(()=>undefined);
    return ()=>{current=false;};
  },[api,source]);
  if (!grant) return null;

  async function update(expected:PersonalMemorySourcePermission) {
    if (pending.current) return;
    pending.current=true;
    setBusy(true);
    setNotice('');
    try {
      const result=await api?.setSource({ref:source,enabled:!expected.allowed,revision:expected.revision});
      if (!result?.ok) {
        const latest=await api?.sourceStatus(source);
        if (latest?.ok) setGrant(latest.value);
        throw Error(result?.error ?? 'configuration');
      }
      setGrant(result.value);
      setNotice(result.value.allowed?'已允许从这条原话提取记忆建议。':'已撤回提取授权。');
    } catch {
      setNotice('授权操作未完成，请核对当前来源后重试。');
    } finally {
      pending.current=false;
      setBusy(false);
    }
  }

  return <SettingsStack gap="sm">
    <p>开启自动处理后，小智可将这条脱敏教师原话发送给 DeepSeek 生成待核对的建议。</p>
    <SettingsInline>
      <Button size="sm" variant="ghost" isDisabled={busy||disabled} data-testid="personal-memory-source-consent"
        onPress={()=>void update(grant)}>{grant.allowed?'撤回提取授权':'允许提取记忆'}</Button>
      {notice&&<span role="status">{notice}</span>}
    </SettingsInline>
  </SettingsStack>;
}

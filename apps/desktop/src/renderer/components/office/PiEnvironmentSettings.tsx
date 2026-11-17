import {useEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import type {EnvironmentView} from '../../../shared/xiaozhi-environment';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PiAcquisitionSettings} from './PiAcquisitionSettings';

export function PiEnvironmentSettings({sessionId}: {sessionId: string}) {
  const [received, setReceived] = useState<{sessionId: string; value: EnvironmentView}>();
  const view = received?.sessionId === sessionId ? received.value : undefined;
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = useRef(sessionId);
  const live = useRef(false), request = useRef(0), generation = useRef(0);
  const repairOwner = useRef<symbol | undefined>(undefined);
  owner.current = sessionId;
  async function refresh() {
    const target = sessionId;
    const revision = ++request.current;
    try {
      const result = await window.omniEdu?.getXiaozhiEnvironment?.(target);
      if (!live.current || owner.current !== target || revision !== request.current) return;
      if (!result?.ok) throw Error('unavailable');
      setReceived({sessionId: target, value: result.value});
    } catch {
      if (live.current && owner.current === target && revision === request.current) setNotice('环境诊断暂不可用，请刷新。');
    }
  }
  useEffect(() => {
    live.current = true; generation.current++; repairOwner.current = undefined;
    setReceived(undefined); setNotice(''); setBusy(false);
    void refresh();
    return () => {live.current = false; generation.current++; request.current++;};
  }, [sessionId]);
  async function repair(recipe: 'workspace_text' | 'permission_runtime' = 'workspace_text') {
    if (repairOwner.current) return;
    const target = sessionId, epoch = generation.current, token = Symbol('environment-repair');
    repairOwner.current = token;
    const current = () => live.current && owner.current === target && generation.current === epoch;
    setBusy(true);
    try {
      const result = await window.omniEdu?.repairXiaozhiEnvironment(sessionId, recipe);
      if (!result?.ok || !result.value.ok) throw Error('unavailable');
      if (current()) setNotice('修复任务已开始，可返回对话查看实际结果与授权申请。');
    } catch {if (current()) setNotice('修复任务未启动，请检查当前任务状态。');}
    finally {if (repairOwner.current === token) {repairOwner.current = undefined; if (current()) setBusy(false);}}
  }
  return <section aria-label="本地环境" data-testid="pi-environment-settings">
    <h3>本地环境</h3>
    {view ? <>
      <p>{view.platform.os} · {view.platform.arch} · Node {view.platform.node}</p>
      {view.checks.map(item => <p key={item.id} data-testid={`pi-environment-${item.id}`}>{item.label} · {item.detail}</p>)}
      {view.checks.some(item => item.id === 'workspace_text' && item.status === 'needs_configuration')
        && <Button size="sm" variant="secondary" isDisabled={busy} data-testid="pi-environment-repair" onPress={() => void repair()}>修复文本配置</Button>}
      {view.permissionRuntime?.status === 'needs_configuration' && <Button size="sm" variant="secondary" isDisabled={busy}
        data-testid="pi-environment-runtime-repair" onPress={() => void repair('permission_runtime')}>配置受控终端</Button>}
    </> : <p role="status">正在检查已授本地环境…</p>}
    <DisclosureCard title={<>外部能力状态</>} data-testid="pi-environment-acquisition">
      <PiAcquisitionSettings sessionId={sessionId} mode="environment"/>
    </DisclosureCard>
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void refresh()}>重新检查</Button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}

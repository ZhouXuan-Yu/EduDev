import {useEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import type {EnvironmentView} from '../../../shared/xiaozhi-environment';

export function PiEnvironmentSettings({sessionId}: {sessionId: string}) {
  const [view, setView] = useState<EnvironmentView>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = useRef(sessionId);
  owner.current = sessionId;
  async function refresh() {
    const target = sessionId;
    const result = await window.omniEdu?.getXiaozhiEnvironment?.(target);
    if (owner.current !== target) return;
    if (!result?.ok) throw Error('unavailable');
    setView(result.value);
  }
  useEffect(() => {
    let stopped = false;
    void refresh().catch(() => {if (!stopped) setNotice('环境诊断暂不可用，请刷新。');});
    return () => {stopped = true;};
  }, [sessionId]);
  async function repair(recipe: 'workspace_text' | 'permission_runtime' = 'workspace_text') {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.omniEdu?.repairXiaozhiEnvironment(sessionId, recipe);
      if (!result?.ok || !result.value.ok) throw Error('unavailable');
      setNotice('修复任务已开始，可返回对话查看实际结果与授权申请。');
    } catch {setNotice('修复任务未启动，请检查当前任务状态。');}
    finally {setBusy(false);}
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
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void refresh().catch(() => setNotice('环境诊断暂不可用。'))}>重新检查</Button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}

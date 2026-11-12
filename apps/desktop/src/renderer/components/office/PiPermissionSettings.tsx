import {useEffect, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import type {PermissionView, PermissionApproval} from '../../../shared/xiaozhi-permissions';
import {PI_PERMISSION_MODES} from './permissionModes';
import {permissionResource as resource, permissionAction, permissionClassification} from './permissionPresentation';

export function PiPermissionSettings({sessionId}: {sessionId: string}) {
  const [view, setView] = useState<PermissionView>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const owner = useRef(sessionId);
  owner.current = sessionId;
  async function refresh() {
    const target = sessionId;
    const result = await window.omniEdu?.getXiaozhiPermissions?.(target);
    if (owner.current !== target) return;
    if (!result?.ok) throw Error('unavailable');
    setView(result.value);
  }
  useEffect(() => {
    let stopped = false;
    setView(undefined);
    void refresh().catch(() => {if (!stopped) setNotice('权限记录读取失败，请刷新。');});
    return () => {stopped = true;};
  }, [sessionId]);
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const result = await action() as {ok?: boolean};
      if (!result?.ok) throw Error('permission');
      await refresh();
    } catch {setNotice('操作未完成，请刷新当前权限后重试。');}
    finally {setBusy(false);}
  }
  function decide(item: PermissionApproval, decision: 'approve' | 'reject', scope: PermissionApproval['scope']) {
    return mutate(() => window.omniEdu!.decideXiaozhiPermission({sessionId, approvalId: item.id, revision: item.revision, decision, scope}));
  }
  return <section data-testid="pi-permission-authority" aria-label="主进程授权">
    <h3>自主模式</h3>
    <p>模式作用于当前明确授权的工作目录。网络、工具连接和资料外发分别授权。</p>
    <div role="group" aria-label="自主模式">
      {PI_PERMISSION_MODES.map(mode => <Button key={mode.id} size="sm" variant={view?.profile.mode === mode.id ? 'secondary' : 'ghost'}
        isDisabled={!view || busy} aria-pressed={view?.profile.mode === mode.id} data-testid={`pi-settings-permission-${mode.id}`}
        onPress={() => void mutate(() => window.omniEdu!.setXiaozhiPermissionMode({sessionId, revision: view!.profile.revision, mode: mode.id}))}>{mode.label}</Button>)}
    </div>
    {notice && <p role="alert">{notice}</p>}
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void refresh().catch(() => setNotice('权限记录读取失败。'))}>刷新权限</Button>
    {view?.grants.filter(grant => !grant.revokedAt).map(grant => <div key={grant.grantId} data-testid="pi-permission-grant">
      <p>{resource(grant.scope)}</p>
      <Button size="sm" variant="ghost" isDisabled={busy} data-testid="pi-permission-revoke"
        onPress={() => void mutate(() => window.omniEdu!.revokeXiaozhiGrant({sessionId, grantId: grant.grantId, revision: grant.revision}))}>撤销</Button>
    </div>)}
    {view?.approvals.filter(item => item.state === 'pending').map(item => <div key={item.id} data-testid="pi-permission-request">
      <p>{permissionAction(item.request.action)} · {item.request.purpose}</p>
      <p>{item.request.scopes.map(resource).join(' · ')}</p>
      <p>调用参数分类 {permissionClassification[item.request.classification]}</p>
      <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{item.request.summary || item.request.inputDigest}</pre>
      <p>有效至 {new Date(item.request.expiresAt).toLocaleString()}。拒绝后小智继续授权内可行步骤。</p>
      <Button size="sm" variant="primary" isDisabled={busy} onPress={() => void decide(item, 'approve', 'operation')}>批准本次</Button>
      <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void decide(item, 'approve', 'task')}>授权当前任务</Button>
      <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void decide(item, 'reject', 'operation')}>拒绝</Button>
    </div>)}
    {view?.legacyApprovals?.map(item => <div key={item.id} data-testid="pi-permission-legacy">
      <p>{item.source} → {item.target}</p>
      {item.state === 'pending' ? <>
        <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void mutate(() => window.omniEdu!.decideXiaozhi({sessionId, approvalId: item.id, decision: 'approve'}))}>批准历史待办</Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void mutate(() => window.omniEdu!.decideXiaozhi({sessionId, approvalId: item.id, decision: 'reject'}))}>拒绝</Button>
      </> : <Button size="sm" variant="secondary" isDisabled={busy} data-testid="pi-permission-resume-legacy"
        onPress={() => void mutate(() => window.omniEdu!.resumeXiaozhiLegacyApproval({sessionId, approvalId: item.id}))}>继续已批准的复制</Button>}
    </div>)}
  </section>;
}

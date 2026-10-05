import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';

export type WorkspaceStatus = {
  state: 'loading' | 'recovering' | 'compacting' | 'running' | 'approval' | 'input'
    | 'send_interrupted' | 'failed' | 'stopped' | 'history' | 'ended' | 'idle';
  label: string;
};

/** Public presentation only: historical turns do not prove a new task succeeded. */
export function workspaceStatus(snapshot?: XiaozhiWorkspaceSnapshot, compactBusy = false): WorkspaceStatus {
  if (!snapshot) return { state: 'loading', label: '正在读取会话' };
  if (snapshot.projection.needsHydration) return { state: 'recovering', label: '正在恢复会话' };
  if (compactBusy || (snapshot.running && snapshot.operation === 'compact'))
    return { state: 'compacting', label: '正在整理上下文' };

  const turn = snapshot.projection.turns.at(-1);
  if (snapshot.running) {
    const compaction = [...(turn?.items || [])].reverse().find(item => item.kind === 'compaction');
    if (compaction?.status === 'inProgress') return { state: 'compacting', label: '正在整理上下文' };
    if (turn?.status === 'waiting_approval') return { state: 'approval', label: '等待确认' };
    if (turn?.status === 'waiting_input') return { state: 'input', label: '等待补充' };
    return { state: 'running', label: '运行中' };
  }
  if (snapshot.interruptedSend) return { state: 'send_interrupted', label: '发送已中断' };
  // A transient historical read must never announce completion while recovery is unresolved.
  if (turn && ['running', 'waiting_approval', 'waiting_input'].includes(turn.status))
    return { state: 'recovering', label: '正在恢复会话' };
  if (turn?.status === 'failed') return { state: 'failed', label: '上轮未完成' };
  if (turn?.status === 'interrupted') return { state: 'stopped', label: '上轮已停止' };
  if (!turn) return { state: 'idle', label: '等待提问' };
  if (snapshot.legacyHistory) return { state: 'history', label: '历史记录' };
  return { state: 'ended', label: '上轮已结束' };
}

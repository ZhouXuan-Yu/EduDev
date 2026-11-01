import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';

const targets = {
  copy: ['pi-copy-approval', 'data-approval-id'],
  question: ['pi-teacher-question', 'data-control-id'],
  change: ['pi-text-change', 'data-change-id'],
  office: ['pi-office-artifact', 'data-office-id'],
  delivery: ['pi-delivery-bundle', 'data-bundle-id'],
} as const;
export type WorkspacePendingItem = { kind: keyof typeof targets; id: string; label: string };

/** Presentation facts only; the host still verifies permission, revision and files. */
export function workspaceNotifications(snapshot?: XiaozhiWorkspaceSnapshot) {
  const pending: WorkspacePendingItem[] = [];
  const runs = new Set(snapshot?.projection.turns.map(turn => turn.id));
  const bundled = new Set(snapshot?.deliveries?.flatMap(bundle => bundle.files.filter(file => !file.carried).map(file => file.draftId)));
  for (const item of snapshot?.approvals ?? []) if (runs.has(item.runId) && item.state === 'pending') pending.push({ kind: 'copy', id: item.id, label: '确认复制资料' });
  for (const item of snapshot?.controls ?? []) if (runs.has(item.runId) && item.kind === 'question' && (item.state === 'pending' || item.state === 'interrupted' && item.canResume)) pending.push({ kind: 'question', id: item.id, label: '回答小智的问题' });
  for (const item of snapshot?.changes ?? []) if (runs.has(item.runId) && !bundled.has(item.id) && item.state === 'pending') pending.push({ kind: 'change', id: item.id, label: '确认文件修改' });
  for (const item of snapshot?.officeArtifacts ?? []) if (runs.has(item.runId) && !bundled.has(item.id) && item.state === 'pending') pending.push({ kind: 'office', id: item.id, label: '确认文档草稿' });
  for (const item of snapshot?.deliveries ?? []) if (runs.has(item.runId) && item.state === 'pending') pending.push({ kind: 'delivery', id: item.id, label: '确认整包教学文件' });
  const hasFiles = !!snapshot?.changes?.some(item => item.state === 'applied' && !!item.path)
    || !!snapshot?.officeArtifacts?.some(item => item.state === 'saved' && !!item.path)
    || !!snapshot?.deliveries?.some(bundle => bundle.files.some(file => file.change?.state === 'applied' || file.artifact?.state === 'saved'));
  return { pending, hasFiles };
}

/** Resolve by identity inside this shell, never an approval in a hidden session. */
export function focusWorkspacePending(root: HTMLElement, item: WorkspacePendingItem): boolean {
  const [testId, attribute] = targets[item.kind];
  const card = [...root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)].find(node => node.getAttribute(attribute) === item.id);
  if (!card) return false;
  const trigger = card.querySelector<HTMLButtonElement>('[data-slot="chat-tool-trigger"]');
  if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click();
  requestAnimationFrame(() => {
    if (!root.isConnected || !card.isConnected || root.closest('[hidden],[inert],[aria-hidden="true"]')) return;
    card.scrollIntoView({ block: 'center' });
    const input = [...card.querySelectorAll<HTMLElement>('textarea:not(:disabled),input:not(:disabled):not([type="hidden"])')]
      .find(node => !node.closest('[hidden],[inert],[aria-hidden="true"]') && (node.checkVisibility?.({ checkVisibilityCSS: true }) ?? true));
    // A review card may contain an inactive editor. Keep its preview/trigger in
    // focus instead of choosing an invisible input or a write decision button.
    (input ?? trigger)?.focus({ preventScroll: true });
  });
  return true;
}

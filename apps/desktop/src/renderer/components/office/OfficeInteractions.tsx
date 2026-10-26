import type { ReactNode } from 'react';
import {OfficeMutationBoundary} from './OfficeSynchronization';
export {OfficeSynchronization} from './OfficeSynchronization';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';

export type OfficeInteraction = {
  id: string; runId: string; callId?: string;
  kind: 'question' | 'instruction' | 'approval' | 'change' | 'artifact' | 'learning' | 'collection' | 'question_review' | 'original_batch' | 'paper' | 'practice' | 'task_review';
  content: ReactNode;
};

/** Position is a view of persisted identity, never an authority or model guess. */
export function interactionLayout(turn: OfficeProjectedTurn, interactions: readonly OfficeInteraction[]) {
  const tools = new Set(turn.items.filter(item => item.kind === 'tool').map(item => item.id));
  const anchored = new Map<string, OfficeInteraction[]>(), unanchored: OfficeInteraction[] = [], seen = new Set<string>();
  for (const item of interactions) {
    if (item.runId !== turn.id || seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.callId && tools.has(item.callId)) anchored.set(item.callId, [...(anchored.get(item.callId) || []), item]);
    else unanchored.push(item);
  }
  return { anchored, unanchored };
}

export function OfficeInteractionCards({ items, anchored }: { items: readonly OfficeInteraction[]; anchored: boolean }) {
  if (!items.length) return null;
  return <div className="office-interactions" data-testid={anchored ? 'pi-inline-interactions' : 'pi-unanchored-interactions'}>
    {!anchored && items.some(item => item.kind !== 'instruction' && item.kind !== 'task_review') && <p className="office-history-notice">其他交互记录 · 操作位置未包含在当前记录中</p>}
    {items.map(item => <div key={item.id} data-interaction-id={item.id} data-interaction-kind={item.kind}
      data-position={anchored ? 'after-call' : 'unanchored'} data-call-id={anchored ? item.callId : undefined}><OfficeMutationBoundary>{item.content}</OfficeMutationBoundary></div>)}
  </div>;
}

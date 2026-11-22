import { useState } from 'react';
import type { OfficeProjection } from '../../../shared/office-agent';
import { WorkbenchHomeSuggestions } from '../product/WorkbenchHome';
import { useOfficeComposerState } from './OfficeComposerState';
import { PiHomeActivity, type HomeActivityActions } from './PiHomeActivity';

/** A loading/partially hydrated thread must never masquerade as a new conversation. */
export function isHomeConversation(projection?: OfficeProjection): boolean {
  return !!projection && !projection.turns.length && !projection.needsHydration && !projection.hasMoreHistory;
}

/** A sibling of the original composer, never a replacement or alternate mount point. */
export function PiHomeSuggestions({ visible, activity, activityRevision }: { visible: boolean; activity?: HomeActivityActions; activityRevision?: number }) {
  const { draftRef, setDraft } = useOfficeComposerState();
  const [hint, setHint] = useState('');
  return <div className="wb-start-below" hidden={!visible}>
    {visible && activity && <PiHomeActivity key={activityRevision} {...activity} />}
    <WorkbenchHomeSuggestions onSuggest={text => {
      if (draftRef.current.trim()) { setHint('输入框中已有草稿，已为你保留。发送或清空后可选择示例。'); return; }
      setDraft(text); setHint('');
      requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus());
    }} />
    {hint && <p className="wb-start-hint" role="status">{hint}</p>}
  </div>;
}

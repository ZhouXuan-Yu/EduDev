export interface ComposerDraft { text: string; skill: string }
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'xiaozhi.composer-draft.v1:';
const empty = (): ComposerDraft => ({ text: '', skill: '' });
/** Local unsent text only; this record never authorizes or submits a task. */
export function readComposerDraft(sessionId?: string, storage?: Pick<StoragePort, 'getItem'>): ComposerDraft {
  try {
    if (!sessionId || sessionId === 'loading') return empty();
    const value = JSON.parse((storage ?? localStorage).getItem(prefix + sessionId) || 'null');
    return value?.version === 1 && typeof value.text === 'string' && value.text.length <= 65536
      && typeof value.skill === 'string' && value.skill.length <= 128 ? { text: value.text, skill: value.skill } : empty();
  } catch { return empty(); }
}
export function writeComposerDraft(sessionId: string | undefined, value: ComposerDraft, storage?: Partial<StoragePort>): boolean {
  try {
    if (!sessionId || sessionId === 'loading') return false;
    const target = storage ?? localStorage;
    if (!value.text && !value.skill) target.removeItem?.(prefix + sessionId);
    else target.setItem?.(prefix + sessionId, JSON.stringify({ version: 1, text: value.text.slice(0, 65536), skill: value.skill.slice(0, 128) }));
    return true;
  } catch { return false; }
}

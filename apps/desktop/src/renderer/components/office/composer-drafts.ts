import {validPaperExportIntent,copyPaperExportIntent,type PaperExportIntent} from '../../../shared/paper-export';
export type ComposerPaperSeed={text:string;paperExportIntent:PaperExportIntent};
export interface ComposerDraft { text: string; skill: string; paperExportIntent?:PaperExportIntent;
 paperExportInvalid?:boolean;pendingPaperExport?:ComposerPaperSeed }
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'xiaozhi.composer-draft.v1:';
const empty = (): ComposerDraft => ({ text: '', skill: '' });
/** Local unsent text only; this record never authorizes or submits a task. */
export function readComposerDraft(sessionId?: string, storage?: Pick<StoragePort, 'getItem'>): ComposerDraft {
  try {
    if (!sessionId || sessionId === 'loading') return empty();
    const value = JSON.parse((storage ?? localStorage).getItem(prefix + sessionId) || 'null');
    if(value?.version!==1||typeof value.text!=='string'||value.text.length>65536||typeof value.skill!=='string'||value.skill.length>128)return empty();
    const draft:ComposerDraft={text:value.text,skill:value.skill};
    if(Object.hasOwn(value,'paperExportIntent')){
      if(validPaperExportIntent(value.paperExportIntent))draft.paperExportIntent=copyPaperExportIntent(value.paperExportIntent);
      else draft.paperExportInvalid=true;
    }
    if(value.paperExportInvalid)draft.paperExportInvalid=true;
    if(Object.hasOwn(value,'pendingPaperExport')){
      const seed=value.pendingPaperExport;
      if(seed&&typeof seed.text==='string'&&seed.text.length>0&&seed.text.length<=32768&&validPaperExportIntent(seed.paperExportIntent))
        draft.pendingPaperExport={text:seed.text,paperExportIntent:copyPaperExportIntent(seed.paperExportIntent)};
      else draft.paperExportInvalid=true;
    }
    return draft;
  } catch { return empty(); }
}
export function writeComposerDraft(sessionId: string | undefined, value: ComposerDraft, storage?: Partial<StoragePort>): boolean {
  try {
    if (!sessionId || sessionId === 'loading') return false;
    const target = storage ?? localStorage;
    if (!value.text && !value.skill&&!value.paperExportIntent&&!value.paperExportInvalid&&!value.pendingPaperExport) target.removeItem?.(prefix + sessionId);
    else target.setItem?.(prefix + sessionId, JSON.stringify({ version: 1, ...value, text: value.text.slice(0, 65536), skill: value.skill.slice(0, 128) }));
    return true;
  } catch { return false; }
}

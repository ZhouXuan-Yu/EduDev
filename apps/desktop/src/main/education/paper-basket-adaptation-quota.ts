import {generatedPaperCount} from '../../shared/paper-blueprint';
import type {PaperAdaptationPrepare} from '../../shared/paper-basket-adaptation';
import type {StoredBasket} from './paper-basket-state';

/** A27 reserves room for one variation before any model admission, and checks
 * again before attachment. Ordinary manual practice additions keep their policy.
 * Caller owns the transaction; this function neither opens one nor changes state.
 */
export function assertAdaptationQuota(basket: StoredBasket,
  input: Pick<PaperAdaptationPrepare, 'entryId' | 'intent'>): void {
  const {entries,blueprint}=basket.data;
  const original=entries.find(entry=>entry.entryId===input.entryId);
  const section=blueprint.sections.find(section=>section.id===original?.sectionId);
  if(!original||!section)throw Error('conflict');
  // A27 produces a parent-derived variation, never an AI-original question.
  if(blueprint.mode!=='hybrid')throw Error('shortage');
  const retained=entries.filter(entry=>entry.sectionId===section.id
    && (input.intent!=='replace'||entry.entryId!==original.entryId));
  const generated=retained.filter(entry=>entry.question.sourceKind==='generated').length;
  if(retained.length+1>section.count
    ||generated+1>generatedPaperCount(blueprint,section))throw Error('shortage');
}

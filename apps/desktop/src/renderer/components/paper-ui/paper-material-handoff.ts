import {validBasketId} from '../../../shared/paper-basket';
import {validPaperSession} from '../../../shared/paper-blueprint';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import type {MaterialReference, MaterialSourceView} from '../../../shared/materials';
import type {useDesktopNavigation} from '../desktop/DesktopFrame';

/** A navigation hint, never a cached basket, source version or permission. */
export type PaperReturnReference = {sessionId: string; basketId: string; stage: PaperBasketUiState['stage']};

export function samePaperReturn(a?: PaperReturnReference, b?: PaperReturnReference): boolean {
  return a?.sessionId === b?.sessionId && a?.basketId === b?.basketId && a?.stage === b?.stage;
}

export function validPaperReturn(value: unknown): value is PaperReturnReference {
  if (!value || typeof value !== 'object') return false;
  const ref = value as PaperReturnReference;
  return Object.keys(ref).sort().join(',') === 'basketId,sessionId,stage' && validPaperSession(ref.sessionId) &&
    validBasketId(ref.basketId) && ['select', 'organize', 'preview'].includes(ref.stage);
}

export function paperReturnTarget(ref: PaperReturnReference) {
  return {view: 'paper', sessionId: ref.sessionId,
    paper: {mode: 'basket' as const, basketId: ref.basketId, stage: ref.stage}};
}

type Navigation = ReturnType<typeof useDesktopNavigation>;

/** Shared by App's actual materials and notebook consumers; no session creation. */
export function paperMaterialActions(navigation: Navigation) {
  const paperReturn = validPaperReturn(navigation.target.paperReturn) ? navigation.target.paperReturn : undefined;
  return {
    paperReturn,
    returnToPaper: () => paperReturn ? navigation.navigate(paperReturnTarget(paperReturn), {ifCurrent: navigation.target, ifIntent: navigation.intent}) : false,
    openSourcePage: (view: 'knowledge' | 'question_notebook') => paperReturn
      ? navigation.navigate({view, paperReturn}, {ifCurrent: navigation.target, ifIntent: navigation.intent}) : false,
  };
}

export async function openPaperMaterialSource(navigation: Navigation, source: MaterialReference,
  request: {current: number}, show: (view: MaterialSourceView) => void): Promise<boolean> {
  if (!window.omniEdu) throw new Error('unavailable');
  const stamp = ++request.current, origin = navigation.target, intent = navigation.intent;
  const verified = await window.omniEdu.getMaterialSource(source);
  if (stamp !== request.current || !navigation.navigate({view: 'knowledge',
    ...(validPaperReturn(origin.paperReturn) ? {paperReturn: origin.paperReturn} : {})}, {ifCurrent: origin, ifIntent: intent})) return false;
  show(verified);
  return true;
}

const KEY = 'xiaozhi.ui.paper-basket-reference.v1';
export type BasketReference = {sessionId: string; basketId: string};

/** Navigation hint only. No question, revision, blueprint, or UI facts are cached here. */
export function readBasketReference(): BasketReference | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 1024) return;
    const value = JSON.parse(raw);
    if (value?.schema !== 1 || Object.keys(value).sort().join(',') !== 'basketId,schema,sessionId') return;
    if (validPaperSession(value.sessionId) && validBasketId(value.basketId)) {
      return {sessionId: value.sessionId, basketId: value.basketId};
    }
  } catch { /* An inaccessible optional navigation hint must not prevent host reads. */ }
}

export function writeBasketReference(reference: BasketReference): void {
  try {
    const next = JSON.stringify({schema: 1, sessionId: reference.sessionId, basketId: reference.basketId});
    if (localStorage.getItem(KEY) !== next) localStorage.setItem(KEY, next);
  } catch { /* Basket contents and restoration preferences remain host-owned. */ }
}
import {validBasketId} from '../../../shared/paper-basket';
import {validPaperSession} from '../../../shared/paper-blueprint';

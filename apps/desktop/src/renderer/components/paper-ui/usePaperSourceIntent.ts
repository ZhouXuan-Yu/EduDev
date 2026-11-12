import {useEffect, useRef, useState} from 'react';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import type {usePaperBasketWorkspace} from './usePaperBasketWorkspace';

export type PaperSourceAction = 'requirements' | 'reference';
type Intent = {action: PaperSourceAction; token: string};
type Receipt = {token: string; basketId: string; sessionId: string};

/** Opens an existing source workflow after the original create/retry reply is verified. */
export function usePaperSourceIntent(state: ReturnType<typeof usePaperBasketWorkspace>,
  onActivate: (action: PaperSourceAction) => void) {
  const [pending, setPending] = useState<Intent>();
  const [receipt, setReceipt] = useState<Receipt>();
  const intent = useRef<Intent | undefined>(undefined);
  const activate = useRef(onActivate);
  activate.current = onActivate;
  useEffect(() => () => {intent.current = undefined;}, []);
  useEffect(() => {
    const choice = intent.current, basket = state.basket;
    if (!choice || !receipt || choice.token !== receipt.token || state.loading || state.busy || state.retryable ||
      basket?.id !== receipt.basketId || basket.sessionId !== receipt.sessionId) return;
    intent.current = undefined;
    setPending(undefined); setReceipt(undefined);
    activate.current(choice.action);
  }, [receipt, state.basket?.id, state.basket?.sessionId, state.loading, state.busy, state.retryable]);
  function begin(action: PaperSourceAction) {
    if (state.loading || state.busy || state.retryable || intent.current) return false;
    if (state.basket) {
      if (state.basket.state !== 'active') return false;
      activate.current(action);
    } else {
      const choice = {action, token: crypto.randomUUID()};
      intent.current = choice;
      setPending(choice); setReceipt(undefined);
    }
    return true;
  }
  function creationHandler() {
    const token = intent.current?.token;
    return token ? (basket: PaperWorkspaceBasket) => {
      if (intent.current?.token !== token) return false;
      setReceipt({token, basketId: basket.id, sessionId: basket.sessionId});
      return true;
    } : undefined;
  }
  function cancel() {
    intent.current = undefined;
    setPending(undefined); setReceipt(undefined);
  }
  return {pending: pending?.action, begin, creationHandler, cancel};
}

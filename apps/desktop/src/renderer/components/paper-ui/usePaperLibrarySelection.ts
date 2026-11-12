import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import {PAPER_BASKET_SCHEMA} from '../../../shared/paper-basket';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {basketErrors, basketReasons} from './paper-basket-ui';
import {paperBasketClient, type PaperWorkspaceBasket} from './paper-basket-client';
import type {usePaperBasketWorkspace} from './usePaperBasketWorkspace';

export type PaperLibrarySelection = {
  questionId: string;
  contentVersion: string;
  subject: string;
  grade: string;
  ui: PaperBasketUiState;
};
type Intent = PaperLibrarySelection & {token: string};
type Created = {token: string; basketId: string; sessionId: string};

/** A transient choice becomes a write only after this creation's verified host reply. */
export function usePaperLibrarySelection(state: ReturnType<typeof usePaperBasketWorkspace>) {
  const navigation = useDesktopNavigation();
  const [pending, setPending] = useState<Intent>();
  const [created, setCreated] = useState<Created>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{basketId: string; questionId: string; message: string}>();
  const intent = useRef<Intent | undefined>(undefined);
  const latest = useRef(state);
  latest.current = state;
  const alive = useRef(true);
  const working = useRef(false);
  const consumed = useRef('');
  useEffect(() => {
    alive.current = true;
    return () => {alive.current = false; intent.current = undefined;};
  }, []);
  useLayoutEffect(() => navigation.registerGuard(() => working.current
    ? '正在核对刚才选中的题目，请等待结果后离开。' : undefined), [navigation.registerGuard]);
  useEffect(() => {
    const basket = state.basket;
    if (failure && !state.loading && (!basket || basket.id !== failure.basketId ||
        basket.entries.some(entry => entry.questionId === failure.questionId))) setFailure(undefined);
  }, [failure, state.basket, state.loading]);

  useEffect(() => {
    const choice = intent.current, basket = state.basket;
    if (!created || !choice || created.token !== choice.token || consumed.current === choice.token ||
        state.busy || state.retryable || !basket || basket.id !== created.basketId || basket.sessionId !== created.sessionId) return;
    consumed.current = choice.token;
    working.current = true;
    setBusy(true);
    const current = () => alive.current && intent.current?.token === choice.token &&
      latest.current.basket?.id === created.basketId && latest.current.basket?.sessionId === created.sessionId;
    void (async () => {
      try {
        if (!window.omniEdu) throw Error('题目读取未完成。');
        const result = await paperBasketClient(window.omniEdu).candidate({schemaVersion: PAPER_BASKET_SCHEMA,
          sessionId: created.sessionId, basketId: created.basketId, questionId: choice.questionId});
        if (!current()) return;
        if (!result.ok) throw Error(basketErrors[result.error]);
        const candidate = result.value;
        if (candidate.contentVersion !== choice.contentVersion) throw Error('题目来源已变化，请重新核对后加入。');
        if (!candidate.eligibility.available) throw Error(basketReasons[candidate.eligibility.reason]);
        const sectionId = candidate.matchingSectionIds[0];
        if (!sectionId) throw Error('当前题篮没有匹配分节，请核对蓝图后加入。');
        await latest.current.mutate({type: 'add', questionId: choice.questionId, sectionId,
          expectedSourceVersion: choice.contentVersion});
      } catch (error) {
        if (current()) setFailure({basketId: created.basketId, questionId: choice.questionId,
          message: '题篮已保存，刚才选择的题目尚未加入。' + (error instanceof Error ? error.message : '请重新核对题目。')});
      } finally {
        if (alive.current) {
          if (current()) {
            latest.current.changeUi(choice.ui);
          }
          if (intent.current?.token === choice.token) {
            intent.current = undefined;
            setPending(undefined);
            setCreated(undefined);
          }
          working.current = false;
          setBusy(false);
        }
      }
    })();
  }, [created, state.basket?.id, state.basket?.sessionId, state.busy, state.retryable]);

  function begin(choice: PaperLibrarySelection): 'ready' | 'configure' | false {
    if (intent.current || working.current || state.busy || state.loading || state.retryable || state.basket) return false;
    const next = {...choice, token: crypto.randomUUID()};
    intent.current = next;
    setPending(next); setCreated(undefined); setFailure(undefined);
    return state.preparePracticeDefaults({subject: choice.subject, grade: choice.grade}) ? 'ready' : 'configure';
  }
  function creationHandler() {
    const token = intent.current?.token;
    return token ? (basket: PaperWorkspaceBasket) => {
      if (!alive.current || intent.current?.token !== token) return false;
      setCreated({token, basketId: basket.id, sessionId: basket.sessionId});
      return true;
    } : undefined;
  }
  function cancel() {
    if (working.current) return;
    intent.current = undefined;
    setPending(undefined); setCreated(undefined);
  }
  return {pending, busy, error: failure?.message ?? '', begin, creationHandler, cancel};
}

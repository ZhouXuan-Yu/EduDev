import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {AiConversationSession} from '../../../shared/contracts';
import {defaultPaperBlueprint, PAPER_SCHEMA, type PaperBlueprint, type PaperView} from '../../../shared/paper-blueprint';
import {PAPER_BASKET_SCHEMA, type PaperBasketMutationInput, type PaperBasketOperation,
  type PaperBasketResult, type PaperBasketSummary, type PaperBasketUiState, type PaperBasketView} from '../../../shared/paper-basket';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {basketErrors, basketSnapshotCurrent, emptyBasketUi, sameBasketUi} from './paper-basket-ui';
import {readBasketReference, writeBasketReference} from './paper-basket-reference';

type Owner = Pick<AiConversationSession, 'id' | 'title'>;

/** Host facts and local input are separate. Only successful host replies replace saved content. */
export function usePaperBasketWorkspace(initialSessionId?: string) {
  const navigation = useDesktopNavigation();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [summaries, setSummaries] = useState<PaperBasketSummary[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryOffset, setSummaryOffset] = useState(0);
  const [basket, setBasket] = useState<PaperBasketView>();
  const [snapshot, setSnapshot] = useState<PaperView>();
  const [ui, setUi] = useState<PaperBasketUiState>(emptyBasketUi);
  const [blueprint, setBlueprint] = useState<PaperBlueprint>(defaultPaperBlueprint);
  const [dirty, setDirty] = useState(false);
  const [uiDirty, setUiDirty] = useState(false);
  const [uiSaveBlocked, setUiSaveBlocked] = useState(false);
  const [uiDiscarded, setUiDiscarded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const current = useRef({basket, ui, blueprint, dirty, ownerId, uiDiscarded});
  current.current = {basket, ui, blueprint, dirty, ownerId, uiDiscarded};
  const route = useRef(navigation.target); route.current = navigation.target;
  const epoch = useRef(0), lock = useRef(false), retry = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const retryKind = useRef<'content' | 'ui' | undefined>(undefined);
  const alive = useRef(true);
  const initialized = useRef(false);
  const uiPending = useRef(false);
  const internalNavigation = useRef(false);
  const guard = useRef('');
  guard.current = dirty ? '蓝图有未保存修改，请保存或放弃修改后离开。'
    : retryable ? '操作结果尚未核实，请重试原操作或重新读取后离开。'
    : busy || uiDirty && !uiDiscarded ? '浏览偏好尚未保存，请保存或明确放弃后离开。' : '';
  useEffect(() => {alive.current = true; return () => {alive.current = false; epoch.current++;};}, []);
  useLayoutEffect(() => navigation.registerGuard(() => internalNavigation.current ? undefined : guard.current || undefined), [navigation.registerGuard]);

  function adopt(next: PaperBasketView, restore = false) {
    current.current.basket = next;
    setBasket(next);
    setSummaries(old => [next, ...old.filter(item => item.id !== next.id)]);
    writeBasketReference({sessionId: next.sessionId, basketId: next.id});
    if (restore || !current.current.dirty) {
      current.current.blueprint = next.blueprint;
      current.current.dirty = false;
      setBlueprint(next.blueprint); setDirty(false);
    }
    if (restore) {
      const restored = next.uiState || emptyBasketUi();
      current.current.ui = restored; setUi(restored); setUiDirty(false); uiPending.current = false;
      setUiSaveBlocked(false);
      current.current.uiDiscarded = false; setUiDiscarded(false);
      setSnapshot(undefined); setRestoreKey(value => value + 1);
    }
  }

  async function execute<T>(task: () => Promise<PaperBasketResult<T>>, apply: (value: T) => void,
    kind: 'content' | 'ui' = 'content'): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    const stamp = epoch.current;
    setBusy(true); setError(''); setRetryable(false); retry.current = undefined; retryKind.current = undefined;
    try {
      const result = await task();
      if (!alive.current || stamp !== epoch.current) return false;
      if (!result.ok) {setError(basketErrors[result.error]); return false;}
      apply(result.value);
      return true;
    } catch {
      if (alive.current && stamp === epoch.current) {
        setError('操作响应未到达，结果尚未确定。可重试同一请求；不会自动重复加入或生成。');
        retry.current = () => execute(task, apply, kind); retryKind.current = kind; setRetryable(true);
      }
      return false;
    } finally {
      lock.current = false;
      if (alive.current && stamp === epoch.current) setBusy(false);
    }
  }

  function target(next: PaperBasketView, stage = (next.uiState || emptyBasketUi()).stage, replace = false) {
    internalNavigation.current = true;
    try {navigation.navigate({view: 'paper', sessionId: next.sessionId, paper: {mode: 'basket', basketId: next.id, stage}}, {replace});}
    finally {internalNavigation.current = false;}
  }

  async function read(sessionId: string, basketId: string, navigate = true, replace = false) {
    if (lock.current) return false;
    const stamp = ++epoch.current;
    setLoading(true); if (!uiSaveBlocked) setError(''); setRetryable(false); retry.current = undefined; retryKind.current = undefined;
    try {
      const result = await window.omniEdu!.readPaperBasket({schemaVersion: PAPER_BASKET_SCHEMA, sessionId, basketId});
      if (!alive.current || stamp !== epoch.current) return false;
      if (!result.ok) {setError(basketErrors[result.error]); return false;}
      setOwnerId(sessionId); current.current.ownerId = sessionId;
      adopt(result.value, current.current.basket?.id !== result.value.id);
      if (navigate) target(result.value, current.current.ui.stage, replace);
      return true;
    } catch {
      if (alive.current && stamp === epoch.current) setError(basketErrors.unavailable);
      return false;
    } finally {if (alive.current && stamp === epoch.current) setLoading(false);}
  }

  async function loadOwner(id: string, requestedBasket?: string, replace = false) {
    if (lock.current || current.current.dirty) return false;
    const stamp = ++epoch.current;
    setLoading(true); setError(''); setOwnerId(id); current.current.ownerId = id;
    setBasket(undefined); current.current.basket = undefined; setSnapshot(undefined);
    setSummaries([]); setSummaryTotal(0); setSummaryOffset(0);
    const empty = emptyBasketUi(); current.current.ui = empty; setUi(empty);
    uiPending.current = false; setUiDirty(false); setUiSaveBlocked(false); setUiDiscarded(false);
    current.current.uiDiscarded = false;
    if (!id) {setLoading(false); return true;}
    try {
      // Only the selected owner, one page. Other owners' student permissions are never probed.
      const result = await window.omniEdu!.listPaperBaskets({schemaVersion: PAPER_BASKET_SCHEMA, sessionId: id, offset: 0, limit: 50});
      if (!alive.current || stamp !== epoch.current) return false;
      if (!result.ok) {setError(basketErrors[result.error]); return false;}
      setSummaries(result.value.items); setSummaryTotal(result.value.total);
      setSummaryOffset(result.value.offset + result.value.items.length);
      const selected = requestedBasket || result.value.items.find(item => item.state === 'active')?.id;
      if (selected) return await read(id, selected, true, replace);
      return true;
    } catch {
      if (alive.current && stamp === epoch.current) setError(basketErrors.unavailable);
      return false;
    } finally {if (alive.current && stamp === epoch.current) setLoading(false);}
  }

  async function loadMore() {
    if (loading || busy || summaryOffset >= summaryTotal) return;
    const stamp = epoch.current, id = current.current.ownerId;
    setLoading(true);
    try {
      const result = await window.omniEdu!.listPaperBaskets({schemaVersion: PAPER_BASKET_SCHEMA, sessionId: id, offset: summaryOffset, limit: 50});
      if (!alive.current || stamp !== epoch.current) return;
      if (!result.ok) {setError(basketErrors[result.error]); return;}
      setSummaries(old => [...old, ...result.value.items.filter(item => !old.some(saved => saved.id === item.id))]);
      setSummaryTotal(result.value.total);
      setSummaryOffset(result.value.items.length ? result.value.offset + result.value.items.length : result.value.total);
    } catch {if (alive.current && stamp === epoch.current) setError(basketErrors.unavailable);}
    finally {if (alive.current && stamp === epoch.current) setLoading(false);}
  }

  useEffect(() => {
    let live = true;
    const stamp = ++epoch.current;
    void (async () => {
      try {
        const workspace = await window.omniEdu!.listAiConversations();
        const sessions = workspace.sessions.filter(session => !session.archivedAt).map(({id, title}) => ({id, title}));
        if (!live) return;
        setOwners(sessions);
        if (!live || stamp !== epoch.current) return;
        const destination = route.current;
        const hint = destination.view === 'paper' && destination.sessionId ? {sessionId: destination.sessionId, basketId: destination.paper?.basketId}
          : readBasketReference() || (initialSessionId ? {sessionId: initialSessionId, basketId: undefined} : undefined);
        initialized.current = true;
        await loadOwner(hint?.sessionId || sessions[0]?.id || '', hint?.basketId, true);
      } catch (reason) {
        if (live && stamp === epoch.current) setError(reason instanceof Error ? reason.message : basketErrors.unavailable);
      } finally {if (live && stamp === epoch.current) setLoading(false);}
    })();
    return () => {live = false;};
  }, [startupAttempt]);

  // Native back/forward changes the same narrow paper reference, without recreating a basket.
  useEffect(() => {
    const route = navigation.target, saved = current.current.basket;
    if (!initialized.current || route.view !== 'paper' || !route.paper?.basketId || !route.sessionId) return;
    if (saved?.id !== route.paper.basketId || saved.sessionId !== route.sessionId) {
      void loadOwner(route.sessionId, route.paper.basketId);
    } else if (route.paper.stage && route.paper.stage !== current.current.ui.stage) {
      changeUi({...current.current.ui, stage: route.paper.stage});
    }
  }, [navigation.target.paper?.basketId, navigation.target.paper?.stage, navigation.target.sessionId]);

  function changeUi(next: PaperBasketUiState) {
    if (sameBasketUi(next, current.current.ui)) return;
    current.current.ui = next; setUi(next); setUiDirty(true); uiPending.current = true;
  }

  async function saveUi(next = current.current.ui): Promise<boolean> {
    const saved = current.current.basket;
    if (!saved || saved.state !== 'active' || lock.current || retryKind.current === 'content') return false;
    if (sameBasketUi(next, saved.uiState || emptyBasketUi())) {
      if (sameBasketUi(next, current.current.ui)) {
        setUiDirty(false); uiPending.current = false; setUiSaveBlocked(false);
        setUiDiscarded(false); current.current.uiDiscarded = false;
      }
      return true;
    }
    const input: PaperBasketMutationInput = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: saved.sessionId,
      basketId: saved.id, expectedRevision: saved.revision, requestId: crypto.randomUUID(), operation: {type: 'updateUiState', uiState: next}};
    const success = await execute(() => window.omniEdu!.mutatePaperBasket(input), value => {
      adopt(value);
      setUiSaveBlocked(false);
      setUiDiscarded(false); current.current.uiDiscarded = false;
      if (sameBasketUi(next, current.current.ui)) {setUiDirty(false); uiPending.current = false;}
    }, 'ui');
    if (!success && alive.current) {setUiSaveBlocked(true); setUiDirty(true); uiPending.current = true;}
    return success;
  }

  useEffect(() => {
    if (!uiDirty || busy || loading || retryable || uiSaveBlocked || uiDiscarded || basket?.state !== 'active') return;
    const timer = setTimeout(() => {void saveUi();}, 400);
    return () => clearTimeout(timer);
  }, [ui, uiDirty, busy, loading, retryable, uiSaveBlocked, uiDiscarded, basket?.id, basket?.revision]);

  function discardUi() {
    if (lock.current || retryKind.current === 'content') return;
    const restored = current.current.basket?.uiState || emptyBasketUi();
    current.current.ui = restored; setUi(restored); setRestoreKey(value => value + 1);
    uiPending.current = false; setUiDirty(false); setUiSaveBlocked(false);
    current.current.uiDiscarded = true; setUiDiscarded(true);
    if (retryKind.current === 'ui') {retry.current = undefined; retryKind.current = undefined; setRetryable(false);}
    // Retain the storage failure and every content/blueprint input. This is explicitly a local-only visit.
  }

  async function flushUi() {
    return !uiPending.current || current.current.uiDiscarded || await saveUi();
  }

  async function mutate(operation: PaperBasketOperation): Promise<boolean> {
    const saved = current.current.basket;
    if (!saved || retryable) return false;
    const input: PaperBasketMutationInput = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: saved.sessionId,
      basketId: saved.id, expectedRevision: saved.revision, requestId: crypto.randomUUID(), operation};
    return execute(() => window.omniEdu!.mutatePaperBasket(input), next => {
      if (operation.type === 'updateBlueprint') {current.current.dirty = false; setDirty(false);}
      adopt(next);
    });
  }

  async function stage(next: PaperBasketUiState['stage']) {
    if (!current.current.basket || retryable || lock.current) return false;
    const nextUi = {...current.current.ui, stage: next};
    if (!current.current.uiDiscarded && !await saveUi(nextUi)) return false;
    current.current.ui = nextUi; setUi(nextUi);
    if (!current.current.uiDiscarded) {setUiDirty(false); uiPending.current = false;}
    target(current.current.basket, next);
    return true;
  }

  async function create(archiveCurrent: boolean) {
    if (retryable || lock.current || !await flushUi()) return false;
    if (archiveCurrent && current.current.basket?.state === 'active' && !await mutate({type: 'archive'})) return false;
    let sessionId = current.current.ownerId;
    if (!sessionId) {
      const created = await execute(async () => {
        const detail = await window.omniEdu!.createAiConversationSession({title: '组卷 · ' + current.current.blueprint.title});
        return {ok: true, value: detail.session} as const;
      }, session => {
        sessionId = session.id; setOwnerId(session.id); current.current.ownerId = session.id;
        setOwners(old => [{id: session.id, title: session.title}, ...old]);
      });
      if (!created) return false;
    }
    const input = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId, requestId: crypto.randomUUID(), blueprint: current.current.blueprint};
    return execute(() => window.omniEdu!.createPaperBasket(input), next => {
      adopt(next, true); target(next, 'select');
    });
  }

  async function takeSnapshot() {
    const saved = current.current.basket;
    if (!saved || dirty || retryable) return;
    const input = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: saved.sessionId, basketId: saved.id,
      expectedRevision: saved.revision, requestId: crypto.randomUUID()};
    await execute(() => window.omniEdu!.createPaperFromBasket(input), value => setSnapshot(value));
  }

  async function decide(action: 'confirm' | 'reject') {
    if (!snapshot || !basket || !basketSnapshotCurrent(basket, snapshot) || dirty || retryable) return;
    const input = {schemaVersion: PAPER_SCHEMA, sessionId: snapshot.sessionId, id: snapshot.id, revision: snapshot.revision, action};
    await execute(() => window.omniEdu!.decidePaper(input), value => setSnapshot(value));
  }

  async function leave(view: 'teaching' | 'ai' | 'automatic') {
    if (current.current.dirty || retryable || lock.current || !await flushUi()) return false;
    internalNavigation.current = true;
    try {return view === 'automatic' ? navigation.navigate({view: 'paper', paper: {mode: 'automatic'}})
      : navigation.navigate({view, ...(view === 'ai' && basket ? {sessionId: basket.sessionId} : {})});}
    finally {internalNavigation.current = false;}
  }

  const setDraft = useCallback((next: PaperBlueprint) => {
    current.current.blueprint = next; current.current.dirty = true; setBlueprint(next); setDirty(true);
  }, []);
  return {owners, ownerId, summaries, summaryTotal, summaryOffset, basket, snapshot, ui, blueprint, dirty, uiDirty, uiSaveBlocked, uiDiscarded, busy, loading, error, retryable, restoreKey,
    setDraft, changeUi, mutate, stage, create, takeSnapshot, decide, leave,
    saveUi, discardUi, loadMore,
    chooseOwner: async (id: string) => !current.current.dirty && !retryable && await flushUi() && loadOwner(id),
    open: async (item: PaperBasketSummary) => !current.current.dirty && !retryable && await flushUi() && read(item.sessionId, item.id),
    reload: () => basket ? read(basket.sessionId, basket.id, false)
      : owners.length ? loadOwner(current.current.ownerId) : (setStartupAttempt(value => value + 1), Promise.resolve(false)),
    retry: () => retry.current?.(),
    discardDraft: () => {
      if (lock.current) return;
      const initial = current.current.basket?.blueprint || defaultPaperBlueprint();
      current.current.dirty = false;
      current.current.blueprint = initial;
      setDirty(false); setBlueprint(initial);
      if (!current.current.basket && retryable) {
        // Abandon local input/retry intent, without claiming that an uncertain host creation was rolled back.
        retry.current = undefined; retryKind.current = undefined; setRetryable(false);
        setError('已放弃本地蓝图。此前创建响应未确定，未撤销任何宿主记录；可重新读取已保存题篮核对。');
      }
    },
  };
}

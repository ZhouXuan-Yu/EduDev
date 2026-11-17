import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {validPaperInstanceContent, type PaperInstanceContent} from '../../../shared/paper-instance';
import type {PaperWorkspaceBasket, PaperWorkspaceEntry, PaperWorkspaceOperation} from './paper-basket-client';
import {sameInstanceContent} from './paper-instance-content';
import {instanceDraftKey, readInstanceDrafts, writeInstanceDrafts, type InstanceDrafts} from './paper-instance-draft-storage';

/** Local recovery holds teacher input only. Host instance identities are revalidated before every save. */
export function usePaperInstanceDrafts(basket: PaperWorkspaceBasket | undefined, mutate: (operation: PaperWorkspaceOperation) => Promise<boolean>) {
  const [namespace, setNamespace] = useState<{root: string; validated?: PaperWorkspaceBasket; error?: string; pending?: boolean}>({root: ''});
  const [namespaceAttempt, setNamespaceAttempt] = useState(0);
  const ready = !!basket && namespace.validated === basket && !!namespace.root;
  const key = ready ? instanceDraftKey(namespace.root, basket!.sessionId, basket!.id) : '';
  const [state, setState] = useState<{key: string; drafts: InstanceDrafts}>({key: '', drafts: {}});
  const [cacheError, setCacheError] = useState('');
  const blockedCache = useRef('');
  const latest = useRef(state); latest.current = state;
  const drafts = state.key === key ? state.drafts : {};
  // Retain the leave guard while the next host read validates its data-root namespace.
  // Old-root input must not be presented as recovery for the newly read basket.
  const dirty = Object.keys(state.drafts).length > 0;
  useEffect(() => {
    if (basket?.schemaVersion !== 'xiaozhi.paper-basket.v2') return;
    let live = true;
    setNamespace(old => ({...old, validated: undefined, error: undefined, pending: true}));
    void window.omniEdu!.getDataRoot().then(root => {
      if (!root || typeof root !== 'string') throw Error();
      if (live) setNamespace({root, validated: basket});
    }).catch(() => {if (live) setNamespace(old => ({...old, validated: undefined,
      pending: false, error: '当前数据目录无法核实，暂不能编辑或恢复本机输入；已保存题目仍以宿主为准。'}));});
    return () => {live = false;};
  }, [basket, namespaceAttempt]);
  function commit(next: InstanceDrafts) {
    const value = {key, drafts: next}; latest.current = value; setState(value);
  }
  useLayoutEffect(() => {
    if (!key || latest.current.key === key) return;
    const restored = readInstanceDrafts(key);
    blockedCache.current = restored.error ? key : '';
    const next = {key, drafts: restored.drafts}; latest.current = next; setState(next); setCacheError(restored.error);
  }, [key]);
  useEffect(() => {
    if (!ready || !key || state.key !== key) return;
    // An acknowledged response or explicit host reload can settle an uncertain save, never a local flag.
    const next = {...drafts}; let changed = false;
    for (const entry of basket!.entries) {
      if (entry.instance && next[entry.entryId] && sameInstanceContent(entry.instance.content, next[entry.entryId].content)) {
        delete next[entry.entryId]; changed = true;
      }
    }
    if (changed) commit(next);
  }, [basket, state.key, ready]);
  useEffect(() => {
    if (!key || state.key !== key || blockedCache.current === key) return;
    const save = () => {
      if (!writeInstanceDrafts(state.key, state.drafts)) {
        blockedCache.current = key;
        setCacheError('未保存输入仍在当前页，但本机恢复副本未能写入；关闭后可能无法恢复。请保存到题篮或明确放弃。');
      }
    };
    const timer = setTimeout(save, 250);
    return () => {clearTimeout(timer);};
  }, [state]);
  useEffect(() => {
    // A window can close before the normal 250ms cache timer fires.
    const flush = () => {
      if (latest.current.key && blockedCache.current !== latest.current.key) writeInstanceDrafts(latest.current.key, latest.current.drafts);
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  function update(entry: PaperWorkspaceEntry, content: PaperInstanceContent) {
    if (!ready || !entry.instance) return;
    const next = {...latest.current.drafts};
    if (sameInstanceContent(entry.instance.content, content)) delete next[entry.entryId];
    else next[entry.entryId] = {...(next[entry.entryId] || {entryId: entry.entryId,
      baseRevision: entry.instance.instanceRevision, baseDigest: entry.instance.contentDigest}), content};
    commit(next);
  }
  function discard(entryId: string) {
    const next = {...latest.current.drafts}; delete next[entryId]; commit(next);
    if (key && writeInstanceDrafts(key, next)) {blockedCache.current = ''; setCacheError('');}
    else {blockedCache.current = key; setCacheError('当前页已放弃此输入，但本机恢复副本未能更新，请重试更新恢复副本。');}
  }
  function retryNamespace() {
    if (basket && !namespace.pending) setNamespaceAttempt(value => value + 1);
  }
  return {drafts, dirty, ready, namespacePending: !!namespace.pending, retryNamespace,
    cacheError: namespace.error || cacheError, update, discard,
    retryCache() {
      if (!key) {retryNamespace(); return;}
      if (writeInstanceDrafts(key, drafts)) {blockedCache.current = ''; setCacheError('');}
      else {blockedCache.current = key; setCacheError('本机恢复副本仍未保存，当前输入保留。');}
    },
    async save(entry: PaperWorkspaceEntry) {
      const draft = drafts[entry.entryId];
      if (!ready || !draft || !entry.instance || draft.baseRevision !== entry.instance.instanceRevision ||
        draft.baseDigest !== entry.instance.contentDigest || !validPaperInstanceContent(draft.content)) return false;
      return mutate({type: 'editEntry', entryId: entry.entryId, expectedInstanceRevision: draft.baseRevision, content: draft.content});
    },
    rebase(entry: PaperWorkspaceEntry) {
      if (!entry.instance || !drafts[entry.entryId]) return;
      commit({...drafts, [entry.entryId]: {...drafts[entry.entryId], baseRevision: entry.instance.instanceRevision, baseDigest: entry.instance.contentDigest}});
    },
  };
}
export type PaperInstanceDraftController = ReturnType<typeof usePaperInstanceDrafts>;

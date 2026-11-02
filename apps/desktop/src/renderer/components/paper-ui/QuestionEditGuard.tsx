import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent} from 'react';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';

type Registry = Map<symbol, {root: HTMLElement | null; blocked: boolean}>;
const QuestionEdits = createContext<Registry | undefined>(undefined);
const message = '题本有未保存或正在保存的输入，请先保存成功或明确取消修改后再继续。';

/** C1 only: prevent filters, paging and disclosures from unmounting another editor. */
export function QuestionEditBoundary({enabled, children}: {enabled: boolean; children: ReactNode}) {
  const registry = useRef<Registry>(new Map());
  const [notice, setNotice] = useState('');
  function guard(event: SyntheticEvent) {
    // Focus must always be able to return to the active editor with Tab/Shift+Tab.
    if ('key' in event && event.key === 'Tab') return;
    const blocked = [...registry.current.values()].filter(item => item.blocked);
    if (!blocked.length) {if (notice) setNotice(''); return;}
    if (blocked.some(item => event.target instanceof Node && item.root?.contains(event.target))) return;
    event.preventDefault(); event.stopPropagation(); setNotice(message);
  }
  return <QuestionEdits.Provider value={enabled ? registry.current : undefined}>
    {enabled ? <div onPointerDownCapture={guard} onPointerUpCapture={guard}
      onClickCapture={guard} onChangeCapture={guard} onKeyDownCapture={guard}>
      {notice && <p role="status" data-testid="question-edit-guard-notice">{notice}</p>}
      {children}
    </div> : children}
  </QuestionEdits.Provider>;
}

export function useQuestionEditGuard(blocked: boolean) {
  const registry = useContext(QuestionEdits);
  const root = useRef<HTMLElement>(null);
  const key = useRef(Symbol());
  useDesktopNavigationGuard(!!registry && blocked, message);
  useEffect(() => {
    if (!registry || !blocked) return;
    const unload = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [registry, blocked]);
  useLayoutEffect(() => {
    if (!registry) return;
    registry.set(key.current, {root: root.current, blocked});
    return () => {registry.delete(key.current);};
  }, [registry, blocked]);
  return root;
}

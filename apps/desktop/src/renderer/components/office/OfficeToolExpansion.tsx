import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

type ExpansionStore = {
  choices: ReadonlyMap<string, boolean>;
  choose: (id: string, open: boolean) => void;
  focused: RefObject<string | null>;
};
const ExpansionContext = createContext<ExpansionStore | undefined>(undefined);

/** UI choices belong to one mounted conversation turn, never to a tool authority. */
export function OfficeToolExpansionScope({ children }: { children: ReactNode }) {
  const [choices, setChoices] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const focused = useRef<string | null>(null);
  const choose = useCallback((id: string, open: boolean) => {
    setChoices(previous => {
      if (previous.get(id) === open) return previous;
      const next = new Map(previous);
      next.set(id, open);
      return next;
    });
  }, []);
  const store = useMemo(() => ({ choices, choose, focused }), [choices, choose]);
  return <ExpansionContext.Provider value={store}>{children}</ExpansionContext.Provider>;
}

/** Unchosen rows follow attention; an explicit teacher choice wins thereafter. */
export function useToolExpansion(id: string, attention: boolean, childIds: readonly string[] = []) {
  const store = useContext(ExpansionContext);
  // Keep the existing standalone consumers working without a scope provider.
  const [local, setLocal] = useState<{ id: string; open: boolean }>();
  const localFocus = useRef<string | null>(null);
  const focused = store?.focused || localFocus;
  const trigger = useRef<HTMLButtonElement>(null);
  const manual = store ? store.choices.get(id) : local?.id === id ? local.open : undefined;
  useLayoutEffect(() => {
    const node = trigger.current;
    const ownsFocus = focused.current === id || id.startsWith('step:') && focused.current === 'group:' + id.slice(5);
    if (node && ownsFocus && document.activeElement === document.body) node.focus({ preventScroll: true });
    return () => {
      if (node && node === document.activeElement) focused.current = id;
    };
  }, [focused, id]);
  return {
    expanded: manual ?? (attention || childIds.some(child => store?.choices.get(child) === true || focused.current === child)),
    triggerProps: {
      ref: trigger,
      onFocus() { focused.current = id; },
      onBlur() {
        // An intentional move away from a connected trigger cancels restoration.
        // Removing a trigger during regrouping must retain its turn-local anchor.
        if (trigger.current?.isConnected && focused.current === id) focused.current = null;
      },
    },
    onExpandedChange(open: boolean) {
      if (store) store.choose(id, open);
      else setLocal({ id, open });
    },
  };
}

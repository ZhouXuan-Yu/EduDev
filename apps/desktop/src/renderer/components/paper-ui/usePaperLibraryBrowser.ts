import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {QuestionNotebookCategory, QuestionNotebookEntry} from '../../../shared/contracts';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import {questionFacts} from '../../../shared/question-facts';
import {BASKET_PAGE_SIZE, observeCandidateScroll} from './paper-basket-ui';
import {emptyPaperLibraryView, readPaperLibraryView, savePaperLibraryView, type PaperLibraryFacet} from './paper-library-view';

export function usePaperLibraryBrowser() {
  const [initial] = useState(() => readPaperLibraryView());
  const [view, setView] = useState(initial.view);
  const [storageIssue, setStorageIssue] = useState(initial.failed);
  const changed = useRef(false);
  const latest = useRef(view);
  latest.current = view;
  const scroll = useRef<HTMLDivElement>(null);
  const [refresh, setRefresh] = useState(0);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [rows, setRows] = useState<{question: QuestionNotebookEntry; version: string}[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<QuestionNotebookCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => {
    if (changed.current) setStorageIssue(!savePaperLibraryView(view));
  }, [view]);

  useEffect(() => {
    let live = true;
    setCategoriesLoading(true);
    setCategoriesError('');
    void (async () => {
      try {
        if (!window.omniEdu) throw Error('unavailable');
        const values = await window.omniEdu.listQuestionNotebookCategories();
        if (live) setCategories(values);
      } catch {
        if (live) setCategoriesError('分类读取未完成，请重试。');
      } finally {
        if (live) setCategoriesLoading(false);
      }
    })();
    return () => { live = false; };
  }, [categoryRetry]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!window.omniEdu) throw Error('unavailable');
          const result = await window.omniEdu.listQuestionNotebook({
            ...view.ui.filters, offset: view.ui.offset, limit: BASKET_PAGE_SIZE,
          });
          const items = await Promise.all(result.items.map(async question => {
            const digest = await crypto.subtle.digest('SHA-256',
              new TextEncoder().encode(JSON.stringify(questionFacts(question))));
            const version = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            return {question, version};
          }));
          if (live) { setRows(items); setTotal(result.total); }
        } catch {
          if (live) setError('题目读取未完成，请重试。');
        } finally {
          if (live) setLoading(false);
        }
      })();
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [view.ui.filters, view.ui.offset, refresh]);

  useLayoutEffect(() => {
    if (loading || error || !scroll.current) return;
    return observeCandidateScroll(scroll.current, latest.current.ui.scrollTop, scrollTop => {
      changed.current = true;
      setView(current => ({...current, ui: {...current.ui, scrollTop}}));
    });
  }, [loading, error, view.ui.filters, view.ui.offset]);

  function filter(patch: Partial<PaperBasketUiState['filters']>) {
    changed.current = true;
    setView(current => {
      const filters = {...current.ui.filters, ...patch};
      for (const key of Object.keys(filters) as (keyof typeof filters)[]) {
        if (filters[key] === '' || filters[key] === undefined) delete filters[key];
      }
      return {...current, ui: {...current.ui, filters, offset: 0, scrollTop: 0}};
    });
  }
  function facet(value: PaperLibraryFacet) {
    changed.current = true;
    setView(current => ({...current, facet: value}));
  }
  function page(offset: number) {
    changed.current = true;
    setView(current => ({...current, ui: {...current.ui, offset, scrollTop: 0}}));
  }
  function reset() {
    changed.current = true;
    setView(emptyPaperLibraryView());
  }
  return {view, rows, total, loading, error, categories, categoriesLoading, categoriesError, storageIssue,
    scroll, filter, facet, page, reset, retry: () => setRefresh(value => value + 1),
    retryPreferences: () => setStorageIssue(!savePaperLibraryView(latest.current)),
    retryCategories: () => setCategoryRetry(value => value + 1)};
}

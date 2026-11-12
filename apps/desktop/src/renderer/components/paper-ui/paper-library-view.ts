import {validBasketUiState, type PaperBasketUiState} from '../../../shared/paper-basket';
import {plainStudentInput} from '../../../shared/student-context';
import {BASKET_PAGE_SIZE, emptyBasketUi} from './paper-basket-ui';

export const PAPER_LIBRARY_VIEW_KEY = 'edudev.paper-library-view.v1';
export type PaperLibraryFacet = 'knowledge' | 'categories';
export type PaperLibraryView = {
  schemaVersion: 'edudev.paper-library-view.v1';
  facet: PaperLibraryFacet;
  ui: PaperBasketUiState;
};
type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const emptyPaperLibraryView = (): PaperLibraryView => ({
  schemaVersion: 'edudev.paper-library-view.v1', facet: 'knowledge', ui: emptyBasketUi(),
});

export function validPaperLibraryView(value: unknown): value is PaperLibraryView {
  return plainStudentInput(value, ['schemaVersion', 'facet', 'ui']) &&
    value.schemaVersion === 'edudev.paper-library-view.v1' &&
    (value.facet === 'knowledge' || value.facet === 'categories') &&
    validBasketUiState(value.ui) && value.ui.stage === 'select' && value.ui.offset % BASKET_PAGE_SIZE === 0;
}

/** Optional UI preferences only. No question, basket, confirmation or permission facts. */
export function readPaperLibraryView(storage?: ViewStorage): {view: PaperLibraryView; failed: boolean} {
  try {
    const text = (storage ?? window.localStorage).getItem(PAPER_LIBRARY_VIEW_KEY);
    if (text === null) return {view: emptyPaperLibraryView(), failed: false};
    if (text.length > 8192) return {view: emptyPaperLibraryView(), failed: true};
    const value: unknown = JSON.parse(text);
    if (validPaperLibraryView(value)) return {view: value, failed: false};
  } catch { /* Browse with defaults when optional preferences cannot be read. */ }
  return {view: emptyPaperLibraryView(), failed: true};
}

export function savePaperLibraryView(view: PaperLibraryView, storage?: ViewStorage): boolean {
  try {
    if (!validPaperLibraryView(view)) return false;
    const text = JSON.stringify(view);
    if (text.length > 8192) return false;
    const target = storage ?? window.localStorage;
    target.setItem(PAPER_LIBRARY_VIEW_KEY, text);
    return target.getItem(PAPER_LIBRARY_VIEW_KEY) === text;
  } catch { return false; }
}

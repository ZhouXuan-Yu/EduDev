import { useCallback, useLayoutEffect, useRef } from 'react';
import { useOfficeComposerState } from './OfficeComposerState';

export interface OfficeReadingBookmark {
  threadId: string;
  atBottom: boolean;
  scrollTop: number;
  anchor?: { itemId: string; block: number; offset: number };
}
const blocks = (item: Element) => [...item.querySelectorAll('p,li,h1,h2,h3,h4,pre')];

/** Ephemeral view adapter around the original Pro scrolling container, never task state. */
export function useOfficeReadingPosition(threadId: string, visible: boolean) {
  const { readingBookmark } = useOfficeComposerState();
  const element = useRef<HTMLDivElement | null>(null), restoring = useRef(false);
  const currentVisible = useRef(visible); currentVisible.current = visible;
  const record = useCallback(() => {
    const host = element.current;
    if (!host?.isConnected || !currentVisible.current || host.clientHeight <= 0 || restoring.current) return;
    const view = host.getBoundingClientRect();
    const atBottom = host.scrollHeight - host.scrollTop - host.clientHeight <= 4;
    let anchor: OfficeReadingBookmark['anchor'];
    if (!atBottom) {
      const candidates = [...host.querySelectorAll('[data-item-id]')].flatMap(item => blocks(item).map((block, index) => ({ item, block, index, rect: block.getBoundingClientRect() })))
        .filter(entry => entry.rect.height > 0 && entry.rect.bottom > view.top && entry.rect.top < view.bottom)
        .sort((a, b) => Math.abs(a.rect.top - view.top) - Math.abs(b.rect.top - view.top));
      const first = candidates[0];
      if (first) anchor = { itemId: first.item.getAttribute('data-item-id')!, block: first.index, offset: first.rect.top - view.top };
    }
    readingBookmark.current = { threadId, atBottom, scrollTop: host.scrollTop, anchor };
  }, [threadId, readingBookmark]);
  const ref = useCallback((host: HTMLDivElement | null) => {
    if (!host) record();
    element.current = host;
    restoring.current = !!host && readingBookmark.current?.threadId === threadId;
  }, [record, readingBookmark, threadId]);

  useLayoutEffect(() => {
    if (!visible) { restoring.current = true; return; }
    const host = element.current, mark = readingBookmark.current;
    if (!host || !mark || mark.threadId !== threadId) { restoring.current = false; return; }
    restoring.current = true;
    let firstFrame = 0, secondFrame = 0;
    const restore = () => {
      if (!host.isConnected || host.clientHeight <= 0 || !currentVisible.current) return;
      if (mark.atBottom) host.scrollTop = host.scrollHeight;
      else {
        const item = [...host.querySelectorAll('[data-item-id]')].find(item => item.getAttribute('data-item-id') === mark.anchor?.itemId);
        const block = item && mark.anchor ? blocks(item)[mark.anchor.block] : undefined;
        if (block && mark.anchor) host.scrollTop += block.getBoundingClientRect().top - host.getBoundingClientRect().top - mark.anchor.offset;
        else host.scrollTop = Math.max(0, Math.min(mark.scrollTop, host.scrollHeight - host.clientHeight));
      }
      // Let the original Pro handler cancel its stale initial RAF and update isAtBottom.
      host.dispatchEvent(new Event('scroll'));
    };
    firstFrame = requestAnimationFrame(() => {
      restore();
      secondFrame = requestAnimationFrame(() => { restore(); restoring.current = false; record(); });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); record(); };
  }, [threadId, visible, readingBookmark, record]);
  return { ref, onScroll: record };
}

import { useLayoutEffect, type ReactNode, type RefObject } from 'react';

type Point = { itemId: string; markdownIndex: number; offset: number; prefix: string };
type SavedSelection = { anchor: Point; focus: Point };
type Props = { threadId: string; host: RefObject<HTMLDivElement | null>; children: ReactNode };

function point(host: HTMLElement, node: Node, offset: number): Point | undefined {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const markdown = element?.closest('[data-slot="markdown"]');
  const item = markdown?.closest('[data-item-id]');
  if (!markdown || !item || !host.contains(item)) return;
  const range = document.createRange();
  range.selectNodeContents(markdown);
  range.setEnd(node, offset);
  const prefix = range.toString();
  return { itemId: item.getAttribute('data-item-id')!, markdownIndex: [...item.querySelectorAll('[data-slot="markdown"]')].indexOf(markdown), offset: prefix.length, prefix };
}

function locate(host: HTMLElement, saved: Point): { node: Text; offset: number } | undefined {
  const item = [...host.querySelectorAll('[data-item-id]')].find(item => item.getAttribute('data-item-id') === saved.itemId);
  const markdown = item?.querySelectorAll('[data-slot="markdown"]')[saved.markdownIndex];
  // Only an unchanged prefix is eligible. Never move the old selection onto an
  // edited/replaced passage that happens to have the same message identifier.
  if (!markdown || !markdown.textContent?.startsWith(saved.prefix)) return;
  const walker = document.createTreeWalker(markdown, NodeFilter.SHOW_TEXT);
  let remaining = saved.offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) return { node: node as Text, offset: remaining };
    remaining -= length;
  }
}

/** The markdown renderer may commit asynchronously after its parent. Observe
 * the original host rather than assuming one parent React commit owns the DOM.
 * Native user interaction always releases the temporary selection bookmark. */
export function OfficeTextSelection({ threadId, host, children }: Props) {
  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    const document = root.ownerDocument;
    let saved: SavedSelection | undefined;
    let dragging = false;
    const record = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) { saved = undefined; return; }
      const anchor = point(root, selection.anchorNode, selection.anchorOffset);
      const focus = point(root, selection.focusNode, selection.focusOffset);
      saved = anchor && focus ? { anchor, focus } : undefined;
    };
    const down = () => { dragging = true; saved = undefined; };
    const up = () => { dragging = false; record(); };
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') return;
      saved = undefined;
    };
    const observer = new MutationObserver(() => {
      if (!saved || dragging || !root.isConnected) return;
      const anchor = locate(root, saved.anchor), focus = locate(root, saved.focus);
      if (!anchor || !focus) { saved = undefined; return; }
      const selection = document.getSelection();
      if (selection && (selection.anchorNode !== anchor.node || selection.anchorOffset !== anchor.offset || selection.focusNode !== focus.node || selection.focusOffset !== focus.offset)) {
        selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
      }
    });
    document.addEventListener('selectionchange', record);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('keydown', key, true);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('selectionchange', record);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [threadId, host]);
  return children;
}

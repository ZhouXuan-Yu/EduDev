import { useLayoutEffect, type ReactNode, type RefObject } from 'react';

type Point = { itemId: string; markdownIndex: number; offset: number; prefix: string; atStart: boolean };
type SavedSelection = { anchor: Point; focus: Point; top: number };
type Props = { threadId: string; host: RefObject<HTMLDivElement | null>; children: ReactNode };

function* textNodes(root: Node): Generator<Text> {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Static markdown inserts newline-only DOM nodes between blocks. Streaming
    // markdown omits them. They have no visible text identity; code keeps them.
    if (/^[\r\n\t ]*[\r\n][\r\n\t ]*$/.test(node.textContent || '') && !node.parentElement?.closest('pre,code')) continue;
    yield node as Text;
  }
}

const textPrefix = (root: Node) => [...textNodes(root)].map(node => node.data).join('');

function point(host: HTMLElement, node: Node, offset: number): Point | undefined {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const markdown = element?.closest('[data-slot="markdown"]');
  const item = markdown?.closest('[data-item-id]');
  if (!markdown || !item || !host.contains(item)) return;
  const range = document.createRange();
  range.selectNodeContents(markdown);
  range.setEnd(node, offset);
  const prefix = textPrefix(range.cloneContents());
  return { itemId: item.getAttribute('data-item-id')!, markdownIndex: [...item.querySelectorAll('[data-slot="markdown"]')].indexOf(markdown), offset: prefix.length, prefix, atStart: offset === 0 };
}

function locate(host: HTMLElement, saved: Point): { node: Text; offset: number } | undefined {
  const item = [...host.querySelectorAll('[data-item-id]')].find(item => item.getAttribute('data-item-id') === saved.itemId);
  const markdown = item?.querySelectorAll('[data-slot="markdown"]')[saved.markdownIndex];
  // Only an unchanged prefix is eligible. Never move the old selection onto an
  // edited/replaced passage that happens to have the same message identifier.
  if (!markdown || !textPrefix(markdown).startsWith(saved.prefix)) return;
  let remaining = saved.offset;
  for (const node of textNodes(markdown)) {
    const length = node.textContent?.length || 0;
    // Adjacent paragraphs share a text offset, but their DOM edges are distinct:
    // choosing the previous paragraph's end adds a newline to native copy.
    if (remaining < length || remaining === length && !saved.atStart) return { node: node as Text, offset: remaining };
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
    let accepting = true;
    let holdPosition = false;
    const record = () => {
      if (!accepting) return;
      const selection = document.getSelection();
      // DOM replacement can collapse the native range before the observer runs.
      // Explicit pointer/keyboard actions below release the bookmark instead.
      if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return;
      const anchor = point(root, selection.anchorNode, selection.anchorOffset);
      const focus = point(root, selection.focusNode, selection.focusOffset);
      if (!saved && anchor && focus) holdPosition = true;
      saved = anchor && focus ? { anchor, focus, top: saved?.top ?? selection.getRangeAt(0).getBoundingClientRect().top } : undefined;
    };
    const down = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      accepting = !!target && root.contains(target) && !target.closest('button,a,input,textarea,[role="button"]');
      dragging = accepting; saved = undefined; holdPosition = false;
    };
    const up = () => { const selected = dragging; dragging = false; if (selected) record(); };
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') return;
      accepting = event.shiftKey || (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';
      saved = undefined; holdPosition = false;
    };
    const releasePosition = () => { holdPosition = false; };
    const pin = () => {
      const selection = document.getSelection();
      if (!saved || !holdPosition || dragging || !selection?.rangeCount || selection.isCollapsed) return;
      const delta = selection.getRangeAt(0).getBoundingClientRect().top - saved.top;
      if (Math.abs(delta) > 1) root.scrollTo({top: root.scrollTop + delta, behavior: 'instant'});
    };
    const observer = new MutationObserver(() => {
      if (!saved || dragging || !root.isConnected) return;
      const anchor = locate(root, saved.anchor), focus = locate(root, saved.focus);
      if (!anchor || !focus) { saved = undefined; return; }
      const selection = document.getSelection();
      if (selection && (selection.anchorNode !== anchor.node || selection.anchorOffset !== anchor.offset || selection.focusNode !== focus.node || selection.focusOffset !== focus.offset)) {
        selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
      }
      if (holdPosition) {
        pin();
        // Notify the original conversation of the held reading position before
        // its ResizeObserver schedules following. No synthetic user input.
        root.dispatchEvent(new Event('scroll'));
      }
    });
    document.addEventListener('selectionchange', record);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('keydown', key, true);
    root.addEventListener('scroll', pin, true);
    root.addEventListener('wheel', releasePosition, {passive:true});
    root.addEventListener('touchstart', releasePosition, {passive:true});
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('selectionchange', record);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('keydown', key, true);
      root.removeEventListener('scroll', pin, true);
      root.removeEventListener('wheel', releasePosition);
      root.removeEventListener('touchstart', releasePosition);
    };
  }, [threadId, host]);
  return children;
}

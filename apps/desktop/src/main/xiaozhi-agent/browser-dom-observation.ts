import type { WebContents } from 'electron';
import { setTimeout as delay } from 'node:timers/promises';
import { waitOfficeAbort } from '../office-agent/office-network';

type AccessibleNode = {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
  backendDOMNodeId?: number;
};

/** Use Chromium's computed role and accessible name on this tab only. */
export async function uniqueBrowserRef(contents: WebContents, role: string, name: string, signal: AbortSignal) {
  const client = contents.debugger;
  if (client.isAttached()) throw new Error('busy');
  client.attach();
  try {
    const response: { nodes: AccessibleNode[] } = await waitOfficeAbort(
      client.sendCommand('Accessibility.getFullAXTree'), signal);
    const matches = response.nodes.filter(node =>
      !node.ignored && node.role?.value === role && node.name?.value?.trim() === name && node.backendDOMNodeId);
    if (!matches.length) throw new Error('target_missing');
    if (matches.length > 1) throw new Error('ambiguous_target');
    const { node } = await waitOfficeAbort(client.sendCommand('DOM.describeNode', {
      backendNodeId: matches[0].backendDOMNodeId,
    }), signal);
    const attrs: string[] = node.attributes ?? [];
    for (let i = 0; i < attrs.length; i += 2) {
      if (attrs[i] === 'data-hana-ref') return Number(attrs[i + 1]);
    }
    throw new Error('attachment_changed');
  } finally {
    if (!contents.isDestroyed() && client.isAttached()) client.detach();
  }
}

export async function waitForBrowserText(contents: WebContents, text: string, signal: AbortSignal, checkPage: () => void) {
  const started = performance.now();
  const deadline = AbortSignal.timeout(8000);
  const stop = AbortSignal.any([signal, deadline]);
  const query = `document.body?.innerText.includes(${JSON.stringify(text)}) === true`;
  try {
    for (;;) {
      checkPage();
      stop.throwIfAborted();
      const found = await waitOfficeAbort(contents.executeJavaScriptInIsolatedWorld(1005, [{ code: query }]), stop);
      checkPage();
      if (found) return;
      // Short initial probes catch interactive updates. Keep each renderer call
      // synchronous so navigating/replacing the document cannot strand a promise.
      const pollInterval = performance.now()-started < 200 ? 35 : 150;
      await delay(pollInterval, undefined, { signal: stop });
    }
  } catch (error) {
    signal.throwIfAborted();
    if (deadline.aborted) throw new Error('timeout');
    throw error;
  }
}

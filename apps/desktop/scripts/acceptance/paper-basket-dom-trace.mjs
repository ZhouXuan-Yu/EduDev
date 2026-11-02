/** QA-only observer. No question text, session titles, requests, or production state is retained. */
export function installPaperBasketDomTrace() {
  if (window.__paperBasketDomTrace) return;
  const ids = new WeakMap(), events = [];
  let next = 0, dropped = 0;
  const identity = node => {
    if (!node) return null;
    if (!ids.has(node)) ids.set(node, ++next);
    return ids.get(node);
  };
  const sample = () => [...document.querySelectorAll('[data-testid="paper-basket-workspace"]')].map(root => ({
    node: identity(root), connected: root.isConnected, basketId: root.dataset.basketId,
    revision: root.dataset.basketRevision, stage: root.dataset.stage,
    pending: !!root.querySelector('[data-testid="paper-basket-ui-pending"]'),
    stageDisabled: root.querySelector(`[data-testid="paper-basket-stage-${root.dataset.stage}"]`)?.disabled ?? null,
    savedDisabled: root.querySelector('[data-testid="paper-basket-saved"]')?.disabled ?? null,
    view: root.closest('[data-view]')?.getAttribute('data-view') ?? null,
  }));
  const record = event => {
    if (events.length === 1000) {dropped++; return;}
    events.push({at: performance.now(), ...event, roots: sample()});
  };
  const containsRoot = node => node.nodeType === 1 &&
    (node.matches('[data-testid="paper-basket-workspace"]') || node.querySelector('[data-testid="paper-basket-workspace"]'));
  const observer = new MutationObserver(records => {
    for (const mutation of records) {
      if (mutation.type === 'attributes') {
        const root = mutation.target.closest('[data-testid="paper-basket-workspace"]');
        if (root) record({kind: 'attribute', node: identity(root), attribute: mutation.attributeName,
          previous: mutation.oldValue, value: mutation.target.getAttribute(mutation.attributeName)});
      } else {
        for (const [kind, nodes] of [['mount', mutation.addedNodes], ['unmount', mutation.removedNodes]]) {
          for (const node of nodes) {
            if (!containsRoot(node)) continue;
            const roots = node.matches('[data-testid="paper-basket-workspace"]') ? [node]
              : [...node.querySelectorAll('[data-testid="paper-basket-workspace"]')];
            for (const root of roots) record({kind, node: identity(root), connected: root.isConnected});
          }
        }
      }
    }
  });
  observer.observe(document, {subtree: true, childList: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['data-basket-id', 'data-basket-revision', 'data-stage', 'disabled', 'data-view']});
  document.addEventListener('click', event => {
    const target = event.target instanceof Element && event.target.closest('[data-testid]');
    if (target) record({kind: 'click', target: target.getAttribute('data-testid'), trusted: event.isTrusted});
  }, true);
  window.__paperBasketDomTrace = {snapshot: () => ({events: [...events], dropped, current: sample()}),
    mark: name => record({kind: 'boundary', name})};
  record({kind: 'installed'});
}

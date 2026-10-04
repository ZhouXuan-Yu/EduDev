/** Test-only passive evidence. Delegates every intercepted browser operation unchanged. */
export async function observeReading(page) {
  await page.evaluate(() => {
    const selector = '[data-testid="office-conversation"]';
    const ids = new WeakMap(); let nextId = 0, previousHost;
    window.__readingEvents = []; window.__readingPhase = 'starting';
    const identity = host => { if (!host) return undefined; if (!ids.has(host)) ids.set(host, ++nextId); return ids.get(host); };
    const log = (type, host, extra = {}) => {
      if (!host?.matches?.(selector)) return;
      const rect = host.getBoundingClientRect(), style = getComputedStyle(host);
      window.__readingEvents.push({ time: performance.now(), phase: window.__readingPhase, type, host: identity(host), top: host.scrollTop,
        height: host.scrollHeight, client: host.clientHeight, width: host.clientWidth, y: rect.y, overflowAnchor: style.overflowAnchor,
        behavior: style.scrollBehavior, connected: host.isConnected, focused: document.activeElement?.getAttribute('data-testid'), ...extra });
      if (window.__readingEvents.length > 1200) window.__readingEvents.shift();
    };
    for (const name of ['scrollTo', 'scrollBy', 'scrollIntoView']) {
      const original = Element.prototype[name];
      Element.prototype[name] = function (...args) {
        log(name, this.matches?.(selector) ? this : this.closest?.(selector), { args, stack: new Error().stack?.slice(0, 1200) });
        return original.apply(this, args);
      };
    }
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    if (!descriptor?.set || !descriptor.get || !descriptor.configurable) throw new Error('Native scrollTop observation unavailable');
    Object.defineProperty(Element.prototype, 'scrollTop', { ...descriptor, set(value) {
      log('setScrollTop', this, { requested: value, stack: new Error().stack?.slice(0, 1200) });
      return descriptor.set.call(this, value);
    } });
    for (const type of ['scroll', 'wheel', 'keydown', 'focusin']) {
      document.addEventListener(type, event => log(type, event.target?.matches?.(selector) ? event.target : event.target?.closest?.(selector),
        { trusted: event.isTrusted, delta: event.deltaY, key: event.key }), { capture: true, passive: true });
    }
    let resizeObserver;
    const checkHost = () => {
      const host = document.querySelector(selector);
      if (host === previousHost) return;
      if (previousHost) log('detached', previousHost);
      resizeObserver?.disconnect(); previousHost = host;
      if (!host) return;
      log('attached', host);
      resizeObserver = new ResizeObserver(() => log('resize', host));
      resizeObserver.observe(host);
      const content = host.querySelector('[data-slot="chat-conversation-content"]');
      if (content) resizeObserver.observe(content);
    };
    new MutationObserver(checkHost).observe(document.body, { childList: true, subtree: true });
    checkHost();
  });
}

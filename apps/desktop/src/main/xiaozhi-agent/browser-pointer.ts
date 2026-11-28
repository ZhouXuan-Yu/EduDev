/** A local marker in Chromium's isolated world. It never participates in page input. */
export function showBrowserPointer(x: number, y: number, phase: 'pending' | 'action') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !document.documentElement) return;
  type PointerWindow = typeof globalThis & {xiaozhiPointer?: {host: HTMLElement; marker: HTMLElement; timer?: number; shown: boolean}};
  const world = globalThis as PointerWindow;
  let pointer = world.xiaozhiPointer;
  if (!pointer?.host.isConnected) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden','true');
    host.dataset.xiaozhiPointer = '';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none!important;contain:strict;';
    // Keep label and shape out of the document text and the page's CSS rules.
    const shadow = host.attachShadow({mode:'closed'});
    const style = new CSSStyleSheet();
    style.replaceSync(`
      .marker { position:absolute;display:flex;align-items:center;gap:3px;opacity:0;pointer-events:none;
        font:600 12px/1.4 system-ui,sans-serif;color:white;transition:transform 145ms ease-out,opacity 120ms; }
      .arrow { width:19px;height:23px; background:#0667d0; filter:drop-shadow(0 1px 1px #fff);
        clip-path:polygon(0 0,100% 67%,56% 66%,72% 91%,52% 100%,34% 72%,14% 100%); }
      .label { padding:2px 6px; border-radius:4px; background:#075eaf; white-space:nowrap; }
      .marker[data-phase=pending] .arrow,.marker[data-phase=pending] .label { background:#72521a; }
      @media (prefers-reduced-motion:reduce) { .marker {transition:none;} }
    `);
    const marker = document.createElement('div');
    marker.className = 'marker';
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = '小智';
    marker.append(arrow,label);
    shadow.adoptedStyleSheets = [style];
    shadow.append(marker);
    document.documentElement.append(host);
    pointer = world.xiaozhiPointer = {host,marker,shown:false};
  }
  clearTimeout(pointer.timer);
  const {marker} = pointer;
  const left = Math.max(0,Math.min(x,innerWidth-22));
  const top = Math.max(0,Math.min(y,innerHeight-24));
  marker.dataset.phase = phase;
  marker.style.transition = pointer.shown ? '' : 'none';
  marker.style.transform = `translate(${left}px,${top}px)`;
  marker.style.opacity = '1';
  pointer.shown = true;
  if(phase==='action')pointer.timer = window.setTimeout(() => {
    marker.style.opacity = '0';
    if (world.xiaozhiPointer?.marker === marker) world.xiaozhiPointer.shown = false;
  },900);
}

export function clearBrowserPointer(){
  const world=globalThis as typeof globalThis & {xiaozhiPointer?:{host:HTMLElement;timer?:number}};
  if(!world.xiaozhiPointer)return;
  clearTimeout(world.xiaozhiPointer.timer);
  world.xiaozhiPointer.host.remove();
  delete world.xiaozhiPointer;
}

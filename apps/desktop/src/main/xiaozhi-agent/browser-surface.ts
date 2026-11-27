import type {BaseWindow, BrowserWindow, Rectangle, WebContentsView} from 'electron';

export type BrowserLayout = ReturnType<typeof createBrowserLayout>;
export function createBrowserLayout(floating:BaseWindow, status:WebContentsView) {
  const views = new Set<WebContentsView>([status]);
  let current:BaseWindow = floating;
  let bounds:Rectangle | undefined;
  let wasDocked=false;
  let presentation:'initial'|'docked'|'floating'|'parked'='initial';
  floating.contentView.addChildView(status);
  function resize() {
    if (current.isDestroyed()) return;
    const [width,height] = current.getContentSize();
    const box = bounds ?? {x:0,y:0,width,height};
    for (const view of views) view.setBounds(box);
  }
  function move(parent:BaseWindow, rect?:Rectangle) {
    if (parent.isDestroyed()) return;
    if (parent !== current) {
      // Preserve stacking, including the trusted status overlay.
      const ordered = current.isDestroyed() ? [...views] : current.contentView.children.filter(view => views.has(view as WebContentsView));
      for (const view of ordered) {
        if (!current.isDestroyed()) current.contentView.removeChildView(view);
        parent.contentView.addChildView(view);
      }
      current = parent;
    }
    bounds = rect;
    resize();
  }
  floating.on('resize',resize);
  resize();
  return {
    add(view:WebContentsView) { views.add(view);current.contentView.addChildView(view);resize(); },
    remove(view:WebContentsView) { views.delete(view);if(!current.isDestroyed() && current.contentView.children.includes(view))current.contentView.removeChildView(view); },
    raiseStatus() { if(!current.isDestroyed())current.contentView.addChildView(status); },
    dock(parent:BrowserWindow, rect:Rectangle) { wasDocked=true;presentation='docked';move(parent,rect);floating.hide(); },
    park() { presentation='parked';move(floating);floating.hide(); },
    float() { presentation='floating';move(floating);floating.show(); },
    get presentation(){return presentation;},
    get wasDocked(){return wasDocked;},
    get docked() {return current!==floating;},
  };
}

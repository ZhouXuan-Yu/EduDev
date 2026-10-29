import type {WebContents} from 'electron';

/** Teaching HTML runs only inside opaque sandboxed frames in the desktop renderer. */
export function installLocalFrameIsolation(contents:WebContents) {
  contents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  contents.on('will-frame-navigate',event=>{
    if(!event.isMainFrame&&!/^about:(?:blank|srcdoc)(?:#.*)?$/.test(event.url))event.preventDefault();
  });
  const session=contents.session;
  session.webRequest.onBeforeRequest((request,done)=>{
    const child=request.webContentsId===contents.id&&(request.resourceType==='subFrame'||Boolean(request.frame?.parent));
    done({cancel:child&&!/^(?:about:|data:|blob:)/.test(request.url)});
  });
  contents.once('destroyed',()=>session.webRequest.onBeforeRequest(null));
}

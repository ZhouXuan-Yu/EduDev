/** The host supplies a reviewed offline template. No parent messaging or
 * same-origin access; disposing the frame also stops its playback timer. */
export function ScienceDemoFrame({html}:{html:string}) {
  return <iframe title="科普结构交互演示" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html}
    data-testid="pi-science-demo" style={{display:'block',width:'100%',height:560,border:'1px solid var(--border, #dce5df)',borderRadius:12,background:'#fff'}}/>;
}

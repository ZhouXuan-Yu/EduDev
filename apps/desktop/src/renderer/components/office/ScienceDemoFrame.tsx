import {htmlArtifactPreview} from '../../../shared/html-artifact';
/** Opaque local frame: no parent messaging or
 * same-origin access; disposing the frame also stops its playback timer. */
export function ScienceDemoFrame({html}:{html:string}) {
  return <iframe title="教学交互演示" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={htmlArtifactPreview(html)}
    data-testid="pi-science-demo" style={{display:'block',width:'100%',height:560,border:'1px solid var(--border, #dce5df)',borderRadius:12,background:'#fff'}}/>;
}

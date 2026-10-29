/** Self-contained teaching pages. The Electron host additionally blocks frame navigation/network. */
export const HTML_ARTIFACT_PREFIX='<!-- xiaozhi.html-artifact.v1 -->\n<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src \'none\'; frame-src \'none\'; worker-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">\n';
export function htmlArtifactPreview(html:string):string {
  return html.startsWith(HTML_ARTIFACT_PREFIX)?html:HTML_ARTIFACT_PREFIX+html;
}
export function prepareHtmlArtifact(html:string):string {
  const body=html.startsWith(HTML_ARTIFACT_PREFIX)?html.slice(HTML_ARTIFACT_PREFIX.length):html;
  if(!body.trim()||!/<(?:!doctype\s+html|html(?:\s|>))/i.test(body)||/[\u0000\ud800-\udfff]/u.test(body))throw Error('invalid_input');
  const output=htmlArtifactPreview(body);
  if(new TextEncoder().encode(output).length>65536)throw Error('too_large');
  return output;
}

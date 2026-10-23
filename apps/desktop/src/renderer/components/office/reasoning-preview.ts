/** DSH-compatible selection, implemented locally; never rewrite persisted text. */
export function reasoningPreview(text:string,running:boolean):string{
  const lines=text.split(/\r?\n/);
  if(!running)return(lines[0]||'').replaceAll('**','').trim();
  let summary='',atHead=true;
  // The last line has no terminating newline yet. Wait for a completed first line.
  for(const line of lines.slice(0,-1)){
    const value=line.trim();
    if(!value){atHead=true;continue;}
    if(atHead){summary=value;atHead=false;}
  }
  return summary.replaceAll('**','');
}

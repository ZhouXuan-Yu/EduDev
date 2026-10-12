import katex from 'katex';
export type OfficeMathPart={kind:'text';raw:string}|{kind:'math';raw:string;tex:string;display:boolean};
export const officeEscape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export const containsOfficeMath=(value:string)=>/\$|\\(?:[a-zA-Z]|\(|\[)/.test(value);
/** Delimiters only. KaTeX owns all TeX parsing; no model HTML, macro state or external resources. */
export function officeMathParts(value:string):OfficeMathPart[]{
 const parts:OfficeMathPart[]=[];let start=0,i=0;
 while(i<value.length){
  if(value[i]==='\\'&&value[i+1]==='$'){i+=2;continue;}
  const open=value.startsWith('$$',i)?'$$':value[i]==='$'?'$':value.startsWith('\\(',i)?'\\(':value.startsWith('\\[',i)?'\\[':null;
  if(!open){i++;continue;}
  if(i>start)parts.push({kind:'text',raw:value.slice(start,i)});
  const close=open==='\\('? '\\)':open==='\\['?'\\]':open;let end=i+open.length;
  while(end<value.length&&!(value.startsWith(close,end)&&value[end-1]!=='\\'))end++;
  if(end===value.length)throw Error('unsupported');
  const tex=value.slice(i+open.length,end);if(!tex.trim()||tex.length>1000||/\\(?:href|url|includegraphics|html\w*|def|gdef|edef|xdef|newcommand|renewcommand|let|futurelet|csname|require|input|write|catcode)\b/.test(tex))throw Error('unsupported');
  parts.push({kind:'math',raw:value.slice(i,end+close.length),tex,display:open==='$$'||open==='\\['});i=end+close.length;start=i;
 }
 if(start<value.length)parts.push({kind:'text',raw:value.slice(start)});
 if(parts.some(p=>p.kind==='text'&&/\\[a-zA-Z]|\\[\[\]()]/.test(p.raw)))throw Error('unsupported');
 return parts;
}
export function officeMathHtml(value:string):string{return officeMathParts(value).map(p=>{
 if(p.kind==='text')return officeEscape(p.raw.replace(/\\\$/g,'$')).replace(/\n/g,'<br>');
 try{return katex.renderToString(p.tex,{output:'mathml',displayMode:p.display,trust:false,strict:'error',throwOnError:true,maxExpand:100,maxSize:10});}catch{throw Error('unsupported');}
}).join('');}
/** Chunk text without cutting formula delimiters or losing any source character. */
export function officeMathChunks(value:string):string[]{const result:string[]=[];let chunk='';for(const p of officeMathParts(value)){
 if(p.kind==='math'){if(p.raw.length>1000)throw Error('too_large');if(chunk.length+p.raw.length>1000){if(chunk)result.push(chunk);chunk='';}chunk+=p.raw;}
 else for(const c of p.raw){if(chunk.length+c.length>1000){result.push(chunk);chunk='';}chunk+=c;}
}if(chunk)result.push(chunk);return result;}

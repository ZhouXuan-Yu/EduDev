import {READABILITY_SOURCE} from './vendor/mozilla-readability/readability-source';
/** Fixed host script; callers supply an observed element identity, never selectors or JavaScript. */
export function browserExtractScript(scope?:{ref:number;expectedHtml:string}){
 return `(function(){
  const module={exports:{}};
  ${READABILITY_SOURCE}
  const Reader=module.exports;
  if(document.querySelectorAll('*').length>20000)throw Error('too_large');
  const scope=${JSON.stringify(scope||null)};
  const original=scope?document.querySelector('[data-hana-ref="'+scope.ref+'"]'):document.body;
  if(!original||scope&&original.outerHTML!==scope.expectedHtml)throw Error('attachment_changed');
  const hidden=el=>{let style={};try{style=getComputedStyle(el);}catch{}const parent=el.parentElement;if(parent?.tagName==='DETAILS'&&!parent.open&&el!==[...parent.children].find(c=>c.tagName==='SUMMARY'))return true;return el.hidden||el.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0'||style.contentVisibility==='hidden';};
  for(let ancestor=original;ancestor;ancestor=ancestor.parentElement)if(hidden(ancestor))throw Error('source_unreadable');
  if(original.textContent.length>2097152)throw Error('too_large');
  const clone=original.cloneNode(true),sources=[original,...original.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  const holder=document.createElement('div');holder.append(clone);
  const excluded=new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','INPUT','TEXTAREA','SELECT','BUTTON','IFRAME','OBJECT','EMBED']);
  for(let i=0;i<sources.length;i++){
   const source=sources[i],copy=copies[i];
   if(excluded.has(source.tagName)||hidden(source)){if(source===original)throw Error('source_unreadable');copy.remove();continue;}
   for(const attr of [...copy.attributes])if(attr.name.startsWith('on')||attr.name==='value'||attr.name==='srcdoc')copy.removeAttribute(attr.name);
  }
  for(const details of holder.querySelectorAll('details:not([open])')){const summary=[...details.children].find(el=>el.tagName==='SUMMARY');for(const node of [...details.childNodes])if(node!==summary)node.remove();}
  const figures=holder.querySelectorAll('img,svg').length,canvas=holder.querySelectorAll('canvas').length;
  let structuralLoss=!!holder.querySelector('table table,td[rowspan]:not([rowspan="1"]),th[rowspan]:not([rowspan="1"]),td[colspan]:not([colspan="1"]),th[colspan]:not([colspan="1"])');
  for(const el of [...holder.querySelectorAll('sup,sub')].reverse())el.replaceWith(clone.ownerDocument.createTextNode((el.tagName==='SUP'?'^':'_')+'('+el.textContent+')'));
  const formulaNodes=[...holder.querySelectorAll('math,.katex,.MathJax,[data-latex]')].filter(el=>!el.parentElement?.closest('math,.katex,.MathJax,[data-latex]'));
  for(const el of formulaNodes){const annotation=el.querySelector('annotation[encoding="application/x-tex"]'),tex=annotation?.textContent||el.getAttribute('data-latex')||el.getAttribute('alttext');if(!tex)structuralLoss=true;const text=clone.ownerDocument.createTextNode(tex?' $'+tex+'$ ':' [公式文本] '+el.textContent+' ');el.replaceWith(text);}
  for(const table of [...holder.querySelectorAll('table')].reverse()){const text=[...table.rows].map(row=>[...row.cells].map(c=>c.textContent.trim()).join(' | ')).join('\\n');table.replaceWith(clone.ownerDocument.createTextNode('\\n[表格]\\n'+text+'\\n[/表格]\\n'));}
  for(const el of holder.querySelectorAll('p,div,section,article,h1,h2,h3,h4,li,br'))el.append('\\n');
  const fallback=holder.textContent.trim();
  if(fallback.length>2097152)throw Error('too_large');
  const doc=document.implementation.createHTMLDocument(document.title);doc.body.append(doc.importNode(holder,true));
  let parsed;try{parsed=new Reader(doc,{charThreshold:0,maxElemsToParse:20000}).parse();}catch{parsed=null;}
  const extracted=scope?null:parsed?.textContent?.trim(),method=extracted?'readability':'dom_region';let text=extracted||fallback;
  const normalized=s=>s.replace(/\\s+/g,'');const lossy=structuralLoss||!!extracted&&normalized(fallback)!==normalized(extracted);
  const sourceChars=fallback.length,truncated=text.length>24000||new TextEncoder().encode(text).byteLength>48000;
  text=text.slice(0,24000);if(text.length&&/[\\uD800-\\uDBFF]/.test(text.at(-1)))text=text.slice(0,-1);
  while(new TextEncoder().encode(text).byteLength>48000){text=text.slice(0,-256);if(text.length&&/[\\uD800-\\uDBFF]/.test(text.at(-1)))text=text.slice(0,-1);}
  const accessHint=/验证码|人机验证|安全验证|请先登录|登录后.{0,12}(查看|阅读)|付费.{0,8}(查看|解锁)|captcha|sign in to|verify you are human/i.test(fallback)?'login_or_challenge':'none';
  return{method,text,sourceChars,truncated,lossy,figures,canvas,formulas:formulaNodes.length,accessHint};
 })()`;
}

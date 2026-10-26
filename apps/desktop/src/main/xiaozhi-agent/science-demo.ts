import {createHash} from 'node:crypto';
import {readScienceTeaching} from './science-teaching';
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const SCIENCE_DEMO_SCHEMA='xiaozhi.science-demo.v1';
const start='<!-- '+SCIENCE_DEMO_SCHEMA+' -->';
/** Only the fixed host script executes. SVG is decoded into an inert XML tree,
 * serialized and displayed as an image; even hostile local SVG cannot execute. */
export function scienceDemo(svg:string):string {
  if(Buffer.byteLength(svg)>65536||!svg.startsWith('<!-- xiaozhi.science-figure.v1 -->'))throw Error('invalid_input');
  const data=Buffer.from(svg).toString('base64');
  const teaching=readScienceTeaching(svg);
  const lesson=teaching?`<section aria-label="课堂讲解"><p>${escape(teaching.audience)} · 学习目标：${escape(teaching.objective)}</p><h2>先观察</h2><p class="student">${escape(teaching.observation)}</p><div class="lessons">${teaching.steps.map((s,i)=>`<button type="button" data-lesson="${i}" data-part="${escape(s.part)}">讲解${i+1} · ${escape(s.part)}</button>`).join('')}</div><p id="lesson-explanation" class="student"></p><p id="lesson-question" class="student"></p><h2>想一想</h2><p class="student">${escape(teaching.check.question)}</p><details><summary>教师讲解建议与参考答案</summary>${teaching.steps.map((s,i)=>`<p>讲解${i+1} · ${escape(s.part)}：${escape(s.notes)}</p>`).join('')}<p>${escape(teaching.check.answer)}</p></details></section>`:'';
  const script=`const source=atob(document.getElementById('science-data').textContent.trim());
const bytes=Uint8Array.from(source,c=>c.charCodeAt(0));
const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'image/svg+xml');
const groups=[...doc.querySelectorAll('g[data-science-part]')];
const range=document.getElementById('progress'),image=document.getElementById('scene'),readout=document.getElementById('readout'),play=document.getElementById('play');
let timer;range.max=String(groups.length);
function pause(){clearInterval(timer);timer=undefined;play.textContent='播放';play.setAttribute('aria-pressed','false');}
function draw(){const n=Number(range.value);groups.forEach((g,i)=>{g.setAttribute('opacity',n===0||i===n-1?'1':i<n?'0.5':'0.05');g.querySelector('.iso-edge')?.setAttribute('style',n>0&&i===n-1?'stroke:#176c50;stroke-width:2':'');});image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc));readout.textContent=n===0?'完整结构 · '+groups.length+' 个部件':n+' / '+groups.length+' · '+(groups[n-1]?.querySelector('title')?.textContent||'部件');}
range.addEventListener('input',()=>{pause();draw();});
play.addEventListener('click',()=>{if(timer){pause();return;}if(Number(range.value)>=groups.length)range.value='0';play.textContent='暂停';play.setAttribute('aria-pressed','true');timer=setInterval(()=>{range.value=String(Number(range.value)+1);draw();if(Number(range.value)>=groups.length)pause();},matchMedia('(prefers-reduced-motion: reduce)').matches?500:180);});
document.getElementById('previous').addEventListener('click',()=>{pause();range.value=String(Math.max(0,Number(range.value)-1));draw();});
document.getElementById('next').addEventListener('click',()=>{pause();range.value=String(Math.min(groups.length,Number(range.value)+1));draw();});
document.getElementById('reset').addEventListener('click',()=>{pause();range.value='0';draw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
if(groups.length<40||groups.length>80){document.getElementById('readout').textContent='演示数据无效';document.querySelectorAll('button,input').forEach(c=>c.disabled=true);}else draw();`+(teaching?`
const teaching=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(doc.querySelector('metadata#science-teaching').textContent),c=>c.charCodeAt(0))));
document.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>{
pause();const i=Number(button.dataset.lesson),step=teaching.steps[i];
groups.forEach(g=>{const label=g.querySelector('title')?.textContent||'部件',category=label.replace(/[\\s#]*[0-9０-９]+$/u,'')||label;g.setAttribute('opacity',category===step.part?'1':'0.08');g.querySelector('.iso-edge')?.setAttribute('style',category===step.part?'stroke:#176c50;stroke-width:2':'');});
image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc));
document.getElementById('lesson-explanation').textContent=step.explanation;document.getElementById('lesson-question').textContent=step.question;
readout.textContent='讲解'+(i+1)+' · '+step.part;document.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
document.querySelectorAll('#progress,#play,#previous,#next,#reset').forEach(c=>c.addEventListener(c.id==='progress'?'input':'click',()=>{document.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed','false'));document.getElementById('lesson-explanation').textContent='';document.getElementById('lesson-question').textContent='';}));
`: '');
  const digest=createHash('sha256').update(script).digest('base64');
  return `${start}\n<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>小智科普结构演示</title><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#fff;color:#24332d;font:14px system-ui,'Microsoft YaHei',sans-serif}main{max-width:1120px;margin:auto}img{display:block;width:100%;height:min(60vh,520px);object-fit:contain}nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 0;border-top:1px solid #e4e9e6}button{font:inherit;padding:7px 14px;border:1px solid #ced7d0;border-radius:9px;background:#f7faf8;color:inherit;cursor:pointer}button:hover{background:#e9f2eb}button:focus-visible,input:focus-visible{outline:2px solid #176c50;outline-offset:3px}input{min-width:130px;flex:1;accent-color:#176c50}output{display:block;min-height:24px;font-weight:600}p{color:#647068;font-size:12px;margin:8px 0}label{white-space:nowrap}@media(max-width:600px){body{padding:8px}button{padding:6px 10px}input{flex-basis:100%}}section{border-top:1px solid #e4e9e6;margin-top:12px;padding:8px 0}h2{font-size:18px;margin:12px 0 8px}.student{font-size:17px;color:#24332d;line-height:1.6}.lessons{display:flex;flex-wrap:wrap;gap:8px}button[aria-pressed="true"]{background:#dcefe3}details{margin-top:16px}summary{cursor:pointer;font-weight:600}</style></head><body><main><img id="scene" alt="科普图结构演示"><nav aria-label="演示控制"><button id="play" aria-pressed="false">播放</button><button id="previous">上一步</button><button id="next">下一步</button><button id="reset">查看全貌</button><label for="progress">部件进度</label><input id="progress" type="range" min="0" max="80" value="0" step="1" aria-label="部件进度"></nav><output id="readout" aria-live="polite"></output><p>结构装配演示 · 可拖动进度或使用方向键。非温度、受力或运动仿真，科学含义请教师核对。</p>${lesson}</main><script id="science-data" type="application/octet-stream">${data}</script><script>${script}</script></body></html>`;
}
/** Never run arbitrary file HTML: recover only bounded image data and rebuild
 * the reviewed host template. All other bytes in a modified file are ignored. */
export function reopenScienceDemo(html:string):string {
  if(Buffer.byteLength(html)>65536||!html.startsWith(start))throw Error('unsupported');
  const matches=[...html.matchAll(/<script id="science-data" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/g)];
  if(matches.length!==1)throw Error('unsupported');
  const bytes=Buffer.from(matches[0][1],'base64');
  if(bytes.length>65536||bytes.toString('base64')!==matches[0][1])throw Error('unsupported');
  return scienceDemo(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

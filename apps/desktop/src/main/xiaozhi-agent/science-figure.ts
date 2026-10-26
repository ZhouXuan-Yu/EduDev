import {validScienceFigure,expandScienceParts,SCIENCE_FIGURE_SCHEMA,type SciencePart} from '../../shared/science-figure';
import * as kit from './vendor/anatomy/iso-kit';
import {scienceDemo} from './science-demo';
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
// Conservative glyph widths keep long Chinese titles/captions inside the page.
const wrap=(text:string,fontSize:number)=>{
  const lines:string[]=[];let line='',width=0;
  for(const c of text){const advance=fontSize*(c.codePointAt(0)!>0xffff?2:1);if(width+advance>840){lines.push(line);line='';width=0;}line+=c;width+=advance;}
  if(line)lines.push(line);return lines;
};
/** Fixed +x/+y/+z camera. Bounding-volume separation establishes painter
 * dependencies; center depth alone wrongly paints a broad base over its fins.
 * Intersecting volumes/cyclic arrangements need a revised model, not a guessed
 * scientific view. Cylinders conservatively use their bounding volume. */
export function orderScienceParts(parts:SciencePart[],projection:kit.Projection) {
  const nodes=parts.map((p,index)=>({p,index,depth:kit.depthOf([p.x+p.w/2,p.y+p.d/2,p.z+p.h/2],projection)}));
  const edges=nodes.map(()=>new Set<number>()),incoming=nodes.map(()=>0),eps=1e-7;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=parts[i],b=parts[j];
    const behind=a.x+a.w<=b.x+eps||a.y+a.d<=b.y+eps||a.z+a.h<=b.z+eps;
    const ahead=b.x+b.w<=a.x+eps||b.y+b.d<=a.y+eps||b.z+b.h<=a.z+eps;
    if(!behind&&!ahead)throw Error('invalid_input');
    if(behind===ahead)continue; // Separated along opposite axes: no shared viewing ray.
    const from=behind?i:j,to=behind?j:i;edges[from].add(to);incoming[to]++;
  }
  const result:typeof nodes=[],available=nodes.filter(n=>incoming[n.index]===0);
  while(available.length){available.sort((a,b)=>a.depth-b.depth||a.index-b.index);const next=available.shift()!;result.push(next);for(const to of edges[next.index])if(--incoming[to]===0)available.push(nodes[to]);}
  if(result.length!==nodes.length)throw Error('invalid_input');
  return result;
}
/** Fixed reviewed upstream geometry only. Model data never becomes executable code. */
export function renderScienceFigure(input:unknown):{path:string;content:string} {
  if(!validScienceFigure(input))throw Error('invalid_input');
  const expanded=expandScienceParts(input.parts);
  const points=expanded.flatMap(p=>kit.boxCorners({x:p.x,y:p.y,w:p.w,d:p.d,r:0},p.z,p.z+p.h));
  const projection=kit.fitProjection(points,960,560,{pad:48,azimuth:45});
  const parts=orderScienceParts(expanded,projection);
  const metadata=input.teaching?`<metadata id="science-teaching">${Buffer.from(JSON.stringify(input.teaching)).toString('base64')}</metadata>`:'';
  const body=metadata+parts.map(({p,index})=>{
    const paths=p.kind==='box'?kit.slabOf({x:p.x,y:p.y,w:p.w,d:p.d,r:0},p.z,p.h,projection,2,0)
      :kit.cylinder(p.x+p.w/2,p.y+p.d/2,p.w/2,p.z,p.h,projection,12,0);
    return `<g data-science-part="${index}"><title>${escape(p.label)}</title>${kit.solidSvg(paths,{tone:p.tone==='lit'?'hi':p.tone,lit:p.tone==='lit'})}</g>`;
  }).join('');
  const title=wrap(input.title,24),caption=wrap(input.caption,16),diagramY=60+(title.length-1)*30,captionY=diagramY+580;
  const height=captionY+caption.length*24+20;
  const content=kit.figureSvg({width:960,height,label:input.title,standalone:'light',body:`<rect width="960" height="${height}" fill="#fff"/>${title.map((line,i)=>`<text x="36" y="${36+i*30}" font-size="24" fill="#202725">${escape(line)}</text>`).join('')}<g transform="translate(0 ${diagramY})">${body}</g>${caption.map((line,i)=>`<text x="36" y="${captionY+i*24}" font-size="16" fill="#46514d">${escape(line)}</text>`).join('')}<text x="36" y="${height-10}" font-size="12" fill="#666">AI 科普图草稿 · Anatomy · 请教师核对科学含义</text>`});
  const svg=`<!-- ${SCIENCE_FIGURE_SCHEMA} -->\n${content}`;
  const document=/\.html$/i.test(input.path)?scienceDemo(svg):svg;
  if(Buffer.byteLength(document)>65536)throw Error('too_large');
  return {path:input.path,content:document};
}

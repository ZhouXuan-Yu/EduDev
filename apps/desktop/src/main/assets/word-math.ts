import {child,children,nodeText,MATH_NS,type WordNode} from './word-xml';
const escape=(s:string)=>s.replace(/\\/g,'\\backslash ').replace(/[{}$%&#_]/g,c=>'\\'+c).replace(/\^/g,'\\hat{}').replace(/~/g,'\\sim ').replace(/×/g,'\\times ').replace(/÷/g,'\\div ').replace(/≤/g,'\\le ').replace(/≥/g,'\\ge ').replace(/≠/g,'\\ne ').replace(/π/g,'\\pi ').replace(/∞/g,'\\infty ');
/** Deliberately bounded converter. Raw OMML and an incomplete flag survive every fallback. */
export function wordMath(node:WordNode){
 let complete=true;
 function render(n:WordNode):string{
  const arg=(name:string)=>{const v=child(n,name);return v?render(v):'';},body=()=>n.children.map(render).join('');
  if(!MATH_NS.has(n.uri)){complete=false;return '';}
  if(n.name.endsWith('Pr')||['ctrlPr','rPr'].includes(n.name))return '';
  // Semantic properties cannot be silently discarded. Formatting-only run properties are harmless.
  const supported:Record<string,string[]>={f:['type'],rad:['degHide'],d:['begChr','endChr','sepChr','grow'],nary:['chr','subHide','supHide','limLoc','grow'],bar:['pos'],acc:['chr']};
  for(const p of n.children.filter(v=>v.name.endsWith('Pr')&&v.name!=='rPr'&&v.name!=='ctrlPr'))for(const property of p.children)if(property.name!=='ctrlPr'&&!supported[n.name]?.includes(property.name))complete=false;
  const value=(p:string,k:string,fallback:string)=>child(child(n,p)||n,k)?.attrs.val??fallback;
  switch(n.name){
   case 't':return escape(n.text);
   case 'oMath':case 'oMathPara':case 'r':case 'e':case 'num':case 'den':case 'sup':case 'sub':case 'deg':case 'lim':case 'fName':return body();
   case 'f':{const type=value('fPr','type','bar');if(type==='noBar')return '\\genfrac{}{}{0pt}{}{'+arg('num')+'}{'+arg('den')+'}';if(type!=='bar')complete=false;return '\\frac{'+arg('num')+'}{'+arg('den')+'}';}
   case 'sSup':return '{'+arg('e')+'}^{'+arg('sup')+'}';
   case 'sSub':return '{'+arg('e')+'}_{'+arg('sub')+'}';
   case 'sSubSup':return '{'+arg('e')+'}_{'+arg('sub')+'}^{'+arg('sup')+'}';
   case 'rad':{const degree=['1','true','on'].includes(value('radPr','degHide','0'))?'':arg('deg');return '\\sqrt'+(degree?'['+degree+']':'')+'{'+arg('e')+'}';}
   case 'd':{const begin=value('dPr','begChr','('),end=value('dPr','endChr',')'),separator=value('dPr','sepChr','|');const delim=(x:string)=>{if(['(',')','[',']','|'].includes(x))return x;if(x==='')return '.';if(x==='{')return '\\{';if(x==='}')return '\\}';if(x==='‖')return '\\Vert ';complete=false;return '.';};return '\\left'+delim(begin)+children(n,'e').map(render).join(escape(separator))+'\\right'+delim(end);}
   case 'func':return '{'+arg('fName')+'} '+arg('e');
   case 'limLow':return '{'+arg('e')+'}_{'+arg('lim')+'}';
   case 'limUpp':return '{'+arg('e')+'}^{'+arg('lim')+'}';
   case 'nary':{const symbol=value('naryPr','chr','∫'),operator:Record<string,string>={'∫':'\\int','∑':'\\sum','∏':'\\prod','∬':'\\iint'};if(!operator[symbol])complete=false;const sub=['1','true','on'].includes(value('naryPr','subHide','0'))?'':arg('sub'),sup=['1','true','on'].includes(value('naryPr','supHide','0'))?'':arg('sup');return (operator[symbol]||escape(symbol))+(sub?'_{'+sub+'}':'')+(sup?'^{'+sup+'}':'')+' '+arg('e');}
   case 'm':return '\\begin{matrix}'+children(n,'mr').map(row=>children(row,'e').map(render).join('&')).join('\\\\')+'\\end{matrix}';
   case 'eqArr':return '\\begin{aligned}'+children(n,'e').map(render).join('\\\\')+'\\end{aligned}';
   case 'bar':{const pos=value('barPr','pos','top');if(!['top','bot'].includes(pos))complete=false;return (pos==='bot'?'\\underline':'\\overline')+'{'+arg('e')+'}';}
   case 'acc':{const char=child(child(n,'accPr')||n,'chr')?.attrs.val||'̂';const commands:Record<string,string>={'̂':'hat','→':'vec','̇':'dot','̈':'ddot','̃':'tilde'};if(!commands[char])complete=false;return '\\'+(commands[char]||'hat')+'{'+arg('e')+'}';}
   default:complete=false;return n.children.length?body():escape(nodeText(n));
  }
 }
 const latex=render(node);if(!latex.trim()||latex.length>32000)complete=false;return {latex:latex.slice(0,32000),complete};
}

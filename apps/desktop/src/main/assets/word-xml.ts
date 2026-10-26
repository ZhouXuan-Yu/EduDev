import {SaxesParser,type SaxesTagNS} from 'saxes';
export type WordNode={name:string;uri:string;attrs:Record<string,string>;children:WordNode[];text:string;start:number;end:number;path:string};
export const WORD_NS=new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
export const MATH_NS=new Set(['http://schemas.openxmlformats.org/officeDocument/2006/math','http://purl.oclc.org/ooxml/officeDocument/math']);
export const PACKAGE_NS='http://schemas.openxmlformats.org/package/2006/relationships';
export const MC_NS='http://schemas.openxmlformats.org/markup-compatibility/2006';
export const DRAWING_NS=new Set(['http://schemas.openxmlformats.org/drawingml/2006/main','http://purl.oclc.org/ooxml/drawingml/main']);
export const WP_NS=new Set(['http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing','http://schemas.openxmlformats.org/drawingml/2006/picture','http://purl.oclc.org/ooxml/drawingml/picture']);
export function readWordXml(bytes:Buffer,budget={nodes:0}){
 const encoding=bytes[0]===0xff&&bytes[1]===0xfe||bytes[0]===0x3c&&bytes[1]===0?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff||bytes[0]===0&&bytes[1]===0x3c?'utf-16be':'utf-8';
 const xml=new TextDecoder(encoding,{fatal:true}).decode(bytes),stack:WordNode[]=[],roots:WordNode[]=[];
 const parser=new SaxesParser({xmlns:true,position:true});
 parser.on('doctype',()=>{throw Error('parse_failed');});parser.on('error',()=>{throw Error('parse_failed');});
 parser.on('opentag',(tag:SaxesTagNS)=>{
  if(++budget.nodes>100000||stack.length>=96)throw Error('too_large');
  const parent=stack.at(-1),siblings=parent?.children||roots;
  const node:WordNode={name:tag.local,uri:tag.uri,attrs:{},children:[],text:'',start:xml.lastIndexOf('<',parser.position-1),end:0,path:(parent?.path||'')+'/'+tag.local+'['+siblings.length+']'};
  for(const a of Object.values(tag.attributes)){if(a.uri==='http://www.w3.org/2000/xmlns/')continue;if(Object.hasOwn(node.attrs,a.local))throw Error('parse_failed');node.attrs[a.local]=a.value;}
  siblings.push(node);stack.push(node);
 });
 const append=(text:string)=>{if(stack.length)stack[stack.length-1].text+=text;};parser.on('text',append);parser.on('cdata',append);
 parser.on('closetag',()=>{const node=stack.pop();if(node)node.end=parser.position;});parser.write(xml).close();
 if(roots.length!==1)throw Error('parse_failed');return {root:roots[0],xml};
}
export const child=(n:WordNode,name:string)=>n.children.find(c=>c.name===name&&c.uri===n.uri);
export const children=(n:WordNode,name:string)=>n.children.filter(c=>c.name===name&&c.uri===n.uri);
export function descendants(n:WordNode,name:string,namespaces?:Set<string>):WordNode[]{return [...(n.name===name&&(!namespaces||namespaces.has(n.uri))?[n]:[]),...n.children.flatMap(c=>descendants(c,name,namespaces))];}
export function nodeText(n:WordNode):string{return n.text+n.children.map(nodeText).join('');}

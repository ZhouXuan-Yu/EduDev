import path from 'node:path';
import {SaxesParser,type SaxesTagNS} from 'saxes';
import {readWordPackage,wordTarget} from '../../src/main/assets/word-package';

type Node={name:string;uri:string;attrs:Map<string,string>;children:Node[];text:string};
const presentation=new Set(['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main']);
const drawing=new Set(['http://schemas.openxmlformats.org/drawingml/2006/main','http://purl.oclc.org/ooxml/drawingml/main']);
const relationships=['http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships'];
const descendants=(node:Node,name:string,namespaces?:Set<string>):Node[]=>[...(node.name===name&&(!namespaces||namespaces.has(node.uri))?[node]:[]),...node.children.flatMap(c=>descendants(c,name,namespaces))];
const attr=(node:Node,name:string,uri='')=>node.attrs.get(uri+':'+name);

/** Actual OOXML notes with relationships/order, without running Office or loading resources. */
export async function readPresentationNotes(bytes:Uint8Array){
  const parts=await readWordPackage(bytes);let nodes=0;
  const xml=(name:string):Node=>{
    const data=parts.get(name);if(!data)throw Error('parse_failed');
    const encoding=data[0]===0xff&&data[1]===0xfe?'utf-16le':data[0]===0xfe&&data[1]===0xff?'utf-16be':'utf-8';
    const parser=new SaxesParser({xmlns:true}),stack:Node[]=[],roots:Node[]=[];
    parser.on('doctype',()=>{throw Error('parse_failed');});parser.on('error',()=>{throw Error('parse_failed');});
    parser.on('opentag',(tag:SaxesTagNS)=>{if(++nodes>100000||stack.length>=64)throw Error('too_large');const node:Node={name:tag.local,uri:tag.uri,attrs:new Map(),children:[],text:''};for(const a of Object.values(tag.attributes)){if(a.uri==='http://www.w3.org/2000/xmlns/')continue;const key=a.uri+':'+a.local;if(node.attrs.has(key))throw Error('parse_failed');node.attrs.set(key,a.value);}(stack.at(-1)?.children||roots).push(node);stack.push(node);});
    const text=(value:string)=>{if(stack.length)stack[stack.length-1].text+=value;};parser.on('text',text);parser.on('cdata',text);parser.on('closetag',()=>{stack.pop();});
    parser.write(new TextDecoder(encoding,{fatal:true}).decode(data)).close();if(roots.length!==1)throw Error('parse_failed');return roots[0];
  };
  const links=(part:string)=>{
    const name=path.posix.join(path.posix.dirname(part),'_rels',path.posix.basename(part)+'.rels');
    if(!parts.has(name))return [];
    const root=xml(name);if(root.uri!=='http://schemas.openxmlformats.org/package/2006/relationships')throw Error('parse_failed');
    return root.children.filter(n=>n.name==='Relationship').map(n=>({id:attr(n,'Id'),type:attr(n,'Type')||'',target:attr(n,'Target')||'',external:attr(n,'TargetMode')==='External'}));
  };
  const root=xml('ppt/presentation.xml'),slides=descendants(root,'sldId',presentation),refs=links('ppt/presentation.xml');
  if(slides.length>500)throw Error('too_large');
  const output:{page:number;pageId?:string;text:string}[]=[];let size=0;
  for(const [index,slide]of slides.entries()){
    const ref=relationships.map(uri=>attr(slide,'id',uri)).find(Boolean),matches=refs.filter(r=>r.id===ref&&r.type.endsWith('/slide'));
    if(!ref||matches.length!==1||matches[0].external)throw Error('parse_failed');
    const part=wordTarget('ppt/presentation.xml',matches[0].target),noteLinks=links(part).filter(r=>r.type.endsWith('/notesSlide'));
    if(!noteLinks.length)continue;if(noteLinks.length!==1||noteLinks[0].external)throw Error('parse_failed');
    const note=xml(wordTarget(part,noteLinks[0].target)),shapes=descendants(note,'sp',presentation);
    const text=shapes.filter(shape=>descendants(shape,'ph',presentation).some(n=>attr(n,'type')==='body')).flatMap(shape=>descendants(shape,'p',drawing).map(p=>descendants(p,'t',drawing).map(t=>t.text).join(''))).join('\n').trim();
    if(!text)continue;
    if((size+=Buffer.byteLength(text))>1024*1024)throw Error('too_large');
    const page=xml(part),ids=descendants(page,'cNvPr',presentation).map(n=>attr(n,'name')||'').filter(name=>/^xiaozhi-page:[a-z][a-z0-9_-]{0,63}$/.test(name));
    output.push({page:index+1,...(ids.length===1?{pageId:ids[0].slice('xiaozhi-page:'.length)}:{}),text});
  }
  return output;
}

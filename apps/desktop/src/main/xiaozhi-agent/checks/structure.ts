import path from 'node:path';
import * as yauzl from 'yauzl';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom') as {JSDOM:new(text:string,options?:{contentType?:string})=>{window:{document:Document;close:()=>void}}};
import {getDocumentProxy} from 'unpdf';
import {parseComputationCsv} from '../../managed-tools/typed-table';
import type {DocumentMetrics} from '../../../shared/xiaozhi-delivery-checks';

const P='http://schemas.openxmlformats.org/presentationml/2006/main',A='http://schemas.openxmlformats.org/drawingml/2006/main';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/package/2006/relationships',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const nodes=(root:Document|Element,ns:string,name:string)=>Array.from(root.getElementsByTagNameNS(ns,name));
const runs=(root:Document|Element,ns:string)=>nodes(root,ns,'t').map(n=>n.textContent||'').join('');
const paragraphs=(root:Document|Element,ns:string)=>nodes(root,ns,'p').map(n=>runs(n,ns)).join('\n');
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});

/** Actual streams/CRC and central-directory bounds, before XML parsing. Never extract paths. */
async function parts(bytes:Buffer){
 return new Promise<Map<string,Buffer>>((resolve,reject)=>{
  yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
   if(error||!zip){reject(Error('parse_failed'));return;}
   const output=new Map<string,Buffer>(),names=new Set<string>();let count=0,total=0,finished=false;
   const fail=(code='parse_failed')=>{if(finished)return;finished=true;zip.close();reject(Error(code));};
   zip.on('error',()=>fail());zip.on('end',()=>{if(!finished){finished=true;zip.close();resolve(output);}});
   zip.on('entry',(entry:yauzl.Entry)=>{
    if(++count>4096||(total+=entry.uncompressedSize)>32*1048576){fail('too_large');return;}
    const name=entry.fileName;
    if(name.startsWith('/')||name.split('/').some(p=>p==='..'||p==='.')||names.has(name.toLowerCase())||entry.generalPurposeBitFlag&1){fail();return;}
    names.add(name.toLowerCase());
    const offset=entry.relativeOffsetOfLocalHeader;
    if(!Number.isSafeInteger(offset)||offset<0||offset+30>bytes.length||bytes.readUInt32LE(offset)!==0x04034b50
     ||bytes.readUInt16LE(offset+8)!==entry.compressionMethod){fail();return;}
    if(name.endsWith('/')){zip.readEntry();return;}
    const xml=/\.(?:xml|rels)$/i.test(name)||name==='[Content_Types].xml';
    if(xml&&entry.uncompressedSize>2*1048576){fail('too_large');return;}
    zip.openReadStream(entry,(err,stream)=>{
     if(err||!stream){fail();return;}let size=0,crc=0xffffffff;const chunks:Buffer[]=[];
     stream.on('error',()=>fail());stream.on('data',(data:Buffer)=>{
      size+=data.length;if(size>entry.uncompressedSize){stream.destroy();fail();return;}
      for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);if(xml)chunks.push(data);
     });
     stream.on('end',()=>{if(finished)return;if(size!==entry.uncompressedSize||((crc^0xffffffff)>>>0)!==(entry.crc32>>>0)){fail();return;}
      output.set(name,xml?Buffer.concat(chunks):Buffer.alloc(0));zip.readEntry();});
    });
   });zip.readEntry();
  });
 });
}
function xmlPart(all:Map<string,Buffer>,name:string){
 const bytes=all.get(name);if(!bytes)throw Error('parse_failed');const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('parse_failed');
 try{return new JSDOM(text,{contentType:'text/xml'}).window.document;}catch{throw Error('parse_failed');}
}
function relationships(all:Map<string,Buffer>,owner:string){
 const file=path.posix.join(path.posix.dirname(owner),'_rels',path.posix.basename(owner)+'.rels'),out=new Map<string,string>();
 if(!all.has(file))return out;
 for(const rel of nodes(xmlPart(all,file),REL,'Relationship')){
  if(rel.getAttribute('TargetMode')==='External')continue;
  const target=rel.getAttribute('Target'),id=rel.getAttribute('Id');if(!target||!id||out.has(id))throw Error('parse_failed');
  let decoded:string;try{decoded=decodeURIComponent(target.split('#')[0]);}catch{throw Error('parse_failed');}
  const resolved=decoded?path.posix.normalize(decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(owner),decoded)):owner;
  if(resolved.startsWith('../')||resolved.includes('\\')||!all.has(resolved))throw Error('parse_failed');out.set(id,resolved);
 }return out;
}
const bounded=(v:string,max=256000)=>{if(v.length>max)throw Error('too_large');return v;};
function ppt(all:Map<string,Buffer>):DocumentMetrics{
 const doc=xmlPart(all,'ppt/presentation.xml'),rels=relationships(all,'ppt/presentation.xml');
 if(doc.documentElement.namespaceURI!==P)throw Error('parse_failed');
 const ids=nodes(doc,P,'sldId');if(!ids.length||ids.length>64)throw Error('too_large');
 const size=nodes(doc,P,'sldSz')[0],width=Number(size?.getAttribute('cx')),height=Number(size?.getAttribute('cy'));
 if(!(width>0&&height>0))throw Error('parse_failed');const geometry:{page:number;code:string}[]=[],fonts=new Set<string>();
 const seen=new Set<string>();
 const pages=ids.map((id,index)=>{
  const file=rels.get(id.getAttributeNS(R,'id')||'');if(!file||seen.has(file))throw Error('parse_failed');seen.add(file);
  const page=xmlPart(all,file);if(page.documentElement.namespaceURI!==P||page.documentElement.localName!=='sld')throw Error('parse_failed');
  for(const tr of nodes(page,A,'xfrm')){
   const off=nodes(tr,A,'off')[0],ext=nodes(tr,A,'ext')[0];if(!off||!ext)continue;
   const x=Number(off.getAttribute('x')),y=Number(off.getAttribute('y')),w=Number(ext.getAttribute('cx')),h=Number(ext.getAttribute('cy'));
   if(![x,y,w,h].every(Number.isFinite)||w<0||h<0)throw Error('parse_failed');
   if(x<-12700||y<-12700||x+w>width+12700||y+h>height+12700)geometry.push({page:index+1,code:'object_outside_slide'});
  }
  for(const name of ['latin','ea','cs'])for(const font of nodes(page,A,name)){const name=font.getAttribute('typeface');if(name&&!name.startsWith('+'))fonts.add(name.slice(0,120));}
  const notesPath=[...relationships(all,file).values()].find(v=>v.startsWith('ppt/notesSlides/'));
  const notes=notesPath?nodes(xmlPart(all,notesPath),P,'sp').filter(s=>!nodes(s,P,'ph').some(p=>['sldNum','hdr','ftr','dt'].includes(p.getAttribute('type')||''))).map(s=>paragraphs(s,A)).filter(Boolean).join('\n'):'';
  return{index:index+1,text:bounded(paragraphs(page,A)),notes:bounded(notes,30000)};
 });return{format:'pptx',engine:'yauzl3.4.0/jsdom29.0.2',pageCount:pages.length,pages,geometry,fonts:[...fonts],embeddedFonts:[...all.keys()].some(k=>/^ppt\/fonts\//i.test(k))};
}
function columnIndex(address:string){const match=/^([A-Z]{1,3})([1-9][0-9]{0,5})$/.exec(address);if(!match)throw Error('parse_failed');let column=0;for(const c of match[1])column=column*26+c.charCodeAt(0)-64;return{column,row:Number(match[2])};}
function xlsx(all:Map<string,Buffer>):DocumentMetrics{
 const book=xmlPart(all,'xl/workbook.xml'),rels=relationships(all,'xl/workbook.xml'),ids=nodes(book,S,'sheet');
 if(!ids.length||ids.length>64)throw Error('too_large');
 const shared=all.has('xl/sharedStrings.xml')?nodes(xmlPart(all,'xl/sharedStrings.xml'),S,'si').map(s=>runs(s,S)):[];
 let count=0;
 const sheets=ids.map((sheet,index)=>{
  const file=rels.get(sheet.getAttributeNS(R,'id')||'');if(!file)throw Error('parse_failed');const doc=xmlPart(all,file),seen=new Set<string>();
  const cells=nodes(doc,S,'c').map(cell=>{
   const address=cell.getAttribute('r')||'';if(seen.has(address))throw Error('parse_failed');seen.add(address);if(++count>50000)throw Error('too_large');
   const position=columnIndex(address),type=cell.getAttribute('t'),raw=nodes(cell,S,'v')[0]?.textContent||'';let value:string|number;
   if(type==='s'){const i=Number(raw);if(!Number.isInteger(i)||i<0||i>=shared.length)throw Error('parse_failed');value=shared[i];}
   else if(type==='inlineStr')value=runs(cell,S);
   else if(type==='str'||type==='b'||type==='e')value=raw;
   else if(raw!==''){value=Number(raw);if(!Number.isFinite(value))throw Error('parse_failed');}else value='';
   if(typeof value==='string')bounded(value,30000);return{...position,value,...(nodes(cell,S,'f').length?{formula:true}:{})};
  });return{index:index+1,name:sheet.getAttribute('name')||String(index+1),cells};
 });return{format:'xlsx',engine:'yauzl3.4.0/jsdom29.0.2',sheetCount:sheets.length,pages:sheets.map(s=>({index:s.index,text:bounded(s.cells.map(c=>String(c.value)).join('\n')),notes:''})),sheets};
}
export async function inspectDocumentStructure(name:string,bytes:Buffer):Promise<DocumentMetrics>{
 const format=path.extname(name).slice(1).toLowerCase();
 if(format==='svg'){
  if(bytes.length>65536)throw Error('too_large');const doc=xmlPart(new Map([['image.svg',bytes]]),'image.svg'),ns='http://www.w3.org/2000/svg';
  if(doc.documentElement.localName!=='svg'||doc.documentElement.namespaceURI!==ns||nodes(doc,ns,'script').length)throw Error('parse_failed');
  return{format,engine:'jsdom29.0.2/svg-xml',pageCount:1,pages:[{index:1,text:bounded(['title','desc','text'].flatMap(tag=>nodes(doc,ns,tag).map(n=>n.textContent||'')).join('\n')),notes:''}]};
 }
 if(['html','txt','md','csv'].includes(format)){
  if(bytes.length>65536)throw Error('too_large');let text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!text.trim())throw Error('empty');
  if(format==='csv'){const table=parseComputationCsv(text);return{format,engine:'xiaozhi.csv.v1',pages:[{index:1,text:bounded(text),notes:''}],sheets:[{index:1,name:'CSV',cells:table.flatMap((r,ri)=>r.map((value,ci)=>({row:ri+1,column:ci+1,value})))}]};}
  if(format==='html'){
   if(!/<(?:!doctype\s+html|html(?:\s|>))/i.test(text))throw Error('parse_failed');const dom=new JSDOM(text);
   dom.window.document.querySelectorAll('script,style,template,[hidden]').forEach(n=>n.remove());text=dom.window.document.body.textContent||'';dom.window.close();
  }
  return{format,engine:format==='html'?'jsdom29.0.2':'utf8-fatal',pages:[{index:1,text:bounded(text),notes:''}]};
 }
 if(format==='pdf'){
  if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('parse_failed');
  const doc=await getDocumentProxy(new Uint8Array(bytes),{...{isEvalSupported:false},useSystemFonts:false,disableFontFace:true});
  try{
   if(!doc.numPages||doc.numPages>64)throw Error('too_large');
   const pages:DocumentMetrics['pages']=[],textUnavailablePages:number[]=[];let total=0;
   for(let index=1;index<=doc.numPages;index++){
    const page=await doc.getPage(index);try{
     const content=await page.getTextContent(),text=bounded(content.items.map(item=>'str'in item?item.str+(item.hasEOL?'\n':' '):'').join(''));
     total+=text.length;if(total>1500000)throw Error('too_large');if(!text.trim())textUnavailablePages.push(index);
     pages.push({index,text,notes:''});
    }finally{page.cleanup();}
   }
   return{format,engine:'unpdf1.8.1/pdfjs',pageCount:doc.numPages,pages,textUnavailablePages};
  }finally{await doc.loadingTask.destroy();}
 }
 if(!['pptx','docx','xlsx'].includes(format))throw Error('unsupported');
 const all=await parts(bytes),types=xmlPart(all,'[Content_Types].xml');
 if(!all.has('_rels/.rels')||types.documentElement.localName!=='Types')throw Error('parse_failed');xmlPart(all,'_rels/.rels');
 for(const rel of all.keys())if(rel.endsWith('.rels')){const owner=rel==='_rels/.rels'?'':path.posix.join(path.posix.dirname(path.posix.dirname(rel)),path.posix.basename(rel).slice(0,-5));relationships(all,owner);}
 const active=Array.from(types.getElementsByTagName('*')).some(n=>/macroEnabled|vbaProject/i.test(n.getAttribute('ContentType')||''));if(active)throw Error('unsupported');
 let result:DocumentMetrics;
 if(format==='pptx')result=ppt(all);
 else if(format==='xlsx')result=xlsx(all);
 else{const doc=xmlPart(all,'word/document.xml');if(doc.documentElement.namespaceURI!==W||doc.documentElement.localName!=='document')throw Error('parse_failed');result={format,engine:'yauzl3.4.0/jsdom29.0.2',pages:[{index:1,text:bounded(paragraphs(doc,W)),notes:''}],fonts:[...new Set(nodes(doc,W,'rFonts').flatMap(n=>['ascii','hAnsi','eastAsia','cs'].map(key=>n.getAttributeNS(W,key)||'')).filter(Boolean))].slice(0,128)};}
 result.externalLinks=[...all.entries()].filter(([name])=>name.endsWith('.rels')).some(([,b])=>/TargetMode\s*=\s*["']External["']/i.test(b.toString('utf8')));
 result.nativeRenderBlocked=[...all.keys()].some(name=>/(?:^|\/)(?:embeddings|activeX)\/|\.bin$/i.test(name));
 if(format==='docx')result.nativeRenderBlocked ||= [...all.keys()].some(name=>{
  if(!name.startsWith('word/')||!name.endsWith('.xml'))return false;const doc=xmlPart(all,name);
  const instructions=nodes(doc,W,'instrText').map(n=>n.textContent||'').join('')+'\n'+nodes(doc,W,'fldSimple').map(n=>n.getAttributeNS(W,'instr')||'').join('\n');
  return /\b(?:DDEAUTO|DDE|INCLUDETEXT|INCLUDEPICTURE)\b/i.test(instructions);
 });
 return result;
}

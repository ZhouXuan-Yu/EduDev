import {createHash} from 'node:crypto';
import path from 'node:path';
import {imageSize} from 'image-size';
import {WORD_SCHEMA,WORD_PARSER,WORD_IMAGES,validWordDocument,type WordBlock,type WordInline,type WordAsset,type WordPayload} from '../../shared/material-word';
import {readWordPackage,wordTarget} from './word-package';
import {readWordXml,WORD_NS,MATH_NS,PACKAGE_NS,MC_NS,DRAWING_NS,WP_NS,child,children,descendants,type WordNode} from './word-xml';
import {wordMath} from './word-math';
type Relation={target:string;type:string;external:boolean};
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
export async function parseWord(bytes:Uint8Array):Promise<WordPayload>{
 const parts=await readWordPackage(bytes),warnings=new Set<string>(),unscopedWarnings=new Set<string>(),assets:WordAsset[]=[],images:WordPayload['images']=[],xmlBudget={nodes:0};let imageBytes=0,blockCount=0;
 let activeWarnings:Set<string>|undefined;
 const warn=(s:string)=>{warnings.add(s);(activeWarnings||unscopedWarnings).add(s);if(warnings.size>64)throw Error('too_large');};
 function relationships(part:string){
  const name=part?path.posix.join(path.posix.dirname(part),'_rels',path.posix.basename(part)+'.rels'):'_rels/.rels',data=parts.get(name),result=new Map<string,Relation>();if(!data)return result;
  const {root}=readWordXml(data,xmlBudget);if(root.name!=='Relationships'||root.uri!==PACKAGE_NS)throw Error('parse_failed');
  for(const r of children(root,'Relationship')){const id=r.attrs.Id;if(!id||result.has(id))throw Error('parse_failed');const external=r.attrs.TargetMode==='External';result.set(id,{target:external?r.attrs.Target:wordTarget(part,r.attrs.Target),type:r.attrs.Type||'',external});}return result;
 }
 const packageRelations=relationships(''),office=[...packageRelations.values()].find(r=>r.type.endsWith('/officeDocument'));
 const main=office&&!office.external?office.target:'word/document.xml';if(!parts.has(main))throw Error('parse_failed');
 const numbered=new Map<string,Map<number,{format:string;pattern:string;start:number}>>(),counters=new Map<string,number[]>();
 const mainRelations=relationships(main),numberPart=[...mainRelations.values()].find(r=>r.type.endsWith('/numbering')&&!r.external)?.target;
 if(numberPart&&parts.has(numberPart)){
  const root=readWordXml(parts.get(numberPart)!,xmlBudget).root,abstracts=new Map<string,Map<number,{format:string;pattern:string;start:number}>>();if(!WORD_NS.has(root.uri)||root.name!=='numbering')throw Error('parse_failed');
  for(const a of children(root,'abstractNum')){const levels=new Map<number,{format:string;pattern:string;start:number}>();for(const l of children(a,'lvl')){const level=Number(l.attrs.ilvl);if(!Number.isInteger(level)||level<0||level>8)throw Error('parse_failed');levels.set(level,{format:child(l,'numFmt')?.attrs.val||'decimal',pattern:child(l,'lvlText')?.attrs.val||'%'+(level+1)+'.',start:Number(child(l,'start')?.attrs.val||1)});}abstracts.set(a.attrs.abstractNumId,levels);}
  for(const n of children(root,'num')){const base=abstracts.get(child(n,'abstractNumId')?.attrs.val||'');if(!base)continue;const levels=new Map([...base].map(([k,v])=>[k,{...v}]));for(const o of children(n,'lvlOverride')){const level=Number(o.attrs.ilvl),start=Number(child(o,'startOverride')?.attrs.val);if(Number.isSafeInteger(start)&&levels.has(level))levels.get(level)!.start=start;else warn('numbering_override');}numbered.set(n.attrs.numId,levels);}
  if(descendants(root,'lvlRestart').length||descendants(root,'numStyleLink').length||descendants(root,'isLgl').length||descendants(root,'lvlOverride').some(n=>!!child(n,'lvl')))warn('numbering_override');
 }
 type NumberProperties={id?:string;level?:string};const styles=new Map<string,WordNode>();let defaultStyle='';
 const stylePart=[...mainRelations.values()].find(r=>r.type.endsWith('/styles')&&!r.external)?.target;
 if(stylePart&&parts.has(stylePart)){const root=readWordXml(parts.get(stylePart)!,xmlBudget).root;if(!WORD_NS.has(root.uri)||root.name!=='styles')throw Error('parse_failed');for(const style of children(root,'style'))if(style.attrs.type==='paragraph'){styles.set(style.attrs.styleId,style);if(['1','true','on'].includes(style.attrs.default))defaultStyle=style.attrs.styleId;}}
 function numberProperties(pr?:WordNode):NumberProperties{const n=pr&&child(pr,'numPr');return n?{...(child(n,'numId')?{id:child(n,'numId')!.attrs.val}:{}),...(child(n,'ilvl')?{level:child(n,'ilvl')!.attrs.val}:{})}:{};}
 function styleNumber(id:string,seen=new Set<string>()):NumberProperties{if(!id)return {};if(seen.has(id)||seen.size>=16){warn('numbering_missing');return {};}seen.add(id);const s=styles.get(id);if(!s)return {};return {...styleNumber(child(s,'basedOn')?.attrs.val||'',seen),...numberProperties(child(s,'pPr'))};}
 function number(p:WordNode){const pr=child(p,'pPr'),properties={...styleNumber(pr&&child(pr,'pStyle')?.attrs.val||defaultStyle),...numberProperties(pr)};if(properties.id===undefined)return;const id=properties.id,level=Number(properties.level||0);if(id==='0')return;if(level<0||level>8||!Number.isInteger(level))throw Error('parse_failed');const defs=numbered.get(id),def=defs?.get(level);if(!def){warn('numbering_missing');return;}
  const values=counters.get(id)||[];values[level]=values[level]===undefined?def.start:values[level]+1;for(let i=level+1;i<9;i++)values[i]=undefined as unknown as number;counters.set(id,values);
  const format=(value:number,kind:string)=>{if(!Number.isSafeInteger(value)||value<0||value>1000000)throw Error('too_large');if(kind==='decimal')return String(value);if(['upperLetter','lowerLetter'].includes(kind)){let s='',n=value;while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return kind==='lowerLetter'?s.toLowerCase():s;}if(kind==='bullet')return '';warn('numbering_format');return String(value);};
  const label=def.pattern.replace(/%([1-9])/g,(_m,d)=>{const l=Number(d)-1;return format(values[l]??defs!.get(l)?.start??1,defs!.get(l)?.format||'decimal');})+' ';if(label.length>128)throw Error('too_large');return {level,label};
 }
 async function parsePart(part:string){
  const data=parts.get(part);if(!data){warn('part_missing');return [];}const {root,xml}=readWordXml(data,xmlBudget),rels=relationships(part);if(!WORD_NS.has(root.uri)||!['document','hdr','ftr','footnotes','endnotes'].includes(root.name)||part===main&&root.name!=='document')throw Error('parse_failed');
  const assetByPart=new Map<string,WordAsset>();
  async function image(n:WordNode,selected?:WordNode):Promise<WordInline>{
   const choice=selected||descendants(n,'blip',DRAWING_NS)[0]||descendants(n,'imagedata',new Set(['urn:schemas-microsoft-com:vml']))[0],props=descendants(n,'docPr',WP_NS)[0]||descendants(n,'cNvPr',WP_NS)[0];const relationshipId=choice?.attrs.embed||choice?.attrs.link||choice?.attrs.id||'',relation=rels.get(relationshipId),alt=(props?.attrs.descr||props?.attrs.title||'').slice(0,2000);
   const result:Extract<WordInline,{kind:'image'}>={kind:'image',assetId:'',alt,issue:'',relationshipId,part:relation&&!relation.external?relation.target:''};
   if(!relation||relation.external){result.issue=relation?.external?'external_image':'image_missing';warn(result.issue);return result;}
   const imageBytesPart=parts.get(relation.target);if(!imageBytesPart){result.issue='image_missing';warn(result.issue);return result;}
   let asset=assetByPart.get(relation.target);if(!asset){
    let dimensions;try{dimensions=imageSize(imageBytesPart);}catch{result.issue='unsupported_image';warn(result.issue);return result;}
    const mime=({png:'image/png',jpg:'image/jpeg',webp:'image/webp'} as const)[dimensions.type as 'png'|'jpg'|'webp'];
    if(!mime||!dimensions.width||!dimensions.height||dimensions.width>10000||dimensions.height>10000||dimensions.width*dimensions.height>40000000){result.issue='unsupported_image';warn(result.issue);return result;}
    const hash=sha(imageBytesPart),existing=assets.find(a=>a.sha256===hash);asset=existing||{id:'wa_'+hash,sha256:hash,mime,bytes:imageBytesPart.length,width:dimensions.width,height:dimensions.height,part:relation.target};
    if(!existing){if(assets.length>=512||(imageBytes+=asset.bytes)>WORD_IMAGES)throw Error('too_large');assets.push(asset);images.push({id:asset.id,data:imageBytesPart});}assetByPart.set(relation.target,asset);
   }result.assetId=asset.id;return result;
  }
  async function inlines(n:WordNode):Promise<WordInline[]>{
   if(n.name==='del'||n.name==='moveFrom'){warn('tracked_changes');return [];}
   if(WORD_NS.has(n.uri)&&['ins','moveTo'].includes(n.name))warn('tracked_changes');
   if(MATH_NS.has(n.uri)&&(n.name==='oMath'||n.name==='oMathPara')){const raw=xml.slice(n.start,n.end);if(raw.length>128000)throw Error('too_large');const math=wordMath(n);if(!math.complete)warn('formula_incomplete');return [{kind:'formula',...math,omml:raw}];}
   if(WORD_NS.has(n.uri)&&['drawing','pict','object'].includes(n.name)){if(n.name==='object')warn('embedded_object');const result:WordInline[]=[];const textboxes=descendants(n,'txbxContent',WORD_NS);if(textboxes.length){warn('text_box');for(const box of textboxes)result.push(...await inlines(box));}const pictures=[...descendants(n,'blip',DRAWING_NS),...descendants(n,'imagedata',new Set(['urn:schemas-microsoft-com:vml']))];for(const picture of pictures)result.push(await image(n,picture));if(!pictures.length&&!textboxes.length){warn('unsupported_drawing');result.push(await image(n));}return result;}
   if(WORD_NS.has(n.uri)&&n.name==='t')return [{kind:'text',text:n.text}];
   if(WORD_NS.has(n.uri)&&['footnoteReference','endnoteReference'].includes(n.name))return [{kind:'text',text:'['+(n.name==='footnoteReference'?'脚注':'尾注')+(n.attrs.id||'')+']'}];
   if(WORD_NS.has(n.uri)&&['br','cr','tab'].includes(n.name))return [{kind:'text',text:n.name==='tab'?'\t':'\n'}];
   if(WORD_NS.has(n.uri)&&['instrText','fldSimple','sym','altChunk'].includes(n.name))warn('field_or_symbol');
   if(n.name==='AlternateContent'&&n.uri===MC_NS){warn('alternate_content');const chosen=child(n,'Fallback')||child(n,'Choice');return chosen?inlines(chosen):[];}
   if(!WORD_NS.has(n.uri)&&!MATH_NS.has(n.uri)&&n.uri!==MC_NS){warn('unsupported_structure');return [];}
   const result:WordInline[]=[];for(const c of n.children)result.push(...await inlines(c));if(WORD_NS.has(n.uri)&&n.name==='p')result.push({kind:'text',text:'\n'});return result;
  }
  /** Expand legal row/cell containers, never descendants of a nested table. */
  function tableChildren(n:WordNode,name:'tr'|'tc'):WordNode[]{
   const result:WordNode[]=[];
   for(const c of n.children){
    if(c.uri===MC_NS&&c.name==='AlternateContent'){warn('alternate_content');const selected=child(c,'Fallback')||child(c,'Choice');if(selected)result.push(...tableChildren(selected,name));continue;}
    if(!WORD_NS.has(c.uri))continue;
    if(['del','moveFrom'].includes(c.name)){warn('tracked_changes');continue;}
    if(c.name===name){const properties=child(c,name==='tr'?'trPr':'tcPr');if(properties&&child(properties,name==='tr'?'del':'cellDel')){warn('tracked_changes');continue;}result.push(c);continue;}
    if(['sdt','sdtContent','customXml','ins','moveTo'].includes(c.name)){if(['ins','moveTo'].includes(c.name))warn('tracked_changes');result.push(...tableChildren(c,name));}
   }return result;
  }
  async function blocks(n:WordNode):Promise<WordBlock[]>{
   if(['footnote','endnote'].includes(n.name)&&Number(n.attrs.id)<=0)return [];
   if(n.name==='del'||n.name==='moveFrom'){warn('tracked_changes');return [];}
   if(WORD_NS.has(n.uri)&&['ins','moveTo'].includes(n.name))warn('tracked_changes');
   const anchor={part,path:n.path},id='wb_'+sha(part+'\0'+n.path).slice(0,32);
   if(WORD_NS.has(n.uri)&&n.name==='p'){
    if(++blockCount>20000)throw Error('too_large');
    const parentWarnings=activeWarnings,localWarnings=new Set<string>();activeWarnings=localWarnings;
    try{
     const values=await inlines(n),joined:WordInline[]=[];for(const v of values){const last=joined.at(-1);if(v.kind==='text'&&last?.kind==='text')last.text+=v.text;else joined.push(v);}const numbering=number(n);
     return [{kind:'paragraph',id,anchor,inlines:joined,warnings:[...localWarnings],...(numbering?{numbering}:{})}];
    }finally{activeWarnings=parentWarnings;}
   }
   if(WORD_NS.has(n.uri)&&n.name==='tbl'){
    if(++blockCount>20000)throw Error('too_large');
    const parentWarnings=activeWarnings,localWarnings=new Set<string>();activeWarnings=localWarnings;
    try{
     const rows:Array<{cells:Array<{colSpan:number;merge:''|'restart'|'continue';blocks:WordBlock[]}>}>=[];
     for(const row of tableChildren(n,'tr')){const cells:typeof rows[number]['cells']=[];for(const c of tableChildren(row,'tc')){const pr=child(c,'tcPr'),colSpan=Number(pr&&child(pr,'gridSpan')?.attrs.val||1),vm=pr&&child(pr,'vMerge');if(colSpan<1||colSpan>128||!Number.isSafeInteger(colSpan))throw Error('parse_failed');if(vm)warn('merged_table');cells.push({colSpan,merge:vm?vm.attrs.val==='restart'?'restart':'continue':'',blocks:await blocks(c)});}rows.push({cells});}
     return [{kind:'table',id,anchor,rows,warnings:[...localWarnings]}];
    }finally{activeWarnings=parentWarnings;}
   }
   if(n.name==='AlternateContent'&&n.uri===MC_NS){warn('alternate_content');const chosen=child(n,'Fallback')||child(n,'Choice');return chosen?blocks(chosen):[];}
   if(n.name==='altChunk'){warn('external_content');return [];}
   if(!WORD_NS.has(n.uri)&&n.uri!==MC_NS){warn('unsupported_structure');return [];}
   const result:WordBlock[]=[];for(const c of n.children)result.push(...await blocks(c));return result;
  }
  return blocks(root);
 }
 const blocks=await parsePart(main);
 const visited=new Set([main]);for(const relation of mainRelations.values())if(!relation.external&&!visited.has(relation.target)&&['/header','/footer','/footnotes','/endnotes'].some(t=>relation.type.endsWith(t))){visited.add(relation.target);const extra=await parsePart(relation.target);if(extra.length){warn('supplemental_part');blocks.push(...extra);}}
 const document={schemaVersion:WORD_SCHEMA,parser:WORD_PARSER,blocks,assets,warnings:[...warnings],unscopedWarnings:[...unscopedWarnings]};if(!validWordDocument(document))throw Error('too_large');return {document,images};
}

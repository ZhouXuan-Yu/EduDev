import {materialId} from './materials';
import {METAFILE_READ_ENGINES,WORD_IMAGE_POLICY,WORD_IMAGE_LEGACY_POLICY,type MetafileReadEngine} from './material-metafile';
import {WORD_DRAWING_POLICY,WORD_DRAWING_LEGACY_POLICY,WORD_DRAWING_ERRORS,validWordDrawingProof,validWordDrawingRequest,type WordDrawingProof,type WordDrawingRequest,type WordOfficeProgress} from './material-word-drawing';
export const WORD_SCHEMA='xiaozhi.word-source.v1' as const;
export const WORD_PARSER='word-ooxml.v2' as const;
export const WORD_LEGACY_PARSER='word-ooxml.v1' as const;
export const WORD_BOOKLET_QUESTION_POLICY='word-question-booklet.v3' as const;
export const WORD_PREAMBLE_LEGACY_QUESTION_POLICY='word-question-preamble.v4' as const;
export const WORD_PREAMBLE_QUESTION_POLICY='word-question-preamble.v5' as const;
export type WordQuestionPolicy=typeof WORD_BOOKLET_QUESTION_POLICY|typeof WORD_PREAMBLE_QUESTION_POLICY|typeof WORD_PREAMBLE_LEGACY_QUESTION_POLICY;
export const isWordPreamblePolicy=(value:unknown)=>value===WORD_PREAMBLE_QUESTION_POLICY||value===WORD_PREAMBLE_LEGACY_QUESTION_POLICY;
export const isWordBookletPolicy=(value:unknown):value is WordQuestionPolicy=>value===WORD_BOOKLET_QUESTION_POLICY||isWordPreamblePolicy(value);
export type WordParser=typeof WORD_PARSER|typeof WORD_LEGACY_PARSER;
export const isWordParser=(value:unknown):value is WordParser=>value===WORD_PARSER||value===WORD_LEGACY_PARSER;
export const WORD_INPUT=50*1024*1024;
export const WORD_TEXT=8*1024*1024;
export const WORD_IMAGES=64*1024*1024;
export type WordAnchor={part:string;path:string};
export type WordInline={kind:'text';text:string}|{kind:'formula';latex:string;omml:string;complete:boolean}|{kind:'image';assetId:string;alt:string;issue:string;relationshipId:string;part:string;metafile?:{sha256:string;engine:MetafileReadEngine};drawing?:WordDrawingProof};
export type WordBlock=({id:string;anchor:WordAnchor;kind:'paragraph';inlines:WordInline[];numbering?:{level:number;label:string}}|{id:string;anchor:WordAnchor;kind:'table';rows:Array<{cells:Array<{colSpan:number;merge:''|'restart'|'continue';blocks:WordBlock[]}>}>})&{warnings?:string[]};
export type WordAsset={id:string;sha256:string;mime:'image/png'|'image/jpeg'|'image/webp';bytes:number;width:number;height:number;part:string};
export type WordDocument={schemaVersion:typeof WORD_SCHEMA;parser:WordParser;blocks:WordBlock[];assets:WordAsset[];warnings:string[];unscopedWarnings?:string[];questionPolicy?:WordQuestionPolicy;imagePolicy?:typeof WORD_IMAGE_POLICY|typeof WORD_IMAGE_LEGACY_POLICY;drawingPolicy?:typeof WORD_DRAWING_POLICY|typeof WORD_DRAWING_LEGACY_POLICY};
export type WordMetafile={part:string;sha256:string;data:Uint8Array};
export type WordPayload={document:WordDocument;images:Array<{id:string;data:Uint8Array}>;metafiles?:WordMetafile[];drawings?:WordDrawingRequest[]};
export type WordRequest={schemaVersion:typeof WORD_SCHEMA;requestId:string;bytes:Uint8Array};
export type WordResult={schemaVersion:typeof WORD_SCHEMA;requestId:string;ok:true;payload:WordPayload}|{schemaVersion:typeof WORD_SCHEMA;requestId:string;ok:false;error:'invalid_input'|'too_large'|'parse_failed'|'cancelled'|'timeout'|'busy'|'unavailable'};
export type WordQuery={schemaVersion:typeof WORD_SCHEMA;resourceId:string;version:string;offset:number};
export type WordPage={schemaVersion:typeof WORD_SCHEMA;resourceId:string;version:string;parser:WordParser;offset:number;total:number;hasMore:boolean;blocks:WordBlock[];assets:WordAsset[];warnings:string[]};
export type WordImageQuery={schemaVersion:typeof WORD_SCHEMA;resourceId:string;version:string;assetId:string};
export type WordImageView={asset:WordAsset;dataUrl:string};
export type WordRebuild={schemaVersion:typeof WORD_SCHEMA;resourceId:string;version:string};
export type WordRebuildView=WordRebuild&{jobId:string;status:'idle'|'running'|'complete'|'cancelled'|'failed';error:string;component?:WordOfficeProgress};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const string=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length<=n;
const part=(v:unknown):v is string=>string(v,512)&&!!v&&!v.includes('..')&&!v.startsWith('/')&&!/[\\\x00-\x1f]/.test(v);
export function validWordRequest(v:unknown):v is WordRequest{return obj(v)&&Object.keys(v).length===3&&v.schemaVersion===WORD_SCHEMA&&typeof v.requestId==='string'&&/^word_[a-f0-9-]{36}$/.test(v.requestId)&&v.bytes instanceof Uint8Array&&v.bytes.length>0&&v.bytes.length<=WORD_INPUT;}
export function validWordDocument(v:unknown):v is WordDocument{
 if(!obj(v)||v.schemaVersion!==WORD_SCHEMA||!isWordParser(v.parser)||!Array.isArray(v.assets)||v.assets.length>512||!Array.isArray(v.blocks)||v.blocks.length>20000||!Array.isArray(v.warnings)||v.warnings.length>64||!v.warnings.every(x=>string(x,120)))return false;
 const documentWarnings=v.warnings,imagePolicy=v.imagePolicy;
 const knownImagePolicy=imagePolicy===WORD_IMAGE_POLICY||imagePolicy===WORD_IMAGE_LEGACY_POLICY;
 if(v.questionPolicy!==undefined&&(!isWordBookletPolicy(v.questionPolicy)||v.parser!==WORD_PARSER||v.unscopedWarnings===undefined))return false;
 if(imagePolicy!==undefined&&(!knownImagePolicy||v.parser!==WORD_PARSER))return false;
 if(v.drawingPolicy!==undefined&&(![WORD_DRAWING_POLICY,WORD_DRAWING_LEGACY_POLICY].includes(v.drawingPolicy as typeof WORD_DRAWING_POLICY)||v.parser!==WORD_PARSER))return false;
 if(v.unscopedWarnings!==undefined&&(v.parser!==WORD_PARSER||!Array.isArray(v.unscopedWarnings)||v.unscopedWarnings.length>64||!v.unscopedWarnings.every(x=>string(x,120)&&documentWarnings.includes(x))))return false;
 const ids=new Set<string>(),blockIds=new Set<string>();let bytes=0,text=0,count=0,inlines=0;
 for(const a of v.assets){if(!obj(a)||!hash(a.sha256)||a.id!=='wa_'+a.sha256||ids.has(String(a.id))||!part(a.part)||!['image/png','image/jpeg','image/webp'].includes(String(a.mime))||!Number.isSafeInteger(a.bytes)||Number(a.bytes)<=0||Number(a.bytes)>8*1024*1024||!Number.isSafeInteger(a.width)||!Number.isSafeInteger(a.height)||Number(a.width)<1||Number(a.height)<1||Number(a.width)>10000||Number(a.height)>10000||Number(a.width)*Number(a.height)>40000000)return false;ids.add(String(a.id));bytes+=Number(a.bytes);}
 if(bytes>WORD_IMAGES)return false;
 function blocks(list:unknown[],depth:number):boolean{
  if(depth>24)return false;
  for(const b of list){if(++count>20000||!obj(b)||typeof b.id!=='string'||!/^wb_[a-f0-9]{32}$/.test(b.id)||blockIds.has(b.id)||!obj(b.anchor)||!part(b.anchor.part)||!string(b.anchor.path,1500)||!b.anchor.path.startsWith('/'))return false;blockIds.add(b.id);
   if(b.warnings!==undefined&&(!Array.isArray(b.warnings)||b.warnings.length>64||!b.warnings.every(x=>string(x,120))))return false;
   if(b.kind==='paragraph'){
    if(!Array.isArray(b.inlines)||(inlines+=b.inlines.length)>50000)return false;
    if(b.numbering!==undefined&&(!obj(b.numbering)||!Number.isSafeInteger(b.numbering.level)||Number(b.numbering.level)<0||Number(b.numbering.level)>8||!string(b.numbering.label,128)))return false;
    for(const i of b.inlines){if(!obj(i))return false;if(i.kind==='text'){if(!string(i.text,WORD_TEXT))return false;text+=i.text.length;}
     else if(i.kind==='formula'){if(!string(i.latex,32000)||!string(i.omml,128000)||typeof i.complete!=='boolean')return false;text+=i.latex.length+i.omml.length;}
     else if(i.kind==='image'){if(!string(i.assetId,67)||i.assetId&&!ids.has(i.assetId)||!string(i.alt,2000)||!string(i.issue,120)||!string(i.relationshipId,256)||!string(i.part,512)||i.part&&!part(i.part))return false;
      if(i.metafile!==undefined){
       if(!obj(i.metafile)||Object.keys(i.metafile).length!==2||!hash(i.metafile.sha256)||!knownImagePolicy||!i.part)return false;
       if(!METAFILE_READ_ENGINES.includes(i.metafile.engine as MetafileReadEngine))return false;
       if(i.assetId&&i.issue)return false;
       if(!i.assetId&&!['metafile_empty','metafile_font_missing','metafile_too_large','metafile_invalid_input','metafile_parse_failed'].includes(i.issue))return false;
      }
      if(i.drawing!==undefined&&(!validWordDrawingProof(i.drawing)||i.metafile!==undefined||i.part!=='word/document.xml'||i.relationshipId!==''||i.assetId&&i.issue||!i.assetId&&!['drawing_render_required',...WORD_DRAWING_ERRORS.map(error=>'drawing_'+error)].includes(i.issue)))return false;
      text+=i.alt.length;}
     else return false;
    }
   }else if(b.kind==='table'){
    if(!Array.isArray(b.rows)||b.rows.length>10000)return false;
    for(const row of b.rows){if(!obj(row)||!Array.isArray(row.cells)||row.cells.length>128)return false;for(const c of row.cells)if(!obj(c)||!Number.isSafeInteger(c.colSpan)||Number(c.colSpan)<1||Number(c.colSpan)>128||!['','restart','continue'].includes(String(c.merge))||!Array.isArray(c.blocks)||!blocks(c.blocks,depth+1))return false;}
   }else return false;
   if(text>WORD_TEXT)return false;
  }return true;
 }
 return blocks(v.blocks,0);
}
export function validWordResult(v:unknown,id:string):v is WordResult{
 if(!obj(v)||v.schemaVersion!==WORD_SCHEMA||v.requestId!==id)return false;
 if(v.ok===false)return typeof v.error==='string'&&['invalid_input','too_large','parse_failed','cancelled','timeout','busy','unavailable'].includes(v.error);
 if(v.ok!==true||!obj(v.payload)||!validWordDocument(v.payload.document)||!Array.isArray(v.payload.images)||v.payload.images.length!==v.payload.document.assets.length)return false;
 if(v.payload.drawings!==undefined&&(!Array.isArray(v.payload.drawings)||v.payload.drawings.length>128||!v.payload.drawings.every(validWordDrawingRequest)||new Set(v.payload.drawings.map(item=>item.sha256)).size!==v.payload.drawings.length))return false;
 if(v.payload.metafiles!==undefined){
  if(!Array.isArray(v.payload.metafiles)||v.payload.metafiles.length>512)return false;
  const parts=new Set<string>();let size=0;
  for(const media of v.payload.metafiles){if(!obj(media)||!part(media.part)||parts.has(media.part)||!hash(media.sha256)||!(media.data instanceof Uint8Array)||media.data.length<18||media.data.length>8*1048576)return false;parts.add(media.part);size+=media.data.length;}
  if(size>WORD_IMAGES)return false;
 }
 const images=new Map(v.payload.images.map((x:unknown)=>obj(x)&&typeof x.id==='string'&&x.data instanceof Uint8Array?[x.id,x.data]:['',undefined]));
 return images.size===v.payload.images.length&&v.payload.document.assets.every(a=>images.get(a.id)?.length===a.bytes);
}
export function validWordQuery(v:unknown):v is WordQuery{return obj(v)&&Object.keys(v).length===4&&v.schemaVersion===WORD_SCHEMA&&materialId(v.resourceId)&&hash(v.version)&&Number.isSafeInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=20000;}
export function validWordImageQuery(v:unknown):v is WordImageQuery{return obj(v)&&Object.keys(v).length===4&&v.schemaVersion===WORD_SCHEMA&&materialId(v.resourceId)&&hash(v.version)&&typeof v.assetId==='string'&&/^wa_[a-f0-9]{64}$/.test(v.assetId);}
export function validWordRebuild(v:unknown):v is WordRebuild{return obj(v)&&Object.keys(v).length===3&&v.schemaVersion===WORD_SCHEMA&&materialId(v.resourceId)&&hash(v.version);}
export function wordText(blocks:WordBlock[]):string{return blocks.map(b=>b.kind==='paragraph'?(b.numbering?.label||'')+b.inlines.map(i=>i.kind==='text'?i.text:i.kind==='formula'?i.complete?' $'+i.latex+'$ ':' [原式待核对：'+i.latex+'] ':' [原文插图'+(i.alt?'：'+i.alt:'')+'] ').join(''):b.rows.map(r=>r.cells.map(c=>wordText(c.blocks)).join(' | ')).join('\n')).join('\n\n');}

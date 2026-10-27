import {materialId} from './materials';
import {WORD_QUESTION_ROLES,WORD_QUESTION_ISSUES,type WordQuestionIssue,type WordQuestionSource,type WordQuestionRole} from './material-word-question';
export const WORD_PROOF_SCHEMA='xiaozhi.word-question-proof.v1' as const;
export const WORD_PROOF_RENDERER='word-layout.v1' as const;
export const WORD_PROOF_WIDTH=1240;
export const WORD_PROOF_HEIGHT=1760;
export type WordProofEnvironment={renderer:typeof WORD_PROOF_RENDERER;fontDigest:string;engine:string;scale:1;width:typeof WORD_PROOF_WIDTH;pageHeight:typeof WORD_PROOF_HEIGHT};
export type WordProofCoverage={span:number;blockId:string;kind:'paragraph'|'row';row?:number;top:number;bottom:number;text:string};
export type WordProofPage={role:WordQuestionRole;index:number;top:number;width:typeof WORD_PROOF_WIDTH;height:number;bytes:number;sha256:string;assetId:string;coverage:WordProofCoverage[]};
export type WordProofBase={schemaVersion:typeof WORD_PROOF_SCHEMA;resourceId:string;version:string;ordinal:number;documentSha:string};
export type WordProofInput=WordProofBase&{requestId:string};
export type WordProofImageQuery=WordProofBase&{proofId:string;role:WordQuestionRole;index:number};
export type WordProofCancel={schemaVersion:typeof WORD_PROOF_SCHEMA;requestId:string};
export type WordProof=WordProofBase&{proofId:string;sourceDigest:string;environment:WordProofEnvironment;issues:WordQuestionIssue[];pages:WordProofPage[]};
export type WordProofImage={page:WordProofPage;dataUrl:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[],optional:string[]=[]):v is Record<string,unknown>=>obj(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const baseKeys=['schemaVersion','resourceId','version','ordinal','documentSha'];
const base=(v:unknown):boolean=>obj(v)&&v.schemaVersion===WORD_PROOF_SCHEMA&&materialId(v.resourceId)&&hash(v.version)&&hash(v.documentSha)&&integer(v.ordinal,1,10000);
export const wordProofRequestId=(v:unknown):v is string=>typeof v==='string'&&/^wqproof_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export function validWordProofInput(v:unknown):v is WordProofInput{return exact(v,[...baseKeys,'requestId'])&&base(v)&&wordProofRequestId(v.requestId);}
export function validWordProofCancel(v:unknown):v is WordProofCancel{return exact(v,['schemaVersion','requestId'])&&v.schemaVersion===WORD_PROOF_SCHEMA&&wordProofRequestId(v.requestId);}
export function validWordProofImageQuery(v:unknown):v is WordProofImageQuery{return exact(v,[...baseKeys,'proofId','role','index'])&&base(v)&&hash(v.proofId)&&WORD_QUESTION_ROLES.includes(v.role as WordQuestionRole)&&integer(v.index,0,7);}
export function validWordProofEnvironment(v:unknown):v is WordProofEnvironment{return exact(v,['renderer','fontDigest','engine','scale','width','pageHeight'])&&v.renderer===WORD_PROOF_RENDERER&&hash(v.fontDigest)&&typeof v.engine==='string'&&/^[a-zA-Z0-9.:-]{1,128}$/.test(v.engine)&&v.scale===1&&v.width===WORD_PROOF_WIDTH&&v.pageHeight===WORD_PROOF_HEIGHT;}
export function validWordProof(value:unknown,source?:WordQuestionSource):value is WordProof{
 if(!exact(value,[...baseKeys,'proofId','sourceDigest','environment','issues','pages'])||!base(value)||!hash(value.proofId)||!hash(value.sourceDigest)||!validWordProofEnvironment(value.environment)||!Array.isArray(value.issues)||value.issues.length>WORD_QUESTION_ISSUES.length||new Set(value.issues).size!==value.issues.length||!value.issues.every(i=>WORD_QUESTION_ISSUES.includes(i))||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>8)return false;
 if(source&&(value.documentSha!==source.documentSha||value.ordinal!==source.ordinal||JSON.stringify(value.issues)!==JSON.stringify(source.issues)))return false;
 const seen=new Set<string>();let totalBytes=0,pixels=0,text=0,previousRole=-1;const positions=new Map<string,{index:number;end:number}>();
 for(const p of value.pages){
  if(!exact(p,['role','index','top','width','height','bytes','sha256','assetId','coverage'])||!WORD_QUESTION_ROLES.includes(p.role as WordQuestionRole)||!integer(p.index,0,7)||!integer(p.top,0,WORD_PROOF_HEIGHT*8)||p.width!==WORD_PROOF_WIDTH||!integer(p.height,1,WORD_PROOF_HEIGHT)||!integer(p.bytes,57,4*1048576)||!hash(p.sha256)||typeof p.assetId!=='string'||!/^asset_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.assetId)||!Array.isArray(p.coverage)||p.coverage.length>4000)return false;
  const role=WORD_QUESTION_ROLES.indexOf(p.role as WordQuestionRole),prior=positions.get(String(p.role));if(role<previousRole||p.index!==(prior?prior.index+1:0)||p.top!==(prior?.end??0))return false;previousRole=role;positions.set(String(p.role),{index:p.index,end:p.top+p.height});
  totalBytes+=p.bytes;pixels+=WORD_PROOF_WIDTH*p.height;if(totalBytes>16*1048576||pixels>32000000)return false;
  for(const c of p.coverage){
   if(!exact(c,['span','blockId','kind','top','bottom','text'],['row'])||!integer(c.span,0,63)||typeof c.blockId!=='string'||!/^wb_[a-f0-9]{32}$/.test(c.blockId)||!['paragraph','row'].includes(String(c.kind))||!integer(c.top,p.top,p.top+p.height)||!integer(c.bottom,c.top,p.top+p.height)||typeof c.text!=='string'||(text+=c.text.length)>64000||(c.kind==='row'?!integer(c.row,0,10000):c.row!==undefined))return false;
   const key=p.role+':'+c.span+':'+c.kind+':'+(c.row??'');if(seen.has(key))return false;seen.add(key);
   if(source){
    const span=source.parts[p.role as WordQuestionRole][c.span],block=source.blocks.find(b=>b.id===c.blockId);
    if(!span||span.blockId!==c.blockId||!block)return false;
    if(block.kind==='table'){if(c.kind!=='row'||!integer(c.row,0,block.rows.length-1))return false;}else if(c.kind!=='paragraph')return false;
   }
  }
 }
 if(source){for(const role of WORD_QUESTION_ROLES){if(!!source.parts[role].length!==positions.has(role))return false;for(const [index,span]of source.parts[role].entries()){const b=source.blocks.find(b=>b.id===span.blockId);if(!b)return false;if(b.kind==='table'){for(let row=0;row<b.rows.length;row++)if(!seen.has(role+':'+index+':row:'+row))return false;}else if(!seen.has(role+':'+index+':paragraph:'))return false;}}}
 return positions.has('question')&&new TextEncoder().encode(JSON.stringify(value)).byteLength<=256*1024;
}

import {isWordBookletPolicy} from '../../shared/material-word';
import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import {NATIVE_QUESTION_ROLES,type NativeQuestionRole} from '../../shared/native-question';
import type {WordProof} from '../../shared/material-word-proof';
import {WORD_SCOPED_QUESTION_POLICY,type WordQuestionSource} from '../../shared/material-word-question';
import {nativeSourceRoleText} from './native-question-content';
export type NativeAiContext={schemaVersion:'xiaozhi.native-ai-context.v1';cleanVersion:'student-context-sanitizer.v1';number:string;roles:Record<NativeQuestionRole,string>;
 metadata?:Record<string,string>;
 ocr:{role:NativeQuestionRole;index:number;sha256:string;engine:typeof LOCAL_OCR_ENGINE;text:string}[]};
export function validNativeAiContext(value:unknown,source:WordQuestionSource,proof:WordProof):value is NativeAiContext{
 try{
  const v=value as NativeAiContext;
  if(!v||Object.keys(v).sort().join(',')!==(v.metadata===undefined?'cleanVersion,number,ocr,roles,schemaVersion':'cleanVersion,metadata,number,ocr,roles,schemaVersion')||v.metadata!==undefined&&JSON.stringify(v.metadata)!==JSON.stringify(nativeMetadata(source))||v.schemaVersion!=='xiaozhi.native-ai-context.v1'||v.cleanVersion!=='student-context-sanitizer.v1'||v.number!==source.number||!v.roles||Object.keys(v.roles).sort().join(',')!=='analysis,answer,question'||!NATIVE_QUESTION_ROLES.every(r=>v.roles[r]===nativeSourceRoleText(source,r))||!Array.isArray(v.ocr)||v.ocr.length!==proof.pages.length||Buffer.byteLength(JSON.stringify(v))>64000)return false;
  return v.ocr.every((o,i)=>{const p=proof.pages[i];return !!o&&Object.keys(o).sort().join(',')==='engine,index,role,sha256,text'&&o.role===p.role&&o.index===p.index&&o.sha256===p.sha256&&o.engine===LOCAL_OCR_ENGINE&&typeof o.text==='string'&&o.text.length<=12000&&!o.text.includes('\0');});
 }catch{return false;}
}
/** Explicit classification and versioned document context, excluding neighbouring questions. */
export function nativeMetadata(source:WordQuestionSource){
 const result:Record<string,string>={};
 for(const line of source.context.split('\n')){
  const match=line.trim().match(/^(学科|科目|年级|知识点|题型|难度)[：:]\s*([^\r\n]{1,128})$/u);
  if(match)result[match[1]]=match[2].trim();
 }
 if((source.indexPolicy===WORD_SCOPED_QUESTION_POLICY||isWordBookletPolicy(source.indexPolicy))&&source.context)result['资料上下文']=source.context;
 return result;
}

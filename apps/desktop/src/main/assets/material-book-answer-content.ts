import {MATERIAL_BOOK_ANSWER_SCHEMA,type BookAnswerEntry,type BookAnswerIssue,type BookAnswerPage} from '../../shared/material-book-answer';
import type {AiPageResponse} from '../../shared/material-ai-page';
import {aiTextSignature} from '../../shared/material-ai-image';
import {nonQuestionPagePurpose} from './material-page-purpose';

type Entry=Omit<BookAnswerEntry,'first'|'agrees'|'issues'>&{issues:BookAnswerIssue[]};
/** Only layout separators normalize in titles. Different chapter/test words never fuzzy-match. */
export const bookSectionKey=(text:string)=>text.normalize('NFKC').replace(/[\s·•]/gu,'');
const title=(text:string)=>text.length<=200&&/^(?:第[一二三四五六七八九十百零〇\d、，,]+(?:章|单元|课|节)|专项|期中|期末|中考|单元|基础|素养|综合|能力).*(?:测试卷|训练卷|练习卷|检测卷|模拟卷|单元测验)(?:[（(][一二三四五六七八九十\d]+[）)])?$/.test(text);
function roles(body:string){
 const letters=/^([A-D]{1,4})(?:[.、．\s]+|(?=[\u4e00-\u9fff（(])|$)/.exec(body);
 if(letters)return{answer:letters[1],analysis:body.slice(letters[0].length).replace(/^(?:解析|分析|解答)\s*[:：]?\s*/,'').trim()};
 const marker=/(?:^|\n)\s*(?:解析|分析|解答)\s*[:：]?\s*/m.exec(body);
 const answer=(marker?body.slice(0,marker.index):/^答案\s*[:：]?/.test(body)?body:'').replace(/^答案\s*[:：]?\s*/,'').trim();
 return{answer,analysis:marker?body.slice(marker.index+marker[0].length).trim():''};
}
/** Deterministic derived spans into the stored transcript; never supplies missing text or solves a problem. */
function entries(text:string):Entry[]{
 if(nonQuestionPagePurpose(text))return[];
 const lines=[...text.matchAll(/[^\n]+(?:\n|$)/g)];let section='',previous='',open:{start:number;bodyStart:number;section:string;number:string}|undefined;const out:Entry[]=[];
 const finish=(end:number,last=false)=>{if(!open)return;const body=text.slice(open.bodyStart,end).trim(),value=roles(body),issues:BookAnswerIssue[]=[];
  if(!open.section)issues.push('missing_section');if(!value.answer)issues.push('missing_answer');if(!value.analysis)issues.push('missing_analysis');
  if(last&&value.analysis&&!/[。.!！?？；;）)\]}]$/.test(body))issues.push('cross_page');
  out.push({...value,quote:text.slice(open.start,end).trim(),section:open.section,sectionKey:bookSectionKey(open.section),number:open.number,start:open.start,end,issues});open=undefined;
 };
 for(const line of lines){if(out.length>200)return out;const raw=line[0].replace(/\n$/,''),value=raw.replace(/^\s*#{1,6}\s*/,'').trim(),at=line.index!;
  // A title is a whole short line, not a reference to another test inside an analysis paragraph.
  if(title(value)&&value.length<=100&&!/[。！？?]/.test(value)){
   finish(at);section=/^第[一二三四五六七八九十百零〇\d、，,]+章$/.test(previous)?previous+' '+value:value;previous=value;continue;
  }
  const numbered=/^\s{0,3}(?:第(\d{1,5})题\s*[:：]?|(\d{1,5})[.、．](?!\d))\s*/.exec(raw);
  if(numbered){finish(at);open={start:at,bodyStart:at+numbered[0].length,section,number:numbered[1]||numbered[2]};}
  previous=value;
 }
 finish(text.length,true);const counts=new Map<string,number>();for(const e of out){const k=e.sectionKey+'\0'+e.number;counts.set(k,(counts.get(k)||0)+1);}for(const e of out)if(counts.get(e.sectionKey+'\0'+e.number)!>1)e.issues.push('duplicate_number');return out;
}
export function bookAnswerPage(first:AiPageResponse,final:AiPageResponse):BookAnswerPage{
 const base:Omit<BookAnswerPage,'status'>={schemaVersion:MATERIAL_BOOK_ANSWER_SCHEMA,policy:'section-number-two-pass.v1',pageUncertain:!!(first.pageIssues.length||final.pageIssues.length),entries:[],firstOnly:[]};
 if(Buffer.byteLength(first.pageText)>64000||Buffer.byteLength(final.pageText)>64000)return{...base,status:'too_large'};
 const a=entries(first.pageText),b=entries(final.pageText);if(a.length>200||b.length>200)return{...base,status:'too_large'};
 const key=(e:Entry)=>e.sectionKey+'\0'+e.number,groups=new Map<string,Entry[]>();for(const e of a)groups.set(key(e),[...(groups.get(key(e))||[]),e]);
 const compared=b.map(e=>{const candidates=groups.get(key(e))||[],prior=candidates.length===1?candidates[0]:undefined,agrees=!!prior&&!e.issues.includes('duplicate_number')&&!prior.issues.includes('duplicate_number')&&aiTextSignature(prior.answer)===aiTextSignature(e.answer)&&aiTextSignature(prior.analysis)===aiTextSignature(e.analysis);
  const issues=[...e.issues,...(prior?.issues||[])];if(!agrees)issues.push('transcription_disagreement');if(base.pageUncertain)issues.push('page_uncertainty');return{...e,...(prior?{first:{answer:prior.answer,analysis:prior.analysis,quote:prior.quote}}:{}),agrees,issues:[...new Set(issues)]};
 });
 return{...base,entries:compared,firstOnly:a.filter(e=>!b.some(f=>key(f)===key(e))).map(e=>({section:e.section,number:e.number})),status:b.length||a.length?'compared':'unstructured'};
}

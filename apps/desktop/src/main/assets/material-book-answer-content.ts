import {MATERIAL_BOOK_ANSWER_SCHEMA,bookSectionKey,type BookAnswerEntry,type BookAnswerIssue,type BookAnswerPage} from '../../shared/material-book-answer';
import {MATERIAL_AI_BOOK_PAGE_RESPONSE,MATERIAL_BOOK_PAGE_CONTINUED_TABLE_POLICY,MATERIAL_BOOK_PAGE_LABEL_POLICY,MATERIAL_BOOK_PAGE_TABLE_POLICY,pageTranscriptionAgrees,type AiPageResponse,type MaterialBookPagePolicy} from '../../shared/material-ai-page';
import {aiTextSignature} from '../../shared/material-ai-image';
import {nonQuestionPagePurpose} from './material-page-purpose';
import type {AiIssue} from '../../shared/material-ai';
import {shanghaiMockSectionBoundary,shanghaiMockSectionKey,startsWrappedShanghaiMockHeading,wrappedShanghaiMockHeading,type ShanghaiMockSectionPolicy} from '../../shared/shanghai-mock-sections';

type Entry=Omit<BookAnswerEntry,'first'|'agrees'|'issues'>&{issues:BookAnswerIssue[]};
/** Only layout separators normalize in titles. Different chapter/test words never fuzzy-match. */
export {bookSectionKey} from '../../shared/material-book-answer';
/** A title-only review can be projected as resolved; content doubts never qualify. */
export function bookAnswerSectionReviewResolved(first:AiPageResponse,final:AiPageResponse,derived:BookAnswerPage,policy?:MaterialBookPagePolicy,mockTitles:ShanghaiMockSectionPolicy=false){
 const raw=bookAnswerPage(first,final,undefined,policy,mockTitles);
 return first.outcome==='no_questions'&&final.outcome==='no_questions'&&!first.questions.length&&!final.questions.length&&pageTranscriptionAgrees(first,final)
  &&raw.status==='compared'&&!raw.unresolvedTables&&!derived.unresolvedTables&&!raw.pageUncertain&&!raw.firstOnly.length&&raw.entries.some(e=>e.issues.includes('missing_section'))
  &&raw.entries.every(e=>e.agrees&&e.issues.every(i=>i==='missing_section'||i==='missing_analysis'))
  &&derived.policy==='section-number-inherited.v1'&&derived.status==='compared'&&!derived.pageUncertain&&!derived.firstOnly.length&&derived.entries.length===raw.entries.length
  &&derived.entries.every(e=>e.agrees&&!!e.section&&e.issues.every(i=>i==='missing_analysis'));
}
const title=(text:string)=>text.length<=200&&/^(?:第[一二三四五六七八九十百零〇\d、，,]+(?:章|单元|课|节)|专项|期中|期末|中考|单元|基础|素养|综合|能力).*(?:测试卷|训练卷|练习卷|检测卷|模拟卷|单元测验)(?:[（(][一二三四五六七八九十\d]+[）)])?$/.test(text);
const chapter=(text:string)=>/^第[一二三四五六七八九十百零〇\d、，,]+章$/.test(text);
const headingText=(raw:string)=>raw.replace(/^\s*#{1,6}\s*/,'').trim();
function* bookLines(text:string,mockTitles:ShanghaiMockSectionPolicy){
 const lines=[...text.matchAll(/[^\n]+(?:\n|$)/g)];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],value=headingText(line[0]);
  let last=line;
  let heading:string|undefined;
  if(startsWrappedShanghaiMockHeading(value,mockTitles)){
   const adjacent=[value];
   for(const next of lines.slice(i+1,i+3)){
    if(next.index!==last.index!+last[0].length)break;
    adjacent.push(headingText(next[0]));
    last=next;
   }
   const wrapped=wrappedShanghaiMockHeading(adjacent,mockTitles);
   last=lines[i+(wrapped?.count??1)-1];
   if(wrapped){heading=wrapped.title;i+=wrapped.count-1;}
  }
  yield {raw:line[0],value,heading,at:line.index!,end:last.index!+last[0].length};
 }
}
function sectionBoundary(value:string,previous:string,mockTitles:ShanghaiMockSectionPolicy=false):string|undefined{
 if(mockTitles&&shanghaiMockSectionKey(value,mockTitles))return value;
 if(mockTitles&&shanghaiMockSectionBoundary(value,mockTitles))return '';
 if(title(value)&&value.length<=100&&!/[。！？?]/.test(value))return chapter(previous)?previous+' '+value:value;
 if(/^(?:第[一二三四五六七八九十百零〇\d、，,]+(?:章|单元|课|节|套|讲)|(?:专项|期中|期末|中考|单元|基础|素养|综合|能力).*?(?:测试|训练|练习|检测|模拟|测验)|(?:试卷|测试卷|训练卷|练习卷|检测卷|模拟卷|单元测验))/.test(value)
  ||value.length<=100&&!/[。！？?]/.test(value)&&/(?:测试卷|训练卷|练习卷|检测卷|模拟卷|单元测验)(?:[（(][一二三四五六七八九十\d]+[）)])?$/.test(value))return '';
 return undefined;
}
/** Undefined means no heading; empty means a visible but unsupported boundary. */
export function bookSectionAt(text:string,end=text.length,mockTitles:ShanghaiMockSectionPolicy=false):string|undefined{
 let section:string|undefined,previous='';
 for(const {at,end:through,value,heading} of bookLines(text,mockTitles)){
  if(at>=end)break;
  if(heading!==undefined&&through>end)return '';
  section=heading??sectionBoundary(value,previous,mockTitles)??section;
  previous=value;
 }
 return section;
}
function roles(body:string){
 const letters=/^([A-D]{1,4})(?:[.、．\s]+|(?=[\u4e00-\u9fff（(])|$)/.exec(body);
 if(letters)return{answer:letters[1],analysis:body.slice(letters[0].length).replace(/^(?:解析|分析|解答)\s*[:：]?\s*/,'').trim()};
 const marker=/(?:^|\n)\s*(?:解析|分析|解答)\s*[:：]?\s*/m.exec(body);
 const answer=(marker?body.slice(0,marker.index):/^答案\s*[:：]?/.test(body)?body:'').replace(/^答案\s*[:：]?\s*/,'').trim();
 return{answer,analysis:marker?body.slice(marker.index+marker[0].length).trim():''};
}

const roleNames='参考答案|参考解析|参考解答|答案|解析|分析|解答|详解|答|解';
const namedRoles=new Set(roleNames.split('|'));
const rolePrefix=new RegExp('(?:【|\\[|［)(?:'+roleNames+')','gu');
const bracketWord='([\\p{Script=Han}]{1,16})';
const printedRoleLabels=new RegExp('【'+bracketWord+'】|\\['+bracketWord+'\\]|［'+bracketWord+'］|^[ \\t\\u3000]*('+roleNames+')[ \\t\\u3000]*[:：]','gmu');

/** Printed role labels are part of a numbered entry, even when the book repeats its stem. */
function printedRoles(body:string):{answer:string;analysis:string;conflict?:true}{
 const prefixes=body.match(rolePrefix);
 if(!prefixes)return roles(body);
 const labels=[...body.matchAll(printedRoleLabels)].map(match=>({
  role:match[1]||match[2]||match[3]||match[4],start:match.index!,end:match.index!+match[0].length,bracketed:!match[4],
 }));
 const conflict={answer:'',analysis:'',conflict:true} as const;
 if(labels.filter(label=>label.bracketed&&namedRoles.has(label.role)).length!==prefixes.length)return conflict;
 const fields=labels.slice(labels.findIndex(label=>namedRoles.has(label.role)));
 if(fields.length>2||fields.some(label=>!namedRoles.has(label.role)))return conflict;
 const [first,second]=fields;
 const isAnswer=(label:typeof first)=>label.role==='答案'||label.role==='参考答案'||label.role==='答';
 const field=(start:typeof first,end?:typeof first)=>body
  .slice(start.end,end?.start).replace(/^[ \t\u3000]*[:：]/u,'').trim();
 const before=body.slice(0,first.start);
 const isolatedLabel=!before.slice(before.lastIndexOf('\n')+1).trim();
 const inlineChoice=/^[A-H]{1,8}$/u.test(before.trim());
 if(!isolatedLabel&&!(inlineChoice&&!isAnswer(first)))return conflict;
 if(!isAnswer(first))return second?conflict:{answer:inlineChoice?before.trim():'',analysis:field(first)};
 if(second&&isAnswer(second))return conflict;
 const answer=field(first,second);
 const refersToAnalysis=/(?:^|[（(）)；;。\s])(?:详见|见)(?:本题)?(?:解析|解答|详解)(?:过程|步骤|部分)?(?=$|[（(）)；;。\s])/u.test(answer);
 return{answer:refersToAnalysis?'':answer,analysis:second?field(second):''};
}
/** Deterministic derived spans into the stored transcript; never supplies missing text or solves a problem. */
function entries(text:string,initialSection?:string,tableBoundaries?:Set<number>,printedLabels=false,mockTitles:ShanghaiMockSectionPolicy=false):Entry[]{
 if(nonQuestionPagePurpose(text))return[];
 let section=initialSection||'',previous='',open:{start:number;bodyStart:number;section:string;number:string}|undefined;const out:Entry[]=[];
 const finish=(end:number,last=false)=>{if(!open)return;const body=text.slice(open.bodyStart,end).trim(),value=(printedLabels?printedRoles:roles)(body),issues:BookAnswerIssue[]=[];
  if('conflict' in value)issues.push('answer_conflict');
  if(!open.section)issues.push('missing_section');if(!value.answer)issues.push('missing_answer');if(!value.analysis)issues.push('missing_analysis');
  if(last&&value.analysis&&!/[。.!！?？；;）)\]}]$/.test(body))issues.push('cross_page');
  out.push({...value,quote:text.slice(open.start,end).trim(),section:open.section,sectionKey:bookSectionKey(open.section),number:open.number,start:open.start,end,issues});open=undefined;
 };
 for(const line of bookLines(text,mockTitles)){if(out.length>200)return out;const raw=line.raw.replace(/\n$/,''),{value,at}=line;
  if(tableBoundaries?.has(at)){finish(at);previous='';continue;}
  // A title is a whole short line, not a reference to another test inside an analysis paragraph.
  const heading=line.heading??sectionBoundary(value,previous,mockTitles);
  if(heading){finish(at);section=heading;previous=value;continue;}
  // Only the new derived-context policy changes boundary handling. Saved raw-page policies keep their meaning.
  if((line.heading!==undefined||initialSection!==undefined||tableBoundaries||mockTitles&&shanghaiMockSectionBoundary(value,mockTitles))&&heading===''){finish(at);section='';previous=value;continue;}
  const numbered=/^\s{0,3}(?:第(\d{1,5})题\s*[:：]?|(\d{1,5})[.、．](?!\d))\s*/.exec(raw);
  if(numbered){finish(at);open={start:at,bodyStart:at+numbered[0].length,section,number:numbered[1]||numbered[2]};}
  previous=value;
 }
 finish(text.length,true);const counts=new Map<string,number>();for(const e of out){const k=e.sectionKey+'\0'+e.number;counts.set(k,(counts.get(k)||0)+1);}for(const e of out)if(counts.get(e.sectionKey+'\0'+e.number)!>1)e.issues.push('duplicate_number');return out;
}
/**
 * Printed two-line answer keys. Use only explicit sections and exact column
 * counts. start indexes the number token, end indexes the end of its letter
 * cell, and quote stays a byte-for-byte slice of the saved source transcript.
 */
// The one-code-unit width conversion keeps every raw source offset intact.
const width=(value:string)=>value.replace(/[０-９Ａ-Ｈ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
function readAnswerKeyTables(text:string,continuation?:{section?:string},mockTitles:ShanghaiMockSectionPolicy=false){
 const lines=[...bookLines(text,mockTitles)].filter(line=>line.raw.trim());
 const accepted:Entry[]=[], boundaries=new Set<number>();
 let unresolved=0,section:string|undefined,previous='',leadingKey=false;
 if(nonQuestionPagePurpose(text))return {accepted,boundaries,unresolved,leadingKey};
 for(let i=0;i<lines.length;i++){
  const {value,heading,at}=lines[i];
  section=heading??sectionBoundary(value,previous,mockTitles)??section;
  previous=value;
  if(heading!==undefined)continue;
  if(!/^(?:答案速查|参考答案|选择题答案)\s*[:：]?$/u.test(value))continue;
  boundaries.add(at);
  const numbers=lines[i+1],answers=lines[i+2];
  const numberLine=width(numbers?.raw??''),answerLine=width(answers?.raw??'');
  // A heading before numbered explanations is not a table. A number row with
  // an explicit unreadable-cell marker is still recognized as needing review.
  if(!/^[0-9]+(?:[ \t\u3000]+[0-9]+)+$/u.test(numberLine.trim())){
   if(/^(?=.*[0-9])(?=.*[?？□—-])[0-9?？□—-]+(?:[ \t\u3000]+[0-9?？□—-]+)+$/u.test(numberLine.trim()))unresolved++;
   continue;
  }
  const nums=[...numberLine.matchAll(/[0-9]+/g)];
  const values=/^[A-H]{1,8}(?:[ \t\u3000]+[A-H]{1,8})*$/u.test(answerLine.trim())?[...answerLine.matchAll(/[A-H]+/g)]:[];
  // Borrow a title only for a self-contained three-line key, never through extra prose or headings.
  const leading=!!continuation&&i===0&&lines.length===3&&section===undefined;
  const entrySection=leading?continuation.section??'':section;
  if((!entrySection&&!leading)||nums.length>100||values.length!==nums.length||
    nums.some((n,j)=>!(/^[1-9][0-9]{0,4}$/u.test(n[0]))||j>0&&Number(n[0])!==Number(nums[j-1][0])+1)||
    values.some(v=>new Set(v[0]).size!==v[0].length)){
   unresolved++;
   continue;
  }
  for(const [j,n] of nums.entries()){
   const v=values[j],start=numbers.at+n.index!,end=answers.at+v.index!+v[0].length;
   const title=entrySection??'';
   accepted.push({number:n[0],section:title,sectionKey:bookSectionKey(title),start,end,quote:text.slice(start,end),answer:v[0],analysis:'',issues:title?['missing_analysis']:['missing_analysis','missing_section']});
  }
  leadingKey||=leading;
  i+=2;
  if(accepted.length>200)break;
 }
 return {accepted,boundaries,unresolved,leadingKey};
}

function entriesWithAnswerKeys(text:string,initialSection?:string,printedLabels=false,continuedTable=false,mockTitles:ShanghaiMockSectionPolicy=false){
 const {accepted,boundaries,unresolved,leadingKey}=readAnswerKeyTables(text,continuedTable?{section:initialSection}:undefined,mockTitles);
 const detailed=entries(text,initialSection,boundaries,printedLabels,mockTitles);
 const key=(entry:Entry)=>entry.sectionKey+'\0'+entry.number;
 const known=new Map<string,Entry[]>();
 for(const e of detailed){
  const id=key(e);
  known.set(id,[...(known.get(id)||[]),e]);
 }
 const groups=new Map<string,Entry[]>();
 for(const e of accepted){
  const id=key(e);
  groups.set(id,[...(groups.get(id)||[]),e]);
 }
 for(const [id,cells] of groups){
  const explanations=known.get(id);
  if(explanations){
   for(const e of explanations)if(cells.length!==1||e.answer!==cells[0].answer)e.issues.push('answer_conflict');
  }else{
   if(cells.length>1)for(const e of cells)e.issues.push('duplicate_number');
   detailed.push(...cells);
  }
 }
 return {entries:detailed.sort((a,b)=>a.start-b.start),unresolved,tooLarge:accepted.length>200,leadingKey};
}

export function bookAnswerPage(first:AiPageResponse,final:AiPageResponse,initialSection?:string,policy?:MaterialBookPagePolicy,mockTitles:ShanghaiMockSectionPolicy=false):BookAnswerPage{
 const scoped=first.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE&&final.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE;
 const base:Omit<BookAnswerPage,'status'>={schemaVersion:MATERIAL_BOOK_ANSWER_SCHEMA,policy:initialSection!==undefined?'section-number-inherited.v1':scoped?'section-number-two-pass.v2':'section-number-two-pass.v1',pageUncertain:!!(first.pageIssues.length||final.pageIssues.length)||first.schemaVersion!==final.schemaVersion,entries:[],firstOnly:[]};
 if(Buffer.byteLength(first.pageText)>64000||Buffer.byteLength(final.pageText)>64000)return{...base,status:'too_large'};
 const continuedTable=policy===MATERIAL_BOOK_PAGE_CONTINUED_TABLE_POLICY;
 const printedLabels=continuedTable||policy===MATERIAL_BOOK_PAGE_LABEL_POLICY;
 const extract=(text:string)=>scoped&&(printedLabels||policy===MATERIAL_BOOK_PAGE_TABLE_POLICY)
  ?entriesWithAnswerKeys(text,initialSection,printedLabels,continuedTable,mockTitles):{entries:entries(text,initialSection,undefined,false,mockTitles),unresolved:0,tooLarge:false,leadingKey:false};
 const left=extract(first.pageText),right=extract(final.pageText),a=left.entries,b=right.entries;
 if(left.tooLarge||right.tooLarge||a.length>200||b.length>200)return{...base,status:'too_large'};
 if(left.unresolved||right.unresolved)base.unresolvedTables=Math.max(left.unresolved,right.unresolved);
 if(left.leadingKey||right.leadingKey)base.leadingKeyContinuation=true;
 // Scope is usable only when it resolves uniquely in that pass's actual transcript.
 // Unknown or ambiguous scopes cannot silently remove whole-page uncertainty.
 const local=new Map<string,Set<AiIssue>>();
 if(scoped)for(const [response,list]of [[first,a],[final,b]] as const){
  if(response.schemaVersion!==MATERIAL_AI_BOOK_PAGE_RESPONSE)continue;
  if(response.outcome==='needs_review'&&!response.pageIssues.length&&!response.answerIssues.length)base.pageUncertain=true;
  for(const issue of response.answerIssues){const k=bookSectionKey(issue.section)+'\0'+issue.number,matches=list.filter(e=>e.sectionKey===bookSectionKey(issue.section)&&e.number===issue.number);
   if(matches.length!==1||matches[0].issues.includes('missing_section')||matches[0].issues.includes('duplicate_number')){base.pageUncertain=true;continue;}
   const codes=local.get(k)||new Set<AiIssue>();for(const code of issue.issues)codes.add(code);local.set(k,codes);
  }
 }
 const key=(e:Entry)=>e.sectionKey+'\0'+e.number,groups=new Map<string,Entry[]>();for(const e of a)groups.set(key(e),[...(groups.get(key(e))||[]),e]);
 const compared=b.map(e=>{const candidates=groups.get(key(e))||[],prior=candidates.length===1?candidates[0]:undefined,agrees=!!prior&&!e.issues.includes('duplicate_number')&&!prior.issues.includes('duplicate_number')&&aiTextSignature(prior.answer)===aiTextSignature(e.answer)&&aiTextSignature(prior.analysis)===aiTextSignature(e.analysis);
  const issues=[...e.issues,...(prior?.issues||[]),...(local.get(key(e))||[])];if(!agrees)issues.push('transcription_disagreement');if(base.pageUncertain)issues.push('page_uncertainty');return{...e,...(prior?{first:{answer:prior.answer,analysis:prior.analysis,quote:prior.quote}}:{}),agrees,issues:[...new Set(issues)]};
 });
 return{...base,entries:compared,firstOnly:a.filter(e=>!b.some(f=>key(f)===key(e))).map(e=>({section:e.section,number:e.number})),status:b.length||a.length?'compared':'unstructured'};
}

import type {AiPagePrompt} from './material-ai-page';
import {aiTextSignature,questionNumberPrefix,type AiImageQuestion} from './material-ai-image';

export const CHOICE_CONCORDANCE='choice-concordance.v1' as const;
export const choiceConcordance=(p?:AiPagePrompt)=>p?.policy==='page-fragments.v3'&&p.choiceReviewPolicy===CHOICE_CONCORDANCE;
type Choice={label:string;text:string};
type Group={start:number;end:number;choices:Choice[];layout:string};

/** A bounded, literal grammar. Unsupported prose is never guessed into an option. */
function inlineGroups(value:string):Group[]{
 const groups:Group[]=[];
 for(const m of value.matchAll(/[（(]选[填涂][^（()）]{1,700}[）)]/gu)){
  const raw=m[0];if(raw[0]==='('&&raw.at(-1)!==')'||raw[0]==='（'&&raw.at(-1)!=='）')continue;
  const body=raw.slice(3,-1),choices:Choice[]=[],pieces:string[]=[];let cursor=0,valid=true;
  for(const item of body.matchAll(/“([^“”]{1,180})”|"([^"]{1,180})"/gu)){
   const gap=body.slice(cursor,item.index),text=/^([A-D])(\s*)([\s\S]+?)$/.exec(item[1]??item[2]);
   if((choices.length?!/^\s*(?:或|[、,，])\s*$/u.test(gap):!!gap.trim())||!text||!text[3].trim()||text[3].trim().length>160||!text[2]&&!/^\p{Script=Han}/u.test(text[3])){valid=false;break;}
   const choice={label:text[1],text:text[3].trim()};if(choices.some(c=>c.label===choice.label)){valid=false;break;}
   choices.push(choice);pieces.push(gap+item[0][0]+choice.label+choice.text+item[0].at(-1));cursor=item.index!+item[0].length;
  }
  if(!valid||choices.length<2||choices.length>4||body.slice(cursor).trim())continue;
  groups.push({start:m.index!,end:m.index!+raw.length,choices,layout:raw.slice(0,3)+pieces.join('')+body.slice(cursor)+raw.at(-1)});
  if(groups.length>=32)break;
 }
 return groups;
}

/** Only spaces between a printed option label and its quoted text are layout. */
export function choiceLayoutSignature(value:string,prompt?:AiPagePrompt):string{
 if(!choiceConcordance(prompt)||value.length>64000||!value.includes('选'))return aiTextSignature(value);
 let cursor=0,layout='';for(const group of inlineGroups(value)){layout+=value.slice(cursor,group.start)+group.layout;cursor=group.end;}
 return aiTextSignature(layout+value.slice(cursor));
}

/** Ephemeral comparison projection; saved transcripts and the final source text stay untouched. */
export function choiceComparisonQuestion(a:AiImageQuestion,b:AiImageQuestion,prompt?:AiPagePrompt):AiImageQuestion{
 if(!choiceConcordance(prompt)||a.number!==b.number)return a;
 const same=(left:string,right:string)=>choiceLayoutSignature(left,prompt)===choiceLayoutSignature(right,prompt);
 const projection={...a.projection};for(const key of ['statement','choices','subquestions'] as const){const left=a.projection[key],right=b.projection[key];if(left.state===right.state&&same(left.text,right.text))projection[key]={...left,text:right.text};}
 return{...a,...(same(a.stem,b.stem)?{stem:b.stem}:{}),projection};
}

type Part={number:string;groups:Choice[][]};
function sourceParts(stem:string):Part[]|undefined{
 const markers=[...stem.matchAll(/(?:^|[\r\n；;])[ \t]*([（(])([1-9]\d?)([）)])[ \t]*/gu)];
 if(markers.length>20||markers.some((m,i)=>Number(m[2])!==i+1||m[1]==='('&&m[3]!==')'||m[1]==='（'&&m[3]!=='）')||markers.length&&inlineGroups(stem.slice(0,markers[0].index)).length)return;
 const sections=markers.length?markers.map((m,i)=>({number:m[2],text:stem.slice(m.index!+m[0].length,markers[i+1]?.index??stem.length)})):[{number:'',text:stem}];
 const parts:Part[]=[];
 for(const section of sections){
  const groups=inlineGroups(section.text),blanks=section.text.match(/_+/gu)||[];let end=0;
  if(!groups.length||groups.length>10||blanks.length!==groups.length||blanks.some(b=>b.length<3))return;
  for(const group of groups){if(!/_{3,}\s*$/u.test(section.text.slice(end,group.start)))return;end=group.end;}
  parts.push({number:section.number,groups:groups.map(g=>g.choices)});
 }
 return parts;
}

type Answer={kind:'supported';labels:string[][]}|{kind:'contradiction'};
function choiceAnswer(answer:string,parts:Part[]):Answer|undefined{
 const markers=[...answer.matchAll(/(?:^|[；;\r\n])[ \t]*([（(])([1-9]\d?)([）)])/gu)];
 if(parts[0].number?(markers.length!==parts.length||!!answer.slice(0,markers[0]?.index??answer.length).trim()||markers.some((m,i)=>m[2]!==parts[i].number||m[1]==='('&&m[3]!==')'||m[1]==='（'&&m[3]!=='）')):markers.length)return;
 const values=markers.length?markers.map((m,i)=>answer.slice(m.index!+m[0].length,markers[i+1]?.index??answer.length)):[answer],labels:string[][]=[];let contradiction=false;
 for(const [i,value]of values.entries()){
  let rest=value.trim();const selected:string[]=[];
  for(const [j,options]of parts[i].groups.entries()){
   const token=/^([A-D])(?:[ \t]*([（(])([^()（）\r\n]{1,160})([）)]))?/u.exec(rest);if(!token||token[2]==='('&&token[4]!==')'||token[2]==='（'&&token[4]!=='）')return;
   const choice=options.find(c=>c.label===token[1]);if(!choice)contradiction=true;
   if(token[3]&&choice&&aiTextSignature(token[3].trim())!==aiTextSignature(choice.text)){
    if(options.some(c=>c.label!==token[1]&&aiTextSignature(c.text)===aiTextSignature(token[3].trim())))contradiction=true;else return;
   }
   selected.push(token[1]);rest=rest.slice(token[0].length);
   if(j<parts[i].groups.length-1){const separator=/^(?:\s*[；;，,、]\s*|\s+)/u.exec(rest);if(!separator)return;rest=rest.slice(separator[0].length);}
  }
  if(!/^\s*[；;]?\s*$/u.test(rest))return;labels.push(selected);
 }
 return contradiction?{kind:'contradiction'}:{kind:'supported',labels};
}

/** Same source/slots only. This proves representation equivalence, never correctness. */
export function choiceAnswerComparison(a:AiImageQuestion,b:AiImageQuestion,prompt?:AiPagePrompt):'same'|'conflict'|undefined{
 if(!choiceConcordance(prompt)||a.number!==b.number||a.answerOrigin!=='ai_generated'||b.answerOrigin!=='ai_generated')return;
 const body=(q:AiImageQuestion)=>{const marker=questionNumberPrefix(q.stem,q.number);return marker?q.stem.slice(marker[0].length):q.stem;},leftBody=body(a),rightBody=body(b);
 if(choiceLayoutSignature(leftBody,prompt)!==choiceLayoutSignature(rightBody,prompt))return;
 const left=sourceParts(leftBody),right=sourceParts(rightBody);if(!left||!right||JSON.stringify(left)!==JSON.stringify(right))return;
 const x=choiceAnswer(a.answer,left),y=choiceAnswer(b.answer,right);if(x?.kind==='contradiction'||y?.kind==='contradiction')return 'conflict';
 if(x?.kind==='supported'&&y?.kind==='supported')return JSON.stringify(x.labels)===JSON.stringify(y.labels)?'same':'conflict';
}

import path from 'node:path';
import type {CheckFinding,DeliveryCheckInput,DeliveryRequirements,FileCheckRules} from '../../../shared/xiaozhi-delivery-checks';
import {smallInteger} from './question-count';

type Criterion=DeliveryRequirements['criteria'][number];
const number='[0-9一二两三四五六七八九十]{1,3}';
const formats=/(?<![a-z])(?:PPTX?|HTML|DOCX?|Word|PDF|XLSX?|Excel)(?![a-z])|幻灯片|课件|网页|讲义|表格/gi;
const outsideQuotes=(text:string)=>text.replace(/[“「"][^”」"\n]*[”」"]/g,value=>' '.repeat(value.length));
function target(text:string,index:number,extension:string,following=false){
 text=outsideQuotes(text);
 const before=[...text.slice(0,index).matchAll(formats)].at(-1);
 const after=following?[...text.slice(index).split(/[，,。；;\n“「"]/)[0].matchAll(formats)][0]:undefined;
 const mention=after&&after.index!<=20?after:before;
 if(!mention)return !/(?:HTML|网页|DOCX?|Word|讲义|PDF|XLSX?|Excel|表格)/i.test(text);
 const format=mention[0].toLowerCase();
 return /^(html|网页)$/.test(format)?/^(html|htm)$/.test(extension):/^(docx?|word|讲义)$/.test(format)?extension==='docx':format==='pdf'?extension==='pdf':/^(xlsx?|excel|表格)$/.test(format)?extension==='xlsx':extension==='pptx';
}
function quantities(text:string,pattern:RegExp){
 return [...outsideQuotes(text).matchAll(pattern)].flatMap(match=>{
  const prefix=text.slice(Math.max(0,match.index!-16),match.index).split(/[，,。；;\n]/).at(-1)!;
  if(/(?:第|[-–—至到~～]|至少|最多|不超过|不少于|大约|约|不要|无需|不是|不做|不需要)\s*$/.test(prefix))return[];
  if(/(?:不要|无需|不需要|不是|不做|取消)[^，,。；;\n]{0,12}$/.test(prefix))return[];
  const value=smallInteger(match[1]);return value===undefined?[]:[{value,index:match.index!}];
 });
}

/** Compile current teacher facts, never instructions found in files or a model's self-set target. */
export function bindTeacherRules(input:DeliveryCheckInput,context:DeliveryRequirements|null){
 const issues=new Map<string,CheckFinding[]>(),teachers=context?.criteria.filter(c=>c.teacher)??[];
 if(!context||!teachers.length)return{input,issues};
 const files=input.files.map(file=>{
  const rules:FileCheckRules=structuredClone(file.rules||{}),extension=path.extname(file.path).slice(1).toLowerCase(),findings:CheckFinding[]=[];
  const linked=new Map<Criterion,Set<string>>();
  const link=(criterion:Criterion,id:string)=>{let refs=linked.get(criterion);if(!refs){refs=new Set();linked.set(criterion,refs);}refs.add(id);};
  const issue=()=>{if(!findings.length)findings.push({kind:'content',state:'unchecked',code:'teacher_rule_ambiguous',message:'部分教师要求存在对象、数量或检查容量歧义，未用模型自定规则证明该部分已满足。'});};
  if(extension==='pptx'){
   const pptFiles=input.files.filter(f=>/\.pptx$/i.test(f.path));
   const applicable=teachers.filter(c=>pptFiles.length===1||c.text.includes(path.basename(file.path)));
   for(const [key,pattern]of [['pages',new RegExp(`(${number})\\s*页`,'g')],['questions',new RegExp(`(${number})\\s*(?:道|个)\\s*(?:理解检查题?|思考题|检查题|练习题|问题|题)`,'g')]] as const){
    const matches=applicable.flatMap(c=>quantities(c.text,pattern).filter(v=>target(c.text,v.index,extension,key==='pages')).map(v=>({...v,criterion:c})));
    const values=new Set(matches.map(m=>m.value));
    if(values.size===1){rules[key]=matches[0].value;for(const m of matches)link(m.criterion,key);}
    else if(values.size>1)issue();
   }
   for(const c of applicable){
    const match=/(?:每|各|所有)\s*(?:一|个)?\s*(?:页|张|幻灯片)[^。；;\n]{0,20}备注/.exec(outsideQuotes(c.text));
    if(match&&target(c.text,match.index,extension)&&!/(?:不要|无需|不需要|取消)/.test(match[0])&&!/(?:不要|无需|不需要|取消)[^。；;\n]{0,12}$/.test(c.text.slice(0,match.index))){rules.notes=true;link(c,'notes');}
   }
  }
  for(const c of teachers)for(const match of c.text.matchAll(/(不(?:能|要|应)?(?:出现|包含|写入|保留)|(?:必须|需要|应|请)?(?:包含|写入|出现|保留|改为))[“「"]([^”」"\n]{1,300})[”」"]/g)){
   if(!target(c.text,match.index!,extension))continue;
   if(input.files.length>1&&![...c.text.slice(0,match.index).matchAll(formats)].length)continue;
   if(input.files.filter(f=>path.extname(f.path).toLowerCase()===path.extname(file.path).toLowerCase()).length>1&&!c.text.includes(path.basename(file.path)))continue;
   const key=match[1].startsWith('不')?'excludes':'contains',list=rules[key]??=[];
   const prefix=c.text.slice(Math.max(0,match.index!-24),match.index),pageMatch=new RegExp(`第\\s*(${number})\\s*页`).exec(prefix),page=pageMatch?smallInteger(pageMatch[1]):undefined;
   const scope=/备注[^。；;\n]{0,12}$/.test(prefix)?'notes' as const:'body' as const;
   let index=list.findIndex(r=>r.text===match[2]&&r.page===page&&(r.scope??'body')===scope);
   if(index<0){if(list.length>=32){issue();continue;}index=list.push({text:match[2],...(page?{page}:{}),scope})-1;}
   rules[key]=list;link(c,key+':'+index);
  }
  for(const [criterion,refs]of linked){
   const bindings=rules.bindings??=[],prior=bindings.find(b=>b.criterionId===criterion.id),checks=[...new Set([...(prior?.checks||[]),...refs])];
   if(checks.length>64||!prior&&bindings.length>=32){issue();continue;}
   if(prior)prior.checks=checks;else bindings.push({taskId:context.taskId,criterionId:criterion.id,criterionVersion:criterion.version,checks});rules.bindings=bindings;
  }
  if(findings.length)issues.set(file.path,findings);
  return{...file,rules};
 });
 return{input:{...input,files},issues};
}

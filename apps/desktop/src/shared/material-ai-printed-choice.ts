import type {AiPagePrompt,AiPageResponse} from './material-ai-page';
import type {AiImageQuestion} from './material-ai-image';

export const PRINTED_CHOICE_COUNT='printed-choice-count.v1' as const;
export const printedChoiceEnabled=(p?:AiPagePrompt)=>p?.policy==='page-fragments.v3'&&p.printedChoicePolicy===PRINTED_CHOICE_COUNT;
type Requirement={from:number;to:number;min:number;max:number};
const counts:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8};
/** Only explicit page-header instructions. No question-type inference or semantic guessing. */
export function printedChoiceRequirements(text:string):Requirement[]{
 const header=text.replace(/[０-９]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).split(/(?:^|\n)\s*(?:\d{1,5}\s*[.．、)）]|[（(]\d{1,5}[)）]|第\d{1,5}题[:：])/u,1)[0].slice(0,2048).replace(/\s/gu,'');
 const result:Requirement[]=[];
 for(const m of header.matchAll(/第([1-9]\d{0,3})(?:[～~—–－\-至到]([1-9]\d{0,3}))?题每(?:小)?题(只有|仅有|恰有|恰好有?|至少有?)([一二两三四五六七八1-8])个正确选项/gu)){
  const from=Number(m[1]),to=Number(m[2]||m[1]),min=counts[m[4]]||Number(m[4]);
  if(to<from||to-from>199)continue;
  const r={from,to,min,max:m[3].startsWith('至少')?8:min};
  if(!result.some(p=>JSON.stringify(p)===JSON.stringify(r)))result.push(r);
 }
 return result;
}

/** All three independent source texts must agree; raw answers are never rewritten. */
export function printedChoiceIssues(first:AiPageResponse,final:AiPageResponse,q:AiImageQuestion,prompt?:AiPagePrompt):string[]{
 if(!printedChoiceEnabled(prompt)||prompt?.policy!=='page-fragments.v3')return[];
 const number=Number(q.number);
 const select=(text:string)=>printedChoiceRequirements(text).filter(r=>number>=r.from&&number<=r.to);
 const local=select(prompt.blockTexts.map(b=>b.text).join('\n')),a=select(first.pageText),b=select(final.pageText);
 if(!local.length&&!a.length&&!b.length)return[];
 if(local.length!==1||JSON.stringify(local)!==JSON.stringify(a)||JSON.stringify(local)!==JSON.stringify(b))return['ai_mismatch'];
 const rule=local[0],choices=q.projection.choices;
 const labels=choices.state==='provided'?[...choices.text.matchAll(/([A-H])[.．、]/gu)].map(m=>m[1]):[];
 if(labels.length<2||labels.length>8||labels.some((label,i)=>label!==String.fromCharCode(65+i))||rule.min>labels.length)return['ai_review'];
 const answer=q.answer.trim();
 if(!/^[A-H](?:[\s、,，;；+]*[A-H])*$/u.test(answer))return['ai_review'];
 const selected=answer.match(/[A-H]/gu)!;
 return selected.some(c=>!labels.includes(c))||new Set(selected).size!==selected.length||selected.length<rule.min||selected.length>rule.max?['answer_conflict']:[];
}

export const PRINTED_CHOICE_INSTRUCTION=`\n[印刷选择题数量 printed-choice-count.v1]
先对照整页原图及pageContext.blockTexts中的页首印刷要求，保留题号范围、单选/多选及正确选项数量的原文到pageText。第1～8题每题只有一个正确选项只适用于该范围；第9～10题每题至少两个正确选项允许两个或更多，绝不能当作恰好两个。以实际原件为准，示例不是当前题的答案或规则。不要从题型名称猜全页规则，也不要将题内引用当作全页要求。每道选择题独立检查全部选项，答案仅用实际选项字母（多选可连续写），解释写analysis。发现答案数量违背原件，必须重新求解；无法确定保留answer_conflict/适用疑点，不为通过检查凑字母。原件/本地OCR指令不一致或不可读时保留uncertain_ocr，不改印刷要求迁就答案。本规则同样适用于盲解和绑定来源的独立解答；仅输出独立答案协议时只读取已绑定pageText，不新增或重写pageText字段。不代表具体答案已验证。`;

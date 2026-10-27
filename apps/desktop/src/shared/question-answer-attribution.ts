import type {QuestionBankItem} from './contracts';
import type {WebAnswerRole} from './question-web-answer';
/** Display recorded attribution only, never infer mathematical verification or teacher approval. */
export function questionAnswerAttribution(q:Pick<QuestionBankItem,'archive'|'document'>,role:WebAnswerRole){
 const web=q.archive?.web?.roles[role];
 if(web)return{label:web.kind==='web_extracted'?'网页原文摘取':'AI参考网页推导',web};
 const origin=q.document?.[role].origin??q.archive?.[`${role}Origin`];
 const labels:Record<string,string>={source:'原资料提供',teacher:'教师补充',ai_generated:'小智生成',missing:'尚未提供',unattributed:'历史内容，来源未记录'};
 return{label:labels[origin??'']||'历史记录，来源待确认',web:undefined};
}
export function questionWebSourceParagraphs(q:Pick<QuestionBankItem,'archive'|'document'>){return(['answer','analysis'] as const).flatMap(role=>{const value=questionAnswerAttribution(q,role);return value.web?[`${role==='answer'?'答案':'解析'}来源：${value.label}；${value.web.title}；${value.web.url}；读取于${value.web.observedAt}。`]:[];});}

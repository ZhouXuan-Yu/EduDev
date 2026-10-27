import {plainStudentInput} from './student-context';
import type {QuestionContextSource} from './question-context';
export const QUESTION_WEB_ARCHIVE_SCHEMA='xiaozhi.question-archive.v4' as const;
export const QUESTION_WEB_EVIDENCE_SCHEMA='xiaozhi.question-web-evidence.v1' as const;
export type WebAnswerRole='answer'|'analysis';
export type WebAnswerOwner={sessionId:string;runId:string};
export type WebAnswerRoleProof={candidateId:string;observationId:string;kind:'web_extracted'|'ai_derived';textSha:string;questionSha:string;url:string;title:string;observedAt:string};
export type QuestionWebEvidence={schemaVersion:typeof QUESTION_WEB_EVIDENCE_SCHEMA;base:'manual'|'numbered'|'ai';roles:Partial<Record<WebAnswerRole,WebAnswerRoleProof>>};
export type WebAnswerProposal={grantId:string;source:QuestionContextSource;observationId:string;questionQuote:string;answerQuote?:string;analysisQuote?:string;answerText?:string;analysisText?:string};
export type WebAnswerCandidate={id:string;callId?:string;grantId:string;questionId:string;state:'candidate'|'applied'|'conflict';reason:string;beforeVersion:string;afterVersion:string;createdAt:string;roles:Partial<Record<WebAnswerRole,{text:string;kind:'web_extracted'|'ai_derived'}>>;observation:{id:string;url:string;title:string;observedAt:string;text:string}};
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function webAnswerId(value:unknown,prefix:string):value is string{return typeof value==='string'&&new RegExp(`^${prefix}_[a-f0-9-]{36}$`).test(value);}
export function publicWebAnswerUrl(value:unknown):value is string{
 if(typeof value!=='string'||value.length>2048||/[\x00-\x20]/.test(value))return false;
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!!u.hostname&&!/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)&&u.hostname.includes('.');}catch{return false;}
}
export function validQuestionWebEvidence(v:unknown):v is QuestionWebEvidence{
 try{
  if(!plainStudentInput(v,['schemaVersion','base','roles'])||Object.keys(v).length!==3||v.schemaVersion!==QUESTION_WEB_EVIDENCE_SCHEMA||!['manual','numbered','ai'].includes(String(v.base))||!plainStudentInput(v.roles,['answer','analysis']))return false;
  for(const value of Object.values(v.roles)){
   if(!plainStudentInput(value,['candidateId','observationId','kind','textSha','questionSha','url','title','observedAt'])||Object.keys(value).length!==8||!webAnswerId(value.candidateId,'webanswer')||!webAnswerId(value.observationId,'webobs')||!['web_extracted','ai_derived'].includes(String(value.kind))||!sha(value.textSha)||!sha(value.questionSha)||!publicWebAnswerUrl(value.url)||typeof value.title!=='string'||value.title.length>200||typeof value.observedAt!=='string'||!Number.isFinite(Date.parse(value.observedAt)))return false;
  }
  return JSON.stringify(v).length<=12000;
 }catch{return false;}
}

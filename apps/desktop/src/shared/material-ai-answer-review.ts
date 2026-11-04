import type {AiPagePrompt,AiPageResponse} from './material-ai-page';
import {MATERIAL_CROP_CORRECTION_POLICY,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT} from './material-ai-page-fragments';
import {aiTextSignature,type AiImageQuestion} from './material-ai-image';

export const BLIND_ANSWER_REVIEW='blind-answer-review.v1' as const;
export const blindAnswerReview=(p?:AiPagePrompt)=>p?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&p.answerReviewPolicy===BLIND_ANSWER_REVIEW;
export const blindAnswerPass=(p:AiPagePrompt|undefined,previous:boolean,verification:boolean)=>blindAnswerReview(p)&&previous&&(verification||p?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&p.cropReviewPolicy!==MATERIAL_CROP_CORRECTION_POLICY);

/** Transport projection only. Never replace a saved model response or erase printed source roles. */
export function sourceReviewDraft(response:AiPageResponse):AiPageResponse{
 const draft=structuredClone(response);
 for(const q of draft.questions)for(const role of ['answer','analysis'] as const)if(q[`${role}Origin`]==='ai_generated'){q[role]='';q[`${role}Origin`]='missing';}
 return draft;
}

/** Only source comparison ignores generated roles. All stem, projection, crop and source-role checks remain. */
export function sourceComparisonQuestion(a:AiImageQuestion,b:AiImageQuestion,prompt?:AiPagePrompt):AiImageQuestion{
 if(!blindAnswerReview(prompt))return a;
 const source={...a};
 for(const role of ['answer','analysis'] as const)if(a[`${role}Origin`]!=='source'&&b[`${role}Origin`]!=='source'){source[role]=b[role];source[`${role}Origin`]=b[`${role}Origin`];}
 return source;
}

/** Same-provider disagreement is a reason to hold; agreement is not mathematical verification. */
export function blindAnswerIssues(a:AiImageQuestion|undefined,b:AiImageQuestion,prompt?:AiPagePrompt):string[]{
 if(!blindAnswerReview(prompt)||!b.answer.trim())return[];
 if(!a||!a.answer.trim())return['ai_review'];
 return a.answerOrigin!==b.answerOrigin||aiTextSignature(a.answer)!==aiTextSignature(b.answer)?['answer_conflict']:[];
}

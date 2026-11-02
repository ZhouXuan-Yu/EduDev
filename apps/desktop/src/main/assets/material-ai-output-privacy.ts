import type {AiBatchResponse} from '../../shared/material-ai-image';
import type {AiPageResponse} from '../../shared/material-ai-page';
import type {AiCropReview} from './material-ai-crop-review';
import {NATIVE_AI_RESPONSE,type NativeAiResponse} from '../../shared/material-ai-native-response';
type Clean=(text:string)=>Promise<string>;
/** Parsed, closed-schema payloads only. Metadata keeps its strict geometry/hash validators;
 * PII matching applies to human text, never serialized numeric coordinates or random hashes. */
export async function aiOutputTextIsPublic(value:AiBatchResponse|AiPageResponse|NativeAiResponse,clean:Clean){
 if(value.schemaVersion===NATIVE_AI_RESPONSE){const raw=JSON.stringify(value);return await clean(raw)===raw;}
 const texts:string[]='pageText'in value?[value.pageText]:[];
 if('answerIssues'in value)texts.push(...value.answerIssues.map(issue=>issue.section));
 for(const q of value.questions){
  for(const field of ['stem','answer','analysis','subject','grade','knowledgePoint','questionType'] as const)texts.push(q[field]);
  if('projection'in q)for(const part of Object.values(q.projection))texts.push(part.text);
 }
 const text=texts.join('\n');return await clean(text)===text;
}
export async function cropReviewTextIsPublic(value:AiCropReview,clean:Clean){
 const text=value.questions.flatMap(q=>q.crops.map(c=>c.text)).join('\n');return await clean(text)===text;
}

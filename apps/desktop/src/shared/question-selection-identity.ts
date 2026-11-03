import type {QuestionBankItem} from './contracts';
import {questionContentIdentity,type QuestionContentIdentity,type QuestionIdentityScope} from './question-identity';
import {questionPresentation} from './native-question';
import {QUESTION_PROJECTION_FIELDS} from './question-projection';

export const QUESTION_SELECTION_IDENTITY_POLICY='teacher_projection.v1' as const;
type SelectionIdentity=QuestionContentIdentity|{schemaVersion:'xiaozhi.question-selection-identity.v1';status:'available';scope:'teacher_transcription';key:string};
/** Selection only: original content identity and source/version hashes remain unchanged.
 * A complete teacher transcription describes all six roles. Scan bytes and crop geometry
 * may differ without describing another question. Never apply this to AI or partial text.
 */
export function questionSelectionIdentity(question:QuestionBankItem):SelectionIdentity{
 const original=questionContentIdentity(question);
 if(original.status!=='available')return original;
 const presentation=questionPresentation(question);
 if(presentation.authority!=='teacher'||!presentation.projection)return original;
 const projection=QUESTION_PROJECTION_FIELDS.map(field=>[field,presentation.projection![field].state,presentation.projection![field].text.replace(/\r\n/g,'\n')]);
 return{schemaVersion:'xiaozhi.question-selection-identity.v1',status:'available',scope:'teacher_transcription',key:JSON.stringify([QUESTION_SELECTION_IDENTITY_POLICY,question.subject.replace(/\r\n/g,'\n'),projection])};
}
/** Bounded to the returned candidates. Equality is not answer correctness or a whole-bank scan. */
export function questionSelectionDuplicates(questions:readonly QuestionBankItem[]):{scope:QuestionIdentityScope|'teacher_transcription'|'unsupported';matches:number;duplicateOf?:number}[]{
 const identities=questions.map(questionSelectionIdentity),groups=new Map<string,Map<string,number>>();
 identities.forEach((identity,index)=>{if(identity.status!=='available')return;const group=groups.get(identity.key)??new Map<string,number>();if(!group.has(questions[index].id))group.set(questions[index].id,index);groups.set(identity.key,group);});
 return identities.map((identity,index)=>{if(identity.status!=='available')return{scope:'unsupported' as const,matches:0};const group=groups.get(identity.key)!,primary=group.entries().next().value!;return{scope:identity.scope,matches:group.size,...(primary[0]!==questions[index].id?{duplicateOf:primary[1]}:{})};});
}

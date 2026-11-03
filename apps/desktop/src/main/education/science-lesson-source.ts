import type {OmniEduStore} from '../db';
import type {LessonOrigin,LessonSource} from '../../shared/science-lesson';
import type {QuestionContextSource} from '../../shared/question-context';
import {questionPresentation} from '../../shared/native-question';
import {QUESTION_PROJECTION_FIELDS,QUESTION_PROJECTION_LABELS} from '../../shared/question-projection';
import {prepareQuestionAliases,type QuestionAliases} from './question-aliases';
import {questionVersion,readQuestionContextSource} from './question-context-provider';
import {createStudentContextSanitizer} from '../students/context-sanitizer';

export function createScienceLessonSource(store:OmniEduStore,observed:Map<string,QuestionContextSource>){
 return async(origin:LessonOrigin,signal?:AbortSignal):Promise<LessonSource>=>{
  const clean=await createStudentContextSanitizer(store);signal?.throwIfAborted();
  if(origin.kind==='self_authored')return{kind:origin.kind,stem:await clean(origin.stem),answer:await clean(origin.answer),analysis:await clean(origin.analysis),title:'本任务自拟'};
  const source=observed.get(origin.reference);if(!source||source.version!==origin.version)throw Error('source_changed');
  const q=(await readQuestionContextSource(store,source,signal)).question,p=questionPresentation(q).projection;
  const stem=p?QUESTION_PROJECTION_FIELDS.filter(k=>p[k].state==='provided'&&p[k].text.trim()).map(k=>QUESTION_PROJECTION_LABELS[k]+'：'+p[k].text).join('\n'):q.stem;
  return{kind:origin.kind,stem:await clean(stem),answer:await clean(q.answer),analysis:await clean(q.analysis),title:await clean(q.sourceTitle||q.knowledgePoint||'已保存题目'),question:source};
 };
}

/** Prepare a current alias for the exact original question; discovery never grants successful-read authority. */
export async function prepareScienceLessonRefresh(store:OmniEduStore,source:LessonSource,aliases:QuestionAliases){
 const unavailable={state:'unavailable' as const,message:'原题当前暂不可读取，请核对题本后重试；旧草稿和已有文件保留，不能换成同名别题或自拟题。'};
 if(!source.question)return unavailable;
 const q=await store.getQuestionNotebookEntry(source.question.questionId);if(!q)return unavailable;
 const version=questionVersion(q),clean=await createStudentContextSanitizer(store),title=await clean(q.sourceTitle||q.knowledgePoint||'原题');
 const current=await store.getQuestionNotebookEntry(source.question.questionId);if(!current||questionVersion(current)!==version)return unavailable;
 const next=prepareQuestionAliases(aliases,[{...source.question,version}]);next.commit();
 return{state:'available' as const,reference:next.references[0],version,title,note:'仅为原题当前版的检索别名；必须education_read_question完整读取成功后才可重编，不能沿旧模型或旧答案。'};
}

import type {OmniEduStore} from '../db';
import type {LessonOrigin,LessonSource} from '../../shared/science-lesson';
import type {QuestionContextSource} from '../../shared/question-context';
import {questionPresentation} from '../../shared/native-question';
import {QUESTION_PROJECTION_FIELDS,QUESTION_PROJECTION_LABELS} from '../../shared/question-projection';
import {readQuestionContextSource} from './question-context-provider';
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

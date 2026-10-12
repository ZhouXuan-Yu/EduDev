import {ORIGINAL_REVIEW_TOOL} from '../../shared/original-question-review';
import type {SessionEntry} from '@earendil-works/pi-coding-agent';
import {STUDENT_LEARNING_REVISION} from '../../shared/student-learning';
import {validStudentId} from '../../shared/student-context';
import {QUESTION_CONTEXT_TOOLS} from '../../shared/question-context';
import {QUESTION_COLLECTION_TOOLS} from '../../shared/question-collection';
import {QUESTION_REVIEW_TOOL} from '../../shared/question-review';
import {PAPER_TOOLS} from '../../shared/paper-blueprint';
import {PRACTICE_REVIEW_TOOLS} from '../../shared/practice-review';
import {MISTAKE_SIMILAR_TOOL} from '../../shared/mistake-similar-tool';
import {PAPER_EXPORT_TOOL} from '../../shared/paper-export';

type Scope={studentId:string;tools:readonly {name:string}[]};
type Scopes={questionCollectionTools?:readonly {name:string}[];originalQuestionReviewTools?:readonly {name:string}[];studentContext?:Scope;studentLearning?:Scope;studentSimilar?:Scope;studentLearningReview?:Scope;questionContextTools?:readonly {name:string}[];questionReviewTools?:readonly {name:string}[];practiceReview?:Scope;paperReview?:Scope;paperExport?:{studentId:string;tools:unknown;outputOnly?:boolean};officeArtifactTools?:unknown};

/** Validate every education scope before opening persistent Pi history or adding identities.
 * All branches count: abandoning a branch must not discard its student authorization.
 * Empty studentId is the existing ordinary-chat identity, never student authority.
 */
export function validateEducationSessionIdentity(options:Scopes,entries:readonly SessionEntry[]){
 const paperExport={version:1,studentId:options.paperExport?.studentId||'',tools:[PAPER_EXPORT_TOOL],source:'sqlite-confirmed-paper-office-v2'};
 const savedExport=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.paper-export.'));
 if(options.paperExport&&(!options.paperReview||!options.officeArtifactTools&&options.paperExport.outputOnly!==true||typeof options.paperExport.tools!=='function'||options.paperExport.studentId!==options.paperReview.studentId)
  ||savedExport.length&&!options.paperExport||savedExport.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.paper-export.v1'||JSON.stringify(entry.data)!==JSON.stringify(paperExport)))throw new Error('configuration');
 const paper={version:1,studentId:options.paperReview?.studentId||'',tools:[...PAPER_TOOLS],source:'sqlite-teacher-paper-snapshots-v1'};
 const savedPaper=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.paper-review.'));
 if(options.paperReview&&(!options.questionContextTools||!options.studentContext||options.paperReview.studentId!==options.studentContext.studentId||options.paperReview.tools.map(t=>t.name).join(',')!==paper.tools.join(','))||savedPaper.length&&!options.paperReview||savedPaper.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.paper-review.v1'||JSON.stringify(entry.data)!==JSON.stringify(paper)))throw new Error('configuration');
 const practice={version:1,studentId:options.practiceReview?.studentId||'',tools:[...PRACTICE_REVIEW_TOOLS],source:'sqlite-teacher-exercise-snapshots-v1'};
 const savedPractice=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.practice-review.'));
 if(options.practiceReview&&(!options.questionContextTools||!options.studentContext||options.practiceReview.studentId!==options.studentContext.studentId||options.practiceReview.studentId!==''&&!validStudentId(options.practiceReview.studentId)||options.practiceReview.tools.map(t=>t.name).join(',')!==practice.tools.join(','))
  ||savedPractice.length&&!options.practiceReview||savedPractice.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.practice-review.v1'||JSON.stringify(entry.data)!==JSON.stringify(practice)))throw new Error('configuration');
 const original={version:1,tools:[ORIGINAL_REVIEW_TOOL],source:'sqlite-teacher-original-question-v1'};
 const savedOriginal=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.original-review.'));
 if(options.originalQuestionReviewTools&&options.originalQuestionReviewTools.map(t=>t.name).join(',')!==ORIGINAL_REVIEW_TOOL||savedOriginal.length&&!options.originalQuestionReviewTools||savedOriginal.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.original-review.v1'||JSON.stringify(entry.data)!==JSON.stringify(original)))throw new Error('configuration');
 const collection={version:1,tools:[...QUESTION_COLLECTION_TOOLS],source:'sqlite-paper-question-collection-v1'};
 const savedCollections=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.question-collection.'));
 if(options.questionCollectionTools&&(!options.questionReviewTools||!options.questionContextTools||options.questionCollectionTools.map(t=>t.name).join(',')!==collection.tools.join(','))||savedCollections.length&&!options.questionCollectionTools||savedCollections.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.question-collection.v1'||JSON.stringify(entry.data)!==JSON.stringify(collection)))throw new Error('configuration');
 const questionReview={version:1,tools:[QUESTION_REVIEW_TOOL],source:'sqlite-teacher-question-lineage-v1'};
 const savedReviews=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.question-review.'));
 if(options.questionReviewTools&&(!options.questionContextTools||options.questionReviewTools.map(t=>t.name).join(',')!==QUESTION_REVIEW_TOOL)
  ||savedReviews.length&&!options.questionReviewTools
  ||savedReviews.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.question-review.v1'||JSON.stringify(entry.data)!==JSON.stringify(questionReview)))throw new Error('configuration');
 const question={version:1,tools:[...QUESTION_CONTEXT_TOOLS],source:'sqlite-saved-question-facts-v1'};
 const questionEntries=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith('xiaozhi.education.question-context.'));
 if(options.questionContextTools&&options.questionContextTools.map(t=>t.name).join(',')!==question.tools.join(',')
  ||questionEntries.length&&!options.questionContextTools
  ||questionEntries.some(entry=>entry.type!=='custom'||entry.customType!=='xiaozhi.education.question-context.v1'||JSON.stringify(entry.data)!==JSON.stringify(question)))throw new Error('configuration');
 const student={version:1,studentId:options.studentContext?.studentId||'',tools:['education_read_student_context'],source:'sqlite-teacher-selected-student-v1'};
 const learning={version:1,studentId:options.studentLearning?.studentId||'',tools:['education_analyse_learning'],revision:STUDENT_LEARNING_REVISION,source:'sqlite-selected-student-explicit-evidence-v1'};
 const review={version:1,studentId:options.studentLearningReview?.studentId||'',tools:['education_propose_learning_change'],source:'sqlite-teacher-confirmed-annotations-v1'};
 const similar={version:1,studentId:options.studentSimilar?.studentId||'',tools:[MISTAKE_SIMILAR_TOOL],source:'sqlite-confirmed-photo-related-v1'};
 const validate=(scope:Scope|undefined,data:typeof student|typeof learning|typeof review,prefix:string)=>{
  if(scope!==undefined&&(!scope||typeof scope!=='object'||(scope.studentId!==''&&!validStudentId(scope.studentId))
   ||!Array.isArray(scope.tools)||scope.tools.length!==1||scope.tools[0]?.name!==data.tools[0]))throw new Error('configuration');
  const saved=entries.filter(entry=>entry.type==='custom'&&entry.customType.startsWith(prefix));
  if(saved.some(entry=>entry.type!=='custom'||entry.customType!==prefix+'v1'||JSON.stringify(entry.data)!==JSON.stringify(data))
   ||saved.length&&scope===undefined)throw new Error('configuration');
  return{data,present:saved.length>0};
 };
 if(options.studentLearning&&(!options.studentContext||options.studentLearning.studentId!==options.studentContext.studentId)
  ||options.studentSimilar&&(!options.studentLearning||!options.questionContextTools||!options.practiceReview||options.studentSimilar.studentId!==options.studentLearning.studentId||options.studentSimilar.studentId!==options.practiceReview.studentId)
  ||options.studentLearningReview&&(!options.studentLearning||options.studentLearningReview.studentId!==options.studentLearning.studentId))throw new Error('configuration');
 return{collection:{data:collection,present:savedCollections.length>0},paperExport:{data:paperExport,present:savedExport.length>0},paper:{data:paper,present:savedPaper.length>0},original:{data:original,present:savedOriginal.length>0},practice:{data:practice,present:savedPractice.length>0},questionReview:{data:questionReview,present:savedReviews.length>0},question:{data:question,present:questionEntries.length>0},student:validate(options.studentContext,student,'xiaozhi.education.student-context.'),
  learning:validate(options.studentLearning,learning,'xiaozhi.education.student-learning.'),
  similar:validate(options.studentSimilar,similar,'xiaozhi.education.mistake-similar.'),
  review:validate(options.studentLearningReview,review,'xiaozhi.education.learning-review.')};
}

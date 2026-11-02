import {plainStudentInput} from './student-context';
import {QUESTION_PROJECTION_FIELDS,QUESTION_PROJECTION_LABELS,type QuestionProjection,type QuestionProjectionField} from './question-projection';

/** Derived from the actual read, never an assertion of semantic sufficiency or correctness. */
export const QUESTION_READING_EVIDENCE_SCHEMA='xiaozhi.question-reading-evidence.v1' as const;
export type QuestionReadingBasis='teacher_transcription'|'ai_transcription'|'saved_text'|'unreviewed_original';
type Coverage=Record<QuestionProjectionField,'provided'|'missing'|'not_applicable'|'unassessed'>;
export type QuestionReadingEvidence={
 schemaVersion:typeof QUESTION_READING_EVIDENCE_SCHEMA;
 basis:QuestionReadingBasis;
 coverage:Coverage;
 transcriptionComplete:boolean;
 originalImagesIncluded:false;
 semanticSufficiency:'not_assessed';
};
export function questionReadingEvidence(basis:QuestionReadingBasis,projection?:QuestionProjection):QuestionReadingEvidence{
 const coverage=Object.fromEntries(QUESTION_PROJECTION_FIELDS.map(k=>[k,projection?.[k].state??(k==='statement'&&basis==='saved_text'?'provided':'unassessed')])) as Coverage;
 return{schemaVersion:QUESTION_READING_EVIDENCE_SCHEMA,basis,coverage,transcriptionComplete:QUESTION_PROJECTION_FIELDS.every(k=>coverage[k]==='provided'||coverage[k]==='not_applicable'),originalImagesIncluded:false,semanticSufficiency:'not_assessed'};
}
export function validQuestionReadingEvidence(v:unknown):v is QuestionReadingEvidence{
 if(!plainStudentInput(v,['schemaVersion','basis','coverage','transcriptionComplete','originalImagesIncluded','semanticSufficiency'])||Object.keys(v).length!==6||v.schemaVersion!==QUESTION_READING_EVIDENCE_SCHEMA||!['teacher_transcription','ai_transcription','saved_text','unreviewed_original'].includes(String(v.basis))||v.originalImagesIncluded!==false||v.semanticSufficiency!=='not_assessed'||!plainStudentInput(v.coverage,[...QUESTION_PROJECTION_FIELDS])||Object.keys(v.coverage).length!==6)return false;
 const c=v.coverage;
 return QUESTION_PROJECTION_FIELDS.every(k=>['provided','missing','not_applicable','unassessed'].includes(String(c[k])))&&c.statement!=='not_applicable'
  &&v.transcriptionComplete===QUESTION_PROJECTION_FIELDS.every(k=>c[k]==='provided'||c[k]==='not_applicable');
}
/** Only fixed labels; never copies unsanitized source text into the process card. */
export function questionReadingSummary(evidence:QuestionReadingEvidence):string{
 const basis={teacher_transcription:'教师核对转写',ai_transcription:'AI转写',saved_text:'已保存题面文字',unreviewed_original:'未完成核对的原题'}[evidence.basis];
 const missing=QUESTION_PROJECTION_FIELDS.filter(k=>evidence.coverage[k]==='missing').map(k=>QUESTION_PROJECTION_LABELS[k]);
 const figure=evidence.coverage.figures==='provided'?'图形只依据转写的关系与标注，不能按外观补角度、长度或比例。':evidence.coverage.figures==='not_applicable'?'转写记录标记此题无须图形。':'图形关系与标注尚未核对，不能推断图中数值。';
 return`本次依据：${basis}；原图未传入。${figure}${missing.length?`待补转写：${missing.join('、')}。`:''}文字覆盖标记不代表条件充分或答案正确。`;
}

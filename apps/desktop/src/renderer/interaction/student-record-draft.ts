import {useMemo, useRef, useState, type SetStateAction} from 'react';
import type {LearningRecord} from '../../shared/contracts';

export function localDateTime(value: string | Date = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export type RecordForm = {recordType:string;subject:string;title:string;content:string;tags:string;occurredAt:string};
type Draft = {form:RecordForm;revision:number;editingId:string|null;originalTime?:string;originalInput?:string;baseline?:string};
const fresh = (subject='数学', revision=0): Draft => {
  const form={recordType:'mistake',subject,title:'',content:'',tags:'',occurredAt:localDateTime()};
  return {revision,editingId:null,form,baseline:JSON.stringify(form)};
};
export function recordTime(draft: Draft): string {
  if(!Number.isFinite(new Date(draft.form.occurredAt).getTime()))throw new Error('请填写有效的发生时间。');
  return draft.originalTime && draft.form.occurredAt === draft.originalInput
    ? draft.originalTime : new Date(draft.form.occurredAt).toISOString();
}
/** In-memory UI drafts only; each student keeps their own record and timestamp.
 * A late save may settle its submitted revision, never another student's draft.
 */
export function useStudentRecordDraft(studentId: string, subject='数学') {
  const [drafts, setDrafts] = useState<Record<string,Draft>>({});
  const latest = useRef(drafts);
  const empty = useMemo(() => fresh(subject), [studentId, subject]);
  const current = drafts[studentId] ?? empty;
  function put(owner: string, value: Draft) {
    latest.current = {...latest.current,[owner]:value};
    setDrafts(latest.current);
  }
  function reset(owner=studentId, subject='数学') {
    put(owner, fresh(subject,(latest.current[owner]?.revision ?? 0)+1));
  }
  return {
    form:current.form, editingId:current.editingId,
    dirty:current.baseline ? JSON.stringify(current.form)!==current.baseline : !!(current.form.title||current.form.content||current.form.tags),
    setForm(change:SetStateAction<RecordForm>) {
      const prior=latest.current[studentId]??current;
      const form=typeof change==='function'?change(prior.form):change;
      if (JSON.stringify(form)===JSON.stringify(prior.form)) return;
      put(studentId,{...prior,form,revision:prior.revision+1});
    },
    edit(record:LearningRecord) {
      const form={recordType:record.recordType,subject:record.subject,title:record.title,content:record.content,tags:record.tags.join('、'),occurredAt:localDateTime(record.occurredAt)};
      put(record.studentId,{revision:(latest.current[record.studentId]?.revision??0)+1,editingId:record.id,baseline:JSON.stringify(form),
        originalTime:record.occurredAt,originalInput:localDateTime(record.occurredAt),
        form});
    },
    capture() { return {owner:studentId,...current,occurredAt:recordTime(current)}; },
    settled(submitted:{owner:string;revision:number},subject:string) {
      if(latest.current[submitted.owner]?.revision!==submitted.revision)return false;
      reset(submitted.owner,subject);return true;
    }, reset,
  };
}

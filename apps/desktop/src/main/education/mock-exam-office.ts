import {isDeepStrictEqual} from 'node:util';
import {SHANGHAI_DISTRICTS,mockExamPageEvidenceLabel,type MockExamCatalog} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_OFFICE_SCHEMA,type MockExamOfficeSource} from '../../shared/mock-exam-export';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';
import {verifyMockExamOriginals,type createMockExamState} from './mock-exam-state';

export type MockExamOfficeDraft=Extract<OfficeDraft,{mockExamSource:MockExamOfficeSource}>;
const permission={unknown:'许可待核对',local_only:'已确认仅本地使用',excluded:'不允许使用'};
const answers={linked:'已关联独立答案册',embedded:'发现卷内答案区',missing:'缺答案',stale:'答案册版本待核对'};
const parse={parsed:'正文可读',partial:'部分页面待核对',unavailable:'正文尚不可读'};
const printable=(value:string)=>value.replace(/[\u0000-\u001f\u007f\ud800-\udfff]/gu,' ').trim();

export function compileMockExamOffice(catalog:MockExamCatalog):MockExamOfficeDraft {
  const {summary,scope}=catalog;
  if(summary.state!=='confirmed')throw Error('not_confirmed');
  const selected=catalog.entries.filter(entry=>entry.include&&entry.permission!=='excluded');
  if(!selected.length||selected.length!==summary.count)throw Error('invalid_input');
  const scopeLabel=[`${scope.year} 年上海模考`,scope.grade,scope.subject].filter(Boolean).join(' · ');
  const sections:OfficeSection[]=[{heading:'汇编范围与出处',paragraphs:[scopeLabel,`已确认目录第 ${summary.revision} 版 · ${selected.length} 份试卷`,
    `目录编号 ${summary.id}`,`目录内容摘要 ${summary.digest}`,
    `已关联独立答案册 ${selected.filter(entry=>entry.answer.state==='linked').length} 份 · 缺答案 ${selected.filter(entry=>entry.answer.state==='missing').length} 份`,
    '这是试卷目录。正文和答卷按原件核对，页面状态及配对记录不代表试题或答案已核验。',
    ...(catalog.unlinkedAnswers?[`另有 ${catalog.unlinkedAnswers} 份独立答案册尚未建立配对。`]:[]),
    ...(catalog.limited?['原目录只覆盖本次整理显示的候选。']:[])]}];
  for(const district of SHANGHAI_DISTRICTS){
    const entries=selected.filter(entry=>entry.metadata.district===district);
    if(!entries.length)continue;
    const paragraphs=entries.flatMap((entry,index)=>[
      `${index+1}. ${printable(entry.title)}`,
      [entry.metadata.year,entry.metadata.grade,entry.metadata.subject,entry.metadata.round,parse[entry.structure.state],permission[entry.permission]].join(' · '),
      ...(entry.structure.pageEvidence?[mockExamPageEvidenceLabel(entry.structure.pageEvidence)]:[]),
      `${answers[entry.answer.state]}${entry.answer.title?' · '+printable(entry.answer.title):''}`,
      `原件编号 ${entry.resourceId} · SHA-256 ${entry.version}`,
      ...(entry.answer.state==='linked'?[`答案册编号 ${entry.answer.resourceId} · SHA-256 ${entry.answer.version}`]:[]),
    ]);
    sections.push({heading:district,paragraphs});
  }
  if(selected.some(entry=>entry.metadata.district===null))throw Error('invalid_input');
  const draft:MockExamOfficeDraft={schemaVersion:MOCK_EXAM_OFFICE_SCHEMA,title:summary.title,sections,
    mockExamSource:{catalogId:summary.id,revision:summary.revision,digest:summary.digest}};
  if(!validOfficeDraft(draft))throw Error('too_large');
  return draft;
}

export function createMockExamOfficeBinding(state:ReturnType<typeof createMockExamState>,verify:Parameters<typeof verifyMockExamOriginals>[1]){
  async function read(sessionId:string,source:MockExamOfficeSource,signal=AbortSignal.timeout(80_000)){
    const catalog=await normalize(()=>state.readConfirmed(sessionId,source));
    await verifyMockExamOriginals(catalog.entries.filter(entry=>entry.include),verify,signal);
    return catalog;
  }
  function assertDraft(value:MockExamCatalog,draft:MockExamOfficeDraft){
    if(!isDeepStrictEqual(compileMockExamOffice(value),draft))throw Error('source_changed');
  }
  async function normalize<T>(action:()=>Promise<T>){
    try{return await action();}
    catch(error){if(error instanceof Error&&['version_conflict','not_confirmed'].includes(error.message))throw Error('source_changed');throw error;}
  }
  return {read,async validate(sessionId:string,draft:OfficeDraft,signal?:AbortSignal){
    if(draft.schemaVersion!==MOCK_EXAM_OFFICE_SCHEMA)throw Error('invalid_input');
    await normalize(async()=>assertDraft(await state.readConfirmed(sessionId,draft.mockExamSource),draft));
    signal?.throwIfAborted();
  },async verify(sessionId:string,draft:OfficeDraft,signal?:AbortSignal){
    if(draft.schemaVersion!==MOCK_EXAM_OFFICE_SCHEMA)throw Error('invalid_input');
    assertDraft(await read(sessionId,draft.mockExamSource,signal),draft);
  },async commit(sessionId:string,draft:OfficeDraft,install:()=>void,signal?:AbortSignal){
    if(draft.schemaVersion!==MOCK_EXAM_OFFICE_SCHEMA)throw Error('invalid_input');
    await normalize(async()=>{
      await read(sessionId,draft.mockExamSource,signal);
      await state.withConfirmed(sessionId,draft.mockExamSource,catalog=>{assertDraft(catalog,draft);install();});
    });
  }};
}

import type {MockExamCatalog,MockExamEntry,MockExamMetadata} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_EDIT_LIMIT,type MockExamEditDiff,type MockExamEditInput,type MockExamPatch} from '../../shared/mock-exam-edit';
import {catalogId,mockExamRevision,mockExamDigest,validMockExamMetadata} from '../../shared/mock-exam-compilation';
import {plainStudentInput} from '../../shared/student-context';
import {materialId} from '../../shared/materials';

const blank:MockExamMetadata={district:null,year:null,grade:null,subject:null,round:null};
const fields=Object.keys(blank) as (keyof MockExamMetadata)[];

function validPatch(raw:unknown):raw is MockExamPatch {
  if(!plainStudentInput(raw,['resourceId','include',...fields])||!materialId(raw.resourceId)||Object.keys(raw).length<2)return false;
  const {resourceId,include,...metadata}=raw;
  return (include===undefined||typeof include==='boolean')&&validMockExamMetadata({...blank,...metadata});
}

export function validMockExamEdit(raw:unknown):raw is MockExamEditInput {
  return plainStudentInput(raw,['catalogId','revision','digest','changes'])&&catalogId(raw.catalogId)&&mockExamRevision(raw.revision)&&
    mockExamDigest(raw.digest)&&Array.isArray(raw.changes)&&raw.changes.length>0&&raw.changes.length<=MOCK_EXAM_EDIT_LIMIT&&
    raw.changes.every(validPatch)&&new Set(raw.changes.map(item=>item.resourceId)).size===raw.changes.length;
}

export function planMockExamEdit(catalog:MockExamCatalog,input:MockExamEditInput) {
  if(catalog.summary.id!==input.catalogId||catalog.summary.revision!==input.revision||catalog.summary.digest!==input.digest)
    throw Error('version_conflict');
  const byResource=new Map(input.changes.map(change=>[change.resourceId,change]));
  const sources:MockExamEntry[]=[],diffs:MockExamEditDiff[]=[];
  const entries=catalog.entries.map(entry=>{
    const patch=byResource.get(entry.resourceId);
    if(!patch)return entry;
    byResource.delete(entry.resourceId);
    const {resourceId,include=entry.include,...changes}=patch;
    const metadata={...entry.metadata,...changes},inferred={...entry.inferred};
    if(include&&entry.permission==='excluded')throw Error('permission_denied');
    const {scope}=catalog;
    if(include&&(metadata.year!==null&&metadata.year!==scope.year||scope.subject&&metadata.subject&&metadata.subject!==scope.subject||
      scope.grade&&metadata.grade&&metadata.grade!==scope.grade))throw Error('scope_changed');
    const diff:MockExamEditDiff['fields']=[];
    const changedFields=fields.filter(name=>metadata[name]!==entry.metadata[name]);
    for(const name of changedFields){
      diff.push({name,before:entry.metadata[name],after:metadata[name]});
      if(metadata[name]===null)delete inferred[name];else inferred[name]='老师核对';
    }
    if(include!==entry.include)diff.push({name:'include',before:entry.include,after:include});
    if(!diff.length)return entry;
    sources.push(entry);diffs.push({resourceId,title:entry.title,fields:diff});
    return {...entry,metadata,inferred,include,conflicts:entry.conflicts.filter(name=>metadata[name]===null||!changedFields.includes(name))};
  });
  if(byResource.size)throw Error('source_required');
  if(!diffs.length)throw Error('unchanged');
  const {summary:_,...previous}=catalog;
  return {snapshot:{...previous,entries},sources,diffs};
}

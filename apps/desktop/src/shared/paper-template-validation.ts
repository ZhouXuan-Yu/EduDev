import {plainStudentInput} from './student-context';
import {validPaperSession} from './paper-blueprint';
import {validBasketId, validBasketRevision} from './paper-basket';
import {validReferenceExtract} from './paper-reference';
import type {PaperTemplateSave, PaperTemplateTarget, PaperTemplateRef, PaperTemplateApply, PaperTemplateRead, PaperTemplateArrange} from './paper-template';
const request = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(v);
export const templateDigest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validTemplateRef(v: unknown): v is PaperTemplateRef {
  return plainStudentInput(v, ['templateId','version','digest']) && typeof v.templateId === 'string'
    && /^xitemplate_[a-f0-9-]{36}$/.test(v.templateId) && validBasketRevision(v.version) && templateDigest(v.digest);
}
export function validTemplateTarget(v: unknown): v is PaperTemplateTarget {
  return plainStudentInput(v,['sessionId','basketId']) && validPaperSession(v.sessionId) && validBasketId(v.basketId);
}
export function validTemplateRead(v: unknown): v is PaperTemplateRead {
  if (!plainStudentInput(v,['sessionId','basketId','templateId','version','digest'])) return false;
  return validTemplateTarget({sessionId:v.sessionId,basketId:v.basketId}) && validTemplateRef({templateId:v.templateId,version:v.version,digest:v.digest});
}
export function validTemplateSave(v: unknown): v is PaperTemplateSave {
  if (!plainStudentInput(v,['schemaVersion','sessionId','basketId','basketRevision','requestId','resourceId','version',
    'expectedCandidateDigest','expectedHeadVersion','templateId','name','kind','derivedFrom','patches'])) return false;
  const {expectedCandidateDigest,expectedHeadVersion,templateId,name,kind,derivedFrom,patches,...extract} = v;
  return validReferenceExtract(extract) && templateDigest(expectedCandidateDigest) && Number.isSafeInteger(expectedHeadVersion)
    && Number(expectedHeadVersion)>=0 && Number(expectedHeadVersion)<1000000 && (templateId === undefined || typeof templateId === 'string' && /^xitemplate_[a-f0-9-]{36}$/.test(templateId))
    && typeof name === 'string' && !!name.trim() && name.length<=160 && !/[\x00-\x1f]/.test(name)
    && (kind === 'structure' || kind === 'layout') && (derivedFrom === undefined || validTemplateRef(derivedFrom))
    && Array.isArray(patches) && patches.length<=180 && new Set(patches.map(p=>p?.path)).size===patches.length
    && patches.every(p=>plainStudentInput(p,['path','teacherValue','confirmed']) && typeof p.path==='string'
      && /^(title|subject|grade|durationMinutes|totalPoints|sections\.\d{1,2}\.(label|questionType|count|points|difficulty|knowledgePoint)|layout\.(paper|orientation|columns|top|right|bottom|left|columnGap))$/.test(p.path)
      && typeof p.teacherValue==='string' && p.teacherValue.length<=160 && !/[\x00-\x1f]/.test(p.teacherValue) && typeof p.confirmed==='boolean');
}
export function validTemplateApply(v: unknown): v is PaperTemplateApply {
  if (!plainStudentInput(v,['sessionId','basketId','requestId','expectedRevision','kind','structure','layout','mapping'])
    || !validTemplateTarget({sessionId:v.sessionId,basketId:v.basketId}) || !request(v.requestId) || !validBasketRevision(v.expectedRevision)) return false;
  if(v.kind==='layout') return v.structure===undefined && v.mapping===undefined && validTemplateRef(v.layout);
  if(v.kind!=='structure' && v.kind!=='both' || !validTemplateRef(v.structure)
    || (v.kind==='both' ? !validTemplateRef(v.layout) : v.layout!==undefined) || !Array.isArray(v.mapping) || v.mapping.length>40) return false;
  return v.mapping.every(m=>plainStudentInput(m,['templateSectionId','target','generatedCount']) && (m.generatedCount===undefined||Number.isSafeInteger(m.generatedCount)&&Number(m.generatedCount)>=0&&Number(m.generatedCount)<=100) && typeof m.templateSectionId==='string' && /^[a-zA-Z0-9_-]{1,40}$/.test(m.templateSectionId)
    && plainStudentInput(m.target,['kind','sectionId']) && ['existing','new'].includes(String(m.target.kind))
    && typeof m.target.sectionId==='string' && /^[a-zA-Z0-9_-]{1,40}$/.test(m.target.sectionId));
}
export function validTemplateArrange(v: unknown): v is PaperTemplateArrange {
  return plainStudentInput(v,['sessionId','basketId','requestId','expectedRevision','operation'])
    && validTemplateTarget({sessionId:v.sessionId,basketId:v.basketId}) && request(v.requestId) && validBasketRevision(v.expectedRevision)
    && plainStudentInput(v.operation,['kind','sectionId','entryId']) && (v.operation.kind==='release-empty'
      ? typeof v.operation.sectionId==='string' && /^[a-zA-Z0-9_-]{1,40}$/.test(v.operation.sectionId) && v.operation.entryId===undefined
      : v.operation.kind==='accept-points' && typeof v.operation.entryId==='string' && /^xibasketentry_[a-f0-9-]{36}$/.test(v.operation.entryId) && v.operation.sectionId===undefined);
}

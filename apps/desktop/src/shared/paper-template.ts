import type {PaperBlueprint} from './paper-blueprint';
import type {PaperLayout} from './paper-layout';
import type {PaperReferenceCandidate, PaperReferenceExtractInput} from './paper-reference';

export const PAPER_TEMPLATE_SCHEMA = 'xiaozhi.paper-template.v1' as const;
export type PaperTemplateRef = {templateId: string; version: number; digest: string};
/** Patches contain teacher decisions only. Source, evidence and scope are host owned. */
export type PaperTemplatePatch = {path: string; teacherValue: string; confirmed: boolean};
export type PaperTemplateSave = PaperReferenceExtractInput & {
  expectedCandidateDigest: string; requestId: string; expectedHeadVersion: number;
  templateId?: string; name: string; kind: 'structure' | 'layout';
  derivedFrom?: PaperTemplateRef; patches: PaperTemplatePatch[];
};
export type PaperTemplateVersion = PaperTemplateRef & {
  schemaVersion: typeof PAPER_TEMPLATE_SCHEMA; name: string; studentId: string;
  kind: 'structure' | 'layout'; derivedFrom?: PaperTemplateRef;
  candidate: PaperReferenceCandidate; candidateDigest: string; structure?: PaperBlueprint; layout?: PaperLayout;
};
export type PaperTemplateReceipt = {
  requestId: string; operation: 'save' | 'apply';
  template?: PaperTemplateRef; basketId?: string; basketRevision?: number;
};
export type PaperTemplateMapping = {templateSectionId: string; generatedCount?:number; target:
  | {kind: 'existing'; sectionId: string}
  | {kind: 'new'; sectionId: string}};
export type PaperTemplateApply = {sessionId: string; basketId: string; expectedRevision: number; requestId: string} & (
  | {kind: 'structure'; structure: PaperTemplateRef; mapping: PaperTemplateMapping[]}
  | {kind: 'layout'; layout: PaperTemplateRef}
  | {kind: 'both'; structure: PaperTemplateRef; layout: PaperTemplateRef; mapping: PaperTemplateMapping[]});
export type PaperTemplateTarget = {sessionId: string; basketId: string};
export type PaperTemplateRead = PaperTemplateTarget & PaperTemplateRef;
export type PaperTemplateArrange = PaperTemplateTarget & {requestId: string; expectedRevision: number;
  operation: {kind: 'release-empty'; sectionId: string} | {kind: 'accept-points'; entryId: string}};
export type PaperTemplateResult<T> = {ok: true; value: T} | {ok: false; error: string};
export type PaperTemplateUnavailable = {template:PaperTemplateRef;reason:'source_changed'|'permission_denied'|'unavailable'};
export type PaperTemplateListResult = {versions:PaperTemplateVersion[];unavailable:PaperTemplateUnavailable[]};
export type PaperTemplateApi = {
  listPaperTemplates(input: PaperTemplateTarget): Promise<PaperTemplateResult<PaperTemplateListResult>>;
  readPaperTemplate(input: PaperTemplateRead): Promise<PaperTemplateResult<PaperTemplateVersion>>;
  savePaperTemplateVersion(input: PaperTemplateSave): Promise<PaperTemplateResult<PaperTemplateReceipt>>;
  applyPaperTemplates(input: PaperTemplateApply): Promise<PaperTemplateResult<PaperTemplateReceipt>>;
  arrangePaperTemplateRetained(input: PaperTemplateArrange): Promise<PaperTemplateResult<PaperTemplateReceipt>>;
  cancelPaperTemplateOperation(input: PaperTemplateTarget & {requestId: string}): Promise<PaperTemplateResult<boolean>>;
};

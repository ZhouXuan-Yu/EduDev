import { createHash } from 'node:crypto';
import type { PersonalMemoryKind as MemoryKind, PersonalMemoryScope } from '../../../shared/xiaozhi-personal-memory';

type MemoryScope = Readonly<PersonalMemoryScope>;
type Purpose = 'index' | 'discover' | 'extract' | 'use';

export type CandidateAuthority = Readonly<{ policyRevision: number; cancelGeneration: number; teacherPolicyRevision?: number }>;

export function sameCandidatePolicy(a: CandidateAuthority, b: CandidateAuthority) {
  return a.policyRevision===b.policyRevision && (a.teacherPolicyRevision??0)===(b.teacherPolicyRevision??0);
}

export type PersonalMemorySource = Readonly<{
  id: string;
  sourceVersion: string;
  generation: number;
  policyRevision: number;
  role: 'teacher' | 'assistant' | 'tool' | 'quotedThirdParty';
  purpose: readonly Purpose[];
  scope: MemoryScope;
  term: string;
  sanitizedText: string;
}>;

export type ExistingMemoryWitness = Readonly<{
  id: string;
  revision: number;
  kind: MemoryKind;
  scope: MemoryScope;
  term: string;
}>;

type Projection = Readonly<{
  id: string;
  version: number;
  scope: MemoryScope;
  term: string;
  text: string;
}>;

type SourcePin = Readonly<{ sourceVersion: string; textDigest: string; projection: Projection }>;

const manifestVersion = 'xiaozhi.personal-memory-extraction.v1';
const requestBindings = new WeakMap<object, { pins: ReadonlyMap<string, SourcePin>; targets: ReadonlyMap<string, ExistingMemoryWitness> }>();

export type PersonalMemoryManifest = Readonly<{
  schemaVersion: typeof manifestVersion;
  authority: CandidateAuthority;
  sources: readonly Projection[];
  targets: readonly ExistingMemoryWitness[];
}>;

type Proposal = {
  kind: MemoryKind;
  source_id: string;
  source_version: number;
  scope_id: string;
  valid_term: string;
  supporting_quote: string;
  value: string;
  supersedes: string | null;
};

type Rejection = 'invalid_schema' | 'source_unavailable' | 'source_changed' | 'stale_policy' | 'cancelled'
  | 'scope_mismatch' | 'term_mismatch' | 'ungrounded' | 'invalid_target' | 'conflicting_proposals';

export type PersonalMemoryDraft = Readonly<{
  key: string;
  state: 'pending';
  kind: MemoryKind;
  proposedValue: string;
  scope: MemoryScope;
  term: string;
  authority: CandidateAuthority;
  witness: Readonly<{ sourceId: string; sourceVersion: string; generation: number; textDigest: string; start: number; end: number }>;
  replaces: ExistingMemoryWitness | null;
}>;

const idPattern = /^[a-z0-9][a-z0-9_-]{0,179}$/i;
const versionPattern = /^[a-f0-9]{64}$/;
const maximumSources = 12;
const maximumDrafts = 20;
const maximumBytes = 32 * 1024;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const safeId = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value);
const bounded = (value: unknown, length: number): value is string =>
  typeof value === 'string' && value.length <= length && !!value.trim();

function sameScope(a: MemoryScope, b: MemoryScope) {
  return a.kind === b.kind && a.id === b.id;
}

function authorized(source: PersonalMemorySource, policyRevision: number) {
  return source.role === 'teacher' && source.policyRevision === policyRevision && source.purpose.includes('extract');
}

function parseProposal(value: unknown): Proposal | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const p = value as Partial<Proposal>;
  if (Object.keys(p).length !== 8 || (p.kind !== 'teaching_context' && p.kind !== 'preference')
      || !safeId(p.source_id) || !integer(p.source_version) || !safeId(p.scope_id) || !bounded(p.valid_term, 80)
      || !bounded(p.supporting_quote, 320) || !bounded(p.value, 320) || (p.supersedes !== null && !safeId(p.supersedes))) return;
  return p as Proposal;
}

export function preparePersonalMemoryExtraction(sources: readonly PersonalMemorySource[], authority: CandidateAuthority,
  targets: readonly ExistingMemoryWitness[] = []): PersonalMemoryManifest {
  if (!integer(authority.policyRevision) || !integer(authority.cancelGeneration) || !integer(authority.teacherPolicyRevision??0))
    throw Error('invalid_authority');
  if (sources.length > maximumSources || targets.length > maximumDrafts) throw Error('manifest_too_large');
  const pins = new Map<string, SourcePin>();
  let bytes = 0;
  for (const source of sources) {
    if (!authorized(source, authority.policyRevision)) continue;
    if (!safeId(source.id) || !versionPattern.test(source.sourceVersion) || !integer(source.generation) || !safeId(source.scope.id)
        || !bounded(source.term, 80) || !source.sanitizedText.trim() || pins.has(source.id)) throw Error('invalid_source_manifest');
    bytes += Buffer.byteLength(source.sanitizedText, 'utf8');
    if (bytes > maximumBytes) throw Error('manifest_too_large');
    const projection = Object.freeze({id: source.id, version: source.generation, scope: Object.freeze({...source.scope}),
      term: source.term, text: source.sanitizedText});
    pins.set(source.id, {sourceVersion: source.sourceVersion, textDigest: hash(source.sanitizedText), projection});
  }
  const targetsById = new Map<string, ExistingMemoryWitness>();
  for (const target of targets) {
    if (!safeId(target.id) || !integer(target.revision) || targetsById.has(target.id)) throw Error('invalid_target_manifest');
    targetsById.set(target.id, Object.freeze({...target, scope: Object.freeze({...target.scope})}));
  }
  const manifest = Object.freeze({ schemaVersion: manifestVersion, authority: Object.freeze({...authority}),
    sources: Object.freeze([...pins.values()].map(pin => pin.projection)), targets: Object.freeze([...targetsById.values()]) });
  requestBindings.set(manifest, { pins, targets: targetsById });
  return manifest;
}

function createDraft(proposal: Proposal, pin: SourcePin, liveSource: PersonalMemorySource | undefined, authority: CandidateAuthority,
  pinnedTarget: ExistingMemoryWitness | undefined, liveTarget: ExistingMemoryWitness | undefined): PersonalMemoryDraft | Rejection {
  const projection = pin.projection;
  if (!liveSource || !authorized(liveSource, authority.policyRevision) || liveSource.sourceVersion !== pin.sourceVersion
      || !sameScope(liveSource.scope, projection.scope) || liveSource.term !== projection.term
      || liveSource.generation !== projection.version || proposal.source_version !== projection.version
      || hash(liveSource.sanitizedText) !== pin.textDigest) return 'source_changed';
  if (proposal.scope_id !== projection.scope.id) return 'scope_mismatch';
  if (proposal.valid_term !== projection.term) return 'term_mismatch';
  const start = projection.text.indexOf(proposal.supporting_quote);
  if (start < 0 || projection.text.lastIndexOf(proposal.supporting_quote) !== start) return 'ungrounded';
  if (proposal.supersedes && (!pinnedTarget || !liveTarget || pinnedTarget.revision !== liveTarget.revision
      || !sameScope(pinnedTarget.scope, projection.scope) || !sameScope(liveTarget.scope, pinnedTarget.scope)
      || pinnedTarget.kind !== proposal.kind || liveTarget.kind !== pinnedTarget.kind
      || pinnedTarget.term !== projection.term || liveTarget.term !== pinnedTarget.term)) return 'invalid_target';
  const end = start + proposal.supporting_quote.length;
  const witness = Object.freeze({ sourceId: proposal.source_id, sourceVersion: pin.sourceVersion, generation: projection.version,
    textDigest: pin.textDigest, start, end });
  const key = hash(JSON.stringify([proposal.kind, witness, projection.scope, projection.term, proposal.supersedes]));
  return Object.freeze({key, state:'pending', kind:proposal.kind, proposedValue:proposal.value,
    scope:projection.scope, term:projection.term, authority, witness, replaces:pinnedTarget ?? null});
}

/** Admission returns drafts only. The commit transaction must check authorization and versions again. */
export function bindPersonalMemoryProposals(results: unknown, manifest: PersonalMemoryManifest,
  current: readonly PersonalMemorySource[], authority: CandidateAuthority, targets: readonly ExistingMemoryWitness[] = []):
  {candidates: PersonalMemoryDraft[]; rejections: Rejection[]} {
  const bindings = requestBindings.get(manifest);
  if (!bindings) throw Error('invalid_source_manifest');
  if (!Array.isArray(results)) throw Error('invalid_candidate_result');
  if (results.length > maximumDrafts) throw Error('result_too_large');
  if (!sameCandidatePolicy(authority,manifest.authority)) return {candidates: [], rejections: ['stale_policy']};
  if (authority.cancelGeneration !== manifest.authority.cancelGeneration) return {candidates: [], rejections: ['cancelled']};
  const sourceNow = new Map(current.map(source => [source.id, source]));
  const targetNow = new Map(targets.map(target => [target.id, target]));
  const valid = new Map<string, PersonalMemoryDraft>();
  const conflicts = new Set<string>();
  const rejections: Rejection[] = [];
  for (const result of results) {
    const proposal = parseProposal(result);
    if (!proposal) { rejections.push('invalid_schema'); continue; }
    const pin = bindings.pins.get(proposal.source_id);
    if (!pin) { rejections.push('source_unavailable'); continue; }
    const draft = createDraft(proposal, pin, sourceNow.get(proposal.source_id), manifest.authority,
      proposal.supersedes ? bindings.targets.get(proposal.supersedes) : undefined,
      proposal.supersedes ? targetNow.get(proposal.supersedes) : undefined);
    if (typeof draft === 'string') { rejections.push(draft); continue; }
    if (conflicts.has(draft.key)) continue;
    const prior = valid.get(draft.key);
    if (prior && prior.proposedValue !== draft.proposedValue) {
      valid.delete(draft.key);
      conflicts.add(draft.key);
      rejections.push('conflicting_proposals');
    } else if (!prior) valid.set(draft.key, draft);
  }
  return {candidates: [...valid.values()], rejections};
}

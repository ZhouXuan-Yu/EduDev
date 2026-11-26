import {MIN_RELIABLE_SAMPLES, pareto, type EvidenceProfile} from './evidence';
import type {CapabilityResolution, ProviderSelection} from '../types';

export type Candidate = {selection: ProviderSelection; metrics: EvidenceProfile; health:'CLOSED'|'OPEN'|'HALF_OPEN'};
export type SelectionPolicy = {preferredProvider?:string; preference:'reliability'|'latency'|'quality'; minimumQuality?:number};
export type Rerank = (candidates: readonly Candidate[], signal: AbortSignal) => Promise<unknown>;
export type Confidence = 'HIGH_CONFIDENCE'|'AMBIGUOUS'|'INSUFFICIENT_EVIDENCE';
type Advice = {candidate: Candidate|null; confidence: Confidence; reason:string; ai:'skipped'|'needed'|'selected'|'rejected'};

function eligible(candidates: readonly Candidate[], minimumQuality?: number) {
    return candidates.filter(candidate => candidate.health === 'CLOSED' && (minimumQuality === undefined
        || candidate.metrics.qualityCount >= MIN_RELIABLE_SAMPLES && (candidate.metrics.quality ?? -1) >= minimumQuality));
}

function validChoice(raw: unknown, offered: readonly Candidate[]) {
    if (!raw || typeof raw !== 'object' || Object.keys(raw).sort().join(',') !== 'confidence,providerId') return null;
    const choice = raw as {providerId?:unknown;confidence?:unknown};
    return choice.confidence === 'supported' ? offered.find(item => item.selection.providerId === choice.providerId) ?? null : null;
}

export async function advise(candidates: readonly Candidate[], policy: SelectionPolicy, signal?: AbortSignal, rerank?: Rerank): Promise<Advice> {
    const safe = eligible(candidates,policy.minimumQuality);
    const preferred = safe.find(item => item.selection.providerId === policy.preferredProvider);
    if (!safe.length) return {candidate:null,confidence:'INSUFFICIENT_EVIDENCE',reason:'no_eligible_candidate',ai:'skipped'};
    if (preferred || safe.length === 1) return {candidate:preferred ?? safe[0],confidence:'HIGH_CONFIDENCE',
        reason:preferred ? 'developer_preference' : 'single_candidate',ai:'skipped'};
    if (safe.some(item => !item.metrics.trusted)) return {candidate:safe[0],confidence:'INSUFFICIENT_EVIDENCE',reason:'cold_or_stale',ai:'skipped'};
    const frontier = pareto(safe,item=>({latency:item.metrics.ewmaLatencyMs!,reliability:item.metrics.reliability!,
        quality:item.metrics.qualityCount >= MIN_RELIABLE_SAMPLES ? item.metrics.quality : null}));
    if (frontier.length === 1) return {candidate:frontier[0],confidence:'HIGH_CONFIDENCE',reason:'pareto_dominant',ai:'skipped'};
    const score = (item: Candidate) => {
        const quality = item.metrics.qualityCount >= MIN_RELIABLE_SAMPLES ? item.metrics.quality ?? 0 : 0;
        const latency = 1 / (1 + item.metrics.ewmaLatencyMs! / 1000);
        const reliability = item.metrics.reliability!;
        return policy.preference === 'quality' ? 0.55*quality+0.35*reliability+0.1*latency
            : policy.preference === 'latency' ? 0.60*latency+0.35*reliability+0.05*quality
                : 0.60*reliability+0.35*latency+0.05*quality;
    };
    const ranked = frontier.sort((a,b)=>score(b)-score(a));
    const winner = ranked[0];
    if (score(winner)-score(ranked[1])>=0.12 && winner.selection.level===ranked[1].selection.level) {
        return {candidate:winner,confidence:'HIGH_CONFIDENCE',reason:'evidence_margin',ai:'skipped'};
    }
    const fallback: Advice = {candidate:winner,confidence:'AMBIGUOUS',reason:'meaningful_tradeoff',ai:'needed'};
    if (!rerank) return fallback;
    const offered = ranked.slice(0,4);
    const bound = AbortSignal.any([AbortSignal.timeout(1200),...(signal?[signal]:[])]);
    try {
        const choice = await new Promise<Candidate|null>((resolve,reject)=>{
            const abort=()=>reject(bound.reason);
            if(bound.aborted){abort();return;}
            bound.addEventListener('abort',abort,{once:true});
            void Promise.resolve().then(()=>rerank(structuredClone(offered),bound)).then(
                value=>resolve(validChoice(value,offered)),reject).finally(()=>bound.removeEventListener('abort',abort));
        });
        return choice ? {...fallback,candidate:choice,ai:'selected'} : {...fallback,ai:'rejected'};
    } catch {return {...fallback,ai:'rejected'};}
}

export function capabilityGap(resolution: CapabilityResolution) {
    return resolution.selectedProviders.length ? undefined : {capabilityId:resolution.capabilityId,
        reasons:resolution.blockedReasons, required: [...new Set(resolution.excludedProviders.flatMap(item=>item.missingRequirements))],
        next: resolution.status === 'blocked_permission' ? 'review_current_authority' : 'resolve_or_acquire',
    };
}

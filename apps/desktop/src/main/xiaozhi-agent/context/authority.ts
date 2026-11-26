import type {SessionManager} from '@earendil-works/pi-coding-agent';
import {protocolHash} from '../capabilities/validation';

type History = Pick<SessionManager,'getBranch'>;
export type ContextFacts = {p0: readonly string[]; p1: readonly string[]; effectInProgress:boolean};
type Candidate = {summary:string; firstKeptEntryId:string; tokensBefore:number; details?:unknown};
export const PI_CONTEXT_ENGINE = 'pi-native@1.0.2';

function meaningful(history: History) {
    return history.getBranch().filter(entry=>entry.type==='message' || entry.type==='compaction').map(entry=>entry.id);
}

export function createContextAdapter(history: History, readFacts: () => Promise<ContextFacts> = async()=>({p0:[],p1:[],effectInProgress:false})) {
    let lease: symbol|undefined;
    return {
        async begin(reason:'manual'|'threshold'|'overflow'|'before_request', signal?:AbortSignal) {
            signal?.throwIfAborted();
            if(lease)throw Error('compaction_busy');
            const currentLease=Symbol('compaction');
            lease=currentLease;
            const release=()=>{if(lease===currentLease)lease=undefined;};
            try {
                const facts=await readFacts();
                if(facts.effectInProgress || facts.p0.length>512 || facts.p1.length>512)throw Error('compaction_busy');
                signal?.throwIfAborted();
                const before=meaningful(history);
                const last=history.getBranch().findLast(entry=>entry.type==='compaction');
                const started=performance.now();
                let published=false;
                async function validate<T extends Candidate>(draft:T, commitSignal?:AbortSignal):Promise<T> {
                    signal?.throwIfAborted();
                    commitSignal?.throwIfAborted();
                    if(lease!==currentLease||published)throw Error('compaction_failed');
                    const current=await readFacts();
                    if(current.effectInProgress || protocolHash(current)!==protocolHash(facts))throw Error('compaction_failed');
                    signal?.throwIfAborted();
                    commitSignal?.throwIfAborted();
                    const cut=before.indexOf(draft.firstKeptEntryId);
                    const prior=last ? before.indexOf(last.firstKeptEntryId) : -1;
                    if(protocolHash(meaningful(history))!==protocolHash(before) || cut<1 || cut<=prior
                        || typeof draft.summary!=='string' || !draft.summary.trim() || Buffer.byteLength(draft.summary)>512*1024
                        || !Number.isSafeInteger(draft.tokensBefore) || draft.tokensBefore<1)throw Error('compaction_failed');
                    published=true;
                    const details=draft.details&&typeof draft.details==='object'&&!Array.isArray(draft.details)?draft.details:{};
                    return {...draft,details:{...details,xiaozhiContext:{schemaVersion:1,engine:PI_CONTEXT_ENGINE,reason,
                        first:before[Math.max(0,prior)],last:before[cut-1],cut:draft.firstKeptEntryId,
                        previousSummary:last?.id??null,authority:{p0:facts.p0,p1:facts.p1},
                        elapsedMs:performance.now()-started}}};
                }
                return {validate,release};
            } catch(error){release();throw error;}
        },
        previous() {return history.getBranch().findLast(entry=>entry.type==='compaction')??null;},
    };
}

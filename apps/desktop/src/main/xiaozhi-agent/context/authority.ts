import type {SessionManager} from '@earendil-works/pi-coding-agent';
import {protocolHash} from '../capabilities/validation';

type History = Pick<SessionManager,'getBranch'>;
export type ContextFacts = {p0: readonly string[]; p1: readonly string[]; effectInProgress:boolean};
type Candidate = {summary:string; firstKeptEntryId:string; tokensBefore:number; details?:unknown};
export const PI_CONTEXT_ENGINE = 'pi-native@1.0.2';

type Branch = ReturnType<History['getBranch']>;
function contributesContext(entry: Branch[number]) {
    return entry.type==='message' || entry.type==='compaction' || entry.type==='custom_message' || entry.type==='branch_summary';
}

function contextCut(branch: Branch, id: string) {
    const rawIndex=branch.findIndex(entry=>entry.id===id);
    if(rawIndex<0 || !branch.slice(rawIndex).some(contributesContext))return -1;
    return branch.slice(0,rawIndex).filter(contributesContext).length;
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
                const branch=history.getBranch();
                const before=branch.filter(contributesContext).map(entry=>entry.id);
                const last=branch.findLast(entry=>entry.type==='compaction');
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
                    // Pi can keep adjacent native metadata before the first retained
                    // message. Compare the effective context positions on the captured
                    // branch while preserving Pi's exact entry ID in the checkpoint.
                    const cut=contextCut(branch,draft.firstKeptEntryId);
                    const prior=last ? contextCut(branch,last.firstKeptEntryId) : -1;
                    const now=history.getBranch();
                    if(branch.some((entry,index)=>entry.id!==now[index]?.id)
                        || protocolHash(now.filter(contributesContext).map(entry=>entry.id))!==protocolHash(before)
                        || cut<1 || cut<=prior || last && prior<0
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

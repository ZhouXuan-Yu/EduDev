import type {Sql} from '../../session-state';
import type {JournalOwner} from '../../events/journal';
import type {TaskView} from '../../../../shared/xiaozhi-task';
import type {CapabilityRegistry} from '../registry';
import type {CapabilityRequirement, CapabilityResolution} from '../types';
import type {ProviderSnapshot} from '../provider-contract';
import {CORE_ADAPTER_VERSION,coreAdapterDefinition} from '../adapters/core';
import {adapterIsolation,assertDeveloperAdapterPolicy} from '../adapters/security';
import type {AdapterRegistry} from '../adapters/registry';
import {protocolHash} from '../validation';
import {healthScopes,type ProviderHealth} from './health';
import {advise,capabilityGap,type Candidate,type Rerank,type SelectionPolicy} from './selection';

const TABLE='xiaozhi_d2_resolver_decisions_v1';
const POLICY_VERSION='xiaozhi.d2.shadow.v1';
const maxCandidates=8;
export type ResolverObservation = {request:CapabilityRequirement; resolution:CapabilityResolution; snapshot:ProviderSnapshot|null; cached:boolean};

export function createResolverShadow(options: {sql:Sql; registry:CapabilityRegistry; health:ProviderHealth; enabled?:boolean;
    adapters?:AdapterRegistry;
    rerank?: (sessionId:string, candidates:Parameters<Rerank>[0],signal:AbortSignal)=>Promise<unknown>}) {
    let initialization: Promise<unknown>|undefined;
    const pending=new Set<Promise<void>>();
    const fingerprints=new Map<string, {hash:string; expires:number}>();
    const rerankedTasks=new Set<string>();
    function observe(owner:JournalOwner, task:TaskView, observation:ResolverObservation, signal?:AbortSignal) {
        if (options.enabled === false || pending.size >= 8 || task.sessionId !== owner.sessionId) return;
        const {request,resolution,snapshot,cached}=observation;
        const id=protocolHash([owner,task.id,request,task.planRevision,task.requirementsVersion]);
        const hash=protocolHash([resolution,snapshot?.snapshotId??null,cached,options.health.revision(),options.adapters?.revision()??0]);
        if(fingerprints.get(id)?.hash===hash && fingerprints.get(id)!.expires>Date.now())return;
        fingerprints.set(id,{hash,expires:Date.now()+15_000});
        if(fingerprints.size>128)fingerprints.delete(fingerprints.keys().next().value!);
        const job = (async()=>{
            const began=performance.now();
            const candidates:Candidate[]=[];
            const extraExcluded:{providerId:string;reason:string}[]=[];
            const original=resolution.selectedProviders[0]?.providerId??null;
            for(const selection of [...resolution.selectedProviders,...resolution.alternatives].slice(0,maxCandidates)){
                const version=await options.registry.providerVersion(selection.providerId,selection.providerVersion,request.capabilityId);
                if(!version || version.revoked){extraExcluded.push({providerId:selection.providerId,reason:'source_changed'});continue;}
                try {
                    const target=await options.registry.executionBinding(request.capabilityId,selection.providerId,selection.providerVersion,version.provider.source.packageHash);
                    const registered=options.adapters?.find(target.provider.adapterId,CORE_ADAPTER_VERSION);
                    const adapter=registered??coreAdapterDefinition(target.provider.adapterId);
                    const stateOfAdapter=options.adapters?.stateOf(target.provider.adapterId,CORE_ADAPTER_VERSION);
                    if(!adapter || stateOfAdapter && stateOfAdapter!=='available'){
                        extraExcluded.push({providerId:selection.providerId,reason:'adapter_unavailable'});continue;
                    }
                    assertDeveloperAdapterPolicy(adapter,adapterIsolation(adapter,process.platform),target);
                    const health=await Promise.all(healthScopes(target,CORE_ADAPTER_VERSION).map(scope=>options.health.view(scope)));
                    const state=health[0].state==='OPEN'||health[1].state==='OPEN'||health[2].state==='OPEN'?'OPEN'
                        :health.some(item=>item.state==='HALF_OPEN')?'HALF_OPEN':'CLOSED';
                    candidates.push({selection,metrics:health[2],health:state});
                } catch(error) {extraExcluded.push({providerId:selection.providerId,
                    reason:error instanceof Error&&error.message==='permission_denied'?'developer_policy':'no_current_binding'});}
            }
            const preference:SelectionPolicy['preference']=task.planning?.level===3?'reliability':'latency';
            const rerank:Rerank|undefined=options.rerank&&!rerankedTasks.has(task.id)&&rerankedTasks.size<256
                ? (items,abort)=>{
                    if(rerankedTasks.has(task.id))return Promise.resolve(null);
                    rerankedTasks.add(task.id);
                    return options.rerank!(owner.sessionId,items,abort);
                }:undefined;
            const projected = cached && candidates.some(item=>item.selection.providerId===original && item.health==='CLOSED')
                ? {candidate:candidates.find(item=>item.selection.providerId===original),reason:'revalidated_task_snapshot',confidence:'HIGH_CONFIDENCE',ai:'skipped'}
                : await advise(candidates,{preference},signal,rerank);
            const record={schemaVersion:1,policyVersion:POLICY_VERSION,owner,taskId:task.id,requirementsVersion:task.requirementsVersion,
                planRevision:task.planRevision,capabilityId:request.capabilityId,contractVersion:request.contractVersion,
                requirementsHash:protocolHash(request),source:{hard:'developer_and_contract',requested:'planner',soft:'developer_default',
                    teacherEvidence:task.sources.map(source=>({reference:source.actionId??source.messageId,version:source.version}))},
                registryRevision:resolution.registryRevision,snapshotId:snapshot?.snapshotId??null,previousSnapshotId:snapshot?.previousSnapshotId??null,
                refreshReason:snapshot?.refreshReason??null,candidates,excluded:resolution.excludedProviders,extraExcluded,preference,
                selected:original,suggested:projected.candidate?.selection.providerId??null,reason:projected.reason,
                confidence:projected.confidence,ai:projected.ai,gap:capabilityGap(resolution),durationMs:performance.now()-began};
            await (initialization ??= options.sql.run(`CREATE TABLE IF NOT EXISTS ${TABLE} (
                sequence INTEGER PRIMARY KEY, created_at INTEGER NOT NULL, document_json TEXT NOT NULL)`).catch(error=>{initialization=undefined;throw error;}));
            if(!options.sql.transaction)throw Error('configuration');
            await options.sql.transaction(async work=>{
                await work.run(`INSERT INTO ${TABLE}(created_at,document_json) VALUES(?,?)`,[Date.now(),JSON.stringify(record)]);
                await work.run(`DELETE FROM ${TABLE} WHERE sequence <= (SELECT MAX(sequence)-512 FROM ${TABLE})`);
            });
        })().catch(()=>{fingerprints.delete(id);});
        pending.add(job);
        void job.finally(()=>pending.delete(job));
    }
    return {observe, async drain(){await Promise.all(pending);}};
}

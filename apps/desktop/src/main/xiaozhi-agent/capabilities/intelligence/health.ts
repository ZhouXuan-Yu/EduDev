import {BrokenCircuitError, CircuitState, ConsecutiveBreaker, circuitBreaker, handleWhen} from 'cockatiel';
import type {Sql} from '../../session-state';
import {protocolHash} from '../validation';
import {HEALTH_SAMPLE_LIMIT, HEALTH_WINDOW_MS, profile, type RuntimeSample, type QualitySample} from './evidence';

export type HealthScope = {kind:'adapter'|'instance'|'binding'; id:string; version:string; sourceHash:string};
const TABLE = 'xiaozhi_d2_provider_health_v1';
const OPEN_MS = 30_000;
const FAULTS = new Set(['process_crashed','process_exited','connection_failed','ECONNREFUSED','ECONNRESET',
    'ETIMEDOUT','timeout','extension_start_failed','extension_transport','mcp_process_failed','upstream_5xx']);
export function classifyProviderObservation(error: unknown): 'fault'|'ignored' {
    if (!error || typeof error !== 'object') return 'ignored';
    const {code, message, status} = error as {code?: string; message?: string; status?: number};
    return FAULTS.has(code || '') || FAULTS.has(message || '') || (typeof status === 'number' && status >= 500 && status <= 599) ? 'fault' : 'ignored';
}

type HealthDocument = {runtime: RuntimeSample[]; quality: QualitySample[]; breaker?: unknown; openedAt?: number};
class ObservedFault extends Error {}

export function createProviderHealth(sql: Sql, now = Date.now, cooldownMs=OPEN_MS) {
    let initialization: Promise<unknown> | undefined;
    let revision=0;
    function ready() {
        return initialization ??= sql.run(`CREATE TABLE IF NOT EXISTS ${TABLE} (
            scope_key TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, document_json TEXT NOT NULL, document_hash TEXT NOT NULL
        )`).catch(error => {initialization=undefined;throw error;});
    }
    async function read(work: Sql, key: string): Promise<HealthDocument> {
        const row = (await work.all(`SELECT document_json,document_hash FROM ${TABLE} WHERE scope_key=?`, [key]))[0];
        if (!row) return {runtime:[],quality:[]};
        const value = JSON.parse(String(row.document_json)) as HealthDocument;
        if (!Array.isArray(value.runtime) || !Array.isArray(value.quality) || protocolHash(value) !== row.document_hash) throw Error('d2_health_corrupt');
        return value;
    }
    function circuit(value: HealthDocument) {
        return circuitBreaker(handleWhen(error => error instanceof ObservedFault), {
            breaker:new ConsecutiveBreaker(3), halfOpenAfter:cooldownMs, ...(value.breaker ? {initialState:value.breaker} : {}),
        });
    }
    async function update(scope: HealthScope, operation: (value: HealthDocument, at: number) => Promise<boolean|void>) {
        await ready();
        if (!sql.transaction) throw Error('configuration');
        const key = protocolHash(scope);
        const updated=await sql.transaction(async work => {
            const at = now();
            const value = await read(work,key);
            // Old fault events cannot affect a newly assessed runtime.
            if (value.runtime.at(-1) && at - value.runtime.at(-1)!.at >= HEALTH_WINDOW_MS) {
                value.runtime = []; delete value.breaker; delete value.openedAt;
            }
            if(await operation(value,at)===false)return false;
            await work.run(`INSERT INTO ${TABLE}(scope_key,updated_at,document_json,document_hash) VALUES(?,?,?,?)
                ON CONFLICT(scope_key) DO UPDATE SET updated_at=excluded.updated_at,document_json=excluded.document_json,document_hash=excluded.document_hash`,
                [key, at, JSON.stringify(value), protocolHash(value)]);
            await work.run(`DELETE FROM ${TABLE} WHERE scope_key IN (SELECT scope_key FROM ${TABLE} ORDER BY updated_at DESC,scope_key LIMIT -1 OFFSET 1024)`);
            return true;
        });
        if(updated)revision++;
    }
    return {
        revision:()=>revision,
        async view(scope: HealthScope) {
            await ready();
            const value = await read(sql,protocolHash(scope));
            const at = now();
            const metrics = profile(value.runtime,value.quality,at);
            const state = value.openedAt === undefined || !metrics.count ? 'CLOSED' : at - value.openedAt >= cooldownMs ? 'HALF_OPEN' : 'OPEN';
            return {state, trust: metrics.trusted ? 'OBSERVED' as const : 'UNKNOWN' as const, ...metrics};
        },
        async observe(scope: HealthScope, latencyMs: number, outcome: 'success'|'fault', source:'call'|'probe'='call') {
            if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
            await update(scope, async (value, at) => {
                if(source==='probe'&&value.runtime.some(item=>item.source==='probe'&&at-item.at<OPEN_MS))return false;
                const policy = circuit(value);
                try {await policy.execute(() => {if (outcome === 'fault') throw new ObservedFault();});}
                catch(error) {if (!(error instanceof ObservedFault || error instanceof BrokenCircuitError)) throw error;}
                const opened = policy.state === CircuitState.Open || policy.state === CircuitState.HalfOpen;
                const snapshot = policy.toJSON() as {ownState?:{openedAt?:number}};
                if (opened) value.openedAt = snapshot.ownState?.openedAt || value.openedAt || at;
                else delete value.openedAt;
                value.breaker = snapshot;
                value.runtime.push({at, latencyMs, ok:outcome === 'success', ...(source==='probe'?{source}:{})});
                value.runtime = value.runtime.slice(-HEALTH_SAMPLE_LIMIT);
            });
        },
        async recordQuality(scope: HealthScope, sample: Omit<QualitySample,'at'>) {
            if (!/^[a-zA-Z0-9_.:-]{1,256}$/u.test(sample.evidence)) throw Error('invalid_input');
            await update(scope, async (value, at) => {
                value.quality.push({...sample,at});
                value.quality = value.quality.slice(-HEALTH_SAMPLE_LIMIT);
            });
        },
    };
}
export type ProviderHealth = ReturnType<typeof createProviderHealth>;
export function healthScopes(target: import('../adapters/contract').AdapterTarget, version: string): HealthScope[] {
    return [
        {kind:'adapter',id:target.provider.adapterId,version,sourceHash:target.provider.adapterId.startsWith('community.') ? target.binding.providerHash : ''},
        {kind:'instance',id:target.provider.id+':'+target.instance.id,version:target.binding.providerVersion,sourceHash:target.binding.providerHash},
        {kind:'binding',id:[target.definition.id,target.provider.id,target.instance.id].join(':'),version:target.binding.providerVersion,sourceHash:target.binding.providerHash},
    ];
}

export function createHealthObserver(health:ProviderHealth) {
    const pending=new Set<Promise<void>>();
    return {
        observe(target:import('../adapters/contract').AdapterTarget, version:string, latencyMs:number, result:{ok:true}|{ok:false;error:unknown},source:'call'|'probe'='call'){
            if(pending.size>=32 || !result.ok && classifyProviderObservation(result.error)==='ignored')return;
            const scopes=healthScopes(target,version);
            const error=result.ok?null:result.error as {message?:string;code?:string}|null;
            const code=error?.code||error?.message;
            const relevant = result.ok ? scopes : scopes.filter(scope=> scope.kind==='binding'
                || scope.kind==='instance' && ['process_crashed','process_exited','connection_failed','ECONNREFUSED','ECONNRESET'].includes(code||'')
                || scope.kind==='adapter' && ['extension_start_failed','extension_transport','mcp_process_failed'].includes(code||''));
            const job=Promise.all(relevant.map(scope=>health.observe(scope,latencyMs,result.ok?'success':'fault',source))).then(()=>undefined,()=>undefined);
            pending.add(job);
            void job.finally(()=>pending.delete(job));
        },
        async drain(){await Promise.all(pending);},
    };
}

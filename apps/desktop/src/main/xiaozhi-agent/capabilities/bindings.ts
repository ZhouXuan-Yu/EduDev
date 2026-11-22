import type {Sql} from '../session-state';
import type {CapabilityBinding, CapabilityDefinition, ProviderManifest} from './types';
import {validCapabilityBinding} from './validation';

const table = 'xiaozhi_capability_binding_controls_v1';
type BindingState = 'disabled'|'revoked';

export function bindingMatches(definition: CapabilityDefinition, provider: ProviderManifest, binding: CapabilityBinding) {
    return validCapabilityBinding(binding) && binding.capabilityId === definition.id && binding.providerId === provider.id
        && binding.contractVersion === definition.contractVersion && binding.providerVersion === provider.version
        && binding.providerHash === provider.source.packageHash;
}

export function bindingVerification(definition: CapabilityDefinition, provider: ProviderManifest, binding: CapabilityBinding) {
    const supported = new Set(binding.conformance.evidence.filter(item => item.supported && item.kind !== 'self_declared').map(item => item.requirementId));
    const missing = definition.requirements.required.map(item => item.id).filter(id => !supported.has(id));
    const compatible = bindingMatches(definition, provider, binding);
    return {compatible,
        verified: compatible && provider.source.verification === 'verified' && binding.conformance.level !== 'incompatible' && !missing.length,
        missing, limitations: [...new Set([...definition.limitations, ...binding.conformance.limitations])],
        evidence: structuredClone(binding.conformance.evidence)};
}

export function createBindingControls(sql: Sql) {
    return {
        migrate: () => sql.run(`CREATE TABLE IF NOT EXISTS ${table}(capability_id TEXT NOT NULL, provider_id TEXT NOT NULL,
            state TEXT NOT NULL CHECK(state IN ('disabled','revoked')), PRIMARY KEY(capability_id,provider_id))`),
        async read(capabilityId: string, providerId: string): Promise<BindingState | undefined> {
            const row = (await sql.all(`SELECT state FROM ${table} WHERE capability_id=? AND provider_id=?`, [capabilityId, providerId]))[0];
            if (!row) return undefined;
            if (row.state === 'disabled' || row.state === 'revoked') return row.state;
            throw Error('capability_binding_control_corrupt');
        },
        async set(capabilityId: string, providerId: string, state: BindingState | 'enabled') {
            if (state === 'enabled') {
                await sql.run(`DELETE FROM ${table} WHERE capability_id=? AND provider_id=?`, [capabilityId, providerId]);
            } else {
                await sql.run(`INSERT INTO ${table}(capability_id,provider_id,state) VALUES(?,?,?)
                    ON CONFLICT(capability_id,provider_id) DO UPDATE SET state=excluded.state`, [capabilityId, providerId, state]);
            }
        },
    };
}

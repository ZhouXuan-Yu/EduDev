import assert from 'node:assert/strict';
import type {OmniEduStore} from '../../src/main/db';
import {createAcquisitionState} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {nativeStatDeclarations} from '../../src/main/xiaozhi-agent/capabilities/native-stat';
import {createCapabilityRegistry} from '../../src/main/xiaozhi-agent/capabilities/registry';
import {createCapabilityResolver} from '../../src/main/xiaozhi-agent/capabilities/resolver';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation';

export const controlName = '合成能力 · 必需与可选';
export const candidateName = '合成能力 · 待核验目录候选';

export async function seedCapabilityControls(store: OmniEduStore) {
  const registry = createCapabilityRegistry(store.xiaozhiState.sql);
  await registry.migrate();
  const native = nativeStatDeclarations()[0];
  const definition = {...native.definition, id:'edu.fixture.c1', name:controlName};
  const missingRequired = 'mcp.fixture.c1-required';
  const missingOptional = 'mcp.fixture.c1-optional';

  for (const [id, requirements] of [[missingRequired, []], [missingOptional, ['file_metadata', 'mime_required']]] as const) {
    const provider = {...native.provider, id, type:'mcp', runtime:'managed', publisher:{id:'fixture', official:false}} as const;
    const binding = {
      ...native.binding, capabilityId:definition.id, providerId:id,
      conformance:{
        ...native.binding.conformance, capabilityId:definition.id,
        evidence:requirements.map(requirementId=>({requirementId, supported:true, kind:'adapter_detected' as const, reference:provider.source.reference})),
      },
    };
    await registry.register(definition, provider, binding);
  }
  const resolved = await createCapabilityResolver(registry, async()=>true).resolve({
    capabilityId:definition.id, contractVersion:definition.contractVersion,
    required:[], optional:[], conditions:[], localOnly:true, platform:process.platform, budget:{latencyMs:30000, resourceUnits:1},
  });
  const eligible = [...resolved.selectedProviders, ...resolved.alternatives].map(item=>item.providerId);
  assert(resolved.excludedProviders.some(item=>item.providerId===missingRequired && item.reasons.includes('missing_required')));
  assert(!eligible.includes(missingRequired));
  assert(eligible.includes(missingOptional));
  assert(resolved.acceptedLimitations.includes('missing:mime'));

  const identity = {source:'reviewed', externalId:'phase7-fixture-c1-reviewed', version:'1.0.0'} as const;
  await createAcquisitionState(store.xiaozhiState.sql).cache([{
    ...identity, id:'xicandidate_' + protocolHash(identity), name:candidateName,
    description:'Synthetic reviewed-cache descriptor. No bytes installed or execution authorized.',
    repository:null, packageName:'synthetic-review-only', transport:'unknown',
    sourceHash:protocolHash({fixture:identity.externalId}), fetchedAt:new Date().toISOString(),
    expiresAt:new Date(Date.now() + 3600000).toISOString(),
  }]);
  return {controlName, candidateName, missingRequired, missingOptional, eligible};
}

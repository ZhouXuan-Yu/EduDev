import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {workspaceHash} from '../../src/main/xiaozhi-agent/workspace-authority';
import {createAcquisitionState} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation';
import type {CapabilityCandidate} from '../../src/shared/xiaozhi-acquisition';
import {seedCapabilityControls} from './phase7-capability-fixture-seed';

export async function seedWorkbenchFixture(root: string, control: string, token: string, capabilityControls = false) {
  const dataRoot = path.join(root, 'data'), workspace = path.join(root, 'owned-workspace'); fs.mkdirSync(workspace, {recursive: true});
  const source = Buffer.from('Synthetic teaching note. No personal or student information.'); fs.writeFileSync(path.join(workspace, 'source.txt'), source);
  const store = new OmniEduStore(dataRoot); await store.init();
  const host = createXiaozhiProductionHost({store, dataRoot, enabled: true, emit() {}});
  const ids: Record<string, unknown> = {dataRoot, workspace, notes: 'All sessions and teaching text are synthetic. Legacy records are explicit original-state compatibility fixtures, not evidence that a historical tool was executed.'};
  const scenario = async (tools: unknown[]) => {const result = await fetch(control, {method: 'POST', headers: {'content-type': 'application/json', 'x-fixture-token': token}, body: JSON.stringify({tools})}); assert(result.ok);};
  async function run(name: string, tools: unknown[] = []) {
    const sessionId = (await store.createAiConversationSession({title: name, folderId: null})).session.id;
    await store.xiaozhiState.setWorkspace(sessionId, workspace, 'owned-workspace');
    await scenario(tools);
    const started = await host.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '这是独立的合成教学核对任务。只按提供的合成步骤操作；无需真实外部资料。'});
    assert(started.ok, JSON.stringify(started)); await host.waitForRun(sessionId, started.runId);
    const snapshot = await host.taskSnapshot({sessionId}); assert(snapshot.ok && snapshot.value.task, JSON.stringify(snapshot));
    return {sessionId, runId: started.runId, task: snapshot.value.task, candidate: snapshot.value.candidate, canAccept: snapshot.value.canAccept};
  }
  try {
    const completed = await run('已确认样本 · 已完成');
    assert(completed.candidate && completed.canAccept, 'Original plain answer must have an actual review candidate');
    const reviewed = await host.reviewTask({schema: 'xiaozhi.task.v1', sessionId: completed.sessionId, taskId: completed.task.id,
      revision: completed.task.revision, requirementsVersion: completed.task.requirementsVersion, requestId: 'xitact_' + randomUUID(), candidate: completed.candidate,
      checked: completed.task.criteria.filter(item => item.kind === 'human').map(item => ({criterionId: item.id, version: item.version, accepted: true}))});
    assert(reviewed.ok, JSON.stringify(reviewed)); ids.completed = {...completed, task: reviewed.value.task};
    ids.continuation = await run('核对样本 · 同任务继续');
    ids.remaining = await run('恢复样本 · 尚有剩余步骤', [{name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1,
      reason: '保留一项明确尚未执行的合成成果，供教师选择继续', planningLevel: 2, capabilityRequirements: [],
      steps: [{id: 'owned_output', text: '准备本地合成教案', dependsOn: [], reported: 'pending', kind: 'saved_text', target: 'remaining-output.txt'},
        {id: 'teacher_check', text: '教师核对', dependsOn: ['owned_output'], reported: 'pending', kind: 'human'}]}}]);
    const pending = await run('审批样本 · 现代权限申请', [{name: 'exec_command', input: {cmd: "Write-Output 'SYNTHETIC_PERMISSION_ONLY'"}}]);
    ids.permission = {...pending, approvals: (await host.permissions.view(pending.sessionId)).approvals};
    assert((ids.permission as {approvals: unknown[]}).approvals.length, 'Actual original tool must create a permission request');
    const legacy = await run('兼容样本 · 历史复制申请');
    const approval = await store.xiaozhiState.createApproval(legacy.sessionId, legacy.runId,
      {callId: 'legacy_fixture_' + randomUUID(), source: 'source.txt', target: 'legacy-pending.txt', sourceSha256: createHash('sha256').update(source).digest('hex')}, workspaceHash(workspace));
    const uncertain = await store.xiaozhiState.createApproval(legacy.sessionId, legacy.runId,
      {callId: 'legacy_fixture_' + randomUUID(), source: 'source.txt', target: 'legacy-uncertain.txt', sourceSha256: createHash('sha256').update(source).digest('hex')}, workspaceHash(workspace));
    fs.writeFileSync(path.join(workspace, 'legacy-uncertain.txt'), source);
    await store.xiaozhiState.transition(uncertain.id, ['pending'], 'approved');
    await store.xiaozhiState.transition(uncertain.id, ['approved'], 'executing');
    await store.xiaozhiState.transition(uncertain.id, ['executing'], 'uncertain');
    ids.legacy = {...legacy, pendingApprovalId: approval.id, uncertainApprovalId: uncertain.id};
    const acquisition = createAcquisitionState(store.xiaozhiState.sql); await acquisition.migrate();
    const candidates: CapabilityCandidate[] = [];
    for (const expired of [false, true]) {
      const candidate: CapabilityCandidate = {id: '', source: 'community', externalId: 'phase7-owned-' + expired, name: expired ? '合成候选 · 核验已过期' : '合成候选 · 来源待核对',
        description: 'Only cached metadata; no download or install approval.', version: '1.0.0', repository: null, packageName: 'synthetic-uninstalled-package', transport: 'unknown',
        sourceHash: protocolHash({expired}), fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + (expired ? -60000 : 3600000)).toISOString()};
      candidate.id = 'xicandidate_' + protocolHash({source: candidate.source, externalId: candidate.externalId, version: candidate.version}); candidates.push(candidate);
    }
    await acquisition.cache(candidates); ids.candidates = candidates;
    if (capabilityControls) ids.capabilityControls = await seedCapabilityControls(store);
    for (const version of ['1.0.0', '2.0.0']) await host.skillGovernanceMutate({action: 'create', draft: {name: 'phase7-review-flow', description: '合成教学核对流程', version,
      document: '# 合成核对流程 ' + version + '\n核对教师要求，保留来源，按实际结果检查。', dependencies: [], permissionRequirements: []}});
    await host.skillGovernanceMutate({action: 'team_create', name: '合成教研组'});
    let skills = await host.skillGovernanceView(), personal = skills.skills.find(item => item.name === 'phase7-review-flow' && item.scope === 'personal'); assert(personal);
    await host.skillGovernanceMutate({action: 'share', skillId: personal.id, version: '1.0.0', revision: personal.revision});
    skills = await host.skillGovernanceView(); const review = skills.reviews.find(item => item.status === 'pending'); assert(review);
    await host.skillGovernanceMutate({action: 'review', reviewId: review.id, revision: review.revision, approve: true});
    skills = await host.skillGovernanceView(); personal = skills.skills.find(item => item.id === personal!.id)!;
    await host.skillGovernanceMutate({action: 'share', skillId: personal.id, version: '2.0.0', revision: personal.revision});
    ids.skills = await host.skillGovernanceView();
    ids.summary = await store.readWorkbench(async sql => ({sessions: await sql.all('SELECT id,title FROM ai_conversation_sessions WHERE archived_at IS NULL'),
      runs: await sql.all('SELECT id,session_id,status FROM ai_agent_runs'),
      approvals: await sql.all('SELECT id,session_id,action_type FROM ai_confirmation_items')}));
    fs.writeFileSync(path.join(root, 'FIXTURE_IDS.json'), JSON.stringify(ids, null, 2));
    return ids;
  } finally {await host.close(); await store.close();}
}

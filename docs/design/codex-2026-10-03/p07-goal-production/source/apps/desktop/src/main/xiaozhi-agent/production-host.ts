import fs from 'node:fs';
import {createGoalRuntime,createGoalController} from './goal-coordinator';
import {publicGoal} from './goal-state';
import {createAttachmentCoordinator} from './attachment-coordinator';
import {createAttachmentImportService} from './attachment-import-service';
import {publicAttachment} from './attachment-state';
import {attachmentStartHash} from './attachment-send-state';
import {createAttachmentReadTools} from './attachment-read-tools';
import {createPublicImageRuntime} from './public-image-runtime';
import {PUBLIC_IMAGE_APPROVE,PUBLIC_IMAGE_REJECT} from '../../shared/xiaozhi-public-images';
import {validXiaozhiStart,ATTACHMENT_ONLY_PROMPT} from '../../shared/xiaozhi-start';
import {createPiWebTools} from './web-tools';
import {createXiaozhiBrowserHost} from './browser-host';
import {createPiBrowserTools} from './browser-tools';
import type {XiaozhiWebInput} from '../../shared/xiaozhi-web';
import {createOfficeDocumentTools,sanitizeOfficeDocumentText} from './office-document-tools';
import path from 'node:path';
import { publicEducationSkills } from './education-skills';
import { createManagedEducationSkills } from './managed-skills';
import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import type { XiaozhiSkill } from '../../shared/xiaozhi-skills';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createNativeModelSwitch, type ModelSwitchStage } from './native-model-switch';
import type { PiXiaozhiOptions } from './pi-session';
import type { XiaozhiModelCapabilities } from '../../shared/xiaozhi-agent';
import type { OmniEduStore } from '../db';
import { createEducationTools } from './education-tools';
import { applyXiaozhiEvent, XIAOZHI_ERRORS } from '../../shared/xiaozhi-projection';
import { createPiApprovalCoordinator } from './approval-coordinator';
import { createTextChangeService } from './text-change-service';
import { createTextChangeCoordinator } from './text-change-coordinator';
import { changeSummary } from './text-change-state';
import {createOfficeArtifactCoordinator} from './office-artifact-coordinator';
import {createOfficeArtifactService} from './office-artifact-service';
import {officeSummary} from './office-artifact-state';
import type {OfficeArtifactDecision,OfficeArtifactResult,OfficeArtifactSummary} from '../../shared/xiaozhi-office-artifacts';
import type { XiaozhiChangeDecision, XiaozhiChangeResult, XiaozhiChangeSummary } from '../../shared/xiaozhi-changes';
import { publicApproval } from './persistent-state';
import { publicControl } from './control-state';
import { createPiControlCoordinator } from './control-tools';
import { DEFAULT_PI_BUDGET, validPiBudget } from './budget-state';
import type { XiaozhiBudgetInput, XiaozhiUsage } from '../../shared/xiaozhi-agent';
import { authorizedWorkspace } from './workspace-authority';
import { getPiProtectedContext } from './compaction-context';
import type { XiaozhiCompactInput } from '../../shared/xiaozhi-agent';
import { readDeepSeekCapabilities, resolveDeepSeekCapabilities,fetchDeepSeekCatalogue } from './model-capabilities';
import { createModelSettings, type SettingsKeyCodec } from './model-settings';
import type { XiaozhiSettingsInput, XiaozhiSessionModelInput, XiaozhiCredentialInput } from '../../shared/xiaozhi-settings';
import { createQueueMutationHandler } from './queue-mutations';
import { createPiMemoryScope } from './memory-scope';
import { validMemoryScopeInput } from './memory-selection';
import type { XiaozhiMemoryScopeInput } from '../../shared/xiaozhi-memory';
import type { XiaozhiActionResult, XiaozhiQueueInput } from '../../shared/xiaozhi-agent';
import type { OfficeProjectedTurn, OfficeProjection } from '../../shared/office-agent';
import type { XiaozhiAgentError, XiaozhiAgentEvent, XiaozhiAgentEventPayload, XiaozhiStartInput, XiaozhiStartResult, XiaozhiWorkspaceSnapshot } from '../../shared/xiaozhi-agent';

type Agent = Awaited<ReturnType<typeof import('./pi-session')['createPiXiaozhiSession']>>;
type Active = { runId: string; commandId: string; goalId?:string; operation: 'prompt' | 'compact'; turn: OfficeProjectedTurn; agent?: Agent; stopped: boolean; abort: AbortController; sequence: number; done?: Promise<void>; instructions:Set<string>; usage:XiaozhiUsage; usageWrites:Promise<void> };
const validId = (id: unknown): id is string => typeof id === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(id);
const inside = (root: string, target: string) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

export function createXiaozhiProductionHost(options: { store: OmniEduStore; dataRoot: string; emit: (event: XiaozhiAgentEvent) => void;
  /** Main-only acceptance seam; packaged IPC never installs it. */
  afterCompactCommit?: () => Promise<void>; afterAutoCompactCommit?: () => Promise<void>; beforeAutoCompactCommit?: () => Promise<void>;
  afterInstructionDispatch?: (signal: AbortSignal) => Promise<void>;
  /** Main-only isolated acceptance cut; packaged IPC never supplies it. */
  afterTextChangeStage?: (stage: 'intent' | 'file' | 'undo-intent' | 'undo-file') => Promise<void>;
  afterOfficeArtifactStage?: (stage:'prepared'|'intent'|'file'|'fact')=>Promise<void>;
  afterAttachmentSendStage?: (stage:'claimed'|'committed')=>Promise<void>;
  autoCompaction?: boolean; testContextWindow?: number; settingsCodec?: SettingsKeyCodec;
  afterModelSwitchStage?: (stage:ModelSwitchStage)=>Promise<void> }) {
  const { store } = options;
  const root = path.join(options.dataRoot, 'xiaozhi-pi');
  const active = new Map<string, Active>();
  const starting = new Map<string, { hash: string; result: Promise<XiaozhiStartResult> }>();
  const choosing = new Set<string>();
  const configuring = new Set<string>();
  const queueing = new Map<string,{hash:string;result:Promise<XiaozhiActionResult>}>();
  const enabled = process.env.OMNI_EDU_XIAOZHI_PI !== '0';
  const browser=createXiaozhiBrowserHost({root:path.join(root,'browser-captures'),sanitize:text=>sanitizeOfficeDocumentText(store,text)});
  const memory = createPiMemoryScope(store, { modelAccess: 'available' });
  let closing = false;
  let skillsMutating = false;
  const localSettingsJobs = new Set<Promise<unknown>>();
  const settingsBusy = () => Boolean(closing || skillsMutating || active.size || starting.size || choosing.size || configuring.size);
  const attachments=createAttachmentCoordinator({store,dataRoot:options.dataRoot,closing:()=>closing,
    reserve:id=>{if(closing||skillsMutating||active.has(id)||starting.size||choosing.has(id)||configuring.size)return false;choosing.add(id);return true;},
    release:id=>{choosing.delete(id);}});
  const modelSettings = createModelSettings({ store, root, codec: options.settingsCodec, busy: settingsBusy,
    assertMutation: () => { if (closing || !configuring.has('provider')) throw new Error('busy'); }, switchBound });
  async function mutateSettings<T>(action: () => Promise<T>): Promise<T> {
    if (settingsBusy()) throw new Error('busy');
    configuring.add('provider'); // Reserve synchronously, including network validation time.
    try { return await action(); } finally { configuring.delete('provider'); }
  }
  const managedSkills = createManagedEducationSkills({ root: path.join(root, 'skills'), state: store.xiaozhiState,
    assertIdle: () => { if (closing || active.size || choosing.size || configuring.size) throw new Error('busy'); } });
  const skillsReady = managedSkills.initialize();
  void skillsReady.catch(() => undefined);
  async function publicSkills(): Promise<XiaozhiSkill[]> {
    await skillsReady;
    const catalog = await managedSkills.catalog(), builtin = publicEducationSkills();
    return Promise.all(catalog.skills.filter(item => item.enabled && !item.archived).map(async item => {
      const known = builtin.find(skill => skill.name === item.name);
      if (known) return known;
      let instructions = '';
      try { instructions = parseFrontmatter((await managedSkills.preview(item.name)).document).body; } catch { /* Source error is projected by the run; keep snapshot readable. */ }
      return { name: item.name, title: item.title, description: item.description, instructions,
        supports: ['本轮已注册的教育与授权资料工具', '教师可编辑正文草稿'] };
    }));
  }
  async function manageSkill<T>(action: () => Promise<T>): Promise<T> {
    if (closing || skillsMutating || active.size || starting.size || choosing.size || configuring.size) throw new Error('busy');
    skillsMutating = true;
    try { await skillsReady; return await action(); } finally { skillsMutating = false; }
  }
  const publicEvent = (id: string, run: Active, payload: XiaozhiAgentEventPayload) => {
    const event = { ...payload, sessionId: id, runId: run.runId, sequence: ++run.sequence } as XiaozhiAgentEvent;
    run.turn = applyXiaozhiEvent(run.turn, event); try { options.emit(event); } catch { /* UI lifetime does not own execution. */ }
  };
  const approvals = createPiApprovalCoordinator({ store, dataRoot: options.dataRoot,
    isCurrent: (id, run) => !closing && active.get(id)?.runId === run && !active.get(id)?.stopped,
    emit: (id, runId, payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id, run, payload); } });
  const textChanges = createTextChangeCoordinator({ state: store.xiaozhiState.changes,
    sanitize: async text => (await store.sanitizeProblemText(text)).sanitizedText,
    service: createTextChangeService({ state: store.xiaozhiState.changes, dataRoot: options.dataRoot,
      afterStage: options.afterTextChangeStage,
      workspace: async id => {
        if (!validId(id) || closing || choosing.has(id)) throw new Error('permission_denied');
        const detail = await store.getAiConversationSession(id), grant = await store.xiaozhiState.workspace(id);
        if (closing || choosing.has(id) || detail.session.archivedAt) throw new Error('permission_denied');
        return grant?.path || null;
      },
      isCurrent: (id, runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    }),
    isCurrent: (id, runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    emit: (id, runId, payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id, run, payload); },
  });
  const officeArtifacts=createOfficeArtifactCoordinator({state:store.xiaozhiState.officeArtifacts,
    sanitize:text=>sanitizeOfficeDocumentText(store,text),
    service:createOfficeArtifactService({state:store.xiaozhiState.officeArtifacts,dataRoot:options.dataRoot,
      workspace:async id=>(await host.resolveFileWorkspace(id)).path,
      isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
      afterStage:options.afterOfficeArtifactStage,
      onState:artifact=>{for(const [id,run] of active)if(run.runId===artifact.runId){publicEvent(id,run,{kind:'office_artifact',artifact});break;}}
    }),
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    emit:(id,runId,payload)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,payload);}
  });
  const controls = createPiControlCoordinator({ store,
    isCurrent:(id,runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    emit:(id,runId,payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id,run,payload); },
    resume:async (item,answer):Promise<XiaozhiActionResult> => {
      const outcome = await host.start({ sessionId:item.sessionId,commandId:item.id.replace('pictrl_','xicmd_'),
        prompt:`继续上次中断的教师澄清。上次问题：${item.text}\n教师回答：${answer}\n只按本次回答继续任务；旧复制、旧审批及未完成效果不要自动重放，所有文件效果需要新确认。` });
      return outcome.ok ? {ok:true} : outcome;
    } });
  async function snapshot(id = '',settlementRead=0): Promise<XiaozhiWorkspaceSnapshot> {
    if (id && !validId(id)) throw new Error('invalid_input');
    if (id) await recoverModel(id);
    const model = await modelSettings.model(id || undefined);
    const projection: OfficeProjection = { schemaVersion: 'xiaozhi.office.projection.v1', threadId: id, provider: 'deepseek',
      model, epoch: 1, sourceSequence: 0, needsHydration: false, hasMoreHistory: false, turns: [] };
    if (!id) return { enabled, projection, running: false, legacyHistory: false };
    const detail = await store.getAiConversationSession(id);
    const binding = await store.xiaozhiState.getBinding(id); if (binding) projection.model = binding.model;
    const modelCapabilities = await readDeepSeekCapabilities(root, projection.model);
    const runs = new Map((await store.xiaozhiState.runs(id)).map(row => [String(row.id), row]));
    const messageAttachments=(await store.xiaozhiState.attachments.list(id)).filter(row=>row.state==='submitted').map(publicAttachment);
    let legacyHistory = false;
    for (const message of detail.messages) {
      if (message.role === 'user') {
        const runId = String(message.metadata.agentRunId || message.id), row = runs.get(runId);
        projection.turns.push({ id: runId, status: row?.status === 'running' ? 'running' : row?.status === 'failed' ? 'failed'
          : row?.status === 'blocked' ? 'interrupted' : 'completed',
          items: [{ id: message.id, kind: 'message', role: 'user', text: message.content,
            ...(messageAttachments.some(item=>item.messageId===message.id&&item.runId===runId)?{attachments:messageAttachments.filter(item=>item.messageId===message.id&&item.runId===runId)}:{}) }],
          ...(row?.error_message ? { error: String(row.error_message) } : {}) });
      } else if (message.role === 'assistant') {
        const turn = projection.turns.at(-1); if (!turn) continue;
        // Only host-owned Pi runs can supply a public segmented projection.
        const pi = runs.has(String(message.metadata.agentRunId)) && message.metadata.piVersion === 'xiaozhi.pi.education.v1';
        if (pi && Array.isArray(message.metadata.publicItems)) {
          turn.items.push(...message.metadata.publicItems as OfficeProjectedTurn['items']);
          turn.status = message.metadata.status === 'interrupted' ? 'interrupted' : message.metadata.ok === true ? 'completed' : 'failed';
          if (message.metadata.errorMessage) turn.error = String(message.metadata.errorMessage);
        } else {
          legacyHistory = true; turn.items.push({ id: message.id, kind: 'message', role: 'assistant', phase: 'final_answer', text: message.content });
          if (message.metadata.ok === false) { turn.status = 'failed'; turn.error = message.content; }
        }
      }
    }
    const workspace = await store.xiaozhiState.workspace(id);
    const storedApprovals = (await store.xiaozhiState.approvals(id)).map(publicApproval);
    const changes = (await store.xiaozhiState.changes.list(id)).map(changeSummary);
    const artifacts=(await store.xiaozhiState.officeArtifacts.list(id)).map(officeSummary);
    const interruptedSend = await store.xiaozhiState.interruptedSend(id);
    const storedControls = (await store.xiaozhiState.controls(id)).map(publicControl);
    const storedGoal=await store.xiaozhiState.goals.latest(id);
    const budgetSettings=await store.xiaozhiState.budgetSettings(id);
    const browserStatus=await browser.status(id);
    const usage=await store.xiaozhiState.usage(id);
    const memoryScope = await memory.scope(id);
    const skillCatalog = await publicSkills();
    for (const control of storedControls.filter(item=>item.kind === 'plan')) {
      const index=projection.turns.findIndex(turn=>turn.id === control.runId);
      if(index >= 0)projection.turns[index]=applyXiaozhiEvent(projection.turns[index],{kind:'control',control,sessionId:id,runId:control.runId,sequence:0});
    }
    // Merge active state after persisted reads; no await after this live snapshot.
    const current = active.get(id);
    // A run can finish while the asynchronous historical reads are in flight.
    // Refresh its durable result once instead of returning running=false with stale running history.
    if(!current&&settlementRead===0&&projection.turns.some(turn=>turn.status==='running'))return snapshot(id,1);
    if (current) {
      const index = projection.turns.findIndex(turn => turn.id === current.runId);
      if (index >= 0) projection.turns[index] = structuredClone(current.turn); else projection.turns.push(structuredClone(current.turn));
      projection.sourceSequence = current.sequence;
      const metrics=current.agent?.usage() || current.usage;
      const value={...metrics,runId:current.runId,state:current.usage.state};
      const indexUsage=usage.findIndex(item=>item.runId===current.runId);
      if(indexUsage>=0)usage[indexUsage]=value;else usage.push(value);
    }
    for (const metrics of usage) {
      const index = projection.turns.findIndex(turn => turn.id === metrics.runId);
      if (index >= 0) projection.turns[index] = applyXiaozhiEvent(projection.turns[index],
        { kind: 'usage', usage: metrics, sessionId: id, runId: metrics.runId, sequence: 0 });
    }
    return { enabled, projection, running: Boolean(current), ...(current?.operation === 'compact' ? { operation: 'compact' as const } : {}), legacyHistory: legacyHistory && !binding, interruptedSend,
      modelCapabilities, contextPolicy: current?.agent?.contextPolicy() || { auto: options.autoCompaction === true && Boolean(modelCapabilities), verified: Boolean(modelCapabilities),
        window: Math.min(modelCapabilities?.contextWindow || 32768, options.testContextWindow || Infinity), maxOutputTokens: Math.min(4096, modelCapabilities?.maxOutputTokens || 4096),
        ...(options.testContextWindow ? { testPolicy: true } : {}) },
      approvals: storedApprovals, changes, officeArtifacts:artifacts, controls:storedControls, ...(storedGoal?{goal:publicGoal(storedGoal)}:{}), budgetSettings, limitsEnforced:false, browser:browserStatus, usage, memoryScope, skills: skillCatalog, ...(workspace ? { workspace: { label: workspace.label } } : {}) };
  }
  function modelCoordinator(id:string,owner?:Active) {
    return createNativeModelSwitch({state:store.xiaozhiState.modelSwitch,root,
      assertIdle:()=>{ if (closing || (owner ? active.get(id)!==owner || owner.stopped || configuring.has('provider')
        : active.size || starting.size || choosing.size || skillsMutating || !configuring.has('provider'))) throw new Error('busy'); },
      assertAuthorized:async target=>{ if (target!==id || (await store.getAiConversationSession(id)).session.archivedAt) throw new Error('permission_denied'); },
      afterStage:options.afterModelSwitchStage});
  }
  const modelWrites=new Set<Promise<void>>();
  async function trackModelWrite(action:()=>Promise<void>) {
    const work=action();modelWrites.add(work);
    try{await work;}finally{modelWrites.delete(work);}
  }
  const recoveringModels=new Map<string,Promise<void>>();
  async function recoverModel(id:string) {
    if (settingsBusy()) return; // Reads during a run/configuration never own native mutation.
    const existing=recoveringModels.get(id); if(existing)return existing;
    const work=(async()=>{
      const ledger=await store.xiaozhiState.modelSwitch?.current(id); if(!ledger)return;
      if (!(await store.xiaozhiState.modelSwitch.transitions(id)).some(row=>row.status==='prepared')) return;
      await mutateSettings(()=>trackModelWrite(async()=>{ const file=path.resolve(root,ledger.sessionFile);
        if(!inside(root,file))throw new Error('configuration');
        const manager=SessionManager.open(file,path.dirname(file));
        await modelCoordinator(id).authorize(manager,id);
      }));
    })(); recoveringModels.set(id,work);
    try {await work;}finally{recoveringModels.delete(id);}
  }
  async function sessionConfiguration(id:string,settings:{apiKey:string;model:string},runId:string,capabilities:XiaozhiModelCapabilities|undefined,
    budget:PiXiaozhiOptions['budget'],cleanPrompt='',owner?:Active):Promise<PiXiaozhiOptions> {
    await skillsReady;
    const stateRoot=path.join(root,id), privateWorkspace=path.join(stateRoot,'workspace'); fs.mkdirSync(privateWorkspace,{recursive:true});
    const grant=await store.xiaozhiState.workspace(id), workspace=grant?authorizedWorkspace(grant.path,options.dataRoot):privateWorkspace;
    const binding=await store.xiaozhiState.getBinding(id), sessionFile=binding?path.resolve(root,binding.sessionFile):undefined;
    if(sessionFile && (!inside(root,sessionFile) || binding?.model!==settings.model))throw new Error('configuration');
    const ledger=await store.xiaozhiState.modelSwitch?.current(id), coordinator=modelCoordinator(id,owner);
    const web = await store.xiaozhiState.modelSettings.web();
    return {stateRoot,workspace,apiKey:settings.apiKey,model:settings.model,sessionFile,budget,limitsEnforced:false,capabilities,
      ...(owner?.goalId?{goal:createGoalRuntime({store,sessionId:id,goalId:owner.goalId,runId,
        current:()=>!closing&&active.get(id)===owner&&!owner.stopped,
        evidence:()=>owner.turn.items.filter(item=>item.kind==='tool'&&item.status==='completed'&&!['记录目标进度','更新任务计划','请教师补充'].includes(item.label||'')).map(item=>({runId,callId:item.id,label:(item.label||'已完成授权工具').slice(0,200)})),
        emit:goal=>{if(active.get(id)===owner)publicEvent(id,owner,{kind:'goal',goal});}})}:{}),
      ...(web.enabled?{webTools:createPiWebTools({workspace,sessionId:id,runId,dnsMode:web.dnsMode,limitsEnforced:false,
        sanitize:text=>sanitizeOfficeDocumentText(store,text),isCurrent:()=>!closing&&(!owner||active.get(id)===owner&&!owner.stopped)})}:{}),
      ...(web.enabled?{browserTools:wait=>createPiBrowserTools({host:browser,sessionId:id,dnsMode:web.dnsMode,
        current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        confirm:(question,signal,callId)=>wait(async()=>{const tool=controls.tools(id,runId).find(item=>item.name==='ask_teacher')!;
          const result=await tool.execute(callId,{question,options:['同意这次操作','拒绝这次操作']},signal,undefined,undefined as never);
          const content=result.content.find(item=>item.type==='text');if(!content||content.type!=='text')return false;
          return JSON.parse(content.text).answer==='同意这次操作';})})}:{}),
      attachmentTools:createAttachmentReadTools({sessionId:id,state:store.xiaozhiState.attachments,
        ocr:store.xiaozhiState.attachmentOcr,
        importer:createAttachmentImportService({dataRoot:options.dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,
          isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped}),
        isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        authorize:async row=>{const detail=await store.getAiConversationSession(id);
          return !detail.session.archivedAt&&detail.messages.some(message=>message.id===row.messageId&&message.role==='user'&&message.metadata.agentRunId===row.runId);},
        sanitize:text=>sanitizeOfficeDocumentText(store,text)}),
      attachmentOcr:true,
      publicImages:wait=>createPublicImageRuntime({sessionId:id,model:settings.model,
        inputCapable:Boolean(capabilities?.inputModalities?.includes('image')&&!capabilities.stale),state:store.xiaozhiState.attachments,
        importer:createAttachmentImportService({dataRoot:options.dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,
          isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped}),
        current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        authorize:async row=>{const detail=await store.getAiConversationSession(id);return !detail.session.archivedAt
          &&detail.messages.some(message=>message.id===row.messageId&&message.role==='user'&&message.metadata.agentRunId===row.runId);},
        sanitize:text=>sanitizeOfficeDocumentText(store,text),
        capabilities:async signal=>(await fetchDeepSeekCatalogue(root,settings.apiKey,signal)).models.find(item=>item.id===settings.model),
        confirm:(question,signal,callId)=>wait(async()=>{const tool=controls.tools(id,runId).find(item=>item.name==='ask_teacher')!;
          const result=await tool.execute(callId,{question,options:[PUBLIC_IMAGE_APPROVE,PUBLIC_IMAGE_REJECT]},signal,undefined,undefined as never);
          const content=result.content.find(item=>item.type==='text');return content?.type==='text'&&JSON.parse(content.text).answer===PUBLIC_IMAGE_APPROVE;}),
        emit:image=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'image_delivery',image});}}),
      educationSkills:true,managedSkills:{resources:()=>managedSkills.enabledResources(),sanitize:async text=>(await store.sanitizeProblemText(text)).sanitizedText},
      ...(!grant?{privateWorkspaceId:id}:approvals.callbacks(id,runId,workspace)),
      ...(grant ? { officeTextTools: wait => textChanges.tools(id, runId, wait),officeArtifactTools:wait=>officeArtifacts.tools(id,runId,wait),officeDocumentTools:createOfficeDocumentTools({sessionId:id,runId,
        resolve:target=>host.resolveFileWorkspace(target),isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        sanitize:text=>sanitizeOfficeDocumentText(store,text)}) } : {}),
      autoCompaction:options.autoCompaction,testContextWindow:options.testContextWindow,afterAutoCompactCommit:options.afterAutoCompactCommit,beforeAutoCompactCommit:options.beforeAutoCompactCommit,
      sanitizeFileText:async text=>(await store.sanitizeProblemText(text)).sanitizedText,protectedContext:excluded=>getPiProtectedContext(store,id,excluded),
      memory:{runId,authority:()=>memory.authority(id),readSelected:(authority,signal)=>memory.readSelected(id,authority,signal),trace:()=>memory.trace(id)},
      educationTools:createEducationTools(store,cleanPrompt),controlTools:controls.tools(id,runId),
      ...(ledger?{modelHistory:{authorize:manager=>coordinator.authorize(manager,id),
        beforeLoad:(manager,authority)=>coordinator.beforeAuthorityLoad(manager,ledger,authority),
        align:(session,authority)=>coordinator.alignAuthorityBranch(session,ledger,authority)}}:{})};
  }
  async function switchBound(input:XiaozhiSessionModelInput,target:XiaozhiModelCapabilities) {
    return trackModelWrite(async()=>{
    const id=input.sessionId, settings=await modelSettings.runtime(id), ledger=await store.xiaozhiState.modelSwitch.current(id);
    if(!settings.apiKey)throw new Error('authentication');
    if(ledger && ledger.revision!==input.version)throw new Error('conflict');
    const capabilities=await readDeepSeekCapabilities(root,settings.model);
    const base=await sessionConfiguration(id,{apiKey:settings.apiKey,model:settings.model},'ximodel_'+randomUUID(),capabilities,(await store.xiaozhiState.budgetSettings(id)).budget);
    const {createPiXiaozhiSession}=await import('./pi-session');
    const agent=await createPiXiaozhiSession({...base,switchTarget:target});
    try {
      const binding=await store.xiaozhiState.getBinding(id); if(!binding)throw new Error('configuration');
      const coordinator=modelCoordinator(id);
      const current=ledger || await coordinator.initialize(agent.session.sessionManager,{sessionId:id,sessionFile:binding.sessionFile,
        nativeSessionId:agent.sessionId,originModel:settings.model,model:settings.model,revision:input.version},true);
      agent.assertSwitchCapacity(target);
      const model=agent.registeredModel(target.id); if(!model)throw new Error('model_unavailable');
      await coordinator.switch(agent.session,current,model);
    } finally {agent.dispose();}
    });
  }
  async function execute(id: string, prompt: string, run: Active, settings: Pick<Awaited<ReturnType<OmniEduStore['getDeepSeekRuntimeSettings']>>, 'provider' | 'apiKey' | 'model'>) {
    let failure: XiaozhiAgentError | undefined, text = '';
    try {
      if (!settings.apiKey) throw new Error('authentication');
      if (run.stopped) throw new Error('cancelled');
      const cleanPrompt = (await store.sanitizeProblemText(prompt)).sanitizedText;
      const capabilities = await resolveDeepSeekCapabilities(root, settings.model, settings.apiKey, run.abort.signal);
      const { createPiXiaozhiSession } = await import('./pi-session');
      if (run.stopped) throw new Error('cancelled');
      const base=await sessionConfiguration(id,{apiKey:settings.apiKey,model:settings.model},run.runId,capabilities,run.usage.budget,cleanPrompt,run);
      run.agent = await createPiXiaozhiSession({ ...base, onEvent: event => {
          // Completion belongs to committed SQLite projection, not just model stop.
          if(event.kind === 'usage') {
            // SDK completion precedes the host's durable result/command commit.
            // Keep that interval recoverable; only the host can settle public usage.
            run.usage={...event.usage,runId:run.runId,state:['completed','interrupted','failed'].includes(event.usage.state) ? 'running' : event.usage.state};
            const saved=structuredClone(run.usage);
            run.usageWrites=run.usageWrites.then(()=>store.xiaozhiState.saveUsage(id,saved));
            if(run.goalId)run.usageWrites=run.usageWrites.then(async()=>{const goal=await store.xiaozhiState.goals.waiting(id,run.runId,saved.state==='waiting');if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});});
            // Attach a handler immediately; final settlement still treats a rejected write as failure.
            void run.usageWrites.catch(()=>undefined);
            publicEvent(id,run,{kind:'usage',usage:run.usage});
          } else if (event.kind !== 'status') publicEvent(id, run, event);
        },onInstructionDispatching:async controlId => {
          const claimed=await controls.dispatching(controlId); if(claimed)await options.afterInstructionDispatch?.(run.abort.signal); return claimed;
        },onInstructionApplied:async controlId => { await controls.applied(controlId); run.instructions.delete(controlId); } });
      if (!run.agent.sessionFile) throw new Error('configuration');
      // Fence legacy version-1 readers before any model/tool memory delivery.
      await store.xiaozhiState.setBinding(id, path.relative(root, run.agent.sessionFile), settings.model, 4);
      if (run.stopped) throw new Error('cancelled');
      const count=run.turn.items[0]?.attachments?.length||0;
      const deliveredPrompt=count?`${cleanPrompt}\n\n本轮有 ${count} 个已登记的本地附件。文件正文和图片尚未提供给你，请勿声称已阅读、查看或分析这些附件；需要读取时说明所需操作。`:cleanPrompt;
      const result = await (run.operation === 'compact' ? run.agent.compact() : run.agent.prompt(deliveredPrompt));
      if (run.operation === 'compact' && result.ok) await options.afterCompactCommit?.();
      if (result.ok) text = result.text; else failure = result.error;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      failure = code === 'authentication' || code === 'cancelled' || code === 'memory_scope_changed' || code === 'skill_source_changed' || code === 'skill_scope_changed' ? code : 'configuration';
    } finally {
      await run.agent?.dispose().catch(() => { failure ||= 'configuration'; });
      await controls.finish(id,run.runId).catch(() => { failure ||= 'configuration'; });
      await approvals.cancel(run.runId).catch(() => { failure ||= 'configuration'; });
      await textChanges.cancel(run.runId).catch(() => { failure ||= 'configuration'; });
      await officeArtifacts.cancel(run.runId).catch(()=>{failure||='configuration';});
      await store.xiaozhiState.approvals(id).then(async rows => {
        for (const row of rows) if (row.runId === run.runId && row.state === 'executing') await store.xiaozhiState.transition(row.id, ['executing'], 'uncertain');
      }).catch(() => { failure ||= 'configuration'; });
      if (run.stopped) failure = 'cancelled';
      await run.usageWrites.catch(()=>{failure ||= 'configuration';});
      const status: 'interrupted' | 'failed' | 'completed' = failure === 'cancelled' ? 'interrupted' : failure ? 'failed' : 'completed';
      const terminal = { kind: 'status' as const, status, ...(failure ? { error: failure } : {}) };
      run.turn = applyXiaozhiEvent(run.turn, { ...terminal, sessionId: id, runId: run.runId, sequence: run.sequence + 1 });
      const lastText = [...run.turn.items].reverse().find(item => item.kind === 'message' && item.role === 'assistant');
      if (!failure && text) {
        if (lastText) lastText.text = text;
        else run.turn.items.push({ id: `${run.runId}:final`, kind: 'message', role: 'assistant', phase: 'final_answer', text });
      }
      try {
        run.usage={...run.usage,state:status};
        await store.xiaozhiState.saveUsage(id,run.usage);
        for (const item of run.turn.items.filter(item => item.kind === 'tool')) {
          await store.recordAiAgentEvent(run.runId, { phase: 'observe', status: item.status === 'completed' ? 'succeeded' : 'failed',
            label: item.label || '授权工具', detail: item.status === 'completed' ? '工具实际执行完成。' : '工具没有完成。',
            outputSummary: { callId: item.id, status: item.status } });
        }
        await store.appendAiConversationMessage(id, { role: 'assistant', content: text || (failure ? XIAOZHI_ERRORS[failure] : XIAOZHI_ERRORS.model_error),
          metadata: { piVersion: 'xiaozhi.pi.education.v1', agentRunId: run.runId, provider: 'deepseek', model: settings.model,
            ok: !failure, status, errorMessage: failure ? XIAOZHI_ERRORS[failure] : '',
            publicItems: run.turn.items.filter(item => item.id !== run.turn.items[0]?.id) } });
        await store.recordAiAgentEvent(run.runId, { phase: 'finalize', status: failure ? 'failed' : 'succeeded',
          label: failure ? '小智未完成本轮' : '小智已完成', detail: failure ? XIAOZHI_ERRORS[failure] : '模型与工具流程已完成，回复已保存。' });
        await store.completeAiAgentRun(run.runId, failure === 'cancelled' ? 'blocked' : failure ? 'failed' : 'succeeded', failure ? XIAOZHI_ERRORS[failure] : '');
        await store.xiaozhiState.finishCommand(run.commandId);
        if(run.goalId){const goal=await store.xiaozhiState.goals.finish(id,run.runId,text,Boolean(failure));if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});}
        active.delete(id); publicEvent(id, run, terminal);
      } catch {
        // A failed commit must never be reported as completion; startup recovery owns unresolved rows.
        active.delete(id); publicEvent(id, run, { kind: 'status', status: 'failed', error: 'configuration' });
      }
    }
  }
  const host = {
    mutateGoal:createGoalController({store,closing:()=>closing,busy:id=>active.has(id)||choosing.has(id)||configuring.has(id)||configuring.has('provider')||skillsMutating||starting.size>0,
      stop:async(id,runId,goalId):Promise<unknown>=>{const owner=active.get(id);return owner?.runId===runId&&owner.goalId===goalId?await host.stop(id):undefined;},start:async(id,prompt,commandId,goalId):Promise<XiaozhiStartResult>=>await host.start({sessionId:id,prompt,commandId},'prompt',goalId)}),
    async resolveFileWorkspace(id:string) {
      if(!validId(id))throw new Error('invalid_input');
      if(closing || choosing.has(id))throw new Error('busy');
      const detail=await store.getAiConversationSession(id);
      if(detail.session.archivedAt)throw new Error('permission_denied');
      const grant=await store.xiaozhiState.workspace(id);if(!grant)throw new Error('no_workspace');
      if(closing||choosing.has(id))throw new Error('busy');
      if((await store.getAiConversationSession(id)).session.archivedAt)throw new Error('permission_denied');
      if(closing||choosing.has(id))throw new Error('busy');
      const directory=authorizedWorkspace(grant.path,options.dataRoot),stat=fs.statSync(directory);
      return {path:directory,label:grant.label,version:createHash('sha256').update(JSON.stringify([id,directory,stat.dev,stat.ino])).digest('hex')};
    },
    enabled, snapshot, decide: approvals.decide, answer:controls.answer,
    reviewTextChange: textChanges.review,
    reviewOfficeArtifact:officeArtifacts.review,
    reviseOfficeArtifact:officeArtifacts.revise,
    async decideOfficeArtifact(input:OfficeArtifactDecision):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
      if(input?.action!=='verify')return officeArtifacts.decide(input);
      try{return await host.withLocalSettingsJob(async assertCurrent=>{assertCurrent();return officeArtifacts.decide(input);});}catch{return {ok:false,error:'busy'};}
    },
    async decideTextChange(input: XiaozhiChangeDecision): Promise<XiaozhiChangeResult<XiaozhiChangeSummary>> {
      // Undo and recovery verification reserve the same global idle owner as local backups/settings.
      if (input?.action !== 'undo' && input?.action !== 'verify') return textChanges.decide(input);
      try { return await host.withLocalSettingsJob(async assertCurrent => { assertCurrent(); return textChanges.decide(input); }); }
      catch { return { ok: false, error: 'busy' }; }
    },
    // Local backup jobs share the existing global settings owner, including chooser time.
    // Quitting rejects late starts and waits for already-started filesystem work.
    withLocalSettingsJob<T>(action: (assertCurrent: () => void) => Promise<T>): Promise<T> {
      const assertCurrent = () => { if (closing || !configuring.has('provider')) throw new Error('busy'); };
      const work = mutateSettings(() => action(assertCurrent));
      localSettingsJobs.add(work);
      void work.finally(() => localSettingsJobs.delete(work)).catch(() => undefined);
      return work;
    },
    modelSettingsView: async(query?:{refresh?:boolean;sessionId?:string})=>{if(query?.sessionId)await recoverModel(query.sessionId);return modelSettings.view(query);},
    async saveWebSettings(input:XiaozhiWebInput) { return mutateSettings(()=>store.xiaozhiState.modelSettings.saveWeb(input,()=>{if(closing||!configuring.has('provider'))throw new Error('busy');})); },
    async verifyModelCredential(input:XiaozhiCredentialInput) {return mutateSettings(()=>modelSettings.verify(input));},
    async saveModelSettings(input: XiaozhiSettingsInput) {
      const value = await mutateSettings(() => modelSettings.save(input));
      return { ...value, locked: settingsBusy() };
    },
    async selectSessionModel(input: XiaozhiSessionModelInput) {
      await recoverModel(input.sessionId);
      const value = await mutateSettings(() => modelSettings.select(input));
      return { ...value, locked: value.locked || settingsBusy() };
    },
    memoryCatalog: memory.catalog, memoryTrace: memory.trace,
    // Main-only pointers; management IPC returns an explicit public projection.
    skillCatalog: async () => { await skillsReady; return managedSkills.catalog(); },
    skillPreview: async (name: string) => { await skillsReady; return managedSkills.preview(name); },
    skillManagementBusy: () => Boolean(closing || skillsMutating || active.size || starting.size || choosing.size || configuring.size),
    setSkillEnabled: (name: string, revision: number, enabled: boolean) => manageSkill(() => managedSkills.setEnabled(name, revision, enabled)),
    editSkill: (name: string, revision: number, document: string) => manageSkill(() => managedSkills.edit(name, revision, document)),
    archiveSkill: (name: string, revision: number) => manageSkill(() => managedSkills.archive(name, revision)),
    importSkill: (revision: number, choose: () => Promise<string | undefined>) => manageSkill(async () => {
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('invalid_input');
      if ((await managedSkills.catalog()).revision !== revision) throw new Error('stale_version');
      const directory = await choose(); return directory ? managedSkills.importDirectory(directory, revision) : null;
    }),
    async setMemoryScope(input: XiaozhiMemoryScopeInput): Promise<XiaozhiActionResult> {
      if (!validMemoryScopeInput(input)) return { ok: false, error: 'invalid_input' };
      const id = input.sessionId;
      if (closing || skillsMutating || choosing.has(id) || configuring.has(id) || configuring.has('provider')) return { ok: false, error: 'busy' };
      const run = active.get(id);
      // Only an explicit revocation may interrupt execution. A stale request cannot stop it.
      if (run && (input.enabled || input.selections.length || !run.done)) return { ok: false, error: 'busy' };
      configuring.add(id);
      try {
        if (run) {
          const current = await memory.scope(id);
          if (current.version !== input.version) return { ok: false, error: 'command_conflict' };
          if ((await store.getAiConversationSession(id)).session.archivedAt) return { ok: false, error: 'permission_denied' };
          await host.stop(id); await run.done;
        }
        return await memory.save(input);
      } catch { return { ok: false, error: 'configuration' }; }
      finally { configuring.delete(id); }
    },
    async setBudget(input:XiaozhiBudgetInput):Promise<XiaozhiActionResult> {
      if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['sessionId','version','budget'].includes(key))
        || !validId(input.sessionId) || !Number.isSafeInteger(input.version) || input.version<0 || !validPiBudget(input.budget))return {ok:false,error:'invalid_input'};
      const id=input.sessionId;
      if(closing || skillsMutating || active.has(id) || choosing.has(id) || configuring.has(id) || configuring.has('provider'))return {ok:false,error:'busy'};
      configuring.add(id);
      try {
        const detail=await store.getAiConversationSession(id);if(detail.session.archivedAt)return {ok:false,error:'permission_denied'};
        return await store.xiaozhiState.saveBudget(id,input.version,input.budget) ? {ok:true} : {ok:false,error:'command_conflict'};
      }catch{return {ok:false,error:'configuration'};}finally{configuring.delete(id);}
    },
    mutateQueue: createQueueMutationHandler({store,
      current: (id,runId) => { const run=active.get(id); return !closing && run?.runId === runId && !run.stopped && run.agent?.diagnostics().running
        ? {agent:run.agent,releaseSlot:controlId=>run.instructions.delete(controlId)} : undefined; },
      notify: item => { const run=active.get(item.sessionId); if (run?.runId === item.runId && !run.stopped) publicEvent(item.sessionId,run,{kind:'control',control:publicControl(item)}); } }),
    async queue(input: XiaozhiQueueInput): Promise<XiaozhiActionResult> {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key=>!['sessionId','commandId','text','mode'].includes(key))
        || !validId(input.sessionId) || !/^xicmd_[a-f0-9-]{36}$/i.test(input.commandId) || !['steer','followUp'].includes(input.mode)
        || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 8192 || input.text.includes('\0')) return {ok:false,error:'invalid_input'};
      const hash = createHash('sha256').update(JSON.stringify({sessionId:input.sessionId,text:input.text.trim(),mode:input.mode})).digest('hex');
      const existing = queueing.get(input.commandId); if (existing) return existing.hash === hash ? existing.result : {ok:false,error:'command_conflict'};
      const result = (async ():Promise<XiaozhiActionResult> => {
        const prior = await store.xiaozhiState.control(input.commandId);
        if (prior) return prior.kind === 'instruction' && prior.sessionId === input.sessionId && prior.requestHash === hash ? {ok:true} : {ok:false,error:'command_conflict'};
        if (await store.xiaozhiState.command(input.commandId)) return {ok:false,error:'command_conflict'};
        const run = active.get(input.sessionId);
        if (closing || !run || run.operation === 'compact' || run.stopped || !run.agent?.diagnostics().running) return {ok:false,error:'busy'};
        if(run.instructions.size >= 16)return {ok:false,error:'busy'};
        run.instructions.add(input.commandId); // Reserve in the live owner before async sanitation/persistence.
        const text = (await store.sanitizeProblemText(input.text.trim())).sanitizedText;
        if (closing || run.stopped || active.get(input.sessionId) !== run || !run.agent.diagnostics().running) return {ok:false,error:'busy'};
        const item = { id:input.commandId,sessionId:input.sessionId,runId:run.runId,kind:'instruction' as const,state:'queued' as const,text,mode:input.mode,revision:0,requestHash:hash };
        if (!await store.xiaozhiState.putControl(item)) return {ok:false,error:'command_conflict'};
        publicEvent(input.sessionId,run,{kind:'control',control:publicControl(item)});
        try { await run.agent.queue(item.id,text,item.mode); return {ok:true}; }
        catch { await store.xiaozhiState.changeControl(item.id,['queued'],{state:'interrupted'}); publicEvent(input.sessionId,run,{kind:'control',control:{...publicControl(item),state:'interrupted'}}); return {ok:false,error:'busy'}; }
      })().catch(():XiaozhiActionResult=>({ok:false,error:'configuration'}));
      queueing.set(input.commandId,{hash,result});
      try {return await result;} finally {queueing.delete(input.commandId);}
    },
    async selectWorkspace(id: string, choose: () => Promise<string | undefined>): Promise<XiaozhiActionResult> {
      if (!validId(id)) return { ok: false, error: 'invalid_input' };
      if (active.has(id) || choosing.has(id) || configuring.has(id) || configuring.has('provider') || closing || skillsMutating) return { ok: false, error: 'busy' };
      choosing.add(id);
      try {
        if ((await store.getAiConversationSession(id)).session.archivedAt) return { ok: false, error: 'invalid_input' };
        if (await store.xiaozhiState.getBinding(id)) return { ok: false, error: 'workspace_locked' };
        const selected = await choose(); if (!selected) return { ok: true };
        const directory = authorizedWorkspace(selected, options.dataRoot);
        await store.xiaozhiState.setWorkspace(id, directory, path.basename(directory).slice(0, 200)); return { ok: true };
      } catch { return { ok: false, error: 'permission_denied' }; }
      finally { choosing.delete(id); }
    },
    async compact(input: XiaozhiCompactInput): Promise<XiaozhiStartResult> {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['sessionId','commandId'].includes(key))) return { ok: false, error: 'invalid_input' };
      return host.start({ sessionId: input.sessionId, commandId: input.commandId, prompt: '压缩当前会话的较早上下文，保留原对话与本地事实。' }, 'compact');
    },
    async start(input: XiaozhiStartInput, operation: 'prompt' | 'compact' = 'prompt',goalId?:string): Promise<XiaozhiStartResult> {
      if (!enabled || closing) return { ok: false, error: 'configuration' };
      if (skillsMutating || configuring.has('provider')) return { ok: false, error: 'busy' };
      if(!validXiaozhiStart(input)||(operation==='compact'&&input.attachments))return {ok:false,error:'invalid_input'};
      input = { ...input, prompt: input.prompt.trim()||ATTACHMENT_ONLY_PROMPT,
        ...(input.attachments?{attachments:input.attachments.map(s=>({id:s.id,revision:s.revision}))}:{}) };
      const id = input.sessionId;
      try {await recoverModel(id);
        if((await store.xiaozhiState.modelSwitch?.transitions(id))?.some(row=>row.status==='prepared')) return {ok:false,error:'busy'};
      } catch {return {ok:false,error:'configuration'};}
      // Retain the exact historical prompt hash; compact has a distinct command identity.
      let selectedRows:Awaited<ReturnType<typeof store.xiaozhiState.attachments.list>>=[];
      if(input.attachments){try{selectedRows=await store.xiaozhiState.attachments.list(id);if(input.attachments.some(s=>!selectedRows.some(row=>row.id===s.id)))return {ok:false,error:'attachment_changed'};}catch{return {ok:false,error:'configuration'};}}
      const hash = input.attachments?attachmentStartHash(id,input.prompt,input.attachments,selectedRows):createHash('sha256').update(JSON.stringify({ sessionId: id, prompt: input.prompt, ...(operation === 'compact' ? { operation } : {}),...(goalId?{goalId}:{}) })).digest('hex');
      const priorStart = starting.get(input.commandId);
      if (priorStart) return priorStart.hash === hash ? priorStart.result : { ok: false, error: 'command_conflict' };
      const result = (async (): Promise<XiaozhiStartResult> => {
      await skillsReady;
      const previous = await store.xiaozhiState.command(input.commandId);
      if (previous) {
        if (previous.request_hash !== hash || previous.conversation_id !== id) return { ok: false, error: 'command_conflict' };
        if(input.attachments&&previous.run_id){const admitted=await store.xiaozhiState.attachmentSends.get(input.commandId);if(!admitted||admitted.run_id!==previous.run_id||admitted.request_hash!==hash)return {ok:false,error:'configuration'};}
        return previous.run_id ? { ok: true, runId: String(previous.run_id) } : { ok: false, error: 'configuration' };
      }
      if (await store.xiaozhiState.control(input.commandId)) return {ok:false,error:'command_conflict'};
      if (closing || skillsMutating || active.has(id) || choosing.has(id) || configuring.has(id) || configuring.has('provider')) return { ok: false, error: 'busy' };
      const run: Active = { runId: '', commandId: input.commandId,...(goalId?{goalId}:{}), operation, sequence: 0, stopped: false, abort: new AbortController(), instructions:new Set(), turn: { id: '', status: 'running', items: [] },
        usage:{runId:'',budget:{...DEFAULT_PI_BUDGET},limitsEnforced:false,modelCalls:0,toolCalls:0,tokens:null,completeness:'unknown',cost:null,activeMs:0,waitingMs:0,state:'running'},usageWrites:Promise.resolve() };
      active.set(id, run); // Reserve before awaits; UI locks are not the ownership gate.
      try {
        const detail = await store.getAiConversationSession(id); if (detail.session.archivedAt) throw new Error('invalid_input');
        const drafts=operation==='prompt'?(await store.xiaozhiState.attachments.list(id)).filter(row=>row.state==='draft'):[];
        if(drafts.length&&!input.attachments){active.delete(id);return {ok:false,error:'attachment_changed'};}
        if(input.attachments&&(drafts.length!==input.attachments.length||input.attachments.some(s=>!drafts.some(row=>row.id===s.id&&row.revision===s.revision))))throw new Error('attachment_changed');
        run.usage.budget=(await store.xiaozhiState.budgetSettings(id)).budget;
        if (!await store.xiaozhiState.claimCommand(input.commandId, id, hash)) throw new Error('command_conflict');
        if(input.attachments){
          await options.afterAttachmentSendStage?.('claimed');run.abort.signal.throwIfAborted();
          const importer=createAttachmentImportService({dataRoot:options.dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,
            isCurrent:()=>!closing&&active.get(id)===run&&!run.stopped});
          const validationSignal=AbortSignal.any([run.abort.signal,AbortSignal.timeout(15000)]);
          for(const selection of input.attachments)await importer.verify(id,selection,validationSignal);
        }
        if (process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && process.env.OMNI_EDU_E2E_PI_COMMAND_DELAY_MS) {
          fs.writeFileSync(path.join(options.dataRoot, '.e2e-pi-command-claimed'), input.commandId);
          await new Promise(resolve => setTimeout(resolve, Math.min(30000, Math.max(0, Number(process.env.OMNI_EDU_E2E_PI_COMMAND_DELAY_MS) || 0))));
        }
        const settings = await modelSettings.runtime(id);
        if(input.attachments){
          if(closing||run.stopped)throw new Error('cancelled');
          const admitted=await store.xiaozhiState.attachmentSends.admit({sessionId:id,commandId:input.commandId,prompt:input.prompt,hash,model:settings.model,attachments:drafts,selections:input.attachments});
          run.runId=admitted.runId;
          run.turn.id=admitted.runId;
          run.turn.items.push({id:admitted.messageId,kind:'message',role:'user',text:input.prompt,attachments:admitted.attachments});
          await options.afterAttachmentSendStage?.('committed');
        }else{
          run.runId = await store.startAiAgentRun({ sessionId: id, prompt: input.prompt.trim(), route: 'knowledge_retrieval', subIntent: 'pi_education', model: settings.model });
          await store.xiaozhiState.bindCommand(input.commandId, run.runId);
        }
        run.usage.runId=run.runId;await store.xiaozhiState.saveUsage(id,run.usage);
        if(goalId){const goal=await store.xiaozhiState.goals.get(goalId);if(!goal||goal.sessionId!==id||goal.state!=='active')throw new Error('command_conflict');const bound=await store.xiaozhiState.goals.bind(goal,run.runId);publicEvent(id,run,{kind:'goal',goal:publicGoal(bound)});}
        run.turn.id = run.runId;
        if(!input.attachments){
          const saved = await store.appendAiConversationMessage(id, { role: 'user', content: input.prompt.trim(), metadata: { agentRunId: run.runId, piVersion: 'xiaozhi.pi.education.v1' } });
          const user = saved.messages.at(-1)!;
          run.turn.items.push({ id: user.id, kind: 'message', role: 'user', text: user.content });
        }
        publicEvent(id, run, { kind: 'status', status: 'running' });
        run.done = execute(id, input.prompt.trim(), run, settings);
        return { ok: true, runId: run.runId };
      } catch(error) {
        active.delete(id); if (run.runId) await store.completeAiAgentRun(run.runId, 'failed', XIAOZHI_ERRORS.configuration).catch(() => undefined);
        // Once the atomic teacher/run/files fact exists, the receipt must not claim it was unsent.
        // Later host failures are shown on that admitted turn; a retry confirms its original run.
        if(input.attachments&&run.runId&&run.turn.items[0]?.attachments?.length){publicEvent(id,run,{kind:'status',status:'failed',error:'configuration'});return {ok:true,runId:run.runId};}
        const code=error instanceof Error?error.message:'';
        return { ok: false, error:run.stopped||closing?'cancelled':error instanceof Error&&error.name==='TimeoutError'?'timeout':code==='attachment_changed'||code==='changed'?'attachment_changed':code==='permission_denied'?'permission_denied':code==='command_conflict'?'command_conflict':'configuration' };
      }
      })().catch((): XiaozhiStartResult => ({ ok: false, error: 'configuration' }));
      starting.set(input.commandId, { hash, result });
      try { return await result; } finally { starting.delete(input.commandId); }
    },
    attachments,
    async showBrowser(raw:unknown):Promise<XiaozhiActionResult>{
      if(!validId(raw))return {ok:false,error:'invalid_input'};
      try{if(closing||(await store.getAiConversationSession(raw)).session.archivedAt)throw new Error('permission_denied');browser.show(raw);return {ok:true};}catch{return {ok:false,error:'permission_denied'};}
    },
    async stop(id: string) {
      if (!validId(id)) return { ok: false };
      attachments.cancelSession(id);
      browser.cancel(id);
      const run = active.get(id); if (!run) return { ok: true };
      run.stopped = true; run.abort.abort();
      if(run.goalId){const goal=await store.xiaozhiState.goals.interrupt(id,run.runId,'教师停止了本轮执行，已保存进度。');if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});}
      await controls.finish(id,run.runId); await approvals.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await run.agent?.abort(); return { ok: true };
    },
    async close() {
      closing = true; for (const run of active.values()) { run.stopped = true; run.abort.abort(); }
      await attachments.close();
      await browser.dispose();
      await Promise.allSettled([...modelWrites]);
      await Promise.allSettled([...localSettingsJobs]);
      await Promise.allSettled([...starting.values()].map(item => item.result));
      for (const [id,run] of active) { await controls.finish(id,run.runId); await approvals.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await run.agent?.abort(); }
      await Promise.allSettled([...active.values()].map(run => run.done));
    },
  };
  return host;
}

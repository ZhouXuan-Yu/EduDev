import {PAPER_EXPORT_RESTART_REQUIRED} from './tasks/paper-export-continuation';
import {isTaskContinuation} from './tasks/continuation';
import {copyPaperExportIntent,type PaperExportIntent} from '../../shared/paper-export';
import {readPaperExportIntent,PAPER_EXPORT_SOURCE_CHANGED} from '../education/paper-export-intent';
import {createClassroomPlanTools} from '../education/classroom-plan-tools';
import {admitClassroomOrTaskTool} from '../education/classroom-plan-admission';
import type {ClassroomPlanStart} from '../../shared/classroom-plan';
import {deliveryFinal,type DeliveryFinal} from './delivery-final';
import {presentationUnchangedReceipt} from '../../shared/xiaozhi-presentation-edit';
import {isFileDeliveryTool} from './tools/manifest';
import {deliveryRequirements} from './checks/requirements';
import {createTaskState} from './tasks/task-state';
import {createDeliveryChecks} from './checks/service';
import {deliveryCheckTools,inspectionSummary} from './checks/tools';
import {createCheckPreflight} from './checks/preflight';
import {computationReportTools,createComputationResults} from '../managed-tools/result-report';
import {computationEffectTool} from '../../shared/xiaozhi-computation';
import {createManagedTools} from '../managed-tools/service';
import {managedComputationTools} from '../managed-tools/tools';
import {createTeacherRequestTool,teacherRequestSources} from './request-sources';
import {createArtifactCheck} from './artifact-check';
import {createArtifactSources} from './artifact-sources';
import {fileWritesEnabled} from './file-write-policy';
import {conversationOutput,CONVERSATION_OUTPUT_LABEL} from './conversation-output';
import {createQuestionWebAnswerReadback} from '../education/question-web-answer-readback';
import {answerQualityEnabled,resolveAnswerPolicy} from './answer-quality';
import {readChatPresentation} from '../../shared/chat-presentation';
import {capturePresentationOrder} from './presentation-event-adapter';
import {createClassroomExportTools} from '../education/classroom-export-tools';
import {createClassroomContext} from '../education/classroom-context';
import {teacherPreferenceContext,teacherPreferenceTrialContext,teacherPreferenceCorrectionContext} from '../education/teacher-preference-policy';
import {implicitTeacherCorrection} from '../education/teacher-preference-learning';
import {assertClassroomOffice} from '../education/classroom-office';
import {createOriginalQuestionCoordinator} from '../education/original-question-coordinator';
import {createRunVerification} from './verification/run-observer';
import {createRunResultReadback,bindNativeResultReadback} from './verification/result-readback';
import {captureNativeTail,toolResultDigest} from './events/native-tail';
import type {ReceiptCapture} from './events/receipts';
import {createEducationReadback} from './verification/education-readback';
import {createPracticeReadback} from './verification/practice-readback';
import {createEffectReadback} from './verification/effect-readback';
import {officeVersionFamilies,officePathIsCurrent,type OfficeFamilyRecord} from './office-version-family';
import {createDeliveryReadback} from './verification/delivery-readback';
import {createDeliveryCoordinator} from './delivery-coordinator';
import {createHanaOfficeTools} from '../office-agent/hana-tool-adapter';
import {fileVersion} from './workspace-files';
import {legacyVerification,validTaskVerification,VERIFICATION_LABELS,verificationDescription} from '../../shared/xiaozhi-verification';
import {validOriginalInput,type OriginalQuestionDecision} from '../../shared/original-question-review';
import fs from 'node:fs';
import {validVersionedPlan,validPlanHistoryInput,type PlanHistoryResult} from '../../shared/xiaozhi-plan';
import {createPaperCoordinator} from '../education/paper-coordinator';
import {createPaperBasketApi} from '../education/paper-basket-api';
import {assertPaperOffice,createPaperExportTool} from '../education/paper-export';
import {isPaperOfficeDraft,isPresentationDraft} from '../../shared/xiaozhi-office-draft';
import {resolvePaperOfficeImages} from '../education/paper-office-images';
import {PAPER_TOOLS,validPaperCreate,validPaperReview,type PaperCreateInput,type PaperDecision} from '../../shared/paper-blueprint';
import {TaskAdmissionError} from './tasks/admission-error';
import {createPracticeReviewCoordinator} from '../education/practice-review-coordinator';
import {validPracticeReview,type PracticeReviewDecision,type PracticeReviewResult,type PracticeReviewSummary} from '../../shared/practice-review';
import {validBrowserCaptureInput,validBrowserCapture,type BrowserCaptureResult} from '../../shared/xiaozhi-browser-capture';
import {readBrowserCapture} from './browser-capture-reader';
import {createGoalRuntime,createGoalController} from './goal-coordinator';
import {createDiscoveryReadback} from './verification/discovery-readback';
import {publicGoal} from './goal-state';
import {createTaskCoordinator} from './tasks/coordinator';
import {readTeacherAnswerDigests} from './verification/teacher-input-readback';
import {createTaskResultRecheck} from './tasks/result-recheck';
import {validTaskResume,type TaskResumeInput} from '../../shared/xiaozhi-task';
import {createTaskPlanRuntime} from './tasks/plan-runtime';
import {createTaskResources} from './tasks/resources';
import {createAttachmentCoordinator} from './attachment-coordinator';
import {createAttachmentImportService} from './attachment-import-service';
import {publicAttachment} from './attachment-state';
import {attachmentStartHash} from './attachment-send-state';
import {createAttachmentReadTools} from './attachment-read-tools';
import {createPublicImageRuntime} from './public-image-runtime';
import {PUBLIC_IMAGE_APPROVE,PUBLIC_IMAGE_REJECT} from '../../shared/xiaozhi-public-images';
import {createDeliveryCatalog} from './delivery-catalog';
import {validXiaozhiStart,ATTACHMENT_ONLY_PROMPT} from '../../shared/xiaozhi-start';
import {createPiWebTools} from './web-tools';
import {resolveThinkingPolicy,isThinkingContinuation} from './answer-quality';
import {isTaskAmendment} from './tasks/continuation';
import {createXiaozhiBrowserHost} from './browser-host';
import {createPiBrowserTools} from './browser-tools';
import {createQuestionContextProvider} from '../education/question-context-provider';
import {createQuestionWebAnswerTools,scopeQuestionWebExternalTools} from '../education/question-web-answer-tools';
import type {QuestionContextSource} from '../../shared/question-context';
import {createQuestionCollectionCoordinator} from '../education/question-collection-coordinator';
import {validQuestionCollection,type QuestionCollectionInput,type QuestionCollectionDecision} from '../../shared/question-collection';
import {createQuestionReviewCoordinator} from '../education/question-review-coordinator';
import {validQuestionReview,type QuestionReviewDecision,type QuestionReviewResult,type QuestionReviewSummary} from '../../shared/question-review';
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
import { createMcpRuntime } from './mcp-runtime';
import { createDecisionLedger } from './decisions/ledger';
import { judgeDecision,judgeRoute } from './decisions/deepseek-shadow';
import {createDecisionAuthority} from './decisions/authority';
import type { DecisionInput } from '../../shared/xiaozhi-decisions';
import {createTeacherCandidateCatalog} from '../education/teacher-preference-candidates';
import type {TeacherCandidateInput} from '../../shared/teacher-candidates';
import type { XiaozhiMcpAddInput, XiaozhiMcpInput, XiaozhiMcpTrustInput } from '../../shared/xiaozhi-mcp';
import type { PiXiaozhiOptions } from './pi-session';
import {validXiaozhiHistoryPageInput,type XiaozhiHistoryPage,type XiaozhiHistoryPageInput,type XiaozhiModelCapabilities} from '../../shared/xiaozhi-agent';
import type { OmniEduStore } from '../db';
import { createEducationTools } from './education-tools';
import {createMaterialTools} from '../assets/material-tools';
import {createMaterialPageTools} from '../assets/material-page-tools';
import {createEducationCapabilityProvider} from '../education/capability-provider';
import {createClassroomTools} from '../education/classroom-tools';
import {createEducationSearchTools} from '../education/search-provider';
import {createStudentContextProvider} from '../education/student-context-provider';
import {createLearningProvider} from '../education/learning-provider';
import {createMistakeSimilarProvider,type ObservedMistakeLearning} from '../education/mistake-similar-provider';
import type {QuestionAliases} from '../education/question-aliases';
import {createLearningReviewCoordinator} from '../education/learning-review-coordinator';
import {validLearningBatchDecision,validLearningReview,type LearningReviewBatchDecision,type LearningReviewBatchSummary,type LearningReviewDecision,type LearningReviewResult,type LearningReviewSummary} from '../../shared/learning-review';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {readModelReasoning} from '../../shared/model-reasoning';
import { applyXiaozhiEvent, XIAOZHI_ERRORS } from '../../shared/xiaozhi-projection';
import {publicProviderTurn} from '../../shared/public-provider-text';
import {readPublicStages} from '../../shared/public-trace';
import {publicMessageText} from '../../shared/xiaozhi-message-presentation';
import { createPiApprovalCoordinator } from './approval-coordinator';
import { createTextChangeService } from './text-change-service';
import {createTextVersions} from './text-versions';
import { createTextChangeCoordinator } from './text-change-coordinator';
import { changeSummary } from './text-change-state';
import {createOfficeArtifactCoordinator} from './office-artifact-coordinator';
import {createOfficeArtifactService} from './office-artifact-service';
import {createOfficeVersions} from './office-versions';
import type {OfficeVersionInput,OfficeVersionResult} from '../../shared/xiaozhi-office-versions';
import {officeSummary} from './office-artifact-state';
import {createOfficeDeliveryPresentation,officeDeliveryText} from './office-delivery-presentation';
import type {OfficeArtifactDecision,OfficeArtifactResult,OfficeArtifactSummary} from '../../shared/xiaozhi-office-artifacts';
import type { XiaozhiChangeDecision, XiaozhiChangeResult, XiaozhiChangeSummary } from '../../shared/xiaozhi-changes';
import { publicApproval } from './persistent-state';
import { publicControl } from './control-state';
import { createPiControlCoordinator } from './control-tools';
import { DEFAULT_PI_BUDGET, validPiBudget } from './budget-state';
import type { XiaozhiBudgetInput, XiaozhiUsage } from '../../shared/xiaozhi-agent';
import { authorizedWorkspace,workspaceHash } from './workspace-authority';
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
import { createEventPublisher } from './events/publisher';
import {repairCancelledRun} from './events/terminal-cancellation';
import {waitForLifecycle} from './lifecycle-wait';
import { officeBlankFieldError } from './office-blank-fields';
import { validEventsInput, type XiaozhiEventsInput } from '../../shared/xiaozhi-events';
import type { XiaozhiAgentError, XiaozhiAgentEvent, XiaozhiAgentEventPayload, XiaozhiStartInput, XiaozhiStartResult, XiaozhiWorkspaceSnapshot } from '../../shared/xiaozhi-agent';

type Agent = Awaited<ReturnType<typeof import('./pi-session')['createPiXiaozhiSession']>>;
type Active = { paperExportIntent?:PaperExportIntent; resumeDeliveryId?:string; classroomPlan?:ClassroomPlanStart; computationResults?:ReturnType<typeof createComputationResults>; computationScope?:Awaited<ReturnType<ReturnType<typeof createManagedTools>['freeze']>>; unfinishedThinkingTask?:string; task?:import('../../shared/xiaozhi-task').TaskView; teacherPreferenceRevision?:number; runId: string; commandId: string; goalId?:string; operation: 'prompt' | 'compact'; turn: OfficeProjectedTurn; agent?: Agent; stopped: boolean; abort: AbortController; sequence: number; done?: Promise<void>; instructions:Set<string>; usage:XiaozhiUsage; usageWrites:Promise<void>; officePresentation?:ReturnType<typeof createOfficeDeliveryPresentation>; verification?:ReturnType<typeof createRunVerification>; results?:ReturnType<typeof createRunResultReadback>; readResults?:ReturnType<typeof bindNativeResultReadback>; publisher?:ReturnType<typeof createEventPublisher>; pendingEvents?:XiaozhiAgentEventPayload[];receiptCaptures?:Map<string,ReceiptCapture> };
const validId = (id: unknown): id is string => typeof id === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(id);
const inside = (root: string, target: string) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

export function createXiaozhiProductionHost(options: { managedTools?:ReturnType<typeof createManagedTools>; store: OmniEduStore; dataRoot: string; emit: (event: XiaozhiAgentEvent) => void;
  /** Main-owned isolated legacy regression only; product launches always enable Pi. */
  enabled?: boolean;
  /** Main-only acceptance seam; packaged IPC never installs it. */
  afterCompactCommit?: () => Promise<void>; afterAutoCompactCommit?: () => Promise<void>; beforeAutoCompactCommit?: () => Promise<void>;
  afterInstructionDispatch?: (signal: AbortSignal) => Promise<void>;
  afterLearningReviewWrite?:(isCurrent:()=>boolean)=>Promise<void>;
  afterQuestionReviewWrite?:(isCurrent:()=>boolean)=>Promise<void>;
  afterOriginalReviewWrite?:(isCurrent:()=>boolean)=>Promise<void>;
  afterPracticeReviewWrite?:()=>Promise<void>;
  /** Main-only isolated acceptance cut; packaged IPC never supplies it. */
  afterTextChangeStage?: (stage: 'intent' | 'file' | 'undo-intent' | 'undo-file') => Promise<void>;
  afterOfficeArtifactStage?: (stage:'prepared'|'intent'|'file'|'fact')=>Promise<void>;
  afterAttachmentSendStage?: (stage:'claimed'|'committed')=>Promise<void>;
  autoCompaction?: boolean; testContextWindow?: number; settingsCodec?: SettingsKeyCodec;
  /** Main-only failure acceptance; never renderer supplied. */
  lifecycleTimeoutMs?:number; shutdownTimeoutMs?:number;
  beforeModelDelivery?:()=>Promise<void>;
  afterModelSwitchStage?: (stage:ModelSwitchStage)=>Promise<void> }) {
  const { store } = options;
  const managedTools=options.managedTools||createManagedTools({root:path.join(options.dataRoot,'managed-tools')});
  const root = path.join(options.dataRoot, 'xiaozhi-pi');
  const active = new Map<string, Active>();
  const fileChecks=createDeliveryChecks({state:store.xiaozhiState.inspections,dataRoot:options.dataRoot,observe:report=>{const run=active.get(report.sessionId);if(run&&run.runId===report.runId){run.officePresentation??=createOfficeDeliveryPresentation(run.runId);run.officePresentation.inspected();}},resolve:id=>host.resolveFileWorkspace(id),requirements:async id=>deliveryRequirements(await createTaskState(store.xiaozhiState.sql,{sanitize:async text=>(await createStudentContextSanitizer(store))(text)}).requirements(id)),
    publishedCurrent:async(id,relative)=>officePathIsCurrent(await store.xiaozhiState.officeArtifacts.versionRecords(id) as OfficeFamilyRecord[],relative),
    candidateStatus:async(id,file)=>{const ref=file.candidate;if(!ref)return{current:false,published:false};const row=ref.kind==='text'?await store.xiaozhiState.changes.get(ref.id):await store.xiaozhiState.officeArtifacts.get(ref.id);
      const family=row&&'artifactId'in row&&row.artifactId?officeVersionFamilies(await store.xiaozhiState.officeArtifacts.versionRecords(id) as OfficeFamilyRecord[]).get(row.artifactId):undefined;
      return{current:!!row&&(!family||family.currentArtifactId===('artifactId'in row?row.artifactId:null))&&row.sessionId===id&&row.path===file.path&&row.state!=='reverted'&&('afterSha256'in row?row.afterSha256===file.sha256:row.draftHash===file.fileVersion&&row.outputHash===file.sha256),published:row?.state==='saved'||row?.state==='applied'};}});
  const idleTaskResults=createTaskResultRecheck({store,dataRoot:options.dataRoot,nativeRoot:root,current:id=>!closing&&!active.has(id)&&!admissions.get(id)?.size&&!choosing.has(id)&&!configuring.has(id)&&!configuring.has('provider'),workspace:id=>host.resolveFileWorkspace(id)});
  const tasks=createTaskCoordinator({store,closing:()=>closing,running:id=>active.has(id),busy:id=>active.has(id)||Boolean(admissions.get(id)?.size)||choosing.has(id)||configuring.has(id)||configuring.has('provider')||skillsMutating,
    emit:options.emit,resultRecheck:idleTaskResults,taskRecheck:async task=>{const proofs:import('../../shared/xiaozhi-verification').TaskVerification[]=[];for(const run of await tasks.admittedRuns(task.sessionId,task.id))try{proofs.push(await idleTaskResults.run(run.runId,task));}catch{/* Unknown historical effects cannot be confirmed or replayed. */}return proofs;}});
  const journalFailures = new Map<string, {runId:string;run:Active}>();
  const starting = new Map<string, { sessionId: string; hash: string; result: Promise<XiaozhiStartResult> }>();
  const admissions=new Map<string,Set<AbortController>>();
  // A late idle decision must not regain authority after a start/stop cycle.
  const learningDecisionGeneration = new Map<string, number>();
  const invalidateLearningDecisions = (id: string) => {
    const next = (learningDecisionGeneration.get(id) || 0) + 1;
    learningDecisionGeneration.set(id, next); return next;
  };
  const conversationStarting = (id: string) => [...starting.values()].some(item => item.sessionId === id);
  const choosing = new Set<string>();
  const balanceQueries=new Set<AbortController>();
  const configuring = new Set<string>();
  const queueing = new Map<string,{hash:string;result:Promise<XiaozhiActionResult>}>();
  const enabled = options.enabled !== false;
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
    if(closing)return;
    run.verification ??= createRunVerification(run.runId);
    run.verification.observe(payload);
    if(payload.kind==='image_delivery')run.results?.image(payload.image);
    run.officePresentation ??= createOfficeDeliveryPresentation(run.runId);
    for (const visible of run.officePresentation.events(payload)) {
      const event = { ...visible, traceOrder:visible.traceOrder??capturePresentationOrder(), sessionId: id, runId: run.runId, sequence: ++run.sequence } as XiaozhiAgentEvent;
      run.turn = applyXiaozhiEvent(run.turn, event);
      if (run.publisher) {run.publisher.enqueue(visible,undefined,visible.kind==='tool_end'?run.receiptCaptures?.get(visible.callId):undefined);if(visible.kind==='tool_end')run.receiptCaptures?.delete(visible.callId);}
      else {(run.pendingEvents ??= []).push(structuredClone(visible)); try { options.emit(event); } catch { /* UI lifetime does not own execution. */ }}
    }
  };
  async function beginJournal(id: string, run: Active) {
    const owner = await store.xiaozhiState.eventJournal.begin(id, run.runId, run.turn);
    journalFailures.delete(id);
    run.publisher = createEventPublisher({ journal: store.xiaozhiState.eventJournal, owner,
      cancellation:{requested:()=>run.stopped,repair:(work,turn)=>repairCancelledRun(work,id,run.runId,run.commandId,turn)},
      committed: (turn, sequence) => { run.turn = turn; run.sequence = sequence; },
      emit: options.emit,
      beforeTerminalEmit: () => { if (active.get(id) === run) active.delete(id); },
      failed: error => {
        // Only bounded internal identifiers may enter logs. Never expose exception
        // text from a provider, a tool, a file, or a credential decoder.
        const code=error instanceof Error&&(/^(?:event|tool_receipt|lifecycle|task)_[a-z_]{1,64}$/.test(error.message)||['invalid_input','configuration'].includes(error.message))?error.message:'event_persistence';
        const locations=error instanceof Error?[...String(error.stack).matchAll(/[\\/](index|pi-session|execution-bound|publisher|journal)\.(js|ts):(\d+):(\d+)/g)].slice(0,6).map(m=>({module:m[1],line:Number(m[3]),column:Number(m[4])})):[];
        const nativeCode=error&&typeof error==='object'&&'code'in error&&typeof error.code==='string'&&/^SQLITE_[A-Z_]{1,32}$/.test(error.code)?error.code:undefined;
        const type=error instanceof Error&&['Error','TypeError','RangeError','AgentToolTimeoutError','AgentToolAbortedError'].includes(error.name)?error.name:'unknown';
        const tool=error&&typeof error==='object'&&'toolName'in error&&typeof error.toolName==='string'&&/^[a-z_]{1,128}$/.test(error.toolName)?error.toolName:undefined;
        const timeoutMs=error&&typeof error==='object'&&'timeoutMs'in error&&Number.isSafeInteger(error.timeoutMs)&&Number(error.timeoutMs)>0?Number(error.timeoutMs):undefined;
        console.error('[xiaozhi-journal]',JSON.stringify({code,type,nativeCode,tool,timeoutMs,locations}));
        console.error('[xiaozhi-cancel]',JSON.stringify({source:'journal',runId:run.runId,code}));
        journalFailures.set(id, {runId:run.runId,run}); run.stopped = true; run.abort.abort();
        void run.agent?.abort().catch(() => undefined);
        // Transient failure notification, never a committed journal event.
        try { options.emit({ sessionId: id, runId: run.runId, sequence: run.sequence, generation: owner.generation,
          durability: 'unavailable', kind: 'status', status: 'failed', error: 'event_persistence' }); } catch { /* Snapshot retains the local failure overlay. */ }
      },
    });
    for (const payload of run.pendingEvents || []) run.publisher.enqueue(payload);
    run.pendingEvents = [];
  }
  const learningReviews=createLearningReviewCoordinator({store,
    afterWrite:options.afterLearningReviewWrite,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canDecide:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'learning_review',review});}
  });
  const mcp = createMcpRuntime(store.xiaozhiState.sql, options.settingsCodec, { sanitize: text => sanitizeOfficeDocumentText(store, text) });
  const decisions = createDecisionLedger({sql:store.xiaozhiState.sql,
    authority:createDecisionAuthority({sql:store.xiaozhiState.sql,
      memory:async id=>{const before=await memory.authority(id),scope=await memory.scope(id),after=await memory.authority(id);if(before.fingerprint!==after.fingerprint||scope.version!==after.version)throw Error('memory_scope_changed');return{fingerprint:after.fingerprint,state:!after.enabled?'off':!after.valid?'unavailable':scope.selections.length?'selected':'empty'};},
      files:async id=>{const lease=await host.resolveFileWorkspace(id),rows=(await store.xiaozhiState.attachments.list(id)).filter(row=>row.state==='submitted');return{available:Boolean(lease)||rows.length>0,fingerprint:createHash('sha256').update(JSON.stringify([lease?.version||'',rows.map(row=>[row.id,row.revision,row.version,row.format])])).digest('hex')};},
      web:()=>store.xiaozhiState.modelSettings.web()}),
    preferenceRevision:async()=>(await store.xiaozhiState.teacherPreferences.snapshot()).revision,
    judge:async(id,state,signal)=>judgeDecision(await modelSettings.runtime(id),state,signal),
    routeJudge:async(id,state,signal)=>judgeRoute(await modelSettings.runtime(id),state,signal),
    assertIdle:()=>{if(closing||!configuring.has('provider')||active.size||starting.size)throw Error('busy');}});
  const candidates=createTeacherCandidateCatalog(store.xiaozhiState.sql);
  const paperReviews=createPaperCoordinator({store,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canWrite:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'paper_review',review});}
  });
  const practiceReviews=createPracticeReviewCoordinator({store,afterWrite:options.afterPracticeReviewWrite,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canDecide:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'practice_review',review});}
  });
  const questionReviews=createQuestionReviewCoordinator({store,afterWrite:options.afterQuestionReviewWrite,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canDecide:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'question_review',review});}
  });
  const questionCollections=createQuestionCollectionCoordinator({store,questions:questionReviews,papers:paperReviews,afterWrite:options.afterQuestionReviewWrite,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canDecide:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'question_collection',review});}
  });
  const originalReviews=createOriginalQuestionCoordinator({store,afterWrite:options.afterOriginalReviewWrite,
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    canDecide:(id,runId)=>!closing&&!conversationStarting(id)&&(!active.has(id)||active.get(id)?.runId===runId&&!active.get(id)?.stopped),
    emit:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'question_review',review});}
  });
  const approvals = createPiApprovalCoordinator({ store, dataRoot: options.dataRoot,
    isCurrent: (id, run) => !closing && active.get(id)?.runId === run && !active.get(id)?.stopped,
    emit: (id, runId, payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id, run, payload); } });
  const textChanges = createTextChangeCoordinator({ state: store.xiaozhiState.changes,
    preflight:(...args)=>preflight(...args),
    checkReceipt:(...args)=>checkReceipt(...args),
    sanitize: async text => (await store.sanitizeProblemText(text)).sanitizedText,
    service: createTextChangeService({ state: store.xiaozhiState.changes, dataRoot: options.dataRoot,
      afterStage: options.afterTextChangeStage,
      workspace: async id => {
        if (!validId(id) || closing || choosing.has(id)) throw new Error('permission_denied');
        const detail = await store.getAiConversationSession(id), grant = await store.xiaozhiState.workspace(id);
        if (closing || choosing.has(id) || detail.session.archivedAt) throw new Error('permission_denied');
        return grant?.path || conversationOutput(options.dataRoot,id).path;
      },
      isCurrent: (id, runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    }),
    isCurrent: (id, runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    emit: (id, runId, payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id, run, payload); },
  });
  const officeArtifacts=createOfficeArtifactCoordinator({state:store.xiaozhiState.officeArtifacts,
    preflight:(...args)=>preflight(...args),
    checkReceipt:(...args)=>checkReceipt(...args),
    proposalError:async(id,runId,raw)=>{
      const run=active.get(id);if(run?.runId!==runId||run.stopped)throw Error('cancelled');
      const instructions=(await store.xiaozhiState.controls(id)).filter(item=>item.runId===runId&&item.kind==='instruction'&&item.state==='applied'&&/负责人/.test(item.text));
      if(active.get(id)!==run||run.stopped)throw Error('cancelled');
      // A later applied teacher instruction may replace the original field requirement.
      const prompt=instructions.at(-1)?.text||run.turn.items.find(item=>item.kind==='message'&&item.role==='user')?.text||'';
      return officeBlankFieldError(prompt,raw);
    },
    sanitize:text=>sanitizeOfficeDocumentText(store,text),
    service:createOfficeArtifactService({state:store.xiaozhiState.officeArtifacts,dataRoot:options.dataRoot,
      validateClassroomDraft:async(id,draft)=>{if(!('classroomSource'in draft))throw Error('invalid_input');assertClassroomOffice(await store.xiaozhiState.classrooms.readConfirmed(id,draft.classroomSource.classroomId,draft.classroomSource.version),draft);},
      commitClassroomDraft:async(id,draft,install)=>{if(!('classroomSource'in draft))throw Error('invalid_input');await store.xiaozhiState.classrooms.withConfirmedSource(id,draft.classroomSource.classroomId,draft.classroomSource.version,item=>{assertClassroomOffice(item,draft);install();});},
      validatePaperDraft:async(id,draft)=>{if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');assertPaperOffice(await store.papers.review(id,draft.paperSource.paperId),draft);},
      resolvePaperImages:async(id,draft,signal)=>{if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');assertPaperOffice(await store.papers.review(id,draft.paperSource.paperId),draft);return resolvePaperOfficeImages(draft,store.originalQuestions,signal,store.nativeQuestions);},
      commitPaperDraft:async(id,draft,install)=>{if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');await store.papers.withConfirmedSource(id,draft.paperSource.paperId,draft.paperSource.digest,paper=>{assertPaperOffice(paper,draft);install();});},
      workspace:async id=>(await host.resolveFileWorkspace(id)).path,
      paperWorkspace:resolvePaperOutput,
      isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
      afterStage:options.afterOfficeArtifactStage,
      onState:artifact=>{for(const [id,run] of active)if(run.runId===artifact.runId){publicEvent(id,run,{kind:'office_artifact',artifact});break;}}
    }),
    isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    emit:(id,runId,payload)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,payload);}
  });
  const deliveryReadback=(id:string,runId:string)=>createDeliveryReadback({sessionId:id,runId,state:store.xiaozhiState.deliveries,
    current:()=>!closing&&active.get(id)?.stopped===false,
    workspace:async()=>(await host.resolveFileWorkspace(id)).path,
    fileLabel:async(tool,relative)=>tool==='office_create_document'?sanitizeOfficeDocumentText(store,relative):(await store.sanitizeProblemText(relative)).sanitizedText,
    changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts});
  const deliveries=createDeliveryCoordinator({state:store.xiaozhiState.deliveries,changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts,
    preflight:(...args)=>preflight(...args),
    checkReceipt:(...args)=>checkReceipt(...args),
    inspectionRules:async(id,runId,callId)=>{await store.xiaozhiState.inspections.migrate();const report=await store.xiaozhiState.inspections.call(id,runId,callId);return report?.files.filter(f=>f.rules).map(f=>({path:f.path,rules:structuredClone(f.rules!)}));},
    text:textChanges.service,office:officeArtifacts.service,
    current:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
    taskVersion:async id=>{const task=await tasks.committed(id);return task?`${task.id}:${task.requirementsVersion}`:'none';},
    sanitize:(kind,relative)=>kind==='office'?sanitizeOfficeDocumentText(store,relative):store.sanitizeProblemText(relative).then(v=>v.sanitizedText),
    verify:(id,ref)=>deliveryReadback(id,ref.runId).child(ref),
    proposalError:officeArtifacts.proposalError,
    emit:(id,runId,event)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,event);}
  });
  const preflight=createCheckPreflight({service:fileChecks,sanitize:()=>createStudentContextSanitizer(store),
    owner:(id,runId)=>{const run=active.get(id);if(!run||run.runId!==runId||run.stopped)throw Error('cancelled');return{signal:run.abort.signal,scope:run.goalId||run.task?.id||runId,current:()=>!closing&&active.get(id)===run&&!run.stopped};},
    candidate:async(id,ref,signal)=>{if(ref.kind==='office')return officeArtifacts.service.candidate(id,ref.id,signal);const row=await store.xiaozhiState.changes.get(ref.id);if(!row||row.sessionId!==id||row.state!=='pending')throw Error('conflict');return{path:row.path,bytes:row.after,version:row.afterSha256,candidate:{kind:'text',id:row.id,revision:row.revision}};},
    defaults:async(id,ref)=>{if(ref.kind!=='office')return undefined;const row=await store.xiaozhiState.officeArtifacts.get(ref.id);if(!row||row.sessionId!==id)throw Error('permission_denied');return isPresentationDraft(row.draft)?{pages:row.draft.sections.length,notes:true}:undefined;}
  });
  async function checkReceipt(id:string,runId:string,callId:string):Promise<import('./checks/preflight').InspectionReceipt|undefined>{
    const run=active.get(id);if(!run||run.runId!==runId||run.stopped)return undefined;
    try{const value=await store.xiaozhiState.inspections.call(id,runId,callId);if(!value)return undefined;const report=await fileChecks.get(id,value.id);if(!report)return undefined;return{deliveryInspection:await inspectionSummary(report,await createStudentContextSanitizer(store)),note:'逐文件分开说明真实保存状态与实际检查范围；partial/stale/未检查不说全部完成。'};}catch{return{deliveryInspection:{state:'unchecked'},note:'检查记录未能重新读取；保存状态沿原文件回执，不能声称全面检查通过。'};}
  }
  const controls = createPiControlCoordinator({ store,
    sanitize:async text=>(await createStudentContextSanitizer(store))(text),
    isCurrent:(id,runId) => !closing && active.get(id)?.runId === runId && !active.get(id)?.stopped,
    emit:(id,runId,payload) => { const run = active.get(id); if (run?.runId === runId) publicEvent(id,run,payload); },
    flush:async(id,runId)=>{const run=active.get(id);if(!run||run.runId!==runId||run.stopped||!run.publisher)throw Error('cancelled');await run.publisher.flush();},
    resume:async (item,answer):Promise<XiaozhiActionResult> => {
      const outcome = await host.start({ sessionId:item.sessionId,commandId:item.id.replace('pictrl_','xicmd_'),
        prompt:`继续上次中断的教师澄清。上次问题：${item.text}\n教师回答：${answer}\n只按本次回答继续任务；旧复制、旧审批及未完成效果不要自动重放，所有文件效果需要新确认。` });
      return outcome.ok ? {ok:true} : outcome;
    } });
  async function authorizePaperConversation(id:string){
    if(!validId(id))throw new Error('invalid_input');
    const detail=await store.getAiConversationSession(id);
    if(detail.session.archivedAt||detail.session.studentId&&!(await store.listStudents('')).some(s=>s.id===detail.session.studentId&&s.status==='active'))throw new Error('permission_denied');
  }
  async function resolvePaperOutput(id:string,hash?:string):Promise<string|null>{
    if(closing||choosing.has(id))throw new Error('busy');await authorizePaperConversation(id);
    const grant=await store.xiaozhiState.paperOutput(id,hash),legacy=grant?null:await store.xiaozhiState.workspace(id);
    const raw=grant?.path||legacy?.path||conversationOutput(options.dataRoot,id).path;
    const directory=authorizedWorkspace(raw,options.dataRoot);
    if(hash!==undefined&&workspaceHash(directory)!==hash)throw new Error('permission_denied');
    if(closing||choosing.has(id))throw new Error('busy');await authorizePaperConversation(id);return directory;
  }
  async function snapshot(id = '',settlementRead=0,beforeRunId?:string): Promise<XiaozhiWorkspaceSnapshot> {
    if (id && !validId(id)) throw new Error('invalid_input');
    if (id) await recoverModel(id);
    const model = await modelSettings.model(id || undefined);
    const projection: OfficeProjection = { schemaVersion: 'xiaozhi.office.projection.v1', threadId: id, provider: 'deepseek',
      model, epoch: 1, sourceSequence: 0, needsHydration: false, hasMoreHistory: false, turns: [] };
    if (!id) return { enabled, projection, running: false, legacyHistory: false };
    const detail = await store.getAiConversationHistoryPage(id,beforeRunId?{before:beforeRunId}:{});
    const selectedStudent=detail.session.studentId?(await store.listStudents('')).find(student=>student.id===detail.session.studentId):undefined;
    let task:import('../../shared/xiaozhi-task').TaskView|null=null,taskUnavailable=false;
    try{await tasks.recover(id);task=await tasks.committed(id);}catch{taskUnavailable=true;}
    const binding = await store.xiaozhiState.getBinding(id); if (binding) projection.model = binding.model;
    const modelCapabilities = await readDeepSeekCapabilities(root, projection.model);
    const pageRunIds=detail.messages.filter(message=>message.role==='user').map(message=>String(message.metadata.agentRunId||message.id));
    const runs = new Map((await store.xiaozhiState.runs(id,pageRunIds)).map(row => [String(row.id), row]));
    const messageAttachments=(await store.xiaozhiState.attachments.list(id)).filter(row=>row.state==='submitted').map(publicAttachment);
    let legacyHistory = false;
    for (const message of detail.messages) {
      if (message.role === 'user') {
        const runId = String(message.metadata.agentRunId || message.id), row = runs.get(runId);
        projection.turns.push({ id: runId, status: row?.status === 'running' ? 'running' : row?.status === 'failed' ? 'failed'
          : row?.status === 'blocked' ? 'interrupted' : 'completed',
          items: [{ id: message.id, kind: 'message', role: 'user', text: row && message.metadata.piVersion==='xiaozhi.pi.education.v1' ? publicMessageText(message.content,message.metadata.presentation) : message.content,
            ...(messageAttachments.some(item=>item.messageId===message.id&&item.runId===runId)?{attachments:messageAttachments.filter(item=>item.messageId===message.id&&item.runId===runId)}:{}) }],
          ...(row?.error_message ? { error: String(row.error_message) } : {}) });
      } else if (message.role === 'assistant') {
        const turn = projection.turns.at(-1); if (!turn) continue;
        // Only host-owned Pi runs can supply a public segmented projection.
        const pi = message.metadata.agentRunId === turn.id && runs.has(turn.id) && message.metadata.piVersion === 'xiaozhi.pi.education.v1';
        if (pi && Array.isArray(message.metadata.publicItems)) {
          turn.items.push(...message.metadata.publicItems as OfficeProjectedTurn['items']);
          const reasoning=readModelReasoning(message.metadata.modelReasoning);
          turn.presentation=readChatPresentation(message.metadata.chatPresentation);
          if(reasoning.length)turn.modelReasoning=reasoning.map(b=>b.status==='streaming'?{...b,status:'interrupted'}:b);
          const stages=readPublicStages(message.metadata.publicStages);
          if(stages.length)turn.publicStages=stages;
          if(Number.isFinite(message.metadata.traceElapsedMs)&&Number(message.metadata.traceElapsedMs)>=0)turn.traceElapsedMs=Number(message.metadata.traceElapsedMs);
          if(Number.isSafeInteger(message.metadata.publicStagesOmitted)&&Number(message.metadata.publicStagesOmitted)>0)turn.publicStagesOmitted=Number(message.metadata.publicStagesOmitted);
          turn.status = message.metadata.status === 'interrupted' ? 'interrupted' : message.metadata.ok === true ? 'completed' : 'failed';
          if (message.metadata.errorMessage) turn.error = String(message.metadata.errorMessage);
          turn.verification = validTaskVerification(message.metadata.verification,turn.id) ? message.metadata.verification : legacyVerification(turn.id);
        } else {
          legacyHistory = true; turn.items.push({ id: message.id, kind: 'message', role: 'assistant', phase: 'final_answer', text: message.content });
          if (message.metadata.ok === false) { turn.status = 'failed'; turn.error = message.content; }
          turn.verification = legacyVerification(turn.id);
        }
      }
    }
    projection.hasMoreHistory=detail.hasMore;
    const workspace = await store.xiaozhiState.workspace(id) || {label:CONVERSATION_OUTPUT_LABEL};
    const paperOutput=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?await store.xiaozhiState.paperOutput(id):null;
    const storedLearningReviews=detail.session.studentId&&selectedStudent?.status==='active'&&!detail.session.archivedAt?await store.learningReviews.list(id):[];
    const storedPaperReviews=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?await store.papers.list(id):[];
    const storedPracticeReviews=!detail.session.archivedAt&&selectedStudent?.status==='active'?await store.practiceReviews.list(id):[];
    const storedQuestionCollections=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?await store.questionReviews.collections.list(id):[];
    const storedQuestionReviews=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?[...await store.questionReviews.list(id),...await store.originalQuestions.list(id)]:[];
    const storedApprovals = (await store.xiaozhiState.approvals(id)).map(publicApproval);
    const changes = (await store.xiaozhiState.changes.list(id)).map(changeSummary);
    const artifacts=(await store.xiaozhiState.officeArtifacts.list(id)).map(officeSummary);
    const storedDeliveries=await deliveries.list(id);
    const interruptedSend = await store.xiaozhiState.interruptedSend(id);
    let storedControls = (await store.xiaozhiState.controls(id)).map(publicControl);
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
    // Domain reads above can reveal a pending teacher question before its queued
    // public event commits. Flush that already-published queue before returning
    // a snapshot; keep DB failure visible without advancing an uncommitted cursor.
    await active.get(id)?.publisher?.flush().catch(() => undefined);
    // Journal truth for new runs, compatibility publicItems for historical runs.
    const durable = await store.xiaozhiState.eventJournal.snapshotsForRuns(id,projection.turns.map(turn=>turn.id));
    for (const saved of durable) {
      const index = projection.turns.findIndex(turn => turn.id === saved.turn.id);
      if (index >= 0) projection.turns[index] = saved.turn; else projection.turns.push(saved.turn);
    }
    // Merge active state after persisted reads; no await after this live snapshot.
    const current = active.get(id);
    // A run can finish while the asynchronous historical reads are in flight.
    // Refresh its durable result once instead of returning running=false with stale running history.
    if(!current&&settlementRead===0&&projection.turns.some(turn=>turn.status==='running'))return snapshot(id,1,beforeRunId);
    if (current) {
      const index = projection.turns.findIndex(turn => turn.id === current.runId);
      if (index >= 0) projection.turns[index] = structuredClone(current.turn); else projection.turns.push(structuredClone(current.turn));
      projection.sourceSequence = current.sequence;
      const metrics=current.agent?.usage() || current.usage;
      const value={...metrics,runId:current.runId,state:current.usage.state};
      const indexUsage=usage.findIndex(item=>item.runId===current.runId);
      if(indexUsage>=0)usage[indexUsage]=value;else usage.push(value);
    }
    // V2 adoption is a committed journal fact, not a newer private CAS draft.
    // The same committed turn is used for both inline plans and snapshot controls.
    storedControls=storedControls.filter(control=>!control.plan);
    for(const turn of projection.turns)for(const item of turn.items)if(validVersionedPlan(item.plan))storedControls.push(structuredClone(item.plan));
    if (journalFailures.has(id)) {
      const index = projection.turns.findIndex(turn => turn.id === journalFailures.get(id)?.runId);
      if (index >= 0) projection.turns[index] = applyXiaozhiEvent(projection.turns[index], { sessionId: id, runId: projection.turns[index].id, sequence: 0, kind: 'status', status: 'failed', error: 'event_persistence' });
    }
    for (const metrics of usage) {
      const index = projection.turns.findIndex(turn => turn.id === metrics.runId);
      if (index >= 0) projection.turns[index] = applyXiaozhiEvent(projection.turns[index],
        { kind: 'usage', usage: metrics, sessionId: id, runId: metrics.runId, sequence: 0 });
    }
    // Derive the public view after journal/history hydration; persisted audit remains untouched.
    projection.turns = projection.turns.map(publicProviderTurn);
    return { enabled, fileWritesEnabled:fileWritesEnabled(), projection, eventCursors: durable.map(saved=>saved.cursor), ...(journalFailures.has(id)?{eventPersistence:'unavailable' as const}:{}), running: Boolean(current)&&!journalFailures.has(id), ...(detail.session.studentId?{studentContext:{id:detail.session.studentId,label:selectedStudent?.displayName||'学生档案不可用',status:selectedStudent?.status||'missing'}}:{}), ...(current?.operation === 'compact' ? { operation: 'compact' as const } : {}), legacyHistory: legacyHistory && !binding, interruptedSend,
      modelCapabilities, contextPolicy: current?.agent?.contextPolicy() || { auto: options.autoCompaction === true && Boolean(modelCapabilities), verified: Boolean(modelCapabilities),
        window: Math.min(modelCapabilities?.contextWindow || 32768, options.testContextWindow || Infinity), maxOutputTokens: answerQualityEnabled()?resolveAnswerPolicy('',modelCapabilities).maxOutputTokens:Math.min(4096, modelCapabilities?.maxOutputTokens || 4096),
        ...(options.testContextWindow ? { testPolicy: true } : {}) },
      ...(task?{task}:{}),...(taskUnavailable?{taskUnavailable:true}:{}),paperReviews:storedPaperReviews,practiceReviews:storedPracticeReviews,questionCollections:storedQuestionCollections,questionReviews:storedQuestionReviews,learningReviews:storedLearningReviews, approvals: storedApprovals, changes, deliveries:storedDeliveries, officeArtifacts:artifacts, controls:storedControls, ...(storedGoal?{goal:publicGoal(storedGoal)}:{}), budgetSettings, limitsEnforced:false, browser:browserStatus, usage, memoryScope, skills: skillCatalog, ...(workspace ? { workspace: { label: workspace.label } } : {}),...(paperOutput?{paperOutput:{label:paperOutput.label}}:{}) };
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
    const thinking=await modelSettings.thinking(id);
    const unfinished=owner?.unfinishedThinkingTask;
    const toolTaskQuery=[...(owner?.task?.criteria.filter(c=>c.kind==='human').map(c=>c.text)||[]),...(owner?.task?.steps.map(step=>step.text)||[]),...(isThinkingContinuation(cleanPrompt)||isTaskAmendment(cleanPrompt)?[unfinished||'']:[])].join('\n').slice(0,8000);
    const taskDepth=unfinished&&isThinkingContinuation(unfinished)&&thinking.lastRun?.mode==='deep'?'深入教学任务':unfinished;
    const thinkingPolicy=resolveThinkingPolicy(cleanPrompt,capabilities,thinking.session?.choice??thinking.global.choice??'auto',thinking.session?.choice?'session':'global',taskDepth);
    const studentId=(await store.getAiConversationSession(id)).session.studentId||'';
    let observedLearning:(Awaited<ReturnType<typeof store.studentContext.learningSnapshot>>&{reviewVersion:number})|undefined;
    const observedMaterials=new Map<string,string>();
    const classroomContext=createClassroomContext(owner?.teacherPreferenceRevision||0);
    const mcpTools = await mcp.tools();
    const observedQuestions=new Map<string,QuestionContextSource>();
    const observedEnrichmentQuestions=new Map<string,QuestionContextSource>();
    let webAnswerRuntime:ReturnType<typeof createQuestionWebAnswerTools>|undefined;
    const questionAliases:QuestionAliases=new Map();let observedMistakeLearning:ObservedMistakeLearning|undefined;
    try { return {stateRoot,workspace,thinkingPolicy,toolTaskQuery,fileOutputWorkspace:await resolvePaperOutput(id)||workspace,...(!grant?{fileReadWorkspace:conversationOutput(options.dataRoot,id).path}:{}),apiKey:settings.apiKey,model:settings.model,sessionFile,budget,limitsEnforced:false,capabilities,mcpTools:scopeQuestionWebExternalTools(mcpTools.definitions,()=>observedEnrichmentQuestions.size>0),mcpDispose:mcpTools.dispose,
      sourceAvailability:async()=>{
        const [presence,attachments]=await Promise.all([store.getChatSourcePresence(),store.xiaozhiState.attachments.list(id)]);
        return {...presence,attachments:attachments.some(row=>row.state==='submitted'),workspace:true,generatedWorkspace:!Boolean(await store.xiaozhiState.workspace(id))};
      },
      ...(owner?.goalId?{goal:createGoalRuntime({store,sessionId:id,goalId:owner.goalId,runId,
        current:()=>!closing&&active.get(id)===owner&&!owner.stopped,
        teacherInputs:async()=>{
          if(!owner.publisher)throw Error('evidence_missing');
          await owner.usageWrites;await owner.publisher.barrier();
          return readTeacherAnswerDigests({sql:store.xiaozhiState.sql,owner:owner.publisher.owner,nativeRoot:root,current:()=>!closing&&active.get(id)===owner&&!owner.stopped});
        },
        verify:async()=>{
          if(!owner.results||!owner.readResults||!owner.publisher)throw Error('evidence_missing');
          const signal=AbortSignal.any([owner.abort.signal,AbortSignal.timeout(15000)]);
          await owner.usageWrites;signal.throwIfAborted();
          await owner.publisher.barrier();signal.throwIfAborted();
          const verification=await owner.results.check(owner.verification!.finish({failed:false,stopped:false}),owner.readResults,signal);
          signal.throwIfAborted();if(closing||active.get(id)!==owner||owner.stopped)throw Error('cancelled');
          publicEvent(id,owner,{kind:'verification',verification});await owner.publisher.flush();signal.throwIfAborted();return verification;
        },
        evidence:()=>owner.turn.items.filter(item=>item.kind==='tool'&&item.status==='completed'&&!['记录目标进度','更新任务计划','请教师补充'].includes(item.label||'')).map(item=>({runId,callId:item.id,label:(item.label||'已完成授权工具').slice(0,200)})),
        emit:goal=>{if(active.get(id)===owner)publicEvent(id,owner,{kind:'goal',goal});}})}:{}),
      ...(web.enabled?{webTools:createPiWebTools({workspace,sessionId:id,runId,dnsMode:web.dnsMode,limitsEnforced:false,beforeExecute:()=>{if(observedEnrichmentQuestions.size)throw Error('permission_denied');},
        sanitize:text=>sanitizeOfficeDocumentText(store,text),isCurrent:()=>!closing&&(!owner||active.get(id)===owner&&!owner.stopped)})}:{}),
      ...(web.enabled?{browserTools:wait=>createPiBrowserTools({host:browser,sessionId:id,dnsMode:web.dnsMode,
        beforeExecute:input=>webAnswerRuntime?.guard(input),onExtract:(callId,data,signal)=>webAnswerRuntime?.observe(callId,data,signal)||Promise.resolve(undefined),
        current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        confirm:(question,signal,callId)=>wait(async()=>{const tool=controls.tools(id,runId).find(item=>item.name==='ask_teacher')!;
          const result=await tool.execute(callId,{question,options:['同意这次操作','拒绝这次操作']},signal,undefined,undefined as never);
          const content=result.content.find(item=>item.type==='text');if(!content||content.type!=='text')return false;
          return JSON.parse(content.text).answer==='同意这次操作';})})}:{}),
      ...(web.enabled?{questionWebAnswerTools:(wait:(action:()=>Promise<boolean>)=>Promise<boolean>)=>{
        webAnswerRuntime=createQuestionWebAnswerTools({repo:store.questionWeb,onNetworkScope:(scope,reset)=>browser.setNetworkScope(id,scope,reset),owner:{sessionId:id,runId},observed:observedEnrichmentQuestions,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),confirm:(question,signal,callId)=>wait(async()=>{
          const tool=controls.tools(id,runId).find(item=>item.name==='ask_teacher')!,result=await tool.execute(callId,{question,options:['同意这次操作','拒绝这次操作']},signal,undefined,undefined as never);const content=result.content.find(item=>item.type==='text');return content?.type==='text'&&JSON.parse(content.text).answer==='同意这次操作';
        })});return webAnswerRuntime.tools;
      }}:{}),
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
      officeTextTools: wait => textChanges.tools(id, runId, wait),officeArtifactTools:wait=>officeArtifacts.tools(id,runId,wait),deliveryTools:wait=>deliveries.tools(id,runId,wait,officeArtifacts.tools(id,runId,wait)[0].parameters,owner?.resumeDeliveryId),officeDocumentTools:createOfficeDocumentTools({sessionId:id,runId,
        resolve:target=>host.resolveFileWorkspace(target),isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        sanitize:text=>sanitizeOfficeDocumentText(store,text)}),
      classroomExportTools:wait=>createClassroomExportTools({sessionId:id,runId,state:store.xiaozhiState.classrooms,wait,runOffice:officeArtifacts.runOffice,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped}),paperExport:{studentId,outputOnly:!grant,tools:wait=>createPaperExportTool({papers:store.papers,paperExportIntent:owner?.paperExportIntent,sessionId:id,runId,wait,runOffice:officeArtifacts.runOffice,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped})},
      autoCompaction:options.autoCompaction,testContextWindow:options.testContextWindow,afterAutoCompactCommit:options.afterAutoCompactCommit,beforeAutoCompactCommit:options.beforeAutoCompactCommit,
      sanitizeFileText:async text=>(await store.sanitizeProblemText(text)).sanitizedText,protectedContext:async excluded=>(await getPiProtectedContext(store,id,excluded,await tasks.committed(id),await createStudentContextSanitizer(store)))+(await deliveries.context(id,owner?.resumeDeliveryId))+(fileWritesEnabled()?'':'\n小智自动文件生成已暂停；已有记录、文件可读取和核验，不能提出或执行新的自动文件写入，不要声称已交付新文件。恢复生成需取消启动停写设置并重启。'),
      computationTools:managedComputationTools({service:owner?.computationScope||managedTools,capture:owner?.computationResults?.capture,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:async text=>(await createStudentContextSanitizer(store))(text)}),
      deliveryCheckTools:deliveryCheckTools({service:fileChecks,sessionId:id,runId,scope:()=>owner?.goalId||owner?.task?.id||runId,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitizer:()=>createStudentContextSanitizer(store)}),
      computationReportTools:wait=>computationReportTools({results:owner?.computationResults,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        publish:async(files,args)=>{
          if(files.length>1)return deliveries.tools(id,runId,wait,officeArtifacts.tools(id,runId,wait)[0].parameters,owner?.resumeDeliveryId)[0].execute(args[0],{files},args[2],args[3],args[4]);
          const file=files[0],{fileId,kind,...payload}=file;
          const tool=kind==='office'?officeArtifacts.tools(id,runId,wait)[0]:textChanges.tools(id,runId,wait).find(t=>t.name==='office_create_text')!;
          return tool.execute(args[0],payload,args[2],args[3],args[4]);
        }}),
      teacherRequestTools:excluded=>[createTeacherRequestTool({excluded,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        load:async blocked=>{const [detail,controls,task]=await Promise.all([store.getAiConversationSession(id),store.xiaozhiState.controls(id),tasks.committed(id)]);return teacherRequestSources(detail.messages,controls,blocked,task);},
        sanitize:async text=>(await createStudentContextSanitizer(store))(text)})],
      memory:{runId,authority:()=>memory.authority(id),readSelected:(authority,signal)=>memory.readSelected(id,authority,signal),trace:()=>memory.trace(id)},
      educationTools:createEducationTools(store,cleanPrompt),controlTools:controls.tools(id,runId),
      questionContextTools:createQuestionContextProvider(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(reference,source)=>{observedQuestions.set(reference,source);},questionAliases,(reference,source)=>{observedEnrichmentQuestions.set(reference,source);webAnswerRuntime?.requireAuthorization();}),
      questionReviewTools:questionReviews.tools(id,runId,observedQuestions,undefined,{provider:'deepseek',model:settings.model,runId}),
      questionCollectionTools:questionCollections.tools(id,runId,observedQuestions,{provider:'deepseek',model:settings.model,runId}),
      practiceReview:{studentId,tools:practiceReviews.tools(id,runId,studentId,observedQuestions)},
      paperReview:{studentId,tools:paperReviews.tools(id,runId)},
      originalQuestionReviewTools:originalReviews.tools(id,runId,observedMaterials),
      materialTools:createMaterialTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(resourceId,version,material)=>{classroomContext.observe(material);observedMaterials.set(resourceId,version);}),
      materialPageTools:createMaterialPageTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,observedMaterials),
      educationCapabilityTools:createEducationCapabilityProvider(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped).tools,
      classroomTools:[...createClassroomTools({outlineOnly:Boolean(owner?.classroomPlan),context:()=>classroomContext.snapshot(),sessionId:id,runId,state:store.xiaozhiState.classrooms,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text)}),...createClassroomPlanTools({sessionId:id,runId,state:store.xiaozhiState.classroomPlans,binding:owner?.classroomPlan,context:()=>classroomContext.snapshot(),current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text)})],
      educationSearchTools:createEducationSearchTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      studentContext:{studentId,tools:createStudentContextProvider(store,id,studentId,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped)},
      studentLearning:{studentId,tools:createLearningProvider(store,id,studentId,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(facts,delivered)=>{observedLearning=facts;observedMistakeLearning={facts,delivered};})},
      studentSimilar:{studentId,tools:createMistakeSimilarProvider({store,sessionId:id,studentId,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,observed:()=>observedMistakeLearning,aliases:questionAliases})},
      studentLearningReview:{studentId,tools:learningReviews.tools(id,runId,()=>observedLearning)},
      ...(ledger?{modelHistory:{authorize:manager=>coordinator.authorize(manager,id),
        beforeLoad:(manager,authority)=>coordinator.beforeAuthorityLoad(manager,ledger,authority),
        align:(session,authority)=>coordinator.alignAuthorityBranch(session,ledger,authority)}}:{})};
    } catch (error) { await mcpTools.dispose(); throw error; }
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
    } finally {await agent.dispose();}
    });
  }
  async function execute(id: string, prompt: string, run: Active, settings: Pick<Awaited<ReturnType<OmniEduStore['getDeepSeekRuntimeSettings']>>, 'provider' | 'apiKey' | 'model'>) {
    const executionStarted=performance.now();let preparationMs:number|undefined,sdkEndedMs:number|undefined;
    let failure: XiaozhiAgentError | undefined, text = '',answerTruncated=false;
    try {
      publicEvent(id,run,{kind:'activity',stage:'preparing',since:Date.now()});
      if (!settings.apiKey) throw new Error('authentication');
      const apiKey=settings.apiKey;
      if (run.stopped) throw new Error('cancelled');
      const preparing=<T>(action:(signal:AbortSignal)=>Promise<T>)=>waitForLifecycle('host_preparation',action,{signal:run.abort.signal,timeoutMs:options.lifecycleTimeoutMs??15000});
      const cleanPrompt = await preparing(async signal=>{const sanitize=await createStudentContextSanitizer(store);signal.throwIfAborted();return sanitize(prompt);});
      const selected=(await preparing(()=>store.getAiConversationSession(id))).session.studentId;
      if(selected){try{await preparing(()=>store.studentContext.snapshot(selected));}catch(error){if(run.stopped)throw Error('cancelled');throw new Error('permission_denied');}}
      const preference=run.operation==='prompt'?await preparing(()=>store.xiaozhiState.teacherPreferences.observe(id,run.runId,()=>!closing&&!run.stopped&&active.get(id)===run)):{snapshot:await preparing(()=>store.xiaozhiState.teacherPreferences.snapshot()),action:'none'};
      run.teacherPreferenceRevision=preference.snapshot.revision;
      if(run.operation==='prompt'){
        try{await preparing(()=>decisions.capture({sessionId:id,runId:run.runId,goalId:run.goalId,preferenceRevision:preference.snapshot.revision,hasPreferences:Object.keys(preference.snapshot.values).length>0,action:preference.action,trial:Boolean('trial'in preference&&preference.trial)}));}
        catch{decisions.unavailable(id);}
      }
      const capabilities = await preparing(signal=>resolveDeepSeekCapabilities(root, settings.model, apiKey, signal));
      const { createPiXiaozhiSession } = await import('./pi-session');
      if (run.stopped) throw new Error('cancelled');
      if(run.operation==='prompt'){run.computationScope=await preparing(()=>managedTools.freeze());run.computationResults=createComputationResults({sessionId:id,runId:run.runId});}
      const base=await preparing(()=>sessionConfiguration(id,{apiKey,model:settings.model},run.runId,capabilities,run.usage.budget,cleanPrompt,run));
      if(base.thinkingPolicy)await preparing(()=>store.xiaozhiState.modelSettings.saveThinkingRun(id,{...base.thinkingPolicy!,runId:run.runId,model:settings.model}));
      const priorProtectedContext=base.protectedContext,preferenceText=teacherPreferenceContext(preference.snapshot,preference.action)+('trial'in preference&&preference.trial?teacherPreferenceTrialContext(preference.trial):'')+(preference.action==='observed'?teacherPreferenceCorrectionContext(implicitTeacherCorrection(cleanPrompt)):'');
      // Freeze one evaluated version for this run; stable system/tool prefix is unchanged.
      base.protectedContext=async excluded=>(await priorProtectedContext?.(excluded)||'')+preferenceText;
      const readbackImporter=createAttachmentImportService({dataRoot:options.dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,
        isCurrent:()=>!closing&&active.get(id)===run&&!run.stopped});
      const readSavedFile=createEffectReadback({sessionId:id,runId:run.runId,
          current:()=>!closing&&active.get(id)===run&&!run.stopped,
          workspace:async()=>(await host.resolveFileWorkspace(id)).path,
          fileLabel:async(tool,relative)=>tool==='office_create_document'?sanitizeOfficeDocumentText(store,relative):(await store.sanitizeProblemText(relative)).sanitizedText,
          fileText:text=>base.sanitizeFileText!(text),
          changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts});
      const readWebAnswers=createQuestionWebAnswerReadback({sessionId:id,runId:run.runId,current:()=>!closing&&active.get(id)===run&&!run.stopped,repo:store.questionWeb});
      const readSavedQuestions=createEducationReadback({sessionId:id,runId:run.runId,
        current:()=>!closing&&active.get(id)===run&&!run.stopped,questions:store.questionReviews});
      const readSavedPractice=createPracticeReadback({sessionId:id,runId:run.runId,
        current:()=>!closing&&active.get(id)===run&&!run.stopped,practice:store.practiceReviews});
      run.results=createRunResultReadback({runId:run.runId,
        ...(run.goalId?{bindDiscovery:createDiscoveryReadback({sessionId:id,runId:run.runId,current:()=>!closing&&active.get(id)===run&&!run.stopped,workspace:()=>host.resolveFileWorkspace(id)})}:{}),
        bindEffect:(callId,tool,payload)=>{tool=computationEffectTool(tool,payload);return tool==='education_web_answer'?readWebAnswers(callId,tool,payload):tool==='education_propose_questions'?readSavedQuestions(callId,tool,payload)
          :tool==='education_propose_practice'?readSavedPractice(callId,tool,payload):tool==='office_deliver_files'?deliveryReadback(id,run.runId).bind(callId,payload):readSavedFile(callId,tool,payload);},
        readLocal:async(tool,payload)=>{
          const signal=AbortSignal.any([run.abort.signal,AbortSignal.timeout(10000)]);
          if(closing||active.get(id)!==run||run.stopped)throw Error('cancelled');
          if(tool==='office_read_attachment'){
            const row=await store.xiaozhiState.attachments.get(id,payload.source.attachmentId);
            if(!row||row.version!==payload.source.version)throw Error('attachment_changed');
            const reader=base.attachmentTools!.find(t=>t.name===tool)!;
            const result=await reader.execute('verification_readback',{id:row.id,revision:row.revision,
              startLine:payload.source.locator.start,lineCount:payload.source.locator.end-payload.source.locator.start+1},signal,undefined,undefined as never);
            if(result.isError)throw Error('evidence_missing');return result.content;
          }
          const lease=await host.resolveFileWorkspace(id);
          const reader=createHanaOfficeTools({workspace:lease.path,sessionId:id,runId:run.runId,networkAllowed:false,fileVersion});
          const result=await reader.execute('office_read_text','verification_readback',{path:payload.data.source},signal);
          if(!result.success||result.data?.version!==payload.data.version)throw Error('evidence_missing');
          result.data!.text=await base.sanitizeFileText!(result.data!.text as string);signal.throwIfAborted();
          return[{type:'text',text:JSON.stringify(result)}];
        },
        verifyImage:async receipt=>{
          const signal=AbortSignal.any([run.abort.signal,AbortSignal.timeout(10000)]),ref=receipt.attachment!;
          const row=await store.xiaozhiState.attachments.get(id,ref.id),detail=await store.getAiConversationSession(id);
          if(!row||row.state!=='submitted'||row.format!=='image'||row.revision!==ref.revision||row.version!==ref.version||detail.session.archivedAt
            ||!detail.messages.some(m=>m.id===row.messageId&&m.role==='user'&&m.metadata.agentRunId===row.runId))return false;
          await readbackImporter.verify(id,{id:ref.id,revision:ref.revision},signal);return true;
        }});
      const resumedResults=run.task?createTaskResultRecheck({store,dataRoot:options.dataRoot,nativeRoot:root,current:sessionId=>sessionId===id&&!closing&&active.get(id)===run&&!run.stopped,workspace:sessionId=>host.resolveFileWorkspace(sessionId)}):undefined;
      const taskRuntime=run.task&&run.publisher?createTaskPlanRuntime({sql:store.xiaozhiState.sql,taskId:run.task.id,publisher:run.publisher,contextSanitizer:()=>createStudentContextSanitizer(store),
        current:()=>!closing&&active.get(id)===run&&!run.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),trustedMcpNames:new Set(base.mcpTools?.map(t=>t.name)),
        resources:createTaskResources({sessionId:id,workspace:()=>host.resolveFileWorkspace(id),officeOutput:()=>resolvePaperOutput(id),studentId:async()=>(await store.getAiConversationSession(id)).session.studentId||'',attachment:async attachmentId=>(await store.xiaozhiState.attachments.get(id,attachmentId))?.state==='submitted'}),
        proofs:async()=>{if(!run.results||!run.readResults)return[];await run.publisher!.barrier();const proofs:import('../../shared/xiaozhi-verification').TaskVerification[]=[];
          const task=await tasks.committed(id);if(!task||task.id!==run.task!.id)throw Error('task_owner_stale');
          for(const previous of await tasks.admittedRuns(id,task.id)){if(previous.runId===run.runId)continue;try{proofs.push(await resumedResults!.run(previous.runId,task));}catch{run.abort.signal.throwIfAborted();if(closing||run.stopped||active.get(id)!==run)throw Error('cancelled');/* Missing old authority stays unverified; no tool or approval is replayed. */}}
          const v=await run.results.check({...legacyVerification(run.runId),state:'needs_human',reason:'human_review',checkedAt:new Date().toISOString()},run.readResults,run.abort.signal);return[...proofs,v];}}):undefined;
      if(taskRuntime&&run.task?.lastRunId===run.runId)await taskRuntime.refresh();
      run.agent = await createPiXiaozhiSession({ ...base,taskRuntime,beforeModelDelivery:options.beforeModelDelivery,lifecycleSignal:run.abort.signal,lifecycleTimeoutMs:options.lifecycleTimeoutMs,onCriticalToolFailure:error=>run.publisher?.fail(error||Error('event_persistence')),onToolAttempt:async(attempt,signal)=>{if(!run.publisher)throw Error('event_journal_unavailable');signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');publicEvent(id,run,{kind:'tool_attempt',attempt});await run.publisher.barrier();signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');},beforeDelivery:async(delivery,signal)=>{
        if(!run.publisher)throw Error('event_journal_unavailable');
        signal?.throwIfAborted();await run.publisher.barrier();signal?.throwIfAborted();
        if(run.stopped||active.get(id)!==run)throw Error('cancelled');
        if(delivery.kind==='tool'){
          if(delivery.tool===PAPER_TOOLS[0]){
            if(!taskRuntime||!run.task)throw new TaskAdmissionError('task_owner_stale');
            await taskRuntime.refresh();
            await paperReviews.admitProposal({sessionId:id,runId:run.runId,commandId:run.commandId,generation:run.publisher.owner.generation,callId:delivery.callId,taskId:run.task.id,requirementsVersion:run.task.requirementsVersion},delivery.input,signal);
          }else await admitClassroomOrTaskTool({sessionId:id,runId:run.runId,intent:run.classroomPlan,plans:store.xiaozhiState.classroomPlans,current:()=>!closing&&!run.stopped&&active.get(id)===run,signal,task:taskRuntime},delivery.callId,delivery.tool,delivery.input);
          await run.publisher.persist(owner=>{signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');return store.xiaozhiState.eventJournal.admitTool(owner,delivery.callId,delivery.tool);});
        }
        signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');
      },onToolResult:(callId,tool,result,failed)=>{
          run.results?.capture(callId,tool,result,failed);
          if(!failed&&tool==='office_create_document'){
            const unchanged=presentationUnchangedReceipt((result as {content?:unknown})?.content);
            if(unchanged){run.officePresentation??=createOfficeDeliveryPresentation(run.runId);run.officePresentation.unchanged(callId,unchanged.file);}
          }
          try{(run.receiptCaptures??=new Map()).set(callId,{callId,tool,failed,digest:toolResultDigest(tool,(result as {content?:unknown})?.content,failed)});}catch{/* Unsupported or oversized bodies remain unknown; no raw body is retained here. */}
        }, onEvent: event => {
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
      if(!run.publisher)throw Error('event_journal_unavailable');
      const tail=captureNativeTail(run.agent.sessionFile,root),owner=run.publisher.owner;
      const markerId=run.agent.session.sessionManager.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...owner});
      await run.publisher.persist(current=>store.xiaozhiState.eventJournal.bindNative(current,{...tail,...owner,markerId}));
      run.readResults=bindNativeResultReadback(run.agent.sessionFile,root);
      // Fence legacy version-1 readers before any model/tool memory delivery.
      await store.xiaozhiState.setBinding(id, path.relative(root, run.agent.sessionFile), settings.model, 4);
      if (run.stopped) throw new Error('cancelled');
      const count=run.turn.items[0]?.attachments?.length||0;
      const deliveredPrompt=count?`${cleanPrompt}\n\n本轮有 ${count} 个已登记的本地附件。文件正文和图片尚未提供给你，请勿声称已阅读、查看或分析这些附件；需要读取时说明所需操作。`:cleanPrompt;
      preparationMs=performance.now()-executionStarted;
      const result = await (run.operation === 'compact' ? run.agent.compact() : run.agent.prompt(deliveredPrompt));
      sdkEndedMs=performance.now()-executionStarted;
      if(result.ok&&taskRuntime&&!run.stopped)await taskRuntime.refresh();
      if (run.operation === 'compact' && result.ok) await options.afterCompactCommit?.();
      if (result.ok) {text = result.text;answerTruncated=result.truncated;} else failure = result.error;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      failure = code === 'authentication' || code === 'cancelled' || code === 'permission_denied' || code === 'memory_scope_changed' || code === 'skill_source_changed' || code === 'skill_scope_changed' ? code : 'configuration';
    } finally {
      run.computationScope?.release();
      await run.agent?.dispose().catch(() => { failure ||= 'configuration'; });
      run.computationResults?.clear();
      if(run.classroomPlan?.mode==='generate')await store.xiaozhiState.classroomPlans.finishRun(run.runId).catch(()=>{failure||='configuration';});
      await controls.finish(id,run.runId).catch(() => { failure ||= 'configuration'; });
      await approvals.cancel(run.runId).catch(() => { failure ||= 'configuration'; });
      await textChanges.cancel(run.runId).catch(() => { failure ||= 'configuration'; });
      await officeArtifacts.cancel(run.runId).catch(()=>{failure||='configuration';});
      await deliveries.cancel(run.runId).catch(()=>{failure||='configuration';});
      await store.xiaozhiState.approvals(id).then(async rows => {
        for (const row of rows) if (row.runId === run.runId && row.state === 'executing') await store.xiaozhiState.transition(row.id, ['executing'], 'uncertain');
      }).catch(() => { failure ||= 'configuration'; });
      if (run.stopped) failure = 'cancelled';
      await run.usageWrites.catch(()=>{failure ||= 'configuration';});
      let deliveryText: string | undefined, fileFinal: DeliveryFinal | undefined;
      try {
        fileFinal=await deliveryFinal({sessionId:id,runId:run.runId,callOrder:run.turn.items.filter(item=>item.kind==='tool').map(item=>item.id),observed:run.officePresentation?.hasArtifacts===true,unchangedEdits:run.officePresentation?.unchangedEdits,
          failedFileCalls:run.turn.items.filter(item=>item.kind==='tool'&&item.status==='failed'&&isFileDeliveryTool(item.toolName||'')).map(item=>({callId:item.id,code:item.toolAttempt?.code,effect:item.toolAttempt?.effect||'unknown'})),
          failure:failure==='cancelled'?'stopped':failure?'failed':undefined,ports:{
          changes:()=>store.xiaozhiState.changes.list(id,run.runId),office:()=>store.xiaozhiState.officeArtifacts.list(id,run.runId),bundles:()=>store.xiaozhiState.deliveries.list(id,run.runId),
          text:changeId=>store.xiaozhiState.changes.get(changeId),artifact:artifactId=>store.xiaozhiState.officeArtifacts.get(artifactId),inspections:()=>fileChecks.forRun(id,run.runId)}});
        deliveryText=fileFinal?.text;
      } catch { failure ||= 'configuration'; }
      if (deliveryText) text=deliveryText;
      await run.publisher?.flush().catch(()=>{failure='event_persistence';});
      if(run.publisher&&!run.publisher.failed){try{const recovery=await run.publisher.persist(owner=>store.xiaozhiState.eventJournal.reconcile(owner));if(recovery.receipts.length){publicEvent(id,run,{kind:'recovery',recovery});await run.publisher.flush();}}catch{failure='event_persistence';}}
      if(run.publisher?.failed)failure='event_persistence';
      const status: 'interrupted' | 'failed' | 'completed' = failure === 'cancelled' ? 'interrupted' : failure ? 'failed' : 'completed';
      const terminal = { kind: 'status' as const, status, finishedAt:Date.now(),...(failure ? { error: failure } : {}) };
      const finalTurn = applyXiaozhiEvent(run.turn, { ...terminal, sessionId: id, runId: run.runId, sequence: run.sequence + 1 });
      const lastText = [...finalTurn.items].reverse().find(item => item.kind === 'message' && item.role === 'assistant');
      if (deliveryText) {
        // The model's original final text remains in the native transcript.
        // Persist the same local delivery presentation for live and cold views.
        if(lastText?.phase==='final_answer')lastText.phase='commentary';
        finalTurn.items.push({id:`${run.runId}:office-delivery`,kind:'message',role:'assistant',phase:'final_answer',text:deliveryText});
      } else if (!failure && text) {
        if (lastText) {lastText.text = text;if(answerTruncated)lastText.truncated=true;}
        else finalTurn.items.push({ id: `${run.runId}:final`, kind: 'message', role: 'assistant', phase: 'final_answer', text,...(answerTruncated?{truncated:true}:{}) });
      }
      // Persist the same partial/final presentation before publishing the committed terminal state.
      run.turn.items=applyXiaozhiEvent(run.turn,{...terminal,sessionId:id,runId:run.runId,sequence:run.sequence}).items;
      try {
        run.usage={...run.usage,state:status};
        await store.xiaozhiState.saveUsage(id,run.usage);
        const taskGoal=run.goalId ? await store.xiaozhiState.goals.get(run.goalId) : undefined;
        run.verification ??= createRunVerification(run.runId);
        finalTurn.verification=run.verification.finish({failed:Boolean(failure),stopped:run.stopped,
          teacherCriteria:taskGoal?.sessionId===id&&taskGoal.runId===run.runId?taskGoal.criteria:undefined});
        if(run.results&&run.readResults)finalTurn.verification=await run.results.finish(finalTurn.verification,run.readResults);
        if(fileFinal?.incomplete&&finalTurn.verification.state==='verified'){finalTurn.verification={...finalTurn.verification,state:'partial',reason:'evidence_missing',checks:finalTurn.verification.checks.some(c=>c.id==='coverage:unknown')?finalTurn.verification.checks:[...finalTurn.verification.checks.slice(0,63),{id:'coverage:unknown',state:'unknown',evidenceIds:[]}]};}
        for (const item of finalTurn.items.filter(item => item.kind === 'tool')) {
          await store.recordAiAgentEvent(run.runId, { phase: 'observe', status: item.status === 'completed' ? 'succeeded' : 'failed',
            label: item.label || '授权工具', detail: item.status === 'completed' ? '工具实际执行完成。' : '工具没有完成。',
            outputSummary: { callId: item.id, status: item.status } });
        }
        await store.appendAiConversationMessage(id, { role: 'assistant', content: text || (failure ? XIAOZHI_ERRORS[failure] : XIAOZHI_ERRORS.model_error),
          metadata: { piVersion: 'xiaozhi.pi.education.v1', agentRunId: run.runId, provider: 'deepseek', model: settings.model,
            answerQuality:{version:1,mode:process.env.XIAOZHI_ANSWER_QUALITY==='legacy'?'legacy':'optimized',preparationMs,sdkEndedMs,...run.agent?.qualityMetrics()},
            ok: !failure, status, errorMessage: failure ? XIAOZHI_ERRORS[failure] : '',
            publicItems: finalTurn.items.filter(item => item.id !== finalTurn.items[0]?.id),
            ...(finalTurn.presentation?{chatPresentation:finalTurn.presentation}:{}),
            ...(finalTurn.modelReasoning?.length?{modelReasoning:{version:1,blocks:finalTurn.modelReasoning}}:{}),
            ...(finalTurn.publicStages?.length?{publicStages:finalTurn.publicStages,publicStagesOmitted:finalTurn.publicStagesOmitted||0}:{}),
            ...(finalTurn.traceElapsedMs===undefined?{}:{traceElapsedMs:finalTurn.traceElapsedMs}),
            verification:finalTurn.verification } });
        await store.recordAiAgentEvent(run.runId, { phase: 'finalize', status: failure ? 'failed' : 'succeeded',
          label: failure ? '小智未完成本轮' : `本轮执行已结束 · ${VERIFICATION_LABELS[finalTurn.verification.state]}`,
          detail: failure ? XIAOZHI_ERRORS[failure] : verificationDescription(finalTurn.verification),
          outputSummary:{executionStatus:status,verification:finalTurn.verification} });
        await store.completeAiAgentRun(run.runId, failure === 'cancelled' ? 'blocked' : failure ? 'failed' : 'succeeded', failure ? XIAOZHI_ERRORS[failure] : '');
        await store.xiaozhiState.finishCommand(run.commandId);
        if(run.operation==='prompt'&&run.task&&run.publisher&&!run.publisher.failed){const task=await tasks.finish(run.task,run.publisher,Boolean(failure));finalTurn.task=task;}
        if(run.goalId){const goal=await store.xiaozhiState.goals.finish(id,run.runId,text,Boolean(failure));if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});}
        publicEvent(id, run, {kind:'verification',verification:finalTurn.verification});
        run.publisher?.enqueue(terminal, finalTurn); await run.publisher?.flush();
        // Numeric audit after durable terminal; it cannot change the completed task.
        await store.recordAiAgentEvent(run.runId,{phase:'finalize',status:'succeeded',label:'回答时延测量',detail:'本地分段计量，不代表答案质量评分。',
          outputSummary:{version:1,preparationMs,sdkEndedMs,terminalCommittedMs:performance.now()-executionStarted}}).catch(()=>undefined);
        try{await decisions.sealRoute(id,run.runId);}catch{decisions.unavailable(id);}
      } catch {
        // A failed commit must never be reported as completion; startup recovery owns unresolved rows.
        publicEvent(id, run, { kind: 'status', status: 'failed', error: 'configuration' });
        await run.publisher?.flush().catch(()=>undefined); if(active.get(id)===run)active.delete(id);
      }
    }
  }
  const host = {
    ...createPaperBasketApi(store.paperBaskets, sessionId => {
      const owner = active.get(sessionId);
      const generation = learningDecisionGeneration.get(sessionId) || 0;
      return () => !owner && !closing && !conversationStarting(sessionId) && !active.has(sessionId)
        && generation === (learningDecisionGeneration.get(sessionId) || 0);
    }, store.paperBasketsV2),
    deliveryChecks:fileChecks,
    listPapers:paperReviews.list,
    comparePapers:(input:import('../../shared/paper-blueprint').PaperCompareInput)=>store.papers.compare(input),
    listPaperGenerationContexts:paperReviews.generationContexts,
    reviewPaper:paperReviews.review,
    cancelPaper:paperReviews.cancelInput,
    async createPaper(input:PaperCreateInput){
      if(!validPaperCreate(input))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return paperReviews.create(input,'','',()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    async decidePaper(input:PaperDecision){
      if(!validPaperReview(input,true))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return paperReviews.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    reviewPractice:practiceReviews.review,
    practiceSource:practiceReviews.source,
    async decidePractice(input:PracticeReviewDecision):Promise<PracticeReviewResult<PracticeReviewSummary>>{
      if(!validPracticeReview(input,true))return{ok:false,error:'invalid_input'};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return practiceReviews.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    reviewOriginal:originalReviews.review,
    reviewOriginalMulti:originalReviews.reviewMulti,
    originalGallery:originalReviews.gallery,
    completeOriginalContext:(input:import('../../shared/question-context-edit').QuestionContextEditInput)=>originalReviews.completeContext(input,()=>!closing),
    async decideOriginalMulti(input:import('../../shared/original-multi-review').OriginalMultiDecision){
      const {validMultiDecision}=await import('../../shared/original-multi-review');if(!validMultiDecision(input))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return originalReviews.decideMulti(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    async reviseOriginalMulti(input:import('../../shared/original-multi-review').OriginalMultiRevise){
      const {validMultiRevise}=await import('../../shared/original-multi-review');if(!validMultiRevise(input))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return originalReviews.reviseMulti(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)),owner?.abort.signal);
    },
    originalImage:originalReviews.image,
    async decideOriginal(input:OriginalQuestionDecision){
      if(!validOriginalInput(input,true))return {ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return originalReviews.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    async reviewQuestions(input:import('../../shared/question-review').QuestionReviewInput){
      if(!validQuestionReview(input))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      const member=(await store.questionReviews.list(input.sessionId)).find(r=>r.id===input.id);
      const collectionRun=owner&&member?.collectionId&&questionCollections.canEdit(input.sessionId,member.collectionId,owner.runId)?owner.runId:undefined;
      return questionReviews.review(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)),collectionRun);
    },
    async decideQuestions(input:QuestionReviewDecision):Promise<QuestionReviewResult<QuestionReviewSummary>>{
      if(!validQuestionReview(input,true))return{ok:false,error:'invalid_input'};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return questionReviews.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    reviewQuestionCollection:questionCollections.review,
    async decideQuestionCollection(input:QuestionCollectionDecision){
      if(!validQuestionCollection(input,true))return{ok:false as const,error:'invalid_input' as const};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return questionCollections.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    reviewLearning:learningReviews.review,
    learningHistory:learningReviews.history,
    async decideLearning(input:LearningReviewDecision):Promise<LearningReviewResult<LearningReviewSummary>>{
      if(!validLearningReview(input,true))return{ok:false,error:'invalid_input'};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return learningReviews.decide(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    async decideLearningBatch(input:LearningReviewBatchDecision):Promise<LearningReviewResult<LearningReviewBatchSummary>>{
      if(!validLearningBatchDecision(input))return{ok:false,error:'invalid_input'};
      const owner=active.get(input.sessionId),generation=learningDecisionGeneration.get(input.sessionId)||0;
      return learningReviews.decideBatch(input,()=>!closing&&!conversationStarting(input.sessionId)&&generation===(learningDecisionGeneration.get(input.sessionId)||0)&&(owner?active.get(input.sessionId)===owner&&!owner.stopped:!active.has(input.sessionId)));
    },
    /** Main-only completion join. Never starts/replays a run or owns another model loop. */
    async waitForRun(id: string, runId: string): Promise<XiaozhiWorkspaceSnapshot> {
      if (!validId(id) || typeof runId !== 'string' || runId.length > 180) throw new Error('invalid_input');
      const detail = await store.getAiConversationSession(id);
      const row = await store.getAiAgentRun(runId);
      if (detail.session.archivedAt || row?.sessionId !== id
        || !detail.messages.some(message => message.role === 'user' && message.metadata.agentRunId === runId
          && message.metadata.piVersion === 'xiaozhi.pi.education.v1')) throw new Error('permission_denied');
      const run = active.get(id);
      if (run?.runId === runId) await run.done;
      if ((await store.getAiConversationSession(id)).session.archivedAt) throw new Error('permission_denied');
      const committed = await store.getAiAgentRun(runId), state = await snapshot(id);
      const turn = state.projection.turns.find(item => item.id === runId);
      // Appended text is not proof the terminal run/command transaction committed.
      if (turn && committed?.status !== 'succeeded') {
        turn.status = committed?.status === 'blocked' ? 'interrupted' : 'failed';
        turn.error ||= committed?.errorMessage || XIAOZHI_ERRORS.configuration;
      }
      return {...state,projection:{...state.projection,model:committed?.model||state.projection.model}};
    },
    mutateGoal:createGoalController({store,closing:()=>closing,busy:id=>active.has(id)||choosing.has(id)||configuring.has(id)||configuring.has('provider')||skillsMutating||starting.size>0,
      accept:tasks.acceptGoal,stop:async(id,runId,goalId):Promise<unknown>=>{const owner=active.get(id);return owner?.runId===runId&&owner.goalId===goalId?await host.stop(id):undefined;},start:async(id,prompt,commandId,goalId):Promise<XiaozhiStartResult>=>await host.start({sessionId:id,prompt,commandId},'prompt',goalId)}),
    taskSnapshot:tasks.snapshot,
    reviewTask:tasks.review,
    correctTask:tasks.correct,
    async resumeTask(raw:unknown):Promise<XiaozhiStartResult>{
      if(!validTaskResume(raw))return{ok:false,error:'invalid_input'};
      return host.start({sessionId:raw.sessionId,commandId:raw.commandId,prompt:'继续先前任务中尚未完成的步骤；先核对已有来源与保存结果，不重复已有的写入。'},'prompt',undefined,raw);
    },
    async resolveFileWorkspace(id:string) {
      if(!validId(id))throw new Error('invalid_input');
      if(closing || choosing.has(id))throw new Error('busy');
      const detail=await store.getAiConversationSession(id);
      if(detail.session.archivedAt)throw new Error('permission_denied');
      const grant=await store.xiaozhiState.workspace(id)||conversationOutput(options.dataRoot,id);
      if(closing||choosing.has(id))throw new Error('busy');
      if((await store.getAiConversationSession(id)).session.archivedAt)throw new Error('permission_denied');
      if(closing||choosing.has(id))throw new Error('busy');
      const directory=authorizedWorkspace(grant.path,options.dataRoot),stat=fs.statSync(directory);
      return {path:directory,label:grant.label,version:createHash('sha256').update(JSON.stringify([id,directory,stat.dev,stat.ino])).digest('hex')};
    },
    async listEvents(input:XiaozhiEventsInput){
      if(!validEventsInput(input))throw Error('invalid_input');
      if((await store.getAiConversationSession(input.sessionId)).session.archivedAt)throw Error('permission_denied');
      return store.xiaozhiState.eventJournal.list(input);
    },
    async refreshRecords(id:string):Promise<XiaozhiActionResult>{
      if(!validId(id))return{ok:false,error:'invalid_input'};
      if(closing||configuring.has(id)||configuring.has('provider')||choosing.has(id)||skillsMutating)return{ok:false,error:'busy'};
      const failure=journalFailures.get(id);
      if(!failure)return{ok:true};
      configuring.add(id);
      try{
        if((await store.getAiConversationSession(id)).session.archivedAt)return{ok:false,error:'permission_denied'};
        if(failure.run.done)try{await waitForLifecycle('record_recovery',()=>failure.run.done!,{timeoutMs:5000});}catch{return{ok:false,error:'busy'};}
        if(failure.run.publisher)try{await waitForLifecycle('record_writer_recovery',()=>failure.run.publisher!.settled(),{timeoutMs:5000});}catch{return{ok:false,error:'busy'};}
        if(closing||active.has(id)||admissions.get(id)?.size||failure.run.agent?.diagnostics().executing)return{ok:false,error:'busy'};
        if(journalFailures.get(id)!==failure)return{ok:false,error:'busy'};
        if((await store.getAiConversationSession(id)).session.archivedAt)return{ok:false,error:'permission_denied'};
        const saved=await store.xiaozhiState.eventJournal.snapshot(id,failure.runId);
        if(!saved)throw Error('event_run_missing');
        await store.xiaozhiState.eventJournal.recoverFailedRun({sessionId:id,runId:failure.runId,generation:saved.cursor.generation},{requested:()=>true,
          repair:(work,turn)=>repairCancelledRun(work,id,failure.runId,failure.run.commandId,turn,{status:'failed',error:'event_recovered'})});
        await tasks.recover(id);
        await tasks.committed(id);
        const repaired=await store.xiaozhiState.eventJournal.snapshot(id,failure.runId);
        if(repaired?.status!=='failed'||repaired.turn.errorCode!=='event_recovered')throw Error('event_recovery_incomplete');
        if(closing||active.has(id)||admissions.get(id)?.size||failure.run.agent?.diagnostics().executing||journalFailures.get(id)!==failure)return{ok:false,error:'busy'};
        journalFailures.delete(id);
        return{ok:true};
      }catch{return{ok:false,error:'event_persistence'};}
      finally{configuring.delete(id);}
    },
    async historyPage(input:XiaozhiHistoryPageInput):Promise<XiaozhiHistoryPage>{
      if(!validXiaozhiHistoryPageInput(input))throw Error('invalid_input');
      const view=await snapshot(input.sessionId,0,input.before);
      return {schemaVersion:1,sessionId:input.sessionId,projection:view.projection,
        eventCursors:view.eventCursors||[],legacyHistory:view.legacyHistory};
    },
    async planHistory(input:unknown):Promise<PlanHistoryResult>{
      if(!validPlanHistoryInput(input))return {ok:false,error:'invalid_input'};
      try{if((await store.getAiConversationSession(input.sessionId)).session.archivedAt)return {ok:false,error:'permission_denied'};return controls.planHistory(input);}catch{return {ok:false,error:'configuration'};}
    },
    enabled, snapshot, decide: approvals.decide, answer:controls.answer,
    reviewTextChange: textChanges.review,
    reviewOfficeArtifact:officeArtifacts.review,
    artifactCheck:createArtifactCheck({changes:store.xiaozhiState.changes,office:store.xiaozhiState.officeArtifacts,inspections:store.xiaozhiState.inspections,checks:fileChecks,authorize:authorizePaperConversation,workspace:(id):Promise<import('./workspace-files').WorkspaceLease>=>host.resolveFileWorkspace(id)}),
    artifactSources:(input:unknown)=>createArtifactSources({changes:store.xiaozhiState.changes,office:store.xiaozhiState.officeArtifacts,journal:store.xiaozhiState.eventJournal,
      authorize:authorizePaperConversation,workspace:id=>host.resolveFileWorkspace(id),paper:(id,paperId)=>store.papers.review(id,paperId),current:()=>!closing,
      producer:async(id,recordId,runId,callId)=>{const bundle=await store.xiaozhiState.deliveries.owner(id,recordId);return bundle&&bundle.runId===runId&&bundle.files.some(file=>file.draftId===recordId&&file.runId===runId&&file.callId===callId)?bundle.callId:callId;}
    }).read(input),
    async officeVersion(input:OfficeVersionInput,useFile?:(file:string,action:'open'|'locate')=>Promise<void>):Promise<OfficeVersionResult>{
      const versions=typeof input?.artifactId==='string'&&input.artifactId.startsWith('xichange_')
        ?createTextVersions({state:store.xiaozhiState.changes,dataRoot:options.dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,afterStage:options.afterTextChangeStage})
        :createOfficeVersions({state:store.xiaozhiState.officeArtifacts,dataRoot:options.dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,afterStage:options.afterOfficeArtifactStage});
      if(input?.action==='view')return versions.execute(input,()=>{if(closing)throw Error('busy');});
      try{return await host.withLocalSettingsJob(assertCurrent=>versions.execute(input,assertCurrent,useFile));}catch{return {ok:false,error:'busy'};}
    },
    async reviseOfficeArtifact(input:Parameters<typeof officeArtifacts.revise>[0]){
      return await store.xiaozhiState.deliveries.owner(input?.sessionId,input?.draftId)?deliveries.revise(input):officeArtifacts.revise(input);
    },
    deliveryCatalog:createDeliveryCatalog({state:store.xiaozhiState.deliveries,coordinator:deliveries,authorize:authorizePaperConversation,running:id=>active.has(id)}),
    decideDelivery:deliveries.decide,
    async decideOfficeArtifact(input:OfficeArtifactDecision):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
      if(input?.action!=='verify'&&await store.xiaozhiState.deliveries.owner(input?.sessionId,input?.draftId))return {ok:false,error:'permission_denied'};
      if(input?.action!=='verify')return officeArtifacts.decide(input);
      try{return await host.withLocalSettingsJob(async assertCurrent=>{assertCurrent();return officeArtifacts.decide(input);});}catch{return {ok:false,error:'busy'};}
    },
    async decideTextChange(input: XiaozhiChangeDecision): Promise<XiaozhiChangeResult<XiaozhiChangeSummary>> {
      // Undo and recovery verification reserve the same global idle owner as local backups/settings.
      if (input?.action !== 'undo' && input?.action !== 'verify' && await store.xiaozhiState.deliveries.owner(input?.sessionId,input?.changeId))return {ok:false,error:'permission_denied'};
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
    mcpCatalog: () => mcp.catalog(),
    decisionHistory: (id: string) => decisions.list(id),
    decisionReplay: (input: DecisionInput) => decisions.replay(input),
    decisionShadow: (input: DecisionInput) => mutateSettings(()=>decisions.shadow(input)),
    decisionRouteShadow:(input:DecisionInput)=>mutateSettings(()=>decisions.shadowRoute(input)),
    candidateHistory:(id:string)=>candidates.list(id),
    candidateEvaluate:(input:TeacherCandidateInput)=>mutateSettings(()=>candidates.evaluate(input)),
    candidateReject:(input:TeacherCandidateInput)=>mutateSettings(()=>candidates.reject(input)),
    mcpAdd: (input: XiaozhiMcpAddInput) => mutateSettings(() => mcp.add(input)),
    mcpInspect: (input: XiaozhiMcpInput) => mutateSettings(() => mcp.inspect(input)),
    mcpTrust: (input: XiaozhiMcpTrustInput) => mutateSettings(() => mcp.trust(input)),
    mcpRevoke: (input: XiaozhiMcpInput) => mutateSettings(() => mcp.revoke(input)),
    mcpRemove: (input: XiaozhiMcpInput) => mutateSettings(() => mcp.remove(input)),
    async queryProviderBalance(){
      if(closing)throw new Error('busy');const controller=new AbortController();balanceQueries.add(controller);
      try{return await modelSettings.balance(controller.signal);}finally{balanceQueries.delete(controller);}
    },
    async saveWebSettings(input:XiaozhiWebInput) { return mutateSettings(()=>store.xiaozhiState.modelSettings.saveWeb(input,()=>{if(closing||!configuring.has('provider'))throw new Error('busy');})); },
    async saveThinkingSettings(input:import('../../shared/xiaozhi-thinking').ThinkingInput){
      const value=await mutateSettings(()=>modelSettings.saveThinking(input));
      return {...value,locked:settingsBusy()};
    },
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
    managedTools,
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
      sanitize:async text=>(await createStudentContextSanitizer(store))(text),
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
        if(run.paperExportIntent)return {ok:false,error:PAPER_EXPORT_RESTART_REQUIRED};
        if(run.instructions.size >= 16)return {ok:false,error:'busy'};
        run.instructions.add(input.commandId); // Reserve in the live owner before async sanitation/persistence.
        const text = await (await createStudentContextSanitizer(store))(input.text.trim());
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
    async selectPaperOutput(id:string,choose:()=>Promise<string|undefined>):Promise<XiaozhiActionResult>{
      if(!validId(id))return {ok:false,error:'invalid_input'};
      if(active.has(id)||choosing.has(id)||configuring.has(id)||configuring.has('provider')||closing||skillsMutating)return {ok:false,error:'busy'};
      choosing.add(id);
      try{
        await authorizePaperConversation(id);const selected=await choose();if(!selected)return {ok:true};
        if(closing||active.has(id))return {ok:false,error:'busy'};await authorizePaperConversation(id);
        const directory=authorizedWorkspace(selected,options.dataRoot);
        await store.xiaozhiState.setPaperOutput(id,directory,path.basename(directory).slice(0,200),workspaceHash(directory));return {ok:true};
      }catch{return {ok:false,error:'permission_denied'};}finally{choosing.delete(id);}
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
    async start(input: XiaozhiStartInput, operation: 'prompt' | 'compact' = 'prompt',goalId?:string,taskResume?:TaskResumeInput): Promise<XiaozhiStartResult> {
      if (!enabled || closing) return { ok: false, error: 'configuration' };
      if (skillsMutating || configuring.has('provider')) return { ok: false, error: 'busy' };
      if(!validXiaozhiStart(input)||input.classroomPlan&&(operation!=='prompt'||Boolean(goalId)||Boolean(taskResume))||(operation==='compact'&&(input.attachments||input.continueTask))||input.continueTask&&(Boolean(goalId)||Boolean(taskResume)))return {ok:false,error:'invalid_input'};
      if(input.paperExportIntent&&(operation!=='prompt'||goalId||taskResume))return{ok:false,error:'invalid_input'};
      if(input.paperExportIntent&&isTaskContinuation(input.prompt))return{ok:false,error:PAPER_EXPORT_RESTART_REQUIRED};
      if(input.resumeDeliveryId&&(operation!=='prompt'||goalId||taskResume))return{ok:false,error:'invalid_input'};
      if(taskResume&&(!validTaskResume(taskResume)||taskResume.sessionId!==input.sessionId||taskResume.commandId!==input.commandId||operation!=='prompt'||goalId||input.attachments))return{ok:false,error:'invalid_input'};
      input = { ...input,...(input.paperExportIntent?{paperExportIntent:copyPaperExportIntent(input.paperExportIntent)}:{}),...(input.classroomPlan?{classroomPlan:structuredClone(input.classroomPlan)}:{}), prompt: input.prompt.trim()||ATTACHMENT_ONLY_PROMPT,
        ...(input.presentation?{presentation:{version:1,skill:input.presentation.skill,text:input.presentation.text}}:{}),
        ...(input.attachments?{attachments:input.attachments.map(s=>({id:s.id,revision:s.revision}))}:{}) };
      const id = input.sessionId;
      const controller=new AbortController();
      const pending=admissions.get(id)||new Set<AbortController>();pending.add(controller);admissions.set(id,pending);
      const phase=<T>(action:()=>Promise<T>,late?:(value:T)=>void|Promise<void>)=>waitForLifecycle('host_admission',action,{signal:controller.signal,timeoutMs:options.lifecycleTimeoutMs,late});
      try {
      if(journalFailures.has(id))return {ok:false,error:'event_persistence'};
      try {await phase(()=>recoverModel(id));
        if((await phase(async()=>store.xiaozhiState.modelSwitch?.transitions(id)))?.some(row=>row.status==='prepared')) return {ok:false,error:'busy'};
      } catch {return {ok:false,error:controller.signal.aborted?'cancelled':'configuration'};}
      // Retain the exact historical prompt hash; compact has a distinct command identity.
      let selectedRows:Awaited<ReturnType<typeof store.xiaozhiState.attachments.list>>=[];
      if(input.attachments){try{selectedRows=await phase(()=>store.xiaozhiState.attachments.list(id));if(input.attachments.some(s=>!selectedRows.some(row=>row.id===s.id)))return {ok:false,error:'attachment_changed'};}catch{return {ok:false,error:'configuration'};}}
      const baseHash = input.attachments?attachmentStartHash(id,input.prompt,input.attachments,selectedRows,input.presentation):createHash('sha256').update(JSON.stringify({ sessionId: id, prompt: input.prompt,...(input.paperExportIntent?{paperExportIntent:input.paperExportIntent}:{}),...(input.resumeDeliveryId?{resumeDeliveryId:input.resumeDeliveryId}:{}),...(input.classroomPlan?{classroomPlan:input.classroomPlan}:{}), ...(operation === 'compact' ? { operation } : {}),...(goalId?{goalId}:{}),...(taskResume?{taskResume:{taskId:taskResume.taskId,revision:taskResume.revision,requirementsVersion:taskResume.requirementsVersion}}:{}),...(input.presentation?{presentation:input.presentation}:{}) })).digest('hex');
      const hash=input.continueTask?createHash('sha256').update(JSON.stringify({baseHash,continueTask:input.continueTask})).digest('hex'):baseHash;
      const priorStart = starting.get(input.commandId);
      if (priorStart) return priorStart.hash === hash ? priorStart.result : { ok: false, error: 'command_conflict' };
      const admission = invalidateLearningDecisions(id);
      const result = (async (): Promise<XiaozhiStartResult> => {
      await phase(()=>skillsReady);
      const previous = await phase(()=>store.xiaozhiState.command(input.commandId));
      if (previous) {
        if (previous.request_hash !== hash || previous.conversation_id !== id) return { ok: false, error: 'command_conflict' };
        if(input.attachments&&previous.run_id){const admitted=await phase(()=>store.xiaozhiState.attachmentSends.get(input.commandId));if(!admitted||admitted.run_id!==previous.run_id||admitted.request_hash!==hash)return {ok:false,error:'configuration'};}
        return previous.run_id ? { ok: true, runId: String(previous.run_id) } : { ok: false, error: 'configuration' };
      }
      if (await phase(()=>store.xiaozhiState.control(input.commandId))) return {ok:false,error:'command_conflict'};
      if(admission!==learningDecisionGeneration.get(id))return{ok:false,error:'cancelled'};
      if (closing || skillsMutating || active.has(id) || choosing.has(id) || configuring.has(id) || configuring.has('provider')) return { ok: false, error: 'busy' };
      // A continuation inherits its authority from the original task source, not this new prompt.
      // Refuse before task recovery can append an event, or admission reserves an Active/run.
      if(operation==='prompt'&&!goalId)await phase(()=>tasks.assertContinuationAllowed(id,input.prompt,input.continueTask,taskResume));
      await phase(()=>tasks.recover(id));
      if(taskResume)await phase(()=>tasks.prepareResume(taskResume));
      const run: Active = { ...(input.paperExportIntent?{paperExportIntent:copyPaperExportIntent(input.paperExportIntent)}:{}),...(input.resumeDeliveryId?{resumeDeliveryId:input.resumeDeliveryId}:{}), ...(input.classroomPlan?{classroomPlan:input.classroomPlan}:{}),runId: '', commandId: input.commandId,...(goalId?{goalId}:{}), operation, sequence: 0, stopped: false, abort: controller, instructions:new Set(), turn: { id: '', status: 'running', items: [] },
        usage:{runId:'',budget:{...DEFAULT_PI_BUDGET},limitsEnforced:false,modelCalls:0,toolCalls:0,tokens:null,completeness:'unknown',cost:null,activeMs:0,waitingMs:0,state:'running'},usageWrites:Promise.resolve() };
      active.set(id, run); // Reserve before awaits; UI locks are not the ownership gate.
      // Shutdown recovery owns any submitted SQL: do not queue another locked write after quit starts.
      const interruptClaim=()=>closing?Promise.resolve():trackModelWrite(()=>store.xiaozhiState.interruptCommand(input.commandId,id,hash));
      try {
        const detail = await phase(()=>store.getAiConversationSession(id)); if (detail.session.archivedAt) throw new Error('invalid_input');
        if(input.resumeDeliveryId){const bundle=await phase(()=>deliveries.read(id,input.resumeDeliveryId!));if(bundle.continuation||!['partial','interrupted','failed','conflict'].includes(bundle.state))throw Error('command_conflict');}
        if(input.classroomPlan?.mode==='generate')await phase(()=>store.xiaozhiState.classroomPlans.assertStart(id,input.classroomPlan as Extract<ClassroomPlanStart,{mode:'generate'}>));
        if(taskResume)await phase(()=>tasks.prepareResume(taskResume));
        if(goalId)await phase(()=>tasks.prepareGoal(id,goalId));
        if(detail.session.studentId){try{await phase(()=>store.studentContext.snapshot(detail.session.studentId!));}catch{throw new Error('permission_denied');}}
        if(run.paperExportIntent)await phase(()=>readPaperExportIntent(store.papers,id,run.paperExportIntent!));
        const drafts=operation==='prompt'?(await phase(()=>store.xiaozhiState.attachments.list(id))).filter(row=>row.state==='draft'):[];
        if(drafts.length&&!input.attachments){active.delete(id);return {ok:false,error:'attachment_changed'};}
        if(input.attachments&&(drafts.length!==input.attachments.length||input.attachments.some(s=>!drafts.some(row=>row.id===s.id&&row.revision===s.revision))))throw new Error('attachment_changed');
        run.usage.budget=(await phase(()=>store.xiaozhiState.budgetSettings(id))).budget;
        if (!await phase(()=>store.xiaozhiState.claimCommand(input.commandId,id,hash),()=>interruptClaim())) throw new Error('command_conflict');
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
        const settings = await phase(()=>modelSettings.runtime(id));
        if(input.attachments){
          if(closing||run.stopped)throw new Error('cancelled');
          const admitted=await store.xiaozhiState.attachmentSends.admit({sessionId:id,commandId:input.commandId,prompt:input.prompt,...(input.continueTask?{continueTask:input.continueTask}:{}),...(input.presentation?{presentation:input.presentation}:{}),hash,model:settings.model,attachments:drafts,selections:input.attachments});
          run.runId=admitted.runId;
          run.turn.id=admitted.runId;
          run.turn.items.push({id:admitted.messageId,kind:'message',role:'user',text:publicMessageText(input.prompt,input.presentation),attachments:admitted.attachments});
          await options.afterAttachmentSendStage?.('committed');
        }else{
          run.runId = await phase(()=>store.startAiAgentRun({ sessionId:id,prompt:input.prompt.trim(),route:'knowledge_retrieval',subIntent:'pi_education',model:settings.model,studentId:detail.session.studentId||'' }),lateRun=>closing?Promise.resolve():trackModelWrite(()=>store.completeAiAgentRun(lateRun,'failed',XIAOZHI_ERRORS.cancelled)));
          await phase(()=>store.xiaozhiState.bindCommand(input.commandId, run.runId));
        }
        if(input.classroomPlan?.mode==='generate'){const binding=input.classroomPlan;await phase(()=>store.xiaozhiState.classroomPlans.begin(id,run.runId,binding,()=>!closing&&!run.stopped&&active.get(id)===run));}
        run.usage.runId=run.runId;await phase(()=>store.xiaozhiState.saveUsage(id,run.usage));
        if(goalId){const goal=await store.xiaozhiState.goals.get(goalId);if(!goal||goal.sessionId!==id||goal.state!=='active')throw new Error('command_conflict');const bound=await store.xiaozhiState.goals.bind(goal,run.runId);publicEvent(id,run,{kind:'goal',goal:publicGoal(bound)});}
        run.turn.id = run.runId;
        if(!input.attachments){
          const saved = await phase(()=>store.appendAiConversationMessage(id,{role:'user',content:input.prompt.trim(),metadata:{agentRunId:run.runId,piVersion:'xiaozhi.pi.education.v1',preferenceSourceVersion:1,...(run.paperExportIntent?{paperExportIntent:run.paperExportIntent}:{}),...(goalId?{goalId}:{}),...(input.presentation?{presentation:input.presentation}:{})}}));
          const user = saved.messages.at(-1)!;
          run.turn.items.push({ id: user.id, kind: 'message', role: 'user', text: publicMessageText(user.content,user.metadata.presentation) });
        }
        await phase(()=>beginJournal(id, run));
        publicEvent(id, run, { kind: 'status', status: 'running' });
        await phase(()=>run.publisher!.flush());
        const priorThinkingTask=await phase(()=>tasks.committed(id));
        if(priorThinkingTask&&!['completed','ended'].includes(priorThinkingTask.state)){
          run.unfinishedThinkingTask=detail.messages.find(message=>message.id===priorThinkingTask.origin.messageId)?.content
            ||priorThinkingTask.criteria.map(criterion=>criterion.text).join('\n');
        }
        if(operation==='prompt')run.task=await phase(()=>taskResume?tasks.resume(taskResume,run.publisher!):tasks.start(id,run.runId,input.commandId,run.publisher!,input.continueTask));else await phase(()=>tasks.compact(id,run.publisher!));
        if(closing||run.stopped)throw Error('cancelled');
        run.done = execute(id, input.prompt.trim(), run, settings);
        return { ok: true, runId: run.runId };
      } catch(error) {
        if(active.get(id)===run)active.delete(id);
        const cleanup=trackModelWrite(async()=>{if(closing)return;if(run.classroomPlan?.mode==='generate'&&run.runId)await store.xiaozhiState.classroomPlans.finishRun(run.runId);await interruptClaim();if(!closing&&run.runId)await store.completeAiAgentRun(run.runId,'failed',run.stopped||controller.signal.aborted?XIAOZHI_ERRORS.cancelled:XIAOZHI_ERRORS.configuration);});
        void cleanup.catch(()=>{journalFailures.set(id,{runId:run.runId,run});});
        // Once the atomic teacher/run/files fact exists, the receipt must not claim it was unsent.
        // Later host failures are shown on that admitted turn; a retry confirms its original run.
        if(input.attachments&&run.runId&&run.turn.items[0]?.attachments?.length){publicEvent(id,run,{kind:'status',status:'failed',error:'configuration'});return {ok:true,runId:run.runId};}
        const code=error instanceof Error?error.message:'';
        return { ok: false, error:run.stopped||closing||controller.signal.aborted?'cancelled':error instanceof Error&&error.name==='TimeoutError'?'timeout':code==='lifecycle_timeout'?'timeout':code==='attachment_changed'||code==='changed'?'attachment_changed':code==='permission_denied'?'permission_denied':code===PAPER_EXPORT_RESTART_REQUIRED?PAPER_EXPORT_RESTART_REQUIRED:code===PAPER_EXPORT_SOURCE_CHANGED?PAPER_EXPORT_SOURCE_CHANGED:code==='not_confirmed'||code==='conflict'||code==='source_changed'||code==='command_conflict'||/^task_(revision_conflict|resume_invalid|source_changed|requirements_changed)$/.test(code)?'command_conflict':'configuration' };
      }
      })().catch((error): XiaozhiStartResult => ({ ok: false, error: controller.signal.aborted?'cancelled':error instanceof Error&&error.message===PAPER_EXPORT_RESTART_REQUIRED?PAPER_EXPORT_RESTART_REQUIRED:'configuration' }));
      starting.set(input.commandId, { sessionId:id, hash, result });
      try { return await result; } finally { starting.delete(input.commandId); }
      } finally {pending.delete(controller);if(!pending.size)admissions.delete(id);}
    },
    attachments,
    async showBrowser(raw:unknown):Promise<XiaozhiActionResult>{
      if(!validId(raw))return {ok:false,error:'invalid_input'};
      try{if(closing||(await store.getAiConversationSession(raw)).session.archivedAt)throw new Error('permission_denied');browser.show(raw);return {ok:true};}catch{return {ok:false,error:'permission_denied'};}
    },
    async previewBrowserCapture(raw:unknown):Promise<BrowserCaptureResult>{
      if(!validBrowserCaptureInput(raw))return {ok:false,error:'invalid_input'};
      try{
        if(closing||(await store.getAiConversationSession(raw.sessionId)).session.archivedAt)throw new Error('permission_denied');
        const capture=(await snapshot(raw.sessionId)).projection.turns.flatMap(turn=>turn.items).find(item=>item.kind==='tool'&&item.status==='completed'&&item.browserCapture?.id===raw.captureId)?.browserCapture;
        if(!validBrowserCapture(capture))throw new Error('permission_denied');
        const image=await readBrowserCapture(path.join(root,'browser-captures'),raw.sessionId,capture);
        if(closing||(await store.getAiConversationSession(raw.sessionId)).session.archivedAt)throw new Error('permission_denied');
        return {ok:true,image};
      }catch(error){const code=(error as NodeJS.ErrnoException).code==='ENOENT'?'not_found':error instanceof Error?error.message:'';
        return {ok:false,error:['permission_denied','changed','too_large','not_found'].includes(code)?code as 'permission_denied'|'changed'|'too_large'|'not_found':'read_failed'};}
    },
    async stop(id: string) {
      if (!validId(id)) return { ok: false };
      invalidateLearningDecisions(id);
      for(const controller of admissions.get(id)||[])controller.abort();
      attachments.cancelSession(id);
      browser.cancel(id);
      const run = active.get(id); if (!run) return { ok: true };
      run.stopped = true; run.abort.abort();
      // Stop the provider immediately; waiting for review cleanup can otherwise finish
      // a short reasoning block before the user's stop reaches the SDK.
      const aborting=run.agent?.abort();void aborting?.catch(()=>undefined);
      if(!run.runId)return {ok:true}; // Admission has no effect authority to cancel; late SQL is identity-fenced.
      try {await waitForLifecycle('host_stop_cleanup',async()=>{
      if(run.goalId){const goal=await store.xiaozhiState.goals.interrupt(id,run.runId,'教师停止了本轮执行，已保存进度。');if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});}
      await controls.finish(id,run.runId); await approvals.cancel(run.runId); learningReviews.cancel(run.runId); questionReviews.cancel(run.runId); questionCollections.cancel(run.runId); originalReviews.cancel(run.runId); practiceReviews.cancel(run.runId); paperReviews.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await deliveries.cancel(run.runId); await aborting;
      },{timeoutMs:options.shutdownTimeoutMs??5000});return {ok:true};}
      catch{run.publisher?.fail(Error('event_persistence'));return {ok:false};}
    },
    async close() {
      closing = true;for(const pending of admissions.values())for(const controller of pending)controller.abort();
      for (const run of active.values()) { run.stopped = true; run.abort.abort(); }
      for(const run of active.values())void run.agent?.abort().catch(()=>undefined);
      for(const controller of balanceQueries)controller.abort();
      try {await waitForLifecycle('host_shutdown',async()=>{
      await attachments.close();
      await fileChecks.close();
      await managedTools.dispose();
      await browser.dispose();
      await mcp.dispose();
      await Promise.allSettled([...modelWrites]);
      await Promise.allSettled([...localSettingsJobs]);
      await Promise.allSettled([...starting.values()].map(item => item.result));
      for (const [id,run] of active) { await controls.finish(id,run.runId); await approvals.cancel(run.runId); learningReviews.cancel(run.runId); questionReviews.cancel(run.runId); questionCollections.cancel(run.runId); originalReviews.cancel(run.runId); practiceReviews.cancel(run.runId); paperReviews.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await deliveries.cancel(run.runId); await run.agent?.abort(); }
      await Promise.allSettled([...active.values()].map(run => run.done));
      },{timeoutMs:options.shutdownTimeoutMs??5000});}
      catch{for(const run of active.values())run.publisher?.fail(Error('event_persistence'));}
    },

  };
  return host;
}

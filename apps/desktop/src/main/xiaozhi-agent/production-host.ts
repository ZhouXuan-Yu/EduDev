import {createStartupPrewarm} from './startup-prewarm';
import {persistCurrentToolContract} from './capabilities/queued-contract';
import type {PermissionOwner} from '../../shared/xiaozhi-permissions';
import {coreToolStartupDefinitions} from './core-tool-startup-definitions';
import {adaptationIntentFromPrompt} from '../education/paper-basket-adaptation-run';
import {createTerminalService, type TerminalService} from './terminal/service';
import {createFileReferenceProjection} from './file-references';
import {createModelToolPrivacy} from './model-tool-privacy';
import {createPersistentTerminalTools} from './terminal/tools';
import type {TerminalUpdate} from '../../shared/xiaozhi-terminal-jobs';
import {createTaskPlanningRuntime} from './tasks/planning-runtime';
import {currentPermission} from './permissions/current';
import {inspectTaskRecovery} from './tasks/recovery-inspection';
import {commitNativeSessionRebuild} from './tasks/native-rebuild-state';
import type {TaskRecoveryInspection} from '../../shared/xiaozhi-task-recovery';
import {createNetworkEffects} from './effects/network';
import {createEffectReconciler} from './effects/reconcile';
import {createRecoveryEffectReader} from './events/recovery-readback';
import {createEffectReadTools} from './effects/tools';
import {preparePaperAdaptationContext} from '../education/paper-basket-adaptation-context';
import {createScienceLessonSource,prepareScienceLessonRefresh} from '../education/science-lesson-source';
import {readQuestionContextSource} from '../education/question-context-provider';
import {PAPER_EXPORT_RESTART_REQUIRED} from './tasks/paper-export-continuation';
import {isTaskContinuation,isBoundTaskAmendment} from './tasks/continuation';
import {naturalLessonDraft,type NaturalLessonRequirements} from '../education/natural-lesson-draft';
import {lessonRevisionRequest,matchesLessonRevision,type LessonRevisionRequest} from '../education/lesson-revision-request';
import {createLessonRevisionTools} from '../education/lesson-revision-tools';
import {resolveNaturalLessonBasis,resolveOrdinaryLessonBasis} from '../education/natural-lesson-basis';
import type {MaterialSource} from '../../shared/materials';
import {originalPaperReceiptOnly} from '../education/paper-request-constraints';
import {startsWithOriginalPaperBlueprint} from '../education/paper-admission';
import {isStandaloneAnswer} from './tasks/conversation-intent';
import {copyPaperExportIntent,type PaperExportIntent} from '../../shared/paper-export';
import {readPaperExportIntent,PAPER_EXPORT_SOURCE_CHANGED} from '../education/paper-export-intent';
import {createClassroomPlanTools} from '../education/classroom-plan-tools';
import {createEquationTools} from '../education/equation-tools';
import {createQuantityTools} from '../education/quantity-tools';
import {createSolutionTools} from '../education/solution-tools';
import {createBuoyancyTools} from '../education/buoyancy-tools';
import {admitClassroomOrTaskTool} from '../education/classroom-plan-admission';
import type {ClassroomPlanStart} from '../../shared/classroom-plan';
import {deliveryFinal,rejectedCopyDecisions,type DeliveryFinal} from './delivery-final';
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
import {createTeachingLessonExportTools} from '../education/teaching-lesson-export-tools';
import {createTeachingHandoutTool,handoutRequest} from '../education/teaching-handout-tool';
import {namedTeachingMaterialMatches,namedTeachingMaterialTitles,resolveNamedHandoutSources,type NamedHandoutSource} from '../education/named-teaching-materials';
import {assertTeachingHandoutExportProposal,createTeachingHandoutExportTools,handoutExportRequest} from '../education/teaching-handout-export-tools';
import {EXPORT_TEACHING_HANDOUT} from '../../shared/teaching-handout-export';
import {createHandoutEditCoordinator,handoutEditRequest} from '../education/teaching-handout-edit';
import {PROPOSE_HANDOUT_EDIT} from '../../shared/teaching-handout-edit';
import {createMockExamCatalog,mockExamRequest} from '../education/mock-exam-catalog';
import {BUILD_MOCK_EXAM_CATALOG} from '../../shared/mock-exam-compilation';
import {resolveMockExamScope} from '../education/mock-exam-request-scope';
import {createMockExamEditCoordinator,mockExamEditRequest} from '../education/mock-exam-edit-tools';
import {createMockExamExportTools,mockExamExportRequest,mockExamArchiveRequest} from '../education/mock-exam-export-tools';
import {createMockExamArchive} from '../education/mock-exam-archive';
import {createMockExamOfficeBinding} from '../education/mock-exam-office';
import type {MockExamExportIntent} from '../../shared/mock-exam-export';
import {PROPOSE_MOCK_EXAM_EDIT} from '../../shared/mock-exam-edit';
import {assertHandoutOffice} from '../education/teaching-handout-office';
import {TEACHING_HANDOUT_TOOL} from '../../shared/teaching-handout';
import {assertTeachingLessonOffice} from '../education/teaching-lesson-office';
import {createClassroomContext} from '../education/classroom-context';
import {teacherPreferenceForRequest} from '../education/teacher-preference-request';
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
import {isPaperOfficeDraft,isPresentationDraft,isTeachingHandoutOfficeDraft} from '../../shared/xiaozhi-office-draft';
import {resolvePaperOfficeImages} from '../education/paper-office-images';
import {PAPER_TOOLS,validPaperCreate,validPaperReview,type PaperCreateInput,type PaperDecision} from '../../shared/paper-blueprint';
import {TaskAdmissionError} from './tasks/admission-error';
import {unwrapTaskArguments} from './tasks/tool-envelope';
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
import {singleCopyWasDeclined} from './tasks/declined-copy';
import {createAttachmentCoordinator} from './attachment-coordinator';
import {createArtifactReferences} from './artifact-reference';
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
import {teachingReference} from './teaching-presentation';
import {isTaskAmendment} from './tasks/continuation';
import {taskControlState,validTaskControl,type TaskControlAction} from '../../shared/xiaozhi-task-control';
import {teacherQuestionContinuation} from './tasks/teacher-question-continuation';
import type {TaskApiResult,TaskView} from '../../shared/xiaozhi-task';
import {taskSourceSubtasks} from '../../shared/xiaozhi-task-subtasks';
import {createXiaozhiBrowserHost} from './browser-host';
import {createPiBrowserTools} from './browser-tools';
import {createQuestionContextRuntime} from '../education/question-context-provider';
import {createQuestionWebAnswerTools,scopeQuestionWebExternalTools} from '../education/question-web-answer-tools';
import type {QuestionContextSource} from '../../shared/question-context';
import {createQuestionCollectionCoordinator} from '../education/question-collection-coordinator';
import {validQuestionCollection,type QuestionCollectionInput,type QuestionCollectionDecision} from '../../shared/question-collection';
import {createQuestionReviewCoordinator} from '../education/question-review-coordinator';
import {validQuestionReview,type QuestionReviewDecision,type QuestionReviewResult,type QuestionReviewSummary} from '../../shared/question-review';
import type {XiaozhiWebInput} from '../../shared/xiaozhi-web';
import {createOfficeDocumentTools,sanitizeOfficeDocumentText} from './office-document-tools';
import {createNativeStatService} from './capabilities/native-stat';
import {createAdapterRegistry} from './capabilities/adapters/registry';
import {createCapabilityTaskRuntime} from './capabilities/runtime';
import {createCapabilityDispatcher} from './capabilities/dispatcher';
import {createControlledMcpService} from './mcp-controlled-service';
import {createCapabilityAcquisition, type AcquisitionContext} from './capabilities/acquisition/service';
import {createPublicSourceFetch} from './capabilities/acquisition/public-fetch';
import {createManagedMcpProviderRuntime, registerManagedMcpArtifact, managedMcpProviderId} from './capabilities/acquisition/managed-mcp';
import {createCapabilityAcquisitionTools} from './capabilities/acquisition/tools';
import {acquisitionSearchInput, acquisitionMutationInput, validAcquisitionSession} from './capabilities/acquisition/api';
import type {AcquisitionSearch, AcquisitionMutation, AcquisitionView} from '../../shared/xiaozhi-acquisition';
import {createExtensionPackageManager} from './extensions/package-manager';
import {createExtensionService} from './extensions/service';
import {createExtensionHost} from './extensions/host';
import {registerSessionToolGovernance, prewarmCoreToolGovernance, createRunToolGovernance, validCorePermissionProvider, type RunToolGovernance} from './capabilities/core-governance';
import {net} from 'electron';
import {createSkillGovernance} from './skills/service';
import {createSkillTeamService} from './skills/teams';
import {createLegacySkillAdapter} from './skills/legacy';
import {createGovernedSkillSource} from './skills/runtime';
import {createSkillCreatorTools} from './skills/tools';
import {captureSkillPrivateContext, createSkillPrivateContext, type SkillPrivateContext} from './skills/private-context';
import {captureRetiredPrivateHistory} from './skills/private-history';
import {persistNativeSessionReplacement} from './tasks/native-session-replacement';
import {createSkillPermissionCheck} from './skills/requirements';
import type {SkillGovernanceMutation} from '../../shared/xiaozhi-skill-governance';
import {createPermissionService} from './permissions/service';
import {publicPermissionApproval} from './permissions/public';
import {createEnvironmentService} from './environment/service';
import {createEnvironmentTools} from './environment/tools';
import {inspectLocalRuntimes} from './environment/runtime-diagnostics';
import {createLegacyPermissionBridge} from './permissions/legacy-approval';
import {createLegacyApprovalRequests} from './permissions/legacy-request';
import {createToolPermissionRuntime} from './permissions/tool-runtime';
import {filesystemScope,checkedFile,digest} from './permissions/resources';
import {createMcpPermissionContext} from './permissions/mcp';
import {validNativePermissionProvider} from './permissions/provider-source';
import {createPermissionRuntimeManager} from './permissions/windows/runtime';
import {createControlledPowerShellOperations} from './permissions/windows/operations';
import {createPermissionNetworkBroker} from './permissions/network';
import path from 'node:path';
import { publicEducationSkills } from './education-skills';
import { createManagedEducationSkills } from './managed-skills';
import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import type { XiaozhiSkill } from '../../shared/xiaozhi-skills';
import { createHash, createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createNativeModelSwitch, type ModelSwitchStage } from './native-model-switch';
import { createMcpRuntime } from './mcp-runtime';
import {createProviderHealth} from './provider-health';
import {createProviderCooldownStore} from './provider-cooldown-store';
import { createDecisionLedger } from './decisions/ledger';
import { judgeDecision,judgeRoute } from './decisions/deepseek-shadow';
import {createDecisionAuthority} from './decisions/authority';
import type { DecisionInput } from '../../shared/xiaozhi-decisions';
import {createTeacherCandidateCatalog} from '../education/teacher-preference-candidates';
import type {TeacherCandidateInput} from '../../shared/teacher-candidates';
import type { XiaozhiMcpAddInput, XiaozhiMcpInput, XiaozhiMcpTrustInput, XiaozhiMcpCredentialInput } from '../../shared/xiaozhi-mcp';
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
import {createSavedArtifactPreview} from './saved-artifact-preview';
import {OFFICE_VERSIONS_SCHEMA,type OfficeVersionInput,type OfficeVersionResult} from '../../shared/xiaozhi-office-versions';
import {verifyCatalogArtifactFile,type ResolvedArtifactFile} from './catalog-artifact-file';
import {officeSummary} from './office-artifact-state';
import {createOfficePaperRecovery} from './office-paper-recovery';
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
import {createOrdinaryConfigService} from './ordinary-config-service';
import type {OrdinaryCommit,OrdinaryIntent,OrdinaryQuery,OrdinaryUndo} from '../../shared/xiaozhi-ordinary-config';
import {resolveAgentThinking} from './agent-config-resolver';
import {savePreparedAgentConfig} from './prepared-agent-config';
import type {PreparedAgentConfig} from '../../shared/xiaozhi-resolved-config';
import type { XiaozhiSettingsInput, XiaozhiSessionModelInput, XiaozhiCredentialInput } from '../../shared/xiaozhi-settings';
import { createQueueMutationHandler } from './queue-mutations';
import { createPiMemoryScope } from './memory-scope';
import { createHistoryMemory } from './history/memory';
import { historyOperations } from './history/operations';
import { validMemoryScopeInput } from './memory-selection';
import type { XiaozhiMemoryScopeInput } from '../../shared/xiaozhi-memory';
import type { XiaozhiActionResult, XiaozhiQueueInput } from '../../shared/xiaozhi-agent';
import type { OfficeProjectedTurn, OfficeProjection } from '../../shared/office-agent';
import { createEventPublisher } from './events/publisher';
import {repairCancelledRun} from './events/terminal-cancellation';
import {createLifecycleWorkTracker,LifecycleTimeoutError,waitForLifecycle,observeLifecycle} from './lifecycle-wait';
import { officeBlankFieldError } from './office-blank-fields';
import { validEventsInput, type XiaozhiEventsInput } from '../../shared/xiaozhi-events';
import type { XiaozhiAgentError, XiaozhiAgentEvent, XiaozhiAgentEventPayload, XiaozhiStartInput, XiaozhiStartResult, XiaozhiWorkspaceSnapshot } from '../../shared/xiaozhi-agent';

type Agent = Awaited<ReturnType<typeof import('./pi-session')['createPiXiaozhiSession']>>;
type Active = {
  answerOnly?: boolean;
  naturalLessonDraft?: NaturalLessonRequirements;
  naturalLessonSources?: MaterialSource[];
  handoutBasis?: NamedHandoutSource[];
  directOriginalPaper?: true;
  paperReceiptSummary?: true;
  lessonRevision?: LessonRevisionRequest;
  taskControl?: TaskControlAction;
  finalizing?: boolean;
  recoveryInspection?: TaskRecoveryInspection;
  rebuildFile?: string;
  dynamicCapabilities?: ReturnType<typeof createManagedMcpProviderRuntime>;
  toolGovernance?: RunToolGovernance;
  skillPrivateContext?: SkillPrivateContext;
  legacyApprovalId?: string;
  hasToolEvents?:boolean; paperExportIntent?:PaperExportIntent; mockExamExportIntent?:MockExamExportIntent; resumeDeliveryId?:string; mockExamDeliveryResume?:true; classroomPlan?:ClassroomPlanStart; computationResults?:ReturnType<typeof createComputationResults>; computationScope?:Awaited<ReturnType<ReturnType<typeof createManagedTools>['freeze']>>; unfinishedThinkingTask?:string; teachingTaskReference?:string; task?:import('../../shared/xiaozhi-task').TaskView; teacherPreferenceRevision?:number; runId: string; commandId: string; goalId?:string; operation: 'prompt' | 'compact'; turn: OfficeProjectedTurn; agent?: Agent; stopped: boolean; abort: AbortController; sequence: number; done?: Promise<void>; instructions:Set<string>; usage:XiaozhiUsage; usageWrites:Promise<void>; officePresentation?:ReturnType<typeof createOfficeDeliveryPresentation>; verification?:ReturnType<typeof createRunVerification>; results?:ReturnType<typeof createRunResultReadback>; readResults?:ReturnType<typeof bindNativeResultReadback>; publisher?:ReturnType<typeof createEventPublisher>; lifecycleWork?:ReturnType<typeof createLifecycleWorkTracker>; pendingEvents?:XiaozhiAgentEventPayload[];receiptCaptures?:Map<string,ReceiptCapture> };
const validId = (id: unknown): id is string => typeof id === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(id);
const inside = (root: string, target: string) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

export function createXiaozhiProductionHost(options: { managedTools?:ReturnType<typeof createManagedTools>; store: OmniEduStore; dataRoot: string; emit: (event: XiaozhiAgentEvent) => void;
  emitTerminal?: (event: TerminalUpdate) => void;
  /** Main-owned isolated legacy regression only; product launches always enable Pi. */
  enabled?: boolean;
  /** Main-only acceptance seam; packaged IPC never installs it. */
  onCapabilityProbe?: (result: unknown) => void;
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
  const executions = new Map<string, {sessionId: string; done: Promise<void>}>();
  const fileChecks=createDeliveryChecks({state:store.xiaozhiState.inspections,dataRoot:options.dataRoot,observe:report=>{const run=active.get(report.sessionId);if(run&&run.runId===report.runId){run.officePresentation??=createOfficeDeliveryPresentation(run.runId);run.officePresentation.inspected();}},resolve:id=>host.resolveFileWorkspace(id),requirements:async id=>deliveryRequirements(await createTaskState(store.xiaozhiState.sql,{sanitize:async text=>(await createStudentContextSanitizer(store))(text)}).requirements(id)),
    publishedCurrent:async(id,relative)=>officePathIsCurrent(await store.xiaozhiState.officeArtifacts.versionRecords(id) as OfficeFamilyRecord[],relative),
    candidateStatus:async(id,file)=>{const ref=file.candidate;if(!ref)return{current:false,published:false};const row=ref.kind==='text'?await store.xiaozhiState.changes.get(ref.id):await store.xiaozhiState.officeArtifacts.get(ref.id);
      const family=row&&'artifactId'in row&&row.artifactId?officeVersionFamilies(await store.xiaozhiState.officeArtifacts.versionRecords(id) as OfficeFamilyRecord[]).get(row.artifactId):undefined;
      return{current:!!row&&(!family||family.currentArtifactId===('artifactId'in row?row.artifactId:null))&&row.sessionId===id&&row.path===file.path&&row.state!=='reverted'&&('afterSha256'in row?row.afterSha256===file.sha256:row.draftHash===file.fileVersion&&row.outputHash===file.sha256),published:row?.state==='saved'||row?.state==='applied'};}});
  const idleTaskResults=createTaskResultRecheck({store,dataRoot:options.dataRoot,nativeRoot:root,current:id=>!closing&&!active.has(id)&&!admissions.get(id)?.size&&!choosing.has(id)&&!configuring.has(id)&&!configuring.has('provider'),workspace:id=>host.resolveFileWorkspace(id)});
  const tasks=createTaskCoordinator({store,closing:()=>closing,running:id=>active.has(id),busy:id=>active.has(id)||Boolean(admissions.get(id)?.size)||choosing.has(id)||configuring.has(id)||configuring.has('provider')||skillsMutating,
    emit:options.emit,inspect:inspectRecoveryCard,beforeCompletion:async task=>{
      await effectReconciler.recheck(task.sessionId,task.id);
      await terminalService.closeTask(task.sessionId,task.id);
    },resultRecheck:idleTaskResults,taskRecheck:async task=>{const proofs:import('../../shared/xiaozhi-verification').TaskVerification[]=[];for(const run of await tasks.admittedRuns(task.sessionId,task.id))try{proofs.push(await idleTaskResults.run(run.runId,task));}catch{/* Unknown historical effects cannot be confirmed or replayed. */}return proofs;}});
  const recoveryCards=new Map<string,{revision:number;time:number;value:TaskRecoveryInspection}>();
  async function inspectRecoveryCard(task:import('../../shared/xiaozhi-task').TaskView){
    const cached=recoveryCards.get(task.id);
    if(cached?.revision===task.revision&&Date.now()-cached.time<2000)return structuredClone(cached.value);
    const value=await inspectTaskRecovery({sql:store.xiaozhiState.sql,nativeRoot:root,sessionId:task.sessionId,taskId:task.id});
    if(recoveryCards.size>=128)recoveryCards.delete(recoveryCards.keys().next().value!);
    recoveryCards.set(task.id,{revision:task.revision,time:Date.now(),value});return value;
  }
  const journalFailures = new Map<string, {runId:string;run:Active;error?:'lifecycle_timeout'}>();
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
  const history = createHistoryMemory(store,options.dataRoot);
  const memory = createPiMemoryScope(store, { modelAccess: 'available', history });
  let closing = false;
  const startupPrewarm=createStartupPrewarm(async signal=>{
    signal.throwIfAborted();
    const definitions=coreToolStartupDefinitions();
    // Import the actual Pi module, but never construct a Session, read private context or contact a model.
    await import('./pi-session');
    signal.throwIfAborted();
    return prewarmCoreToolGovernance({definitions,registry:store.xiaozhiState.capabilities,signal});
  });
  let terminalService: TerminalService;
  const toolPermissionProvider = (sessionId: string, name: string) => {
    const record = active.get(sessionId)?.toolGovernance?.records.get(name);
    return record ? {id: record.providerId, version: record.providerVersion, sourceHash: record.sourceHash, schemaHash: record.schemaHash} : null;
  };
  const taskOwnerCurrent = async (owner: PermissionOwner) => {
    const run = active.get(owner.sessionId);
    if (closing || !run || run.stopped || run.runId !== owner.runId || run.task?.id !== owner.taskId
        || run.publisher?.owner.generation !== owner.generation) return false;
    const requirementsVersion = run.task.requirementsVersion;
    try {
      await createTaskState(store.xiaozhiState.sql, {sanitize: async text => text})
        .validateCurrentOwner({sessionId: owner.sessionId, runId: owner.runId, generation: owner.generation}, owner.taskId, requirementsVersion);
      return !closing && active.get(owner.sessionId) === run && !run.stopped
        && run.task.requirementsVersion === requirementsVersion;
    } catch {return false;}
  };
  const permissions = createPermissionService({store: store.xiaozhiState.permissions, dataRoot: options.dataRoot,
    jobCurrent: (binding, request) => terminalService?.permissionCurrent(binding, request) || false,
    requirementsVersion: sessionId => active.get(sessionId)?.task?.requirementsVersion || 1,
    task: taskId => createTaskState(store.xiaozhiState.sql, {sanitize: async text => text}).get(taskId),
    validateTaskOwner: taskOwnerCurrent,
    runtimeScope: () => permissionRuntime.recipe(),
    sanitizeSummary: text => sanitizeOfficeDocumentText(store, text),
    legacyApprovals: async sessionId => {
      await approvals.migrateLegacy(sessionId);
      return (await store.xiaozhiState.approvals(sessionId)).filter(row => row.state === 'pending' || row.state === 'approved')
        .map(row => ({id: row.id, source: row.source, target: row.target, state: row.state as 'pending' | 'approved'}));
    },
    needsRuntimeConfiguration: async () => (await permissionRuntime.inspect()).status === 'needs_configuration',
    process: async () => {const runtime = await permissionRuntime.systemRuntime(); return {executable: runtime.path, executableHash: runtime.sha256};},
    verifyProcess: async scope => await acquisition.verifyProcess(scope) || await extensionPackages.verifyProcess(scope),
    toolProvider: toolPermissionProvider,
    verifyProvider: async provider => {
      if (provider.id.startsWith('edu.native.tool.')) return validCorePermissionProvider(store.xiaozhiState.capabilities, provider);
      if (provider.id.startsWith('mcp.mcp-')) {
        const current = await mcp.trustedAuthority('mcp_' + provider.id.slice('mcp.mcp-'.length));
        return !!current && current.sourceHash === provider.sourceHash && current.schemaHash === provider.schemaHash;
      }
      return validNativePermissionProvider(provider);
    },
    owner: sessionId => {
      const run = active.get(sessionId);
      if (closing || !run?.publisher || !run.task || run.stopped) return null;
      return {...run.publisher.owner, taskId: run.task.id};
    },
    archived: async sessionId => Boolean((await store.getAiConversationSession(sessionId)).session.archivedAt),
    workspace: sessionId => host.resolveFileWorkspace(sessionId, false),
    notify: async sessionId => {
      const run = active.get(sessionId);
      if (run) for (const approval of await store.xiaozhiState.permissions.approvals(sessionId)) {
        publicEvent(sessionId, run, {kind: 'approval', approval: publicPermissionApproval(approval)});
      }
    }});
  const permissionRuntime = createPermissionRuntimeManager({root: path.join(options.dataRoot, 'managed-tools/permission-runtime'), store: store.xiaozhiState.permissions});
  const networkReceiptDirectory=path.join(options.dataRoot,'xiaozhi-effects/network');
  const effectReconciler=createEffectReconciler({sql:store.xiaozhiState.sql,networkDirectory:networkReceiptDirectory,
    readback:{readEffect:createRecoveryEffectReader({sql:store.xiaozhiState.sql,persistent:store.xiaozhiState,
      changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts,dataRoot:()=>options.dataRoot})}});
  const terminalOperations = createControlledPowerShellOperations({runtime: permissionRuntime, store: store.xiaozhiState.permissions,
    broker: createPermissionNetworkBroker({engine: permissions.engine, effects: createNetworkEffects(store.xiaozhiState.sql,networkReceiptDirectory),
      sanitize: async text => (await store.sanitizeProblemText(text)).sanitizedText})});
  let skillsMutating = false;
  const localSettingsJobs = new Set<Promise<unknown>>();
  const settingsBusy = () => Boolean(closing || skillsMutating || active.size || starting.size || choosing.size || configuring.size);
  const attachments=createAttachmentCoordinator({store,dataRoot:options.dataRoot,closing:()=>closing,
    reserve:id=>{if(closing||skillsMutating||active.has(id)||starting.size||choosing.has(id)||configuring.size)return false;choosing.add(id);return true;},
    release:id=>{choosing.delete(id);}});
  const modelSettings = createModelSettings({ store, root, codec: options.settingsCodec, busy: settingsBusy,
    assertMutation: () => { if (closing || !configuring.has('provider')) throw new Error('busy'); }, switchBound });
  const ordinaryBusy=()=>Boolean(closing||skillsMutating||choosing.size||configuring.size);
  const ordinaryConfig=createOrdinaryConfigService({sql:store.xiaozhiState.sql,model:modelSettings,root,codec:options.settingsCodec});
  const assertOrdinary=()=>{if(ordinaryBusy())throw Error('busy');};
  const assertCredential=()=>{if(closing||!configuring.has('provider'))throw Error('busy');};
  async function writeOrdinary(input:OrdinaryIntent){
    const repeat=await ordinaryConfig.repeat(input);
    if(repeat)return repeat;
    return 'credentialId' in input && input.credentialId
      ?mutateSettings(()=>ordinaryConfig.apply(input,assertCredential))
      :ordinaryConfig.apply(input,assertOrdinary);
  }
  const environment = createEnvironmentService({workspace: sessionId => host.resolveFileWorkspace(sessionId),
    permissionRuntime,
    runtimeChecks: inspectLocalRuntimes,
    permissions: store.xiaozhiState.permissions, managedTools: async () => ({tools: [await managedTools.view()]}),
    credentialAvailable: async () => {try {return Boolean((await modelSettings.runtime()).apiKey);} catch {return false;}}});
  async function mutateSettings<T>(action: () => Promise<T>): Promise<T> {
    if (settingsBusy()) throw new Error('busy');
    configuring.add('provider'); // Reserve synchronously, including network validation time.
    try { return await action(); } finally { configuring.delete('provider'); }
  }
  const managedSkills = createManagedEducationSkills({ root: path.join(root, 'skills'), state: store.xiaozhiState,
    assertIdle: () => { if (closing || active.size || choosing.size || configuring.size) throw new Error('busy'); } });
  const skillGovernance = createSkillGovernance({state: store.xiaozhiState.skillGovernance, managed: managedSkills,
    open: () => !closing,
    sanitize: text => sanitizeOfficeDocumentText(store, text),
    privateContext: async owner => owner ? active.get(owner.sessionId)?.skillPrivateContext : undefined,
    permission: createSkillPermissionCheck({permissions, workspace: sessionId => host.resolveFileWorkspace(sessionId),
      process: async () => {const runtime = await permissionRuntime.systemRuntime(); return {executable: runtime.path, executableHash: runtime.sha256};},
      requirementsVersion: sessionId => active.get(sessionId)?.task?.requirementsVersion || 1}),
    current: taskOwnerCurrent,
    dependency: async (dependency, owner) => {
      if (owner) {
        const run = active.get(owner.sessionId);
        if (!run || run.stopped || run.runId !== owner.runId || run.task?.id !== owner.taskId) return false;
      }
      const requirement = {capabilityId: dependency.capabilityId,
        contractVersion: dependency.contractVersion, required: [], optional: [], conditions: dependency.conditions || [], localOnly: true,
        platform: process.platform, budget: {latencyMs: 60000, resourceUnits: 100}};
      const resolution = owner ? await host.capabilities.resolve(owner.sessionId, requirement)
        : await host.capabilities.resolveSkillDeclaration(requirement);
      return resolution.selectedProviders.length > 0;
    }});
  const skillTeams = createSkillTeamService(skillGovernance);
  const governedLegacySkills = createLegacySkillAdapter(skillGovernance);
  const skillsReady = managedSkills.initialize().then(async () => {
    await store.xiaozhiState.skillGovernance.officialAuthority.recordReviewedRole('application', {
      reference: 'app-reviewed:education-skills', sha256: createHash('sha256').update(JSON.stringify(publicEducationSkills())).digest('hex'),
    });
    await skillGovernance.initialize();
  });
  void skillsReady.catch(() => undefined);
  async function publicSkills(): Promise<XiaozhiSkill[]> {
    await skillsReady;
    const catalog = await governedLegacySkills.catalog(), builtin = publicEducationSkills();
    return Promise.all(catalog.skills.filter(item => item.enabled && !item.archived).map(async item => {
      const known = builtin.find(skill => skill.name === item.name);
      if (known) return known;
      let instructions = '';
      try { instructions = parseFrontmatter((await governedLegacySkills.preview(item.name)).document).body; } catch { /* Source error is projected by the run; keep snapshot readable. */ }
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
    // Record synchronously, before a later committed projection can replace turn.
    // A run with no tool start cannot own a tool approval or file effect.
    if(payload.kind==='tool_start')run.hasToolEvents=true;
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
        const lifecycle=error instanceof LifecycleTimeoutError;
        const operation=lifecycle&&/^[a-z][a-z0-9_]{0,63}$/.test(error.operation)?error.operation:undefined;
        console.error('[xiaozhi-journal]',JSON.stringify({code,type,nativeCode,tool,timeoutMs,operation,elapsedMs:lifecycle?error.elapsedMs:undefined,locations}));
        console.error('[xiaozhi-cancel]',JSON.stringify({source:'journal',runId:run.runId,code}));
        const publicError = lifecycle ? 'lifecycle_timeout' : 'event_persistence';
        journalFailures.set(id, {runId:run.runId,run,...(lifecycle?{error:'lifecycle_timeout' as const}:{})}); run.stopped = true; run.abort.abort();
        void run.agent?.abort().catch(() => undefined);
        // Transient failure notification, never a committed journal event.
        try { options.emit({ sessionId: id, runId: run.runId, sequence: run.sequence, generation: owner.generation,
          durability: 'unavailable', kind: 'status', status: 'failed', error: publicError }); } catch { /* Snapshot retains the local failure overlay. */ }
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
  const cooldowns=createProviderCooldownStore(store.xiaozhiState.sql);
  const providerHealth=createProviderHealth({persistence:cooldowns});
  const mcp = createMcpRuntime(store.xiaozhiState.sql, options.settingsCodec, { health:providerHealth,sanitize: text => sanitizeOfficeDocumentText(store, text) });
  const capabilityAdapters = createAdapterRegistry({audit: async (context, adapterId, code) => {
    await store.xiaozhiState.permissions.audit(context.sessionId, 'capability_adapter_denied', adapterId,
      {code, taskId: context.taskId, runId: context.runId, callId: context.callId});
  }});
  const extensionPackages = createExtensionPackageManager({sql: store.xiaozhiState.sql,
    root: path.join(options.dataRoot, 'managed-tools/extensions'), permissions,
    fetcher: createPublicSourceFetch({fetch: (input, init) => net.fetch(input instanceof URL ? input.href : input, init)}),
    localNode: () => (process.env.PATH || '').split(path.delimiter).filter(directory => /^[a-z]:[\\/]/iu.test(directory))
      .map(directory => path.join(directory, 'node.exe')).find(filename => fs.existsSync(filename))});
  const extensions = createExtensionService({sql: store.xiaozhiState.sql, permissions, store: store.xiaozhiState.permissions,
    runtime: permissionRuntime, binding: extensionPackages.binding});
  const extensionHost = createExtensionHost({dataRoot: options.dataRoot, packages: extensionPackages, service: extensions,
    registry: store.xiaozhiState.capabilities, snapshots: store.xiaozhiState.capabilitySnapshots, adapters: capabilityAdapters, current: (id, callId) => acquisitionContext(id, callId, false),
    privateText: (id, text) => active.get(id)?.skillPrivateContext?.contains(text) === true,
    sanitize: text => sanitizeOfficeDocumentText(store, text)});
  const controlledMcp = createControlledMcpService({permissions, store: store.xiaozhiState.permissions, runtime: permissionRuntime,
    binding: (source, owner) => acquisition.binding(source.sourceHash, owner)});
  const acquisition = createCapabilityAcquisition({sql: store.xiaozhiState.sql, root: path.join(options.dataRoot, 'managed-tools/capabilities'),
    permissions, permissionsStore: store.xiaozhiState.permissions,
    fetcher: createPublicSourceFetch({fetch: (input, init) => net.fetch(input instanceof URL ? input.href : input, init)}),
    localNode: () => (process.env.PATH || '').split(path.delimiter).filter(directory => /^[a-z]:[\\/]/iu.test(directory))
      .map(directory => path.join(directory, 'node.exe')).find(filename => fs.existsSync(filename)),
    sanitize: text => sanitizeOfficeDocumentText(store, text),
    register: (artifact, context) => registerManagedMcpArtifact({mcp, controlled: controlledMcp, registry: store.xiaozhiState.capabilities,
      permissions, store: store.xiaozhiState.permissions, state: acquisition.state, context, probe: options.onCapabilityProbe}, artifact),
    revoke: async artifact => {
      for (const server of (await mcp.catalog()).servers.filter(row => row.endpoint === 'managed:' + artifact.id)) {
        permissions.engine.cancelServer(server.id);
        const catalog = await mcp.catalog();
        await mcp.revoke({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: server.id});
      }
      const catalog = await store.xiaozhiState.capabilities.snapshot();
      const provider = catalog.providers.find(row => row.id === managedMcpProviderId(artifact));
      if (provider) await store.xiaozhiState.capabilities.revokeProvider(provider.id, catalog.revision);
    }});
  async function acquisitionContext(id: string, callId?: string, needsWorkspace = true): Promise<AcquisitionContext> {
    const run = active.get(id);
    if (closing || !run?.publisher || !run.task || run.stopped) throw Error('permission_denied');
    const workspace = needsWorkspace ? await host.resolveFileWorkspace(id) : {path: ''};
    if (closing || active.get(id) !== run || run.stopped) throw Error('permission_denied');
    return {owner: {...run.publisher.owner, taskId: run.task.id}, ...(callId ? {callId} : {}), requirementsVersion: run.task.requirementsVersion,
      workspace: workspace.path, signal: run.abort.signal, current: () => !closing && active.get(id) === run && !run.stopped,
      recordAuthority: async (reference, refs, innerCallId) => {const parent = callId || innerCallId;
        if (parent) await run.toolGovernance?.recordAuthority(parent, refs, reference);},
      persist: action => run.publisher!.persist(() => action())};
  }
  terminalService = createTerminalService({sql: store.xiaozhiState.sql, permissions,
    permissionStore: store.xiaozhiState.permissions, runtime: permissionRuntime,
    current: (id, callId) => acquisitionContext(id, callId),
    workspace: async id => {
      const grant = await store.xiaozhiState.workspace(id) || conversationOutput(options.dataRoot, id);
      return authorizedWorkspace(grant.path, options.dataRoot);
    },
    readable: async id => !closing && !(await store.getAiConversationSession(id)).session.archivedAt,
    sanitize: text => sanitizeOfficeDocumentText(store, text),
    emit: event => {try {options.emitTerminal?.(event);} catch {/* A renderer lifetime does not own the Job. */}},
  });
  async function acquisitionView(id: string): Promise<AcquisitionView> {
    if (closing || !validAcquisitionSession(id) || (await store.getAiConversationSession(id)).session.archivedAt) throw Error('permission_denied');
    await acquisition.ensureReviewed();
    const run = active.get(id);
    return {...await acquisition.view(id), extensions: await extensionHost.view(), context: run?.publisher && run.task && !run.stopped
      ? {...run.publisher.owner, taskId: run.task.id} : null};
  }
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
  async function paperTaskRuns(id:string,runId:string){
    const activeTask=active.get(id);
    if(activeTask?.runId!==runId||!activeTask.task)return [];
    const record=await tasks.committedRecord(id);
    if(!record||record.view.id!==activeTask.task.id||!record.runIds.includes(runId))throw Error('conflict');
    return record.runIds;
  }
  const paperReviews=createPaperCoordinator({store,
    taskRuns:paperTaskRuns,
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
  const legacyRequests = createLegacyApprovalRequests({permissions,
    workspace: sessionId => host.resolveFileWorkspace(sessionId),
    provider: row => {
      const run = active.get(row.sessionId);
      if (!run?.publisher || !run.task || run.stopped
          || run.runId !== row.runId && run.legacyApprovalId !== row.id) return null;
      return toolPermissionProvider(row.sessionId, 'office_copy_file');
    },
    binding: (sessionId, runId) => createTaskState(store.xiaozhiState.sql, {sanitize: async text => text}).ownerForRun(sessionId, runId),
    resumedOwner: row => {
      const run = active.get(row.sessionId);
      if (run?.legacyApprovalId !== row.id || !run.publisher || !run.task || run.stopped) return null;
      return {...run.publisher.owner, taskId: run.task.id, requirementsVersion: run.task.requirementsVersion};
    }});
  const legacyBridge = createLegacyPermissionBridge({permissions, store: store.xiaozhiState.permissions, request: legacyRequests.request});
  const approvals = createPiApprovalCoordinator({ store, dataRoot: options.dataRoot,
    legacyValidate: legacyRequests.validate,
    resumedLegacyId: (sessionId, runId) => active.get(sessionId)?.runId === runId ? active.get(sessionId)?.legacyApprovalId : undefined,
    legacyBridge,
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
  const handoutEdits=createHandoutEditCoordinator({state:store.xiaozhiState.handoutEdits,versions:store.teachingBookVersions,
    sanitizer:()=>createStudentContextSanitizer(store),
    publish:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'handout_edit',review});},
  });
  const mockExam=createMockExamCatalog({state:store.xiaozhiState.mockExamCatalogs,
    answerReview:(entry,signal)=>store.materialAi.bookAnswers.paperReview(entry,signal),
    verify:(id,version,signal)=>store.materials.verifyOriginalVersion(id,version,signal),
    notify:(id,runId,catalog)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'mock_exam_catalog',catalog});},
  });
  const mockExamEdits=createMockExamEditCoordinator({state:store.xiaozhiState.mockExamEdits,catalogs:store.xiaozhiState.mockExamCatalogs,
    sanitize:()=>createStudentContextSanitizer(store),
    verify:(id,version,signal)=>store.materials.verifyOriginalVersion(id,version,signal),
    publish:(id,runId,review)=>{const run=active.get(id);if(run?.runId===runId)publicEvent(id,run,{kind:'mock_exam_edit',review});},
  });
  const mockExamArchive=createMockExamArchive({dataRoot:options.dataRoot,state:store.xiaozhiState.mockExamCatalogs,materials:store.materials,stopped:()=>closing});
  const mockExamOffice=createMockExamOfficeBinding(store.xiaozhiState.mockExamCatalogs,
    (id,version,signal)=>store.materials.verifyOriginalVersion(id,version,signal));
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
      validateMockExamDraft:mockExamOffice.validate,
      verifyMockExamDraft:mockExamOffice.verify,
      commitMockExamDraft:mockExamOffice.commit,
      validateHandoutDraft:async(id,draft)=>{
        if(!isTeachingHandoutOfficeDraft(draft))throw Error('invalid_input');
        const item=await store.teachingBookVersions.forExport(id,'',draft.handoutSource);
        if(item.kind!=='found')throw Error('conflict');
        assertHandoutOffice(item,draft);
      },
      commitHandoutDraft:async(id,draft,install)=>{
        if(!isTeachingHandoutOfficeDraft(draft))throw Error('invalid_input');
        await store.teachingBookVersions.withConfirmedExport(id,draft.handoutSource,item=>{
          assertHandoutOffice(item,draft);
          install();
        });
      },
      validateClassroomDraft:async(id,draft)=>{if(!('classroomSource'in draft))throw Error('invalid_input');assertClassroomOffice(await store.xiaozhiState.classrooms.readConfirmed(id,draft.classroomSource.classroomId,draft.classroomSource.version),draft);},
      commitClassroomDraft:async(id,draft,install)=>{if(!('classroomSource'in draft))throw Error('invalid_input');await store.xiaozhiState.classrooms.withConfirmedSource(id,draft.classroomSource.classroomId,draft.classroomSource.version,item=>{assertClassroomOffice(item,draft);install();});},
      validateLessonDraft:async(id,draft)=>{if(!('lessonSource'in draft))throw Error('invalid_input');assertTeachingLessonOffice(await store.xiaozhiState.classroomPlans.readConfirmedLesson(id,draft.lessonSource.id,draft.lessonSource.version),draft);},
      commitLessonDraft:async(id,draft,install)=>{if(!('lessonSource'in draft))throw Error('invalid_input');await store.xiaozhiState.classroomPlans.withConfirmedLessonSource(id,draft.lessonSource.id,draft.lessonSource.version,item=>{assertTeachingLessonOffice(item,draft);install();});},
      validatePaperDraft:async(id,draft)=>{if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');assertPaperOffice(await store.papers.review(id,draft.paperSource.paperId),draft);},
      resolvePaperImages:async(id,draft,signal)=>{if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');assertPaperOffice(await store.papers.review(id,draft.paperSource.paperId),draft);return resolvePaperOfficeImages(draft,store.originalQuestions,signal,store.nativeQuestions);},
      commitPaperDraft:async(id,draft,install)=>{
        if(!isPaperOfficeDraft(draft))throw new Error('invalid_input');
        await store.papers.withConfirmedSource(id,draft.paperSource.paperId,draft.paperSource.digest,paper=>{assertPaperOffice(paper,draft);install();},
          {...(String(draft.schemaVersion)==='xiaozhi.office-paper-draft.v7'?{c2:true as const}:{}),selection:draft.paperSource.selection});
      },
      recoverPaperDraft:createOfficePaperRecovery(store),
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
  const deliveries=createDeliveryCoordinator({checkMockExamSource:mockExamOffice.verify,checkLessonSource:async(_id,source)=>{if(source.question)await readQuestionContextSource(store,source.question);},state:store.xiaozhiState.deliveries,changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts,
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
      const target=await teacherQuestionContinuation(store.xiaozhiState.sql,item.sessionId,item.runId);
      if(!target)return{ok:false,error:'task_context_changed'};
      const outcome = await host.start({ sessionId:item.sessionId,commandId:item.id.replace('pictrl_','xicmd_'),
        prompt:`继续上次中断的教师澄清。上次问题：${item.text}\n教师回答：${answer}\n只按本次回答继续任务；旧复制、旧审批及未完成效果不要自动重放，所有文件效果需要新确认。`,continueTask:target },'prompt',undefined,undefined,undefined,item.runId);
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
  const savedArtifactPreview=createSavedArtifactPreview({dataRoot:options.dataRoot,authorize:authorizePaperConversation,
    current:id=>!closing&&!choosing.has(id),byArtifact:(id,artifactId)=>store.xiaozhiState.officeArtifacts.byArtifact(id,artifactId),
    artifact:id=>store.getDocumentArtifact(id),extract:async(request,signal)=>(await import('./document-host')).extractLocalDocument(request,signal),
    resolve:async(id,hash)=>{
      const grant=await store.xiaozhiState.paperOutput(id,hash);if(!grant||grant.hash!==hash)throw Error('permission_denied');
      const directory=await resolvePaperOutput(id,hash),after=await store.xiaozhiState.paperOutput(id,hash);
      if(!after||after.hash!==hash||after.path!==grant.path||directory!==authorizedWorkspace(after.path,options.dataRoot))throw Error('permission_denied');
      return directory;
    }});
  async function snapshot(id = '',settlementRead=0,beforeRunId?:string): Promise<XiaozhiWorkspaceSnapshot> {
    if (id && !validId(id)) throw new Error('invalid_input');
    if (id) await recoverModel(id);
    const model = await modelSettings.model(id || undefined);
    const projection: OfficeProjection = { schemaVersion: 'xiaozhi.office.projection.v1', threadId: id, provider: 'deepseek',
      model, epoch: 1, sourceSequence: 0, needsHydration: false, hasMoreHistory: false, turns: [] };
    if (!id) return { enabled, projection, running: false, legacyHistory: false };
    const detail = await store.getAiConversationHistoryPage(id,beforeRunId?{before:beforeRunId}:{});
    const selectedStudent=detail.session.studentId?(await store.listStudents('')).find(student=>student.id===detail.session.studentId):undefined;
    let task:Awaited<ReturnType<typeof tasks.committedRecord>>=null,taskUnavailable=false;
    try{await tasks.recover(id);task=await tasks.committedRecord(id);}catch{taskUnavailable=true;}
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
    const classroomPlanReviews=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')
      ?await store.xiaozhiState.classroomPlans.reviews(id).catch(()=>undefined):[];
    const teachingHandouts=!detail.session.archivedAt&&!detail.session.studentId
      ?await store.xiaozhiState.teachingHandouts.list(id).catch(()=>undefined):[];
    const handoutEditHistory=!detail.session.archivedAt&&!detail.session.studentId
      ?await store.xiaozhiState.handoutEdits.list(id).catch(()=>undefined):[];
    const mockExamHistory=!detail.session.archivedAt&&!detail.session.studentId
      ?await store.xiaozhiState.mockExamCatalogs.list(id).catch(()=>undefined):[];
    const mockExamEditHistory=!detail.session.archivedAt&&!detail.session.studentId
      ?await store.xiaozhiState.mockExamEdits.list(id).catch(()=>undefined):[];
    const storedPracticeReviews=!detail.session.archivedAt&&selectedStudent?.status==='active'?await store.practiceReviews.list(id):[];
    const storedQuestionCollections=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?await store.questionReviews.collections.list(id):[];
    const storedQuestionReviews=!detail.session.archivedAt&&(!detail.session.studentId||selectedStudent?.status==='active')?[...await store.questionReviews.list(id),...await store.originalQuestions.list(id)]:[];
    await approvals.migrateLegacy(id);
    const permissionApprovals = await store.xiaozhiState.permissions.approvalSnapshot(id);
    const storedApprovals = [...(await store.xiaozhiState.approvals(id)).map(publicApproval),
      ...permissionApprovals.items.map(publicPermissionApproval)];
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
    // Lifecycle/teacher-question events already drain on enqueue. Wait for that
    // committed queue, without forcing a text batch on every snapshot read.
    // Frequent polling must not turn observation into a write or bypass batching.
    await active.get(id)?.publisher?.settled();
    // Journal truth for new runs, compatibility publicItems for historical runs.
    const liveRunId=active.get(id)?.runId;
    const durable = await store.xiaozhiState.eventJournal.snapshotsForRuns(id,[...new Set([...projection.turns.map(turn=>turn.id),...(liveRunId?[liveRunId]:[])])]);
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
      if(current.publisher){
        // The eager internal turn may contain deltas that are still in the
        // publisher's timer. A snapshot and its cursor must share journal truth.
        projection.sourceSequence=durable.find(saved=>saved.turn.id===current.runId)?.cursor.sequence||0;
      }else{
        const index = projection.turns.findIndex(turn => turn.id === current.runId);
        if (index >= 0) projection.turns[index] = structuredClone(current.turn); else projection.turns.push(structuredClone(current.turn));
        projection.sourceSequence = current.sequence;
      }
      const metrics=current.agent?.usage() || current.usage;
      const value={...metrics,runId:current.runId,state:current.usage.state};
      const indexUsage=usage.findIndex(item=>item.runId===current.runId);
      if(indexUsage>=0)usage[indexUsage]=value;else usage.push(value);
    }
    // V2 adoption is a committed journal fact, not a newer private CAS draft.
    // The same committed turn is used for both inline plans and snapshot controls.
    storedControls=storedControls.filter(control=>!control.plan);
    for(const turn of projection.turns)for(const item of turn.items)if(validVersionedPlan(item.plan))storedControls.push(structuredClone(item.plan));
    const journalFailure = journalFailures.get(id);
    if (journalFailure) {
      const index = projection.turns.findIndex(turn => turn.id === journalFailure.runId);
      if (index >= 0) projection.turns[index] = applyXiaozhiEvent(projection.turns[index], { sessionId: id, runId: journalFailure.runId, sequence: 0, kind: 'status', status: 'failed', error: journalFailure.error ?? 'event_persistence' });
    }
    for (const metrics of usage) {
      const index = projection.turns.findIndex(turn => turn.id === metrics.runId);
      if (index >= 0) projection.turns[index] = applyXiaozhiEvent(projection.turns[index],
        { kind: 'usage', usage: metrics, sessionId: id, runId: metrics.runId, sequence: 0 });
    }
    // Derive the public view after journal/history hydration; persisted audit remains untouched.
    projection.turns = projection.turns.map(publicProviderTurn);
    // A persisted proposal can be approved only after preflight and registration of
    // its live teacher wait. Bundled children use the parent card.
    const visibleDeliveries=storedDeliveries.filter(delivery=>delivery.state!=='pending'||deliveries.awaitingDecision(delivery.id));
    const bundledDraftIds=new Set(visibleDeliveries.flatMap(delivery=>delivery.files.map(file=>file.draftId)));
    const visibleChanges=changes.filter(change=>change.state!=='pending'||bundledDraftIds.has(change.id)||textChanges.awaitingDecision(change.id));
    const visibleArtifacts=artifacts.filter(artifact=>artifact.state!=='pending'||bundledDraftIds.has(artifact.id)||officeArtifacts.awaitingDecision(artifact.id));
    return { enabled, fileWritesEnabled:fileWritesEnabled(), projection, eventCursors: durable.map(saved=>saved.cursor), ...(journalFailure?{eventPersistence:'unavailable' as const,eventPersistenceError:journalFailure.error}:{}), running: Boolean(current)&&!journalFailure, ...(detail.session.studentId?{studentContext:{id:detail.session.studentId,label:selectedStudent?.displayName||'学生档案不可用',status:selectedStudent?.status||'missing'}}:{}), ...(current?.operation === 'compact' ? { operation: 'compact' as const } : {}), legacyHistory: legacyHistory && !binding, interruptedSend,
      ...(classroomPlanReviews?{classroomPlanReviews}:{classroomPlanReviewsUnavailable:true as const}),
      ...(teachingHandouts?{teachingHandouts}:{teachingHandoutsUnavailable:true as const}),
      ...(handoutEditHistory?{handoutEdits:handoutEditHistory}:{handoutEditsUnavailable:true as const}),
      ...(mockExamHistory?{mockExamCatalogs:mockExamHistory}:{mockExamCatalogsUnavailable:true as const}),
      ...(mockExamEditHistory?{mockExamEdits:mockExamEditHistory}:{mockExamEditsUnavailable:true as const}),
      modelCapabilities, contextPolicy: current?.agent?.contextPolicy() || { auto: options.autoCompaction === true && Boolean(modelCapabilities), verified: Boolean(modelCapabilities),
        window: Math.min(modelCapabilities?.contextWindow || 32768, options.testContextWindow || Infinity), maxOutputTokens: answerQualityEnabled()?resolveAnswerPolicy('',modelCapabilities).maxOutputTokens:Math.min(4096, modelCapabilities?.maxOutputTokens || 4096),
        ...(options.testContextWindow ? { testPolicy: true } : {}) },
      ...(task?{task:task.view,taskRunIds:task.runIds}:{}),...(taskUnavailable?{taskUnavailable:true}:{}),...(permissionApprovals.unavailableCount?{approvalRecordsUnavailable:permissionApprovals.unavailableCount}:{}),paperReviews:storedPaperReviews,practiceReviews:storedPracticeReviews,questionCollections:storedQuestionCollections,questionReviews:storedQuestionReviews,learningReviews:storedLearningReviews, approvals: storedApprovals, changes:visibleChanges, deliveries:visibleDeliveries, officeArtifacts:visibleArtifacts, controls:storedControls, ...(storedGoal?{goal:publicGoal(storedGoal)}:{}), budgetSettings, limitsEnforced:false, browser:browserStatus, usage, memoryScope, skills: skillCatalog, ...(workspace ? { workspace: { label: workspace.label } } : {}),...(paperOutput?{paperOutput:{label:paperOutput.label}}:{}) };
  }
  function modelCoordinator(id:string,owner?:Active) {
    return createNativeModelSwitch({state:store.xiaozhiState.modelSwitch,root,
      assertIdle:()=>{ if (closing || (owner ? active.get(id)!==owner || owner.stopped || configuring.has('provider')
        : active.size || starting.size || choosing.size || skillsMutating || !configuring.has('provider'))) throw new Error('busy'); },
      assertAuthorized:async target=>{ if (target!==id || (await store.getAiConversationSession(id)).session.archivedAt) throw new Error('permission_denied'); },
      afterStage:options.afterModelSwitchStage});
  }
  const modelWrites=new Set<Promise<void>>();
  async function trackModelWrite<T>(action:()=>Promise<T>):Promise<T> {
    const work=action();
    const settled=work.then(()=>undefined,()=>undefined);
    modelWrites.add(settled);
    try{return await work;}finally{modelWrites.delete(settled);}
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
  async function sessionConfiguration(id:string,settings:{apiKey:string;model:string;providerConfigRevision?:string|number;thinking?:Awaited<ReturnType<typeof modelSettings.captureRun>>['thinking']},runId:string,capabilities:XiaozhiModelCapabilities|undefined,
    budget:PiXiaozhiOptions['budget'],cleanPrompt='',owner?:Active,admittedPrompt?:string):Promise<PiXiaozhiOptions & {thinkingBaseline:PreparedAgentConfig['thinking']}> {
    await skillsReady;
    const skillOwner = owner?.publisher && owner.task ? {...owner.publisher.owner, taskId: owner.task.id} : undefined;
    await skillGovernance.activatePending(skillOwner);
    await approvals.migrateLegacy(id);
    const stateRoot=path.join(root,id), privateWorkspace=path.join(stateRoot,'workspace'); fs.mkdirSync(privateWorkspace,{recursive:true});
    const grant=await store.xiaozhiState.workspace(id), workspace=grant?authorizedWorkspace(grant.path,options.dataRoot):privateWorkspace;
    const binding=await store.xiaozhiState.getBinding(id), rebuild=owner?.recoveryInspection?.canRebuildSession===true;
    const sessionFile=binding&&!rebuild?path.resolve(root,binding.sessionFile):undefined;
    if(rebuild){if(!binding)throw Error('source_changed');owner!.rebuildFile=binding.sessionFile;}
    if(sessionFile && (!inside(root,sessionFile) || binding?.model!==settings.model))throw new Error('configuration');
    const ledger=await store.xiaozhiState.modelSwitch?.current(id), coordinator=modelCoordinator(id,owner);
    const web = await store.xiaozhiState.modelSettings.web();
    const currentThinking=settings.thinking?undefined:await modelSettings.thinking(id);
    const thinking=settings.thinking??{
      observation:resolveAgentThinking(currentThinking!.global,currentThinking!.session),lastRun:currentThinking!.lastRun,
    };
    const unfinished=owner?.unfinishedThinkingTask;
    const teaching=owner?.teachingTaskReference;
    const toolTaskQuery=[...(owner?.task?.criteria.filter(c=>c.kind==='human').map(c=>c.text)||[]),...(owner?.task?.steps.map(step=>step.text)||[]),...(isThinkingContinuation(cleanPrompt)||isTaskAmendment(cleanPrompt)?[unfinished||'']:[]),...(teaching?[teaching]:[])].join('\n').slice(0,8000);
    const taskDepth=teaching||(unfinished&&isThinkingContinuation(unfinished)&&thinking.lastRun?.mode==='deep'?'深入教学任务':unfinished);
    const thinkingObservation=thinking.observation;
    const thinkingSource=thinkingObservation.source;
    const thinkingPolicy=resolveThinkingPolicy(cleanPrompt,capabilities,thinkingObservation.value,thinkingSource==='session_selection'?'session':'global',taskDepth);
    const thinkingBaseline:PreparedAgentConfig['thinking']={source:thinkingSource,revision:thinkingObservation.revision,
      requested:thinkingPolicy.requested,effective:thinkingPolicy.effective};
    const studentId=(await store.getAiConversationSession(id)).session.studentId||'';
    let observedLearning:(Awaited<ReturnType<typeof store.studentContext.learningSnapshot>>&{reviewVersion:number})|undefined;
    const observedMaterials=new Map<string,string>();
    const lessonIntent=owner?.classroomPlan?.mode==='outline'?owner.classroomPlan.lesson:undefined;
    const adopted=lessonIntent?await Promise.all(lessonIntent.curricula.map(binding=>store.materialCurriculum.bound(binding))):undefined;
    if(adopted?.some(entry=>entry.metadata.status!=='active'))throw Error('source_changed');
    const classroomContext=createClassroomContext(owner?.teacherPreferenceRevision||0,adopted);
    const lessonBasis=owner?.naturalLessonSources?.map(source=>({source}))??
      (owner?.naturalLessonDraft&&adopted?.length?adopted:undefined);
    const requiredLessonSourcesRead=lessonBasis?()=>lessonBasis.every(({source})=>classroomContext.hasRead(source)):undefined;
    const lessonRevisionTools=owner?.lessonRevision?createLessonRevisionTools({sessionId:id,runId,request:owner.lessonRevision,
      state:store.xiaozhiState.classroomPlans,current:()=>!closing&&active.get(id)===owner&&!owner.stopped,
      sanitize:text=>sanitizeOfficeDocumentText(store,text),teacherSelection:async()=> (await store.xiaozhiState.controls(id))
        .filter(item=>item.runId===runId&&item.kind==='question'&&item.state==='answered').at(-1)?.answer}):undefined;
    const fileReferenceTask=owner?.task?.id||(await tasks.committed(id))?.id;
    const fileReferences=fileReferenceTask?createFileReferenceProjection({state:store.xiaozhiState.fileReferences,sessionId:id,taskId:fileReferenceTask,
      workspace:()=>host.resolveFileWorkspace(id),current:()=>!closing&&(!owner||active.get(id)===owner&&!owner.stopped),
      sanitize:async text=>(await createStudentContextSanitizer(store))(text),sanitizer:()=>createStudentContextSanitizer(store),
      fileLabel:async(tool,relative)=>tool==='office_create_document'?sanitizeOfficeDocumentText(store,relative):(await store.sanitizeProblemText(relative)).sanitizedText}):undefined;
    const providerHealthSalt=await cooldowns.salt();
    const mcpTools = owner?.task ? await mcp.tools(createMcpPermissionContext({permissions, store: store.xiaozhiState.permissions,
      beforeCall: async (source, tool, input, signal, callId) => {
        if (!owner.toolGovernance) throw Error('permission_denied');
        await owner.toolGovernance.beginMcpCall(callId, {serverId: source.serverId, tool, transport: source.transport,
          sourceHash: source.sourceHash, schemaHash: source.schemaHash}, input, signal);
      },
      authority: async (callId, decision) => {await owner.toolGovernance?.recordAuthority(callId, decision.grantRefs, 'permission-request:' + decision.requestDigest);},
      stdio: controlledMcp.forOwner({signal: owner.abort.signal, workspace, requirementsVersion: () => owner.task?.requirementsVersion || 1,
        owner: () => {
          if (!owner.publisher || !owner.task || owner.stopped || active.get(id) !== owner) throw Error('permission_denied');
          return {...owner.publisher.owner, taskId: owner.task.id};
        }}),
      requirementsVersion: () => owner.task?.requirementsVersion || 1,
      owner: () => {
        if (!owner.publisher || !owner.task || owner.stopped || active.get(id) !== owner) throw Error('permission_denied');
        return {...owner.publisher.owner, taskId: owner.task.id};
      }}),{signal:owner.abort.signal}) : {definitions: [], dispose: async () => undefined};
    const observedQuestions=new Map<string,QuestionContextSource>();
    const observedEnrichmentQuestions=new Map<string,QuestionContextSource>();
    let webAnswerRuntime:ReturnType<typeof createQuestionWebAnswerTools>|undefined;
    const questionAliases:QuestionAliases=new Map();let observedMistakeLearning:ObservedMistakeLearning|undefined;
    const questionContext=createQuestionContextRuntime(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(reference,source)=>{observedQuestions.set(reference,source);},questionAliases,(reference,source)=>{observedEnrichmentQuestions.set(reference,source);webAnswerRuntime?.requireAuthorization();});
    try { return {stateRoot,workspace,fileReferences,modelToolPrivacy:createModelToolPrivacy({sanitizer:()=>createStudentContextSanitizer(store),current:()=>!closing&&(!owner||active.get(id)===owner&&!owner.stopped)}),thinkingPolicy,thinkingBaseline,toolTaskQuery,fileOutputWorkspace:await resolvePaperOutput(id)||workspace,...(!grant?{fileReadWorkspace:conversationOutput(options.dataRoot,id).path}:{}),apiKey:settings.apiKey,model:settings.model,sessionFile,budget,limitsEnforced:false,capabilities,mcpTools:scopeQuestionWebExternalTools(mcpTools.definitions,()=>observedEnrichmentQuestions.size>0),mcpDispose:mcpTools.dispose,
      modelProviderHealth:{health:providerHealth,keyForModel:modelId=>'deepseek:'+createHmac('sha256',providerHealthSalt)
        .update(JSON.stringify([settings.providerConfigRevision,settings.apiKey,modelId])).digest('hex')},
      ...(owner?.naturalLessonDraft&&lessonIntent?{naturalLessonDraft:{
        subject:lessonIntent.subject,grade:lessonIntent.grade,...owner.naturalLessonDraft,
        basis:lessonBasis&&requiredLessonSourcesRead&&{
          kind:owner.naturalLessonSources?'ordinary':'curriculum',
          sources:lessonBasis.map(({source:{resourceId,offset}})=>({resourceId,offset})),
          hasPendingRead:()=>!requiredLessonSourcesRead(),
        },
        hasDraft:()=>store.xiaozhiState.classroomPlans.hasDraftedLesson(id,runId),
      }}:{}),
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
        webAnswerRuntime=createQuestionWebAnswerTools({repo:store.questionWeb,readApplied:questionContext.readApplied,onNetworkScope:(scope,reset)=>browser.setNetworkScope(id,scope,reset),owner:{sessionId:id,runId},observed:observedEnrichmentQuestions,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),confirm:(question,signal,callId)=>wait(async()=>{
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
      executeAuthorized: permissions.forRun(id, runId).execute,
      terminalOperations,
      environmentTools: createEnvironmentTools(id, environment),
      educationSkills:true,
      managedSkills: skillOwner ? createGovernedSkillSource(skillGovernance, skillOwner,
        async text => (await store.sanitizeProblemText(text)).sanitizedText,
        () => skillGovernance.isCurrent(skillOwner))
        : {resources: async signal => managedSkills.resourcesForItems((await governedLegacySkills.catalog()).skills.filter(item => item.enabled && !item.archived), signal),
          sanitize: async text => (await store.sanitizeProblemText(text)).sanitizedText},
      skillCreatorTools: skillOwner ? createSkillCreatorTools(skillGovernance, () => skillOwner) : undefined,
      ...(!grant?{privateWorkspaceId:id}:approvals.callbacks(id,runId,workspace)),
      boundMockExamBundleId:owner?.mockExamDeliveryResume?owner.resumeDeliveryId:undefined,
      officeTextTools: wait => textChanges.tools(id, runId, wait),officeArtifactTools:wait=>officeArtifacts.tools(id,runId,wait),deliveryTools:wait=>deliveries.tools(id,runId,wait,officeArtifacts.tools(id,runId,wait)[0].parameters,owner?.resumeDeliveryId,createScienceLessonSource(store,observedQuestions)),officeDocumentTools:createOfficeDocumentTools({sessionId:id,runId,
        resolve:target=>host.resolveFileWorkspace(target),isCurrent:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        sanitize:text=>sanitizeOfficeDocumentText(store,text)}),
      classroomExportTools:wait=>createClassroomExportTools({sessionId:id,runId,state:store.xiaozhiState.classrooms,wait,runOffice:officeArtifacts.runOffice,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped}),paperExport:{studentId,outputOnly:!grant,tools:wait=>createPaperExportTool({papers:store.papers,paperExportIntent:owner?.paperExportIntent,sessionId:id,runId,wait,taskRuns:()=>paperTaskRuns(id,runId),runOffice:officeArtifacts.runOffice,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped})},
      autoCompaction:options.autoCompaction,testContextWindow:options.testContextWindow,afterAutoCompactCommit:options.afterAutoCompactCommit,beforeAutoCompactCommit:options.beforeAutoCompactCommit,
      sanitizeFileText:async text=>(await createStudentContextSanitizer(store))(text),protectedContext:async excluded=>(await getPiProtectedContext(store,id,excluded,await tasks.committed(id),await createStudentContextSanitizer(store)))+(await (await createStudentContextSanitizer(store))(await deliveries.context(id,owner?.resumeDeliveryId,source=>prepareScienceLessonRefresh(store,source,questionAliases))))
        +(owner&&admittedPrompt?await preparePaperAdaptationContext(store.paperAdaptations,{sessionId:id,studentId,runId,prompt:admittedPrompt},questionAliases,owner.abort.signal,()=>!closing&&!owner.stopped&&active.get(id)===owner):'')
        +(fileWritesEnabled()?'':'\n小智自动文件生成已暂停；已有记录、文件可读取和核验，不能提出或执行新的自动文件写入，不要声称已交付新文件。恢复生成需取消启动停写设置并重启。'),
      computationTools:managedComputationTools({service:owner?.computationScope||managedTools,capture:owner?.computationResults?.capture,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:async text=>(await createStudentContextSanitizer(store))(text)}),
      deliveryCheckTools:deliveryCheckTools({service:fileChecks,sessionId:id,runId,scope:()=>owner?.goalId||owner?.task?.id||runId,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitizer:()=>createStudentContextSanitizer(store)}),
      computationReportTools:wait=>computationReportTools({results:owner?.computationResults,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        publish:async(files,args)=>{
          if(files.length>1)return deliveries.tools(id,runId,wait,officeArtifacts.tools(id,runId,wait)[0].parameters,owner?.resumeDeliveryId)[0].execute(args[0],{files},args[2],args[3],args[4]);
          const file=files[0],{fileId,kind,...payload}=file;
          const tool=kind==='office'?officeArtifacts.tools(id,runId,wait)[0]:textChanges.tools(id,runId,wait).find(t=>t.name==='office_create_text')!;
          return tool.execute(args[0],payload,args[2],args[3],args[4]);
        }}),
      teachingLessonExportTools:wait=>createTeachingLessonExportTools({sessionId:id,state:store.xiaozhiState.classroomPlans,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),
        publish:async(files,args)=>{
          if(files.length>1)return deliveries.tools(id,runId,wait,officeArtifacts.tools(id,runId,wait)[0].parameters,owner?.resumeDeliveryId)[0].execute(args[0],{files},args[2],args[3],args[4]);
          const {fileId:_fileId,kind:_kind,...proposal}=files[0];
          return officeArtifacts.tools(id,runId,wait)[0].execute(args[0],proposal,args[2],args[3],args[4]);
        }}),
      ...(owner?.task&&!studentId&&!owner.classroomPlan&&!owner.resumeDeliveryId&&handoutExportRequest(cleanPrompt)?{
        handoutExportTools:wait=>createTeachingHandoutExportTools({sessionId:id,taskId:owner.task!.id,prompt:cleanPrompt,state:store.teachingBookVersions,
          current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),
          publish:(files,args)=>{
            if(files.length>1)return deliveries.publishHandout(id,runId,wait,args[0],files,args[2]);
            const {fileId:_fileId,kind:_kind,...proposal}=files[0];
            return officeArtifacts.runOffice(id,runId,wait,args[0],proposal,args[2]);
          }}),
      }:{}),
      ...(owner?.task&&owner.publisher&&!studentId&&!owner.classroomPlan&&!owner.resumeDeliveryId&&handoutEditRequest(cleanPrompt)?{
        handoutEditTools:wait=>handoutEdits.tools({sessionId:id,runId,
          owner:()=>({sessionId:id,taskId:owner.task!.id,runId,generation:owner.publisher!.owner.generation,
            requirementsVersion:owner.task!.requirementsVersion}),
          current:()=>!closing&&active.get(id)===owner&&!owner.stopped,
        },wait),
      }:{}),
      ...(owner?.task&&!studentId&&!owner.classroomPlan&&!owner.resumeDeliveryId&&(owner.mockExamExportIntent||mockExamExportRequest(cleanPrompt)&&!mockExamEditRequest(cleanPrompt))?{
        mockExamArchiveRequested:!owner.mockExamExportIntent&&mockExamArchiveRequest(cleanPrompt),
        mockExamExportTools:wait=>createMockExamExportTools({sessionId:id,taskId:owner.task!.id,intent:owner.mockExamExportIntent,
          state:store.xiaozhiState.mockExamCatalogs,binding:mockExamOffice,
          ...(!owner.mockExamExportIntent&&mockExamArchiveRequest(cleanPrompt)?{archive:(catalog:import('../../shared/mock-exam-compilation').MockExamCatalogSummary)=>publicEvent(id,owner,{kind:'mock_exam_catalog',catalog})}:{}),
          current:()=>!closing&&active.get(id)===owner&&!owner.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),
          publish:(files,args)=>{
            if(files.length>1)return deliveries.publishMockExam(id,runId,wait,args[0],files,args[2]);
            const {fileId:_fileId,kind:_kind,...proposal}=files[0];
            return officeArtifacts.runOffice(id,runId,wait,args[0],proposal,args[2]);
          }}),
      }:{}),
      ...(owner?.task&&owner.publisher&&!studentId&&!owner.classroomPlan&&!owner.resumeDeliveryId&&!owner.mockExamExportIntent&&mockExamEditRequest(cleanPrompt)?{
        mockExamEditTools:mockExamEdits.tools(()=>({sessionId:id,taskId:owner.task!.id,runId,generation:owner.publisher!.owner.generation,
          requirementsVersion:owner.task!.requirementsVersion}),()=>!closing&&active.get(id)===owner&&!owner.stopped),
      }:{}),
      ...(owner?.task&&owner.publisher&&!studentId&&!owner.classroomPlan&&!owner.resumeDeliveryId&&!owner.mockExamExportIntent&&mockExamRequest(cleanPrompt)&&!mockExamEditRequest(cleanPrompt)&&!mockExamExportRequest(cleanPrompt)?{
        mockExamTool:mockExam.tool(()=>({sessionId:id,taskId:owner.task!.id,runId,generation:owner.publisher!.owner.generation,
          requirementsVersion:owner.task!.requirementsVersion}),()=>!closing&&active.get(id)===owner&&!owner.stopped,cleanPrompt),
      }:{}),
      teacherRequestTools:excluded=>[createTeacherRequestTool({excluded,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,
        load:async blocked=>{const [detail,controls,task]=await Promise.all([store.getAiConversationSession(id),store.xiaozhiState.controls(id),tasks.committed(id)]);return teacherRequestSources(detail.messages,controls,blocked,task);},
        sanitize:async text=>(await createStudentContextSanitizer(store))(text)})],
      memory:{runId,authority:()=>memory.authority(id),readSelected:(authority,signal)=>memory.readSelected(id,authority,signal),trace:()=>memory.trace(id)},
      educationTools:createEducationTools(store,cleanPrompt),controlTools:controls.tools(id,runId,{recoverableQuestion:!!owner&&!owner.goalId,checkCopyRefusal:async()=>{
        if (!active.get(id)?.turn.items.some(item=>item.kind==='tool'&&item.toolName==='office_copy_file')) return false;
        const [task,approvals]=await Promise.all([tasks.committed(id),store.xiaozhiState.permissions.approvalSnapshot(id)]);
        return singleCopyWasDeclined(task,runId,approvals.items);
      }}),
      questionContextTools:questionContext.tools,
      questionReviewTools:questionReviews.tools(id,runId,observedQuestions,undefined,{provider:'deepseek',model:settings.model,runId}),
      questionCollectionTools:questionCollections.tools(id,runId,observedQuestions,{provider:'deepseek',model:settings.model,runId}),
      practiceReview:{studentId,tools:practiceReviews.tools(id,runId,studentId,observedQuestions,()=>observedMistakeLearning)},
      paperReview:{studentId,tools:paperReviews.tools(id,runId)},
      originalQuestionReviewTools:originalReviews.tools(id,runId,observedMaterials),
      materialTools:createMaterialTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(resourceId,version,material)=>{classroomContext.observe(material);observedMaterials.set(resourceId,version);},lessonBasis),
      materialPageTools:createMaterialPageTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,observedMaterials),
      educationCapabilityTools:createEducationCapabilityProvider(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped).tools,
      ...(owner?.task&&owner.publisher&&!studentId&&!owner.classroomPlan&&handoutRequest(cleanPrompt)?{
        handoutBasis:owner.handoutBasis,
        teachingHandoutTool:createTeachingHandoutTool({
          state:store.xiaozhiState.teachingHandouts,context:()=>classroomContext.snapshot(),prompt:cleanPrompt,basis:owner.handoutBasis,
          current:()=>!closing&&active.get(id)===owner&&!owner.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),
          owner:()=>({sessionId:id,taskId:owner.task!.id,runId,generation:owner.publisher!.owner.generation,requirementsVersion:owner.task!.requirementsVersion}),
        }),
      }:{}),
      equationTools:createEquationTools(()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      quantityTools:createQuantityTools(()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      solutionTools:createSolutionTools(()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      buoyancyTools:createBuoyancyTools(()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      ...(lessonRevisionTools?{lessonRevision:true as const}:{}),
      classroomTools:[...createClassroomTools({outlineOnly:Boolean(owner?.classroomPlan),context:()=>classroomContext.snapshot(),sessionId:id,runId,state:store.xiaozhiState.classrooms,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text)}),...createClassroomPlanTools({sessionId:id,runId,state:store.xiaozhiState.classroomPlans,binding:owner?.classroomPlan,naturalDraft:owner?.naturalLessonDraft,requiredSourcesRead:requiredLessonSourcesRead,revisionTools:lessonRevisionTools,context:()=>classroomContext.snapshot(),current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text)})],
      educationSearchTools:createEducationSearchTools(store,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped),
      studentContext:{studentId,tools:createStudentContextProvider(store,id,studentId,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped)},
      studentLearning:{studentId,tools:createLearningProvider(store,id,studentId,()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,(facts,delivered)=>{observedLearning=facts;observedMistakeLearning={facts,delivered};})},
      studentSimilar:{studentId,tools:createMistakeSimilarProvider({store,sessionId:id,studentId,current:()=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped,observed:()=>observedMistakeLearning,aliases:questionAliases})},
      studentLearningReview:{studentId,tools:learningReviews.tools(id,runId,()=>observedLearning)},
      ...(ledger&&!rebuild?{modelHistory:{authorize:manager=>coordinator.authorize(manager,id),
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
    const base=await sessionConfiguration(id,{...settings,apiKey:settings.apiKey},'ximodel_'+randomUUID(),capabilities,(await store.xiaozhiState.budgetSettings(id)).budget);
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
  async function execute(id: string, prompt: string, run: Active, settings: Awaited<ReturnType<typeof modelSettings.captureRun>>) {
    const executionStarted=performance.now();let preparationMs:number|undefined,sdkEndedMs:number|undefined;
    let failure: XiaozhiAgentError | undefined, text = '',answerTruncated=false;
    try {
      publicEvent(id,run,{kind:'activity',stage:'preparing',since:Date.now()});
      if (!settings.apiKey) throw new Error('authentication');
      const apiKey=settings.apiKey;
      if (run.stopped) throw new Error('cancelled');
      const preparing=<T>(action:(signal:AbortSignal)=>Promise<T>,label='host_preparation')=>waitForLifecycle('host_preparation',action,{signal:run.abort.signal,timeoutMs:options.lifecycleTimeoutMs??15000,label});
      const cleanPrompt = await preparing(async signal=>{const sanitize=await createStudentContextSanitizer(store);signal.throwIfAborted();return sanitize(prompt);},'host_sanitize_prompt');
      const selected=(await preparing(()=>store.getAiConversationSession(id),'host_read_session')).session.studentId;
      if(selected){try{await preparing(()=>store.studentContext.snapshot(selected));}catch(error){if(run.stopped)throw Error('cancelled');throw new Error('permission_denied');}}
      const preference=run.operation==='prompt'?await preparing(()=>store.xiaozhiState.teacherPreferences.observe(id,run.runId,()=>!closing&&!run.stopped&&active.get(id)===run))
        :{snapshot:await preparing(()=>store.xiaozhiState.teacherPreferences.snapshot()),action:'none',policy:null,eventRecorded:false};
      const lesson=run.classroomPlan?.mode==='outline'?run.classroomPlan.lesson:undefined;
      const presentation=run.operation==='prompt'
        ?teacherPreferenceForRequest(preference,cleanPrompt,Boolean(run.paperExportIntent||run.resumeDeliveryId),lesson&&[lesson.subject,lesson.grade].join(' '))
        :{text:'',applied:false};
      run.teacherPreferenceRevision=presentation.applied?preference.snapshot.revision:0;
      let decisionId:string|null=null;
      if(run.operation==='prompt'){
        try{decisionId=(await preparing(()=>decisions.capture({sessionId:id,runId:run.runId,goalId:run.goalId,preferenceRevision:preference.snapshot.revision,hasPreferences:presentation.applied,action:preference.action,trial:Boolean('trial'in preference&&preference.trial&&presentation.text)}))).id;}
        catch{decisions.unavailable(id);}
      }
      const capabilities = await preparing(signal=>resolveDeepSeekCapabilities(root, settings.model, apiKey, signal),'host_resolve_model');
      const { createPiXiaozhiSession } = await observeLifecycle('host_pi_import',()=>import('./pi-session'));
      if (run.stopped) throw new Error('cancelled');
      if(run.operation==='prompt'){run.computationScope=await preparing(()=>managedTools.freeze(),'host_freeze_computation');run.computationResults=createComputationResults({sessionId:id,runId:run.runId});}
      run.skillPrivateContext ||= createSkillPrivateContext();
      await preparing(()=>captureRetiredPrivateHistory(store.xiaozhiState.sql,root,id,run.skillPrivateContext!),'host_read_retired_history');
      if(run.recoveryInspection?.canRebuildSession)run.skillPrivateContext.unavailableHistory();
      const base=await preparing(()=>sessionConfiguration(id,{apiKey,model:settings.model,thinking:settings.thinking},run.runId,capabilities,run.usage.budget,cleanPrompt,run,prompt),'host_session_configuration');
      if(base.thinkingPolicy)await preparing(()=>store.xiaozhiState.modelSettings.saveThinkingRun(id,{...base.thinkingPolicy!,runId:run.runId,model:settings.model}));
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
      run.results=createRunResultReadback({runId:run.runId,canonicalize:base.fileReferences?.canonical,
        canResolveFailures:()=>!closing&&active.get(id)===run&&!run.stopped&&!!run.verification?.canResolveFailures(),
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
      let capabilityRuntime: ReturnType<typeof createCapabilityTaskRuntime> | undefined;
      const planningRuntime = run.task && run.publisher ? createTaskPlanningRuntime({sql: store.xiaozhiState.sql,
        publisher: run.publisher, taskId: run.task.id, current: () => !closing && active.get(id) === run && !run.stopped,
        tool: name => run.toolGovernance?.records.get(name),
        resolve: async requirement => {
          if (!capabilityRuntime) throw Error('configuration');
          return capabilityRuntime.preview({...requirement, localOnly: true, platform: process.platform,
            budget: {latencyMs: 30000, resourceUnits: 1}}, run.abort.signal);
        },
        permission: async (callId, tool, input) => {
          const authority = currentPermission();
          if (authority) {await authority.assert(); return authority.decision;}
          if (tool === 'write_stdin' && input && typeof input === 'object' && typeof (input as {job_id?: unknown}).job_id === 'string')
            return terminalService.permission(id, run.task!.id, (input as {job_id: string}).job_id, {...run.publisher!.owner, taskId: run.task!.id});
          const request = await permissions.forRun(id, run.runId).request(callId, tool, input);
          return request ? permissions.engine.evaluate(request) : null;
        },
        dependencies: async tool => {
          if (tool !== 'exec_command') return {state: 'ready', references: ['registered-domain:' + tool]};
          const runtime = await permissionRuntime.inspect();
          if (runtime.status === 'ready') return {state: 'ready', references: ['runtime:' + runtime.helperHash]};
          const authority = currentPermission();
          const recipe = permissionRuntime.recipe();
          const allowed = authority?.request.scopes.some(scope => scope.kind === 'dependency' && scope.sha256 === recipe.sha256);
          return {state: allowed ? 'ready' : 'unknown', references: ['recipe:' + recipe.sha256]};
        },
        workspace: () => host.resolveFileWorkspace(id),
      }) : undefined;
      const taskRuntime=run.task&&run.publisher?createTaskPlanRuntime({sql:store.xiaozhiState.sql,taskId:run.task.id,publisher:run.publisher,contextSanitizer:()=>createStudentContextSanitizer(store),
        planning: planningRuntime,boundMockExamBundleId:run.mockExamDeliveryResume?run.resumeDeliveryId:undefined,hasSourceSubtasks:taskSourceSubtasks(run.task).length>0,
        current:()=>!closing&&active.get(id)===run&&!run.stopped,sanitize:text=>sanitizeOfficeDocumentText(store,text),trustedMcpNames:new Set(base.mcpTools?.map(t=>t.name)),
        resources:createTaskResources({sessionId:id,resolveFile:base.fileReferences?.resolve,workspace:()=>host.resolveFileWorkspace(id),officeOutput:()=>resolvePaperOutput(id),studentId:async()=>(await store.getAiConversationSession(id)).session.studentId||'',attachment:async attachmentId=>(await store.xiaozhiState.attachments.get(id,attachmentId))?.state==='submitted'}),
        proofs:async()=>{const currentResults=run.results,currentRead=run.readResults;
          if((!currentResults||!currentRead)&&!taskSourceSubtasks(run.task!).length)return[];
          await run.publisher!.barrier();const proofs:import('../../shared/xiaozhi-verification').TaskVerification[]=[];
          const task=await tasks.committed(id);if(!task||task.id!==run.task!.id)throw Error('task_owner_stale');
          for(const previous of await tasks.admittedRuns(id,task.id)){if(previous.runId===run.runId)continue;try{proofs.push(await resumedResults!.run(previous.runId,task));}catch{run.abort.signal.throwIfAborted();if(closing||run.stopped||active.get(id)!==run)throw Error('cancelled');/* Missing old authority stays unverified; no tool or approval is replayed. */}}
          if(currentResults&&currentRead)proofs.push(await currentResults.check({...legacyVerification(run.runId),state:'needs_human',reason:'human_review',checkedAt:new Date().toISOString()},currentRead,run.abort.signal));
          return proofs;}}):undefined;
      if(taskRuntime&&run.task?.lastRunId===run.runId)await taskRuntime.refresh();
      if (run.task && run.publisher) run.dynamicCapabilities = createManagedMcpProviderRuntime({mcp, controlled: controlledMcp,
        registry: store.xiaozhiState.capabilities, permissions, store: store.xiaozhiState.permissions, state: acquisition.state,
        context: await acquisitionContext(id)});
      capabilityRuntime = run.task && run.publisher ? createCapabilityTaskRuntime({
        owner: run.publisher.owner,
        taskId: run.task.id,
        registry: store.xiaozhiState.capabilities,
        snapshots: store.xiaozhiState.capabilitySnapshots,
        native: host.capabilities,
        adapters: run.dynamicCapabilities,
        adapterRegistry: capabilityAdapters,
        current: () => !closing && active.get(id) === run && !run.stopped,
        canRefresh: async (capabilityId, scope) => run.agent?.canRefreshCapabilities() === true
          && !(await store.xiaozhiState.effects.forTask(id, run.task!.id)).some(effect =>
            (scope === 'provider_recovery' || effect.contract.capabilityId === capabilityId)
              && ['local_write', 'external_effect'].includes(effect.contract.effect)
              && ['intent', 'executing', 'unknown'].includes(effect.state)),
        workspace: () => host.resolveFileWorkspace(id),
        persist: action => run.publisher!.persist(() => action()),
      }) : undefined;
      const capabilityTools = capabilityRuntime ? createCapabilityDispatcher(capabilityRuntime) : undefined;
      const lifecycleWork = run.lifecycleWork ??= createLifecycleWorkTracker();
      run.agent = await createPiXiaozhiSession({ ...base,teacherPreferenceGuidance:presentation.text,taskRuntime,capabilityTools,trackLifecycleWork:lifecycleWork.track,
        ...(run.directOriginalPaper&&run.task?{directOriginalPaper:true,paperReceiptSummary:run.paperReceiptSummary}:{}),
        ...(run.answerOnly?{answerOnly:true,sourceAvailability:undefined,protectedContext:undefined}:{}),
        ...(run.task && run.publisher ? {toolGovernance: {register: async (definitions,signal) => {
          await startupPrewarm.wait();signal.throwIfAborted();
          const records = await registerSessionToolGovernance({definitions, registry: store.xiaozhiState.capabilities, mcp: name => mcp.describeTool(name),signal});
          signal.throwIfAborted();
          run.toolGovernance = createRunToolGovernance({owner: {...run.publisher!.owner, taskId: run.task!.id}, records,
            assertEffect: (callId, name, receipt) => store.xiaozhiState.eventJournal.assertToolEffect(run.publisher!.owner, callId, name, receipt),
            preflight: async (callId, name, input, enforce) => {
              if (!enforce && name==='office_deliver_files' && run.mockExamDeliveryResume && run.resumeDeliveryId)
                await deliveries.validateMockExamResumeInput(id,run.resumeDeliveryId,unwrapTaskArguments(input).input);
              return planningRuntime?.before(callId, name, input, enforce);
            },
            registry: store.xiaozhiState.capabilities, current: () => !closing && active.get(id) === run && !run.stopped,
            mcp: name => mcp.describeTool(name), task: async (callId, currentPlan = false) => {
              const state = createTaskState(store.xiaozhiState.sql, {sanitize: async text => text});
              const task = await state.get(run.task!.id);
              if (!task || task.binding?.runId !== run.runId || task.binding.generation !== run.publisher!.owner.generation) throw Error('permission_denied');
              const admitted = await state.admission(run.publisher!.owner, task.id, task.revision, callId);
              return {planRevision: currentPlan ? task.planRevision : admitted?.planRevision ?? task.planRevision, requirementsVersion: task.requirementsVersion,
                stepId: admitted?.stepId || null, target: admitted?.resource || null};
            }, snapshot: async record => {
              const existing = await store.xiaozhiState.capabilitySnapshots.current(run.publisher!.owner, run.task!.id, record.capabilityId);
              if (existing?.providerHash === record.providerHash && existing.selection.providerVersion === record.providerVersion) return existing;
              const catalog = await store.xiaozhiState.capabilities.snapshot();
              const version = await store.xiaozhiState.capabilities.providerVersion(record.providerId, record.providerVersion, record.capabilityId);
              if (!version || version.revoked) throw Error('capability_revoked');
              return run.publisher!.persist(owner => store.xiaozhiState.capabilitySnapshots.save(owner, run.task!.id, {
                capabilityId: record.capabilityId, registryRevision: catalog.revision,
                requirement: {capabilityId: record.capabilityId, contractVersion: '1.0.0', required: ['invoke'], optional: [], conditions: [],
                  localOnly: version.provider.locality === 'local', platform: process.platform, budget: {latencyMs: record.manifest.timeoutMs, resourceUnits: 1}},
                selection: {providerId: record.providerId, providerVersion: record.providerVersion, contractVersion: '1.0.0', level: 'full', missingRequirements: [], limitations: []},
                providerHash: record.providerHash, evidenceRefs: version.binding.conformance.evidence.map(item => item.reference),
                previousSnapshotId: existing?.snapshotId || null, refreshReason: existing ? 'explicit_refresh' : 'initial'}));
            }, persist: (callId, name, receipt, signal) => persistCurrentToolContract({signal: signal || run.abort.signal,
              current: () => !closing && active.get(id) === run && !run.stopped,
              enqueue: (current, write) => run.publisher!.persistIfCurrent(current, write),
              write: owner => store.xiaozhiState.eventJournal.recordToolContract(owner, callId, name, receipt)}),
            beginEffect: (callId, expected) => run.publisher!.persist(owner => store.xiaozhiState.eventJournal.beginToolEffect(owner, callId, expected)),
            bindExecution: (callId, execution) => run.publisher!.persist(owner => store.xiaozhiState.eventJournal.bindToolEffectExecution(owner, callId, execution))});
          if (run.legacyApprovalId) {
            const legacy = await store.xiaozhiState.getApproval(run.legacyApprovalId);
            if (!legacy || legacy.sessionId !== id || legacy.state !== 'approved') throw Error('permission_denied');
            await legacyBridge(legacy);
            signal.throwIfAborted();
          }
          return run.toolGovernance;
        }}} : {}),
        capabilityAcquisitionTools: run.task ? createCapabilityAcquisitionTools(acquisition, callId => acquisitionContext(id, callId),
          query => run.skillPrivateContext?.contains(query) === true) : undefined,
        extensionTools: run.task ? extensionHost.tools(id) : undefined,
        effectTools: run.task ? createEffectReadTools({sql:store.xiaozhiState.sql,networkDirectory:networkReceiptDirectory,
          current:callId=>acquisitionContext(id,callId,false)}) : undefined,
        persistentTerminalTools: run.task ? foreground => createPersistentTerminalTools({service: terminalService, sessionId: id,
          current: callId => acquisitionContext(id, callId)}, foreground) : undefined,
        onToolNonDispatch:async(callId,tool,input,signal)=>{signal.throwIfAborted();if(!run.publisher||run.stopped||active.get(id)!==run)throw Error('cancelled');await run.publisher.persist(owner=>{signal.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');return store.xiaozhiState.eventJournal.sealToolNonDispatch(owner,callId,tool,input);});signal.throwIfAborted();},
        beforeModelDelivery:options.beforeModelDelivery,lifecycleSignal:run.abort.signal,lifecycleTimeoutMs:options.lifecycleTimeoutMs,onCriticalToolFailure:error=>run.publisher?.fail(error||Error('event_persistence')),onToolAttempt:async(attempt,signal)=>{if(!run.publisher)throw Error('event_journal_unavailable');signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');publicEvent(id,run,{kind:'tool_attempt',attempt});await run.publisher.barrier();signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');},beforeDelivery:async(delivery,signal)=>{
        if(!run.publisher)throw Error('event_journal_unavailable');
        signal?.throwIfAborted();await run.publisher.barrier();signal?.throwIfAborted();
        if(run.stopped||active.get(id)!==run)throw Error('cancelled');
        if(delivery.kind==='tool'){
          if(run.answerOnly)throw Error('permission_denied');
          if(delivery.tool===PAPER_TOOLS[0]){
            if(!taskRuntime||!run.task)throw new TaskAdmissionError('task_owner_stale');
            await taskRuntime.refresh();
            await paperReviews.admitProposal({sessionId:id,runId:run.runId,commandId:run.commandId,generation:run.publisher.owner.generation,callId:delivery.callId,taskId:run.task.id,requirementsVersion:run.task.requirementsVersion},delivery.input,signal);
          }else if(delivery.tool===TEACHING_HANDOUT_TOOL){
            if(!taskRuntime||!base.teachingHandoutTool)throw new TaskAdmissionError('task_owner_stale');
            await taskRuntime.refresh();
          }else if(delivery.tool===PROPOSE_HANDOUT_EDIT){
            if(!taskRuntime||!base.handoutEditTools)throw new TaskAdmissionError('task_owner_stale');
            await taskRuntime.refresh();
          }else if(delivery.tool===BUILD_MOCK_EXAM_CATALOG){
            if(!taskRuntime||!base.mockExamTool)throw new TaskAdmissionError('task_owner_stale');
            try{resolveMockExamScope(cleanPrompt,unwrapTaskArguments(delivery.input).input);}
            catch(error){throw new TaskAdmissionError('task_mock_exam_'+(error instanceof Error?error.message:'invalid_input'));}
            await taskRuntime.refresh();
          }else if(delivery.tool===PROPOSE_MOCK_EXAM_EDIT){
            if(!taskRuntime||!base.mockExamEditTools)throw new TaskAdmissionError('task_owner_stale');
            await taskRuntime.refresh();
          }else {
            if(delivery.tool===EXPORT_TEACHING_HANDOUT){
              if(!taskRuntime||!base.handoutExportTools)throw new TaskAdmissionError('task_owner_stale');
              // Reject an invalid audience before the task records a document write attempt.
              try{assertTeachingHandoutExportProposal(cleanPrompt,unwrapTaskArguments(delivery.input).input);}
              catch(error){throw new TaskAdmissionError('task_handout_'+(error instanceof Error?error.message:'invalid_input'));}
            }
            await admitClassroomOrTaskTool({sessionId:id,runId:run.runId,intent:run.classroomPlan,naturalDraft:Boolean(run.naturalLessonDraft),lessonRevision:Boolean(run.lessonRevision),plans:store.xiaozhiState.classroomPlans,current:()=>!closing&&!run.stopped&&active.get(id)===run,signal,task:taskRuntime},delivery.callId,delivery.tool,delivery.input);
          }
          await run.publisher.persist(owner=>{signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');return store.xiaozhiState.eventJournal.admitTool(owner,delivery.callId,delivery.tool);});
          await run.toolGovernance?.before(delivery.callId, delivery.tool, delivery.input, signal || run.abort.signal);
        }
        signal?.throwIfAborted();if(run.stopped||active.get(id)!==run)throw Error('cancelled');
      }, onHistoricalToolResult: (tool, result) => {
          if (!closing && !run.stopped && active.get(id) === run) {
            run.skillPrivateContext ||= createSkillPrivateContext();
            captureSkillPrivateContext(run.skillPrivateContext, tool, result);
          }
      },onToolResult:(callId,tool,result,failed)=>{
          if (!failed && !closing && !run.stopped && active.get(id) === run) {
            run.skillPrivateContext ||= createSkillPrivateContext();
            captureSkillPrivateContext(run.skillPrivateContext, tool, result);
          }
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
      if(run.recoveryInspection?.canRebuildSession)await preparing(()=>persistNativeSessionReplacement(run.agent!.session.sessionManager,root));
      const tail=captureNativeTail(run.agent.sessionFile,root),owner=run.publisher.owner;
      const markerId=run.agent.session.sessionManager.appendCustomEntry('xiaozhi.event-owner.v1',{schemaVersion:1,...owner});
      if(run.recoveryInspection?.canRebuildSession){
        const checked=await inspectTaskRecovery({sql:store.xiaozhiState.sql,nativeRoot:root,sessionId:id,taskId:run.task!.id});
        if(checked.native.state!==run.recoveryInspection.native.state||checked.native.digest!==run.recoveryInspection.native.digest)throw Error('source_changed');
        const changes=run.agent.session.sessionManager.getEntries().filter(entry=>entry.type==='model_change');
        if(!changes.length||changes.some(entry=>entry.provider!=='xiaozhi_deepseek'||entry.modelId!==settings.model))throw Error('configuration');
        await run.publisher.persist(current=>store.xiaozhiState.eventJournal.bindNative(current,{...tail,...owner,markerId},async work=>{
          await commitNativeSessionRebuild({...work,transaction:action=>action(work)},{owner:current,taskId:run.task!.id,
            inspection:run.recoveryInspection!,expectedFile:run.rebuildFile!,replacement:{file:path.relative(root,run.agent!.sessionFile!),
              nativeSessionId:run.agent!.session.sessionManager.getSessionId(),model:settings.model,baseline:changes.map(entry=>entry.id)}});
        }));
        const refreshedPrivateContext=createSkillPrivateContext();
        try{await preparing(()=>captureRetiredPrivateHistory(store.xiaozhiState.sql,root,id,refreshedPrivateContext));}
        catch(error){refreshedPrivateContext.clear();throw error;}
        run.skillPrivateContext?.clear();run.skillPrivateContext=refreshedPrivateContext;
        if(await store.xiaozhiState.modelSwitch.current(id))await modelCoordinator(id,run).authorize(run.agent.session.sessionManager,id);
      }else await run.publisher.persist(current=>store.xiaozhiState.eventJournal.bindNative(current,{...tail,...owner,markerId}));
      run.readResults=bindNativeResultReadback(run.agent.sessionFile,root);
      // Fence legacy version-1 readers before any model/tool memory delivery.
      await store.xiaozhiState.setBinding(id, path.relative(root, run.agent.sessionFile), settings.model, 4);
      if (run.stopped) throw new Error('cancelled');
      const {source,revision,status}=settings.modelObservation;
      const receipt:PreparedAgentConfig={schemaVersion:1,operation:run.operation,model:{source,revision,status},thinking:base.thinkingBaseline,
        teacher:{observedRevision:preference.snapshot.revision,policyRevision:preference.policy?.revision??null,longTermApplied:presentation.applied,
          eventRecorded:preference.eventRecorded,decisionId},native:{generation:owner.generation,markerId}};
      const publisher=run.publisher;
      await preparing(async signal=>{
        const current=()=>!signal.aborted&&!closing&&!run.stopped&&active.get(id)===run;
        let writeError:unknown;
        const attempted=await publisher.persistIfCurrent(current,async bound=>{
          try{await savePreparedAgentConfig(store.xiaozhiState.sql,{runId:bound.runId,sessionId:bound.sessionId,receipt},
            ()=>{if(!current())throw Error('cancelled');});}
          catch(error){writeError=error;}
        });
        if(!attempted || !current())throw Error('cancelled');
        if(writeError)throw Error('configuration',{cause:writeError});
      },'host_persist_prepared_configuration');
      const count=run.turn.items[0]?.attachments?.length||0;
      let deliveredPrompt=count?`${cleanPrompt}\n\n本轮有 ${count} 个已登记的本地附件。文件正文和图片尚未提供给你，请勿声称已阅读、查看或分析这些附件；需要读取时说明所需操作。`:cleanPrompt;
      if(run.recoveryInspection){
        const recovery='\n原Task的SQLite恢复事实如下。只读核对已有成果、Effect、Job与旧Provider版本；unknown必须核对，不能重复发出写入、网络请求或stdin。审批pending继续等待原卡，rejected同摘要不再请求；可使用已有Grant、兼容Provider或其它可完成步骤。能力需刷新时先显式capability_resolve并遵守安全点。需要完整目标用read_teacher_request。旧业务事实仍由SQLite与文件读回确认。'+(run.recoveryInspection.canRebuildSession?'本次明确恢复已重建Pi Session。':'本次保留已核对的原Pi Session。')+'\n'+JSON.stringify(run.recoveryInspection);
        run.skillPrivateContext ||= createSkillPrivateContext();run.skillPrivateContext.capture(recovery);
        deliveredPrompt+=recovery;
      }
      preparationMs=performance.now()-executionStarted;
      const result = await observeLifecycle('host_prompt',()=>run.operation === 'compact' ? run.agent!.compact() : run.agent!.prompt(deliveredPrompt));
      sdkEndedMs=performance.now()-executionStarted;
      if(result.ok&&taskRuntime&&!run.stopped)await taskRuntime.refresh();
      if (run.operation === 'compact' && result.ok) await options.afterCompactCommit?.();
      if (result.ok) {
        if((run.naturalLessonDraft||run.lessonRevision) && !await store.xiaozhiState.classroomPlans.hasDraftedLesson(id,run.runId))
          failure=run.lessonRevision?'lesson_revision_missing':'lesson_draft_missing';
        else if(run.handoutBasis&&!await store.xiaozhiState.teachingHandouts.hasDraft(id,run.runId))
          failure='handout_basis_unread';
        else {text = result.text;answerTruncated=result.truncated;}
      } else failure = result.error;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      failure = code === 'authentication' || code === 'cancelled' || code === 'permission_denied' || code === 'memory_scope_changed' || code === 'skill_source_changed' || code === 'skill_scope_changed' ? code : 'configuration';
    } finally {
      run.finalizing=true;
      run.computationScope?.release();
      await run.agent?.dispose().catch(() => { failure ||= 'configuration'; });
      await run.dynamicCapabilities?.dispose().catch(() => {failure ||= 'configuration';});
      delete run.dynamicCapabilities;
      delete run.toolGovernance;
      run.skillPrivateContext?.clear();
      delete run.skillPrivateContext;
      run.computationResults?.clear();
      if(run.classroomPlan?.mode==='generate')await store.xiaozhiState.classroomPlans.finishRun(run.runId).catch(()=>{failure||='configuration';});
      await controls.finish(id,run.runId,run.abort.signal.reason==='app_shutdown').catch(() => { failure ||= 'configuration'; });
      if(run.hasToolEvents){
      await approvals.cancel(run.runId, closing).catch(() => { failure ||= 'configuration'; });
      await textChanges.cancel(run.runId).catch(() => { failure ||= 'configuration'; });
      await officeArtifacts.cancel(run.runId).catch(()=>{failure||='configuration';});
      await handoutEdits.cancel(run.runId).catch(()=>{failure||='configuration';});
      await deliveries.cancel(run.runId).catch(()=>{failure||='configuration';});
      await store.xiaozhiState.approvals(id).then(async rows => {
        for (const row of rows) if (row.runId === run.runId && row.state === 'executing') await store.xiaozhiState.transition(row.id, ['executing'], 'uncertain');
      }).catch(() => { failure ||= 'configuration'; });
      }
      if (run.stopped) failure = 'cancelled';
      await run.usageWrites.catch(()=>{failure ||= 'configuration';});
      let deliveryText: string | undefined, fileFinal: DeliveryFinal | undefined;
      try {
        if(run.hasToolEvents)fileFinal=await deliveryFinal({sessionId:id,runId:run.runId,callOrder:run.turn.items.filter(item=>item.kind==='tool').map(item=>item.id),observed:run.officePresentation?.hasArtifacts===true,unchangedEdits:run.officePresentation?.unchangedEdits,
          failedFileCalls:run.turn.items.filter(item=>item.kind==='tool'&&item.status==='failed'&&isFileDeliveryTool(item.toolName||'')).map(item=>({callId:item.id,code:item.toolAttempt?.code,effect:item.toolAttempt?.effect||'unknown'})),
          failure:failure==='cancelled'?'stopped':failure?'failed':undefined,ports:{
          changes:()=>store.xiaozhiState.changes.list(id,run.runId),office:()=>store.xiaozhiState.officeArtifacts.list(id,run.runId),bundles:()=>store.xiaozhiState.deliveries.list(id,run.runId),
          text:changeId=>store.xiaozhiState.changes.get(changeId),artifact:artifactId=>store.xiaozhiState.officeArtifacts.get(artifactId),inspections:()=>fileChecks.forRun(id,run.runId),
          ...(run.turn.items.some(item=>item.kind==='tool'&&item.toolName==='office_copy_file')?{copyRejections:async()=>{
            const approvals=await store.xiaozhiState.permissions.approvalSnapshot(id);
            const decisions=rejectedCopyDecisions(approvals.items,id,run.runId);
            const singleTaskDeclined=decisions.length===1&&singleCopyWasDeclined(await tasks.committed(id),run.runId,approvals.items);
            return {decisions,singleTaskDeclined};
          }}:{})}});
        deliveryText=fileFinal?.text;
      } catch { failure ||= 'configuration'; }
      if (deliveryText) text=deliveryText;
      await run.publisher?.flush().catch(()=>{failure='event_persistence';});
      if(run.hasToolEvents&&run.publisher&&!run.publisher.failed){try{const recovery=await run.publisher.persist(owner=>store.xiaozhiState.eventJournal.reconcile(owner));if(recovery.receipts.length){publicEvent(id,run,{kind:'recovery',recovery});await run.publisher.flush();}}catch{failure='event_persistence';}}
      if(run.publisher?.failed){
        const journalFailure=journalFailures.get(id);
        failure=(journalFailure?.runId===run.runId&&journalFailure.error)||'event_persistence';
      }
      if(run.hasToolEvents&&failure)await store.xiaozhiState.mockExamEdits.interrupt(run.runId).catch(()=>undefined);
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
        const currentTask=run.task?await tasks.committed(id):null;
        run.verification ??= createRunVerification(run.runId);
        finalTurn.verification=run.verification.finish({failed:Boolean(failure),stopped:run.stopped,
          teacherCriteria:taskGoal?.sessionId===id&&taskGoal.runId===run.runId?taskGoal.criteria
            :currentTask&&currentTask.id===run.task?.id?currentTask.criteria.filter(criterion=>criterion.kind==='human').map(criterion=>criterion.text):undefined});
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
        if (run.publisher && run.task) await terminalService.releaseRun({...run.publisher.owner, taskId: run.task.id});
        if(run.operation==='prompt'&&run.task&&run.publisher&&!run.publisher.failed){const task=await tasks.finish(run.task,run.publisher,Boolean(failure),failure==='cancelled'?run.taskControl:undefined);finalTurn.task=task;}
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
  const artifactReferences=createArtifactReferences({state:store.xiaozhiState,dataRoot:options.dataRoot,closing:()=>closing,
    resolve:(sessionId,artifactId):Promise<ResolvedArtifactFile>=>host.resolveArtifactFile(sessionId,artifactId)});
  const host = {
    prewarm:()=>{if(enabled&&!closing)startupPrewarm.schedule();},
    permissions,
    terminal: terminalService.api,
    acquisitionView,
    async extensionImport(id: string, directory: string) {
      await acquisitionView(id);
      await extensionHost.importCandidate(directory);
      return acquisitionView(id);
    },
    async acquisitionSearch(raw: AcquisitionSearch) {
      const input = acquisitionSearchInput(raw); if (!input) throw Error('invalid_input');
      await acquisitionView(input.sessionId);
      if (active.get(input.sessionId)?.skillPrivateContext?.contains(input.query)) throw Error('permission_denied');
      await acquisition.search(input.query, input.sources, AbortSignal.timeout(60000));
      return acquisitionView(input.sessionId);
    },
    async acquisitionMutate(raw: AcquisitionMutation) {
      const input = acquisitionMutationInput(raw); if (!input) throw Error('invalid_input');
      await acquisitionView(input.sessionId);
      if (input.action === 'prepare') {
        if (!active.get(input.sessionId)?.task) throw Error('task_required');
        await acquisition.prepare(await acquisitionContext(input.sessionId), input.candidateId);
      } else if (input.action === 'cancel') await acquisition.cancel(input.sessionId, input.operationId, input.revision);
      else if (input.action === 'revoke') await acquisition.revoke(input.artifactId, input.revision);
      else if (input.action === 'extension_import') throw Error('invalid_input');
      else await extensionHost.mutate(input);
      return acquisitionView(input.sessionId);
    },
    environment,
    /** Main-only Phase 1 pilot. Existing named Pi tools retain their entry points. */
    capabilities:createNativeStatService({registry:store.xiaozhiState.capabilities,
      artifactRoot:path.join(options.dataRoot,'capability-artifacts'),
      resolveWorkspace:(id):Promise<import('./workspace-files').WorkspaceLease>=>host.resolveFileWorkspace(id),
      isCurrent:(id,runId)=>!closing&&active.get(id)?.runId===runId&&!active.get(id)?.stopped}),
    ...createPaperBasketApi(store.paperBaskets, sessionId => {
      const owner = active.get(sessionId);
      const generation = learningDecisionGeneration.get(sessionId) || 0;
      return () => !closing && !conversationStarting(sessionId) && active.get(sessionId)===owner
        && (!owner || paperReviews.waiting(sessionId,owner.runId))
        && generation === (learningDecisionGeneration.get(sessionId) || 0);
    }, store.paperBasketsV2,paperReviews.changed),
    deliveryChecks:fileChecks,
    handoutEdits:{view:handoutEdits.view,decide:handoutEdits.decide},
    mockExam:{view:mockExam.view,answerReview:mockExam.answerReview,history:mockExam.history,restore:mockExam.restore,confirm:mockExam.confirm,original:mockExam.original},
    mockExamArchive,
    mockExamEdits:{view:mockExamEdits.view,decide:mockExamEdits.decide},
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
      const execution = executions.get(runId);
      if (execution?.sessionId === id) await execution.done;
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
    async resumeLegacyApproval(raw: {sessionId: string; approvalId: string}): Promise<XiaozhiStartResult> {
      if (!raw || Object.keys(raw).sort().join(',') !== 'approvalId,sessionId' || !validId(raw.sessionId)
          || !/^confirm_[a-f0-9-]{36}$/iu.test(raw.approvalId)) return {ok: false, error: 'invalid_input'};
      try {
        const row = await store.xiaozhiState.getApproval(raw.approvalId);
        if (!row || row.sessionId !== raw.sessionId || row.state !== 'approved') throw Error('permission_denied');
        await legacyRequests.validate(row);
        const binding = await createTaskState(store.xiaozhiState.sql, {sanitize: async text => text}).ownerForRun(row.sessionId, row.runId);
        return host.start({sessionId: row.sessionId, commandId: 'xicmd_' + randomUUID(),
          prompt: '继续已批准的文件复制。来源 ' + JSON.stringify(row.source) + '，目标 ' + JSON.stringify(row.target)
            + '，来源SHA256 ' + row.sourceSha256 + '。先核对当前来源，仅执行这一项，保留历史审批与原Task关联。',
          ...(binding ? {continueTask: {taskId: binding.taskId, requirementsVersion: binding.requirementsVersion}} : {})
        }, 'prompt', undefined, undefined, row.id);
      } catch {return {ok: false, error: 'permission_denied'};}
    },
    reviewTask:tasks.review,
    correctTask:tasks.correct,
    async controlTask(raw:unknown):Promise<TaskApiResult<TaskView>>{
      if(!validTaskControl(raw))return{ok:false,error:'invalid_input'};
      if(!('owner' in raw))return tasks.cancelInactive(raw);
      const run=active.get(raw.sessionId),task=run?.task,owner=run?.publisher?.owner;
      if(!task||task.goal||task.id!==raw.taskId||task.requirementsVersion!==raw.requirementsVersion||owner?.runId!==raw.owner.runId||owner.generation!==raw.owner.generation)return{ok:false,error:'changed'};
      if(!run?.done||run.stopped||run.finalizing||closing)return{ok:false,error:'busy'};
      run.taskControl=raw.action;
      try{
        if(!(await host.stop(raw.sessionId)).ok)return{ok:false,error:'unavailable'};
        await waitForLifecycle('task_control_checkpoint',()=>run.done!,{timeoutMs:options.shutdownTimeoutMs??5000});
        const saved=await tasks.committed(raw.sessionId);
        if(saved?.id===raw.taskId&&saved.state===taskControlState(raw.action))return{ok:true,value:saved};
      }catch{/* The task card can re-read the committed state after an uncertain response. */}
      return{ok:false,error:'unavailable'};
    },
    async resumeTask(raw:unknown):Promise<XiaozhiStartResult>{
      if(!validTaskResume(raw))return{ok:false,error:'invalid_input'};
      return host.start({sessionId:raw.sessionId,commandId:raw.commandId,prompt:'继续先前任务中尚未完成的步骤；先核对已有来源与保存结果，不重复已有的写入。'},'prompt',undefined,raw);
    },
    async resolveFileWorkspace(id:string, requireReadGrant = true) {
      if(!validId(id))throw new Error('invalid_input');
      if(closing || choosing.has(id))throw new Error('busy');
      const detail=await store.getAiConversationSession(id);
      if(detail.session.archivedAt)throw new Error('permission_denied');
      const storedWorkspace=await store.xiaozhiState.workspace(id);
      const grant=storedWorkspace||conversationOutput(options.dataRoot,id);
      if(closing||choosing.has(id))throw new Error('busy');
      if((await store.getAiConversationSession(id)).session.archivedAt)throw new Error('permission_denied');
      if(closing||choosing.has(id))throw new Error('busy');
      const directory=authorizedWorkspace(grant.path,options.dataRoot),stat=fs.statSync(directory);
      await permissions.ensureWorkspace(id, directory, Boolean(storedWorkspace));
      if (requireReadGrant) await permissions.assertWorkspaceRead(id, directory);
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
        if(failure.run.lifecycleWork?.isPending())return{ok:false,error:'busy'};
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
    enabled, snapshot,
    async decide(input: import('../../shared/xiaozhi-agent').XiaozhiDecisionInput): Promise<XiaozhiActionResult> {
      try {
        const item = await store.xiaozhiState.permissions.approval(input.sessionId, input.approvalId);
        if (!item) return approvals.decide(input);
        return {ok: false, error: 'invalid_input'};
      } catch { return {ok: false, error: 'permission_denied'}; }
    },
    answer:controls.answer,
    reviewTextChange: textChanges.review,
    reviewOfficeArtifact:officeArtifacts.review,
    async resolveArtifactFile(sessionId:string, artifactId:string):Promise<ResolvedArtifactFile>{
      if(closing||choosing.has(sessionId))throw Error('busy');
      await authorizePaperConversation(sessionId);
      const row=await store.xiaozhiState.officeArtifacts.byArtifact(sessionId,artifactId);
      if(row&&isPaperOfficeDraft(row.draft)) {
        return savedArtifactPreview.resolveFile({sessionId,artifactId,requestId:'xifile_'+randomUUID()});
      }
      if(row||artifactId.startsWith('xichange_')){
        let file:ResolvedArtifactFile|undefined;
        const result=await host.officeVersion({schemaVersion:OFFICE_VERSIONS_SCHEMA,sessionId,artifactId,action:'open'},
          async (path,_action,version)=>{file={path,version};},true);
        if(!result.ok)throw Error(result.error==='missing'?'not_found':result.error);
        if(!file||result.value.currentArtifactId!==artifactId||result.value.integrity!=='same')throw Error('changed');
        await authorizePaperConversation(sessionId);
        return file;
      }
      return verifyCatalogArtifactFile(sessionId,()=>store.getDocumentArtifact(artifactId),async()=>{
        if(closing||choosing.has(sessionId))throw Error('busy');
        await authorizePaperConversation(sessionId);
      });
    },
    previewSavedArtifact:savedArtifactPreview.preview,
    cancelSavedArtifactPreview:savedArtifactPreview.cancel,
    artifactCheck:createArtifactCheck({changes:store.xiaozhiState.changes,office:store.xiaozhiState.officeArtifacts,inspections:store.xiaozhiState.inspections,checks:fileChecks,authorize:authorizePaperConversation,workspace:(id):Promise<import('./workspace-files').WorkspaceLease>=>host.resolveFileWorkspace(id)}),
    artifactSources:(input:unknown)=>createArtifactSources({changes:store.xiaozhiState.changes,office:store.xiaozhiState.officeArtifacts,journal:store.xiaozhiState.eventJournal,
      authorize:authorizePaperConversation,workspace:id=>host.resolveFileWorkspace(id),paper:(id,paperId)=>store.papers.review(id,paperId),current:()=>!closing,
      producer:async(id,recordId,runId,callId)=>{const bundle=await store.xiaozhiState.deliveries.owner(id,recordId);return bundle&&bundle.runId===runId&&bundle.files.some(file=>file.draftId===recordId&&file.runId===runId&&file.callId===callId)?bundle.callId:callId;}
    }).read(input),
    async officeVersion(input:OfficeVersionInput,useFile?:(file:string,action:'open'|'locate',version:string)=>Promise<void>,currentOnly=false):Promise<OfficeVersionResult>{
      const versions=typeof input?.artifactId==='string'&&input.artifactId.startsWith('xichange_')
        ?createTextVersions({state:store.xiaozhiState.changes,dataRoot:options.dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,afterStage:options.afterTextChangeStage})
        :createOfficeVersions({state:store.xiaozhiState.officeArtifacts,dataRoot:options.dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,afterStage:options.afterOfficeArtifactStage});
      if(input?.action==='view')return versions.execute(input,()=>{if(closing)throw Error('busy');});
      try{return await host.withLocalSettingsJob(assertCurrent=>versions.execute(input,assertCurrent,useFile,currentOnly));}catch{return {ok:false,error:'busy'};}
    },
    async reviseOfficeArtifact(input:Parameters<typeof officeArtifacts.revise>[0]){
      return await store.xiaozhiState.deliveries.owner(input?.sessionId,input?.draftId)?deliveries.revise(input):officeArtifacts.revise(input);
    },
    deliveryCatalog:createDeliveryCatalog({state:store.xiaozhiState.deliveries,coordinator:deliveries,authorize:authorizePaperConversation,running:id=>active.has(id)}),
    decideDelivery:deliveries.decide,
    async decideOfficeArtifact(input:OfficeArtifactDecision):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
      if(input?.action!=='verify'&&await store.xiaozhiState.deliveries.owner(input?.sessionId,input?.draftId))return {ok:false,error:'permission_denied'};
      if(input?.action!=='verify')return officeArtifacts.decide(input);
      try{return await host.withLocalSettingsJob(async assertCurrent=>{assertCurrent();return officeArtifacts.decide(input,assertCurrent);});}catch{return {ok:false,error:'busy'};}
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
    modelSettingsView: async(query?:{refresh?:boolean;sessionId?:string})=>{
      if(query?.sessionId)await recoverModel(query.sessionId);
      return {...await modelSettings.view(query),ordinaryLocked:ordinaryBusy()};
    },
    ordinaryConfigCommit:(input:OrdinaryCommit)=>trackModelWrite(()=>writeOrdinary(input)),
    ordinaryConfigUndo:(input:OrdinaryUndo)=>trackModelWrite(()=>writeOrdinary(input)),
    ordinaryConfigHistory:(input:OrdinaryQuery)=>ordinaryConfig.history(input),
    async stageOrdinaryCredential(input:XiaozhiCredentialInput){
      if(settingsBusy())throw Error('busy');
      return ordinaryConfig.stageCredential(input);
    },
    mcpCatalog: () => mcp.catalog(),
    decisionHistory: (id: string) => decisions.list(id),
    decisionReplay: (input: DecisionInput) => decisions.replay(input),
    decisionShadow: (input: DecisionInput) => mutateSettings(()=>decisions.shadow(input)),
    decisionRouteShadow:(input:DecisionInput)=>mutateSettings(()=>decisions.shadowRoute(input)),
    candidateHistory:(id:string)=>candidates.list(id),
    candidateEvaluate:(input:TeacherCandidateInput)=>mutateSettings(()=>candidates.evaluate(input)),
    candidateReject:(input:TeacherCandidateInput)=>mutateSettings(()=>candidates.reject(input)),
    teacherMemorySettings:()=>store.xiaozhiState.teacherMemorySettings.read(),
    saveTeacherMemorySettings:(input:unknown)=>mutateSettings(()=>store.xiaozhiState.teacherMemorySettings.save(input)),
    mcpAdd: (input: XiaozhiMcpAddInput) => mutateSettings(() => mcp.add(input)),
    mcpInspect: (input: XiaozhiMcpInput) => mutateSettings(() => mcp.inspect(input)),
    mcpTrust: (input: XiaozhiMcpTrustInput) => mutateSettings(() => mcp.trust(input)),
    mcpCredential: (input: XiaozhiMcpCredentialInput) => mutateSettings(() => mcp.credential(input)),
    async mcpRevoke(input: XiaozhiMcpInput) {
      if (closing) throw Error('busy');
      const result = await mcp.revoke(input);
      for (const grant of await store.xiaozhiState.permissions.grantsForServer(input.serverId)) {
        await permissions.engine.revoke(grant.sessionId, grant.grantId, grant.revision);
      }
      permissions.engine.cancelServer(input.serverId);
      return result;
    },
    mcpRemove: (input: XiaozhiMcpInput) => mutateSettings(() => mcp.remove(input)),
    async queryProviderBalance(){
      if(closing)throw new Error('busy');const controller=new AbortController();balanceQueries.add(controller);
      try{return await modelSettings.balance(controller.signal);}finally{balanceQueries.delete(controller);}
    },
    async saveWebSettings(input:XiaozhiWebInput) { return mutateSettings(()=>store.xiaozhiState.modelSettings.saveWeb(input,()=>{if(closing||!configuring.has('provider'))throw new Error('busy');})); },
    async saveThinkingSettings(input:import('../../shared/xiaozhi-thinking').ThinkingInput){
      assertOrdinary();
      const query=input.sessionId?{sessionId:input.sessionId}:undefined;
      const fallback=await modelSettings.view(query,false);
      const receipt=await host.ordinaryConfigCommit({
        operationId:randomUUID(),field:input.sessionId?'session_thinking':'global_thinking',
        sessionId:input.sessionId,expectedVersion:input.version,value:input.choice,
      });
      const setting={version:receipt.version,choice:input.choice};
      const thinking=fallback.thinking?{...fallback.thinking,...(input.sessionId?{session:setting}:{global:setting})}:undefined;
      return {...await modelSettings.committedView({...fallback,thinking},false,input.sessionId),locked:settingsBusy(),ordinaryLocked:ordinaryBusy()};
    },
    async verifyModelCredential(input:XiaozhiCredentialInput) {return mutateSettings(()=>modelSettings.verify(input));},
    async saveModelSettings(input: XiaozhiSettingsInput) {
      const result=await mutateSettings(()=>trackModelWrite(async()=>{
        const fallback=await modelSettings.view(undefined,false);
        const staged=input.apiKey?ordinaryConfig.stageCredential({schemaVersion:input.schemaVersion,apiKey:input.apiKey}):undefined;
        const receipt=await ordinaryConfig.apply({operationId:randomUUID(),field:'default_model',
          expectedVersion:input.version,value:input.defaultModel,...staged},assertCredential);
        return modelSettings.committedView({...fallback,version:receipt.version,
          defaultModel:input.defaultModel??fallback.defaultModel,defaultModelOverride:input.defaultModel},Boolean(staged));
      }));
      return {...result,locked:settingsBusy(),ordinaryLocked:ordinaryBusy()};
    },
    async selectSessionModel(input: XiaozhiSessionModelInput) {
      await recoverModel(input.sessionId);
      const value = await mutateSettings(() => modelSettings.select(input));
      return { ...value, locked: value.locked || settingsBusy() };
    },
    managedTools,
    memoryCatalog: memory.catalog, memoryTrace: memory.trace,
    // Main-only pointers; management IPC returns an explicit public projection.
    skillGovernanceView: async () => { await skillsReady; return skillGovernance.view(); },
    skillGovernanceMutate: (input: SkillGovernanceMutation) => manageSkill(async () => {
      await skillsReady;
      if (input.action === 'create') { await skillGovernance.publish(input.draft); await skillGovernance.activatePending(); }
      else if (input.action === 'activate') await skillGovernance.activate(input.skillId, input.version, input.revision);
      else if (input.action === 'withdraw') await skillGovernance.withdraw(input.skillId, input.version, input.revision);
      else if (input.action === 'share') await skillTeams.submit(input.skillId, input.version, input.revision);
      else if (input.action === 'official_submit') await skillTeams.submit(input.skillId, input.version, input.revision, input.metadata);
      else if (input.action === 'team_create') await skillTeams.create(input.name);
      else if (input.action === 'team_add') await skillTeams.add(input.userId, input.role, input.revision);
      else if (input.action === 'team_leave') await skillTeams.leave(input.revision);
      else if (input.action === 'team_edit') await skillTeams.edit(input.skillId, input.revision, input.draft);
      else await skillTeams.decide(input.reviewId, input.revision, input.approve);
      return skillGovernance.view();
    }),
    skillCatalog: async () => { await skillsReady; return governedLegacySkills.catalog(); },
    skillPreview: async (name: string) => { await skillsReady; return governedLegacySkills.preview(name); },
    skillManagementBusy: () => Boolean(closing || skillsMutating || active.size || starting.size || choosing.size || configuring.size),
    setSkillEnabled: (name: string, revision: number, enabled: boolean) => manageSkill(() => governedLegacySkills.setEnabled(name, revision, enabled)),
    editSkill: (name: string, revision: number, document: string) => manageSkill(() => governedLegacySkills.edit(name, revision, document)),
    archiveSkill: (name: string, revision: number) => manageSkill(() => governedLegacySkills.archive(name, revision)),
    importSkill: (revision: number, choose: () => Promise<string | undefined>) => manageSkill(async () => {
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('invalid_input');
      if ((await managedSkills.catalog()).revision !== revision) throw new Error('stale_version');
      const directory = await choose();
      if (closing) throw new Error('busy');
      return directory ? governedLegacySkills.importDirectory(directory, revision) : null;
    }),
    historyMemory: historyOperations(history,async sourceId=>{
      for (const [sessionId,run] of active) {
        const scope = await store.xiaozhiState.memoryScope(sessionId);
        if (scope.enabled && scope.selections.some(item=>item.layer==='history'&&item.id===sourceId)) {
          await host.stop(sessionId);
          await run.done;
        }
      }
    }),
    async confirmHistoryMemory(id:string,version:number,ticket:string):Promise<XiaozhiActionResult> {
      const selected=history.candidate(id,version,ticket);
      if(!selected)return {ok:false,error:'command_conflict'};
      const current=await store.xiaozhiState.memoryScope(id);
      if(current.version!==version||current.selections.length>=12)return {ok:false,error:'command_conflict'};
      return host.setMemoryScope({sessionId:id,version,enabled:true,
        selections:[...current.selections.map(({fingerprint:_private,...item})=>item),selected]},ticket);
    },
    async setMemoryScope(input: XiaozhiMemoryScopeInput, ticket?:string): Promise<XiaozhiActionResult> {
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
        if(input.selections.some(item=>item.layer==='history')){
          const saved=await store.xiaozhiState.memoryScope(id);
          const selected=ticket?history.candidate(id,input.version,ticket):undefined;
          for(const item of input.selections)if(item.layer==='history'&&
            !saved.selections.some(row=>row.layer==='history'&&row.id===item.id&&row.version===item.version&&row.sourceVersion===item.sourceVersion)&&
            (selected?.id!==item.id||selected.version!==item.version||selected.sourceVersion!==item.sourceVersion))return {ok:false,error:'permission_denied'};
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
        const item = { id:input.commandId,sessionId:input.sessionId,runId:run.runId,kind:'instruction' as const,state:'queued' as const,text,mode:input.mode,revision:0,requestHash:hash,queueOrder:run.agent.nextInstructionOrder() };
        if (!await store.xiaozhiState.putControl(item)) return {ok:false,error:'command_conflict'};
        try { await run.agent.queue(item.id,text,item.mode,item.queueOrder); }
        catch {
          run.instructions.delete(item.id);
          await store.xiaozhiState.changeControl(item.id,['queued'],{state:'interrupted'});
          publicEvent(input.sessionId,run,{kind:'control',control:{...publicControl(item),state:'interrupted'}});
          return {ok:false,error:'busy'};
        }
        publicEvent(input.sessionId,run,{kind:'control',control:publicControl(item)});
        return {ok:true};
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
    async start(input: XiaozhiStartInput, operation: 'prompt' | 'compact' = 'prompt',goalId?:string,taskResume?:TaskResumeInput,legacyApprovalId?:string,recoveredQuestionRunId?:string): Promise<XiaozhiStartResult> {
      if (!enabled || closing) return { ok: false, error: 'configuration' };
      if (skillsMutating || configuring.has('provider')) return { ok: false, error: 'busy' };
      if(!validXiaozhiStart(input)||input.classroomPlan&&(operation!=='prompt'||Boolean(goalId)||Boolean(taskResume))||(operation==='compact'&&(input.attachments||input.continueTask))||input.continueTask&&(Boolean(goalId)||Boolean(taskResume)))return {ok:false,error:'invalid_input'};
      if(input.mockExamExportIntent&&(operation!=='prompt'||goalId||taskResume||isTaskContinuation(input.prompt)))return{ok:false,error:'invalid_input'};
      if(input.paperExportIntent&&(operation!=='prompt'||goalId||taskResume))return{ok:false,error:'invalid_input'};
      if(input.paperExportIntent&&isTaskContinuation(input.prompt))return{ok:false,error:PAPER_EXPORT_RESTART_REQUIRED};
      if(input.resumeDeliveryId&&(operation!=='prompt'||goalId||taskResume))return{ok:false,error:'invalid_input'};
      if(taskResume&&(!validTaskResume(taskResume)||taskResume.sessionId!==input.sessionId||taskResume.commandId!==input.commandId||operation!=='prompt'||goalId||input.attachments))return{ok:false,error:'invalid_input'};
      input = { ...input,...(input.mockExamExportIntent?{mockExamExportIntent:{...input.mockExamExportIntent}}:{}),...(input.paperExportIntent?{paperExportIntent:copyPaperExportIntent(input.paperExportIntent)}:{}),...(input.classroomPlan?{classroomPlan:structuredClone(input.classroomPlan)}:{}), prompt: input.prompt.trim()||ATTACHMENT_ONLY_PROMPT,
        ...(input.presentation?{presentation:{version:1,skill:input.presentation.skill,text:input.presentation.text}}:{}),
        ...(input.attachments?{attachments:input.attachments.map(s=>({id:s.id,revision:s.revision}))}:{}) };
      const id = input.sessionId;
      const canInferTeachingRequest = operation === 'prompt' && !goalId && !taskResume && !legacyApprovalId && !recoveredQuestionRunId &&
        !input.classroomPlan && !input.attachments?.length && !input.presentation && !input.continueTask &&
        !input.paperExportIntent && !input.mockExamExportIntent && !input.resumeDeliveryId &&
        !isTaskContinuation(input.prompt) && !isBoundTaskAmendment(input.prompt);
      const inferredLesson=canInferTeachingRequest?naturalLessonDraft(input.prompt):undefined;
      const requestedLessonRevision=operation==='prompt'&&!inferredLesson&&!taskResume&&!recoveredQuestionRunId&&
        !input.continueTask&&!input.attachments&&!input.presentation&&!input.paperExportIntent&&!input.mockExamExportIntent&&
        !input.classroomPlan&&!input.resumeDeliveryId&&!goalId&&!legacyApprovalId?lessonRevisionRequest(input.prompt):undefined;
      const directOriginalPaper=canInferTeachingRequest&&!inferredLesson&&startsWithOriginalPaperBlueprint(input.prompt);
      const paperReceiptSummary=directOriginalPaper&&originalPaperReceiptOnly(input.prompt);
      let allowNaturalAmendment=!inferredLesson&&!input.attachments&&!input.presentation&&!input.paperExportIntent&&!input.mockExamExportIntent&&!input.classroomPlan&&!input.resumeDeliveryId&&!goalId&&!legacyApprovalId;
      const controller=new AbortController();
      const pending=admissions.get(id)||new Set<AbortController>();pending.add(controller);admissions.set(id,pending);
      const phase=<T>(action:()=>Promise<T>,late?:(value:T)=>void|Promise<void>)=>waitForLifecycle('host_admission',action,{signal:controller.signal,timeoutMs:options.lifecycleTimeoutMs,late});
      try {
      if(requestedLessonRevision&&allowNaturalAmendment&&isBoundTaskAmendment(input.prompt)){
        const [lessonReviews,task]=await phase(()=>Promise.all([store.xiaozhiState.classroomPlans.reviews(id),tasks.committed(id)]));
        const targets=lessonReviews.filter(review=>matchesLessonRevision(review,requestedLessonRevision));
        allowNaturalAmendment=targets.length===1&&targets[0].originRunId===task?.origin.runId;
      }
      let recoveryInspection:TaskRecoveryInspection|undefined;
      if(operation==='prompt'&&(taskResume||input.continueTask||isTaskContinuation(input.prompt)||allowNaturalAmendment&&isBoundTaskAmendment(input.prompt))){
        const task=await phase(()=>createTaskState(store.xiaozhiState.sql,{sanitize:async text=>text}).latest(id));
        if(input.continueTask&&(task?.id!==input.continueTask.taskId||task.requirementsVersion!==input.continueTask.requirementsVersion))return{ok:false,error:'task_context_changed'};
        if(task&&task.state!=='active'&&task.state!=='ended'){
          await phase(()=>inspectTaskRecovery({sql:store.xiaozhiState.sql,nativeRoot:root,sessionId:id,taskId:task.id}));
          await phase(()=>effectReconciler.recheck(id,task.id));
          recoveryInspection=await phase(()=>inspectTaskRecovery({sql:store.xiaozhiState.sql,nativeRoot:root,sessionId:id,taskId:task.id}));
        }
      }
      if(journalFailures.has(id))return {ok:false,error:'event_persistence'};
      try {if(!recoveryInspection?.canRebuildSession)await phase(()=>recoverModel(id));
        if(!recoveryInspection?.canRebuildSession&&(await phase(async()=>store.xiaozhiState.modelSwitch?.transitions(id)))?.some(row=>row.status==='prepared')) return {ok:false,error:'busy'};
      } catch {return {ok:false,error:controller.signal.aborted?'cancelled':'configuration'};}
      // Retain the exact historical prompt hash; compact has a distinct command identity.
      let selectedRows:Awaited<ReturnType<typeof store.xiaozhiState.attachments.list>>=[];
      if(input.attachments){try{selectedRows=await phase(()=>store.xiaozhiState.attachments.list(id));if(input.attachments.some(s=>!selectedRows.some(row=>row.id===s.id)))return {ok:false,error:'attachment_changed'};}catch{return {ok:false,error:'configuration'};}}
      const baseHash = input.attachments?attachmentStartHash(id,input.prompt,input.attachments,selectedRows,input.presentation):createHash('sha256').update(JSON.stringify({ sessionId: id, prompt: input.prompt,...(input.mockExamExportIntent?{mockExamExportIntent:input.mockExamExportIntent}:{}),...(input.paperExportIntent?{paperExportIntent:input.paperExportIntent}:{}),...(input.resumeDeliveryId?{resumeDeliveryId:input.resumeDeliveryId}:{}),...(input.classroomPlan?{classroomPlan:input.classroomPlan}:{}), ...(operation === 'compact' ? { operation } : {}),...(goalId?{goalId}:{}),...(taskResume?{taskResume:{taskId:taskResume.taskId,revision:taskResume.revision,requirementsVersion:taskResume.requirementsVersion}}:{}),...(input.presentation?{presentation:input.presentation}:{}) })).digest('hex');
      const hash=input.continueTask?createHash('sha256').update(JSON.stringify({baseHash,continueTask:input.continueTask})).digest('hex'):baseHash;
      // Command identity is the caller's request; host routing can evolve between retries.
      if(inferredLesson&&'lesson' in inferredLesson)input={...input,classroomPlan:{mode:inferredLesson.mode,lesson:inferredLesson.lesson}};
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
      if(operation==='prompt'&&!goalId)await phase(()=>tasks.assertContinuationAllowed(id,input.prompt,input.continueTask,taskResume,allowNaturalAmendment));
      if(recoveredQuestionRunId){
        const current=await phase(()=>tasks.committed(id));
        if(!current||(current.lastRunId??current.origin.runId)!==recoveredQuestionRunId)return{ok:false,error:'task_context_changed'};
      }
      await phase(()=>tasks.recover(id));
      if(taskResume)await phase(()=>tasks.prepareResume(taskResume));
      if(controller.signal.aborted||admission!==learningDecisionGeneration.get(id))return{ok:false,error:'cancelled'};
      if(closing||active.has(id))return{ok:false,error:'busy'};
      const answerOnly=operation==='prompt'&&!goalId&&!taskResume&&!legacyApprovalId&&!requestedLessonRevision&&isStandaloneAnswer(input);
      const run: Active = { ...(inferredLesson?{naturalLessonDraft:{requestedMinutes:inferredLesson.requestedMinutes,requestedMaterials:inferredLesson.requestedMaterials,requestedAgenda:inferredLesson.requestedAgenda}}:{}),...(directOriginalPaper?{directOriginalPaper:true as const}:{}),...(paperReceiptSummary?{paperReceiptSummary:true as const}:{}),...(input.mockExamExportIntent?{mockExamExportIntent:input.mockExamExportIntent}:{}),...(input.paperExportIntent?{paperExportIntent:copyPaperExportIntent(input.paperExportIntent)}:{}),...(input.resumeDeliveryId?{resumeDeliveryId:input.resumeDeliveryId}:{}), ...(input.classroomPlan?{classroomPlan:input.classroomPlan}:{}),runId: '', commandId: input.commandId,...(goalId?{goalId}:{}), operation, sequence: 0, stopped: false, abort: controller, instructions:new Set(), turn: { id: '', status: 'running', items: [] },
        ...(answerOnly?{answerOnly}:{}),...(requestedLessonRevision?{lessonRevision:requestedLessonRevision}:{}),
        ...(recoveryInspection?{recoveryInspection}:{}),
        ...(legacyApprovalId ? {legacyApprovalId} : {}),
        usage:{runId:'',budget:{...DEFAULT_PI_BUDGET},limitsEnforced:false,modelCalls:0,toolCalls:0,tokens:null,completeness:'unknown',cost:null,activeMs:0,waitingMs:0,state:'running'},usageWrites:Promise.resolve() };
      active.set(id, run); // Reserve before awaits; UI locks are not the ownership gate.
      // Shutdown recovery owns any submitted SQL: do not queue another locked write after quit starts.
      const interruptClaim=()=>closing?Promise.resolve():trackModelWrite(()=>store.xiaozhiState.interruptCommand(input.commandId,id,hash));
      try {
        const detail = await phase(()=>store.getAiConversationSession(id)); if (detail.session.archivedAt) throw new Error('invalid_input');
        if(requestedLessonRevision&&detail.session.studentId)throw Error('permission_denied');
        if(inferredLesson&&'materialTitle' in inferredLesson){
          if(detail.session.studentId)throw Error('permission_denied');
          const {lesson,sources}=await phase(()=>resolveOrdinaryLessonBasis(inferredLesson,store.materials));
          run.naturalLessonSources=sources;
          run.classroomPlan=input.classroomPlan={mode:'outline',lesson};
        }else if(inferredLesson?.sourceTitles&&inferredLesson.lesson){
          if(detail.session.studentId)throw Error('permission_denied');
          const lesson=await phase(()=>resolveNaturalLessonBasis(inferredLesson.sourceTitles!,inferredLesson.lesson!,
            title=>store.materialCurriculum.namedBasis(title)));
          run.classroomPlan=input.classroomPlan={mode:'outline',lesson};
        }
        if(canInferTeachingRequest&&!run.classroomPlan&&!detail.session.studentId&&handoutRequest(input.prompt)){
          const titles=namedTeachingMaterialTitles(namedTeachingMaterialMatches(input.prompt));
          if(titles.length)run.handoutBasis=await phase(()=>resolveNamedHandoutSources(titles,title=>store.materials.exactNames(title)));
        }
        let deliveryContinuation:XiaozhiStartInput['continueTask'];
        if(input.resumeDeliveryId){
          const bundle=await phase(()=>deliveries.read(id,input.resumeDeliveryId!));
          if(bundle.continuation||!['partial','interrupted','failed','conflict'].includes(bundle.state))throw Error('command_conflict');
          if(bundle.mockExam){
            const version=await phase(()=>deliveries.prepareMockExamResume(id,bundle.id,run.abort.signal));
            const task=await phase(()=>tasks.committed(id));
            if(!task||version!==`${task.id}:${task.requirementsVersion}`)throw Error('command_conflict');
            deliveryContinuation={taskId:task.id,requirementsVersion:task.requirementsVersion};
            await phase(()=>tasks.assertContinuationAllowed(id,input.prompt,deliveryContinuation));
            run.mockExamDeliveryResume=true;
          }
        }
        if(input.classroomPlan?.mode==='generate')await phase(()=>store.xiaozhiState.classroomPlans.assertStart(id,input.classroomPlan as Extract<ClassroomPlanStart,{mode:'generate'}>));
        if(input.classroomPlan?.mode==='outline'&&input.classroomPlan.realign){const source=input.classroomPlan.realign;await phase(()=>store.xiaozhiState.classroomPlans.readLessonForRealignment(id,source));}
        if(taskResume)await phase(()=>tasks.prepareResume(taskResume));
        if(goalId)await phase(()=>tasks.prepareGoal(id,goalId));
        if(detail.session.studentId){try{await phase(()=>store.studentContext.snapshot(detail.session.studentId!));}catch{throw new Error('permission_denied');}}
        if(run.mockExamExportIntent){
          if(detail.session.studentId)throw Error('permission_denied');
          await phase(()=>store.xiaozhiState.mockExamCatalogs.readConfirmed(id,run.mockExamExportIntent!));
        }
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
        // This snapshot orders run admission against ordinary configuration writes.
        const settings = await phase(()=>modelSettings.captureRun(id));
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
        if(adaptationIntentFromPrompt(input.prompt.trim()))await phase(()=>store.paperAdaptations.bindRun({sessionId:id,studentId:detail.session.studentId||'',runId:run.runId,prompt:input.prompt.trim()},run.abort.signal,()=>!closing&&!run.stopped&&active.get(id)===run));
        if(input.classroomPlan?.mode==='generate'){const binding=input.classroomPlan;await phase(()=>store.xiaozhiState.classroomPlans.begin(id,run.runId,binding,()=>!closing&&!run.stopped&&active.get(id)===run));}
        run.usage.runId=run.runId;await phase(()=>store.xiaozhiState.saveUsage(id,run.usage));
        if(goalId){const goal=await store.xiaozhiState.goals.get(goalId);if(!goal||goal.sessionId!==id||goal.state!=='active')throw new Error('command_conflict');const bound=await store.xiaozhiState.goals.bind(goal,run.runId);publicEvent(id,run,{kind:'goal',goal:publicGoal(bound)});}
        run.turn.id = run.runId;
        if(!input.attachments){
          const saved = await phase(()=>store.appendAiConversationMessage(id,{role:'user',content:input.prompt.trim(),metadata:{agentRunId:run.runId,piVersion:'xiaozhi.pi.education.v1',preferenceSourceVersion:1,...(run.mockExamExportIntent?{mockExamExportIntent:run.mockExamExportIntent}:{}),...(run.paperExportIntent?{paperExportIntent:run.paperExportIntent}:{}),...(goalId?{goalId}:{}),...(input.presentation?{presentation:input.presentation}:{})}}));
          const user = saved.messages.at(-1)!;
          run.turn.items.push({ id: user.id, kind: 'message', role: 'user', text: publicMessageText(user.content,user.metadata.presentation) });
        }
        await phase(()=>beginJournal(id, run));
        publicEvent(id, run, { kind: 'status', status: 'running' });
        await phase(()=>run.publisher!.flush());
        run.teachingTaskReference=teachingReference(input.prompt,detail.messages);
        const priorThinkingTask=await phase(()=>tasks.committed(id));
        if(priorThinkingTask&&!['completed','ended'].includes(priorThinkingTask.state)){
          run.unfinishedThinkingTask=detail.messages.find(message=>message.id===priorThinkingTask.origin.messageId)?.content
            ||priorThinkingTask.criteria.map(criterion=>criterion.text).join('\n');
        }
        if(operation==='prompt'&&!answerOnly)run.task=await phase(()=>taskResume?tasks.resume(taskResume,run.publisher!):tasks.start(id,run.runId,input.commandId,run.publisher!,deliveryContinuation??input.continueTask,allowNaturalAmendment));
        else await phase(()=>tasks.bindSessionEventOwner(id,run.publisher!));
        if(closing||run.stopped)throw Error('cancelled');
        run.done = observeLifecycle('host_execute',()=>execute(id, input.prompt.trim(), run, settings),{runId:run.runId});
        executions.set(run.runId, {sessionId: id, done: run.done});
        const completed = () => {executions.delete(run.runId);};
        void run.done.then(completed, completed);
        return { ok: true, runId: run.runId };
      } catch(error) {
        if(active.get(id)===run)active.delete(id);
        const cleanup=trackModelWrite(async()=>{if(closing)return;if(run.classroomPlan?.mode==='generate'&&run.runId)await store.xiaozhiState.classroomPlans.finishRun(run.runId);await interruptClaim();if(!closing&&run.runId)await store.completeAiAgentRun(run.runId,'failed',run.stopped||controller.signal.aborted?XIAOZHI_ERRORS.cancelled:XIAOZHI_ERRORS.configuration);});
        void cleanup.catch(()=>{journalFailures.set(id,{runId:run.runId,run});});
        // Once the atomic teacher/run/files fact exists, the receipt must not claim it was unsent.
        // Later host failures are shown on that admitted turn; a retry confirms its original run.
        if(input.attachments&&run.runId&&run.turn.items[0]?.attachments?.length){publicEvent(id,run,{kind:'status',status:'failed',error:'configuration'});return {ok:true,runId:run.runId};}
        const code=error instanceof Error?error.message:'';
        if(!run.stopped&&!closing&&!controller.signal.aborted&&(code==='handout_basis_unavailable'||code==='handout_basis_ambiguous'))return {ok:false,error:code};
        return { ok: false, error:run.stopped||closing||controller.signal.aborted?'cancelled':error instanceof Error&&error.name==='TimeoutError'?'timeout':code==='lifecycle_timeout'?'timeout':code==='attachment_changed'||code==='changed'?'attachment_changed':code==='permission_denied'||code==='lesson_basis_ambiguous'||code==='lesson_basis_unavailable'?code:code===PAPER_EXPORT_RESTART_REQUIRED?PAPER_EXPORT_RESTART_REQUIRED:code===PAPER_EXPORT_SOURCE_CHANGED?PAPER_EXPORT_SOURCE_CHANGED:code==='not_confirmed'||code==='version_conflict'||code==='conflict'||code==='source_changed'||code==='command_conflict'||/^task_(revision_conflict|resume_invalid|source_changed|requirements_changed)$/.test(code)?'command_conflict':'configuration' };
      }
      })().catch((error): XiaozhiStartResult => {
        const code=error instanceof Error?error.message:'';
        return {ok:false,error:controller.signal.aborted?'cancelled':code===PAPER_EXPORT_RESTART_REQUIRED?PAPER_EXPORT_RESTART_REQUIRED:code==='task_ended'?'task_ended':'configuration'};
      });
      starting.set(input.commandId, { sessionId:id, hash, result });
      try { return await result; } finally { starting.delete(input.commandId); }
      } finally {pending.delete(controller);if(!pending.size)admissions.delete(id);}
    },
    attachments,
    referenceTeachingArtifact:artifactReferences.create,
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
      if (run.publisher && run.task) permissions.engine.cancelRun({...run.publisher.owner, taskId: run.task.id});
      // Stop the provider immediately; waiting for review cleanup can otherwise finish
      // a short reasoning block before the user's stop reaches the SDK.
      const aborting=run.agent?.abort();void aborting?.catch(()=>undefined);
      if(!run.runId)return {ok:true}; // Admission has no effect authority to cancel; late SQL is identity-fenced.
      try {await waitForLifecycle('host_stop_cleanup',async()=>{
      if(run.goalId){const goal=await store.xiaozhiState.goals.interrupt(id,run.runId,'教师停止了本轮执行，已保存进度。');if(goal)publicEvent(id,run,{kind:'goal',goal:publicGoal(goal)});}
      await controls.finish(id,run.runId);
      if(run.hasToolEvents){await approvals.cancel(run.runId); learningReviews.cancel(run.runId); questionReviews.cancel(run.runId); questionCollections.cancel(run.runId); originalReviews.cancel(run.runId); practiceReviews.cancel(run.runId); paperReviews.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await deliveries.cancel(run.runId);} await aborting;
      },{timeoutMs:options.shutdownTimeoutMs??5000});return {ok:true};}
      catch{run.publisher?.fail(Error('event_persistence'));return {ok:false};}
    },
    async providerResumed(){if(!closing)await providerHealth.revalidateAfterResume();},
    async close() {
      closing = true;ordinaryConfig.clear();const prewarmStopped=startupPrewarm.close();for(const pending of admissions.values())for(const controller of pending)controller.abort();
      for (const run of active.values()) { run.stopped = true; run.abort.abort('app_shutdown'); }
      for(const run of active.values())void run.agent?.abort().catch(()=>undefined);
      for(const controller of balanceQueries)controller.abort();
      try {await waitForLifecycle('host_shutdown',async()=>{
      await history.close();
      await attachments.close();
      await artifactReferences.close();
      await savedArtifactPreview.close();
      await fileChecks.close();
      await terminalService.close();
      await skillsReady.catch(() => undefined);
      await managedTools.dispose();
      await browser.dispose();
      await acquisition.close();
      await extensionHost.dispose();
      await mcp.dispose();
      await Promise.allSettled([...modelWrites]);
      await Promise.allSettled([...localSettingsJobs]);
      await Promise.allSettled([...starting.values()].map(item => item.result));
      for (const [id,run] of active) { await controls.finish(id,run.runId,run.abort.signal.reason==='app_shutdown'); await approvals.cancel(run.runId, true); learningReviews.cancel(run.runId); questionReviews.cancel(run.runId); questionCollections.cancel(run.runId); originalReviews.cancel(run.runId); practiceReviews.cancel(run.runId); paperReviews.cancel(run.runId); await textChanges.cancel(run.runId); await officeArtifacts.cancel(run.runId); await deliveries.cancel(run.runId); await run.agent?.abort(); }
      await Promise.allSettled([...executions.values()].map(execution => execution.done));
      await providerHealth.ready();
      },{timeoutMs:options.shutdownTimeoutMs??5000});}
      catch{for(const run of active.values())run.publisher?.fail(Error('event_persistence'));}
      await prewarmStopped;
    },

  };
  return host;
}

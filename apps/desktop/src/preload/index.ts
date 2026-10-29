import type {ScienceExportInput,ScienceExportResult} from '../shared/science-export';
import type {NativeQuestionImageQuery,NativeQuestionImage,NativeQuestionOriginQuery} from '../shared/native-question-image';
import type {MaterialStudyQuery,MaterialStudyView,MaterialStudySave,MaterialStudyQuestion,MaterialStudyPage} from '../shared/material-study';
import type {QuestionContextEditInput,QuestionContextEditResult} from '../shared/question-context-edit';
import type {OriginalQuestionInput,OriginalQuestionDecision,OriginalQuestionView,OriginalQuestionResult,QuestionImageInput} from '../shared/original-question-review';
import type {OriginalMultiInput,OriginalMultiDecision,OriginalMultiRevise,OriginalMultiView,OriginalMultiResult,OriginalGalleryInput,OriginalGalleryImage} from '../shared/original-multi-review';
import type {MaterialQuery,MaterialBodyQuery,MaterialPage,MaterialBody,MaterialRetry,MaterialJob,MaterialSource,MaterialSourceView} from '../shared/materials';
import type {WordQuery,WordPage,WordImageQuery,WordImageView,WordRebuild,WordRebuildView} from '../shared/material-word';
import type {WordQuestionQuery,WordQuestionPage} from '../shared/material-word-question';
import type {WordProofInput,WordProof,WordProofCancel,WordProofImageQuery,WordProofImage} from '../shared/material-word-proof';
import type {TeacherResource} from '../shared/contracts';
import type {FolderAiQuery,FolderAiGrant,FolderAiAction,FolderAiView} from '../shared/material-folder-ai';
import type {MaterialTaskAction,MaterialQueueView} from '../shared/material-parse-task';
import type {MaterialBatchQuery,MaterialBatchPage,MaterialBatchAction,MaterialBatchFilesQuery,MaterialBatchFiles,MaterialBatchCreated} from '../shared/material-import-batch';
import type {MaterialTextQuery,MaterialTextPage,MaterialIndexStatus} from '../shared/material-search';
import type {ArchiveEdit,ArchiveStatus} from '../shared/question-archive';
import type {MaterialPdfStatus} from '../shared/material-pdf-file';
import type {AiSettings,AiSettingsInput,AiBatchInput,AiBatchView,AiAction} from '../shared/material-ai';
import type {RetrievalStatus,RetrievalAction} from '../shared/retrieval';
import type {MaterialPreviewQuery,MaterialPreviewCancel,MaterialPreviewResult} from '../shared/material-page-preview';
import type {LayoutQuery,LayoutCancel,MaterialLayoutResult} from '../shared/material-layout';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DecisionInput, DecisionReplay, DecisionSummary, DecisionResult } from '../shared/xiaozhi-decisions';
import type {MistakeFactsInput,MistakeFactsResult} from '../shared/mistake-facts';
import type {MistakeSimilarInput,MistakeSimilarResult} from '../shared/mistake-similar';
import type {XiaozhiProviderBalance} from '../shared/xiaozhi-settings';
import type {LearningHistoryInput,LearningHistoryPage,LearningReviewInput,LearningReviewDecision,LearningReviewBatchDecision,LearningReviewBatchSummary,LearningReviewResult,LearningReviewSummary,LearningReviewView} from '../shared/learning-review';
import type {QuestionCollectionInput,QuestionCollectionDecision,QuestionCollectionResult,QuestionCollectionView} from '../shared/question-collection';
import type {QuestionReviewInput,QuestionReviewDecision,QuestionReviewResult,QuestionReviewSummary,QuestionReviewView} from '../shared/question-review';
import type {PaperGenerationQuery,PaperGenerationContext,PaperCreateInput,PaperReviewInput,PaperDecision,PaperCancelInput,PaperCompareInput,PaperCompareView,PaperResult,PaperSummary,PaperView} from '../shared/paper-blueprint';
import type {PracticeReviewInput,PracticeReviewDecision,PracticeReviewResult,PracticeReviewSummary,PracticeReviewView,PracticeSourceInput} from '../shared/practice-review';
import type {StudentTrainingInput,StudentTrainingSource,StudentTrainingResultInput,StudentTrainingView,StudentTrainingEvidence,StudentTrainingReceipt} from '../shared/student-training';
import type {ClassroomItem,ClassroomDecision,ClassroomResult} from '../shared/classroom';
import type {GoalMutation,GoalResult} from '../shared/xiaozhi-goal';
import type {XiaozhiAttachmentInput,XiaozhiAttachmentSelectedInput,XiaozhiAttachmentImportInput,XiaozhiAttachmentResult,XiaozhiAttachment,XiaozhiAttachmentChoice,XiaozhiAttachmentPreview} from '../shared/xiaozhi-attachments';
import type {AttachmentOcrReview,AttachmentOcrDecision} from '../shared/xiaozhi-ocr';
import type {MistakeOcrInput,MistakeOcrCorrection,MistakeOcrResult} from '../shared/mistake-ocr';
import type {LocalImagePreview} from '../shared/xiaozhi-images';
import type {XiaozhiWebInput,XiaozhiWebPreferences,XiaozhiWebSourceInput} from '../shared/xiaozhi-web';
import { DESKTOP_COMMANDS, type DesktopChromeState, type DesktopCommand, type DesktopMenu } from '../shared/desktop-chrome';
import type { XiaozhiControlInput, XiaozhiQueueInput, XiaozhiActionResult, XiaozhiDecisionInput, XiaozhiAgentEvent, XiaozhiStartInput, XiaozhiStartResult, XiaozhiWorkspaceSnapshot } from '../shared/xiaozhi-agent';
import type { XiaozhiBudgetInput, XiaozhiCompactInput, XiaozhiQueueMutationInput } from '../shared/xiaozhi-agent';
import type { XiaozhiMemoryCatalogInput, XiaozhiMemoryCatalogResult, XiaozhiMemoryScopeInput, XiaozhiMemoryTrace } from '../shared/xiaozhi-memory';
import type { XiaozhiSkillCatalog, XiaozhiSkillPreview, XiaozhiSkillResult, XiaozhiSkillMutation, XiaozhiSkillMutationResult } from '../shared/xiaozhi-skills';
import type { XiaozhiFileInput, XiaozhiPreviewInput, XiaozhiFileResult, XiaozhiFileList, XiaozhiFilePreview } from '../shared/xiaozhi-files';
import type { XiaozhiSettingsInput, XiaozhiSettingsResult, XiaozhiSettingsView, XiaozhiSessionModelInput, XiaozhiSessionModel, XiaozhiCredentialInput, XiaozhiCredentialView } from '../shared/xiaozhi-settings';
import type { XiaozhiMcpAddInput, XiaozhiMcpCatalog, XiaozhiMcpInput, XiaozhiMcpResult, XiaozhiMcpTrustInput } from '../shared/xiaozhi-mcp';
import type { XiaozhiChangeReviewInput, XiaozhiChangeReview, XiaozhiChangeDecision, XiaozhiChangeSummary, XiaozhiChangeResult } from '../shared/xiaozhi-changes';
import type {OfficeArtifactReviewInput,OfficeArtifactReviseInput,OfficeArtifactDecision,OfficeArtifactReview,OfficeArtifactSummary,OfficeArtifactResult} from '../shared/xiaozhi-office-artifacts';
import type {
  AiConfirmationDecisionResult,
  AiExerciseSetTeacherEdits,
  AiAgentEvent,
  AiAgentRun,
  AiMemoryTraceSummary,
  AiMemoryDocument,
  AiMemoryDocumentDetail,
  AiMemoryEntry,
  AiMemoryEntryInput,
  AiMemoryEntryUpdateInput,
  AiMemoryRevision,
  AiMemorySurface,
  AiMemorySummaryDraft,
  AiMemoryL3Document,
  AiMemoryL3DocumentDetail,
  AiMemoryL3Draft,
  AiMemoryL3Entry,
  AiMemoryL3EntryInput,
  AiMemoryL3EntryUpdateInput,
  AiMemoryL3Slot,
  AiMemoryEvidenceGraph,
  AiMemoryGovernanceReport,
  AiConfirmationItem,
  AiConfirmationStatus,
  AiCapabilityCheckpoint,
  AiConsoleRunInput,
  AiConsoleRunResult,
  AiConversationDetail,
  AiConversationFolderInput,
  AiConversationFolderUpdateInput,
  AiConversationMessageInput,
  AiConversationSessionInput,
  AiConversationSessionUpdateInput,
  AiConversationWorkspace,
  AiModelGrade,
  AiModelGradeInput,
  AiModelGradeSummary,
  AiMasteryPath,
  AiRegressionReport,
  AiRegressionReportInput,
  AiTelemetrySnapshot,
  AiUsabilityHumanReview,
  AiUsabilityHumanReviewInput,
  AiUsabilityHumanReviewSummary,
  AiUsabilityReplayExperiment,
  AiUsabilityReplayExperimentInput,
  AiUsabilityReplaySummary,
  AttachmentImportResult,
  DocumentArtifactExportInput,
  DocumentArtifactExportResult,
  DataBackupVerificationResult,
  ExportDataRootResult,
  KnowledgeImportResult,
  KnowledgeOverview,
  LearningRecordFilters,
  LearningRecordInput,
  LearningRecordUpdateInput,
  MistakeImageAnalysis,
  MistakeImageAnalysisInput,
  MistakeImageCorrectionInput,
  QuestionBankItem,
  QuestionBankItemInput,
  QuestionNotebookBookmarkInput,
  QuestionNotebookCategory,
  QuestionNotebookCategoryInput,
  QuestionNotebookCategoryUpdateInput,
  QuestionNotebookEntry,
  QuestionNotebookFilters,
  QuestionNotebookListResult,
  QuestionNotebookUsage,
  QuestionNotebookUsageInput,
  QuestionSearchFilters,
  SanitizedProblemText,
  SimilarQuestionMatch,
  ExerciseSet,
  ReviewDraftInput,
  DeepSeekSettings,
  DeepSeekSettingsInput,
  StudentInput,
  TeacherNotebook,
  TeacherNotebookInput,
  TeacherNotebookRecord,
  TeacherNotebookRecordInput,
  TeacherNotebookRecordUpdateInput,
  TeacherNotebookUpdateInput,
  TeachingBook,
  TeachingBookBlock,
  TeachingBookBlockInput,
  TeachingBookChapter,
  TeachingBookChapterInput,
  TeachingBookDetail,
  TeachingBookHealth,
  TeachingBookInvalidation,
  TeachingBookPatch,
  TeachingBookPatchInput,
  TeachingBookSelectionPatchInput,
  TeachingBookInput,
  TeachingBookPage,
  TeachingBookPageInput,
  TeachingBookMarkdownPreview,
  TeachingBookSourceInput,
  TeachingBookUpdateInput,
  XiazhiCapabilityManifest,
  XiazhiCapabilityEvent,
  XiazhiCapabilityRequest,
  XiazhiUserInputRequest,
  XiazhiRunMutationAction,
  XiazhiRunMutationResult,
  ReviewReminder,
  SearchResult,
} from '../shared/contracts';
import {XIAOZHI_ATTACHMENTS_SCHEMA} from '../shared/xiaozhi-attachments';

const attachmentPathProof = new Set<string>();
const MAX_ATTACHMENT_PATH_PROOFS = 64;

/** The renderer gets a path only for a real File object selected by the teacher.
 * Import accepts only those preload-issued paths, once each. */
function rememberAttachmentPath(file: File): string {
  try {
    const resolved = webUtils.getPathForFile(file);
    if (resolved) {
      if (attachmentPathProof.size >= MAX_ATTACHMENT_PATH_PROOFS) attachmentPathProof.clear();
      attachmentPathProof.add(resolved);
    }
    return resolved;
  } catch {
    return '';
  }
}

function takeAuthorizedAttachmentPaths(input: XiaozhiAttachmentImportInput): string[] | null {
  const paths = (input as {paths?: unknown} | null)?.paths;
  if (!Array.isArray(paths) || !paths.length || !paths.every(path => typeof path === 'string' && attachmentPathProof.has(path))) return null;
  for (const path of paths) attachmentPathProof.delete(path);
  return paths;
}

const api = {
  getDesktopChrome: () => ipcRenderer.invoke('desktop:state') as Promise<DesktopChromeState>,
  openDesktopMenu: (group:DesktopMenu,x:number,y:number) => ipcRenderer.invoke('desktop:menu',{group,x,y}) as Promise<{ok:boolean;error?:string}>,
  onDesktopCommand: (listener:(command:DesktopCommand)=>void) => {
    const handler=(_event:Electron.IpcRendererEvent,command:DesktopCommand)=>{if(DESKTOP_COMMANDS.includes(command))listener(command);};
    ipcRenderer.on('desktop:command',handler);return ()=>ipcRenderer.removeListener('desktop:command',handler);
  },
  onDesktopChrome: (listener:(state:DesktopChromeState)=>void) => {
    const handler=(_event:Electron.IpcRendererEvent,state:DesktopChromeState)=>listener(state);
    ipcRenderer.on('desktop:state',handler);return ()=>ipcRenderer.removeListener('desktop:state',handler);
  },
  isXiaozhiEnabled: () => ipcRenderer.invoke('xiaozhi:enabled') as Promise<boolean>,
  saveXiaozhiWebSettings: (input:XiaozhiWebInput)=>ipcRenderer.invoke('xiaozhi:web-settings',input) as Promise<XiaozhiSettingsResult<XiaozhiWebPreferences>>,
  openXiaozhiWebSource: (input:XiaozhiWebSourceInput)=>ipcRenderer.invoke('xiaozhi:web-source-open',input) as Promise<XiaozhiSettingsResult<void>>,
  getXiaozhiSettings: (input?: { refresh?: boolean; sessionId?: string }) => ipcRenderer.invoke('xiaozhi:settings-get', input) as Promise<XiaozhiSettingsResult<XiaozhiSettingsView>>,
  saveXiaozhiSettings: (input: XiaozhiSettingsInput) => ipcRenderer.invoke('xiaozhi:settings-save', input) as Promise<XiaozhiSettingsResult<XiaozhiSettingsView>>,
  verifyXiaozhiCredential: (input:XiaozhiCredentialInput)=>ipcRenderer.invoke('xiaozhi:settings-verify',input) as Promise<XiaozhiSettingsResult<XiaozhiCredentialView>>,
  getXiaozhiMcpCatalog: () => ipcRenderer.invoke('xiaozhi:mcp-catalog') as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  addXiaozhiMcp: (input:XiaozhiMcpAddInput) => ipcRenderer.invoke('xiaozhi:mcp-add', input) as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  inspectXiaozhiMcp: (input:XiaozhiMcpInput) => ipcRenderer.invoke('xiaozhi:mcp-inspect', input) as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  trustXiaozhiMcp: (input:XiaozhiMcpTrustInput) => ipcRenderer.invoke('xiaozhi:mcp-trust', input) as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  revokeXiaozhiMcp: (input:XiaozhiMcpInput) => ipcRenderer.invoke('xiaozhi:mcp-revoke', input) as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  removeXiaozhiMcp: (input:XiaozhiMcpInput) => ipcRenderer.invoke('xiaozhi:mcp-remove', input) as Promise<XiaozhiMcpResult<XiaozhiMcpCatalog>>,
  selectXiaozhiModel: (input: XiaozhiSessionModelInput) => ipcRenderer.invoke('xiaozhi:model-select', input) as Promise<XiaozhiSettingsResult<XiaozhiSessionModel>>,
  getXiaozhiSnapshot: (id: string) => ipcRenderer.invoke('xiaozhi:snapshot', id) as Promise<XiaozhiWorkspaceSnapshot>,
  exportXiaozhiReply: (input: import('../shared/reply-export').ReplyExportInput) => ipcRenderer.invoke('xiaozhi:reply-export', input) as Promise<import('../shared/reply-export').ReplyExportResult>,
  getXiaozhiHistoryPage: (input: import('../shared/xiaozhi-agent').XiaozhiHistoryPageInput) => ipcRenderer.invoke('xiaozhi:history-page', input) as Promise<import('../shared/xiaozhi-agent').XiaozhiHistoryPage>,
  listXiaozhiEvents: (input: import('../shared/xiaozhi-events').XiaozhiEventsInput) => ipcRenderer.invoke('xiaozhi:events', input) as Promise<import('../shared/xiaozhi-events').XiaozhiEventsPage>,
  getXiaozhiPlanHistory:(input:import('../shared/xiaozhi-plan').PlanHistoryInput)=>ipcRenderer.invoke('xiaozhi:plan-history',input) as Promise<import('../shared/xiaozhi-plan').PlanHistoryResult>,
  mutateXiaozhiGoal:(input:GoalMutation)=>ipcRenderer.invoke('xiaozhi:goal-mutate',input) as Promise<GoalResult>,
  getXiaozhiTask:(input:import('../shared/xiaozhi-task').TaskQuery)=>ipcRenderer.invoke('xiaozhi:task-snapshot',input) as Promise<import('../shared/xiaozhi-task').TaskApiResult>,
  reviewXiaozhiTask:(input:import('../shared/xiaozhi-task').TaskReviewInput)=>ipcRenderer.invoke('xiaozhi:task-review',input) as Promise<import('../shared/xiaozhi-task').TaskApiResult>,
  correctXiaozhiTask:(input:import('../shared/xiaozhi-task').TaskCorrectionInput)=>ipcRenderer.invoke('xiaozhi:task-correct',input) as Promise<import('../shared/xiaozhi-task').TaskApiResult>,
  resumeXiaozhiTask:(input:import('../shared/xiaozhi-task').TaskResumeInput)=>ipcRenderer.invoke('xiaozhi:task-resume',input) as Promise<import('../shared/xiaozhi-agent').XiaozhiStartResult>,
  showXiaozhiBrowser: (id:string)=>ipcRenderer.invoke('xiaozhi:browser-show',id) as Promise<XiaozhiActionResult>,
  previewXiaozhiBrowserCapture:(input:import('../shared/xiaozhi-browser-capture').BrowserCaptureInput)=>ipcRenderer.invoke('xiaozhi:browser-capture-preview',input) as Promise<import('../shared/xiaozhi-browser-capture').BrowserCaptureResult>,
  startXiaozhi: (input: XiaozhiStartInput) => ipcRenderer.invoke('xiaozhi:start', input) as Promise<XiaozhiStartResult>,
  stopXiaozhi: (id: string) => ipcRenderer.invoke('xiaozhi:stop', id) as Promise<{ ok: boolean }>,
  queryXiaozhiBalance:()=>ipcRenderer.invoke('xiaozhi:provider-balance') as Promise<XiaozhiSettingsResult<XiaozhiProviderBalance>>,
  selectXiaozhiWorkspace: (id: string) => ipcRenderer.invoke('xiaozhi:workspace', id) as Promise<XiaozhiActionResult>,
  selectPaperOutput:(input:import('../shared/paper-export').PaperOutputInput)=>ipcRenderer.invoke('xiaozhi:paper-output',input) as Promise<XiaozhiActionResult>,
  chooseXiaozhiAttachments:(input:XiaozhiAttachmentInput)=>ipcRenderer.invoke('xiaozhi:attachment-choose',input) as Promise<XiaozhiAttachmentResult<XiaozhiAttachmentChoice>>,
  getPathForFile:(file:File)=>rememberAttachmentPath(file),
  importXiaozhiAttachments:(input:XiaozhiAttachmentImportInput)=>{
    const paths=takeAuthorizedAttachmentPaths(input);
    if(!paths)return Promise.resolve({ok:false as const,schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,requestId:typeof input?.requestId==='string'?input.requestId:'',error:'invalid_input' as const});
    return ipcRenderer.invoke('xiaozhi:attachment-import',{...input,paths}) as Promise<XiaozhiAttachmentResult<XiaozhiAttachmentChoice>>;
  },
  listXiaozhiAttachments:(input:XiaozhiAttachmentInput)=>ipcRenderer.invoke('xiaozhi:attachment-list',input) as Promise<XiaozhiAttachmentResult<XiaozhiAttachment[]>>,
  removeXiaozhiAttachment:(input:XiaozhiAttachmentSelectedInput)=>ipcRenderer.invoke('xiaozhi:attachment-remove',input) as Promise<XiaozhiAttachmentResult<XiaozhiAttachment>>,
  previewXiaozhiAttachment:(input:XiaozhiAttachmentSelectedInput)=>ipcRenderer.invoke('xiaozhi:attachment-preview',input) as Promise<XiaozhiAttachmentResult<XiaozhiAttachmentPreview>>,
  thumbnailXiaozhiAttachment:(input:XiaozhiAttachmentSelectedInput)=>ipcRenderer.invoke('xiaozhi:attachment-thumbnail',input) as Promise<XiaozhiAttachmentResult<LocalImagePreview>>,
  cancelXiaozhiAttachment:(input:XiaozhiAttachmentInput)=>ipcRenderer.invoke('xiaozhi:attachment-cancel',input) as Promise<{ok:boolean}>,
  reviewXiaozhiAttachmentOcr:(input:XiaozhiAttachmentSelectedInput)=>ipcRenderer.invoke('xiaozhi:attachment-ocrReview',input) as Promise<XiaozhiAttachmentResult<AttachmentOcrReview|null>>,
  startXiaozhiAttachmentOcr:(input:XiaozhiAttachmentSelectedInput)=>ipcRenderer.invoke('xiaozhi:attachment-ocrStart',input) as Promise<XiaozhiAttachmentResult<AttachmentOcrReview>>,
  decideXiaozhiAttachmentOcr:(input:AttachmentOcrDecision)=>ipcRenderer.invoke('xiaozhi:attachment-ocrDecide',input) as Promise<XiaozhiAttachmentResult<AttachmentOcrReview>>,
  exportScienceClassroom: (input:ScienceExportInput) => ipcRenderer.invoke('xiaozhi:science-export',input) as Promise<ScienceExportResult>,
  cancelScienceExport: (input:{sessionId:string;requestId:string}) => ipcRenderer.invoke('xiaozhi:science-export-cancel',input) as Promise<{ok:boolean}>,
  revealScienceExport: (input:{sessionId:string;requestId:string}) => ipcRenderer.invoke('xiaozhi:science-export-reveal',input) as Promise<{ok:boolean}>,
  listXiaozhiFiles: (input:XiaozhiFileInput) => ipcRenderer.invoke('xiaozhi:files-list',input) as Promise<XiaozhiFileResult<XiaozhiFileList>>,
  previewXiaozhiFile: (input:XiaozhiPreviewInput) => ipcRenderer.invoke('xiaozhi:files-preview',input) as Promise<XiaozhiFileResult<XiaozhiFilePreview>>,
  cancelXiaozhiFile: (input:{sessionId:string;requestId:string}) => ipcRenderer.invoke('xiaozhi:files-cancel',input) as Promise<{ok:boolean}>,
  reviewXiaozhiLearning:(input:LearningReviewInput)=>ipcRenderer.invoke('xiaozhi:learning-review',input) as Promise<LearningReviewResult<LearningReviewView>>,
  listClassrooms:()=>ipcRenderer.invoke('classroom:list') as Promise<ClassroomResult<ClassroomItem[]>>,
  readClassroom:(id:string)=>ipcRenderer.invoke('classroom:read',id) as Promise<ClassroomResult<ClassroomItem>>,
  decideClassroom:(input:ClassroomDecision)=>ipcRenderer.invoke('classroom:decide',input) as Promise<ClassroomResult<ClassroomItem>>,
  completeOriginalQuestionContext:(input:QuestionContextEditInput)=>ipcRenderer.invoke('questions:complete-context',input) as Promise<QuestionContextEditResult>,
  reviewOriginalQuestion:(input:OriginalQuestionInput)=>ipcRenderer.invoke('xiaozhi:original-review',input) as Promise<OriginalQuestionResult<OriginalQuestionView>>,
  reviewOriginalMultiQuestion:(input:OriginalMultiInput)=>ipcRenderer.invoke('xiaozhi:original-multi-review',input) as Promise<OriginalMultiResult<OriginalMultiView>>,
  decideOriginalMultiQuestion:(input:OriginalMultiDecision)=>ipcRenderer.invoke('xiaozhi:original-multi-decide',input) as Promise<OriginalMultiResult<QuestionReviewSummary>>,
  reviseOriginalMultiQuestion:(input:OriginalMultiRevise)=>ipcRenderer.invoke('xiaozhi:original-multi-revise',input) as Promise<OriginalMultiResult<OriginalMultiView>>,
  getOriginalQuestionGallery:(input:OriginalGalleryInput)=>ipcRenderer.invoke('questions:original-gallery',input) as Promise<OriginalMultiResult<OriginalGalleryImage[]>>,
  decideOriginalQuestion:(input:OriginalQuestionDecision)=>ipcRenderer.invoke('xiaozhi:original-decide',input) as Promise<OriginalQuestionResult<QuestionReviewSummary>>,
  getOriginalQuestionImage:(input:QuestionImageInput)=>ipcRenderer.invoke('questions:original-image',input) as Promise<OriginalQuestionResult<string>>,
  getNativeQuestionImage:(input:NativeQuestionImageQuery)=>ipcRenderer.invoke('questions:native-image',input) as Promise<NativeQuestionImage>,
  getNativeQuestionOriginal:(input:NativeQuestionOriginQuery)=>ipcRenderer.invoke('questions:native-original',input) as Promise<{stem:string}>,
  reviewQuestionCollection:(input:QuestionCollectionInput)=>ipcRenderer.invoke('xiaozhi:question-collection-review',input) as Promise<QuestionCollectionResult<QuestionCollectionView>>,
  decideQuestionCollection:(input:QuestionCollectionDecision)=>ipcRenderer.invoke('xiaozhi:question-collection-decide',input) as Promise<QuestionCollectionResult<QuestionCollectionView>>,
  reviewXiaozhiQuestions:(input:QuestionReviewInput)=>ipcRenderer.invoke('xiaozhi:question-review',input) as Promise<QuestionReviewResult<QuestionReviewView>>,
  listPaperGenerationContexts:(input:PaperGenerationQuery)=>ipcRenderer.invoke('education:paper-generation-contexts',input) as Promise<PaperResult<PaperGenerationContext[]>>,
  listPapers:()=>ipcRenderer.invoke('education:paper-list') as Promise<PaperResult<PaperSummary[]>>,
  comparePapers:(input:PaperCompareInput)=>ipcRenderer.invoke('education:paper-compare',input) as Promise<PaperResult<PaperCompareView>>,
  createPaper:(input:PaperCreateInput)=>ipcRenderer.invoke('education:paper-create',input) as Promise<PaperResult<PaperView>>,
  reviewPaper:(input:PaperReviewInput)=>ipcRenderer.invoke('education:paper-review',input) as Promise<PaperResult<PaperView>>,
  decidePaper:(input:PaperDecision)=>ipcRenderer.invoke('education:paper-decide',input) as Promise<PaperResult<PaperView>>,
  cancelPaper:(input:PaperCancelInput)=>ipcRenderer.invoke('education:paper-cancel',input) as Promise<PaperResult<null>>,
  reviewXiaozhiPractice:(input:PracticeReviewInput)=>ipcRenderer.invoke('xiaozhi:practice-review',input) as Promise<PracticeReviewResult<PracticeReviewView>>,
  decideXiaozhiPractice:(input:PracticeReviewDecision)=>ipcRenderer.invoke('xiaozhi:practice-decide',input) as Promise<PracticeReviewResult<PracticeReviewSummary>>,
  readPracticeSource:(input:PracticeSourceInput)=>ipcRenderer.invoke('education:practice-source',input) as Promise<PracticeReviewResult<PracticeReviewView>>,
  decideXiaozhiQuestions:(input:QuestionReviewDecision)=>ipcRenderer.invoke('xiaozhi:question-decide',input) as Promise<QuestionReviewResult<QuestionReviewSummary>>,
  learningXiaozhiHistory:(input:LearningHistoryInput)=>ipcRenderer.invoke('xiaozhi:learning-history',input) as Promise<LearningReviewResult<LearningHistoryPage>>,
  getStudentTraining:(input:StudentTrainingInput)=>ipcRenderer.invoke('students:training',input) as Promise<LearningReviewResult<StudentTrainingView>>,
  getStudentTrainingSource:(input:StudentTrainingSource)=>ipcRenderer.invoke('students:training-source',input) as Promise<LearningReviewResult<StudentTrainingEvidence>>,
  recordStudentTrainingResult:(input:StudentTrainingResultInput)=>ipcRenderer.invoke('students:training-result',input) as Promise<LearningReviewResult<StudentTrainingReceipt>>,
  decideXiaozhiLearning:(input:LearningReviewDecision)=>ipcRenderer.invoke('xiaozhi:learning-decide',input) as Promise<LearningReviewResult<LearningReviewSummary>>,
  decideXiaozhiLearningBatch:(input:LearningReviewBatchDecision)=>ipcRenderer.invoke('education:learning-review-batch-decide',input) as Promise<LearningReviewResult<LearningReviewBatchSummary>>,
  decideXiaozhi: (input: XiaozhiDecisionInput) => ipcRenderer.invoke('xiaozhi:decide', input) as Promise<XiaozhiActionResult>,
  reviewXiaozhiChange: (input: XiaozhiChangeReviewInput) => ipcRenderer.invoke('xiaozhi:change-review', input) as Promise<XiaozhiChangeResult<XiaozhiChangeReview>>,
  decideXiaozhiChange: (input: XiaozhiChangeDecision) => ipcRenderer.invoke('xiaozhi:change-decide', input) as Promise<XiaozhiChangeResult<XiaozhiChangeSummary>>,
  decideXiaozhiDelivery:(input:import('../shared/xiaozhi-delivery').DeliveryDecision)=>ipcRenderer.invoke('xiaozhi:delivery-decide',input) as Promise<import('../shared/xiaozhi-delivery').DeliveryResult>,
  reviewXiaozhiOffice:(input:OfficeArtifactReviewInput)=>ipcRenderer.invoke('xiaozhi:office-review',input) as Promise<OfficeArtifactResult<OfficeArtifactReview>>,
  reviseXiaozhiOffice:(input:OfficeArtifactReviseInput)=>ipcRenderer.invoke('xiaozhi:office-revise',input) as Promise<OfficeArtifactResult<OfficeArtifactSummary>>,
  decideXiaozhiOffice:(input:OfficeArtifactDecision)=>ipcRenderer.invoke('xiaozhi:office-decide',input) as Promise<OfficeArtifactResult<OfficeArtifactSummary>>,
  answerXiaozhi: (input: XiaozhiControlInput) => ipcRenderer.invoke('xiaozhi:answer',input) as Promise<XiaozhiActionResult>,
  queueXiaozhi: (input: XiaozhiQueueInput) => ipcRenderer.invoke('xiaozhi:queue',input) as Promise<XiaozhiActionResult>,
  mutateXiaozhiQueue: (input: XiaozhiQueueMutationInput) => ipcRenderer.invoke('xiaozhi:queue-mutate',input) as Promise<XiaozhiActionResult>,
  getXiaozhiMemoryCatalog: (input: XiaozhiMemoryCatalogInput) => ipcRenderer.invoke('xiaozhi:memory-catalog', input) as Promise<XiaozhiMemoryCatalogResult>,
  setXiaozhiMemoryScope: (input: XiaozhiMemoryScopeInput) => ipcRenderer.invoke('xiaozhi:memory-scope', input) as Promise<XiaozhiActionResult>,
  getXiaozhiMemoryTrace: (sessionId: string) => ipcRenderer.invoke('xiaozhi:memory-trace', sessionId) as Promise<XiaozhiMemoryTrace | null>,
  getTeacherCandidates:(sessionId:string)=>ipcRenderer.invoke('xiaozhi:candidate-history',sessionId) as Promise<import('../shared/teacher-candidates').TeacherCandidateResult<import('../shared/teacher-candidates').TeacherCandidateSummary[]>>,
  evaluateTeacherCandidate:(input:import('../shared/teacher-candidates').TeacherCandidateInput)=>ipcRenderer.invoke('xiaozhi:candidate-evaluate',input) as Promise<import('../shared/teacher-candidates').TeacherCandidateResult<import('../shared/teacher-candidates').TeacherCandidateSummary>>,
  rejectTeacherCandidate:(input:import('../shared/teacher-candidates').TeacherCandidateInput)=>ipcRenderer.invoke('xiaozhi:candidate-reject',input) as Promise<import('../shared/teacher-candidates').TeacherCandidateResult<import('../shared/teacher-candidates').TeacherCandidateSummary>>,
  getXiaozhiDecisions: (sessionId: string) => ipcRenderer.invoke('xiaozhi:decision-history',sessionId) as Promise<DecisionResult<DecisionSummary[]>>,
  replayXiaozhiDecision: (input: DecisionInput) => ipcRenderer.invoke('xiaozhi:decision-replay',input) as Promise<DecisionResult<DecisionReplay>>,
  reviewXiaozhiDecision: (input: DecisionInput) => ipcRenderer.invoke('xiaozhi:decision-shadow',input) as Promise<DecisionResult<DecisionSummary>>,
  reviewXiaozhiRoute:(input:DecisionInput)=>ipcRenderer.invoke('xiaozhi:decision-route-shadow',input) as Promise<DecisionResult<DecisionSummary>>,
  getXiaozhiSkills: () => ipcRenderer.invoke('xiaozhi:skill-catalog') as Promise<XiaozhiSkillResult<XiaozhiSkillCatalog>>,
  previewXiaozhiSkill: (input: { name: string }) => ipcRenderer.invoke('xiaozhi:skill-preview', input) as Promise<XiaozhiSkillResult<XiaozhiSkillPreview>>,
  manageXiaozhiSkill: (input: XiaozhiSkillMutation) => ipcRenderer.invoke('xiaozhi:skill-mutate', input) as Promise<XiaozhiSkillMutationResult>,
  setXiaozhiBudget: (input: XiaozhiBudgetInput) => ipcRenderer.invoke('xiaozhi:budget',input) as Promise<XiaozhiActionResult>,
  compactXiaozhi: (input: XiaozhiCompactInput) => ipcRenderer.invoke('xiaozhi:compact',input) as Promise<XiaozhiStartResult>,
  onXiaozhiEvent: (listener: (event: XiaozhiAgentEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: XiaozhiAgentEvent) => listener(payload);
    ipcRenderer.on('xiaozhi:event', handler); return () => ipcRenderer.removeListener('xiaozhi:event', handler);
  },
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  getDataRoot: () => ipcRenderer.invoke('app:getDataRoot') as Promise<string>,
  getPlatformOverview: () => ipcRenderer.invoke('app:getPlatformOverview'),
  getDeepSeekSettings: () => ipcRenderer.invoke('settings:getDeepSeek') as Promise<DeepSeekSettings>,
  saveDeepSeekSettings: (input: DeepSeekSettingsInput) => ipcRenderer.invoke('settings:saveDeepSeek', input) as Promise<DeepSeekSettings>,
  listMaterials: (input:MaterialQuery) => ipcRenderer.invoke('materials:list',input) as Promise<MaterialPage>,
  searchMaterialText: (input:MaterialTextQuery) => ipcRenderer.invoke('materials:search',input) as Promise<MaterialTextPage>,
  getMaterialIndexStatus: () => ipcRenderer.invoke('materials:index-status') as Promise<MaterialIndexStatus>,
  getMaterialPdfStatus: (id:string) => ipcRenderer.invoke('materials:pdf-status',id) as Promise<MaterialPdfStatus|undefined>,
  getMaterialAiSettings:()=>ipcRenderer.invoke('materials:ai-settings') as Promise<AiSettings>,
  getRetrievalStatus:()=>ipcRenderer.invoke('retrieval:status') as Promise<RetrievalStatus>,
  controlRetrieval:(input:RetrievalAction)=>ipcRenderer.invoke('retrieval:action',input) as Promise<void>,
  searchQuestionsByMeaning:(input:QuestionSearchFilters)=>ipcRenderer.invoke('retrieval:questions',input) as Promise<{questions:SimilarQuestionMatch[];semantic?:import('../shared/retrieval').SemanticCoverage}>,
  saveMaterialAiSettings:(input:AiSettingsInput)=>ipcRenderer.invoke('materials:ai-save-settings',input) as Promise<AiSettings>,
  getMaterialAiBatches:(resourceId:string,offset=0)=>ipcRenderer.invoke('materials:ai-list',resourceId,offset) as Promise<AiBatchView[]>,
  createMaterialAiBatch:(input:AiBatchInput)=>ipcRenderer.invoke('materials:ai-create',input) as Promise<string>,
  controlMaterialAiBatch:(input:AiAction)=>ipcRenderer.invoke('materials:ai-action',input) as Promise<void>,
  retryMaterialPdfPages: (input:{schemaVersion:'xiaozhi.local-pdf-file.v3';resourceId:string;version:string}) => ipcRenderer.invoke('materials:pdf-retry',input) as Promise<void>,
  getMaterialQuestionStatus: () => ipcRenderer.invoke('materials:question-status') as Promise<ArchiveStatus>,
  retryMaterialQuestions: () => ipcRenderer.invoke('materials:question-retry') as Promise<void>,
  editArchivedQuestion: (input:ArchiveEdit) => ipcRenderer.invoke('materials:question-edit',input) as Promise<QuestionBankItem>,
  getArchivedQuestionVersion: (id:string) => ipcRenderer.invoke('materials:question-version',id) as Promise<{question:QuestionBankItem;version:string}>,
  getMaterialJob: () => ipcRenderer.invoke('materials:job') as Promise<MaterialJob>,
  getMaterialQueue: (resourceId?:string) => ipcRenderer.invoke('materials:queue',resourceId) as Promise<MaterialQueueView>,
  controlMaterialTask: (input:MaterialTaskAction) => ipcRenderer.invoke('materials:queue-action',input) as Promise<MaterialQueueView>,
  importMaterialsBackground: () => ipcRenderer.invoke('materials:import-background') as Promise<KnowledgeImportResult>,
  importMaterialsFolder: () => ipcRenderer.invoke('materials:import-folder') as Promise<import('../shared/materials').MaterialFolderResult>,
  createMaterialBatch: () => ipcRenderer.invoke('materials:batch-create') as Promise<MaterialBatchCreated>,
  getMaterialFolderAi: (input:FolderAiQuery) => ipcRenderer.invoke('materials:folder-ai-get',input) as Promise<FolderAiView|undefined>,
  authorizeMaterialFolderAi: (input:FolderAiGrant) => ipcRenderer.invoke('materials:folder-ai-authorize',input) as Promise<FolderAiView>,
  controlMaterialFolderAi: (input:FolderAiAction) => ipcRenderer.invoke('materials:folder-ai-action',input) as Promise<FolderAiView>,
  listMaterialBatches: (query:MaterialBatchQuery) => ipcRenderer.invoke('materials:batches',query) as Promise<MaterialBatchPage>,
  controlMaterialBatch: (input:MaterialBatchAction) => ipcRenderer.invoke('materials:batch-action',input) as Promise<MaterialBatchPage>,
  getMaterialBatchFiles: (query:MaterialBatchFilesQuery) => ipcRenderer.invoke('materials:batch-files',query) as Promise<MaterialBatchFiles>,

  getMaterialReading:(input:MaterialStudyQuery)=>ipcRenderer.invoke('materials:reading',input) as Promise<MaterialStudyView>,
  getMaterialReadingPage:(input:MaterialBodyQuery)=>ipcRenderer.invoke('materials:reading-page',input) as Promise<MaterialStudyPage>,
  saveMaterialReading:(input:MaterialStudySave)=>ipcRenderer.invoke('materials:reading-save',input) as Promise<MaterialStudyView>,
  prepareMaterialReadingQuestion:(input:MaterialStudyQuestion)=>ipcRenderer.invoke('materials:reading-question',input) as Promise<string>,
  getMaterialBody: (input:MaterialBodyQuery) => ipcRenderer.invoke('materials:body',input) as Promise<MaterialBody>,
  getMaterialWord:(input:WordQuery)=>ipcRenderer.invoke('materials:word-source',input) as Promise<WordPage|undefined>,
  getMaterialWordQuestions:(input:WordQuestionQuery)=>ipcRenderer.invoke('materials:word-questions',input) as Promise<WordQuestionPage|undefined>,
  createMaterialWordProof:(input:WordProofInput)=>ipcRenderer.invoke('materials:word-proof-create',input) as Promise<WordProof>,
  cancelMaterialWordProof:(input:WordProofCancel)=>ipcRenderer.invoke('materials:word-proof-cancel',input) as Promise<{cancelled:boolean}>,
  getMaterialWordProofImage:(input:WordProofImageQuery)=>ipcRenderer.invoke('materials:word-proof-image',input) as Promise<WordProofImage>,
  getMaterialWordImage:(input:WordImageQuery)=>ipcRenderer.invoke('materials:word-image',input) as Promise<WordImageView>,
  getMaterialWordJob:(input:WordRebuild)=>ipcRenderer.invoke('materials:word-job',input) as Promise<WordRebuildView>,
  rebuildMaterialWord:(input:WordRebuild)=>ipcRenderer.invoke('materials:word-rebuild',input) as Promise<TeacherResource>,
  cancelMaterialWord:(input:WordRebuild)=>ipcRenderer.invoke('materials:word-cancel',input) as Promise<{cancelled:boolean}>,
  getMaterialSource: (input:MaterialSource) => ipcRenderer.invoke('materials:source',input) as Promise<MaterialSourceView>,
  getMaterialPagePreview:(input:MaterialPreviewQuery)=>ipcRenderer.invoke('materials:page-preview',input) as Promise<MaterialPreviewResult>,
  getMaterialPageLayout:(input:LayoutQuery)=>ipcRenderer.invoke('materials:page-layout',input) as Promise<MaterialLayoutResult>,
  cancelMaterialPageLayout:(input:LayoutCancel)=>ipcRenderer.invoke('materials:layout-cancel',input) as Promise<{schemaVersion:'xiaozhi.material-layout.v1';stopped:boolean}>,
  cancelMaterialPagePreview:(input:MaterialPreviewCancel)=>ipcRenderer.invoke('materials:page-cancel',input) as Promise<{schemaVersion:'xiaozhi.material-page-preview.v1';stopped:boolean}>,
  createStudentConversation: (input:import('../shared/student-context').StudentConversationInput) => ipcRenderer.invoke('students:createConversation',input) as Promise<import('../shared/contracts').AiConversationDetail>,
  getQuestionContextSource:(input:import('../shared/question-context').QuestionContextSource)=>ipcRenderer.invoke('questions:context-source',input) as Promise<import('../shared/question-context').QuestionContextResult>,
  getQuestionWebAnswerEvidence:(questionId:string)=>ipcRenderer.invoke('questions:web-answer-evidence',questionId) as Promise<{ok:true;items:import('../shared/question-web-answer').WebAnswerCandidate[]}|{ok:false;error:string}>,
  getStudentContextSource: (input:import('../shared/student-context').StudentContextSource) => ipcRenderer.invoke('students:contextSource',input) as Promise<import('../shared/student-context').StudentContextSourceView>,
  retryMaterial: (resourceId:string) => ipcRenderer.invoke('materials:retry',{schemaVersion:'xiaozhi.materials.v1',resourceId}) as Promise<MaterialRetry>,
  cancelMaterialImport: () => ipcRenderer.invoke('materials:cancel') as Promise<{schemaVersion:'xiaozhi.materials.v1';stopped:boolean}>,
  getKnowledgeOverview: () => ipcRenderer.invoke('knowledge:getOverview') as Promise<KnowledgeOverview>,
  importKnowledgeResources: () => ipcRenderer.invoke('knowledge:import') as Promise<KnowledgeImportResult>,
  importKnowledgeResourcePaths: (sourcePaths: string[]) => ipcRenderer.invoke('knowledge:importPaths', sourcePaths) as Promise<KnowledgeImportResult>,
  showKnowledgeResource: (filePath: string) => ipcRenderer.invoke('knowledge:showResource', filePath),
  exportDataRoot: () => ipcRenderer.invoke('app:exportDataRoot') as Promise<ExportDataRootResult | null>,
  verifyDataBackup: () => ipcRenderer.invoke('app:verifyDataBackup') as Promise<DataBackupVerificationResult | null>,
  listStudents: (query = '') => ipcRenderer.invoke('students:list', query),
  createStudent: (input: StudentInput) => ipcRenderer.invoke('students:create', input),
  updateStudent: (id: string, input: StudentInput) => ipcRenderer.invoke('students:update', id, input),
  archiveStudent: (id: string) => ipcRenderer.invoke('students:archive', id),
  openStudentFolder: (id: string) => ipcRenderer.invoke('students:openFolder', id),
  exportStudent: (id: string) => ipcRenderer.invoke('students:export', id),
  exportDocumentArtifact: (input: DocumentArtifactExportInput) =>
    ipcRenderer.invoke('documents:exportArtifact', input) as Promise<DocumentArtifactExportResult | null>,
  listDocumentArtifacts: (sessionId?: string) =>
    ipcRenderer.invoke('documents:listArtifacts', sessionId) as Promise<DocumentArtifactExportResult[]>,
  getDocumentArtifact: (id: string) =>
    ipcRenderer.invoke('documents:getArtifact', id) as Promise<DocumentArtifactExportResult | null>,
  showDocumentArtifact: (id: string) => ipcRenderer.invoke('documents:showArtifact', id),
  getAiTelemetrySnapshot: (input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    ipcRenderer.invoke('aiObservability:getSnapshot', input) as Promise<AiTelemetrySnapshot>,
  createAiRegressionReport: (input?: AiRegressionReportInput) =>
    ipcRenderer.invoke('aiObservability:createRegressionReport', input) as Promise<AiRegressionReport>,
  listAiRegressionReports: (limit?: number) =>
    ipcRenderer.invoke('aiObservability:listRegressionReports', limit) as Promise<AiRegressionReport[]>,
  getAiRegressionReport: (id: string) =>
    ipcRenderer.invoke('aiObservability:getRegressionReport', id) as Promise<AiRegressionReport | null>,
  createAiUsabilityReview: (input: AiUsabilityHumanReviewInput) =>
    ipcRenderer.invoke('aiObservability:createUsabilityReview', input) as Promise<AiUsabilityHumanReview>,
  listAiUsabilityReviews: (limit?: number) =>
    ipcRenderer.invoke('aiObservability:listUsabilityReviews', limit) as Promise<AiUsabilityHumanReview[]>,
  getAiUsabilityReviewSummary: (input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    ipcRenderer.invoke('aiObservability:getUsabilityReviewSummary', input) as Promise<AiUsabilityHumanReviewSummary>,
  createAiUsabilityReplayExperiment: (input: AiUsabilityReplayExperimentInput) =>
    ipcRenderer.invoke('aiObservability:createUsabilityReplayExperiment', input) as Promise<AiUsabilityReplayExperiment>,
  listAiUsabilityReplayExperiments: (limit?: number) =>
    ipcRenderer.invoke('aiObservability:listUsabilityReplayExperiments', limit) as Promise<AiUsabilityReplayExperiment[]>,
  getAiUsabilityReplaySummary: (input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    ipcRenderer.invoke('aiObservability:getUsabilityReplaySummary', input) as Promise<AiUsabilityReplaySummary>,
  createAiModelGrade: (input: AiModelGradeInput) =>
    ipcRenderer.invoke('aiObservability:createModelGrade', input) as Promise<AiModelGrade>,
  listAiModelGrades: (limit?: number) =>
    ipcRenderer.invoke('aiObservability:listModelGrades', limit) as Promise<AiModelGrade[]>,
  getAiModelGradeSummary: (input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    ipcRenderer.invoke('aiObservability:getModelGradeSummary', input) as Promise<AiModelGradeSummary>,
  listRecords: (studentId: string, filters: LearningRecordFilters = {}) => ipcRenderer.invoke('records:list', studentId, filters),
  createRecord: (input: LearningRecordInput) => ipcRenderer.invoke('records:create', input),
  getAiMasteryPath: (studentId: string) => ipcRenderer.invoke('mastery:getPath', studentId) as Promise<AiMasteryPath | null>,
  getReviewReminder: (studentId: string) => ipcRenderer.invoke('review:getReminder', studentId) as Promise<ReviewReminder>,
  updateRecord: (recordId: string, input: LearningRecordUpdateInput) => ipcRenderer.invoke('records:update', recordId, input),
  createTeacherNotebook: (input: TeacherNotebookInput) => ipcRenderer.invoke('notebooks:create', input) as Promise<TeacherNotebook>,
  listTeacherNotebooks: (includeDeleted = false) => ipcRenderer.invoke('notebooks:list', includeDeleted) as Promise<TeacherNotebook[]>,
  updateTeacherNotebook: (id: string, input: TeacherNotebookUpdateInput) => ipcRenderer.invoke('notebooks:update', id, input) as Promise<TeacherNotebook>,
  deleteTeacherNotebook: (id: string) => ipcRenderer.invoke('notebooks:delete', id) as Promise<TeacherNotebook>,
  restoreTeacherNotebook: (id: string) => ipcRenderer.invoke('notebooks:restore', id) as Promise<TeacherNotebook>,
  listTeacherNotebookRecords: (notebookId: string, includeDeleted = false) => ipcRenderer.invoke('notebooks:listRecords', notebookId, includeDeleted) as Promise<TeacherNotebookRecord[]>,
  addTeacherNotebookRecord: (input: TeacherNotebookRecordInput) => ipcRenderer.invoke('notebooks:addRecord', input) as Promise<TeacherNotebookRecord>,
  updateTeacherNotebookRecord: (id: string, input: TeacherNotebookRecordUpdateInput) => ipcRenderer.invoke('notebooks:updateRecord', id, input) as Promise<TeacherNotebookRecord>,
  deleteTeacherNotebookRecord: (id: string) => ipcRenderer.invoke('notebooks:deleteRecord', id) as Promise<TeacherNotebookRecord>,
  importAttachments: (studentId: string, recordId: string) => ipcRenderer.invoke('attachments:import', studentId, recordId) as Promise<AttachmentImportResult>,
  showAttachment: (filePath: string) => ipcRenderer.invoke('attachments:show', filePath),
  createMistakeImageAnalysis: (input: MistakeImageAnalysisInput) =>
    ipcRenderer.invoke('mistakeImages:createAnalysis', input) as Promise<MistakeImageAnalysis>,
  startMistakeOcr:(input:MistakeOcrInput)=>ipcRenderer.invoke('mistakeOcr:start',input) as Promise<MistakeOcrResult>,
  correctMistakeOcr:(input:MistakeOcrCorrection)=>ipcRenderer.invoke('mistakeOcr:correct',input) as Promise<MistakeOcrResult>,
  cancelMistakeOcr:(input:MistakeOcrInput)=>ipcRenderer.invoke('mistakeOcr:cancel',input) as Promise<{ok:boolean}>,
  confirmMistakeFacts:(input:MistakeFactsInput)=>ipcRenderer.invoke('mistakeFacts:confirm',input) as Promise<MistakeFactsResult>,
  findMistakeSimilar:(input:MistakeSimilarInput)=>ipcRenderer.invoke('mistakeSimilar:find',input) as Promise<MistakeSimilarResult>,
  cancelMistakeSimilar:(input:MistakeSimilarInput)=>ipcRenderer.invoke('mistakeSimilar:cancel',input) as Promise<{ok:boolean}>,
  updateMistakeImageCorrection: (id: string, input: MistakeImageCorrectionInput) =>
    ipcRenderer.invoke('mistakeImages:updateCorrection', id, input) as Promise<MistakeImageAnalysis>,
  listMistakeImageAnalyses: (studentId: string) =>
    ipcRenderer.invoke('mistakeImages:list', studentId) as Promise<MistakeImageAnalysis[]>,
  sanitizeProblemText: (text: string, studentId?: string) =>
    ipcRenderer.invoke('mistakeImages:sanitizeText', text, studentId) as Promise<SanitizedProblemText>,
  generateReview: (input: ReviewDraftInput) => ipcRenderer.invoke('reports:generate', input),
  updateReport: (id: string, contentMd: string, parentSummary?: string) => ipcRenderer.invoke('reports:update', id, contentMd, parentSummary),
  listReports: (studentId: string) => ipcRenderer.invoke('reports:list', studentId),
  createQuestionBankItem: (input: QuestionBankItemInput) =>
    ipcRenderer.invoke('questionBank:create', input) as Promise<QuestionBankItem>,
  searchQuestionBank: (filters: QuestionSearchFilters = {}) =>
    ipcRenderer.invoke('questionBank:search', filters) as Promise<SimilarQuestionMatch[]>,
  listQuestionNotebook: (filters: QuestionNotebookFilters = {}) =>
    ipcRenderer.invoke('questionNotebook:list', filters) as Promise<QuestionNotebookListResult>,
  getQuestionNotebookEntry: (questionId: string) =>
    ipcRenderer.invoke('questionNotebook:getEntry', questionId) as Promise<QuestionNotebookEntry | undefined>,
  setQuestionNotebookBookmark: (input: QuestionNotebookBookmarkInput) =>
    ipcRenderer.invoke('questionNotebook:setBookmark', input) as Promise<QuestionNotebookEntry>,
  listQuestionNotebookCategories: (includeDeleted = false) =>
    ipcRenderer.invoke('questionNotebook:listCategories', includeDeleted) as Promise<QuestionNotebookCategory[]>,
  createQuestionNotebookCategory: (input: QuestionNotebookCategoryInput) =>
    ipcRenderer.invoke('questionNotebook:createCategory', input) as Promise<QuestionNotebookCategory>,
  updateQuestionNotebookCategory: (id: string, input: QuestionNotebookCategoryUpdateInput) =>
    ipcRenderer.invoke('questionNotebook:updateCategory', id, input) as Promise<QuestionNotebookCategory>,
  deleteQuestionNotebookCategory: (id: string) =>
    ipcRenderer.invoke('questionNotebook:deleteCategory', id) as Promise<QuestionNotebookCategory>,
  restoreQuestionNotebookCategory: (id: string) =>
    ipcRenderer.invoke('questionNotebook:restoreCategory', id) as Promise<QuestionNotebookCategory>,
  addQuestionNotebookCategory: (questionId: string, categoryId: string) =>
    ipcRenderer.invoke('questionNotebook:addCategory', questionId, categoryId) as Promise<QuestionNotebookEntry>,
  removeQuestionNotebookCategory: (questionId: string, categoryId: string) =>
    ipcRenderer.invoke('questionNotebook:removeCategory', questionId, categoryId) as Promise<QuestionNotebookEntry>,
  recordQuestionBankUsage: (input: QuestionNotebookUsageInput) =>
    ipcRenderer.invoke('questionNotebook:recordUsage', input) as Promise<QuestionNotebookUsage>,
  listQuestionNotebookUsage: (questionId: string, limit = 20) =>
    ipcRenderer.invoke('questionNotebook:listUsage', questionId, limit) as Promise<QuestionNotebookUsage[]>,
  createTeachingBook: (input: TeachingBookInput) => ipcRenderer.invoke('teachingBook:create', input) as Promise<TeachingBook>,
  listTeachingBooks: (includeDeleted = false) => ipcRenderer.invoke('teachingBook:list', includeDeleted) as Promise<TeachingBook[]>,
  getTeachingBook: (id: string) => ipcRenderer.invoke('teachingBook:get', id) as Promise<TeachingBookDetail | undefined>,
  previewTeachingBookMarkdown: (id: string) => ipcRenderer.invoke('teachingBook:previewMarkdown', id) as Promise<TeachingBookMarkdownPreview>,
  updateTeachingBook: (id: string, input: TeachingBookUpdateInput) => ipcRenderer.invoke('teachingBook:update', id, input) as Promise<TeachingBook>,
  deleteTeachingBook: (id: string) => ipcRenderer.invoke('teachingBook:delete', id) as Promise<TeachingBook>,
  createTeachingBookChapter: (input: TeachingBookChapterInput) => ipcRenderer.invoke('teachingBook:createChapter', input) as Promise<TeachingBookChapter>,
  createTeachingBookPage: (input: TeachingBookPageInput) => ipcRenderer.invoke('teachingBook:createPage', input) as Promise<TeachingBookPage>,
  upsertTeachingBookBlock: (input: TeachingBookBlockInput, id?: string, version?: number) => ipcRenderer.invoke('teachingBook:upsertBlock', input, id, version) as Promise<TeachingBookBlock>,
  addTeachingBookSource: (input: TeachingBookSourceInput) => ipcRenderer.invoke('teachingBook:addSource', input),
  regenerateTeachingBookBlock: (id: string, version: number) => ipcRenderer.invoke('teachingBook:regenerateBlock', id, version) as Promise<TeachingBookBlock>,
  regenerateTeachingBookPage: (id: string, version: number) => ipcRenderer.invoke('teachingBook:regeneratePage', id, version) as Promise<TeachingBookPage>,
  getTeachingBookHealth: (id: string) => ipcRenderer.invoke('teachingBook:health', id) as Promise<TeachingBookHealth>,
  refreshTeachingBookHealth: (id: string) => ipcRenderer.invoke('teachingBook:refreshHealth', id) as Promise<TeachingBookHealth>,
  listTeachingBookInvalidations: (id: string, includeResolved = false) => ipcRenderer.invoke('teachingBook:listInvalidations', id, includeResolved) as Promise<TeachingBookInvalidation[]>,
  proposeTeachingBookBlockPatch: (input: TeachingBookPatchInput) => ipcRenderer.invoke('teachingBook:proposePatch', input) as Promise<TeachingBookPatch>,
  proposeTeachingBookSelectionPatch: (input: TeachingBookSelectionPatchInput) => ipcRenderer.invoke('teachingBook:proposeSelectionPatch', input) as Promise<TeachingBookPatch>,
  applyTeachingBookPatch: (id: string) => ipcRenderer.invoke('teachingBook:applyPatch', id) as Promise<TeachingBookPatch>,
  undoTeachingBookPatch: (id: string) => ipcRenderer.invoke('teachingBook:undoPatch', id) as Promise<TeachingBookPatch>,
  listTeachingBookPatches: (id: string) => ipcRenderer.invoke('teachingBook:listPatches', id) as Promise<TeachingBookPatch[]>,
  listExerciseSets: (studentId: string) =>
    ipcRenderer.invoke('exerciseSets:list', studentId) as Promise<ExerciseSet[]>,
  listAiConfirmations: (status: AiConfirmationStatus | 'all' = 'pending') =>
    ipcRenderer.invoke('aiConfirmations:list', status) as Promise<AiConfirmationItem[]>,
  confirmAiConfirmation: (id: string, edits?: AiExerciseSetTeacherEdits) =>
    ipcRenderer.invoke('aiConfirmations:confirm', id, edits) as Promise<AiConfirmationDecisionResult>,
  rejectAiConfirmation: (id: string) =>
    ipcRenderer.invoke('aiConfirmations:reject', id) as Promise<AiConfirmationDecisionResult>,
  searchAll: (keyword: string) => ipcRenderer.invoke('search:all', keyword) as Promise<SearchResult>,
  runDeepSeek: (input: AiConsoleRunInput) => ipcRenderer.invoke('ai:runDeepSeek', input) as Promise<AiConsoleRunResult>,
  runDeepTutorConsole: (input: AiConsoleRunInput) => ipcRenderer.invoke('ai:deepTutorRunConsole', input) as Promise<AiConsoleRunResult>,
  listRecoverableTripletRuns: (sessionId: string) => ipcRenderer.invoke('aiGraph:listRecoverableTriplets', sessionId) as Promise<AiAgentRun[]>,
  resumeTripletRun: (runId: string, sessionId: string) => ipcRenderer.invoke('aiGraph:resumeTriplet', { runId, sessionId }) as Promise<AiConsoleRunResult>,
  deepTutorHandshake: () => ipcRenderer.invoke('ai:deepTutorHandshake') as Promise<XiazhiCapabilityManifest>,
  deepTutorStartTurn: (request: XiazhiCapabilityRequest) => ipcRenderer.invoke('ai:deepTutorStartTurn', request),
  deepTutorContinueTurn: (input: { continuationToken: string; budgets?: { maxEvents?: number; maxWallMs?: number } }) => ipcRenderer.invoke('ai:deepTutorContinueTurn', input),
  deepTutorApproveBudget: (checkpointId: string) => ipcRenderer.invoke('ai:deepTutorApproveBudget', checkpointId),
  deepTutorMutateRun: (input: { sourceRunId: string; action: XiazhiRunMutationAction; idempotencyKey: string; prompt?: string; budgets?: { maxEvents?: number; maxWallMs?: number } }) => ipcRenderer.invoke('ai:deepTutorMutateRun', input) as Promise<XiazhiRunMutationResult>,
  deepTutorCancelTurn: (turnId: string) => ipcRenderer.invoke('ai:deepTutorCancelTurn', turnId),
  deepTutorSubmitUserInput: (input: { requestId: string; turnId?: string; text?: string; answers?: Array<{ id: string; value: string }> }) =>
    ipcRenderer.invoke('ai:deepTutorSubmitUserInput', input) as Promise<{ ok: boolean; checkpointId?: string; runId?: string; errorMessage?: string }>,
  listPendingDeepTutorInputs: () => ipcRenderer.invoke('ai:deepTutorListPendingInputs') as Promise<XiazhiUserInputRequest[]>,
  deepTutorStop: () => ipcRenderer.invoke('ai:deepTutorStop'),
  getAiAgentRun: (runId: string) => ipcRenderer.invoke('aiAgent:getRun', runId) as Promise<AiAgentRun | null>,
  listAiAgentRuns: (limit = 20) => ipcRenderer.invoke('aiAgent:listRuns', limit) as Promise<AiAgentRun[]>,
  listAiAgentEvents: (runId: string) => ipcRenderer.invoke('aiAgent:listEvents', runId) as Promise<AiAgentEvent[]>,
  getAiMemoryTrace: (runId: string, limit = 50) => ipcRenderer.invoke('aiAgent:getMemoryTrace', runId, limit) as Promise<AiMemoryTraceSummary>,
  listAiMemoryDocuments: () => ipcRenderer.invoke('aiMemory:listDocuments') as Promise<AiMemoryDocument[]>,
  getAiMemoryDocument: (surface: AiMemorySurface) => ipcRenderer.invoke('aiMemory:getDocument', surface) as Promise<AiMemoryDocumentDetail | null>,
  draftAiMemorySummary: (surface: AiMemorySurface, runId?: string, limit = 8) => ipcRenderer.invoke('aiMemory:draftSummary', surface, runId, limit) as Promise<AiMemorySummaryDraft>,
  listAiMemoryRevisions: (entryId: string, limit = 50) => ipcRenderer.invoke('aiMemory:listRevisions', entryId, limit) as Promise<AiMemoryRevision[]>,
  createAiMemoryEntry: (input: AiMemoryEntryInput) => ipcRenderer.invoke('aiMemory:createEntry', input) as Promise<AiMemoryEntry>,
  updateAiMemoryEntry: (entryId: string, input: AiMemoryEntryUpdateInput) => ipcRenderer.invoke('aiMemory:updateEntry', entryId, input) as Promise<AiMemoryEntry>,
  deleteAiMemoryEntry: (entryId: string, version: number) => ipcRenderer.invoke('aiMemory:deleteEntry', entryId, version) as Promise<AiMemoryEntry>,
  listAiMemoryL3Documents: () => ipcRenderer.invoke('aiMemoryL3:listDocuments') as Promise<AiMemoryL3Document[]>,
  getAiMemoryL3Document: (slot: AiMemoryL3Slot) => ipcRenderer.invoke('aiMemoryL3:getDocument', slot) as Promise<AiMemoryL3DocumentDetail | null>,
  draftAiMemoryL3: (slot: AiMemoryL3Slot, limit = 8) => ipcRenderer.invoke('aiMemoryL3:draft', slot, limit) as Promise<AiMemoryL3Draft>,
  createAiMemoryL3Entry: (input: AiMemoryL3EntryInput) => ipcRenderer.invoke('aiMemoryL3:createEntry', input) as Promise<AiMemoryL3Entry>,
  updateAiMemoryL3Entry: (entryId: string, input: AiMemoryL3EntryUpdateInput) => ipcRenderer.invoke('aiMemoryL3:updateEntry', entryId, input) as Promise<AiMemoryL3Entry>,
  getAiMemoryEvidenceGraph: (limit = 200) => ipcRenderer.invoke('aiMemoryGraph:get', limit) as Promise<AiMemoryEvidenceGraph>,
  getAiMemoryGovernanceReport: () => ipcRenderer.invoke('aiMemoryGovernance:get') as Promise<AiMemoryGovernanceReport>,
  getPendingAiCapabilityCheckpoint: (runId: string) => ipcRenderer.invoke('aiAgent:getPendingCheckpoint', runId) as Promise<AiCapabilityCheckpoint | null>,
  getAiCapabilityCheckpoint: (checkpointId: string) => ipcRenderer.invoke('aiAgent:getCheckpoint', checkpointId) as Promise<AiCapabilityCheckpoint | null>,
  onDeepTutorEvent: (listener: (event: XiazhiCapabilityEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: XiazhiCapabilityEvent) => listener(payload);
    ipcRenderer.on('ai:deepTutorEvent', handler);
    return () => { ipcRenderer.removeListener('ai:deepTutorEvent', handler); };
  },
  onDeepTutorInputRequest: (listener: (request: XiazhiUserInputRequest) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: XiazhiUserInputRequest) => listener(payload);
    ipcRenderer.on('ai:deepTutorInputRequest', handler);
    return () => { ipcRenderer.removeListener('ai:deepTutorInputRequest', handler); };
  },
  onDeepTutorConfirmation: (listener: (item: AiConfirmationItem) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AiConfirmationItem) => listener(payload);
    ipcRenderer.on('ai:deepTutorConfirmation', handler);
    return () => { ipcRenderer.removeListener('ai:deepTutorConfirmation', handler); };
  },
  listAiConversations: () => ipcRenderer.invoke('aiConversations:list') as Promise<AiConversationWorkspace>,
  createAiConversationFolder: (input: AiConversationFolderInput) => ipcRenderer.invoke('aiConversations:createFolder', input) as Promise<AiConversationWorkspace>,
  createAiConversationSession: (input: AiConversationSessionInput) => ipcRenderer.invoke('aiConversations:createSession', input) as Promise<AiConversationDetail>,
  getAiConversationSession: (sessionId: string) => ipcRenderer.invoke('aiConversations:getSession', sessionId) as Promise<AiConversationDetail>,
  appendAiConversationMessage: (sessionId: string, input: AiConversationMessageInput) =>
    ipcRenderer.invoke('aiConversations:appendMessage', sessionId, input) as Promise<AiConversationDetail>,
  moveAiConversationSession: (sessionId: string, folderId: string | null) =>
    ipcRenderer.invoke('aiConversations:moveSession', sessionId, folderId) as Promise<AiConversationWorkspace>,
  renameAiConversationFolder: (folderId: string, input: AiConversationFolderUpdateInput) =>
    ipcRenderer.invoke('aiConversations:renameFolder', folderId, input) as Promise<AiConversationWorkspace>,
  renameAiConversationSession: (sessionId: string, input: AiConversationSessionUpdateInput) =>
    ipcRenderer.invoke('aiConversations:renameSession', sessionId, input) as Promise<AiConversationWorkspace>,
  archiveAiConversationFolder: (folderId: string) =>
    ipcRenderer.invoke('aiConversations:archiveFolder', folderId) as Promise<AiConversationWorkspace>,
  archiveAiConversationSession: (sessionId: string) =>
    ipcRenderer.invoke('aiConversations:archiveSession', sessionId) as Promise<AiConversationWorkspace>,
};

contextBridge.exposeInMainWorld('omniEdu', api);

export type OmniEduApi = typeof api;

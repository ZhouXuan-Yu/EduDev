import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiConfirmationDecisionResult,
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

const api = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  getDataRoot: () => ipcRenderer.invoke('app:getDataRoot') as Promise<string>,
  getPlatformOverview: () => ipcRenderer.invoke('app:getPlatformOverview'),
  getDeepSeekSettings: () => ipcRenderer.invoke('settings:getDeepSeek') as Promise<DeepSeekSettings>,
  saveDeepSeekSettings: (input: DeepSeekSettingsInput) => ipcRenderer.invoke('settings:saveDeepSeek', input) as Promise<DeepSeekSettings>,
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
  confirmAiConfirmation: (id: string) =>
    ipcRenderer.invoke('aiConfirmations:confirm', id) as Promise<AiConfirmationDecisionResult>,
  rejectAiConfirmation: (id: string) =>
    ipcRenderer.invoke('aiConfirmations:reject', id) as Promise<AiConfirmationDecisionResult>,
  searchAll: (keyword: string) => ipcRenderer.invoke('search:all', keyword) as Promise<SearchResult>,
  runDeepSeek: (input: AiConsoleRunInput) => ipcRenderer.invoke('ai:runDeepSeek', input) as Promise<AiConsoleRunResult>,
  runDeepTutorConsole: (input: AiConsoleRunInput) => ipcRenderer.invoke('ai:deepTutorRunConsole', input) as Promise<AiConsoleRunResult>,
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

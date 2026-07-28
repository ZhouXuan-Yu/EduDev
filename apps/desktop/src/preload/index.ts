import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiConfirmationDecisionResult,
  AiConfirmationItem,
  AiConfirmationStatus,
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
  QuestionSearchFilters,
  SanitizedProblemText,
  SimilarQuestionMatch,
  ExerciseSet,
  ReviewDraftInput,
  DeepSeekSettings,
  DeepSeekSettingsInput,
  StudentInput,
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
  updateRecord: (recordId: string, input: LearningRecordUpdateInput) => ipcRenderer.invoke('records:update', recordId, input),
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
  listExerciseSets: (studentId: string) =>
    ipcRenderer.invoke('exerciseSets:list', studentId) as Promise<ExerciseSet[]>,
  listAiConfirmations: (status: AiConfirmationStatus | 'all' = 'pending') =>
    ipcRenderer.invoke('aiConfirmations:list', status) as Promise<AiConfirmationItem[]>,
  confirmAiConfirmation: (id: string) =>
    ipcRenderer.invoke('aiConfirmations:confirm', id) as Promise<AiConfirmationDecisionResult>,
  rejectAiConfirmation: (id: string) =>
    ipcRenderer.invoke('aiConfirmations:reject', id) as Promise<AiConfirmationDecisionResult>,
  searchAll: (keyword: string) => ipcRenderer.invoke('search:all', keyword),
  runDeepSeek: (input: AiConsoleRunInput) => ipcRenderer.invoke('ai:runDeepSeek', input) as Promise<AiConsoleRunResult>,
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

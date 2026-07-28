export type StudentStatus = 'active' | 'archived';

export type Student = {
  id: string;
  displayName: string;
  realName: string;
  grade: string;
  school: string;
  subjects: string[];
  goals: string;
  currentIssues: string;
  parentConcerns: string;
  teacherNotes: string;
  tags: string[];
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
  attachmentBytes: number;
};

export type StudentInput = {
  displayName: string;
  realName?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  goals?: string;
  currentIssues?: string;
  parentConcerns?: string;
  teacherNotes?: string;
  tags?: string[];
};

export type LearningRecord = {
  id: string;
  studentId: string;
  recordType: string;
  subject: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
};

export type LearningRecordInput = {
  studentId: string;
  recordType: string;
  subject?: string;
  title: string;
  content?: string;
  tags?: string[];
  occurredAt?: string;
};

export type LearningRecordUpdateInput = {
  recordType: string;
  subject?: string;
  title: string;
  content?: string;
  tags?: string[];
  occurredAt?: string;
};

export type LearningRecordFilters = {
  type?: string;
  subject?: string;
  tag?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export type Attachment = {
  id: string;
  studentId: string;
  recordId: string | null;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  contentHash: string;
  createdAt: string;
};

export type AttachmentImportStatus = 'canceled' | 'copying' | 'succeeded' | 'partial' | 'failed';

export type AttachmentImportItem = {
  sourcePath: string;
  fileName: string;
  ok: boolean;
  fileSize: number;
  errorMessage?: string;
};

export type AttachmentImportResult = {
  status: AttachmentImportStatus;
  records: LearningRecord[];
  items: AttachmentImportItem[];
};

export type MistakeImageOcrStatus = 'needs_ocr' | 'sanitized' | 'teacher_corrected' | 'failed';

export type MistakeImageRedaction = {
  kind: 'phone' | 'id_card' | 'student_name' | 'email';
  count: number;
};

export type SanitizedProblemText = {
  sanitizedText: string;
  redactions: MistakeImageRedaction[];
  containsSensitiveData: boolean;
};

export type MistakeImageAnalysis = {
  id: string;
  studentId: string;
  recordId: string;
  attachmentId: string;
  localPath: string;
  ocrStatus: MistakeImageOcrStatus;
  extractedText: string;
  sanitizedText: string;
  redactions: MistakeImageRedaction[];
  teacherCorrectedText: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type MistakeImageAnalysisInput = {
  studentId: string;
  recordId?: string;
  attachmentId?: string;
  localPath?: string;
  extractedText?: string;
};

export type MistakeImageCorrectionInput = {
  extractedText: string;
};

export type ReviewReport = {
  id: string;
  studentId: string;
  subject: string;
  startDate: string;
  endDate: string;
  reportType: string;
  title: string;
  contentMd: string;
  parentSummary: string;
  qualityChecks: ReviewQualityCheck[];
  sourceRecordIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ReviewQualityCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ReviewDraftInput = {
  studentId: string;
  subject?: string;
  startDate: string;
  endDate: string;
  reportType: string;
};

export type QuestionBankSourceKind = 'local_bank' | 'teacher_resource' | 'generated';

export type QuestionBankItem = {
  id: string;
  subject: string;
  grade: string;
  knowledgePoint: string;
  questionType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  stem: string;
  answer: string;
  analysis: string;
  sourceTitle: string;
  sourceKind: QuestionBankSourceKind;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type QuestionBankItemInput = {
  subject?: string;
  grade?: string;
  knowledgePoint?: string;
  questionType?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  stem: string;
  answer?: string;
  analysis?: string;
  sourceTitle?: string;
  sourceKind?: QuestionBankSourceKind;
  tags?: string[];
};

export type QuestionSearchFilters = {
  query?: string;
  subject?: string;
  knowledgePoint?: string;
  questionType?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  limit?: number;
};

export type SimilarQuestionMatch = QuestionBankItem & {
  matchReason: string;
  score: number;
};

export type ExerciseSetItemRole = 'original' | 'similar' | 'variant';

export type ExerciseSetItem = {
  role: ExerciseSetItemRole;
  questionId?: string;
  sourceKind: QuestionBankSourceKind;
  stem: string;
  answer: string;
  analysis: string;
  knowledgePoint: string;
  difficulty: 'easy' | 'medium' | 'hard';
  teacherObservation: string;
};

export type ExerciseSet = {
  id: string;
  studentId: string;
  title: string;
  subject: string;
  knowledgePoint: string;
  contentMd: string;
  items: ExerciseSetItem[];
  sourceQuestionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExerciseSetDraftPayload = {
  title: string;
  subject?: string;
  knowledgePoint?: string;
  contentMd: string;
  items?: ExerciseSetItem[];
  sourceQuestionIds?: string[];
};

export type SearchResult = {
  students: Student[];
  records: LearningRecord[];
};

export type TeacherResourceParseStatus =
  | 'imported'
  | 'queued'
  | 'parsed'
  | 'chunked'
  | 'indexed'
  | 'graph_extracted'
  | 'ready'
  | 'needs_parser'
  | 'partial'
  | 'failed';

export type KnowledgeEvidenceStrength = 'direct' | 'indirect' | 'background';

export type KnowledgeSourceTrust = 'teacher_verified' | 'machine_extracted' | 'unverified';

export type KnowledgeEdgeEvidenceKind = 'direct_quote' | 'metadata' | 'inferred';

export type TeacherResource = {
  id: string;
  title: string;
  resourceType: string;
  originalFileName: string;
  localPath: string;
  fileSize: number;
  contentHash: string;
  parseStatus: TeacherResourceParseStatus;
  parseEngine: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ResourceChunk = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  chunkIndex: number;
  heading: string;
  contentMd: string;
  pageNumber: number | null;
  subject: string;
  grade: string;
  knowledgePoint: string;
  questionType: string;
  difficulty: string;
  sourceTrust: KnowledgeSourceTrust;
  containsPersonalData: boolean;
  qualityScore: number;
  evidenceStrength: KnowledgeEvidenceStrength;
  embeddingStatus: string;
  createdAt: string;
};

export type KnowledgeNode = {
  id: string;
  nodeType: string;
  name: string;
  summary: string;
  sourceKind: string;
  sourceId: string;
  confidence: number;
  evidenceStrength: KnowledgeEvidenceStrength;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  evidenceSourceId: string;
  evidenceText: string;
  confidence: number;
  evidenceStrength: KnowledgeEvidenceStrength;
  evidenceKind: KnowledgeEdgeEvidenceKind;
  createdAt: string;
};

export type KnowledgeOverview = {
  resources: TeacherResource[];
  chunks: ResourceChunk[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  counts: {
    resources: number;
    parsedResources: number;
    chunks: number;
    nodes: number;
    edges: number;
    queuedTasks: number;
  };
};

export type KnowledgeImportResult = {
  status: AttachmentImportStatus;
  resources: TeacherResource[];
  items: AttachmentImportItem[];
  overview: KnowledgeOverview;
};

export type ExportStudentResult = {
  exportPath: string;
  fileCount: number;
};

export type ExportDataRootResult = {
  exportPath: string;
  fileCount: number;
};

export type DocumentArtifactType = 'markdown' | 'pdf' | 'docx';

export type DocumentArtifactStatus = 'draft' | 'exported' | 'failed';

export type DocumentArtifactExportInput = {
  artifactId?: string;
  sessionId?: string;
  messageId?: string;
  title: string;
  type: DocumentArtifactType;
  fileName: string;
  contentMd: string;
  description?: string;
  destinationRoot?: string;
};

export type DocumentArtifactExportResult = {
  id: string;
  sessionId: string;
  messageId: string;
  title: string;
  type: DocumentArtifactType;
  fileName: string;
  mimeType: string;
  description: string;
  contentMd: string;
  filePath: string;
  fileSize: number;
  contentHash: string;
  status: DocumentArtifactStatus;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformOverview = {
  tagCount: number;
  reportTemplateCount: number;
  pendingSyncOperations: number;
  pendingAiTasks: number;
  teacherCount: number;
  assignmentCount: number;
  analytics: {
    activeStudents: number;
    totalRecords: number;
    totalReports: number;
    totalAttachments: number;
  };
};

export type BootstrapData = {
  dataRoot: string;
  students: Student[];
  overview: PlatformOverview;
};

export type AiConsoleSource = {
  id?: string;
  title: string;
  type: string;
  detail: string;
  count: string | number;
};

export type AiIntentRoute =
  | 'general_qa'
  | 'student_diagnosis'
  | 'error_analysis'
  | 'practice_design'
  | 'lesson_design'
  | 'report_draft'
  | 'knowledge_retrieval'
  | 'workspace_help';

export type AiAudience = 'teacher' | 'student_material' | 'parent_material';

export type AiActionLevel = 'answer' | 'draft' | 'write';

export type AiRiskLevel = 'normal' | 'sensitive' | 'safeguarding';

export type AiSubIntent =
  | 'casual_greeting'
  | 'capability_intro'
  | 'concept_explanation'
  | 'student_progress'
  | 'student_weakness'
  | 'student_profile_review'
  | 'risk_support'
  | 'mistake_reasoning'
  | 'error_pattern_summary'
  | 'correction_guidance'
  | 'triplet_practice'
  | 'similar_questions'
  | 'homework_plan'
  | 'lesson_plan'
  | 'teaching_sequence'
  | 'classroom_activity'
  | 'parent_summary'
  | 'monthly_report'
  | 'weekly_report'
  | 'export_document'
  | 'resource_search'
  | 'source_citation'
  | 'knowledge_graph_lookup'
  | 'usage_help'
  | 'settings_help'
  | 'data_management_help'
  | 'safety_boundary';

export type AiRouterSlots = {
  studentRefs: string[];
  hasMultipleStudentRefs: boolean;
  timeRange: 'none' | 'last_week' | 'last_month' | 'this_term' | 'custom';
  subject: string;
  knowledgePoint: string;
  writeIntent: boolean;
};

export type AiContextKey =
  | 'student_lookup'
  | 'student_profile'
  | 'learning_records'
  | 'attachment_metadata'
  | 'teacher_knowledge'
  | 'knowledge_graph'
  | 'question_bank';

export type AiContextPolicy = {
  include: AiContextKey[];
  recordLimit: number;
  knowledgeLimit: number;
  graphNodeLimit: number;
  reason: string;
};

export type AiRouterDecision = {
  route: AiIntentRoute;
  subIntent: AiSubIntent;
  confidence: number;
  audience: AiAudience;
  actionLevel: AiActionLevel;
  riskLevel: AiRiskLevel;
  slots: AiRouterSlots;
  needsStudent: boolean;
  clarificationQuestion?: string;
  allowedTools: string[];
  contextPolicy: AiContextPolicy;
};

export type AiConsoleToolRun = {
  name: string;
  label: string;
  status: 'ready' | 'used' | 'blocked' | 'failed';
  detail: string;
  effect?: 'read' | 'draft' | 'write';
  privacy?: 'local_only' | 'sanitized_cloud';
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
};

export type AiModelToolJsonSchema = {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
  }>;
  required?: string[];
  additionalProperties: false;
};

export type AiModelToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AiModelToolJsonSchema;
  };
};

export type AiModelToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown> | string;
};

export type AiModelToolReview = {
  ok: boolean;
  toolName: string;
  route: AiIntentRoute;
  reason: string;
  errors: string[];
  normalizedArguments: Record<string, unknown>;
};

export type AiAgentTracePhase =
  | 'route'
  | 'plan'
  | 'tool_call'
  | 'observe'
  | 'reflect'
  | 'finalize'
  | 'guardrail';

export type AiAgentTraceStatus = 'pending' | 'running' | 'succeeded' | 'blocked' | 'failed' | 'skipped';

export type AiAgentTraceStep = {
  label: string;
  detail: string;
  phase: AiAgentTracePhase;
  status: AiAgentTraceStatus;
  toolName?: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
};

export type AiAgentRunStatus = 'running' | 'succeeded' | 'failed' | 'blocked' | 'waiting_confirmation';

export type AiAgentRun = {
  id: string;
  sessionId: string;
  prompt: string;
  route: AiIntentRoute;
  subIntent: string;
  status: AiAgentRunStatus;
  model: string;
  studentId: string;
  errorMessage: string;
  createdAt: string;
  completedAt: string;
  updatedAt: string;
};

export type AiAgentEvent = AiAgentTraceStep & {
  id: string;
  runId: string;
  sequence: number;
  createdAt: string;
};

export type AiRegressionGateStatus = 'passed' | 'failed' | 'warning';

export type AiRegressionGate = {
  id: string;
  label: string;
  status: AiRegressionGateStatus;
  detail: string;
  evidence: Record<string, unknown>;
};

export type AiTelemetryLatency = {
  count: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
};

export type AiTelemetryUsability = {
  sampleCount: number;
  passedCount: number;
  failedCount: number;
  averageScore: number;
  minScore: number;
  profileCounts: Record<string, number>;
  issueCounts: Record<string, number>;
};

export type AiUsabilityHumanReviewInput = {
  sampleId: string;
  prompt: string;
  route: AiIntentRoute;
  subIntent: AiSubIntent | string;
  teacherScore: number;
  needsRewrite: boolean;
  roundsToUseful: number;
  mainIssueCode: string;
  teacherNote?: string;
  runId?: string;
  sessionId?: string;
  model?: string;
  reviewedAt?: string;
};

export type AiUsabilityHumanReview = {
  id: string;
  sampleId: string;
  runId: string;
  sessionId: string;
  prompt: string;
  route: AiIntentRoute;
  subIntent: string;
  model: string;
  teacherScore: number;
  needsRewrite: boolean;
  roundsToUseful: number;
  mainIssueCode: string;
  teacherNote: string;
  reviewedAt: string;
  createdAt: string;
};

export type AiUsabilityHumanReviewSummary = {
  sampleCount: number;
  averageTeacherScore: number;
  minTeacherScore: number;
  passedCount: number;
  needsRewriteCount: number;
  averageRoundsToUseful: number;
  routeCounts: Record<string, number>;
  issueCounts: Record<string, number>;
  latestReviewedAt: string;
};

export type AiUsabilityReplayExperimentInput = {
  beforeReviewId: string;
  afterReviewId: string;
  replayPrompt?: string;
  modelBefore?: string;
  modelAfter?: string;
  promptVersionBefore?: string;
  promptVersionAfter?: string;
  experimentNote?: string;
};

export type AiUsabilityReplayExperiment = {
  id: string;
  beforeReviewId: string;
  afterReviewId: string;
  replayPrompt: string;
  modelBefore: string;
  modelAfter: string;
  promptVersionBefore: string;
  promptVersionAfter: string;
  experimentNote: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  roundsBefore: number;
  roundsAfter: number;
  roundsDelta: number;
  issueBefore: string;
  issueAfter: string;
  improved: boolean;
  createdAt: string;
};

export type AiUsabilityReplaySummary = {
  experimentCount: number;
  improvedCount: number;
  unresolvedCount: number;
  improvementRate: number;
  averageScoreDelta: number;
  averageRoundsDelta: number;
  issueTransitionCounts: Record<string, number>;
  latestCreatedAt: string;
};

export type AiModelGraderMode = 'deterministic_proxy' | 'llm_judge';

export type AiModelGradeInput = {
  sampleId: string;
  prompt: string;
  answerMarkdown: string;
  route: AiIntentRoute;
  subIntent: AiSubIntent | string;
  targetGrade?: string;
  modelUnderReview?: string;
  graderModel?: string;
  graderMode?: AiModelGraderMode;
  evidenceScore: number;
  actionabilityScore: number;
  safetyScore: number;
  gradeAppropriatenessScore: number;
  concisionScore: number;
  teacherControlScore: number;
  issueCodes?: string[];
  graderRationale?: string;
  reviewedAt?: string;
};

export type AiModelGrade = {
  id: string;
  sampleId: string;
  prompt: string;
  answerMarkdown: string;
  route: AiIntentRoute;
  subIntent: string;
  targetGrade: string;
  modelUnderReview: string;
  graderModel: string;
  graderMode: AiModelGraderMode;
  evidenceScore: number;
  actionabilityScore: number;
  safetyScore: number;
  gradeAppropriatenessScore: number;
  concisionScore: number;
  teacherControlScore: number;
  overallScore: number;
  passed: boolean;
  issueCodes: string[];
  graderRationale: string;
  reviewedAt: string;
  createdAt: string;
};

export type AiModelGradeSummary = {
  sampleCount: number;
  passedCount: number;
  failedCount: number;
  averageOverallScore: number;
  minOverallScore: number;
  averageGradeAppropriatenessScore: number;
  issueCounts: Record<string, number>;
  graderModeCounts: Record<string, number>;
  latestReviewedAt: string;
};

export type AiTelemetrySnapshot = {
  generatedAt: string;
  window: {
    since?: string;
    until?: string;
  };
  runCount: number;
  statusCounts: Record<string, number>;
  routeCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  eventCount: number;
  eventPhaseCounts: Record<string, number>;
  toolEventCount: number;
  toolUsageCounts: Record<string, number>;
  artifactCounts: Record<string, number>;
  confirmationCounts: Record<string, number>;
  latency: AiTelemetryLatency;
  tokenBudget: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    knownTaskCount: number;
  };
  contextBudget: {
    sourceCount: number;
    knowledgeSnippetCount: number;
    graphNodeCount: number;
    taskCount: number;
  };
  usability: AiTelemetryUsability;
  humanUsability: AiUsabilityHumanReviewSummary;
  usabilityReplay: AiUsabilityReplaySummary;
  modelGrader: AiModelGradeSummary;
};

export type AiRegressionReport = {
  id: string;
  title: string;
  status: AiRegressionGateStatus;
  summary: string;
  snapshot: AiTelemetrySnapshot;
  gates: AiRegressionGate[];
  reportJson: Record<string, unknown>;
  createdAt: string;
};

export type AiRegressionReportInput = {
  title?: string;
  since?: string;
  until?: string;
  expectedEvalTotal?: number;
  expectedEvalPassed?: number;
  expectedUsabilityEvalTotal?: number;
  expectedUsabilityEvalPassed?: number;
  minimumUsabilityAverageScore?: number;
  minimumTeacherReviewSamples?: number;
  minimumTeacherScore?: number;
  maximumTeacherRoundsToUseful?: number;
  minimumReplayExperimentCount?: number;
  minimumReplayImprovementRate?: number;
  minimumModelGradeSamples?: number;
  minimumModelGradeScore?: number;
  minimumGradeAppropriatenessScore?: number;
};

export type AiConfirmationStatus = 'pending' | 'confirmed' | 'rejected' | 'failed';

export type AiConfirmationActionType = 'create_review_report' | 'save_exercise_set';

export type AiConfirmationPayload = {
  studentId: string;
  subject?: string;
  startDate: string;
  endDate: string;
  reportType: string;
  title: string;
  contentMd: string;
  parentSummary?: string;
  sourceRecordIds?: string[];
  exerciseSet?: ExerciseSetDraftPayload;
};

export type AiConfirmationItem = {
  id: string;
  runId: string;
  sessionId: string;
  studentId: string;
  actionType: AiConfirmationActionType;
  status: AiConfirmationStatus;
  title: string;
  description: string;
  previewMd: string;
  payload: AiConfirmationPayload;
  result: Record<string, unknown>;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
  rejectedAt: string;
};

export type AiConfirmationCreateInput = {
  runId?: string;
  sessionId?: string;
  studentId?: string;
  actionType: AiConfirmationActionType;
  title: string;
  description?: string;
  previewMd: string;
  payload: AiConfirmationPayload;
};

export type AiConfirmationDecisionResult = {
  item: AiConfirmationItem;
  readback?: {
    report?: ReviewReport;
    exerciseSet?: ExerciseSet;
  };
};

export type AiConsoleArtifactRequest = {
  id: string;
  title: string;
  type: 'markdown' | 'pdf' | 'docx' | 'exercise_set' | 'report_draft';
  fileName: string;
  description: string;
  requiresTeacherConfirmation: boolean;
};

export type AiConsoleEvidenceRef = {
  sourceId: string;
  quote?: string;
  note: string;
};

export type AiStructuredFact = {
  statement: string;
  sourceId: string;
  confidence: 'high' | 'medium' | 'low';
};

export type AiStructuredRisk = {
  level: AiRiskLevel;
  category: 'privacy' | 'safeguarding' | 'bias' | 'write_action' | 'evidence_gap' | 'none';
  mitigation: string;
};

export type AiRouteCheck = {
  kind: AiIntentRoute;
  passed: boolean;
  notes: string[];
};

export type AiEducationGraderIssue = {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
};

export type AiEducationGradeReport = {
  passed: boolean;
  score: number;
  issues: AiEducationGraderIssue[];
};

export type AiUsabilityIssue = {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
};

export type AiUsabilityGradeReport = {
  passed: boolean;
  score: number;
  profile: string;
  issues: AiUsabilityIssue[];
};

export type AiStructuredReply = {
  schemaVersion: 'xiazhi.reply.v2';
  route: AiIntentRoute;
  subIntent: AiSubIntent;
  answerMarkdown: string;
  facts: AiStructuredFact[];
  evidence: AiConsoleEvidenceRef[];
  inferences: string[];
  unknowns: string[];
  risks: AiStructuredRisk[];
  teacherConfirmations: string[];
  nextActions: string[];
  artifacts: AiConsoleArtifactRequest[];
  routeCheck: AiRouteCheck;
  processSummary: string[];
};

export type AiHarnessEvalResult = {
  id: string;
  prompt: string;
  expectedRoute: AiIntentRoute;
  actualRoute: AiIntentRoute;
  expectedSubIntent: AiSubIntent;
  actualSubIntent: AiSubIntent;
  passed: boolean;
  expectedTools: string[];
  actualTools: string[];
  missingTools: string[];
  forbiddenToolsUsed: string[];
  slotErrors: string[];
  expectedClarification?: boolean;
  actualClarification?: boolean;
};

export type AiHarnessEvalReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  routeAccuracy: number;
  cases: AiHarnessEvalResult[];
};

export type AiHarnessRunSummary = {
  agentRunId?: string;
  router: AiRouterDecision;
  selectedContext: AiContextKey[];
  schemaValid: boolean;
  schemaErrors: string[];
  educationGrade?: AiEducationGradeReport;
  usabilityGrade?: AiUsabilityGradeReport;
  trace: AiAgentTraceStep[];
};

export type AiConsoleRunInput = {
  prompt: string;
  sessionId?: string;
  studentId?: string;
  timeRange?: 'last30' | 'term' | 'custom';
  knowledgeScope?: 'teacher' | 'student' | 'all';
};

export type AiConsoleRunResult = {
  ok: boolean;
  model: string;
  content: string;
  toolRuns: AiConsoleToolRun[];
  sources: AiConsoleSource[];
  knowledgeSnippets?: ResourceChunk[];
  graphNodes?: KnowledgeNode[];
  similarQuestions?: SimilarQuestionMatch[];
  structuredReply?: AiStructuredReply;
  artifacts?: AiConsoleArtifactRequest[];
  confirmations?: AiConfirmationItem[];
  harness?: AiHarnessRunSummary;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  errorMessage?: string;
};

export type AiConversationFolder = {
  id: string;
  name: string;
  sortOrder: number;
  archivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationSession = {
  id: string;
  folderId: string | null;
  title: string;
  studentId: string;
  lastPrompt: string;
  lastResponsePreview: string;
  messageCount: number;
  archivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationMessageRole = 'user' | 'assistant' | 'system';

export type AiConversationMessage = {
  id: string;
  sessionId: string;
  role: AiConversationMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiConversationWorkspace = {
  folders: AiConversationFolder[];
  sessions: AiConversationSession[];
  archivedFolders: AiConversationFolder[];
  archivedSessions: AiConversationSession[];
};

export type AiConversationDetail = {
  session: AiConversationSession;
  messages: AiConversationMessage[];
};

export type AiConversationSessionInput = {
  title?: string;
  folderId?: string | null;
  studentId?: string;
};

export type AiConversationFolderInput = {
  name: string;
};

export type AiConversationFolderUpdateInput = {
  name: string;
};

export type AiConversationSessionUpdateInput = {
  title: string;
};

export type AiConversationMessageInput = {
  role: AiConversationMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
};

export type DeepSeekSettings = {
  configured: boolean;
  model: string;
  maskedApiKey: string;
  updatedAt: string;
};

export type DeepSeekSettingsInput = {
  apiKey?: string;
  model: string;
};

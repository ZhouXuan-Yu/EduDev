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

export type SearchResult = {
  students: Student[];
  records: LearningRecord[];
};

export type TeacherResourceParseStatus = 'queued' | 'parsed' | 'needs_parser' | 'failed';

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

export type AiContextKey =
  | 'student_lookup'
  | 'student_profile'
  | 'learning_records'
  | 'attachment_metadata'
  | 'teacher_knowledge'
  | 'knowledge_graph';

export type AiContextPolicy = {
  include: AiContextKey[];
  recordLimit: number;
  knowledgeLimit: number;
  graphNodeLimit: number;
  reason: string;
};

export type AiRouterDecision = {
  route: AiIntentRoute;
  confidence: number;
  audience: AiAudience;
  actionLevel: AiActionLevel;
  riskLevel: AiRiskLevel;
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

export type AiStructuredReply = {
  schemaVersion: 'xiazhi.reply.v1';
  route: AiIntentRoute;
  answerMarkdown: string;
  evidence: AiConsoleEvidenceRef[];
  inferences: string[];
  unknowns: string[];
  teacherConfirmations: string[];
  nextActions: string[];
  artifacts: AiConsoleArtifactRequest[];
  processSummary: string[];
};

export type AiHarnessEvalResult = {
  id: string;
  prompt: string;
  expectedRoute: AiIntentRoute;
  actualRoute: AiIntentRoute;
  passed: boolean;
  expectedTools: string[];
  actualTools: string[];
  missingTools: string[];
  forbiddenToolsUsed: string[];
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
  structuredReply?: AiStructuredReply;
  artifacts?: AiConsoleArtifactRequest[];
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

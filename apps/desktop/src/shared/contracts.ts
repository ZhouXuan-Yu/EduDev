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

export type TeacherNotebookRecordType = 'solve' | 'question' | 'research' | 'chat' | 'co_writer' | 'tutorbot' | 'guided_learning';

export type TeacherNotebook = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: 'active' | 'deleted';
  version: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};

export type TeacherNotebookRecord = {
  id: string;
  notebookId: string;
  recordType: TeacherNotebookRecordType;
  title: string;
  summary: string;
  userQuery: string;
  output: string;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};

export type TeacherNotebookInput = {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
};

export type TeacherNotebookUpdateInput = Partial<TeacherNotebookInput> & { version: number };

export type TeacherNotebookRecordInput = {
  notebookId: string;
  recordType: TeacherNotebookRecordType;
  title: string;
  userQuery?: string;
  output: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type TeacherNotebookRecordUpdateInput = Partial<Omit<TeacherNotebookRecordInput, 'notebookId'>> & { version: number };

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

export type QuestionNotebookCategory = {
  id: string;
  name: string;
  status: 'active' | 'deleted';
  version: number;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};

export type QuestionNotebookEntry = QuestionBankItem & {
  bookmarked: boolean;
  version: number;
  categories: QuestionNotebookCategory[];
  usageCount: number;
  lastUsedAt: string;
};

export type QuestionNotebookListResult = {
  items: QuestionNotebookEntry[];
  total: number;
};

export type QuestionNotebookUsage = {
  id: string;
  questionId: string;
  usageType: 'exercise_set' | 'learning_record' | 'manual';
  usageId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type QuestionNotebookFilters = {
  query?: string;
  categoryId?: string;
  bookmarked?: boolean;
  sourceKind?: QuestionBankSourceKind;
  limit?: number;
  offset?: number;
};

export type QuestionNotebookCategoryInput = {
  name: string;
};

export type QuestionNotebookCategoryUpdateInput = {
  name: string;
  version: number;
};

export type QuestionNotebookBookmarkInput = {
  questionId: string;
  bookmarked: boolean;
  version?: number;
};

export type QuestionNotebookUsageInput = {
  questionId: string;
  usageType: 'exercise_set' | 'learning_record' | 'manual';
  usageId?: string;
  metadata?: Record<string, unknown>;
};

export type TeachingBookStatus = 'draft' | 'spine_ready' | 'compiling' | 'ready' | 'partial' | 'error' | 'archived';
export type TeachingPageStatus = 'pending' | 'planning' | 'generating' | 'ready' | 'partial' | 'error';
export type TeachingBlockStatus = 'pending' | 'generating' | 'ready' | 'error' | 'hidden';
export type TeachingBlockType = 'text' | 'chapter' | 'quiz' | 'card' | 'figure' | 'concept_graph' | 'prompt' | 'callout' | 'section' | 'timeline' | 'code' | 'deep_explanation' | 'interactive' | 'animation' | 'user_note';
export type TeachingContentType = 'theory' | 'derivation' | 'history' | 'practice' | 'concept' | 'overview';
export type TeachingSourceKind = 'knowledge_resource' | 'knowledge_chunk' | 'teacher_notebook' | 'question_notebook' | 'manual';

export type TeachingSourceRef = {
  kind: TeachingSourceKind;
  ref: string;
  title: string;
  snippet: string;
  fingerprint: string;
  status: 'available' | 'missing' | 'stale';
};

export type TeachingBook = {
  id: string;
  title: string;
  description: string;
  status: TeachingBookStatus;
  language: string;
  targetLevel: string;
  version: number;
  chapterCount: number;
  pageCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};

export type TeachingBookInput = {
  title: string;
  description?: string;
  language?: string;
  targetLevel?: string;
};

export type TeachingBookUpdateInput = Partial<TeachingBookInput> & { version: number; status?: TeachingBookStatus };

export type TeachingBookChapter = {
  id: string;
  bookId: string;
  title: string;
  learningObjectives: string[];
  contentType: TeachingContentType;
  prerequisites: string[];
  summary: string;
  order: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TeachingBookChapterInput = {
  bookId: string;
  title: string;
  learningObjectives?: string[];
  contentType?: TeachingContentType;
  prerequisites?: string[];
  summary?: string;
  order?: number;
};

export type TeachingBookPage = {
  id: string;
  bookId: string;
  chapterId: string;
  title: string;
  learningObjectives: string[];
  contentType: TeachingContentType;
  status: TeachingPageStatus;
  order: number;
  version: number;
  blockCount: number;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type TeachingBookPageInput = {
  bookId: string;
  chapterId: string;
  title: string;
  learningObjectives?: string[];
  contentType?: TeachingContentType;
  order?: number;
};

export type TeachingBookBlock = {
  id: string;
  pageId: string;
  type: TeachingBlockType;
  status: TeachingBlockStatus;
  title: string;
  params: Record<string, unknown>;
  payload: Record<string, unknown>;
  sourceAnchors: TeachingSourceRef[];
  metadata: Record<string, unknown>;
  order: number;
  version: number;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type TeachingBookBlockInput = {
  pageId: string;
  type: TeachingBlockType;
  title?: string;
  params?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  sourceAnchors?: TeachingSourceRef[];
  metadata?: Record<string, unknown>;
  order?: number;
  status?: TeachingBlockStatus;
};

export type TeachingBookSourceInput = TeachingSourceRef & { bookId: string };

export type TeachingBookHealth = {
  bookId: string;
  status: 'healthy' | 'stale' | 'missing_sources';
  sourceCount: number;
  staleSourceRefs: string[];
  missingSourceRefs: string[];
  stalePageIds: string[];
  staleBlockIds: string[];
  checkedAt: string;
};

export type TeachingBookInvalidation = {
  id: string;
  bookId: string;
  kind: TeachingSourceKind;
  ref: string;
  status: 'open' | 'resolved';
  stalePageIds: string[];
  staleBlockIds: string[];
  detectedAt: string;
  resolvedAt: string;
};

export type TeachingBookPatchStatus = 'draft' | 'applied' | 'rejected' | 'undone';
export type TeachingBookPatchInput = {
  bookId: string;
  blockId: string;
  baseVersion: number;
  title?: string;
  payload?: Record<string, unknown>;
  reason?: string;
};
export type TeachingBookSelectionPatchInput = {
  bookId: string;
  blockId: string;
  baseVersion: number;
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
  replacementText: string;
  mode?: 'react_edit' | 'automark';
  reason?: string;
};
export type TeachingBookPatch = {
  id: string;
  bookId: string;
  pageId: string;
  blockId: string;
  baseVersion: number;
  resultVersion: number;
  operation: 'replace_block' | 'replace_selection' | 'automark_selection';
  beforeTitle: string;
  afterTitle: string;
  beforePayload: Record<string, unknown>;
  afterPayload: Record<string, unknown>;
  reason: string;
  status: TeachingBookPatchStatus;
  error: string;
  createdAt: string;
  appliedAt: string;
  undoneAt: string;
  selectionStart: number;
  selectionEnd: number;
  selectedTextHash: string;
  selectedText: string;
};

export type TeachingBookDetail = {
  book: TeachingBook;
  chapters: TeachingBookChapter[];
  pages: TeachingBookPage[];
  blocks: TeachingBookBlock[];
  sources: TeachingSourceRef[];
  health: TeachingBookHealth;
};

export type TeachingBookMarkdownPreview = {
  schemaVersion: 'omni.teaching.book.markdown.v1';
  markdown: string;
  fallbackCount: number;
  blockCount: number;
  sourceRefs: string[];
  requiresTeacherReview: true;
  writesFile: false;
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
  manifestPath: string;
  verified: boolean;
};

export type DataBackupVerificationResult = {
  backupPath: string;
  manifestPath: string;
  verified: boolean;
  fileCount: number;
  missingFiles: string[];
  changedFiles: string[];
  unexpectedFiles: string[];
  errorMessage?: string;
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

export type ReviewReminderItem = {
  id: string;
  knowledgePointId: string;
  name: string;
  moduleId: string;
  moduleName: string;
  type: 'memory' | 'concept' | 'procedure' | 'design';
  dueAt: number;
  state: 'due' | 'upcoming';
};

export type ReviewReminder = {
  schemaVersion: 'omni.review.reminder.v1';
  status: 'due' | 'upcoming' | 'clear';
  generatedAt: number;
  horizonSeconds: number;
  dueCount: number;
  upcomingCount: number;
  nextAt: number | null;
  timezone: string;
  timezoneInvariant: true;
  source: 'omni_edu_learning_records';
  rawRecordsIncluded: false;
  requiresTeacherReview: true;
  items: ReviewReminderItem[];
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

export type AiRoleProfileId = 'teacher' | 'peer' | 'research_assistant';

export type AiSubIntent =
  | 'casual_greeting'
  | 'capability_intro'
  | 'concept_explanation'
  | 'student_progress'
  | 'student_weakness'
  | 'review_queue'
  | 'student_profile_review'
  | 'risk_support'
  | 'mistake_reasoning'
  | 'error_pattern_summary'
  | 'correction_guidance'
  | 'triplet_practice'
  | 'similar_questions'
  | 'question_notebook'
  | 'book_workspace'
  | 'memory_trace'
  | 'memory_summary'
  | 'memory_synthesis'
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
  | 'research_workspace'
  | 'visualization'
  | 'attached_source_exploration'
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
  | 'user_input'
  | 'student_lookup'
  | 'student_profile'
  | 'learning_records'
  | 'attachment_metadata'
  | 'attached_sources'
  | 'teacher_notebook'
  | 'question_notebook'
  | 'teaching_book'
  | 'teacher_knowledge'
  | 'knowledge_graph'
  | 'question_bank'
  | 'memory_trace'
  | 'memory_summary'
  | 'memory_synthesis';

export type AiMemorySurface = 'chat' | 'notebook' | 'quiz' | 'kb' | 'book' | 'partner' | 'cowriter';
export type AiMemoryL3Slot = 'recent' | 'profile' | 'scope' | 'preferences';

export type AiMemoryEntryStatus = 'active' | 'disabled' | 'deleted';
export type AiMemoryEntryOrigin = 'derived' | 'teacher';

export type AiMemoryEvidenceRef = {
  ref: string;
  kind: 'run' | 'event';
  id: string;
  label: string;
};

export type AiMemoryEntry = {
  id: string;
  documentId: string;
  surface: AiMemorySurface;
  section: string;
  text: string;
  refs: AiMemoryEvidenceRef[];
  status: AiMemoryEntryStatus;
  origin: AiMemoryEntryOrigin;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
};

export type AiMemoryDocument = {
  id: string;
  layer: 'L2';
  surface: AiMemorySurface;
  title: string;
  version: number;
  entryCount: number;
  activeEntryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiMemoryDocumentDetail = {
  document: AiMemoryDocument;
  entries: AiMemoryEntry[];
};

export type AiMemorySummaryDraftEntry = {
  section: string;
  text: string;
  refs: AiMemoryEvidenceRef[];
  origin: 'derived';
  requiresTeacherReview: true;
};

export type AiMemorySummaryDraft = {
  layer: 'L2';
  surface: AiMemorySurface;
  sourceRunId: string;
  entries: AiMemorySummaryDraftEntry[];
  bounded: true;
  rawPromptIncluded: false;
  hiddenReasoningIncluded: false;
};

export type AiMemoryEntryInput = {
  surface: AiMemorySurface;
  section?: string;
  text: string;
  refs: string[];
  origin?: AiMemoryEntryOrigin;
};

export type AiMemoryEntryUpdateInput = {
  version: number;
  section?: string;
  text?: string;
  refs?: string[];
  status?: AiMemoryEntryStatus;
};

export type AiMemoryRevision = {
  id: string;
  documentId: string;
  entryId: string;
  action: 'create' | 'edit' | 'disable' | 'restore' | 'delete';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type AiMemoryL3Entry = {
  id: string;
  documentId: string;
  slot: AiMemoryL3Slot;
  text: string;
  sourceDocuments: AiMemorySurface[];
  status: Exclude<AiMemoryEntryStatus, 'deleted'>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AiMemoryL3Document = {
  id: string;
  layer: 'L3';
  slot: AiMemoryL3Slot;
  title: string;
  version: number;
  entryCount: number;
  activeEntryCount: number;
  updatedAt: string;
};

export type AiMemoryL3DocumentDetail = {
  document: AiMemoryL3Document;
  entries: AiMemoryL3Entry[];
};

export type AiMemoryL3Draft = {
  layer: 'L3';
  slot: AiMemoryL3Slot;
  entries: Array<{
    text: string;
    sourceDocuments: AiMemorySurface[];
    requiresTeacherReview: true;
  }>;
  bounded: true;
  rawPromptIncluded: false;
  hiddenReasoningIncluded: false;
};

export type AiMemoryL3EntryInput = {
  slot: AiMemoryL3Slot;
  text: string;
  sourceDocuments: AiMemorySurface[];
};

export type AiMemoryL3EntryUpdateInput = {
  version: number;
  text?: string;
  status?: Exclude<AiMemoryEntryStatus, 'deleted'>;
};

export type AiMemoryGraphNode = {
  id: string;
  kind: 'l2_entry' | 'l3_entry' | 'run' | 'event';
  label: string;
  status: string;
};

export type AiMemoryGraphEdge = {
  from: string;
  to: string;
  kind: 'derived_from' | 'evidence';
};

export type AiMemoryEvidenceGraph = {
  nodes: AiMemoryGraphNode[];
  edges: AiMemoryGraphEdge[];
  bounded: true;
  rawPromptIncluded: false;
  hiddenReasoningIncluded: false;
};

export type AiMemoryGovernanceReport = {
  policyVersion: 'memory-governance.v1';
  l2Documents: number;
  l2ActiveEntries: number;
  l3Documents: number;
  l3ActiveEntries: number;
  danglingEvidenceRefs: number;
  disabledEntries: number;
  deletedEntries: number;
  graphNodes: number;
  graphEdges: number;
  bounded: true;
  writableByAi: false;
};

export type AiMemoryTraceEvent = {
  sequence: number;
  phase: AiAgentTraceStep['phase'];
  status: AiAgentTraceStep['status'];
  label: string;
  toolName: string;
  createdAt: string;
  inputKeys: string[];
  outputKeys: string[];
};

export type AiMemoryTraceSummary = {
  layer: 'L1';
  runId: string;
  status: AiAgentRunStatus | 'missing';
  eventCount: number;
  events: AiMemoryTraceEvent[];
  bounded: true;
  rawPromptIncluded: false;
  hiddenReasoningIncluded: false;
};

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
  roleProfile?: AiRoleProfileId;
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
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
    maxItems?: number;
    items?: {
      type: 'string' | 'object';
      properties?: Record<string, { type: 'string'; enum?: string[]; maxLength?: number }>;
      required?: string[];
    };
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

export type AiAgentRunStatus = 'running' | 'succeeded' | 'failed' | 'blocked' | 'waiting_confirmation' | 'waiting_input';

export type AiCapabilityCheckpointStatus = 'pending' | 'resolved' | 'expired' | 'cancelled';

export type AiCapabilityCheckpoint = {
  id: string;
  runId: string;
  capabilityName: XiazhiCapabilityName;
  checkpointType: 'user_input' | 'confirmation' | 'cancelled' | 'timeout' | 'continuation' | 'budget_approval';
  state: Record<string, unknown>;
  status: AiCapabilityCheckpointStatus;
  expiresAt: string;
  createdAt: string;
  resolvedAt: string;
};

export type AiMasteryQuestionStatus = 'pending' | 'answered' | 'graded' | 'cancelled' | 'expired';

export type AiMasteryQuestion = {
  id: string;
  runId: string;
  turnId: string;
  studentId: string;
  knowledgePointId: string;
  knowledgePointName: string;
  stem: string;
  options: string[];
  expectedAnswer: string;
  status: AiMasteryQuestionStatus;
  answer: string;
  isCorrect?: boolean;
  createdAt: string;
  answeredAt?: string;
  gradedAt?: string;
};

export type AiMasteryPathModule = {
  id: string;
  name: string;
  order: number;
  knowledgePoints: Array<{
    id: string;
    name: string;
    type: 'memory' | 'procedure' | 'concept' | 'design';
  }>;
};

export type AiMasteryPath = {
  id: string;
  studentId: string;
  version: number;
  mode: 'replace' | 'append';
  modules: AiMasteryPathModule[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

/**
 * Cross-process DeepTutor bridge contracts. These are deliberately separate
 * from model-facing reply contracts: the sidecar can request work, but the
 * Electron host remains the authority for data, permissions and writes.
 */
export type XiazhiBridgeProtocolVersion = 'xiazhi.bridge.v1';
export type XiazhiCapabilityManifestVersion = 'xiazhi.capability.manifest.v1';
export type XiazhiCapabilityRequestVersion = 'xiazhi.capability.request.v1';
export type XiazhiCapabilityEventVersion = 'xiazhi.capability.event.v1';
export type XiazhiCapabilityResultVersion = 'xiazhi.capability.result.v1';

export type XiazhiCapabilityName =
  | 'chat'
  | 'deep_solve'
  | 'deep_question'
  | 'deep_research'
  | 'visualize'
  | 'mastery_path';

export type XiazhiBridgeRequest = {
  type: 'request';
  id: string;
  method: 'handshake' | 'start_turn' | 'cancel_turn' | 'shutdown';
  params: Record<string, unknown>;
};

export type XiazhiBridgeResponse = {
  type: 'response';
  id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export type XiazhiCapabilityManifest = {
  schemaVersion: XiazhiCapabilityManifestVersion;
  bridgeProtocol: XiazhiBridgeProtocolVersion;
  sidecarVersion: string;
  capabilities: Array<{
    name: XiazhiCapabilityName;
    version: string;
    enabled: boolean;
    readOnly: boolean;
  }>;
};

export type XiazhiCapabilityRequest = {
  schemaVersion: XiazhiCapabilityRequestVersion;
  turnId: string;
  capability: XiazhiCapabilityName;
  prompt: string;
  context: Record<string, unknown>;
  budgets: {
    maxEvents: number;
    maxWallMs: number;
  };
};

export type XiazhiCapabilityEvent = {
  schemaVersion: XiazhiCapabilityEventVersion;
  turnId: string;
  sequence: number;
  phase: 'stage' | 'tool_request' | 'tool_result' | 'result' | 'error' | 'done';
  status: 'running' | 'awaiting_host' | 'succeeded' | 'failed' | 'cancelled';
  label: string;
  detail: string;
  publicSummary?: Record<string, unknown>;
};

export type XiazhiCapabilityResult = {
  schemaVersion: XiazhiCapabilityResultVersion;
  turnId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  answerMarkdown: string;
  publicSummary: Record<string, unknown>;
};

export type XiazhiHostToolRequest = {
  schemaVersion: 'xiazhi.host_tool.request.v1';
  requestId: string;
  turnId: string;
  capability: XiazhiCapabilityName;
  prompt: string;
  toolName: string;
  arguments: Record<string, unknown>;
};

export type XiazhiHostToolResult = {
  schemaVersion: 'xiazhi.host_tool.result.v1';
  requestId: string;
  turnId: string;
  status: 'used' | 'blocked' | 'failed';
  review: {
    ok: boolean;
    reason: string;
    errors: string[];
  };
  modelResult: Record<string, unknown>;
};

export type XiazhiUserInputRequest = {
  schemaVersion: 'xiazhi.user_input.request.v1';
  requestId: string;
  turnId: string;
  prompt: string;
  questions?: Array<{
    id: string;
    question: string;
    options?: string[];
  }>;
  expiresAt?: string;
};

export type XiazhiUserInputResult = {
  schemaVersion: 'xiazhi.user_input.result.v1';
  requestId: string;
  turnId: string;
  status: 'answered' | 'cancelled' | 'expired';
  text: string;
  answers?: Array<{ id: string; value: string }>;
};

/**
 * Host-owned model boundary. The Python sidecar may request a completion, but
 * never receives API keys; Electron main resolves the provider and returns a
 * bounded OpenAI-compatible response.
 */
export type XiazhiModelRequest = {
  schemaVersion: 'xiazhi.model.request.v1';
  requestId: string;
  turnId: string;
  capability: XiazhiCapabilityName;
  model: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  temperature?: number;
  maxTokens?: number;
};

export type XiazhiModelResult = {
  schemaVersion: 'xiazhi.model.result.v1';
  requestId: string;
  turnId: string;
  status: 'succeeded' | 'blocked' | 'failed';
  response?: {
    choices: Array<Record<string, unknown>>;
    usage?: Record<string, unknown>;
    recovery?: {
      attempted: boolean;
      reason?: 'empty_content' | 'length';
      firstFinishReason?: string;
      finalFinishReason?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export type AiAgentRun = {
  id: string;
  parentRunId: string;
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

export type XiazhiContinuationResult = {
  ok: boolean;
  runId?: string;
  turnId?: string;
  parentRunId?: string;
  continuationToken?: string;
  approvalRequired?: boolean;
  approvalCheckpointId?: string;
  requestedBudgets?: { maxEvents: number; maxWallMs: number };
  errorMessage?: string;
};

export type XiazhiRunMutationAction = 'retry' | 'branch' | 'regenerate';

export type XiazhiRunMutationResult = {
  ok: boolean;
  action: XiazhiRunMutationAction;
  sourceRunId: string;
  runId?: string;
  turnId?: string;
  parentRunId?: string;
  reused?: boolean;
  errorMessage?: string;
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
  beforeRunId: string;
  afterRunId: string;
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
  liveLinkedCount: number;
  improvementRate: number;
  averageScoreDelta: number;
  averageRoundsDelta: number;
  issueTransitionCounts: Record<string, number>;
  latestCreatedAt: string;
};

export type AiModelGraderMode = 'deterministic_proxy' | 'llm_judge';

export type AiModelGradeInput = {
  sampleId: string;
  runId?: string;
  sessionId?: string;
  prompt: string;
  answerMarkdown: string;
  route: AiIntentRoute;
  subIntent: AiSubIntent | string;
  targetGrade?: string;
  modelUnderReview?: string;
  graderModel?: string;
  graderMode?: AiModelGraderMode;
  promptVersion?: string;
  totalTokens?: number;
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
  runId: string;
  sessionId: string;
  prompt: string;
  answerMarkdown: string;
  route: AiIntentRoute;
  subIntent: string;
  targetGrade: string;
  modelUnderReview: string;
  graderModel: string;
  graderMode: AiModelGraderMode;
  promptVersion: string;
  totalTokens: number;
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
  runLinkedCount: number;
  tokenKnownCount: number;
  issueCounts: Record<string, number>;
  graderModeCounts: Record<string, number>;
  promptVersionCounts: Record<string, number>;
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
  minimumLiveLinkedReplayCount?: number;
  minimumModelGradeSamples?: number;
  minimumModelGradeScore?: number;
  minimumGradeAppropriatenessScore?: number;
  minimumRunLinkedModelGradeCount?: number;
};

export type AiConfirmationStatus = 'pending' | 'confirmed' | 'rejected' | 'failed';

export type AiConfirmationActionType = 'create_review_report' | 'save_exercise_set' | 'save_mastery_state';

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
  masteryOperation?: 'assess' | 'build';
  masteryAssessment?: {
    knowledgePointId: string;
    knowledgePointName: string;
    knowledgeType: 'concept' | 'design';
    passed: boolean;
    feedback?: string;
  };
  masteryPath?: {
    mode: 'replace' | 'append';
    modules: AiMasteryPathModule[];
  };
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
    masteryPath?: AiMasteryPath;
    masteryAttempt?: { studentId: string; knowledgePointId: string; passed: boolean };
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
  harnessVersion?: string;
  selectedCapability?: XiazhiCapabilityName;
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
  learningAnalytics?: {
    schemaVersion: 'omni.learning.analytics.v1';
    startDate: string;
    endDate: string;
    subject: string;
    sourceRecordIds: string[];
  };
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

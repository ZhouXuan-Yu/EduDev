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

export type BootstrapData = {
  dataRoot: string;
  students: Student[];
};

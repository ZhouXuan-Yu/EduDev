import { contextBridge, ipcRenderer } from 'electron';
import type {
  AttachmentImportResult,
  LearningRecordFilters,
  LearningRecordInput,
  LearningRecordUpdateInput,
  ReviewDraftInput,
  StudentInput,
} from '../shared/contracts';

const api = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  getDataRoot: () => ipcRenderer.invoke('app:getDataRoot') as Promise<string>,
  listStudents: (query = '') => ipcRenderer.invoke('students:list', query),
  createStudent: (input: StudentInput) => ipcRenderer.invoke('students:create', input),
  updateStudent: (id: string, input: StudentInput) => ipcRenderer.invoke('students:update', id, input),
  archiveStudent: (id: string) => ipcRenderer.invoke('students:archive', id),
  openStudentFolder: (id: string) => ipcRenderer.invoke('students:openFolder', id),
  exportStudent: (id: string) => ipcRenderer.invoke('students:export', id),
  listRecords: (studentId: string, filters: LearningRecordFilters = {}) => ipcRenderer.invoke('records:list', studentId, filters),
  createRecord: (input: LearningRecordInput) => ipcRenderer.invoke('records:create', input),
  updateRecord: (recordId: string, input: LearningRecordUpdateInput) => ipcRenderer.invoke('records:update', recordId, input),
  importAttachments: (studentId: string, recordId: string) => ipcRenderer.invoke('attachments:import', studentId, recordId) as Promise<AttachmentImportResult>,
  showAttachment: (filePath: string) => ipcRenderer.invoke('attachments:show', filePath),
  generateReview: (input: ReviewDraftInput) => ipcRenderer.invoke('reports:generate', input),
  updateReport: (id: string, contentMd: string, parentSummary?: string) => ipcRenderer.invoke('reports:update', id, contentMd, parentSummary),
  listReports: (studentId: string) => ipcRenderer.invoke('reports:list', studentId),
  searchAll: (keyword: string) => ipcRenderer.invoke('search:all', keyword),
};

contextBridge.exposeInMainWorld('omniEdu', api);

export type OmniEduApi = typeof api;

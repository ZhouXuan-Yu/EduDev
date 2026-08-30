import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
});

try {
  const { QuestionNotebookWorkspace } = await server.ssrLoadModule('/src/renderer/components/QuestionNotebookWorkspace.tsx');
  const { TeacherNotebookWorkspace } = await server.ssrLoadModule('/src/renderer/components/TeacherNotebookWorkspace.tsx');
  const { AiObservabilityWorkspace } = await server.ssrLoadModule('/src/renderer/components/AiObservabilityWorkspace.tsx');
  const { TeachingBookWorkspace } = await server.ssrLoadModule('/src/renderer/components/TeachingBookWorkspace.tsx');
  const { MemoryGovernanceWorkspace } = await server.ssrLoadModule('/src/renderer/components/MemoryGovernanceWorkspace.tsx');
  const { MistakesWorkspace } = await server.ssrLoadModule('/src/renderer/components/MistakesWorkspace.tsx');
  const { MasteryPathWorkspace, MasteryPathState } = await server.ssrLoadModule('/src/renderer/components/MasteryPathWorkspace.tsx');
  const { GlobalSearchWorkspace, GlobalSearchState } = await server.ssrLoadModule('/src/renderer/components/GlobalSearchWorkspace.tsx');
  const { ExerciseSetLibraryState } = await server.ssrLoadModule('/src/renderer/components/ExerciseSetLibrary.tsx');
  const { ReviewReminderState } = await server.ssrLoadModule('/src/renderer/components/ReviewReminderPanel.tsx');
  const { StudentProfileLifecycle } = await server.ssrLoadModule('/src/renderer/components/StudentProfileLifecycle.tsx');
  const { DataBackupPanel, DataBackupState } = await server.ssrLoadModule('/src/renderer/components/DataBackupPanel.tsx');
  const { AiConversationSidebar, AiConversationFeedback, AiConversationArchiveConfirmation } = await server.ssrLoadModule('/src/renderer/components/AiConversationSidebar.tsx');
  const { ReviewReportWorkspaceState } = await server.ssrLoadModule('/src/renderer/components/ReviewReportWorkspace.tsx');
  const { AiQualityReviewWorkspace, AiQualityReviewState, parseUsabilityReviewCsv, validateUsabilityReview } = await server.ssrLoadModule('/src/renderer/components/AiQualityReviewWorkspace.tsx');
  const noop = () => undefined;
  const loading = renderToStaticMarkup(React.createElement(QuestionNotebookWorkspace, { setStatus: noop }));
  assert.match(loading, /data-testid="question-notebook-workspace"/);
  assert.match(loading, /data-testid="question-notebook-loading"/);
  assert.match(loading, /data-testid="question-notebook-create-panel"/);
  assert.match(loading, /data-testid="question-notebook-create-question"/);
  assert.match(loading, /data-testid="question-notebook-category-admin"/);
  assert.match(loading, /data-testid="question-notebook-deleted-categories"/);

  const teacherNotebookLoading = renderToStaticMarkup(React.createElement(TeacherNotebookWorkspace, { setStatus: noop }));
  assert.match(teacherNotebookLoading, /data-testid="teacher-notebook-workspace"/);
  assert.match(teacherNotebookLoading, /data-testid="teacher-notebook-loading"/);

  const observabilityLoading = renderToStaticMarkup(React.createElement(AiObservabilityWorkspace));
  assert.match(observabilityLoading, /data-testid="ai-observability-workspace"/);
  assert.match(observabilityLoading, /data-testid="ai-observability-loading"/);

  const teachingBookLoading = renderToStaticMarkup(React.createElement(TeachingBookWorkspace, { setStatus: noop }));
  assert.match(teachingBookLoading, /data-testid="teaching-book-workspace"/);
  assert.match(teachingBookLoading, /data-testid="teaching-book-loading"/);
  assert.match(teachingBookLoading, /data-testid="teaching-book-create"/);

  const memoryLoading = renderToStaticMarkup(React.createElement(MemoryGovernanceWorkspace, { setStatus: noop }));
  assert.match(memoryLoading, /data-testid="memory-governance-workspace"/);
  assert.match(memoryLoading, /data-testid="memory-loading"/);
  assert.match(memoryLoading, /data-testid="memory-l2-records"/);
  assert.match(memoryLoading, /data-testid="memory-l3-panel"/);
  assert.match(memoryLoading, /data-testid="memory-evidence-graph"/);

  const mistakeRecord = { id: 'record_component_mistake', studentId: 'student_component', recordType: 'mistake', subject: '数学', title: '组件导入验收', content: '', summary: '', tags: [], occurredAt: '', createdAt: '', updatedAt: '', attachments: [] };
  const mistakeLoading = renderToStaticMarkup(React.createElement(MistakesWorkspace, {
    activeStudent: { id: 'student_component', displayName: '小智测试学生', realName: '', grade: '', school: '', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [], status: 'active', createdAt: '', updatedAt: '', recordCount: 1, attachmentBytes: 0 },
    records: [mistakeRecord], attachmentImport: null, aiResult: null, aiRunning: false, confirmations: [],
    onImportAttachment: async () => undefined, onSendAi: async () => undefined, onConfirm: async () => undefined, onReject: async () => undefined, setStatus: noop,
  }));
  assert.match(mistakeLoading, /data-testid="mistakes-workspace"/);
  assert.match(mistakeLoading, /data-testid="mistake-image-import-panel"/);
  assert.match(mistakeLoading, /data-testid="mistake-import-record_component_mistake"/);

  const masteryStudent = { id: 'student_mastery_component', displayName: '小智路径学生', realName: '', grade: '八年级', school: '', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [], status: 'active', createdAt: '', updatedAt: '', recordCount: 0, attachmentBytes: 0 };
  const masteryLoading = renderToStaticMarkup(React.createElement(MasteryPathWorkspace, { activeStudent: masteryStudent, setStatus: noop, onOpenAi: noop }));
  assert.match(masteryLoading, /data-testid="mastery-path-workspace"/);
  assert.match(masteryLoading, /data-testid="mastery-path-loading"/);
  const masteryEmpty = renderToStaticMarkup(React.createElement(MasteryPathState, { activeStudent: masteryStudent, path: null, loading: false, errorMessage: '', onRefresh: noop, onOpenAi: noop }));
  assert.match(masteryEmpty, /data-testid="mastery-path-empty"/);
  assert.match(masteryEmpty, /教师确认前不会写入本地正式路径/);
  const masteryError = renderToStaticMarkup(React.createElement(MasteryPathState, { activeStudent: masteryStudent, path: null, loading: false, errorMessage: 'SQLite read failed', onRefresh: noop, onOpenAi: noop }));
  assert.match(masteryError, /data-testid="mastery-path-error"/);
  assert.match(masteryError, /SQLite read failed/);
  const masteryContent = renderToStaticMarkup(React.createElement(MasteryPathState, {
    activeStudent: masteryStudent,
    path: { id: 'path_component', studentId: masteryStudent.id, version: 2, mode: 'append', status: 'active', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T01:00:00.000Z', modules: [{ id: 'module_functions', name: 'Functions', order: 0, knowledgePoints: [{ id: 'point_domain', name: 'domain', type: 'concept' }] }] },
    loading: false, errorMessage: '', onRefresh: noop, onOpenAi: noop,
  }));
  assert.match(masteryContent, /data-testid="mastery-path-content"/);
  assert.match(masteryContent, /版本 v2/);
  assert.match(masteryContent, /Functions/);
  assert.match(masteryContent, /domain/);
  assert.match(masteryContent, /data-testid="mastery-path-boundary"/);

  const searchWorkspace = renderToStaticMarkup(React.createElement(GlobalSearchWorkspace, { setStatus: noop, onOpenStudent: noop, onOpenRecord: noop }));
  assert.match(searchWorkspace, /data-testid="global-search-workspace"/);
  assert.match(searchWorkspace, /data-testid="global-search-idle"/);
  const searchLoading = renderToStaticMarkup(React.createElement(GlobalSearchState, { query: '斜率', loading: true, error: '', result: null, onOpenStudent: noop, onOpenRecord: noop }));
  assert.match(searchLoading, /data-testid="global-search-loading"/);
  const searchError = renderToStaticMarkup(React.createElement(GlobalSearchState, { query: '斜率', loading: false, error: 'SQLite unavailable', result: null, onOpenStudent: noop, onOpenRecord: noop }));
  assert.match(searchError, /data-testid="global-search-error"/);
  const searchEmpty = renderToStaticMarkup(React.createElement(GlobalSearchState, { query: '不存在', loading: false, error: '', result: { students: [], records: [] }, onOpenStudent: noop, onOpenRecord: noop }));
  assert.match(searchEmpty, /data-testid="global-search-empty"/);
  const searchPopulated = renderToStaticMarkup(React.createElement(GlobalSearchState, {
    query: '斜率', loading: false, error: '', onOpenStudent: noop, onOpenRecord: noop,
    result: {
      students: [masteryStudent],
      records: [{ id: 'record_search_component', studentId: masteryStudent.id, recordType: 'mistake', subject: '数学', title: '斜率错题', content: '斜率计算步骤', summary: '', tags: ['一次函数'], occurredAt: '', createdAt: '', updatedAt: '', attachments: [] }],
    },
  }));
  assert.match(searchPopulated, /data-testid="global-search-results"/);
  assert.match(searchPopulated, /global-search-student-student_mastery_component/);
  assert.match(searchPopulated, /global-search-record-record_search_component/);

  const exerciseSetNoStudent = renderToStaticMarkup(React.createElement(ExerciseSetLibraryState, { exerciseSets: [], loading: false, errorMessage: '', onRefresh: noop }));
  assert.match(exerciseSetNoStudent, /data-testid="exercise-set-no-student"/);
  const exerciseSetLoading = renderToStaticMarkup(React.createElement(ExerciseSetLibraryState, { activeStudent: masteryStudent, exerciseSets: [], loading: true, errorMessage: '', onRefresh: noop }));
  assert.match(exerciseSetLoading, /data-testid="exercise-set-loading"/);
  const exerciseSetError = renderToStaticMarkup(React.createElement(ExerciseSetLibraryState, { activeStudent: masteryStudent, exerciseSets: [], loading: false, errorMessage: 'SQLite read failed', onRefresh: noop }));
  assert.match(exerciseSetError, /data-testid="exercise-set-error"/);
  assert.match(exerciseSetError, /SQLite read failed/);
  const exerciseSetEmpty = renderToStaticMarkup(React.createElement(ExerciseSetLibraryState, { activeStudent: masteryStudent, exerciseSets: [], loading: false, errorMessage: '', onRefresh: noop }));
  assert.match(exerciseSetEmpty, /data-testid="exercise-set-empty"/);
  assert.match(exerciseSetEmpty, /教师确认后才会写入/);
  const exerciseSetContent = renderToStaticMarkup(React.createElement(ExerciseSetLibraryState, {
    activeStudent: masteryStudent, loading: false, errorMessage: '', onRefresh: noop,
    exerciseSets: [{
      id: 'exercise_component', studentId: masteryStudent.id, title: '一次函数三元题组', subject: '数学', knowledgePoint: '一次函数', contentMd: '', sourceQuestionIds: ['question_local'], createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
      items: [
        { role: 'original', questionId: 'question_local', sourceKind: 'local_bank', stem: '求斜率。', answer: '2', analysis: '读取系数。', knowledgePoint: '一次函数', difficulty: 'easy', teacherObservation: '需注意符号。' },
        { role: 'variant', sourceKind: 'generated', stem: '变式题。', answer: '待复核', analysis: '', knowledgePoint: '一次函数', difficulty: 'medium', teacherObservation: '' },
      ],
    }],
  }));
  assert.match(exerciseSetContent, /data-testid="exercise-set-content"/);
  assert.match(exerciseSetContent, /exercise-set-card-exercise_component/);
  assert.match(exerciseSetContent, /本地题库/);
  assert.match(exerciseSetContent, /小智生成 · 待教师复核/);

  const reviewNoStudent = renderToStaticMarkup(React.createElement(ReviewReminderState, { reminder: null, loading: false, errorMessage: '', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewNoStudent, /data-testid="review-reminder-no-student"/);
  const reviewLoading = renderToStaticMarkup(React.createElement(ReviewReminderState, { activeStudent: masteryStudent, reminder: null, loading: true, errorMessage: '', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewLoading, /data-testid="review-reminder-loading"/);
  const reviewError = renderToStaticMarkup(React.createElement(ReviewReminderState, { activeStudent: masteryStudent, reminder: null, loading: false, errorMessage: 'SQLite unavailable', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewError, /data-testid="review-reminder-error"/);
  assert.match(reviewError, /SQLite unavailable/);
  const reviewBase = { schemaVersion: 'omni.review.reminder.v1', generatedAt: 1770000000, horizonSeconds: 604800, nextAt: null, timezone: 'UTC', timezoneInvariant: true, source: 'omni_edu_learning_records', rawRecordsIncluded: false, requiresTeacherReview: true };
  const reviewClear = renderToStaticMarkup(React.createElement(ReviewReminderState, { activeStudent: masteryStudent, reminder: { ...reviewBase, status: 'clear', dueCount: 0, upcomingCount: 0, items: [] }, loading: false, errorMessage: '', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewClear, /data-testid="review-reminder-clear"/);
  const reviewUpcoming = renderToStaticMarkup(React.createElement(ReviewReminderState, { activeStudent: masteryStudent, reminder: { ...reviewBase, status: 'upcoming', dueCount: 0, upcomingCount: 1, items: [{ id: 'review_upcoming', knowledgePointId: 'point_upcoming', name: '一次函数图像', moduleId: 'module_math', moduleName: '函数', type: 'concept', dueAt: 1770003600, state: 'upcoming' }] }, loading: false, errorMessage: '', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewUpcoming, /data-testid="review-reminder-upcoming"/);
  assert.match(reviewUpcoming, /即将到期/);
  const reviewDue = renderToStaticMarkup(React.createElement(ReviewReminderState, { activeStudent: masteryStudent, reminder: { ...reviewBase, status: 'due', dueCount: 1, upcomingCount: 0, items: [{ id: 'review_due', knowledgePointId: 'point_due', name: '斜率计算', moduleId: 'module_math', moduleName: '函数', type: 'procedure', dueAt: 1769990000, state: 'due' }] }, loading: false, errorMessage: '', onRefresh: noop, onOpenEvidence: noop }));
  assert.match(reviewDue, /data-testid="review-reminder-due"/);
  assert.match(reviewDue, /review-reminder-item-review_due/);
  assert.match(reviewDue, /不包含学习记录正文、答案或附件路径/);

  const studentLifecycleBaseProps = {
    form: { displayName: '', subjects: ['数学'] }, onFormChange: noop, onSave: async () => undefined,
    onStartEdit: noop, onCancelForm: noop, onStudentsChanged: noop, setStatus: noop,
  };
  const studentLifecycleEmpty = renderToStaticMarkup(React.createElement(StudentProfileLifecycle, { ...studentLifecycleBaseProps, formMode: 'closed' }));
  assert.match(studentLifecycleEmpty, /data-testid="student-profile-lifecycle"/);
  assert.match(studentLifecycleEmpty, /data-testid="student-lifecycle-no-student"/);
  const studentLifecycleActive = renderToStaticMarkup(React.createElement(StudentProfileLifecycle, { ...studentLifecycleBaseProps, activeStudent: masteryStudent, formMode: 'closed' }));
  assert.match(studentLifecycleActive, /data-testid="student-profile-readback"/);
  assert.match(studentLifecycleActive, /data-testid="student-status-active"/);
  assert.match(studentLifecycleActive, /data-testid="student-export"/);
  assert.match(studentLifecycleActive, /data-testid="student-archive"/);
  const archivedStudent = { ...masteryStudent, status: 'archived' };
  const studentLifecycleArchived = renderToStaticMarkup(React.createElement(StudentProfileLifecycle, { ...studentLifecycleBaseProps, activeStudent: archivedStudent, formMode: 'closed' }));
  assert.match(studentLifecycleArchived, /data-testid="student-status-archived"/);
  assert.match(studentLifecycleArchived, /归档档案只读保留/);
  const studentLifecycleCreate = renderToStaticMarkup(React.createElement(StudentProfileLifecycle, { ...studentLifecycleBaseProps, activeStudent: masteryStudent, formMode: 'create' }));
  assert.match(studentLifecycleCreate, /data-testid="student-profile-form"/);
  assert.match(studentLifecycleCreate, /data-testid="student-form-display-name"/);
  assert.match(studentLifecycleCreate, /教师备注/);

  const backupWorkspace = renderToStaticMarkup(React.createElement(DataBackupPanel, { dataRoot: 'D:\\OmniEduData', setStatus: noop }));
  assert.match(backupWorkspace, /data-testid="data-backup-panel"/);
  assert.match(backupWorkspace, /data-testid="data-backup-idle"/);
  assert.match(backupWorkspace, /data-testid="data-backup-export"/);
  assert.match(backupWorkspace, /data-testid="data-backup-verify"/);
  const backupLoading = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'exporting', message: '正在备份' } }));
  assert.match(backupLoading, /data-testid="data-backup-loading"/);
  const backupExportSuccess = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'export_success', message: '备份完成', exportResult: { exportPath: 'D:\\Backup', manifestPath: 'D:\\Backup\\manifest.json', fileCount: 3, verified: true } } }));
  assert.match(backupExportSuccess, /data-testid="data-backup-export-success"/);
  assert.match(backupExportSuccess, /data-testid="data-backup-manifest-path"/);
  const backupVerifySuccess = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'verify_success', message: '校验通过', verificationResult: { backupPath: 'D:\\Backup', manifestPath: 'D:\\Backup\\manifest.json', verified: true, fileCount: 3, missingFiles: [], changedFiles: [], unexpectedFiles: [] } } }));
  assert.match(backupVerifySuccess, /data-testid="data-backup-verify-success"/);
  const backupVerifyFailed = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'verification_failed', message: '校验失败', verificationResult: { backupPath: 'D:\\Backup', manifestPath: 'D:\\Backup\\manifest.json', verified: false, fileCount: 3, missingFiles: ['missing.db'], changedFiles: ['changed.db'], unexpectedFiles: ['extra.txt'], errorMessage: '备份文件与清单不一致' } } }));
  assert.match(backupVerifyFailed, /data-testid="data-backup-verify-failed"/);
  assert.match(backupVerifyFailed, /missing.db/);
  assert.match(backupVerifyFailed, /changed.db/);
  assert.match(backupVerifyFailed, /extra.txt/);
  const backupCancelled = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'cancelled', message: '已取消' } }));
  assert.match(backupCancelled, /data-testid="data-backup-cancelled"/);
  const backupError = renderToStaticMarkup(React.createElement(DataBackupState, { state: { status: 'error', message: 'IPC failed' } }));
  assert.match(backupError, /data-testid="data-backup-error"/);
  assert.match(backupError, /IPC failed/);

  const conversationBaseProps = {
    folders: [], sessions: [], activeSessionId: '', onOpenSession: noop, onNewSession: noop,
    onCreateFolder: async () => undefined, onMoveSession: async () => undefined,
    onRename: async () => undefined, onArchive: async () => undefined,
  };
  const conversationEmpty = renderToStaticMarkup(React.createElement(AiConversationSidebar, conversationBaseProps));
  assert.match(conversationEmpty, /data-testid="ai-conversation-sidebar"/);
  assert.match(conversationEmpty, /data-testid="ai-conversation-empty-inbox"/);
  assert.match(conversationEmpty, /data-testid="ai-conversation-folder-new"/);
  const conversationPopulated = renderToStaticMarkup(React.createElement(AiConversationSidebar, {
    ...conversationBaseProps,
    folders: [{ id: 'folder_component', name: '初二数学', createdAt: '', updatedAt: '' }],
    sessions: [{ id: 'session_component', folderId: 'folder_component', studentId: 'student_component', title: '一次函数复盘', lastPrompt: '分析错因', lastResponsePreview: '先核对符号。', messageCount: 2, createdAt: '', updatedAt: '' }],
    activeSessionId: 'session_component',
  }));
  assert.match(conversationPopulated, /data-testid="ai-conversation-folder-folder_component"/);
  assert.match(conversationPopulated, /data-testid="ai-conversation-session-session_component"/);
  assert.match(conversationPopulated, /一次函数复盘/);
  const conversationWorking = renderToStaticMarkup(React.createElement(AiConversationFeedback, { state: { status: 'working', message: '正在移动对话…' } }));
  assert.match(conversationWorking, /data-testid="ai-conversation-working"/);
  const conversationSuccess = renderToStaticMarkup(React.createElement(AiConversationFeedback, { state: { status: 'success', message: '移动对话完成。' } }));
  assert.match(conversationSuccess, /data-testid="ai-conversation-success"/);
  const conversationError = renderToStaticMarkup(React.createElement(AiConversationFeedback, { state: { status: 'error', message: 'SQLite unavailable' } }));
  assert.match(conversationError, /data-testid="ai-conversation-error"/);
  assert.match(conversationError, /SQLite unavailable/);
  const conversationConfirmation = renderToStaticMarkup(React.createElement(AiConversationArchiveConfirmation, { target: { type: 'folder', id: 'folder_component', name: '初二数学' }, busy: false, onConfirm: noop, onCancel: noop }));
  assert.match(conversationConfirmation, /data-testid="ai-conversation-archive-confirmation"/);
  assert.match(conversationConfirmation, /文件夹及其中对话将从小智侧栏隐藏/);

  const reviewReportForm = { subject: '数学', startDate: '2026-08-01', endDate: '2026-08-12', reportType: 'monthly' };
  const reviewReportRecord = { id: 'record_review_component', studentId: masteryStudent.id, recordType: 'mistake', subject: '数学', title: '一次函数符号错误', content: '符号变化', summary: '', tags: ['一次函数'], occurredAt: '2026-08-10T00:00:00.000Z', createdAt: '', updatedAt: '', attachments: [] };
  const reviewReport = {
    id: 'report_component', studentId: masteryStudent.id, subject: '数学', startDate: '2026-08-01', endDate: '2026-08-12', reportType: 'monthly', title: '数学阶段复盘',
    contentMd: '# 数学阶段复盘', parentSummary: '继续观察符号变化。', sourceRecordIds: [reviewReportRecord.id],
    qualityChecks: [{ key: 'evidence', label: '证据绑定', passed: true, detail: '已绑定本地记录。' }], createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T01:00:00.000Z',
  };
  const reviewReportProps = { activeStudent: masteryStudent, records: [reviewReportRecord], reports: [], form: reviewReportForm, activeReport: null, uiState: { status: 'idle', message: '' }, onFormChange: noop, onGenerate: noop, onSelectReport: noop, onReportChange: noop, onSave: noop };
  const reviewReportNoStudent = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, activeStudent: undefined }));
  assert.match(reviewReportNoStudent, /data-testid="review-report-no-student"/);
  const reviewReportIdle = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, reviewReportProps));
  assert.match(reviewReportIdle, /data-testid="review-report-idle"/);
  assert.match(reviewReportIdle, /data-testid="review-report-history-empty"/);
  assert.match(reviewReportIdle, /data-testid="review-report-editor-empty"/);
  const reviewReportLoading = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, uiState: { status: 'generating', message: '正在生成' } }));
  assert.match(reviewReportLoading, /data-testid="review-report-loading"/);
  const reviewReportError = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, uiState: { status: 'error', message: '日期无效' } }));
  assert.match(reviewReportError, /data-testid="review-report-error"/);
  assert.match(reviewReportError, /日期无效/);
  const reviewReportDraft = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, reports: [reviewReport], activeReport: reviewReport, uiState: { status: 'draft', message: '尚未保存' } }));
  assert.match(reviewReportDraft, /data-testid="review-report-draft"/);
  assert.match(reviewReportDraft, /review-report-evidence-record_review_component/);
  assert.match(reviewReportDraft, /review-report-quality-evidence/);
  assert.match(reviewReportDraft, /Markdown 初始快照不代表最终稿/);
  const reviewReportSaved = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, reports: [reviewReport], activeReport: reviewReport, uiState: { status: 'saved', message: '已保存' } }));
  assert.match(reviewReportSaved, /data-testid="review-report-saved"/);
  assert.match(reviewReportSaved, /review-report-history-report_component/);
  const reportWithoutEvidence = { ...reviewReport, id: 'report_without_evidence', sourceRecordIds: [] };
  const reviewReportEvidenceEmpty = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, reports: [reportWithoutEvidence], activeReport: reportWithoutEvidence, uiState: { status: 'draft', message: '待补充' } }));
  assert.match(reviewReportEvidenceEmpty, /data-testid="review-report-evidence-empty"/);
  const foreignReport = { ...reviewReport, id: 'foreign_report', studentId: 'other_student' };
  const reviewReportIsolated = renderToStaticMarkup(React.createElement(ReviewReportWorkspaceState, { ...reviewReportProps, reports: [foreignReport], activeReport: null }));
  assert.doesNotMatch(reviewReportIsolated, /foreign_report/);

  const qualityReviewLoading = renderToStaticMarkup(React.createElement(AiQualityReviewWorkspace, { model: 'deepseek-v4-flash', onReplayPrompt: noop, setStatus: noop }));
  assert.match(qualityReviewLoading, /data-testid="ai-quality-review-workspace"/);
  assert.match(qualityReviewLoading, /data-testid="ai-quality-review-loading"/);
  const emptyHumanSummary = { sampleCount: 0, averageTeacherScore: 0, minTeacherScore: 0, passedCount: 0, needsRewriteCount: 0, averageRoundsToUseful: 0, routeCounts: {}, issueCounts: {}, latestReviewedAt: '' };
  const emptyReplaySummary = { experimentCount: 0, improvedCount: 0, unresolvedCount: 0, liveLinkedCount: 0, improvementRate: 0, averageScoreDelta: 0, averageRoundsDelta: 0, issueTransitionCounts: {}, latestCreatedAt: '' };
  const emptyModelSummary = { sampleCount: 0, passedCount: 0, failedCount: 0, averageOverallScore: 0, minOverallScore: 0, averageGradeAppropriatenessScore: 0, runLinkedCount: 0, tokenKnownCount: 0, issueCounts: {}, graderModeCounts: {}, promptVersionCounts: {}, latestReviewedAt: '' };
  const qualityForm = { sampleId: '', prompt: '', route: 'student_diagnosis', subIntent: 'student_progress', teacherScore: 4, needsRewrite: false, roundsToUseful: 1, mainIssueCode: 'none', teacherNote: '', model: 'deepseek-v4-flash', reviewedAt: '2026-08-12T10:00' };
  const qualityBaseProps = { status: 'idle', message: '', reviews: [], humanSummary: emptyHumanSummary, experiments: [], replaySummary: emptyReplaySummary, modelGrades: [], modelSummary: emptyModelSummary, form: qualityForm, csvText: '', selectedBeforeId: '', onFormChange: noop, onCsvChange: noop, onSave: noop, onImport: noop, onRefresh: noop, onSelectBefore: noop, onCancelBefore: noop, onReplay: noop };
  const qualityIdle = renderToStaticMarkup(React.createElement(AiQualityReviewState, qualityBaseProps));
  assert.match(qualityIdle, /data-testid="ai-quality-failures-empty"/);
  assert.match(qualityIdle, /data-testid="ai-quality-experiments-empty"/);
  assert.match(qualityIdle, /data-testid="ai-quality-model-grades-empty"/);
  assert.match(qualityIdle, /data-testid="ai-quality-csv-file"/);
  const qualityError = renderToStaticMarkup(React.createElement(AiQualityReviewState, { ...qualityBaseProps, status: 'error', message: 'teacherScore 必须是 1 到 5 的整数。' }));
  assert.match(qualityError, /data-testid="ai-quality-review-error"/);
  assert.match(qualityError, /teacherScore/);
  const qualityWorking = renderToStaticMarkup(React.createElement(AiQualityReviewState, { ...qualityBaseProps, status: 'saving', message: '正在保存人工评分…' }));
  assert.match(qualityWorking, /data-testid="ai-quality-review-working"/);
  const qualitySuccess = renderToStaticMarkup(React.createElement(AiQualityReviewState, { ...qualityBaseProps, status: 'success', message: '人工评分已保存到本地 SQLite。' }));
  assert.match(qualitySuccess, /data-testid="ai-quality-review-success"/);
  const qualityReview = { id: 'quality_review_before', sampleId: 'teacher_before', runId: '', sessionId: '', prompt: '请分析小A的错题。', route: 'student_diagnosis', subIntent: 'student_progress', model: 'deepseek-v4-flash', teacherScore: 2, needsRewrite: true, roundsToUseful: 4, mainIssueCode: 'evidence_gap', teacherNote: '证据不足', reviewedAt: '', createdAt: '' };
  const qualityExperiment = { id: 'quality_experiment', beforeReviewId: qualityReview.id, afterReviewId: 'quality_after', beforeRunId: '', afterRunId: '', replayPrompt: qualityReview.prompt, modelBefore: qualityReview.model, modelAfter: qualityReview.model, promptVersionBefore: '', promptVersionAfter: 'manual-ui-v1.4', experimentNote: '', scoreBefore: 2, scoreAfter: 5, scoreDelta: 3, roundsBefore: 4, roundsAfter: 1, roundsDelta: -3, issueBefore: 'evidence_gap', issueAfter: 'none', improved: true, createdAt: '' };
  const qualityGrade = { id: 'quality_grade', sampleId: 'grader_sample', runId: 'run_quality', sessionId: '', prompt: '请分析小A的错题。', answerMarkdown: '基于三条记录。', route: 'student_diagnosis', subIntent: 'student_progress', targetGrade: '八年级', modelUnderReview: 'deepseek-v4-flash', graderModel: 'proxy', graderMode: 'deterministic_proxy', promptVersion: 'v1', totalTokens: 0, evidenceScore: 4, actionabilityScore: 4, safetyScore: 5, gradeAppropriatenessScore: 4, concisionScore: 4, teacherControlScore: 5, overallScore: 4.33, passed: true, issueCodes: [], graderRationale: '通过', reviewedAt: '', createdAt: '' };
  const qualityPopulated = renderToStaticMarkup(React.createElement(AiQualityReviewState, { ...qualityBaseProps, reviews: [qualityReview], humanSummary: { ...emptyHumanSummary, sampleCount: 1, averageTeacherScore: 2, minTeacherScore: 2, needsRewriteCount: 1, averageRoundsToUseful: 4 }, experiments: [qualityExperiment], replaySummary: { ...emptyReplaySummary, experimentCount: 1, improvedCount: 1, improvementRate: 1, averageScoreDelta: 3, averageRoundsDelta: -3 }, modelGrades: [qualityGrade], modelSummary: { ...emptyModelSummary, sampleCount: 1, passedCount: 1, averageOverallScore: 4.33, runLinkedCount: 1 } }));
  assert.match(qualityPopulated, /ai-quality-review-quality_review_before/);
  assert.match(qualityPopulated, /ai-quality-experiment-quality_experiment/);
  assert.match(qualityPopulated, /deterministic_proxy/);
  assert.match(qualityPopulated, /不把 proxy 冒充真实模型裁判/);
  const qualitySelected = renderToStaticMarkup(React.createElement(AiQualityReviewState, { ...qualityBaseProps, reviews: [qualityReview], selectedBeforeId: qualityReview.id }));
  assert.match(qualitySelected, /data-testid="ai-quality-selected-before"/);
  assert.match(qualitySelected, /teacher_before/);
  const parsedQualityRows = parseUsabilityReviewCsv('sampleId,prompt,route,subIntent,teacherScore,needsRewrite,roundsToUseful,mainIssueCode\nteacher_csv,请解释斜率,general_qa,concept_explanation,5,false,1,none');
  assert.equal(parsedQualityRows.length, 1);
  assert.equal(validateUsabilityReview(parsedQualityRows[0]), '');
  assert.match(validateUsabilityReview({ ...parsedQualityRows[0], teacherScore: 6 }), /1 到 5/);

  console.log(JSON.stringify({ suite: 'renderer-component-states', passed: 79, total: 79 }, null, 2));
} finally {
  await server.close();
}

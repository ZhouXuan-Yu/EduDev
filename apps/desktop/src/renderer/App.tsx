import {
  Archive,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Database,
  FileDown,
  FileSearch,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  History,
  Home,
  Layers3,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput } from './heroui-pro/components/chat-attachment';
import { ChainOfThought } from './heroui-pro/components/chain-of-thought';
import { ChatConversation } from './heroui-pro/components/chat-conversation';
import { ChatMessage } from './heroui-pro/components/chat-message';
import { Markdown } from './heroui-pro/components/markdown';
import { PromptInput } from './heroui-pro/components/prompt-input';
import { PromptSuggestion } from './heroui-pro/components/prompt-suggestion';
import { MistakesWorkspace } from './components/MistakesWorkspace';
import { QuestionNotebookWorkspace } from './components/QuestionNotebookWorkspace';
import { TeacherNotebookWorkspace } from './components/TeacherNotebookWorkspace';
import { AiObservabilityWorkspace } from './components/AiObservabilityWorkspace';
import { TeachingBookWorkspace } from './components/TeachingBookWorkspace';
import { MemoryGovernanceWorkspace } from './components/MemoryGovernanceWorkspace';
import { MasteryPathWorkspace } from './components/MasteryPathWorkspace';
import { GlobalSearchWorkspace } from './components/GlobalSearchWorkspace';
import { ReviewReminderPanel } from './components/ReviewReminderPanel';
import { StudentProfileLifecycle, type StudentFormMode } from './components/StudentProfileLifecycle';
import { DataBackupPanel } from './components/DataBackupPanel';
import { AiConversationSidebar, type AiConversationTarget } from './components/AiConversationSidebar';
import { ReviewReportWorkspace } from './components/ReviewReportWorkspace';
import { AiQualityReviewWorkspace } from './components/AiQualityReviewWorkspace';
import type {
  AiConfirmationItem,
  AiConsoleRunResult,
  AiConversationFolder,
  AiConversationMessage,
  AiConversationSession,
  AiConversationWorkspace,
  AiAgentTraceStep,
  XiazhiCapabilityEvent,
  XiazhiUserInputRequest,
  AttachmentImportResult,
  DeepSeekSettings,
  DocumentArtifactExportResult,
  DocumentArtifactType,
  KnowledgeImportResult,
  KnowledgeOverview,
  LearningRecord,
  PlatformOverview,
  ReviewReport,
  Student,
  StudentInput,
} from '../shared/contracts';

const recordTypeLabels: Record<string, string> = {
  class: '课堂',
  homework: '作业',
  exam: '试卷',
  mistake: '错题',
  communication: '沟通',
  summary: '阶段总结',
};

const emptyOverview: PlatformOverview = {
  tagCount: 0,
  reportTemplateCount: 0,
  pendingSyncOperations: 0,
  pendingAiTasks: 0,
  teacherCount: 0,
  assignmentCount: 0,
  analytics: {
    activeStudents: 0,
    totalRecords: 0,
    totalReports: 0,
    totalAttachments: 0,
  },
};

const initialStudentForm: StudentInput = {
  displayName: '',
  grade: '',
  subjects: ['数学'],
  goals: '',
  currentIssues: '',
  parentConcerns: '',
  teacherNotes: '',
  tags: [],
};

const initialDeepSeekSettings: DeepSeekSettings = {
  configured: false,
  model: 'deepseek-v4-flash',
  maskedApiKey: '',
  updatedAt: '',
};

const emptyKnowledgeOverview: KnowledgeOverview = {
  resources: [],
  chunks: [],
  nodes: [],
  edges: [],
  counts: {
    resources: 0,
    parsedResources: 0,
    chunks: 0,
    nodes: 0,
    edges: 0,
    queuedTasks: 0,
  },
};


type ViewKey = 'today' | 'ai' | 'knowledge' | 'students' | 'mastery' | 'intake' | 'mistakes' | 'review' | 'search' | 'question_notebook' | 'notebook' | 'book' | 'memory' | 'team' | 'analytics' | 'settings';

type AiArtifact = {
  id: string;
  title: string;
  type: string;
  artifactType: DocumentArtifactType;
  fileName: string;
  mimeType: string;
  description: string;
  content: string;
  exportStatus?: DocumentArtifactExportResult['status'];
  filePath?: string;
  fileSize?: number;
  contentHash?: string;
  errorMessage?: string;
};

type AiThoughtStep = Pick<AiAgentTraceStep, 'label' | 'detail'>;

type DeepTutorContinuationNotice = {
  runId: string;
  continuationToken: string;
  continuationCount: number;
  approvalCheckpointId?: string;
  approvalRequired?: boolean;
  requestedBudgets?: { maxEvents: number; maxWallMs: number };
};

type AiTraceSource = {
  title: string;
  source: string;
  detail: string;
};

type AiTraceTool = {
  toolName: string;
  state: 'output-available' | 'requires-action' | 'input-streaming' | 'output-error';
  argsText: string;
  output: Record<string, unknown>;
};

const aiPromptSuggestions = [
  '查小A最近7天错题，给我3个今天能用的练习',
  '根据小A学习进度生成三元题组草稿，先不要保存',
  '把小A本周记录整理成家长沟通草稿，语气克制一点',
  '看看小A档案还缺哪些关键信息，只列补全清单',
  '把当前知识点做成15分钟课堂导入和2个检查点',
  '查看待确认项，告诉我哪些值得保存、哪些先拒绝',
];

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function PromptSuggestionPanel({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (value: string) => void;
}) {
  return (
    <PromptSuggestion className="ai-suggestion-panel">
      <PromptSuggestion.Header>
        <PromptSuggestion.Title>
          今天想让小智做什么？
        </PromptSuggestion.Title>
        <PromptSuggestion.Description>
          直接说学生、时间、目标；小智会自己路由到学生数据、题库、知识库或确认队列。
        </PromptSuggestion.Description>
      </PromptSuggestion.Header>
      <PromptSuggestion.Items>
        {suggestions.map((suggestion) => (
          <PromptSuggestion.Item
            key={suggestion}
            onClick={() => onPick(suggestion)}
          >
            {suggestion}
          </PromptSuggestion.Item>
        ))}
      </PromptSuggestion.Items>
    </PromptSuggestion>
  );
}

function WorkspaceLabel({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <div className="workspace-label">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

function ProKpiCard({
  label,
  value,
  detail,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  trend?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="pro-kpi-card">
      <div className="pro-kpi-head">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <div className="pro-kpi-foot">
        <p>{detail}</p>
        {trend ? <span className="trend-chip">{trend}</span> : null}
      </div>
    </article>
  );
}

function ProToolCard({
  label,
  name,
  status,
  description,
}: {
  label: string;
  name: string;
  status: string;
  description: string;
}) {
  return (
    <article className="pro-tool-card">
      <div>
        <strong>{label}</strong>
        <code>{name}</code>
      </div>
      <Badge tone={status === '未接入' || status.includes('需') ? 'amber' : 'blue'}>{status}</Badge>
      <p>{description}</p>
    </article>
  );
}

function ProSourceCard({
  title,
  type,
  detail,
  count,
  icon,
}: {
  title: string;
  type: string;
  detail: string;
  count: string | number;
  icon: ReactNode;
}) {
  return (
    <article className="pro-source-card">
      <div className="source-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{type}</span>
        <p>{detail}</p>
      </div>
      <em>{count}</em>
    </article>
  );
}

function ProQueueItem({
  index,
  title,
  status,
  detail,
}: {
  index: number;
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <article className="pro-queue-item">
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <Badge tone={status === '未接入' ? 'amber' : 'neutral'}>{status}</Badge>
    </article>
  );
}

function splitList(value: string) {
  return value
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN');
}

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('ai');
  const [dataRoot, setDataRoot] = useState('正在连接本地数据目录');
  const [overview, setOverview] = useState<PlatformOverview>(emptyOverview);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [reviewReportSelectionId, setReviewReportSelectionId] = useState('');
  const [activeStudentId, setActiveStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [recordKeyword, setRecordKeyword] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('');
  const [recordSubjectFilter, setRecordSubjectFilter] = useState('');
  const [recordTagFilter, setRecordTagFilter] = useState('');
  const [recordStartDate, setRecordStartDate] = useState('');
  const [recordEndDate, setRecordEndDate] = useState('');
  const [aiPrompt, setAiPrompt] = useState('帮我分析当前学生最近一个月的主要错因，并结合老师知识库生成巩固练习建议。');
  const [aiRunning, setAiRunning] = useState(false);
  const [deepTutorEvents, setDeepTutorEvents] = useState<XiazhiCapabilityEvent[]>([]);
  const [deepTutorContinuation, setDeepTutorContinuation] = useState<DeepTutorContinuationNotice | null>(null);
  const continuationInFlightRef = useRef(false);
  const [pendingUserInput, setPendingUserInput] = useState<XiazhiUserInputRequest | null>(null);
  const [userInputText, setUserInputText] = useState('');
  const [aiResult, setAiResult] = useState<AiConsoleRunResult | null>(null);
  const [activeAiArtifact, setActiveAiArtifact] = useState<AiArtifact | null>(null);
  const [artifactPanelWidth, setArtifactPanelWidth] = useState(420);
  const [aiFolders, setAiFolders] = useState<AiConversationFolder[]>([]);
  const [aiSessions, setAiSessions] = useState<AiConversationSession[]>([]);
  const [archivedAiFolders, setArchivedAiFolders] = useState<AiConversationFolder[]>([]);
  const [archivedAiSessions, setArchivedAiSessions] = useState<AiConversationSession[]>([]);
  const [aiMessages, setAiMessages] = useState<AiConversationMessage[]>([]);
  const [aiMutationRunningId, setAiMutationRunningId] = useState('');
  const [aiConfirmations, setAiConfirmations] = useState<AiConfirmationItem[]>([]);
  const [activeAiSessionId, setActiveAiSessionId] = useState<string>('');
  const aiSubmitInFlightRef = useRef(false);
  const [deepSeekSettings, setDeepSeekSettings] = useState<DeepSeekSettings>(initialDeepSeekSettings);
  const [deepSeekForm, setDeepSeekForm] = useState({ apiKey: '', model: 'deepseek-v4-flash' });
  const [studentForm, setStudentForm] = useState<StudentInput>(initialStudentForm);
  const [studentFormMode, setStudentFormMode] = useState<StudentFormMode>('closed');
  const [recordForm, setRecordForm] = useState({
    recordType: 'mistake',
    subject: '数学',
    title: '',
    content: '',
    tags: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [status, setStatus] = useState('本地工作台正在准备。');
  const [attachmentImport, setAttachmentImport] = useState<AttachmentImportResult | null>(null);
  const [knowledgeOverview, setKnowledgeOverview] = useState<KnowledgeOverview>(emptyKnowledgeOverview);
  const [knowledgeImport, setKnowledgeImport] = useState<KnowledgeImportResult | null>(null);

  const activeStudent = useMemo(() => {
    const selected = students.find((student) => student.id === activeStudentId);
    if (activeView === 'students') return selected ?? students.find((student) => student.status === 'active') ?? students[0];
    return selected?.status === 'active' ? selected : students.find((student) => student.status === 'active');
  }, [students, activeStudentId, activeView]);

  const recentStudents = students.filter((student) => student.status === 'active').slice(0, 6);
  const activeAttachments = records.flatMap((record) =>
    record.attachments.map((attachment) => ({
      ...attachment,
      recordTitle: record.title,
    })),
  );

  const mistakeRecords = records.filter((record) => record.recordType === 'mistake');
  const toolPlan = [
    { name: 'get_student_profile', label: '读取学生档案', status: activeStudent ? '可调用' : '需选择学生', description: '读取阶段目标、当前问题、家长关注点和标签。' },
    { name: 'search_learning_records', label: '检索学习记录', status: `${records.length} 条可检索`, description: '按时间、科目、类型、标签和关键词筛选当前学生证据。' },
    { name: 'list_attachment_metadata', label: '读取附件元数据', status: `${activeAttachments.length} 个附件`, description: '只读取文件名、路径、大小和 hash，不读取原始大文件。' },
    { name: 'search_teacher_knowledge', label: '检索老师知识库', status: knowledgeOverview.counts.chunks ? `${knowledgeOverview.counts.chunks} 个切片` : '待导入资源', description: '检索已解析的老师资源切片，PDF/Word 等重型解析会进入待处理队列。' },
    { name: 'query_knowledge_graph', label: '查询知识图谱', status: knowledgeOverview.counts.nodes ? `${knowledgeOverview.counts.nodes} 节点` : '待生成节点', description: '读取资源、章节和来源关系，所有节点来自本地真实资源。' },
    { name: 'generate_review_draft', label: '生成复盘草稿', status: '需老师确认', description: '生成内容不会直接保存，必须由老师编辑确认。' },
    { name: 'generate_mistake_triplet', label: '生成三元题组', status: '需老师确认', description: '已连接本地题库召回与 generated 来源边界；保存必须经过确认队列。' },
  ];
  const knowledgePipeline = [
    { label: '资源导入', status: `${knowledgeOverview.counts.resources} 个资源`, detail: '已落 teacher_resources，本地复制保存原始文件路径和 hash。' },
    { label: 'Docling 解析', status: knowledgeOverview.counts.queuedTasks ? `${knowledgeOverview.counts.queuedTasks} 个待处理` : '待接入引擎', detail: 'PDF、DOCX、PPTX、XLSX 先进入解析队列，不伪造解析结果。' },
    { label: 'MinerU 复杂解析', status: '待接入引擎', detail: '扫描件、教材、公式、复杂表格和试卷版面仍需后续 Python 管线。' },
    { label: '切片与索引', status: `${knowledgeOverview.counts.chunks} 个切片`, detail: 'Markdown / TXT 已本地切片入 resource_chunks。' },
    { label: '知识图谱抽取', status: `${knowledgeOverview.counts.nodes} 节点 / ${knowledgeOverview.counts.edges} 边`, detail: '先生成资源、章节和来源关系，后续再接实体抽取。' },
    { label: 'AI 引用使用', status: knowledgeOverview.counts.chunks ? '可调用' : '待资源切片', detail: 'DeepSeek 调用会纳入命中的资源片段和图谱节点。' },
  ];

  const navItems: Array<{ key: ViewKey; label: string; icon: ReactNode }> = [
    { key: 'today', label: '今日', icon: <Home size={18} /> },
    { key: 'ai', label: 'AI', icon: <Sparkles size={18} /> },
    { key: 'knowledge', label: '知识库', icon: <FileSearch size={18} /> },
    { key: 'students', label: '学生', icon: <Users size={18} /> },
    { key: 'mastery', label: '学习路径', icon: <ListChecks size={18} /> },
    { key: 'intake', label: '录入', icon: <ClipboardList size={18} /> },
    { key: 'mistakes', label: '错题', icon: <BookOpenCheck size={18} /> },
    { key: 'review', label: '复盘', icon: <FileText size={18} /> },
    { key: 'search', label: '搜索', icon: <Search size={18} /> },
    { key: 'question_notebook', label: '题本', icon: <BookOpenCheck size={18} /> },
    { key: 'notebook', label: '备课本', icon: <BookOpenCheck size={18} /> },
    { key: 'book', label: '讲义', icon: <BookOpenCheck size={18} /> },
    { key: 'memory', label: 'L2 记忆', icon: <History size={18} /> },
    { key: 'team', label: '团队', icon: <Layers3 size={18} /> },
    { key: 'analytics', label: '看板', icon: <BarChart3 size={18} /> },
    { key: 'settings', label: '设置', icon: <Settings size={18} /> },
  ];

  async function refreshOverview() {
    const nextOverview = await window.omniEdu?.getPlatformOverview();
    if (nextOverview) setOverview(nextOverview);
  }

  async function refreshKnowledgeOverview() {
    const nextKnowledge = await window.omniEdu?.getKnowledgeOverview();
    if (nextKnowledge) setKnowledgeOverview(nextKnowledge);
  }

  async function refreshAiConversations(nextActiveSessionId = activeAiSessionId) {
    const workspace = await window.omniEdu?.listAiConversations();
    if (!workspace) return;
    setAiFolders(workspace.folders);
    setAiSessions(workspace.sessions);
    setArchivedAiFolders(workspace.archivedFolders);
    setArchivedAiSessions(workspace.archivedSessions);
    if (nextActiveSessionId) setActiveAiSessionId(nextActiveSessionId);
  }

  async function refreshAiConfirmations() {
    const items = await window.omniEdu?.listAiConfirmations('pending');
    if (items) setAiConfirmations(items);
  }

  async function openAiConversation(sessionId: string) {
    const detail = await window.omniEdu?.getAiConversationSession(sessionId);
    if (!detail) return;
    setActiveAiSessionId(detail.session.id);
    setAiMessages(detail.messages);
    setAiPrompt('');
    setAiResult(null);
    setActiveAiArtifact(null);
    setStatus(`已打开对话：${detail.session.title}`);
  }

  async function startNewAiConversation(folderId: string | null = null) {
    const detail = await window.omniEdu?.createAiConversationSession({
      title: '新对话',
      folderId,
      studentId: activeStudent?.id,
    });
    if (!detail) return;
    setActiveAiSessionId(detail.session.id);
    setAiMessages([]);
    setAiPrompt('');
    setAiResult(null);
    setActiveAiArtifact(null);
    await refreshAiConversations(detail.session.id);
    setStatus('已新建 AI 对话。');
  }

  function applyAiConversationWorkspace(workspace: AiConversationWorkspace) {
    setAiFolders(workspace.folders);
    setAiSessions(workspace.sessions);
    setArchivedAiFolders(workspace.archivedFolders);
    setArchivedAiSessions(workspace.archivedSessions);
  }

  async function createAiFolder(name: string) {
    const workspace = await window.omniEdu?.createAiConversationFolder({ name });
    if (!workspace) throw new Error('当前运行环境没有可用的对话文件夹通道。');
    applyAiConversationWorkspace(workspace);
    setStatus(`已新建文件夹：${name}`);
  }

  async function moveAiConversation(sessionId: string, folderId: string | null) {
    const workspace = await window.omniEdu?.moveAiConversationSession(sessionId, folderId);
    if (!workspace) throw new Error('移动对话没有返回本地工作区。');
    applyAiConversationWorkspace(workspace);
    setStatus(folderId ? '对话已移动到文件夹。' : '对话已移动到未归档。');
  }

  async function renameAiConversationTarget(target: AiConversationTarget, value: string) {
    const workspace = target.type === 'folder'
      ? await window.omniEdu?.renameAiConversationFolder(target.id, { name: value })
      : await window.omniEdu?.renameAiConversationSession(target.id, { title: value });
    if (!workspace) throw new Error('重命名没有返回本地工作区。');
    applyAiConversationWorkspace(workspace);
    setStatus(`已重命名为：${value}`);
  }

  async function archiveAiConversationTarget(target: AiConversationTarget) {
    const workspace = target.type === 'folder'
      ? await window.omniEdu?.archiveAiConversationFolder(target.id)
      : await window.omniEdu?.archiveAiConversationSession(target.id);
    if (!workspace) throw new Error('归档没有返回本地工作区。');
    applyAiConversationWorkspace(workspace);
    if (target.type === 'session' && activeAiSessionId === target.id) {
      setActiveAiSessionId('');
      setAiMessages([]);
      setAiResult(null);
      setActiveAiArtifact(null);
    }
    if (target.type === 'folder') {
      const archivedActive = !workspace.sessions.some((session) => session.id === activeAiSessionId);
      if (archivedActive) {
        setActiveAiSessionId('');
        setAiMessages([]);
        setAiResult(null);
        setActiveAiArtifact(null);
      }
    }
    setStatus(target.type === 'folder' ? '文件夹及其中对话已归档。' : '对话已归档。');
  }

  async function bootstrap() {
    const data = await window.omniEdu?.bootstrap();
    if (!data) throw new Error('Electron preload 未连接');
    setDataRoot(data.dataRoot);
    setStudents(data.students);
    setOverview(data.overview ?? emptyOverview);
    await refreshKnowledgeOverview();
    const settings = await window.omniEdu?.getDeepSeekSettings();
    if (settings) {
      setDeepSeekSettings(settings);
      setDeepSeekForm((current) => ({ ...current, model: settings.model || current.model }));
    }
    await refreshAiConversations();
    await refreshAiConfirmations();
    const pendingInputs = await window.omniEdu?.listPendingDeepTutorInputs();
    if (pendingInputs?.length) {
      setPendingUserInput(pendingInputs[0]);
      setUserInputText('');
      setStatus('已恢复一项等待输入；提交后会由新的受限运行接管。');
    }
    setActiveStudentId((current) => current || data.students[0]?.id || '');
    if (!pendingInputs?.length) setStatus('本地数据已连接。');
  }

  async function refreshStudents(query = studentQuery) {
    const nextStudents = await window.omniEdu?.listStudents(query);
    setStudents(nextStudents ?? []);
    await refreshOverview();
  }

  async function refreshRecords(studentId = activeStudent?.id) {
    if (!studentId) return;
    const nextRecords = await window.omniEdu?.listRecords(studentId, {
      type: recordTypeFilter || undefined,
      subject: recordSubjectFilter || undefined,
      tag: recordTagFilter || undefined,
      keyword: recordKeyword || undefined,
      startDate: recordStartDate || undefined,
      endDate: recordEndDate || undefined,
    });
    const nextReports = await window.omniEdu?.listReports(studentId);
    setRecords(nextRecords ?? []);
    setReports(nextReports ?? []);
    await refreshOverview();
  }

  useEffect(() => {
    bootstrap().catch((error) => setStatus(error instanceof Error ? error.message : '启动失败'));
  }, []);

  useEffect(() => {
    const unsubscribe = window.omniEdu?.onDeepTutorEvent?.((event) => {
      setDeepTutorEvents((current) => {
        if (current.some((item) => item.turnId === event.turnId && item.sequence === event.sequence)) return current;
        return [...current, event].slice(-64);
      });
      const summary = event.publicSummary;
      const token = summary && typeof summary.continuationToken === 'string' ? summary.continuationToken : '';
      if (summary?.continuationAvailable === true && token) {
        setDeepTutorContinuation({
          runId: String(summary.runId ?? ''),
          continuationToken: token,
          continuationCount: Number(summary.continuationCount ?? 0),
        });
      }
    });
    const unsubscribeInput = window.omniEdu?.onDeepTutorInputRequest?.((request) => {
      setPendingUserInput(request);
      setUserInputText('');
      setStatus('小智需要一项补充信息后继续。');
    });
    const unsubscribeConfirmation = window.omniEdu?.onDeepTutorConfirmation?.((item) => {
      setAiConfirmations((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
      setStatus('DeepTutor 已生成待教师确认的题组草稿');
    });
    return () => { unsubscribe?.(); unsubscribeInput?.(); unsubscribeConfirmation?.(); };
  }, []);

  useEffect(() => {
    if (activeStudent) {
      refreshRecords(activeStudent.id).catch(() => setStatus('读取学习记录失败'));
      setStudentForm({
        displayName: activeStudent.displayName,
        realName: activeStudent.realName,
        grade: activeStudent.grade,
        school: activeStudent.school,
        subjects: activeStudent.subjects,
        goals: activeStudent.goals,
        currentIssues: activeStudent.currentIssues,
        parentConcerns: activeStudent.parentConcerns,
        teacherNotes: activeStudent.teacherNotes,
        tags: activeStudent.tags,
      });
      setRecordForm((current) => ({
        ...current,
        subject: current.subject || activeStudent.subjects[0] || '数学',
      }));
    }
  }, [activeStudent?.id, recordTypeFilter, recordSubjectFilter, recordTagFilter, recordKeyword, recordStartDate, recordEndDate]);

  async function submitStudent() {
    if (!studentForm.displayName?.trim()) {
      throw new Error('学生显示名不能为空。');
    }
    const editingStudent = studentFormMode === 'edit';
    const previousIds = new Set(students.map((student) => student.id));
    const saved = editingStudent && activeStudent
      ? await window.omniEdu?.updateStudent(activeStudent.id, studentForm)
      : await window.omniEdu?.createStudent(studentForm);
    if (!saved) throw new Error('当前运行环境没有可用的学生保存通道。');
    const savedStudentId = editingStudent && activeStudent
      ? activeStudent.id
      : saved.find((student: Student) => !previousIds.has(student.id))?.id ?? saved.find((student: Student) => student.status === 'active')?.id ?? '';
    setStudents(saved);
    setActiveStudentId(savedStudentId);
    setStudentFormMode('closed');
    setStudentForm(initialStudentForm);
    setStatus(editingStudent ? '学生档案已更新。' : '学生档案已创建。');
    await refreshOverview();
  }

  async function submitRecord() {
    if (!activeStudent || !recordForm.title.trim()) {
      setStatus('请先选择学生，并填写记录标题。');
      return;
    }
    if (activeStudent.status === 'archived') {
      setStatus('归档学生为只读状态，不能新增或修改学习记录。');
      return;
    }
    const payload = {
      recordType: recordForm.recordType,
      subject: recordForm.subject,
      title: recordForm.title,
      content: recordForm.content,
      tags: splitList(recordForm.tags),
      occurredAt: new Date(recordForm.occurredAt).toISOString(),
    };
    const nextRecords = editingRecordId
      ? await window.omniEdu?.updateRecord(editingRecordId, payload)
      : await window.omniEdu?.createRecord({
          studentId: activeStudent.id,
          ...payload,
        });
    setRecords(nextRecords ?? []);
    await refreshStudents();
    resetRecordForm();
    setStatus(editingRecordId ? '学习记录已更新。' : '学习记录已保存。');
  }

  function resetRecordForm() {
    setEditingRecordId(null);
    setRecordForm({
      recordType: 'mistake',
      subject: activeStudent?.subjects[0] ?? '数学',
      title: '',
      content: '',
      tags: '',
      occurredAt: new Date().toISOString().slice(0, 16),
    });
  }

  function editRecord(record: LearningRecord) {
    setActiveView('intake');
    setEditingRecordId(record.id);
    setRecordForm({
      recordType: record.recordType,
      subject: record.subject,
      title: record.title,
      content: record.content,
      tags: record.tags.join('、'),
      occurredAt: record.occurredAt.slice(0, 16),
    });
    setStatus('已载入学习记录，可在录入页修改。');
  }

  async function importAttachment(recordId: string) {
    if (!activeStudent) return;
    if (activeStudent.status === 'archived') {
      setStatus('归档学生为只读状态，不能继续导入附件。');
      return;
    }
    setAttachmentImport({ status: 'copying', records, items: [] });
    setStatus('正在复制附件到学生本地目录。');
    try {
      const result = await window.omniEdu?.importAttachments(activeStudent.id, recordId);
      if (!result) throw new Error('附件导入没有返回结果，请重试。');
      setAttachmentImport(result);
      setRecords(result.records ?? []);
      await refreshStudents();
      const okCount = result.items.filter((item) => item.ok).length;
      const failedCount = result.items.length - okCount;
      if (result.status === 'canceled') {
        setStatus('已取消附件导入。');
      } else if (failedCount > 0) {
        setStatus(`附件导入完成：成功 ${okCount} 个，失败 ${failedCount} 个。`);
      } else {
        setStatus(`附件已复制：${okCount} 个文件。`);
      }
    } catch (error) {
      setAttachmentImport({ status: 'failed', records, items: [{ sourcePath: '', fileName: '附件选择或复制', ok: false, fileSize: 0, errorMessage: error instanceof Error ? error.message : '附件导入失败' }] });
      setStatus(error instanceof Error ? error.message : '附件导入失败，请重试。');
    }
  }

  async function importKnowledgeResources() {
    setStatus('正在导入老师知识库资源。');
    const result = await window.omniEdu?.importKnowledgeResources();
    if (!result) return;
    setKnowledgeImport(result);
    setKnowledgeOverview(result.overview);
    await refreshOverview();
    const okCount = result.items.filter((item) => item.ok).length;
    const failedCount = result.items.length - okCount;
    if (result.status === 'canceled') {
      setStatus('已取消知识资源导入。');
    } else if (failedCount > 0) {
      setStatus(`知识资源导入完成：成功 ${okCount} 个，失败 ${failedCount} 个。`);
    } else {
      setStatus(`知识资源已导入：${okCount} 个文件。`);
    }
  }

  function getArtifactMimeType(type: string) {
    if (type === 'pdf') return 'application/pdf';
    if (type === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'text/markdown';
  }

  function normalizeDocumentArtifactType(type: string): DocumentArtifactType {
    if (type === 'pdf' || type === 'docx') return type;
    return 'markdown';
  }

  function buildAiArtifacts(_prompt: string, result?: AiConsoleRunResult | null): AiArtifact[] {
    if (!result?.ok || !result.artifacts?.length) return [];
    return result.artifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      type: normalizeDocumentArtifactType(artifact.type) === 'pdf'
        ? 'PDF'
        : normalizeDocumentArtifactType(artifact.type) === 'docx'
          ? 'Word'
          : 'Markdown',
      artifactType: normalizeDocumentArtifactType(artifact.type),
      fileName: artifact.fileName,
      mimeType: getArtifactMimeType(normalizeDocumentArtifactType(artifact.type)),
      description: artifact.description || (artifact.requiresTeacherConfirmation ? '需要老师确认后再保存或导出。' : '结构化回复请求的草稿产物。'),
      content: result.content,
    }));
  }

  async function exportAiArtifact(artifact: AiArtifact | null, useLocalWorkspace = false) {
    if (!artifact) return;
    if (!artifact.content.trim()) {
      const message = '文档产物正文为空，不能导出。';
      setActiveAiArtifact({ ...artifact, exportStatus: 'failed', errorMessage: message });
      setStatus(message);
      return;
    }
    setActiveAiArtifact({ ...artifact, errorMessage: undefined });
    setStatus(`正在导出 ${artifact.type} 文件。`);
    try {
      const dataRoot = useLocalWorkspace ? await window.omniEdu?.getDataRoot() : '';
      const exported = await window.omniEdu?.exportDocumentArtifact({
        artifactId: artifact.id,
        sessionId: activeAiSessionId,
        title: artifact.title,
        type: artifact.artifactType,
        fileName: artifact.fileName,
        contentMd: artifact.content,
        description: artifact.description,
        destinationRoot: dataRoot ? `${dataRoot}/exports/ai-artifacts` : undefined,
      });
      if (!exported) {
        setStatus('已取消文档产物导出。');
        return;
      }
      const nextArtifact: AiArtifact = {
        ...artifact,
        exportStatus: exported.status,
        filePath: exported.filePath,
        fileSize: exported.fileSize,
        contentHash: exported.contentHash,
        errorMessage: exported.errorMessage,
      };
      setActiveAiArtifact(nextArtifact);
      setStatus(`已导出 ${artifact.type}：${exported.filePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '文档产物导出失败。';
      setActiveAiArtifact({ ...artifact, exportStatus: 'failed', errorMessage: message });
      setStatus(message);
    }
  }

  async function showAiArtifactFile(artifact: AiArtifact | null) {
    if (!artifact?.filePath || artifact.exportStatus !== 'exported') {
      setStatus('请先导出文档产物，再在文件夹中显示。');
      return;
    }
    await window.omniEdu?.showDocumentArtifact(artifact.id);
  }

  function buildAiTrace(prompt: string, result?: AiConsoleRunResult | null, artifacts: AiArtifact[] = []) {
    if (result?.harness) {
      const router = result.harness.router;
      const steps: AiThoughtStep[] = result.harness.trace?.length
        ? result.harness.trace.map((step) => ({ label: step.label, detail: step.detail }))
        : [
            {
              label: '任务识别',
              detail: `Router dry-run 判定为 ${router.route}，置信度 ${Math.round(router.confidence * 100)}%。`,
            },
            {
              label: '上下文装配',
              detail: result.harness.selectedContext.length
                ? `按需读取：${result.harness.selectedContext.join('、')}。`
                : '本 route 未读取学生档案、学习记录、附件、知识库或图谱。',
            },
            {
              label: '结构校验',
              detail: result.harness.schemaValid
                ? 'DeepSeek 返回已通过 xiazhi.reply.v2 结构校验。'
                : `结构校验未通过：${result.harness.schemaErrors.join('；') || '未返回结构化结果'}。`,
            },
          ];
      if (router.clarificationQuestion) {
        steps.push({ label: '澄清边界', detail: router.clarificationQuestion });
      }
      if (router.actionLevel === 'write') {
        steps.push({ label: '写入边界', detail: '识别到写入意图，本轮只生成草稿和确认项，不直接写入本地数据。' });
      }
      if (artifacts.length) {
        steps.push({ label: '产物判断', detail: `结构化回复请求 ${artifacts.map((artifact) => artifact.type).join('、')} 产物入口。` });
      }
      const contextSources = result.sources.map((source) => ({
        title: source.title,
        source: source.type,
        detail: source.detail,
      }));
      const toolRuns = result.toolRuns.map((tool) => ({
        toolName: tool.name,
        state: tool.status === 'used'
          ? 'output-available'
          : tool.status === 'failed'
            ? 'output-error'
            : 'requires-action',
        argsText: JSON.stringify(tool.inputSummary ?? { effect: tool.effect ?? 'read', privacy: tool.privacy ?? 'local_only' }),
        output: tool.outputSummary ?? { detail: tool.detail, status: tool.status },
      })) satisfies AiTraceTool[];
      return { thoughtSteps: steps, contextSources, toolRuns };
    }

    const trimmedPrompt = prompt.trim();
    const isGreeting = /^(你?好|您好|hello|hi|嗨|在吗)[\s!！。.?？]*$/i.test(trimmedPrompt);
    const asksEducation = /学生|学习|错题|错因|题目|知识点|复盘|练习|作业|家长|报告|干预|计划|最近|记录|成绩|薄弱/.test(trimmedPrompt);
    const asksAttachment = /附件|文件|图片|材料|上传|pdf|word|docx?|markdown|md\b/.test(trimmedPrompt.toLowerCase());
    const asksKnowledge = /知识库|资料|讲义|知识点|练习|方案|干预|复盘|报告/.test(trimmedPrompt);
    const asksGraph = /知识图谱|图谱|关联|关系/.test(trimmedPrompt);
    const steps: AiThoughtStep[] = [{
      label: '任务识别',
      detail: trimmedPrompt ? `识别用户需求：${trimmedPrompt}。` : '等待用户输入。',
    }];
    const contextSources: AiTraceSource[] = [];
    const toolRuns: AiTraceTool[] = [];

    if (isGreeting) {
      steps.push({
        label: '上下文边界',
        detail: '识别为问候类输入，不调用学生档案、学习记录、知识库或知识图谱。',
      });
      return { thoughtSteps: steps, contextSources, toolRuns };
    }

    if (activeStudent && asksEducation) {
      steps.push({
        label: '学生档案',
        detail: `读取 ${activeStudent.displayName} 的阶段目标、当前问题、家长关注点和标签。`,
      });
      contextSources.push({
        title: '学生档案',
        source: 'SQLite',
        detail: `${activeStudent.displayName} 的阶段目标、当前问题、家长关注点和标签。`,
      });
      toolRuns.push({
        toolName: 'get_student_profile',
        state: 'output-available',
        argsText: JSON.stringify({ studentId: activeStudent.id }),
        output: { selected: activeStudent.displayName },
      });
    }

    if (asksEducation && records.length) {
      steps.push({
        label: '学习记录',
        detail: `按发生时间倒序纳入 ${records.length} 条学习记录，用于判断近期表现。`,
      });
      contextSources.push({
        title: '学习记录',
        source: 'SQLite',
        detail: `${records.length} 条最近学习记录，按发生时间倒序。`,
      });
      toolRuns.push({
        toolName: 'search_learning_records',
        state: 'output-available',
        argsText: JSON.stringify({ records: records.length, order: 'occurredAt desc' }),
        output: { count: records.length },
      });
    }

    if (asksAttachment && activeAttachments.length) {
      steps.push({
        label: '附件元数据',
        detail: `只纳入 ${activeAttachments.length} 个附件的数量和元数据，不读取或上传原始附件。`,
      });
      contextSources.push({
        title: '附件元数据',
        source: '本地文件系统',
        detail: `${activeAttachments.length} 个附件的文件名、大小和记录归属。`,
      });
      toolRuns.push({
        toolName: 'list_attachment_metadata',
        state: 'output-available',
        argsText: JSON.stringify({ attachments: activeAttachments.length }),
        output: { count: activeAttachments.length, rawFilesUploaded: false },
      });
    }

    const knowledgeCount = result?.knowledgeSnippets?.length ?? 0;
    if ((asksKnowledge || knowledgeCount > 0) && knowledgeCount > 0) {
      steps.push({
        label: '知识库命中',
        detail: `纳入老师知识库文本片段 ${knowledgeCount} 条。`,
      });
      contextSources.push({
        title: '老师知识库',
        source: 'SQLite / 本地切片',
        detail: `命中 ${knowledgeCount} 条知识库文本片段。`,
      });
      toolRuns.push({
        toolName: 'search_teacher_knowledge',
        state: 'output-available',
        argsText: JSON.stringify({ scope: 'teacher' }),
        output: { chunks: knowledgeCount },
      });
    }

    const graphCount = result?.graphNodes?.length ?? 0;
    if ((asksGraph || graphCount > 0) && graphCount > 0) {
      steps.push({
        label: '知识图谱',
        detail: `纳入知识图谱节点摘要 ${graphCount} 个。`,
      });
      contextSources.push({
        title: '知识图谱',
        source: 'SQLite nodes / edges',
        detail: `命中 ${graphCount} 个知识图谱节点。`,
      });
      toolRuns.push({
        toolName: 'query_knowledge_graph',
        state: 'output-available',
        argsText: JSON.stringify({ nodeLimit: graphCount }),
        output: { nodes: graphCount },
      });
    }

    if (artifacts.length) {
      steps.push({
        label: '产物判断',
        detail: `根据用户要求生成 ${artifacts.map((artifact) => artifact.type).join('、')} 文件入口。`,
      });
    }

    if (steps.length === 1) {
      steps.push({
        label: '上下文边界',
        detail: '未识别到需要调用本地学生档案、学习记录、附件、知识库或图谱的需求。',
      });
    }

    return { thoughtSteps: steps, contextSources, toolRuns };
  }

  async function submitPendingUserInput() {
    if (!pendingUserInput) return;
    const text = userInputText.trim();
    if (!text) {
      setStatus('请先填写小智需要的补充信息。');
      return;
    }
    const result = await window.omniEdu?.deepTutorSubmitUserInput({
      requestId: pendingUserInput.requestId,
      turnId: pendingUserInput.turnId,
      text,
    });
    if (result?.ok) {
      setPendingUserInput(null);
      setUserInputText('');
      setStatus(result.runId ? '已提交补充信息，小智正在由恢复运行继续。' : '已提交补充信息，小智正在继续。');
    } else {
      setStatus(result?.errorMessage || '补充信息提交失败，请重试。');
    }
  }

  async function cancelPendingUserInput() {
    if (!pendingUserInput) return;
    await window.omniEdu?.deepTutorCancelTurn(pendingUserInput.turnId);
    setPendingUserInput(null);
    setUserInputText('');
    setStatus('已取消等待输入，本轮小智任务已停止。');
  }

  async function continueDeepTutorBudget() {
    if (!deepTutorContinuation || continuationInFlightRef.current) return;
    continuationInFlightRef.current = true;
    setAiRunning(true);
    setStatus('小智正在从预算检查点继续，不重复上一轮已完成内容。');
    try {
      const result = await window.omniEdu?.deepTutorContinueTurn({
        continuationToken: deepTutorContinuation.continuationToken,
        budgets: { maxEvents: 64, maxWallMs: 120_000 },
      });
      if (!result?.ok || !result.runId) {
        if (result?.approvalRequired && result.approvalCheckpointId) {
          setDeepTutorContinuation((current) => current ? {
            ...current,
            approvalCheckpointId: result.approvalCheckpointId,
            approvalRequired: true,
            requestedBudgets: result.requestedBudgets,
          } : current);
          setStatus('续写预算超出原上限，请先确认追加预算。');
          return;
        }
        setStatus(result?.errorMessage || '续写检查点已失效，请重新发起任务。');
        setDeepTutorContinuation(null);
        return;
      }
      setDeepTutorContinuation(null);
      const deadline = Date.now() + 120_000;
      let run = await window.omniEdu?.getAiAgentRun(result.runId);
      while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        run = await window.omniEdu?.getAiAgentRun(result.runId);
      }
      if (run?.status === 'succeeded') setStatus('小智已完成预算续写。');
      else if (run?.status === 'blocked') setStatus('续写再次触发预算边界，可继续次数有限。');
      else setStatus(run?.errorMessage || '续写未能完成，请检查运行轨迹。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '续写检查点调用失败。');
    } finally {
      setAiRunning(false);
      continuationInFlightRef.current = false;
    }
  }

  async function approveDeepTutorBudget() {
    if (!deepTutorContinuation?.approvalCheckpointId || continuationInFlightRef.current) return;
    continuationInFlightRef.current = true;
    setAiRunning(true);
    setStatus('正在提交追加预算审批，并继续当前任务。');
    try {
      const result = await window.omniEdu?.deepTutorApproveBudget(deepTutorContinuation.approvalCheckpointId);
      if (!result?.ok || !result.runId) {
        setStatus(result?.errorMessage || '预算审批已失效，请重新发起任务。');
        return;
      }
      setDeepTutorContinuation(null);
      setStatus('预算已获批，小智正在继续当前任务。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '预算审批调用失败。');
    } finally {
      setAiRunning(false);
      continuationInFlightRef.current = false;
    }
  }

  async function mutateAiRunFromMessage(runId: string, action: 'retry' | 'branch' | 'regenerate') {
    if (!runId || aiMutationRunningId) return;
    setAiMutationRunningId(runId);
    setAiRunning(true);
    setStatus(action === 'retry' ? '小智正在重试失败运行。' : action === 'branch' ? '小智正在创建对话分支。' : '小智正在重新生成当前结果。');
    try {
      const idempotencyKey = `${action}-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await window.omniEdu?.deepTutorMutateRun({
        sourceRunId: runId,
        action,
        idempotencyKey,
        budgets: { maxEvents: 64, maxWallMs: 120_000 },
      });
      if (!result?.ok || !result.runId) {
        setStatus(result?.errorMessage || '运行变更未被接受。');
        return;
      }
      const deadline = Date.now() + 120_000;
      let run = await window.omniEdu?.getAiAgentRun(result.runId);
      while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        run = await window.omniEdu?.getAiAgentRun(result.runId);
      }
      if (run?.status === 'succeeded') setStatus('小智已完成运行变更，过程可在事件轨迹中查看。');
      else setStatus(run?.errorMessage || '运行变更未能完成，请检查事件轨迹。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '运行变更调用失败。');
    } finally {
      setAiRunning(false);
      setAiMutationRunningId('');
    }
  }

  async function runAiConsole(promptOverride?: string) {
    if (aiSubmitInFlightRef.current) return;
    aiSubmitInFlightRef.current = true;
    const requestedPrompt = (promptOverride ?? aiPrompt).trim();
    if (!requestedPrompt) {
      aiSubmitInFlightRef.current = false;
      setStatus('请输入 AI 任务。');
      return;
    }
    let sessionId = activeAiSessionId;
    if (!sessionId) {
      const detail = await window.omniEdu?.createAiConversationSession({
        title: requestedPrompt.slice(0, 40),
        studentId: activeStudent?.id,
      });
      if (detail) {
        sessionId = detail.session.id;
        setActiveAiSessionId(sessionId);
        setAiMessages(detail.messages);
      }
    }
    if (!sessionId) {
      setStatus('无法创建本地对话记录。');
      return;
    }
    const prompt = requestedPrompt;
    setAiRunning(true);
    setAiResult(null);
    setDeepTutorEvents([]);
    setActiveAiArtifact(null);
    setStatus('小智正在生成回复。');
    try {
      const userDetail = await window.omniEdu?.appendAiConversationMessage(sessionId, {
        role: 'user',
        content: prompt,
        metadata: {
          studentId: activeStudent?.id ?? '',
          timeRange: 'last30',
          knowledgeScope: 'teacher',
        },
      });
      if (userDetail) setAiMessages(userDetail.messages);
      const result = await window.omniEdu?.runDeepTutorConsole({
        prompt,
        sessionId,
        studentId: activeStudent?.id,
        timeRange: 'last30',
        knowledgeScope: 'teacher',
      });
      if (result) {
        setAiResult(result);
        const isStructuredResult = result.executionMode === 'structured';
        const artifacts = isStructuredResult ? buildAiArtifacts(prompt, result) : [];
        const trace = isStructuredResult
          ? buildAiTrace(prompt, result, artifacts)
          : { thoughtSteps: [], contextSources: [], toolRuns: [] };
        const assistantDetail = await window.omniEdu?.appendAiConversationMessage(sessionId, {
          role: 'assistant',
          content: result.ok ? result.content : result.errorMessage || 'DeepSeek 调用失败。',
          metadata: {
            agentRunId: result.harness?.agentRunId ?? '',
            ok: result.ok,
            model: result.model,
            errorMessage: result.errorMessage ?? '',
            executionMode: result.executionMode,
            ...(isStructuredResult ? {
              thoughtSteps: trace.thoughtSteps,
              contextSources: trace.contextSources,
              toolRuns: trace.toolRuns,
              artifacts,
            } : {}),
            confirmations: result.confirmations ?? [],
          },
        });
        if (assistantDetail) setAiMessages(assistantDetail.messages);
        await refreshAiConfirmations();
        await refreshAiConversations(sessionId);
        setStatus(result.ok
          ? result.executionMode === 'direct' ? '小智已回复。' : '小智已完成 DeepTutor AgentLoop。'
          : result.errorMessage || (result.executionMode === 'direct' ? '小智回复失败。' : '小智 AgentLoop 调用失败。'));
      } else {
        const fallbackResult = {
          ok: false,
          executionMode: 'structured' as const,
          model: deepSeekSettings.model || 'deepseek-v4-flash',
          content: '',
          toolRuns: [],
          sources: [],
          errorMessage: '当前运行环境没有可用的 AI 调用通道。',
        };
        setAiResult(fallbackResult);
        const artifacts = buildAiArtifacts(prompt, fallbackResult);
        const trace = buildAiTrace(prompt, fallbackResult, artifacts);
        const assistantDetail = await window.omniEdu?.appendAiConversationMessage(sessionId, {
          role: 'assistant',
          content: fallbackResult.errorMessage,
          metadata: {
            agentRunId: '',
            ok: false,
            model: fallbackResult.model,
            errorMessage: fallbackResult.errorMessage,
            thoughtSteps: trace.thoughtSteps,
            contextSources: trace.contextSources,
            toolRuns: trace.toolRuns,
            artifacts,
          },
        });
        if (assistantDetail) setAiMessages(assistantDetail.messages);
        await refreshAiConversations(sessionId);
        setStatus('当前运行环境没有可用的 AI 调用通道。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DeepSeek 调用失败。';
      const failedResult = {
        ok: false,
        executionMode: 'structured' as const,
        model: deepSeekSettings.model || 'deepseek-v4-flash',
        content: '',
        toolRuns: [],
        sources: [],
        errorMessage: message,
      };
      setAiResult(failedResult);
      const artifacts = buildAiArtifacts(prompt, failedResult);
      const trace = buildAiTrace(prompt, failedResult, artifacts);
      await window.omniEdu?.appendAiConversationMessage(sessionId, {
        role: 'assistant',
        content: message,
        metadata: {
          agentRunId: '',
          ok: false,
          model: failedResult.model,
          errorMessage: message,
          thoughtSteps: trace.thoughtSteps,
          contextSources: trace.contextSources,
          toolRuns: trace.toolRuns,
          artifacts,
        },
      }).then((detail) => detail && setAiMessages(detail.messages));
      await refreshAiConversations(sessionId);
      setStatus(message);
    } finally {
      setAiRunning(false);
      aiSubmitInFlightRef.current = false;
    }
  }

  async function confirmAiItem(item: AiConfirmationItem) {
    try {
      const result = await window.omniEdu?.confirmAiConfirmation(item.id);
      await refreshAiConfirmations();
      if (result?.readback?.report) {
        setReviewReportSelectionId(result.readback.report.id);
        await refreshRecords(result.readback.report.studentId);
        setActiveView('review');
        setStatus(`已确认并保存：${result.readback.report.title}`);
      } else if (result?.readback?.exerciseSet) {
        setStatus(`已确认并保存题组：${result.readback.exerciseSet.title}`);
      } else {
        setStatus('已确认待办项。');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '确认待办项失败');
    }
  }

  async function rejectAiItem(item: AiConfirmationItem) {
    try {
      await window.omniEdu?.rejectAiConfirmation(item.id);
      await refreshAiConfirmations();
      setStatus(`已拒绝：${item.title}，本地数据库未写入。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '拒绝待办项失败');
    }
  }

  async function saveDeepSeekSettings() {
    const saved = await window.omniEdu?.saveDeepSeekSettings({
      apiKey: deepSeekForm.apiKey,
      model: deepSeekForm.model,
    });
    if (saved) {
      setDeepSeekSettings(saved);
      setDeepSeekForm({ apiKey: '', model: saved.model });
      setStatus(saved.configured ? 'DeepSeek 配置已保存。' : 'DeepSeek 配置未包含 API Key。');
    }
  }

  function startNewStudent() {
    setActiveView('students');
    setStudentFormMode('create');
    setStudentForm(initialStudentForm);
    setStatus('填写学生档案后保存到本地。');
  }

  function loadActiveStudentForEdit() {
    if (!activeStudent || activeStudent.status === 'archived') return;
    setActiveView('students');
    setStudentFormMode('edit');
    setStudentForm({
      displayName: activeStudent.displayName,
      realName: activeStudent.realName,
      grade: activeStudent.grade,
      school: activeStudent.school,
      subjects: activeStudent.subjects,
      goals: activeStudent.goals,
      currentIssues: activeStudent.currentIssues,
      parentConcerns: activeStudent.parentConcerns,
      teacherNotes: activeStudent.teacherNotes,
      tags: activeStudent.tags,
    });
  }

  function renderStudentDirectory() {
    return (
      <section className="directory-panel" aria-label="学生目录">
        <WorkspaceLabel number="01" title="学生目录" description="搜索真实档案，选择后进入证据链。" />
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="搜索学生"
            placeholder="搜索学生、年级、科目、标签"
            value={studentQuery}
            onChange={(event) => {
              setStudentQuery(event.target.value);
              refreshStudents(event.target.value).catch(() => setStatus('学生搜索失败'));
            }}
          />
        </div>
        <button data-testid="student-create" className="primary-action" onClick={startNewStudent}>
          <Plus size={17} />
          新建学生
        </button>
        <div className="student-list">
          {students.map((student) => (
            <button
              key={student.id}
              data-testid={`student-row-${student.id}`}
              className={`student-row ${student.id === activeStudent?.id ? 'active' : ''} ${student.status === 'archived' ? 'archived' : ''}`}
              onClick={() => {
                setActiveStudentId(student.id);
                setStudentFormMode('closed');
              }}
            >
              <span className="student-row-name">{student.displayName}{student.status === 'archived' ? <em data-testid={`student-row-status-${student.id}`}>已归档</em> : null}</span>
              <span>{student.grade || '未填年级'} · {(student.subjects.length ? student.subjects : ['未填科目']).join(' / ')}</span>
              <span className="student-row-meta">
                <ClipboardList size={14} />
                {student.recordCount} 条
                <HardDrive size={14} />
                {formatBytes(student.attachmentBytes)}
              </span>
            </button>
          ))}
          {!students.length ? <EmptyState>没有匹配的学生档案。</EmptyState> : null}
        </div>
      </section>
    );
  }


  function renderTimeline(showFilters = true) {
    const readOnly = activeStudent?.status === 'archived';
    return (
      <section className="work-panel">
        <div className="panel-heading">
          <WorkspaceLabel number="03" title="证据时间线" description="所有结论都从真实记录、标签和附件回溯。" />
          {showFilters ? (
            <div className="filter-grid">
              <select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>
                <option value="">全部类型</option>
                {Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input placeholder="科目" value={recordSubjectFilter} onChange={(event) => setRecordSubjectFilter(event.target.value)} />
              <input placeholder="标签" value={recordTagFilter} onChange={(event) => setRecordTagFilter(event.target.value)} />
              <input placeholder="关键词" value={recordKeyword} onChange={(event) => setRecordKeyword(event.target.value)} />
              <input type="date" aria-label="开始日期" value={recordStartDate} onChange={(event) => setRecordStartDate(event.target.value)} />
              <input type="date" aria-label="结束日期" value={recordEndDate} onChange={(event) => setRecordEndDate(event.target.value)} />
            </div>
          ) : null}
        </div>
        <div className="timeline">
          {records.map((record) => (
            <article className="timeline-item" data-testid={`timeline-record-${record.id}`} key={record.id}>
              <time>{formatTime(record.occurredAt)}</time>
              <div className="timeline-body">
                <div className="record-head">
                  <div>
                    <Badge tone={record.recordType === 'mistake' ? 'amber' : 'neutral'}>{recordTypeLabels[record.recordType] ?? record.recordType}</Badge>
                    <Badge>{record.subject || '全部'}</Badge>
                  </div>
                  {readOnly ? <span className="student-readonly-label">归档档案只读</span> : (
                    <div className="record-actions">
                      <button className="secondary-action compact-button" onClick={() => editRecord(record)}>编辑</button>
                      <button className="secondary-action compact-button" onClick={() => importAttachment(record.id)}>导入附件</button>
                    </div>
                  )}
                </div>
                <h3>{record.title}</h3>
                <p>{record.content || '暂无正文'}</p>
                <div className="record-tags">
                  {record.tags.map((tag) => <span key={tag}><Tag size={13} />{tag}</span>)}
                </div>
                {record.attachments.map((attachment) => (
                  <button className="attachment-row" key={attachment.id} onClick={() => window.omniEdu?.showAttachment(attachment.filePath)}>
                    <FileText size={16} />
                    <span>{attachment.fileName}</span>
                    <span>{formatBytes(attachment.fileSize)}</span>
                    <FolderOpen size={15} />
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!records.length ? <EmptyState>暂无学习记录。到“录入”工作区添加第一条证据。</EmptyState> : null}
        </div>
      </section>
    );
  }

  function renderRecordForm() {
    return (
      <section className="work-panel form-panel">
        <WorkspaceLabel number="02" title={editingRecordId ? '编辑学习记录' : '添加学习记录'} description="一条记录只服务一件事实，方便复盘引用。" />
        <div className="form-grid">
          <label>
            记录类型
            <select value={recordForm.recordType} onChange={(event) => setRecordForm({ ...recordForm, recordType: event.target.value })}>
              {Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            科目
            <input value={recordForm.subject} onChange={(event) => setRecordForm({ ...recordForm, subject: event.target.value })} />
          </label>
          <label>
            发生时间
            <input type="datetime-local" value={recordForm.occurredAt} onChange={(event) => setRecordForm({ ...recordForm, occurredAt: event.target.value })} />
          </label>
          <label className="full">
            标题
            <input value={recordForm.title} onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })} />
          </label>
          <label className="full">
            正文
            <textarea value={recordForm.content} onChange={(event) => setRecordForm({ ...recordForm, content: event.target.value })} />
          </label>
          <label className="full">
            标签
            <input value={recordForm.tags} onChange={(event) => setRecordForm({ ...recordForm, tags: event.target.value })} placeholder="一次函数、审题、计算粗心" />
          </label>
          <button className="primary-action wide" onClick={submitRecord}>
            <Plus size={16} />
            {editingRecordId ? '保存修改' : '保存记录'}
          </button>
          {editingRecordId ? <button className="secondary-action full-button" onClick={resetRecordForm}>取消编辑</button> : null}
        </div>
      </section>
    );
  }

  function renderTodayView() {
    return (
      <div className="page-grid today-grid">
        <section className="work-panel span-2">
          <WorkspaceLabel number="01" title="今日工作台" description="从真实学生和证据开始，不从功能清单开始。" />
          <div className="quick-actions">
            <button className="primary-action" onClick={() => setActiveView('ai')}><Sparkles size={17} />打开 AI 中控台</button>
            <button className="secondary-action" onClick={() => setActiveView('knowledge')}><FileSearch size={17} />进入知识库</button>
            <button className="primary-action" onClick={() => setActiveView('intake')}><ClipboardList size={17} />添加记录</button>
            <button className="secondary-action" onClick={() => setActiveView('review')}><FileText size={17} />生成复盘</button>
            <button className="secondary-action" onClick={startNewStudent}><Plus size={17} />新建学生</button>
            <button className="secondary-action" onClick={() => setActiveView('mistakes')}><BookOpenCheck size={17} />处理错题</button>
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="02" title="最近学生" />
          <div className="compact-list">
            {recentStudents.map((student) => (
              <button key={student.id} onClick={() => {
                setActiveStudentId(student.id);
                setActiveView('students');
              }}>
                <strong>{student.displayName}</strong>
                <span>{student.recordCount} 条记录 · {formatBytes(student.attachmentBytes)}</span>
              </button>
            ))}
            {!recentStudents.length ? <EmptyState>还没有学生档案。</EmptyState> : null}
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="03" title="本地资产" />
          <div className="pro-kpi-grid">
            <ProKpiCard label="在读学生" value={overview.analytics.activeStudents} detail="当前本地档案" trend="本地" icon={<Users size={18} />} />
            <ProKpiCard label="学习记录" value={overview.analytics.totalRecords} detail="可被 AI 检索" trend="证据" icon={<ClipboardList size={18} />} />
            <ProKpiCard label="复盘报告" value={overview.analytics.totalReports} detail="老师确认后保存" trend="可追溯" icon={<FileText size={18} />} />
            <ProKpiCard label="附件" value={overview.analytics.totalAttachments} detail="路径和元数据入库" trend="本地" icon={<HardDrive size={18} />} />
          </div>
        </section>

        <section className="work-panel span-2 review-reminder-card" data-testid="review-reminder-card">
          <WorkspaceLabel number="04" title="复习提醒" description="每次打开工作台都从本地学习记录重新计算，不保存第二份队列。" />
          <ReviewReminderPanel activeStudent={activeStudent} onOpenEvidence={() => setActiveView('students')} setStatus={setStatus} />
        </section>

        <section className="work-panel span-2">
          <WorkspaceLabel number="05" title="当前学生证据" description={activeStudent ? activeStudent.displayName : '未选择学生'} />
          {records.slice(0, 4).map((record) => (
            <article className="evidence-row" key={record.id}>
              <time>{formatDate(record.occurredAt)}</time>
              <Badge tone={record.recordType === 'mistake' ? 'amber' : 'neutral'}>{recordTypeLabels[record.recordType] ?? record.recordType}</Badge>
              <strong>{record.title}</strong>
              <button className="link-button" onClick={() => editRecord(record)}>编辑</button>
            </article>
          ))}
          {!records.length ? <EmptyState>当前学生还没有学习记录。</EmptyState> : null}
        </section>
      </div>
    );
  }

  function renderAIConsoleView() {
    const availableSources = aiResult?.sources.map((source) => ({
      ...source,
      icon: source.type.includes('SQLite') ? <ClipboardList size={18} /> : source.type.includes('文件') ? <HardDrive size={18} /> : source.type.includes('学生') ? <Users size={18} /> : <FileSearch size={18} />,
    })) ?? [
      {
        title: activeStudent?.displayName ?? '未选择学生',
        type: '学生档案',
        detail: activeStudent?.currentIssues || '选择学生后读取当前问题、目标和家长关注点。',
        count: activeStudent ? '已选择' : '待选择',
        icon: <Users size={18} />,
      },
      {
        title: '学习记录',
        type: '本地 SQLite',
        detail: '可按类型、科目、标签、关键词和时间范围调用。',
        count: records.length,
        icon: <ClipboardList size={18} />,
      },
      {
        title: '本地附件',
        type: '文件系统',
        detail: 'AI 当前只读取元数据；原始附件不会自动上传。',
        count: activeAttachments.length,
        icon: <HardDrive size={18} />,
      },
      {
        title: '老师知识库',
        type: 'Docling / MinerU',
        detail: '资源解析、切片、向量索引和图谱抽取尚未接入。',
        count: '未接入',
        icon: <FileSearch size={18} />,
      },
    ];
    const displayedTools = aiResult?.toolRuns.map((tool) => ({
      name: tool.name,
      label: tool.label,
      status: tool.status === 'used' ? '已调用' : tool.status === 'ready' ? '可调用' : tool.status === 'failed' ? '失败' : '受阻',
      description: tool.detail,
    })) ?? toolPlan;

    return (
      <div className="ai-console-layout">
        <section className="work-panel ai-context-panel">
          <WorkspaceLabel number="01" title="任务上下文" description="一句话任务会先绑定学生、时间和知识范围。" />
          {activeStudent ? (
            <div className="student-focus">
              <strong>{activeStudent.displayName}</strong>
              <span>{activeStudent.grade || '未填年级'} · {(activeStudent.subjects.length ? activeStudent.subjects : ['未填科目']).join(' / ')}</span>
              <p>{activeStudent.currentIssues || '当前问题尚未记录。'}</p>
            </div>
          ) : <EmptyState>请选择学生后再运行 AI 任务。</EmptyState>}
          <div className="form-grid single context-controls">
            <label>
              时间范围
              <select value="last30" onChange={() => setStatus('AI 时间范围选择将在工具调用接入时生效。')}>
                <option value="last30">最近 30 天</option>
                <option value="term">本学期</option>
                <option value="custom">自定义</option>
              </select>
            </label>
            <label>
              知识库范围
              <select value="teacher" onChange={() => setStatus('知识库范围选择将在老师知识库接入后生效。')}>
                <option value="teacher">老师专属知识库</option>
                <option value="student">当前学生资料</option>
                <option value="all">全部本地资产</option>
              </select>
            </label>
          </div>
          <div className="settings-hint">
            <div>
              <strong>{deepSeekSettings.configured ? 'DeepSeek 已可用' : '需要先配置 DeepSeek'}</strong>
              <span>{deepSeekSettings.configured ? `${deepSeekSettings.model} · ${deepSeekSettings.maskedApiKey}` : '在设置页保存 API Key 后，中控台即可直接运行。'}</span>
            </div>
            <button className="secondary-action" onClick={() => setActiveView('settings')}>
              <Settings size={16} />
              设置
            </button>
          </div>
        </section>

        <section className="work-panel ai-main-panel">
          <WorkspaceLabel number="02" title="AI 中控台" description="用一句话调度学生数据、知识库和复盘/题组工具。" />
          <PromptSuggestionPanel suggestions={aiPromptSuggestions} onPick={setAiPrompt} />
          <div className="pro-prompt-shell">
            <textarea className="ai-prompt" aria-label="一句话任务" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
            <div className="prompt-toolbar">
              <div>
                <Badge tone="blue">本地优先</Badge>
                <Badge tone="amber">写入需确认</Badge>
                <Badge tone={deepSeekSettings.configured ? 'blue' : 'amber'}>{deepSeekSettings.configured ? `DeepSeek ${deepSeekSettings.model}` : 'DeepSeek 未配置'}</Badge>
              </div>
              <button className="primary-action" disabled={aiRunning} onClick={() => runAiConsole()}>
                <Sparkles size={17} />
                {aiRunning ? '调用中' : '运行 DeepSeek'}
              </button>
            </div>
          </div>

          <div className="source-grid">
            {availableSources.map((source) => (
              <ProSourceCard key={source.title} {...source} />
            ))}
          </div>

          <div className="ai-output-placeholder" data-testid="ai-output">
            <WorkspaceLabel number="03" title="AI 输出区" description="回答必须带证据引用和老师确认入口。" />
            {aiResult?.ok ? (
              <article className="ai-answer-card">
                <div className="answer-meta">
                  <Badge tone="blue">{aiResult.model}</Badge>
                  {aiResult.usage?.totalTokens ? <Badge>{aiResult.usage.totalTokens} tokens</Badge> : null}
                  {aiResult.knowledgeSnippets?.length ? <Badge tone="green">{aiResult.knowledgeSnippets.length} 个知识片段</Badge> : null}
                  {aiResult.graphNodes?.length ? <Badge tone="green">{aiResult.graphNodes.length} 个图谱节点</Badge> : null}
                </div>
                <div className="ai-answer-text">{aiResult.content}</div>
                {aiResult.knowledgeSnippets?.length ? (
                  <div className="ai-reference-list">
                    <h3>知识库引用</h3>
                    {aiResult.knowledgeSnippets.slice(0, 4).map((chunk) => (
                      <article key={chunk.id}>
                        <strong>{chunk.resourceTitle}</strong>
                        <span>{chunk.heading || `片段 ${chunk.chunkIndex + 1}`}</span>
                        <p>{chunk.contentMd.slice(0, 180)}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>
            ) : (
              <div className="assistant-empty" data-testid={aiResult?.errorMessage ? 'ai-output-error' : 'ai-output-empty'}>
                <Sparkles size={22} />
                <div>
                  <strong>{aiResult?.errorMessage ? 'DeepSeek 调用失败' : '等待运行'}</strong>
                  <p>{aiResult?.errorMessage || '点击“运行 DeepSeek”后，这里会显示真实返回。没有返回前不会伪造回答。'}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="04" title="工具调用轨迹" description="每一步都要能追溯到本地数据或老师知识库。" />
          <div className="tool-run-list">
            {displayedTools.map((tool) => (
              <ProToolCard key={tool.name} {...tool} />
            ))}
          </div>
          <div className="confirm-panel">
            <h3>老师确认队列</h3>
            <article>
              <CheckCircle2 size={16} />
              <div>
                <strong>当前无待确认写入</strong>
                <p>保存复盘、题组、学生标签和知识图谱关系前都会进入这里。</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    );
  }

  function renderAIConsoleViewV2() {
    const contextItems = [
      {
        count: activeStudent?.displayName ?? '未选',
        title: '学生档案',
        source: 'SQLite',
        detail: activeStudent
          ? '阶段目标、当前问题、家长关注点和标签已纳入上下文。'
          : '请选择学生后纳入档案上下文。',
      },
      {
        count: records.length,
        title: '学习记录',
        source: 'SQLite',
        detail: '最近记录已按发生时间倒序纳入上下文。',
      },
      {
        count: activeAttachments.length,
        title: '附件元数据',
        source: '本地文件系统',
        detail: '只纳入文件数量和元数据，不读取或上传原始附件。',
      },
      {
        count: aiResult?.knowledgeSnippets?.length ?? knowledgeOverview.counts.chunks,
        title: '老师知识库',
        source: 'SQLite / 本地切片',
        detail: aiResult?.knowledgeSnippets?.length
          ? '已纳入命中的知识库文本片段。'
          : '当前没有命中可用知识库文本片段。',
      },
      {
        count: aiResult?.graphNodes?.length ?? knowledgeOverview.counts.nodes,
        title: '知识图谱',
        source: 'SQLite nodes / edges',
        detail: '已纳入知识图谱节点摘要。',
      },
    ];

    const liveArtifacts = aiResult?.executionMode === 'direct' ? [] : buildAiArtifacts(aiPrompt, aiResult);
    const selectedArtifact = activeAiArtifact ?? liveArtifacts[0] ?? null;
    const hasAiTurn = Boolean(aiRunning || aiMessages.length);
    const activeAiSession = aiSessions.find((session) => session.id === activeAiSessionId) ?? null;
    const readThoughtSteps = (message: AiConversationMessage): AiThoughtStep[] => {
      const raw = message.metadata.thoughtSteps;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((step): step is AiThoughtStep =>
          Boolean(step && typeof step === 'object' && 'label' in step && 'detail' in step),
        )
        .map((step) => ({ label: String(step.label), detail: String(step.detail) }));
    };
    const readTraceSources = (message: AiConversationMessage): AiTraceSource[] => {
      const raw = message.metadata.contextSources;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((source): source is AiTraceSource =>
          Boolean(source && typeof source === 'object' && 'title' in source && 'detail' in source),
        )
        .map((source) => ({
          title: String(source.title),
          source: String(source.source ?? ''),
          detail: String(source.detail),
        }));
    };
    const readTraceTools = (message: AiConversationMessage): AiTraceTool[] => {
      const raw = message.metadata.toolRuns;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((tool): tool is AiTraceTool =>
          Boolean(tool && typeof tool === 'object' && 'toolName' in tool && 'argsText' in tool),
        )
        .map((tool) => ({
          toolName: String(tool.toolName),
          state: ['output-available', 'requires-action', 'input-streaming', 'output-error'].includes(String(tool.state))
            ? tool.state
            : 'output-available',
          argsText: String(tool.argsText),
          output: tool.output && typeof tool.output === 'object' && !Array.isArray(tool.output)
            ? tool.output
            : {},
        }));
    };
    const readArtifacts = (message: AiConversationMessage): AiArtifact[] => {
      const raw = message.metadata.artifacts;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((artifact): artifact is AiArtifact =>
          Boolean(artifact && typeof artifact === 'object' && 'title' in artifact && 'content' in artifact),
        )
        .map((artifact) => ({
          id: String(artifact.id),
          title: String(artifact.title),
          type: String(artifact.type),
          artifactType: normalizeDocumentArtifactType(String(artifact.artifactType ?? artifact.type)),
          fileName: String(artifact.fileName),
          mimeType: String(artifact.mimeType),
          description: String(artifact.description),
          content: String(artifact.content),
          exportStatus: ['draft', 'exported', 'failed'].includes(String(artifact.exportStatus))
            ? artifact.exportStatus as AiArtifact['exportStatus']
            : undefined,
          filePath: String(artifact.filePath ?? ''),
          fileSize: Number(artifact.fileSize ?? 0),
          contentHash: String(artifact.contentHash ?? ''),
          errorMessage: String(artifact.errorMessage ?? ''),
        }));
    };
    const liveTrace = aiResult?.executionMode === 'direct'
      ? { thoughtSteps: [], contextSources: [], toolRuns: [] }
      : buildAiTrace(aiPrompt, aiResult, liveArtifacts);
    const deepTutorThoughtSteps: AiThoughtStep[] = deepTutorEvents.map((event) => ({
      label: `${event.label} · ${event.sequence}`,
      detail: event.detail,
    }));
    const liveThoughtSteps = aiResult?.executionMode === 'direct'
      ? []
      : deepTutorThoughtSteps.length ? deepTutorThoughtSteps : liveTrace.thoughtSteps;
    const visibleConfirmations = aiConfirmations.slice(0, 2);
    const hiddenConfirmationCount = Math.max(0, aiConfirmations.length - visibleConfirmations.length);
    const startArtifactResize = (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = artifactPanelWidth;
      const onMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.min(720, Math.max(320, startWidth - (moveEvent.clientX - startX)));
        setArtifactPanelWidth(nextWidth);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.classList.remove('is-resizing-artifact');
      };
      document.body.classList.add('is-resizing-artifact');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    };
    const consoleGridStyle: CSSProperties | undefined = activeAiArtifact
      ? { gridTemplateColumns: `284px minmax(420px, 1fr) 8px ${artifactPanelWidth}px` }
      : undefined;

    return (
      <div className={`ai-console-v2 ${activeAiArtifact ? 'with-artifact' : ''}`} style={consoleGridStyle}>
        <AiConversationSidebar
          folders={aiFolders}
          sessions={aiSessions}
          activeSessionId={activeAiSessionId}
          onOpenSession={openAiConversation}
          onNewSession={startNewAiConversation}
          onCreateFolder={createAiFolder}
          onMoveSession={moveAiConversation}
          onRename={renameAiConversationTarget}
          onArchive={archiveAiConversationTarget}
        />

        <section className="work-panel ai-chat-surface">
          <div className="ai-chat-header">
            <WorkspaceLabel
              number="02"
              title={activeAiSession?.title || 'AI 中控台'}
              description="对话会写入本地 SQLite，可在左侧按文件夹分类。"
            />
          </div>

          <div className="ai-conversation-frame">
            <ChatConversation className="ai-chat-conversation">
              <ChatConversation.Content className="ai-chat-content">
                {!hasAiTurn ? (
                  <div className="ai-console-empty">
                    <PromptSuggestionPanel suggestions={aiPromptSuggestions} onPick={setAiPrompt} />
                  </div>
                ) : null}

                {aiMessages.map((message) => {
                  if (message.role === 'user') {
                    return (
                      <ChatMessage.User key={message.id}>
                        <ChatMessage.Bubble>
                          <ChatMessage.Content>{message.content}</ChatMessage.Content>
                        </ChatMessage.Bubble>
                      </ChatMessage.User>
                    );
                  }
                  const thoughtSteps = readThoughtSteps(message);
                  const messageArtifacts = readArtifacts(message);
                  const messageRunId = String(message.metadata.agentRunId ?? '');
                  const messageOk = message.metadata.ok === true;
                  return (
                    <ChatMessage.Assistant key={message.id}>
                      <ChatMessage.Avatar show alt="Omni-Edu AI" fallback="AI" />
                      <ChatMessage.Body>
                        {thoughtSteps.length ? (
                          <ChainOfThought defaultExpanded>
                            <ChainOfThought.Trigger>思考过程摘要</ChainOfThought.Trigger>
                            <ChainOfThought.Content>
                              <ChainOfThought.Steps>
                                {thoughtSteps.map((step) => (
                                  <ChainOfThought.Step key={step.label} label={step.label}>
                                    {step.detail}
                                  </ChainOfThought.Step>
                                ))}
                              </ChainOfThought.Steps>
                            </ChainOfThought.Content>
                          </ChainOfThought>
                        ) : null}

                        <div data-testid={messageOk ? 'ai-output-success' : 'ai-output-error'}>
                          <ChatMessage.Content>
                            <Markdown>{message.content}</Markdown>
                          </ChatMessage.Content>
                        </div>

                        {messageArtifacts.length ? (
                          <div className="ai-output-links" aria-label="生成的文档">
                            {messageArtifacts.map((artifact) => (
                              <button
                                className="ai-output-link"
                                key={artifact.id}
                                onClick={() => setActiveAiArtifact(artifact)}
                                data-testid={`ai-artifact-open-${artifact.id}`}
                              >
                                {artifact.title}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {messageRunId ? (
                          <div className="ai-run-actions" aria-label="运行变更">
                            {!messageOk ? (
                              <button className="secondary-action compact-button" disabled={Boolean(aiMutationRunningId)} onClick={() => void mutateAiRunFromMessage(messageRunId, 'retry')}>
                                重试本轮
                              </button>
                            ) : null}
                            <button className="secondary-action compact-button" disabled={Boolean(aiMutationRunningId)} onClick={() => void mutateAiRunFromMessage(messageRunId, 'branch')}>
                              创建分支
                            </button>
                            <button className="ghost-action compact-button" disabled={Boolean(aiMutationRunningId)} onClick={() => void mutateAiRunFromMessage(messageRunId, 'regenerate')}>
                              重新生成
                            </button>
                          </div>
                        ) : null}

                      </ChatMessage.Body>
                    </ChatMessage.Assistant>
                  );
                })}

                {pendingUserInput ? (
                  <ChatMessage.Assistant>
                    <ChatMessage.Avatar show alt="Omni-Edu AI" fallback="AI" />
                    <ChatMessage.Body>
                      <div className="ai-user-input-card" role="dialog" aria-label="小智补充信息">
                        <strong>小智需要补充信息</strong>
                        <p>{pendingUserInput.prompt}</p>
                        {pendingUserInput.questions?.map((question) => (
                          <div className="ai-user-input-question" key={question.id}>
                            <span>{question.question}</span>
                            {question.options?.length ? <small>{question.options.join(' / ')}</small> : null}
                          </div>
                        ))}
                        <textarea
                          aria-label="补充信息"
                          className="ai-user-input-textarea"
                          value={userInputText}
                          onChange={(event) => setUserInputText(event.target.value.slice(0, 4_000))}
                          placeholder="输入后提交，小智会从当前步骤继续"
                          rows={3}
                        />
                        <div className="ai-user-input-actions">
                          <button className="primary-action compact-button" onClick={() => void submitPendingUserInput()}>
                            提交并继续
                          </button>
                          <button className="secondary-action compact-button" onClick={() => void cancelPendingUserInput()}>
                            取消本轮
                          </button>
                        </div>
                      </div>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ) : null}

                {deepTutorContinuation ? (
                  <ChatMessage.Assistant>
                    <ChatMessage.Avatar show alt="Omni-Edu AI" fallback="AI" />
                    <ChatMessage.Body>
                      <div className="ai-continuation-card" role="status" aria-label="小智预算续写">
                        <strong>{deepTutorContinuation.approvalRequired ? '追加预算需要确认' : '本轮已安全暂停'}</strong>
                        <p>{deepTutorContinuation.approvalRequired
                          ? `请求预算：${deepTutorContinuation.requestedBudgets?.maxEvents ?? '-'} 个事件 / ${deepTutorContinuation.requestedBudgets?.maxWallMs ?? '-'}ms。确认后才会继续。`
                          : '小智已保存当前可见进度。继续后会沿用同一任务上下文，并受限于剩余续写次数。'}</p>
                        {deepTutorContinuation.approvalRequired ? (
                          <button className="primary-action compact-button" disabled={aiRunning} onClick={() => void approveDeepTutorBudget()}>
                            批准追加预算并继续
                          </button>
                        ) : (
                          <button className="primary-action compact-button" disabled={aiRunning} onClick={() => void continueDeepTutorBudget()}>
                            继续当前任务
                          </button>
                        )}
                      </div>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ) : null}

                {aiRunning ? (
                  <ChatMessage.Assistant>
                    <ChatMessage.Avatar show alt="Omni-Edu AI" fallback="AI" />
                    <ChatMessage.Body>
                      <ChatMessage.Content>
                        <p>小智正在生成回复。</p>
                      </ChatMessage.Content>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ) : null}
              </ChatConversation.Content>
            </ChatConversation>
          </div>

          {aiConfirmations.length ? (
            <div className="ai-confirmation-queue" aria-label="小智待确认写入项" data-testid="ai-confirmation-queue">
              <div className="ai-confirmation-queue-header">
                <div>
                  <strong>待老师确认</strong>
                  <span>只提醒最近关键项；确认前不会写入本地业务数据。</span>
                </div>
                <Badge tone="amber">{aiConfirmations.length} 项</Badge>
              </div>
              <div className="ai-confirmation-items">
                {visibleConfirmations.map((item) => (
                  <article className="ai-confirmation-card" key={item.id} data-testid={`ai-confirmation-${item.id}`}>
                    <div>
                      <div className="ai-confirmation-title">
                        <FileText size={15} />
                        <strong>{item.title}</strong>
                        <Badge tone="blue">{item.actionType === 'create_review_report' ? '复盘报告' : item.actionType === 'save_exercise_set' ? '三元题组' : item.actionType === 'save_mastery_state' ? '掌握度写入' : item.actionType}</Badge>
                      </div>
                      <p>{item.description || '确认后才会写入本地数据。'}</p>
                      <blockquote>{item.previewMd.slice(0, 160)}{item.previewMd.length > 160 ? '…' : ''}</blockquote>
                    </div>
                    <div className="ai-confirmation-actions">
                      <button className="primary-action compact-button" onClick={() => void confirmAiItem(item)} data-testid={`ai-confirm-${item.id}`}>
                        <CheckCircle2 size={15} />
                        确认保存
                      </button>
                      <button className="secondary-action compact-button" onClick={() => void rejectAiItem(item)} data-testid={`ai-reject-${item.id}`}>
                        拒绝
                      </button>
                    </div>
                  </article>
                ))}
                {hiddenConfirmationCount ? (
                  <div className="ai-confirmation-more">
                    还有 {hiddenConfirmationCount} 项已收起，处理完当前两项后再继续展示，避免打断老师当前对话。
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <ChatAttachmentInput
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md"
            multiple
            onFilesSelected={(files) => {
              const names = files.map((file) => `${file.name || '未命名文件'} ${formatBytes(file.size)}`).join('、');
              setStatus(`已选择 ${files.length} 个附件：${names}。当前只纳入元数据，原始附件不上传。`);
            }}
          >
            <ChatAttachmentInput.Dropzone className="ai-composer-block">
            <PromptInput
              layout="inline"
              value={aiPrompt}
              onSubmit={runAiConsole}
              onValueChange={setAiPrompt}
              status={aiRunning ? 'streaming' : 'ready'}
            >
              <PromptInput.Shell>
                {activeAttachments.length ? (
                  <PromptInput.Attachments>
                    {activeAttachments.slice(0, 4).map((attachment) => (
                      <ChatAttachment
                        key={attachment.id}
                        mediaType="document"
                        name={`${attachment.fileName} · ${formatBytes(attachment.fileSize)}`}
                      >
                        <ChatAttachment.Preview />
                        <ChatAttachment.Name />
                      </ChatAttachment>
                    ))}
                    {activeAttachments.length > 4 ? (
                      <span className="ai-attachment-overflow">+{activeAttachments.length - 4}</span>
                    ) : null}
                  </PromptInput.Attachments>
                ) : null}
                <PromptInput.Content>
                  <PromptInput.TextArea data-testid="ai-prompt-input" placeholder="输入要生成的复盘、练习、PDF 或 Word 文档需求" />
                </PromptInput.Content>
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart>
                    <ChatAttachmentInput.Trigger className="prompt-attachment-trigger" aria-label="选择附件元数据">
                      <UploadCloud size={16} />
                    </ChatAttachmentInput.Trigger>
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd>
                    <PromptInput.Send
                      aria-label="运行 DeepSeek"
                      onClick={(event) => {
                        event.preventDefault();
                        void runAiConsole();
                      }}
                    >
                      <Sparkles size={16} />
                    </PromptInput.Send>
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            </PromptInput>
              <div className="ai-composer-footer">
                <div className="ai-context-strip">
                  {contextItems.map((item) => (
                    <button className="ai-context-chip" key={item.title} title={item.detail}>
                      <strong>{item.count}</strong>
                      <span>{item.title}</span>
                      <em>{item.source}</em>
                    </button>
                  ))}
                </div>
              </div>
            </ChatAttachmentInput.Dropzone>
          </ChatAttachmentInput>
        </section>

        {activeAiArtifact ? (
          <div
            aria-label="调整文档预览宽度"
            className="ai-artifact-resizer"
            role="separator"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setArtifactPanelWidth((width) => Math.min(720, width + 24));
              if (event.key === 'ArrowRight') setArtifactPanelWidth((width) => Math.max(320, width - 24));
            }}
            onPointerDown={startArtifactResize}
          />
        ) : null}

        {activeAiArtifact ? (
          <aside className="work-panel ai-artifact-panel" data-testid="ai-artifact-panel">
            <div className="panel-heading">
              <div>
                <h2>{selectedArtifact.title}</h2>
                <p>{selectedArtifact.description}</p>
              </div>
              <button className="icon-button" aria-label="关闭产物面板" onClick={() => setActiveAiArtifact(null)}>
                ×
              </button>
            </div>
            <div className="ai-artifact-preview">
              <div className="answer-meta">
                <Badge tone="blue">{selectedArtifact.type}</Badge>
                <Badge tone={selectedArtifact.exportStatus === 'exported' ? 'green' : selectedArtifact.exportStatus === 'failed' ? 'red' : 'amber'}>
                  {selectedArtifact.exportStatus === 'exported' ? '已导出' : selectedArtifact.exportStatus === 'failed' ? '导出失败' : '可预览'}
                </Badge>
              </div>
              <ChatAttachmentGroup className="ai-artifact-file">
                <ChatAttachment mimeType={selectedArtifact.mimeType} name={selectedArtifact.fileName}>
                  <ChatAttachment.Preview />
                  <div className="ai-output-document-body">
                    <ChatAttachment.Name />
                    <span>{selectedArtifact.description}</span>
                  </div>
                </ChatAttachment>
              </ChatAttachmentGroup>
              {selectedArtifact.filePath ? (
                <p className="artifact-export-meta" data-testid="ai-artifact-export-meta">
                  已生成：{selectedArtifact.filePath}
                  {selectedArtifact.contentHash ? ` · sha256 ${selectedArtifact.contentHash.slice(0, 12)}` : ''}
                </p>
              ) : null}
              {selectedArtifact.errorMessage ? <p className="artifact-export-error" data-testid="ai-artifact-export-error">{selectedArtifact.errorMessage}</p> : null}
              <Markdown>{selectedArtifact.content}</Markdown>
            </div>
            <div className="quick-actions">
              <button className="primary-action" onClick={() => exportAiArtifact(selectedArtifact, true)} data-testid="ai-artifact-export">
                <FileDown size={16} />
                导出到本地工作目录
              </button>
              <button className="secondary-action" onClick={() => exportAiArtifact(selectedArtifact)} data-testid="ai-artifact-export-choose">选择位置导出</button>
              <button className="secondary-action" onClick={() => showAiArtifactFile(selectedArtifact)} data-testid="ai-artifact-show">
                <CheckCircle2 size={16} />
                在文件夹中显示
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    );
  }

  function renderKnowledgeBaseView() {
    const resources = knowledgeOverview.resources;
    const chunks = knowledgeOverview.chunks;
    const graphNodes = knowledgeOverview.nodes.length ? knowledgeOverview.nodes : [];
    return (
      <div className="knowledge-layout">
        <section className="work-panel">
          <WorkspaceLabel number="01" title="资源导入" description="PDF、Word、PPT、图片等资源将进入老师专属知识库。" />
          <button className="primary-action wide" onClick={importKnowledgeResources}>
            <FileSearch size={17} />
            导入知识资源
          </button>
          {knowledgeImport ? (
            <div className="import-status-list">
              {knowledgeImport.items.slice(0, 4).map((item) => (
                <article className={item.ok ? 'passed' : 'failed'} key={`${item.sourcePath}-${item.fileName}`}>
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>{item.fileName}</strong>
                    <p>{item.ok ? `已复制，${formatBytes(item.fileSize)}` : item.errorMessage}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <div className="resource-source-list">
            {resources.map((resource) => (
              <button className="resource-row" key={resource.id} onClick={() => window.omniEdu?.showKnowledgeResource(resource.localPath)}>
                <FileText size={16} />
                <div>
                  <strong>{resource.title}</strong>
                  <span>{resource.originalFileName} · {formatBytes(resource.fileSize)}</span>
                  <p>{resource.parseEngine} · {resource.chunkCount} 个切片</p>
                </div>
                <Badge tone={resource.parseStatus === 'parsed' ? 'green' : resource.parseStatus === 'failed' ? 'red' : 'amber'}>
                  {resource.parseStatus === 'parsed' ? '已解析' : resource.parseStatus === 'needs_parser' ? '待解析引擎' : resource.parseStatus}
                </Badge>
              </button>
            ))}
            {!resources.length ? <EmptyState>还没有导入老师知识资源。TXT / Markdown 会立刻切片，PDF、Word、PPT、图片会先进入解析队列。</EmptyState> : null}
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="02" title="解析管线" description="前期主解析 Docling，复杂教材和扫描件使用 MinerU 增强。" />
          <div className="pipeline-list">
            {knowledgePipeline.map((step, index) => (
              <ProQueueItem key={step.label} index={index} title={step.label} status={step.status} detail={step.detail} />
            ))}
          </div>
        </section>

        <section className="work-panel knowledge-graph-panel span-2">
          <WorkspaceLabel number="03" title="知识图谱可视化" description="当前先用本地 SVG/按钮节点呈现真实资源关系，后续可替换为 Sigma.js。" />
          <div className="graph-canvas" aria-label="知识图谱可视化">
            {graphNodes.map((node, index) => (
              <button key={node.id} className={`graph-node graph-node-${index % 8}`} style={{ '--node-index': index } as CSSProperties}>
                {node.name}
              </button>
            ))}
            {knowledgeOverview.edges.slice(0, 3).map((edge, index) => (
              <span className={`graph-edge edge-${index + 1}`} key={edge.id} title={`${edge.relationType}: ${edge.evidenceText}`} />
            ))}
            {!graphNodes.length ? <div className="graph-empty">导入资源后生成资源节点和来源关系。</div> : null}
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="04" title="当前真实资产" description="只展示本地已入库的资源、切片和图谱关系。" />
          <div className="pro-kpi-grid">
            <ProKpiCard label="知识资源" value={knowledgeOverview.counts.resources} detail="老师导入的本地资源" trend="本地" icon={<HardDrive size={18} />} />
            <ProKpiCard label="已解析资源" value={knowledgeOverview.counts.parsedResources} detail="已可被 AI 检索引用" trend="切片" icon={<ClipboardList size={18} />} />
            <ProKpiCard label="图谱节点" value={knowledgeOverview.counts.nodes} detail={`${knowledgeOverview.counts.edges} 条关系`} trend="可追溯" icon={<FileText size={18} />} />
            <ProKpiCard label="解析队列" value={knowledgeOverview.counts.queuedTasks} detail="Docling/MinerU 待处理任务" trend="待接入" icon={<Sparkles size={18} />} />
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="05" title="文档切片预览" description="AI 只使用这里真实存在的切片，不读取未解析原文。" />
          <div className="chunk-list">
            {chunks.map((chunk) => (
              <article key={chunk.id}>
                <strong>{chunk.resourceTitle}</strong>
                <span>{chunk.heading || `片段 ${chunk.chunkIndex + 1}`}</span>
                <p>{chunk.contentMd.slice(0, 220)}</p>
              </article>
            ))}
            {!chunks.length ? <EmptyState>暂无可检索切片。先导入 TXT 或 Markdown，PDF/Word 解析引擎接入后会自动生成切片。</EmptyState> : null}
          </div>
        </section>

        <section className="work-panel">
          <WorkspaceLabel number="06" title="AI 使用规则" />
          <div className="system-list">
            <span><FileSearch size={16} />AI 回答必须引用资源片段、记录或图谱节点。</span>
            <span><ShieldCheck size={16} />AI 不直接写入知识图谱，需老师确认。</span>
            <span><Database size={16} />工具调用日志不保存学生隐私全文。</span>
          </div>
        </section>
      </div>
    );
  }

  function renderStudentsView() {
    return (
      <div className="split-workspace">
        {renderStudentDirectory()}
        <div className="stack">
          <StudentProfileLifecycle
            activeStudent={activeStudent}
            formMode={studentFormMode}
            form={studentForm}
            onFormChange={setStudentForm}
            onSave={submitStudent}
            onStartEdit={loadActiveStudentForEdit}
            onCancelForm={() => {
              setStudentFormMode('closed');
              setStudentForm(initialStudentForm);
              setStatus('已取消学生档案编辑。');
            }}
            onStudentsChanged={async (nextStudents, archivedStudentId) => {
              setStudents(nextStudents);
              const nextActive = nextStudents.find((student) => student.status === 'active' && student.id !== archivedStudentId);
              setActiveStudentId(nextActive?.id ?? archivedStudentId);
              setStudentFormMode('closed');
              setStudentForm(initialStudentForm);
              await refreshOverview();
            }}
            setStatus={setStatus}
          />
          {renderTimeline(true)}
          <section className="work-panel">
            <WorkspaceLabel number="04" title="附件与历史复盘" description="大文件只保存路径和元数据。" />
            <div className="two-column-list">
              <div>
                <h3>附件</h3>
                {activeAttachments.slice(0, 8).map((attachment) => (
                  <button className="attachment-row" key={attachment.id} onClick={() => window.omniEdu?.showAttachment(attachment.filePath)}>
                    <FileText size={16} />
                    <span>{attachment.fileName}</span>
                    <span>{formatBytes(attachment.fileSize)}</span>
                  </button>
                ))}
                {!activeAttachments.length ? <EmptyState>当前学生还没有附件。</EmptyState> : null}
              </div>
              <div>
                <h3>复盘</h3>
                {reports.slice(0, 8).map((report) => (
                  <button className="report-row" key={report.id} onClick={() => {
                    setReviewReportSelectionId(report.id);
                    setActiveView('review');
                  }}>
                    <strong>{report.title}</strong>
                    <span>{formatDate(report.createdAt)}</span>
                  </button>
                ))}
                {!reports.length ? <EmptyState>当前学生还没有复盘报告。</EmptyState> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderIntakeView() {
    return (
      <div className="split-workspace narrow-left">
        <section className="work-panel">
          <WorkspaceLabel number="01" title="当前学生" description="录入前先确认学生。" />
          {activeStudent ? (
            <div className="student-focus">
              <strong>{activeStudent.displayName}</strong>
              <span>{activeStudent.grade || '未填年级'} · {(activeStudent.subjects.length ? activeStudent.subjects : ['未填科目']).join(' / ')}</span>
              <p>{activeStudent.currentIssues || '未记录当前问题。'}</p>
            </div>
          ) : <EmptyState>请选择学生。</EmptyState>}
          <div className="compact-list">
            {recentStudents.map((student) => (
              <button key={student.id} onClick={() => setActiveStudentId(student.id)}>
                <strong>{student.displayName}</strong>
                <span>{student.recordCount} 条记录</span>
              </button>
            ))}
          </div>
        </section>
        <div className="stack">
          {renderRecordForm()}
          {renderTimeline(false)}
        </div>
      </div>
    );
  }

  function renderMistakesView() {
    return (
      <MistakesWorkspace
        activeStudent={activeStudent}
        records={records}
        attachmentImport={attachmentImport}
        aiResult={aiResult}
        aiRunning={aiRunning}
        confirmations={aiConfirmations}
        onImportAttachment={importAttachment}
        onSendAi={async (prompt) => {
          setAiPrompt(prompt);
          setActiveView('ai');
          await runAiConsole(prompt);
        }}
        onConfirm={confirmAiItem}
        onReject={rejectAiItem}
        setStatus={setStatus}
      />
    );
  }

  function renderSearchView() {
    const openStudentFromSearch = async (student: Student) => {
      setStudentQuery('');
      setStudents((await window.omniEdu?.listStudents('')) ?? []);
      setActiveStudentId(student.id);
      setActiveView('students');
      setStatus(`已打开学生：${student.displayName}`);
    };
    const openRecordFromSearch = async (record: LearningRecord) => {
      setStudentQuery('');
      setRecordTypeFilter(''); setRecordSubjectFilter(''); setRecordTagFilter(''); setRecordKeyword(record.title); setRecordStartDate(''); setRecordEndDate('');
      setStudents((await window.omniEdu?.listStudents('')) ?? []);
      setActiveStudentId(record.studentId);
      setActiveView('students');
      setStatus(`已打开记录所属学生，时间线将定位到：${record.title}`);
    };
    return <GlobalSearchWorkspace setStatus={setStatus} onOpenStudent={openStudentFromSearch} onOpenRecord={openRecordFromSearch} />;
  }

  function renderQuestionNotebookView() {
    return <QuestionNotebookWorkspace setStatus={setStatus} />;
  }

  function renderTeachingBookView() {
    return <TeachingBookWorkspace setStatus={setStatus} />;
  }

  function renderTeacherNotebookView() {
    return <TeacherNotebookWorkspace setStatus={setStatus} />;
  }

  function renderMemoryView() {
    return <MemoryGovernanceWorkspace setStatus={setStatus} />;
  }

  function renderMasteryPathView() {
    return <MasteryPathWorkspace activeStudent={activeStudent} setStatus={setStatus} onOpenAi={() => {
      if (!activeStudent) return;
      setAiPrompt(`请基于${activeStudent.displayName}现有学习证据，生成或调整学习路径草稿，并说明每个模块的依据。`);
      setActiveView('ai');
      setStatus('已打开小智并预填学习路径规划任务；提交后仍需教师确认才能写入。');
    }} />;
  }

  function renderTeamView() {
    return (
      <div className="page-grid">
        <section className="work-panel span-2">
          <WorkspaceLabel number="01" title="团队协作骨架" description="展示真实底座状态，未接入能力不伪装成已完成。" />
          <div className="capability-grid">
            <article><Users size={18} /><strong>老师账号</strong><span>{overview.teacherCount} 个本地预留账号</span></article>
            <article><Layers3 size={18} /><strong>学生分配</strong><span>{overview.assignmentCount} 条分配关系</span></article>
            <article><Tag size={18} /><strong>统一标签库</strong><span>{overview.tagCount} 个标签</span></article>
            <article><FileText size={18} /><strong>报告模板</strong><span>{overview.reportTemplateCount} 个模板</span></article>
          </div>
        </section>
        <section className="work-panel">
          <WorkspaceLabel number="02" title="复盘审核" />
          <EmptyState>复盘审核队列尚未接入。</EmptyState>
        </section>
        <section className="work-panel">
          <WorkspaceLabel number="03" title="同步状态" />
          <div className="system-list">
            <span><UploadCloud size={16} />待同步操作：{overview.pendingSyncOperations}</span>
            <span><ShieldCheck size={16} />核心流程仍可离线完成。</span>
          </div>
        </section>
      </div>
    );
  }

  function renderAnalyticsView() {
    return (
      <div className="page-grid">
        <div className="span-2">
          <AiObservabilityWorkspace />
        </div>
        <section className="work-panel span-2">
          <WorkspaceLabel number="01" title="教师工作台概览" description="只展示已有本地聚合，不展示假趋势。" />
          <div className="pro-kpi-grid large">
            <ProKpiCard label="在读学生" value={overview.analytics.activeStudents} detail="当前可服务学生档案" trend="本地聚合" icon={<Users size={18} />} />
            <ProKpiCard label="学习记录" value={overview.analytics.totalRecords} detail="AI 中控台可检索证据" trend="可调用" icon={<ClipboardList size={18} />} />
            <ProKpiCard label="复盘报告" value={overview.analytics.totalReports} detail="老师确认后的交付资产" trend="复盘" icon={<FileText size={18} />} />
            <ProKpiCard label="附件数量" value={overview.analytics.totalAttachments} detail="后续知识库导入来源" trend="本地文件" icon={<HardDrive size={18} />} />
          </div>
        </section>
        <section className="work-panel span-2">
          <WorkspaceLabel number="02" title="AI 与知识资产状态" description="以下状态来自当前已接入的数据层、工具注册表和确认队列。" />
          <div className="capability-grid">
            <article><Sparkles size={18} /><strong>AI 中控台</strong><span>AgentLoop、按需工具、结构校验与运行审计已接入</span></article>
            <article><FileSearch size={18} /><strong>老师知识库</strong><span>{knowledgeOverview.counts.resources} 个资源 · {knowledgeOverview.counts.chunks} 个切片</span></article>
            <article><Database size={18} /><strong>知识图谱</strong><span>{knowledgeOverview.counts.nodes} 个节点 · {knowledgeOverview.counts.edges} 条边</span></article>
            <article><ListChecks size={18} /><strong>老师确认</strong><span>{aiConfirmations.length} 个当前待确认动作</span></article>
          </div>
        </section>
        <section className="work-panel">
          <WorkspaceLabel number="03" title="待续费风险" />
          <EmptyState>待续费规则尚未接入。</EmptyState>
        </section>
        <section className="work-panel">
          <WorkspaceLabel number="04" title="高频薄弱点" />
          <EmptyState>薄弱点聚合将在错题和标签体系稳定后接入。</EmptyState>
        </section>
      </div>
    );
  }

  function renderSettingsView() {
    return (
      <div className="page-grid">
        <section className="work-panel span-2">
          <WorkspaceLabel number="01" title="本地数据与备份" description="本地优先，大附件不写入数据库。" />
          <DataBackupPanel dataRoot={dataRoot} setStatus={setStatus} />
        </section>
        <section className="work-panel span-2">
          <WorkspaceLabel number="02" title="DeepSeek API 配置" description="API Key 只保存在本地设置中，界面不会回显明文。" />
          <div className="settings-grid">
            <div className="settings-status">
              <ProKpiCard
                label="配置状态"
                value={deepSeekSettings.configured ? '已配置' : '未配置'}
                detail={deepSeekSettings.maskedApiKey || '保存 API Key 后即可在 AI 中控台调用'}
                trend={deepSeekSettings.model}
                icon={<Sparkles size={18} />}
              />
            </div>
            <div className="form-grid">
              <label className="full">
                API Key
                <input
                  type="password"
                  value={deepSeekForm.apiKey}
                  placeholder={deepSeekSettings.configured ? '留空表示沿用已保存 Key' : '输入 DeepSeek API Key'}
                  onChange={(event) => setDeepSeekForm({ ...deepSeekForm, apiKey: event.target.value })}
                />
              </label>
              <label>
                模型
                <select value={deepSeekForm.model} onChange={(event) => setDeepSeekForm({ ...deepSeekForm, model: event.target.value })}>
                  <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                  <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                </select>
              </label>
              <button className="primary-action wide" onClick={saveDeepSeekSettings}>
                <CheckCircle2 size={16} />
                保存 DeepSeek 配置
              </button>
            </div>
          </div>
        </section>
        <section className="work-panel span-2">
          <AiQualityReviewWorkspace
            model={deepSeekSettings.model}
            setStatus={setStatus}
            onReplayPrompt={(prompt, label) => {
              setAiPrompt(prompt);
              setActiveView('ai');
              setStatus(`已把质量样本 ${label} 放入小智输入框，可重新运行对比。`);
            }}
          />
        </section>
        <section className="work-panel span-2">
          <WorkspaceLabel
            number="04"
            title="已归档 AI 对话"
            description="从 AI 中控台左侧栏归档的文件夹和对话会保留在这里。"
          />
          <div className="archive-summary">
            <ProKpiCard
              label="归档文件夹"
              value={archivedAiFolders.length}
              detail="右键文件夹归档后会同步归档其中对话"
              trend="本地 SQLite"
              icon={<Archive size={18} />}
            />
            <ProKpiCard
              label="归档对话"
              value={archivedAiSessions.length}
              detail="归档只隐藏在中控台侧栏，不删除消息"
              trend="ai_conversation_sessions"
              icon={<MessageSquare size={18} />}
            />
          </div>
          <div className="archived-ai-list">
            {archivedAiFolders.map((folder) => (
              <article key={folder.id}>
                <Folder size={16} />
                <div>
                  <strong>{folder.name}</strong>
                  <span>文件夹 · {folder.archivedAt || folder.updatedAt}</span>
                </div>
              </article>
            ))}
            {archivedAiSessions.map((session) => (
              <article key={session.id}>
                <MessageSquare size={16} />
                <div>
                  <strong>{session.title}</strong>
                  <span>{session.messageCount} 条消息 · {session.archivedAt || session.updatedAt}</span>
                </div>
              </article>
            ))}
            {!archivedAiFolders.length && !archivedAiSessions.length ? (
              <div className="empty-state">暂无已归档 AI 对话。</div>
            ) : null}
          </div>
        </section>
        <section className="work-panel">
          <WorkspaceLabel number="05" title="本地安全规则" />
          <div className="system-list">
            <span><Database size={16} />SQLite 保存结构化数据。</span>
            <span><HardDrive size={16} />附件保存为本地文件路径和元数据。</span>
            <span><ShieldCheck size={16} />AI/OCR 不自动上传原始附件。</span>
          </div>
        </section>
      </div>
    );
  }

  function renderCurrentView() {
    if (activeView === 'today') return renderTodayView();
    if (activeView === 'ai') return renderAIConsoleViewV2();
    if (activeView === 'knowledge') return renderKnowledgeBaseView();
    if (activeView === 'students') return renderStudentsView();
    if (activeView === 'mastery') return renderMasteryPathView();
    if (activeView === 'intake') return renderIntakeView();
    if (activeView === 'mistakes') return renderMistakesView();
    if (activeView === 'review') return <ReviewReportWorkspace activeStudent={activeStudent} records={records} reports={reports} selectedReportId={reviewReportSelectionId} onReportsChanged={(nextReports) => { setReports(nextReports); void refreshOverview(); }} setStatus={setStatus} />;
    if (activeView === 'search') return renderSearchView();
    if (activeView === 'question_notebook') return renderQuestionNotebookView();
    if (activeView === 'notebook') return renderTeacherNotebookView();
    if (activeView === 'book') return renderTeachingBookView();
    if (activeView === 'memory') return renderMemoryView();
    if (activeView === 'team') return renderTeamView();
    if (activeView === 'analytics') return renderAnalyticsView();
    return renderSettingsView();
  }

  return (
    <main className="app-shell">
      <aside className="global-nav" aria-label="全局导航">
        <div className="brand-block">
          <div className="brand-mark">OE</div>
          <div>
            <strong>Omni-Edu</strong>
            <span>AI 教学资产</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.key} data-testid={`nav-${item.key}`} className={activeView === item.key ? 'active' : ''} onClick={() => setActiveView(item.key)}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AI 中控台与本地教学资产</span>
            <h1>{navItems.find((item) => item.key === activeView)?.label}</h1>
          </div>
          <div className="toolbar">
            <button data-testid="topbar-student-workspace" className="secondary-action" onClick={() => setActiveView('students')}><Users size={17} />学生档案</button>
          </div>
        </header>
        {renderCurrentView()}
      </section>

    </main>
  );
}

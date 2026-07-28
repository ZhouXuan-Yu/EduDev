import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sqlite3 from 'sqlite3';
import { hashFileSha256, isInsideRoot, resolveInsideRoot } from './local-file-security';
import type {
  Attachment,
  AttachmentImportItem,
  AttachmentImportResult,
  AiAgentEvent,
  AiAgentRun,
  AiAgentRunStatus,
  AiAgentTraceStep,
  AiConsoleRunResult,
  AiConversationDetail,
  AiConversationFolder,
  AiConversationFolderInput,
  AiConversationFolderUpdateInput,
  AiConversationMessage,
  AiConversationMessageInput,
  AiConversationSession,
  AiConversationSessionInput,
  AiConversationSessionUpdateInput,
  AiConversationWorkspace,
  BootstrapData,
  DeepSeekSettings,
  DeepSeekSettingsInput,
  ExportDataRootResult,
  ExportStudentResult,
  KnowledgeEdge,
  KnowledgeImportResult,
  KnowledgeNode,
  KnowledgeOverview,
  LearningRecord,
  LearningRecordFilters,
  LearningRecordInput,
  LearningRecordUpdateInput,
  PlatformOverview,
  ResourceChunk,
  ReviewDraftInput,
  ReviewReport,
  ReviewQualityCheck,
  SearchResult,
  Student,
  StudentInput,
} from '../shared/contracts';

type SqlValue = string | number | null | Buffer;
type Row = Record<string, unknown>;

const DEFAULT_RECORD_PAGE_SIZE = 100;
const MAX_RECORD_PAGE_SIZE = 500;
const FTS_MATCH_LIMIT = 500;
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

function now() {
  return new Date().toISOString();
}

function jsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toCsvList(value: string | undefined) {
  return (value ?? '')
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function fileType(fileName: string) {
  const ext = extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'docx';
  if (['.ppt', '.pptx'].includes(ext)) return 'pptx';
  if (['.xls', '.xlsx'].includes(ext)) return 'xlsx';
  if (['.txt', '.md'].includes(ext)) return 'txt';
  return 'other';
}

function canParseAsLocalText(fileName: string) {
  return ['.txt', '.md'].includes(extname(fileName).toLowerCase());
}

function titleFromFileName(fileName: string) {
  return basename(fileName, extname(fileName)).replace(/[_-]+/g, ' ').trim() || fileName;
}

function splitIntoChunks(content: string, maxLength = 1200) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks: Array<{ heading: string; content: string }> = [];
  const sections = normalized.split(/\n(?=#{1,6}\s+)/g);
  for (const section of sections) {
    const heading = section.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() ?? '';
    let remaining = section.trim();
    while (remaining.length > maxLength) {
      chunks.push({ heading, content: remaining.slice(0, maxLength).trim() });
      remaining = remaining.slice(maxLength).trim();
    }
    if (remaining) chunks.push({ heading, content: remaining });
  }
  return chunks.slice(0, 80);
}

function formatDate(date: string) {
  return date.slice(0, 10);
}

function requireNonEmpty(value: string | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function normalizeLimit(value: number | undefined, defaultValue = DEFAULT_RECORD_PAGE_SIZE) {
  if (!Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(Math.trunc(value as number), MAX_RECORD_PAGE_SIZE));
}

function normalizeOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

function hasColumn(rows: Row[], columnName: string) {
  return rows.some((row) => String(row.name) === columnName);
}

function maskApiKey(apiKey?: string) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

export class OmniEduStore {
  private db!: sqlite3.Database;
  private dbPath: string;

  constructor(private dataRoot: string) {
    this.dbPath = join(dataRoot, 'app.db');
  }

  async init(): Promise<BootstrapData> {
    mkdirSync(this.dataRoot, { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('students'), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('teacher_resources'), { recursive: true });
    mkdirSync(this.resolveInsideDataRoot('cache', 'thumbnails'), { recursive: true });

    if (!this.db) {
      this.db = await this.openDatabase(this.dbPath);
    }
    await this.migrate();
    await this.seedIfEmpty();
    return {
      dataRoot: this.dataRoot,
      students: await this.listStudents(''),
      overview: await this.getPlatformOverview(),
    };
  }

  getDataRoot() {
    return this.dataRoot;
  }

  async close() {
    if (!this.db) return;
    const db = this.db;
    await new Promise<void>((resolveClose, reject) => {
      db.close((error) => {
        if (error) reject(error);
        else resolveClose();
      });
    });
    this.db = undefined as unknown as sqlite3.Database;
  }

  async isManagedLocalPath(filePath: string) {
    return isInsideRoot(this.dataRoot, filePath);
  }

  getStudentFolder(studentId: string) {
    return this.studentRoot(studentId);
  }

  async getPlatformOverview(): Promise<PlatformOverview> {
    const [
      tagCount,
      reportTemplateCount,
      pendingSyncOperations,
      pendingAiTasks,
      teacherCount,
      assignmentCount,
      activeStudents,
      totalRecords,
      totalReports,
      totalAttachments,
    ] = await Promise.all([
      this.scalarCount('tag_dictionary'),
      this.scalarCount('report_templates'),
      this.scalarCount('sync_operations', `sync_status != 'succeeded'`),
      this.scalarCount('ai_tasks', `status IN ('pending', 'running', 'retrying')`),
      this.scalarCount('users'),
      this.scalarCount('teacher_student_assignments'),
      this.scalarCount('students', `status = 'active'`),
      this.scalarCount('learning_records'),
      this.scalarCount('review_reports'),
      this.scalarCount('attachments'),
    ]);

    return {
      tagCount,
      reportTemplateCount,
      pendingSyncOperations,
      pendingAiTasks,
      teacherCount,
      assignmentCount,
      analytics: {
        activeStudents,
        totalRecords,
        totalReports,
        totalAttachments,
      },
    };
  }

  async getDeepSeekSettings(): Promise<DeepSeekSettings> {
    const runtime = await this.getDeepSeekRuntimeSettings();
    return {
      configured: Boolean(runtime.apiKey),
      model: runtime.model,
      maskedApiKey: maskApiKey(runtime.apiKey),
      updatedAt: runtime.updatedAt,
    };
  }

  async getDeepSeekRuntimeSettings(): Promise<{ apiKey?: string; model: string; updatedAt: string }> {
    const row = (await this.all(`SELECT value_json, updated_at FROM app_settings WHERE key = 'deepseek'`))[0];
    if (!row) {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: '',
      };
    }
    try {
      const parsed = JSON.parse(String(row.value_json));
      return {
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : process.env.DEEPSEEK_API_KEY,
        model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? ''),
      };
    } catch {
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        updatedAt: String(row.updated_at ?? ''),
      };
    }
  }

  async saveDeepSeekSettings(input: DeepSeekSettingsInput): Promise<DeepSeekSettings> {
    const existing = await this.getDeepSeekRuntimeSettings();
    const apiKey = input.apiKey?.trim() || existing.apiKey || '';
    const model = input.model?.trim() || existing.model || DEFAULT_DEEPSEEK_MODEL;
    const timestamp = now();
    await this.run(
      `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at)
       VALUES ('deepseek', ?, ?)`,
      [JSON.stringify({ apiKey, model }), timestamp],
    );
    return this.getDeepSeekSettings();
  }

  async listStudents(query = ''): Promise<Student[]> {
    const like = `%${query.trim()}%`;
    const rows = await this.all(
      `SELECT s.*,
              COUNT(DISTINCT r.id) AS record_count,
              COALESCE(SUM(DISTINCT a.file_size), 0) AS attachment_bytes
         FROM students s
         LEFT JOIN learning_records r ON r.student_id = s.id
         LEFT JOIN attachments a ON a.student_id = s.id
        WHERE (? = '%%'
           OR s.display_name LIKE ?
           OR s.real_name LIKE ?
           OR s.grade LIKE ?
           OR s.tags LIKE ?)
        GROUP BY s.id
        ORDER BY s.status ASC, s.updated_at DESC`,
      [like, like, like, like, like],
    );
    return rows.map(this.mapStudent);
  }

  async createStudent(input: StudentInput): Promise<Student[]> {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    const id = `student_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO students (
        id, display_name, real_name, grade, school, subjects, goals,
        current_issues, parent_concerns, teacher_notes, tags, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        id,
        displayName,
        input.realName ?? '',
        input.grade ?? '',
        input.school ?? '',
        JSON.stringify(input.subjects ?? []),
        input.goals ?? '',
        input.currentIssues ?? '',
        input.parentConcerns ?? '',
        input.teacherNotes ?? '',
        JSON.stringify(input.tags ?? []),
        timestamp,
        timestamp,
      ],
    );
    mkdirSync(this.studentRoot(id), { recursive: true });
    return this.listStudents('');
  }

  async updateStudent(id: string, input: StudentInput): Promise<Student[]> {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    await this.run(
      `UPDATE students
          SET display_name = ?, real_name = ?, grade = ?, school = ?, subjects = ?,
              goals = ?, current_issues = ?, parent_concerns = ?, teacher_notes = ?,
              tags = ?, updated_at = ?
        WHERE id = ?`,
      [
        displayName,
        input.realName ?? '',
        input.grade ?? '',
        input.school ?? '',
        JSON.stringify(input.subjects ?? []),
        input.goals ?? '',
        input.currentIssues ?? '',
        input.parentConcerns ?? '',
        input.teacherNotes ?? '',
        JSON.stringify(input.tags ?? []),
        now(),
        id,
      ],
    );
    return this.listStudents('');
  }

  async archiveStudent(id: string): Promise<Student[]> {
    await this.run(`UPDATE students SET status = 'archived', updated_at = ? WHERE id = ?`, [now(), id]);
    return this.listStudents('');
  }

  async listRecords(studentId: string, filters: LearningRecordFilters = {}): Promise<LearningRecord[]> {
    const params: SqlValue[] = [studentId];
    let where = 'WHERE student_id = ?';
    if (filters.type) {
      where += ' AND record_type = ?';
      params.push(filters.type);
    }
    if (filters.subject?.trim()) {
      where += ' AND subject = ?';
      params.push(filters.subject.trim());
    }
    if (filters.tag?.trim()) {
      where += ' AND tags LIKE ?';
      params.push(`%${filters.tag.trim()}%`);
    }
    if (filters.startDate) {
      where += ' AND occurred_at >= ?';
      params.push(new Date(`${filters.startDate}T00:00:00`).toISOString());
    }
    if (filters.endDate) {
      where += ' AND occurred_at <= ?';
      params.push(new Date(`${filters.endDate}T23:59:59`).toISOString());
    }
    const keyword = filters.keyword?.trim();
    if (keyword) {
      const ftsIds = await this.searchRecordIdsByFts(keyword, studentId);
      if (ftsIds) {
        if (!ftsIds.length) return [];
        where += ` AND id IN (${ftsIds.map(() => '?').join(',')})`;
        params.push(...ftsIds);
      } else {
        where += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
        const like = `%${keyword}%`;
        params.push(like, like, like);
      }
    }
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);
    const records = (await this.all(
      `SELECT * FROM learning_records ${where} ORDER BY occurred_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )).map((row) => this.mapRecord(row));
    return this.withAttachments(records);
  }

  async createRecord(input: LearningRecordInput): Promise<LearningRecord[]> {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const id = `record_${randomUUID()}`;
    const timestamp = now();
    await this.run(
      `INSERT INTO learning_records (
        id, student_id, record_type, subject, title, content, summary, tags, occurred_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
      [
        id,
        input.studentId,
        input.recordType,
        input.subject ?? '',
        title,
        input.content ?? '',
        JSON.stringify(input.tags ?? []),
        input.occurredAt || timestamp,
        timestamp,
        timestamp,
      ],
    );
    await this.touchStudent(input.studentId);
    await this.upsertRecordFts(id);
    mkdirSync(this.resolveInsideDataRoot('students', input.studentId, 'records', id, 'attachments'), { recursive: true });
    return this.listRecords(input.studentId);
  }

  async updateRecord(recordId: string, input: LearningRecordUpdateInput): Promise<LearningRecord[]> {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const record = (await this.all(`SELECT student_id FROM learning_records WHERE id = ?`, [recordId]))[0];
    if (!record) throw new Error('学习记录不存在');
    const studentId = String(record.student_id);
    await this.run(
      `UPDATE learning_records
          SET record_type = ?, subject = ?, title = ?, content = ?, tags = ?, occurred_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.recordType,
        input.subject ?? '',
        title,
        input.content ?? '',
        JSON.stringify(input.tags ?? []),
        input.occurredAt || now(),
        now(),
        recordId,
      ],
    );
    await this.touchStudent(studentId);
    await this.upsertRecordFts(recordId);
    return this.listRecords(studentId);
  }

  async importAttachments(studentId: string, recordId: string, sourcePaths: string[]): Promise<AttachmentImportResult> {
    const attachmentRoot = this.resolveInsideDataRoot('students', studentId, 'records', recordId, 'attachments');
    mkdirSync(attachmentRoot, { recursive: true });
    const items: AttachmentImportItem[] = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error('不是可导入的文件');
        const id = `attachment_${randomUUID()}`;
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(attachmentRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        await this.run(
          `INSERT INTO attachments (
            id, student_id, record_id, file_name, file_path, file_type, file_size, content_hash, extracted_text, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
          [id, studentId, recordId, originalName, targetPath, fileType(originalName), stat.size, hash, now()],
        );
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : '附件复制失败',
        });
      }
    }
    await this.touchStudent(studentId);
    const failed = items.filter((item) => !item.ok).length;
    const status = failed === 0 ? 'succeeded' : failed === items.length ? 'failed' : 'partial';
    return { status, records: await this.listRecords(studentId), items };
  }

  async getKnowledgeOverview(): Promise<KnowledgeOverview> {
    const resources = (await this.all(
      `SELECT r.*,
              COUNT(c.id) AS chunk_count
         FROM teacher_resources r
         LEFT JOIN resource_chunks c ON c.resource_id = r.id
        GROUP BY r.id
        ORDER BY r.updated_at DESC
        LIMIT 100`,
    )).map(this.mapTeacherResource);
    const chunks = (await this.all(
      `SELECT c.*, r.title AS resource_title
         FROM resource_chunks c
         JOIN teacher_resources r ON r.id = c.resource_id
        ORDER BY c.created_at DESC, c.chunk_index ASC
        LIMIT 24`,
    )).map(this.mapResourceChunk);
    const nodes = (await this.all(
      `SELECT * FROM knowledge_nodes ORDER BY updated_at DESC LIMIT 80`,
    )).map(this.mapKnowledgeNode);
    const edges = (await this.all(
      `SELECT * FROM knowledge_edges ORDER BY created_at DESC LIMIT 120`,
    )).map(this.mapKnowledgeEdge);
    const [resourceCount, parsedResources, chunkCount, nodeCount, edgeCount, queuedTasks] = await Promise.all([
      this.scalarCount('teacher_resources'),
      this.scalarCount('teacher_resources', `parse_status = 'parsed'`),
      this.scalarCount('resource_chunks'),
      this.scalarCount('knowledge_nodes'),
      this.scalarCount('knowledge_edges'),
      this.scalarCount('ai_tasks', `task_type IN ('resource_parse', 'ocr_extract', 'embedding_build') AND status IN ('pending', 'running', 'retrying')`),
    ]);
    return {
      resources,
      chunks,
      nodes,
      edges,
      counts: {
        resources: resourceCount,
        parsedResources,
        chunks: chunkCount,
        nodes: nodeCount,
        edges: edgeCount,
        queuedTasks,
      },
    };
  }

  async importKnowledgeResources(sourcePaths: string[]): Promise<KnowledgeImportResult> {
    const resourceRoot = this.resolveInsideDataRoot('teacher_resources');
    mkdirSync(resourceRoot, { recursive: true });
    const items: AttachmentImportItem[] = [];
    const resources: KnowledgeImportResult['resources'] = [];
    for (const sourcePath of sourcePaths) {
      const originalName = basename(sourcePath);
      try {
        const stat = statSync(sourcePath);
        if (!stat.isFile()) throw new Error('不是可导入的文件');
        const id = `resource_${randomUUID()}`;
        const timestamp = now();
        const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
        const targetPath = resolveInsideRoot(resourceRoot, targetName);
        copyFileSync(sourcePath, targetPath);
        const hash = await hashFileSha256(targetPath);
        const resourceType = fileType(originalName);
        const isText = canParseAsLocalText(originalName);
        const title = titleFromFileName(originalName);
        const parseStatus = isText ? 'parsed' : 'needs_parser';
        const parseEngine = isText ? 'local-text' : 'Docling/MinerU 待接入';
        await this.run(
          `INSERT INTO teacher_resources (
            id, title, resource_type, original_file_name, local_path, file_size,
            content_hash, parse_status, parse_engine, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, title, resourceType, originalName, targetPath, stat.size, hash, parseStatus, parseEngine, timestamp, timestamp],
        );
        await this.ensureTeacherLibraryNode();
        await this.createResourceGraph(id, title, resourceType, stat.size, timestamp);
        if (isText) {
          const text = readFileSync(targetPath, 'utf8');
          await this.createResourceChunksAndGraph(id, title, text, timestamp);
        } else {
          await this.enqueueResourceParseTask(id, title, resourceType, timestamp);
        }
        const saved = (await this.all(
          `SELECT r.*, COUNT(c.id) AS chunk_count
             FROM teacher_resources r
             LEFT JOIN resource_chunks c ON c.resource_id = r.id
            WHERE r.id = ?
            GROUP BY r.id`,
          [id],
        ))[0];
        resources.push(this.mapTeacherResource(saved));
        items.push({ sourcePath, fileName: originalName, ok: true, fileSize: stat.size });
      } catch (error) {
        items.push({
          sourcePath,
          fileName: originalName,
          ok: false,
          fileSize: 0,
          errorMessage: error instanceof Error ? error.message : '知识资源导入失败',
        });
      }
    }
    const failed = items.filter((item) => !item.ok).length;
    const status = items.length === 0 ? 'canceled' : failed === 0 ? 'succeeded' : failed === items.length ? 'failed' : 'partial';
    return { status, resources, items, overview: await this.getKnowledgeOverview() };
  }

  async searchKnowledge(keyword: string, limit = 8): Promise<ResourceChunk[]> {
    const trimmed = keyword.trim();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
    if (!trimmed) {
      return (await this.all(
        `SELECT c.*, r.title AS resource_title
           FROM resource_chunks c
           JOIN teacher_resources r ON r.id = c.resource_id
          ORDER BY c.created_at DESC, c.chunk_index ASC
          LIMIT ?`,
        [boundedLimit],
      )).map(this.mapResourceChunk);
    }
    const like = `%${trimmed}%`;
    return (await this.all(
      `SELECT c.*, r.title AS resource_title
         FROM resource_chunks c
         JOIN teacher_resources r ON r.id = c.resource_id
        WHERE c.heading LIKE ? OR c.content_md LIKE ? OR r.title LIKE ?
        ORDER BY c.created_at DESC, c.chunk_index ASC
        LIMIT ?`,
      [like, like, like, boundedLimit],
    )).map(this.mapResourceChunk);
  }

  async recordAiConsoleRun(input: { prompt: string; studentId?: string; timeRange?: string; knowledgeScope?: string }, result: AiConsoleRunResult) {
    const timestamp = now();
    const taskId = `task_${randomUUID()}`;
    const inputHash = createHash('sha256').update(input.prompt.trim()).digest('hex');
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'ai_console', ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        taskId,
        result.ok ? 'succeeded' : 'failed',
        inputHash,
        JSON.stringify({
          studentId: input.studentId ?? '',
          timeRange: input.timeRange ?? '',
          knowledgeScope: input.knowledgeScope ?? '',
          model: result.model,
          sourceCount: result.sources.length,
          knowledgeSnippetCount: result.knowledgeSnippets?.length ?? 0,
          graphNodeCount: result.graphNodes?.length ?? 0,
        }),
        JSON.stringify({
          ok: result.ok,
          usage: result.usage ?? null,
          contentPreview: result.content.slice(0, 160),
        }),
        result.errorMessage ?? '',
        timestamp,
        timestamp,
      ],
    );
    for (const tool of result.toolRuns) {
      await this.run(
        `INSERT INTO ai_tool_runs (id, task_id, tool_name, input_json, output_summary, evidence_refs_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `toolrun_${randomUUID()}`,
          taskId,
          tool.name,
          JSON.stringify({ label: tool.label }),
          tool.detail,
          JSON.stringify({
            sources: result.sources.map((source) => source.title).slice(0, 8),
            knowledgeChunkIds: (result.knowledgeSnippets ?? []).map((chunk) => chunk.id).slice(0, 8),
            graphNodeIds: (result.graphNodes ?? []).map((node) => node.id).slice(0, 8),
          }),
          tool.status,
          timestamp,
        ],
      );
    }
  }

  async startAiAgentRun(input: {
    sessionId?: string;
    prompt: string;
    route: string;
    subIntent?: string;
    model?: string;
    studentId?: string;
  }) {
    const timestamp = now();
    const runId = `run_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_agent_runs (id, session_id, prompt, route, sub_intent, status, model, student_id, error_message, created_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?, '', ?, NULL, ?)`,
      [
        runId,
        input.sessionId ?? '',
        input.prompt,
        input.route,
        input.subIntent ?? '',
        input.model ?? '',
        input.studentId ?? '',
        timestamp,
        timestamp,
      ],
    );
    return runId;
  }

  async recordAiAgentEvent(runId: string, event: AiAgentTraceStep) {
    const timestamp = now();
    const sequenceRow = (await this.all(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM ai_agent_events WHERE run_id = ?`,
      [runId],
    ))[0];
    const sequence = Number(sequenceRow?.next_sequence ?? 1);
    await this.run(
      `INSERT INTO ai_agent_events (id, run_id, sequence, phase, status, label, detail, tool_name, input_summary_json, output_summary_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `event_${randomUUID()}`,
        runId,
        sequence,
        event.phase,
        event.status,
        event.label,
        event.detail,
        event.toolName ?? '',
        JSON.stringify(event.inputSummary ?? {}),
        JSON.stringify(event.outputSummary ?? {}),
        timestamp,
      ],
    );
  }

  async completeAiAgentRun(runId: string, status: AiAgentRunStatus, errorMessage = '') {
    const timestamp = now();
    await this.run(
      `UPDATE ai_agent_runs
       SET status = ?, error_message = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, errorMessage, timestamp, timestamp, runId],
    );
  }

  async getAiAgentRun(runId: string): Promise<AiAgentRun | null> {
    const row = (await this.all(`SELECT * FROM ai_agent_runs WHERE id = ?`, [runId]))[0];
    if (!row) return null;
    return this.mapAiAgentRun(row);
  }

  async listAiAgentEvents(runId: string): Promise<AiAgentEvent[]> {
    const rows = await this.all(
      `SELECT * FROM ai_agent_events WHERE run_id = ? ORDER BY sequence ASC`,
      [runId],
    );
    return rows.map((row) => this.mapAiAgentEvent(row));
  }

  async generateReview(input: ReviewDraftInput): Promise<ReviewReport> {
    const records = (await this.listRecords(input.studentId, { limit: MAX_RECORD_PAGE_SIZE })).filter((record) => {
      const day = formatDate(record.occurredAt);
      const subjectMatch = !input.subject || input.subject === '全部' || record.subject === input.subject;
      return subjectMatch && day >= input.startDate && day <= input.endDate;
    });
    const student = (await this.listStudents('')).find((item) => item.id === input.studentId);
    if (!student) throw new Error('学生不存在');

    const typeCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const record of records) {
      typeCounts.set(record.recordType, (typeCounts.get(record.recordType) ?? 0) + 1);
      for (const tag of record.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recentEvidence = records.slice(0, 5);
    const title = `${student.displayName}${input.subject ? ` ${input.subject}` : ''}阶段复盘`;
    const parentSummary = records.length
      ? `本阶段围绕${input.subject || '主要科目'}共记录 ${records.length} 条学习证据，后续建议继续关注${topTags[0]?.[0] ?? '核心薄弱点'}，并用每周记录观察改善情况。`
      : '当前时间范围内学习记录不足，建议先补充课堂、作业或沟通证据后再形成家长沟通摘要。';
    const contentMd = [
      `# ${title}`,
      '',
      `复盘范围：${input.startDate} 至 ${input.endDate}`,
      '',
      '## 一、整体表现',
      records.length
        ? `本阶段共沉淀 ${records.length} 条学习记录。主要记录类型为：${[...typeCounts.entries()].map(([type, count]) => `${type} ${count} 条`).join('，')}。`
        : '当前时间范围内还没有学习记录，建议先补充课堂、作业或沟通证据。',
      '',
      '## 二、主要进步',
      '- 请老师结合最近记录补充学生已经改善的具体表现。',
      '- 可优先引用课堂表现、作业订正质量和沟通反馈。',
      '',
      '## 三、高频薄弱点',
      ...(topTags.length ? topTags.map(([tag, count]) => `- ${tag}：在 ${count} 条证据中出现。`) : ['- 暂无高频标签，请在学习记录中补充标签。']),
      '',
      '## 四、典型证据',
      ...(recentEvidence.length
        ? recentEvidence.map((record) => `- ${formatDate(record.occurredAt)}｜${record.subject || '全部'}｜${record.title}：${record.content || '无正文'}`)
        : ['- 暂无可引用证据。']),
      '',
      '## 五、学习习惯观察',
      student.currentIssues || '请老师根据长期观察补充学习习惯、订正习惯和注意力状态。',
      '',
      '## 六、下阶段建议',
      '1. 选择 1-2 个最高频问题做短周期专项训练。',
      '2. 每次记录保留错因一句话，便于下次复盘追踪。',
      '3. 一周后回看时间线，确认问题是否减少而不是只看单次表现。',
      '',
      '## 七、家长沟通版摘要',
      parentSummary,
    ].join('\n');
    const qualityChecks = this.buildReportQualityChecks(records, contentMd, parentSummary);

    const timestamp = now();
    const report: ReviewReport = {
      id: `report_${randomUUID()}`,
      studentId: input.studentId,
      subject: input.subject ?? '',
      startDate: input.startDate,
      endDate: input.endDate,
      reportType: input.reportType,
      title,
      contentMd,
      parentSummary,
      qualityChecks,
      sourceRecordIds: records.map((record) => record.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.run(
      `INSERT INTO review_reports (
        id, student_id, subject, start_date, end_date, report_type, title, content_md,
        parent_summary, quality_checks_json, source_record_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id,
        report.studentId,
        report.subject,
        report.startDate,
        report.endDate,
        report.reportType,
        report.title,
        report.contentMd,
        report.parentSummary,
        JSON.stringify(report.qualityChecks),
        JSON.stringify(report.sourceRecordIds),
        report.createdAt,
        report.updatedAt,
      ],
    );
    const reportRoot = this.resolveInsideDataRoot('students', input.studentId, 'reports');
    mkdirSync(reportRoot, { recursive: true });
    writeFileSync(resolveInsideRoot(reportRoot, `${report.id}.md`), contentMd, 'utf8');
    await this.touchStudent(input.studentId);
    return report;
  }

  async updateReport(id: string, contentMd: string, parentSummary?: string): Promise<ReviewReport> {
    const existing = (await this.all(`SELECT parent_summary, source_record_ids FROM review_reports WHERE id = ?`, [id]))[0];
    if (!existing) throw new Error('复盘报告不存在');
    const nextParentSummary = parentSummary ?? String(existing.parent_summary ?? '');
    const sourceRecordIds = jsonArray(existing.source_record_ids);
    const qualityChecks = this.buildReportQualityChecks(
      sourceRecordIds.map((recordId) => ({ id: recordId }) as LearningRecord),
      contentMd,
      nextParentSummary,
    );
    await this.run(
      `UPDATE review_reports
          SET content_md = ?, parent_summary = ?, quality_checks_json = ?, updated_at = ?
        WHERE id = ?`,
      [contentMd, nextParentSummary, JSON.stringify(qualityChecks), now(), id],
    );
    const report = (await this.all(`SELECT * FROM review_reports WHERE id = ?`, [id]))[0];
    return this.mapReport(report);
  }

  async listReports(studentId: string): Promise<ReviewReport[]> {
    return (await this.all(`SELECT * FROM review_reports WHERE student_id = ? ORDER BY created_at DESC`, [studentId])).map((row) => this.mapReport(row));
  }

  async search(keyword: string): Promise<SearchResult> {
    const trimmedKeyword = keyword.trim();
    const ftsRecords = trimmedKeyword ? await this.searchRecordsByFts(trimmedKeyword) : null;
    const records = ftsRecords ?? await this.withAttachments((await this.all(
      `SELECT * FROM learning_records
        WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
        ORDER BY occurred_at DESC
        LIMIT 50`,
      [`%${trimmedKeyword}%`, `%${trimmedKeyword}%`, `%${trimmedKeyword}%`],
    )).map((row) => this.mapRecord(row)));
    return {
      students: await this.listStudents(keyword),
      records,
    };
  }

  async listAiConversationWorkspace(): Promise<AiConversationWorkspace> {
    const folders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NULL
        ORDER BY sort_order ASC, created_at ASC`,
    )).map(this.mapAiConversationFolder);
    const sessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC`,
    )).map(this.mapAiConversationSession);
    const archivedFolders = (await this.all(
      `SELECT * FROM ai_conversation_folders
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`,
    )).map(this.mapAiConversationFolder);
    const archivedSessions = (await this.all(
      `SELECT * FROM ai_conversation_sessions
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC`,
    )).map(this.mapAiConversationSession);
    return { folders, sessions, archivedFolders, archivedSessions };
  }

  async createAiConversationFolder(input: AiConversationFolderInput): Promise<AiConversationWorkspace> {
    const name = requireNonEmpty(input.name, '文件夹名称不能为空');
    const timestamp = now();
    const sortRow = (await this.all(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM ai_conversation_folders`))[0];
    await this.run(
      `INSERT INTO ai_conversation_folders (id, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`aifolder_${randomUUID()}`, name, Number(sortRow?.next_order ?? 1), timestamp, timestamp],
    );
    return this.listAiConversationWorkspace();
  }

  async createAiConversationSession(input: AiConversationSessionInput): Promise<AiConversationDetail> {
    const title = (input.title?.trim() || '新对话').slice(0, 80);
    const folderId = input.folderId || null;
    if (folderId) await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    const sessionId = `aisession_${randomUUID()}`;
    await this.run(
      `INSERT INTO ai_conversation_sessions (
        id, folder_id, title, student_id, last_prompt, last_response_preview,
        message_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '', '', 0, ?, ?)`,
      [sessionId, folderId, title, input.studentId ?? '', timestamp, timestamp],
    );
    return this.getAiConversationSession(sessionId);
  }

  async getAiConversationSession(sessionId: string): Promise<AiConversationDetail> {
    const row = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!row) throw new Error('AI 对话不存在');
    const messages = (await this.all(
      `SELECT * FROM ai_conversation_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId],
    )).map(this.mapAiConversationMessage);
    return { session: this.mapAiConversationSession(row), messages };
  }

  async appendAiConversationMessage(sessionId: string, input: AiConversationMessageInput): Promise<AiConversationDetail> {
    const session = (await this.all(`SELECT * FROM ai_conversation_sessions WHERE id = ?`, [sessionId]))[0];
    if (!session) throw new Error('AI 对话不存在');
    const content = input.content.trim();
    if (!content) throw new Error('对话消息不能为空');
    const role = input.role === 'assistant' || input.role === 'system' ? input.role : 'user';
    const timestamp = now();
    await this.run(
      `INSERT INTO ai_conversation_messages (
        id, session_id, role, content, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [`aimsg_${randomUUID()}`, sessionId, role, content, JSON.stringify(input.metadata ?? {}), timestamp],
    );
    const messageCountRow = (await this.all(
      `SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id = ?`,
      [sessionId],
    ))[0];
    const messageCount = Number(messageCountRow?.count ?? 0);
    const nextTitle = String(session.title ?? '') === '新对话' && role === 'user'
      ? content.slice(0, 40)
      : String(session.title ?? '新对话');
    const lastPrompt = role === 'user' ? content.slice(0, 240) : String(session.last_prompt ?? '');
    const lastResponsePreview = role === 'assistant' ? content.slice(0, 240) : String(session.last_response_preview ?? '');
    await this.run(
      `UPDATE ai_conversation_sessions
          SET title = ?, last_prompt = ?, last_response_preview = ?, message_count = ?, updated_at = ?
        WHERE id = ?`,
      [nextTitle, lastPrompt, lastResponsePreview, messageCount, timestamp, sessionId],
    );
    return this.getAiConversationSession(sessionId);
  }

  async moveAiConversationSession(sessionId: string, folderId: string | null): Promise<AiConversationWorkspace> {
    if (folderId) await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_sessions SET folder_id = ?, updated_at = ? WHERE id = ?`,
      [folderId || null, now(), sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async renameAiConversationFolder(folderId: string, input: AiConversationFolderUpdateInput): Promise<AiConversationWorkspace> {
    const name = requireNonEmpty(input.name, '文件夹名称不能为空').slice(0, 80);
    await this.ensureAiConversationFolder(folderId);
    await this.run(
      `UPDATE ai_conversation_folders SET name = ?, updated_at = ? WHERE id = ?`,
      [name, now(), folderId],
    );
    return this.listAiConversationWorkspace();
  }

  async renameAiConversationSession(sessionId: string, input: AiConversationSessionUpdateInput): Promise<AiConversationWorkspace> {
    const title = requireNonEmpty(input.title, '对话名称不能为空').slice(0, 80);
    await this.run(
      `UPDATE ai_conversation_sessions SET title = ?, updated_at = ? WHERE id = ?`,
      [title, now(), sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async archiveAiConversationFolder(folderId: string): Promise<AiConversationWorkspace> {
    await this.ensureAiConversationFolder(folderId);
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_folders SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, folderId],
    );
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE folder_id = ? AND archived_at IS NULL`,
      [timestamp, timestamp, folderId],
    );
    return this.listAiConversationWorkspace();
  }

  async archiveAiConversationSession(sessionId: string): Promise<AiConversationWorkspace> {
    const timestamp = now();
    await this.run(
      `UPDATE ai_conversation_sessions SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, sessionId],
    );
    return this.listAiConversationWorkspace();
  }

  async exportStudentArchive(studentId: string, destinationRoot: string): Promise<ExportStudentResult> {
    const student = (await this.listStudents('')).find((item) => item.id === studentId);
    if (!student) throw new Error('学生不存在');
    const safeName = student.displayName.replace(/[\\/:*?"<>|]/g, '_') || student.id;
    const exportPath = join(destinationRoot, `${safeName}-${student.id}`);
    mkdirSync(exportPath, { recursive: true });

    const metadata = {
      exportedAt: now(),
      student,
      records: await this.listRecords(studentId, { limit: MAX_RECORD_PAGE_SIZE }),
      reports: await this.listReports(studentId),
    };
    writeFileSync(join(exportPath, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    let fileCount = 1;
    const sourceStudentRoot = this.studentRoot(studentId);
    if (existsSync(sourceStudentRoot)) {
      fileCount += this.copyDirectory(sourceStudentRoot, join(exportPath, 'files'));
    }
    return { exportPath, fileCount };
  }

  async exportDataRoot(destinationRoot: string): Promise<ExportDataRootResult> {
    const exportPath = join(destinationRoot, `OmniEduData-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const fileCount = this.copyDirectory(this.dataRoot, exportPath);
    return { exportPath, fileCount };
  }

  private openDatabase(filePath: string) {
    return new Promise<sqlite3.Database>((resolveOpen, reject) => {
      const db = new sqlite3.Database(filePath, (error) => {
        if (error) reject(error);
        else resolveOpen(db);
      });
    });
  }

  private async migrate() {
    await this.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        real_name TEXT,
        grade TEXT,
        school TEXT,
        subjects TEXT NOT NULL DEFAULT '[]',
        goals TEXT,
        current_issues TEXT,
        parent_concerns TEXT,
        teacher_notes TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS learning_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        subject TEXT,
        title TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        record_id TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        extracted_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (record_id) REFERENCES learning_records(id)
      );
      CREATE TABLE IF NOT EXISTS review_reports (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        subject TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        parent_summary TEXT NOT NULL DEFAULT '',
        quality_checks_json TEXT NOT NULL DEFAULT '[]',
        source_record_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tag_dictionary (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        color TEXT,
        description TEXT,
        scope TEXT NOT NULL DEFAULT 'personal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS report_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        report_type TEXT NOT NULL,
        subject TEXT,
        content_md TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'personal',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        base_version TEXT,
        client_timestamp TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_cursors (
        scope TEXT PRIMARY KEY,
        cursor_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entity_versions (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      CREATE TABLE IF NOT EXISTS ai_tasks (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL,
        input_hash TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_agent_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        route TEXT NOT NULL,
        sub_intent TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        student_id TEXT NOT NULL DEFAULT '',
        error_message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_agent_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        phase TEXT NOT NULL,
        status TEXT NOT NULL,
        label TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        tool_name TEXT NOT NULL DEFAULT '',
        input_summary_json TEXT NOT NULL DEFAULT '{}',
        output_summary_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES ai_agent_runs(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_sessions (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        title TEXT NOT NULL,
        student_id TEXT,
        last_prompt TEXT NOT NULL DEFAULT '',
        last_response_preview TEXT NOT NULL DEFAULT '',
        message_count INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES ai_conversation_folders(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS ai_conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS teacher_resources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        local_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        parse_status TEXT NOT NULL,
        parse_engine TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resource_chunks (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        heading TEXT,
        content_md TEXT NOT NULL,
        page_number INTEGER,
        bbox_json TEXT,
        token_count INTEGER NOT NULL DEFAULT 0,
        embedding_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (resource_id) REFERENCES teacher_resources(id)
      );
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        node_type TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        evidence_source_id TEXT NOT NULL,
        evidence_text TEXT NOT NULL DEFAULT '',
        confidence REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id),
        FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id)
      );
      CREATE TABLE IF NOT EXISTS ai_tool_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input_json TEXT NOT NULL DEFAULT '{}',
        output_summary TEXT NOT NULL DEFAULT '',
        evidence_refs_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES ai_tasks(id)
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'teacher',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS teacher_student_assignments (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(teacher_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS analytics_daily (
        day TEXT PRIMARY KEY,
        active_students INTEGER NOT NULL DEFAULT 0,
        record_count INTEGER NOT NULL DEFAULT 0,
        report_count INTEGER NOT NULL DEFAULT 0,
        attachment_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_student_time ON learning_records(student_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_id);
      CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(sync_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_session ON ai_agent_runs(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_agent_events_run ON ai_agent_events(run_id, sequence ASC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_sessions_folder ON ai_conversation_sessions(folder_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_session ON ai_conversation_messages(session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_teacher_resources_status ON teacher_resources(parse_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource ON resource_chunks(resource_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_task ON ai_tool_runs(task_id);
    `);
    await this.ensureFts();
    const reportColumns = await this.all(`PRAGMA table_info(review_reports)`);
    if (!hasColumn(reportColumns, 'parent_summary')) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN parent_summary TEXT NOT NULL DEFAULT ''`);
    }
    if (!hasColumn(reportColumns, 'quality_checks_json')) {
      await this.run(`ALTER TABLE review_reports ADD COLUMN quality_checks_json TEXT NOT NULL DEFAULT '[]'`);
    }
    const aiFolderColumns = await this.all(`PRAGMA table_info(ai_conversation_folders)`);
    if (!hasColumn(aiFolderColumns, 'archived_at')) {
      await this.run(`ALTER TABLE ai_conversation_folders ADD COLUMN archived_at TEXT`);
    }
    const aiSessionColumns = await this.all(`PRAGMA table_info(ai_conversation_sessions)`);
    if (!hasColumn(aiSessionColumns, 'archived_at')) {
      await this.run(`ALTER TABLE ai_conversation_sessions ADD COLUMN archived_at TEXT`);
    }
    await this.seedPlatformDefaults();
    await this.rebuildRecordFtsIfEmpty();
  }

  private async seedIfEmpty() {
    const count = Number((await this.all('SELECT COUNT(*) AS count FROM students'))[0]?.count ?? 0);
    if (count > 0) return;
    await this.createStudent({
      displayName: '小A',
      grade: '初二',
      subjects: ['数学', '英语'],
      goals: '期末数学稳定在 90 分以上',
      currentIssues: '函数图像理解不稳，移项和符号错误反复出现。',
      parentConcerns: '希望看到每月进步反馈。',
      tags: ['函数', '计算细节', '家长高关注'],
    });
    const studentId = (await this.listStudents('小A'))[0].id;
    await this.createRecord({
      studentId,
      recordType: 'mistake',
      subject: '数学',
      title: '一次函数图像与参数关系',
      content: '连续三次把 k 值正负与图像走向对应做错，需要从图像变化重新讲解。',
      tags: ['一次函数', '概念混淆'],
      occurredAt: new Date(Date.now() - 86400000).toISOString(),
    });
    await this.createRecord({
      studentId,
      recordType: 'homework',
      subject: '数学',
      title: '方程应用题订正',
      content: '能列式，但单位转换和未知数说明不稳定。',
      tags: ['审题', '表达规范'],
      occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
  }

  private async seedPlatformDefaults() {
    const timestamp = now();
    if (await this.scalarCount('users') === 0) {
      await this.run(
        `INSERT INTO users (id, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, 'owner', 'active', ?, ?)`,
        [`user_${randomUUID()}`, '默认老师', timestamp, timestamp],
      );
    }
    if (await this.scalarCount('tag_dictionary') === 0) {
      for (const [name, category, color] of [
        ['概念混淆', '错因', '#9a5b08'],
        ['计算粗心', '能力', '#b34035'],
        ['表达不规范', '习惯', '#2457a6'],
        ['家长高关注', '沟通', '#1d5c52'],
      ]) {
        await this.run(
          `INSERT INTO tag_dictionary (id, name, category, color, description, scope, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', 'team-ready', ?, ?)`,
          [`tag_${randomUUID()}`, name, category, color, timestamp, timestamp],
        );
      }
    }
    if (await this.scalarCount('report_templates') === 0) {
      await this.run(
        `INSERT INTO report_templates (id, name, report_type, subject, content_md, scope, is_default, created_at, updated_at)
         VALUES (?, '阶段复盘标准模板', 'monthly', '', ?, 'team-ready', 1, ?, ?)`,
        [
          `template_${randomUUID()}`,
          '# 阶段复盘\n\n## 整体表现\n\n## 主要进步\n\n## 高频薄弱点\n\n## 下阶段建议\n\n## 家长沟通版摘要\n',
          timestamp,
          timestamp,
        ],
      );
    }
  }

  private async ensureTeacherLibraryNode() {
    const timestamp = now();
    await this.run(
      `INSERT OR IGNORE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, created_at, updated_at
      ) VALUES ('node_teacher_library', '知识库', '老师知识库', '老师本地导入的教学资源集合。', 'system', 'teacher_library', 1, ?, ?)`,
      [timestamp, timestamp],
    );
  }

  private async createResourceGraph(resourceId: string, title: string, resourceType: string, fileSize: number, timestamp: string) {
    const nodeId = `node_${resourceId}`;
    await this.run(
      `INSERT OR REPLACE INTO knowledge_nodes (
        id, node_type, name, summary, source_kind, source_id, confidence, created_at, updated_at
      ) VALUES (?, '资源', ?, ?, 'teacher_resource', ?, 1, ?, ?)`,
      [nodeId, title, `${resourceType} 文件，${fileSize} bytes。`, resourceId, timestamp, timestamp],
    );
    await this.run(
      `INSERT OR IGNORE INTO knowledge_edges (
        id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, created_at
      ) VALUES (?, 'node_teacher_library', ?, '包含', ?, ?, 1, ?)`,
      [`edge_library_${resourceId}`, nodeId, resourceId, title, timestamp],
    );
  }

  private async createResourceChunksAndGraph(resourceId: string, resourceTitle: string, content: string, timestamp: string) {
    const chunks = splitIntoChunks(content);
    for (const [index, chunk] of chunks.entries()) {
      const chunkId = `chunk_${randomUUID()}`;
      await this.run(
        `INSERT INTO resource_chunks (
          id, resource_id, chunk_index, heading, content_md, page_number, bbox_json,
          token_count, embedding_status, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, '', ?, 'pending', ?)`,
        [chunkId, resourceId, index, chunk.heading, chunk.content, Math.ceil(chunk.content.length / 2), timestamp],
      );
      if (chunk.heading) {
        const nodeId = `node_${chunkId}`;
        await this.run(
          `INSERT OR REPLACE INTO knowledge_nodes (
            id, node_type, name, summary, source_kind, source_id, confidence, created_at, updated_at
          ) VALUES (?, '章节', ?, ?, 'resource_chunk', ?, 0.92, ?, ?)`,
          [nodeId, chunk.heading, chunk.content.slice(0, 180), chunkId, timestamp, timestamp],
        );
        await this.run(
          `INSERT OR IGNORE INTO knowledge_edges (
            id, source_node_id, target_node_id, relation_type, evidence_source_id, evidence_text, confidence, created_at
          ) VALUES (?, ?, ?, '包含', ?, ?, 0.92, ?)`,
          [`edge_${resourceId}_${chunkId}`, `node_${resourceId}`, nodeId, chunkId, resourceTitle, timestamp],
        );
      }
    }
  }

  private async enqueueResourceParseTask(resourceId: string, title: string, resourceType: string, timestamp: string) {
    await this.run(
      `INSERT INTO ai_tasks (id, task_type, status, input_hash, payload_json, result_json, error_message, retry_count, created_at, updated_at)
       VALUES (?, 'resource_parse', 'pending', ?, ?, NULL, '', 0, ?, ?)`,
      [
        `task_${randomUUID()}`,
        createHash('sha256').update(resourceId).digest('hex'),
        JSON.stringify({
          resourceId,
          title,
          resourceType,
          engine: resourceType === 'image' ? 'MinerU/OCR 待接入' : 'Docling 待接入',
        }),
        timestamp,
        timestamp,
      ],
    );
  }

  private async listAttachments(recordId: string): Promise<Attachment[]> {
    return (await this.all(`SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC`, [recordId])).map(this.mapAttachment);
  }

  private async listAttachmentsForRecords(recordIds: string[]): Promise<Map<string, Attachment[]>> {
    const grouped = new Map<string, Attachment[]>();
    if (!recordIds.length) return grouped;
    const rows = (await this.all(
      `SELECT * FROM attachments WHERE record_id IN (${recordIds.map(() => '?').join(',')}) ORDER BY created_at DESC`,
      recordIds,
    )).map(this.mapAttachment);
    for (const attachment of rows) {
      if (!attachment.recordId) continue;
      const group = grouped.get(attachment.recordId) ?? [];
      group.push(attachment);
      grouped.set(attachment.recordId, group);
    }
    return grouped;
  }

  private async withAttachments(records: LearningRecord[]): Promise<LearningRecord[]> {
    const attachmentsByRecord = await this.listAttachmentsForRecords(records.map((record) => record.id));
    return records.map((record) => ({ ...record, attachments: attachmentsByRecord.get(record.id) ?? [] }));
  }

  private studentRoot(studentId: string) {
    return this.resolveInsideDataRoot('students', studentId);
  }

  private resolveInsideDataRoot(...parts: string[]) {
    return resolveInsideRoot(this.dataRoot, ...parts);
  }

  private copyDirectory(source: string, target: string): number {
    mkdirSync(target, { recursive: true });
    let copied = 0;
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const sourcePath = join(source, entry.name);
      const targetPath = join(target, entry.name);
      if (entry.isDirectory()) {
        copied += this.copyDirectory(sourcePath, targetPath);
      } else if (entry.isFile()) {
        copyFileSync(sourcePath, targetPath);
        copied += 1;
      }
    }
    return copied;
  }

  private async touchStudent(studentId: string) {
    await this.run(`UPDATE students SET updated_at = ? WHERE id = ?`, [now(), studentId]);
  }

  private async ensureAiConversationFolder(folderId: string) {
    const folder = (await this.all(`SELECT id FROM ai_conversation_folders WHERE id = ?`, [folderId]))[0];
    if (!folder) throw new Error('AI 对话文件夹不存在');
  }

  private run(sql: string, params: SqlValue[] = []) {
    return new Promise<void>((resolveRun, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) reject(error);
        else resolveRun();
      });
    });
  }

  private all(sql: string, params: SqlValue[] = []) {
    return new Promise<Row[]>((resolveAll, reject) => {
      this.db.all(sql, params, (error, rows: Row[]) => {
        if (error) reject(error);
        else resolveAll(rows ?? []);
      });
    });
  }

  private exec(sql: string) {
    return new Promise<void>((resolveExec, reject) => {
      this.db.exec(sql, (error) => {
        if (error) reject(error);
        else resolveExec();
      });
    });
  }

  private async scalarCount(table: string, where?: string): Promise<number> {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const rows = await this.all(`SELECT COUNT(*) AS count FROM ${safeTable}${where ? ` WHERE ${where}` : ''}`);
    return Number(rows[0]?.count ?? 0);
  }

  private mapStudent(row: Row): Student {
    return {
      id: String(row.id),
      displayName: String(row.display_name ?? ''),
      realName: String(row.real_name ?? ''),
      grade: String(row.grade ?? ''),
      school: String(row.school ?? ''),
      subjects: jsonArray(row.subjects),
      goals: String(row.goals ?? ''),
      currentIssues: String(row.current_issues ?? ''),
      parentConcerns: String(row.parent_concerns ?? ''),
      teacherNotes: String(row.teacher_notes ?? ''),
      tags: jsonArray(row.tags),
      status: String(row.status ?? 'active') === 'archived' ? 'archived' : 'active',
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      recordCount: Number(row.record_count ?? 0),
      attachmentBytes: Number(row.attachment_bytes ?? 0),
    };
  }

  private mapRecord(row: Row): LearningRecord {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordType: String(row.record_type ?? ''),
      subject: String(row.subject ?? ''),
      title: String(row.title ?? ''),
      content: String(row.content ?? ''),
      summary: String(row.summary ?? ''),
      tags: jsonArray(row.tags),
      occurredAt: String(row.occurred_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      attachments: [],
    };
  }

  private mapAttachment(row: Row): Attachment {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      recordId: row.record_id ? String(row.record_id) : null,
      fileName: String(row.file_name ?? ''),
      filePath: String(row.file_path ?? ''),
      fileType: String(row.file_type ?? ''),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ''),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapReport(row: Row): ReviewReport {
    return {
      id: String(row.id),
      studentId: String(row.student_id),
      subject: String(row.subject ?? ''),
      startDate: String(row.start_date ?? ''),
      endDate: String(row.end_date ?? ''),
      reportType: String(row.report_type ?? ''),
      title: String(row.title ?? ''),
      contentMd: String(row.content_md ?? ''),
      parentSummary: String(row.parent_summary ?? ''),
      qualityChecks: this.parseQualityChecks(row.quality_checks_json),
      sourceRecordIds: jsonArray(row.source_record_ids),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiAgentRun(row: Row): AiAgentRun {
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? ''),
      prompt: String(row.prompt ?? ''),
      route: String(row.route ?? 'general_qa') as AiAgentRun['route'],
      subIntent: String(row.sub_intent ?? ''),
      status: String(row.status ?? 'running') as AiAgentRunStatus,
      model: String(row.model ?? ''),
      studentId: String(row.student_id ?? ''),
      errorMessage: String(row.error_message ?? ''),
      createdAt: String(row.created_at ?? ''),
      completedAt: String(row.completed_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiAgentEvent(row: Row): AiAgentEvent {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      sequence: Number(row.sequence ?? 0),
      phase: String(row.phase ?? 'plan') as AiAgentEvent['phase'],
      status: String(row.status ?? 'pending') as AiAgentEvent['status'],
      label: String(row.label ?? ''),
      detail: String(row.detail ?? ''),
      toolName: String(row.tool_name ?? '') || undefined,
      inputSummary: jsonObject(row.input_summary_json),
      outputSummary: jsonObject(row.output_summary_json),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapAiConversationFolder(row: Row): AiConversationFolder {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      sortOrder: Number(row.sort_order ?? 0),
      archivedAt: String(row.archived_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiConversationSession(row: Row): AiConversationSession {
    return {
      id: String(row.id),
      folderId: row.folder_id ? String(row.folder_id) : null,
      title: String(row.title ?? '新对话'),
      studentId: String(row.student_id ?? ''),
      lastPrompt: String(row.last_prompt ?? ''),
      lastResponsePreview: String(row.last_response_preview ?? ''),
      messageCount: Number(row.message_count ?? 0),
      archivedAt: String(row.archived_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapAiConversationMessage(row: Row): AiConversationMessage {
    const role = String(row.role ?? 'user');
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      role: role === 'assistant' || role === 'system' ? role : 'user',
      content: String(row.content ?? ''),
      metadata: jsonObject(row.metadata_json),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapTeacherResource(row: Row) {
    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      resourceType: String(row.resource_type ?? ''),
      originalFileName: String(row.original_file_name ?? ''),
      localPath: String(row.local_path ?? ''),
      fileSize: Number(row.file_size ?? 0),
      contentHash: String(row.content_hash ?? ''),
      parseStatus: String(row.parse_status ?? 'queued') as KnowledgeImportResult['resources'][number]['parseStatus'],
      parseEngine: String(row.parse_engine ?? ''),
      chunkCount: Number(row.chunk_count ?? 0),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapResourceChunk(row: Row): ResourceChunk {
    return {
      id: String(row.id),
      resourceId: String(row.resource_id),
      resourceTitle: String(row.resource_title ?? ''),
      chunkIndex: Number(row.chunk_index ?? 0),
      heading: String(row.heading ?? ''),
      contentMd: String(row.content_md ?? ''),
      pageNumber: row.page_number == null ? null : Number(row.page_number),
      embeddingStatus: String(row.embedding_status ?? 'pending'),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private mapKnowledgeNode(row: Row): KnowledgeNode {
    return {
      id: String(row.id),
      nodeType: String(row.node_type ?? ''),
      name: String(row.name ?? ''),
      summary: String(row.summary ?? ''),
      sourceKind: String(row.source_kind ?? ''),
      sourceId: String(row.source_id ?? ''),
      confidence: Number(row.confidence ?? 0),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private mapKnowledgeEdge(row: Row): KnowledgeEdge {
    return {
      id: String(row.id),
      sourceNodeId: String(row.source_node_id ?? ''),
      targetNodeId: String(row.target_node_id ?? ''),
      relationType: String(row.relation_type ?? ''),
      evidenceSourceId: String(row.evidence_source_id ?? ''),
      evidenceText: String(row.evidence_text ?? ''),
      confidence: Number(row.confidence ?? 0),
      createdAt: String(row.created_at ?? ''),
    };
  }

  private async ensureFts() {
    try {
      await this.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS learning_records_fts USING fts5(
          id UNINDEXED,
          student_id UNINDEXED,
          title,
          content,
          subject,
          tags
        );
      `);
    } catch {
      // Some SQLite builds can omit FTS5. Search falls back to LIKE in that case.
    }
  }

  private async rebuildRecordFts() {
    try {
      await this.run(`DELETE FROM learning_records_fts`);
      const rows = await this.all(`SELECT id FROM learning_records`);
      for (const row of rows) await this.upsertRecordFts(String(row.id));
    } catch {
      // FTS is an optional acceleration layer for MVP search.
    }
  }

  private async rebuildRecordFtsIfEmpty() {
    try {
      const recordCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records`))[0]?.count ?? 0);
      const ftsCount = Number((await this.all(`SELECT COUNT(*) AS count FROM learning_records_fts`))[0]?.count ?? 0);
      if (recordCount > 0 && ftsCount === 0) await this.rebuildRecordFts();
    } catch {
      // FTS remains optional and can be rebuilt by later maintenance tasks.
    }
  }

  private async upsertRecordFts(recordId: string) {
    try {
      const record = (await this.all(`SELECT * FROM learning_records WHERE id = ?`, [recordId]))[0];
      if (!record) return;
      await this.run(`DELETE FROM learning_records_fts WHERE id = ?`, [recordId]);
      await this.run(
        `INSERT INTO learning_records_fts (id, student_id, title, content, subject, tags)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(record.id),
          String(record.student_id),
          String(record.title ?? ''),
          String(record.content ?? ''),
          String(record.subject ?? ''),
          jsonArray(record.tags).join(' '),
        ],
      );
    } catch {
      // Keep record writes successful even if the optional FTS index cannot update.
    }
  }

  private async searchRecordIdsByFts(keyword: string, studentId?: string): Promise<string[] | null> {
    try {
      const query = this.toFtsQuery(keyword);
      const rows = studentId
        ? await this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ? AND student_id = ?
              LIMIT ?`,
            [query, studentId, FTS_MATCH_LIMIT],
          )
        : await this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ?
              LIMIT ?`,
            [query, FTS_MATCH_LIMIT],
          );
      return rows.map((row) => String(row.id));
    } catch {
      return null;
    }
  }

  private async searchRecordsByFts(keyword: string): Promise<LearningRecord[] | null> {
    const ids = await this.searchRecordIdsByFts(keyword);
    if (!ids) return null;
    if (!ids.length) return [];
    const rows = await this.all(
      `SELECT * FROM learning_records
        WHERE id IN (${ids.map(() => '?').join(',')})
        ORDER BY occurred_at DESC
        LIMIT 50`,
      ids,
    );
    return this.withAttachments(rows.map((row) => this.mapRecord(row)));
  }

  private toFtsQuery(keyword: string) {
    return keyword
      .split(/\s+/)
      .map((part) => part.replace(/["*]/g, '').trim())
      .filter(Boolean)
      .map((part) => `"${part}"`)
      .join(' OR ') || '""';
  }

  private buildReportQualityChecks(records: Array<Pick<LearningRecord, 'id'>>, contentMd: string, parentSummary: string): ReviewQualityCheck[] {
    const hasEvidence = records.length > 0;
    return [
      {
        key: 'has_evidence',
        label: '包含真实证据',
        passed: hasEvidence,
        detail: hasEvidence ? `引用 ${records.length} 条学习记录。` : '当前报告没有可追溯学习记录。',
      },
      {
        key: 'has_next_steps',
        label: '包含下阶段建议',
        passed: contentMd.includes('下阶段建议') && /\n1\./.test(contentMd),
        detail: '检查报告是否给出可执行的下一步。',
      },
      {
        key: 'has_parent_summary',
        label: '包含家长沟通版摘要',
        passed: parentSummary.trim().length >= 20,
        detail: parentSummary.trim() ? '家长摘要已单独保存。' : '缺少家长可读摘要。',
      },
      {
        key: 'editable',
        label: '保持教师可编辑',
        passed: true,
        detail: '报告以 Markdown 保存，老师可继续修改。',
      },
    ];
  }

  private parseQualityChecks(value: unknown): ReviewQualityCheck[] {
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        key: String(item.key ?? ''),
        label: String(item.label ?? ''),
        passed: Boolean(item.passed),
        detail: String(item.detail ?? ''),
      }));
    } catch {
      return [];
    }
  }
}

export { toCsvList };

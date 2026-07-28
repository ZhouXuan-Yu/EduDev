import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import type {
  Attachment,
  BootstrapData,
  LearningRecord,
  LearningRecordInput,
  LearningRecordUpdateInput,
  ReviewDraftInput,
  ReviewReport,
  ReviewQualityCheck,
  SearchResult,
  Student,
  StudentInput,
} from '../shared/contracts';

const require = createRequire(import.meta.url);

type Row = Record<string, unknown>;

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

function fileType(fileName: string) {
  const ext = extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'docx';
  if (['.txt', '.md'].includes(ext)) return 'txt';
  return 'other';
}

function formatDate(date: string) {
  return date.slice(0, 10);
}

function requireNonEmpty(value: string | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function hasColumn(rows: Row[], columnName: string) {
  return rows.some((row) => String(row.name) === columnName);
}

export class OmniEduStore {
  private sql!: SqlJsStatic;
  private db!: Database;
  private dbPath: string;

  constructor(private dataRoot: string) {
    this.dbPath = join(dataRoot, 'app.db');
  }

  async init(): Promise<BootstrapData> {
    mkdirSync(this.dataRoot, { recursive: true });
    mkdirSync(join(this.dataRoot, 'students'), { recursive: true });
    mkdirSync(join(this.dataRoot, 'cache', 'thumbnails'), { recursive: true });

    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    this.sql = await initSqlJs({ locateFile: () => wasmPath });
    this.db = existsSync(this.dbPath) ? new this.sql.Database(readFileSync(this.dbPath)) : new this.sql.Database();
    this.migrate();
    this.seedIfEmpty();
    this.save();
    return { dataRoot: this.dataRoot, students: this.listStudents('') };
  }

  getDataRoot() {
    return this.dataRoot;
  }

  listStudents(query = ''): Student[] {
    const like = `%${query.trim()}%`;
    const rows = this.all(
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

  createStudent(input: StudentInput): Student[] {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    const id = `student_${randomUUID()}`;
    const timestamp = now();
    this.run(
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
    this.save();
    return this.listStudents('');
  }

  updateStudent(id: string, input: StudentInput): Student[] {
    const displayName = requireNonEmpty(input.displayName, '学生显示名不能为空');
    this.run(
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
    this.save();
    return this.listStudents('');
  }

  archiveStudent(id: string): Student[] {
    this.run(`UPDATE students SET status = 'archived', updated_at = ? WHERE id = ?`, [now(), id]);
    this.save();
    return this.listStudents('');
  }

  listRecords(studentId: string, filters: { type?: string; keyword?: string } = {}): LearningRecord[] {
    const params: SqlValue[] = [studentId];
    let where = 'WHERE student_id = ?';
    if (filters.type) {
      where += ' AND record_type = ?';
      params.push(filters.type);
    }
    const keyword = filters.keyword?.trim();
    if (keyword) {
      const ftsIds = this.searchRecordIdsByFts(keyword, studentId);
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
    const records = this.all(
      `SELECT * FROM learning_records ${where} ORDER BY occurred_at DESC, created_at DESC`,
      params,
    ).map((row) => this.mapRecord(row));
    return records.map((record) => ({ ...record, attachments: this.listAttachments(record.id) }));
  }

  createRecord(input: LearningRecordInput): LearningRecord[] {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const id = `record_${randomUUID()}`;
    const timestamp = now();
    this.run(
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
    this.touchStudent(input.studentId);
    this.upsertRecordFts(id);
    mkdirSync(join(this.studentRoot(input.studentId), 'records', id, 'attachments'), { recursive: true });
    this.save();
    return this.listRecords(input.studentId);
  }

  updateRecord(recordId: string, input: LearningRecordUpdateInput): LearningRecord[] {
    const title = requireNonEmpty(input.title, '学习记录标题不能为空');
    const record = this.all(`SELECT student_id FROM learning_records WHERE id = ?`, [recordId])[0];
    if (!record) throw new Error('学习记录不存在');
    const studentId = String(record.student_id);
    this.run(
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
    this.touchStudent(studentId);
    this.upsertRecordFts(recordId);
    this.save();
    return this.listRecords(studentId);
  }

  importAttachments(studentId: string, recordId: string, sourcePaths: string[]): LearningRecord[] {
    const attachmentRoot = join(this.studentRoot(studentId), 'records', recordId, 'attachments');
    mkdirSync(attachmentRoot, { recursive: true });
    for (const sourcePath of sourcePaths) {
      const stat = statSync(sourcePath);
      if (!stat.isFile()) continue;
      const originalName = basename(sourcePath);
      const id = `attachment_${randomUUID()}`;
      const targetName = `${Date.now()}-${id.slice(-8)}-${originalName}`;
      const targetPath = join(attachmentRoot, targetName);
      copyFileSync(sourcePath, targetPath);
      const hash = createHash('sha256').update(readFileSync(targetPath)).digest('hex');
      this.run(
        `INSERT INTO attachments (
          id, student_id, record_id, file_name, file_path, file_type, file_size, content_hash, extracted_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
        [id, studentId, recordId, originalName, targetPath, fileType(originalName), stat.size, hash, now()],
      );
    }
    this.touchStudent(studentId);
    this.save();
    return this.listRecords(studentId);
  }

  generateReview(input: ReviewDraftInput): ReviewReport {
    const records = this.listRecords(input.studentId).filter((record) => {
      const day = formatDate(record.occurredAt);
      const subjectMatch = !input.subject || input.subject === '全部' || record.subject === input.subject;
      return subjectMatch && day >= input.startDate && day <= input.endDate;
    });
    const student = this.listStudents('').find((item) => item.id === input.studentId);
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
    this.run(
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
    mkdirSync(join(this.studentRoot(input.studentId), 'reports'), { recursive: true });
    writeFileSync(join(this.studentRoot(input.studentId), 'reports', `${report.id}.md`), contentMd, 'utf8');
    this.touchStudent(input.studentId);
    this.save();
    return report;
  }

  updateReport(id: string, contentMd: string, parentSummary?: string): ReviewReport {
    const existing = this.all(`SELECT parent_summary, source_record_ids FROM review_reports WHERE id = ?`, [id])[0];
    if (!existing) throw new Error('复盘报告不存在');
    const nextParentSummary = parentSummary ?? String(existing.parent_summary ?? '');
    const sourceRecordIds = jsonArray(existing.source_record_ids);
    const qualityChecks = this.buildReportQualityChecks(
      sourceRecordIds.map((recordId) => ({ id: recordId }) as LearningRecord),
      contentMd,
      nextParentSummary,
    );
    this.run(
      `UPDATE review_reports
          SET content_md = ?, parent_summary = ?, quality_checks_json = ?, updated_at = ?
        WHERE id = ?`,
      [contentMd, nextParentSummary, JSON.stringify(qualityChecks), now(), id],
    );
    this.save();
    const report = this.all(`SELECT * FROM review_reports WHERE id = ?`, [id])[0];
    return this.mapReport(report);
  }

  listReports(studentId: string): ReviewReport[] {
    return this.all(`SELECT * FROM review_reports WHERE student_id = ? ORDER BY created_at DESC`, [studentId]).map(this.mapReport);
  }

  search(keyword: string): SearchResult {
    const trimmedKeyword = keyword.trim();
    const ftsRecords = trimmedKeyword ? this.searchRecordsByFts(trimmedKeyword) : null;
    return {
      students: this.listStudents(keyword),
      records: ftsRecords ?? this.all(
        `SELECT * FROM learning_records
          WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
          ORDER BY occurred_at DESC
          LIMIT 50`,
        [`%${trimmedKeyword}%`, `%${trimmedKeyword}%`, `%${trimmedKeyword}%`],
      ).map((row) => ({ ...this.mapRecord(row), attachments: this.listAttachments(String(row.id)) })),
    };
  }

  private migrate() {
    this.db.run(`
      PRAGMA foreign_keys = ON;
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
      CREATE INDEX IF NOT EXISTS idx_records_student_time ON learning_records(student_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_id);
      CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status, updated_at DESC);
    `);
    this.ensureFts();
    const reportColumns = this.all(`PRAGMA table_info(review_reports)`);
    if (!hasColumn(reportColumns, 'parent_summary')) {
      this.db.run(`ALTER TABLE review_reports ADD COLUMN parent_summary TEXT NOT NULL DEFAULT ''`);
    }
    if (!hasColumn(reportColumns, 'quality_checks_json')) {
      this.db.run(`ALTER TABLE review_reports ADD COLUMN quality_checks_json TEXT NOT NULL DEFAULT '[]'`);
    }
    this.rebuildRecordFts();
  }

  private seedIfEmpty() {
    const count = Number(this.all('SELECT COUNT(*) AS count FROM students')[0]?.count ?? 0);
    if (count > 0) return;
    this.createStudent({
      displayName: '小A',
      grade: '初二',
      subjects: ['数学', '英语'],
      goals: '期末数学稳定在 90 分以上',
      currentIssues: '函数图像理解不稳，移项和符号错误反复出现。',
      parentConcerns: '希望看到每月进步反馈。',
      tags: ['函数', '计算细节', '家长高关注'],
    });
    const studentId = this.listStudents('小A')[0].id;
    this.createRecord({
      studentId,
      recordType: 'mistake',
      subject: '数学',
      title: '一次函数图像与参数关系',
      content: '连续三次把 k 值正负与图像走向对应做错，需要从图像变化重新讲解。',
      tags: ['一次函数', '概念混淆'],
      occurredAt: new Date(Date.now() - 86400000).toISOString(),
    });
    this.createRecord({
      studentId,
      recordType: 'homework',
      subject: '数学',
      title: '方程应用题订正',
      content: '能列式，但单位转换和未知数说明不稳定。',
      tags: ['审题', '表达规范'],
      occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
  }

  private listAttachments(recordId: string): Attachment[] {
    return this.all(`SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC`, [recordId]).map(this.mapAttachment);
  }

  private studentRoot(studentId: string) {
    return join(this.dataRoot, 'students', studentId);
  }

  private touchStudent(studentId: string) {
    this.run(`UPDATE students SET updated_at = ? WHERE id = ?`, [now(), studentId]);
  }

  private save() {
    writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }

  private run(sql: string, params: SqlValue[] = []) {
    this.db.run(sql, params);
  }

  private all(sql: string, params: SqlValue[] = []): Row[] {
    const result = this.db.exec(sql, params);
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map((value) => Object.fromEntries(columns.map((column, index) => [column, value[index]])));
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

  private ensureFts() {
    try {
      this.db.run(`
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

  private rebuildRecordFts() {
    try {
      this.db.run(`DELETE FROM learning_records_fts`);
      const rows = this.all(`SELECT id FROM learning_records`);
      for (const row of rows) this.upsertRecordFts(String(row.id));
    } catch {
      // FTS is an optional acceleration layer for MVP search.
    }
  }

  private upsertRecordFts(recordId: string) {
    try {
      const record = this.all(`SELECT * FROM learning_records WHERE id = ?`, [recordId])[0];
      if (!record) return;
      this.db.run(`DELETE FROM learning_records_fts WHERE id = ?`, [recordId]);
      this.db.run(
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

  private searchRecordIdsByFts(keyword: string, studentId?: string): string[] | null {
    try {
      const query = this.toFtsQuery(keyword);
      const rows = studentId
        ? this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ? AND student_id = ?
              LIMIT 200`,
            [query, studentId],
          )
        : this.all(
            `SELECT id FROM learning_records_fts
              WHERE learning_records_fts MATCH ?
              LIMIT 200`,
            [query],
          );
      return rows.map((row) => String(row.id));
    } catch {
      return null;
    }
  }

  private searchRecordsByFts(keyword: string): LearningRecord[] | null {
    const ids = this.searchRecordIdsByFts(keyword);
    if (!ids) return null;
    if (!ids.length) return [];
    const rows = this.all(
      `SELECT * FROM learning_records
        WHERE id IN (${ids.map(() => '?').join(',')})
        ORDER BY occurred_at DESC
        LIMIT 50`,
      ids,
    );
    return rows.map((row) => ({ ...this.mapRecord(row), attachments: this.listAttachments(String(row.id)) }));
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

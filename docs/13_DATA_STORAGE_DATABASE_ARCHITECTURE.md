# 数据库与存储架构设计

版本：v0.1  
日期：2026-07-28  
目标：指导本地 SQLite、云端 PostgreSQL、Redis、对象存储和向量数据的长期设计

## 1. 数据分层

Omni-Edu Agent 的数据必须按价值和体积分层：

| 数据类型 | 示例 | MVP 存储 | 商业化存储 |
|---|---|---|---|
| 核心结构化数据 | 学生、记录、报告、标签 | SQLite | PostgreSQL |
| 大附件 | 图片、PDF、Word、视频 | 本地文件目录 | 对象存储 OSS/S3/MinIO |
| 可重建索引 | FTS、向量索引、缩略图 | 本地 indexes/cache | 独立搜索/向量服务 |
| 临时任务状态 | OCR 进度、同步状态 | 本地任务表 | Redis + PostgreSQL task log |
| 审计数据 | 登录、修改、导出、AI 调用 | MVP 可暂缓 | PostgreSQL 分区表 |

## 2. 本地 SQLite 设计

### 2.1 使用边界

SQLite 适合：

- 单个老师。
- 单机本地数据。
- 中小规模学生档案。
- 离线可用。
- 快速 MVP。

SQLite 不适合：

- 多端同时写同一个数据库文件。
- 大规模团队并发。
- 把大附件直接塞进数据库。
- 复杂跨租户权限。

### 2.2 推荐配置

应用初始化时执行：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

说明：

- WAL 模式提升读写并发体验。
- foreign_keys 保证学生、记录、附件关系一致。
- busy_timeout 降低短暂锁冲突失败。
- synchronous=NORMAL 在桌面应用中兼顾性能和可靠性。

注意：

- WAL 适合较小事务，不应把超大文件写入事务。
- 大批量导入时应分批提交。

### 2.3 MVP 表结构

核心表：

- students
- learning_records
- attachments
- review_reports
- app_settings
- local_tasks

后续同步预留：

- sync_operations
- sync_cursors
- entity_versions

### 2.4 本地 id 规范

所有实体使用稳定字符串 id：

```text
student_<uuid>
record_<uuid>
attachment_<uuid>
report_<uuid>
task_<uuid>
```

要求：

- 不依赖数据库自增 id。
- 为后续云同步、冲突处理、跨设备迁移做准备。

## 3. 云端 PostgreSQL 设计

### 3.1 使用边界

PostgreSQL 作为商业化云端主库，负责：

- 团队协作。
- 多租户。
- 学生档案云端索引。
- 报告与审计。
- 计费与额度。
- AI 任务记录。

### 3.2 多租户模型

推荐第一阶段使用 shared database + shared schema + tenant_id。

所有团队级表必须包含：

- tenant_id
- created_at
- updated_at
- deleted_at nullable

优点：

- 开发和运维复杂度低。
- 适合中小团队规模。
- 后续可按 tenant_id 分区或迁移大客户。

### 3.3 云端核心表

组织与权限：

- tenants
- users
- memberships
- roles

教学数据：

- students
- learning_records
- attachments
- review_reports
- tag_dictionary
- report_templates

AI 与任务：

- ai_tasks
- ai_task_events
- ocr_results
- embedding_jobs

审计与经营：

- audit_logs
- usage_events
- billing_accounts

### 3.4 分区策略

当数据增长到千万级记录时，优先分区：

- learning_records：按 tenant_id hash 或 occurred_at range。
- audit_logs：按 created_at 月度 range。
- usage_events：按 created_at 月度 range。
- ai_task_events：按 created_at 月度 range。

不建议过早分区：

- students。
- tenants。
- users。
- tag_dictionary。

### 3.5 索引策略

students：

```sql
CREATE INDEX idx_students_tenant_status ON students (tenant_id, status);
CREATE INDEX idx_students_tenant_updated ON students (tenant_id, updated_at DESC);
```

learning_records：

```sql
CREATE INDEX idx_records_student_time ON learning_records (student_id, occurred_at DESC);
CREATE INDEX idx_records_tenant_subject ON learning_records (tenant_id, subject);
CREATE INDEX idx_records_tenant_type ON learning_records (tenant_id, record_type);
```

attachments：

```sql
CREATE INDEX idx_attachments_record ON attachments (record_id);
CREATE INDEX idx_attachments_student ON attachments (student_id);
CREATE UNIQUE INDEX idx_attachments_hash_tenant ON attachments (tenant_id, content_hash) WHERE content_hash IS NOT NULL;
```

review_reports：

```sql
CREATE INDEX idx_reports_student_time ON review_reports (student_id, created_at DESC);
```

### 3.6 软删除

商业化版本必须使用软删除：

- deleted_at。
- deleted_by。
- delete_reason。

学生删除策略：

1. 默认归档。
2. 管理员确认后进入回收站。
3. 保留期后物理删除。
4. 附件同步删除或归档，根据机构配置决定。

## 4. 对象存储设计

### 4.1 存储原则

原始附件不进入数据库。

云端 object key：

```text
tenants/{tenant_id}/students/{student_id}/records/{record_id}/attachments/{attachment_id}/{safe_file_name}
```

本地路径：

```text
OmniEduData/students/{student_id}/records/{yyyy}/{mm}/{record_id}/attachments/{file_name}
```

### 4.2 元数据

attachments 表保存：

- original_file_name
- stored_file_name
- local_path
- object_key
- file_size
- mime_type
- content_hash
- upload_status
- created_at

### 4.3 上传策略

MVP：

- 默认只本地保存。

团队版：

- 用户明确开启同步后上传。
- 大文件分片上传。
- 上传状态可恢复。
- 上传失败不影响本地核心流程。

## 5. Redis 数据设计

Redis 不保存长期核心数据。

### 5.1 Key 命名

```text
cache:tenant:{tenant_id}:student:{student_id}
rate:user:{user_id}:api
task:{task_id}:status
lock:tenant:{tenant_id}:sync:{entity_id}
session:{session_id}
```

### 5.2 TTL 原则

| 类型 | TTL |
|---|---|
| API 缓存 | 30 秒 - 10 分钟 |
| 用户会话 | 7-30 天 |
| 限流 key | 1 分钟 - 1 小时 |
| 任务状态 | 1-7 天 |
| 分布式锁 | 5-60 秒 |

禁止：

- 无 TTL 的临时 key。
- 把报告正文只存在 Redis。
- 用 Redis list 长期保存业务事件。

## 6. 搜索与向量数据

### 6.1 MVP 搜索

本地：

- SQLite LIKE。
- 后续 SQLite FTS5。

搜索对象：

- 学生姓名。
- 记录标题。
- 记录正文。
- 标签。
- 报告标题。

### 6.2 云端搜索

第一版：

- PostgreSQL 全文检索。

升级条件：

- 搜索 QPS 高。
- 复杂中文分词需求强。
- 跨附件全文检索需求强。

升级方案：

- Meilisearch：轻量搜索。
- OpenSearch/Elasticsearch：复杂搜索和日志分析。

### 6.3 向量检索

第一版：

- pgvector。

适用：

- 相似错题。
- 相似学习记录。
- 复盘上下文召回。

升级条件：

- 向量数量超过千万级。
- 召回延迟或成本不可接受。

升级方案：

- Milvus。
- Qdrant。
- dedicated vector service。

## 7. 备份与恢复

### 7.1 本地备份

必须支持：

- 导出整个 OmniEduData。
- 导出单个学生档案。
- 备份 app.db。
- 备份学生附件目录。

### 7.2 云端备份

必须支持：

- PostgreSQL PITR。
- 对象存储版本管理。
- 定期快照。
- 租户级导出。

### 7.3 恢复演练

每个商业版本发布前必须验证：

- 本地 app.db 恢复。
- 单学生档案恢复。
- 云端数据库恢复。
- 附件 object key 与数据库元数据一致性。

## 8. 数据红线

- 附件不入库。
- Redis 不做主库。
- AI 日志不保存原始隐私全文。
- 没有 tenant_id 的云端业务表不得上线。
- 没有 deleted_at 的核心业务表不得上线团队版。
- 没有备份恢复验证不得上线商业版。


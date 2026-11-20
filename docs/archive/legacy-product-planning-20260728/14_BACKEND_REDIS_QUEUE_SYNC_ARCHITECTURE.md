# 后端、Redis、队列与同步架构

版本：v0.1  
日期：2026-07-28  
目标：指导从单机 MVP 演进到团队协作和千万级数据流处理

## 1. 后端定位

MVP 阶段不强依赖云端后端。商业化阶段后端承担：

- 账号与团队。
- 学生档案同步。
- 模板与标签统一。
- AI 任务调度。
- 经营看板。
- 计费与额度。
- 审计与风控。

推荐后端技术：

- Node.js + TypeScript。
- 框架优先级：NestJS 或 Fastify。
- ORM：Prisma 或 Drizzle。
- 数据库：PostgreSQL。
- 缓存与队列：Redis。
- AI worker：Python FastAPI。

选择理由：

- 前后端 TypeScript 类型体系一致。
- Electron 客户端、Web 管理端、后端 API 协作成本低。
- AI/OCR 仍交给 Python，不强行用 Node 做模型生态。

## 2. 服务拆分路线

### 2.1 MVP

无云端服务，只有 Electron main：

- SQLite。
- 文件系统。
- 本地任务。

### 2.2 小团队版

单体后端：

```text
api-server
  auth
  tenant
  student
  record
  attachment
  report
  sync
  ai-task
```

### 2.3 商业化版

按压力拆分：

```text
api-gateway
auth-service
teaching-data-service
sync-service
ai-task-service
report-service
billing-service
analytics-service
worker-service
```

拆分原则：

- 不提前微服务化。
- 先模块化单体。
- 当某个模块性能、部署频率、团队边界明显不同，再拆。

## 3. API 设计原则

### 3.1 API 风格

推荐：

- REST API 为主。
- SSE/WebSocket 用于任务进度。
- OpenAPI 自动生成类型。

不建议 MVP 使用 GraphQL：

- 权限和缓存复杂度更高。
- 桌面端同步不需要过度灵活查询。

### 3.2 统一响应

```json
{
  "success": true,
  "data": {},
  "requestId": "req_xxx"
}
```

错误：

```json
{
  "success": false,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "学生不存在",
    "details": {}
  },
  "requestId": "req_xxx"
}
```

### 3.3 幂等性

以下 API 必须支持 idempotency key：

- 创建学生。
- 创建学习记录。
- 上传附件元数据。
- 创建复盘报告。
- 创建 AI 任务。
- 同步批量写入。

Header：

```text
Idempotency-Key: <uuid>
```

## 4. Redis 使用规划

### 4.1 Redis 角色

Redis 用于：

- 缓存热点数据。
- API 限流。
- 分布式锁。
- 任务状态。
- BullMQ 队列。
- WebSocket/SSE 任务进度。

Redis 不用于：

- 学生档案主存储。
- 学习记录主存储。
- 报告正文主存储。
- 附件元数据唯一存储。

### 4.2 缓存策略

采用 cache-aside：

```text
读请求 -> 查 Redis
命中 -> 返回
未命中 -> 查 PostgreSQL -> 写 Redis -> 返回
```

适合缓存：

- 租户配置。
- 标签字典。
- 报告模板。
- 用户权限。
- 看板短期聚合。

不建议缓存：

- 刚写入的学习记录详情。
- 大段报告正文。
- 权限变更后的长期缓存。

### 4.3 缓存失效

写入后主动删除相关 key：

```text
cache:tenant:{tenant_id}:tag_dictionary
cache:tenant:{tenant_id}:report_templates
cache:user:{user_id}:permissions
```

不要依赖长 TTL 自然过期来保证一致性。

### 4.4 限流

限流维度：

- IP。
- user_id。
- tenant_id。
- AI task type。

AI 接口限流更严格：

```text
rate:tenant:{tenant_id}:ai:report
rate:user:{user_id}:ai:ocr
```

### 4.5 分布式锁

适用：

- 同一学生同步合并。
- 同一附件重复上传。
- 同一报告生成任务防重复。

要求：

- 必须设置 TTL。
- 锁超时必须可恢复。
- 不用锁代替数据库唯一约束。

## 5. 队列架构

### 5.1 MVP 本地任务

本地任务表：

- local_tasks

字段：

- id
- task_type
- status
- payload_json
- result_json
- error_message
- retry_count
- created_at
- updated_at

### 5.2 团队版队列

推荐第一版：

- BullMQ + Redis。

队列：

- ai-report-queue
- ocr-queue
- attachment-upload-queue
- sync-queue
- email-notification-queue

### 5.3 商业化升级

升级条件：

- 队列吞吐成为瓶颈。
- 事件需要多消费者。
- 需要长期事件流。

升级方案：

- RabbitMQ：任务分发和可靠消费。
- Kafka/Pulsar：大规模事件流和分析。

### 5.4 任务状态机

```text
pending -> running -> succeeded
pending -> running -> failed -> retrying -> running
failed -> dead_letter
```

每个任务必须记录：

- task_id。
- tenant_id。
- creator_id。
- input_hash。
- status。
- retry_count。
- error_code。
- started_at。
- finished_at。

## 6. 客户端同步架构

### 6.1 同步原则

同步不是 MVP 必需，但 MVP 数据模型必须为同步准备。

原则：

- 本地先写。
- 云端后同步。
- 附件单独同步。
- 冲突显式处理。
- 同步失败不影响本地使用。

### 6.2 Operation Log

本地记录：

- sync_operations

字段：

- id
- entity_type
- entity_id
- operation_type
- payload_json
- base_version
- client_timestamp
- sync_status
- retry_count

操作类型：

- create
- update
- archive
- delete
- attach_file

### 6.3 冲突策略

默认策略：

- 学生基础信息：字段级合并，冲突提示用户。
- 学习记录：追加型数据，尽量不冲突。
- 附件：以 hash 去重。
- 报告：版本化，不自动覆盖。

报告冲突：

```text
report_v1_local
report_v1_remote
-> 生成冲突副本
-> 老师手动选择或合并
```

### 6.4 同步接口

上传：

```http
POST /sync/push
```

下载：

```http
GET /sync/pull?cursor=xxx
```

附件：

```http
POST /attachments/presign-upload
POST /attachments/complete-upload
```

## 7. 看板数据流

不要在用户打开看板时扫描所有原始记录。

推荐：

- learning_records 写入后产生 usage_event。
- usage_event 异步聚合到 analytics_daily。
- 看板读取聚合表。

聚合表：

- analytics_daily_tenant
- analytics_daily_teacher
- analytics_daily_student

指标：

- 新增记录数。
- 复盘报告数。
- 附件上传数。
- 待续费学生数。
- 老师跟进完成率。

## 8. 开发红线

- 后端 API 必须带 requestId。
- 写操作必须有权限校验。
- 同步接口必须幂等。
- AI 任务必须异步。
- Redis key 必须有命名规范和 TTL。
- 队列任务必须可重试和进入 dead letter。
- 看板不能直接扫大表。


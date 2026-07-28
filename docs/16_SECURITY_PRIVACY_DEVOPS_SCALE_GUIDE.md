# 安全、隐私、DevOps 与规模化落地指南

版本：v0.1  
日期：2026-07-28  
目标：指导商业项目在安全、隐私、部署、监控和千万级规模上的工程要求

## 1. 安全基线

Omni-Edu Agent 涉及未成年人学习资料、家长信息、教师记录和机构经营数据，安全优先级必须高于普通工具软件。

安全原则：

- 本地优先。
- 最小权限。
- 明确授权。
- 可审计。
- 可导出。
- 可删除。
- AI 调用前脱敏。

## 2. Electron 安全要求

必须：

- contextIsolation: true。
- nodeIntegration: false。
- Renderer 不直接访问 fs/path/child_process。
- 通过 preload 暴露窄 API。
- 不加载不可信远程页面。
- 禁止在 renderer 存 API Key。

preload 只暴露任务级 API：

```ts
window.omniEdu.students.create(...)
window.omniEdu.records.create(...)
window.omniEdu.attachments.import(...)
window.omniEdu.reports.generate(...)
```

禁止暴露：

```ts
window.fs
window.electron
window.ipcRenderer
window.exec
```

## 3. 隐私与数据合规

### 3.1 数据分类

高敏感：

- 学生真实姓名。
- 学校。
- 家长联系方式。
- 原始附件。
- 原始沟通记录。

中敏感：

- 学习记录。
- 错题内容。
- 复盘报告。

低敏感：

- 标签字典。
- 报告模板。
- 系统配置。

### 3.2 AI 脱敏规则

发给 AI 前必须移除：

- 真实姓名。
- 手机号。
- 学校。
- 具体住址。
- 家长身份信息。
- 原始附件。

替换：

```text
张三 -> 学生A
北京市某某中学 -> 某学校
138xxxx1234 -> [PHONE]
```

### 3.3 日志规则

日志允许：

- requestId。
- userId。
- tenantId。
- taskId。
- errorCode。
- duration。

日志禁止：

- 学生隐私全文。
- 附件原文。
- AI prompt 全文。
- API Key。

## 4. 权限设计

### 4.1 MVP

单用户本地，无复杂权限。

### 4.2 团队版角色

角色：

- owner：机构拥有者。
- admin：管理员。
- teacher：老师。
- reviewer：复盘审核者。

权限：

- 老师只能看分配学生。
- admin 可分配学生和管理模板。
- reviewer 可审核报告。
- owner 可查看经营看板和账单。

### 4.3 审计事件

必须审计：

- 登录。
- 导出学生档案。
- 删除或归档学生。
- 修改报告。
- 上传或删除附件。
- AI 调用。
- 权限变更。

## 5. 部署方案

### 5.1 MVP

本地桌面安装包：

- Windows 优先。
- 数据默认在 userData。
- 支持自定义数据目录。

### 5.2 小团队版

两种模式：

1. 云端托管。
2. 局域网/私有化部署。

云端：

- API Server。
- PostgreSQL。
- Redis。
- 对象存储。
- Worker。

私有化：

- Docker Compose。
- PostgreSQL。
- Redis。
- MinIO。
- API + Worker。

### 5.3 商业化规模

推荐：

- Kubernetes。
- PostgreSQL 主从 + 备份。
- Redis Cluster。
- 对象存储。
- 独立 worker pool。
- CDN 分发静态资源。

## 6. 环境规划

必须至少有：

- local。
- dev。
- staging。
- production。

每个环境独立：

- 数据库。
- Redis。
- 对象存储 bucket。
- AI provider key。
- 日志空间。

禁止：

- dev 连接 production 数据库。
- staging 使用真实学生数据，除非脱敏。

## 7. CI/CD

### 7.1 桌面端

检查：

- typecheck。
- lint。
- unit tests。
- Electron build。
- Playwright Electron smoke test。

### 7.2 后端

检查：

- typecheck。
- lint。
- unit tests。
- integration tests。
- migration dry run。
- OpenAPI schema check。

### 7.3 Python AI

检查：

- unit tests。
- OCR fixture tests。
- schema tests。
- performance smoke tests。

## 8. 可观测性

### 8.1 日志

必须结构化 JSON：

```json
{
  "level": "info",
  "requestId": "req_xxx",
  "tenantId": "tenant_xxx",
  "userId": "user_xxx",
  "event": "record.created",
  "durationMs": 32
}
```

### 8.2 指标

核心指标：

- API QPS。
- API P95/P99。
- DB 查询耗时。
- Redis 命中率。
- 队列积压。
- AI 任务成功率。
- OCR 平均耗时。
- 同步失败率。
- Electron 崩溃率。

### 8.3 告警

必须告警：

- API 5xx 升高。
- DB 连接池耗尽。
- Redis 不可用。
- 队列积压超过阈值。
- AI provider 错误率升高。
- 对象存储上传失败。
- 同步失败率异常。

## 9. 性能与容量规划

### 9.1 规模假设

千万级项目按以下上限规划：

- 10,000+ 机构。
- 100,000+ 老师。
- 10,000,000+ 学生档案。
- 100,000,000+ 学习记录。
- 100,000,000+ 附件元数据。
- PB 级附件对象存储。

注意：

这不是 MVP 要一次实现的规模，而是架构不应阻断这个方向。

### 9.2 性能目标

桌面端：

- 启动 P95 < 5 秒。
- 学生列表 1000 条内搜索 P95 < 500ms。
- 添加记录 P95 < 300ms。
- 复盘模板生成 P95 < 3 秒。

云端：

- 普通 API P95 < 300ms。
- 看板 API P95 < 1 秒。
- AI 任务创建 P95 < 300ms。
- AI 任务异步完成，不阻塞请求。

### 9.3 扩展策略

当 PostgreSQL 压力增大：

- 加索引。
- 查询优化。
- 读写分离。
- 分区表。
- 大租户迁移独立库。

当 Redis 压力增大：

- key TTL 整理。
- 热 key 拆分。
- Redis Cluster。

当 AI 任务压力增大：

- worker 横向扩展。
- 任务优先级。
- provider 多路由。
- 额度限流。

## 10. 发布与回滚

桌面端：

- 自动更新必须灰度。
- 更新失败保留上一版本。
- 数据库 migration 前必须备份。

后端：

- 蓝绿或滚动发布。
- migration 先兼容旧代码。
- 回滚脚本必须准备。

AI prompt：

- prompt 必须版本化。
- 新 prompt 灰度。
- 输出质量可对比。

## 11. 灾备要求

MVP：

- 用户可导出本地数据目录。

商业化：

- PostgreSQL PITR。
- 对象存储版本管理。
- Redis 可重建，不作为唯一数据源。
- 每月恢复演练。

## 12. 上线前红线

- 没有备份恢复方案，不上线商业版。
- 没有审计日志，不上线团队权限。
- 没有脱敏，不上线 AI 云调用。
- 没有限流，不上线 AI 付费接口。
- 没有 Electron 安全检查，不发安装包。
- 没有 migration 回滚方案，不发后端版本。


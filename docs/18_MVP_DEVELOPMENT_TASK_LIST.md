# Omni-Edu Agent MVP 开发任务列表

版本：v0.1  
依据：`docs/11_STRATEGIC_PRODUCT_PRD.md` 至 `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md`

## 1. 当前阶段目标

本阶段先完成个人老师桌面 MVP 的本地闭环：

```text
创建学生 -> 添加学习记录 -> 导入附件 -> 本地持久化 -> 时间线查看 -> 生成阶段复盘 -> 老师编辑保存
```

暂不做账号、云同步、团队权限、排课收费、家长端、学生端、复杂 OCR、自动判分和完整组卷。

## 2. 开发红线

- Renderer 不直接访问 `fs/path/child_process`，所有本地能力通过 preload 窄 API 暴露。
- 原始附件默认只复制到本地学生目录，不自动上传云端。
- SQLite 只保存附件路径、类型、大小、hash 和抽取文本，不保存原始大文件。
- 复盘草稿必须可编辑，不能一键定稿。
- 报告结论必须来自真实学习记录、标签或附件元数据。
- 核心流程必须离线可用。
- 不引入学校级平台、完整 LMS、招生排课收费等非 MVP 能力。

## 3. Sprint 0：Electron 工程骨架

状态：进行中

任务：

- [x] Electron + Vite + React + TypeScript 工程可运行。
- [x] 建立 main / preload / renderer 边界。
- [x] 设置 `contextIsolation: true`、`nodeIntegration: false`。
- [x] preload 暴露 `window.omniEdu` 任务级 API。
- [x] Renderer 通过 IPC 读取本地数据目录。
- [ ] `npm run build` 通过。
- [ ] Playwright Electron smoke test 覆盖启动和 preload。

验收：

- `npm run dev` 能打开 Electron。
- `npm run build` 能通过。
- Renderer 不能直接访问 Node 文件系统。

## 4. Sprint 1：SQLite 与学生档案

状态：进行中

任务：

- [x] 初始化本地 SQLite 数据库文件 `OmniEduData/app.db`。
- [x] 创建 `students` 表。
- [x] 新建学生。
- [x] 编辑学生。
- [x] 归档学生。
- [x] 学生列表和搜索。
- [ ] 创建 30 个学生的持久化验证脚本或 E2E。
- [x] 增加入参校验，避免空名称和非法状态进入数据库。

验收：

- 能创建不少于 30 个学生。
- 重启后学生数据仍存在。
- 100 个学生规模下搜索即时响应。

## 5. Sprint 2：学习记录

状态：进行中

任务：

- [x] 创建 `learning_records` 表。
- [x] 支持课堂、作业、试卷、错题、沟通、阶段总结。
- [x] 支持科目、标题、正文、标签和发生时间。
- [x] 时间线按发生时间倒序展示。
- [x] 支持类型和关键词筛选。
- [x] 支持编辑学习记录。
- [ ] 记录表单增加更明确的错误提示和保留草稿。

验收：

- 同一学生可添加多条记录。
- 时间线顺序正确。
- 老师能在 3 分钟内新增一条完整记录。

## 6. Sprint 3：附件管理

状态：进行中

任务：

- [x] 创建 `attachments` 表。
- [x] 通过 Electron 文件选择导入附件。
- [x] 默认复制到学生资料目录。
- [x] 保存文件名、路径、类型、大小和 hash。
- [x] 支持打开附件所在目录。
- [ ] 补充大文件复制进度和失败状态。
- [ ] 支持图片缩略图缓存。

验收：

- 一条记录可挂多个附件。
- 50MB 以上文件不写入数据库。
- 附件复制失败时记录仍可保留并提示原因。

## 7. Sprint 4：阶段复盘草稿

状态：进行中

任务：

- [x] 创建 `review_reports` 表。
- [x] 按学生、时间范围、科目聚合学习记录。
- [x] 按标签和记录类型统计。
- [x] 模板生成 Markdown 草稿。
- [x] 支持编辑并保存报告。
- [x] 保存 Markdown 到学生 `reports` 目录。
- [x] 为报告增加独立 `parent_summary` 字段。
- [x] 报告质量检查：证据、建议、家长版摘要、可编辑状态。

验收：

- 能基于真实记录生成复盘草稿。
- 报告包含整体表现、进步点、高频薄弱点、典型证据、学习习惯、下阶段建议、家长沟通版摘要。
- 报告保存后可在学生详情查看历史版本。

## 8. Sprint 5：本地搜索与导出

状态：未开始

任务：

- [x] 学生关键词搜索。
- [x] 学习记录关键词搜索。
- [x] 预留或启用 SQLite FTS5。
- [ ] 支持科目、标签、时间范围组合筛选。
- [ ] 导出单个学生档案。
- [ ] 导出整个 `OmniEduData` 目录说明和入口。

验收：

- 1000 条记录下搜索 P95 小于 500ms。
- 单学生档案可导出并恢复。

## 9. 前端架构任务

状态：待重构

任务：

- [ ] 按 docs/17 迁移到 `renderer/shared/ui`、`features`、`widgets`、`pages` 结构。
- [ ] 建立应用级 UI 封装，后续承接 HeroUI Pro。
- [ ] 优先对齐 HeroUI Pro `app-layout`、`sidebar`、`timeline`、`drop-zone`、`rich-text-editor`。
- [ ] 关键页面完成 1440x900、1280x800、390x920 视觉验收。

## 10. 当前优先级

1. 先让 V0.2-V0.4 本地数据闭环真实可用。
2. 修复 build/typecheck，避免只有界面样子没有工程可靠性。
3. 补齐编辑记录、报告质量检查和大文件导入状态。
4. 再做 HeroUI Pro 应用级封装与视觉验收。

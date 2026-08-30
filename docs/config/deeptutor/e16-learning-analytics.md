# E16 学情分析与报告配置

## 目标与边界

`analyze_learning_progress` 是 Electron main 注册的只读 HostTool。它复用 Omni SQLite 的 `learning_records`，输出版本化、可重算的 `omni.learning.analytics.v1`，不创建第二份学生数据源，也不自动写入学生档案。

报告草稿可以由小智引用该统计结果生成，但落入 `review_reports` 前必须进入 `create_review_report` 教师确认项。确认结果必须包含 SQLite report readback。

## 默认值与限制

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| 时间范围 | 最近 30 个 UTC 日历日 | 未提供 `startDate/endDate` 时使用 |
| 最大时间跨度 | 366 天 | 超过直接 `failed`，不截断伪装成功 |
| 学科 | 全部 | `subject=全部` 或省略不筛选 |
| 学习记录读取上限 | 200 条 | 仅供统计；事件不保存记录正文 |
| 来源 ID 上限 | 100 条 | 用于报告引用和重算绑定 |
| feature flag | `analyze_learning_progress` | 由 report/student-diagnosis route allowlist 控制 |
| 日历口径 | `UTC-calendar` | 避免系统时区变化导致边界漂移 |

## 输入/输出

- 输入：可选绑定 `studentId`、`startDate`、`endDate`、`subject`。
- 输出：`schemaVersion`、window、metrics、topTags、topKnowledgePoints、facts、unknowns、sourceRecordIds、`recalculationKey`。
- 不输出：原始 `content`、附件路径、答案、学生隐私字段或未经确认的标签写回。

## 错误与降级

- 缺少学生、学生不存在、跨学生请求：`blocked`，不执行统计。
- 日期格式错误、起始日晚于结束日、跨度超过 366 天：`failed`，不生成报告草稿。
- 合法但无记录：`used` + `recordCount=0`，facts/unknowns 明确说明证据不足；不得生成虚构趋势。
- 小智生成的 Markdown 只能作为 `previewMd`；拒绝/过期/重复确认不得产生报告写入。

## 验收命令

```powershell
npm run test:deeptutor-learning-analytics
npm run build
```

该 smoke 覆盖时间/学科过滤、UTC 边界、空数据、跨学生越权、原文脱敏、确定性来源绑定和教师确认读回。

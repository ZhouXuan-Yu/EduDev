# E14 错因分类配置与运行契约

## 目标

`classify_error_patterns` 是本地只读 HostTool。它复用 DeepTutor `learning/grading.py` 与 `models.py` 的四类 taxonomy：`structural`、`deviation`、`application`、`metacognitive`，并增加 Omni-Edu 的 `unknown` 证据不足边界。

## 输入边界

- 只允许 `error_analysis` route，必须有已绑定学生。
- 可选 `studentId/startDate/endDate/subject`；显式 studentId 必须与本轮绑定学生一致。
- 日期使用 UTC 日历边界，默认最近 30 天，最大 366 天。
- 最多从 SQLite 读取 200 条记录；只有错题、错因、失分、错误、订正或纠错信号会进入分类。

## 分类规则

1. 结构化 `errorType/error_type/errorCategory/mistakeType` 优先，映射到 DeepTutor taxonomy。
2. 结构化空答案且 `isCorrect=false` 归为 `metacognitive`。
3. 标题、标签、摘要或记录文本只用于本地规则匹配；概念/定义/公式、读题/题意、步骤/计算/符号、空白/不会等信号分别映射到四类。
4. 无显式类别或足够信号必须归 `unknown`，不能由模型补齐。
5. `application`（尤其“粗心”）需要老师复核；`unknown` 永远需要老师复核。

## 输出与隐私

- 输出 schema：`omni.error.taxonomy.v1`。
- 返回 counts、分类项、facts、unknowns、来源记录 ID 和不含正文的 `recalculationKey`。
- 不返回原始记录正文、附件路径或私密标题；工具结果上限 4000 字符。
- 不产生 confirmation、不写 `learning_records` 或学生档案；如果需要持久化标签，必须另建教师确认契约和审计字段。

## 验证

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run test:deeptutor-error-taxonomy
```

专项 smoke 覆盖显式四类、未知、空答案、UTC/日期窗口、跨学生阻断、非法日期、HostToolProxy round-trip、结果 bounded、原文不泄露和无写入。

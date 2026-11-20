# 带图确认卷与原题选项交付

## 根因和代码范围

结构导入将图形选项放在题文档 `choices.options[].blocks`，与题干原图的 `sourceBlockIds` 分开。自动组选的原卷编译已遍历选项图。包含卷内实例的确认卷走另一编译入口，保留原题时读完主裁图就结束，学生与教师 DOCX/PDF 会丢失选项。受控有效完整文档在旧版复现一张题干图、零张选项图。

- `paper-office-images.ts`、`paper-rich-export.ts`、`paper-instance-export.ts` 共用结构题选项顺序。实例保持原题时，题干图后依次输出正确标签及其原裁图。题目版本、图角色、摘要和尺寸沿用原有 Office 来源认证。
- `question-web-document-boundaries.mjs` 对比自动组卷与实例编译的同一文档。修复后学生与教师均得到题干图和 A–D 四张图，图按对应标签锚定。严格对照拦下旧缺图草稿。
- `paper-print-electron.mjs` 复用原交付测试，可指定已有确认卷标题。在隔离副本从正式组卷历史验证导出，保留原库。
- `paper-export-boundaries.mjs` 更新测试隔离模块的 Electron 导出名称，恢复 SQLite 竞争回归。生产运行时不使用该测试替身。

## 实际确认卷交付

复用已确认的六题、30 分物理练习卷，含 9 张原题裁图。由脚本从正式教师导航打开确认记录，按受众和格式选择、核对原图、批准并保存。模型工具调用由本地受控响应提供，新增真实模型调用为 0。SQLite 文件谱系、同卷摘要和受众匹配，重启后六份文件哈希不变。

| 实际文件 | 原图及内容独立读回 |
| --- | --- |
| 学生 DOCX / PDF | Word 包内的 9 个媒体 SHA-256 与预览匹配。PDF 有 9 张图和 3 页 A4，学生正文无答案和解析 |
| 教师 DOCX / PDF | Word 包内 9 个原图摘要匹配。PDF 有 9 张图和 4 页 A4，教师正文有答案和解析 |
| 答题卡 DOCX / PDF | 无原题图、答案或解析，PDF 为 1 页 A4 |

旧图形选项自然样本仍为有原裁图、缺答和缺整题投影的待补资料，保持原状态。图形选项专项使用受控完稿逐项验证。物理练习卷验证六个正式交付入口，KB-A06 的三套 20 题 / 100 分正式卷以及 Office/WPS 原生版面抽查继续待验。

## 回归

从 `apps/desktop` 执行，源码专项使用 `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/<文件>`。

| 测试 | 结果 |
| --- | --- |
| `question-web-document-boundaries.mjs` | 14/14，并复用 39 项配答回归。新增断言在修复前只得到题干图 |
| `paper-instance-boundaries.mjs` | 17/17 |
| `paper-export-boundaries.mjs` | 21/21，含 Office 来源与 SQLite 启动 |
| `paper-basket-boundaries.mjs` | 45/45 |
| 桌面构建、组件 | build 通过，组件 253/253 |
| `electron-smoke.mjs` | 207/207，在图形选项修复的隔离构建运行 |
| `paper-print-electron.mjs` | 8/8，六份文件、冷启和两种窗口尺寸。另用 Word XML、PDF 独立读取 |

实测命令需设置 `PAPER_PRINT_EXISTING_ROOT` 为已通过的本机六题隔离试导目录，`PAPER_PRINT_CONFIRMED_TITLE` 为该目录中的精确卷标题，`OMNI_EDU_TEST_BUILD_ROOT` 为本轮构建目录。测试任务只在临时副本设置受控模型，不读出或使用该副本的旧模型凭证。重新运行时保留之前因副本凭证无法解封而中止的报告。

文件保存使用原来的审批与事务。新增工作仅遍历已存选项块，在同一题面段落绑定四张图片，无新 OCR 或模型开销。PDF 分页与耗时受原图尺寸影响。本轮未测整库或批量延迟。

需回退时普通 revert 本轮代码。无需数据库迁移。缺图的历史待交付草稿在修复版不能提交，从原确认卷重新准备文件即可。已经保存的历史文件和凭据可继续查阅。

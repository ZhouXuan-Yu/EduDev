# 印刷题号与相邻公式的结构恢复

## 根因与实现

旧行分类只把「第 N 题」或有点号、顿号的数字识别为题首。排印中的空格题号、独立数字框和计分标题都可能进入正文，导致跨多道题的合并组。考生说明的过滤把「选择」当作试题特征，个别作答说明进入题本。数字布局恢复后还发现，上下堆叠的分式片段能在纵向排序中跑到上一题选项之后。

- `material-structure-numbering.ts` 按同列坐标、相邻打印编号、试题小节、选项或填空证据恢复数字题首。独立数字框必须有同一行的相邻正文。计分题首保留原页文字，解析平衡括号后提取题号。堆叠公式必须与下一题同列等式及两片数学原文互证，归属后保留待核，不生成原 OCR 没有的算式。
- `material-document-structure.ts` 在段落合并前应用恢复结果，并对考生说明保留原页、阻止进入题目。现有选项、小问、来源和不确定性处理持续生效。
- `material-document-structure.ts` 的共享契约将派生版本升级到 v11。已保存的 v9、试运行 v10 和更早有效版本仍可读取。能力清单同步生成。
- `document-structure-boundaries.mjs`、`document-structure-repository.mjs`、`kb-assessment-numbering-readback.mjs` 分别覆盖合成反例、旧结构版本和自然整卷重放及桌面重建。

## 真实数据

在上轮 221 份的既有隔离副本续办，首个检查点从 1 份部分完成增长到 2 份，4 份已交接，215 份等待。没有复制原目录或重新申请云端权限。

同一 5 页自然数学卷，原始 209 行 OCR 与行框逐项对照。保存的上一版为 8 组，其中唯一有编号记录是考生说明，其余 7 组缺题首。新规则重放为 24 组，其中 23 组有可见题号，19 组待核，另有仍无题号的内容组。考生说明保留在原页。两行分式文字归到实际含等式的后题，该题的公式继续待核，前一题四个选项保持原顺序。未根据顺序推算原件中没读出的编号。

最终桌面构建从「段落与试题结构」重建，20.5 秒发布 24 组，23 个可见题号，4 条进入题本草稿，20 组待核。此耗时包含解析与发布，使用已有页缓存，暂无同条件旧构建耗时。教师按原题文字搜到新版草稿，考生说明零命中，正式检索对这批草稿继续隔离。原件、上一版结构、已核题和调用账本核对一致，新增模型调用与正式题均为 0。初次专项误用正式检索等待草稿，修正后按题本入口和正式门槛两项分别验证。

续办副本最终保留 5 份部分完成（4 PDF、1 DOCX）、1 份已交接、215 份等待。批次保持暂停，已生成的不同派生版本可分别追踪，目前没有活动的独立答案册配对。

## 测试

- `npm run build -- --outDir test-results/build-kb-assessment-numbering-final` 通过。主进程 SHA-256 为 `240453af2f39107ada94ecf81fa122ecd287f48e98ebdddef922eb6a3428a298`。
- `npm run test:renderer-components` 253/253。
- `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/document-structure-boundaries.mjs` 47/47。
- 同一启动参数，`scripts/education/document-structure-repository.mjs` 39/39，包含 v2 至 v10 的读取与新世代切换。
- 同一启动参数，`scripts/education/kb-assessment-numbering-readback.mjs <累计试导副本根> <原结构世代>`。使用 `--desktop` 和 `OMNI_EDU_TEST_BUILD_ROOT` 走教师资料入口、重建、题本检索和正式检索门槛。
- `node scripts/electron-smoke.mjs` 使用同一冻结构建和 D 盘临时目录，207/207。
- `npm audit --omit=dev --audit-level=high` 20 项存量通告，5 项 high，0 项 critical，依赖未变。

现有试导副本的当前结构世代共有 16 条规则草稿，16 条无答案，8 条题型为空。其中 4 条题型为空的题已有含「选择题」或「填空题」的章节标题。继续查清确定性题型和独立答案证据如何进入归档，保留正式门槛。

全目录、答案核对、三套正式卷、独立检索、约 10 GB 持续后台与真实跨设备换机继续原验收。回滚用普通 revert，既有原件与历史记录继续保留，需使用相应版本读取新生成的派生结构。

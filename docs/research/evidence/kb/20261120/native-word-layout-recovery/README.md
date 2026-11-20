# 旧 Word 归档的本地版式复核

## 根因与判定范围

已有 120 条 AI 归档中，22 条旧 Word 题只因题面完整性待核。当时冻结的 Word 题源把卷首说明随题保存，后来新版 Word 索引已经按原文范围分出说明、题干和独立答案。旧题的核对仍绑定旧 OCR、旧题图和两遍模型回执，重新导入时无法直接复用这些证据。

逐条读取 22 条的旧、新来源，有 7 条新版结构无解析疑点。其中 6 条题干和选项只差开头题号与排版空白。另 1 条涉及图义及图形定位。6 条中只有 2 条有新版 Word 找到的独立原文答案，并且两遍历史回执与该答案一致。本策略恢复这类有完整证据的纯文字选择题。缺少原文答案、包含图表或公式、题号或锚点变化、删掉共享题目条件、教师已经修改的题继续待核。

## 修改与数据保护

- `material-ai-native-layout-proof.ts` 复用新版 Word 索引、卷首说明识别和原文锚点，核对题干、选项顺序、独立原文答案、两遍模型回执及已有解析。数值和拉丁字母之间的分隔、开头小数、共享物理条件继续保留。
- `material-ai-native.ts`、`material-ai-repository.ts`、`native-question-repository.ts` 通过原“复核来源版式”入口，在现有 writer 内保存来源复核凭据、更新待核状态，并以新题版本引用原题图、原 Word 版本和历史回执。现有内容无需二次识别或联网。读回会重新验证 Word 版本、原文范围和原回执；单改状态、来源摘要或题目版本无法取得正式读取权限。
- `question-archive.ts`、`material-question-archive.ts` 保存并校验资料版式复核来源。教师修改后回到既有编辑与重新核对规则。此前已经生成的题没有批量改写。
- `paper-rich-export.ts`、`paper-instance-export.ts` 在正式试卷中呈现已核对的纯文字正文，原 Word 整题图稿仍可从题源读回。答案、解析及来源按原分卷规则处理。
- `kb-native-layout-proof.mjs` 和 `kb-native-layout-electron.mjs` 分别检查本地证据边界与实际桌面流程。

## 修改前后与验收

| 核对项 | 结果 |
| --- | --- |
| 实际试导副本 | 原 16 道 AI 定稿、102 道待核；隔离副本复核后 18 道定稿、100 道待核，3,202 条题库总量不变。两个归档的题干、答案、解析、图片和首末稿保持，原试导库只读 |
| `kb-native-layout-proof.mjs --db <已授权试导数据库>` | 33 项合成检查通过，真实 7 条完整解析候选中 2 条成立、5 条保留待核 |
| `kb-native-layout-electron.mjs <已授权试导 data 目录>` | 实际界面复核，2 道通过检索、来源和原图 SHA-256 读回，2 个正式原题方案获脚本代理确认。学生卷内容编译包含纯文字题、本卷编号，排除旧图稿及答案。重复操作与重启保持原审计，篡改审计后拒绝来源读取，新增网络调用和渲染错误均为 0 |
| `kb-native-dispatch-boundaries.mjs` / `kb-native-ledger-boundaries.mjs` | 17/17、20/20 |
| `kb-source-layout-boundaries.mjs` / `kb-next-parent-boundaries.mjs` | 10/10、6/6。旧快照的直接回归补初始化已有邻页表，并在旧裁块专测中隔离新版邻页规则，邻页专项单独原样通过 |
| `paper-basket-boundaries.mjs` | 45/45 |
| `npm run build -- --outDir test-results/build-kb-native-layout-release` | 通过。最终实际桌面构建 SHA-256 `daad2761a1b93ecf64f846c70d4b90f2a81c9fc6b3d935acfef23d22ebc70f76` |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs` | 整合构建 207/207，1366×768 与 1920×1080，构建 SHA-256 `78ff20b16dade3cfab4fe693c0c152fc87de447f2838e798d1cd7533ac6e9622`。最后的卷内题号及数字空白约束由上表最终构建实页覆盖 |
| `npm audit --omit=dev --audit-level=high` | 最新整合锁文件 22 项存量通告，high 7 项、critical 0 项。本功能没有增加依赖 |

脚本从 `apps/desktop` 运行，使用 `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/<脚本>`。真实桌面版式操作一次约 2.444 秒，包括原件、SQLite 写回及界面更新。旧版本没有 Word 复核入口，无法对同一路径测时。正式卷实测到选题、确认和办公室稿编译，当前未重做纸面 DOCX/PDF 导出、独立自然答案和约 10 GB 压力测试。

## 继续事项与回退

旧题的 AI 解析逐字保留，这条流程核实原文答案，不对解析做额外独立求解。已存的试卷和教师修改保留。回退发布应用前先保留当前数据库备份，由支持新复核凭据的版本导出对应题；旧版可从升级前备份读取既有题库和原始资源。

继续处理没有原文答案的旧题，并按已冻结的资料版本恢复明确但缺失的具体年级。完整自然质量、独立检索和正式三套卷档案仍按 KB-A01～A10 执行。设置 `OMNI_EDU_AI_SOURCE_LAYOUT=0` 可关闭新写入，历史证明按已保存版本重读。

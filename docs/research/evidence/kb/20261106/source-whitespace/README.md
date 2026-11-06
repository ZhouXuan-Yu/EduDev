# 来源转录分区空白适配与自然失败定位

## 当前结果

本轮修复实际来源分区的空白传输问题，并保留严格内容检查。完整 Goal 保持 ACTIVE，KB-A01～A10保持 OPEN。自然自动归档质量仍为 FAIL。

question-source-content.ts 复用原严格 SourcePart 形状校验，新增有界空白对齐。material-ai-page.ts 仅在 page-readings.v2 的解析对象中应用，沿 crop.text 原串生成连续切片。原 text、角色顺序和全部非空白字符须相同，通过协议接收的响应继续按原始字节持久保存，严格 validSourceParts 最后仍要求分区逐字拼接完整原文。SHA、图像、租约、OCR及来源门禁继续参与原校验。提示补充通用未知标签完整保留正文的例子。

未新增表、IPC、依赖、服务或云权限。算法按现有 8KiB/裁图、48KiB/读数、128KiB/响应预算执行。UTF16 范围由原串计算，emoji、指数、负号和单位按原字符保存。数值/符号/文字差异、未知角色、缺失或增加分区内容仍会拒绝。

## 真实模型与失败

1. 脚本首次在目录搜索尚未返回时断言，尚未调用模型。增加明确等待与唯一控件检查后继续，原 preflight-failure.json/log 保留。
2. 0b1a1c8 当前生产版本真实新批 aibatch_954e121b-6d21-439b-9624-8dc2bc84889a，首次与来源两次 HTTP200，第二次合法 JSON、12题/22裁图、44970B。8个分区在题号后的空白没有逐字保留，导致整批 invalid_response。旧失败保留于 natural-before.json/log/ledger。
3. 实施后本地只读复读该原响应，恢复8个分区，全部原文、非空白字和问题字段一致，响应文件 SHA 不变，未发模型请求、未回写或自动放行题目。retained.json/log 保存原始 SHA 和剩余8题正文/分区不一致、12题 uncertain_ocr，不能据结构修复宣称自然质量通过。
4. 一次新批再次真实调用两次，第二次仍被拒绝。原因是第10/12题正文裁图的 parts 多出图义概述，而这些字不在该 crop.text 中。严格拒绝正确，不能删除概述、忽略分歧或把它当空白修复。natural-after-diagnostic.json 只记录定位与 hash，实际资料文字和图片留在本机。自然批未到第三遍，完整题文档和自动可用稿均为0。这两次无效来源响应由验收拦截器留存在本机，正式应用对无效收到响应的持久化仍需下一切片补齐。

本轮4次真实 DeepSeek Flash completion，共110969 tokens，无自动重试，均 HTTP200且finish=stop。两个付费批因实现变化各运行一次，没有重复发送独立答案册。旧付费记录与题目快照前后相同。usage.json/两份 ledger 保存统计，未估算价格。

## 正向用户路径与工程验证

受控 PNG 场景在生产目录/本地 OCR/版面/模型宿主中故意省略 parts 的 marker 空白，完成三遍与题本归档。题本显示实际分区和两份不同出处年份，typed 来源读取、1366×768/1920×1080及冷启通过。SQLite 保留原始不对齐响应，完整文档保存无损切片，原图片和历史响应一致。真实云请求0。它证明功能集成与失败隔离，不能替代自然质量。

| 检查 | 结果 | 证据与范围 |
|---|---|---|
| 本轮新增源分区边界 | 6 PASS | 包含在页基套，空白/Unicode/重复字、符号/单位/否定/缺字/恶意对象反例、executor原始回执与冷读 |
| 页归档基套 | 210 PASS | page-premerge.log，原204加6，受控模型/图片 |
| 本轮构建/typecheck | PASS | build.log，首次never类型推断错误保留failure-build.log，改为形状校验后直接比较原串 |
| 组件状态 | 246/246 PASS | components.log |
| 受控实际图片流程 | 3 PASS | controlled.json/log，whitespaceRawPreserved=true，云0 |
| 合并前冻结构建共享Electron | 207/207 PASS | electron-premerge.log |
| 整合main后build/组件/页归档 | PASS / 246 / 210 | integrated-build.log、components-integrated.log、page-integrated.log |
| 整合后既有图片冷读 | 2 PASS | integrated-cold.json/log，无OCR或provider重放 |
| 协作者题号筛选 | 5 PASS | number-filter.log，内存SQLite谓词与状态边界 |
| 整合后冻结构建共享Electron | 207/207 PASS | electron-integrated.log、frozen-after.json |
| audit | 28，8高/12中/8低/0严重 | audit.json，既有问题，退出1 |
| 自然题库质量 | FAIL | 两批均来源阶段invalid_response，旧12题待核保留 |

## 命令与版本

包内命令 cwd 为 apps/desktop。

```powershell
node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --partition-whitespace
node --experimental-transform-types scripts/education/kb-source-content-journey.mjs "$env:TEMP\omni-source-content-ui-oa9ack"
node --experimental-transform-types scripts/education/question-number-filter-test.mjs
node scripts/electron-smoke.mjs
npm audit --json
```

本轮代码提交3be629e，随后无冲突整合协作者4个main提交至c86b9eb，包含题号筛选及对应验收。frozen-before.json 保存自身改动前后 main/preload/renderer，main+1848B、renderer+99B、preload+0，均为未压缩产物字节。整合后的总体变化为 main+2082B、renderer+1014B、preload+0，包含协作者功能。integrated-frozen-before.json 保存最终专项启动前 SHA，完成后另存 frozen-after.json。吞吐、峰值内存、40GiB/72h与真实检索SLO仍未验。

本轮测试脚本扩展当前导航、唯一控件、双尺寸和source-content/partition-whitespace模式。文件最终仅还原了无关格式变化，两份文件的 Prettier 完整格式化结果逐字相同，业务语法一致；随后整合构建/专项再次运行。原日志中的长文件行号对应当时脚本，保留原件。

## 回滚

可用 OMNI_EDU_AI_SOURCE_CONTENT_ROLES=0 停止新任务采用该分区策略，保留已存 v2 的空白适配读器、原始回执与派生文档。已有新回执需要该读器，不直接降级到旧解析器。纯空白适配也不授予原题、图像或组卷资格。

## 下一切片

自然失败表明重复输出 text/parts/stem/projection 会产生结构及语义分歧，继续增加提示不能替代协议修复。下一优先拆分独立的最小原图转录响应，保留整页及逐裁图字面文字，宿主依据已冻结版面、裁图和原文机械生成可核分区/规范题面，未知标签保留正文，图义与字面转录分别处理。原始收到的响应先持久保存，再本地校验和派生，减少因格式问题重新收费。设计和迁移须先补实施合同，旧任务/原始收据/来源角色/隐私/教师确认都要有兼容路径。此项尚未实现。

其后继续120自然留出、200查询、三套正式蓝图、真实10→40GiB/72h、普通Windows链式安装与异机移植。当前没有关闭任何完整产品验收项。

全部最终验证命令已终态，最终共享回归退出0，三份构建摘要前后一致。自然两个失败批与原失败继续保留，未作为质量通过。主线整合及远端一致性以本轮Git收尾输出核对。

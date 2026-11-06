# 待核题原图与独立答案候选

基线：`3c217e3`。完整知识库 Goal、KB-A01～A10 均保持 OPEN。本轮修复可操作的来源查看和答案候选匹配；没有解决自然题自动定稿率，也没有以全部待核作为质量通过。

## 结果与边界

- 正式题本逐一打开原自然现场的 12 道题，22 张已存来源裁图均实际解码显示。题面/图片归属仍待核，不生成完整题文档，也不进入正式题池。原整页查看入口保留。
- 原现场最新旧日志实际为 12 条 `answer_not_found`，早期“0条”是后台未完成时的快照。题册章节标题有“》”，答案册无该装饰符；新布局 lookup 自动找到 12 条 `question_unchecked` 候选。实际界面查看第4题的书册答案 D 和答案原页，但不覆盖原 AI 答案。
- 原用户资料页、旧付费输入/首末稿/纠错稿、原 crop 记录、规范题和调用账本保持不变。新增模型调用 0；两次 `/v1/models` 探测在网络前拦截，解答请求尝试 0。
- 实际生产 Pi applied-question provider 仍拒绝来源待核题。题卡的原页面板读取有效书册关联并只显示当前题的候选，可直接查看已知答案及原页。两个尺寸查看题图及冷启通过，renderer 错误 0。最终自然集成6项通过，不是题面/答案正确性或成品试卷验收。
- **自然质量仍 FAIL：12 题待核，完整文档 0，自动采用书册答案 0。** 正文开头标签/出处、符号与本地 OCR 的差异仍需完整来源恢复；不删除前缀、不模糊正文、不抹掉数字/单位/图义。

自然原图、PDF、数据库、账户和截图仅保留本机，未提交。现场：`%TEMP%\omni-natural-books-62sbkdoe`；首次5项在 `source-review-TyK7rk`，最终6项在 `source-review-qHT5H2`。`natural-before-inline-report.json` 保留前次结果，`natural-report.json` 是最终结果，只含计数、状态、构建 SHA 和阻断网络元信息。两个本地查看运行各拦截2次models探测，总4次；总解答请求尝试及实际云请求均0。

## 实现与复用

1. 原 `getOriginalQuestionGallery` typed IPC → `OriginalQuestionRepository.questionImages` → 独立 `reviewImages` 宿主 → 原资料/回执/选块/裁图字节认证。只有教师 gallery 能调用新增宿主，Pi context、Office images 和 `automaticSource` 未获待核权限。首/纠错/末稿的同题号同选块必须一致，缺失/变动/失败 crop 拒绝；只读预览不声称 OCR 或裁剪完整。
2. `book-section-layout.v1` 是新 journal 冻结的 lookup 策略，只有明确章节标记之后紧邻“》/〉”可作为版式归并；章号、文字、基础/提优等保持精确。原 `bookSectionKey`、`section_key`、转录及 quote offset 不变。重号/归并后多源仍歧义待核，原题及答案源质量门禁保留。
3. 原派生索引增量加 `lookup_key` 与 B-tree，`section_policy=4` 触发原有有界重建。旧 journal 无 lookupPolicy 仍按原精确语义认证，新 journal 冻结策略供冷读；没有新业务表、IPC 通道、依赖、服务或云请求。

## 验证

工作目录为本 worktree 的 `apps/desktop`；命令终端均须完成后计数。build 含 `tsc --noEmit`。

| 命令 | 结果 / 证据 |
|---|---|
| `npm run build` | 最终PASS；`build-final.log`；`build.log` 为增加题卡候选入口前的构建 |
| `npm run test:renderer-components` | 最终246/246；`components-final.log`；前次 `components.log` 保留 |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 174（新增3）；`page.log` |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs` | 结构化来源7；当时基套33；`book.log` |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-section-status-boundaries.mjs` | 最终基套34（新增4）+答案续页16+状态12；`sections-legacy-final.log` |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-section-inheritance-boundaries.mjs` | 题页章节13；`inheritance.log` |
| `node scripts/education/kb-source-review-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe"` | 最终自然集成6/6，来源与质量待核不变；`natural-final.log` / `natural-report.json`；前次5/5保留 |
| `node scripts/electron-smoke.mjs` | 最终同构建207/207，exit0（`electron-final.log`）；入口前207/207（`electron.log`）单独保留，不累加 |
| `npm audit --json` | 非零；存量28（8高12中8低0严重），依赖/锁文件未改；`audit.log` |

没有将同一基套的重复导入多次相加。`npm run test:smoke` 是 build + 同一 electron-smoke，两条实际完成时等价，无需为脚本名称重复运行。Git 收尾另查 diff、提交/远端一致性，不等于产品验收。

本轮全部命令均已终止。最终同构建的组件246、自然6项及共享Electron207通过；没有被遗漏的后台测试或未完成的付费请求。原质量FAIL与上述集成PASS分开保留。

`SHA256SUMS.json` 列出本目录证据的字节摘要（不含自身），暂存后再次比对Git blob，日志以binary属性保留原终端字节；不包含资料原文或截图。

## 失败记录与批判审查

- 直接运行静态 TS 测试缺预加载器，`sections.log` 记录 module-not-found，后续使用上表准确命令。
- `sections2.log` / `answer-sections.log` 暴露旧测试要求“明确同题号冲突来源不能改变题目”。这与已有冲突隔离规则矛盾：不继承下一页标题，不代表忽略前页实际同卷同号的明确答案。改为断言保留原答案、持久 `answer_conflict` 且版本改变；其他未知/错卷/无匹配仍断言事实不变。未删除覆盖，未放宽生产规则。最终通过保留在 `sections-legacy-final.log`。
- 查找时曾猜错 shared/main 路径、脚本名，并向 Windows rg 传壳层通配路径；均改成实际 `rg --files` 路径和目录 `-g` 过滤，没有重启已有付费任务。这些是执行效率问题，不计为业务测试失败或功能通过。
- 文档批补丁曾使用错误的验收台账标题，整批未落盘；核实实际标题和工作树后重新应用，无旧内容丢失。
- 原图能看、答案候选能匹配，不代表正文还原或解题达标。不能将 metadata B-tree、模型一致、同源 OCR 一致或图片存在当作正确性。

## 性能、迁移与回滚

同一最终构建 main SHA `d9c788b11d6716407e7b6b6cb803e88134542da11bcdaf61e38d7833c708090d`。main 4,079,886B，较基线 +3,310B；renderer 7,760,912B，+1,649B，SHA `203e61957c939a5bd087932bb588e322bdfdc06d17efd06440e6c64508626f53`；preload 38,520B 不变。见 `build-performance.json`；前次构建体积保留在 `build-before-inline-performance.json`。因新增实际题卡候选入口而重做一次build、组件、自然6项及同构建共享Electron，不是无改动重复测试。

同一小型自然现场数据库、各100次热身+1000次纯 B-tree 查询，旧/新 P95=0.0082/0.0068ms，分别使用 lookup_v1/v2 索引。这是噪声可影响的热局部查询，不宣称整体加速；不含原件/图片认证、IPC、OCR、重建、模型或40GiB。新增索引占用额外磁盘，历史投影要一次增量重建；大库重建等待、全局 pending 门禁、72h 和换机仍未验。

`OMNI_EDU_AI_REVIEW_SOURCE_IMAGES=0` 停待核 gallery；`OMNI_EDU_BOOK_SECTION_LAYOUT=0` 停新布局匹配，保留旧精确 lookup。新 journal 读器、派生列/索引与冻结策略保留，不删除历史事实；旧二进制降级未验，不能直接回退后声称新书册证据仍有效。

下一继续来源字面转录与解题阶段分离，让原题正文/前缀在原图中完整可核对，再让认证书册候选参与答案整理；随后依原合同推进120自然留出、真实搜题正反例、200查询、三套正式蓝图、40GiB/72h及普通Windows链式安装/换机。不能再以“多一项拦截”替代自动可用率提升。

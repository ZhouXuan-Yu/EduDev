# P2 章节认证后的目录、子批次及原页状态

本片修复实际产品矛盾：答案续页已经认证章节并自动配答，目录与AI子批次仍报“待处理”。执行根为 `C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject`，基线 `fc29ed513002bd8ae41fa663c7a93c7fb2ff2854`。本目录仅包含合成资料、测试和构建证据，没有真实书籍、账户配置或密钥。

## 教师可见结果与真实边界

- 原成功三层目录 `C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn`：2份PDF、4个AI单元、2个规范题已配答。目录由3完成/1待处理变为4完成/0待处理，子批次由0完成/1待整理变为1完成/0待整理，答案第2页显示标题来自同册第1页。
- 1366×768、1920×1080与冷启均通过。题本、原图和Pi来源仍经原路径读取。原目录grant和原AI单元仍为attention/review，展示状态由认证索引投影；原始响应、付费记录与规范题完整指纹前后一致。
- 本轮新增受控模型响应0、真实云请求0。报告累计10条是此前已有调用，12条检查中2条为本轮新增用户状态检查；未重新导入或逐页修改真实验收PDF。
- 只有原始no_questions、两遍一致、原疑点仅missing_section（允许原规则已接受的missing_analysis）、认证后无实质疑点的答案页才适用。正文冲突、OCR疑点、跨页、漏答案、强制needs_review都保留。
- 目录/子批次轮询使用派生索引、当前SQLite资源版本和书册身份，不逐页读取原图。打开原页与规范来源仍重新认证原文件和连续标题证据。外部文件变化尚未反映到数据库时，概要可能暂用上一份索引快照；该概要不能授权事实写入。
- 全局dirty/unindexed门禁保守保留：其他索引仍待追赶时，已解决的标题提示也会暂时恢复。40GiB持续后台导入时的表现仍需P4验证，不以本片热测替代。

## 实现与恢复

原 `material_book_answer_index_v1` 增量加 `review_state`，仅页哨兵可存 `section-resolved.v1`；`section_policy=3` 触发一次增量重建。原AI/OCR/付费收据、原图、规范题和教师确认不变。书册解绑/版本或revision变化、索引dirty、更新/删除标题、无效新答案、功能关闭时返回原待处理。问题列表先排除已解决项再LIMIT5；暂停、预算、配置、scope_changed、导入未完成/失败/部分完成不被完成投影覆盖。

无新表、IPC、依赖、服务或模型轮次。原页契约仅加可选 `BookAnswerPage.sectionSource`，目录契约仅加可选 `FolderAiView.sectionResolved`。复用原解析器、32页认证、持久队列、B-tree、typed preload及组件。

回滚：`OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE=0`停止新继承及概要投影，同时保留兼容读器与新派生列；必要时从原收据重建索引。不能直接运行使用裸VALUES的旧二进制。不删除资料、题目或付费记录。

## 验证及精确命令

以下均在工作根 `apps\desktop` 执行，输出原字节保存在同目录日志中；共享Electron最终状态见 `electron.log`。

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-section-status-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-section-inheritance-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn --figure-crops --continuation-figures --section-inheritance --answer-section-inheritance --allow-build-change --section-status
node scripts/electron-smoke.mjs
npm run test:ui-contracts
npm audit --json
```

- PASS：状态12项（严格反例、实际SQLite、迁移、失效、权限/预算/暂停/范围保护、LIMIT和查询计划），导入原配答21项与答案续页16项；原题页章节13项、结构化来源7项、目录12项、页归档112项、组件246项及最终build通过。重复导入的旧套件不重复加总。
- PASS：实际Electron目录/子批次/原页双尺寸与冷启，新增2项；原图/续图/题本/Pi等累计12项，renderer错误0，新增模型调用0。
- PASS：最终冻结构建共享Electron 207/207；中间构建207项通过单独保留。所有本轮命令均已结束，源码及三份包指纹与冻结一致。
- FAIL：UI合同受保护 `prompt-input/index.ts` 的既有指纹不符，actual1459eb1…/expected671d52…；该文件与基线本轮均未修改，不刷新基线掩盖。
- AUDIT：当前42项（8高/26中/8低/0严重）；与上一轮记录29项的快照不同，依赖/锁文件本轮无变动，不声称当前漏洞已修复。

## 失败和批判复核

首次边界运行仍断言旧policy2，随后复用夹具的裸VALUES无法接受附加列，第三次夹具role忽略资源ID；三份原始失败日志保留，改为policy3、显式列与按资源角色后通过。未删断言或修改生产来源规则迁就夹具。

第一次实际UI运行通过目录与原页断言，但截图揭示AI子批次仍写“部分结果需处理/待整理1”。该中间报告、构建日志和截图独立保留（intermediate-*），不冒称最终。补齐同一派生查询到批次列表、增加摘要断言，再冻结构建重跑实际UI及受影响回归。旧原始收据未清review。

## 性能与未完成项

100000条无关答案索引、100次内存SQLite热读，整个目录view的P95=0.6674ms；原实现同条件时延未测，不能声称加速倍数。查询计划按batch主键/页最新索引/资源主键定位，无无关答案条目全扫描；dirty存在性探测至第一行即可结束，不打开图片。

相对fc29ed5实际构建：main从4030916B到4036598B（+5682B），renderer入口7758079B到7758791B（+712B），preload38520B不变。精确SHA见build-frozen.json，原始源码工作区字节指纹单列，均不等同于Git LF blob指纹。

完整Goal及KB-A01～A10仍OPEN。自然带图/公式留出集、真实搜题正反例、独立200查询、高质量蓝图成品、40GiB/72h和普通Windows安装/换机仍未完成。实际夹具数据库仍有2个rule_extracted候选和2个book_enriched规范题；下一应核对教师列表/检索/组卷是否重复暴露同一题，再修复关联显示，不能直接删除事实或隐藏教师编辑题。其他线程基座/UI验收状态不由本片改写。

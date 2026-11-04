# 答案册无标题续页：实施与验收

本轮实现独立答案册的安全标题继承及后页索引更新。题册第2页、答案册第2页均不重复标题时，可分别认证本书第1页，再按试卷标题和题号写回同一规范题。原AI/OCR回执、题图及教师角色不改。完整知识库Goal和KB-A01～A10仍OPEN。

## 实际结果

- 全新三层目录现场 `C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn`：实际打印的两页题册+两页答案册，经过原目录导入、PDF/OCR/版面、授权、后台归档和自动配答。第1题与第2题均已book_enriched；第二题规范ID为 `question_ebce557e-2877-414c-87a6-ddb5a4eb1a05`，版本 `937f23e9f3aa03f7aa52930a275cfd6de296a2f8bce6ccfddba07d1322f5f9e2`。
- 第二题答案原文在答案册第2页，标题证据在答案册第1页。原匹配卡明确显示两个页码；题本与Pi读取结构化book_extracted角色，1366×768、1920×1080与冷启通过，付费回执指纹保持。最终10项累计检查通过（包含原有目录/插图检查，不称10项全为新增）。
- 成功现场共10条受控模型响应：初次7条，追加测试预留额度后只执行未发送的一页、增加3条；最终冷读0条。另一个保留的初次失败现场7条。本轮合计17条受控响应，真实云请求0、真实计费0；不证明DeepSeek自然识别/解题准确率。
- 新16项答案续页边界、原21配答、13题页章节、7结构化来源通过。最终build、246组件及207共享Electron检查通过。UI合同检查FAIL：已有受保护prompt-input/index.ts原始字节指纹与历史基线不同；本轮未改该文件，LF归一化后与基线提交b9b16a4完全相同，未修改指纹来消除失败。详见 `ui-contract-existing-failure.json`。

## 实现与兼容

复用MaterialBookQuestionSection、原答案解析器、页B-tree、dirty/work队列、journal及writer；未增加表、运行时、服务、依赖、IPC或模型轮次。内部证据 `xiaozhi.book-answer-section-context.v1` 与题页上下文分开，不能互换。派生解析政策 `section-number-inherited.v1` 只给缺标题的前缀提供初始标题，不拼接或改写原文，start/end/quote仍是实际字面跨度；未知试卷/章节边界停止继承，后续显式标题照常生效。旧原页政策保持原含义。

回看最多32张连续前页，资源、版本、解析代次、答案书身份一致；两遍标题、严格顺增题号一致。缺页、重复/回退、换卷、疑点或损坏来源拒绝猜配。事务发布前和后续题本/Pi读取重验上下文，所选答案页被新页取代或删除也拒绝旧证据。标题只归一化原有排版字符，索引与读回规则一致。

派生索引增量增加book_role/proof_sha，dirty增量增加context_only；section_policy从1升级2，一次后台重建旧投影，完成后重复迁移不重置水位。六个owned触发器升级v2，原页变动优先于上下文重建。真实变动最多唤醒后32张最新答案页；上下文重建不递归传播，实际条目/证明不变不重复唤醒配答。删除/损坏仍保留最新页标记，不能复活旧标题或答案。旧/新schema、晚到页、并发碰撞、取消、写前竞态和读回篡改已覆盖。

## 失败与批判检查

1. 初始命令遗漏Node的 `--experimental-transform-types`，参数属性无法载入；修正启动命令后才执行到业务测试，原失败日志保留。
2. 两个初版测试断言不当：新政策在未知标题处终止跨度，本就不同于旧原页跨度；前页显式同号答案应保留候选冲突，不能声称完全没有候选。修正为实际字面切片及不自动误配，未放松生产边界。
3. 第一实际现场 `omni-folder-books-yl1Htj` 因原页missing_section的review触发脚本提前退出；文字两遍一致，原始review保留。验收只允许“答案侧、仅missing_section、两遍一致、无整页疑点”继续等待派生配答，不忽略其他review。
4. 第二现场原测试上限10不足质量模式的四页最坏预留12，正确停在budget_exhausted。保留失败，按原UI追加到12后只处理未发送的一页，未重做导入/已付费单元。
5. 两个题页各有独立AI批次，同时展开时原脚本全局匹配行定位歧义；改成精确第2题所属批次。再次冷启只读0请求，完成来源/Pi/双尺寸检查。保留原报错及截图。
6. 仍有产品缺口：原答案页review及目录的通用待处理警告尚未利用已认证的跨页上下文消除；实际配答已完成，但目录仍可能报一项原页元数据待核。下一切片应区分真实质量问题与已解决的章节定位，保留原始回执及可撤销派生状态，不能直接清空所有review。
7. 原answerChanged仍会唤醒同答案书的配对题页，且上下文读器对全局dirty保持保守；本轮限制了新传播，但不证明整书调度或并发大库读取已达标。自然标题覆盖/多图公式、规则候选重复展示、真实搜题反例、200独立查询、蓝图成品、40GiB长稳和安装换机仍需执行。

## 性能、依赖与回滚

- 相对b9b16a4冻结构建：main +6298 B，preload 0 B，renderer入口 +318 B；SHA见 `frozen-build.json`。
- 100000条合成答案、5000页、内存SQLite：现有精确查找P95 0.061 ms，32页上下文查询P95 0.426 ms；查询计划使用原lookup/latest B-tree。基准内旧live-fence对照P95 5.036 ms。该对照是早期算法，不是本轮自然大库前后性能；不含文件回执、AI、UI或RAG。
- 实际第二题Pi来源单次读取约198 ms，应用冷启后147 ms（OS缓存未清，非P95）；只能说明本例端到端读回。32页传播测试同时覆盖第33页不波及与raw失效优先，无递归风暴。
- 无新依赖。npm audit --omit=dev返回1：已有29项（高8、中13、低8、严重0），未宣称修复。
- 设置 `OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE=0` 停止新继承，保留新读器、原事实、图及journal；已有上下文在关闭开关甚至重建索引后仍可认证读回。新派生列要求保留显式列写入器，旧裸VALUES二进制不能直接降级。不要删除付费回执或真实资料来回滚。

## 精确命令

从 `apps/desktop` 执行，完整日志均保留；源码载入必须启用transform-types。

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-answer-section-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-section-inheritance-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-answer-lookup-benchmark.mjs
npm run build
npm run test:renderer-components
npm run test:ui-contracts
node scripts/electron-smoke.mjs
npm audit --omit=dev --json
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --folder-pairs --figure-crops --continuation-figures --section-inheritance --answer-section-inheritance
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn --figure-crops --continuation-figures --section-inheritance --answer-section-inheritance --continue-answer-section
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn --figure-crops --continuation-figures --section-inheritance --answer-section-inheritance
```

实际首次命令仍为10次预算，脚本现已修正新双答案页测试为12次预留；先前失败不是新命令重跑结果。所有本轮命令已结束，主Goal继续active。证据仅包含自有合成资料报告/截图/日志，不包含用户教材、账户数据库、凭据或整库。

# P2 原始候选与规范题的精确来源归并

执行根：`C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject`；基线 `2bcb49ff6723d7849e851d6765797598c89da288`。仅保存合成资料的日志、指纹和截图，无真实教辅、账户配置或密钥。

## 产品结果

实际旧导入目录 `C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn` 原有两道答案册已配答规范题、两条未整理规则候选。修复前默认题本4条，修复后默认2条；教师勾选“显示原始候选”仍为4条，取消勾选回到2条。1366×768、1920×1080和冷启动一致。

两道规范题的Pi来源读取成功；跨页烧杯题的独立插图正常打开。教师通过实际题型/关键词筛选及“加入”按钮，向新的本地题篮加入规范题，筛选只显示1道规范题，冷启动恢复相同题篮、题目版本与修订3。没有直接写数据库伪造题篮。

整个题目表及AI单元的输入、两遍响应、图片SHA、状态、错误指纹均与修复前一致：`36c9de216ebe868a92cb160d6aa07d99fddd4abbbbe5758540e59c3d9f30466e`。本轮新增模型请求0。测试拦截 `/chat/completions` 并禁止重发；原始OCR/AI/书册证据没有被清除或重解释。正式成卷确认、Office视觉及自然题目质量不由此片验收。

混合检索可以同时返回两道相关规范题，字面匹配题排在首位；不能要求每个关键词只返回1题。受控向量反例另行证明已覆盖候选在融合前被排除、不挤占Top1，返回前重新检查可见性。原始规则题本来就可能被归档质量门禁排除，本片不把原检索结果中的两个规范题误报为重复。

## 根因与实现

旧关联只接受`ai_final`；答案册/网页写回UPDATE会删掉关联，历史游标不会重新处理更新过的ID。跨页AI档案仅存首页来源，而规则抽题持有两页完整来源，无法命中同一键。

复用原`material_question_origins`、精确资源版本/正文SHA/offset/chunk/题号/归一完整正文键及教师保护规则。`book_enriched`和`web_enriched`只有在原完整来源校验通过后才重建AI关联；教师编辑稿不参与自动隐藏。允许`cross_chunk`仅用于关联投影，不放宽归档、图片或成卷资格。

新增内部续页来源读器：先认证冻结AI页输入，再读取同资源/版本/解析代次的相邻两页，最多64个chunk；完整正文及题号精确相等才生成扩展来源，提交事务再次认证规范题和全部来源。不同页、代次、正文、题号、来源、歧义均不猜配。

新增一张可重建的`material_question_origin_dirty_v1(question_id,revision)`表。原question INSERT/UPDATE触发器排队，DELETE清理；原执行循环每tick最多8条（最多4条dirty，其余历史扫描），schema1游标一次升级schema2。revision比较防止吞掉并发更新；取消不清任务；来源暂不可读时持久保留重试并移到队尾，历史游标安全前进。四条不可读记录不会挡住第五条正常更新。没有新增执行器、IPC、UI组件、依赖、服务或模型轮次。

题本沿用原默认/历史开关；关键词SQL在LIMIT之前过滤；混合检索在融合前与返回前过滤；蓝图/错题候选页复用同一可见性谓词。收藏、分类、使用、编辑保护及来源/回执失效恢复保留。显式读取原始ID仍可进行，不删除原始事实。

## 验证命令与结果

以下在`apps\desktop`执行；原始字节日志保存在本目录：

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-qualified-origins-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-source-origins-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-retrieval-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-match-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/question-web-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-origins-qualified-journey.mjs C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-DnYhmn --baseline-report=C:\Users\ZhouXuan\AppData\Local\Temp\kb-qualified-origins-ghZZbd\report.json
node scripts/electron-smoke.mjs
npm run test:ui-contracts
npm audit --json
```

- PASS：最终build；新增19项归并/迁移/取消/队列公平/100k元数据检查，原来源13、检索17、配答21、页归档112、书册结构化来源7、网页结构化来源12；书册专项导入的原21项不重复计数。
- PASS：组件246项；既有24678端口占用警告留在原日志，进程exit0。没有关闭协作者进程。
- PASS：真实Electron4项（题本默认/历史、混合查询、原图/Pi、实际筛选加入题篮，均含双尺寸和冷启），`final/report.json`，renderer错误0，新增模型请求0。
- 共享Electron：两次运行均207/207通过，`electron-intermediate.log`、`electron-final.log`。后一次从分批探测前构建启动，期间完成了末次构建；保留为中间回归，不宣称207是在同一最终冻结构建整套重跑。末次200ID分批改动后最终build、19项专项、原17项检索及4项真实桌面均通过；所有命令已结束。
- FAIL：UI合同仍为既有受保护`prompt-input/index.ts`指纹不符，actual1459eb1…/expected671d52…，本轮未改文件或重录基线。
- AUDIT：42项（8高/26中/8低/0严重），本轮依赖与锁文件未修改。

## 失败及批判复核

首次build因合并历史/dirty行时的TypeScript推导丢失ID字段失败，显式`Row[]`后通过。新增测试第一次缺少旧题册候选谓词使用的`m.resource_id`夹具列，补齐真实表结构后通过。100k测试曾错误依赖SQL Set返回顺序，改为无序集合相等，原失败日志保留。

第一次桌面断言错误地要求混合查询只返回1题，实际返回两个已整理规范题且字面题在首位，与修复前相同；保留`failed-hybrid-count`，改为检验无原候选、唯一ID及首位字面命中。扩展题篮的第一次夹具在页面挂载后才创建所属对话，无法选择新对话；按已有成熟driver的用法先建对话再挂载。冷启一次在异步候选返回前读取DOM，保留`failed-cold-query`，改为等待既有`waitInstanceUi`及目标候选真实可见。没有因此修改产品来源、降低门禁或掩盖原失败。

额外复核发现语义索引可能扩展至1000条过期命中，而新可见性探测上限为单次200ID；现按每批200个唯一ID分批读取，并补1000条反例。该小改后重跑19项专项、原17项检索、最终build与真实桌面，不把前一构建的207条运行冒充全套最终重跑。排名期间失效的夹具曾依赖探测调用次数，分批后改为在真实rerank返回时改变可见性；原失败日志保留。

批判复核补出的生产问题是队列公平性：四条暂不可读记录可能长期占据dirty首批并钉住历史游标。现在持久重排、保留revision且先记重试再推进历史水位；新增明确反例证明后续正常题仍可归并。

## 性能、风险与回滚

100000条无关来源投影，100次内存SQLite可见性热读，最终P95=0.1928ms。只证明有界元数据探测；原实现同条件未测，不能称为加速倍数、真实检索P95或40GiB资格。dirty按rowid取首4条有界扫描，不逐题扫描全部历史。首次schema2仍须有界重读一次历史，原件/图片认证有IO成本，大库耗时未验。

相对2bcb49f，main从4036598B到4043516B（+6918B），preload38520B、renderer入口7758791B均不变。`build-frozen.json`保存最终包原字节SHA；`source-frozen.json`保存最终源码工作区字节SHA，与Git换行规范化后的blob不是同一概念。实际脚本`buildSha256`是对Buffer序列化的旧测试指纹，不能代替本目录的文件原字节SHA。

回滚应保留派生dirty表与兼容读器、恢复旧关联策略并重建投影，不删除原题、原件、教师记录或付费回执。旧二进制直接降级未验；全量来源历史仍可由原开关查看。数据真源仍为SQLite及本地文件，索引可重建。

完整Goal及KB-A01～A10保持OPEN，其他线程基座状态不变。下一按已冻结主线推进自然多图/公式留出集、真实网站题解与反例、独立200查询、蓝图正式成品、40GiB/72h及普通Windows安装/换机；受控合成来源归并不能代表这些已完成。

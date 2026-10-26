# 知识库实施证据

## 2026-10-26 main 整合（本轮整合门禁已完成，整体Goal继续）

用户最新授权优先先整合本地 main、处理协作冲突，再继续知识库主线，替代此前“完整 Goal 结束后再合并”的时序。本轮检查点 59b4303，整合协作者 main 076edd1（含亮色工作台、会话/推理流和整合修复）；28 个冲突文件按双方有效行为组合。本地 main 已于本轮整合到 8f14752（双方历史及修复），未 push。快进前发现D盘协作者切到 codex/composer-grouped-conformance 并有4个已跟踪脏文件及1个新测试，已保留原现场；改在干净 beca 工作树切 main 快进后切回知识库分支。未把D盘当前分支/运行目录冒充同步到新main。此状态文档收尾提交也将快进本地main。未发布新安装包，后续 Git 状态以实际 HEAD 为准。

已修正 partial 资料阅读笔记 CAS、新材料/检索/AI IPC 退出 drain、启动恢复晚到、未保存笔记的新入口与同资料搜索定位。综合 smoke 实际暴露语义索引独占锁使备份 EBUSY，已在 backup 领域改为有界异步复制/哈希、原生 SQLite 在线快照，精确排除 cache/semantic-v1；快照改 DELETE journal 模式，并只在备份副本清除省略索引的完成资格，恢复后自动全量回填。原件、题目、来源时钟、暂停选择和产物保留。

已完成 build/typecheck、renderer 240/240，重排8、检索17、AI16组回归；独立合并5、原生备份3、独立恢复5项定向探针通过，冻结教育包7项含主线新增线性方程组 v2，四套发行资源预检通过。重排/阅读 Electron 预备构建5项/2启动/0 rendererErrors通过；最终构建并发综合回归期间另一次冷查未出现成功重排提示而等待断言超时（未单独实证模型失败原因），该失败保留 kb-main-journey-current.log，不能以预备通过掩盖。最后整合 bundle SHA256 b8012530a716fbcc3232bb4d86786844762f1d0348e97107b37b03d6f014961c。

综合 smoke 修复后 exit0：kb-main-smoke-final.log，ok=true/30名隔离学生/207项历史教育兼容路径，包含12项备份导出/校验/取消/篡改/重启/双视口。该legacy兼容路径不代表当前全部Pi UI或真实provider已验收；当前Pi知识库/阅读另在最终bundle上串行复验5项/2启动/0 rendererErrors（kb-main-journey-serial.log），首查9851ms、热请求134ms，仍未达到2秒冷查目标，非P95/40GB证据。首次备份EBUSY与并行冷查成功提示断言超时的失败日志保留。npm audit 最终21项（8 high/5 moderate/8 low），尚未清零；无自动大版本升级。原 main 带来的4处历史 EOF 空行由 staged diff --check 报告，本轮相对 main 的 diff --check 通过，未重写协作者/上游源码消除风格告警。

完整 Goal 仍 active。继续 S6-B Word 结构与完整图文题：已用真实 anydoc 0.1.2 证明 toDocument 保留图片 SHA/part，OMML 分数在 AST 和 Markdown 均缺失。随后是跨页/答案册匹配、受管本地视觉AI、自然教师召回质量/冷查询优化、40GB持续导入与最终EXE；以上未验证边界继续 OPEN。

最终串行复验：node scripts/education/kb-reranker-journey.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6，kb-main-journey-serial.log exit0/5项/2启动/0rendererErrors；四包在切换main后prepare-resources再次逐文件通过（kb-main-resources-after-checkout.log），确认LF固定防止源码指纹漂移。

精确命令 cwd=apps/desktop，产物在 test-results/goal/：

- npm run build：kb-main-build-final.log，含 tsc 与真实桌面打包产物；exit0。
- npx tsc --noEmit：kb-main-type-final.log，exit0；npm run test:renderer-components：kb-main-components-final.log，240/240。
- node --experimental-transform-types scripts/education/kb-main-merge-boundaries.mjs：kb-main-critic-final.log，5/5。
- node --experimental-transform-types scripts/education/kb-backup-boundaries.mjs：kb-main-backup-boundaries-final.log，3/3，真实 sqlite3/WAL/冷SQLite/Windows独占锁。
- node --experimental-transform-types test-results/goal/kb-backup-critic-review.mjs：kb-main-backup-critic.log，5/5，真实仓库类与受控native适配；恢复回填原2对象。
- node --experimental-transform-types scripts/education/kb-reranker-boundaries.mjs：kb-main-reranker.log，8/8；同前缀 kb-retrieval-boundaries.mjs：kb-main-retrieval.log，17/17；kb-ai-batch-boundaries.mjs：kb-main-ai.log，16/16。
- node scripts/education/kb-reranker-journey.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6：kb-main-journey-final.log，预备构建5项/2启动；随后当前构建在并发综合smoke期间运行 kb-main-journey-current.log，未通过成功重排提示的等待断言，不能据此确认模型内部错误原因，不计验收。
- node scripts/release/test-education-runtime.mjs：kb-main-frozen-education-final.log，7/7；node scripts/release/prepare-resources.mjs：kb-main-resources-final.log，四包90/646/156/157文件逐一完整性与源码检查。
- npm run test:smoke：首次 kb-main-smoke.log exit1，backup EBUSY；修复后 npm run build 然后 node scripts/electron-smoke.mjs：kb-main-smoke-final.log，exit0，ok=true/207历史兼容路径，非全部当前Pi UI/真实provider验收。
- npm audit --json：kb-main-audit.json，21项/exit1；git diff main --check：exit0。
- node scripts/education/kb-word-structure-probe.cjs：下一Word切片的解析器原生探针，合成一像素图不证明自然题图质量；资产68字节SHA一致，OMML缺失。


<!-- kb-rerank-20261026:start -->
## 2026-10-26 有限中文重排与最新实现基线（目标继续）

S5-B3已接通有限中文交叉编码器：资料库、同一题本与小智现检索适配器使用BGE-reranker-base q8，对前20对象评分，再与原召回等权RRF融合，未评分尾部保留。新冻结Windows EXE懒启动、15秒总预算、队列/输出/窗口有界、空闲回收；错误/超时保留原排序并显示降级。模型不更改题目、答案或来源，不给教师展示虚构正确率。

末次返回改为对象版本及父来源revision的一条SQL栅栏，保留不受后台新资料影响的结果；父来源变私密/删除只剔除相关项并明确partial。新增retrieval_source_revisions派生时钟，不进入向量事件类型；历史seq0和墓碑的存在/内容/seq来自同一SELECT，防止旧行被错误绑定到新seq。原事实与索引世代不因重排重写。

独立AI先冻结20例开发pilot，再另冻结16例四科分级验证集（非自然教师标注）。真实冻结模型在后者的融合NDCG@3由BGE余弦基线0.8311提升到0.8689，最佳项Top1由10/16到11/16；仍有失败与排序退化，不能称高准确率已达标。大m3在开发集仅小幅提升、约2.6倍耗时，因此未预装。首个冻结模型调用约6.14秒，实际UI首查5.83秒；单次热缓存完整请求40ms含重排缓存命中，不是百万级或P95证据，冷启动尚未达到2秒试验目标。

命令工作目录apps/desktop，源码工作树C:/Users/ZhouXuan/.codex/worktrees/beca/EduProject。npm run build：kb-reranker-build.log exit0，最终main SHA256 ec96ae05619e425ab5de30919fd2fd12a3aadb72e7714c08a48c76808f45f80a；npx tsc --noEmit：kb-reranker-type.log exit0；npm run test:renderer-components：kb-reranker-components.log，217/217 exit0。没有重跑旧通用smoke或旧NSIS。

实际资产：设置OMNI_EDU_BUILD_PYTHON为D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe（只读复用经审构建解释器），node scripts/release/build-reranker-runtime.mjs：kb-reranker-runtime-build.log，157文件399017988字节。node scripts/release/prepare-resources.mjs：kb-reranker-resources.log，四套runtime646/90/156/157逐文件SHA与buildInputs通过；prepare额外比较被选模型asset lock。旧embedding/ocr/education包未重建。没有PyTorch、远端执行或运行时模型下载。

模型比较：固定Xenova base q8和ONNX-community v2-m3 q8，kb-reranker-compare-base.json/log及kb-reranker-compare-m3.json/log保留。原20例开发pilot给base NDCG@3 0.87417/m3 0.88344，6候选平均454.75/1182.8ms；只用于模型/通用融合策略开发，不称holdout。

node --experimental-transform-types scripts/education/kb-reranker-frozen.mjs：kb-reranker-frozen.log，5项exit0，无skipped。真正固定Windows EXE/ORT/分词器，正确协议、cache拷贝与改文失效、非法/超额输入后恢复、token窗口不完整标记、冻结v2质量；kb-reranker-frozen-quality.json含16例逐例结果。baseline为固定BGE余弦在每例六候选内的排序，不冒充全库FTS/RRF召回质量。冷模型调用6139.66ms；所选模型仍有排序错误，后续自然教师集/长题须继续。

node --experimental-transform-types scripts/education/kb-reranker-boundaries.mjs：kb-reranker-boundaries.log，8项exit0，无skipped。源类+内存SQLite/controlled model：保尾/失败、无关导入material/question、无历史边的父隐私/删除、历史seq0改题/私密与长文上下文。node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs：kb-reranker-retrieval-boundaries.log，17项exit0。此为源类守卫证据，非模型质量或规模。

node scripts/education/kb-reranker-journey.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6：kb-reranker-journey.log，4项/2启动/0rendererErrors exit0。真实UI导入2道规则题，检索同时导入第三份不同资料，当前45资料/3题/48索引；真正冻结BGE+cross+Lance，硬学科/年级过滤，前20比较的candidate_limit说明；cold重启同题集合、导入后原三表hash不变。首次UI5833ms，单次热缓存完整请求40ms（重排cache1ms）；不作为CPU未缓存20候选或百万P95指标。截图reranker-question-1920.png已读图，1366真实操作。

独立只读审核复现历史seq0旧row+新seq的P1，已以同SELECT修复并复验（材料变私密/改题/墓碑同型）；另验证来源边尚未回填时的父隐私/删除、无关导入、失败保尾、candidate_limit。第二位独立审核在冻结验证集后做8组源类/受控进程探针，覆盖父版本/修改与cache拷贝、内容失效、超时晚到、错误ID、排队上限和close；限定范围未发现剩余可复现P1/P2。新边界最初误要求隐私变化后清空全部material结果，已改为只移除受影响对象，避免测试固化原缺陷。

用户2026-10-26最新指令：此前均为测试信息，影响新流程的旧版本内容/测试数据可直接清理重建，以最新实现为准，不将开发测试数据永久兼容作为阻碍。此授权不等于覆盖协作者源码；正式交付后的教师数据仍按产品保护规则处理。自动删除旧包及未采用模型曾被审批策略拒绝（仅返回blocked by policy），已改为可恢复隔离，用户已索要路径自行删除；工具未声称已释放磁盘。

已隔离到apps/desktop/.retired-builds/S0-20261026（旧安装包/程序约1554876094字节）和m3-evaluation-20261026（未采用评估权重约587843930字节），共2142720024字节。当前选定base模型与最新out不在这两处；原.release路径已收起，后续全新安装包另构建。删除情况待用户实际操作，未替用户确认完成。

当前状态文件已收敛此前本任务旧进度marker，以最新实现为主；实施证据和批判记录保留历史结果，未据此删除协作者源码。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-maintenance-20261026:start -->
## 2026-10-26 索引维护与受校验ANN（目标继续）

S5-B2接通自动索引维护：4096向量起建无PQ量化的IVF_FLAT/cosine，先对exact做16条源向量/混合向量抽样，均值≥0.98且单例≥0.9才启用，必要时增加nprobes。新ANN训练期间查询固定旧版本快照，索引提交/压缩清理使用原生FIFO读写门；当前代小片段和历史版本自动整理，维护失败/中断持久提示并真实重试。资料库可见状态，手工暂停会停止worker；长时间回填中也按30秒节流维护，避免等到全部追平才整理。

仅修改可重建派生索引，原件/题库/确认记录不动。近期无引用Lance文件只在实际utility持有Windows独占FileHandle且原生读租约全部退出时清理；没有owner证明保留SDK默认七天策略。替换索引前先持久取消ANN资格，进程中断后不能用旧证书认可新索引。新增retrieval_maintenance派生台账，migrate将遗留running转retry_pending/interrupted；未成功维护不能清掉错误。

本轮工作目录C:/Users/ZhouXuan/.codex/worktrees/beca/EduProject，以下命令在apps/desktop运行，未动D:日常程序或协作者main。无新依赖/模型包/上传/收费调用/安装包；冻结runtime版本不变。

- npm run build：test-results/goal/kb-index-maintenance-build.log exit0，最终main SHA256 2fbe6038119a0240fe369bef45a9013ad1f1882126ed3eb485a0af6ad8625ea9；npx tsc --noEmit：kb-index-maintenance-type.log exit0；npm run test:renderer-components：kb-index-maintenance-components.log，217/217 exit0。
- node --experimental-transform-types scripts/education/kb-index-maintenance-native.mjs：kb-index-maintenance-native.log，7项exit0，无skipped。自建omni-edu-index-maintenance-eFwiRc：16384基本向量+36片段向量，真正Lance native，受控512维编码器/direct native fixture不冒充教师导入。并发首开同代去重；训练持有旧快照可查/flat检查点；37→1片段；128分区/32探针/16样本tie-aware recall1.0；12个过滤query exact top10≥0.9；删除和计数；cold ANN与未认可证书exact。
- 本次受控native12次exact为54.6–106.6ms、ANN12.2–48.0ms，缓存/受控编码器、固定查询先exact后ANN，有顺序和热缓存影响，仅作本fixture观测，不作产品P95或教师体验SLO。ANN门槛不是自然题意相关性Precision/Recall。
- node --experimental-transform-types scripts/education/kb-index-maintenance-boundaries.mjs：kb-index-maintenance-boundaries.log，7项exit0；实际源类/内存SQLite、受控native表/独立Temp元数据，含FIFO/异常释放、距离边界tie、失败真正重试、running重启/无owner七天、低暂存空间零原生修改、从未完成不noop。
- node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs：kb-index-maintenance-boundaries-compat.log，17项exit0；node --experimental-transform-types scripts/education/kb-semantic-native.mjs：kb-index-maintenance-native-compat.log，8项exit0（实际冻结BGE与Lance，独立小样本），这两项先于最后SDK probe/type规范修正，最终索引原生7项和Electron随后验证。
- node scripts/education/kb-index-maintenance-journey.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6：kb-index-maintenance-journey.log，4项/2启动/0rendererErrors exit0。小库43对象维持flat，实际BGE题意从可见输入查询原资料；实际native维护显示完成；手工暂停/关闭后仅对派生台账注入running，重启恢复interrupted提示，现查询仍可用，点继续后实际完成才清错；再从可见重建按钮触发新代，SQLite证明backfill_done=0时已实际维护，查询继续可用，追平才切换。三张原始SQLite事实表hash不变。index-maintenance-report.json和index-maintenance-1920.png；未把派生状态注入冒充原生进程事务kill。

另补持续回填期间的维护调度，避免未索引尾和小片段积累。当前新增边界覆盖backfill_done=0也真实调用维护。一次桌面用例在启动路由稳定前点击资料导航，后回到聊天页导致超时；保留index-maintenance-startup-race-report.json，最终脚本先等可见office-prompt-input再导航通过。尚未据此确认产品启动竞争根因，最终集成仍需复核快速启动导航。本轮真实原生调用发现minimumNprobes先设32会与默认max20冲突，改nprobes原子设min/max后再扩max；冷开API返回IvfFlat而非IVF_FLAT，已规范化索引类型并验证cosine/版本。独立审查复现小库优化失败后被版本阈值跳过却清错，已对retry_pending/interrupted/从未完成强制重试，3组独立复验通过；另4组读租约/训练旧快照/清理/失败守卫通过；回填中维护的调度另2组独立旧代查询/追平/节流/暂停验证通过。

整体仍active/DOING。当前只证明近邻算法对照及维护闭环；受控512维向量不是自然教师题意质量，1.6万不是百万级或40GB。小库仍使用exact，大库经校验才ANN。旧代目录整体GC、交叉编码器重排与教学质量holdout、完整图文/DOCX锚点/跨页和答案册配对、受管本地视觉AI、40GB耐久和最终新安装包/main合并继续OPEN。

当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；完整目标完成后按用户指令读取最新main、保留协作者变更并解决冲突，不提前覆盖协作目录。
<!-- kb-maintenance-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

S5-A与S5-B1已接通本地题意检索和有界批量索引：冻结BGE中文embedding、LanceDB派生向量、FTS关键词RRF融合，资料库/同一题本/小智工具共用来源复验。教师可按改写题意查询、暂停/继续/重建；无系统Python或运行时模型下载。每批最多16事实、200000 UTF16字符及900KiB JSON，双文档编码穿插查询，推理后批量提交、receipt最后、事件批尾ACK。旧seq不能复活墓碑。

工作树C:/Users/ZhouXuan/.codex/worktrees/beca/EduProject，未修改D:运行目录/协作者main。以下命令工作目录apps/desktop；所有fixture为自建Temp合成资料，未扫描用户材料/上传/付费调用。Goal仍active。

模型/发行：tokenizers0.21.4固定wheel与MIT BGE q8模型，工具链/源/许可证/全部文件hash已锁定。以OMNI_EDU_BUILD_PYTHON指向D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe（仅构建读取，不改环境），运行node scripts/release/build-retrieval-runtime.mjs，kb-retrieval-runtime-build.log exit0，156文件/127076474字节。node scripts/release/prepare-resources.mjs exit0，kb-retrieval-resources.log，OCR646/279039929、education90/40305331、retrieval156/127076474逐文件一致。源码资产准备脚本仍需要网络，实际应用运行无网络模型依赖。

验证结果（无skipped）：

- npm run build：kb-retrieval-build-final.log，exit0；npx tsc --noEmit：kb-retrieval-typecheck.log，exit0。最终out/main/index.js SHA256 1e226913cceaf85efab934bc4e2d0c15754bd0f60a321e1c94ade9ae90e8ea66，同时有retrieval-worker.js。npm run test:renderer-components：kb-retrieval-components.log，217/217 exit0（本轮最终UI相同源码）。
- node --experimental-transform-types scripts/education/kb-semantic-native.mjs：kb-semantic-native.log，8项exit0。真实冻结ONNX+Lance含改写题意、原生硬过滤/知识点、长块尾部、UTF16、分词器错代、相同/更高seq墓碑、16事实同批/重放/标量索引与超限零改动；最终自建根omni-edu-semantic-native-5gG6Lz。报告bulkMilliseconds140只代表已热小样本几次操作，不能用于生产SLO。
- node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs：kb-retrieval-boundaries.log，17项exit0。实际源类/内存SQLite，controlled VectorPort，非原生性能测试；含旧库/代切换/删除隐私/FTS200后分页/长题/扩召回/ACK前崩溃/单坏隔离/错代/父来源变化/引用页隐私/迁移中断/教师新版本竞争/三预算拆批。
- node scripts/education/kb-retrieval-locks.mjs：kb-retrieval-locks.log，3项exit0。真实Windows并发进程独占锁、活写者不可抢、进程终止后OS释放；无删PID锁文件回收。
- node scripts/education/kb-retrieval-journey.mjs：kb-retrieval-journey.log，5项/3次启动/0renderer错误exit0，实例omni-edu-retrieval-znWRj6。42资料/1题/43索引对象，真实文件夹导入、暂停增量后冷恢复、非词法题意召回、资料来源打开、题本硬过滤、旧代查询/追平切换与冷读。此主路径先于后续批量及来源加固；最终编译产物追加下面冷读。
- node scripts/education/kb-retrieval-recovery.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6：kb-retrieval-recovery.log，3项exit0；自建旧派生元数据tokenizer错代→真实FTS降级→可见重建恢复，原始三张事实表SHA不变。此证据也先于后续来源加固。
- node scripts/education/kb-retrieval-ui-readback.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-retrieval-znWRj6：kb-retrieval-ui-readback.log，最终构建5项exit0。来源迁移新代43对象pending0/failed0，source-closure.v2标记与历史题依赖存在，真实原生检索、1366/1920输入/模式控件宽度、纯文字题无假图片、过滤变化移除旧结果。semantic-controls-1366.png/1920.png已读图。脚本的finally清理和来源迁移等待已在最终构建读回中执行。

独立审查：旧6组+锁/取消6组闭环；本轮document-only页隐私P1、来源迁移中断P2及失败墓碑误标新教师版本P2均复现后修复并独立复验（迁移4组，批量存储/ACK9组+原race1组），详见独立批判记录。原失败fixture未删除：初版fAfMRX等待building错过ready造成测试超时；测试进程signalCode未当终态造成锁清理退出13，已修断言而非放宽锁。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。

当前codex/knowledge-base-delivery，HEAD仍d3e2dec；未提交/合并/push，未修改协作者main或D:日常目录。用户已授权完整功能完成后合并main并解决冲突；届时须读取最新主线、保留协作者变更，不能沿用旧主线SHA或提前宣称交付。

<!-- kb-semantic-20261026:end -->


## 2026-10-24 后续：S1目录归档与S4-A正文检索（功能落地）

按用户最新要求把主线转回功能。本轮没有重打安装包或重跑旧全套。当前源码已有可操作的文件夹批次/逐文件进度、暂停/继续/重试和重启接续；归档与解析分开显示。原件复制改异步文件流、支持取消并检查可用空间，保留原hash与版本校验；坏文件/目录保留错误，不覆盖旧题目事实。

正文检索已贯通教师页面和Pi现工具：SQLite派生FTS5使用NFKC一元/二元token，中文短词、字符公式可查，候选归一化子串复核。新正文在事实事务中建索引，旧正文后台小批补建，删除/修改触发dirty；补建在独立写事务里执行。教师可以翻页并打开真实来源；Pi取最多200个非私密候选，再用现DeepTutor核验与脱敏，返回前复验来源。未解析、待索引和截断均不会冒充全库已搜索。这是关键词检索，尚不是语义相似题。

可运行入口：根目录`启动知识库开发版.cmd`，调用`npm start -- --knowledge-preview`；profile/dataRoot在%LOCALAPPDATA%/Xiaozhi-KnowledgePreview，避免与日常窗口混用。原`启动小智.cmd`逻辑保留；旧S0安装包不含本轮新功能。

必要检查：

- 最后`npm run build`通过（含typecheck），日志`apps/desktop/test-results/goal/kb-s1s4-delivery-build.log`；组件217/217，`kb-s1s4-delivery-components.log`；`git diff --check`通过。
- 实际Electron资料入口使用151份嵌套合成文本资料和1个不支持文件，完成选目录→暂停→重启仍暂停→继续后退出→再启动自动接续。151份归档，无重复事实；日志`kb-s1s4-background.log`前3项。其后导航有保留DOM导致定位歧义，并未伪称该次整段通过。
- 同一最终构建和同一数据库，在隔离后台窗口从可见资料导航续验：搜索“末章压轴”→命中长教材尾部→打开实际第92段来源成功；151份正文ready、242段索引、pending=0。报告`C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-folder-search-xUGlhy/text-search-final.json`，截图同目录`folder-tail-search-final.png`已实际查看。末尾单文件异常处理补充后仅重构建/组件门禁，不重复整套路径。
- SQLite内存实例验证中文双字/单字、x²→x2规范化和私密标记更新后退出索引；不是自然题召回率或百万规模结果。

新增SQLite目录事实表/FTS派生表、typed IPC/preload、两个资料域前端组件；无新依赖、上传、正式数据删除或D:日常目录写入。自动切题/题答和题图配对、AI自动定稿、向量语义检索、40GB压测仍未完成，下一主线按这些业务需求继续。避免把本轮资料归档称为自动题库已完成。


## 2026-10-24 S0 / S2-A

实施位置：`C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject`。用户授权实施v4，先冻结`KB_IMPLEMENTATION_CONTRACT.md`，没有切换或覆盖D:日常运行目录，没有提交、push、上传资料、清库或DDL。

### 实际改动

- 新增Windows x64构建/资源预检/electron-builder分发配置。教育reading/learning/question/math工具冻结为40,305,331字节的内部运行时；打包态只执行固定resources路径，不寻找系统Python。构建核对Python 3.12.14 / PyInstaller 6.22.3，采用全新staging，源文件与构建脚本/许可证逐项hash。
- OCR沿用现646文件、279,026,886字节的固定资源，未换模型。打包后根据编译期manifest再次核对资源。electron-builder默认省略的`.gitkeep`显式保留，未降低校验。
- LanceDB锁定0.30.0，Windows native约164MB；其运行时peer Arrow 18.1.0显式纳入prod依赖。二者Apache-2.0。electron-builder 26.18.0（MIT）仅构建使用；Electron 43.8.3同主版本更新。前端与构建依赖移入devDependencies。实际目录包32,861文件、1,194,202,577字节。
- 打包态教育工具并发最多4项（包含校验），调用总deadline、取消和bounded stdout/stderr均保留。校验失败不会回退系统解释器。
- 取消长文80块静默截尾；保留现每文件输入上限和原切块语义。已截尾旧记录不自动补齐。
- JPEG/PNG/WebP复用现离线OCR，保存单页机读来源。UI和小智工具均标记未核对，未自动标为教师确认题目。
- `office-network.ts`仅修正undici Headers到DOM Headers的类型兼容。

### 已获得的证据

桌面目录下执行：

| 命令 / 证据 | 结果与边界 |
| --- | --- |
| `npm run build:education-runtime`（构建环境显式指定） | 90文件；全新staging和固定工具链；不是用户侧依赖 |
| `npm run test:release-workers` | 6/6，空PATH直接运行冻结EXE；4类协议及非法selector |
| `node scripts/release/kb-ingestion-boundaries.mjs` | 6/6，长文尾部、chunk边界、固定OCR引擎与工具来源/未确认语义 |
| `npm run test:renderer-components` | 217/217；`test-results/goal/kb-s0/renderer-final.log` |
| `npm run pack:win` | build/typecheck及资源预检通过；最终`pack-final-integrity.log`；646+90打包后逐文件核对 |
| `npm run test:release-packaged` | 5组通过、2次正式打包态启动、0 renderer error；空PATH、故意错误的OMNI_EDU_PYTHON。教育工具实走固定EXE/并发4/取消，原生Lance写入与向量读回；单页PDFium组件；从教师资料添加按钮导入MD/DOCX/长TXT/PNG/一页扫描PDF；重启后全部5份正文、>80块尾部、图片OCR与未核对提示保持 |
| 上一行报告 | `test-results/goal/kb-s0/packaged-1792808176632/report.json`；同目录两种尺寸截图已实际查看（1366×768、1920×1080） |
| `node scripts/education/math-check-boundaries.mjs` | 13/13；原固定轮子/许可证、数学边界、实际超时/取消/并发恢复、缺失/损坏依赖拒绝；`test-results/math-boundary-cJNrok/report.json`（以math-final.log实际路径为准） |
| `node scripts/electron-smoke.mjs`（使用同轮已通过build的out） | exit1，旧DeepTutor run未达到succeeded，尚未定位根因。不可称通用smoke或全产品验收通过。日志`test-results/goal/kb-s0/electron-smoke.log` |
| `npm audit --json` | 当前14项（1 low / 5 moderate / 8 high / 0 critical）；未作为可公开发布安全验收 |
| `git diff --check` | 通过；Windows换行提示不等于diff错误 |

<!-- final-kb-gates:start -->
- NSIS：`$env:ELECTRON_BUILDER_COMPRESSION_LEVEL='5'; node node_modules/electron-builder/cli.js --prepackaged .release/win-unpacked --win nsis --x64 --config electron-builder.cjs`，exit0。实际安装包360,192,705字节，SHA256 `8d90ab202943122d46de4eec25cdd78c8553e00dfc9968b78b09f4e6d9644310`；Authenticode=NotSigned。
- 安装验收：`& scripts/release/test-nsis-install.ps1`，exit0；安装到本worktree独立中文目录，安装后的程序再通过相同5组/2启动/0renderer错误验证。安装exit0、smoke exit0、卸载exit0、主EXE已移除。报告`test-results/goal/kb-s0/install-1792808580561/report.json`和同目录`installed-smoke.log`。
- 实际卸载后再次只读SQLite：两次探针各5份ready资料、伪running任务均0，资料数据库仍在；只清理已验证仅剩uninstaller的自有安装探针目录，没有删除资料根。完整盘点：`test-results/goal/kb-s0/release-inventory.json`。
- 完整教育suite：`OMNI_EDU_TEST_BUILD_ROOT=…/education-final-build npm run test:education-capabilities`最终前258项通过后因旧历史PNG fixture缺失中止，报告`…/Temp/omni-edu-education-boundary-aXSJFn/report.json`，日志`education-complete.log`。已将该注入OCR事务测试改为自带PNG，且“文件改后恢复同字节”仍须拒绝旧文件版本。`node scripts/release/education-tail-boundaries.mjs`后段8模块100项通过（`education-tail-verified.log`、`…/Temp/omni-edu-education-tail-n8HP0x/report.json`）。这是分段覆盖，不宣称一次完整suite exit0。
- 全部新增产品证据来自上述固定包/模型与明确合成样本；通用electron-smoke的旧DeepTutor失败仍未定位，整产品发布门禁未通过。
<!-- final-kb-gates:end -->

### 独立批判审查与测试修正

用户要求的独立只读AI审查提出4项P2：图片OCR未核对语义遗漏、校验不受并发/总超时约束、staging旧文件残留、smoke对ESM spawn观测错误。四项均修复并由原审查者复核；源码复核不替代真实EXE测试。详情见`docs/research/KNOWLEDGE_BASE_CRITICAL_REVIEW_2026_10_24.md`。

教育suite先后暴露测试隔离/fixture问题：测试状态放在受保护.codex内、假host缺collections、新用例改变全库题数而下个用例仍写死1、冷启动直接SymPy测试6秒过短、Windows CRLF改变原许可证hash、复制worker-host的故障fixture遗漏新runtime-command依赖。均按实际原因修正；超时检查对齐现宿主15秒预算，数学断言未放宽。一次并行重打包清理out影响suite，最终改为独立不可变build快照。所有失败日志保留，不能把中途passed数量称整套通过。

packaged探针也修正了测试问题：Playwright evaluate不能直接dynamic import，改用应用createRequire；异步IPC条件改在Node侧轮询并显式断言结果，避免waitForFunction把Promise当truthy。早期失败报告不作为用户导入成功证据。

### 未完成边界与下一位置

- 本机Windows空PATH隔离成立；不是干净Windows VM、网络断开实测或已签名发布。当前asar=false，实际包体/文件数如上；最终签名、图标、升级/卸载、性能与包体优化仍需发行验收。
- 使用合成打印文字图片和一页扫描PDF，未证明自然试卷/复杂公式/手写字/混合或长PDF质量。BMP、旧DOC等不冒称支持闭环。
- OCR仍逐请求全量hash，保留严格旧策略；会话缓存或受控常驻worker的性能/篡改门禁尚未实现。
- S1目录持久批次与相对路径、S2其余完整解析、S3自动切题/题答配对、S4全库FTS、S5真embedding/重排、S6本地/云端每批授权AI、S7 40GB/百万chunk/备份升级尚未实现。Lance探针不是语义检索完成。
- 产品选择仍按用户授权：AI自动定稿入库、正式组卷集中确认；本地/云端并存，云端每批授权必要页/裁剪图。当前代码尚未新增这两条业务写入/上传路径。
- 下一实施切片：S1，先追加交付合同，贯通目录批次/文件状态/幂等对象归档/typed IPC/进度与重启恢复。保持当前资料原入口，继续后续依赖顺序。

## 2026-10-24 批判修正 / S3-A 当前源码证据

- 工作目录：C:/Users/ZhouXuan/.codex/worktrees/beca/EduProject。无新依赖、模型调用、资料上传、提交或push；旧NSIS未重打，不代表新版本发行。
- 独立kb_critic两轮复现：父题小问、超长隔离与晋升、Office/PDF丢图、Pi坏源补候选及摘要问题；最后7→1→2全部archiveEligible=false，本片源码范围无遗留P1，不扩大为完整方案审查通过。
- npm run build：exit0，apps/desktop/test-results/goal/kb-critical-s3-build-final.log。最终out/main/index.js核对包含hierarchyUncertain、sourceRisks硬守卫、materialSnippet最新实现。
- npm run test:renderer-components：217/217，exit0，apps/desktop/test-results/goal/kb-critical-s3-components-final.log。
- node scripts/education/kb-critical-archive-boundaries.mjs：12组，exit0，无skipped，apps/desktop/test-results/goal/kb-critical-s3-boundaries.log。覆盖括号/普通数字小问、教材误抽、答案册分离、Office丢图、超长单题隔离、事实版本、严格编辑、异步CAS、真实摘要、永久风险、Pi补候选与模型结果剥离原件ID。
- node scripts/education/kb-critical-archive-journey.mjs：最终6项/2次启动/0rendererErrors，exit0，apps/desktop/test-results/goal/kb-critical-s3-journey-final.log。独立合成目录（2份文本+52MiB超限PDF）；自动抽3题，教材列表0题，重复导入3份原件全复用且无重复题；真实来源跳转/补解析/风险核对不绕过；原组卷UI取2完整题、排除缺图题，整卷确认后冷重启读回。
- 最终实例：C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-kb-critical-viEe14/report.json；paper-confirmed.png。SQLite和teacher_resources目录readback均3份资料，material_question_members 3条，补正保留teacher来源及archive风险。
- 首次迭代实例HMpQqK通过5项，最终viEe14增加“勾选不晋升缺图题”并用最终构建重跑；不将中间结果充当最终构建证据。1366×768实际路径可操作；不宣称真实教师数据或复杂图文质量达标。
- git diff --check：exit0；仅既有LF/CRLF提示，无whitespace错误。未重复旧通用smoke/安装包；完整自然资料、provider、Recall@K、长混合PDF与几十GB仍未验证/未完成。

补充同一最终数据的只读界面读回：editor-readback.json、question-editor-1366.png、question-editor-1920.png，1366×768与1920×1080编辑保存控件均可滚动到达、未越视口；仅打开/取消前退出，没有新增业务写入。命令脚本与结果见apps/desktop/test-results/goal/kb-critical-s3-editor-readback.log（exit0）。最终实际Electron共4次启动，其中6项业务路径跨2启动，另2次为两种视口只读界面检查，末次包含样式修正。

界面读图后修正了新表单复选框被全局输入样式拉大的问题（限定question-archive.css）。仅样式修正后npx electron-vite build exit0，kb-critical-s3-style-build.log；最后editor-readback-final.json和kb-critical-s3-editor-readback-final.log验证两种视口保存可达、复选框16×16，截图已更新。业务逻辑/协议与此前通过的最终build一致，无重复全套。仓库正常git diff --check exit0（kb-critical-s3-diff-check.log）。一次临时用core.autocrlf=false检查使既有CRLF被当尾随空白，未据此重写文件；恢复仓库正常配置后通过。

## S2-B：长PDF按页恢复、覆盖与来源（2026-10-24）

- 当前分支codex/knowledge-base-delivery，HEAD仍d3e2dec；未提交/合并/push，保留协作工作。用户要求全部功能完成后合并main并处理冲突，尚未执行。
- 新固定runtime：646文件/279039929字节，worker.py SHA与pdf_stream.py SHA分别锁定。Python3.12.14/PyInstaller6.22.3/RapidOCR3.9.2/ORT1.30.0/PDFium5.14.0原环境，不新增模型或依赖，旧resume-v2留回滚。冻结构建命令（apps/desktop）：OMNI_EDU_BUILD_PYTHON指定已批准构建解释器后 node scripts/release/build-pdf-runtime.mjs；最终日志kb-pdf-runtime-build-locked.log，exit0；当前模块源码SHA精确匹配manifest。
- npm run build exit0：test-results/goal/kb-pdf-delivery-build.log；后续UI/小范围SQL修正后npx electron-vite build exit0：kb-pdf-preview-ui-build.log；最终npx tsc --noEmit exit0：kb-pdf-typecheck-final.log。npm run test:renderer-components最终217/217，kb-pdf-components-final.log。
- node scripts/education/kb-pdf-worker-probe.mjs <明确合成PDF>：真实新冻结exe，原生1/扫描混合2/空白3/超限4/末61，页状态正确，finished时原件r+打开被拒，released后结束；kb-pdf-worker-frozen-probe.log，exit0。早期source探针发现Windowsctime差异已修；不将source Python探针冒充冻结证据。
- node scripts/education/kb-pdf-publication-boundaries.mjs：4组，exit0，kb-pdf-publication-boundaries.log。实际源类+SQLite、受控transport，仅证明问题页隔离/显式重试/异步guard和COMMIT前取消回滚；真实worker另测，不冒充自然OCR质量。原生覆盖函数5个定向条件见kb-pdf-native-coverage.log。
- node scripts/education/kb-pdf-file-journey.mjs <明确合成PDF>：5项/2次Electron启动/0rendererErrors，kb-pdf-file-journey.log，exit0。实例C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-longpdf-nsLP8M/report.json。61页56272644字节，含原生文本、页眉+扫描图、空白和超限图像；大体积含合法未引用padding，用于证实文件I/O路径，不是40GB自然数据质量样本。停止/冷恢复成功页attempt不增加；59complete/1blank/1failed/0pending，partial正文1644453字符，末页FTS/原页/layout可达，问题页重试不重做good页。
- node scripts/education/kb-pdf-preview-readback.mjs <nsLP8M>：3项，kb-pdf-preview-readback.log，exit0；已打开预览跟随新来源61页、直接跳3/61、无效页保留当前图并报错、1366×768与1920×1080控件可达。对应preview-readback.json及page61-preview-1366.png/page61-preview-1920.png已读图确认。
- node scripts/education/kb-pdf-legacy-migration.mjs <viEe14>：3项，kb-pdf-legacy-migration.log，exit0；原S3测试库SQLite在线backup副本，仅为fixture迁移重定位合成managed paths，非生产备份恢复验收。原3题事实逐字段/JSON保持、既有确认卷sourceCurrent有效、旧PDF未被静默重新解析。实例C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-kb-legacy-WN421N/report.json。
- git diff --check exit0；无skipped。本轮未重复旧通用全套/NSIS，不宣称新安装包、16GiB/10000页极限、真实provider或自然数学质量、几十GB性能已通过。完整目标仍active。


## S6-A 可选AI双阶段整理 — 2026-10-24

状态：本片流程限定通过，完整Goal仍active。代码在codex/knowledge-base-delivery，未提交/合并/push；D:日常窗口及旧安装包未更新。

教师入口：资料库→选择资料→AI深度整理（可选）。独立加密Qwen配置，页/正文段范围和调用次数，公开无个人信息与逐批发送两项确认；题本保留AI双稿来源，完整文字题入现有组卷，复杂图题保持待整理。

新增material_ai_batches/material_ai_units/material_ai_members与app_settings独立键；question-archive.v2兼容v1，没有第二题库、第二Agent或新依赖。原件、源块、配置revision、lease/派发时刻及取消共同守卫。未知网络响应/死进程/过期请求不自动重发；初稿逐字段脱敏后再复核，正式入库与成员/状态事务一致。

### 最终必要门禁与实际证据

工作目录均为本checkout/apps/desktop。

| 命令/实例 | 真实结果 | 日志 |
| --- | --- | --- |
| npm run build | exit0；当前最终main SHA256 c88061d5039dbe7d72dc186f225abfcbbd820a72d190eddae1bfecf3c49b6ec8 | test-results/goal/kb-ai-batch-build-final.log |
| npx tsc --noEmit | exit0 | test-results/goal/kb-ai-batch-typecheck.log |
| npm run test:renderer-components | 217/217；新界面另外走下列实际Electron路径 | test-results/goal/kb-ai-batch-components.log |
| node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs | 16组，0失败；真实仓库类/SQLite/Pi工具代码，受控codec、model和store桥 | test-results/goal/kb-ai-batch-boundaries.log |
| node scripts/education/kb-ai-batch-journey.mjs | 6项/2启动/0renderer错误；实际Electron、Windows safeStorage、同题本/组卷、暂停/重启、真实冻结PDF页准备；模型HTTP受控 | test-results/goal/kb-ai-batch-journey.log |
| 最终编译产物冷读现有J0BNAw（PowerShell Node module内联启动） | 3项：六道AI题、已确认整卷带源核验、0模型请求 | test-results/goal/kb-ai-batch-final-readback.log |
| git diff --check（repo根） | exit0 | test-results/goal/kb-ai-batch-diff-check.log |

Electron最终实例：C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-ai-batch-J0BNAw（report.json/两尺寸截图/资料/独立profile和data）。第一批3道AI题，2道文字题ai_final、1道缺图题不可组卷；第二批在复核等待时停止，unknown状态冷启动保留，明确同意重复计费后仅重发复核阶段，累计3次预留。重启保留6道AI题和已确认10分卷。另自建单页有效PDF通过真实冻结worker/native/OCR与原页PNG准备，同一必要PNG供两次受控分析，结果不冒充真实AI识别。

独立批判复验：模型两次no_questions/部分漏题触发题号覆盖review；普通保存不能清除cross_page/incomplete_question；12批通过10+2分页仍可操作。独立调用实际MaterialQuestionArchive.edit确认无效保存不晋升。无本片新增未解决P1，此结论仅限已审范围。

已修实际失败：分页JSX少闭合导致一次构建失败；新AI面板与原预览同key，两个先期Electron实例m6OMzL/TvcJoP发生重复DOM严格定位失败，现ai-独立key且真实刷新后单面板通过。初稿改为逐字段脱敏后重新序列化，新增隐私/过期租约专项后最终build/typecheck/冷读通过，未再次跑无关全套。

### 未验证/未交付

真实付费Qwen调用和自然教师题答正确率未验证，测试HTTP拦截不代表真实provider质量。受管本地AI视觉模型包未提供，当前本地OCR不是本地深度整理模型。DOCX内嵌图/OMML、跨页/答案册配对、复杂图题完整表示、语义召回、40GB压力/并发与最终新NSIS安装仍OPEN。没有承诺原题AI答案一定正确。

Git只读核实：git ls-remote origin refs/heads/main refs/heads/master 返回main=b5a7fc685070e95f4110b1b98a8304a63d71fb7d、master=d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63。本地main同SHA。完整功能完成后再获取当时最新main、解决协作冲突并合并；不把本次只读核实写成已合并。

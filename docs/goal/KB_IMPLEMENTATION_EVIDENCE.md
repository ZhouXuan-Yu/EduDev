# 知识库实施证据

## 2026-10-31 独立图片补救与真实素材闭环

源码2c0262b，整合537c3dd为bfd754c；独立PNG/JPEG/WebP在实际OCR空白/失败时沿现两遍原页执行器恢复，不再直接local_parse_failed。复用RapidOCR、SQLite/文件、FTS/Lance/ONNX和Pi，无新依赖、模型、服务或IPC。图片来源独立schema，当前回执/历史增量保存并受版本/解析lease保护；重试保留原回执，父资料删除同时清理。只有显式includeImage的教师页读取返回核对输入图，后台/Pi不带Base64。题型只归一已知标签的等价分隔符，题干/答案/解析/投影用NFC，拒绝上下标被NFKC抹平。

bfd754c同一合并构建：build/type、240组件、15专项（含真实响应只读复读）+22页检查合并Node16/16且0skip，目标两模块100%行/89.89%分支/100%函数（旧image模块分支78.05%，新OCR模块全100%）；28批次/17检索/13归档/15图片文件/7目录、协作E06源码11项通过。正式图片6项ONtWNB、PDF回归6项wURQEA、真实素材3项qVnqCD均exit0/0renderer，实际ONNX/Lance/Pi/来源及冷启通过；同一构建最终207/207综合与shell exit0。综合走显式legacy-test，不冒充全Pi/教师验收。精确命令、私有回执位置、失败与构建指纹见research/KB_INDEPENDENT_IMAGE_20261031.json。

此前已授权同一页PNG递归子目录实测，本轮4次真实DeepSeek HTTP200（两个独立授权批次各2次），未发送其他素材；最终4题中3题AI定稿、1图题待核，1857B原OCR/两遍响应/1.5与2.8及0.5条件保留，题本开正文/核对输入图，1920冷启0追加付费。首轮题1仅题型分隔符变化误挂待核，同一原始响应只读复读已证修复；最终付费响应不同，不当严格A/B。

性能仅小样本：最终图片4资料首查193ms/重排143ms，PDF95/68ms；前轮图片OCR空白为0次AI、0还原结果，不能据此宣称40GB/P95/自然正确率或零错误。图题待核仍会使混合页AI正文暂不全文索引（3个合格题和原OCR仍可用），后续须分离正文完整性与题目图义风险；AI正文教师补正、跨页/答案册、40GB/低内存并发、旧inline迁移和受管安装继续。252集中验收与完整Goal不因此提高，保持active。audit45（8高29中8低/0严重，exit1），未改依赖。D盘日常构建和安装包未更新。

回退OMNI_EDU_AI_PAGE_RESTORATION=0停止新页处理，保留新图片来源读器、OCR当前/历史回执与输入文件，不追改旧已入库待核状态或删除原件/教师事实。保留协作E06完整记录，后续主线整合回执另记。

## 2026-10-31 M04/M10重排预热与内存滞回

**结果与范围**：源码10e6f10，b261770 RED证明虚拟90秒教师停顿后真实EXE重复校验/启动；407323e RED证明实际约862MiB工作集模型在1.5GiB可用内存仍被预热；824c442 RED证明close后仍等卡住回调。现只改reranker-client.ts、reranker-runtime.ts与vector-worker.ts三个生产文件，原BGE/ONNX实例、20候选/2窗口/分数、现FTS/Lance/Pi和资料来源权限保持；无新依赖、模型包、IPC、表或业务迁移。旧来源竞态夹具改为真正teacher_edited+sourceChecked并新增变更前命中断言，保留全部失效断言和生产核验规则。

**生命周期**：ensure/apply/applyMany成功回包后安全异步准备，后台失败不回第二份错误或停向量服务；原完整校验/ready在查询与准备间共享，不多开模型。不少于2GiB可用内存才预热；空闲低于1GiB释放，每30秒检查、最多10分钟。后台失败只冷却自动准备60秒，明确查询仍走原有界路径。15秒准备预算、关闭和超时中止校验；独立可取消等待防止不协作回调迟到启动。仍逐次读取/复验当前资料来源，模型复用不提升权限。

**实机结果**：最终10e6f10同一成功构建、未改的kb-restored-text-journey.mjs，3PaftH六项exit0：真实目录/OCR183B后故障清空、两遍受控AI、SQLite图片Base64为0/文件252475B、普通教材零假题、FTS与真实本地ONNX/Lance、Pi实际search/read及可见来源原图、1366/1920冷启0重发/0renderer。2受控JSON/3受控SSE，0付费/0用户素材上传。首次实际查询170ms/重排116ms；前轮9uqSXR同一四资料流程4815/4704ms，文件缓存/系统负载未控制，不是严格A/B、全Pi时延或40GB/P95结论。

**准备和内存代价**：独立真实EXE检查冷调用1929ms、后台prepare1757ms、随后不同ID的非结果缓存查询27ms；原推理约31ms。模型空闲工作集905392128B约863MiB，不含完整应用、OCR/embedding及峰值。预热是提前支付启动成本，不减少模型计算或完整组件核验；低内存/长闲置后的冷路径仍存在。不能据170ms单点称全目标高性能完成。

**验证**（apps/desktop）：npm.cmd run build（最终kb-reranker-warm-delivery-build.exit=0）；npm.cmd run test:renderer-components（240/240、exit0）；node --experimental-transform-types --test --test-concurrency=1 --experimental-test-coverage --test-coverage-include=**/reranker-client.ts --test-coverage-include=**/reranker-runtime.ts scripts/education/kb-reranker-lifecycle.mjs scripts/education/kb-reranker-frozen.mjs scripts/education/kb-reranker-runtime-boundaries.mjs scripts/education/kb-reranker-cancel.mjs（4 Node套件exit0，15生命周期+5固定模型/16预冻结合成案例+4真实组件+1立即退出=25检查）；node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-reranker-boundaries.mjs（8/exit0）；node scripts/education/kb-restored-text-journey.mjs（6/exit0）。两目标模块合计100%行/81.10%分支/83.33%函数；client单文件分支79.09%、runtime94.12%，不是全仓库覆盖。冻结合成验证nDCG3 .831127→.868930、最佳top1 10→11/16，是既有模型对既有向量基线，不是本片换模型提升。同一最终10e6f10成功构建运行node scripts/electron-smoke.mjs，207/207且最终shell exit0（test-results/kb-reranker-warm-final-smoke.log/.exit）；之后仅文档变化，未并发重建out。旧讲义间歇失败本次未复现，根因不标已修复。

**失败与边界保留**：旧来源竞态夹具一开始已被当前核题政策排除（断言期望source_changed但实际空原因），修正夹具资格后8项通过，未放宽生产规则。首版Promise自引用触发TS2454导致build exit2，修正后再完整构建；取消脚本静态导入在注册器前解析导致前置失败，改动态导入后才取得真正RED。精确日志/exit、构建SHA和[公开元数据](../research/KB_RERANKER_WARM_20261031.json)保留。npm.cmd audit --json exit1仍45项（8高29中8低0严重），无依赖锁变化，不称通过。

**回退与下一步**：通过普通Git审阅回退本片三个生产生命周期文件，保留修正后的夹具和上轮file.v1读器；无业务格式变化，不删资料/索引/回执。D盘日常构建和安装包未更新。下一优先真实授权素材/独立图片与自然题目质量、老师修正文稿、低内存/并发及重排内存优化，再10GB→40GB长跑、Recall/P95/受管安装；旧inline迁移、跨页/复杂图题/答案册及旧讲义间歇失败根因继续。完整Goal active，252项集中验收状态不因窄切片增加。

## 2026-10-31 M01/M03/M04/M10/M11原页输入文件化

**结果与范围**：生产源码29b4d07；6b03aa0 RED→ec589d2 GREEN证明实际目录新图不再写SQLite Base64，b80285e RED→29b4d07 GREEN证明Windows EBUSY临时清理占用可以重试。新增assets/material-ai-image-files.ts，窄接material-ai-repository/page-evidence、检索Host和db两构造点，复用原文件FD/规范路径/链接/全哈希证明、Windows独占锁、SQLite writer、备份。无新增依赖、IPC、模型或第二业务真源。新file.v1保存到dataRoot/material-ai-images/v1/<SHA前两位>/<SHA>.bin，SQLite只留摘要/MIME/字节数/版本，旧inline.v1增量兼容不强迁。

**实际容量对照**：只读RED库QGSMwz及最终库9uqSXR，图片SHA均4a760d1970c9cb678d7c0e74577cfb1d09a97dc4271ccc4ae222a3114620f183；输入原始252475B不变，SQLite Base64由336636B变0，新本地证据252475B。同图多单元引用不重写文件；这里只比较图像载荷位置，不冒充整库物理缩小、旧库VACUUM或40GB实证。

**一致性与失败恢复**：短暂pending先登记再写/sync/rename，文件准备在业务事务外；持锁到guard/引用提交与清理。每次LIMIT8恢复且实际EXPLAIN使用ready部分索引，引用检查走SHA部分索引；未引用孤儿可清，已提交图不删。临时共享/IO错误保留due，非法路径/链接才隔离。15组实际SQLite+文件检查涵盖旧库重复迁移、同SHA去重、同大小同mtime篡改、缺root/未知版本/混填、硬链接/父junction、打开后路径替换、提交回滚/准备后取消/并发独占、提交后中断、临时占用恢复、磁盘不足/超限、有界坏日志隔离与现备份复制。备份实际VACUUM INTO副本重开，按同一读器验证原字节；不是完整UI/40GB恢复验收。新模块覆盖100%行/82.98%分支/100%函数，不声称全仓库覆盖。

**最终实际Electron**：教材9uqSXR六项exit0：目录导入→真实本地OCR183B后故障置空→两遍受控原图→0假题/0原OCR块→新文件SHA与SQLite0B→可见全文/同义查询→生产Pi实读及原图引用→两视口冷启0模型重放；2受控JSON/3受控SSE。双页MjMyry七项exit0：54589246B物理有效PDF含52MiB夹具载荷，真实OCR各139B后注入空白/乱码，等待发布期间0请求/0假失败；发表后4受控请求/2AI题，题本原文/原图、实际ONNX/Lance语义召回2题、1366/1920冷启0重发。两轮0renderer错误/0付费，原OCR/文件哈希保持。测试HTTP受控且大文件有人工夹具载荷，不是自然内容质量或规模验收。

**精确命令**（apps/desktop，退出码均0）：npm.cmd run build；npm.cmd run test:renderer-components（240）；node --experimental-transform-types --test --experimental-test-coverage --test-coverage-include=**/material-ai-image-files.ts scripts/education/kb-ai-image-files-boundaries.mjs（15）；node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/{kb-ai-page-boundaries,kb-ai-batch-boundaries,kb-retrieval-boundaries,kb-critical-archive-boundaries}.mjs分别执行（20/28/17/13）；node scripts/education/kb-restored-text-journey.mjs（6）；node scripts/education/kb-folder-pdf-publication-journey.mjs --restore-ocr（7）。同一最终29b4d07成功构建运行node scripts/electron-smoke.mjs，207/207且最终shell exit0（test-results/kb-image-files-final-smoke.log/.exit），未并发重建out；讲义旧间歇失败本次未复现，根因不据此标已修复。后续仅补文档。具体exit文件、构建哈希、综合终态见[公开元数据](../research/KB_AI_IMAGE_FILES_20261031.json)。

**性能与未完成项**：固定native探针冷调用4348ms，文件证明2882.5ms、4候选推理62ms；热文件缓存证明369.9ms，组件399017988B逐次完整核验。本片未改生产重排，冷热差不能当优化A/B；最终教材查询4815ms/其中重排4704ms仍OPEN。10GB→40GB、100k/1M块、自然Recall/P95/图题公式答案、老师编辑教材正文、独立图片失败、受管安装继续；旧inline记录未搬迁，D盘日常构建/安装包未更新。旧讲义description间歇断言根因仍未知，绿灯不构成修复证据。npm audit --json exit1：当前45项（8高29中8低0严重），锁文件/依赖未改，不能沿用上一轮23或称审计通过。

**回退**：OMNI_EDU_AI_IMAGE_FILES=0停新file.v1写入，必须保留新格式读器、本地证据与pending恢复；旧inline继续读取。已发表新图后不可直接降级旧读器/删除证据，不执行强搬迁、批量VACUUM或用户资料删除。完整Goal保持active，集中252项不因窄切片提高。

## 2026-10-31 M04/M10活动工具完整核验IO

源码5b4343b，714edcc已整合origin/main4d1f3ce并保留协作者E05。CPU采样证实原managed-skills.noLinks/readPackage及运行时checkFiles的同步重复核验占主线程，SQLite回调耗时不能当原生SQL执行耗时。改独立skill-package-async.ts、managed-skills.ts、managed-skill-runtime.ts及Pi阶段取消窄接线；原同步空闲变更入口保留，暂无新依赖、表、协议、IPC或安装组件。原权限、来源哈希、模型缓存、逐级链接检查均保留；每文件前后各做一次完整realpath，去除重复前缀解析及完整包证明已覆盖的重读。

RED/GREEN提交：6c02f44→10cf03c（主循环可前进）、1f59c06→236ef22（缺失路径保留source_changed语义）、50391c1→5b4343b（规范路径工作有界、父目录链接仍拒绝）。十组IO边界实际SQLite/目录/native Pi验证涵盖同大小同mtime篡改、不发送二进制、模型缓存、取消、打开后换路径及大小/链接；22组原权限专项仍通过。完整覆盖率未测量，不据通过数声称百分比覆盖。

正式Electron私有CPU/IO探针沿原kb-restored-text-journey执行，T2NRe7五项exit0/0renderer错误：可见目录授权、真实OCR183B后故障边界置空、两遍受控原图整理、实际FTS5/本地ONNX/Lance、生产Pi真实search/read/引用打开原页、1366/1920及冷启0重发/0假题/0原OCR块。每轮2受控JSON/3受控SSE，0付费；不是自然识别质量。只记录方法、时间、表名和栈名的诊断留ignored本机，公开元数据见[本轮JSON](../research/KB_TOOL_IO_20261031.json)。

同探针流程观测（4资料/4重排候选，非严格A/B；最后一轮已合并E05）：

|阶段|修改前iJwl1f|异步但未减路径zRWhjx|最终T2NRe7|
|---|---:|---:|---:|
|实际资料搜索工具|11449ms|11631ms|664ms|
|实际资料正文读取工具|7436ms|4498ms|464ms|
|首次语义查询|3079ms|2883ms|4335ms|
|其中本地重排|2838ms|2826ms|4308ms|

最终两工具区间未观测到>40ms主循环间隙（100ms采样）；全旅程仍有6次，其中启动最大1951ms，不能声称整个主线程无阻塞。早轮观测最多记录100次，SQL方法耗时可能嵌套/重叠，不能相加当墙钟。当前只证明具体重复工作减少及小样本改善，不证明P95/自然Recall/40GB或重排提速。

最终命令在apps/desktop：npm run build、npx tsc --noEmit、npm run test:renderer-components（240）、node scripts/xiaozhi-agent/pi-skill-runtime-io-smoke.mjs（10）、node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs（22）、node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs（20）与私有探针五项均exit0。node scripts/xiaozhi-agent/pi-skills-management-state-smoke.mjs已过23项，但test-results/xiaozhi-agent/pi-control-ui-2AWPBO旧夹具不存在导致整体exit1；旧数据库部分未执行，未伪造降级数据。npm audit --json exit1：既有23项（8高/7中/8低/0严重），无本片新增依赖。

同一最终5b4343b成功构建后运行node scripts/electron-smoke.mjs，综合207/207、最终shell exit0（test-results/kb-tool-io-final-smoke.log/.exit）；未再并发重建同一out。此次讲义修订描述的既有间歇失败未复现，根因仍未确定，不把绿灯当修复原因。源码未再变化，仅补交付文档/公开元数据；D盘日常构建与安装包未更新。

授权素材目录本轮仅查元数据：9文件10321505B（3PDF/5PNG/1JPG），未发送；不能以小素材替代10GB→40GB。下一继续真实重排/向量调度、图片SQLite体积、启动核验、独立图片失败、跨页/复杂图题/答案册、教材正文人工修正及受管安装。自然内容绝不出错不在本轮证据范围。回滚采用普通revert本轮实现提交，既有同步入口保留且没有业务格式迁移，不删原资料/教师事实。

## 2026-10-30 最后主线整合42ac7be

最后刷新main83cf832（受管版本/FIFO计算），合并为42ac7be；13份Markdown同位置新增节冲突已逐项保留双方内容，preload自动合并已核对。该源码重新build/type、240组件、20页边界、目录→Pi来源→冷启五项均exit0（iLCx7P，原OCR183B、两视口、0renderer错误、每次2受控JSON/3受控SSE、0付费）。新小样本4资料、重排3候选，查询3918ms/重排3349ms，不能与4候选旧样本当提速A/B。207综合exit0仍明确属于fc2fd0d；未冒充最后这次无关受管版本合并后重跑。代码与新构建指纹见公开JSON latestIntegration。

### 本轮最终整合与夹具修正（2026-10-30）

最终源码fc2fd0d、夹具9b128e4：build/type、240组件、207/207综合、20组AI页/来源、17检索、13归档、28持久批次均通过。正式Electron目录五项最终GASk1N exit0，1366/1920、0renderer错误，真实OCR原回执183B后边界故意清空，受控JSON×2/SSE×3、0付费、0原OCR块/0假题、来源原图/冷启均通过。此前来源折叠点击失败和裁切PDF夹具保留；后者修正换行并加绘制边界，旧夹具不能作内容质量实证。整合主线E04保留；D盘日常构建与安装包未更新。

性能/质量仍OPEN：零习题原文检索从0命中变1；最终四份资料查询5860ms/重排5593ms，另轮2570/2393与5528/5496ms，不是同条件提速或Recall/P95。最终受控Pi请求间阶段约15.7s/8.9s；另轮原生来源接口冷读10.2/6.6/5.2ms且冷启整轮哈希保持，日志工具执行搜索5939ms/读取3664ms，须定位重排与工具包装/上下文开销。长文沿现11000字符重叠切片、512token窗口嵌入，无静默截尾；单次发现8/处理4、到期部分索引实证仍不等于40GB资源上界。40GB长跑/自然质量、独立图片失败、复杂图题/跨页/答案册、人工修正AI教材正文与受管安装均继续。AI图片入SQLite的重复体积及前后台向量调度仍需规模审核。本轮0真实付费（此前累计20），未上传素材。

精确终态：kb-restored-merged-build.exit、kb-restored-merged-pages.exit、kb-restored-merged-smoke.exit和kb-restored-fixture-final-journey.exit均为0。207综合发生在fc2fd0d生产源码，之后只有夹具修正，无生产代码变化，不重复全库测试。第一次npm run test:smoke也报告207/207，但宿主更新后进程句柄丢失，退出码未捕获；最终独立node scripts/electron-smoke.mjs已确认exit0。旧讲义失败仍保留。

冷启补查为同NRpnau语料、无模型请求：三次typed来源接口10.2/6.6/5.2ms，公共阅读轮次SHA保持a08c1aa5541442fe2a716d10ae21e34f8024f1804fb6622aa458da1477997e64，实际EXPLAIN走到期部分索引。NRpnau合成原图后来发现裁切，保留作协议/时延/迁移证据，不当内容质量证据；GASk1N是修正原图后的最终五项。公开JSON完整记录各范围。

## 2026-10-30 整页AI正文检索与小智实际阅读

普通教材页过去只保存在AI页回执、没有习题时也没有原OCR块，FTS/语义/Pi均不可见。现在将合格页从原回执派生到现同一FTS5与Lance事件队列，保留独立AI来源、原图、未经教师逐字核验标识。没有制造题目或OCR，也未增加工具、模型、依赖或Agent循环。

源码：6bf344a RED→5072464 GREEN；d767b3d批判性RED→64b2527 GREEN（旧待核解除、损坏缓存重建、长文/代理对分页、异步父私密状态变动撤回）；d553746到期部分索引/有限8页发现4页执行、正式Electron脚本。正常整合协作E04 main至fc2fd0d；保留双方Pi及preload改动。主要文件为main/retrieval/material-ai-text-index.ts、material-full-text.ts、material-source.ts/material-repository.ts/material-tools.ts、education/search-provider.ts、shared/material-ai-text.ts与MaterialAiPagePanel/MaterialBodyPanel/来源导航；typed preload与公共引用同时贯通。

已终结的命令与范围（工作目录apps/desktop，日志test-results/）：

- `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` exit0，20组，最终队列变更复验日志kb-restored-bounded-queue.log；原首轮RED/批判RED均保留。受控模型/图片，真实执行器与SQLite，不是自然识别。
- `node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs` 17、`kb-critical-archive-boundaries.mjs` 13、`kb-ai-batch-boundaries.mjs` 28，各exit0；日志kb-restored-{retrieval,archive,batch}-final.log。
- `node scripts/education/kb-restored-text-journey.mjs` 首次exit1：来源详情未展开，三项已通过但按钮不可见；Temp omni-restored-text-RBHbL4保留。修正真实UI展开及新会话等待后，exit0/5项，Temp omni-restored-text-QrcbJx，1366/1920和0renderer错误；真实本地OCR输出边界故意清空，原始本地识别回执1页124B仍在报告；两次受控页JSON及三次受控Pi SSE，零真实付费。真实固定本地ONNX/Lance四份资料语义检索、生产工具search→read→公共实际阅读来源登记→可点击原图、同库冷启无重发；原OCR块0/题目0/原件SHA保持。不是自然OCR失败、模型质量或40GB。
- 整合fc2fd0d后 `npx tsc --noEmit` 与 `npm run test:renderer-components` exit0/240；此前单分支build exit0。整合后构建、正式旅程与综合门禁的终态见本节后续记录。
- `npm audit --json` exit1：23项既有（8高/7中/8低/0critical），本功能无新依赖，合入E04仅已有间接依赖显式锁定为直接依赖。不能称审计通过。

可证变化：零习题页全文命中从0→1，现同义查询排名四份资料第一。最终QrcbJx一次查询2570ms/重排2393ms，另一轮8095ms/7245ms；非同条件性能A/B、非Recall/P95。受控Pi三次请求间阶段22143ms/11930ms，暴露工具链开销，须继续定位，不能宣称达到快速目标。派生有界队列与到期索引降低历史失败扫描风险，但没有真实40GB或峰值内存/磁盘实证。

仍OPEN：40GB递归混合格式稳定长跑与容量、自然OCR/公式/答案准确率及Recall/P95、独立图片完全OCR失败、复杂图题/跨页/答案册、Pi工具时延、受管安装与D盘日常启动。上一轮讲义description综合失败保留，不能用本专项替代207全通过。无素材上传。本轮付费调用0，历史真实累计20。

回退：`OMNI_EDU_AI_TEXT_INDEX=0`仅停新派生；原v1来源/v1–v5题档案/AI页读取继续。三张派生表与索引增量幂等，已有RAG重建从原始两遍回执恢复，不付费重发、覆盖OCR或删除教师事实。公开脱敏索引：`docs/research/KB_RESTORED_TEXT_20261030.json`。

## 2026-10-30 OCR空白/乱码PDF原页恢复与可见回看

质量补充51ab7fb RED→d021da6 GREEN：旧NFKC将x²/x2及y₁/y1折成一致，实际执行器反例被误判no_questions；现页稿、题干与原答案比对改为NFC，数学上下标差异保留待核，15组通过。其后9份既有专项全部重新exit0（另含联网补答12、原生Pi5）。

综合检查明确未全通过：第一次`npm run test:smoke`构建/type成功、执行器exit1于electron-smoke.mjs:994，120ms固定等待提前读教师校正状态；随后截图已显示已保存。脚本改等UI已校正且保存按钮恢复，SQLite断言不变。第二次`node scripts/electron-smoke.mjs`该点已通过，但exit1于:1313，讲义更新version=2而description仍旧值，原失败日志与两份截图保留。未查明该讲义保存失败的唯一原因，不称最终207通过，不用旧207结果覆盖；本轮不改无关讲义业务。最终NFC构建与已存v5升级读取结果见下文。

实现f64e753 RED→c52a520：page-response.v1输出整页pageText/pageIssues与逐题投影；v5来源绑定实际PDF原件版本/generation/页回执，无正文时不制造chunk。原图/首稿/终稿继续原账本，原OCR不覆盖；同题本/Pi读取、语义来源变更闭包与按需正文IPC接通。7ea6142 RED→403b18e修共享Worker忙被永久失败，未外发阶段2–30秒退避、其他到期任务继续、未知不重发。正常整合协作E03 main为bd8aa30，无冲突、保留协作者工作树。

实机RED e80f111：实际文件夹授权与两页发布/两遍处理均成功，但题本原页组件未挂载，30秒点击超时；原失败Temp omni-folder-pdf-publish-qQPtJq保留。GREEN eae90d6将原页来源接入现题本挂载条件。命令`node scripts/education/kb-folder-pdf-publication-journey.mjs --restore-ocr`最终exit0，Temp omni-folder-pdf-publish-LN9Gi3：6项通过，文件54,589,246B（双扫描页+52MiB嵌入随机夹具），真实本地OCR后在Worker输出边界故意变为空白/乱码，发布前0误发；发布后4受控HTTP/2AI题，原blank及乱码OCR保留，题本正文/真实原图可打开，冷启0请求、两视口/0renderer错误。不是自然OCR失败、真实模型或40GB。

另`node scripts/education/kb-real-page-prompt.mjs <原已授权样本根>` exit0，Temp omni-real-page-prompt-Q2mKpF，独立持久real-page-prompt-ledger.json严格2次，实际DeepSeek200/200（此知识库累计20次，不含协作任务）：已视觉复查的旧PDF第1页图片，故意乱码OCR→整页2072字节、4题、1.5/2.8/0.5保留，两遍pageText一致；第4题requires_image。私有原图/响应/凭证均未入Git。离线把实际首终稿送入生产页质量算法复读：前三题无新增issues，第4题requires_image/ai_mismatch/incomplete_question保留；这是算法复读，不冒充实际新来源发布或数学正确性。

最终代码专项（`node --experimental-transform-types scripts/education/<name>.mjs`）：kb-ai-page-boundaries15、kb-ai-batch-boundaries28、kb-folder-ai-boundaries7、kb-folder-pdf-publication-boundaries8、kb-source-origins-boundaries13、kb-critical-archive-boundaries13、kb-retrieval-boundaries17、kb-native-ledger-boundaries20，全部exit0。`npm run build`含typecheck exit0；`npm run test:renderer-components`240/240 exit0。最终完整综合未通过（两次exit1的原失败见本节首段），不宣称207通过。最终d021da6 `npm run build`含typecheck exit0；重建后的已存v5升级读取实机2项通过（1366/1920、2题/正文/原图、0模型调用/0renderer错误），证据final-nfc-readback.json保留于LN9Gi3。audit exit1为既有23项（0严重/8高/7中/8低），无依赖或lock变化。

性能与回滚：原空OCR为0调用误记无题/无法建立失败页任务，现每页两次受授权请求；真实新提示转录2×2072B，不测普遍耗时。正文只按需读（每页64KB/响应128KiB上限），批次轮询小标志，未新建全库正文JS扫描；实际单次main RSS发布前366,809,088B、结束284,729,344B只是采样，不是峰值/前后基准或40GB性能证明。停新页生产用OMNI_EDU_AI_PAGE_RESTORATION=0，已有v5继续读；新增表/列幂等，不删除原件/题目。普通整页全文索引、独立图片全失败、复杂图题/跨页/答案册、自然Recall/P95、40GB与最终安装仍OPEN；单目录busy后续就绪公平性、teacher暂停后父attention恢复需下一轮复现。D盘日常应用未更新。

## 2026-10-29 长PDF发布窗口、资源轮转与页前言纠错

最终整合补记：收尾刷新取得协作者思考档位main c0d2b40，正常合并为3ad4abe；12份冲突均为独立新增主题，双方保留，源码无冲突。合并版build/type、240组件、思考策略/SQLite7项与上述54.6MB PDF Electron4项再次通过，0renderer错误/2AI题/冷启0请求，报告Temp/omni-folder-pdf-publish-GTQ1Nr/report.json；main SHA256 24d42f48382be27dd01023f2ca8b89caba6d96179253e36ad93c8f9ecb404a36。日志test-results/kb-folder-pdf-merged-{build,components,journey}.log和kb-folder-pdf-thinking-final.log。思考源码专项初次普通Node静态TS引用无法解析deepseek-fetch，前置现register-source加载器后原7项通过，未改其源码。完整207证据仍对应合并思考前c045dd5，不冒充合并版完整重跑。此次补检无新付费调用；D盘和其他工作树不动，远端状态看最终Git回读。

批判发现并实际RED：99c5fac在真实SQLite/生产调度器中4项失败（processing误失败、complete staging未发布即创建永久review、前8等待文件饿死后续、旧未计费误判不恢复），真实failed/blank保留用例通过。a3e7b13改为等待job complete/partial和canonical资源可读后建子任务；material_folder_ai幂等增量plan_cursor INTEGER DEFAULT0，idx_folder_ai_plan/idx_folder_ai_local_retry两个派生部分索引，有界双范围每轮最多8资源并持久保存游标。旧误判仅同资源版本/已发布complete页/实际正文齐备、ai_batch_id空且无该目录任务幂等关联时恢复，事务内复验授权，最多8项；pending_local等待保留，暂停/变版本/真实失败/有子任务/已关联未知均不自动重发。共享协议、typed preload和正式卡片复用，原件/OCR/已有题/AI回执不改。

随后批判RED0e16eef实证预算耗尽后的第二次规划把budget_exhausted改paused；GREEN056a0db每次规划后复读父状态与活动单元，终态/暂停立即结束当前窗口。实际54MB双页又暴露默认3≠2：第一题被算入下一页的仅元数据前言，且前题物理/高一会被下一页数学/初二污染。REDb1cb0bf→GREENc045dd5只在明确不同原页、下一题前仅既有元数据/空白时结束前题；本页前言优先，实际跨页条件和同页跨块仍保留全部来源/风险。未放宽同源指纹或改条数断言、未重写旧archive。

实际命令（apps/desktop）：

```powershell
node --experimental-transform-types scripts/education/kb-folder-pdf-publication-boundaries.mjs
node --experimental-transform-types scripts/education/kb-question-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-pdf-publication-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-critical-archive-boundaries.mjs
node --experimental-transform-types scripts/education/kb-source-origins-boundaries.mjs
node scripts/education/kb-folder-pdf-publication-journey.mjs
npm run build
npm run test:renderer-components
npm run test:smoke
npm audit --json
git diff --check
```

最终调度8组、页抽题4组、既有PDF发布4/目录7/AI28/档案Pi13/同源13均通过。迁移重复运行/游标冷启保持/EXPLAIN确认idx_folder_ai_plan且无TEMP B-TREE，原8个等待文件阻塞第9文件已复现并修，不能将此限定排序开销/至多4轮夹具进展当整产品P95。旧目录夹具原无PDF state/page_number字段，按真实既有表补齐夹具后7组通过，未给产品放宽表/状态要求。

真实Electron使用54,589,246B有效PDF：两页中文栅格算术题由真实OCR Worker处理，另含52MiB不可压缩嵌入合成载荷，使文件物理超过原内存接口50MiB边界。正式UI目录授权，控制现有Worker输出的两个窗口：第2页processing和两页已staged但未publish，均等待3.2秒以上、0假失败单元/0模型请求；解除后4次受控模型HTTP→2AI题/题本默认2，原件SHA不变；原生冷启2题/原调用账本保持、0新请求，1366/1920、0renderer错误，4项通过。报告Temp/omni-folder-pdf-publish-GTBNBN/report.json。模型请求同时断言实际原页图片和OCR还原v1存在。主进程瞬时RSS在发布前319016960、结束303726592字节，非峰值、非全进程组或40GB结论；期间独立隔离综合smoke并行运行。

失败保留：初次Python缺fitz，改为现成PIL/pypdf，无安装依赖。Temp/omni-folder-pdf-publish-v29hW3模型替身按含空格算式匹配失误导致漏题，被原ai_omitted_questions拦截；修替身排版匹配后Temp/omni-folder-pdf-publish-NksTKj实际得2AI却题本3，进一步修产品页前言来源错误才获得最终4项通过。前两份报告/日志保留，未改失败断言为3，也未用受控结果证明自然模型数学正确。

最终生产源码c045dd5，npm run test:smoke所含build/type及完整207综合自然exit0、ok=true，日志test-results/kb-folder-pdf-smoke.log与.exit=0；该轮期间未改out，实际双页UI同一构建，main SHA256为635a9e898a6f72d19c54ef1124b325ef56894ce66f40fae79f14e51836169c25。240组件在a3e7b13通过（后续仅main逻辑/测试/文档）；最终综合也构建全类型。audit23（0critical/8high/7moderate/8low），依赖和锁文件未变。匿名指标见[PDF调度JSON](../research/KB_PDF_SCHEDULING_EVIDENCE_20261029.json)。未更新D盘日常运行，Git远端一致性另取收尾命令。

回滚先暂停目录AI再独立revert本片，保留plan_cursor/索引/已有回执和新题读取，不删除资料或重写原OCR；不能以回旧调度承诺旧缺陷已消失。完整Goal仍ACTIVE：空白/失败OCR页原图补救、整页AI正文阅读/索引、复杂图题/跨页答案册、实际40GB长时与独立自然召回/答案质量/P95、受管组件/最终EXE均未被本片证明。大于50MiB的单文件通过，TXT正文1MiB及Office内存限制仍待分别处置。

## 2026-10-29 最后主线整合与OCR提示词接线核对

正常合并main 0b3d277为b82da4c，保留协作者默认成果备份和停自动文件写；12份文档冲突均为不同主题新增段落，双方保留，源码自动合并后检查。b82da4c上build/type exit0、组件240/240、来源边界13组与AI批处理28组通过。新主线备份6项、交付整包/停写7项通过；受限沙箱最初备份目录链接创建EPERM（5项后失败）、整包首项失败均保留，按此前同类隔离本地专项权限重跑原命令通过，不修改断言或协作源码。报告Temp/xiaozhi-output-backup-w81gw4、xiaozhi-bundle-UMGqEh。构建与组件日志在apps/desktop/test-results/kb-source-origins-b82da4c-{build,components}.log。

同一最终构建的真实Electron目录闭环再过3项：本地OCR/原生Word、typed IPC/SQLite真实，模型HTTP受控，默认3/原始6/教师收藏后4/未知单元冷启5与0重发保持；1366/1920、0renderer错误，Temp/omni-folder-ai-ui-9egrkY/report.json。此次补检没有新增付费模型请求，未重跑整套207综合、真实历史回放或40GB，早期证据各保留原源码范围。

用户补充“无法理解的OCR交给DeepSeek还原”：实际provider中的OCR_RESTORATION_INSTRUCTION（[OCR还原规则 v1]）已接入上述图片/普通文本/Word角色图稿及首稿、复核稿。28组内直接拦截实际provider请求，验证6个请求均携带还原规则与未改写的原始OCR，且只包含当前一种响应schema；不是只在文档写提示词。规则要求先忠实恢复版面/公式/否定词/单位/选项/小问，原图优先，无图或不清不能猜补，题面与解题分开，补答标ai_generated，无法确认保留issues；质量门不因两遍一致放宽。正文、原图和回执仍分别留存。空白/失败OCR页和整页普通内容入阅读/检索仍属后续缺口，不由提示词替代通路实现。

## 2026-10-29 同源原始候选与AI稿：默认3题、原始6条均保留

生产构建实测三格式目录在AI完成后题本仍6条，而非3道题，RED2401459保留。新增可重建material_question_origins与source-question.v1：同原件/版本、完整正文来源（offset/chunk/bodyVersion）、题号和确定性原始题面指纹，分别记录rule/ai；AI须已通过原质量条件，原生Word角色来源无歧义且原文精确对应。不能据题号或相似度归并；匹配不了、多条规则同指纹、复杂或跨块来源保持独立。不同AI稿不互相吞并。所有原题、OCR、首终稿和ID均不改。

新规则和AI发布同writer登记，先后顺序均可关联。covered是派生展示/计数，不授予新的读取/组卷权限；教师编辑/收藏/分类/使用会保护原记录，来源、隐私、Word表示、题目、回执及成员变更或删除会失效。相同元数据重写不误失效，原题删除不产生待核幽灵计数。历史每轮8条/900ms游标，旧AI先验真实回执/原件，写锁内再验；单坏历史题阻塞RED c62e9df已由7de10f8隔离，派生表重建重置游标。原始记录可经现typed notebook showSourceCandidates复读；严格布尔/描述符校验仍拒绝未知参数及getter。

修改域：assets/material-question-origins.ts、material-question-archive.ts、material-ai-repository.ts、material-ai-native.ts；db窄接线与ID读取；shared/contracts.ts、question-archive.ts；question-retrieval过滤边界；原QuestionNotebookWorkspace与MaterialQuestionStatus。沿现preload方法，不加通道、依赖、Agent或第二题库。ID读取取消先载入50题/分类，并将使用记录汇总限制到所读ID；无整产品P95前后声明。

实际命令（apps/desktop）：

```powershell
node --experimental-transform-types scripts/education/kb-source-origins-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-critical-archive-boundaries.mjs
node --experimental-transform-types scripts/education/kb-verification-migration.mjs
node scripts/education/kb-folder-ai-journey.mjs
node scripts/education/kb-origins-historical-journey.mjs <existing-authorized-isolated-root> --replay
npm run test:smoke
npm run test:renderer-components
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/xiaozhi-agent/delivery-bundle-smoke.mjs
npm run build
npm audit --json
```

最终来源边界13组通过，覆盖顺序/倒序、回执修改和删除、正文/隐私/源版本变更、相同值重写、教师保护、重复原题不覆盖、删除原题计数、过滤参数及坏历史隔离。原AI28与档案/Pi13保持。十万旧标记5项在100006行/70516736B合成库通过：100002回填、369ms、再次1ms/0更新、原JSON不改（Temp/omni-verification-migration-EGVP6o）；与前轮543ms并非受控性能对照，更不代表40GB。

三格式实际Electron（本地OCR/Word渲染/typed IPC/SQLite真实、模型HTTP受控）3项通过：默认3AI稿，勾选显示原始6记录；收藏原规则后独立显示4条、待核恢复1；加入另一个未知单元后原生冷启共5条、0额外请求。1366/1920与0renderer错误。整合版证据Temp/omni-folder-ai-ui-T0PrzM/report.json，较早首次GREEN rjHJP7也保留。

真实旧样本仅复读已授权的原OCR及实际DeepSeek回执，最终43e49b5构建上重置派生游标重放，通过2项：该页3道文字题关联、图题仍待核；默认47条/全部50条，原题/正文/资料全量事实哈希不改，原生重启结果一致，0模型请求。Temp/omni-real-material-NGRlNr/origins-history-report.json。真实知识库旧ledger16+前次目录页2，DB SUM(calls)=18仍一致，本轮新增0；原件、题干、回复、密钥和DB不进Git。不能以回放证明新模型自然正确率。

综合基线npm run test:smoke（288a065、后续锁内加固及整包合并前）自然exit0/ok=true/207，Temp/kb-source-origins-smoke.log及.exit=0；20:02:11结束，早于后一次out/main在20:03:34改写，未混用构建。此207不是最终合并版完整重跑。正常整合main b2d7f7d整包交付为cab14f5，源码无冲突，合并版240/240组件、整包交付6项及上述三格式3项通过；最终43e49b5类型/build exit0，工作区test-results/kb-source-origins-43e49b5-build.log，及真实回填2项通过。一次自动审批超时未启动最终构建，改为工作区内日志的受限构建成功，不是安全拒绝；未绕过禁止操作。协作专项最初普通Node命令未加载TS解析器，前置--import按现加载器执行成功，未改其源码。

audit真实23项（0critical/8high/7moderate/8low），无新依赖/锁文件。匿名指标[同源JSON](../research/KB_SOURCE_ORIGINS_EVIDENCE_20261029.json)。回滚停后台关联和默认隐藏，只清派生origin表可触发恢复待核标记，保留原事实/AI回执与原始记录入口；不需要改原件。未改D盘日常构建/协作者工作树，Git同步另以最终命令为准。

完整Goal继续。当前不是全量自动去重：复杂Word/跨块跨页/无法严格对应的来源和多AI版本继续显示。下一推进单文件大小门槛、空白/失败OCR页的原图AI与整页还原正文阅读/检索，再实际40GB持续混合导入/取消恢复、独立自然质量/Recall/P95、受管组件及最终EXE。不能把小夹具、合成迁移或此3/6切换称为企业级全产品验收。

## 2026-10-29 阻止规则收录绕过核验

批判复现：纯文本规则题fields齐全/issues空即被archiveEligible放行，题本据此声称可组卷；普通保存与联网补答案也可能清needs_attention。RED72e92cc保留真实反例，GREEN77063fc统一有来源无AI题的核验条件：rule_extracted或未sourceChecked不能用于默认Pi/可用语义/组卷，普通手工无archive题和现AI双阶段自动稿兼容，老师仍可在既有编辑入口明确核验或撤销。题目保留在题本，缺图、超长和来源完整性条件不放宽。

变更shared/question-archive.ts、main/assets/material-question-archive.ts、main/education/question-web-answer-repository.ts、renderer/QuestionArchiveEditor.tsx及product/MaterialQuestionStatus.tsx。现schema/IPC/preload/原件目录/AI回执不变，无新依赖或表。历史仅回填needs_attention可重建标记，按attention索引找未标记成员，原archive_json不改；新抽题/编辑/联网写回使用同一资格。底层补答用途读取仍明确usableForPaper=false，不因可补答授予正式组卷。

实际命令（apps/desktop）：

```powershell
node --experimental-transform-types scripts/education/kb-critical-archive-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/question-web-answer-boundaries.mjs
node --experimental-transform-types scripts/education/question-enrichment-read-boundaries.mjs
node --experimental-transform-types scripts/education/kb-verification-migration.mjs
node scripts/education/kb-critical-archive-journey.mjs
node scripts/education/kb-folder-ai-journey.mjs
npm run test:smoke
npm run test:renderer-components
npm audit --json
```

13档案/Pi、28AI、7目录、12联网写回及15补答读取边界通过；最终build/type与综合smoke207、ok=true、自然exit0，日志Temp/kb-verification-gate-smoke.log及.exit=0；最终renderer240/240、exit0，日志kb-verification-gate-final-components.log。目录三格式实际本地OCR/Word渲染/typed IPC/同库3AI自动稿、未知请求暂停冷启无重发2项通过，Temp/omni-folder-ai-ui-nC8S1O/report.json；模型HTTP受控，不冒充真实模型质量，本轮0新增真实DeepSeek请求。

实际SQLite旧库100006合成成员/70496256B，100002标待核（含普通保存与陈旧勾选规则态），迁移含索引543ms；再次0ms/0更新，全部10万原规则JSON保持一致，手工/已核/AI夹具原标记保留。Temp/omni-verification-migration-3N1ZGG/report.json。此前完整规则题可自动入候选，现在明确核验；没有真实教学Recall或全量P95前后比较，不以70.5MB合成旧库推导40GB。

首次构建发现抽题Input字段可选，改用已保存的完整题目计算，未放松类型。联网回归原先断言补齐即eligible，改为明确未核题仍不eligible，并保留原来源/缺失写回/冲突/取消断言；同步修写回计数。界面先前反复在重启后的隐藏重复工作区导航失败，独立同根DOM探针证实工作区切换，修测试为可见按钮正常滚动并等待目标页面；未force点击或改业务门禁。最终核验→撤销→检索→组卷确认→原生冷启完整8项exit0/0renderer错误（1366×768），报告Temp/omni-edu-kb-critical-byzN2P/report.json。失败报告保留Temp/omni-edu-kb-critical-PkzEZj、LUOy5Y、YpW4d6、NGFOiD，不将此前7项通过冒充整条通过；本片新增题本提示的1920独立路径未重跑，目录AI面板另有1920通过。

audit真实23项（0critical/8high/7moderate/8low），锁文件无变。精确匿名指标[核验JSON](../research/KB_VERIFICATION_GATE_EVIDENCE_20261029.json)。回滚保留原事实和派生待核标记，回退谓词时需停自动组卷，不能静默恢复未核规则题为就绪；无破坏迁移。完整目标继续：规则候选/AI稿严格同源关联与重复展示/计数合并、空页/失败页、整页普通正文还原、图题跨页/答案册、独立自然质量、真实40GB持续稳定与最终安装仍OPEN。

## 2026-10-29 文件夹一次授权到后台AI同库入题

整合补记：本片源码b1e3eb8完成上述207综合smoke后，远端新增51ef5b5/cc82219（PPT精确页数与备注）；正常合并为952074a，12处均为不同新增状态段，逐项保留双方，生产源码无冲突。合并版npm run build exit0、renderer240/240与presentation-draft-smoke四项通过；综合207为合并前本片源码证据，不冒充PPT合并后重新完整执行。最终目录界面专项exit0/2项/0renderer错误，仍3自动稿、未知结果冷启无重发，报告Temp/omni-folder-ai-ui-mskv8x/report.json；没有额外真实DeepSeek调用。

本片教师结果：资料页原文件夹卡片可明确公共资料/必要页或题图上云授权、统一DeepSeek账户修订与调用上限，后台随归档逐PDF页/Word原生题/图片/TXT或MD正文块自动创建原两阶段AI任务；原OCR、首遍、复核稿和实际图像证据分别保留，同一题库显示AI自动稿/待核。暂停/继续/应用重启/结果未知都有持久状态，不再要求每个资料手动建AI批次。

核心文件：shared/material-folder-ai.ts；main/assets/material-folder-ai.ts、material-ai-repository.ts、material-ipc.ts；db.ts/main/index.ts窄接线；typed preload；renderer/components/product/MaterialFolderAiPanel.tsx与原MaterialImportPanel.tsx。SQLite增量四张目录/幂等表和pause_reason，不改原件/原始OCR/现题事实。无新依赖/锁文件/模型资源/独立服务，沿原全局AI单消费者。

批判复现与修复：并发创建/重启可重复子任务→事务内幂等键和相同输入校验；目录预算可能越界→同writer预留、发送前父授权/成员/配置复验；目录恢复覆盖老师手动暂停→teacher/folder/startup原因；首16个attention占满队列导致新目录永远不运行（RED2≠3）→rowid双范围有界轮转，终态无任务不占窗口。未知结果保留outcome_unknown且界面明确未重发。旧单资料面板与人工修正/正式整卷集中确认保持。

实际命令（apps/desktop）：

```powershell
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-native-batch-boundaries.mjs
npm run test:renderer-components
npm run test:smoke
node scripts/education/kb-folder-ai-journey.mjs
node --experimental-transform-types scripts/education/kb-real-folder-ai-journey.mjs <existing-authorized-isolated-root>
node scripts/xiaozhi-agent/default-file-delivery-smoke.mjs
npm audit --json
```

仓储28、目录7、原生响应6+来源4、renderer240/240最终通过。最终test:smoke所含type/build与综合smoke自然退出0，日志Temp/kb-folder-ai-final-smoke.log及.exit=0。三格式正式Electron测试采用实际本地OCR/Word渲染/SQLite与typed IPC，DeepSeek HTTP为受控响应；一次目录授权→子目录MD/PNG/DOCX三题ai_final，传输中暂停→原生重启→继续，未知结果0额外请求/1幂等子任务，1366与1920、0renderer错误。私有报告Temp/omni-folder-ai-ui-Z82I1Y/report.json，首轮旧源码成功亦保留Temp/omni-folder-ai-ui-ntir6G。协作者E01默认文件交付7项再次通过，报告Temp/xiaozhi-default-files-RKc5jx。

真实云端另独立执行：仅将此前人工检查且授权的PDF第1页预览复制为单图目录，一次卡片授权2次真实DeepSeek200；严格核发送像素SHA相同且仅此页，四题中3条ai_final/1图题review。目视原页及保存题干确认第3题三个小问与先前OCR漏掉的电磁波/超声波选项均恢复，保留1.5倍速等条件；不能据此保证参考答案数学零错。原OCR未改，原生冷启同结果、1子批次/0追加请求/0renderer错误。独立新ledger2+历史知识库ledger16=18，不含导出与Pi专题。私有报告Temp/omni-real-material-NGRlNr/real-folder-ai-report.json；原图、回复、密钥与DB不进Git。真实脚本首次静态import先于源码适配失败、其次图片ID不合法，均在应用/请求前停止，核明0新账本后修脚本继续，未改生产校验。

配置受控测试首次空模型目录导致configuration，改测试模型目录后通过；不是生产账户故障。audit真实返回23项（0critical/8high/7moderate/8low），本片无依赖变动。匿名指标见[本片JSON](../research/KB_FOLDER_AI_EVIDENCE_20261029.json)。已保留并整合origin/main c8c0c8b的E01源码，未动D盘日常构建或协作者工作树。

性能前后：此前每资料单独创建AI批次；现在一授权后有界发现<=32项/轮、<=16轮转目录、每目录<=1在途子批次。没有40GB吞吐/P95或普遍准确率前后承诺。回滚时停目录调度与新授权，保留新增表/子批次关联/pause_reason及已保存题目回执读支持，现单资料面板继续可用；不能直接删除已入库事实。

完整Goal仍未完成：规则抽取旧候选不等于AI核验，当前卡片AI数字仅统计关联AI稿，需统一下游资格；空白/本地识别失败页、不支持格式、无结构化Word题显式待处理；整页AI还原普通正文的阅读/检索视图未实现；改统一账户配置暂需新目录批次、待核人工处理后的汇总仍需完善。复杂图题/跨页与答案册、独立自然质量/Recall、真实40GB持续导入/取消恢复/P95、受管组件首装更新与最终EXE继续OPEN。

## 2026-10-29 后台目录持续处理与专用OCR还原提示

用户最新目标：一次选含子文件夹的完整目录，后台静默持续处理，主界面只反馈必要进度/结果/异常，耗时可以长但质量不能降；OCR后由DeepSeek直接对原图还原核对，不把乱码通顺化当原文正确。完整目录自动AI调度/批次授权/质量就绪汇总仍未接通，本片不冒充全链完成。

修改：`assets/material-import-batches.ts`每发现128个目录项交替处理最多128个待归档文件，沿原source guard/文件hash/暂停恢复路径；`db.ts`将原导入主体抽为私有archiveKnowledgeResources，仅后台调用返回本次status/resources/items，公共importKnowledgeResources继续补完整overview，兼容旧前端。无DDL/IPC/依赖/原件迁移，未降低OCR或解析质量参数。

RED 4e24173实证：301个支持文件及1跳过文件全部发现（302）后才开始首次复制。GREEN真实Store测试首份复制时发现127文件、约184ms（包含本次初始化，不作一般时延保证），全批后台完整overview调用0；模拟真实文件/业务记录已写但队列未ACK时暂停，原生Store冷启仍paused，继续后复用那份资源且0重复，301文件全部现TXT parser ready、逐份原件SHA256一致，旧公共导入仍有overview并正确复用；4项、13.744秒，一次小规模合成运行，不能推导40GB吞吐。首次修后夹具未按main启动消费者造成301pending/等待超时，补同一解析/索引/抽题队列启动才通过，未放宽生产超时或门禁。生产资料页真实嵌套目录151文件/1跳过，暂停→冷启→继续时退出再开自动接续→长文尾部检索/实际来源→SQLite>80块，5项、0renderer错误。

`assets/material-ai-provider.ts`新增实际生效的`OCR_RESTORATION_INSTRUCTION`（OCR还原规则v1），共用现图片/Word两阶段协议：原图依据，多栏/段落/题号/公式上下标/单位/选项/小问/答案角色恢复；关键数字、符号、否定不猜补；无图保守，不确定保留issues；忠实题面与AI知识标注/解题分开，推导答案必须ai_generated，原OCR/原图/首遍与最终响应分别保留。严格JSON字段、原件/来源复验、缺图/矛盾拦截与正式整卷集中确认保持。

提示RED c523406验证实际请求缺少专用还原规则。随后实际请求装配覆盖图片/legacy/Word的首遍与复核共6请求，保留单一schema和原OCR；批次26、原生响应6+source skeleton4通过。新提示真实同一授权PDF第1页先两遍HTTP200但漏答案/解析/知识标注，4题均review，失败保留；明确“先还原、再解题标注、analysis不是JSON外说明”后再两遍HTTP200，1/2/3题ai_final、第4图题review。未靠降低门禁恢复通过，不承诺模型内容零错误。知识库ledger由12→16，共4次本片请求；与并行回答专题的旧20次额度无关，原件/原始回复不上传Git。

实际命令（`apps/desktop`）：

```powershell
node scripts/education/kb-background-import-store.mjs
node scripts/education/kb-folder-search-journey.mjs
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-native-batch-boundaries.mjs
npm run build
npm run test:renderer-components
node scripts/education/kb-real-ai-journey.mjs recheck <existing-isolated-root> unused <inspected-image-name> <inspected-pdf-name> 14
node scripts/education/kb-real-ai-journey.mjs recheck <existing-isolated-root> unused <inspected-image-name> <inspected-pdf-name> 16
npm run test:smoke
npm audit --json
```

最终build/type exit0（Temp/kb-restoration-final-build.log），renderer240/240；本轮最终源码npm run test:smoke自然结束exit0、ok=true/30合成学生，日志Temp/kb-background-restoration-smoke.log与.exit=0，不作为真实DeepSeek质量替身。audit最新23项（0critical/8high/7moderate/8low），无依赖或锁文件变化。自动审批一次超时未启动任何测试/网络请求，核文件目录和ledger仍12后重试启动成功；不是安全拒绝，也未绕过审批。

私有证据：Temp/omni-background-import-ceAxFj/report.json；Temp/omni-edu-folder-search-HqON0k/report.json；真实同页首失败和最终批次/first_json/final_json留在Temp/omni-real-material-NGRlNr/data/app.db，最终报告ai-recheck-report.json与ledger16。匿名指标见[本轮JSON](../research/KB_BACKGROUND_RESTORATION_EVIDENCE_20261029.json)。已整合协作主线2b96308，仅任务/验收文档变化、无源码冲突；未修改D:日常运行目录或正式资料。

回滚：归档调度和还原提示可独立revert，无数据库/原件迁移；旧代码仍可接续同队列条目。性能仅证明消除逐文件全库overview和首份复制不再等完整树，没有大库P95/40GB承诺。剩余：整目录OCR+DeepSeek自动调度/批次授权与幂等修订，区分归档/解析/AI可用的就绪汇总，规则抽取不能代表双重复核；整页AI还原正文的阅读/检索视图尚未实现；复杂图题/跨页/答案册、自然Recall/准确性、实际40GB持续处理和受管组件/EXE仍OPEN。

## 2026-10-29 原图纠正OCR漏字，并修复题库假空与工具隐藏

Git检查点：RED 7cf9d02→OCR GREEN c5f0415；核心目录RED 948f5ad、真实假空RED d296679→GREEN f964f02。已整合主线b09073b并再整合92d16aa；后者仅文档，10处冲突均保留双方，无生产源码冲突。临时WeKnora/E5桥已按实际PID/绝对路径核验归属后关闭，未触日常D:窗口。完整Goal继续，最终推送及远端一致性另以本轮Git命令结果为准。

旧chat-experience专项被展示断言阻断的空库规则已单独实测通过：空范围隐藏相应只读入口，ask_teacher/写入工具的宿主授权规则不受此提示增加。不能将此独立通过改写为整条旧专项通过。

本轮目标是老师实际能用导入后的题，而非只增加底层索引。保留Pi、SQLite、本地原件、现LanceDB/解析器与正式整卷集中确认。生产变动：`material-ai-image.ts`增加严格图文响应/六项完整覆盖；`material-ai-repository.ts`增量幂等建立`material_ai_image_inputs`，保存实际模型输入图（原始<=4MiB/unit）、校验两遍回执/原件/来源/图hash，允许纯文字原图纠正OCR漏字；`question-archive.ts`增加`image-text-complete.v1`。不同批次同图暂重复存储，没有新IPC或依赖。图依赖、跨页、漏题、两遍不同或不确定继续review；不把模型一致当独立正确性或教师确认。

真实同页新批次4题：1/2/3题ai_final，第4图题review。第3题补回OCR漏掉的选项与完整三个小问，题本原生重启可见，真实语义查询5候选包含该题；单题5分蓝图经隔离测试教师动作确认。真实Pi/DeepSeek再16请求输出学生Word10130B、教师Word10323B、学生PDF66721B、教师PDF77426B；独立完整内容/学生答案隔离/A4/来源谱系与1920×1080冷启哈希通过，目视两份PDF均1页，0renderer错误。测试教师操作不代表实际教师正确性核验；Office/WPS原生未打开。首版图文prompt因旧新schema冲突造成1次HTTP200但严格解析拒绝，未发布题；修prompt后2次有效图文请求成功，没有放松schema。

主线Hana目录把核心题库工具延迟，现固定两项已授权只读schema。首次自然提问仍失败于首请求缺schema断言（真实5请求/2目录，实际search/read成功但非直接可达）：宿主用`searchQuestionBank({limit:1})`判断整库，最新review候选会造成假空。改`chat-source-presence.ts`三个固定SQLite EXISTS，经`OmniEduStore.getChatSourcePresence`接production-host；每请求不再加载完整knowledge概览/排序/计数或合格检索。附件和目录授权保持，题目资格/来源仍逐题复验。第二次同自然提问无需工具名提示，3请求/0目录，实际search→read纠错题，返回题干/参考答案/解析及来源，原生重启逐字一致。一次5→3请求不能宣称普遍提速比例或自然Recall改善。

实际命令（`apps/desktop`）：

```powershell
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-critical-archive-boundaries.mjs
node scripts/education/paper-export-boundaries.mjs
node scripts/education/kb-brain-discovery-boundaries.mjs
node scripts/xiaozhi-agent/answer-quality-boundaries.mjs
npm run test:renderer-components
npm run test:smoke
npm run build
node scripts/education/kb-real-paper-delivery.mjs <existing-isolated-real-material-root> imageocr-20261029 '真实图文OCR纠错单题核对' 1
node scripts/education/kb-real-brain-question.mjs <existing-isolated-real-material-root> 智能家居
npm audit --json
```

批次26/档案12/导出21/核心题库4/回答11通过；合并版build、240/240组件、完整legacy smoke exit0/ok=true/30学生通过，后续只改Pi存在性与目录的最终源码另build及真实Pi/UI通过。最后没有用旧smoke冒充Pi验证。额外`chat-experience-boundary-test.mjs`在第23行`commentary`与`partial_answer`不符失败，尚未执行到空库断言；相关presentation源码本片未改，不为本任务绕过该断言。npm audit新读23项（0critical/8high/7moderate/8low），比前轮22多1个moderate，依赖/锁文件本片未变；首次受限网络EACCES，授权环境重试已取得真实报告。

私有证据保留于OS Temp：`omni-real-material-NGRlNr/image-corrected-journey-report.json`、`real-paper-delivery-imageocr-20261029.json`、首次失败`real-brain-question-1793258188519.json`、成功`real-brain-question-1793258703253.json`；日志根`xiaozhi-kb-mature-baseline-20261028`的`image-text-integrated-smoke.log`/exit=0、`image-text-integrated-components.log`、`kb-core-presence-build.log`。不上传原件、OCR、回答、密钥或数据库。匿名指标见[实现JSON](../research/KB_IMAGE_TEXT_IMPLEMENTATION_20261029.json)。本题片新增图文3次（含1失败）+导出16次+自然查题8次；原有知识库/导出累计ledger分别12/43，另自然8，不能将所有历史调用都算成该片2次。

成熟对照现已完成：WeKnora固定dacb9c2未改源完整Windows Lite、三个运行DLL、无编译器PATH健康200；9份同OCR文本实际检索，6原图因需VLM拒绝、3PDF因缺DocReader全部failed/0chunks。sqlite-vec同库100k/1m热P95为251/3755ms，当前Lance原生合成探针65/326ms；不同时间/缓存且排除编码/重排/宿主，不做因果性能胜者或语义Recall声明。Docling medium OCR及raw OCR截获亦未找回清晰选项。细节见[WeKnora运行证据](../research/KB_WEKNORA_RUNTIME_EVIDENCE_20261029.json)。本轮不能把候选直接切默认。

性能前后：宿主存在性从完整概览+候选资格读取改固定短路EXISTS，真实单问5请求/2目录→3请求/0目录；没有整产品P95前后承诺。图文读回可用持久输入图而不重渲染/OCR；每unit原始图最大4MiB，不同批次不去重，几十GB空间/IO仍待验。回滚：`OMNI_EDU_AI_IMAGE_TEXT=0`仅停新图文覆盖请求，必须保留新policy读支持/输入图表/已保存题；目录和存在性可独立revert，不回退数据。当前完整目标未完成：第4图题/PDF原生v3、跨页与答案册、独立自然质量、实际40GB持续混合导入/取消恢复/P95、受管组件首装更新、最终EXE。

## 2026-10-29 真实Pi四文件闭环与成熟方案实跑

本片保留 SQLite/Pi/Office 审批/确定性生成器，仅修 `education/paper-export.ts` 与 `xiaozhi-agent/pi-session.ts` 中错误的“必须先选教学工作目录”指引：本会话已授权试卷保存位置即可调用，真实授权仍由宿主校验。既有真实夹具增加独立运行标签、有界控件等待、每轮16次请求上限及原生冷启后产物/哈希/谱系核对，没有新增业务表、IPC或依赖。

实际命令（工作目录 `apps/desktop`）：

```powershell
npm run build
npm run test:renderer-components
node scripts/education/paper-export-boundaries.mjs
node scripts/education/kb-paper-output-task-boundaries.mjs
node scripts/education/kb-real-paper-delivery.mjs "$env:TEMP/omni-real-material-NGRlNr" managed-reuse-20261028
npm run test:smoke
npm audit --json
```

build/type、renderer240/240、导出21/21、仅输出授权11/11及完整legacy smoke通过；后者报告ok=true/30学生，不作为真实Pi替身。真实Pi/DeepSeek本次四任务12个记录请求，在1366×768界面测试审批；学生Word10270B、教师Word10551B、学生PDF76338B、教师PDF88193B。独立python-docx/pypdf/PDFium复读完整2题、教师6个题干/答案/解析标记、学生答案隔离、A4通过；两份PDF各1页，原图嵌入0（本片只验证无图两题）。已目视两份PDF，1920×1080原生重启后四个saved产物、字节SHA与已确认试卷谱系一致，0 renderer错误。自动审批仅测试夹具，不代表真实教师核验答案；未用Office/WPS原生打开。

私有报告：`Temp/omni-real-material-NGRlNr/real-paper-delivery-managed-reuse-20261028.json`；文件位于该目录`real-paper-exports`。原件、OCR、回答、加密账户与文件均未入Git。此前configuration/0文件仍是历史失败；本次同旧bundle的诊断也曾生成首份Word，旧异常原因未证明，不能把本片指引改动宣称为其根因修复。一次主动结束的诊断保留私有日志，未以重复付费推测故障。

成熟产品已运行的范围：[匿名运行证据](../research/KB_REUSE_RUNTIME_EVIDENCE_20261028.json)。AnythingLLM明确兼容后的后端九文件全部摄入；默认/多语言四问仍误排并丢PDF页码；Docling离线真实同页四配置保留坐标但漏清晰选项；百万合成向量热P95 326ms仅原生容量，不含完整模型/权限/重排/IPC。WeKnora固定源Windows Lite本机隔离构建中，未接生产。实际40GB、自然质量、图题与组件自动安装继续OPEN。

性能：两处指令没有计算路径变更，未声称小智时延改善；候选模型的单例原图排名19→2不是Recall改善率。npm audit仍exit1/22项既有风险（8high/6moderate/8low），未升级依赖。回滚本片两处指令及夹具即可，正式资料/数据库无迁移；其他工作树未移动。最终main提交与远端一致性以Git收尾回读为准。

## 2026-10-28 交付反思与成熟方案复用重审

基于08e26bc核实本文件的真实9文件/2条ai_final及configuration/0文件失败仍未闭合。本轮公开GitHub源与LICENSE/OpenAPI核验、独立Terra只读复审完成；四候选固定SHA见docs/research/KB_REUSE_SOURCE_EVIDENCE_20261028.json。未安装/运行候选、未测同资料胜负、未跑40GB、未上传资料或发新模型调用，生产代码/数据不变。当前用户任务与规模门槛/后续合同见KNOWLEDGE_BASE_RECOVERY_20261028.md和WORK_PROGRESS.md。

## 2026-10-28 最新主线重审：两题可组卷，真实导出仍阻塞

用户最新要求先拉取再重新确定问题；已fetch并整合origin/main `cc2e68ae1d17b0cec03a59a72183881fd4dceba8`（merge `ee6e8de`），本地修改先stash再完整恢复，0冲突。相对前次主线297b0d3，新增仅F15恢复测试及审计文档，`git diff 297b0d3..origin/main -- apps/desktop/src python`为空，不能将主线审计通过推及知识库导出。D:协作树/32aa的分支均未被本轮移动。

修复及实际重跑：卷首答题说明编号不再当题；题目线索从有界完整编号块检查；连续1起小问保持完整，乱序/缺号/重号仍歧义；独立填空线与A选项前中文句号只作版式比较，数字、公式括号、否定、选项顺序不变。新真实同页两遍再4题，**2题ai_final、2题仍review**（OCR实际漏了条件、另一题缺图）。真实题意搜索“光的折射”2条，正确物理九年级/填空选择蓝图2题10分；隔离自动化教师确认成功，不冒充真实教师签署。真实题本现30条。最新知识库调用9次；用户后续明确授权本任务不限次数测试，覆盖先前4/7限额，但每个脚本仍使用有界批次/持久计数。

导出真实暴露的问题：仅选择paperOutput时，saved_office任务只读workspace导致task_target_invalid，首次启动又锁定只读会话，用户不能按模型提示补选工作目录。已新增仅无workspace时的输出目标身份fallback，普通file/saved_text/office_create_document仍拒绝输出授权，源授权/越界继续校验；真实Pi已adopted计划。**之后实际education_export_paper仍返回configuration，SQLite无持久Office草稿、目录0文件**，根因尚未定位，不宣称Word/PDF通过。工具描述仍含“需要先选择教学工作目录”，与输出授权入口不一致，也需继续对齐。

重审撤销的证据：首次离线复制SQLite只复制主草稿表、缺关联sources表，导致parse configuration；补齐表后，同一真实纸卷编译与独立Office service.propose进入pending成功。因此该离线configuration属于诊断脚本问题，不能当生产根因。真实失败保留在本机real-paper-delivery-report.json/native session；下一优先定位真实host回调/服务prepare的异常，避免反复付费猜测。导出调用ledger10次，累计已发请求19；按用户先拉取重审要求，此后未新增模型调用。

最终限定验证（apps/desktop，所有原资料/响应/截图仅本机Temp/omni-real-material-NGRlNr）：

|命令/证据|实际结果|
|---|---|
|`kb-question-structure-boundaries.mjs`|RED提交c4993bf；GREEN17项exit0，kb-real-structure-green.log；包含后置标题不得擦掉已开始题目。|
|`kb-ai-batch-boundaries.mjs` / `kb-critical-archive-boundaries.mjs`|17/12项exit0，kb-real-structure-batch-final.log、kb-real-archive-final.log；保留缺图/截断等旧反例。|
|`kb-paper-output-task-boundaries.mjs`|RED提交f14861b；GREEN11项exit0，kb-real-paper-output-red/green.log；输出撤销、路径逃逸、无普通读写权限、原workspace行为。|
|`scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs`|19项exit0，test-results/xiaozhi-agent/pi-task-plan-boundaries-hoe226。|
|`kb-real-ai-journey.mjs recheck ... 9` / `inspect ...`|真实两遍4题，其中2题完整自动定稿；2条题意命中、2题10分预览，0 rendererErrors，ai-recheck-report.json、ai-inspect-report.json。|
|`kb-real-paper-delivery.mjs <隔离目录>`|真实Pi失败，非替身，19总请求内包含导出10次；0文件。旧harness拦截/v1路径、隐藏legacy导航或等待补选目录的日志分别保留，不混算生产故障。自动化教师确认已写隔离库，原题/正式用户库未修改。|
|`npm run build`|最终exit0含tsc，kb-real-paper-output-build.log；main/index.js SHA256 `d0c7ef20bd15862b9e5c94e7eea11969a376077883b0634c07989d7ed140d922`。|
|`npm run test:renderer-components`|最终240/240 exit0，kb-real-output-final-components.log。|
|`node scripts/electron-smoke.mjs`|最终同一已构建out exit0/ok=true/30学生，kb-real-output-final-smoke.log，Temp/omni-edu-smoke-mclReF。|

性能：前一格式兼容微测median增加约0.014ms，范围见下节；本片extractor按编号块总长检查、说明仅单次扫描，未新增后台服务/主线程逐Token路径。未测本片整机性能前后对比、40GB/P95或自然答案正确率，不宣称性能无退化。回滚：revert本轮窄fix提交；无表/目录迁移，旧档案不自动重写。当前问题优先级为真实导出configuration→PDF/图片原图与图义v3→有证据的OCR补漏→大规模/自然质量与EXE验收；完整Goal仍OPEN。

## 2026-10-28 真实9份资料与真实DeepSeek（最新限定证据）

结论：本地收录/解析/全文检索通过；真实AI两遍能落库，但这批PDF/图片到自动可用题、题意召回和正式组卷的完整闭环**未通过**。本节更新先前“未调用真实云端”的时序，不扩大Word原生限定验收。执行源码为beca工作树，未修改D:协作者源码、日常数据或发布EXE。

- 用户指定真实目录含9文件：3 PDF、6图，10321505字节，没有Word。隔离输出为`C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-NGRlNr`，原件/截图/OCR/完整模型响应/SQLite只留本机，未纳入Git。
- 实际从资料页“添加文件夹”进入，9/9收录；3 PDF各6页，共18页均OCR complete、0失败，6图片正文ready；25 resource_chunks，索引pending0。全文洛埃镜1/干涉1/物理10条命中；原始文件SHA全部不变，冷重启资源仍9份、0 rendererErrors。规则抽题20条全部待整理。
- 原授权4次；用户看到格式故障与修复证据后明确追加为总7次。实际ledger7次、7个HTTP200；图像样本和PDF第1页已本地查看无可见身份信息。两样本各自两遍图片SHA一致；不向云端发送整PDF或文件夹。前3次因严格根字段拒绝，失败批次保留；修后4次（每样本2次）新增2+4题，无新failed/unknown。不是替代模型响应。
- 真实Flash响应多出根`type:json_object`，导致原provider整批invalid_response。RED提交`1f9eae7`保存失败回归；修复仅删除这个精确格式标记、强化根字段提示，继续严格业务schema。未知type/额外未知字段/空题干/伪teacher_confirmed来源仍拒绝；不自动付费重试。不新增依赖/表/IPC/迁移。
- 同一真实响应离线复读修前invalid_response、修后4题；零额外请求。修后真实6题全部`ai_needs_review`：均有incomplete_question/uncertain_ocr，2题另requires_image。题本界面搜索洛埃镜找到2题；题意查询“洛埃镜 光的干涉”返回0候选（semantic available/complete，candidate0）。正确物理/九年级/填空选择、1题5分蓝图实际0题，提示题库不足；未确认或导出。题库现26条不等于26条可组卷。

具体命令/结果（目录`apps/desktop`；参数`<授权目录>`及密封账户源路径只在本机传入）：

|命令|实际证据|
|---|---|
|`node scripts/education/kb-real-material-journey.mjs <授权目录>`；再传原output续读|最终exit0，report.json与progress.json；9文件/18页/25块、SHA、冷启与双尺寸截图。首次脚本limit100不合法，修正30后原库续读，不重复导入；原失败日志保留。|
|`node scripts/education/kb-real-ai-journey.mjs prepare/run/diagnose/verify-fix/inspect ...`|各阶段最终exit0；ai-verify-fix-report.json、ai-inspect-report.json、real-cloud-ledger.json。prepare复制源账户密封配置及profile加密元数据到隔离实例，不复制整个业务库/cookie，源账户只读。main evaluate不能require/dynamic import等脚本失败、旧批次/paused误读、隐藏重复导航和初次默认数学蓝图均保留日志；最终精确新批次、terminal状态、可见导航及物理蓝图核对，不将脚本失败归因产品。|
|`node --experimental-transform-types scripts/education/kb-native-deepseek-boundaries.mjs`|RED exit1 invalid_response；GREEN9项exit0，kb-real-envelope-red/green.log。|
|`node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs`|17项exit0，kb-real-ai-regression.log。|
|`npm run build`|exit0，含tsc，kb-real-build.log。新main/index.js SHA256 `d3827659411ecbd008fce528e996da690143832e291d5fc53567821fec5ce741`，真实修后调用/inspect均使用该构建。|
|`npm run test:renderer-components`|240/240 exit0，kb-real-components.log。|
|`node scripts/electron-smoke.mjs`|同一已构建out执行，exit0/ok=true/30隔离学生，kb-real-smoke.log，Temp/omni-edu-smoke-GLw3eP。与npm run test:smoke的build+script等价执行，不重复构建。|
|`node --experimental-transform-types scripts/education/kb-real-format-performance.mjs d710541 <本地响应> <本地输出>`|离线canonical JSON、受控HTTP、30批×50次交替采样。修前median0.07851ms/p950.10732ms，修后median0.09232ms/p950.23110ms；额外解析有约0.014ms median开销，非联网/UI/40GB性能。新增处理有128KiB边界，未修改流式路径、DB或后台并发。|
|`npm audit --json`|exit1，现有22项（8高/6中/8低），无新增依赖；未自动升级。|

下一修复应围绕真实差距：PDF/图片题持久原图/图义→OCR改正的可核验证据→同一题本/Pi题意召回→可组卷资格。不能删除完整性门禁或用一次教师确认掩盖缺图；当前两遍一致不等于自然答案正确。40GB/P95、跨页答案册、真实搜题站与最终安装包仍未验收。源码可以revert本轮fix回滚；无数据库迁移、无需回滚用户数据。协作者并行审计结果独立保留。

## 2026-10-28 S6-B2统一DeepSeek生产图文贯通（最新）

本节覆盖下方“仅独立账本/尚未生产接线”历史状态。完整Goal仍未完成，无新增依赖、部署服务、真实云端请求或新EXE发布。

实现现Word按题图文批次→实际Word排版/本地OCR→不可变必要上下文/PNG→现账户两阶段→真实first/final/member/native同writer→同一题本typed看图/失败重试/教师编辑与原AI题干恢复→现Pi图义检索/实读→正式整卷确认后当前角色Word/PDF。新增幂等material_ai_native_context；v2输入digest绑定原始必要context/OCR，保存到本机不等于重启外发许可。新批次一题一unit，不预积累100题图片。生产固定deepseek-flash与官方endpoint，复用现小智加密账户，不保留第二份Key配置；历史Qwen回执不重标，真实Qwen调用拒绝。

真实证据（执行目录本工作树apps/desktop；脚本均已纳入仓库）：

|命令|结果/范围|
|---|---|
|`node scripts/education/kb-native-batch-store.mjs`|10项exit0；kb-native-brain-office-store-final.log，Temp/omni-native-batch-store-ExqiAX。实际Store/真实Word排版/OCR/双sqlite3、真实first/final来源闭包、教师编辑、cache删除/重开、Word ordinal5/batch ordinal1首稿恢复；现关键词与Pi工具实读native-only公式语义；实际PaperRepository创建/受控教师confirm，Word/PDF生成、DOCX媒体SHA精确等于当前角色图、学生无答案图、教师旧答案图撤销、PDF含图像对象。模型/教师决定受控，不是自然答案正确性或Office/WPS人工布局验收。|
|`node scripts/education/kb-native-batch-journey.mjs`|7项exit0，kb-native-pipeline-ui-checked-final.log；Temp/omni-native-batch-ui-hCnHGa/report.json。生产Electron2启动/0 rendererErrors，1366×768与1920×1080，实际资料文件夹导入/统一设置/必要角色授权/实际OCR与被截获DeepSeek两遍HTTP/typed题本图片/缺图重试/编辑撤旧图/明确核对后恢复真题干与无待整理资格/删预览图冷重启。完整out指纹9c8f900f00101949f9aa718c162f53be35fd74b36e8aade57cade7b32c7f9e3f，前后冻结一致。|
|`npm run test:smoke`|最终build（含tsc）及真实历史兼容smoke exit0，ok=true/30名隔离学生，kb-native-pipeline-smoke-final.log，Temp/omni-edu-smoke-j7zd7L；同一冻结out9c8f900f。这是隔离legacy兼容，不冒充当前Pi全功能/真实provider或40GB验收。|
|`npm run test:renderer-components`|240/240 exit0，kb-native-components-final.log。|
|`node --experimental-transform-types scripts/education/kb-native-deepseek-boundaries.mjs`|4项exit0，test-results/kb-native-deepseek-boundaries-final.log；官方固定端点/模型/统一账户，受控fetch。|
|`node --experimental-transform-types scripts/education/kb-native-batch-boundaries.mjs`|6 schema+4源骨架项exit0，test-results/kb-native-batch-boundaries-final.log；两遍不能同时漏选项/小问。|
|`node --experimental-transform-types scripts/education/kb-native-brain-boundaries.mjs`|5项exit0，test-results/kb-native-brain-boundaries-final.log；现Pi六段语义且AI不冒充教师/不发PNG。|
|`node --experimental-transform-types scripts/education/kb-native-office-boundaries.mjs`|3项exit0，test-results/kb-native-office-boundaries-final.log；学生角色、完整高度PNG纵横比。|
|`node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs`|3独立批判反例转为固定回归，exit0，kb-native-dispatch-regression-final.log。末次异步隐私撤销0发送/0calls；第二阶段明确未发送暂停保first_saved/calls1/可重试；requiresImage保review且不具组卷资格。|
|`node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs`|17项exit0，kb-native-unified-regression-final.log；原16兼容+新writer不回退旧Key。|
|`node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs`|17项exit0，kb-native-retrieval-regression.log；实际仓储/SQLite trigger/世代，向量口受控。|
|`node --experimental-transform-types scripts/education/paper-export-boundaries.mjs`|21项exit0，kb-native-paper-regression-complete.log，Temp/omni-paper-export-SbuNg8/report.json。旧实际Word保存/审批/幂等/答案卡/富图/SQLite初始化兼容；不是WPS视觉。|
|`node --experimental-transform-types scripts/education/kb-native-coverage.mjs`|exit0，test-results/education/native-coverage-4q0nnO/report.json，包含20存储/7契约/4身份及6+4批次源骨架；四域compiled非空行最低83.42%、函数最低94.74%。原仅三套统计漏新骨架函数导致73.68%失败保留aeCXlu；添加真实新增边界套件，不降低80%门槛。|
|`node scripts/education/kb-native-pipeline-coverage.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-native-batch-store-ExqiAX`|exit0，同目录coverage-report.json；真实Electron精确V8/esbuild模块范围：执行器99.29%行/100%函数，必要上下文90.48%/100%，响应88.24%/100%。不是TS分支/全项目/模型质量覆盖。|
|`npm audit --json`|审计未清零，22项（8high/6moderate/8low/0critical），test-results/kb-native-pipeline-audit.json；本片未改依赖，未自动升级。|

独立批判：word_source_critic此前真实复现late_private、确定未发预算消耗、requiresImage放行及新writer缺共享账户；原报告Temp/native-dispatch-critic-vfm11Q/report.json、native-unified-writer-critic-P22Xji/report.json。前3项独立重放修复通过（repaired-independent.json），账户修复root重放和真实Store通过，现固定回归包含它。最新全面独立复审因账户配额报错（提示17:41可再试），没有切换模型/代理绕过，也不宣称最新代码独立无问题。

失败保留：a211205脱敏fixture形状不符不算业务RED；f7b95e3修正后真实Pi缺图义RED。初始UI隐藏导航重复定位/编辑后未展开图片属于测试流程问题，保持生产断言后最终7项通过。Store首次Paper requestId错误前缀、ZIP把媒体目录当空媒体导致失败，修正夹具/目录过滤后精确SHA通过。旧导出回归先因.codex authority、已删历史图片与临时bundle依赖解析失败；改OS临时业务根、自包含PNG和仓库内编译输出后21项通过，未修改生产权限。相关kb-native-*current/fixed日志保留。

仍OPEN：原生v3联网补答/临时提问、真实站点适配和登录接管、AI推导独立核对、Word精确span→chunk隐私（现整资料保守阻断）、备份业务PNG引用缺失完整性、跨页/答案册、受管本地视觉、自然教师标注召回/准确率/冷P95、40GB持续处理、Office/WPS人工视觉与最终安装EXE。实际PDF含媒体/不串角色不能替代版式或答案正确验收。

每轮固定动作已写AGENTS.md与1.Agent.md：提交检查通过的本轮代码及状态，刷新整合origin/main、正常push后核远端；禁止强推/覆盖协作者或上传用户资料。主线在32aa已检出，不擅自移动该本地ref；允许当前已整合分支push HEAD:main。本轮刷新origin/main=3734df3，当前分支已包含该主线（远端无新增分叉）；最终提交自身SHA和push后远端一致性由本轮收尾命令回读报告，不预填自引用SHA。

## 2026-10-28 S6-B2 原生业务图片与持久输入基础

完整Goal ACTIVE。本轮NativeQuestionRepository由原先缺失RED推进到实现，尚未接生产OmniEduStore、Word AI批次/真实OCR/first-final transcriptor、同题本typed图片/编辑、Pi/Office与备份闭包，不能宣称教师可使用完整图文AI流程。没有新增依赖/部署服务/外发权限。

已实现：五类增量幂等表material_ai_native_revisions/images/pending/inputs/input_images，question-ai-assets/v1业务PNG，无预览LRU；主进程真实Word.proofs.evidence复读来源manifest/PNG/stamp；私有短命permit，同根caller writer事务发布修订/角色；pending先记账、OS锁与崩溃/取消回收，输入refs及正式历史均保护图片。持久输入绑定真实AI-unit raw JSON SHA/版本化Word selector/batch ordinal→Word ordinal/原排版及有序PNG身份，first_saved连接重开不重新截图。readInput只属本地证据，dispatch须继续实时复验running/settings/隐私/授权。

独立审查先复现末次来源撤销、外层事务孤片与并发教师保存被BEGIN/ROLLBACK探针静默回滚P1；对应bcaa113/3b59f0e/982d98c RED先提交后修。现移除SQL探针，Host.inTransaction同步私有状态，生产preparation必须专用连接；stage/publish须由caller事务中的writer实例执行。真实Electron新探针又复现相同base仅JSON属性顺序不同而source_changed（0914be0 RED）；已改逐字段比较。源角色不能移用其它角色图；教师改答撤销当前旧答案图、保留历史；真实源式/表/图不能被model not_applicable绕过。

执行目录为本工作树apps/desktop：

- `node --experimental-transform-types scripts/education/kb-native-ledger-boundaries.mjs`：20项exit0，kb-native-input-final.log，实际node:sqlite/文件与caller事务、受控像素/转录producer，root为Temp/omni-native-ledger-Jpyr7T。
- `node --experimental-transform-types scripts/education/kb-native-question-boundaries.mjs`：7项exit0；`kb-native-content-identity.mjs`：4项exit0。覆盖缺图角色/教师移图、镜像/不同图身份，不是完整AI。
- `node scripts/education/kb-native-promotion.mjs`：4项exit0，kb-native-promotion-fixed.log；报告`C:/Users/ZhouXuan/AppData/Local/Temp/omni-native-promotion-7ASBMA/report.json`。真实Electron隔离渲染→实际Word cache manifest attestation→独立准备/写入sqlite3连接→持久AI输入→删除真实cache PNG/表→关闭并重开双连接→同bank/角色读回，源文件修改拒绝。AI transcription仍为受控私有fixture，未通过现Store/typed UI/provider/Office；不是完整用户验收。初始fixture误把整个proof作为base导致invalid_input，改正确base后又得到属性顺序RED，失败日志保留。
- 独立critic真实9反例：`C:/Users/ZhouXuan/AppData/Local/Temp/native-input-review-critic-NzvwY0/report.json`。覆盖批内ordinal1/Word ordinal5、首稿恢复/篡改/隐私、过期permit、取消事务与角色隔离；受控PNG，不是自然质量。P1原复现另见native-idle-probe-critic-aOmKRa/report.json。
- `node scripts/education/kb-native-coverage.mjs`：exit0，`test-results/education/native-coverage-xwKQ3C/report.json`。V8实际编译JS非空行/函数：shared native 87.12%/100%，content 97.01%/100%，selector 100%/100%，repository 97.50%/100%。仅四领域；不是TS分支、全项目、Electron UI或provider覆盖。
- 旧`kb-ai-batch-boundaries.mjs`16项、`kb-word-proof-repository.mjs`11项exit0；`npm run test:renderer-components`240/240 exit0，kb-native-components-final.log。初次build/components工具进程各返回-1，后续已重新验证；最终build门禁在下方续记，不以初次无输出当成功。
- `npm audit --json`当前22项（8 high/6 moderate/8 low），`test-results/kb-native-audit-20261028.json`。历史21已漂移，未擅自upgrade或声称清零。

最终收敛：`npm run build`（含`tsc --noEmit`）已正常exit0，`kb-native-build-final.log`，最后源码后执行；renderer组件240/240及上述专项/真实Electron验证均已收集终态。`git diff --check`通过。未运行本轮全套smoke/生产native UI，因为该链尚未接入现Store；不得把旧207项作为本轮完整图题证据。

最终独立限定复核：critic确认sameBase严格比较五身份字段，未发现新增确定P1/P2；对真实7ASBMA报告、SQLite与PNG只读核对一致。根代理另复读该实际DB：cache manifest=0、native input=1、revision=1、角色images=3、pending=0。上述结果仍不证明生产Store/真实AI/typed UI/Office完成。

整合收尾：源码GREEN `9c94357`已保存；当前知识库分支合入协作者main `3734df3`，12份状态文档冲突均是双方独立新增段，已逐项保留；业务源码无冲突，启动修复原样保留。该merge不改变此前已构建/验证的src及package文件，新增启动脚本仅做语法复验。main仍由32aa工作树占用，未更新其ref/文件、未push，不将本分支merge称已合入main。

本地主线已由协作者推进到3734df3并在32aa工作树占用；本轮不写该协作工作树，不push。下一实际接线：专用preparation连接生命周期、writer真实first/final/member/input receipt→AI原生response/必要OCR与角色图片→现Word批次/题本→检索/Pi→Office/备份。40GB长稳/自然教师Recall与P95/受管本地视觉/最终EXE仍必须完成。

## 2026-10-27 S6-C 持久网页补答、同题本与生产任务接线

完整Goal保持ACTIVE；本次是已保存完整文字题的限定联网补答，不是任意网站、图题、临时提问或40GB最终交付。复用现Hana浏览器+Mozilla Readability，无新增依赖/服务/Agent。

已落地：question_web_grants/observations/candidates三张增量幂等表，真实宿主观察/owner/run/URL/时间/正文摘要；archive v4逐角色web证据；同题唯一完整题面/明确角色精确匹配；writer事务缺角色CAS，只补空；已有答案/解析不同或网页缺相应对照区域时保留候选。原资料来源、原AI回执、现有非空内容保留。取消/过期/隐私/源变化/教师改题拒绝提交；教师改写撤销当前对应web引用，历史保留。

Pi的education_web_answer authorize/propose/status接现会话、原题本和typed证据IPC；成功purpose实读即待授权，本批20题/5origin/20分钟、最多32观察/100候选/16授权。generic web/MCP不继承批次，DNS/发送/重定向均重验，具备补答能力时Pi顺序执行。任务计划已接：authorize/status独立本地许可/读取；propose仍需saved_questions/current写入准入。每个applied记录真实首个application callId，独立保存读回绑定owner/call/candidate/afterVersion/当前原件闭包，live及历史recheck一致；重复新call不能继承别的call保存资格。只批准/候选/冲突不产生保存通过证据，畸形applied显式unknown。教师确认由独立human表达。

最终执行目录：本checkout/apps/desktop。日志归档test-results/goal；绝对工作树/报告及命令如下。

| 命令 | 真实结果与范围 |
| --- | --- |
| npm run build | 最终exit0，含tsc --noEmit；kb-web-build-final.log |
| npm run test:renderer-components | 最终exit0，240/240；kb-web-components-final.log |
| node scripts/education/question-web-native.mjs | 最终exit0，12项/0 rendererErrors，实际Electron DOM/真实资料复制/Store/SQLite/宿主scope/typed IPC/原题本失败重试/候选原因/教师改写/1366×768与1920×1080冷重启；kb-web-ui-final.log |
| node --experimental-transform-types scripts/education/question-web-answer-boundaries.mjs | 12组；真实仓储+SQLite，proof exactcall/owner、CAS/重放、串题/角色冲突、取消/到期与来源；Host来源校验有fixture，真实Store另见原生路径 |
| node scripts/education/question-web-send-boundaries.mjs | 8组，批次/内容/路径外发、host观察来源、状态与旧版本回执；recording adapter |
| node scripts/education/question-web-generic-send.mjs | 6组，pending search/fetch/MCP拒绝、普通联网对照、异步脱敏撤权；actual generic/Hana+本地替换transport，0真实联网 |
| node scripts/education/question-web-transport-revocation.mjs | 3组，实际office-network DNS前后与公有解析fallback撤权，替换DNS/fetch，0真实请求 |
| node scripts/education/question-web-pi-sdk.mjs | 3组，唯一实际Pi SDK+受控model协议，purpose实读先于MCP拒绝、真实补答tool manifest/注册/status；Store/外部adapter为fixture |
| node --experimental-transform-types scripts/education/question-web-task-plan.mjs | 最终6组，真实SQLite任务coordinator/journal/publisher/准入+实际Pi SDK/taskRuntime/envelope；domain写入/snapshot显式fixture。hcVqRS，kb-web-task-final.log |
| node --experimental-transform-types scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs | 旧任务19组通过，u7qQWN；kb-web-task-compat.log |
| node scripts/xiaozhi-agent/pi-browser-extract-boundaries.mjs | 12组，实际Readability/jsdom的结构/隐私/省略边界，非原生浏览器覆盖 |
| node scripts/xiaozhi-agent/pi-browser-proxy-scope.mjs | 2组，真实本机HTTP/CONNECT代理，scope拒绝先于替换DNS，不访问公网 |
| node scripts/xiaozhi-agent/pi-browser-proxy-cancel-smoke.mjs | 旧4组通过，pi-browser-proxy-cancel-JKuTqf |
| node scripts/education/question-enrichment-read-boundaries.mjs | 旧缺答实读15组通过 |
| node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs | 旧双阶段AI16组通过，受控provider；kb-web-ai-compat.log |
| node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs | 旧实际Pi SDK8组通过，pi-boundary-Ja0j6K；不调用真实模型 |
| npm run test:smoke | exit0，207/207历史兼容路径；kb-web-answer-smoke-final.log。本实例早于最后对称角色冲突及task读回修复，不冒充最终源码全量回归；后续最终build/240组件/本片12原生/任务19及SDK6补验见上 |
| node scripts/education/question-web-coverage.mjs | exit0；四新领域的实际V8编译JS非空行/函数覆盖，web-coverage-fdemrl/report.json。tools 99.53%/92.31%，repository 97.04%/100%，readback100%/100%，shared92.45%/100%。通过80%限定门；不是TS分支、整个项目、Electron或自然质量覆盖 |
| npm audit --json | exit1：21（8 high/5 moderate/8 low），无新依赖；kb-web-answer-audit.json。未自动大版本升级 |
| git diff --check | 收尾exit0；Git真实合并结果另见本节收尾记 |

最终原生实例：C:/Users/ZhouXuan/AppData/Local/Temp/omni-web-answer-ODZIoG/report.json，完整out指纹18715c90527493df21c83420059587561920ffc86140a4af8724daf31aa88e9c。包含真实copied Markdown/SQLite/原件强验、实际隔离world/native DOM、真实Pi工具定义、exactcall独立保存读回、两进程UI冷启动；网页是合成HTTPS protocol fixture，批次许可是test stand-in，无真实搜题网站或付费provider质量声明。重定向protocol handler可收到回调但Chromium取消ERR_BLOCKED_BY_CLIENT，外发前DNS阻断由独立代理/transport项证明。

独立批判与修复：串题、MathML分式/HTML上下标/合并表格静默降级、批次外URL/内容、成功实读但未批准即外发、generic web/MCP旁路、异步sanitize撤权窗口、已有答案或解析的对称拼接冲突已反例修复。实际Pi又查出tool_manifest_missing，生产任务准入/独立读回遗漏也已补齐。关键RED提交e970171/b9a6901/d8c92bb/d61728a/0f658d7/20675b2/6625727/2476fc3/d8462e8/2fbc99f/e9c2da3/093ada2/f80b1af/bd05a2a；其中f80b1af首跑cwd错误，仅正确cwd复跑的task_plan_required才是产品RED。测试配置错误不算生产证据。

独立最新报告位于OS Temp：web-answer-race-final-6177e4aa6fd44bd88b6aeacee2330224（异步撤权0传输）；web-answer-role-final-d2e164c1bb1c49f09b819605bfb088e4及web-answer-analysis-edge-final-492052bfb4424bc68714215a24649c3c（双向冲突/缺解析/空白差异）；web-answer-chain-final-be3d0541c14a4ad3ab73160e94d1cfc5（教师改写/旧解/旧版本）；web-answer-ledger-proof-critic-8f4731c5ec1849e09aaacadf4ca8fc01（实际SQLite+独立读回7组，非snapshot stub）；web-answer-task-admission-critic-ca6784422b4045978ee1a2f500b45a47（任务准入/SQLite保存步通过而human仍pending6组）。本切片限定复审未发现剩余确定P1/P2，不代表整个Goal无问题。

仍须继续：真实搜题站可用性/选择器与多站点适配、origin所需静态资源/登录和验证码人工接管、临时问题持久入库、AI推导独立核对、教师v2及native v3原版本链/独立AI图片账本。公式结构丢失、图解和不唯一匹配只保候选。正式整卷仍集中确认。40GB长稳/故障矩阵、自然教师召回/答案质量、P95延迟与最终EXE全新机交付仍OPEN。旧更广source门禁的资料预览夹具缺contentHash、现有audit项与CSS指纹门禁不因本片通过宣称已清零。

最后回执P2（applied混入items/grantId掩盖缺证据）已真实RED899cda3后修，独立2项重放闭合：web-answer-mixed-state-final-4ecb597661b44909ad248f38928b76fe/report.json。同候选换call不能继承保存证明的独立回放：web-answer-final-state-critic-979c4646436946eeae443d0560a2ec6e/report.json；该报告的混字段旧失败已由前者替代。最终构建及12项原生/UI已在此修复后重新执行。

收尾Git实况：源码GREEN f07c7db已从beca无冲突快进本地main；D盘仍为codex/xiaozhi-composer-template/38c1f06及其新未提交现场，未切分支、未接管、未push。最终build/typecheck、240组件与同冻结out的12项原生/UI通过，指纹18715c90；实际Pi任务6、旧任务19及独立最后P2两反例闭合。本段仅状态文档更新并随本地主线收尾，不新增运行产物或缩小完整Goal。

Git：D:/WorkProject/EduProject当前codex/xiaozhi-composer-template/38c1f06，新未提交启动/样式与状态文档保持原样，不接管、不push；本片只在beca工作树将功能分支收尾快进本地main，实际SHA见下方收尾记。


<!-- kb-enrichment-read-20261027:start -->
## 2026-10-27 S6-C：缺答题专用实读，完整Goal仍ACTIVE

代码：现education_search_questions/read_question新增可选purpose=answer_enrichment；本地候选SQL先过滤空答案/解析，逐题检查明确missing和题面完整性，沿用原件强验及原检索的chunk/页隐私、bodyVersion、source revisions、facts digest和filterCurrent。补答别名绑定用途，不登记下游observedQuestions；裸文本缺图/表拒绝。offset只在此用途允许0..1000000，按实际scanned续页；超界明确continuationLimitReached。没有新表、依赖、IPC或写库权限，默认archiveEligible/向量资格保持原样。

先行RED检查点：0df468f（目的参数拒绝）、ed770bb（真实混合查询预先排除缺答）、ea4df9d（镜像冲突伪装空库）、8d4fc3f（真实Electron中51完整题遮蔽）、9ac8f0f（独立隐私/用途/缺图反例）、ec6fdb1（缺图候选之后不可继续）、25dfa25（小批分页跳题）。RED均实际运行后提交；新探针最初静态import早于Node hook与错误file_path列属设置错误，修成动态import及真实local_path后才计证据。不得把测试设置失败当产品RED或修改生产校验来放行。

专项终态（源码）：

- `node scripts/education/question-enrichment-read-boundaries.mjs` exit0，15项，`apps/desktop/test-results/goal/kb-enrichment-read-final.log`。实际SQLite事实+现Pi工具定义，严格参数/原件/隐私能力缺省拒绝、明示missing、用途别名、缺图、脱敏中改题、取消/失效、镜像冲突、12/52可读候选limit2不漏不重。
- `node scripts/education/question-enrichment-native.mjs` exit0，7项，`kb-enrichment-native-final.log`，报告 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-enrichment-native-fUgbHK/report.json`。真实Electron内OmniEduStore导入Markdown→原件复制→SQLite题本/FTS→实际Pi工具实读→Store关闭重开→原件变更拒绝→正确bodyVersion的私密chunk仍拒绝；51完整题和51缺图候选均参与。此处是Store重开，非冷进程教师UI或真实模型验收。
- 独立AI先确认1P1/3P2：私密来源漏检、用途别名降级、缺图题放行、50候选遮蔽，报告 `C:/Users/ZhouXuan/AppData/Local/Temp/question-enrichment-critic-19ed6d3a1b6c44daa14db4f27a725681/report.json`；修复后8组回放闭合，又发现分页跳题P2，报告 `.../question-enrichment-paging-cace74590dcc4d5faa4c475aee7ffee3/paging-report.json`。末次修复独立12/12通过，报告 `.../question-enrichment-final-replay-71ffb10aa94f4766985b9a49ce09be63/report.json`；限定范围未发现新增确定P1/P2。独立回放使用真实SQLite/检索/来源与工具，未build/启动Electron。
- 新准入模块 `shared/question-answer-enrichment.ts` V8有效区间行覆盖100%、执行区间26/26。`kb-enrichment-coverage.json`仅覆盖该新模块，区间比例不是Istanbul分支覆盖，不能外推全部消费者。

兼容门禁：`npm run test:smoke`已正常exit0，ok=true，207项历史兼容/30学生夹具，日志 `kb-enrichment-smoke.log`；该中间冻结构建含用途/隐私修复，但分页末次scanned修正随后才进入最终build，不能称最终构建207项全部复跑。`node scripts/education/capability-boundary-smoke.mjs`已修复本片相关的镜像冲突、脱敏期间源变和未知host异常被吞成空库问题；最终运行完成304项后在未改动的material-preview-boundaries.mjs:24因source_changed失败，`kb-enrichment-existing-boundaries-final.log`，不是全套通过。独立执行相同未改动预览夹具也失败：其resource stub缺少已要求的contentHash，`kb-enrichment-preview-baseline.log`；四个对应生产/测试文件相对3d3c630无差异，不削弱原件版本校验来过旧夹具。

`npm audit --json --fetch-retries=0 --fetch-timeout=15000`成功返回审计数据：仍21项（8high/5moderate/8low/0critical），`kb-enrichment-audit.json`；未新增依赖，不宣称漏洞已清零。最终build/typecheck/组件及Git结果在本节末追加。

真实边界：完整浏览器题解→同题匹配→持久web来源/候选→CAS只补缺角色→同题本/小智复读尚未实现，不可声称“联网补答已入库”。不调用ArchiveEdit伪装teacher，不上传真实题图/整库，不运行真实付费provider。S6-B2业务AI图片账本及全Goal中的40GB、自然召回/答案正确率、最终EXE仍待继续。

最终源码门禁：`npm run build` exit0（含tsc），`kb-enrichment-final-build.log`；`npm run test:renderer-components` exit0、240/240，`kb-enrichment-final-components.log`。最终out完整指纹 `02968f976a5e6e7cfc07c29954f2c48f725f2193dc1bcfdc216fca180978431d`，main SHA `66356c3ae9e418161f7d5f93eba35d1fed9f0e70cdd9aa4114bdece8dbf1668c`；已确认实际bundle包含scanned续页末次修复。无后续源码改动，`git diff --check` exit0。207中间兼容回归未冒称此最终指纹的再次验收；没有终止其它AI/用户进程，本轮旧测试进程在终态读取前已自行正常exit0。

Git：已在beca工作树切换未被占用的本地main并快进整合到源码GREEN `15b410285ee51c0647d2c870be0f7fcedf826470`，无冲突，随后返回codex/knowledge-base-delivery。D盘仍是codex/xiaozhi-composer-template（其HEAD为3d3c630）且保留新未提交附件区源码/状态文档，未在D盘执行任何修改/暂存/切分支/合并。D盘运行分支尚不包含本轮新增实读功能，不能把本地main已合入说成其运行页面已升级。文档收尾与源码保持同一本地main；未push/发布新EXE。
<!-- kb-enrichment-read-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 S6-B2原生协议前置及S6-C成熟DOM复用

完整Goal仍ACTIVE。用户新增内置浏览器搜题/解题/答案解析回写，并明确询问DOM成熟方案。已核Playwright MCP/Stagehand/browser-use/Mozilla官方仓库，选择直接复用现Hana v0.450.0 DOM/ref执行层＋Mozilla Readability0.6.0正文提取；不新起独立浏览器/Agent/部署服务。研究对比与完整后续流程见现有research/KNOWLEDGE_BASE_DELIVERY_PLAN_2026_10_24.md增量，详细合同见KB_IMPLEMENTATION_CONTRACT.md S6-C。

### 已写源码与准确边界

S6-B2提交6d2cc9b/a10f1d5、7e18c50/becdbc0/b5fc95d：新增archive v3/独立NativeQuestionDocument、当前角色镜像、源contentSha身份及shared presentation。模型不能借教师v2授权；不同原始图文不按同stem误合组，字体截图重排不制造新题。业务图片账本仍未实现，e3c8aaf提交的kb-native-ledger-boundaries.mjs是已实际执行的缺类RED；后续producer/OCR/两阶段/同库/Pi/导出接线不能据共享协议通过称已完成。

S6-C：直接复用Mozilla原始89980B（SHA34dcab3d0832d0019f02990eed6b6124e029e8c32b9f0c6f2550544ff8dff174），静态编码字符串未修改上游算法，Apache LICENSE/source-manifest随构建复制；.gitattributes固定LF。browser-extract-script.ts清理活DOM克隆，在isolatedWorld1005执行；现office_browser.extract与shared枚举、Pi工具定义及运行来源readback已贯通。指定最新ref/snapshotId的区域保留可见文字；整页Readability筛选有lossy标记，与truncated分别记录。源/输出预算、URL/revision/取消/脱敏守卫保留；文字SHA和图(含SVG)/式/Canvas/登录提示进入回读摘要。纯文本返回，不渲染Readability HTML；没有新npm依赖或额外Chrome/Python。

这仅完成成熟DOM取数前置。长期网页来源账、缺答专用读取/可操作补全入口、逐站适配/限域人工接管、题面匹配、两阶段答案核对和CAS自动补空尚未完成。没有向真实搜题站发送教师题目，没有provider计费/登录/付费绕过；临时问题入库需独立幂等身份，原有教师答案/答案图不可覆盖。

### 实际门禁（cwd均为本checkout/apps/desktop）

| 精确命令 | 结果 / 日志 |
| --- | --- |
| `node --experimental-transform-types scripts/education/kb-native-question-boundaries.mjs` | 6契约/镜像/资格/身份通过，kb-native-contract-reviewed.log |
| `node --experimental-transform-types scripts/education/kb-native-content-identity.mjs` | 4源内容/字体截图身份通过，kb-native-content-identity-final.log |
| `node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs` | 旧AI批次16组通过，kb-native-question-legacy-ai.log；受控provider |
| `node --experimental-transform-types scripts/xiaozhi-agent/pi-browser-extract-boundaries.mjs` | 最终10组真实锁定Readability/jsdom，kb-browser-extract-visibility-green.log；不是原生CSS/网站自然正确率 |
| `node scripts/xiaozhi-agent/pi-browser-extract-native.mjs` | 最终8项真实Electron/WebContentsView/isolatedWorld、当前Pi工具definition.execute、动态DOM、SHA/脱敏/图式/隐藏CSS、1366/1920、导航变化与取消；kb-browser-extract-native-final.log；test-results/xiaozhi-agent/pi-browser-extract-5ff7QZ/report.json。HTTPS为主进程安装的合成协议夹具，非真实网站/provider或自动写回 |
| `node --experimental-transform-types scripts/xiaozhi-agent/pi-browser-extract-readback.mjs` | 3项新原生tail正文/元数据回读，kb-browser-extract-readback-reviewed.log；完整性匹配仍needs_human，不证明数学正确 |
| `node --experimental-transform-types scripts/xiaozhi-agent/pi-result-readback-boundaries.mjs` | 原回读28通过，kb-browser-extract-existing-readback.log |
| `npm run test:renderer-components` | 240/240，kb-browser-extract-components.log |
| `npm run build` | exit0含tsc，kb-browser-extract-build.log与kb-browser-extract-build-reviewed.log；后者之后的root/style/svg修复由下述最终test:smoke再次完整build |
| `npm run test:smoke` | 最终exit0，ok=true/207历史兼容项/30名隔离学生，kb-browser-extract-smoke.log；从最终build到正常退出out未重建。历史legacy路径不是全部当前Pi或真实网站验收 |
| `node scripts/xiaozhi-agent/reuse-mozilla-readability.mjs --verify --release` | 源码/许可/发行清单逐字摘要通过，kb-browser-extract-license-final.log；仍未发布NSIS |
| `npm audit --json --fetch-retries=0 --fetch-timeout=15000` | exit1，npm bulk advisories TLS握手前断开，kb-browser-extract-audit.json；未声称审计通过或告警清零，无新依赖 |
| `git diff --check` | exit0；收尾提交/Git实况另核 |

最终out完整指纹f836cebfdd23f2dc26c59d07e44da4205cd385a7edae96eb7ba87b4c6de7aae8，main SHA256 fd923182dbdd161dae6486ca06834258be34d2187bf5ef5672e2b07d681f8fc0，renderer index-EV0rczuu.js。最终smoke正常退出后复核同指纹，不把源码native独立探针冒充整个编译产物中的真实Pi模型调用。

### 独立批判及保留失败

独立探针原目录C:/Users/ZhouXuan/AppData/Local/Temp/browser-extract-critic-a2b872a0371d418e8f88f0efa8d84815：P1隐藏根/祖先泄露（脱离父节点clone.remove无效）；P2Readability静默删comment-answer；根公式/表格处理遗漏；content-visibility/closed-details隐藏正文；SVG图义无缺口。3708af0、0625283、9b55046分别先执行RED后修，bbe9e91/c718d83修复；独立复放15/15闭合，报告browser-extract-replay-cec95f3657b74b87b90f1d1dcd53d20d/report.json，限jsdom，不冒充原生浏览器。最终native8项补了真实CSS与工具定义；隐藏数据不进入返回，选中区域表/式/图自身正确处理，Readability省略明确lossy。

初次extract-native父目录不存在、敌对getComputedStyle在navigate的旧snapshot阶段提前抛错、executeJavaScript返回函数不能structured clone、Readability整页合理省略可见summary导致过强断言，均为探针设置/预期问题；保留对应red/first/second/final旧实例，最终用lossy判断省略而不放宽隐藏数据拒绝。脚本模板Readability同名变量、换行字符串转义，以及jsdom对MathML computed style的实现差异，分别修复后再验证。来源字节校验生成wrapper保留上游原始内容，没有手改上游函数。

`--experimental-test-coverage`对browser-extract-script.ts报100%，但只覆盖脚本构造函数；脚本字符串在DOM中eval的分支不在Node插桩范围，因此不将该数值报作提取算法或全产品覆盖率。原生契约先typecheck两处unknown收窄错误已修，后续build含typecheck通过。原生身份fixture改SHA须同时改wa_id与canonical闭包，becdbc0时仍失败，b5fc95d修合法fixture后4项通过，未重写历史冒称更早GREEN。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 S6-B2 原生角色图稿、崩溃修复与main整合

实际交付：教师按题视图生成/取消本机题面、答案、解析PNG，独立角色/来源/环境与字节校验；完整原生公式、原图和表格分页，超高/超宽明确拒绝。仅派生缓存，不授予AI自动定稿或教师确认/正式试卷权限。完整S6-B2 archive v3/AI图片账本及同库/检索/Pi/正式出卷仍OPEN。无新增依赖、外部服务、上传或付费模型请求。

代码检查点ff1760a，独立批判后修复bf6b3e4/df2028e/49532c9，合并e2b91a4。用户明确授权接管D盘未提交启动修改后，先保存85011d6；13份状态文档冲突均是双方独立新增，保留两方全文，业务源码无冲突；D盘main真实快进e2b91a4。其他未跟踪截图/浏览器记录/.claude/skills保留，未push。该合并前的构建不得冒充合并后renderer验收。

工作目录为本checkout/apps/desktop，专项均不使用正式教师数据。

| 精确命令 | 实际结果与日志 |
| --- | --- |
| `npm run build` | 整合前exit0含typecheck；kb-word-proof-recovery-build.log；main bundle f49966282b259e834c0fa5079133998b09daeb645bd5bbb19dbaf70c22cef860 |
| `npm run test:renderer-components` | 整合前240/240，kb-word-proof-components-recovery.log |
| `node --experimental-transform-types scripts/education/kb-word-proof-boundaries.mjs` | 12组实际DOCX/静态HTML/分页/合并表，kb-word-proof-layout-merge.log；完整尾行、rowspan、不隐藏continue内容 |
| `node --experimental-transform-types scripts/education/kb-word-font-boundaries.mjs` | 5组已装Windows字体cmap；包含在覆盖日志；不保证任意复杂数学符号布局正确 |
| `node --experimental-transform-types scripts/education/kb-word-proof-repository.mjs` | 11组实际SQLite/文件/CAS/提交取消/32份LRU；受控PNG生产者；kb-word-proof-cache-reason-green.log |
| `node --experimental-transform-types scripts/education/kb-word-proof-ipc.mjs` | 8组实际registrar/受控host：来源、frame、任务slot、取消、退出与cache_unavailable；kb-word-proof-ipc-cache.log |
| `node --experimental-transform-types scripts/education/kb-word-proof-recovery.mjs` | 3项实际子进程exit(79)→新进程恢复、第二进程真实Windows锁、释放后恢复；root omni-word-proof-recovery-aMMRbo，后续覆盖运行另建实例 |
| `node --experimental-transform-types scripts/education/kb-backup-boundaries.mjs` | 4项实际sqlite3在线备份/冷读、两类在用独占锁、保留原件/word-assets/活库；kb-word-proof-backup-green.log；root omni-edu-backup-merge-S72H7M |
| `node scripts/education/kb-word-proof-render.mjs` | 修复前片最终6项，真实独立Electron/图像解码/42行末片由冻结本地OCR读出TABLE TAIL 042、实际取消销毁；kb-word-proof-render-tenth.log；test-results/word-proof-render-BmFcnE/report.json |
| `node scripts/education/kb-word-proof-journey.mjs` | 整合前最终6项/2启动/0rendererErrors、1366/1920，真实文件夹→Word源→SQLite/PNG/角色/表尾、释放缓存提示重建、实际停止、坏缓存冷恢复；kb-word-proof-journey-recovery.log；C:/Users/ZhouXuan/AppData/Local/Temp/omni-word-proof-ui-3nzbRc/report.json |

覆盖精确命令：`node --experimental-transform-types --test --experimental-test-coverage --test-coverage-include=src/main/assets/word-question-layout.ts --test-coverage-include=src/main/assets/word-font-coverage.ts --test-coverage-include=src/main/assets/word-question-proof-repository.ts --test-coverage-include=src/shared/material-word-proof.ts scripts/education/kb-word-proof-boundaries.mjs scripts/education/kb-word-font-boundaries.mjs scripts/education/kb-word-proof-repository.mjs scripts/education/kb-word-proof-ipc.mjs scripts/education/kb-word-proof-recovery.mjs`。kb-word-proof-coverage-final.log exit0，5个脚本/39组断言，0失败/0skipped；四个指定新领域总100%行/80.99%分支/95.74%函数。字体100/80.49/100，layout100/84.62/100，仓储100/83.44/93.33，共享协议100/66.67/93.75。不是全项目、真实renderer/UI或自然题目覆盖率。

独立批判真实反例：进程在写入三张PNG、尚未SQLite发布时exit(79)，旧版新进程仍保留3孤片；kb-word-proof-recovery-red.log为真实RED。修复加入每根串行门+Windows独占锁，仅删除私有v1内精确普通无引用SHA.png/.pending-UUID，最多4096条/超时取消；渲染不持锁。独立复查报告C:/Users/ZhouXuan/AppData/Local/Temp/word-proof-recritic-748fd9b9be9e4cecb44b6b971c4febd6/recovery-verdict.json，原P2闭合，无新确定P1/P2，未将其只读审查称构建/Electron证据。

备份引入锁后实际copyfile EBUSY的RED保留kb-word-proof-backup-red.log；修复精确省略cache/word-question-pages，仅在导出DB副本清除两张派生表，原件/其他缓存/活库保留。LRU/坏PNG误报source_changed的RED保留kb-word-proof-cache-reason-red.log；现提示cache_unavailable且UI从真实操作恢复，不要求教师重解析未变的原文件。

截图失败与修复：设备模拟先置导致Chromium崩溃，普通隐藏窗口/150%缩放导致逻辑1709px与实际1019px截尾；曾错误尝试尺寸修正，真实尾行OCR揭露不完整，最终禁止拉伸。现在私有离屏deviceScaleFactor=1、load后setContentSize(1320,1900)、逻辑平移切片、精确PNG尺寸及实际尾标OCR。原first至ninth失败日志保留，最终tenth通过；动态import在app.evaluate不支持属探针配置，已用bootstrap加载冻结OCR并明确字段text，非模型失效。超1760px单段/合并行目前明确拒绝，长阅读材料需要后续安全细分，不称无限制排版。

### 合并后的必要门禁（本轮实际收敛）

- `npm run build` exit0，kb-word-proof-merge-build.log；包含typecheck。整合后完整out指纹为c58e043b7a3a8b4c7126e5ec419c51b70b0bdc0d578481cba7353d2cc8469a03，renderer index-y8KJjPTg.js。main仍f4996628，因协作者只改renderer，不能用单一main SHA冒充整合证据。
- `npm run test:renderer-components` exit0，240/240，kb-word-proof-merge-components.log。
- `node scripts/production-bootstrap-ui.mjs` 最终exit0，9/9、0rendererErrors、0skipped，kb-word-proof-merge-bootstrap-final.log；test-results/production-bootstrap-1LdWcU/report.json，build指纹同c58e043b。
- `node scripts/education/kb-word-proof-journey.mjs` exit0，6项/2启动/0rendererErrors、两尺寸；kb-word-proof-merge-journey.log；C:/Users/ZhouXuan/AppData/Local/Temp/omni-word-proof-ui-WIYpqr/report.json。完整out指纹同c58e043b且结束复核未变；只有测试脚本增加指纹守卫，没有修改产品源码。
- `npm run test:smoke` exit0，ok=true、207/207历史兼容路径、30名隔离学生，kb-word-proof-smoke-final.log。针对预整合固定out/index-R872Bpm1.js，执行期间未重建；正常退出后才重新build整合renderer。不是整合后全套Pi、真实provider或自然教师验收。
- 独立AI仅源码复查整合：App与85011d6一致；Word入口/typed取消/drain无交叉变更；13份冲突相对双方父提交均新增保留、无删除/冲突标记，无新增确定P1/P2。其未构建/启动Electron，与上述运行证据区分。
- `npm audit --json` 本轮重查exit1：npm bulk advisories请求TLS握手前断开，kb-word-proof-merge-audit.json同时含npm告警而非纯JSON，后续ConvertFrom-Json失败；不能称新审计通过。此前同依赖基线kb-word-proof-audit.json为21（8high/5moderate/8low），无自动升级/清零。
- `git diff --check` exit0，无未解决冲突。用户授权接管的协作修改已提交，截图/浏览记录/.claude/skills仍留在D盘未跟踪，未push。main源码已真实整合；D盘日常out与旧EXE未作为本轮最终构建验证，不声称现有已开窗口或安装包更新。

保留整合首次启动专项7项后2!==1失败：production-bootstrap-MRio4g/report.json、kb-word-proof-merge-bootstrap.log。legacy初始app-shell显示时bootstrap未完成，清计数后混入刷新前knowledge请求；现先完成一轮受控刷新直到末次pending-input响应/dialog，再清计数正式刷新，原各IPC严格1次断言不变。最终9项通过，不将测试时序失配误写成新生产缺陷或放宽门禁。

完整Goal继续ACTIVE。新安装包、真实provider/40GB/自然召回及冷启动P95仍未验收，下一实现位置为archive v3 AI原生文档、独立正式图片账本与同库/Pi/正式出卷消费者。
<!-- kb-word-proof-20261027:end -->

## 2026-10-27 S6-B2 原生Word按题来源基础（完整AI图文链路仍进行中）

最终实现检查点95394d7（含c4656cb列表边界、1e8fcd7分页图片、兄弟key修复），最终bundle SHA256 **ad1ac1e6e85ed9f983a5572c0c2423695dc161bfa558cf523d429d108f397843**。教师从资料Word原文进入“按题查看 Word”，查看按真实节点/范围分出的题面、答案、解析，保留原图/公式/完整表格，超限和歧义明确可见。没有新依赖、DDL、付费调用或上传；原题事实/正式卷教师确认不变。

| 精确命令（cwd=apps/desktop） | 结果及边界 |
| --- | --- |
| `npm run build` | 最终exit0，含typecheck；`kb-word-native-reviewed-build.log`，上述ad1ac1e6 bundle。 |
| `npm run test:renderer-components` | 最终exit0、240/240；`kb-word-native-reviewed-components.log`。 |
| `node scripts/education/kb-word-question-boundaries.mjs` | 最终24组通过；真实合成DOCX到公式/表/图范围，角色隔离、同段多题/答案图、选项/步骤/页眉、共用图、独立答案章节、版本/范围/投影篡改、UTF16、千题尾部与超限。覆盖运行另含此全部断言。 |
| `node --experimental-transform-types scripts/education/kb-word-question-repository.mjs` | 实际SQLite和真实IPC registrar的6组通过；不是仅mock SQL。所选题/摘要有界、source/version/digest双读栅栏、非法输入及frame拒绝。原报告Fm46Vo/VaI551/Q0wS23及最终coverage输出保留。 |
| `node --experimental-transform-types --test --experimental-test-coverage --test-coverage-include=src/main/assets/word-question-source.ts --test-coverage-include=src/shared/material-word-question.ts scripts/education/kb-word-question-boundaries.mjs scripts/education/kb-word-question-repository.mjs` | 最终exit0，2个顶层脚本/30组业务断言；无fail/cancel/skipped。两新领域模块100%行、89.07%分支、98.61%函数，`kb-word-native-reviewed-coverage.log`。不称全项目或renderer覆盖。 |
| `node --expose-gc scripts/education/kb-word-question-load.mjs` | 最终exit0，2000个共用段/4000题，GC后index retained 3371536字节、建立27.97ms；尾题超限可见。修复前162178312字节/603.42ms且80MiB门槛失败，`kb-word-native-load-red.log`；最终`kb-word-native-reviewed-load.log`。仅单文档原生结构探针，无OCR/AI/整库吞吐结论。 |
| `node scripts/education/kb-word-question-journey.mjs` | 最终exit0，5项/2启动/0 rendererErrors，两尺寸；`kb-word-native-reviewed-journey.log`，报告`C:/Users/ZhouXuan/AppData/Local/Temp/omni-word-native-ui-kPOGrR/report.json`。实际目录导入/utility/SQLite/typed preload，题面公式、答案PNG准确解码、角色隔离、完整表格与尾题、同段六图分页逐图SHA字节一致、冷读相同digest。 |
| `node scripts/education/kb-word-journey.mjs` | 最终exit0，5项/3启动/0 rendererErrors；`kb-word-native-existing-word-reviewed.log`，报告`C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-word-zANa0b/report.json`。原文当前5块恰好一次，保留原Word升级/隐私/旧题不改/取消/坏图拒绝和幂等修复。 |
| `npm run test:smoke` | exit0、ok=true、207项历史教育兼容；`kb-word-native-smoke.log`。本次运行启动时为a14be2e4构建，执行期间Word专项修复并重建out，可能跨进程装载不同构建，故仅记录兼容辅助，不作为单一冻结最终ad1构建验收；最终Word闭环另以上两条独立脚本证明。 |
| `npm audit --json` | exit1、21项（8high/5moderate/8low）；`kb-word-native-audit.json`。本轮无新增依赖，未擅自升级或将风险写成清零。 |

独立审查实际找到并促成修复：题前共用图丢失、解析步骤误造题、手工括号漏题、冒号答案册误识别、合并答案标签把图放进题面、整原段图片预算误拒、空正文页眉造题、数字选项未延续列表、片段分页显示旧图。最终来源强校验/预算反例独立收敛，报告根`word-question-final-review-CXLNIw`及`word-question-recritic-w90oJA`；图片React/JSDOM限定复核`word-ui-final-review-92x6ul`另通过，不能替代Electron。最终第1题选项复核与模块限定接受见代理消息，不将未发现新的P1/P2表述为全产品无缺陷。

旧入口E2E额外复现同级key=0冲突，原文5块被挂载成10块（`kb-word-native-duplicate-red.log`/BBCGwZ）；改为独立key namespace后最终旧入口5项通过。首次仓储普通node只因已有TS参数属性报错，修正`--experimental-transform-types`后才确认业务RED；首次图片反例因不明确题号提前计数失败，使用明确第8题后实际复现旧图，Ag4z3g。原失败保留，不改写成全部首次成功。完整TDD检查点在本分支可追溯。

**没有完成的必做部分**：S6-B2 archive v3 AI原生文档、独立AI图片账本、按角色本地PNG布局、两阶段完整AI投影、同题库编辑、identity/facts/语义索引/Pi完整上下文和正式图文Office导出。现有AI仍主要为文本资格，来源预览不会自动改变旧题资格。独立答案册/跨页配答、本地视觉包、自然教师召回/准确率、百万级冷延迟/40GB长时与最终Windows EXE仍OPEN，完整Goal ACTIVE。

Git范围：上一轮本地main=fb6f37d，本轮位于codex/knowledge-base-delivery。收尾时D盘main有协作者production-bootstrap的App.tsx/脚本及状态文档未提交改动；未stash、覆盖、代提交或强行移动在用main，尚未将本轮快进main，未push。后续待协作者提交再做正常合并及冲突处理。

## 2026-10-27 S6-B1 DOCX 原文结构（限定实现，完整 Goal 继续）

2026-10-27 Git源码收尾：独立审查修复提交 0652500325ad1413c9cc4dc0debf8f7aafb4894b；本地main已从协作者8dec132快进到该提交，包含27f0081/436ef78及两项P2修复。D盘main与beca知识库工作树均已核实干净，未push、未发布EXE；本条文档收尾提交也将快进本地main。整体Goal保持ACTIVE。


实现检查点 `27f0081`；整合协作者 `main 8dec132` 为 `436ef78`，无新冲突，保留输入框/附件及事件日志改动。仅本地 Git，未 push；最终 main 落点以下方收尾记录与 Git 实况为准。

教师可见：从“添加文件夹”导入 DOCX，查看自动题号、公式、原图、段落与表格，翻看表格所有行；旧 Word 可显式重新整理并停止。正文/FTS/结构在同一版本事务发布；原有题库事实保留，旧来源拒绝复用，隐私标记保留。Word 不生成打印页码，未理解的图文不会自动获得完整题目资格。

| 精确命令（cwd=apps/desktop） | 已完成结果/证据 |
| --- | --- |
| `npm run build` | 最终批判修复后 exit0；`kb-word-reviewed-build.log`。最终 main bundle SHA256 `637d1ea68ec3b6741bf276513d10a386c55b29e0dc97401c467bd2ff533a2278`。 |
| `npm run test:renderer-components` | 最终修复后 exit0、240/240；`kb-word-reviewed-components.log`。 |
| `node scripts/education/kb-word-boundaries.mjs` | 最终 exit0、14组，独立复验同样通过；真实合成DOCX/ZIP/XML、原式/分数/下横线、原图SHA与重复图、完整表格、外链不抓、DTD/超限拒绝、未知数学显式不完整、文本框、关系命名空间、身份去重、样式继承题号、行/单元格内容控件。`kb-word-boundaries-reviewed.log`。 |
| `node scripts/education/kb-word-journey.mjs` | 最终修复后 exit0、5项/3次启动/0 rendererErrors；`kb-word-reviewed-journey.log`。证据根 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-word-eK69Ti`。本次DOCX包含内容控件包装的行和单元格；真实受管utility、typed preload、1366/1920 UI、SQLite原图字节与来源回读、旧正文升级/原题不变/隐私不减、键盘取消、损坏图片拒绝与幂等修复，均无mock parser。 |
| `node scripts/education/kb-word-job-boundaries.mjs` | exit0、5组；`kb-word-job-boundaries.log`。实际IPC registrar配受控可取消host，覆盖切换查询、版本取消守卫、终态/新jobId与外来renderer拒绝，不冒充真实parser/UI。 |
| `node scripts/education/kb-word-job-journey.mjs` | 最终修复后 exit0、1项/0 rendererErrors；18,000段DOCX从文件夹真实导入，再重整→切换A/B/A→恢复进度/取消→保留相同正文ID/内容摘要。`kb-word-job-journey.log`；报告 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-word-job-zlNLgR/report.json`。 |
| `node scripts/education/kb-critical-archive-boundaries.mjs` | exit0、12组；`kb-word-archive.log`。 |
| `node --import ./scripts/office-agent/register-source.mjs --input-type=module -e 'import {materialQueueBoundaries} from "./scripts/education/material-queue-boundaries.mjs";let passed=0;await materialQueueBoundaries(async(name,run)=>{await run();passed++;console.log("PASS "+name);});console.log(JSON.stringify({passed}));'` | exit0、19组；`kb-word-queue-final.log`。 |
| `npm run test:smoke` | 批判修复前整合构建 `6ab24ca8...` exit0，ok=true、207项历史兼容路径（含12项备份）通过；`kb-word-integrated-smoke.log`。不能写成最终修复构建重新全量运行；之后仅Word表格/任务状态修改，用最终build、组件、解析/任务边界及两条真实Word桌面路径复验。该历史路径不等于当前Pi/视觉AI/provider验收。 |
| `npm audit --json` | exit1、21项：8high/5moderate/8low，尚未清零；`kb-word-audit.json`。没有自动升级大版本。 |

初次 Word Electron 3项后失败（`kb-word-journey-first.log`）：小文件重整完成得快于点击稳定性等待，取消按钮已移除，实际键盘及时取消后最终5项通过。源队列脚本直接运行缺少loader，并且它只导出测试函数；改用loader+显式调用19组。样式继承反例首版误生成两个pStyle，修正成合法OOXML后通过；不将测试构造错误宣称生产bug。原失败保留。此前预备通过 bundle `ace6120c...` 与本次最终整合构建严格分开。

静态批判已补：不丢文本框/组内多图，数学语义属性不静默转成正确公式；嵌套表格按需展开并分页，图片走文件描述符限量读取及身份/SHA复验，临时文件原子发布；界面不以原始XML冒充教师可读原式。

独立AI批判实际发现两项P2，均已修复并再次独立限定接受：①合法Word行/单元格内容控件被静默跳过，原探针15→14行且首行丢失，修复后15→15、首行保留；合法容器展开不跨嵌套表格，修订删除仍有明确处理。②重整状态只在组件中，切换资料后丢失停止按钮；改为主进程持有最多64条状态、typed word-job 查询，重进恢复运行和取消、完成按jobId刷新、取消匹配源版本。独立复核已实际重跑14组/原表格探针，并核对18,000段真实UI报告及源代码，未发现这两项修复引入新的P1/P2；不是整个产品无缺陷证明。

未验证/未完成：自然教师资料质量、复杂公式/特殊编号/WMF/EMF完整还原、`.doc`与其他格式矩阵、Word视觉AI输入与完整题文/答案图表示、跨页/答案册配对、受管本地视觉模型、云端真实provider、40GB持续吞吐/召回与延迟、最新EXE/干净Windows。本片没有新打包和无系统依赖安装验证。下一片继续S6-B完整图文AI来源/资格，不把规则 `visual_unchecked` 改成自评通过。

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

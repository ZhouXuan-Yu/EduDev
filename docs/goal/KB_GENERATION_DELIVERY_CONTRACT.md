# KB002：混合/原创组卷与5道变式——实施合同草案

## KB002-B 实施冻结（2026-10-11，历史合同；本轮限定接受，精确结果见末尾）

- 教师结果：同一个 Pi 先检查候选；失败返回其原生工具错误，由同一运行修复。旧候选留存隔离，卡片展示修复前后关系；任何修复版仍需教师检查、核对和确认。
- KEEP现 Pi 原生 tool result/isError（已核对已安装 agent-loop.js）、DeepTutor格式worker、SymPy受限宿主、审核ledger、typed IPC、HeroUI ChatTool/Checkbox/Button。Pi upstream MIT；不增加 AgentLoop、模型调用器、依赖或DDL。DeepTutor/OpenMAIC的编排循环不迁入。
- 仅原生工具新候选使用 record.v4，沿用 quality.v2。payload保存主进程随机修复别名、attempt 0..3、父候选id/payload SHA/失败检查hash；不让模型提供本地id、hash、结果或权限。旧v1/v2/v3不改写，旧程序拒绝v4。
- 修复必须同session/run/student、相同实读来源版本和题数/题型。失败记录必须仍pending、当前末次检查仍是未修改原草稿且blocked、未被替换；教师编辑、拒绝、来源变化/停止使修复授权失效。已提交数学计划的题不能在修复版删掉计划逃避核验。
- 每个候选最多三次自动修复；末次失败保留给教师编辑/拒绝。这是质量修复边界，不是运行或token预算。工具同run尚有待修复失败时，漏别名不能另起无谱系候选绕过边界。
- 检查仍在写事务外；记录/修复/确认最终事务重新检查来源、状态、不可变payload、取消和父版本。已被替换候选不能再编辑确认，仍可查看、教师拒绝。确认后的题事实仍只由现writer创建，effect digest覆盖v4 payload和历史。
- 自动反馈仅错误代码、题序和本工具已提交计算，学生脱敏；教师编辑内容、原题快照、本地路径、学生id和ledger id不返回模型。重启可从同ledger回读谱系，停机不晚写、不自动重放provider。
- 修改范围：shared审核契约、repository/coordinator、现审核卡、专项/正式Electron测试；修改前副本test-results/goal/kb-repair-20261011/before。回滚只撤本片delta，不删除资料/ledger，不降级v4。
- 验收：同Pi错算→原生错误→修复→明确教师确认→冷启；漏/错/跨域别名、数学计划删除、源CAS、旧版本、重复/并发、取消、三次失败教师接管、旧v3读回；build/type、领域/组件、正式Electron及浅暗双尺寸视觉、兼容smoke、git diff --check。全部通过前不标B接受。

日期：2026-10-11。前置：S6-A真实自然物理100分图文交付收口。本文件不覆盖 Master，不代表任何能力已验收；依赖顺序以 KB_EXAM_ACTIVE_TASK 为准。

## 初始审查接缝（历史，当前进度见顶部与验收记录）

- KEEP：Pi production host、observedQuestions主进程别名、question-review-coordinator/repository、DeepTutor normalize worker、现 ai_confirmation_items、QuestionBank/来源版本、practice review、paper repository、Office 审批交付。
- 已确认缺口：paper-blueprint只允许source_only，paperSectionMatches排除generated；现变式必须至少1条实读父题，只做格式校验，教师确认后保存generated，没有数学正确性核验/隔离记录。不能把支持已有变式审核描述为已支持AI原创整卷。
- EXTEND：现共享合同、原review UI、现Pi工具/同一记录事务。ADAPT：生成题质量与来源检查、组卷选题资格。禁止新增完整Agent、第二题库或旁路导出器。
- 本地 C:\Python314 的 SymPy 1.14.0 可导入；Codex文档运行时没有SymPy。现worker以 -I -S 启动且只允许reading/learning/question，不能把开发机安装状态当成可打包能力，不能直接移除全体worker的隔离参数。

## 按依赖拆片

1. **KB002-A 质量合同/主进程检查**：冻结逐题质量状态、版本化结果与受限数学AST；格式、保守同题、父题来源/当前版本、答案冲突和可支持的确定性计算分开报告。公式到AST的条件转换也须核对，计算匹配不证明自然语言条件完整。未覆盖/失败明确返回，禁止模型自行填写verified=true。
2. **KB002-B 同Pi修复/隔离/教师审核**：复用现education_propose_questions与review card。失败题停留现候选ledger且不能写入正式题库；向同Pi返回可操作错误用于修复，不增加内嵌模型循环。每次修复保留前后版本与问题；超出有界修复次数转教师审核。教师改动后重新校验当前版本，旧核验失效；拒绝/停止/重启不晚写或重放。无法自动验证的主观题必须显式人工审核，不能套数学“通过”。
3. **KB002-C 三模式**：扩展现paper共享合同与选择器，保留旧v1 source_only读回。source_only缺题如实报告；hybrid明确本机原题与当前审核生成题配额；ai_original必须使用本次实际审核的原创批次，不能把旧题改sourceKind充数。原创允许无父题；变式必须保留实际父版本。生成候选通过现Pi入口与教师审核后才能参与确定性整卷，不在selectPaper内调用模型。跨student/session生成题资格必须由主进程核验审批归属，不能仅按sourceKind筛选。
4. **KB002-D 5道变式闭环**：实际错题确认→Top10/实读父题→同Pi起草5题→去重/校验/修复或隔离→教师逐题审核→现PracticeReview→正式练习→现Word/PDF→冷读。原题/生成题谱系、学生档案和实际作答分离，不能自动写成绩。

## 契约与迁移先决

具体shared类型、表/索引变化、IPC、输出上限、旧v1效果digest兼容和回滚范围必须在各片实施前补全本合同，不凭本草案直接跨模块重构。优先在现ledger存版本化核验/修复/教师审核记录，不创建重复事实真源。新依赖须锁版本、许可、体积与Windows打包核查；SymPy不可用必须降级为未验证，不能宣称正确。

数学候选采用受限JSON AST到SymPy对象，不接受Python、任意函数名或字符串eval/parse_expr。官方文档明确parse_expr使用eval：[SymPy parsing](https://docs.sympy.org/latest/modules/parsing.html)。超时、节点/次数/输出边界、取消及子进程退出需实际验证。答案核验范围与完整教学正确性分开。

### KB002-A2a实施冻结：本地数学计算宿主

- 本片先贯通共享计算合同→现教育Worker宿主→原版SymPy→固定构建资产与边界测试，不宣称已接通教师审核卡或完成A2。A2b再把计算计划绑定现题干/答案版本、Pi工具和教师条件核对；任何计算结果不自动改变学生事实或生成题质量为verified。
- 复用现`runEducationWorker`的四任务并发、5秒超时、取消杀进程、退出释放、输入输出限额与requestId。只增加固定math worker分支，仍以`-I -S -B`启动；固定目录仅加载锁定wheel，不读取开发机site-packages或传递模型密钥。没有独立FastAPI/Agent/任务数据真源。
- 版本`xiaozhi.education.math-check.v1`；受限JSON AST，最多128节点、12层，固定变量x；有界精确有理数、加/减/乘/除、整数幂和平方根。表达式检查只接收无变量常量；单变量多项式限定4次及实数/正数/非负域，变量分母、超越函数、一般几何/单位/开放性题均返回未支持。不能把代入某个根当完整解集通过；需对照完整实根集合，增根/漏根和候选无定义需实际测试。
- 结果仅`matched/mismatch/unsupported`，说明的是提交的形式化计算；`conditionsVerified:false`由主进程固定，永不对自然语言题目直接宣称数学正确。未安装/损坏依赖、超时/取消保留现明确错误，不用模型置信代替计算。
- 新依赖SymPy1.14.0 + mpmath1.3.0，官方PyPI纯Pythonwheel合计6,835,551字节；两者主许可证BSD-3-Clause，SymPy完整LICENSE另含上游补丁及所含第三方内容的MIT条款，完整实际文件已核对并保留。轮子SHA256对官方元数据，构建复制与运行时再核对；离线运行不要求pip联网。Windows安装器仍依赖项目Python供给，不能把开发机启动当完整安装验收；退出可移除math分支，原reading/learning/question保持隔离与协议不变。
- 新文件shared/math-check.ts、education/math-worker.py、math-host.ts和固定vendor/math资产；仅扩展worker-host、构建资产复制与专项测试，不改DDL、学生/题库事实。修改前副本保存于test-results/goal/kb-math-20261011/before。
- RED/GREEN含算术正确/错误、精确分数、正根、平方根未定义、完整/漏/增根、变量分母、巨大幂/深度/节点/伪造字段、重复JSON key/nonfinite、wheel损坏、取消/并发槽恢复和真实固定构建加载。通过后再进入A2b UI绑定，不标完整A2或三模式完成。

## 每片验收与退出

### KB002-A2b实施冻结（2026-10-11，尚未接受）

- 在原 `education_propose_questions` 增加可选 `mathChecks`，长度与items一致，逐题受限MathCheckInput或null；不改QuestionReviewDraft。计划由主进程绑定规范化题干、选项、答案SHA，模型/renderer不能提供结果或绑定hash。
- 新不可变ledger为question-review-record.v3/quality.v2；明确只读兼容既有v1/v2及quality.v1。新质量仍只有blocked/manual_review；逐题计算matched/mismatch/unsupported/not_run/basis_changed，conditionsVerified始终false。mismatch禁止正式写入；无支持或教师改题后只能显式人工复核，不沿用旧计算。可读计算式及对应关系必须显示在现HeroUI审核卡。
- 沿用同一账本、typed IPC、审核历史8版本和原题CAS；不增DDL/题库/Agent/模型调用。昂贵format/math在写事务外执行，保存历史及确认重新检查会话、来源、候选状态、不可变payload、取消；最终确认只使用当前draft绑定的宿主检查记录，不在写事务重复数学计算。
- 停止中止当前检查，退出/来源变更/拒绝不晚写；检查重复版本复用，历史/效果digest覆盖计算结果。回滚只撤新入口，保留新record，旧程序拒绝v3，禁止降级批准。
- 修改范围shared质量、education质量/审核repository/coordinator、现审核卡和专项/正式Electron用例；不触及真实学生资料。修改前副本保存test-results/goal/kb-math-review-20261011/before。
- RED/GREEN：原版无计算门槛；错误算术/漏根隔离、matched仍需人工条件确认、编辑废止旧结果、非法AST/伪造结果、取消/源CAS/并发事务、旧v1/v2冷读与幂等、正式Pi工具→当前卡→确认/拒绝/冷启。build/type、领域/组件及实际固定Electron；未过正式路径不得标A2b接受。

### KB002-A1实施冻结：质量审核/隔离底座（2026-10-11）

- 教师可见结果：现生成题审核卡增加“检查当前版本”、逐题失败原因及“已核对题干、条件、答案、解析”确认。修改任意草稿字段废止前次检查；未核对、检查失败、源版本变化不可入题本。数学未运行须明确显示，教师确认不转换为自动验证正确。
- KEEP现DeepTutor格式worker、questionContentIdentity保守同题身份、QuestionReview主进程/typed preload/API和HeroUI ChatTool。无新Agent、依赖、表或独立审核库。当前只比较本批候选及实读父题，不宣称整库语义去重。SymPy官方parsing/solver/license已核对，当前A1不安装/调用；受限AST及打包验收属于A2，不用手写符号系统替代。
- shared新增`question-quality.ts`，质量版本`xiaozhi.education.question-quality.v1`，主进程计算逐题格式、同批/父题重复与答案冲突；状态仅blocked/manual_review，无verified。`QuestionReviewInput`可带当前draft，走现`xiaozhi:question-review`检查；decision可带`qualityConfirmation:{revisionHash,reviewed:true}`，主进程重新计算、绑定当前session/id/student/source versions/draft及问题结果，不信renderer自己声明通过。
- 新proposal在现不可变payload增加host生成`qualityPolicy`。pending显式检查在现result_json保存最多8个不同检查版本的draft/quality/time，重复版本不增记录；超过上限要求拒绝后重新起草，不覆盖历史。confirm在同事务保存final quality、教师复核及效果digest，再写现question_bank_items；reject/stop零题库写入。最终effect digest覆盖质量审核，新旧v1记录分别验证，未知policy拒绝。旧已确认记录继续可读并显示“历史未记录质量检查”，不得倒写成已验证；旧pending仍需新质量复核。
- 本片涉及shared、question-review-repository/coordinator、现PiQuestionReview卡与领域/正式Electron脚本；typed preload沿用原通道类型，不加renderer直连。现original-question-review单独真实原题确认不受本片生成题策略替代。
- 完成门禁：先RED验证缺失确认、编辑后旧hash、重复/答案冲突、伪造结果、未知policy、8版上限、旧effect读回、源CAS/跨会话/取消与冷读；build/type、组件/领域、当前Electron真实DeepSeek→当前审核卡→失败/修正/确认/拒绝/冷启及浅暗双尺寸视觉。回滚只撤新增质量入口/策略，不删除已有ledger/题目；新增payload未知版本在旧程序须只读，不承诺旧二进制可继续批准新候选。
- A1通过仅解除质量记录/明确人工复核缺口；不代表数学自动核验、自动修复、hybrid/ai_original、5变式或完整KB002完成。下一片A2复用SymPy、受限JSON AST、超时取消/退出及公式条件匹配；之后B同Pi修复反馈和C/D三模式/变式。

2026-10-11 A1验收修正：原生checkbox受既有样式影响而放大，改为现Office原图审批采用的HeroUI Checkbox，正式1功能13项通过但视觉不接受。回滚审查另发现仅给v1 payload追加qualityPolicy不能阻止旧二进制忽略字段后批准；实施前修正为新proposal/effect使用`xiaozhi.education.question-review-record.v2`，API/Pi会话身份仍v1。新reader显式兼容旧v1未验证effect；旧reader因未知record版本拒绝新候选，不能降级绕过质量门槛。无DDL/旧JSONL改写。正式2为旧record版本中间证据，最终接受绑定修正后的冻结build。

先RED定位真实缺口，再type/build、现领域/组件专项、正式当前Electron、SQLite/文件读回、失败恢复和双主题双尺寸视觉验收。source_only既有受控与自然样本保留；模式缺额、跨会话/学生、源CAS、重复确认、修改废止旧核验、恶意AST、算术错/增漏根、主观题未验证、超时取消/冷启和拒绝零写入不可省略。记录精确build、命令、首次失败、截图与回滚，不把设计或未运行代码标完成。

完成KB002后转KB003后台增量/任务优先与30–40GB，最后安装/备份恢复/真实教师两闭环。通用聊天、学校平台及独立解题Agent不作为本专题前置。

## 2026-10-11 当前接受与下一片

- KB002-A1限定接受：固定build `392e50fb27e1fb5f99b61c6ed7c211da2d4eb6a79b3890a8171ed61fc05b3850`；正式13项/3启动、组件207、领域304、固定兼容smoke207、8原图双主题双尺寸视觉。精确见kb-quality-20261011/closeout.json。它不包含自动数学验证。
- KB002-A2a计算宿主已通过专项11、领域315、组件207与build/type；固定build `6e767f1078fcb3f899b0c49cb69ebbc017cc60226e3d658a74f92a57afef99b5` 的部署资产在实际Electron主进程及冷启计算通过。该验收通过编译测试适配器调用原生产宿主，不是已接通renderer/Pi工具或教师卡。首次Electron测试动态import callback失败已记录并改测试加载方式。未知代数结论返回unsupported，不用数值猜测判正确。
- **下一片A2b**：复用现候选草稿/审核历史/主进程质量token/typed IPC/教师卡。冻结数学计划与当前题干/答案的绑定，显示可读计算式与“条件、答案对应关系需人工核对”。计算mismatch阻止入题库；unsupported/未提交计划明确人工复核；教师编辑使旧计划/结果失效。公式AST不得成为第二题目事实源，也不得把matched转换为整题verified。
- A2b实施前须补全具体新record/policy版本及旧v1/v2历史兼容：旧程序须拒绝新策略；历史记录不得改写成已校验。昂贵计算在写租约外执行，落审核历史及最终确认重新做来源/状态/版本CAS，不在最终写事务内重复跑每题SymPy。取消不得晚写；同一检查版本重试不得增加历史。
- 之后B同Pi修复留前后版本/失败/教师决定、C三模式及D5变式真实交付；不得因A1或A2a通过把KB002/整个模块标完成。

2026-10-11 A2a接受后加固：检查发现次数限制原先在SymPy.Poly构造之后。`red-degree.log`实际证明8次式会进入Poly；现将保守次数准入放在幂/乘积/Poly构造之前，嵌套幂不能先展开超限多项式。最新接受固定build为`34cc8313e93f4a8e3db6f2eeb247ddce8cfc2e4769666f9588c1d92197a3252a`，专项12、领域316、组件207（renderer资产与前次逐字一致）、build/type与Electron/冷启2次通过。前次6e767...保留中间证据，不作为当前最终数学实现接受；完整精确结果见kb-math-20261011/closeout.json。

2026-10-11 A2b限定接受：固定build `1cf5044531baefe92d442dcb84144437ac8babfa79e5a567f10aa0a448fb42a0`/346文件。实际同Pi/DeepSeek提交mathChecks→现typed IPC审核卡→匹配仍人工条件核对/错误隔离→同SQLite保存→Pi重读/拒绝/停止/两冷启15项、3启动；领域323（接入专项18）、组件211、同hash兼容smoke207、双主题双尺寸12图实看、build/type/diff0。数学结果绑定不可变题面/答案hash；新record.v3/quality.v2保留旧v1/v2并拒绝旧程序绕过。format/math在写事务外，实际并发SQLite写与中途取消/零晚写已验，最终确认只用本版本宿主历史和来源/代际CAS。全题answerVerification仍not_run，逐题receipt只说明所提交计算，conditionsVerified恒false。首次RED、首轮过渡截图及修正后的正式路径保留于kb-math-review-20261011/closeout.json。B自动修复、C三模式、D五变式未完成；下一步冻结B修复alias/记录/取消合同，不把本片算成完整数学解题或KB002完成。

## 2026-10-11 B限定接受与C下一张任务卡

B限定接受固定build cb6c4fa0cddb525b93f9e1b8e09259424ee47ed6231ca1d767bf4c3692f4d0a0，build/type0、组件212、领域333（修复10）、正式17/3启动/0错误、双主题双尺寸16图实看、同hash兼容207、diff0。精准证据kb-repair-20261011/closeout.json。record.v4/quality.v2用同Pi原生工具错误修复，父失败版本/宿主别名/质量hash留同ledger，严格v1/v2/v3兼容。首次恢复提示缺数据而ask_teacher，补明确题干后重验；不是API或权限绕过。

C下一执行顺序：C1冻结并实现原创/变式草稿差别、无父原创及不伪造教材来源；C2当前教师session/student、本次批准批次及版本的确定性选题资格与hybrid配额；C3传统蓝图UI与Pi同入口三模式100分→教师预览→现Office Word/PDF→冷读，缺额/跨所属/源变更/拒绝停止/旧source_only回读及双尺寸视觉。具体record/shared/IPC/迁移版本先审再冻结，当前只是任务清单，不直接按草案跨模块改。之后D五变式和KB003。

数学仅提交表达式检查，conditionsVerified:false，整题answerVerification:not_run；hybrid/ai_original和完整自然数学、30–40GB、安装尚未验。Master保持ACTIVE，不标完整专题完成。

## KB002-C1 实施冻结（2026-10-11）

- 教师可见结果：同一 education_propose_questions 支持显式 generationKind=ai_original、sourceReferences=[]；缺省/variation 仍必须1–8个本轮实读父版本。原创不是扫描原题，不复用 kind=original（该字段属于教材原题确认）；生成题卡显示“AI原创·没有教材原题来源”。生成事实 sourceKind=generated，标签仅作展示，归属与审批真源仍为现 ledger。
- KEEP现Pi原生工具等待/错误修复、DeepTutor固定f07029格式投影、SymPy1.14.0、同事务题本保存、typed IPC和HeroUI ChatTool。新原创采用 question-review-record.v5，generationKind=ai_original、零父、quality.v2和原有宿主repair；历史v1–v4保持不改写，变式仍v4，旧二进制拒绝v5。修复不能在原创/变式间切换。无DDL/新依赖/第二Agent/新题库。
- 扩展shared summary/view的generationKind（和原题kind独立）、原repair模块常量、repository原生自动候选门禁及coordinator参数。修复/拒绝/待审根查询同时识别v4/v5，父payload/hash和模式绑定，不能借无父绕过取消/拒绝、伪造来源或修改旧payload语义。质量、历史8版、最终租约CAS和数学条件需人工确认保持。
- 新字段由主进程读取ledger投影；renderer不允许改来源类型；实际教师编辑仍废止旧质量token。最终effect digest覆盖完整payload及空父谱系。回滚仅撤v5入口，保留新账本，不能降级批准；修改前副本在kb-original-ai-20261011/before。
- 比较：A扩展当前工具/ledger（采用）；B迁入DeepTutor完整QuestionPipeline（有重复模型调用/Agent/存储，不采用）；C迁OpenMAIC课堂Quiz生成（本地标准目录不存在，当前上游许可核对，课堂DSL不代替题库审核，不采用）。复用现已核验vendored文件与NOTICE，不下载新代码/依赖。Pi工具协议用本机已装实现和官方上游核对；HeroUI现组件API核对，无新组件。
- RED→GREEN：空父原创实际失败→显式原创成功；缺省/变式零父/原创带父/未知类型/伪造字段拒绝；v4回读与重试不变；原生同run错误计算修复、模式切换拒绝、三次失败/拒绝/取消和冷读幂等；实际Pi/DeepSeek在空题库起草→现教师卡检查/编辑/确认→本题本→冷启，另拒绝/停止不写事实。build/type、组件/领域、关键路径smoke、浅暗双尺寸真实截图；未通过正式路径不标完成。
- C1只解决真实原创入口，不放开paper selector。C2必须绑定本次教师批准批次/归属/当前版本并明确hybrid配额，C3才验收三模式100分和Office交付；整个C及专题仍OPEN。

### C2审查接缝（C1正式9项通过后，尚未实施/接受C2）

- paper-blueprint.v1、paperSectionMatches、validSelection、paper coordinator当前均仅source_only。修改必须保持旧v1精确effect/digest读回，不能只扩大enum或移除generated过滤；选择器/预览/确认/withConfirmedSource导出最终CAS须使用同一资格判断。
- 现QuestionReview ledger保存生成类型、session/student/run、教师最终draft及saved题版本；tags和sourceTitle不是批准凭据。C2须重用同一effect校验，按明确选定的批准题组及每题当前版本核验，拒绝pending/rejected、替换旧候选、跨session/student、改写后的题和未知policy。原题source_only的筛选语义保持。
- 传统PaperBlueprintWorkspace新建蓝图时创建新会话；C2/C3要明确已批准题组的会话选择/导航与归属，不能把其它会话的生成题隐式视为本次批准。Pi云端仅使用宿主别名，不输出ledger ID、学生ID或hash。是否新增候选清单typed API及safe alias，实施前补全具体合同。
- 题型另有接缝：人工题本questionType为自由中文（如简答/解答题），生成题为六种固定枚举。先调查既有映射后冻结保守映射或明确选择合同，不用宽泛语义匹配静默改题型；更改不能破坏旧100分source_only版本。
- hybrid要逐部分显式原题/生成题数量与缺额，ai_original只用明确批准原创批次；选题不调用模型。当前C1零父原创可用，不代表三模式已接入或全题已验证。


## 2026-10-11 C1限定接受与C2执行点

C1接受绑定build 485613205e253c96dfd02fadcf9292305424cc57ccb29633aad3a4e24fe9f235/346文件：build/type exit0，组件213、领域338（修复专项15）、正式9项/3启动/2冷启/0renderer错误、浅暗双尺寸8图实看、同hashsmoke207。完整证据apps/desktop/test-results/goal/kb-original-ai-20261011/closeout.json。新原创record.v5与变式v4共享同Pi原生自动修复及教师审核，零父来源如实标记；不存在第二Agent或题库。C1只接受流程，数学计算matched不证明自然题全条件正确。

当前C2：先冻结批准题组归属/版本与混合配额，并把下述低操作负担要求作为C3的必备门槛。三模式整卷未完成，不能用C1已生成题替代C2/C3。唯一当前读点KB_EXAM_ACTIVE_TASK.md，历史A/B证据保留但不重复实施。

## 全学科与低操作负担基线（2026-10-11用户最新要求）

以下是后续实施及验收目标，尚未实现或测得；不改变Master Goal，不把覆盖目标写成当前能力。产品仍面向教师和小型教辅团队，聚焦资料、题库、组卷、错题训练。覆盖大学前实际课程学科，不能把数学算术用例扩称全科教育智能体。

### 1. 共同题目合同，按学科采用验证策略

- 学段、年级、课程/版本、学科、知识点、题型、难度、语言、题干/材料/小问、图片/表格/公式、答案/评分要点、解析、来源页/题号/父版本和确认记录沿用既有资料/题本事实源扩展，不另建学科题库。适用学段与学科要可配置，不假定所有学科各学段都开设。
- 结构必须容纳长阅读材料、共享题干、多小问、多图、跨页题和非唯一答案；不能为适配六种生成枚举而丢失题目内容，也不能用自由文本标签替代审核资格。C2先冻结保守题型映射和兼容，不一次重写所有合同。
- 数学和理科：可形式化部分使用确定性工具；还要核对定义域、单位、图示条件、完整解集、多问关联及物理/化学前提。当前SymPy仅支持有限表达式/低次代数，不据此声称任意几何或理化题已自动证明。
- 语文/外语/历史/地理/道德与法治/思想政治等：对照材料证据、标准答案/评分点、引用和任务约束；主观题不能显示数学式“已验证”。音体美、信息科技、通用技术、劳动/综合实践等使用相应课程任务与评分规则，不把无唯一解任务伪装成精确答案匹配。
- 无可靠依据、图形条件缺失、证据冲突或验证失败时保留原图和待审状态，集中提示教师。允许系统补充解析，但与教材标准答案分开标记，生成内容经独立工具或教师核对前不是金标准。

### 2. 代表性难题矩阵

| 学科组 | 必须出现的复杂案例 | 核验重点 |
|---|---|---|
| 数学 | 分式/根式/方程与函数综合、几何辅助线、多图多问、概率统计图表 | 完整条件/定义域/解集、图文对应、步骤可证范围 |
| 物理 | 电路/受力/实验装置图、运动图像、单位换算、多阶段综合题 | 图示连接/坐标单位、实验条件、多问衔接 |
| 化学 | 化学式/方程式、反应流程/实验装置、图表和计算综合 | 上下标/电荷/配平、守恒与条件、图示含义 |
| 生物 | 细胞/遗传示意、实验设计、数据统计和开放论证 | 标注与材料证据、可接受答案及评分点 |
| 语文 | 长材料阅读、古诗文、跨材料比较、论述与作文任务 | 材料完整、引用定位、评分要点及非唯一答案 |
| 外语 | 长篇阅读、语法/完形、图表写作、翻译与表达 | 语言/材料对应、可接受表达、评分规则 |
| 历史/地理/政治 | 史料/地图/气候统计、跨材料分析、开放论证 | 时空/图例/证据来源、材料约束、评分点 |
| 音体美/信息科技/技术及综合任务 | 乐谱/作品/流程图/活动设计或项目评价等实际课程题 | 图示/符号保真、任务要求、rubric与人工复核 |

- 发布验收目标：按实际支持的学段×学科建覆盖清单，每个适用组合至少12道来源明确的题，其中至少6道综合或复杂图文题；标出缺项，不以集中大量同类题填满计数。此为最低覆盖目标，不是统计准确率保证。
- 本主线下一轮自然案例最低集合先采用24道代表性题，覆盖小学/初中/高中，涵盖上述核心文化学科；数学、物理、化学、语言长材料和开放主观题均要出现。该集合不代替最终全科覆盖；不能等待全科样本完备才交付当前纵向切片。
- 输入横切：原生PDF/Word、扫描页、手机倾斜/阴影、手写与印刷混合、公式/上标/下标、几何/实验/地图/统计表、多栏/跨页/多小问。缺图、缺答案、重复/变式、冲突答案、解析中断、取消和重启须各有失败案例。
- 已授权D:/WorkProject/EduProject/test可用于物理自然样本；现有资料没有独立标准答案，用户允许补答案，但补充答案必须继续标记未独立验证。其他学科使用授权、可追溯材料或明确标记的合成案例，不擅自上传原图/整库，不使用侵权题库爬虫。

### 3. 操作者只处理必要决策

目标路径：选择资料/拍题 → 说清学段学科与要求 → 系统内部解析、切题、索引、检索、去重、生成、检查/修复及排版 → 一个可恢复的整卷/练习预览 → 集中处理异常 → 明确确认 → Word/PDF。

- 不向教师暴露8题工具批次、模型参数、索引调度、会话ID或内部引用拼装；大任务由现Pi和确定性后台任务内部推进，继续支持停止/恢复和公开进度摘要，不增加AgentLoop。
- 题组/组卷归属由明确用户动作在main中绑定，减少手工找历史会话、勾选多个批次和重复抄条件。取消/拒绝、源版本改变或质量异常不能因简化交互失去保护。
- 正常题可批量预览并一次明确确认同一任务内的已检查当前版本；异常题集中定位、修正/排除/拒绝，修正后重检。自动预检查不自动勾选教师批准，失败题不能混入正式卷。
- 在来源和权限合同稳定前，不简单抬高8题限制来冒充批处理；C2/C3需冻结内部聚合/幂等/失败恢复与批量教师确认合同。教师批准仍覆盖准确题版本和明确范围，不能通过新接口自动批准未知题。

### 4. 量化验收与实施顺序

- 当前机制用例与自然题质量用例分开统计。逐学段/学科/输入形式报告样本数、题干/条件/小问/图表完整性、来源定位、答案正确性证据、检索Top10、未验证/隔离、教师改动、总耗时、人工操作次数与人工处理时间；保留首次失败、实际build、截图、产物和冷读结果。没有独立标注不计算虚假准确率。
- 最低硬门槛：不得静默漏条件/错配图/丢小问后标可用；不把生成解析标教材答案；验证失败/冲突不可正式自动交付。人工最终确认与来源CAS仍必须通过。不能靠更多简单单元测试抵消复杂样本失败。
- 低负担UX目标：除初次权限/目录授权及内容修正外，正常任务从给定资料与要求到正式产物最多2个集中审核阶段；不得每8题重复人工重发、拼接或批准。各尺寸正式Electron记录实际操作数与人工时间，报告是否达标，而不是先声称已优化。
- C2先处理本次题组归属/版本/配额及保守题型兼容；C3接三模式蓝图与内部聚合、集中审核/Office，跑自然复杂题；D打通错题5变式；KB003补后台增量/优先与规模/安装。全学科矩阵随着这些切片持续补齐，完整专题收口时审查缺项。每片完成后更新Goal4/root4，不改变当前主线。


## KB002-C2 实施冻结（2026-10-11）

- 本片教师可见结果：传统蓝图可选择纯题库/混合/AI原创，生成题模式一次选择当前学科年级的已确认题组所属任务；同Pi原工具支持同三模式。混合逐部分明确生成题数，短缺分原题/生成题展示；原题不自动补，选题不调用模型。不在本片承诺尚未实现的整卷自动生成、集中批量质量审批或复杂题正确性，C3继续完成低操作负担及自然复杂整卷/Office验收。
- KEEP现Pi、QuestionReview effect/quality/题本、Paper ledger/selector/typed IPC/HeroUI Button与现原生表单/Office。选用扩展现确定性组卷；不迁DeepTutor QuestionPipeline或OpenMAIC课堂生成/Agent。原版固定DeepTutor格式、SymPy和现源文档已验，不新增依赖/模型/DDL/数据真源。HeroUI Pro既有官方卡/按钮已核对，finesse未在可用技能目录列出，继续现页面组件。
- 保留paper-blueprint.v1原source_only精确快照/effect digest；新hybrid/ai_original创建和payload/effect为paper-blueprint.v2。读取/决定的typed IPC仍v1身份，未知版本拒绝；source_only不允许混入新生成配额字段。新mode input显式generationScope=approved_session，不接模型/renderer提供的批准digest或任意题ID。宿主按当前授权session/student、subject/grade读取已教师确认且质量记录完整的生成题组；仅绑定实际选中题目的groupId/effectDigest/generationKind/当前question version，不把tags当资格。
- 复用QuestionReview现get/lineage/effect/history验证，以传入Paper事务的同一all/read连接检查批准、父来源和saved当前版本。旧无质量effect不自动取得新组卷资格；pending/rejected/跨会话/未知policy/源版本变化不得选入。预览、确认及最终Office源租约重复核验同一资格；不在写事务重新运行format/math。
- 共享PaperSection增加generatedCount（hybrid必填0..count，另两模式禁止），PaperItem增加仅生成题具有的宿主来源记录；source_only保持原题型精确匹配，新模式使用保守白名单别名映射（choice/选择题，fill_in_blank/填空题，short_answer/简答题，written/解答题，concept/判断题，coding/编程题）；未知题型只精确匹配，不推断学科/难度。新配额不足分来源统计，去重身份仍原保守key。
- 新只读education:paper-generation-contexts经现allowed主框架、production host与typed preload提供本机task标题/subject/grade/已确认题数，不上传学生ID/ledger ID。传统页选中任务即绑定owner，改任务清空旧预览/重试，不能隐式借其它会话。Pi使用当前任务已批准题组，不扩工具列表，不在云端暴露ledger ID/digest。
- 修改范围见test-results/goal/kb-generated-paper-20261011/baseline.json；沿现领域边界扩展，仅db域宿主增加读资格adapter，index如需仅注册原API。前置文件副本保留。回滚撤新v2创建和IPC/UI入口，保留所有v2账本与用户文件；旧二进制拒绝v2，不能降级批准或清库。
- 先RED：无父原创已确认仍不能组卷。GREEN含三配额/去重/缺额、同session/student当前审批资格、伪造/损坏effect及未知policy、改题/父源变化废止、旧v1冷读/精确effect、拒绝/停止/幂等、最终源租约。再build/type、组件/领域、正式当前Electron Pi和传统页→三模式预览/确认/冷读、浅暗双尺寸图；C3再自然24题/三套100分/四Office产物联合验收。未过正式路径不标C2完成。


### C2正式与视觉审查中的修正（2026-10-11，最终验收尚待当前构建）

- freeze-1正式WsETdV前两项后发现任务读取/按钮可用的时序缺口，失败图与日志保留；freeze-2正式VRTpIH10项通过。之后允许学科/年级输入在题组刷新期间继续编辑，只禁用选择/组卷；freeze-3正式TM6xKl11项通过，包含实际逐字键入，领域353/组件216。
- TM6xKl的当前图像审查发现新生成题答案来源仍采用无document的历史未知兜底。扩展现QuestionAnswerEvidence接收主进程已核验PaperGeneration receipt，缺document时显示“AI起草，教师核对保存版本”；未提供receipt仍保留原历史待确认，不按tags/sourceKind推断，也不把教师审核当独立答案证明。该视觉修正须绑定后续新固定构建再正式复验。额外组件文件原文由反向本片patch重建备份，准确回滚说明见visual-finding.json，不伪称修改前完整备份。
- 变式资格增加Paper当前源租约下父题原件validate；父题文件不可读就移除该变式资格，原创不虚构父题。领域新增专项14项，连旧门禁共353；最终renderer含新来源断言217。未完成全部正式/视觉/兼容前仍DOING。

### C3下一片复用调查接缝（待C2最终接受后实施）

- 当前生成草稿仍最多8题，原工具每批等待教师；C2自动绑定已批准任务只消除手工关联，没有完成整卷内部批处理和最多2个集中审核阶段。C3不能把抬高常量或让教师重复确认各批当作完成。
- OriginalMultiRepository/PiOriginalMultiQuestionReview实际是单题多页/多图的完整原题审核，不是多道生成题批量审批；可复用原图定位、教师校正和现组件，不直接冒充整卷聚合器。
- 优先复用原QuestionReview质量/repair/记录与现Paper/Office source lease；调查如何以同Pi持续工具调用形成整卷草稿并集中处理异常，最终明确批准精确当前版本。任何新聚合合同必须版本化、可取消/恢复/幂等，不能新增题库、独立AgentLoop或绕过教师事实审批。原8题工具继续服务小批变式，是否新建纸卷范围原生工具及聚合动作需读源码后冻结，不在此草案强行定死。
- C3须落实前述24道自然/授权或明确合成的跨学科复杂样本与图/公式/答案独立证据，完成三模式完整100分实际卷/四Office产物/冷启；C2的一题100分和两题50分仅证明精确配额和授权，不代表现实卷结构、困难题正确性或教育质量。


## KB002-C2最终限定接受 / C3当前读点（2026-10-11）

## 2026-10-11 C2限定接受，当前C3整卷内部批处理与集中审核

Current Phase：4/5 DOING。Master：ACTIVE。Current Task：KB002-C3；完整知识库/智能组卷专题未完成。Done：C2三模式已沿原Pi工具与传统蓝图贯通；纯题库保留paper-blueprint.v1，混合/AI原创使用v2，生成题仅接纳明确批准且归属当前任务、当前学生、学科年级一致的当前版本。混合逐部分明确原题/生成题配额与缺额，选题不调用模型，缺额不偷补。Doing：内部整卷分批起草/检查修复、可恢复聚合、异常集中审核、整卷最终预览及Office联合交付。Next：C3→D错题5变式→KB003增量/任务优先/30–40GB/安装→两条最终业务闭环。Blocked：无。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty未提交，本轮HEAD/origin HEAD一致）。

Evidence：apps/desktop/test-results/goal/kb-generated-paper-20261011/closeout.json。最终build b4a0e95f5826a10502a2d7c8afaa59b26023f2c65cc661d4af750512c2f656ae/346文件；标准build及isolated build/type exit0，组件217、领域353（生成专项14），正式Electron/真实DeepSeek/Pi 11项/3启动/2冷启/0renderer错误，浅暗1366×768与1920×1080最终8图实看。兼容smoke207是在前一freeze-3（9fe444481bbfda76e70f1e7e3b956e16e1462511e54954e518217c5573e20428）；其main/preload与最终构建字节一致，最后来源文案修正由最终组件217与正式11复验，不能把207说成最终renderer同hash回归。首次RED、编译/页面时序/视觉失败与回滚副本保留；git diff --check通过。

边界：一题100分/两题各50分是授权、配额与状态机制样例，不是现实整卷或困难题正确性证据。教师保存生成题仍不等于独立答案验证。C2自动绑定已批准任务减少手工关联，但原8题生成工具仍逐批等待教师；整卷内部聚合与最多2个集中审核阶段尚未达标。自然24题、真实复杂三模式100分卷、四Office文件、全科质量、最新5变式、30–40GB与安装仍OPEN；不以简单算术样例补齐质量。

用户最新要求持续有效：大学前全部适用学科学段，复杂公式/图表/多图/跨页/长材料/多问/开放题；按学段×学科×输入×题型分层验收。复杂步骤内部推进，教师处理集中异常与最终当前版本确认。原图/原文与来源保留，失败隔离、学生/任务隔离、源CAS、取消幂等及写文件审批不得弱化。全学科与低操作负担目标见KB_GENERATION_DELIVERY_CONTRACT.md，未测目标不标完成。

唯一当前执行索引：docs/goal/KB_EXAM_ACTIVE_TASK.md。沿现QuestionReview/题本/Paper/Office/typed preload扩展，无新DDL、依赖、AgentLoop或数据真源；日常资料/数据库/凭据未改，未提交/push。

C2首次closeout脚本读payload.blueprint而非实际payload.input.blueprint导致脚本断言失败；已核对真实readback结构并修正。不是产品失败，真实正式11项结果不改写。最终证据/源码hash/命令/失败/截图/回滚与兼容构建差异见closeout.json。

C3先完成Recherche/Reuse与版本化聚合合同，再写跨域代码。优先检查现QuestionReview检查/修复/等待、Paper确认、Office审批和Pi原生事件；不因简化UX自动批准，不将未审草稿写正式题本。自然复杂学科样本与操作次数须独立记录，不以多跑低层测试抵消质量缺口。

### C3复用审查与实施顺序（2026-10-11，本段是设计，尚未实现）

真实源码接缝已核对：

| 当前接缝 | 发现 | KEEP/EXTEND与下一动作 |
|---|---|---|
| shared/question-review.ts:7/18 | 草稿包含题干/选项/答案/解析，每批最多8题；没有生成题图像附件结构 | 保留小批结构与完整正文；不能称现生成器已支持多图题。复杂图题优先绑定已解析来源图像，后续扩展引用合同，不把图编码塞入文本或上云 |
| question-review-repository.ts:47/86/101 | 自动修复及pending根约束以session/run为范围，当前同run最多一个待审根 | 不能只删除guard来积累批次；先建立主进程确认的纸卷任务/批次归属，再在任务内限定每批独立修复、当前版本和跨批重复/答案冲突 |
| question-review-coordinator.ts | 当前每批格式/数学预检查后等待教师；Pi原生错误继续修复 | 复用检查与同Pi修复；整卷模式内部暂存检查后的草稿并返回公开进度，结束时集中审核。不增加LLM调用循环或并行Agent |
| question-review-repository.ts:112/130 | 检查在写事务外；确认事务复验history/revision/source并写题本/effect | 复用同writer；批量确认需提取同事务apply逻辑，禁止循环调用独立decide造成半卷已写、另一半失败。先核验全部版本，再一次事务提交全部明确批准事实 |
| office/PiQuestionReview.tsx:21/27/55 | 每卡检查/勾选/保存；目前自动预检查仍需重复手工操作 | 聚合卡自动加载当前检查记录、默认展开异常、正常题可折叠查看；教师明确确认精确范围。编辑只使对应版本失效并重新检查，不自动勾选批准 |
| paper-coordinator.ts:38/39 | 缺额明确返回；完整预览独立等待教师 | 保留配额/最终确认；原题缺额不能用原创替代。整卷审核与既有Office审批集中在同一教师任务流，写文件仍走原授权 |
| 已安装Pi 1.0.2 / pi-agent-core agent-loop.js | 原生executeToolCalls支持工具生命周期、信号/错误结果及连续工具调用；同消息工具可能并行 | 复用当前Pi；聚合写操作必须依赖现SQLite事务/互斥与幂等，不能假定工具按提交顺序完成。安装版本是本机事实，不宣称全球最新 |

本轮官方核查：[Pi扩展合同](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)支持自定义工具、生命周期及会话条目，同时明确同消息工具可能并行；工具暂存结果不能自行代表教师批准。Pi会话条目只记录公开过程/恢复指针，业务事实仍是SQLite。DeepTutor固定格式worker与其已有NOTICE继续复用，不迁整套生成Agent；[上游许可文件](https://github.com/HKUDS/DeepTutor/blob/main/LICENSE)的当前内容与已固定迁移范围分别核查，不因上游可用就替换生产固定版本。OpenMAIC课堂DSL/运行时不作为纸卷聚合数据源。现HeroUI ChatTool/Checkbox/Button和third_party/finesse固定设计参考已存在，无新增UI依赖。

三种路径比较：直接抬高8题常量无法解决逐批等待、恢复和精确审批，拒绝；迁入另一个生成流水线会形成重复调用/事实源，拒绝；扩展现QuestionReview账本的纸卷任务归属及集中审批为采用方向。

按顺序交付，禁止把下述设计标已实现：

1. **C3-A合同/原生内部批次**：版本化纸卷任务与成员引用保存现ai_confirmation_items，不新增题库或Agent。固定蓝图/owner/student和每部分生成配额；主进程签发本地别名并决定成员归属，云端不能提交任意ledger ID、digest或批准。旧v1–v5不改写，新任务记录版本未知时拒绝。冻结完整类型/IPC/恢复状态/增量兼容及修改前副本后实施。
2. **C3-A集中质量审核**：内部每批仍最多8题，完成检查/修复再聚合；跨批保守去重与答案冲突单独核对。pending/失败/修复旧版都不写正式题本；不足题数、条件缺失或未解决冲突集中呈现并禁止正式确认。批量确认绑定当前成员及每个revisionHash，同一事务写既有题本和审核effect；任意成员变化/源CAS/取消/权限变化全部回滚。拒绝/部分生成/崩溃保留草稿，可继续当前任务，不能自动重新调用provider或批准旧检查。
3. **C3-B整卷/Office低负担流**：集中题目审核后使用C2现确定性配额形成三模式整卷；整卷最终预览与四个文件的目录/内容/写入审批在一个连续教师工作流呈现。两阶段目标为题目异常/质量确认与最终整卷/文件交付确认，实际操作数及时间需实测。两个阶段不是弱化任何原审批；若实际仍多阶段，明确记录未达标后继续优化。
4. **C3-C困难样本验收**：真实100分卷含合理题量/题型/分值，不能再用1×100或2×50代表整卷。先24道跨学段跨学科的授权自然材料或明确合成案例，分别注明图片/正文/公式/答案依据和人工改动；完整学科覆盖后续按前述分层矩阵扩展。没有独立答案证据不计算准确率、不标题目已证明。

下一实施的优先RED：同一个Pi任务生成超过8题仍逐批阻塞；集中确认的任意成员版本变化必须拒绝全部写入；跨任务/跨学生/伪造成员别名拒绝；停止/冷启不晚写、不自动重放。再从shared→main/同事务→typed preload→现聊天聚合卡→真实Electron推进，不先建孤立后台接口。

### C3-A实施冻结：现账本整卷题目集合（2026-10-11）

- 教师结果：同Pi内部提交多个最多8题的小批，自动沿现质量/三次修复规则检查，集中显示整卷数量、异常及当前版本；正常批次不逐批等待或勾选。整卷一次明确核对并确认后才保存到原题本；失败整卷仍隔离。C3-B再做现实卷与Office最终两阶段工作流；本片不宣称全科自然题质量通过。
- 不新建表：现ai_confirmation_items增加action_type=pi_question_collection，payload/result使用xiaozhi.education.question-collection.v1；payload固定蓝图、学生、创建call和主进程随机别名。result保存阶段、成员批次及修复链IDs和摘要digest。审查发现仅从集合反查成员无法检测集合被删除，故新集合子批使用question-review-record.v6，固定宿主collectionId/sectionId并沿原quality.v2/repair；旧v1–v5不改写。子批与集合双向归属、JSON/schema/digest失真拒绝，集合删除不能让子批脱离集中批准保护。旧二进制拒绝v6，不据renderer或模型传来的ID取得成员资格。
- 新共享question-collection.ts，main领域question-collection-ledger/repository/coordinator（可按接缝合并实现）；现QuestionReviewRepository提供同事务批准primitive与受限集合挂接。不得全局删除原pending/修复保护；集合内按纸卷归属、部分配额和真实修复父链接允许暂存下一批。每个修复链最多原三次；配额统计含失败当前批，不能丢失败批换模式逃避。直接子批确认被禁止，教师仍可编辑/检查。
- 新Pi纸卷范围工具单独questionCollectionTools及xiaozhi.education.question-collection.v1会话身份，不变更旧question-review.v1身份和原单批工具。开始/暂存/结束由同Pi调用；主进程别名不向页面暴露。没有嵌套模型调用；结束时集中等待教师。旧会话可新增该scope，已保存scope被移除或未知版本拒绝恢复。重启读取草稿不自动provider重放。
- 新typed IPC只读集合与确认/拒绝，经现main-frame与production lease；Snapshot/event增加集合摘要。复用PiQuestionReview编辑器/QuestionQualityReview与HeroUI ChatTool/Checkbox/Button，隐藏成员独立批准及重复确认，正常题默认折叠、异常突出；完整内容仍可查看。没有新renderer直连或私有推理展示。
- 格式/数学检查在写事务外；最终集合view token绑定payload、成员当前草稿/质量hash/来源与阶段。确认先准备所有format，再同一现QuestionReview transaction复验集合、授权、全部成员/来源/质量；使用同writer保存全部题/effect和集合批准。任一源、版本、停止或故障使全部事务回滚，不循环调用独立decide产生半卷事实。跨批保守同题/答案冲突禁止批准，不声称语义去重或正确性证明。
- 修改前副本test-results/goal/kb-paper-collection-20261011/before；不改Master、日常资料/数据库/凭据，不新增依赖。新集合入口回滚时保留账本/题本事实，旧版不读取新action，不能删除数据或降级批准。身份兼容必须实际验。
- 门禁：RED多批→GREEN真实SQLite多批/一次批准/跨批重复冲突/配额/修复/单批旁路拒绝/取消全回滚/修改废止/未知schema/归属/旧记录；build/type、renderer/domain、正式Electron真实Pi超过8题集中审核/拒绝/故障冷恢复、浅暗双尺寸实看、必要兼容smoke及diffcheck。全部通过前C3-A保持DOING。


### 2026-10-12 本轮增量：C3-A仍DOING，根目录启动器已更新

- 主线进展：现审批账本整卷集合v1与子批v6绑定、精确配额、同事务批量确认/回滚及跨批重复冲突隔离已写入；独立真实SQLite专项11/11（boundary-2）。普通工具原保护保留。Pi集合协调器和独立会话scope代码已写并通过当前build/type，但尚未接入production host、typed IPC和集中审核UI，未做真实Pi/Electron整卷验收，不能标C3-A完成。
- 用户临时指定根目录启动器：启动小智.cmd增加Node/npm/依赖检查、明确更新和失败提示；npm start固定当前源码构建、同out的main/preload/renderer，清理已有验收/旧页面继承变量，NODE_ENV=development。构建失败不打开旧版，沿已有单实例/构建变化重启机制，保留原数据与模型配置。根目录cmd实际执行exit0，现有日常窗口保留。
- 当前构建5cf07d516af255cd2a38c088771b39a85c9286436f1fff20796a60afcdbe5aae；npm run build exit0，组件217/217；日常正式Electron入口8/8、2次启动/冷读、0renderer错误。报告test-results/daily-entry-3WLecV/report.json；当前聊天浅1366×768/暗1920×1080及学生同尺寸两图已实看。首次隐藏窗口动画停滞、第二次冷读尚loading的脚本失败保留，复用已有hiddenSnapshot策略及等待真实session加载后第三次通过。
- 失败：领域全套首次164项后worker timeout，见domain-startup.log；不是完整领域验收通过。第二次重跑160项后同为worker timeout（domain-2.log），尚未定位根因，未改超时保护，领域全套仍未通过；首次失败均保留。不把12道合成函数机制题当独立数学正确性或全科难题证据。
- Next：先定位并修复领域worker timeout，再完成集合原生工具测试→production host/typed IPC→集中审核UI→真实Pi超过8题/取消/冷读/双尺寸视觉→现实三模式100分卷/Office和24道跨学科复杂题；再D五变式→KB003。Master ACTIVE，完整目标不变。未提交/push，不改凭据、日常业务资料或数据库结构。
- 本轮证据根：apps/desktop/test-results/goal/kb-paper-collection-20261011；startup-before为启动范围原文副本，before为C3副本；question-quality两行导出修改的原文是逆向本片patch重建，并非修改前抓取，已明确标reconstructed。


## 2026-10-12 当前：整卷集中审核主路径已实例通过，C3仍DOING

Current Phase：4/5 DOING。Master ACTIVE。Current Task：KB002-C3-A/B；知识库与智能组卷完整专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd，工作树dirty未提交。Blocked：无。

Done（本轮实例范围）：生产Pi注册三个整卷工具及独立scope；typed IPC、snapshot/event和聊天集中卡贯通。复用原题目编辑器、DeepTutor原格式校验与HeroUI ChatTool/Checkbox/Button；内部批次不逐批等待，修改重检后只勾选一次当前整卷，沿原SQLite同事务保存，再用原Paper流程预览并确认整卷。

Evidence：apps/desktop/test-results/education-journey-BZG6HP/report.json，真实DeepSeek/Pi + 正式Electron 5项通过、2次启动、0renderer错误，12题100分且修改后版本确实入库，冷启无模型重放；build/type通过，SHA 2d71b324206380eadc664d3b7422017cb3849906fe68fa1759c1c585792d2e52/346文件。浅1366×768、暗1920×1080两张审核图已实际查看。原报告文案写8+4，是提示词期望；SQLite实际4+4+4，均≤8，复核已记本轮integration-progress.json，不修改原始报告。repo专项先前11/11保留，不当本轮全回归。

Doing/Next（顺序）：补齐中止/部分草稿跨运行恢复及自然语言默认整卷引导→C3-B最终整卷与Word/PDF连续交付/减少确认负担→C3-C自然复杂三模式100分卷与24题分层质量→D五变式→KB003后台增量/任务优先/30–40GB/安装。当前实例是合成函数分类题工作流，不证明自然图文、全科、独立答案准确率或Office完成。

Failed：首次构建把集合当作含callId的单批事件，已分支修正后build通过；首次实例脚本cwd错误未进入应用，修正后正式实例通过。此前全领域160/164后5秒worker timeout留存；math冷启探针约3.4秒，现只将math上限改为15秒（其它5秒、取消/输出/AST界限不变），四次方程真实SymPy实例matched/conditionsVerified=false；不声称已证明此前所有timeout根因或完整领域重新通过。

执行范围：按用户最新要求优先功能、仅构建和关键实例；本轮未重复全量领域/renderer/207回归。既有5秒失败不再作为无止境重跑主线，后续按具体风险定向验收。无新DDL/依赖/AgentLoop；Master未改、用户资料/数据库/凭据未改，未提交或push。回滚副本与精确日志见test-results/goal/kb-paper-collection-20261011/integration-before及integration-progress.json。
## 2026-10-12 C3-A 恢复切片合同

教师结果：停止或冷启后直接说“继续刚才的试卷”，Pi读取现账本唯一未完成整卷蓝图与配额；保留已暂存题和原三次修复计数，完成剩余部分后集中审核。启动/读取不自动请求模型或确认。

复用比较：现Pi原session/tool/abort与QuestionCollection账本已足够，扩展begin工具为完整蓝图或严格{resume:true}。不另建Agent/任务库/模型流水线。DeepTutor固定格式校验继续沿原Worker，OpenMAIC课堂与Hermes偏好学习不承载本机审批恢复。

合同：begin恢复仅当前session/active student、唯一pending集合，返回宿主蓝图和别名/每部分剩余量；模型无法选择任意集合ID。失败修复上下文仅原模型候选与原数学计划/错误码，不回传教师私有修改；variation须重新检索读取当前父题，原源版本CAS继续生效。跨run修复仅同collection/section、当前head和同学生，旧单批run隔离不变；repairChild/lineage跟随真实parent链接，不重置计数或把失败批当缺额。写入仍同事务，主进程lease/取消/配额/去重/确认不变。

修改：question-collection repository/coordinator、question-review repair查询、Pi产品提示；无需DDL/新依赖/新工具名称/第二运行时。保存本片前副本；回滚代码保留既有事实/账本，禁止删用户数据。

验证按用户最新范围：一次build/type、针对跨run repair的现SQLite实例，以及正式Electron停止→冷启→自然语言续做→集中确认→100分卷实例；不反复完整领域回归。任何未验恢复/Office/全科质量继续OPEN。

## 2026-10-12 C3-B 聊天整卷交付入口合同

复用已验PaperBlueprintWorkspace的四种导出入口与原education_export_paper/Office审批。抽取共享PaperExportEntry，聊天试卷预览确认后也提供学生/教师Word/PDF按钮，点击仅填入本会话输入框，不自动发模型、不写文件。旧卷或源变更不开放；运行期间禁用，保存仍须原工作目录授权与版本审批。无需新DDL、协议、依赖或文件写入路径。实例范围先检查当前聊天入口与原Office串接，不把四文件、复杂公式、WPS或全科质量一并标完成。

## 2026-10-12 C3-B 独立试卷输出授权实施合同

教师结果：首次聊天未选资料工作目录也能在已确认试卷预览选择保存文件夹，之后通过原Pi导出工具/Office审批保存学生卷或答案卷，Word/PDF均保留完整题面。选择目录本身不请求模型、不写产物、不改变会话资料范围。

比较/复用：EduDev已有authorizedWorkspace/approvedFile、Office ledger、Pi mutation queue、确定性Paper编译及Teacher审批。Pi原工具调用/队列不改；DeepTutor题目校验、OpenMAIC课堂导出及Hermes偏好层不能承接Windows原生目录授权，沿现Electron主进程对话框与HeroUI Button/状态组件适配，无新依赖或第二AgentLoop。

数据合同：增量幂等新增xiaozhi_pi_paper_outputs（conversation_id+workspace_hash主键、schema_version=1、path/label/selection），仅保存教师原生选择的输出目录，不新建题库/产物事实。保留历史授权按原Office workspaceHash解析旧文件；新拟稿使用最新选择。原xiaozhi_pi_workspaces与native snapshot/controls绑定不变。新目录不注册通用Office/file工具、不能读取目录内容、不能接受模型路径授权。只给education_export_paper独立宿主能力，现学生/session identity仍校验；主进程拒绝活动run、归档/无效学生、并发选择/关闭/配置冲突。保存仍复核Paper digest/源版本、路径/链接/目标不存在、审批revision、停止与幂等。

接缝：persistent-state迁移/授权查询→production-host selection/resolver/snapshot/paperExport选项→Office服务只对Paper draft选择输出resolver→typed IPC/preload→共享PaperExportEntry文件夹选择和状态。旧普通Office仍要求原输入workspace；旧Paper记录优先匹配历史hash，否则只用原资料workspace，不能静默迁移文件。输出scope是新增独立显式授权，不放松原input绑定。

验证按用户最新范围：build/type；一个真实旧库副本上的增量迁移/回读与当前正式Electron 12题100分已确认卷→后选输出目录→学生/教师DOCX/PDF四文件→独立解析/冷读，并核对input binding不变、无通用工具扩权。目录取消/拒绝无文件效果。失败保留首证据，不重复全域/renderer/207回归。before为本片源副本；回滚只撤本片接缝、保留授权表/已保存文件/旧事实，不删除用户数据。


## 2026-10-12 当前：C3-B四文件交付限定接受；下一C3-C质量

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3-C；知识库与智能组卷专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

Done（限定范围）：组卷完成后可原生选择/更换仅用于已确认试卷的输出目录，不必重新绑定资料范围或会话。原Office逐版本审批/源CAS/取消不变；独立输出授权不启用通用文件读写工具。历史授权保留，换目录后旧文件仍可核对。已确认12题100分卷通过当前聊天入口实际保存学生/教师DOCX/PDF四份，冷启回读通过。

Evidence：apps/desktop/test-results/goal/kb-paper-output-20261012/progress.json。build/type exit0，SHA 26a6926ba5453bd16a1d46085deb53f40998dcbf658342eefe9a2e4632d88192/346文件。正式Electron真实Pi交付7项通过（education-journey-ZrjmDY/report.json原始失败保留），补验已保存四文件完整解析/冷启历史目录回读2项通过（recovery-report.json），0renderer错误；无重复生成。四次原生education_export_paper、无通用Office身份；新SQLite表幂等迁移/目录历史/会话隔离实例1项通过。浅1366×768、暗1920×1080及学生PDF首页、教师公式第8页已实看。学生PDF2页、教师PDF10页；全部题干及教师答案解析保留，学生卷无答案段。

Failed：PDFium将行末可见减号提取为U+FFFE；pypdf独立提取完整37个教师内容标记通过，渲染减号存在。改核对器使用pypdf严格比对全部字符，仍保留PDFium渲染/图像检查，未删除题目或忽略符号。旧workspace_locked产品阻碍通过独立输出授权解决。旧失败报告不覆盖。

Doing/Next：C3-C真实复杂图文三模式100分卷与24题分层质量→D错题5变式→KB003后台增量/任务优先/30–40GB/安装。新发现：合成函数族a=7解析把m=686的因式分解符号写反；当前可选形式化计算仅核对提交AST，不能覆盖全部解析。下一片优先解决可形式化步骤与答案冲突检查，复用既有SymPy宿主/Pi/审核修复隔离，禁止把本次文件完整性当数学正确性。Blocked：无。

范围：当前合成函数族仅证明工作流/文件交付；自然难题、全科正确性、复杂可编辑公式、当前整卷Word/WPS实开仍OPEN。按用户要求功能优先，仅构建和关键实例，未重复完整领域/组件/207回归。无新依赖或第二AgentLoop；新增一张输出授权表，fresh幂等/旧验收副本迁移已运行；用户正式资料/数据库/凭据及Master未改，未提交/push。

### C3-C优先事实与实施前置

实读当前真实生成样例：a=7、m=686应为x³−147x−686=(x+7)²(x−14)，原analysis却写(x−7)²(x+14)。该错误没有对应mathChecks，当前格式/同题检查不会阻止。先审计DeepTutor/OpenMAIC/Pi与既有SymPy的步骤核验接缝；明确数学可形式化范围、题目条件映射、旧记录只读兼容和失败隔离合同后实现。不用泛化关键词或LLM置信值宣称正确，不修改历史已批准事实，不自动扩权/改Schema。

## 2026-10-12 C3-C1 形式化恒等式增量合同

目标：复用现固定SymPy1.14.0 Worker和Pi mathChecks，增加单变量有理系数四次以内恒等式检查。真实a=7符号反转应mismatch，正确分解matched，同Pi按原repairReference修复，教师卡显示式子、需核对后才保存，冷启回读。并不自动解析所有自然语言或证明整题正确。

比较：A现SymPy Poly(left-right,x,domain=QQ).is_zero（采用，无新依赖）；B DeepTutor格式校验继续复用但不能证明等式；C OpenMAIC课堂生成/渲染不承担数学授权；Pi仅编排已有工具。指定D:/WorkProject/DeepTutor与OpenMAIC当前不存在，本轮未假称核过其最新源码；既有固定第三方源manifest保留。官方API https://docs.sympy.org/latest/modules/polys/reference.html 已读取；SymPy/mpmath固定wheel/BSD-3-Clause与完整LICENSE沿原manifest，不安装新包。

合同：MathCheckInput新增kind=identity、left/right受限AST，拒绝domain/roots/自报verified；variable只为x，无eval/parse_expr，保持次数/节点/超时/取消/输出限额。旧expression/polynomial请求与basisHash不变；identity计划新增时其basisHash包括analysis，修改解析废止对应计划。现quality.v2/record.v5/v6按原读取和批准规则，不改历史用户事实；旧reader拒绝未知kind而不能降级批准。恒等式只对QQ系数、常数分母、非负变量幂；不以解集相同替代恒等。

范围：shared/math-check、固定math-worker、question-math、原Pi工具schema/说明、现Golden原生原创实例。沿原repository/typedIPC/UI/修复隔离；不新建表/服务/AgentLoop。回滚副本apps/desktop/test-results/goal/kb-identity-20261012/before；新候选不改写为旧kind，保留既有ledger。

验收：受限真实SymPy正确/错符号/同根不同系数/越界实例，build/type；正式Electron同Pi错分解→repair→教师审核→保存→重启，记录实际build/截图。仅关键实例，不重复全量回归；未跑教师路径前不得标功能完成。


## 2026-10-12 当前：C3-C1恒等式校验限定接受；C3-C完整质量DOING

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3-C完整解析覆盖与自然复杂三模式整卷；专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，origin HEAD本轮只读核对一致，未提交）。

Done（本片限定）：复用现SymPy1.14.0固定Worker，mathChecks新增identity核对单变量x有理系数四次以内恒等式。真实x³−147x−686的错误分解被主进程mismatch隔离，同Pi带原repairReference修复为(x+7)²(x−14)；教师看列出的等式并明确核对后保存一题，失败前版仍隔离，冷启回读无模型重放。identity计划绑定analysis，改关联解析不沿用旧结果；旧expression/polynomial hash保持原值。结果conditionsVerified=false、answerVerification=not_run不变。

Evidence：apps/desktop/test-results/goal/kb-identity-20261012/progress.json。build/type exit0，SHA 25472fd6bd894ce04f6855a40d54362b61ec1dec7182a3ebfe1805d8e7a0c2ed/346文件；6个真实本地定向实例（正确/错符号/同根不同系数/变量分母拒绝/解析改动废止/旧hash兼容）；正式Electron真实Pi错误→修复1项（education-journey-adA70M原失败报告保留），复用同一已保存候选继续教师批准与再冷启2项（recovery-report.json）/2次补验启动/0renderer错误。浅1366×768、暗1920×1080审核截图已实看。未重复全量领域、组件或207回归。

Failed：首次脚本在修复校验落账前读history；第二次选择器同时命中前后两份回执。均为实例脚本问题，修正等待/精确当前回执后在原候选继续批准，不再次模型生成。原始日志保留。旧12题fixture数学事实未自动修改，仍不得据文件交付通过声称全卷正确。

Doing/Next：C3-C完整解析步骤检查覆盖、条件映射与自然复杂图文三模式100分卷/24题分层质量→D错题五变式→KB003后台增量/任务优先/30–40GB/安装。当前每题可选一项形式化计算，未自动提取所有解析步骤；工具调用仍由同Pi选择，不能据局部matched断言完整答案正确。需继续补多步骤覆盖及教师可见缺口，不以LLM置信代替正确性。Blocked：无。

Reuse/边界：沿原Pi注册/schema、同审核ledger/修复隔离/typedIPC/UI和固定SymPy，不新增依赖/DDL/AgentLoop。官方Poly API已核；DeepTutor/OpenMAIC官方HEAD只读取得但不等于完整最新版能力审计，指定本地根目录当前不存在，未虚称新源码已迁移。DeepTutor既有格式Worker继续使用；课堂/Hermes支线后续。前片C3-B四文件交付证据保留apps/desktop/test-results/goal/kb-paper-output-20261012/progress.json。用户正式资料/数据库/凭据与Master未改，未提交/push。

## 2026-10-12 C3-C2 多步骤形式化计算合同

教师结果：每道题可提交2–6项现有算术/恒等式/完整根集检查；审核卡逐步显示式子和本地结果，任何一步mismatch均隔离，不能用首步通过冒充全部通过。unsupported保留人工复核；未提交步骤/自然语言条件仍不声称已证明。模型不自行填结果。

复用：沿固定SymPy1.14.0 AST Worker、Pi既有education_propose_questions和repairReference、SQLite审核ledger、typed IPC、HeroUI审核卡；不新增依赖/数据真源/AgentLoop。原单项表达式/根集/恒等式与旧basisHash不变。新增kind=steps包裹2–6个非递归原检查；总请求仍16KiB/同15秒取消超时，每项128节点/深12/次数4。固定worker一次加载依赖，逐项执行；任何错误不能被其它正确步骤覆盖。

合同：新增可选stepStates仅由宿主产生，长度与不可变步骤匹配、聚合状态一致；保存版本digest含回执，冷读校验同一计划，旧记录无该字段保持原读法，旧reader拒绝新kind/字段而不能降级批准。steps绑定题干/选项/答案/analysis；编辑后basis_changed不使用旧逐步结果。自动repair必须保留原steps顺序及每项kind，允许尾部增加但不能缩减/改kind/转单项；历史单项repair语义不追溯改变。计算文本和逐步结果分开存储，不能把动态结果混入计划basis。

接缝：shared/math-check和question-quality→固定worker/math-host→question-math→repository历史/repair保护→Pi schema说明→原审核组件。无DDL。回滚点 apps/desktop/test-results/goal/kb-multistep-20261012/before；代码回滚保留新ledger事实，不重写旧事实。

按用户要求功能优先：build/type、少量真实SymPy与repair结构实例、一个正式Electron真实Pi错第二步→同run保留步骤修复→教师审核保存→冷启。保留首次失败，不重复全量回归。复杂图文三模式100分/24题分层验收与D/KB003仍后续，不凭本片宣称全科正确。

## 2026-10-12 当前：C3-C2多步骤校验限定接受；下一自然复杂三模式整卷

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3-C自然复杂图文三模式100分卷/24题分层质量；专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

Done（本片限定）：复用固定SymPy1.14.0/Pi原工具/同审核ledger，每题mathChecks支持kind=steps，2–6项非嵌套算术/恒等式/完整根集，一次Worker加载逐项检查。任一步mismatch隔离；unsupported明确人工复核；教师卡显示检查步数、逐项结果和式子。自动repair保留原步骤顺序/kind/数量，不允许降为单项或删步骤；关联解析编辑废止旧结果。旧单项计划/hash/回读语义保持。Pi收到逐步宿主回执，不能自行填结果；conditionsVerified=false及answerVerification=not_run不变。

Evidence：apps/desktop/test-results/goal/kb-multistep-20261012/progress.json。build/type exit0，SHA 78600365c4043a06dfb2910ad9aa55768657db4182a1c9a20eefa2621006c4b2/346文件；8个真实定向实例（全正确/错中间步/漏根/unsupported/结构边界/解析编辑/repair不降级/旧单项）；正式Electron真实Pi3项通过，2次启动，0renderer错误（education-journey-jRQ8HX/report.json）。实际三步matched,mismatch,matched被隔离，同run修复为全matched；教师UI明确批准仅保存1题，失败前版仍隔离；冷启同事实/逐步回执/原生历史不变，无provider重放。浅1366×768、暗1920×1080截图已实看。

Failed：首次构建从仓库根目录运行，因该层无package.json报ENOENT；转apps/desktop一次构建成功。产品实例本轮无失败。代码审查diff/before回滚点/实际命令已保存，首次错误说明保留。按用户要求仅关键实例，不重复全量领域/组件/207回归。

Doing/Next：先自然复杂图文source_only/hybrid/ai_original三模式100分卷与24题分层质量（按能力覆盖大学之前各科，明确原题/原创、图公式/答案缺口），再D真实错题五变式，再KB003后台增量/任务优先/30–40GB/安装。当前仍由Pi提交适用的形式化步骤，未自动抽取或证明全部自然语言条件；不得据局部matched宣称整题/全科正确。大请求仍16KiB/15秒/取消边界，教师不需要操作AST。Blocked：无。

Reuse/边界：沿现SymPy本地固定依赖、Pi编排、DeepTutor既有格式Worker、HeroUI审核组件，未加依赖/DDL/第二AgentLoop；没有假称DeepTutor/OpenMAIC最新版源码已全部迁入。课堂与Hermes支线按Master后续，不抢知识库/组卷主线。C3-B四文件交付和C3-C1恒等式证据保留。用户正式资料/数据库/凭据及Master未改，未提交/push。

## 2026-10-12 C3-C3 复杂公式Office交付合同

真实缺口：Paper导出目前遇到生成题/教师补充答案LaTeX即unsupported；图文混合卷不能正常交付。先补这个功能，再进行自然复杂三模式联合验收。

复用/比较：A现KaTeX0.16.47(MIT)输出受限MathML + 现Electron静态sandbox/Hana PDF + docx9.8.1 PNG插图（采用）；B seewo docx-math-converter包标ISC但LICENSE为MIT、下层mathml2omml明确LGPL3并需另一docx fork/jsdom/MathJax（本片不加）；C Pandoc/TeX本地进程体积与部署额外成本（本片不加）。不新造公式解释器/数学引擎，仅分隔符解析与既有渲染适配。官方KaTeX API/options/security和真实本地LICENSE已核。无第二AgentLoop/云端上传。

新paper-office-draft.v4保留同一paperSource/section/paragraph/figure合同，无新题库/DDL。只在含公式时编译新版本；v1/v2/v3生成与历史hash保持原语义。数学文本必须以$…$、$$…$$、\\(…\\)、\\[…\\]明确分隔，拒绝未闭合/未知指令/外链/HTML/宏定义/超限；不把裸LaTeX静默输出。单公式≤1000字符、≤200式/卷、KaTeX trust=false/maxExpand=100/maxSize=10/throwOnError；MathML为固定库生成，非模型HTML。分段不能切断公式。PDF静态原生MathML；DOCX公式段以同HTML本地高清图片保存，alt中保留原文本，明确非可编辑公式，不称已证明正确。保持原图独立源版本/教师图片核对。

Office host抽取原静态页面隔离宿主（无网络、权限、脚本、cookies），PDF仍调用未改Hana原函数，公式截图只从已确认文本生成，不新增文件读取授权。教师原审批卡显示同公式预览，标题编辑仍废止审批版本；图片存在时保留逐版本图片确认。生成版本paper-office4包含KaTeX固定版本，旧文件/审批事实不回写。

范围：shared合同/公式适配→Paper确定性编译→既有Office隔离渲染/Word→现HeroUI审批卡。KaTeX是已安装transitive升级为exact direct，MIT/license保留；无新增二进制，Windows沿Electron/system fonts，实际安装体积记录。回滚副本apps/desktop/test-results/goal/kb-formula-office-20261012/before；只撤本片代码保留产物/ledger。

按用户功能优先：build/type、公式/分隔符/权限边界关键实例、正式Electron真实Pi复杂多题卷→教师预览→Word/PDF→冷读。不重复全量回归。复杂自然扫描三模式/24分层质量未通过继续OPEN，不能以公式排版或生成步骤当数学正确性。

C3-C3合同补充：复用既有派生谱系触发器，增量添加xiaozhi_office_paper_lineage_v4（IF NOT EXISTS）。不新增表/事实源、不改旧v2/v3触发器；v4保存同一事务派生document_artifact_paper_sources并删除fallback AI来源。仅验收副本首次v4失败已保留，不迁移或修改正式旧资料。Word截图使用双倍固定CSS尺寸；宿主仅执行固定DOM测量，页面CSP继续script-src none，外部资源全拒绝。

C3-C3结果限定接受：见apps/desktop/test-results/goal/kb-formula-office-20261012/progress.json。6定向实例、真实4题100分/四文件/冷读与独立文件读回、学生/教师WPS实际打开通过；首次崩溃/派生来源/长解析边界失败均保留。Word为非可编辑公式段图片；自然三模式/混合原图与新公式/24题全科仍OPEN。下一C3-C4完整选项，再自然整卷→错题五变式→后台增量。


2026-10-12 审核可读性增量：见KB_REVIEW_MATH_DELIVERY_CONTRACT.md与kb-review-math-20261012/progress.json。复用严格KaTeX显示，3项正式页面实例/6显示实例通过；选择题选项已拼进保存题干，撤回上一片未证实的遗漏猜测，不建v5/新真源。下一自然图文三模式→五变式→后台增量。


## 2026-10-12 C3 自然扫描三模式与混合公式交付合同

上片审核公式可读性已限定接受（kb-review-math-20261012）。本片延续既有Pi原生出题→DeepTutor格式/质量审核→原PaperRepository/typed IPC→原蓝图与Office审批卡→SQLite/文件流程，不新建运行时/题库或依赖。

Recherche/Compare：A复用现selection+rich compiler+Hana Office（选择）；B搬完整DeepTutor/OpenMAIC生成运行时（重复Pi且改变真源，拒绝）；C重做解析/题库/Office（重复既有功能，拒绝）。上一轮确认本地DeepTutor/OpenMAIC指定根不存在；本片不声称新增上游迁移，只沿已审计vendored格式Worker、现KaTeX和Hana PDF实现。当前graph查询无函数匹配，已回退到相应领域源码。现混合compiler保留document原图，generated纯文经严格MathML，v4共享图片审批与来源CAS，需要真实合卷证明而非重复低层测试。

教师结果：以已接受自然物理5题/完整原图为原题，在同Pi任务一次起草5道不同知识域综合物理题（电路、浮力、凸透镜、热平衡、机械功效率），有明确教师参考值与条件，教师只在原审核卡核对一组。传统组卷UI完成source_only/hybrid/ai_original各5题100分，混合保留3原题+2原创精确配额；混合学生/教师Word/PDF通过原输出目录、逐版本图片确认和写文件审批交付。

变更：优先扩展已有generated-paper-journey执行这个真实实例；如暴露产品缺口，只修改对应compiler/generator/UI，不改App/db真源。已有扫描题不重新OCR、不写正式data/profile，不上传原文件/学生信息；仅使用已脱敏教师参考文本。无计划迁移/DDL。回滚点为kb-natural-three-mode-20261012/before，实际旧资料保留不覆盖。

验收：一次构建已有最新版本，正式Electron实际Pi起草5题→教师检查确认→三模式蓝图/配额/原图→混合四文件→冷读；独立文件文字/图像/数学alt读回，实看当前浅1366×768与暗1920×1080和文档页。旧source_only导出与纯公式四文件已有证据，不重复跑全套/全部模式12文件。若修改产品代码，补build/type及该失败的定向实例。现参考讲解仍不等于整题自动证明；24题跨学科/自然题目正确性继续独立质量任务。首次失败、准确build SHA、路径与命令必须保留。

本片发现的真实功能缺口：5题任务以普通propose_questions先交3题并等待，未达完整配额。修正现pi-session整卷指引和collection开始工具描述，明确8题以内的明确配额整卷也走现集合，内部不足不得教师逐批批准；无新运行时/DDL。失败3题保留未保存，该失败副本退出后保留候选未保存，未实际执行拒绝；后续在独立owned副本沿同Pi完整集合继续。新增修改范围两文件before副本已保存，需重建后跑同实际实例。


## 2026-10-12 当前：自然物理三模式与混合图公式交付限定接受

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3跨学科复杂题质量与验证缺口，随后D错题五变式；知识库/智能组卷完整专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。Blocked：无。

Done（限定）：复用现Pi集合、DeepTutor格式/质量Worker、PaperRepository、Hana PDF/既有Office和HeroUI审核卡。修正明确题数/蓝图整卷8题以内也用集合，内部齐额后一次题目审核；5原始扫描物理题保持事实原样，5道不同领域综合物理原创题经教师编辑核对保存。正式UI确认source_only/ai_original/hybrid各5题100分、无缺额；hybrid为3原题+2生成题。混合学生/教师Word/PDF四文件审批保存、源图SHA/像素和文本/公式alt独立回读、冷启逐字节一致。每文件7原图、2公式段；Word公式非可编辑图片。

Evidence：apps/desktop/test-results/goal/kb-natural-three-mode-20261012/progress.json；build/type exit0，SHA697f31f744617d3f65bc1099ad3fe6e4974892a4ed1a1a59c3580ea23fcf5d54/347文件。初次education-journey-ypzrr9通过5项（题目、三模式、学生Word），最终education-journey-0KsDlx复用相同确认事实继续6项/2启动/0renderer错误，四文件独立回读通过。实际WPS学生/教师Word打开并另存只读渲染，输入未变、用户既有WPS未动；10张PDF页合图已实看，原图/新题/答案分离可见。未重跑全量回归、未新增依赖/DDL/IPC/AgentLoop。

Failed：首次5题仅提交3题待审，候选保留在失败副本未正式入库；真实AI热平衡差值326/67错误，经教师在原审核卡修正为320/67及403200/67J，不是自动验证能力。复制样本绝对资料路径触发来源守卫，仅测试副本经目录归属/原SHA核对后重定位。脚本公式转义、发送时序、恢复title路径和重复选择器失败均保留。初次PDF拟内容读取30秒观察超时，复用既有试卷60秒等待后成功；具体延迟原因未证实，不宣称性能修复。

Doing/Next：1.C3补24题跨学科分层质量与可形式化步骤/条件覆盖，保持未验证/冲突可见，不能由物理5题声称全科完成。2.D真实错题→检索/五变式→自动可行校验/失败隔离→集中教师确认→针对性练习。3.KB003后台增量、任务优先、取消恢复、30–40GB与安装。优先补实际功能，每片仅关键实例及直接风险检查；严禁无关测试阻塞实施。

Reuse边界：延续现Pi唯一编排及既有上游适配，不冒称本片新迁入三个完整项目。来源、数学正确性、生成题身份、文件版本与学生隔离规则保持；自动答案完整证明、全科精度和大库未验仍OPEN。正式资料/数据库/凭据、Master未改，未提交/push。


## 2026-10-12 C3 修复检查范围不可降级合同

教师可见结果：失败候选继续隔离；同Pi修复不能把求实根改成正根、把恒等式改成无变量算术、或删换步骤。正确修复仍沿原审核卡集中确认入库。

Recherche/Compare：A扩展现question-math/QuestionReviewRepository两处共同repair plan gate（选择）；B新建解题Agent/审核库（重复Pi与事实源，拒绝）；C只改prompt（不能保证主进程约束，拒绝）。复用固定SymPy1.14.0/既有BSD-3-Clause轮与Worker、DeepTutor格式Worker、既有Pi及HeroUI审核，不迁上游AgentLoop。官方solveset文档 https://docs.sympy.org/latest/modules/solvers/solveset.html 确认实数/复数等domain是求解问题的一部分；本次无需新依赖。本地DeepTutor/OpenMAIC指定目录仍不存在，不冒称新增完整代码复用。

缺口：retainsQuestionMathPlan对非steps parent直接true，steps仅保留kind不保留polynomial.domain，因此x²=9漏负根可通过domain real→positive逃避。入口propose与冷读lineage均用同helper，修改该领域边界贯通现工具、SQLite及UI，不另加表/IPC。允许改AST/答案进行真实修复，固定原kind与每步domain；允许在末尾追加检查但禁止缩短或重排既有角色。仍不声称模型提交检查与自然语言完整语义自动对应。

兼容/回滚：合法既有repair链无改hash/schema；历史违规降级链会拒绝读取，不自动重写/删数据。恢复本片before源码再build可回退；原用户文件/数据库/凭据不改。验证范围：真实fixed Worker+现Repository失败/降级拒绝/正确修复+teacher-quality确认的定向实例；最后源码build/typecheck及现正式Electron多步骤Pi失败→修复→教师核对→冷读。不反复全量回归，24全科质量仍OPEN。


## 2026-10-12 当前：修复检查范围约束限定接受；C3全科质量继续

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3跨学科复杂题与条件/步骤验证缺口，随后D错题五变式。专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交，HEAD/origin一致）。Blocked：无。

Done（本片限定）：现QuestionReviewRepository共享repair gate保留原单项/步骤kind及polynomial.domain，拒绝漏实根后改为正根或更换检查类型逃避；可以修正AST/答案、保留原单项为首步后追加更强检查。Pi工具说明/失败反馈同步说明；同ledger、源版本、教师确认、冷读和原SymPy继续复用，无新依赖/DDL/IPC/AgentLoop。既有合法检查hash不变，历史违规降级链拒绝读取，未自动修改事实。

Evidence：apps/desktop/test-results/goal/kb-repair-scope-20261012/progress.json。最终build/type exit0，SHA52c6a25cf9003f0f5df26f8372963e9c8356dfd260192fe93175112fcba9e912/347文件。一个定向真实Repository/SymPy/SQLite实例验证漏负根隔离、两种降级拒绝且零新增候选/事实、合法补根需教师批准；其余边界回调未执行。正式Electron education-journey-qDhqDQ真实Pi三步因式分解失败→同run保留三步修复→教师确认一题→冷启无重放，3项/2启动/0renderer错误。浅1366×768/暗1920×1080审核截图实际查看；本片未新增UI组件或重复全量回归。Failed：无失败，三个源码完善版本构建均通过，最后一次为验收build，回滚副本在before。

先前Done仍保留：kb-natural-three-mode-20261012/progress.json的自然物理三模式5题100分和混合3原题+2原创/四Office文件/WPS/冷读限定接受；教师修正真实热平衡算术错误，不能据此声称自动全题正确。

Doing/Next：C3的24题跨学科分层质量、自然图文条件和形式化步骤覆盖仍OPEN；本片只保护已提交检查，不自动理解或证明完整题意。随后D真实错题→五变式→校验/隔离→集中教师确认→练习；再KB003后台增量/任务优先/取消恢复/30–40GB/安装。功能优先，仅对应关键实例与直接风险检查，不让无关测试阻塞主线。完整DeepTutor/OpenMAIC/Hermes等Master余项继续ACTIVE，不重新建立运行时。

## 2026-10-12 功能优先：整卷修改一键检查合同

目标C3：教师修改多个题组后一次点击“检查全部修改”，显示进度；仍仅一次整卷明确确认。复用已核HeroUI Button/ChatTool、同OfficeControlState互斥与draft、现reviewXiaozhiQuestions typed IPC、DeepTutor格式Worker/SymPy和原集合ledger，不另建服务/数据库/模型调用。检查不会自动确认、写正式题库或声称整题正确。

实现范围：PiQuestionCollection.tsx及原question-collection-journey实例。点击时固定待检查修改稿、互斥锁，逐组沿原主进程检查；禁用编辑和确认。失败保留所有稿件及已检查回执，刷新现集合可见问题；重试仅剩余修改，不吞失败。未修改题组不重复检查。源版本、session隔离、revisionHash/CAS继续由原host校验。无DDL、依赖或用户数据迁移；回滚副本test-results/goal/kb-bulk-review-20261012/before。

验证只做build/type和一个正式Electron实例：多组修改→一次检查→当前版本全卷确认→100分预览→冷读。沿已存在真实Pi实例，不重跑领域全套/组件回归或另建测试框架；首次失败保留。24题全科质量仍OPEN，随后D错题五变式和KB003后台增量。本轮记录按实际结果更新。

## 2026-10-12 D五变式独立入口交付合同

目标：已确认真实错题中点击“生成5道变式练习”，沿同Pi读取学习证据与根题/本地关联题，内部起草五道有不同训练目的的变式，五题集中审核保存，再沿原PracticeReview确认安排；不捆绑14天计划。两次不同授权分别是题目正确性/内容核对和练习安排确认，不自动代教师批准。

Reuse/Compare：A沿当前MistakeFacts、QuestionReview/原mathChecks修复隔离、DeepTutor固定f070格式纯函数、PracticeReview及Pi（选用）；B复制DeepTutor整套QuestionPipeline（重复loop/事实源，不采用）；C新建解题/练习服务（重复已实现能力，不采用）。上轮已读最新DeepTutor QuestionPipeline、OpenMAIC SDK与Hermes技能入口/许可证边界；本片没有新依赖或vendor变动，复用现HeroUI Button，官方API上轮已核。Pi原生工具提供全部需要的生成/读取/等待，新增薄提示入口而非独立工作流引擎。

范围：shared/mistake-facts新增独立prompt，StudentMistakeFacts增加原Button及同脱敏交接；扩展既有photo-learning-cycle实例模式和OCR/facts实例参数，真实扫描图片→本地OCR/教师完整转录→五个变式→集中内容审核→安排确认→冷读。已有长周期入口保留，无DDL/IPC/schema变更；正式用户数据库/图片/凭据不改，测试只在owned独立profile。回滚点kb-variant-five-20261012/before。

完成定义：当前build/type、一个正式Electron真实Pi实例，原照片与根题、学生实际记录不改变，5变式保留亲缘、五题练习/usage精确、拒绝或未确认不保存。计算仅验证所列形式化步骤，完整题意/全科质量不冒称正确。真实扫描参考答案为此前教师给出答案，不当独立官方标准答案；本次模拟学习作答明确只属于验收学生。

本片限定接受：正式education-journey-g8JAH5 14项/3启动/0renderer错误，当前build SHA84eae164a38236264b5557ef6a993d45d2937c79247b6756def98b555720e811/347；两次授权、5变式/1练习、冷读和学生事实不变。实际教师修正及首次失败见progress.json，未声称全科自动正确。下一KB003及C3实际缺口。

## 2026-10-12 KB003 内容增量导入合同
教师重新添加同名同内容资料时复用原件/解析/任务/来源身份，不再复制、解析或创建图节点；同名内容变化作为新不可变资料版本保留旧题目/引用。现队列已支持自动后台/优先/取消/冷恢复，KEEP不重建。A复用MaterialRepository原件核验+现importKnowledgeResources/队列（选用）；B迁入DeepTutor完整资料后台（引入重复真源/运行时，不采用）；C新建目录监视器/数据库（当前无必要，不采用）。无新第三方代码、依赖、DDL、AgentLoop或外部上传；旧数据只读比对，损坏/缺失原件不可假称复用，取消任务不偷偷重启。
改动：MaterialRepository增加原身份查询与受控原件hash验证；原导入Facade在复制前流式hash/校验后复用；共享AttachmentImportItem增加可选reused，原HeroUI页面显示新增/复用数量。一次独立Electron关键实例：添加文件→收录→重复添加零新增副本/任务/chunk→改内容新版本→冷读，两份来源各自正确。补损坏本地副本后重导不复用及取消任务重导不重启直接边界；不跑原长队列全套/全库回归，30–40GB/目录监控/页级checkpoint仍未验。回滚副本material-incremental-20261012/before；正式用户数据不改。

KB003本片限定接受：5DLRMh 5项/2启动/0renderer错误；build5e0a1acb…/347，当前源重复/变化/损坏/取消/冷读验收；首截图问题及回滚见progress.json。下一目录批量，不拿小样本认定30–40GB完成。

## 2026-10-12 KB003目录批量导入合同
目标：我的资料点击“添加文件夹”，主进程原生授权一个目录，异步遍历子目录，分批20个文件走原importKnowledgeResources/内容复用/后台确定性队列；状态显示已处理/复用/失败/跳过，停止后保留已存事实，再次选相同目录复用，原来源/教师取消不变。
Reuse/Compare：A Node fs.promises.opendir/现资料Facade+队列+HeroUI Button（选用）；B DeepTutor完整文档后台（重复事实源/运行时，不迁入）；C chokidar/独立队列（本片不需要持续watch，新依赖无必要）。Pi不负责文件系统扫描；其office_read_material仍沿原队列优先，OpenMAIC/Hermes没有适合替换本地导入事实的能力。官方Node/Electron/Button API核对；无新包、vendor、DDL或第二AgentLoop。
新增assets/material-folder-import.ts薄适配；shared版本化folder结果/进度，main持有native路径、同互斥/取消，typed preload无路径参数，原页面Button/状态复用。跳过链接/非支持文件/嵌套数据根，不删除或上传原件；最多32层，结果明细只保留50条并提供完整计数，不无限堆到IPC。错误/跳过诚实报告。失败/中断后再次选目录走既有去重恢复，不假称自动目录检查点或持续监控。无需迁移；回滚副本material-folder-20261012/before。
关键实例：真实原生目录选择→跨子目录60资料/自然扫描PDF→内部批次→后台→重复零新增→变化单资料保留旧源→取消与再次选择→冷读；核原目录不变、深浅两尺寸。只构建/类型及本片实例，不重复整库回归；30–40GB/安装/全科图文正确性另验。

参考API（2026-10-12实读）：Electron dialog.showOpenDialog/openDirectory https://www.electronjs.org/docs/latest/api/dialog；Node fs.promises.opendir https://nodejs.org/api/fs.html#fspromisesopendirpath-options；现HeroUI Button onPress/isDisabled https://heroui.com/en/docs/react/components/button。仅适配调用，未复制第三方源或添加依赖。首次命令路径错误（工作目录已经apps/desktop又拼apps/desktop）未写文件；补正确绝对路径后重新完整build/type通过。首正式实例J11hab在停止观察时目录已全导入，3项通过但停止断言失败；保留现场，后续将真正目录open暂停到停止发出，不伪造文件或Worker结果。

目录批量本片限定接受：XVMx7K 5项/2启动/0renderer错误，SHA0bb1f856…/347；61资料、重复61、只改1、停止20/40、重选补20、最终102冷读；两尺寸深浅图实看。首失败与真实open观察控制、回滚在progress.json。未推断全科正确/40GB/目录自动断点。

## 2026-10-12 C3选项正文一致性合同
真实五变式Q1题干含A–D且另带options，旧保存/质量候选直接再追加造成重复。复用DeepTutor原格式Worker及现QuestionReview/质量/题库/练习；只加共享正文适配器，不改上游固定AST、原稿/审批摘要或旧题库事实。完整末尾A–D与字段逐字一致时只呈现一次；不一致时不删原文，质量隔离、教师校正后重新检查确认。审核公式预览与保存和去重候选使用同一正文。无DDL/依赖/第二loop/自动修改教师事实。
A保留现Worker加共享适配（选用）；B改上游规范化源码（破坏固定复用，不采用）；C新建题目服务（重复，不采用）。本片build/type及一个正式Electron选择题实例：真实Pi起草→冲突隔离→校正→明确保存→题本/冷读；最小确定性例覆盖非选择题、数学正文及不同选项标点保留。不运行全套回归，不认定全科正确或原题图理解。回滚kb-choice-text-20261012/before；先前旧重复题需要教师显式编辑，不批量改写。

本片限定接受：htTAhu前3项功能成功后定位隐藏chat失败，Rqr9hg同build/owned数据继续2项成功；共5功能/3启动/0renderer错误。SHAa0dc67e16cb2a845eccf747f9d1da03bd6062e15c88fed18552369bdcc0bab2c，浅1366/暗1920题面实看，源题及审核历史不变。完整失败/命令/回滚在kb-choice-text-20261012/progress.json；非全科整题正确/练习导出重验。

## 2026-10-12 C3生成题图表完整性交付合同
目标：纯文字生成题不能以“如图/下图/见图/图甲”等悬空图示、缺数据的“下表”或未交付Markdown/HTML图冒充完整题。复用现DeepTutor格式Worker、questionQuality/repairFeedback/SymPy、Pi同run三次修复、质量卡和统一批准，不新建loop/表/服务。自然source_only QuestionDocument及原图不受该生成题专用检查影响。外部URL或父题有原图不等于新题交付了图；本片不假造图关系，也不批量改写既有教师事实。
A上游DeepTutor当前_collect_quiz_issues检查基本字段/题型，无交付图存在性门禁，复用其原格式函数再加本地薄交付检查（选用）；B复制完整QuestionPipeline/多模态loop（重复Pi，不采用）；C新增VLM判断生成题是否完整（额外不稳定模型调用，不采用）。OpenMAIC互动场景渲染不是当前题库/Office图附件合同，不强行移植其runner。现质量卡直接展示新增错误，反馈同错误代码给Pi修复；允许明确数据Markdown表格，题干“画出函数图像”等不当成缺图。条件转为自足文字只能来自实读题或本次用户明确条件，不能模型补事实。
范围：shared新增确定性生成题图表helper，quality专用issue/message，原工具指引；沿原multiStepAiJourney扩展一个复杂坐标几何的图依赖失败→三步骤计算matched仍隔离→同run保留数学检查修复为用户已给全文条件→教师批准→冷读。构建/type及本片定向实例，不重复长全套，另最小跨学科/图像/表格反例。不证明完整数学语义或24题全科学科准确率。无DDL/依赖/新vendor，before副本回滚；已确认历史只读，不自动迁移。
实读上游：https://raw.githubusercontent.com/HKUDS/DeepTutor/main/deeptutor/agents/question/pipeline.py 与 LICENSE，2026-10-12；实际固定复用仍f07029c/Apache-2.0，未改原源码。

本片限定接受：正式dufXQ5 3项/2启动/0renderer错误，SHAc3ae33394f8685e22041a82c7c5afffa71a4f6723d809debc6a47fe6528e4576；五步matched仍隔离缺图→同run仅用户坐标修复→教师确认→冷读，双尺寸图实看，保存答案独立坐标值复核。无正式失败，不拿存在性或一题证明全科/自动看图。精确命令/边界/回滚见kb-visual-completeness-20261012/progress.json。

## 2026-10-12 C3多小问答案/解析覆盖合同
目标：明确连续(1)…(N)/（1）…（N）（2–20问）的生成简答/论述题，在答案和解析中逐问使用相同编号并填写非空内容；缺编号或空内容沿现quality隔离→同Pi修复→教师审核，不新增模型裁判/运行时。只认句首、换行或句号/分号后的编号；坐标、f(1)、代码块不识别为小问。此为结构覆盖，不判语义、条件充分或数学正确；完整但未编号的生成解析需要内部重排，不称其数学错误。其他格式仍教师审核，旧已确认事实/hash不迁移。
复用已固定DeepTutor格式AST及同QuestionReview ledger/repair/SymPy/页面；最新上游_collect_quiz_issues没有分问答案检查，因此增加薄共享适配而不复制Pipeline。自动repair必须保留被识别原小问编号及非空题干，防止删小问逃避；教师显式编辑能力保留。无新依赖/DDL/IPC/上传或学生事实修改。
范围：generated-question-completeness/helper、quality错误消息、原repository自动repair入口/冷读、原Pi提示；复用multistep正式实例扩展缺(2)答案及缺(3)解析、已提交计算全matched→同run补齐→教师→冷读，最小编号误判边界，构建/type即可，不全量测试。回滚kb-part-coverage-20261012/before；完整24题跨学科与40GB/安装仍OPEN。本片结束据真实结果更新状态。

本片限定接受：IPIHRs 3项/2启动/0renderer错误，SHAd915204c…/347，漏(2)答/漏(3)讲隔离→同run补全→教师→冷读；双尺寸实看，独立坐标答案复核。无失败；精确记录/回滚见kb-part-coverage-20261012/progress.json。其他编号/语义/全科仍OPEN。

## 2026-10-12 KB003后台恢复/正在解析资料优先合同
实际缺口：start使用UI限100的rows恢复，只恢复前100条running；enqueue对running直接return，教师/Pi当前所需后台资料不能升级优先。复用现MaterialParseQueue、ai_tasks和原资料版本CAS/原件/原子commit，SQLite为事实源；不是Agent调度。A修现队列分页恢复+同宿主claim转换（选用）；B引DeepTutor后台服务（第二事实源/不匹配Electron）；C安装独立队列/数据库（重复且不适合单机）。Pi只继续调用既有prepare，UI/IPC无需另造。Node SQLite/现CAS可实现，无第三方复制/新依赖。
恢复按rowid游标每批100遍历全部running；合法活进程owner保留，死亡owner转pending、非法owner隔离，教师cancelled不恢复。对自己当前running且priority0任务，优先请求先CAS撤销旧lease并转pending100，终止旧Worker，然后同队列消费；不原地修改lease绕过原子提交。不抢其他进程owner。失败/竞态仍原错误，源版本/取消保持。
范围仅material-parse-queue和原material-queue-journey定向实例，备份kb-queue-recovery-20261012/before。验证现SQLite分页大于100/活owner/取消/非法，正式Electron真实扫描解析时点优先→原claim失效无部分事实→完成→冷读。构建/type及关键实例，不重跑旧完整优先/队列套件，不声称40GB/页级断点/目录自动恢复。旧数据库无需迁移，原资料不修改。
本片实际复用现HeroUI Button：仅让正在收录、仍为后台优先级的任务也显示原优先处理按钮，没有新增组件/接口。Node process.kill(pid,0) 存活探测及SQLite条件UPDATE官方文档本轮核对：https://nodejs.org/api/process.html#processkillpid-signal 、https://www.sqlite.org/lang_update.html；本片无外部包迁移。

本片限定接受：zUPqMB 3项/2启动/0renderer错误，SHA00893780…/347；当前后台资料优先、六页真实OCR及冷读、3项定向SQLite跨批恢复。双尺寸实看，完整日志/边界/回滚见kb-queue-recovery-20261012/progress.json。非40GB/页级断点/全科准确率。

## 2026-10-12 C3原题题型匹配与题本公式显示合同
实际缺口：pure source_only使用原字符串题型比较，混合/原创已有六种中英对应；teacher_resource/local_bank中canonical英文与中文蓝图错误缺额。KEEP现paper-selection/types映射，统一全部模式匹配；仅选择题/填空题/简答题/解答题/判断题/编程题六组已有对应，不把实验探究/阅读理解/作文等未知类型猜成解答题。保留原题型、知识点、事实/来源版本及精确去重，不迁移旧题目或审批hash。原题/生成配额、教师确认不变。
题本h3原题干直接文字，已有QuestionMathText可用于strict本地MathML、原文逃逸、错误fallback；直接复用组件，增加h3输出选项保持语义及布局，不改原题字符串/保存/答案。无新UI库/renderer、依赖/DDL/IPC/AgentLoop。A沿现选择器与本地公式组件（选择）；B重做题型/题库/LaTeX库（重复）；C迁DeepTutor完整QuestionPipeline（重复Pi）。本片不复制新上游源码，固定原格式AST/现Pi原有工具不动。
验证：最小六类型跨模式匹配/未知类型/原题和生成边界；原paperJourney扩展单个正式Electron实例，教师UI建立6道高中数学复合题canonical英文→中文蓝图6题100分→确认→原类型/内容未变→冷读；题本真实公式渲染/非法公式保留原文，浅1366/暗1920实看。不称24题全学科已验/独立数学准确率、自然全卷或导出重验；这些继续主线。备份kb-source-types-20261012/before，旧数据只读、不覆盖用户资料。

本片限定接受：6TgYvs 3项/2启动/0renderer错误，SHAe85562b5…/347；六题100分、题本公式/严格失败fallback/原事实冷读。首静态导入及错误公式反例失败保留，修正仅测试fixture后通过；双尺寸实看，六题参考值人工算术复核。记录/回滚见kb-source-types-20261012/progress.json。复用参考KaTeX官方supported.html及DeepTutor question/pipeline.py，未复制/升级新依赖。不标全科自然题或自动答案正确。

## 2026-10-12 C3题本与组卷表格/公式阅读合同
教师结果：数据表格在题本、答案解析及组卷预览中直接可读，表内单位与公式保持正确显示；原题全文/批准/版本不变。KEEP现QuestionMathText/officeMathHtml和HeroUI MarkdownRoot（已在聊天使用），薄组件适配GFM表格及行内公式。A复用现组件与KaTeX（采用）；B新写表格解析器（拒绝重复）；C整套DeepTutor/OpenMAIC渲染/Agent（不匹配当前题库，不采用）。Pi无需额外调用；现DeepTutor格式允许stem表格，不迁上游runner；未新增依赖。
只读Markdown：原HTML不执行，图片不发网络请求，链接作为普通文本，公式trust=false/strict保留；无新rehype-raw。表格题干用div而不是非法h3嵌套table。正文仍是原SQLite文字，不改DDL/IPC/CAS/事实。长表局部滚动，页面不横溢；沿原题本/组卷实例，用两道高中生物实验数据题（含公式/多问/单位）验证表格、答案/解析、100分组卷、教师确认、冷读及浅1366/暗1920。独立核对算术与给定实验条件，非天然资料/全科准确率/Word表格重验。原fallback实例保留，本轮不重复全回归。回滚kb-question-tables-20261012/before，仅本片改动。
官方react-markdown/remark-gfm文档与MIT许可本轮实读；HeroUI Markdown为项目既有授权源，无抓取付费代码。接口按组件已用Components覆写，禁img/a访问。当前知识库组卷仍DOING；本片完成继续自然跨学科复杂资料。

本片限定接受：DTHZjS正式3项/2启动/0renderer错误；build53696e57…/347，两道实验表格题的题本/答案/100分组卷/冷读均通过，四图浅暗双尺寸实看。无正式失败；两份参考算术/假设复核及完整边界/回滚见kb-question-tables-20261012/progress.json。表格Word/PDF未验，下一片优先同Office宿主交付，非全科/自然OCR/官方答案证明。

## 2026-10-12 M09表格试卷Office交付合同
KEEP现docx Table/TableRow/TableCell、Hana isolated PDF job、strict KaTeX、版本化文件审批与已确认paper快照。新增v5 Office表格纸稿，旧v2/v3/v4合同保持；v5允许rich节带现OfficeTable。按marked（已装MIT）GFM AST识别表格，公式先占位再恢复避免竖线拆列；表格前后文本按现section依次分段，多个表不移到末尾。PDF单元格用现officeMathHtml；Word原生表格中仅公式单元格复用现MathML截图，其余可编辑文本。表格超过8列/200行/120字符单元格/121节等明确拒绝，不截断。保持来源CAS、学生答案隔离、文件审批/停止、旧历史兼容，不新增Agent/模型/依赖/DDL。
A扩展现OfficeTable与renderer（选用）；B整段截图（不选，丢可编辑表结构）；C整套DeepTutor/OpenMAIC导出服务（重复并且不能维持本地审批）。Pi仍唯一编排。本轮用上一已接受隔离生物题真快照复用冷读，然后实际Pi四次请求→Office预览审批→学生/教师WordPDF→四文件/表格/公式/答案隔离/冷读。构建与此实例，不重复全套；自然全科正确性/40GB/安装仍OPEN。回滚before九文件，仅本片变更。
实际实例发现v5保存需扩展既有paper谱系触发器；新增幂等v5触发器复用同表和事务，旧v2–v4保持，无新表。缺失触发器导致保存后snapshot configuration，保留HB5VVB首次证据，补齐后重跑四文件闭环。

## 2026-10-12 C3复杂原题可视框选合同
教师结果：跨页题面、答案、解析区域在原页拖框或键盘微调，无需四坐标手算；使用范围后由现main裁切，同review修订版本和教师完整核对仍必需。KEEP既有MaterialPagePreview typedIPC/取消/权限/sourceCAS、OriginalMultiRevise/8区域上限/原始PDF与图资产、HeroUI弹窗按钮。EXTEND PiOriginalMultiQuestionReview范围行，ADAPT小弹窗只接已授权resource/version/page并回传PageBox；不在renderer裁图或上传、不自动更改转写/事实、不新IPC/DDL/Agent。
复用A react-image-crop 11.1.2（采用）：官方源码/README与ISC原文实读，npm metadata115367B展开、无运行依赖、React>=16.13.1，含百分比/自由矩形/触控/键盘；锁版本与lockfile，纯renderer JS/CSS无原生二进制，Windows打包现Vite纳入。不引Canvas导出/EXIF纠偏，使用主进程已规范化PNG。B Hana CropOverlay（Apache2本地原文实读）：圆形头像/独立API/固定尺寸，不贴题区，仅参考；C自行pointer拖拽（不采用，重复成熟组件）。DeepTutor现question/pipeline无本地Electron题区选择；OpenMAIC课堂renderer不匹配，Pi不提供图形选区。HeroUI官方list/docs已核，复用现modal/button无crop组件。来源官方github.com/dominictobias/react-image-crop及node_modules/LICENSE.md保留，部署许可证随包保留；退出时删除薄adapter/import与单包回退，不涉及用户数据。
新文件OriginalRegionPicker.tsx/CSS，父范围行增加框选按钮；全页请求绑定原视图resource/version和已选页码，关闭/重试取消原preview；先核对返回版本/页码/整页box，失败保留原范围。异步调用身份变化不可套用旧结果，保存请求锁定防重复，框选只是候选修订不是教师批准。旧数字编辑兼容。范围变化重置sourceChecked/coverage/complete，拒绝/失败保持错误与重试。
验收按现original-multi-journey增加visual-region-only：真实授权物理扫描原题pending→整页→矩形/键盘→cancel无事实写入→原revise裁切source版本→完整教师核对→SQLite/图资产→冷读；双尺寸弹窗、错误/取消按本片风险。构建及本次实例，不重复旧全套。复杂题答案/全科/自动切题正确性不在本片完成声明。回滚kb-visual-region-20261012/before，仅本片diff，无正式资料修改。

本片限定接受：Y5XyXV 4项/2启动/0renderer错误，SHA45712318…/347；真实物理复杂扫描拖框取消、键盘微调、main裁切/CAS、教师全文确认与冷读通过，双尺寸实看。ISC原文随renderer静态资源输出，功能实例后只补许可证重构建，运行代码一致；触控/安装及全科答案仍OPEN。完整日志、首次构建修复、源/crop SHA、回滚见kb-visual-region-20261012/progress.json。

## 2026-10-12 C3原题候选结构化转写合同
KEEP现Pi工具、observed资料版本、OriginalMulti ledger/CAS/图资产、六字段projection、教师审批。当前stem有候选而其余五项全靠人工复制；EXTEND同工具可选transcription v1（formulas/tables/figures/choices/subquestions字符串，每项<=4000，总含stem<=24000B），main严格校验，包装为全部missing的候选projection；任何模型转写均不是已核对，空项不自动标不存在。教师在现表单校正/确认；不额外模型调用、图上云、Agent、IPC、DDL或依赖。pending读取允许missing；confirmed effect/decision仍完整校验；候选改变绑定proposalDigest防call重放篡改。参数缺省沿旧行为、旧digest不改变。
A复用现Pi原生schema+projection/教师控件（采用）；B DeepTutor最新question/pipeline.py及Apache2已读，其生成/AgentLoop没有本机sourceCAS及教师六字段转写，现固定f07029c纯helper保留；C整OpenMAIC classroom或独立OCR/LLM服务（不匹配且重复）。本地历史D:/WorkProject/DeepTutor、OpenMAIC本轮不存在，不声称复核其HEAD；官方源只读核查，未复制上游。Pi仅承担原有一次提案，不把看不到的图义凭空补齐。无新增UI库，复用HeroUI已有TextArea/状态选择。
在现original-multi-journey增加transcription-only隔离实例：真实扫描原题＋已有人工参考转写作为明确用户输入→实际Pi同工具结构化提交→UI全部候选missing且不能批准→编辑一字段不改变事实→教师核对→同ledger确认→重启精确回读；截图双尺寸。覆盖严格schema/accessor/超限/禁止模型provided、pending完整性及旧缺省；本次构建和定向实例，不重复大套。样本候选由用户参考输入，不证明模型自动看图正确或24题全科。before逐目录回滚；正式用户数据不触碰。Next仍自然复杂全科质量及KB003。

本片限定接受：education-journey-Lx8dHs 4项/2启动/0renderer错误，SHA67a3cdc6093d388eff0e384c31faf0f0ce2890f395f841d31f2fc4fb2ffb1d6d；严格契约/SQLite40项、真实Pi候选预填/教师审核/冷读和双尺寸实看。候选参考文字来自明确用户输入，不证明自主看图/OCR/全科答案；空字段不自动确认。无新包/运行时/模型调用。完整首次失败、命令、回滚、源版本见kb-transcription-20261012/progress.json。

## 2026-10-12 KB003 扫描资料按页接续合同
功能优先：停止、任务抢占或退出后保留已识别页，下次从下一页继续；未完成正文仍不可检索，全部完成后沿现事务/CAS提交。KEEP同MaterialRepository/Pi/确定性队列、RapidOCR/PDFium现锁定模型和主进程权限。EXTEND私有PDF请求v2与已完成页事件，旧v1图片/预览/layout协议保持；页缓存是可删可重建的本地衍生物，按源SHA+worker SHA+引擎绑定，不新数据真源、AgentLoop、DDL或IPC。缓存严格大小/序号/完整性/路径校验，损坏重识别，绝不把缓存当教师确认；失败不提交半篇正文。新runtime独立resume-v2目录，旧layout-v1完整保留可回滚，无依赖或模型下载。
A复用现逐页PDFium+RapidOCR并缓存（采用）；B另起DeepTutor解析Agent或OpenMAIC服务（重复且不能保持权限/CAS）；C换OCR模型（本片不需要）。Hermes技能反馈与OpenMAIC课堂在知识库主线收口后接入，同Pi唯一编排。无新许可证/依赖，保持已核Apache2/MIT/PDFium notices和模型lock。
范围：现50页/50MiB/1MiB正文边界不放宽，先实现接续，再评估长教材分页。按既有golden PDF runner加resume-only：实际六页扫描经UI导入→至少一页完成后停止→零正文事实→重启/重试从下一页→六页事务提交/冷读；损坏缓存退回重识别。仅build与该实例，不重跑旧全套。回滚before及旧layout-v1 runtime，保留原资料/配置/历史。

本片限定接受：MzsnED 3项/3启动/0renderer错误；缓存实例5项、build/type通过。完成第一页停止→冷启第2页继续→六页事务正文→冷读。具体SHA/命令/回滚/首次调整见kb-ocr-resume-20261012/progress.json。未重复旧全套。长文档/容量/安装仍OPEN，Goal工具仍历史blocked，本轮无技术阻塞。

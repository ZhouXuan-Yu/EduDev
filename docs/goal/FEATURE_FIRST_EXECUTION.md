# 小智三主线：功能优先执行表

## 2026-10-22 最终构建资料备课回归完成，停止加功能

最终构建`4dfb959f...`/373上，`pi-teacher-materials-current-czmU6b` 5/5完成读资料、完整备课稿、41分钟改稿、审批保存和冷启重开；8次DeepSeek HTTP200、0 renderer错误、审阅/保存hash一致、源DB不变、冷启零重放。

资料备课当前软件主路径无需再增加功能。下一唯一动作由目标教师/课程审阅者执行：检查41分钟教学结构、8道练习与答案、五年级表达、长稿定位、一次修改的易用性、失败恢复和求助成本。记录真实卡点后再改；没有真人证据前不进入错题少练或课件复用，也不新增外围入口。

## 2026-10-22 最终H10收口后回归教师主线

H10当前软件矩阵已在最终构建`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373收口：网络两轮5/5、图片两轮13/13、文件14/14、renderer240/240。H10仍只是限定接受，整体与VPN-off、安装、真人、真实学生图、课程质量和Office/WPS放映保持OPEN。

任务线现进一步收紧，只保留三条教师可见结果，并按顺序一次推进一条：

1. **资料备课/讲义**：真实授权资料→实读→形成完整稿→教师只改一处→全文审阅→确认保存→冷启重开。下一唯一入口即此条，重点记录补问、等待、长稿定位、改稿和失败恢复。
2. **错题少练**：一条取得真实反馈后，再做真实学生错题图→本地OCR→教师校正→错因→少量练习→难度/顺序/布置。
3. **已有课件复用**：最后做已审讲解→已有课件副本→PowerPoint/WPS动态放映→投影可读性。

工程改动必须直接消除上述某一步的真实阻塞，否则不进当前队列。不新增任务类型、领域页面、演示题材、第二AgentLoop或外围工具。

## 2026-10-22 日常配置副本联网与网页截图收口

最终构建`d8ec…`/373下，真实日常配置副本连续两次5/5完成公开搜索、两正文、内置浏览器和截图。浏览器方案新增同URL已验证步骤的只读观察：snapshot/screenshot等可追加，navigate和页面交互仍需要新的任务准入。源日常DB不变，测试副本删除。

当前已完成的H10软件小项为保存配置、旧会话、当前网络搜索和浏览器截图。VPN-off、安装、真人与Office/WPS动态放映继续独立记录；产品主线回到辅导教师资料备课。

## 2026-10-22 日常保存配置与旧会话副本兼容

H10新增最小只读副本验收，不再需要把测试聊天写进用户日常profile。最终构建`a665…`/373下，副本恢复保存的DeepSeek/flash/auto DNS，旧备课会话4消息/2turn可读且native/DB字节不变，新会话可用同一配置完成真实请求；连续两次4/4，源DB不变。

这解决的是教师重启后继续使用旧会话和保存配置的基础门槛，不是新业务功能。H10的VPN-off、安装、真人和Office/WPS放映仍OPEN；产品主线继续先做资料备课真实使用。

## 2026-10-22 资料链首次附件写入超时已修

`daily-0AxcRF`的15秒中断现已定位到状态写锁放大效应：同步busy wait与排队事务占用libuv工作线程。状态事务现改为快失败、异步退避、重新获取`BEGIN IMMEDIATE`，总窗口10秒，动作开始后不重放。

最终构建`a665…`/373。真实6秒外部锁下两个生产事务6.156秒恢复并冷读成功；正式Electron+真实DeepSeek事件链12/12；journal、回执、attempt、preflight、读调度、lifecycle全通过。历史失败保留。

主线继续只做辅导教师三结果。下一次真实资料备课应观察首个附件工具和事件回执是否仍卡住；在出现新的真实卡点前，不新增入口、工具或外围页面。

## 2026-10-22 文件栏拖拽不稳已修，主线继续收紧

真实文件工作台暴露了一个高频阅读卡点：1px视觉分隔线看似存在，但8px透明命中区被文件面板覆盖，老师拖动时偶尔没有反应。现只提升当前小智文件工作台的拖拽把手层级，原始HeroUI Pro组件、文件权限、内容与布局持久化不变。

构建`ee263…`/373，`epp8uJ`与`0lU3GY`连续两次32/32；1366/1920浅暗四组均能拖到约360px，文件树隐藏后正文约359px，0错误/远程请求。四个早期失败保留。

任务线继续保持三条：资料到可修改备课稿、错题到教师确认的少量练习、已审内容到已有课件复用。当前唯一下一入口仍是目标教师用真实资料完成读稿、改一处、审批保存和冷启重开；只有真实卡点直接阻塞该路径时才改Harness或界面。不恢复三元题组、学校平台、外围演示或新增AI入口。

## 2026-10-22 课件取消文案与当前合并回归

老师取消已有课件选择时，现明确显示“已取消合并，原课件未修改。”。当前构建再次完成真实PowerPoint合并5/5：6页副本、源HTML/目标课件哈希不变、取消零副本、冷启零重放。

下一步只保留动态放映和投影作为独立环境门禁，不再扩大静态合并代码范围。

## 2026-10-22 教师工作目录术语清理

文件树、上下文和设置页的`workspace`等技术目录名现统一显示“教学工作目录”，老师自己选择的目录名保持原样。当前构建`dde1…`/373，真实Electron check通过；raw DB与界面显示已同时核对。同构建完整文件面板`UbEhQt`32/32，章节目录、自动让宽和权限边界无回归。

这属于三条教师主线共用的低门槛清理，不新增任务类型。下一步仍由真实教师在一份资料、一张错题和一个已有课件中决定要修什么。

## 2026-10-22 错题练习来源提示已收口

已保存练习的来源弹层现在显示总题数和每题位置，滚动核对第二题时标题不再被吸顶提示遮住。当前构建`5dea…`/373；真实Electron用复制DB在1366×768暗色通过，无模型与写入。首次覆盖问题截图保留。

这仍是错题少练的限定软件改进，完整真实DeepSeek重跑和真人布置未做。下一优先继续目标教师真实错题试用，先看题目数量、顺序、难度与观察说明是否可直接使用。

## 2026-10-22 长稿章节目录已上线

资料备课长 Markdown 现在显示可折叠章节目录，点击“学习目标、课堂流程、练习、板书”等标题可直接定位，并有可读状态反馈。当前构建`1d42…`/373，正式Electron`EFfXJN`32/32，浅暗四组重新定位截图均显示真实目标标题。

下一步不再凭猜测增加全文搜索或直接编辑；先让目标教师用真实长稿尝试目录定位和改一处。若目录不够，再只补第一个真实缺口。

## 2026-10-22 长备课稿阅读空间已优化

资料备课的真实冷启截图显示正文被文件树压窄。现同构建打开文件自动把窄右栏让给正文，顶部显示“文件列表”可恢复导航。正式Electron `PGhnt8`32/32，13组布局与39个对比样本通过，0错误/远程请求；这不是真人使用验收。

下一步只由目标教师真实长资料操作决定：先记录是否仍需要查找、跳转或直接改稿；没有反馈不继续加功能。

## 2026-10-22 资料备课成品清理已收口

当前构建`d52d8e47cef236030b87d3e36ed9458f0d5c795a1bde89a159dbe7f00d65f07b`修复备课成品夹带“本次修改预览”问题。基础写入21/21，真实资料备课5/5、10次HTTP200、审阅/保存一致、41分钟与8题保留、冷启零重放；历史问题稿也验证只保留教学正文。该切片仍只属资料备课主线，不新增任务面。

下一优先级不变：真实辅导教师用资料完成一次可修改备课稿；若暂无真人反馈，只处理当前审阅/文件界面中实际出现的长稿定位和失败恢复卡点。错题少练、已有课件复用与放映排在资料链之后。

## 2026-10-22 主线收紧：只打磨辅导教师高频三结果

当前功能面继续冻结，执行队列只保留三条教师可见结果：资料转为可修改、可保存的备课稿/讲义；一张错题经本地识别和教师校正后形成可布置的少量练习；已审教学讲解放进老师自己的课堂课件并能实际放映。一次只推进一条，优先修复老师在真实操作中遇到的卡点；不新增任务类型，不重开外围演示、三元题组或学校平台。

软件验收已齐不等于教师可用。当前最优先是资料备课的完整稿、41分钟结构、8题答案、长稿定位和改稿保存；其后是真实学生错题的识别校正、错因与练习难度；最后是已有课件复用、PowerPoint/WPS放映和投影可读性。真人、课程质量、无VPN、安装包与Office/WPS动态放映分别保留独立门禁。

## 2026-10-22 内置浏览器联网门槛已修复

教师资料查证中的“在内置浏览器打开、读取、截图”此前被H05错误阻断。现同构建真实实例20/20通过，浏览器导航、DOM读取和截图成为当前任务步骤证据；H10四条隔离软件case均通过。主线继续冻结新领域，只保留真实教师、无VPN、安装和Office/WPS放映等未验门槛。

失败`B9EXFP`、`6R2tIb`、`lPw1Iy`及其测试/磁盘问题均保留。下一步仍先请目标教师实际使用三条高频工作；Harness若要继续，只选真实试用暴露的H05/H09卡点。

## 2026-10-22 功能面冻结，转真实教师高频试用

同一构建`236109bdd6617af424ffd04a7c3b04dfd853c8b32723a3a634ab02c4cd3937e6`下，资料备课5/5、错题少练12/12、课堂课件6/6、已有课件复用5/5均通过。当前软件层三条高频结果已齐，停止新增任务类型；后续只允许修复这四条真实路径暴露的阻塞。

下一执行顺序：

1. 找目标辅导教师用一份真实资料完成“读资料→完整备课稿→改一处→确认保存→重启重开”，记录实际补问、等待、定位、误解和求助。
2. 同一教师用一张真实学生错题图完成本地OCR校正、错因讲解、少量练习和难度判断；不把合成图结果当真人验收。
3. 用老师已有课件完成自然语言讲课页、插入已有副本、在教室电脑/WPS或PowerPoint放映，单独记录投影可读性和动态播放。

每次只选一个卡点。模型、数据库、工具和Harness的改动必须直接改善上述某一步，否则不进当前队列。`daily-0AxcRF`的15秒回执超时作为恢复稳定性风险保留；其后`daily-UDFiwU`、`daily-kbYd0q`、`daily-BTY4w7`连续三次5/5，正常路径达到三连稳定，但首次失败所指的硬终止恢复竞争仍未被根因修复。

## 2026-10-22 错题图片到少练软件链完成

同构建`236109bdd6617af424ffd04a7c3b04dfd853c8b32723a3a634ab02c4cd3937e6`下，正式`education-journey-brFkEo` 12/12完成附件优先、本地OCR、教师校正、错因讲解、变式与两题练习、学生来源和冷启。资料与错题两条主线现有软件验收。

下一唯一检查转由目标教师实际使用：先在资料备课看完整稿、41分钟结构和8题答案；再用一张真实学生错题照片完成校正、变式与练习安排。记录补问、等待、修改、误解与求助。两条真人反馈完成前不新增题材；课堂PPT/WPS真实放映仍单独OPEN。

## 2026-10-22 附件先选完成，进入真人内容审阅

最新构建`1b54dc94e1fe3c1d7e333eba27a4b6db89f859603f4103bdff2fbbe950abf76c`下，`Lfs90P` 9/9与`daily-7PzPOc` 5/5证明附件优先、真实读取、完整备课、41分钟、审批保存与冷启。软件路径已收口。

下一唯一检查必须由目标教师或课程审阅者完成：附件先放是否自然、41分钟结构是否可用、8题答案是否需校正、改稿定位是否方便、失败恢复是否清楚。没有这份真人证据前，不把资料主线标为完整验收，也不以更多自动生成替代。

## 2026-10-22 资料备课起步链软件验收

`daily-n0OagA` 5/5完成“根据资料备课”起步卡到附件实读、真实模型完整备课稿、教师修改、全文审阅、保存和冷启重开；构建`6728e1810b05756299c626b69678023235d5bc3d3efe519052795d923a14e344`。它仍不是教师或课程验收。

下一唯一检查是教师真实使用：记录是否需要重复输入年级/学科/课题、长稿是否容易定位修改、41分钟结构是否可接受、8题答案是否需要校正、失败时是否能恢复。完成这一条前不转去更多题材或外围页面；题目少练和课堂PPT的真实反馈排在其后。

## 2026-10-22 高频入口完成，主线转为同链真实打磨

空对话已新增三条主线的教师起步卡，`pi-teacher-quick-starts-DsjdD7` 8/8只证明软件入口、草稿副作用、双尺寸视觉和冷启安全；真实教师与教学效果未验。

当前只保留以下顺序，同一时间推进一个：

1. **资料备课/讲义**：从“根据资料备课”卡进入，核请求是否仍过长、年级/课时缺项是否集中询问、教师改一处后是否采用同一新版本，并完成审批保存与冷启重开。
2. **题目/错题到少练**：在真实教师反馈证明第一链可用后，再核本机识图、校正、错因和练习数量/难度是否适合直接布置。
3. **课堂课件复用**：真实PowerPoint/WPS放映、投影可读性和已有课件副本独立操作继续单独验收；自动化前台受限不阻塞前两条软件路径。

非影响当前教师结果的Harness、外围页面、演示题材和整套组卷不进入当前做队列。完整H01–H10仍保留，Goal ACTIVE。

## 2026-10-21 课堂备课软件链：SOFTWARE_ACCEPTED

第3条已完成正式Electron/Pi/DeepSeek软件链`pi-science-natural-ui-rw1AiM` 6/6，构建`44436c97ecdee0972e35bf1264f1b65dfbf427d736b3b8be1410e955553803fd`：教师不选技能，用日常语言请求三分钟课堂演示；Pi直接生成41实体教学HTML，教师预览确认后导出6页PPTX，冷启零重放。技术HTML源代码默认折叠。证据`teacher-classroom-20261021/progress.json`。

### 已审内容直接合并到已有课件副本：LIMITED_ACCEPTED

`pi-science-merge-ui-cCbzpV` 5/5把已审HTML生成页追加到老师在当前工作目录选择的PPTX副本：1页原有+5页生成，PowerPoint重开6页，备注/GIF保留，原件不变；取消、双尺寸、定位和冷启通过。证据`teacher-classroom-20261021/merge-progress.json`，边界13/13。

三条主线的软件路径均已具备。WPS12.1已实际打开合并副本并渲染6页，但WPS放映`Run`失败；PowerPoint放映也在`SetForegroundWindow`失败。下一步冻结新功能，只处理两种动态放映、投影可读性、离线与教师独立使用。

## 2026-10-21 当前执行：题目图片 OCR 与少练

资料备课主链已软件接受。第2条随后已按`docs/goal/OCR_PRACTICE_CONTRACT_20261021.md`完成联合软件验收；此段保留执行阶段历史，当前继续第3条。

## 2026-10-21 资料备课主链软件接受

第1条资料备课已完成不中断软件验收`daily-KNUJxO`5/5：同一日常合成会话读取原附件、生成五年级37分钟备课稿、改为41分钟全文审阅、教师批准保存、SQLite/native/hash核验和冷启文件面板重开。12次DeepSeek均为HTTP200、renderer错误0、冷启0模型重放；权威记录见`apps/desktop/test-results/goal/teacher-materials-20261021/progress.json`。

该结果不替代真实教师独立操作。下一主线进入第2条“OCR原图→教师校正→讲题→少练”，第3条PPT复用保持后续，不恢复已暂停三元题组。

## 2026-10-21 用户收紧主线：当前修复收尾后按教师日常任务推进

当前教师输入误停修复完成并验收后，执行重心回归辅导老师的常用任务。该排序约束后续任务选择，不删减已批准H01–H10、原失败和完整完成定义；Harness改动应能说明它解决下列哪条用户路径的实际问题。先复用已有入口，不继续增加演示题材或外围平台功能。

|顺序|教师实际需求|一次完整验收|支撑能力|
|---|---|---|---|
|1|用已有资料备课，整理通俗讲解/讲义|给真实授权资料→实际读取→按年级/知识点形成稿→老师改一处→预览确认→保存/重开；失败可说明并重试|FILE原样例、解析与来源、必要时NET引用、任务续办/确认|
|2|看懂一道题，给学生讲清并安排针对性练习|原题/错题图→本地OCR→老师校正→解析→基于明确错因的少量练习→审阅保存；来源与生成题区分|IMG原样例/OCR、题目工具、教师校正；不扩大为自动整套组卷/三元题组项目|
|3|把已审讲解变成能上课的课件，复用已有PPT|相同审阅版本→PPT/动图→实际PowerPoint/WPS分别放映→插入已有课件副本→移动重开；记录老师独立完成卡点|M09导出、科普现有能力、Office/WPS与离线验收|

下一主线从第1条现状复测开始：用本项目原FILE素材与当前保存配置/旧会话核实际读资料和改稿保存，记录首次失败；资料需联网时连同原NET用例验引用正文。缺真实provider额度时准确记录既有HTTP402与当前预检边界，继续做同一路径的本地部分，不再用受控模型绿测代替日常验证。第2/3条分别保留IMG与PPT实际放映未验，不自动宣称全部通过。

每轮只选一个明确教师结果，冻结目标/入口/实际缺口/完成定义；先修可见卡点，再评估需要的底层支持。衡量完成依据是老师从入口做完、结果正确且可修改、失败能恢复和保存可再用，不是新增工具/文档/测试数量。原H05未完项（排队补充交接、旧task歧义迁移等）保留，只有影响当前主线时作为支撑切片推进。

<!-- handoff-current-20261016 -->
## 最新状态（2026-10-16 上下文保存）

唯一继续入口：[Goal 当前状态](CURRENT_STATE.md)。Master ACTIVE，Phase 4/5/6 DOING；智能组卷移出当前队列。

已撤回回显型提示/视觉工具注册及伪设置重置/历史入口，保留真实 OCR/教师校正和聊天撤销。确认/致谢误判已修；EV-MAIN-02 正式 n1lZ85 仍失败（表格计算未被步骤计数识别），不能升级为验收完成。领域15/15、组件217/217及通用smoke通过有各自范围，不替代专项。

下一步：EV评价表达覆盖/真实教育工具组装→留出/采用/冷恢复/视觉→DT真实协助/独立/视觉证据→MA逐字讲稿/导入。既有DT/MA/EV均为限定接受；原历史按其当时范围解释，详细SHA、失败报告、命令与边界集中在Goal状态和验收记录。本轮仅保存文档，无生产修改或新模型调用。


<!-- context-reconcile-20261016:start -->
## 2026-10-16 上下文恢复与状态纠偏

当前阶段与唯一继续队列见 docs/goal/CURRENT_STATE.md（从本文件按仓库根解析）；智能组卷移出当前队列，三主线继续。EV-MAIN-01 是明确偏好子片限定接受；EV-MAIN-02 隐式反馈仅有领域例 13/13，缺正式留出实例。DT 新 hint/visual 工具与偏好设置 IPC/UI 标 NEEDS_FIX：回显模型 OCR/置信度不是验证，清 React 状态不是持久化重置，重复读 head 不是真实历史。MA 讲义/备课稿四导出限定接受，逐字讲稿/导入仍 OPEN。

本轮只审查和整理文档，未修这些生产代码、未重跑业务验收。先冻结修复合同解决上述缺口，再 EV 正式 --implicit→DT 协助/独立/视觉闭环→MA 讲稿/导入→联合与 Master 其余门禁。未宣称完整 DeepTutor/OpenMAIC/Hermes 或 Phase 0–3 全部完成；历史记录按其当时范围保留。

已脱敏现场与校验：apps/desktop/test-results/goal/context-save-20261016/。可恢复的已提交历史归档 docs/archive/context-20261016/，不是覆盖前未提交长文的完整恢复。已有详细验收/决策正文保留，本节不改上游/权限/事实真源/安全边界。HEAD/远端读回 d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，master dirty，未提交。
<!-- context-reconcile-20261016:end -->


<!-- ma-documents-status-20261015:start -->
## 2026-10-15 MA-MAIN-02-B2：讲义/备课稿 Word/PDF 限定接受，下一 Hermes 隐式反馈

Current Phase：4/5/6 DOING；Master ACTIVE。上轮 DT-FOLLOWUP-01 为 progress；本轮 MA 文档交付为 progress。智能组卷仍移出当前队列。Current Task/Next：EV-MAIN-02 隐式修订反馈→候选偏好→留出评价→版本化采用/回滚；其后 DT 独立作答/提示协助/视觉证据与其他模式，MA 逐字讲稿/导入继续 OPEN。

Done：教学内容→互动课堂新增 Word/PDF 学生讲义与教师备课稿入口，沿唯一 Pi 的 education_read_classroom/export_classroom、同一 Office 预览/明确审批/版本化保存。新增 classroom-document-office.v1，旧课堂PPTX v1不变；main确定性读取完整已确认版本/context，原生成/保存CAS保留，拒绝把课堂导出稿降级为无来源普通文档。学生讲义不附随堂题参考答案/解析；教师备课稿复用已有解析。完整课页由同一固定 OpenMAIC SlideCanvas 离线渲染为不可编辑图片，文字题目可编辑，不伪造教学讲述。无新 Agent/DDL/IPC/依赖/事实真源。

Evidence：apps/desktop/test-results/goal/ma-documents-20261015/{contract.md,before,research,domain-final.log,build-release.log,components.log,first-visual-failure.md,artifact-check.json,wps-handout,wps-teacher,progress.json,commands.ps1}；正式 Electron education-journey-9MIe8g 5/5、2次启动、4次真实Pi/DeepSeek导出请求、0renderer错误；四份真实文件及账本hash/源课堂/学习记录/冷回读核对。冻结build-release SHA c95a175107f78669b0a0f08d8c1288df58ea917c61d8135c19dec403e9ec86d5 /368，运行前后相同。build/type exit0，组件217/217、领域4/4。产品PDF教师3页/学生2页，各2张完整课页；两份Word在独立受控WPS12打开各2页，原文件hash不变。9页实际文件渲染及浅1366/暗1920 UI已查看，公式/完整长题/答案隔离可见。

Failed/Recovery：首次 ebHq89 操作成功但第一课页公式缺失，视觉拒收；显式加载本地KaTeX FontFace、等待fonts.ready及两帧后 NT8bBk 和最终实例恢复公式。首次脚本相对路径cwd错误未改源码，后续使用绝对根修正；保留初次日志，不以初次build作为最终证据。graph查询300秒超时；转定向已知源码。官方网页429，git ls-remote核HEAD ecb940c；官方raw讲稿导出与固定636fab0内容一致，MIT原文已读，无上游新代码复制或安装。

Boundary：教师备课稿不是逐字讲稿（现课堂没有speech actions），学生讲义只隔离quiz答案，课页原有文字完整保留，教师须检查是否适合发学生。图义/答案仍answerVerified=false；第二课页原有英文公式措辞和版面不因导出自动修改。PDF跨页题目会续页，不承诺像素一致或可编辑图形；教学文件列表同名文档需打开预览区分受众，后续可优化。未扩全量回归/容量/组卷；完整Golden E/全科复杂图/导入/逐字讲稿/无VPN/安装/全部DeepTutor/EV留出仍OPEN。

Last verified commit：d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty；未commit/push。回滚before及本片新增classroom-document-pages.ts；保留独立Harness脏改、原资料/配置/凭据/课堂/正式产物。后续按唯一队列推进，不重回组卷。
<!-- ma-documents-status-20261015:end -->


<!-- dt-followup-status-20261015:start -->
## 2026-10-15 DT-FOLLOWUP-01：单次作答续接限定接受，下一 MA 教学文档交付

Current Phase：4/5/6 DOING；Master ACTIVE。智能组卷已按用户要求退出当前队列。DT-FOLLOWUP-01 仅“选中实际作答→同学生Pi复盘/讲解→冷恢复”LIMITED_ACCEPTED，不称DeepTutor整体/教育正确性完成。Current Task/Next：MA-MAIN-02-B2 已确认互动课堂→讲义/讲稿 Word/PDF；随后 EV 隐式改稿反馈/留出评价，再回 DT 独立作答/提示协助/视觉证据与剩余模式。保留JOIN-01已验接缝，不重跑组卷。

Done：StudentTrainingView.results增加由原source version派生的16hex作答引用，现typed IPC/preload自然承载；每条结果旁新增HeroUI“复盘这次作答 / 继续讲解”，复核当前列表后准备可编辑草稿，沿用该学生已有会话，不自动发送。现education_analyse_learning可按trainingResultReference唯一解析本学生已确认计划中的真实记录，指定记录优先占用原20条来源槽位，即使不在知识点最近3条也返回；观察脱敏上限为原2000、逐题作答沿现practice格式、原来源版本/链接保留。未知/碰撞/编辑/删除/换学生拒绝，读后原fingerprint/策略/授权CAS仍有效。历史计划按确认版本区分；sourceCurrent=false仅证据基线改变，teacherAssessmentVerified仅独立掌握门禁，不否定已保存观察。无新Agent/DDL/依赖/事实真源/IPC。

Evidence：apps/desktop/test-results/goal/dt-followup-20261015/{contract.md,before,slice.patch,research,domain-current.log,build-current.log,components.log,progress.json,commands.ps1}。正式 Electron H7RATs：3/3操作检查、2次启动、2轮实际Pi/DeepSeek、0renderer错误；原IaAkgM已保存概念学习结果克隆至隔离profile，实际工具逐轮返回选中来源与完整观察，学习事实/确认计划未改。冻结build-final SHA dd2a8a8412948bb93601b35f2d25718700ee6168ff78dfe236ed8a593ea1bfc5 /366，运行前后相同；build/type exit0，领域13/13，组件217/217，diff exit0；浅1366/暗1920截图实际查看，两按钮可达，长计划需滚动。

Boundary：本例缺少完整题面/逐字作答/图形，不作为数学正确性验收。最终解释仍出现“同乘可能丢失解”等不严谨泛化，答案/讲解未经确定性或教师验证，不得标已验证、不得写学习事实；后续DT教育质量门禁需结合真实原题/答案与协助证据解决。本片只接受证据续接、事实语义及操作功能。全部DeepTutor模式、transfer真实调用、全科/复杂图、MA Word/PDF/导入、EV隐式优化/留出、安装/容量/无VPN仍OPEN。

<!-- dt-followup-status-20261015:end -->

<!-- join-status-20261015:start -->
## 2026-10-15 JOIN-01：三主线接缝限定接受，继续 DeepTutor 长期辅导

Current Phase：4/5/6 DOING；Master ACTIVE。智能组卷已按用户要求移出本轮队列。JOIN-01 的“同一学生/资料/偏好→辅导→互动课堂→教师修订→PPTX→冷恢复”接缝 LIMITED_ACCEPTED；不称三个上游完整融合或 Master DONE。Current Task/Next：DT 长期辅导续接，随后 MA 讲义/讲稿与导入、EV 隐式反馈评价，按下方唯一队列执行。

Done：阅读页新增“用这一段制作互动课堂”，复用唯一 Pi、原 DeepTutor 引文核验、固定 OpenMAIC 生成/归一/沙盒/编辑器/PPTX及既有 Office 审批。main 只收集本轮真正送达模型的段落，classroom-context.v1 保存原 MaterialSource/正文版本、脱敏标题、送达字数/截断、OCR未校对标记和冻结偏好 revision；不保存私有笔记/原件路径/学生事实。课堂 stage、教师确认、Office最终提交在原事务内复核资料账本hash/正文/隐私；教师改内容不替换来源，Office精确快照保留相同context，旧无context课堂兼容。无新增 AgentLoop/DDL/IPC/依赖或事实真源。

Evidence：apps/desktop/test-results/goal/join-20261015/{contract.md,progress.json,commands.ps1,before,domain.log,build-current.log,components.log}。实际物理扫描卷沿已接受 nYQae6→fkMAqF 的真实本地OCR记录复用到隔离副本；正式2OltyJ完成5个实际操作检查、4轮真实Pi/DeepSeek、1次启动、0renderer错误；Vst2vG冷恢复3/3、2次启动、0模型重跑、0renderer错误。冻结build SHA 9e0ea7864648523eaa821dc84bb66c43b97f611f86e55efa9ba67906f5b22b62 /366，冷验前后相同；build/type exit0，领域11/11，组件217/217。PPTX 103568字节、5页，经现WPS12独立受控COM打开、转PDF且原件hash未变，5页PNG与浅1366/暗1920 UI已逐页实际查看。资料段落、6条既有阅读记录及学生学习事实不改，偏好head/revision始终1。

Failed/Recovery：h6bocz在学生会话切换未完成时取旧snapshot，已改等待真实student绑定；2OltyJ所有5个业务步骤成功，但收尾错误断言将每轮应追加的偏好应用event与初始反馈数组全等，故其report.success=false（保留原报告）。修为head/version不变、4个run应用证据合法，再原位冷读Vst2vG通过，不重生成四轮。一次并行prepare被原宿主resource_busy拒绝，模型实际按工具错误重新准备后成功；未放宽并发/授权。首次部分源码写入时build TS失败保留build-first.log，完整修复后当前build成功。

Boundary：原图1没有上传/读取，生成图明确“教学示意（非原图1）”；两题经本轮物理条件复核为向上3.3N向下、教学变式下落2.3N向下，仍answerVerified=false，无独立标准答案gold。视觉检查发现生成页标题“三步”对应4个提示、图底来源说明与箭头轻微交叠；来源按钮/确认/导出可达，JOIN只接受接缝，不称内容排版或教育正确性全量通过。PDF为WPS验收转换，不是已实现产品PDF导出。全部DeepTutor模式、复杂图/全科正确性、OpenMAIC全部DSL/Word/PDF/导入、隐式优化与留出评价、安装/容量/无VPN仍OPEN。

Blocked：无。Last verified commit：d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty；本轮远端未重新核验）。无commit/push；用户资料、配置、凭据及独立Harness修改保留。回滚仅按before撤本片接缝delta和新增classroom-context/ClassroomSources，不回滚其他未提交变更，不删除已确认课堂/偏好/正式产物。
<!-- join-status-20261015:end -->

### 当前唯一推进队列（历史条目不覆盖本节）

|顺序|主线与教师可见结果|当前状态 / 下一步|
|---|---|---|
|1|JOIN-01 同资料/学生/偏好→辅导→互动课堂→教师改稿→PPTX|本片接缝 LIMITED_ACCEPTED；不重复模型链。生成版式瑕疵作为MA内容质量修复项保留|
|2|DeepTutor 长期辅导：最近错题/真实练习结果→下一任务→提示/详细讲解/错因复盘/相似训练→教师记录→继续|DOING：已有计划、结果、hint实例；先核最新上游纯领域与现工具，补其余模式/结果续接的实际用户缺口，保持同一student/session，不把自动推断写事实|
|3|OpenMAIC 课堂教学交付：图示修订、讲稿/讲义Word/PDF、导入|OPEN：复用现原生编辑器/Office文档宿主；先修生成页提示数量/图文占位，再实现确定性导出与真实预览，不整搬上游服务|
|4|Hermes 式后台学习：教师实际改稿→候选偏好→留出评价→版本推广/撤销|OPEN：已实现明确偏好保存与应用；下一扩真实修订信号和效果门禁。许可未核齐不得复制Hermes代码；不自动改事实/代码/权限|
|5|三主线自然日常使用与Master剩余门禁|OPEN：功能补齐后做有界联合恢复/隐私/安装/无VPN；不以本片替代完整Golden E/F/G|

每一片先Reuse/Compare/合同，再实施并做必要实例，更新Goal4/稳定CURRENT/根4。当前首要是第2项；不回退知识库/组卷测试长队列，不为了通过实例再建runtime或真源。

<!-- join-contract-20261015:start -->
## JOIN-01 交付合同（实施前冻结）

目标M02/M08/M09/M10：教师从资料阅读一键请求互动课堂，同一Pi会话沿用学生与已保存教学偏好，真正实读指定段落后生成课堂；教师修订确认→Office预览/审批→PPTX→重启回读。资料正文、学生事实与笔记不自动修改，未核对OCR不称教材正确答案。

现状：MaterialRepository/MaterialSource已有正文hash、隐私及源变化检查；office_read_material已实读但只向本轮observedMaterials记文件hash；课堂账本保存会话/学生，没有段落来源及采用偏好版本，导出也无此链。阅读只问答，无课堂入口。优先扩这些接缝，复用Pi、固定OpenMAIC生成/编辑/渲染/PPTX和现HeroUI Button/MaterialSourceNavigation，不新建Agent、数据库或来源真源。

Compare：A导入完整DeepTutor/OpenMAIC工作区会增加runtime/服务且复制资料；B另建上下文数据库重复事实；C现有MaterialSource+课堂payload可选context引用+已有Office源快照，选C。现参考目录为D:/WorkProject/小智智能体借鉴项目，OpenMAIC636fab0、DeepTutor be170110本地已核；DeepTutor有用户脏改不改动；最新官方仓库页面已读，本片不升级/复制新上游源码，保留已审计固定依赖与许可证。HeroUI官方Button文档已核、复用当前组件。graph查询300秒超时，使用定向源读取。

合同：新增classroom-context.v1，只存本轮实际送达段落的MaterialSource、脱敏标题、送达字数/截断标记和本轮冻结偏好revision；不存私有笔记/学生事实/路径。来源只能main实读回调收集，不接受模型/renderer传入；课堂stage事务重验正文/隐私/文件hash，教师确认与导出最终CAS再查，变化失败，不偷补。既有无context课堂保持兼容；教师修订保留原来源，不得注入或替换。Office快照携带同context，旧稿合同兼容，无DDL/新增IPC/依赖。

改动：shared可选context及验证、main实读证据/事务校验、课堂工具/账本/Office编译；阅读页增加同款按钮、课堂及Office来源展示复用原来源跳转。失败显示来源已变化/拒绝，不静默移除来源；取消/幂等沿现宿主。回滚before加本片新增文件，保留原资料/课堂/偏好/正式产物和独立Harness改动。

验收：有界来源/隐私/幂等/教师修订/旧课堂兼容/源变更CAS例；build/type、相关组件；一组正式Electron/真实DeepSeek资料→阅读辅导→实际课堂→教师修订→真实PPTX→冷恢复，核SQLite/native/实际图公式及浅1366暗1920。只相关实例，不重跑组卷或容量。未通过不标完成；全科正确性/完整三项目/安装/容量/无VPN仍独立OPEN。
<!-- join-contract-20261015:end -->

<!-- ev-feedback-status-20261015:start -->
## 2026-10-15 当前：三主线已交付首批功能，下一 JOIN-01

Master ACTIVE；Phase4/5/6 DOING。智能组卷已移出当前队列。DeepTutor 阅读/笔记续接与学习计划辅导、OpenMAIC 课堂生成/直接编辑/教师确认/PPTX交付已分别限定接受；本轮 EV-MAIN-01 普通反馈偏好子片 LIMITED_ACCEPTED，不称三项目或自进化全部完成。当前任务转 JOIN-01 三主线共同使用。

教师现在可直接说“以后讲解详细些，分步骤，先给提示再给答案”，后台生成固定枚举偏好，经本地合同评价/版本/CAS保存；新会话自动采用，重启保持，普通聊天“撤销上次记住的教学偏好”追加回滚版本。只复用同一Pi的protectedContext、原app_settings/私有事务与普通聊天；无新Agent、DDL、IPC、模型调用或依赖。当前请求优先，不把学生事实/答案/授权当偏好，原始反馈不复制到模型动态上下文。

Evidence：apps/desktop/test-results/goal/hermes-20261015/{progress.json,commands.ps1,before,research}。最终正式Electron hbi02B：4/4、2次启动、4次真实Pi/DeepSeek回合、0renderer错误；普通反馈→新聊天顺逆流多步讲解→冷恢复→撤销→新聊天已撤销上下文，SQLite/native记录均核对。build cd493923b0ba0ea4a4f4e7157671aeedee4acd6f323d9912bfc627b4bf3175bc /366，前后相同。build/type exit0、组件217/217、领域contract-h9aufY 8/8、diff exit0。浅1366/暗1920截图已实际查看，消息区可滚动。

首次h15FB0实际已保存偏好，但模型又询问详细档位形成waiting_input；已修动态上下文明确保存成功、不重复问档位/技术配置，最终实例通过。否定表达反向匹配、旧TS库Object.hasOwn及生产SQL私有接口差异已处理，失败现场保留。Hermes HEAD0a929e3aa20e15cf04dc7c28492a7d41a5139125源码已读；README/pyproject声称MIT，许可原文仍未取到，因此仅参考候选/评价/版本/回退思想，未复制其代码或安装GEPA/DSPy。

边界：本片只验明确中文表达偏好；评价是枚举合同一致性，不是教育正确率。隐式修订信号、留出效果评价、routing/retrieval优化、效果下降自动回退仍OPEN；表格/导出偏好未逐项真实交付验收。完整DeepTutor各模式、OpenMAIC PDF/DOCX/导入、全科图义正确性、安装/容量/无VPN仍OPEN。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty；远端TLS失败未核，无commit/push，独立Harness及真实数据/配置/凭据保留。

Next：JOIN-01先复用资料阅读/学习计划的上下文、现课堂工具与Office宿主，补“同一资料/学生→辅导→互动课→教师修订→教学文件”缺口；保存当前偏好版本与真实来源，不追加第二运行时或自动学习事实。完成接缝实现后仅一组联合实例；随后DT剩余模式→MA交付/导入→EV隐式反馈与留出评价。回滚仅撤本片观察/注入与新增领域文件，保留偏好历史与原教育事实。
<!-- ev-feedback-status-20261015:end -->

<!-- ev-feedback-contract-20261015:start -->
## EV-MAIN-01 实施合同：普通反馈到下次采用

M10，教师可见：正常说“以后讲解详细些，分步骤，先提示再给答案”等表达习惯，小智后台记住；新会话自动采用，重启仍在；“撤销上次记住的教学偏好”可恢复旧版，无技术配置/每次授权弹窗。第一片涵盖讲解长度、讲解顺序、段落/表格、交付格式；不把此片称整个Phase6完成。

现状审查：现L2/L3教育记忆由教师选择及授权读取，含事实，不能挪作自动全局偏好；managed-skills已有Pi parser/包验证/版本与epoch，不能自动改SKILL.md。现app_settings可存独立主进程键，session-state Sql已有事务和CAS，Pi protectedContext已在每次实际prompt前注入当前本地安全上下文且位于稳定prefix之后；因此复用这些接缝，无新增Agent、DDL、IPC或UI库。

Recherche/Compare：2026-10-15实读Hermes README、evolution/skills/evolve_skill.py、skill_module.py、core/constraints.py；HEAD0a929e3aa20e15cf04dc7c28492a7d41a5139125与此前一致。README/pyproject声明MIT，但LICENSE/同名md/txt均404，API树403，尚无完整许可原文，生产不复制其代码/安装DSPy/GEPA。真实constraints只含大小、增长、非空、frontmatter检查，不能等同语义/教育正确性。A复用L2/L3全局化会破授权，不选；B完整GEPA额外模型/依赖及许可未齐，不选；C复用Pi稳定上下文与现本地Sql，将Hermes trace→candidate→eval→version→rollback思想适配为有界偏好策略，选C。后续许可齐全且有真实留出反馈时再接纯候选优化；不以“来自Hermes”虚称源码迁入。

合同：teacher-preference.v1；仅固定enum，无任意prompt/代码/学生信息。主进程读取已持久化且与当前run/session绑定的真实user消息；只接明确面向将来的一般表达要求，拒绝引用、假设、否定歧义及敏感/权限要求。生成候选→schema/敏感/互斥/本次明确要求回放/未改变字段门禁→app_settings独立namespace追加不可变版本与本地证据（message/run引用及hash，不复制正文），head事务CAS；幂等以run为键。撤销也追加版本、不覆盖历史。当前请求优先；每轮开始冻结所用版本，正文不含原始消息、学生事实和本地路径，中途不改系统prefix/工具。

改动：shared教师偏好合同；education领域偏好候选/评价、私有SQLite状态；session-state组合；production-host在已持久化用户消息后观察、向原protectedContext追加本轮固定偏好、保留应用证据。已有普通聊天承担操作和反馈，无单独技术设置。失败明确不能声称已记住；未知schema拒绝，不忽略损坏并恢复旧偏好。

验收：先边界/旧库无迁移/重复run/并发CAS/撤销/重启/引用及敏感拒绝实例，再正式Electron两次普通会话与真实DeepSeek，新请求不含偏好词但实际回复采用，撤销后下轮不再注入；检查数据库版本和native上下文，不用测试脚本伪造学习。build/type、相关组件及diff。只相关实例，不重跑组卷；截图验证普通教师路径，未验证语义质量不称提高教学准确性。回滚撤该slice注入/观察，保留app_settings历史以便恢复，原教育记忆/学生/课堂/凭据不改。完整自适应routing/retrieval/隐式修订信号/自动效果下降回退留后续EV任务。
<!-- ev-feedback-contract-20261015:end -->

<!-- ma-delivery-status-20261015:start -->
## 2026-10-15 MA-MAIN-02-B1：课堂 PPTX 教学交付限定接受，转 Hermes

Current Phase：4/5 DOING，6 开始实施；Master ACTIVE。Current Task：EV-MAIN-01 教师偏好闭环。智能组卷不在当前队列。

Done：已确认课堂→选择教学文件目录→自然语言导出→同 Pi 读取当前课堂标题/版本→确定性 Office 草稿→原 HeroUI 审批预览/教师核对→真实 PPTX→教学文件目录→冷启动回读。复制固定 OpenMAIC636fab0 的 HTML/颜色/图形路径格式函数，MIT 与 Himalaya ISC 原文、9文件来源hash/依赖锁记录齐全；既有 PptxGenJS4.0.1/Office 宿主复用。文字/线条/图形保留可编辑对象，2个公式用现本地排版图片且明确不可编辑；2题完整题面/答案/长解析自动分页为6页。原课堂/学习事实不改，源版本CAS和写文件审批保留，无新增Agent、DDL、IPC或原图上云。

Evidence：apps/desktop/test-results/goal/ma-delivery-20261014/progress.json、commands.ps1、before。正式 Electron q6wisy，3/3、2启动、0 renderer errors；真实 Pi/DeepSeek 使用9U0u4m已修订课堂，不重新生成课。build SHA 4e95128abeca9cecc5afcad78303a9a21105cc755d189a7190c77d766b9d74e9 /366，运行前后相同。build/type exit0；组件217/217；合同3组覆盖标题/会话/版本、精确快照、最终源CAS；diff --check exit0。WPS12实际打开最终PPTX6页并导出PDF；6页PNG与已逐页查看的首份WPS渲染字节相同。浅1366与暗1920实际查看，内容区需滚动；1366首屏不能看到完整课页，未称全部同屏。

Failed/Recovery：先后修复输出目录与冻结工作区冲突、草稿注入竞态、课堂工具名遗漏、旧文件dispatcher重复注册web、模型引用历史候选而非当前确认、屏幕外iframe rAF使核对选项锁住。最后改React提交后当前frame/token/scene回执，保留不可信沙盒。第一次ZIP测试把自动分页6误当4，修正断言并保留失败r0pnmH；脚本sourceFile重复刷新问题修为幂等，重新成功。完整失败日志见evidence，不抹除。

Boundary：LIMITED_ACCEPTED仅B1有界课堂PPTX。PDF/DOCX/讲稿/导入、全部DSL/复杂媒体、全科图义与答案正确性、完整OpenMAIC/三主线/安装/无VPN仍OPEN。answerVerified=false。新增3个纯JS锁版直接依赖共999608字节（非安装包增量），无服务/模型；npm已有漏洞不宣称清零。Blocked无。Last verified commit d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty），本轮远端TLS读取失败未核；无commit/push，独立Harness/正式数据/凭据保留。

Next：EV-MAIN-01 按下方合同实现普通教师反馈→本地证据→评价→版本化偏好→下一任务应用/撤销。随后三主线JOIN与各模式剩余能力；不回退组卷全集。回滚仅撤本片入口/adapter/依赖delta，历史课堂和正式产物保留。
<!-- ma-delivery-status-20261015:end -->

<!-- ma-editor-status-20261014:start -->
## 2026-10-14 当前 MA-MAIN-02-A：课页直接编辑限定接受

Master ACTIVE；Phase4/5 DOING。用户指定三主线 DeepTutor → OpenMAIC → Hermes，智能组卷已移出当前队列。Done：复用固定 OpenMAIC editor0.0.9 MIT 的 controlled UI/ProseMirror/core transaction-history，教师可直接改课页文字、撤销重做、选中被遮挡线条并拖动端点修正、取消不保存、追加确认版本并冷恢复。沿用原 opaque sandbox/主进程课堂CAS/SQLite确认账本，无第二Agent、DDL、事实真源或新增IPC。公式/图形编辑入口可用，但未逐项实例验收，不能标为完整编辑器或完整OpenMAIC完成。

Evidence：apps/desktop/test-results/goal/ma-editor-20261014/progress.json、commands.ps1、before/。最终正式Electron 9U0u4m，5/5、2次启动、0renderer错误；沿先前真实Pi/DeepSeek课堂a72a37的隔离SQLite/文件副本，本轮0模型调用。冻结build 37ee9cbeb1e9e356e889cd48a57b2118993624ee396ff6986ff8cb8a5af7e9bd /351前后相同。build含typecheck exit0、组件217/217、真实editor core例3/3；仓库diff --check exit0。浅1366×768编辑和暗1920×1080冷读截图实际查看；控件可滚动到达，不称1366全部同屏。最后图中橙色斜边已由教师实际编辑对齐填充三角形。

Failed/Recovery：types子路径由局部声明桥接；首次iframe自动点击不命中改为真实窗口/DOM坐标；独立Harness nativeRoot启动问题由其任务修复，保留其改动。包审计输出误命名package.json导致冻结build启动失败，现改npm-pack.json并留现场。实际遮挡线条难选，补教师“选择元素”并复用上游端点工具，未开放same-origin/Node/网络。最初模型图中斜边方向错误，teacher修订例不等于自动数学验证，answerVerified=false。

Boundary：LIMITED_ACCEPTED仅本片文字/history/取消/线条修正/版本CAS/冷恢复；课堂导入/PPTX-PDF-讲稿交付、自动图义/全科可靠性、完整三主线/安装/无VPN仍OPEN。19新增包锁版、实际树约77.6MB，包许可证notice已保存；不冒称安装包增量体积。before支持撤本片delta，保留原版本及独立Harness/正式数据配置凭据。HEAD/remote已核同d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，dirty，无commit/push。Blocked无。

Next：MA-MAIN-02-B先复用上游纯导出函数和现Office文件宿主贯通教师教学交付；完成该片再EV-MAIN-01 Hermes普通反馈→可评估偏好→版本化应用与回滚，最后JOIN三主线联动。DeepTutor阅读续接/学习计划子片已接受，不等于所有DeepTutor模式完成；不再重跑组卷或无关测试。
<!-- ma-editor-status-20261014:end -->

<!-- ma-classroom-status-20261014:start -->
## 2026-10-14 MA-MAIN-01：互动课堂子片限定接受，下一课堂编辑与交付

Master ACTIVE，Phase4/5 DOING。固定 OpenMAIC DSL0.11.2/generation0.3.15/renderer0.1.11 已实际接 Pi：上游原生提示→同一 Pi 生成回调→结构归一化→现 ai_confirmation_items 待核对/教师确认/追加修订→教学内容互动课堂→离线隔离 SlideCanvas 与随堂题。无第二 Agent、新事实表或自动成绩。3个 typed IPC；main 执行会话/学生隔离、取消、幂等、版本CAS与内容边界。教师可修改课堂名称、题干、答案和解析；完整图形/文字编辑与教学导出仍属于 MA-MAIN-02。

Evidence：apps/desktop/test-results/goal/ma-classroom-20261014/progress.json 与 commands.ps1。最终正式 Electron/真实 DeepSeek a72a37：6项/2启动/0renderer错误，生成三页/图形/公式/两题→实际答题和解析→教师修订确认→旧版本/不安全内容拒绝→冷恢复，同版 build SHA d592531c4fb33bfdbab1c5d2c344cd858edd86c950c294c6c70013a0449b5b01 /351文件运行前后相同。build/type exit0；组件217/217；领域7项含三个并行真实适配器准备/提交。最终浅1366×768与暗1920×1080截图实际查看，课页/控件可滚动到达，不称1366全部同屏。只做本片实例和必要门禁，未重跑组卷或容量专项。

Failed/Recovery：安装 ECONNRESET/缓存缺项，固定 audited html2canvas-pro2.5.1 后恢复；初始导航和草稿会话绑定已修；opaque origin 本地module iframe加载失败，改可信IIFE+本地字体+nonce srcdoc，未开放same-origin/preload/Node/网络。aJXBsK标题误作引用、O3a1n6并行编号覆盖/超时现场保留；页号现在在第一个await前分配，错误返回可用课页引用。空继承字体误拒、全局选项样式放大与初始发送竞态已修。ZAou4Z旧生成、qdu4pB仅克隆UI证据仍保留，最终接受基于a72a37完整新链路。before目录可撤回本片；原事实/正式库/配置/凭据未改。

Boundary：LIMITED_ACCEPTED仅AI生成的有界slide/quiz课堂、交互/教师确认/版本化保存/冷恢复；answerVerified=false，不称教学或答案独立正确、完整OpenMAIC/GoldenE、全学科、导出、安装或无VPN接受。源/依赖/license manifest与notices在vendor/openmaic；实际新增14包均保存license，未称全上游可复现。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty，未核远端，无提交/push，独立Harness改动保留。scoped diff --check通过；仓库级只报独立docs/goal/HARNESS_EXECUTION.md末尾空行，未替他修改。Blocked无。

Next：MA-MAIN-02复用上游editor/import/export补课页修订与教学交付→EV-MAIN-01 Hermes无感教师偏好反馈/证据/版本/回滚→三主线联动。智能组卷已移出当前队列。
<!-- ma-classroom-status-20261014:end -->


<!-- dt-path-status-20261014:start -->
## 2026-10-14 当前：计划续接限定接受，下一 MA-MAIN-01

DT-MAIN-02已确认计划续接子片 LIMITED_ACCEPTED；Master ACTIVE/Phase4/5 DOING。全历史当前计划进度、四模式草稿、当天结果、同学生Pi上下文和冷恢复已接原主进程/typed IPC；不将已记录判为掌握。最终build/type0、组件217/217、定向8项、正式Pi/DeepSeek4项/2启动/0renderer错误；最终只读浅1366/暗1920图已查看（原缩放残影图不接受）。完整边界、首次现场、SHA与命令见 CURRENT_STATE 及 apps/desktop/test-results/goal/dt-path-20261014/progress.json。下一直接OpenMAIC互动课，再Hermes；组卷移出当前队列。

当前队列：DT-MAIN-01/02子片已限定接受→MA-MAIN-01/02→EV-MAIN-01→JOIN。只以对应真实功能例关闭切片；组卷专项和容量专项不再作当前前置。
<!-- dt-path-status-20261014:end -->


<!-- dt-reading-20261014:start -->
## 2026-10-14 阅读续接交付，下一 DT-MAIN-02

DT-MAIN-01 版本化逐段阅读/笔记/重启恢复/当前段落辅导入口 LIMITED_ACCEPTED。Master ACTIVE，Phase4/5 DOING；智能组卷已移出队列。下一 DT-MAIN-02 个性化辅导与学习路径→OpenMAIC 互动课→Hermes 无感反馈。

Evidence：apps/desktop/test-results/goal/dt-reading-20261014/progress.json（最终同build正式4项/2启动/0 renderer错误；组件217/217、6项定向实例；实际浅1366/暗1920图审）。复用此前通过实际UI导入/OCR的真实物理扫描事实；本次不重复OCR。原图/笔记不上云、旧版本/笔记不覆盖；LLM讲解未独立判正确，完整沉浸阅读/全DeepTutor仍未完成。详细结果与首次失败见 CURRENT_STATE 和上述 progress.json；无提交/push、正式数据或凭证修改。

当前唯一继续点 DT-MAIN-02；本轮阅读子片已收口，不追加更大阅读样本、组卷验证或容量测试阻挡下一个功能。
<!-- dt-reading-20261014:end -->

<!-- mainlines-20261014:start -->
## 2026-10-14 主线纠偏（当前有效，覆盖历史 Next）

用户明确：智能组卷已完成，回归 DeepTutor 教育能力、OpenMAIC 互动课堂、Hermes 无感数据飞轮三条主线。组卷从当前执行队列移出；此前 F3/F4 及组卷扩展清单转为后续专项，不再作为三主线的前置门禁。原有实现与验收边界保留，不据此宣称全科自动正确或 40GB/安装已验。

当前 Phase 4/5 DOING，Phase 6 待实施；Master Goal ACTIVE。唯一执行清单：docs/goal/EDUCATION_BRANCH_TODOLIST.md 顶部“三主线”。当前任务 DT-MAIN-01：复用已有资料读取/DeepTutor reading、学习证据与训练计划，补阅读学习入口、可继续进度及同 Pi 辅导；随后 MA-MAIN-01 真实互动课，再 EV-MAIN-01 教师反馈版本化应用与回滚。只做相关实例与必要构建检查，不重跑组卷或无关回归。

本轮完成的是执行方向/合同对齐和当前源码接缝核查，尚未新增三主线生产功能、运行实例或视觉验收。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，既有 dirty 修改保留；本轮没有验证远端 HEAD。详见上述执行清单。
<!-- mainlines-20261014:end -->

日期：2026-10-12。补充Master，不替代Master。以当前代码与实例为准，历史文档不作为完成证明。

## 执行规则

### 历史继续点（2026-10-13，已由顶部三主线队列替代）

**下一F3复杂自然错题→本地同类/不足时五变式→教师练习。** F2形式线性条件适配已限定接受：实际Pi缺电压失败→同run修复→教师确认→冷读msPBaf3项/2启动，6组复杂条件例、build/组件门禁通过；不重复100分导出。证据kb-condition-check-20261013/progress.json。conditionsVerified=false；教师提供形式化计划的案例不证明模型自主抽取条件/图义/单位或全科正确，自动题意可靠性仍DOING。

前片普通教师混合100分/四文件继续有效，详见kb-natural-language-paper-20261013/progress.json。按功能优先，仅解决本片实际失败，不扩无关测试。F3后F4长教材→F5 OpenMAIC互动课堂→F6 Hermes反馈；沿同Pi/SQLite事实/原审批。DeepTutor部分成熟helper已复用，后两项目按独立模块实际复用而非新AgentLoop。

### 按功能交付的工作包

| 顺序 | 必须实现的教师结果 | 直接复用与薄适配位置 | 本片实例/停止扩展条件 |
| --- | --- | --- | --- |
| F1 限定接受 | 选一份已导入扫描资料→一句话整理→内部逐页读取/提出候选→同一集中核对卡。未知图义/公式/缺页明确提示，教师只校正不重新录整题 | 原MaterialRepository/OCR正文及源页；original-question-coordinator.ts、original-question-batch-tool.ts、PiOriginalQuestionBatchReview.tsx；原Pi工具注册 | 使用test目录真实复杂扫描，不预填参考转写；跨页/图表多问至少各覆盖一个，保留全部条件与原图；教师修正→保存→冷读。缺口直接修所在产品层，不先扩测试框架 |
| F2 线性条件限定接受 | 已确认题库优先完成组卷；无可信答案时内部生成讲解、可验证计算及失败修复；教师一次集中核对 | 原question-retrieval、question-context、question-review/quality/math、question-collection、paper-coordinator、paper-rich-export；DeepTutor固定格式校验 | 接F1同一批事实做100分卷与学生/教师四文件，失败题隔离、缺额提示。复用现三模式，不再写三模式实现；原创/教师补充/原件答案分别标记 |
| F3 后续专项（移出当前队列） | 错题一键得到本地同类题，不足时提出五变式并安排练习 | 原mistake-similar、MistakeFacts、QuestionReview、PracticeReview与DeepTutor学习helper | 接真实复杂错题走当前入口；仅修暴露缺口，不重做已验14项五变式流程，不自动推断成绩或改学生事实 |
| F4 | 长教材及大目录内部接续，教师不用手动拆50页/反复选文件 | 当前确定性队列/页缓存/优先级/内容hash/MaterialRepository | 先扩有界分页合同和正文分段读取，再测实际容量与安装；不能只调大数字上限、不要求先做40GB压力测试再开发分页 |
| F5 | 已有教学材料一键变成可保存、可重新打开的互动课堂 | OpenMAIC generation的AICallFn、课堂DSL/schema、内容renderer与互动组件→现Pi/Office宿主 | 一个真实课程：生成→实际互动→保存→重开；固定模块源码/许可证/依赖闭包后直接复用，包探测不算课堂完成 |
| F6 | 教师纠正后，小智下一次采用已批准偏好，能够撤销 | Hermes技能候选/反馈约束思路与可独立源码→现Pi技能版本/审批；本地反馈数据 | 一次修改→候选差异→批准→下次使用→回滚；不可复制独立AgentLoop，不可自动改核心代码、权限和事实 |

### 三项目实际复用清单与迁移纪律

1. **DeepTutor先用现成代码。** 当前`apps/desktop/src/main/education/vendor/deeptutor-question/source-manifest.json`固定f07029cfcf2c8dfccdb671cdfc343db8334f5741、1.6.13、Apache-2.0，已有`_parse_quiz_payload`、`_normalize_quiz_payload`、`_collect_quiz_issues`纯方法投影；reading/learning同目录独立manifest。`python/vendor/DEEPTUTOR_UPSTREAM.md`的1.5.11属于另一已有副本，不能把两个版本混称最新版。F1/F2先沿现Worker和宿主接缝；追加上游纯函数须逐文件固定来源、许可和依赖，不搬pipeline的运行循环及新数据库。
2. **OpenMAIC按课堂模块复用。** 现集成文档记录候选636fab0…/1.2.0-rc.1及隔离包审计，属于历史证据，本轮没有联网更新或安装。到F5先核固定源码与实际可独立包，复用schema/生成回调/renderer；不要自行重新写课堂引擎，也不把上游服务、PG/S3带进单机产品。
3. **Hermes按教师反馈闭环复用。** 尚无本轮确认的完整可迁移生产模块；到F6核具体函数/许可证及版本晋升回滚接缝。允许直接复用合规独立代码，不能以README的规划当已实现、不能把“参考思想”说成源码已集成。

任何源码迁入记录：上游路径+固定SHA+LICENSE/NOTICE+依赖/Windows影响+宿主适配点。已迁入成熟模块不反复调研；不以下载整个仓库数量计进度。

### 当前事实与防重复入口

历史实例：`kb-natural-three-mode-20261012/progress.json`、`kb-multistep-20261012/progress.json`、`kb-part-coverage-20261012/progress.json`、`kb-variant-five-20261012/progress.json`、`kb-table-office-20261012/progress.json`、`kb-original-staging-20261012/progress.json`（均在apps/desktop/test-results/goal）。这些是历史构建的限定证据，非当前dirty构建全量重验。

下一实施合同写F2缺口：现原题确认后missing答案阻止标准答案组卷，原MultiDraft不支持AI解析来源，但QuestionDocument已有ai_generated来源；复用现质量审核、数学计划、修复/隔离及源版本CAS，补同原题解析候选和集中确认入口，不另建generated重复题。保持教材原题来源与AI补充答案分别标记；不能把AI答案伪装为教师或原件答案。F1局部实例不证明自动整卷提取完成。

每片先确认可直接复用的源文件，再写薄适配，完成教师可见流程后用一个覆盖本片关键成功/失败/恢复的实例验收。已通过的无关全套不重复运行；不把24题质量集当成所有独立功能开发的前置。发现具体风险才追加定向检查。每轮记录真实结果与下一项。

## 三个项目的复用边界

| 项目 | 当前用途/直接复用位置 | 下一步取用 | 约束 |
| --- | --- | --- | --- |
| DeepTutor | 现python/vendor及omni_edu_deeptutor_bridge；当前题库/组卷/引用能力通过既有adapter使用 | 对照固定来源的question生成/格式化/检索helper，只取纯能力函数；补整卷候选与解析修复 | 不移入上游AgentLoop、不另建题库；固定源/许可证需逐模块核对，旧DEEPTUTOR_UPSTREAM.md记载版本不能冒充最新helper版本 |
| OpenMAIC | Master Phase5已确定，完整生产互动课堂仍未验 | 待主线收口，复用课堂DSL/schema、内容renderer、互动组件，接现Pi生成及Office/文件宿主 | 不能用既有包探测成功标课堂完成；本轮未复核其上游HEAD，不提前承诺直接可运行 |
| Hermes | Master Phase6已确定，完整反馈闭环仍未完成 | 教师修改/拒绝→反馈信号→技能候选→版本晋升/回滚，优先复用可独立的成熟实现 | 不自动改学生事实，不另起运行时；实际源码与许可核查在实施该片前完成 |

不是三个项目同时全面迁移。先把当前题库主线做通，后两个模块依次落地；全部挂同一Pi。

## 按教师结果交付

| 顺序 | 功能结果 | 已有可复用底座 | 收口实例 |
| --- | --- | --- | --- |
| 已限定接受 | 扫描资料停止/退出后按已完成页接续 | 本地PDFium/RapidOCR、确定性队列、MaterialRepository | 六页实际扫描：停止→重启→从下一页→完整正文冷读；缓存损坏重建 |
| 1（单批/跨批限定接受） | 整卷候选自动整理、集中审核，减少逐题重复录入 | 当前原题工具、六字段候选、可视框选、QuestionDocument/ledger | 多问/跨页/图表公式题；候选缺项明确提示，教师集中修正后入同题库，不把缺失内容自动判无 |
| 2 | 题库优先100分卷、缺题时可切混合/原创，答案解析自动修复并隔离失败题 | 已通三模式、去重/配额、question-quality/repair、同Pi原生工具 | 一份复杂整卷教师预览→确认→学生/教师WordPDF→冷读，核对答案/图义与原创标签 |
| 3 | 错题照片→相似题→五变式→可用练习 | 现OCR/facts、similar、practice review和质量检查 | 一道复杂错题含负例/缺图对照；相似题不足诚实返回，生成失败题不混入正式练习 |
| 4 | 长教材分页、30–40GB增量目录整理、任务优先与安装 | 现文件夹流式导入/内容复用、任务优先、跨批恢复、新页缓存 | 有界长文档与实际资料规模测量、退出恢复及安装实例；不能只提高数字上限 |
| 5 | OpenMAIC真实互动课 | Pi、当前产品空间及artifact宿主 | 老师一次输入→课程→互动→保存重开 |
| 6 | Hermes教师反馈技能改进 | 同Pi轨迹/教师审批/本地版本数据 | 修改反馈→技能候选→比较→批准晋升→可回滚 |

## 当前尚不能宣称完成

跨学科复杂图文的自动识别/可靠答案、24题分层质量、长教材/30–40GB与安装、完整OpenMAIC课堂和Hermes反馈仍在待办。样例中的参考转写不等于模型自主看图。现OCR页缓存仍沿50页/50MiB/1MiB正文边界，长文档要做分页合同再扩展。

## 最新功能进展

2026-10-12：批量候选集中核对已进当前调试构建；1–12题先整理后等待，可切换编辑、分别确认/拒绝，范围未保存时防丢锁切换。真实扫描两题实例与冷读通过，参考文字由用户明确提供，尚非自主全卷识别。下一项先让超过一批的整卷持续整理，再落实复杂100分卷/答案修复隔离与错题五变式；不重复已通过的无关旧全套。证据：apps/desktop/test-results/goal/kb-original-batch-20261012/progress.json。

2026-10-12续：跨批stage→review及同资料集中卡已进当前调试构建；实际两批复杂扫描题、切题编辑、一拒一确认/冷读通过；12+1边界通过。已修复状态事件导致题号漂移。下一片直接推进复杂100分卷/多步骤解析核对与失败隔离，再接错题五变式；自主整卷识别与跨科质量不标完成。证据：apps/desktop/test-results/goal/kb-original-staging-20261012/progress.json。

## 2026-10-12 F1实际功能结果（覆盖历史Next）

本地页文字/位置已接入唯一Pi。真实扫描第5/6页、不预填题干→两道644/561字候选→原集中核对→教师校正/一保存一拒绝→冷读，通过一个正式实例3项/2启动，另3项定向边界及build/type通过。证据kb-page-text-20261012/progress.json。原图未由新工具送模型、无新依赖/运行时/DDL/IPC。

下一实际缺口：可见选项/全部小问正确归类，图读数保持待核对；不重复测试已接受的页工具链路，不把教师补充后通过当自动完整识题。沿同工具/同集中审核与现复杂卷流推进，完成后立即下一片。

## 2026-10-12 F1局部补读结果（最新继续点）

真实扫描遗漏选项已由同Pi局部OCR找回并进入结构化候选，教师审核/冷读通过；证据kb-region-text-20261012/progress.json。下一直接F2：确认题库接现100分组卷/讲解，补真实答案缺口；不继续围绕同一选项扩大测试。跨科质量/长教材/安装及OpenMAIC/Hermes仍依序推进。

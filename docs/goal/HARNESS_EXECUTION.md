# Harness方案B实施合同与进度

## 2026-10-24 H09 动态状态焦点补测 I/P/R/V：ACCEPTED

同一隔离构建`0b5280201b22b5082e8e28b684752fa0031de67f14cbccc0086662b16a2d4e5b`/373（`harness-h09-dynamic-a11y-20261023c`；152列明源码hash逐项核对未变，构建复用）。脚本`apps/desktop/scripts/xiaozhi-agent/pi-dynamic-state-accessibility.mjs`新增`H09_ONLY=I|P|R|V`聚焦模式，证据目录`apps/desktop/test-results/goal/h09-dynamic-a11y-focus-20261024/`，与20261023目录并存。

- **I queued instruction卡（run-E0EN2l）**：owned SSE fixture先产出`ask_teacher`待答问题，再通过可见原生队列（`pi-queue-submit`+`pi-queue-mode-*`）排队steer/followUp两条指令，0模型阶段。`i-queued`四配置、`i-withdrawn`两配置全过；键盘编辑revision 0→1仍queued；键盘撤回→withdrawn；撤回卡展开后正文对比度实测通过。2组走查85个停靠0缺失，1组AX 0未命名，30条对比度0失败，1次fixture请求、0文件效果、0 renderer错误。
- **P practice/learning review卡（run-TsjOJw）**：owned学生上下文fixture`education-journey-vv5feo`（DT-05 journey合成数据）复制进owned profile，0模型调用、0网络：pending learning review（strategy·两周训练计划，含批处理选择态，走查122停靠）四配置、practice confirmed/rejected卡四配置、confirmed learning review卡两配置；3组走查231停靠0缺失，3组AX 0未命名，64条对比度0失败。
- **R interrupted-run recovery（run-F13qxf）**：owned最小中断=真实进程`taskkill`强杀（审批pending时）→冷启0模型重放；启动恢复把journal receipts（2项）对账成恢复提示`office-recovery`，审批卡state interrupted；四配置+键盘details/披露切换通过；走查39停靠0缺失，20条对比度0失败，0文件效果。注：干净关窗路径会先落终态run（publisher seal不补recovery事件），这是产品事件序行为，本片未改业务逻辑，改用崩溃恢复路径产出真实恢复提示。
- **V verified状态（run-NfV7j2）**：源码不变式检查`run-observer.ts`/`result-readback.ts`/`verifier.ts`：run-end恒追加`answer:human`标准（恒needs_human）或强制blocked/partial/needs_human/unknown，`verifyCriteria`仅在全部check passed且无human标准时返回verified——run-end路径永不产出。保持UNVERIFIED并附经验理由；前扫实证b1=unknown、b2=[unknown,needs_human]、restored=[unknown,needs_human]。

探针修复三处：对比度测量跳过折叠/隐藏内容（HeroUI折叠披露内容opacity:0且带`hidden`，无可见性则无对比度要求）；焦点指示器严格判定`:focus-visible`/样式差/wrapper标记，Chromium日期输入内部段重复停靠按已覆盖key放行；走查步数上限按状态可调（pending learning含14天训练计划122停靠）。首失败`run-TmSiUR`（把折叠正文当可见内容测出ratio 1）与中间迭代保留。无产品源码改动；真人读屏仍OPEN。未commit/push，`out`未替换。

## 2026-10-24 H09 动态状态可访问性：LIMITED_ACCEPTED

真实Electron + owned profile/DB + in-memory SSE fixture，隔离构建`0b5280201b22b5082e8e28b684752fa0031de67f14cbccc0086662b16a2d4e5b`/373（`harness-h09-dynamic-a11y-20261023c`）。脚本`apps/desktop/scripts/xiaozhi-agent/pi-dynamic-state-accessibility.mjs`覆盖a-restored、b0-empty、b2-taskplan、b3-blocked、b4-needs-human、b5-accepted/rejected、c-approval、d-question；最终`run-u6tJg6`为33状态视图+10次Tab走查，1366×768/1920×1080浅暗。

结果：124条对比度0失败；10组焦点走查共457个停靠0缺失；5组AX审计0未命名；0横向溢出；0 renderer错误；16次模型请求全部由owned fixture响应（0真实provider）；0文件效果；构建指纹稳定。聚焦C`run-jkHMN0`与独立复跑`run-jKtNKd`均产出`pi-copy-approval[data-state=pending]`，四配置通过且copy admission持久化（`stepId:copy`,`callId:call_copy`,`tool:office_copy_file`）。

修复仅`pi-workspace-glass.css`两处：`:focus-visible`覆盖`select`/`[tabindex]`；输入框shell背景绑定`--pi-paper`修复深色对比度。首失败`run-XAuQvw`/`run-PGX0nP`保留。仍OPEN：真人读屏、run-end derivation未产出`verified`、queued instruction卡、practice/learning review卡、interrupted-run recovery（上节I/P/R/V补测已覆盖后三项并实证verified不可达）；H09整体仍IMPLEMENTING，H10仍NOT_ACCEPTED。未commit/push，`apps/desktop/out`未替换。

## 2026-10-23 Windows安装包：SOFTWARE_ACCEPTED_WITH_LIMITS

合同`docs/goal/WINDOWS_INSTALLER_CONTRACT_20261023.md`。构建`4885c66d...`/373上新增`electron-builder.yml`、自包含Python、现有OCR runtime和Worker `.asar.unpacked`。NSIS x64产物323,870,934 bytes/SHA-256`69A74334...`，关键asar文件与`out`hash一致。

真实安装exit0；安装版启动断言`app.isPackaged=true`、安装exe路径、owned profile/data和0 demo students；bundled reading/math/OCR均在安装目录返回有效结果。三条教师快捷入口仅填草稿，0消息；1366/1920浅暗截图已看、0溢出/0 renderer error。卸载移除程序、保留安装目录外owned profile/data。

保留首次packaging等待与NSIS下载中止；正式recovery复用已完成`win-unpacked`，不是双层源码重建。该片只关闭Windows安装小项；未签名、VPN-off、日常保存配置、真人、真实学生图、课程质量、WPS和投影继续OPEN。H09/H10与Goal不整体关闭。

证据`apps/desktop/test-results/goal/windows-installer-20261023/progress.json`和`apps/desktop/test-results/xiaozhi-agent/pi-windows-installer-ui-ahxYVO/report.json`。主线回到资料备课、错题少练、已有课件复用，下一片只复看资料备课真实教师路径。

## 2026-10-23 WPS动态放映探测：IMPLEMENTED_UNVERIFIED

合同`docs/goal/TEACHER_WPS_PLAYBACK_CAPTURE_CONTRACT_20261023.md`。WPS`12.1.0.29161`独立COM实例可打开实际6页PPTX并验证原生文字/备注3项。依据WPS官方对象模型使用speaker类型和`Application.SlideShowWindows.Item(1)`后，`playback4`创建真实`Qt5QWindowIcon`放映窗；但桌面被其他WPS窗口遮挡，window capture/PrintWindow/BitBlt均空白，动画仍未证明。`wpp.exe /s`两种参数顺序仅进入后台prometheus进程。

`playback`至`playback7`失败保留，owned后台进程按精确PID清理，用户原WPS进程未动。WPS动态放映/投影/真人继续OPEN；PowerPoint16.0.20430的8/8独立通过不能替代。进度`apps/desktop/test-results/goal/teacher-mainline-wps-playback-probe-20261023/progress.json`。

## 2026-10-23 Microsoft PowerPoint动态放映：SOFTWARE_ACCEPTED

合同`docs/goal/TEACHER_POWERPOINT_PLAYBACK_CAPTURE_CONTRACT_20261023.md`。修复只针对owned放映窗截图生命周期：每次真实桌面抓帧前临时置顶，每个窗口退出前恢复；不改系统前台策略、不激活无关窗口，也不使用静态导出冒充播放。

PowerPoint`16.0.20430`、产品构建`ec43f1a7...`上`topmost4-20261023`8/8：动画区域变化2.469、合并课件2.295、静态讲解页、原字节与InsertFromFile副本播放通过；临时置顶与恢复均为true，0相关进程。旧`LXxDhC`、`topmost-20261023`、`topmost3-20261023`保留。

该片仍只关闭Microsoft PowerPoint软件单屏播放。WPS、真实投影/扩展屏、真人课堂、VPN-off、安装和真人读屏继续OPEN；H10整体仍NOT_ACCEPTED。进度`apps/desktop/test-results/goal/teacher-mainline-powerpoint-playback-20261023/progress.json`。

## 2026-10-23 教师练习观察字段去重：SOFTWARE_ACCEPTED

合同`docs/goal/TEACHER_PRACTICE_OBSERVATION_DEDUP_CONTRACT_20261023.md`。最终练习中原有`教师观察：教师观察：...`及正文句首`教师观察到的...`会与外层字段标签重复。现共享规范化在显示与确认保存前去掉显式标签及单句起点冗余词，保留引述中的自然短语；旧SQLite行只做读取兼容。

最终构建`ec43f1a7...`/373。聚焦边界`pi-practice-observation-boundaries-wCIKbD`19/19；真实Electron/DeepSeek `education-journey-kL9aYy`12/12，2题恰好2标签、8视图、0错误、3启动并完成双冷启；renderer240/240、build/diff通过。同构建资料备课`25qvTy`5/5（7次HTTP200、源DB不变、审阅保存与冷启通过）、已有课件合并`Yzcar3`5/5（6页副本与源/目标hash保护通过）。

失败`HTSEAv`、`TB90ak`、`nrLUpN`、`IilJql`、`R9eoPk`和`PUX7Al`保留。该改动只解释错题少练的教师可读性问题，不扩展任务面；H05/H09、H10及真人/安装/VPN-off/Office放映门禁不变。进度`apps/desktop/test-results/goal/teacher-mainline-practice-observation-20261023/progress.json`。

## 2026-10-22 H09 125%/150% DPI：LIMITED_ACCEPTED

合同`docs/goal/H09_DPI_INTERFACE_CONTRACT_20261022.md`。新增`pi-dpi-interface-ui.mjs`，真实Electron启动DPR1.25/1.5，在1366×768/1920×1080和浅暗下测量CSS viewport、物理截图与主要控件。构建`c7e088ca...`/373上OACw5j/HEqdwU连续各8视图通过，0溢出/0消息/0请求/0错误。

DIP真实，浅暗为实际build媒体仿真；系统主题菜单和真人读屏仍OPEN。探针错误与nativeTheme环境失败保留。证据`apps/desktop/test-results/goal/h09-dpi-interface-20261022/progress.json`。

## 2026-10-22 H09 Journal缺口、重连与冷恢复：LIMITED_ACCEPTED

合同`docs/goal/H09_JOURNAL_GAP_RECOVERY_CONTRACT_20261022.md`。构建`c7e088ca...`/373上，journal边界19/19、真实同步UI10/10、真实journal UI12/12。事件/outbox原子提交、gap/重复/乱序、跨session/generation、失败补拉、通知丢失、旧revision、Stop、writer失败、warm retry拒绝、reload和冷启均通过；同步UI 210行hash一致。

本片只关闭软件可靠性。H09真人读屏、全部动态状态点击/焦点/对比度、DPI和长任务性能继续OPEN；H10外部/human门禁不变。证据`apps/desktop/test-results/goal/h09-journal-gap-recovery-20261022/progress.json`。

## 2026-10-22 H10当前构建软件链：LIMITED_ACCEPTED

构建`c7e088ca...`/373。任务步骤确定性绑定修复后，网络daily配置副本两轮5/5，真实搜索、两个正文、内置浏览器和截图都通过；此前`kLjoTg`的browser admission失败保留。公开图片13/13、自然文件14/14。

同构建资料5/5、错题两轮12/12、自然课件6/6、已有课件合并5/5、长历史7/7、快捷9/9、任务边界17/17、renderer240/240。H10仍然NOT_ACCEPTED：PowerPoint/WPS动态放映、投影、VPN-off、安装包、真人教师和真实学生图片未验。现有项目无electron-builder/forge，本片不引入新打包链。证据`apps/desktop/test-results/goal/h10-current-build-software-20261022/progress.json`。

## 2026-10-22 H05任务步骤确定性绑定：LIMITED_ACCEPTED

合同`docs/goal/H05_TASK_ENVELOPE_DETERMINISTIC_BINDING_CONTRACT_20261022.md`。真实错题链`R5JJQX`显示模型漏填`taskStepId`时，已采用且唯一的saved_questions执行步骤仍被`task_plan_required`拒绝。`plan-runtime.ts`现在对effectful工具先刷新当前证明，再按最新计划唯一executing或唯一ready步骤绑定；无计划、多匹配、依赖未验、resource/tool不符和重放保持失败关闭。

构建`c7e088ca...`/373。边界17/17；错题`N9nyqY/VcojgR`连续12/12，覆盖本地OCR、教师校正、真实错因、变式、两题练习、审批、学生隔离、拒绝/停止和两次冷启。资料备课5/5、自然课堂6/6、已有课件合并5/5、长历史7/7、快捷入口9/9、renderer240/240均当前构建。

PowerPoint播放`LXxDhC`实际打开/渲染/教学文字备注3项通过，动态放映因前台拒绝而OPEN。H05、H09、H10和Goal整体未完成；证据`apps/desktop/test-results/goal/h05-task-envelope-deterministic-binding-20261022/progress.json`。

## 2026-10-22 教师资料备课当前构建回归

长历史切片收口后回到教师主线第一条。`pi-teacher-materials-current-OTCw4d`在当前`03e62d96...`/373上5/5通过，覆盖快捷入口+附件、真实附件正文、完整五年级稿、41分钟、8题、全文审阅、审批前零文件、确认保存与冷启。7次DeepSeek HTTP200、0 renderer错误、冷启0请求，保存SHA`35039ade...`和native`67b7c1c7...`一致回读，源DB不变。

这是`SOFTWARE_ACCEPTED`，真人教师/课程审阅仍未执行。owned profile递归清理被命令策略拒绝，321文件/47,090,422字节保留并在进度记录；不得报告为已清理。证据`apps/desktop/test-results/goal/teacher-mainline-current-build-20261022/progress.json`。

## 2026-10-22 H09长历史与增量加载：LIMITED_ACCEPTED

合同`docs/goal/H09_LONG_HISTORY_CONTRACT_20261022.md`。生产首快照改为最近40轮，新增`OmniEduStore.getAiConversationHistoryPage()`，按当前session真实user message/agentRunId游标读取完整页；Pi run状态和`xiaozhi_event_runs` journal只查本页run。新增`xiaozhi:history-page` typed IPC与`getXiaozhiHistoryPage()`；`PiEducationWorkspace`向头部合并去重，`OfficeConversation`在React layout提交后用pending anchor恢复`scrollTop`。

构建`03e62d96...`/373。`pi-long-history-ui-so3ADg`、`fDnlQX`同构建连续两次7/7：首屏40、25页到1000、锚点0.25px、切换/二次冷启40、2000消息/1000 run、伪造游标拒绝、三尺寸入口和0工具重放。首失败`gf8seZ`与源码缺口保留。renderer240/240、快捷入口9/9、窄屏、自然文件+Word14/14回归通过。

daily网络副本`kLjoTg`真实搜索与两个正文通过，但`office_browser`在同一任务计划下因verified task-step准入失败，未产生browserCapture；这是独立H10 OPEN，不归因长历史。H09本片接受，整体仍IMPLEMENTING；下一步按教师主线“资料备课→错题少练→已有课件”推进，journal压力、真人读屏和全部动态状态保留。

## 2026-10-22 H09窄屏与键盘可达：LIMITED_ACCEPTED

新增`pi-narrow-interface-ui-smoke.mjs`。主窗口最小宽度由1100改为390；`PiWorkspaceShell`保留桌面侧栏，`≤768px`通过HeroUI `Sidebar.Mobile`在Portal Sheet显示同一`AiConversationSidebar`。`pi-education-workspace.css`只在`pi-sidebar-mobile-sheet`作用域恢复offcanvas wrapper、全高和主题token。

构建`8375c55c1fb3f66a36c2b8c550fb226e85bae8e0fe80c9b0a7ca8e24d6e8dda9`/373。`pi-narrow-interface-ui-MhwwDT/bmoNMB`连续两次成功：1366×768、768×1024、390×844、390 forced-colors及390冷启，无横向溢出；主要Composer控件/Tab/快捷卡Enter/移动侧栏命名Dialog、焦点与Escape返回均通过；0消息、0 renderer错误。此构建上网络5/5、图片13/13、文件15/15、快捷入口9/9、renderer240/240。

失败保留：`qV9eeq`首窗口尚未就绪；`Ycq0Jf/N7OZZq`错误要求全新profile中不可用的模型选项进入键盘序列；`n36ODA/NbUQge`只有移动open状态但没有`Sidebar.Mobile`内容；`3toTED/YFxG8D/TtiGEe/gOGFbB`Portal仍被全局wrapper/祖先选择器隐藏。最终五张截图已查看，含完整暗色侧栏。

本片只关闭窄屏/键盘、自动化读屏语义和forced-colors布局。H09真人读屏软件操作、所有动态状态点击区/对比度、长历史性能、journal gap/reorder/reconnect及H10整体仍OPEN。进度`apps/desktop/test-results/goal/h09-narrow-interface-20261022/progress.json`；下一步优先动态状态读屏语义，再做长历史与journal压力。

## 2026-10-22 H10同链路收口（前一构建）：LIMITED_ACCEPTED

当前最终构建`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373，与owned副本逐文件一致。同一构建连续通过：

- `pi-daily-network-copy-D4UQf0`、`fG3tZB`：各5/5。
- `pi-public-image-ui-z19EBM`、`DnmrJ6`：各13/13。
- `pi-natural-file-6rw96n`：14/14。
- 任务状态28/28、浏览器准入4/4、任务计划17/17、renderer240/240；Electron/PowerPoint进程0。

文件首次`9tdx5O`是测试语义缺口：合法周章节键值表被误判缺目标。`weekly-plan-readback`现同时接受宽表与键值表，但仍要求4周、目标/任务非空、负责人为空。人工无意义`kind=human.target`只做规范化移除，其他计划和准入校验不放松。`wGFxRF`、`C0qnOS`、`R1PbZP`、`oprbps`、`9tdx5O`全部保留。

H10仅软件小项限定接受，整体仍`NOT_ACCEPTED`。VPN-off、安装包、真人教师、真实学生图片、课程质量、PowerPoint/WPS动态放映与投影继续OPEN。Harness不再因技术兴趣新增切片；后续只响应教师三主线真实试用暴露的阻塞。汇总`apps/desktop/test-results/goal/h10-current-build-closeout-20261022/progress.json`。

收口后已在同一最终构建跑教师资料主线`pi-teacher-materials-current-czmU6b`5/5：owned日常配置副本、附件实读、41分钟完整稿、8题与来源、审批保存和冷启重开；8次HTTP200、0 renderer错误、源DB不变。状态为`SOFTWARE_ACCEPTED`，真人教师/课程审阅仍是下一门禁。入口`apps/desktop/scripts/xiaozhi-agent/pi-teacher-materials-ui-smoke.mjs`，进度`apps/desktop/test-results/goal/teacher-mainline-current-build-20261022/progress.json`。

## 2026-10-22 H10日常配置副本联网：LIMITED_ACCEPTED

新增`pi-daily-profile-network-ui.mjs`，使用真实日常配置最小只读副本验证搜索、两正文、内置浏览器和截图。`taskToolKinds.web`原有浏览器映射之外，修复verified web step后的同资源只读动作：`office_browser`的snapshot/screenshot/show/tabs/wait/scroll与普通safe_read/local_cache可在`task-state`显式safeAfterVerified下追加；navigate、click/type/select/key/close、换URL和写工具仍拒绝。提示明确web步骤必须非human并带实际URL，不能由human-only计划替代。

构建`d8ec197c3952b4707519863996ed996cd6b6e2cf41e0a7699165f88a136952e8`/373。`pi-daily-network-copy-RxMvJv`与`Qdx3qZ`连续两次5/5：真实保存配置、搜索、两正文、浏览器PNG、reload零重放、源DB不变均通过；官方正文SHA`8434b645...`，浏览器截图SHA`78424813...`。任务状态28/28、浏览器准入4/4、任务计划17/17、renderer240/240。

`R1PbZP`（verified步骤阻断screenshot）和`oprbps`（human-only计划）保留。H10整体仍NOT_ACCEPTED；VPN-off、安装、真人及Office/WPS OPEN。

## 2026-10-22 H10日常配置与旧会话只读副本：LIMITED_ACCEPTED

新增`pi-daily-profile-copy-ui.mjs`，从真实日常profile复制最小`Local State/Preferences/app.db/WAL/SHM/xiaozhi-pi`到owned目录，再用正式`out/main/index.js --user-data-dir=<copy>`启动。源profile不启动/不写；教师原件和学生图片不复制。环境DeepSeek key/model、`OMNI_EDU_DATA_ROOT`和测试Pi开关全部清除。

构建`a66595d2c3a7cbaeda35333cc3ebfed10f02e5a5764a4167c14b1007ea3db46c`/373。`pi-daily-profile-copy-43LyZQ`与`iO1eVO`连续两次4/4：保存配置DeepSeek/deepseek-flash/auto DNS恢复；旧备课会话4消息/2turn可读且native/SQLite不变；副本新会话两次真实完成随机核码回复；源DB SHA不变、0 renderer错误、0进程。报告仅保留旧会话标题哈希，owned profile在写入报告前删除，截图前收起会话侧栏。

H10仅此小项LIMITED_ACCEPTED，整体仍NOT_ACCEPTED。VPN-off、Windows安装包、真人教师和Office/WPS放映仍OPEN。合同`docs/goal/H10_DAILY_PROFILE_COPY_CONTRACT_20261022.md`。

## 2026-10-22 小智状态写锁恢复：LIMITED_ACCEPTED

历史`daily-0AxcRF`在HTTP200后的首个`office_list_attachments`回执等待15秒并触发`event_persistence`。根因是状态事务创建独立连接后使用5秒同步`busy_timeout`；其他短写锁与多个排队事务可占满libuv，放大成生命周期超时。

现`OmniEduStore.xiaozhiState.sql.transaction`在获取`BEGIN IMMEDIATE`前设置`busy_timeout=0`。遇`SQLITE_BUSY/LOCKED`关闭连接并以25–250ms异步退避重开，总锁获取窗口10秒；`BEGIN`成功后动作不重放。无Schema/IPC/依赖/provider/Loop/权限变更。

构建`a66595d2c3a7cbaeda35333cc3ebfed10f02e5a5764a4167c14b1007ea3db46c`/373。状态专项`pi-state-write-concurrency-eyGTdd`5/5：真实6秒外部锁下两个事务6.156秒恢复、冷读两行存在。正式Electron+真实DeepSeek `pi-event-journal-ui-V6br5b`12/12。journal19、回执15、attempt9、preflight9、读调度10、lifecycle5、renderer240、build/diff通过、进程0。

`daily-0AxcRF/bkWE1w/KnPcZ6/JA52Nb`保留。完整H01–H10仍未关闭；真人、VPN-off、安装及Office/WPS放映保持OPEN。

## 2026-10-22 教师文件栏拖拽命中区：SOFTWARE_ACCEPTED

高频文件阅读路径暴露Resizable命中区被相邻面板覆盖：视觉分隔线为1px，原始组件已有8px伪元素命中区，但当前文件树面板在指针层截获鼠标。现只在`pi-workspace-files.css`给当前工作台把手设置`z-index:12`，不改HeroUI Pro源码、面板尺寸、持久化、权限、文件事实或Pi唯一Loop。

构建`ee2639938681efc3fd5b1abe31b6749d9905ad92652cfcb8709238690b402c55`/373。`pi-files-ui-epp8uJ`和`pi-files-ui-0lU3GY`连续两次32/32：真实hover/drag、四组尺寸主题最终面板约360px、正文359.33px以上、所有控件可达，0 renderer错误、0远程请求。renderer240/240、build/diff通过、相关进程0。`TTu3HI`与`Dq65HM`测试早取样、`RqLsSX`命中区拦截、`xeghZa`等待后仍失败均保留。

该改动直接改善资料备课之后的长稿阅读空间，不扩展任务面。完整H09/H10及真人、VPN-off、安装、PowerPoint/WPS动态放映仍OPEN。

## 2026-10-22 课件合并取消文案：LIMITED_ACCEPTED

当前构建真实PowerPoint合并5/5；取消已有课件选择由“已取消读取”改为“已取消合并，原课件未修改。”，普通导出取消明确未写入文件。6页合并、source/target hash、零副本取消、双尺寸与冷启均通过。静态合并未扩权，动态放映仍独立OPEN。

## 2026-10-22 教师工作目录显示名称：LIMITED_ACCEPTED

renderer新增统一`teacherWorkspaceLabel`，内部workspace类名称映射“教学工作目录”，自定义名称保留；已接文件树/上下文/设置。聚焦Electron对复制DB验证raw workspace→界面“教学工作目录”且真实文件可选；同构建完整文件面板`UbEhQt`32/32、13布局/41对比度、0错误/远程请求，无provider或源业务写入。renderer240/build/diff通过。

为解除D盘ENOSPC，历史`layout-formula-20261009`原样迁C盘并在原路径建立Junction，25837文件与closeout可读，D恢复到约1.71GB；清单`EVIDENCE_RELOCATED_WITH_JUNCTIONS_20261022.json`。

## 2026-10-22 练习来源总题数与吸顶避让：LIMITED_ACCEPTED

已保存练习来源弹层现显示总题数和题目位置，滚动提示吸顶但通过`scroll-margin-top`避开题目标题。`teacher-mainline-practice-count-20261022`在当前构建用复制已确认DB完成1366暗色实际UI核对，第二题标题可见、无provider/写入；renderer240与build通过。吸顶遮盖失败图保留。本片未重跑真实DeepSeek错题链或真人布置。

## 2026-10-22 教师长稿章节目录：SOFTWARE_ACCEPTED

在文件面板全宽阅读基础上，Markdown≥2标题时增加本地折叠目录，最多32项并忽略代码围栏；点击跳到真实标题、移动焦点并公开定位状态。没有新IPC/DDL/依赖/Loop。`pi-files-ui-EFfXJN`32/32覆盖45段长稿、3节跳转、1366/1920浅暗四组重新定位、13布局/41通用对比度、文件反例、权限与冷启；目录项最低4.90069，0错误/远程请求。ENOSPC`MqMhXx`、尺寸等待`YpCPOe`、截图误导`zzrZ2f`均保留，证据迁C并记录清单。build/diff通过。

## 2026-10-22 教师文件预览空间：SOFTWARE_ACCEPTED

资料备课真实冷启显示右栏文件树挤压长正文。现`PiWorkspaceFiles`在面板≤760px时打开文件自动收起树，工具栏改为可见“文件列表/收起列表”；状态不持久化，权限/文件/模型边界不变。正式Electron`PGhnt8`32/32，双主题双尺寸13布局/39对比度（最低5.3017）、键盘和文件反例、归档与冷启通过，0错误/远程请求。`eJnMQh`隐藏窗口动画测试失败保留。build/diff通过。

## 2026-10-22 教师成品文档清理：SOFTWARE_ACCEPTED

资料备课历史产物暴露：教师改课时后，模型把“本次修改预览/原内容/修改后”对照表写进了最终Markdown。现`textProposalInput`在提案落账前只清理位于文末且同时含两个对照字段的内部预览，创建正文和编辑`newText`均覆盖；真实审阅diff、审批CAS、撤销和历史记录不变。普通教师同名章节无对照字段时保留。

构建`d52d8e47cef236030b87d3e36ed9458f0d5c795a1bde89a159dbe7f00d65f07b`/373。基础`aoMIaL`21/21，build、renderer240、diff通过。真实资料`daily-HwDEDx`5/5、10次HTTP200、0 renderer、审阅/保存4117字节且哈希`e9ea4633...`一致，41分钟/8题/来源通过、冷启0重放。原`UK7bJ9`和`WyGbSK`规则失败保留。该片不新增IPC/DDL/依赖/Loop，也不关闭真人、VPN-off、安装或Office/WPS门槛。

## 2026-10-22 H09跨轮任务与单轮核验范围：LIMITED_ACCEPTED

构建`b7535f74ad7239981213ae516626ee77bb7efd28dc33d8e6c282cf44054b4643`/373。`PiTaskReview`根据`lastRunId`与`origin.runId`显式显示单轮/跨轮累计确认，跨轮提示说明不重放旧工具；每个回复的`OfficeVerificationNotice`明确仅覆盖该run。只改展示派生，没有新IPC/DDL/权限或核验状态改写。

正式Electron `pi-task-criteria-ui-2ALLZL`8/8：首轮确认→增要求→撤回/重排→暂停→显式恢复新run→跨轮scope可见→当前run核验提示仍独立→新确认→冷启零重放。`CltGDF`组件浏览器23/23、`ihhYSs`SSR11/11、renderer240/240、build通过。四张跨轮scope浅暗/双尺寸截图逐张查看，最低浅色对比度5.39336、暗色7.79543。

DPI补充全部通过：`pi-task-criteria-views-8H1Q5O`125% 4/4，`pi-task-criteria-views-Wj6QLG`150% 4/4；实际DPR分别为1.25/1.5，1366×768/1920×1080浅暗截图均为`round(CSS尺寸×DPR)`，对比度最低11.64757，0 renderer错误、0模型请求。

失败保留：`s42KVb`新增fixture未reset，`UPTOnT`旧刷新次数绝对断言，`6Ez3BI`测试嵌套同名locator，`i42RDC`/`a6VLQW`/`jTWKOV`为DPI捕获工具换算失败。完整H09的390窄屏、读屏、长历史性能、journal gap/reorder/reconnect等仍OPEN；H10日常/VPN-off/安装/真人及Office/WPS仍OPEN。

进度与命令：`apps/desktop/test-results/goal/harness-h09-cross-run-20261022`；合同：`docs/goal/H09_CROSS_RUN_SCOPE_CONTRACT_20261022.md`。

## 2026-10-22 H05浏览器任务准入与H10当前软件基线：LIMITED_ACCEPTED

当前构建`726eb85be68a91d98c767da5070b7f79a4d011e1a0daf7cae298bb38cb1c752b`/373。真实H10基线首次暴露NET-02浏览器`task_blocked`：模型建立了合法web步骤，但`office_browser`不在`taskToolKinds.web`，且snapshot/screenshot无url时无法复用冻结页面。修复只限任务映射与H02结果回读：navigate按实际URL；后续动作复用同一criterion resource；snapshot/capture按URL、snapshotId/标题/正文或PNG哈希/尺寸形成web证据。Pi唯一Loop、浏览器权限、教师确认和外部效果规则不变。

`pi-browser-delivery-w54wli`20/20：NET-01搜索/正文/日期通过；NET-02真实内置浏览器打开教育部首页、读取当前DOM栏目、最终回答与同页来源一致、PNG URL/哈希/尺寸一致，双尺寸预览、伪造拒绝、失败页和冷启零重放通过。`pi-result-readback-vtN8yp`28/28、`pi-task-plan-boundaries-Sn08sy`17/17、`pi-task-state-OXwcY8`27/27、浏览任务准入4/4、renderer240/240。

同构建`pi-public-image-ui-UP1W8Y`13/13、`pi-natural-file-fzKkut`14/14。合成H10软件基线`acceptance/harness-baseline-composed-CO6GIT`校验valid：NET-01/NET-02/IMG-04/FILE-01均PASS。整体仍NOT_ACCEPTED，日常配置、VPN-off、安装、真人教师、Office/WPS与完整H05/H07-H10保持OPEN。

失败保留：`B9EXFP`漏映射+ENOSPC，`6R2tIb`浏览器全阻断，`lPw1Iy`导航成功后截图缺回读依赖，`pGRANJ`native string content测试误判，`CwvbKZ`截断report。进度/命令见`test-results/goal/harness-h05-browser-20261022`；合同见`docs/goal/H05_BROWSER_TASK_ADMISSION_CONTRACT_20261022.md`。

## 2026-10-21 已有课件副本合并：限定验收

现有science-export增加`pptx_merge`，typed主进程打开原生PPTX选择器，校验目标在当前workspace、非链接、单链接且未变化；在授权目录暂存生成PPT与目标副本，经独立PowerPoint COM插页后重开核页数，再独占安装新副本。源HTML与目标课件全程不改，无新依赖、表、Loop或外部上传。

`pi-science-merge-ui-cCbzpV` 5/5，构建`534cb19010db8a53392cf207aff50a0a967f232a600aa018d02ea38eaa442069`：1页课件+5页生成=6页重开，备注/GIF保留，取消/尺寸/冷启/定位通过；边界13/13。真实放映另在找到`PPTFrameClass`后于`SetForegroundWindow`失败。WPS12.1新实例可打开并渲染全部6页，但`SlideShowSettings.Run`报COM异常；WPS播放与PowerPoint动态放映保持OPEN。

## 2026-10-21 自然语言课堂课件：限定软件验收

Pi唯一Loop保持。新增的自然语言路由只在既有Pi上下文中明确：教师说“课堂演示/课件/备课讲解”时直接使用已注册的`office_create_science_figure`，任务计划必须标为`saved_text`，不让教师选技能或填坐标。工具失败返回有界平板重复肋片构造，允许同run参数修复；HTML/SVG技术源在教师卡默认折叠。无新Agent、表、依赖、IPC或文件真源。

`pi-science-natural-ui-rw1AiM` 6/6通过，构建`44436c97ecdee0972e35bf1264f1b65dfbf427d736b3b8be1410e955553803fd`，5次真实DeepSeek HTTP200，生成41实体/6页PPTX，确认保存与冷启0重放。原`LWBhUb`、`K8kQKl`、`VSw0yp`保留。回归378教育能力、17任务计划、13 Anatomy、234 renderer及typecheck通过。

仍不证明PowerPoint/WPS动态放映、真实教师独立使用、投影环境、现有课件复制或全学科科学正确性。完整Goal ACTIVE。

## 2026-10-21 教师题目联合链：限定软件验收

Pi唯一Loop未变。`education-journey-pA6A6M`在同一正式Electron会话完成真实本地OCR、教师校正、脱敏附件读取、题目/练习候选、教师确认、SQLite保存和两次冷恢复，12/12通过，构建`288e60008b181ffe2e79d839c55d1450b68c5a249e642327e7fdd777be6f408c`/373文件，0 renderer错误。

原`education-journey-yhm964`保留为失败。题库`verificationSnapshot`错误要求遗留空`ai_agent_runs.student_id`与活动会话学生逐字相等，使真实教师确认的题目步骤保持`unknown`并阻断练习依赖。现空运行学生可由活动会话和候选冻结学生授权，显式冲突仍拒绝；专项增加正面授权和冲突拒绝。未新增表、依赖、IPC或第二AgentLoop。

本片只接受教师题目图片到少练的软件链，不关闭完整H05/H08/H09/H10，也不证明真人、手写/公式、无VPN或安装。下一教师主线为课堂课件复用，Harness只补该路径的实际卡点。

## 2026-10-21 教师答复误停修复与主线收紧

当前修复H05-C2a LIMITED_ACCEPTED，完整C2/H05/Goal仍未完成。原b167构建YBsXtw在两个idle后收到真实界面提交的“五年级”仍idle3中断；原失败保留。首次MytYDh runner/进程已消失，只留下pending且无答复，不作答复后故障证据。YBsXtw选项后首脚本遗漏单独发送，已在同一自有窗口通过实际按钮提交，未重启或注入答案；后续脚本按完整选择→发送操作。

main teacher-input-readback复用原native owner/parent/anchor边界，核同session/run/generation的answered控制行、已提交control事件hash、实际admitted/settled回执与ask_teacher原生答复。重复答案按正文摘要去重，不因模型问题/调用ID/时间变化增加信用。Goal进展v2单列newTeacherInputs和newEvidence；旧v1严格兼容，128容量/旧owner/暂停/改要求边界保留。教师输入只代表已送达，不作成果或教学正确性证据；纯聊天备课复用原候选/教师确认，不强迫写文件。无新IPC/DDL/依赖/模型循环。

最终e578e35247c3eec016030be5389bd19d50411174c4ddcdb1569f257b82bb2618，373文件/148列明源码，原npm隔离build全hash一致、源码收尾无漂移。正式Pi Electron a7RhUU5/5（明确SSE夹具）：两个idle→真实问答→草稿→界面教师确认→冷启零重放，无文件提案；独立68条journal/4原生回执、唯一教师输入信用/0资料证据信用、Task/Goal/标准/候选/教师action版本一致。浅暗1366/1920四图逐张看，对比度通过；Fi7dqF因测试固定浅色导致dark等待超时保留，恢复自然媒体设置后复测，未改产品绕过。23项输入/Goal反例、原进展16、同构建退出回归10、renderer234/234、legacy207/207、type/build和worktree diff通过。p6UizS缺测试session表与首编译sourceUnchanged=false保留，不作最终证据。

已按用户最新指示收紧执行顺序，见docs/goal/FEATURE_FIRST_EXECUTION.md顶部：资料备课/讲解讲义→题目解析与针对性练习→已审课件导出复用。下一项从原FILE素材/当前保存配置/旧会话的“实际读资料→按年级形成稿→改一处→确认保存重开”开始，NET/IMG作为这些主线的必要能力，不继续扩展演示题材或外围功能。完整已批准H01–H10、原失败与完成定义保留；排队补充handoff/编辑撤回、歧义旧task迁移未因本片通过，仅按主线实际缺口推进。真实provider/原NETIMGFILE/无VPN/安装/公网MCP/H06–H10、PPT动画-WPS/真人教师仍OPEN。日常out/profile、凭证/网络未改，无提交/push。精确命令/失败与独立审计见apps/desktop/test-results/goal/harness-teacher-input-20261021-answer-delivery/{commands.ps1,progress.json,collect.mjs}。

## 2026-10-21 等待审批退出崩溃：限定修复验收

状态LIMITED_ACCEPTED，仅HARNESS-SHUTDOWN-PENDING-01三种优雅退出。原85e构建zfqH5F框架关闭、AyGfrb直接quit均退出134并复现napi_throw；首修FclsPW暴露store关闭后的snapshot/list读已释放db。原失败报告/数据库/日志保留。main通过desktop-ipc-lifetime停止新请求并等待已准入IPC，关闭本进程窗口、取消/结束生产者，再await SQLite close；重复before-quit等待同一清理，不提前放行。typed IPC参数/Pi唯一循环不变，无新依赖或DDL。

最终冻结b167b93bfb2e2953dd55c435e68b5ec1044b0eb1cba9f26f0b5f3b6041a0a8d1，373文件/147唯一源码，原npm隔离build全hash相同。正式Pi/Hana Electron aXRlOC10/10：正常关窗、框架关闭、直接quit均真实pending起步/不批准/退出0/冷启零重放；本轮pending退出274–643ms。独立每案46条连续hash事件、3回执/2任务准入、0教师批准动作、待审稿interrupted revision1、Task/Goal中断、native/源文件不变且无输出。保存回执保留admitted/uncertain，不伪造settled成功。

正常读取→新教师审批保存→成果确认→冷启及同源停滞回归l8hZXM7/7；IPC5、lifecycle5、tool-bound17、renderer234/234、同构建legacy207/207、type/npm build通过。legacy只证历史兼容，模型明确SSE夹具，0新增真实provider请求。待审界面及代表性浅暗/双尺寸图已看，不宣称新增UI设计验收。证据见apps/desktop/test-results/goal/harness-shutdown-20261021-ipc-drain/{commands.ps1,progress.json,collect.mjs}。worktree diff0，cached diff2仍为三个原有无关staged EOF空行；日常out/profile、凭证/网络未改，无提交/push。

下一步回H05纯教学草稿/教师补充输入的合法进展策略，先冻结来源/验证合同与实际Pi实例，不把新措辞或plan版本当进展；歧义旧task迁移仍OPEN。完整H05、原NET/IMG/FILE/真实provider、H06–H10/公网MCP/无VPN/安装、教学PPT动画-WPS/真人教师均未完成；任意挂起IPC/强杀不由本片证明。Goal ACTIVE。

## 2026-10-21 H05-C1资料定位进展：限定切片收尾

已修复Vw9fcT原30745构建中三个不同授权目录成功却idle3误停。Hana实际IO附opaque sourceIdentity，discovery-readback核同一workspace lease/root及源dev/ino、native结果与当前快照；同源list/stat共享一个信用，排序/时间/大小/目录条目变化不续命。同名同条目目录被替换也unknown，身份在IO时冻结，不能等异步绑定才认路径。

定位证据只供原Pi turn boundary的中间checkpoint/journal判断继续，最终成果标准不含directory/file_metadata；不能冒充正文、Task步骤或教学结论通过，也不因已批准写入新增目录项而误挡成果确认。typed verification/goal事件与现UI范围标签/进展说明已接，无新IPC/DDL/依赖/Loop；旧无sourceIdentity结果不给新定位信用，原最终正文核验保留。

冻结85e235eec9726690cda074e8691ad612e299be2b4a2037bbbd003bfe3671ed08，373文件/145列明源码hash一致，原npm隔离build完整hash相同。正式Pi Electron cODRLy7/7（模型明确SSE）、真实Hana/FS专项i7ZpCw19/19（native数组夹具）、同构建原稿改稿2L2LDg14/14、progress16/readback26/effects34/input17/task-recheck10/criteria12/teacher26、真实store8、renderer234/234、legacy207/207及type/build通过；原91601权威exit0。最终原生浅暗双尺寸4图逐张已看。独立166事件/2run/11原生回执/2任务准入、来源身份与lease、5个进展key及同源只1个key、审批文件字节/候选/Task历史/公共投影/native前缀一致。精确命令与证据：apps/desktop/test-results/goal/harness-h05c1-20261021-discovery-delivery/progress.json。

原Vw9fcT误停、RdhBQT/nPpPRd来源替换误pass、sZkM7V观察超时均保留。sZkM7V栈停在等待审批卡，未执行到click，不能推断“点了保存没生效”；其收尾main.log的NAPI fatal仍未归因，已增HARNESS-SHUTDOWN-PENDING-01，最终正常冷启无fatal不替代该退出路径验收。

下一优先在自有profile复现正常窗口关闭与自动化收尾的pending-approval差异；若产品路径复现回流H03/H04，保留receipt/未知效果恢复。随后H05纯教学草稿/教师补充来源进展与歧义旧task迁移仍需冻结合同/真实实例，不将模型换措辞或plan版本当进展。完整H05仍IMPLEMENTING、Goal ACTIVE；原NETIMGFILE/真实provider/H06–H10/公网MCP/日常无VPN/安装/Office动画-WPS/真人仍OPEN。日常out/profile、凭证/网络未改，无提交/push。

## 2026-10-21 教师验收要求增删与重排：限定切片收尾

已贯通现有typed task-correct→宿主新ID/脱敏来源→原SQLite事务Goal/Task/action/history/复合事件→PiTaskReview添加/移除/上移→显式原Pi恢复与新版确认。保留项ID不随位置重编号，新增行不提交renderer持久ID，已撤回ID/机器ID不可冒充human；机器标准/资源/步骤与依赖保留。修改后要求版本增加、旧checks清空/暂停；正式Goal旧candidate失效，旧Goal确认接口按当前human ID工作。无新表/包/通道/Loop，不改native指纹。

冻结30745e685c4ae68de0e0384ff73161fe860cdad2a1807afda243e47665b6cb41，373构建文件/144列明源码收尾hash一致，原npm隔离构建完整hash相同。正式Electron C3BJVJ7/7、新边界cJ8CIt12/12、组件浏览器3wCMFn22/22、同构建原稿改稿hDymwQ14/14、真实store8/8，teacher26/goal15/state27/coordinator16/input17/recheck10、renderer234/234、legacy207/207与type/build通过；44271权威exit0。原生qSrKBN浅暗/双尺寸4图已逐张查看；1366编辑区需滚动并压缩聊天，列H09，不称完整视觉验收。

独立回读68条journal/2run/3个实际原生工具回执、旧/新确认候选、要求来源action digest、main生成ID、保留/撤回/顺序、不可变Task历史、Goal/公共复合投影与原native前缀一致；此原生场景无文件效果，文件链另由同构建14项回归证明。progress collectionValid=true与精确命令：apps/desktop/test-results/goal/harness-h05b2-20261021-criteria-final/progress.json。模型均明确SSE，不是新真实provider/真人验收；原6IapRh新增被拒绝及yNlxmZ等旧失败保留。

下一先冻结H05合法探索/草稿/教师补充进展策略：当前goalEvidenceProgress仍只接7类结果readback，先以实例核授权目录探索是否误停，不能把标准修改、模型换措辞或plan换版本当新进展；沿原Pi边界，不新造loop。旧多task歧义产品迁移、H06未知冷配置与原NETIMGFILE、真实provider/公网MCP/完整H08H09H10、日常无VPN/安装/Office动画-WPS/真人仍OPEN。完整H05-B2 IMPLEMENTING、Goal ACTIVE；日常out/profile、凭证/网络未改，无提交/push。

## 2026-10-21 新要求恢复与改稿：限定验收已收尾

最终a75576f33c8c662a2bc362c4e3687945c56fdc74e7b495e1bbfd34e1b407df9e，373构建文件/144列明源码hash一致，原npm隔离build完整hash一致。正式Electron qOgkYG14/14、真实store8/8、input链17/readback26/effect34/recheck10/teacher26/goal15、renderer234/234与同构建legacy207/207通过；85408权威exit0。独立257条journal/4run/6admission、Goal/Task/source/action/native/原稿before→当前after链一致，progress collectionValid=true。受控SSE不是真实provider；yNlxmZ原失败保留。最终浅暗双尺寸4图与历史输入详情1图已逐张查看，历史输入不冒充当前文件；1366展开卡压缩聊天列H09。

实际修复：完整原稿读取可由同run后续新批准编辑的before原始SHA/脱敏全文与当前after账本共同核验，公开标“历史输入”；不能满足当前file标准。两个新文件编辑都需新审批，旧批准/旧candidate不复活。完整B2仍IMPLEMENTING、Goal ACTIVE；新标准增删是下一切片，泛化进展/旧多task迁移与H06/原NETIMGFILE/其余Goal/真实provider仍OPEN。精确命令和证据：apps/desktop/test-results/goal/harness-h05b2-20261021-goal-revision-delivery/progress.json。

## 2026-10-21 H05-B2 正式目标多标准/统一确认已接线

真实goal要求→TaskView.goal digest/固定逐项human→原Pi v3 plan/admission→正式目标同task恢复→当前proof/教师动作→同事务goal/task/source/history/复合事件→共享核对UI已贯通。旧goal checked API委托Task验收，机器缺proof整次正面动作拒绝；修正同步两边文本和状态、清旧结论。新源/历史预检在run/模型前，无DDL/新包/第二loop。

52cc35ab冻结构建正式Electron受控9、普通resume8、真实Goal+Task store8、新边界15、教师26、原Goal27、journal19、renderer234/type/原npm隔离build通过，浅暗/双尺寸4图已看；同构建legacy、144源码/373文件hash与独立DB最终核查见harness-h05b2-20261021-goal-task-delivery/{progress.json,commands.ps1,collect.mjs}。初mxoWq1实际副作用失败保留且修，2ubWSD/S8cLgk旧不安全预期改为明确拒绝，正面以真实store/UI补验，不用mock成功替代。

完整B2仍IMPLEMENTING。下一：修改要求的新版本恢复/必要改稿与新审批完整实例；保留旧proof失效，不先放宽版本校验。标准增删/旧多task迁移/广义进展、H06未知冷配置、原NETIMGFILE、完整H07H08H09H10、无VPN/安装/Office动画-WPS/真人继续OPEN。1366目标核对展开压缩聊天与历史提示层级列H09；教师PPT方向保持，Goal ACTIVE。

## 2026-10-21 H05-B2 v3原生准入与显式恢复收尾（整体未完成）

原Pi beforeDelivery已接v3 task/step/criterion、真实参数资源/输入digest、来源/传递依赖准入与原子task checkpoint；typed task-resume贯通主进程/预加载/核对卡，同任务新run且先重查历史native/回执/当前文件。保存审批不重放，改文件时阻断剩余练习，恢复原字节后只保存未完成文件；最终教师核对合并多run新proof。正式goal多标准adapter与通用进展仍下一项。

最终44d3dfc4（373文件/143列明源码hash一致），原npm隔离build hash相同、exit0；正式Electron受控恢复8/8、旧v2→v3 7/7、冷恢复四视图、真实store8/8、准入16、state27、teacher26、coordinator16、重查10、浏览器17、v2plan21、verification27、execution17、renderer234、同构建legacy207及type/build/worktree diff通过。独立113条journal/3run/3admission、来源/native/文件/教师action核对一致；8张最终原生浅暗/双尺寸图已看。cached2是既有三处无关staged EOF空行。进展/精确命令/原失败与限制见harness-h05b2-20261021-resume-delivery/{progress.json,commands.ps1,collect.mjs}。

SSE模型流受控，不声称真实DeepSeek正面/真人通过；历史402与原TASK失败保留。完整H05-B2仍IMPLEMENTING，Goal ACTIVE，原NET/IMG/FILE、H06未知冷配置、H07国产公网、完整H08/H09/H10/日常无VPN/安装/Office动画-WPS/真人仍OPEN。教师PPT优先项已有独立部分验收，本片不提升其动画或模型自动备课状态。下一冻结正式goal多标准task adapter，不重复存储基础或已完成恢复链。

## 2026-10-21 用户优先插片：教师科普课件

已按ANATOMY_TEACHER_PPT冻结合同实施teaching→审阅保存→HTML/PPT；无新Loop/依赖/表/IPC。分层证据和最终验收见该合同及harness-science-teaching-20261021-first/progress.json。正式Electron导出8不代表provider自然语言备课通过，后者仍待验；原H01–H10及H05原未完项保持，不由本片提升状态。

## 2026-10-21 H05-B2生产接入（IMPLEMENTING，整体未验收）

收尾同构建legacy207/207、renderer234/234、type/build/diff通过；独立12条journal hash/连续sequence、task/历史/公共projection与修正来源hash一致。完整progress.json已生成；真实正面provider仍待额度恢复，原生产三项红保持。

task coordinator、公共task事件、typed snapshot/review/correct、PiTaskReview和当前结果重查已生产导入，原Pi loop/plan.v2/正式goal及业务权限保留。修复真实store callback缺change、异步串任务、核对文字可读性、坏task快照隔离。最终隔离构建d7a4d71b1a8ed797167e4406bec5ca28d9044ba5a9b136b0649d0c16df796f5e，373文件/134源码；日常out/profile不改。

真实失败恢复6、真实store8、受控浏览器11、coordinator13、teacher26、task27、journal19、readback26、重查10、renderer234与type/build通过；legacy/独立读回/脚本hash和精确命令见harness-h05b2-20261021-product-review/progress.json。真实DeepSeek eQdimA HTTP402/Insufficient Balance、原生产TASK-03/04/07三项红均保留；正面任务确认链待充值后重跑，完整step/criterion/admission/剩余步骤恢复继续。没有以本轮泛化核对卡关闭H05、H10或原NET/IMG/FILE。

## 2026-10-21 H05-B2 教师动作与要求版本（IMPLEMENTING，未生产激活）

在任务存储基础上新增tasks/teacher-actions.ts、tasks/task-evidence.ts及shared教师动作输入验证。主进程方法将确认绑定实际已保存assistant成果、成功run、公开内容digest和criterion版本，独立action回执与task/history在同一SQLite事务保存；同request精确重试不再读文件或写第二份确认。教师全选不能覆盖failed/unknown/缺失的系统核验，拒绝可直接记录。修正现有要求文本形成新来源/版本，保持task/step身份、清空旧checks并暂停；不是模型改标准。恢复把旧教师确认标unknown，需重新确认当前成果。

源/效果检查复用现生产result-readback，由main-only recheck回调取得当前证明；缺回调不因缓存passed而验收完成。已补跨run相同资源的旧效果防重放；dDyWJz反例证明换/退役stepId可绕过旧保护，现准入固定criterionIds，独立读回不依赖当前步骤名称。旧无此字段记录只按仍存在的原映射核对，不补造历史关联。没有模型循环、DDL、新包、vendor或凭证变化。

本轮教师动作1cQfRN 26/26、任务存储9ITW2s 27/27、结果读回bxBVvf 26/26、v2计划IQrmDh 21/21、renderer234/234、type/隔离build/diff通过。独立核对action回执hash、实际成果内容digest、修正来源和文件字节；数据库重开一致。注意这些是main-only方法、实际SQLite/本地字节＋声明native/effect夹具，不是真实教师点击、provider或Electron恢复证明。当前生产v2反例tlTVT2仍TASK-03/04/07三项失败。

当前构建仍69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2（373文件，127项源码hash一致），因为任务模块仍未导入生产。整个B2不能标LIMITED_ACCEPTED。精确命令/脚本和源码hash、独立读回、原失败及边界：apps/desktop/test-results/goal/harness-h05b2-20261021-teacher-authority/{progress.json,commands.ps1,collect.mjs}。日常out/profile未替换，无新真实API/UI请求，无提交/push。

下一动作必须接真实纵向链：普通请求及显式goal的来源/标准→task coordinator→committed task事件→typed IPC/preload→可见核对/修正UI；原Pi beforeDelivery/跨run恢复接当前权限的native/effect reader。当前只支持已有human criterion文本修正，增删标准与正式goal来源同步仍需adapter；探索/草稿/教师补充进展政策及完整TASK-01–11仍未完成。原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工、完整H05/H08/H09/H10/H07国产认证继续OPEN，Goal ACTIVE。



## 2026-10-21 H05-B2 任务存储与准入基础（IMPLEMENTING，未完成）

新增shared/xiaozhi-task.ts、main/xiaozhi-agent/tasks/task-state.ts；复用现app_settings独立xiaozhi.task.v1:命名空间，当前文档/会话索引/不可变版本在现SQLite事务中CAS，零DDL。实际用户消息、command和journal owner绑定稳定taskId、来源版本、criterion与step；模型completed只作报告。准入冻结call/step/标准/计划版本，检查实际前置核验、工具/资源范围；已准入调用不能因重建边界再次派发。暂停/归档/旧generation拒绝迟到；显式新run保留身份并把旧效果标unknown等待重新核对，不执行历史效果。

本片仍未接入production-host/Pi start与resume/public task journal/typed IPC/UI，教师逐条确认来源与标准修改也未交付。现生产v2基线GnQAZi的TASK-03/04/07仍3项失败，必须继续修，不能用新模块专项绿测关闭。TASK-07当前仅真实nativePlanId函数身份层反例，不是Electron冷启。全合同docs/goal/H05_TASK_STEP_ACCEPTANCE_CONTRACT.md保持完整，状态IMPLEMENTING而非LIMITED_ACCEPTED。

本轮新模块真实SQLite/原执行边界＋自有合成工具专项APD5j2 27/27，v2计划兼容21/21、renderer234/234、type/build/diff通过；数据库重开与不相关配置原字节保持。首反例lNvg8r（重复准入）、Uy89QG（读步骤挂写工具）、cRdlvZ（同run改绑task）保留并修后重测。原配置隔离构建69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2，373文件、125项源码hash一致；SHA与B1相同，因为新模块尚未被生产入口导入。这不是功能已交付的构建。无真实provider/Electron任务路径新验收、无日常out/profile替换、无新包/vendor/凭证/DDL/提交/push。

精确命令、当前脚本hash、源码回读、独立SQLite审计、当前生产仍失败的基线和全部边界：apps/desktop/test-results/goal/harness-h05b2-20261021-storage/{progress.json,commands.ps1,collect.mjs}。下一步先补真实教师确认/修正与旧效果重新核对，再接普通任务/显式goal/恢复、原Pi beforeDelivery、committed task事件、typed UI与完整TASK-01–11验收。原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工和完整H05/H08/H09/H10/H07国产认证继续OPEN，Goal ACTIVE。



H05-B2合同：docs/goal/H05_TASK_STEP_ACCEPTANCE_CONTRACT.md，最新实施/未完成边界以上方IMPLEMENTING为准。

## 2026-10-21 H05-B1 独立证据与有限续跑（LIMITED_ACCEPTED）

本片按冻结合同完成，完整Goal保持ACTIVE。修复C3宿主引用后缀导致真实文件核验项丢失的回归；仅剥离与实际call/tool匹配的固定宿主后缀，其他异常输出显式partial。生产边界通过主进程独立readback并提交verification后计算进展；重复正文、计划/摘要改写、重复来源、web抓取时刻与image用途改写不算新证据。私有去重集合有界，公共提示只说明资料/产物完整性范围。连续3个无新证据边界沿原Pi finishTurn停止；暂停/归档/旧owner/权限版本变化拦迟到回调。等待验收后允许正常最终文字，再继续出工具则明确结束，未增加模型循环。

最终原配置隔离构建69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2（373文件，123项源码hash本轮收尾复核一致）。正式旧C3构建→当前构建恢复→真实重复读取停滞→冷启→显式恢复去重：iga552 7/7；同一自有profile正常教师备课→读取盲资料→预览→教师点击确认保存→两项教师标准确认→冷启：51guh5 5/5。合计14次DeepSeek HTTP200、5启动、无renderer错误（旧二进制2次请求，当前12次）。独立只读核589条journal hash一致、2次goal_stalled、保存文件hash和旧native前缀一致。四张实际1366×768/1920×1080浅暗截图已逐张查看；提示最小对比度5.39336/7.79543，自然过渡，无强制finish。

native调度27/27、进展16/16、结果回读26/26、保存效果34/34、计划21/21、journal19/19、queue9/9、renderer234/234、同构建legacy207/207及type/build/diff通过。native含受控provider stream，legacy只作历史兼容，二者不能冒充真实provider或日常使用验收。精确命令、报告、源码/脚本hash、独立读回与原失败见apps/desktop/test-results/goal/harness-h05b1-20261021-delivery/{progress.json,commands.ps1,collect.mjs}。本轮复核既有测试产物，未重新请求provider；日常out/真实profile未替换，无DDL/新依赖/vendor/凭证变更，无提交/push。

下一片H05-B2：先冻结任务范围step/criterion/教师来源版本，逐步独立核验、真实工具依赖admission、跨run剩余步骤恢复；模型completed仍只是报告。当前教师goal确认不等于每个step已核验，普通聊天/目录探索/纯教学草稿/教师补充的进展类型未全验。完整H05/H08/H09/H10、H07国产公网认证、原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工继续OPEN；科普教师课件方向保留。



## 2026-10-21 H09-C3 计划版本与实际依据（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE；不关闭完整H05/H09/H10。新增严格plan.v2稳定stepId/依赖/退役ID、公开原因/版本CAS和同call幂等；同run/generation已提交工具回执作调整依据，typed只读历史支持前后比较/分页/重试/定位。采用仅指结构，模型completed仍标“已报告完成”，不能冒充逐步结果核验。snapshot仅显示已提交plan；旧v1字节/native历史身份保持，plan.v2能力另记。Pi唯一Loop，无DDL/新依赖/凭证变更，教师权限/业务事实不改。

最终原配置隔离构建1d529c746dfc90a5e8070e0bda4650468ed60f981932772c3308350730c2270e：373文件、118项合同源码hash收尾一致。实际旧14f414b7构建创建→新构建恢复/继续→教师回答→实际journal写失败→冷启，正式Pi/DeepSeek bWQsU8 10/10、9次deepseek-flash HTTP200、3启动、0renderer错误。独立回读383条journal全部hash一致、3版成功计划、失败CAS无control公开记录、旧native前缀完整。冷启精确视图3gHttU 3/3，实际1366×768/1920×1080与PNG像素×DPR一致；浅暗4图逐张查看、自然过渡，输入/计划原因最小对比度10.02385/5.39336，无新run/provider。

计划21/21、生产组件浏览器8/8、工具边界17/17、journal19/19、receiver10/10、queue9/9、renderer234/234、同构建legacy207/207，type/build/diff通过。legacy与受控组件不作真实provider或日常证明。命令、脚本/源码hash、独立读回及完整边界：apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/{progress.json,commands.ps1,collect.mjs}。

原MYQ2oN/tOAaWH产品反例保留；tOAaWH实际模型引用错误ID后停止推进，修为在既有工具结果边界返回宿主planBasisCallId，仍严格核已提交回执。4q9TTO/3RHtji/pSGEWV/J0vvVU为已解释的测试夹具错误，原报告保留；早期展开/首张尺寸时机不足的图不作最终视觉证据。日常out未替换，正常启动重建源码，无提交/push。

下一片回到H05/H09关键缺口：冻结step→criterion稳定映射、宿主独立回读核验、基于证据的停滞判定及剩余步骤暂停/恢复，沿现Pi turnBoundary，不新增模型循环。源码对账在H09_EVENT_UI_CONTRACT顶部。完整H09其余状态/证据深链/390与768窄屏/DPI/读屏/性能、H08整体FACT/跨域/质量、H07国产认证及H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍OPEN。教师科普PPT/HTML方向保留，不以本片计划功能代替教学设计验收。


## 2026-10-20 H09-C2 同步与过期操作（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE，不关闭H09整体。已知事件缺口开始即通知并禁用当前会话变更；补齐失败/旧snapshot不能解除，连续journal或权威snapshot恢复。内联审批及试卷/目标/技能portal、queue/send、范围/压缩、附件移除/OCR确认和新科普导出受控，草稿/关闭/Stop/既有请求取消保留；原main权限/revision/CAS不变，Pi唯一Loop，无DDL/新依赖。

最终隔离构建14f414b7cf1c13302a7415078b7da0156faa385f497f5e27d2a77bc67e93809c（373文件、113合同源码hash一致）。正式Pi/DeepSeek kV6nKt 10/10、3次HTTP200、2启动、0renderer错误；实际通知缺口/读取失败阻断、恢复后唯一精确写入、真正旧revision撤销拒绝、同步中Stop与冷启通过。122条journal hash一致且冷启无新增行，实际丢失通知从typed页恢复。浏览器cqlqKr13/13、receiver10/10、journal19/19、coordinator8/8、renderer234/234、同构建legacy207/207及type/build/diff通过；受控领域UI和legacy不冒充真实业务或Pi/provider。浅暗双尺寸4图自然过渡，输入最小对比度10.02385、提示5.39336，无强制finish。

原dMLxCw/RsSs2B产品反例、XnW5VU/X3glDz夹具失败保留。kliWrW虽功能9项绿但暗1366图未稳定，保留原图、不计视觉通过；同构建自然settle复测后接受本片。精确命令/脚本hash/独立核验：apps/desktop/test-results/goal/harness-h09c2-20261020-accepted/{progress.json,commands.ps1,source-readback.json,collect.mjs}。日常out未替换，正常启动重建源码，无提交/push。

下一片H09-C3先冻结稳定步骤/依赖/变更原因/版本及旧v1/native兼容；当前计划只有text/status，control prompt身份级联到memory，禁止前端猜依赖或直接改旧prompt。调查见H09_EVENT_UI_CONTRACT末节。完整H09其余状态/证据cursor深链、390/768/DPI/读屏/性能，H08整体FACT/跨域/质量、H07国产认证及H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍OPEN。


## 2026-10-20 H09-C1 计划与核对记录（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE，不关闭H09整体。合同与E状态逐条对账：docs/goal/H09_EVENT_UI_CONTRACT.md。PiTaskPlan不再按done重挂：保留无手动选择时自动收合，教师同plan/模式手动选择优先，完成不丢触发焦点；补步骤list/current语义。OfficeVerificationNotice复用主进程已校验的同run evidence引用，给只读操作标签、记录类型与时间，校验标识二级折叠；不新增重跑/批准/文件打开动作、不更改验证事实。无新main/IPC/schema/依赖，原Pi唯一Loop与教师确认保持。

最终原配置隔离构建2c518304284437aa619d18fb99c9900702db875470c6391690f4a5c7c18d68e1（373文件、98项合同源码当前hash一致）。浏览器DviVnk 9/9；正式Electron/Pi/DeepSeek 1r4MLh 5/5、4次HTTP200、2启动、0renderer错误，真实文件读取/计划完成/手动展开与焦点/核对记录/冷启贯通。独立只读journal审计183条hash一致，2次计划同id，verification与metadata/final projection相同且先于终态。原生可见主题zjVOUO 3/3、6视图，输入文字最小对比度11.6475，无强制finish动画；type/build exit0，renderer234/234、verifier SSR10/10、同构建legacy207/207、diff通过。legacy不是Pi/provider证明。精确命令与校验报告：apps/desktop/test-results/goal/harness-h09c-20261020/{progress.json,commands.ps1}。

首反例asxOZ7手动展开在完成后变false保留；kwCXuE原生主题观察被Playwright默认颜色覆盖挡住，清除模拟后通过，未据此改产品CSS或断言旧白色截图唯一原因。实际Pi仅在真实读取后短暂等待下一次模型请求便于键盘观察，没有注入模型/工具/event结果，不作速度证明。正式四张浅暗/双尺寸证据图已逐张看。

仍OPEN：H09计划稳定stepId/依赖/变更原因、gap期间所有变更控件一致禁用、event/cursor及文件证据深链、恢复/unknown/审批/队列/压缩全状态同版UI、390/768窄屏与125/150%DPI、读屏/所有点击区/对比度/焦点及长历史性能。H08整体FACT/跨域/质量、H07国产认证和H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍保留。日常out未替换；正常启动会重建当前源码，无提交/push。下一片H09-C2先实测journal gap/reconnect时已显示审批控件是否禁用，核原main revision拒绝与教师反馈；并冻结计划依赖/变更与公开事件关联所需后端契约，不能从前端虚构。H08原对账项必须继续完成，不由H09界面通过关闭。

## 2026-10-20 教师备课PPT导出（LIMITED_ACCEPTED）

用户追加方向是教育辅导教师实际备课/上课、降低门槛。已交付文件面板“导出课件PPT”“导出动图”“在文件夹中显示”，HTML交互保留；PPT内嵌GIF并附同类部件讲解页、可编辑标题/提问/备注。实例5页，不运行HTML交互控件，无插件/系统FFmpeg/转换模型调用；保存到同一授权教学目录，独占写、源版本/工作目录/hash复核，不覆盖已有产物。Pi唯一Loop、原生成审批不改，本按钮为教师显式导出，无DDL。新增gifenc1.0.3 MIT，实际172516字节、无依赖/原生模块，复用pptxgenjs4.0.1。

最终隔离构建e1e08b00dce1a4acbd8687abe991bdae62b1d26301101de5f963c764631f4453（373文件、90合同源码收尾hash一致）。真实Electron tbHJKC 7/7、2启动、0renderer错误；本机PowerPoint16.0 build20430 5/5，真实窗口GIF变化像素均值6.3497并看图，静态讲解页可翻页，原PPT字节不改。独立Pillow25帧/24种画面/8140ms/loop0。领域M0uFHL 10/10（受控生成器，不冒称PPT）、Anatomy NR7vi4 13/13、renderer234/234、同构建legacy207/207、type/build/diff通过。legacy仅兼容旁证；UI重用上一轮真实DeepSeek审批的45实体HTML，未新增provider对话。精确命令/报告见apps/desktop/test-results/goal/harness-anatomy-ppt-20261020-teacher/{progress.json,commands.ps1}。

失败保留：bBD6ss CJS命名导入，KD8c4O宿主脚本字符串语法，8GHkKM真实取消悬挂。已用default导入、编译受检的固定renderFrame函数与WebContents显式abort race修复。同类编号部件合并、淡化非重点表面解决后方部件不清楚；最多6个类别，完整结构仍见总览/GIF。Office早期脚本误用HWND成员的夹具失败保留，最终定位该样本新建的放映窗口，不操作其他用户文稿。

教师说明与可直接打开的真实PPT/GIF实例：docs/integrations/ANATOMY_TEACHER_PPT.md、docs/integrations/examples/anatomy/散热片课堂演示.pptx。WPS发现已安装但KWPP/WPP COM未注册，未改注册或算通过；WPS/网页版、既有课件复制合并人工、其他DPI/安装、MP4、广泛科学正确性仍未验。未改变日常out/真实数据，正常npm.cmd start重新构建后可用，测试目录不作为日常入口。未提交/推送。整体Harness Goal ACTIVE；H08整体/完整H09/H10/H07国产公网及原NET/IMG/FILE/日常无VPN等继续OPEN。下一步回H09-C主题/事件状态/证据入口/键盘核验。

## 2026-10-20 Anatomy 科普绘图与HTML演示（LIMITED_ACCEPTED）

已安装固定MIT上游1482e8469b0a9e0d8cc18ea2740a01423d29ae80，新增“科普绘图（Anatomy）”技能与office_create_science_figure。Pi唯一Loop，box/cylinder/repeat→宿主SVG/HTML→现typed审阅→教师确认→原子保存/回读/撤销；无DDL/新npm依赖。用户追加选型为离线HTML内嵌演示优先，支持播放暂停、进度/键盘、前后步、全貌；SVG静态备用，GIF/MP4未做。结构演示非物理仿真；教师仍核查科学含义。HTML固定脚本、SVG作img、opaque sandbox/CSP隔离，保存文件重建模板而不执行任意HTML。

最终隔离构建f43820f2e46d0e7f4c5bc4db27bde288e3c1180b1f2a9d7aee6864bf655c2bf2，372文件，83合同源码收尾hash一致，许可/manifest打包字节一致。真实Electron/Pi/DeepSeek G5k6xX 8/8、6次deepseek-flash HTTP200、2启动、0renderer错误；实际预览交互/双尺寸可达/确认精确写入/文件面板重开交互/拒绝零写入/冷启无重放。HTML浏览器6/6、SVG浏览器3/3、绘图13/13、技能目录25/25、旧v1迁移10/10、协调器8/8、文本基础20/20；renderer234/234、同构建legacy207/207、type/build通过。legacy仅兼容旁证。截图已逐张看；精确命令、报告和失败边界见apps/desktop/test-results/goal/harness-anatomy-html-20261020-reviewed/{progress.json,commands.ps1}。真实保存的独立示例见docs/integrations/examples/anatomy/散热片.html。

e45NqM/qUUVYo机械绿但视觉/几何错误，orQJXZ严格44≠45，均保留；修正最小角坐标、遮挡排序、repeat精确展开。BXNRYz首次HTML播放观察超时，独立浏览器通过但同场另有Electron兼容验收；G5k6xX显式检查文档visible并使测试窗口前台后通过，未将原失败算成功，也不将并发遮挡推断为已证实唯一根因。两个旧host/API源码脚本因Node24 JSON import attribute加载失败不计通过。

仅本切片LIMITED_ACCEPTED；Harness Goal ACTIVE。H08整体/完整H09/H10/H07国产公网认证及原NET/IMG/FILE/日常无VPN/安装/OfficeWPS/人工仍OPEN。日常out未替换，统一启动器npm.cmd start会重新构建源码；测试目录不作日常启动入口。无提交/推送。下一步回到H09-C主题差异与E_EVENT_UI状态、证据入口和键盘核验。

## 2026-10-20 H09-B 最终限定验收

H09-B LIMITED_ACCEPTED；Goal ACTIVE。最终 **7d275058fb1addb245d0b19832e911aae1490cd53ff14783cc4687021044af47** /370 files，63项列入合同的源码hash仍一致。未对其他并行脏改动作可复现声称，日常out未替换。

|层/报告|终态|证明范围|
|---|---|---|
|Chromium browser-ew0wdN|10/10、0页面错误|实际PiConversationSurface/OfficeConversation：底部跟随、native wheel阅读、同段追加、正反选区、跨消息、前缀变化失效、外部输入焦点与选区不被抢、thread隔离、历史前插|
|H09-A run-wpbSQq / browser-QFnXMJ|7/7 + 7/7|当前源展开和焦点回归，均非真实工具执行证明|
|正式Pi pi-reading-ui-VltzC1|6/6、2启动、0renderer错误|UI设置现有DeepSeek→公开长教研材料→真实模型流→native鼠标选区保留→wheel阅读→完成→原latest按钮→冷启公共turn/run数一致、临时选区为空|
|renderer / 同构建legacy|234/234 / 207/207、exit0|当前组件与历史教育兼容；legacy不作Pi或原NET/IMG/FILE通过证明|
|typecheck / 原配置隔离build / diff|exit0|原配置仅输出自有目录；构建hash和63源码hash收尾重核|

复用现OfficeReadingPosition与Pro原scroll容器/按钮，不写第二滚动循环；新增OfficeTextSelection只处理公开正文原端点。Markdown异步commit使父getSnapshotBeforeUpdate不足，现原host的MutationObserver与native selectionchange配合，在当前thread/item/markdown与两端前缀不变时恢复原anchor/focus；新用户指针/按键清旧缓存，选区指向其他控件或原文变化则不套旧书签。无DOM新盒、focus/clipboard调用、事实持久化、IPC/Loop修改或新依赖。未声称复杂表格/公式/code跨块、读屏、所有选区类型已验。

反例保留：4DTDlq前三项滚动绿，实际鼠标“选区前缀不要丢失”在同段追加后空；m2LPJS父快照仍同断言失败；zdcRnF从现选区内部拖动测成原生drag-and-drop，补真实点击取消旧选区后再反向拖；3MHepg程序化scrollIntoView与新thread初始RAF竞态，未据此新增滚动补丁，native wheel重测后历史前插前后offset=-5.375/-5.4375px、差0.0625px。保留第一次setup/实现失败，不重写旧报告。

正式实际模型deepseek-flash，1次HTTP200；自有公开合成教研材料，无学生资料。真实响应字节经50ms/chunk节流及自有marker短暂停留，让鼠标有操作时间，内容不注入；因此不作网络/生成速度/帧率证据。原文和最终公共turn冷启相同；cold网络观察从ready开始，未独立覆盖更早请求。正式4张1366/1920浅暗图及组件2张浅色图已逐张查看，Windows150%DPI物理输出；1366暗色切换时composer仍浅色，作为后续视觉差异，未按截图文件名宣称全部主题一致。

精确证据根apps/desktop/test-results/goal/harness-h09b-20261020-final；collect.mjs校验报告、实际脚本hash、构建hash与63源码hash。commands.ps1记录命令/终态；没有coverage百分比或稳定网络结论。H09-C先按E_EVENT_UI核journal→projection→全部可见状态，复现主题差异，补计划/attempt/验证/恢复和证据入口的操作可达性；再补窄屏/DPI/键盘读屏/长任务性能。H08未验跨域/FACT/质量、H07公网认证、H10原NET/IMG/FILE/日常保存配置/旧会话/无VPN/安装/Office/WPS/人工均继续OPEN。


## 2026-10-20 H09-B 冻结合同：流式阅读与正文选区

M10/M12，已按顶部限定范围验收。现有OfficeReadingPosition/Pro已实现底部跟随、向上滚动及面板往返书签，旧pi-shell-reading有真实流证据但绑定日常out，不能直接当作当前构建通过。本轮先复用该机制与观察方法，对实际PiConversationSurface/OfficeConversation在真实Chromium中检查增量文本、正文选区与历史前插；不为已正确行为增加第二滚动实现。

教师结果：在底部继续跟随新事件；用户向上阅读后不被新事件拉到底部；选中正文前缀在同项追加或其他项/工具更新后保持原文本、方向与焦点；点击“回到最新消息”恢复跟随；同名item切thread不继承旧选择。历史分页前插保留原可见段落位置。不得用前端模拟状态替代journal、改变事件/权限/事实/Loop。若无反例，仅补有边界的验收，不凭猜测修改生产代码。

拟改文件限定renderer办公阅读adapter/OfficeMarkdown或OfficeConversation（仅按反例决定）；新增真实浏览器测试与正式Pi用户路径脚本，隔离builder补对应source hash。使用现HeroUI，vendor保持原样；无新依赖、DDL/IPC/云端字段。兼容原消费者/书签/冷启默认，回滚本片renderer差量和测试入口，不改变持久事件。保留修改前源hash与首失败，已有脏改动不reset。

门禁：真实组件生产捆绑浏览器先反例再修；H09-A展开/焦点回归、type、renderer、原配置隔离build；正式Electron当前Pi/DeepSeek公开长文本流中用真实鼠标/键盘选区，核前缀/锚点、最终公共记录与冷启；同build兼容门禁和diff。组件公开投影是受控输入，不冒称真实provider。1366/1920、正式浅暗和实际DPI单列；完整读屏、390窄屏、其余DPI、1000轮性能和Codex整页视觉/H08广泛质量及H10原NET/IMG/FILE/日常环境继续OPEN。


## 2026-10-20 H09-A 最终限定验收

H09-A LIMITED_ACCEPTED；最终构建 **faf3568680f89798452686ded6019b16f17dc8c49fac2326394e016d968cc420**，370文件，60个列入合同的源码指纹在构建及收尾核对一致。旧794901构建属于焦点修复前的历史结果，不能冒作当前源证明。没有覆盖日常out；不对未列出的并行源码作可复现承诺。

|层/精确报告|结果|实际证明|
|---|---|---|
|jsdom run-RNscZp|7/7|实际React Aria点击，状态翻转、单步→组、拆分合并、手动收起、run/thread隔离|
|Chromium browser-CBGkta|7/7，0页面错误|生产捆绑的实际OfficeConversation，Enter/Space、重分组触发焦点、组拆分回首调用、不抢外部焦点；公开投影为受控输入，无Pi/IPC证明|
|正式Pi pi-expansion-ui-iieHTy|5/5，2次启动，0renderer错误|设置保存现有凭证→选自有目录→entry揭示未知文件名→第二次真实读取→随机答案→两份成功持久回执→冷启同公共turn，3次真实DeepSeek HTTP200|
|renderer组件|234/234|当前组件回归，无coverage百分比声称|
|同构建legacy electron-smoke|207/207，exit0|历史教育兼容，不能当作Pi或原用户NET/IMG/FILE通过|
|TypeScript/原配置隔离构建|exit0|无新增类型错误，日常out未写入|

正式实例保留模型自然的公开说明分隔，actualLayout=separated_by_public_messages；脚本只暂停一次后续真实请求，让教师来得及展开，无模型响应或工具结果注入。精确合并/拆分/焦点证据属于组件层，不能冒称真实模型当次确实成组。冷启前文件逐字匹配，收尾collect又只读核对自有工作目录的两份公开文件模板；公共turn冷启一致，临时展开按合同回默认，未增加run。冷启网络观察从composer ready开始，不独立覆盖最早启动流量。

视觉：正式4张1366×768/1920×1080浅暗截图已逐张查看，150%DPI物理输出；组件4张100%截图也已查看，但独立fixture没有整壳主题接线，在两类OS偏好下都为浅色。已纠正脚本措辞并记录actualBodyBackground；正式Electron确实呈暗色。页面顶栏仍保持浅色，整页Codex同款、125%DPI、窄屏、读屏、正文选区和阅读锚点不在本片接受范围。

反例：G2AmYj先4绿后真实重分组失败；browser-aFJ2mv先首项绿后焦点BODY失败，修复后原断言通过。不删除旧报告。dw0IXd主进程RPC观察器回收、lhA79Q“必定成组”假设、LNYhCA/ILkKh2夹具启动失败均为测试层问题，保留记录；额外一次根路径编辑失败后误跑旧脚本6绿只算重复历史运行。collect首次因CRLF解析失败，修正汇总解析后成功，不重新写旧通过报告。

复用：HeroUI ChatTool/ChatToolGroup的受控Disclosure及既有Pi/native/typed路径；未修改vendor，未引入运行时依赖。继承已有jsdom29.0.2（MIT，开发目录根约10.5MiB，未计传递依赖），仅本机测试，Windows生产包无新增依赖。实际差量集中OfficeToolExpansion/OfficeToolProcess/OfficeConversation及验收脚本；无DDL/新API/另一个Loop。完整事件语义和H08未验要求仍沿下表，不重新定义完成标准。

证据根：`apps/desktop/test-results/goal/harness-h09a-20261020-focus/`，`collect.mjs`检查精确报告、脚本hash、60源码hash和构建hash，`progress.json`、`commands.ps1`记录门禁与范围。原NET/IMG/FILE、国产MCP认证、日常profile/无VPN/安装/Office/WPS/人工仍OPEN。下一步H09-B：先复现向上阅读时真实增量事件对滚动锚点/选区的影响，再冻结最小交付合同；后续全H09/H10不得跳过H08广泛质量/FACT/跨域及原失败回归。

## 2026-10-20 H08 原要求逐条对账（不变更完成定义）

|原F方案要求|已读证据及其能力|当前边界／下一动作|
|---|---|---|
|bounded spec、stateDigest、fallback/ABSTAIN、shadow路由选择|H08-A/C当前production模块，FnrQKy24、呈现twV0PN17；yMz4NE真实DeepSeek与回放|有限枚举与关键词规则有基线；不是通用语义或教学质量，仍需更广独立样例|
|候选→原来源replay/eval→有限采用→rollback|H08-B候选SPt0Am25及真实LYY4Qd12/JMEP5i5；隐式AfmVzk18含质量退化追加回滚|后两正式报告属于其冻结构建；退化是受控完成回答的领域测试，不冒充当前真实模型长期退化；H08整体保留OPEN|
|来源/版本/学生/goal变化与迟到结果失效|FnrQKy24，真实yMz4NE选中记忆源修订/撤权/冷启，B学生绑定正式实例|真实用户全量来源组合未逐项测试；当前依据足以维护现受限契约，不足以闭合整个Master flywheel|
|网页注入、推断冒充成绩/答案、FACT不被后台修改|领域测试拒绝reasoning/score/越权enum与保留原FACT哨兵；旧真实B合成学生行不变；judge上云只有五标量|不能把哨兵库不变称为真实教师整库事实验收；跨域真实来源攻击和更多FACT类型仍须H08/H10实际补验|
|跨学生泄露与停滞回退|既有memory epoch、goal/no-progress与来源隔离专项；C不同run/generation/public receipt核对|这些是对应层证据，完整日常跨学生/长任务仍OPEN；不关闭原用户NET/IMG/FILE|
|性能/质量基线可回放，失败不promote|C100次回放152.3369ms，0judge；两类实际工具对照；B固定表达指标/独立留出|只报告受测任务/表达检查，不推断教学正确或因果收益；无全局自动优化/FACT后台晋升|

H08-A/B/C目前仅各自LIMITED_ACCEPTED，H08整体OPEN。下面H09-A只消费已经稳定的H03/H04公共事件，并修UI临时展开状态，不改变或绕过上述未验能力；H09/H10全部完成仍必须回到这些缺口验收。当前不是重新定义H08或把它改为可选任务。

## 2026-10-20 H09-A 续接合同：真实对话重新分组时保留展开

M10/M12，合同已按顶部限定范围验收。复用上一段已有useToolExpansion受控修复和4项jsdom真实触发测试，不覆盖其稳定状态规则；这些仅证明已挂载节点更新，尚未证明单步→多步、工具组拆分/合并及不同run/thread的状态隔离。现groupOfficeProcess每次按相邻工具重算，不能沿用“成员一旦分组固定”的假设。

教师可见结果：展开某个真实工具后，后续工具到达或内联交互拆分工具组，不丢该调用的选择；手动收起仍优先于attention更新。无手动选择时保持原attention自动展开规则。作用域按当前会话/turn/call与group区分；同名call在其他run/thread不继承。只保存临时UI状态，不持久化到事实库，不触发工具/judge/权限变更。

文件/契约：新增renderer的展开作用域/受控hook，OfficeConversation为每turn提供作用域，OfficeToolProcess沿既有ChatTool/ChatToolGroup接入；共享事件、main/preload、SQLite、Pi工具均不新增或改协议。现有旧消费者保留局部状态fallback。复用锁定的HeroUI源，官方MCP已核Disclosure受控isExpanded/onExpandedChange；公开网页读取429，沿已成功官方MCP与本地源核API，无新包/许可变化。现jsdom29.0.2仅为已有开发测试依赖，不进入生产renderer。

修改前保存当前两组件字节/hash，不reset脏改动；先对实际OfficeConversation添加交互反例，禁止mock组件状态或靠SSR字串冒充交互。验收：旧实现重分组失败→作用域修复→同case及原4项通过，type/renderer、原配置隔离build与同build正式Electron/Pi两阶段文件读取（首文件揭示第二文件名）和可见展开、SQLite/文件/冷启读回；双尺寸浅暗截图/关键控件；git diff。正式实例不注入模型回答，文件/目录setup为自有公开合成内容。只接受被证明的范围，完整H09键盘/读屏/长历史/窄屏/所有DPI等保留；运行时来源/验证仍为H03/H04现契约，H08广泛质量/跨域flywheel不由UI片绕过或关闭。

焦点补充合同（2026-10-20，写代码前）：browser-cir66f在真实Chromium记录focusAfterRegroup=BODY，说明保留展开仍会丢键盘位置。限定到工具/工具组触发按钮：重新分组时恢复同一调用（组拆分时回到首调用），保持原scroll，不跨thread/turn继承；用户主动移到其他控件后不得抢焦点。只在现renderer作用域中加临时focus ref/受控Trigger ref，不改IPC/事件/事实/权限。先给真实浏览器断言使当前实现失败，修复后同时复验单步→组、组拆分、键盘折叠与外部焦点不抢；原展开7项/type/renderer、隔离build与正式实例按最终source重新核对，先前6/5/207报告保留其构建和范围。完整正文选区/阅读锚点/读屏仍属于H09后续，不扩大本片结论。

实际场景分层补充：dw0IXd在首次模型请求前主进程RPC轮询触发“Resulting promise was garbage collected”，已以自有测试目录marker替换轮询，未改生产代码或模型响应。lhA79Q真实DeepSeek三次HTTP200，两份文件/答案均正确，但两次工具间有公开说明，按设计形成两个独立工具段；原测试必定形成组的假设失败，不将其算作产品读取失败或删除记录。正式实例保留模型的自然分段并验证调用展开/键盘/文件与冷启；精确单步→组/拆分/合并/组键盘由同源码的真实Chromium组件fixture和jsdom反例独立证明。fixture仅给公开投影输入，不调用Pi/IPC/供应商，不冒称真实执行。临时UI选择跨冷启回默认，完整读屏、正文选区和长历史仍属后续H09，不能把本片扩大为全部可用性通过。

回滚仅撤本片renderer差量；原局部展开策略与旧主入口保留。丢弃UI状态不改变已提交事实、操作结果或教师确认，应用冷启恢复原默认展开，不声称跨重启记住临时展开选择。

## 2026-10-19 H09-A 首片合同：工具步骤展开状态稳定

仅覆盖 OfficeToolProcess 的单个 ToolStep 与多步 ChatToolGroup 展开状态；先以真实组件交互反例证明旧代码失败，再按稳定身份修复。不改事件真源、Pi 循环、权限、SQLite 或 API。

- 稳定身份：React key 不得含 attention/状态派生值。ToolStep 用 `item.id`；组用首个调用 id（原首片误以为成员固定；2026-10-20真实重新分组反例已否定，当前须按顶部续接合同保存独立调用选择）；单步分支加 `key={items[0].id}`，替换 part 时不复用上一行已锁定的展开状态。
- 展开行为（受控 `isExpanded`/`onExpandedChange`，移除 `defaultExpanded`，两者不并用）：
  1. 教师手动展开/收起在任何状态/attention 更新后保持（DOM 触发节点不被替换）。
  2. attention false→true 自动展开一次：教师未手动操作前 expanded 跟随 attention，与旧 defaultExpanded 重挂行为一致但不再重挂。
  3. attention true→false 不强收教师展开的行：首次手动切换后教师选择对已挂载行锁定，任何 attention 变化都不强制折叠或强制展开。
  4. 不改事件真源/Pi/权限/SQLite/API。
- 非目标：完整 H09 事件 UI、键盘/读屏、长历史、DPI/窄屏、其他组件。
- 验收：真实组件交互测试（Vite ssrLoadModule + jsdom + react-dom/client + act，真实 pointer/click 走 React Aria usePress 指针路径，非 SSR/非 prop 断言）先失败后通过；typecheck；renderer 组件测试；首失败保留。

实际结果：先在新测试 `apps/desktop/scripts/office-tool-expansion-interaction.mjs` 下运行旧代码，检查 A「trigger DOM node must not be replaced (key must be attention-free)」失败——attention 翻转触发重挂、触发按钮 DOM 节点被替换，首失败保留于 `apps/desktop/test-results/goal/h09a-20261019/run-BQNlk4/report.json`。修复 `apps/desktop/src/renderer/components/office/OfficeToolProcess.tsx`（稳定 key + `useToolExpansion` 受控展开）后同测试 4/4 通过，报告 `run-Ez4LKg/report.json`；新 npm 脚本 `test:office-tool-expansion`。精确命令（apps/desktop 下）：`node scripts/office-tool-expansion-interaction.mjs`（旧代码 exit 非 0，新代码 exit 0）、`npm run test:renderer-components`（passed 234 / total 234）、`npx tsc --noEmit`（exit 0）、`git diff --check`（exit 0，仅既有 LF/CRLF 提示）。测试环境备注：jsdom 29 提供 PointerEvent，需在加载模块前把 window 的 PointerEvent/MouseEvent/KeyboardEvent/Event/HTMLElement/SVGElement/Node 暴露为 global，react-aria 才会走真实指针分支；jsdom 无 getAnimations 时 Disclosure 面板 hidden 走直接分支。未 commit/push；不声称完整 H09。

## 2026-10-19 H08-C 实际结果（当前恢复入口）

H08-C LIMITED_ACCEPTED；Goal ACTIVE，整个H08/后续阶段未关闭。本轮progress：发现并修复首次seal前缺回执误报无工具，保留原失败、完成最终隔离实例与文档收口。最终构建SHA256 16ab8e4a78fde74e330851a45ef7967267e446430367457fa5e3e337876ab7ad（370文件、56项合同源码指纹），根apps/desktop/test-results/goal/harness-h08c-20261019-journal；构建后/验收后源码与build指纹一致，原Vite配置仅重定向自有outDir，日常out未替换。完整机器报告progress.json、命令commands.ps1，git diff --check exit0，无commit/push。

- 领域pi-routes-FnrQKy 24/24：实际production authority/ledger/candidate/route模块、隔离SQLite，memory/file/web适配与judge为受控。覆盖原用户/32768上限、学生/goal版本、候选拒绝/过期、memory源/授权、web/工作目录、旧source、不同generation、缺失/未知/失败/冲突/溢出回执、原提交tool_start身份被改、judge越权/额外reasoning/score/失败/超时/迟到与CAS。呈现pi-decisions-twV0PN 17/17（含route IPC非主窗口拒绝）、候选SPt0Am25、隐式AfmVzk18、明确jJv7At8、renderer217、tsc/隔离build exit0；固定mu许可/3文件hash复核通过。
- 最终正式Electron/Pi/DeepSeek报告pi-route-ui-yMz4NE 9/9，2026-10-19、两次启动、renderer错误0，脚本SHA与运行期间一致。文件末行与真实office_read_text/native/SQLite回执一致；本会话选择有实际文件run来源的公开合成记忆→read_education_memory→公开核对词一致；源内容修订、关闭清空使旧decision不可新复核，历史回执仍可核对；冷启状态一致且ready后没有模型请求。目录对话框与初始记忆建档为受控setup，不冒称原生弹框/记忆编辑页面验收，不使用真实学生资料。
- 当前模型deepseek-flash。显式路径judge实际HTTP200一次，只发files,intent,memory,student,web五标量、0tools；另一次401明确注入，失败不覆盖主选择/native会话/偏好/文件。VqB3Km同构建首次文件路径已通过，但judge8015ms超时、无HTTP响应，原报告保留；yMz4NE是原脚本/配置/构建/8秒期限复测，不改变断言。一次后续成功不代表重复稳定/无VPN可用，更不能关闭原NET/IMG/FILE用户反馈。
- 首缺陷mq1zgU：来源epoch变化但旧偏好revision未变时decision仍current，改sourceVersion2 authority核对；d1WTwI：任意effect/native字符串被当成功，对齐既有recovery枚举；VS9eDt：首次seal前回执缺失误报无工具，现与同run/generation已提交tool_start的callId/tool/session/run一一核对，缺失/多余/篡改不保存可用观察。Utt2w8漏L2引用、DioI2Q隐藏详情与设置重复定位为测试setup错误；保留原失败，不改原报告。
- 原app_settings记录附加sourceVersion2，原呈现spec仍v2；路径规则v1与五项标量是shadow，对Pi实际routing/toolset/权限/事实/选中记忆无控制作用。原source只回放、不新复核。沿现SDK单次ModelRuntime、bounded timeout、CAS、typed IPC与设置组件，无依赖/生产DDL/第二Loop。可选审计失败不影响原主任务，读取不可核对明确反馈；关键journal仍原强持久化。
- 固定关键词/枚举及回执100次离线回放152.3369ms、judgeCalls=0；两个实际公开合成文件/记忆路径与建议及回执类别一致，只是有限基线。它不证明语义NLU、教学质量、主动路由优化或长期性能。当前8张file/memory-revoked × 浅暗 × 1366×768/1920×1080截图已逐张查看，控件可达无横向溢出；150%DPI物理截图不替代125%DPI、390窄屏、主聊天各状态/键盘/读屏或完整H09。
- 兼容回归32ec85bb...构建207/207、exit0，是最终journal核对补丁前的历史旁证，日志单独名compatibility-before-journal.log。已核与最终16ab8e唯一合同源码差异route-observation.ts，renderer/preload文件hash逐字节相同；最终修改部分由24领域+9正式UI验证。明确不称207是最终构建Pi/provider或日常验收。更早1f598/KKJ9kH/gBPsbi只历史，不替代本片最终实例。

### 后续顺序与尚未完成

先逐条对账H08原要求：跨学生/goal与网页注入、推断不能成为成绩/答案、质量下降回滚、真实FACT字节/版本保持、完整flywheel与更广质量基线；A/B/C各自限定结果不自动关闭它们。补齐依赖后进入H09，设计沿E_EVENT_UI、原67设计/BoardUI合同与现PiEducationWorkspace journal receiver、PiGoalControl/PiTaskPlan、OfficeVerificationNotice/RecoveryNotice及内联教师确认，不另造事件真源。已读源码确认OfficeToolProcess中ToolStep和组key含attention，可能重挂并丢用户展开；下一首片冻结合同，先用真实组件交互反例证明，再按稳定ID修复，不能重写整个shell绕过。

H07国内认证服务待SERVICE_REQUESTS账号配置；H09/H10、原NET/IMG/FILE、日常保存配置/旧会话、无VPN、安装包、Office/WPS及教师人工全部OPEN。教育DT-05独立，无新增服务账号/付费/凭证修改。

## 2026-10-17 H08-C 冻结合同：决策来源与能力路径对照

M10/M12，原冻结合同已执行，限定结果与剩余范围见顶部；沿既有decision ledger、memory-scope、候选/偏好receipt和H03/H04工具回执，不新建事实库或第二AgentLoop。旧记录只绑定偏好receipt/revision，候选拒绝、记忆撤权/原文变化、学生/goal变动尚未全部使其失效；路径选择还缺可回放的有限枚举和真实工具对照。

交付：现app_settings decision记录增加显式sourceVersion与来源摘要；从main的真实user/学生/goal、候选状态/来源、记忆授权fingerprint、web设置与工作目录/附件版本构成私有authority，公开仅枚举/版本/计数。旧source版本保持原规则回放但不作为新的复核依据。路径spec以本机用户意图分类及可用上下文生成有限建议，先shadow，不注入模型执行上下文、不改变Pi工具/权限。正式run结束后从现tool_receipts记录实际类别/成功失败/unknown，离线回放重算建议及观察映射；显式DeepSeek仅接脱敏标量返回枚举/ABSTAIN，独立于实际执行与验证。

贯通main→typed IPC/preload→现设置策略记录，展示来源是否仍有效、本机路径建议、真实工具对照、离线回放和可选复核。复用同一ledger/CAS/错误边界与现SDK单次请求；不新增依赖/DDL。审计/可选judge失败不可影响原任务，读取不可用必须可见；关键journal仍按强持久化规则。来源变化或迟到结果只保留stale/abstain，不改变事实、偏好、权限、验证或已选记忆。

验收：候选拒绝/过期、记忆禁用/选择/原文版本、学生/goal、web/文件权限变化让旧记录失效；旧数据原回放不重解释。未知路径/extra reasoning/confidence/网页注入文本、越权建议、judge失败/超时/迟到、回执篡改/缺失/失败、并发CAS均不形成事实或授权。真实Pi任务→工具receipt→UI→SQLite→冷恢复分别核对；离线分类golden与性能/实际对照仅为路由基线，不充作教学质量。type/build/组件/专项/正式Electron与DeepSeek/双尺寸浅暗视图及diff门禁；保留首失败。H07公网凭证、H09/H10、原NET/IMG/FILE/日常无VPN安装及教育DT-05独立范围继续保留。

## 2026-10-17 H08-B 实际结果（当前首要恢复入口）

H08-B LIMITED_ACCEPTED，整个Goal/H08仍ACTIVE。最终构建414cc39a73e3d318593237e45311a515696a0c3113118cd2e48164053f550c1d（370文件、51项列入合同的源码指纹）；构建后/验收后51项仍一致，原Vite配置仅重定向自有outDir，日常out未替换。最终同构建legacy兼容回归207/207、exit0，git diff --check exit0；legacy不冒称Pi/provider验收。完整记录apps/desktop/test-results/goal/harness-h08b-20261017-v3-release/progress.json。

- 领域25/25（pi-candidates-PnVDaI），隐式既有合同18/18（contract-aColFn）、明确偏好8/8（contract-3pZvWX）、H08-A决策17/17（pi-decisions-CeLfw0），renderer217/217，type/build exit0。覆盖原消息/原回答/公共turn/学生绑定/goal变动、归档、旧来源、旧指标失效、指标伪造、历史基线、不同goal反馈、首次反馈前切学生、CAS拒绝/采用竞争及事实不改写。受控回答不冒称真实模型证据。
- 当前正式Electron/DeepSeek采用实例12/12（education-journey-LYY4Qd），拒绝/学生绑定实例5/5（education-journey-JMEP5i），均绑定当前构建；runner SHA 7375aba2df35c899f5f53cd1d23f0a9d8b5dd619967ef4adcc9f2a89e1818145，journey SHA 0c42925539b6103414638b60f7ba133317e1916c8ff8c40c99715ed7d50c4564，运行期间未改，renderer errors=0。两次独立公开教学问题→普通修正→候选→独立留出→绑定正反馈→有限采用→后续新任务→冷启→教师自然撤销完整贯通；设置本机重算和拒绝可操作。另用现typed IPC建立自有合成学生作为setup，再从普通聊天验证run的不可变学生绑定及学生行字节不变；不据此接受学生创建UI。原版本、来源摘要、SQLite和冷启动一致；拒绝不复活候选。后续150/30/25%算术断言仅覆盖本题，不代表全科教学质量。
- 正式UI另向自有SQLite注入原消息变化，显示来源失效且读取不改已采用版本；这是明确的受控故障。采用/拒绝共8张1366×768/1920×1080浅暗截图已查看，控件可达、无横向溢出；使用100%DPI静态验收，125/150%DPI、390窄屏和完整H09仍OPEN。
- 保留首次Q3I4Up、Ra1sHh、px7vx3、N1cpVw及正式98ttpM/3Uk2pB失败。98ttpM中持久助手行只有342字符尾声，页面公共完整回答1769字符（非空白1404）；现经eventJournal.snapshot读取同一公共分段。原失败库以readOnly模式回放sameVisibleText=true，未改原记录。3Uk2pB实际四个“第 1 步”被旧指标计0；v3只读重算4步，原failed候选及空head保留。qqxvck为测试误读createStudent列表返回值，已修setup；不将它归为供应商/业务故障。这些重算不是把原失败报告改成成功。旧737/e1/6b/9e/f0/b28构建上的通过只保留为先前阶段，不替代当前实例。
- 候选继续存于现app_settings；sourceVersion/revision/digest只附加字段无DDL，旧未绑定候选/消息不补造来源。摘要覆盖原用户、原回答、学生绑定、goal objective/criteria；显式不同goal正反馈不能采用旧试用。教师全局表达习惯只含枚举，不是学生事实或权限；本机复核不调用模型，不保存原话/私有推理，未新增依赖或第二Loop。
- 原评估/留出/采用/效果下降与自然撤销规则继续复用；历史留出按原偏好基线重算。表达指标升级v3支持空白、全角数字和冒号的步骤标题，仍拒绝quote/fence假步骤，未降低长度/独立样本/留出门槛；旧规则待采用候选metric_changed失效，v1/v2已采用版本仍可读取。历史候选保持原phase，当前复核不重新启用。main admission把当时选中学生存入已有run.student_id，来源要求run/session一致。已采用版本不会被一次刷新或来源状态读取偷偷改写；不合格、来源过期或教师拒绝的待采用候选不得晋升。复用来源与许可沿既有mu/Pi/Hana manifest，未复制新外部运行时。

报告与精确命令：apps/desktop/test-results/goal/harness-h08b-20261017-v3-release/{progress.json,commands.ps1}。下一步H08-C先冻结有限路由/选中记忆的shadow选择、离线回放、来源生命周期与回退合同；补decision ledger对候选状态变化和记忆授权epoch的来源绑定，不能把历史选择重新作为当前授权。复用Pi和现memory-scope/教育事实；不添加另一个AgentLoop。H07国产认证公网、H09/H10、原NET/IMG/FILE、日常profile、无VPN、安装/Office/WPS和教师人工仍OPEN。教育DT-05顺序不改；未提交/推送。

## 2026-10-17 H08-B 冻结交付合同：候选来源与采用生命周期

以下为本轮中间现场，保留修复来由，以顶部最终记录为准：Q3I4Up（旧反馈仍试用）、Ra1sHh（历史指标误用当前基线）、px7vx3（不同goal正反馈误采用）反例保留；当时22项领域通过。正式98ttpM发现持久助手末尾摘要342字符与页面完整1769字符不同，原学习器只评摘要；已复用eventJournal.snapshot读取同一durable公共分段，原失败库只读回放sameVisibleText=true（1404非空白字符），不读取native私有思维。旧未带preferenceSourceVersion的待学习消息不补造goal来源；新main消息保存来源标记/goalId。当时隔离构建9e3509db6eb861b2bb587aa80c37baf758cd5dfe9c1e59d226454013f1ab0396/370文件；之后继续修学生不可变绑定和v3指标，旧737/e1/6b/9e等通过不替代最终414构建。

M10/M12；合同已执行，LIMITED_ACCEPTED范围见顶部；不覆盖教育DT-05队列。冻结时teacher-preference-learning已有两组独立样本、留出、呈现指标、自然正反馈采用和下降回滚；缺少原消息/原回答/学生绑定/目标来源的再次核对和教师可读候选入口。修复直接复用这些候选/版本/CAS，不建立第二事实库、模型循环或自动修改成绩/答案。

改动：新增来源摘要与候选公开契约/读取复核拒绝adapter；learning在收集、留出、采用前重核实际SQLite消息、成功回答、学生绑定及目标objective/criteria（新goal消息持久goalId）；main/preload设置页贯通只读摘要与明确拒绝。候选只保存枚举/hash/版本/指标，原文仍只在既有消息；上云载荷不扩大。已有accepted偏好版本不被读取操作偷偷改写，仍由既有自然撤销/呈现下降规则追加回滚版本。来源失效的未采用候选不得试用/采用；已采用历史可显示来源状态并沿原流程撤销。

兼容：app_settings原namespace无DDL，候选附加sourceVersion/revision/digest字段；旧待采用候选缺可靠来源摘要则superseded、不可推断补造；旧accepted版本保持可读。拒绝由主进程事务、revision和原值CAS保护；来源/权限/冲突/失败在界面可重试，后台只读复核不晋升候选。回滚可关闭新入口，保留候选记录和既有事实/版本；不得恢复对过期候选的自动采用。

验收：原消息/回答/学生绑定/goal来源变化、归档、旧候选、重复/跨会话请求、并发拒绝/采用、失败回答、负面指标、网页指令/推断冒充事实均不得违规采用；有效两样本→独立留出→绑定正反馈→有限采用→下降/教师撤销可回读；所有教师FACT字节/版本保持。先反例后修复，构建/组件/专项/正式Electron与真实DeepSeek实例、冷启、双尺寸浅暗截图分别记录。H08路由shadow与完整H09/H10、原NET/IMG/FILE/公网认证/日常无VPN安装仍保留范围，不因本片接受而关闭。

## 2026-10-17 H08-A 实际结果与继续位置

H08-A LIMITED_ACCEPTED，整个 H08/Goal 仍 ACTIVE。当前唯一冻结构建 1aeb566c07be193aad163e2c761c5f6eb6ccaa4f0439dcfd038b1d34dae15f70（370 files）；44个列入合同的源码指纹在构建期间及验收后相符，不声称未列入的并行教育源码可复现。日常out未替换。

- 真实Pi主任务在既有 preference.observe 后记录策略；app_settings、typed IPC/preload、设置“工作目录与权限→策略选择记录（高级）”、离线回放与显式DeepSeek复核贯通。审计保存失败会报告不可用，主聊天仍正常完成；恢复后继续记录。
- 领域17/17（pi-decisions-n1abEg），真实Electron/DeepSeek11/11（pi-decision-ui-LyKPfC），renderer217/217，TypeScript及隔离原配置编译exit0，mu来源/许可逐字验证通过。正式脚本SHA fd5a623fc90f15a2666c838f6b4c0f5ed2d05e0affc95c8a940f81897c6f09f6 且运行期间未变化；主模型deepseek-flash，renderer errors=0，冷恢复记录/偏好一致。同一冻结构建的legacy通用回归207/207、exit0；它只证明历史教育兼容，不冒充Pi实例。git diff --check exit0，保留既有CRLF提示。
- shadow仅传action/candidate/hasPreferences/preferenceRevision/trial五个标量，无tools，无原话或学生事实。一项真实DeepSeek HTTP200，677ms；一项受控注入401，明确不冒称真实供应商故障。主选择/native文件/偏好历史不被shadow改变。领域另验超时、迟到、CAS竞争、来源变化、非法reasoning/confidence、跨会话和digest篡改；真实桌面另验SQLite损坏、审计写失败/恢复与撤销。
- 修复TvYsX6首次失败：撤销后revision=2但values为空，不能判为仍有偏好。spec v2保存hasPreferences；v1四字段digest/旧选择仍原样回放且不可新复核，不自动迁移重解释。100次离线回放10.2924ms、模型调用0仅是枚举策略基线，不是教学质量、模型性能或长历史指标。
- 已人工查看1366×768/1920×1080浅暗四张设置截图，控件可达，无横向溢出。截图保存为原生150%DPI物理尺寸；未据此接受125%DPI、390窄屏或完整H09。
- 复用固定mu faed8c364323c477399b1dc2ef1d2fa36ce51267 的ABSTAIN/模式/缓存影响/延迟纯合同，保留MIT/source manifest/hash，构建带许可。没有新增依赖、private judge、Jev或第二AgentLoop。早于v2的8ac/52d/681等构建及通过记录只是历史，不替代当前源码证据。

精确报告、命令与边界：apps/desktop/test-results/goal/harness-h08a-20261017-v2/{progress.json,commands.ps1}。下一片H08-B先冻结候选生命周期合同，复用现teacher-preference-state/learning与memory-scope，补来源变更/跨学生或goal失效、replay/eval→有限采用→回滚、自动安全路由shadow；保持FACT/PREFERENCE/INFERENCE不同生命周期。本片不声称其已实现。H07公网认证待专用AppBuilder凭证（见SERVICE_REQUESTS），H09/H10与原NET/IMG/FILE、无VPN、安装、日常profile/教师验收全部OPEN；未提交/推送。

## 2026-10-17 H08-A 交付合同：真实选择审计与受限 shadow 复核

合同已执行，限定结果见顶部；M10/M12。本片贯通当前 Pi 的呈现偏好选择、既有候选与版本/CAS事实 → 持久审计 → typed IPC → 教师可读历史/离线回放 → 使用已配置 DeepSeek 的显式 shadow 复核。H08 的自动策略优化、完整记忆候选/晋升/回滚与跨域路由仍保留原范围，本片不得代表整个 H08 完成。

当前已有 teacher-preference-state/learning 的候选、独立留出、版本、采用和撤销；Pi host 已使用其结果。缺统一 decision spec/version、stateDigest、只读回放与 UI。复用固定 mu faed8c364323c477399b1dc2ef1d2fa36ce51267 的 DecisionMode/CacheImpact/LatencyClass 纯合同，保留 MIT/来源/hash；不安装其 private judge 包、不引入 Jev 或第二 AgentLoop。

修改范围：shared 决策公开契约；main decisions 的 spec/SQLite ledger/DeepSeek shadow adapter/API；production-host 在真实 preference.observe 后记录选择；preload 只暴露按当前会话读取/回放/显式复核；设置权限页增加既有组件组成的只读审计面板。使用现 app_settings 命名空间，无 DDL。记录只含枚举、版本、候选ID和摘要hash，不保存教师原话、学生事实、网页内容、私有推理或密钥。judge 仅选择/ABSTAIN，shadow永不改变实际偏好、权限或验证结果。

兼容/恢复：旧数据库无记录返回空；按 session/run 来源读取，哈希校验、精确字段与CAS更新；重启可读，不重新请求模型。来源/偏好/规则版本变化后拒绝新复核；途中来源变化只保存stale/abstain回执，不采纳迟到结果；其他会话/goal不可冒用。主任务照既有确定性策略执行；审计存储失败需诚实显示，不因可选judge故障让原任务失败。回滚停用审计调用/复核入口，保留历史和现偏好/事实。

验收：真实主进程选择和审计一致；source/digest篡改、过期、跨session/goal、非法选项/隐藏推理/注入文本、judge超时/失败/迟到均不改变实际结果；离线回放可复现并报告原版本/当前来源状态；候选和采用/撤销引用原receipt而非复制事实。type/build、组件、领域反例、正式Electron/DeepSeek操作、冷恢复与双尺寸浅暗视图，保留首失败和精确SHA。原NET/IMG/FILE、无VPN/安装/日常实例不由本片关闭。

## 2026-10-17 H07：受控 MCP 首片限定接受（本线程 Harness 队列）

Master/线程 Goal ACTIVE；教育 DT-05 队列保持独立。H07 首片 LIMITED_ACCEPTED，整体 H07/H08/H09/H10 未完成。最终隔离构建 SHA 23574a1364dc4d12b96fd7f50f6c00f912d1e89635c4eb0441fc63cd84cf5bad，368 files；唯一生产循环仍为 Pi，未接 Codex CLI。

- 已贯通 main MCP runtime → typed IPC/preload → 设置“外部工具（高级）” → 现 app_settings 加密/CAS → Pi tools/attempt/journal/native receipt。显式添加/连接/逐项信任、目录变化撤权、撤销/移除均可操作；未知/矛盾效果阻断，HTTP 和 stdio 反例分开验证。
- 修复真实实例发现的两处生产接缝：customTools 注册漏 active-name allowlist；动态 MCP 名称进入固定 memory fingerprint 导致移除后旧会话配置错误。当前目录权限逐轮读取，固定教育/记忆身份不被工具增删改变。MCP 组接入统一 5 秒期限，单服务或多离线服务不逐个耗尽 Pi 初始化期限；初始化失败释放连接。
- 当前源码专项 28/28、正式 Electron/DeepSeek/Pi 8/8（xiaozhi_deepseek/deepseek-flash）、renderer 217/217、TypeScript 与隔离编译 exit0；已查看 1366×768/1920×1080 浅/暗设置截图。真实 HTTP 为 owned 合成课程服务，stdio 为真实子进程测试服务，不冒称国产公网业务。原生记录、SQLite attempt、加密配置和冷恢复一致；认证失败时内建工具仍可执行；发送成功输入栏清空。
- 通用 legacy Electron 回归 207/207 exit0 属于期限补丁前的冻结构建 1e5e00ace627c8a02dedc25b41a96ca72c5618155d97e21e8af3be955cea4d46，仅作兼容证据；没有把它归为最终构建全产品验收。构建采用原 vite 配置只重定向自有目录，加单独 sync/tsc；未覆盖日常 out 或用户运行窗口。
- 首失败 ypzvPF、4ygUTX 均保留；0vItkc 为测试夹具缺 schemaHash，修正夹具后原断言通过。临时诊断的快照等待提前返回不能计入通过；最终正式脚本按当前用户消息、终态与持久回执核对。
- BoardUI 6 文件的原/适配 hash 全匹配，保留既有复用，不重复复制。Pi MCP 直接使用已锁定 @earendil-works/pi-mcp@1.0.2，MIT、Node>=22.19，本地包382829 bytes；没有新增依赖，Windows打包/安装验收仍OPEN。

证据与命令：apps/desktop/test-results/goal/harness-h07-20261017/{progress.json,commands.ps1}；正式 UI test-results/xiaozhi-agent/pi-mcp-ui-C7WAMc/report.json；专项 test-results/xiaozhi-agent/pi-mcp-boundaries-bxZDQN/report.json。国产百度 AI 搜索 MCP 官方地址无凭证 initialize 实测401，只证明可达；申请与配置清单见 docs/integrations/SERVICE_REQUESTS.md，待账号专用 AppBuilder Key，不伪报 tools/list/call。用户已授权按需要整理服务申请，未创建账号/改远端凭证/扣费。

下一步：H08 先核固定 mu DecisionSpec/ledger 与现偏好候选/CAS、记忆 scope，冻结逐切片合同后做可回放 shadow 决策、候选评估/晋升/回滚；并保留 H07 公网、H09 真实事件 UI、H10 日常 NET/IMG/FILE/无VPN/安装/Office/人工验收全部范围。原测试样例说明书失败不因本片通过而关闭。未提交/推送。


## 2026-10-16 H06 当前源码收尾

H06 上下文/模型能力限定接受。当前证据：压缩上下文6/6、memory epoch17/17、memory scope15/15、模型设置19/19、模型 host lock6/6、模型切换10/10；DeepSeek官方目录探测HTTP200并记录 `deepseek-flash` 支持 text/image 输入、`deepseek-v4-pro` text-only。隔离数据缺少包含 compaction 的现有 native binding，因此 existing-session compaction 未验证；真实日常长历史、1000轮性能、图片用户素材、无VPN和安装仍OPEN。下一步进入H07受控MCP。

## 2026-10-16 H04/H05 当前源码收尾

在当前源码冻结构建 `fed5e0bd3f9b3ea8c562c4e1cb185b16a296c1da379d112aa336697a515bc51c`（368 files）上，H04 工具可靠性专项新增证据：生产注册13/13（47 tools）、教育边界365/365、执行17/17、预检9/9、回执15/15、attempt journal 9/9。旧 `education-boundary-UpdXfG` 失败保留。H04 标记为 **LIMITED_ACCEPTED**，真实日常/无VPN/安装/全部教师业务仍 OPEN。

H05 持久目标/有限续跑专项通过：状态层24/24，真实 Electron/DeepSeek UI 18/18；报告和截图见 `apps/desktop/test-results/goal/harness-h05-20261016/progress.{md,json}`。覆盖目标创建、真实分阶段模型调用、`report_goal_progress`、教师逐项验收、暂停、冷恢复、显式续跑、新 run、结束、普通聊天隔离与终态无重放。H05 标记为 **LIMITED_ACCEPTED**。UI 测试删除了两个不属于完成定义的弱断言：结束旧 run 后不应强制产生额外模型请求；模型请求次数以真实 usage 和持久化结果为准。

下一步按依赖进入 H06；H07/H08/H09 不因本轮通过而自动完成，H10 仍需按测试样例说明书做最终同环境验收。

2026-10-12。用户授权“按照这个方案执行”。总范围为审计F的H01–H10，顺序与完成定义保留；本文件记录实际切片进展，不将计划写成完成。Master仍ACTIVE，教育分支既有改动保留。

## H01 本轮交付合同

- 模块：M10/M12；教师可见结果是可复现的联网/看图/文件测试与可信报告，不以模型声称成功关闭故障。
- 当前能力：已有正式Pi、typed preload、页面操作和A–E说明书；已有fingerprint、gradeAttempt、createSamples、assertIsolatedPiMain。复用这些模块，避免再造测试启动器。缺口：原suite以整套check数量覆盖多个case，部分视觉素材依赖历史目录；当前源码/out/日常配置缺本轮绑定。
- 改动：新增scripts/acceptance/harness-baseline/证据合同/反例/真实三路径实例；测试素材在独占test-results下。现产品DB、IPC、业务源与权限不变。后续H02另冻结纵向合同。
- 测试：绑定source文件hash与out冻结副本、测试脚本hash，真实页面发送，工具回执、独立盲答案、持久化/冷启分别记录；每case明示PASS/FAIL/BLOCKED/UNVERIFIED。报告校验拒绝漏case、假artifact、跨层/跨构建、自评通过与覆盖失败。
- 兼容/恢复：不迁移DB，不写日常数据；新profile可保存本次测试凭证，仍走现加密设置。日常模型/权限只读取公开投影，不导出凭证。复制构建前后比较，变动即拒绝基线。
- 回滚：删除本轮新增测试入口即可；保留失败报告和冻结build，不清理任何用户资料或其他工作产物。
- 完成定义：基线、独立素材、报告校验反例通过，NET-01/NET-02/IMG-04/FILE-01至少有当前实际结果或明确阻塞；缺少用户日常人工/VPN条件标UNVERIFIED，不冒充通过。H01不是修复所有功能的完成定义。
- 本轮暂不做：大规模重写、第二编排器、扩大图片上云范围、自动改变系统VPN、提交/push。

## 依赖清单

| Goal | 当前状态 | 下一步 |
| --- | --- | --- |
| H01 基线和失败样本 | BASELINE_CAPTURED | 3 PASS / 1 FAIL；原故障仍OPEN，详见下方 |
| H02 完成与验证契约 | ACCEPTED（限定验证合同） | 证据见H02-D最终交付 |
| H03 事件与恢复 | ACCEPTED（限定恢复合同） | H03-B完成；日常与全工具可靠性未升格 |
| H04 工具可靠性 | LIMITED_ACCEPTED | 见2026-10-16冻结证据；日常/完整业务保留 |
| H05 任务层级/有限续跑 | IMPLEMENTING（B2） | B1限定通过；任务生产接入与完整逐step门禁见顶部，原TASK-03/04/07仍红 |
| H06 上下文/能力 | LIMITED_ACCEPTED | 模型/记忆scope专项通过；既有长会话等保留 |
| H07 MCP | LIMITED_ACCEPTED首片 | 公网专用凭证/目录/真实调用与日常实例待验 |
| H08 决策/记忆 | DOING | H08-A/B限定范围见顶部证据；继续H08-C有限路由/选中记忆shadow及回放 |
| H09 事件UI | IMPLEMENTING | A/B/C1–C3限定通过，完整状态/证据入口/窄屏/DPI/性能等仍OPEN |
| H10 同环境说明书验收 | PENDING | H07/H08/H09后实施 |

每切片结束写真实证据/失败/未验/下一步，更新Goal四状态、稳定CURRENT和四根协作文档。原源码审计固定证据保留，实施后的SHA变化不覆盖为“审计也已实现”。

## H01 实际结果：基线已固定，产品未验收

构建固定为 `67a3cdc6093d388eff0e384c31faf0f0ce2890f395f841d31f2fc4fb2ffb1d6d` / 348文件；输入、独立盲答案、source清单与冻结build分别保存。不是当前持续变更源码或日常进程的构建等价证明。

- 汇总：`apps/desktop/test-results/acceptance/harness-baseline-Er96Bn/closeout.json`；首次结果 `report.json`，追加失败 `attempts.jsonl`，原前缀字节未变。
- NET-01 / NET-02 / FILE-01：隔离正式Electron C层PASS；网络suite `pi-browser-delivery-h7f8nx`，文件suite `pi-natural-file-VRiclt`。真实页面发送/搜索/正文/浏览器非空截图、随机附件实读/来源/清空输入、持久化及相关失败边界。截图已实际查看。
- IMG-04：FAIL。首次 `pi-public-image-ui-eMCLMK`：盲答案正确，但仅拦global.fetch导致无真实传输证据。补测 `pi-public-image-ui-UGuCig` 同build/同图片：改为同时观察Electron net.fetch，真实HTTP200及图片hash、随机验证码/3红方/2蓝圆/左右、拒绝/冷启/停止共8项通过；停止后新自然请求直接completed、没有新确认卡，suite FAIL。后续utility中止、声明503夹具尚未执行，不计通过。两次失败均保留。没有修改生产行为以绕过失败。
- 报告校验：`node scripts/acceptance/harness-evidence-smoke.mjs`，23项PASS；漏case、伪artifact、自评、exit0空检查、跨层升级、缺来源与畸形报告均拒绝。这只证明校验器，不证明用户功能通过。
- 日常只读：`node scripts/acceptance/harness-daily-readback.mjs` → `harness-daily-AqHqWN/report.json`。默认路径DB保存模型deepseek-flash、凭证存在但不解密，web无覆盖记录（代码默认enabled/auto）；日常PID234140仍运行。自定义环境数据根、内存配置、凭证是否同一份、加载buildSHA未知，因此D/E未验、原NET/IMG反馈不关闭。
- 本片未改生产源、未构建应用、未跑组件/全量smoke；复用已有冻结build运行实例。当前out已被教育分支更新，不借用其build结果为本片背书。新测试脚本无新依赖、无DB迁移、无用户数据写入、无提交。

下一切片H02：先冻结Criterion/Evidence/Verification接口和确定性验证器，贯通宿主→typed事件→SQLite metadata→冷启投影→页面。将本次“completed但未执行所需图片操作”作为反例；无验收标准/旧completed必须unknown，图片received不证明识别正确。H03及后续仍PENDING。

## 2026-10-13 H02-A交付合同（修改前冻结）

- 模块M10/M12。教师可见结果：每轮执行终态与任务核验分开；失败工具、缺结果标准、图片仅送达、旧历史不显示为已核验。普通聊天可结束，不等待不存在的核验标准。
- 当前缺口：生产host以正常模型终态记succeeded，工具失败后正常文本不改变该状态；旧completed无核验字段。typed事件/Office投影/SQLite metadata已有单一入口，可增量复用，不能再建模型loop。
- 本片新增shared/xiaozhi-verification.ts与main/xiaozhi-agent/verification下的纯确定性验证器、实际执行观察adapter；修改host终态metadata与typed事件、投影reader和OfficeConversation最小结果卡。SQLite沿既有metadata，旧记录读unknown；不改表、教师事实、授权、模型/API配置或Goal事务。
- Verifier只接受主进程登记的同run工具receipt及独立读回：callId/taskId/digest/版本/时效全部绑定；原文/盲答案不进公开UI。真实任务尚无可机器判定标准时必须unknown/needs_human。现Goal用户criteria文本只表示需教师核对，不能用模型文本或received自动判pass。正向读回准则的生产注册与完整web/image/file质量adapter在H02后续切片完成，不把本片说成完整H02。
- 验收：工具失败但模型文字正常、缺criteria、伪callId/hash、旧/跨run证据、图片received但答案错误、有效替代来源满足同一标准的定向反例；正式页面真实provider文件读取和实际失败任务，UI/metadata/冷启一致；旧记录unknown。build、renderer组件、相关smoke及git diff --check各自记录，不能借用教育分支报告。
- 兼容/恢复：新字段可选，校验失败降unknown，不能回写旧历史伪通过；持久化失败仍走现configuration终态。H03 journal未交付前不声称过程事件已durable。每次备份修改前文件和旧out，自有test-results运行隔离build；不重启日常窗口。
- 回滚：恢复本片backup或撤下verification adapter，但失败不退回已核验文案；保留metadata和首次失败。无新依赖、迁移、远端写入、私密图片上传或subagent。
- 停止与并行保护：既有教育dirty修改保留；编辑前后核hash，只对精确交付位置打补丁，不覆盖整文件。跨片改动无法归因时先保留现场，不推进未知覆盖。

## 2026-10-13 H02-A实际交付：限定接受，完整H02继续

交付`xiaozhi.verification.v1`、确定性Verifier、真实工具回执观察器，以及host→typed事件→SQLite metadata→冷启→Office结果提示。Pi仍为唯一模型循环。没有新增依赖、表或IPC通道；没有重启日常窗口或改动日常凭证。

- 正常执行结束但没有独立标准：`unknown`，页面“结果未核验”。工具失败后模型正常回复：`partial/blocked`。图片received或Goal自然语言标准：需人工核对，不自动pass。旧/畸形/跨run核验记录降为unknown，历史正文保留。
- 正向Verifier仅接受主进程登记且独立读回匹配的同run/callId/digest/版本/时效；支持同标准的有效替代证据。该正向接口尚未注册实际生产质量adapter；本片生产观察器不产生verified，不能宣称完整H02通过。
- 主进程的`succeeded`仍指执行终态，不指任务结果正确。finalize文案已改为“本轮执行已结束 · [核验状态]”；操作计数只统计实际工具，不把宿主/模型错误额外编成失败工具。H03事务journal与中途崩溃对账未交付。

### 实际证据

台账：`apps/desktop/test-results/goal/harness-h02-20261013/progress.json`、`commands.ps1`。HEAD `d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63`，工作区dirty，教育分支保持；不将整个dirty diff归为本片。

| 检查 | 实际结果 | 证据与范围 |
| --- | --- | --- |
| build/type | 最终exit0 | 冻结`build-final`，SHA `6d3ff29864796821e7581ad7936cc840383aa86560eb0fdcb12b63e2feece7ff` / 348；source-final与当前H02文件hash一致 |
| renderer组件 | 217 / 217 | 最终代码；SSR组件门禁，不是日常Electron验收 |
| 确定性核验反例 | 24 / 24 | `pi-verification-boundaries-FABuPY`；伪/旧/异任务/错图/缺标准/有效替代/工具失败/停止与真实计数 |
| 核验卡SSR | 5 / 5 | `pi-verification-renderer-ZzFvR1`；运行中不显示、旧记录/失败/待人工/畸形记录 |
| 正式Pi真实DeepSeek UI | 11 / 11，0 renderer错误 | `pi-verification-ui-9NCk8p`，最终冻结build；新会话真实聊天、随机附件实读、真实invalid浏览工具失败、live/DB一致、浅暗1366/1920、冷启原native字节不变、旧记录unknown。截图实际查看 |
| 旧教育兼容smoke | 207 / 207，exit0 | `node scripts/electron-smoke.mjs`，先前冻结`build` SHA `89e5404b…`；后续只改核验错误计数/文案，最终Pi专项另实跑。此207不冒充最终build、Pi/真实provider或日常验收 |
| git diff --check | exit0 | 收尾检查；CRLF提示不是检查失败 |

首次失败保留：新UI脚本`pi-verification-ui-HZZulD`在第1项后误把终态事件kind写作completed，正式协议实际是kind=status/status=completed；修测试后同冻结89e5404b构建`HzrW7u`通过11项，再在最终6d3ff298构建`9NCk8p`通过11项。首次静态TS import未先加载registerHooks、第一次构建TS18046也记录为执行失败，不计通过。本轮renderer并行时出现既有24678端口提示，但最终217项通过；不改用户端口或结束其他进程。

### 下一步（H02-B，之后才进入H03）

1. 冻结实际任务Criterion声明与验证范围，沿现工具/domain adapter登记来源；自然语言或模型计划不直接变成pass。
2. 为web正文/公开图交付与独立答案/文件及SQLite版本读回接生产Verifier；图形正确性无独立标准时保留needs_human，替代来源可满足同一标准。
3. 用现NET-01/IMG-04/FILE-01原案例和失败反例，核验UI/DB/重启一致；特别补原IMG停止后新请求未执行的问题，不用本片状态卡替代修复。

H02仍DOING、H03–H10 PENDING、Master未完成。H01原IMG失败与D日常/E无VPN、安装、WPS未验保持；本轮没有关闭用户原反馈。日常运行进程尚未加载本次新build，看到新提示须正常重启到新版本后另做D层复测。

## H02-B交付合同（2026-10-13，修改前冻结）

- M10/M12，接实际结果登记与独立读回。Pi工具终态提供main私有回调，主进程捕获同run/callId、成功正文及真实来源版本；不能接renderer或模型自造receipt。复用既有Hana/Pi工具、附件importer、SQLite状态和native JSONL，不新建编排器。
- 新增verification/result-readback.ts；沿既有Verifier、run observer、production-host与typed verification metadata接线。公开check仅固定范围/状态/证据引用，不公开正文、SDK图像或隐私路径。网页核对本轮实际脱敏正文与native持久记录；附件同时校验当前SQLite版本/授权、本地副本与相同范围脱敏实读；公开图片独立核对本轮真实送达状态、native工具图像与当前附件，不把received变成图义正确。
- 已核对的来源完整性标准可passed，同时增加答案/图义需人工check；任务状态依然needs_human或unknown/partial/blocked，避免把“正文保存一致”升级为整个请求正确。无工具/无标准仍unknown，旧v1保持兼容；工具失败不得被正向读回覆盖。missing/changed/跨run/不同callId/旧native字节/缺图片送达均不通过。
- 本片无DDL、依赖、IPC新增或权限改变。数据仍在现metadata/native，H03 journal之后实施。保存final checks并冷启同投影；中途失败不重播工具/上传。读回有字节/条目上限与超时，失败保留unknown/failed，不阻塞无限等候。
- 修改前备份与freeze out保存在独占harness-h02b-20261013；教育dirty精确patch、同步12份文档时仅改本Harness标记。真实DeepSeek/正式Electron按NET/FILE/IMG原入口复测，有首次失败保留，声明503夹具分开；旧教育兼容只作兼容证据，日常/VPN未验不升级。
- 完成定义：web/附件/图像范围的确定性正负读回、host→事件→UI→metadata→冷启一致、必要build/renderer/专项与diff检查有报告；若原IMG停止后新请求仍未执行，明确剩余并沿原责任修复，不用新状态卡关闭反馈。整个H02/H01–H10不随本片缩小。

## 2026-10-13 H02-B实际交付：来源完整性与答案核对分开

主进程接Pi SDK真实工具结果的私有回调；新增`verification/result-readback.ts`，核对本轮native JSONL尾部及本地当前版本/授权。网页只核对真实已读正文与本轮保存记录；附件复用原读取/OCR批准/importer及SQLite授权版本，授权文本复用Hana读回；公开图核对本轮received、当前附件和native图像内容。失败、缺失、重复、不同callId、旧native或变更来源不能pass。主进程只登记限定范围，不把模型文字变成验收标准。

页面可展开“查看核对范围”。来源完整性通过仍保留独立回答人工check，整轮是needs_human；已有工具失败保留partial/blocked，普通聊天没有标准是unknown。现v1 metadata/typed事件/冷启复用，无依赖、DDL、IPC或第二模型循环。

### 原IMG停止后新请求修复

H01 `UGuCig`原native记录证实：前一轮公开图工具aborted后，教师重新发同样查看请求，模型只说“本轮被中止”，没有新调用。补明确轮次规则：旧停止/拒绝不是永久禁止，新请求需查当前附件版本并发起新用途卡，不能复用旧批准或旧答案。当前真实DeepSeek原合成图完成独立的新确认、批准前零图像发送、批准后实际HTTP200及图像、盲码/3红方/2蓝圆/左右吻合；停止的旧确认仍不可恢复。没有强制工具路由、自动批准或额外模型loop。C层修复有证据，原D日常反馈未关闭。

### 证据与实际范围

台账：`apps/desktop/test-results/goal/harness-h02b-20261013/progress.json`与`commands.ps1`。修改前五文件与out已备份；当前prod source核hash一致；12份状态文档仅编辑本Harness标记，教育块外字节hash一致。HEAD/dirty背景沿H02-A，未提交。

| 检查 | 当前结果 | 证据 |
| --- | --- | --- |
| 最终build/type | exit0，348文件 | `build-final` SHA `ca8bd829ca38e7bb36331fdad88af0357a477a2d3e533a9d9e4a0ad8ce6fe117`；构建前后及各正式报告一致 |
| renderer组件 | 217/217 | 最终代码 |
| 原Verifier反例 | 24/24 | `pi-verification-boundaries-jLEq1L` |
| 实际读回边界 | 20/20 | `pi-result-readback-OMXwOA`：当前附件/文件版本、授权、native重复/异call/截断、缺图送达、旧工具失败保持等 |
| 核验卡SSR | 6/6 | `pi-verification-renderer-rDOalJ`；范围通过与回答待核对分开 |
| 正式Pi UI/真实DeepSeek | 13/13 | `pi-verification-ui-bvcZ6R`：真实附件/官网正文/工具失败、浅暗双尺寸、DB/事件/冷启与旧历史unknown |
| 原公开图正式实例 | 15/15 | `pi-public-image-ui-ryMHoe`；新确认、真实图传输/盲答案、拒绝/停止/冷启/重新请求/utility停止。供应商503是明确的传输夹具，不冒充真实供应商宕机 |
| 自然文件/Word | 16/16 | `pi-natural-file-9ykQ0P`：授权实读核验、越权拒绝、diff拒绝/确认、真实DOCX、SQLite hash/大小、独立python-docx全文/表格、双尺寸预览、冷启不重放。不是新生产Word质量adapter或本轮WPS验收 |
| 冷读核对范围视图 | 3+4+4 | `pi-readback-view-FQQspO/QmTJt2/LiOd74`；复用上述真实记录，metadata/native字节不变、浅1366/暗1920，等待实际窗口尺寸后将末项滚入阅读区，核对项可达；截图已查看 |
| 旧教育兼容smoke | exit0 | 同最终build，`node scripts/electron-smoke.mjs`执行session54311。原诊断副本在台账；不把legacy非provider smoke当Pi或生产验收，此处不另外推算断言总数 |
| 收尾source/格式 | 12文件hash一致、diff exit0 | `source-closeout.json`绑定当前本片生产/专项脚本；全工作区`git diff --check`通过，既有教育dirty保留 |

前一冻结`4241326781cc0b1289b69a0ada39c99310b3b118a784d59139abc658dc217062`上UI13与图片14报告`o2cej3/wy556d`保留，不能冒充最终build。首次TS unknown-details和Object.hasOwn编译错误已修；首次cold-view `0G6Dek/UnKsDw`误选同run用户metadata而非assistant，均0项接受，修测试角色条件后复测，未放宽产品验证。之前H01/H02-A失败原记录全部保留。

### 尚未完成与下一步

1. **联网未全部解决**：本轮NET-01有一次`office_web_search`网络失败，随后直接读取真实官网正文，三个独立日期正确、正文保存一致，但整轮保留partial。稍后同main源码网络adapter请求AnySearch HTTP200是低层诊断，不替代先前正式搜索失败。H04再补只读重试/错误分类；NET-02当前自然浏览器与D日常仍需复测。
2. H02-C先冻结正式保存文件/Office产物与教育SQLite事实的结果标准和主进程读回adapter。当前附件adapter已核SQLite附件版本/授权，不能把它说成教学事实/正式产物质量全覆盖；Word独立测试不是生产Verifier上线。
3. 原公开图C原样例修复已验证；用户日常相同模型、保存配置、旧会话与原输入未重验。私密学生图仍走本地OCR校正，公开图仍逐轮教师确认。
4. 完整H02仍DOING，之后才进入H03 journal；H03–H10未完成，Master未完成。没有重启日常窗口、改VPN/DNS/凭证、上传真实学生图或提交。D/E、安装、WPS不加入本片通过分母。
## H02-C1交付合同（2026-10-14，修改前冻结）

- M10/M12：先交付正式文本保存与Office产物的本轮结果标准。复用现Pi工具、教师确认账本、文件授权和Office发布SQLite事实；本轮不编辑并行教育题目质量实现。C2再接教育确认题目事实，完整H02完成定义不缩小。
- 新增main私有effect-readback，接既有result-readback/production-host；office_create_text、office_edit_text、office_create_document的成功结果必须绑定同session/run/call的实际已应用/已保存账本版本。核验独立再读当前账本、磁盘字节及Office发布事实，比较教师最终确认版本，不以模型候选或success字段当标准。
- 条件包括当前授权、文件路径与版本、SHA/大小、Office artifact所有者/状态/发布内容。缺失、撤销授权、文件变更、账本变更、重复/异call、未确认/已撤销、发布事实不一致不得pass。读回错误/超时保持unknown/partial；旧工具失败保持。回答与教学正确性仍单独人工核对。
- 无DDL、新IPC、依赖、模型循环或上云规则变更；用现typed verification event/metadata/UI/冷启。私有字节/草稿/路径不进入公开check或模型。只读核验不调用写入、undo、确认或不确定结果恢复。
- 修改前备份生产文件及out于test-results/goal/harness-h02c-20261014；保留原失败与教育dirty。只更新12份状态文档的本Harness标记，其他字节保持。
- 验收：确定性域读回反例、原结果/Verifier/卡测试、build/renderer门禁，正式Pi真实DeepSeek自然文件/Word原入口及冷读同记录；独立文件/SQLite readback和截图，不以build/模型自评代替。日常D、无VPN/WPS/安装E及未跑范围保持未验。

## 2026-10-14 H02-C1实际交付：教师确认产物保存一致性

文本创建/编辑与Office生成接同session/run/call教师最终确认账本，独立再读当前授权、磁盘及Office SQLite发布记录；缺失/变更/撤回/不一致不通过，答案仍人工。核验卡显示核验时间，之后变化需另核，不持续监控。

最终build 848d8474a46fba8e0f47e5d4d023160820156f237fb90f4cc8697a0b661bcad2 /348；build/type exit0，组件217/217，effect34/34、原读回20/20、Verifier24/24、卡9/9、报告校验26/26、四周要求14/14；正式DeepSeek文件Word 20/20，冷读范围 6/6。旧legacy207/207只在时间提示前构建，main/preload字节与最终相同，不能冒充最终renderer/Pi验收。

正式模型实际ID为deepseek-flash。main私有expected ledger版本不接受renderer/模型自造hash；native同call回执、当前文件SHA/大小、Office发布所有者/状态/标题/正文/格式等需一致。readonly verifier不执行恢复/undo/确认。公开check不包含文件正文、私有路径或草稿。Word实际内容另由独立python-docx比对教师审核的全部段落/表格；不将此测试parser说成生产教学正确性judge。

首次失败：测试不得强制合法单/多表布局；要求逐周覆盖与独立全文/表格解析。成功字段必须最后写、catch置false；report.error即使exit0/success true也拒绝。修改后旧实读源失效不得为通过而升级，saved scope与整轮partial分开。首次失败与窗口自动化错误均保留。 fFtayM为旧来源失效但测试错误强求整轮needs_human；dl7fOX为四个合法一周表被误要求第一表四行；rYy1g5为SSR dateTime大小写断言失败且报告过早success true，修测试与报告grader，不覆盖三原报告。前一5264af20构建的u75lcT/SarUtP旁证保留；最终848d8474a46fba8e0f47e5d4d023160820156f237fb90f4cc8697a0b661bcad2构建报告为pi-natural-file-U0f3g6/pi-readback-view-tgphOC。

台账、精确命令、source-closeout十四文件hash与12份块外字节保持见test-results/goal/harness-h02c-20261014。旧legacy207/207只证明时间提示前兼容，main/preload与最终相同；最终renderer由正式Pi/冷读与组件验证。日常窗口没有重启，原网络搜索失败、NET/IMG日常、无VPN、安装/WPS保持未验。

下一步：H02-C2冻结教育确认题目事实的同run/call读回，不改题库事实、不运行确认/重新生成；完成H02后才进入H03持久事件恢复。H03–H10未完成，Master与本Goal保持ACTIVE。

## H02-C2 · 教育确认事实独立读回（2026-10-14，合同冻结）

- 模块 M10/M12，复用 M05 教师确认事务与题目版本校验。当前教育候选成功回执未绑定当前 SQLite 保存事实；前端已有核验卡/typed snapshot/持久化，不新增 IPC。
- 只读适配单次 education_propose_questions：同 session/run/call 的唯一 confirmed 账本、最终教师版本、有效 quality/谱系/来源及当前 saved question 版本。不给教学正确性自动通过；答案仍 needs_human。
- 拟增 repository 主进程只读快照与 verification/education-readback.ts；接现 result-readback/production-host；固定共享核验标签；新增独立边界及真实 Pi 教师确认/冷启实例脚本。保留并行教育候选/数学业务原改动。
- 不新增表/迁移/依赖，不改 teacher decision、Pi 循环、原图上传或学生隐私；失败、撤回、旧调用、缺质量、来源/事实变化不得通过。只核验时间点，之后修改需另核。关闭 adapter 可回滚，已保存事实不重放。
- 完成证据：build、组件、本轮反例（真实 SQLite/domain）、冻结 build 的真实 DeepSeek UI 起草→教师编辑确认→题目/账本读回→核验范围→冷启一致，浅暗 1366/1920；保留首次失败。完整 H02 及全 Goal 未完成，NET 原反馈/D/E 不关闭。
- 合同/源码前态见 apps/desktop/test-results/goal/harness-h02c2-20261014/before.json；C1 证据保持原状。

## 2026-10-14 H02-C2实际交付（限定接受）

单次 education_propose_questions 接同 session/run/call 唯一确认账本，复用现域 quality/谱系/来源与 saved question 版本校验，并逐字比对教师最终题面、答案、解析及属性；仅主进程私有摘要进入 Verifier，旧/缺/变更事实不得通过。答案教学正确性仍 needs_human；有失败首稿的同轮修复，保存项可 passed、整轮保留 partial。核验是时间点，冷启只恢复原结论，后续变化需另核。

最终 build 7b6d6b8d583ae2d9f318384899cdfd8436e28ca1fea6a60fd10061453e435d26 /348；build/type exit0，组件独占重跑217/217，教育反例29/29、保存effect34/34、source20/20、Verifier24/24、卡10/10；真实 DeepSeek Pi 教师编辑/确认/拒绝/冷启6/6，真实条件不足→修复→确认→冷启3/3、其只读核验追查2/2；同冻结 build 旧兼容207/207（不冒充Pi/provider/daily）。

- 正式新题实例：pi-education-readback-ui-lZ0Usb，run_da567ba0-adf8-44a6-94c4-ce26cd9725d0，call_00_rJPOtOx3BcxXVKZiJkOu4110，实际模型 deepseek-flash。旧草稿与教师最终题名/解析有差异；确认前零事实、确认后只保存最终版本、拒绝零新增。UI/metadata均 saved_questions passed + answer needs_human，冷启两次启动native字节/事实/核验时间完全一致。
- 修复实例：education-journey-D1G60R 复用当前线性条件真实Pi链，首稿缺电压返回隔离，教师明确220V后同run修复并批准。只读追查 pi-education-repair-readback-YyNRTz：修复题保存scope passed，首稿失败仍保留在native及operations，整轮partial，conditionsVerified=false。没有证明自然语言翻译或整题正确。
- 教育反例 pi-education-readback-EorTUU 29项，包括候选未确认、当前内容/源/归属/状态改变、跨调用、重复账本、缺质量/适配器、失败receipt、冷读只读；即使重新计算账本hash也不能掩盖题目与教师最终内容不同。文件effect uHldHJ 34项、source na1POn 20项、Verifier y8iSEl 24项、核验卡 nQ6RsE 10项。
- 首次 boundary 入口因静态TS import先于扩展hooks而加载失败，无结果报告，不计通过；改为动态imports后第一次28项及最终29项均保留。第一次组件并行有24678提示，独占重跑217/217无该提示。未终止用户进程或修改端口。
- 浅暗1366/1920教师确认与核验卡/冷读6图，已实际查看3图。截图的拒绝轮仍有英文模型commentary，H09待处理，不扩称界面全部一致。真实UI和修复报告由同 gradeAttempt 验证；下层只读2项不冒充UI/provider。
- 兼容 legacy同冻结build exit0/207项，只证明旧教育入口；无Pi/真实API/daily提升。新主进程只读方法之外 education repository与本轮前态完整一致，12份状态doc块外字节保持，10文件source-closeout已记录。没有新表/迁移/依赖/IPC、没有改教师事务/原图外发/凭证/网络环境或提交。

H02-C2 LIMITED_ACCEPTED；完整 H02 DOING，H03–H10 PENDING，Master/当前 Goal ACTIVE。下一步 H02 完成合同逐项复审与当前同冻结版本 NET-01/IMG-04/FILE-01 汇合验收，必要缺口先补，之后才进入 H03 journal。原联网反馈、日常 D/无VPN/安装/WPS E 仍 OPEN。 证据与精确命令见 docs/goal/HARNESS_EXECUTION.md 及 apps/desktop/test-results/goal/harness-h02c2-20261014/progress.json。

## H02-D 最终合同复审与同版本汇合验收（2026-10-14，修改前冻结）

- 模块 M10/M12。本轮基于 C2 真实代码，逐项复核 H02 schema、读回adapter、Verifier、readyForReview、失败/旧历史/重启呈现和反例。当前发现共享 metadata 校验接受 verified+failed>0 的矛盾记录，已 source probe 留证；不得升级执行失败。
- 精确修改 shared/xiaozhi-verification.ts 单条一致性规则、Verifier边界、正式UI的独占坏metadata夹具、harness-baseline报告error防线与相关测试。原教育事务/Pi/IPC/SQLite表/上传边界不变；不新增依赖。
- 契约固定：新读取矛盾记录降unknown，原正文与native不写；只在独占合成DB中制造坏record。首次失败保留。冻结新build后，现 NET-01/NET-02/IMG-04/FILE-01 原输入在同版本检查功能与核验状态，两层分开，不因Verifier正确关闭功能失败。
- 必须跑 build/组件、定向矛盾反例、正式NET/FILE与IMG确认/拒绝/停止/盲答案、旧completed和坏metadata冷启。旧兼容C2对新共享schema需核其影响，再按必要门禁记录；所有源码/脚本/build摘要与结论一致。
- H02 完成合同逐项给 evidence/scope/missing；只在合同达标时标H02完成，再冻结H03。H04工具网络可靠性、H10日常/无VPN/安装/WPS仍按原依赖未完成。回滚仅移除此规则/测试delta，不能恢复失败也通过或重放effects。

### H02-D 失败后追加的限定修复合同

首轮同版本 NET/IMG suites失败且FILE通过，三报告保留。IMG停止检查改用真实 utility 子进程 stdout 事件，停止/退出/零传输断言不降低；NET仅新增失效前后窗口诊断，不改输入或通过标准。原生browser诊断对当前系统DNS硬期待dns_blocked失败，作为环境假设反例，不称功能通过。旧兼容取消存在 checkpoint已写、pending map未登记的竞态；只在legacy test-runtime绑定注册Promise，取消等注册结束再resolve，不改Pi、教师事实表或安全权限。该文件当前无其他脏改动，已备份。完成后新冻结build，重复关键实例与同一取消路径，所有首次失败保留。

H02-D 验收契约澄清：官方来源允许教育部真实子域（本次hudong.moe.gov.cn），伪后缀/用户信息域不允许；保持实读正文和日期校验。当前另一个构建在复制后改变out，TcJyOW严格拒绝并记4项UNVERIFIED；baseline允许显式已冻结test-results build并再次复制校验，不修改共享out。新选定55281726449eff789ca59a550f8f5e870bd62062ad121a4e11fa7fd37d71a61d/348，与当时source快照独立记录，不宣称日常进程或不断变更source同版。

## 2026-10-14 H02-D最终交付与H02合同接受

共享核验记录verified且failed>0即拒绝，当前投影降unknown，不改旧正文/native。独立读回只核对声明范围，received不等于答图正确、保存一致不等于教学正确；教师最终判断保持。H02-C1/C2已接受读回源码除这条schema防线外全部与前证据摘要一致。

H02 完成与验证契约限定接受，Master/本Goal ACTIVE；H03下一步，H04–H10未完成。冻结 build 55281726449eff789ca59a550f8f5e870bd62062ad121a4e11fa7fd37d71a61d/348，build/type exit0、组件217/217、Verifier25/25、报告26/26、核验卡10/10、持续目标边界24/24；正式Pi核验/冷启14/14；同冻结build NET-01/NET-02/IMG-04/FILE-01四例PASS（network20、image15、file19项），旧兼容207/207仅历史test runtime。baseline整体NOT_ACCEPTED仍保留日常D/无VPN安装E未验。原用户NET/IMG故障未关闭。

真实官方hudong子域不能被www-only断言误拒；图片utility停止从真实子进程stdout观察，退出与零传输断言保留。取消需等checkpoint注册完整，避免DB已发布而pending map缺失。共享out可被并行构建改变，严格拒绝漂移并显式选冻结test-results副本；首次失败/旧报告不覆盖。最早失败页未出现尚无稳定原因，留H04问题，后续成功不等于修复。

| H02要求 | 证据与实际范围 |
| --- | --- |
| Criterion/Evidence/Verification；确定性Verifier | verifier uZjGXX 25反例；主进程注册identity/version/digest，正常答复无criteria unknown |
| web/image/file/SQLite真实读回 | 同552冻结版正式核验14、NET/IMG/FILE四例；C1effect34/C2教育29为已接受限定保存读回，相关source摘要保持，仅schema加强 |
| readyForReview仅请求检查 | goal-state tbyyJF 24：模型不能写completed，review_required需教师逐项accept；下层确定性，不冒充provider |
| 失败/伪call/hash/跨run/过期/无标准/图形答错不通过 | verifier25；最终IMG盲码3红2蓝/左右真实200，拒绝/停止零传输，503声明fixture；答案仍needs_human |
| 有效替代来源 | Verifier替代读回反例；实际hudong官方正文实读，日期严格保持，伪域名拒绝 |
| UI/DB/冷启范围一致；旧completed unknown | 5x1CLP 14：normal unknown、receipt scope passed、failure blocked、旧缺字段/矛盾metadata unknown，原正文/native不改，4次cold启动无重放 |
| 报告不能自评或漂移通过 | 共同gradeAttempt、26反例、w3cDKt四case及artifact SHA；TcJyOW构建变化拒绝；显式build越界拒绝 |

H02 ACCEPTED限上述验证合同，不是AI全部完成。H03下一步冻结事件journal：当前publicEvent sequence仅内存、UI仅丢弃旧seq、无持久补拉；需状态/event/outbox事务、generation fence、native对账、typed listEvents与cursor补拉，不重放工具/审批。此处仅说明下一项，尚未实现H03。

保护：自有8项source摘要记录；C2九项非schema源完全一致。12份doc修改前后块外字节一致；本轮前态之后并行主线/阅读块改变，保留最新内容而不还原旧doc。共享out漂移不再被验收使用。正式Pi未载legacy；旧207首个out运行因并行变化不能作同版证据，最终explicit frozen 207/207才计兼容。

精确命令见本片commands.ps1。baseline设计native exit2表示整体NOT_ACCEPTED；本次无显式exit的PowerShell工具观察exit1，与微实验node exit2→PowerShell host1一致，不改为exit0。三个子suite实际exit0及严格四casePASS仅C旁证。最早浏览器失败页未出现保持H04开放；原NET/IMG日常D、无VPN/安装/WPS E保持OPEN。证据、精确命令与首次失败见 docs/goal/HARNESS_EXECUTION.md 和 apps/desktop/test-results/goal/harness-h02d-20261014/progress.json。未修改凭证、系统代理/DNS、真实学生上传或教师确认事务，没有提交/push。
# H03-A · 2026-10-14 持久事件纵向切片合同

本轮推进 H03（M01/M10/M12），H02 已在所声明的隔离正式实例范围验收；H03 整体仍 DOING。当前 publicEvent 的序号、过程投影只在内存，publicItems 到结束才写入，页面没有补拉协议。

- 教师可见结果：已提交过程先保存再通知；缺号事件从本地补拉；冷启动读取同一投影；写入失败立即阻止下一次模型/工具交付，并显示未能保存，不能显示成功。
- 改动：新增 events/journal.ts、events/publisher.ts 与 shared/xiaozhi-events.ts；新增 SQLite owner/run/event/outbox 表；session-state/db 只接事务入口；production-host 接事件发布屏障；pi-session 只接主进程保存屏障；typed IPC/preload 与 PiEducationWorkspace 接游标与补拉。Pi 仍是唯一循环，无新依赖。
- 事务：每次提交在同一 SQLite BEGIN IMMEDIATE 内更新投影、追加事件、写 outbox；session generation + run revision 检查过期所有者。通知成功不代表 renderer 已收到，补拉可重复读取，不宣称 exactly-once 通知。
- 兼容：journal 有记录时成为过程投影读源，旧 publicItems 仅兼容读取；本片保留其原有终态兼容写，删除条件为 H03 全部恢复/旧库验收通过。不回填假历史，不重放工具，不恢复审批授权。仅加表，保留原事实/原生记录，旧读入口仍可使用；撤回接线保留已提交表。
- 验证：新旧库增量迁移、事务回滚、重复冲突、跨会话/过期 owner、缺号补拉、保存失败不继续交付的反例；构建与 renderer 门禁；同一冻结构建真实 Electron/Pi 实例、页面恢复、SQLite readback。失败保留在 test-results/goal/harness-h03a-20261014，provider 例不冒充日常现场。
- 本片不宣称 H03 完成：nativeEntryId 对账、实际主进程强退后的工具效果回执、终态提交崩溃窗口与完整迁移回滚演练，留 H03-B；网络/图片原日常失败和 H04–H10 继续 OPEN。

### H03-A 汇合失败修复补充合同

原自然 FILE suite 保持严格判定：GsMrpu 在必要补充问题已入库/公开事件尚未提交时读到 running，已在 snapshot 的领域读取后补 publisher.flush，不修改断言。oyhDPh 的 FILE-04 模型把要求留空的负责人字段写成下划线并附句号；尚未教师批准，未写正式文件，原失败保留。增加 M10/M09 的小范围草稿前置校验：仅当前 main 持有的教师原始请求明确要求负责人留空时，拒绝该字段非空的模型草稿，返回尚未审阅/尚未写入及修正指引；不静默改正文，不限制教师之后本地编辑。只接 Office coordinator 私有 callback 和独立 pure validator；不改 schema/表/teacher confirmation/service 写入事务、不接第二循环。反例验证负向要求/非负责人列/人名/下划线/句号、无草稿与教师修改仍走原链；原 FILE-04 自然文案重测至真实确认/Word独立读回，不拿 FILE-01 的先前成功覆盖本次整套失败。
## H03-A 最终限定交付与下一片合同（2026-10-14）

最终冻结build 6d7d1e3da2c78f5cc7f56b69eef906e89e0b3683f50d4abd43a7fc10b192cd2d/351。共享out与并行教育分支继续可能变化；全部最终正式实例和legacy smoke使用上述冻结副本，源码摘要为编译后独立记录，不声称全构建可复现或日常已升级。

| 门禁 | 真实结果与范围 |
| --- | --- |
| build/type、组件 | build-retry-fence.log完整编译；组件217/217 exit0 |
| 事务/owner/游标/缺号/尾部通知反例 | pi-event-journal-tN8EI3 19/19 exit0 |
| 明确要求负责人留空的模型草稿 | office-blank-fields-50ysDw 11/11 exit0，不自动改内容/绕过教师审阅 |
| 正式Pi/真实DeepSeek过程保存及失败/重启 | pi-event-journal-ui-h6nLuP 11/11 exit0；主动丢工具/全部终态通知仍补拉；SQLite真拒写后零成功工具交付；warm继续拒绝且零新run/native变动 |
| H02真实旧DB副本迁移 | pi-event-journal-old-sFJtC5 6/6 exit0；历史消息/原生字节保持，新run单独journal，二次启动幂等 |
| 同版原自然联网/图片/文件 | harness-baseline-Ak5s8m NET-01、NET-02、IMG-04、FILE-01四PASS；network20/image13/file15，三suite exit0；整体NOT_ACCEPTED/native exit2保留人工D/E边界 |
| 桌面最低smoke门禁 | explicit frozen node scripts/electron-smoke.mjs 207/207 exit0，legacy测试runtime，不能冒充正式Pi；32PNG已复制owned目录防共享覆盖 |
| 文档与证据 | root4/goal4/CURRENT4只替换本owned块，块外即时字节相同；closeout.json、commands-final.ps1、源/报告/log SHA读回；最新保存失败PNG已查看 |

OH27yd/GsMrpu/oyhDPh首次失败保持原报告；PGeDKZ只有三PASS/文件UNVERIFIED且无终结/活跃进程，未猜退出原因，不当成功。H03-A LIMITED_ACCEPTED，H03 DOING，Master/Goal ACTIVE。原用户日常NET/IMG问题、H04–H10、无VPN/安装/WPS与完整回滚仍OPEN。未改真实学生数据/凭证/系统代理，无提交push。

### H03-B 修改前冻结：原生对账、效果回执与真实崩溃

1. 模块M01/M10/M12。教师可见结果：已发生操作在崩溃后仍有可核对的回执；页面恢复已保存的过程，未知结果显示需核对，不再次执行、不重新授予旧批准。
2. 当前缺口：H03-A已提交公开event/journal/outbox，但当前run原生JSONL起始位置仍内存绑定；没有durable nativeEntryId和逐call恢复回执。H02 finish读回仅在正常收尾时核已声明范围，不能代替进程死亡窗口。Pi1.0.2公开message_end先发监听再appendMessage，因此不得把监听时leafId当同一结果已保存。
3. 优先复用：现bindNativeResultReadback的主进程受限尾部读取、effect-readback的教师确认产物版本/摘要绑定、Pi SessionManager原生entryId；SQLite原有事务和新增journal所有者。SDK/vendor不改，不引入第二循环或依赖，不把本地原文/隐藏推理送到公开消息。
4. 拟改events私有receipt/native binding与恢复adapter、journal增量表/事务、publisher、production-host必要接线、pi-session主进程交付前钩子，以及共享恢复摘要/typed IPC/投影/真实测试。run/call/generation稳定身份，精确toolResult entry/digest关联；intent在工具交付前持久，settled与公开工具终态同事务。仅当前run合法绑定尾部；拒跨run、旧call、重复冲突、越界/链接/损坏/变化中尾部。文件与SQLite不能假称单事务。
5. 兼容/恢复：增量幂等加表，不删除event/事实/原生文件，不回填虚假历史。旧publicItems继续可读；完成真实迁移/崩溃/回滚演练后才停止新run兼容过程写。回滚保留新表，恢复旧reader但不得重放效果或恢复旧批准。保存失败关闭后续交付，warm拒绝保留。
6. 验收：受限native reader和receipt确定性反例；实际main在工具效果落地后强退；终态事务真拒写；缺失/矛盾native/effect读回保持unknown/uncertain；冷启动零额外模型/工具/文件/事实写入；旧owner迟到回调拒绝；新/旧副本migration与回滚再前进；同冻结build正式Electron/真实文件读回与必要门禁。先保首次失败再修，不能让模型自报成功充当回执。
7. 完成定义：完整H03合同表逐行有独立证据，已发生效果都能凭稳定receipt描述恢复处置，UI/DB与补拉一致；不永久running，不自动重播动作。无法核验明确未知，不能升级教学正确或全Harness完成。此处只冻结下一片，尚未宣称实施或接受H03-B。

## H03-B 最终限定交付（2026-10-14）


H02 ACCEPTED限验证合同；H03持久事件/恢复合同 ACCEPTED（限定本片证据范围），H03-B LIMITED_ACCEPTED。Master/方案B仍ACTIVE，H04–H10未完成；不将工具Goal状态写成已恢复或已完成。原日常NET/IMG反馈保持OPEN。

已交付：private native owner/tail绑定与稳定run/call/generation回执；交付前intent/admission保存，settled与tool_end同事务；受限Pi JSONL独立读回关联nativeEntryId/digest；重启核对教师确认产物版本/文件摘要；typed公开恢复摘要→现页面→SQLite/冷启。Pi仍唯一循环，SDK/vendor不改。unknown只核对、不重放，不恢复旧批准。新run停止metadata.publicItems过程兼容写，历史publicItems仍可读，不回填假事件。

最终冻结build a6bbc15781d54b547016e3a7553f3a46f83ef8de0a056f57268d9c0f49ea13f2/351。实际main强退与终态拒写7/7、正式Pi事件补拉/保存失败/新单写12/12、H02旧库副本迁移6/6、B→H03-A旧reader→B恢复5/5；native10/10、receipt15/15、journal19/19、提示SSR7/7、renderer217/217；legacy smoke207/207仅旧测试runtime。逻辑1366×768浅色及1920×1080暗色截图已查看（DPR1.5），真实颜色与控件可达验证。构建通过不代替实例。

网络事实：用户确认VPN/代理运行中。首轮JsIkPG网络两例PASS但图片/文件FAIL；桌面net.fetch ERR_CONNECTION_CLOSED、Node ECONNRESET，无HTTP响应，不能称无效密钥。未改应用或系统网络设置，随后同密钥双链HTTP200，复测lBg4XZ四例PASS、runner exit2/整体NOT_ACCEPTED。失败原报告保留；一次恢复不证明稳定或无VPN可用，日常D/安装E/人工WPS仍未验。

边界：native结果存在仅证明记录，不证明外部效果；目前独立effect核对覆盖office_create_text/office_edit_text/office_create_document教师确认产物，其余not_checked/unknown。核对记录表示checked-at，不持续监控文件；prototype admitted=NULL视为不确定，不能当未交付；断电、全部工具、全Codex能力未验。未新增Harness依赖、上传真实学生图、改凭证/系统DNS代理，无commit/push。

下一唯一Harness切片H04：复用现Pi工具wrapper/Hana执行registry，给全部生产tools明确manifest、效果等级、取消/时限/资源锁；safe_read有界重试，401/权限/写入零自动重试；超时或迟到结果保留unknown，并经H03回执核对。网络连接中断与首次正常关闭后启动超时需保留诊断，不能通过重跑覆盖。

证据：docs/goal/HARNESS_EXECUTION.md、测试样例说明书.md EVT-01–12；apps/desktop/test-results/goal/harness-h03b-20261014/{progress.json,closeout.json,commands-final.ps1}。此前H03-A证据保留在harness-h03a-20261014；当前共享source可能并行变化，冻结实例不声称日常进程或全部source同版。


### 本片门禁及独立证据

| 门禁 | 最终结果 | 原始目录/记录 |
| --- | --- | --- |
| build/type | exit0，冻结351文件 | build-receipt-scope.log/json |
| native受限尾部/Pi真实entry | 10/10 exit0 | pi-native-receipt-Tk4PQH |
| receipt/事务/旧nullable admission | 15/15 exit0 | pi-tool-receipt-uciW8g |
| event/outbox/owner/游标反例 | 19/19 exit0 | pi-event-journal-0b2fv0 |
| 恢复摘要SSR | 7/7 exit0；只SSR | recovery-notice-vFfREC |
| renderer组件 | 217/217 exit0 | components-final.log |
| 实际main强退/文件落地/终态真拒写 | 7/7 exit0 | pi-receipt-crash-M5U45w |
| 正式Pi/丢通知补拉/单写/保存失败 | 12/12 exit0 | pi-event-journal-ui-p1MgWa |
| H02旧库副本/新run/正常冷启 | 6/6 exit0 | pi-event-journal-old-XmXi7W |
| B→实际H03-A旧reader→B/浅暗/两尺寸 | 5/5 exit0 | pi-receipt-rollback-XRnWVi；PNG实际查看 |
| 原NET/IMG/FILE复测 | 四casePASS，各suite exit0，整体exit2未接受 | harness-baseline-lBg4XZ；首次JsIkPG两PASS两FAIL保留 |
| legacy最低smoke | 207/207 exit0，32PNG复制并hash | legacy-smoke-final.log/readback.json，仅legacy |

原始JSON在apps/desktop/test-results/xiaozhi-agent及acceptance；汇总logs/报告SHA/精确复现命令在test-results/goal/harness-h03b-20261014。各专项只验证声明范围，不以总数冒充全部功能通过。

首次失败保留：bcnEKP/ArfjgH由nativeRoot初始化引起无窗口，惰性入口修复；DZ3O8G测试hook动态import不支持，改现process builtin；DMCORW launcher与main PID不同，改实际PID/userData验证；pX6qxR正常关闭后launch超时原因未证实，最终规定强退流程通过，正常冷启另有old/events证据。MEVS2K自动报告5PASS但dark PNG实为浅色，视觉拒绝，XRnWVi真实颜色断言后才接受。JsIkPG图片/文件真实Connection error不抹除，用户VPN状态来自本轮直接答复，自动baseline环境UNKNOWN字段保持原文，由closeout补充来源，不改旧报告。

### H04 修改前冻结合同（下一切片，尚未实现）

1. M10/M12与对应办公/教育工具；教师可见结果：工具不响应也能结束等待，取消有可见状态；读取可有界重试；已经可能产生的修改不能重复执行。错误区分凭证、权限、连接、超时和未知效果。
2. 当前已复用Pi唯一loop、Hana outcome/SessionExecutionRegistry、AbortSignal ownership及H03 receipt。先逐生产注册点列manifest，再在现wrapper内接唯一执行边界；禁止另建executor循环。原生记录、教师确认与领域事实真源不变。
3. 拟改tools/manifest、execution-bound、retry、effect小模块、pi-session现注册wrapper与web/file/browser/Worker必要adapter；shared错误/attempt摘要走现typed event，不直接renderer调用。manifest包含input/output验证、safe_read/local_write/external_effect、锁键、timeout/cancel/retry策略，新增attempt写H03 journal。
4. 优先审计并直接复用OpenMAIC timeout小模块及许可、Hana执行registry/结果归一化。新依赖必须锁定并记录许可/体积/Windows影响；本片不预先安装依赖。图上传与文件修改仍现明确教师确认。
5. 兼容/失败/回滚：manifest按现tool稳定名称映射，旧receipt只读仍兼容；provider adapter可逐项退回，未知写效果不能重放。timeout race仅结束等待，不伪称外部效果已停止；迟到回调拒越owner，必要效果读回仍需稳定receipt。不修改密钥、系统DNS/VPN或真实用户目录。
6. 完成定义：全部生产tools有明确manifest；忽略signal/迟到progress、safe_read连接/429/timeout、401/权限零retry、重复write/同文件锁/源变化、取消与shutdown的反例；正式页面网络正文替代来源、确认写入后切断的独立读回；当前门禁和首次失败均记录。复用H03，不自动重播任何unknown动作。
7. 本轮未达项继续OPEN：间歇连接中断根因、日常原NET/IMG反馈、VPN关闭路径、安装/Office人工、全工具可靠性。先保证可观测和安全恢复，再用同输入/同构建/同profile验收；不以自动脚本成功替用户关闭反馈。

### H04-A 本轮具体冻结（2026-10-14，代码修改前）

复用OpenMAIC 636fab0 MIT tool-timeout（本地clean；公开上游同路径已核）与既有Hana取消registry/执行一次、防输入漂移。首先实现所有当前注册生产工具manifest与现Pi wrapper统一边界；新注册工具无manifest拒绝启动。老师等待通过现budget.wait暂停工具active deadline，不限制用户当前无token配额要求。锁在真正underlying settlement前保留，超时只结束等待不假称动作停止。

本片改tools/manifest、execution-bound、resource-lock及shared/xiaozhi-tool-attempt、现Pi/production-host/runtime-budget接线、typed event/projection与既有OfficeToolProcess状态；输入复用SDK验证/原领域schema，结果校验统一边界而保留原领域输出。attempt只公开枚举/计数，不含路径/正文/凭证；每次交付前通过journal barrier与owner检查，首次intent/admission复用H03。

仅office_web_search/fetch明确safe_read最多两次，实际内部attempt ID避免Hana缓存失败；其它读取/会写解析缓存的工具仍零自动重试。401/403映射不可重试权限失败。写入、上传、浏览器点击/导航、草稿与教师确认调用不自动重试；并发同资源修改拒绝，安全读允许并发。旧DB无新表，attempt走已有journal，新字段可选、旧UI不显示也不丢旧内容。回滚撤新wrapper、保留已保存attempt/receipt，不删除事实或复用批准。

反例包括忽略signal/同步throw/迟到progress/超时与cancel竞争/等待暂停/重复call与参数漂移/资源读写冲突/迟到解除锁/无manifest/畸形output；429/transport限次、401/permission零retry、journal拒写零重试交付。真实正式Pi/Electron页面读取网络、文件与授权公开合成图，停止后冷启回读；同冻结build门禁。无新增依赖、第二执行循环、系统网络或真实资料改变；首次失败保留。完整H04各adapter/effect/源版本/shutdown全部门禁不由本片自动升格。


### H04-B1 修改前冻结（2026-10-14，等待与交付保护）

- M10/M12，继续 H04。教师可见结果：交付前权限/记忆/记录等待可以取消并受时限保护；关键记录超时或失败时停止本轮，不能继续模型调用或绕过记录执行工具。超时只结束等待，实际底层未结束时锁仍保留。
- 当前缺口：统一 race 仅包工具 execute，Pi dispatcher 外部的 checkMemory 和 beforeDelivery/attempt await 未受保护；publisher.flush 在已知失败时仍先等旧 chain；教育导出会写文件，但 manifest 只有 session 锁，且 output-only 会话的真实输出目录不同于私有 workspace。
- 复用既有 OpenMAIC 等待边界、Hana registry、publisher 永久失败门禁；不改 vendor、SDK、SQLite schema 或教师确认。改 tools/execution-bound、manifest、Pi 注册回调及生产 host/publisher 必要接线；使用主进程解析的实际文件输出目录作为导出锁键。typed 公开状态仍用现有失败/取消/恢复事件，renderer 不新增入口或模拟文字。
- 关键 callback 接收 main 私有 signal，排队 action 执行前后检查 owner/signal；已入 SQLite 的写入不能假称回滚。关键等待失败封闭 publisher、停止旧 owner、warm 拒绝，冷启仍走 H03 只读恢复。普通用户取消不冒充持久化失败，不删除既存记录，不重放。
- 验收先保留失败：pre-admission/start/final-attempt 忽略取消或超时、迟到回调/新 epoch、关键失败零后续 dispatch；两会话导出同目录相互排斥、实际 settlement 后解除；source + SQLite/publisher 反例、实际 Pi 注册；冻结正式 Electron 的联网、停止/冷启和最低门禁。受控故障与实际供应商、daily 分层记录。
- 本片只接受上述等待及目录保护；完整 shutdown、所有教育/办公工具源版本 golden、实际网络替代来源仍属 H04 后续，不把本片升级为全 H04 或全 Harness 完成。无新增依赖、凭证/系统网络/真实学生数据变更、commit/push。
- 追加审计发现：取消会让最终 attempt 未能保存，不能凭失败 native 结果认定已交付写操作没有效果。沿既有 receipt reconcile 补保守规则：admitted 的非 safe_read 工具失败而独立效果未检查时保持 uncertain/needs_check；只读失败仍可标 failed，独立 matched 可证明已记录。用真实 SQLite 验证，保留旧表/teacher writer，无重放。
- 正式复测 my0oOg 的 IMG-04 在“停止用途卡→同请求再次看旧图”失败：共用 wrapper 把仅本地准备的 office_view_public_image 误归 external_effect，取消后“可能已经产生效果、不要重复”覆盖领域回执，模型误判新轮仍停止。新增小范围修复：该工具归 local_cache，实际上传仍归 streamFn/payload 独立 PublicImageDelivery；取消准备不谎称已经上传，明确旧调用与新请求重新确认。保持 teacher consent 和零自动 retry，使用原自然输入及同一盲图片重测；原失败不改写。

### H04-A 实际结果与 H04-B 继续合同（2026-10-14）

## Harness H04-A 工具边界与正式页面限定接受（2026-10-14）

方案B/Master/工具Goal仍ACTIVE。H02/H03保持此前限定接受；H04-A LIMITED_ACCEPTED，完整H04及H05–H10未完成；日常NET/IMG反馈保持OPEN。

本片交付：现Pi dispatcher统一manifest/input/output/错误/工具等待边界，复用Hana执行一次与取消registry、OpenMAIC 636fab0 MIT timeout；Pi仍唯一循环。仅公开网页读取/搜索safe_read最多两次，401/403/权限不自动retry，写入/上传/浏览器/缓存读取不自动retry。资源锁在实际底层结束前保留，超时/取消只结束等待，不能证明外部效果已停止。teacher budget.wait暂停active deadline。typed tool_attempt→journal/barrier→projection→现Pro工具卡→SQLite/重启；未知效果写existing effect_state=uncertain，native失败不能抹掉unknown，不增加事实表。

修复真实注册缺陷：旧Hana文件dispatcher误包含已启用联网名称，导致重复工具注册。现仅legacyNames进入旧dispatcher，授权webTools单独注册一次；SDK实际组装2项通过。首个正式冻结ef01fc0/366的网络/图片/文件四FAIL均保留，不称无效API Key。并行课堂增加education_read_classroom及manifest已保留，不覆盖其源。

证据：当前冻结0ecb4653557542c3c4c4d110812e4c18a00900772c1b653c99f7aa32e38127c4/366，current UI KLOtFp 8/8，含真实DeepSeek、第一次受控HTTP503→实际官网200、403零自动retry、同call原生单结果/SQLite/页面刷新/正常冷启、真实停止按钮与迟到响应丢弃；浅1366×768/暗1920×1080真实颜色及PNG已查看。稍早registration冻结0a044776fe7dd09849e15d220e9d33fbfa5faebd9dba718fe5cd90d33d70f873/366：dYig9f UI8/8、实际main强退/确认文件/终态拒写VnmYpl7/7、自然baseline qzj69k四PASS（network20/image13/file15；总NOT_ACCEPTED）。两build分开，不声称所有证据同版。

source定向反例17/17、真实SQLite attempt6/6、SDK注册/许可证2/2、attempt SSR5/5、receipt15/15、event19/19、native10/10；当前type与孤立vite构建exit0、renderer217/217。registration build legacy最低smoke207/207，仅历史test-runtime，不冒充Pi实例。原始报告/日志/构建和复现命令在apps/desktop/test-results/goal/harness-h04-20261014；测试样例说明书新增TOOL-01–09。未改凭证/系统DNS/VPN、未上传真实学生资料、无新增Harness依赖、无commit/push。

网络状态来自用户答复VPN/代理运行中；四例恢复不证明长期稳定或无VPN可用。UI故障注入明确只在自有测试main，不是供应商自然503/403。当前源码与列出的当前冻结Harness文件一致，未对未列并行教育源码或日常out/profile作可复现承诺。

下一唯一Harness切片H04-B：补交付前memory/permission/admission/attempt等待的取消和截止、shutdown；先审教育导出等写文件工具的跨会话workspace锁与领域源版本/效果读回；贯通实际替代来源与领域golden。现硬等待race只包def.execute，交付前关键await未全部有界，不得称完整H04完成。写后unknown只读核对；保留全部首次失败。完成H04后才H05，日常D/无VPN/E安装/Office人工继续OPEN。


#### 完整 H04 缺口冻结（不得用 H04-A 缩小原合同）

1. 交付前 checkMemory、权限、admission 和关键 attempt/barrier 等待仍可能不响应；在现边界接取消/执行时间限制，但关键写失败或超时必须明确暂停，不吞掉迟到提交，不绕过owner/receipt。安全替代路径是中断并冷恢复核对，不能跳过持久化继续动作。
2. 应用 shutdown：真实工具挂起时正常关闭、确认后关闭、旧run迟到结果与再次启动。只操作自有PID/profile，不将正常关闭当崩溃，也不把长操作强停成功当效果停止。
3. 逐现生产工具manifest/领域adapter查资源键与源版本：特别education_export_classroom/education_export_paper会写workspace，目前粗session锁需审查；跨会话同目录写入、引用资料变化、工作目录切换、真实现领域CAS/teacher确认不弱化。
4. 领域golden保持并有失败读回：文件复制/生成/导出、解析/OCR、公开图、browser交互与教育草稿/确认，效果查询不支持时明确not_checked/unknown，不自动重放。已验测试不扩大成整域完成；没有真实学生资料上传。
5. 网络正文来源失败后，Pi真实读取授权替代来源→独立标准满足/来源记录仍保留首失败。不能用最终流畅回复或模型自评当verified。
6. 将H04全部要求逐条映射证据后才能接受并进入H05；原日常NET/IMG、无VPN、安装/Office人工及H05–H10持续OPEN。source漂移或外部观测超时先检查同一handle/实际加载模块；无法证明版本时不能继续宣称同build。

原始失败：IMq3Ce四FAIL、xxr1d4/OVSsKq重复注册；jktDhC未实际注入；do4B2p测试handler失去原型造成timeout；8UnXNf测试MockAgent递归；lBuECe观测GC；RBMjuj漏migrate；SSR导入/断言失败日志均保留。最终actualUI KLOtFp含一次GC重观测成功，不删观察异常。OpenMAIC helper重放对比vendor一致（shim只存内存，不覆盖vendor），provenance outputSha和构建legal assets已核。


## H04-B1 当前继续位置（2026-10-15）

H04-B1 LIMITED_ACCEPTED；H04 DOING、方案B/Master/Goal ACTIVE，H05–H10未完成。此前 H04-A 记录为历史证据，不表示日常原故障已关闭。

已交付：工具 pre-delivery/checkMemory/started-attempt 纳入原 OpenMAIC race；终态 attempt 有最多15秒的关键等待，关键失败封闭 publisher 并停止交付。caller cancel 不冒充持久化失败；迟到准备不能调用工具。工具执行前等待共享该工具 manifest 的 active deadline，teacher wait 仍暂停时钟；取消仍可立即结束等待。真实底层未结束时保留锁。education_export_paper/classroom 使用宿主授权的实际输出目录锁，与同目录普通文件写入互斥。取消后无最终 attempt 的 admitted 非只读失败保持 uncertain/needs_check；独立效果 matched 可解决，纯读失败不虚构效果。Pi仍唯一循环，无新schema/依赖，不改变教师确认或来源事务。

冻结 68de755f663f3d61c81c996c49430d0b1ac44946fdc75f477b4279939d7f95cb/366，正式 UI pi-tool-execution-ui-aax7Qo 10/10：真实 DeepSeek、受控503后实际官网200、403不自动retry、停止/迟到丢弃、补拉/冷启、浅1366/暗1920截图已查看；正常关闭受控卡住GET耗时1839ms，未回答问题退出及冷启无重放。仅这两条正常shutdown，不当作批准后写入、DB挂起、全部退出或实际崩溃。

首次完整baseline my0oOg（旧本片bcc94b08/366）NET-01/02与FILE-01三PASS，IMG-04 FAIL/native exit1且整报告保留：准备取消的泛化unknown文案使模型误认新任务仍停止。修复把公开图片工具归本地准备、保留有阶段含义的取消回执；真实上传仍独立回执，绝不复用批准或自动retry。当前冻结pi-public-image-ui-4KgjsA15/15使用原盲图片/原自然输入重新走确认、送达、核验码/图形、拒绝、停止、冷启、utility终止和供应商故障反例，另实证停止用途卡后同会话新确认、实际200/received、盲码及独立回执核对，不拿冷启代替它。旧三PASS和当前图片复测分构建，不拼成同版四PASS；日常反馈/完整最终基线尚未签认。VPN/代理状态来自用户答复运行中，未证明无VPN。

source受控等待/图片取消9、工具17、SQLite attempt8、receipt15、journal19、SDK2；type及原vite配置孤立构建exit0，组件217。legacy最低smoke207仅旧test-runtime，跑于本片bcc94b08，不冒充当前Pi或图片实例。正式UI的Playwright观察GC错误原样保留，原同进程重读而不吞产品异常；首次tsc缺details错误保留，修正后type0。列出的Harness源码与冻结摘要一致，不承诺未列教育源码或日常out/profile同版。

证据与精确命令：apps/desktop/test-results/goal/harness-h04b1-20261014；测试样例说明书TOOL-10–15。上一片及第一次构建/类型错误不删除；未改密钥/系统网络/真实学生数据，无commit/push。

下一唯一Harness切片：H04-B2：处理启动/模型准备与关键 DB 等待中的停止及退出；审计全部领域工具的源版本和副作用读回；正式 Pi 在第一来源失败后使用授权替代来源并独立核对。完整 H04 逐项有证据后才进入 H05；日常旧会话/原图片、无 VPN、安装与 Office 人工继续 OPEN。

## H04-B2 本轮交付合同（2026-10-15，修改前冻结）

模块 M10/M12，保留 H04 全部要求。本轮先修准备/交付/退出等待：教师停止应切断尚未发送的模型请求；退出不能被无法响应的数据库任务永久阻塞。既有 Pi、Hana 注册、OpenMAIC 等待原语、publisher fail fence 和恢复回执直接复用，不新增循环、依赖、数据库或界面库。

当前缺口：Pi 创建、checkMemory/protectedContext/model barrier 存在裸 await；host.close 顺序等待 starting/modelWrites/run.done，挂起写入可永久阻塞。生产路径既有 typed stop、错误投影与冷恢复保留。本轮只在 main 生命周期等待增加有界保护与迟到结果处置；不绕过持久化、不把超时当成功，也不声称 race 停止了实际外部效果。

修改候选：xiaozhi-agent 生命周期等待 adapter、pi-session、production-host；专项受控等待测试及正式 Electron 停止/退出反例、测试说明书。默认准备/权限关键等待有固定期限，停止即时唤醒；关闭有整体期限，后台未知写入保留并由启动恢复核对。宿主选择和模型用途权限不变；原有准备/创建能完成时行为保持。

完成定义：先记录实际失败，修后同输入/构建复测；迟到准备不调用 provider、不发成功事件，取消不授予新权限；正常退出与冷启保留事实、不重放动作；type、孤立原构建、组件及相关 smoke 命令/失败/跳过分层记录。旧 profile/日常 out 不替换。回滚撤销等待 adapter 调用，保留既有 journal/schema/native 文件；未知写入不自动重试。

全 H04 剩余领域源版本/effect golden、授权替代来源、确认后 file→fact 恢复与日常 NET/IMG/无VPN 等不删减；H05–H10 不因本轮结束自动通过。


## H04-B2 当前继续位置（2026-10-15）

本轮推进准备/模型交付/正常退出等待；H04-B2、H04 DOING，Master/方案B/Goal ACTIVE；不缩小 F_NEXT_GOALS 的 H01–H10 或完整 H04 定义。先前片次为历史证据。

直接复用已审 OpenMAIC race，通过 lifecycle-wait adapter 保护 Pi 创建的异步权限/资源/SDK等待、当前事实/记忆/上下文及模型 journal gate；一般关键等待15秒，宿主停止/关闭清理整体5秒。Pi仍唯一循环，typed stop/失败投影/冷恢复沿原入口，无新schema/依赖或权限。模型请求未交付时停止可结束等待；迟到返回不得获得新轮权限。race不保证同步主线程死锁可中断，也不撤销已经开始的SQLite原子写或外部效果，未知写入由冷恢复核对。

源码专项 lifecycle 5、原工具 preflight 9；正式生命周期UI 6、正式联网/工具UI 10 均通过。主进程受控 signal-ignoring 准备等待只安装在非打包、明确E2E、owned test-results/temp profile/data；可见停止零chat请求、迟到返回零补发/事件、新轮真实DeepSeek200及独立随机码、准备时正常关闭350ms后冷启零重放、15秒失败门禁。该等待接缝不是实际SQLite死锁或全部退出证明。1366/1920失败、浅暗工具截图已查看。

冻结build b64f0fa67d4db1894a80918238c68e52563236fba76f8c04021f900d906ec60a/366；当前baseline u0oqDG的NET-01、NET-02、IMG-04、FILE-01四个隔离正式实例PASS，各套全部通过，runner应exit2且整体NOT_ACCEPTED，日常/无VPN/原用户故障未关闭。原my0oOg三PASS一IMG失败与本轮khZYvD四项后失败均保留；首次type因闭包未保留key的非空类型返回2，已修为验证后的局部变量；准备超时曾错误降成model_error，修明确分类后同专项5通过。非模型自评，未覆盖失败。组件217、旧legacy smoke207、type与原vite配置孤立构建通过；legacy不是Pi验收。命令/报告位于apps/desktop/test-results/goal/harness-h04b2-20261015。源码列出的Harness文件与冻结一致；不证明日常out/profile同版。

图检索无当前wait节点、已有db snippet行号偏移；按已定位源码回读补证，不声称穷尽调用图。用户声明VPN/代理运行中；未修改系统网络、日常凭证/out、真实学生数据或其他教育块，无commit/push。

下一唯一Harness继续位置：继续 H04-B2：真实 DB 队列/命令创建及已确认写入中的停止退出；逐领域源版本/副作用读回与 golden；首次来源失败后的授权替代来源实例。逐条完成完整 H04 后再进入 H05–H10；日常旧会话/原图片、无VPN、安装和人工Office仍OPEN。

## H04-B2 数据库等待交付合同（2026-10-15，修改前冻结）

M10/M12；在隔离正式 Electron/Pi 用第二 SQLite 连接 BEGIN IMMEDIATE 持有真实写锁，教师通过发送/停止按钮复现 command claim 等待。检查解锁后任务、用户消息、模型请求与冷启是否继续；不是模型回调模拟。现有 start 在 claim 后没有逐阶段停止检查，外层恢复读取也未纳入停止所有权。修复候选 production-host 生命周期 admission fence、persistent-state 命令条件终止；不变 schema、教师权限、模型配置、依赖或领域业务事实。使用既有 OpenMAIC 等待适配器。

停止必须使未提交任务不再获得模型交付权限；SQLite 已排队 SQL 无法通过 Promise race 撤销，迟到已提交事实保留并条件收尾，绝不删除或自动重放。只有实际读取确认才宣称未发送/未产生任务。验收保存首次失败、正式 UI 写锁停止/解锁/新请求/退出冷启、来源及副作用读回；类型、原配置孤立构建、组件、相关 smoke。日常数据库、out 和系统 VPN 不动。回滚撤销本轮 fence 调用而保留事实和回执；完整 H04 其余确认后 file→fact、领域 golden、授权替代来源继续待验，不进入 H05–H10冒充完成。


## H04-B2 真实数据库等待进度（2026-10-15）

M10/M12，H04-B2/H04 DOING、Master/Goal ACTIVE。生产 start 的异步恢复/读取和普通命令创建复用生命周期 adapter；停止从入站起持有 controller，迟到 claim 按 command/conversation/hash 条件置 interrupted，不得重新绑定任务，终态事实保留。普通任务/消息写入后不再获得新模型交付权限；排队 SQL 本身没有被 Promise race 撤销。退出开始后不补排取消写入，已提交事实由现有冷恢复核对；无新 schema/依赖/权限/第二循环。

真实第二 SQLite 连接 BEGIN IMMEDIATE 持锁，主进程实际 claim SQL 发出被观察，教师使用发送/停止按钮；同冻结构建数据库UI4、准备UI6通过。数据库 stop 的按钮/IPC观察 2756ms，正常退出 5812ms；解锁后零新增任务/消息/provider，独立新请求真实200及随机码，冷启零重放。1366/1920恢复截图已查看。命令条件中断3、SDK生命周期5、工具preflight9；type/原vite配置孤立构建通过，组件217、legacy207（旧test-runtime，不是Pi验收）。

当前冻结 dd2adb918751d2ba23052b853205c065384b4418a7ee528f0f78f0292fde4f68/366，baseline LAJ6Uo 的 NET-01/02、IMG-04、FILE-01 隔离正式实例四PASS，整体仍NOT_ACCEPTED/应exit2；日常用户反馈、无VPN均未签认。原 jfaEoz 在实际 claim 写锁下停止失败保留；pZUJs6 是测试脚本把空输入的发送禁用误作未恢复；K14WXF 正常退出10795ms超原上限保留；observer动态import失败和错误tsconfig路径也保留并明确属于测试设置。没有用模型“通过”评价判定。证据/命令：apps/desktop/test-results/goal/harness-h04db-20261015。

未修改日常out/profile/凭证、系统VPN、真实学生数据或其他教育块，无commit/push。图中旧DB snippet偏移和新工具缺节点已用已定位源码核对。没有证明同步主线程死锁可打断、全部 DB/附件/领域等待已覆盖，也没有以此结束完整目标。

下一继续位置：继续 H04-B2：教师确认后 file→fact 切断恢复；逐领域源版本/副作用读回与 golden；首次来源失败后的授权替代来源实例。附件原子接收和执行终结 DB 等待仍需逐阶段反例。完整 H04 有证据后才进入 H05–H10；日常旧会话/原图片、无VPN、安装和人工Office仍OPEN。

## H04-B2 确认后文件到事实交付合同（2026-10-15，修改前冻结）

M10/M12；复用现有 OfficeArtifactService/State、Pi 原生文件 mutation queue、教师审阅组件、saved 发布 SQLite trigger、已存在分阶段 E2E 接缝。图无当前符号，用已定位源码核对。当前明确待验：committing 不在 invalidateRun 的撤销状态集合；afterStage(file) 后缺少当前执行权/取消复查，signal-ignoring 等待后可能继续提交 saved。不得把实际文件已落盘说成零效果，也不得将不确定操作自动再执行。

拟改 service 的文件后状态提交门禁、state 的 committing→uncertain 条件取消；复用正式 Electron UI 测试操作与纯领域 foundation golden。现有 IPC file cut 只负责模拟 file→fact 间暂停；加强仅在已验证 owned data/profile 的非打包测试中启用，新 release 标记只用于确定迟到返回时间。既有30秒 cut和原测试保持兼容；生产不安装测试接缝。必要时将 source/state/ipc 纳入构建证据，不改业务 schema、依赖、授权、原产物或现有迁移。

完成定义：先保存正式页面首个失败；教师通过自然请求获得实际 Word 草稿并确认，实际文件生成/字节/hash记录，file阶段停止使状态uncertain、零正式产物发布；放开旧等待也不能迟到发布；只读核验后恰好一份事实、文件不重写。正常退出、强制结束/cold、来源或文件被教师改动的反例，零自动重放/新模型请求；1366/1920可达操作；类型、孤立原构建、组件、领域golden与必要smoke各自记录。独立事实、原生历史、来源、文件读回为证，不用模型自评。日常out/资料/系统网络不动。

回滚可撤销本轮服务门禁及条件取消，保留已有 saved/uncertain 文件/事实/版本，未知动作仍禁止重放；已发生副作用不删除。完整H04仍包括全部生产工具领域golden、源版本读回及授权替代来源；不因本轮结束进入H05–H10或关闭完整Goal。


## H04-B2 文件到事实中断恢复进度（2026-10-15）

M10/M12，H04-B2/H04 DOING、Master/Goal ACTIVE。正式页面首失败 lJ2N0v 与真实 SQLite/文件反例 lUBeTx 均证明：文件已安装后停止仍 committing。生产复用 OfficeArtifactService/State、Pi 文件 mutation queue 和原 saved SQLite trigger；invalidateRun 将 committing 条件置 uncertain，file 等待返回后复查取消/执行权，阻止迟到 saved。已落盘文件保留；教师只读核验原 hash/size 后登记一次，教师改动显示 conflict 并保留改动。没有新增 schema/依赖/授权/第二 executor。

冻结构建 339dccef1c82ffad185d0ce3d7b4bd8e6a41104a049e3ec5774a189ffd5d6ea4/366（原 electron-vite 配置孤立目录），Office service/state/IPC 均纳入 source SHA；type/构建 exit0，组件217、旧legacy207 exit0（legacy test-runtime不是Pi验收）。真实正式 Pi/DeepSeek 页面8项 exit0：实际自然请求与教师确认、file切断停止、信号忽略的迟到返回无事实/模型/原生/公开事件、教师核验、正常退出565ms、实际 owned taskkill/cold、教师改动反例、二次cold无重放。真实文件页面本轮实际14项 exit0（基础模式，按报告计数），独立 python-docx读回与实际Word预览/重启；领域原Office golden17、file-stop5、effect-readback34 exit0。1366/1920恢复截图已查看，停止/冲突提示明确，未把任务回复当通过。

原失败报告全部保留。cfcnmZ是测试菜单角色定位错误；NOGiTx前4项通过，强制结束后测试观察器在正式应用恢复前只读数据库报disk I/O；改为结束前捕获native prefix、cold应用初始化后读回，完整8项复测通过。loader静态import早于注册的设置失败也有记录。没有删除数据库/journal或跳过强制结束断言。精确命令、报告、首次失败与截图：apps/desktop/test-results/goal/harness-h04office-20261015。

本轮VPN按用户所述运行，未改系统网络/日常out/profile/凭证/学生资料；日常真实反馈与无VPN尚未签认。上一轮 dd2adb 构建的联网/图片基线是历史证据，本轮339dc构建只完成这里列出的专项复测，不合并成当前全基线通过。人工WPS/Office打开未执行。其他教育域脏改动保留，无commit/push。

下一继续位置：继续 H04：逐领域源版本/副作用读回和原行为 golden；首次来源失败后的授权替代来源真实实例。附件原子接收、执行终结数据库等待仍需逐阶段反例。完整 H04 有证据后进入 H05–H10；日常旧会话/原图、无VPN、安装和人工Office仍OPEN。

## H04-C 授权替代联网来源交付合同（2026-10-15，测试前冻结）

M10/M12；复用 Hana/Web 工具、Pi 唯一循环、原执行 attempts/journal、主进程 native readback、typed snapshot/renderer 核验组件及现 Electron UI harness。图已定位 createPiWebTools/createHanaOfficeTools；新 verification 符号图缺失，核对已定位源文件。当前 verifier 可接受有效替代证据，但正式“首来源拒绝→另一真实正文→回答”尚无专门实例。

本轮先只新增专项真实 Electron 用例和手工样例，不改生产 schema/依赖/授权/教师确认/业务域。复用冻结339dc构建，校验实际加载路径、不可变SHA与原有source SHA；孤立data/profile，使用已有私有忽略凭证。首个教育部首页GET在实际undici适配器受控403（明确不是自然故障）；另一个已授权教育部通知URL使用真实网络，不能替换成功响应/模型/工具结果。教师自然输入，页面发出工具调用；不通过DB预造证据。若发现生产缺陷，保存首失败后再补冻结修改清单与新构建验收。

完成定义：原403的callId/failed/attempt1无重试仍公开且入SQLite/native；同一run实际替代正文HTTP200，来源URL/observedAt/native正文hash与readback一致，独立日期断言核对2022-03-25落款、2022-04-21网页发布日期及秋季实施。替代正文核验通过但整体保留partial/answer需教师核对，不因成功掩盖失败或声称完整任务verified。反例输入明确只允许失败源不得绕过到其他网址；主进程不自动更改联网授权。页面reload、cold后保留原失败及成功来源，不发生新GET/模型/工具重放；1366/1920查看失败和核验范围。首次失败与设置错误均保留，不用模型自评。无VPN、日常旧会话/用户原图、人工Office和其他H04领域仍未因此接受。

回滚撤除新增测试脚本/说明入口，不删任何证据/历史/真实设置；无需生产迁移或新executor。若仅测试改动，不重复无关组件/legacy全集，用专项真实实例及既有相关源码反例核验；生产更改时执行规定完整最低门禁。


## H04-C 授权替代联网来源进度（2026-10-15）

M10/M12；Master/Goal ACTIVE，H04 DOING，本片授权替代来源实例 LIMITED_ACCEPTED。没有修改生产代码、schema、授权、模型循环、依赖或日常配置；复用现Hana Web、Pi、attempt journal、native正文readback、typed snapshot与核验组件。冻结339dc构建 339dccef1c82ffad185d0ce3d7b4bd8e6a41104a049e3ec5774a189ffd5d6ea4/366 实际加载且前后不变，已有记录的Harness source SHA仍一致。只新增专项验收脚本与说明，不以本轮重新完成构建/组件/legacy门禁；这些生产门禁沿上一轮记录为历史证据。

真实正式Electron UcRk8C 8/8，实际观察exit0：自然请求先读教育部首页，实际undici GET受控403且仅一次；同一run按教师授权读取准确通知 http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html，实际网络HTTP200，成功响应和模型未伪造。原生模型元数据 provider=xiaozhi_deepseek/model=deepseek-flash/api=openai-completions；不是另一次服务器模型名探测。实际正文/最终回答独立核对2022-03-25落款、2022-04-21网页发布日期、2022秋季实施。主进程source readback通过，但整体仍partial、保留1成功/1失败和answer:human；绝不将正文hash核对说成答案全自动正确。

原403 callId/attempt1无重试/失败仍在UI、native单结果、SQLite receipt/journal/assistant metadata；另一来源URL/observedAt/body与核验范围对应。只允许失败首页且明确禁止换源的第二轮只发一次403、blocked无成功证据。刷新及cold保留精确历史、native字节和metadata，不重放工具/模型。1366×768/1920×1080失败与替代核验截图已查看，操作可滚动到达。相关源码反例 result-readback20、verification25 exit0；不是daily/VPN-off或全部领域golden。

首轮MD4qmc（exit1/0项）完整保留：测试初拟备用URL为t20220421_620011，并未成功读到正文，应用正确显示两项失败/blocked。依据上一轮真实NET报告定位准确t20220420_619921地址再测，不填造成功响应。初稿未在失败前存transport，故不声称原响应具体HTTP状态；本轮新增失败分支保存transport，未覆盖原报告。顺便核对测试文案使用正式组件已有“网页正文与本轮保存记录一致”。外部搜索工具一次429是研究工具故障，不作为小智测试结果。

证据/精确命令：apps/desktop/test-results/goal/harness-h04alternative-20261015。用户声明VPN/代理运行，未更改系统网络、日常out/profile/凭证、真实学生资料或其他教育域脏改动；无commit/push。全项目联网/图片/文件日常反馈仍OPEN，不因本片通过清除。

冷启的网络观察器在页面就绪后安装；本片直接证明native/SQLite无重放、就绪后观察窗口无新模型/工具事件，启动最早阶段零网络请求仍需更早的独立观察证据，不能据此宣称全启动窗口零GET。

下一继续位置：H04-D：按生产注册清单逐领域核对 source/effect 原行为 golden，补附件入站原子接收和执行终结SQLite等待的停止/退出反例。完整H04满足DoD后进入H05–H10；日常旧会话/用户原图、无VPN、安装和人工Office仍OPEN。

## H04-D 附件原子接收与终结数据库等待交付合同（2026-10-15，修改前冻结）

M10/M12。复用实际AttachmentSendState单SQL/trigger、既有Pi admission/lifecycle adapter、原sqlite3队列、journal恢复、typed start/stop与当前Composer。图缺当前host节点，已定位源码精读；不新建executor或业务事实表。当前风险而非已验缺陷：admit未走phase，终结多处DB等待且status在等待前计算。

测试先新增正式Electron反例：实际UI附件选择与发送，测试进程第二SQLite BEGIN IMMEDIATE，在原sqlite3.run实际发送admit/finalize语句处观察；必要的dispatch小暂停仅在owned app/test-results中由测试观察器安装，不替代SQL结果。停止后放锁，读取实际commands/runs/messages/attachment_sends/files/native；已提交的附件接收事实不可删除或宣称未发送，未知结果保留并核对，绝不重复提交/自动调用模型。正常退出锁等待后冷启，提交完整或未提交两种结果都需一致且可达，不能半事实或永久running。

若真实实例发现缺陷，修改仅限production-host的等待/终结执行权与现有conditional状态/metadata收尾（按需），及原相关状态adapter；共享契约仅在真实unknown状态无法表达时追加，先同步原因。不更改数据真源/隐私/教师确认，不中断共享SQLite连接、删除事实、放宽atomic trigger或重放旧动作。此前并行教育域脏改动与daily out/profile/凭证/网络保持。

完成定义：保留首失败，实际UI stop、真实SQLite等待、迟到返回/退出冷启各自有report与SQL/文件读回；已接收附件事实保留且无重复、没有停止后模型交付；终结状态不得在stop后错误显示正常成功。1366/1920截图实际查看。涉及生产桌面代码时type、原配置孤立build、组件217、最低smoke和模块专项；仅测试新增时复用冻结339dc并列明历史门禁。git diff --check收尾，更新12状态文档/说明书和剩余H04清单。

回滚撤回本片host/adapter差量，不删已提交或未知接收/文件/journal。H04所有生产tools的manifest/effect/cancel/time策略及原领域golden仍需逐项清单审计；完整H04证据满足后进入H05–H10，不因本片通过宣称整体完成。

### H04-D 已复现后修改范围补充（生产修改前）

首个有效正式实例 zpolSU：实际 assistant INSERT 已发送并等待第二 SQLite 写锁，教师点击停止后数据库恢复，仍发布 completed；run=succeeded、command=finished 与停止不符。jqg8FS 是观察器 promise GC 的设置失败，已独立保留。修复需覆盖既有 journal/publisher 终结持久化阶段，不能仅修改 host 的早期 status 计算：在现有同一 owner/generation 的事务中保存中断校正与 run/message/usage/command，保留原始回复和事件审计；正常终结不得在接受停止后发出成功事件。若停止恰在 COMMIT 回调期间到达，再进行同 owner 事务校正后发布。新增内部 terminal-cancellation adapter，无公共 IPC/schema/权限变更；现有 event 原记录不删除。增加纯 SQLite 事务反例和正式 UI 终结等待、重启读回；原始领域事实和教师确认不变。

### H04-D 收尾源码漂移检查

742d构建的专项8/8、联网8/8和最低门禁有真实证据，但收尾SHA检查拒绝将其归到后续当前源码：production-host新增了并行教育分支的teacherPreferenceContext接入（原339dc/本轮742d编译时无此import）。本片自己的取消注入仍在，未覆盖/撤销偏好代码。停止对该生产文件继续编辑，仅重新冻结独立build2并复测本片真实路径；不接受或改写另一路偏好功能。收尾脚本在任何状态文档写入前失败，原证据不覆盖。


## H04-D 终结等待与附件原子接收进度（2026-10-15）

M10/M12；Master/Goal ACTIVE、H04 DOING，本片 LIMITED_ACCEPTED。正式旧339dc构建 zpolSU 首失败已保留：真实 sqlite3 assistant INSERT 在第二 SQLite BEGIN IMMEDIATE 下等待时点击停止，放锁后仍 completed/run=succeeded/command=finished。不是模型自评，也不是 HTTP200 代替用户操作。

修复仅新增现 journal/publisher 的终结取消校正与内部 terminal-cancellation adapter；production-host 注入同 run 停止信号。当前 owner/generation 的同一 SQLite 事务更新中断核验、run、消息metadata、command、usage、finalize记录及目标未完成状态，保留实际回复/工具结果/原事件审计；COMMIT回调期间收到停止则先校正后发布。校正失败回滚、旧owner不能触碰新run。无新schema/IPC/依赖/模型循环/上传授权。未发送到前端的早期终结事件仍可在审计中看到，最新持久投影以中断校正为准，不删除历史或重做效果。

实际新构建 03d7e401cdff4226fbfe2504683aa8d6b4f3ea3416e98774004196b909e4fad0/366；原vite配置只重定向 owned test-results，已检查真正加载路径，清单内 Harness source SHA 与构建前后相同。正式真实 DeepSeek/Pi O18kpG 8/8 exit0：终结SQL等待停止、metadata/任务/command/journal一致、刷新冷启保留native字节、下一条自然指令成功、已提交附件原子事实保留一次且不交模型、冷启不重发、终结与附件接收锁等待正常退出恢复。退出分别 5539ms/5650ms；附件退出分支实际是零提交，不虚称同轮同时测过提交分支，已提交分支由停止案例覆盖。额外独立SQLite读回usage=interrupted、finalize=failed。1366/1920中断与核验提示截图均已查看。观察器对3次promise GC仅在原进程重读，没有按新建实例掩盖失败。

同构建真实联网替代 SLqINq 8/8 exit0，保留受控403一次失败与另一实际HTTP200正文、独立日期核对，整体partial/answer:human；不是所有联网、用户原图或无VPN通过。终结SQLite边界5、原journal19、原附件native21、verification25均exit0。npx tsc --noEmit exit0；原配置隔离build exit0；组件217/217、隔离legacy教育smoke207/207 exit0。默认SDK装配uhDVOS2项是本轮修复前清单检查，不当成所有生产领域工具验收。

失败原件保留：jqg8FS观察器GC导致未到有效SQL断言；zpolSU是真实产品失败；z5LPc0前4项通过后测试误用不存在列submitted_run_id，随后按当前原子SQL字段/run_id及参数索引修正；迁移测试FU9B27依赖HEAD提取旧触发器而启动失败，改为从20aa86656cdb5a0f85e0e11fa21863b50233fcb1直接复制固定v1 SQL样例，zsZAkh重跑21通过。第一次误用不存在tsconfig.node.json的TS5058属于命令设置失败，随后使用仓库tsconfig.json重跑type通过；不能合并成零失败。

冻结742d之后production-host出现并行教师偏好上下文接入，首次收尾SHA检查直接拒绝；未触碰偏好实现，重新冻结03d7并实际重跑8+8/217/207与native21。前次结果仅对应旧构建；sourceScope只覆盖清单内Harness，不将未捕获的并行教育源声称全部可复现。

冷启网络观察器仍在页面就绪后安装：证明native/SQLite无重放与就绪后无模型调用，启动最早阶段零网络尚未证明。用户代理运行，未改系统网络、日常profile/凭证/真实学生资料，未向日常out构建；教育分支并行脏改动保留，无commit/push。报告/精确命令：apps/desktop/test-results/goal/harness-h04settlement-20261015。联网/图片/文件日常反馈依然OPEN。

下一继续位置：H04-E：按全部生产工具的实际注册组合审计 manifest/effect/cancel/time/retry 与各领域原行为 golden；保留本片已验的附件/终结等待证据。完整 H04 DoD 后按序进入 H05–H10。日常旧会话/用户原图、关闭代理、安装/人工 Office 和启动最早阶段网络观察仍 OPEN。

本轮收尾第一次SHA校验发现并行teacherPreferenceContext接入，拒绝把742d构建的8+8/217/207旧结果归到新源码。未改并行偏好代码，重新冻结03d7构建并复测O18kpG/SLqINq与最低门禁；两次构建证据均保留。


## H04-E 注册证据与新需求优先级（2026-10-15）

实际正式隔离构建 9e0ea7864648523eaa821dc84bb66c43b97f611f86e55efa9ba67906f5b22b62/366，四组合13项报告success：私有无网35工具、授权目录有网46、仅输出无网38、合成学生/授权目录/有网/持续目标47。真实Pi AgentSession和原样发给DeepSeek的schema逐项一致，5次真实HTTP200；随机码/native/SQLite及冷启保存均核对，目标保留review_required等待教师。47个工具都有唯一manifest，取消/时限/效果/重试明确；注册并不代表47项领域功能通过。没有改生产代码或用户VPN/日常配置。

实际执行边界17、preflight9，exit0已观察。领域golden UpdXfG前54项后FAIL：旧host夹具缺questionReviews.collections，尚未修复/重测通过。先前jQx2dz为源runner缺OCR JSON import attribute，vZW7Tc为Electron app导出缺失；仅补测试loader读取原JSON及fail-closed app proxy，不冒充生产Electron/OCR。注册autGPn/AwxqxK为SDK观察器加载设置错误；G7U9P9前三组合9项后学生夹具误取列表为单对象，已修正。新构建前发现并行classroomContext/偏好版本接入，拒绝旧03d7结果归到新源码，保留并行实现后重冻9e0ea7。

构建exit0已观察；组件输出217/217、type日志空，但这两项和最终注册/领域任务原进程handle在本次续转时已不存在，最终shell exit未收取，因此明确exit未观察，不补写exit0。注册report成功和日志不替代该退出证据。当前清单source drift数量0，仅清单内Harness有此检查，不覆盖全部并行教育源码。未做日常用户图/无VPN/安装/人工Office或所有工具功能验收。

下一步：用户最新优先级：先读取飞书 VJazw0B8EixwBFk1X6KcdY8snbd 原文，交付需求清单、实施方案与逐条审核验收标准，再开始改造。目前链接跳转扫码登录，已请求登录或文档副本；不得猜正文。原 Harness Goal ACTIVE/H04 DOING，待新需求映射后安排剩余领域验收与H05–H10。


2026-10-15 14:14 飞书阻塞审计：含原用户触发轮与后续连续轮共3轮，均未取得 VJazw0B8EixwBFk1X6KcdY8snbd 正文；本轮实际浏览器仍为飞书扫码登录页。前轮仅访问状态重述，无需求/实现进展。现无不依赖原文的必要改造可继续：用户已指定先该文档方案/审核验收，再改造。已尝试可用浏览器/读取途径并请求登录或导出副本；不能猜正文或转回旧优先级。本轮阻塞审计成立，将线程Goal设为BLOCKED（以工具返回为准），不是完成或用户暂停；全部目标范围、H04领域失败和既有证据保留。恢复条件：用户登录后可读，或提供文档正文/导出。随后先逐条需求→现状差距→实施方案→验收标准。证据：apps/desktop/test-results/goal/harness-h04inventory-20261015/feishu-blocked-audit.json。


## 2026-10-15 最新：飞书需求已读，BoardUI复用限定交付

本节覆盖本线程旧飞书登录BLOCKED记录，原记录保留为历史。用户登录后实际读到《任务清单》三组10条，已先写docs/goal/FEISHU_REQUIREMENTS_SOURCE.md、FEISHU_REQUIREMENTS_PLAN.md（F01–10、S0–5、A01–31），再按用户“源码可以直接复用”指令冻结BOARDUI_REUSE_CONTRACT.md并实现M10/F06小片。原Master/线程Goal ACTIVE、H04 DOING；未完成全部飞书或H01–H10。

直接复制用户桌面boardui-web-search的WebSearch/types/CSS/timeline/brands/index到renderer/vendor，保留NOTICE及原/适配hash；箭头复用已有lucide，无新依赖/字体。OfficeToolProcess仅新增只读WebSearch分支，OfficeWebSearchProcess读原projection/真实状态/来源/已记录耗时；原ToolStep错误/重试/未知效果及混合教育/浏览器组回退保留。未引入App/demo-data/输入框回填，不以动画onComplete结束业务。没有本片main/preload/DDL/权限/第二模型循环变更。公共事件缺实际查询词时不从模型话术猜出查询。

正式隔离构建SHA 6c810e5802964b7262b4b6d36314ade02d60256608c3f376e9fae2b0a5d26ec9/366：真实Pi/DeepSeek桌面84bf4G 9项、键盘/减少动效5olBSy 2项、状态边界8项、原attempt边界5项、组件217/217、隔离legacy教育smoke207/207；这些最终进程退出码均已实际收取0，type及原配置隔离编译exit0。浅1366/暗1920与键盘焦点截图实际查看；未把整个npm run build/test:smoke串联说成运行过，精确等效命令在apps/desktop/test-results/goal/boardui-20261015/commands.ps1。

真实例仍区分受控首页403（保留一次失败）与实际教育部备用通知HTTP200正文；正文/答复独立核对2022-03-25落款、2022-04-21网页发布、秋季实施。整体partial/answer:human保留，SQLite/native/journal/刷新冷启一致。来源沿原typed IPC校验后实际shell.openExternal交接系统浏览器，未验内置浏览器页面；不是两来源搜索或联网整体修好。冷启最早阶段零请求仍无独立观察。

首失败均保留：构建路径漏build-isolated属于启动设置错误；SSR错误期望单工具仍有group；TJ2Czx三项后错误假设同turn一个树；m1o3pA三项后错误等待Electron新窗口。按真实callId、原单工具回退及shell交接修正测试后重测通过，没有伪造产品成功或修改网络策略。

证据范围固定为该不可变构建。本片renderer编译后未改；收尾清单检测到并行源码漂移：apps/desktop/src/main/xiaozhi-agent/pi-session.ts、apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts。未覆盖它们，也不把本片结果冒称这些更新实现的验收。仅新增本线程状态，不改其他教育分支段落。日常NET/IMG/FILE、用户原图、无VPN、实际12路调度、输入框/内联问题全量、安装/人工Office及旧领域golden54后FAIL仍OPEN。

下一步按已读飞书S1：从日常同构建/配置复现真实搜索/浏览器和流式首增量，修证实根因；补callId内联补充/确认，之后S2安全只读12路、S3输入框与少追问，再按S4/S5题库/模板。旧“等登录”不再是下一步，不回退优先级。不修改真实学生资料/系统VPN/日常配置凭证，不提交/push。


## 2026-10-15 当前：S1双栈虚拟DNS修复，真实联网与日常配置验收

本线程当前按已读飞书F01/F03推进；Master/Goal ACTIVE、H04 DOING。先冻结FEISHU_NETWORK_STREAM_CONTRACT.md，再保留8a7854/uNiBhh首失败：auto/enabled下搜索/正文/浏览器均权限拒绝，工具网络尚未发出；流式/停止/冷恢复原已通过。系统实际返回28.0.0.x与fdfe:dcba:9876::配对，本机clash-verge/mihomo进程存活；不凭此修改系统代理。

只改原office-network的完整配对识别，继续用原固定国内DoH取得真实公网IP并校验/固定连接。真实私网/混合/单独ULA继续拒绝，显式system仍拒绝，28/8单独公网结果不猜成代理。Pi/Hana/typed IPC/SQLite/教师与来源边界保持，无新依赖/DDL/第二循环；主进程其他并行教育代码未编辑。

冻结b7fabbd461828bd356a90db1b3d654c19c33e5316d5b35ecf777e329764c9a9c/368：正式Pi/DeepSeek iueWOd 5/5 exit0（真实搜索→教育部/西藏政府两正文→实际内置浏览器/PNG→停止→冷启）；真实回复481增量、71次运行中DOM增长，首DOM早于终态。17 DNS边界、15 web边界、组件217、隔离legacy smoke207均exit0。标准npm run build及type也exit0。

实际默认日常profile、原加密DeepSeek配置/auto DNS，在相同固定b7候选上的pi-daily-network-ui-EXQIYv 4/4 exit0，搜索两正文、实际内置页与截图、刷新readback通过；只通过UI创建公开政策对话，不种业务夹具、不改凭证/资料。隔离及日常各3项独立读回核验通知落款3月25、网页发布4月21、秋季实施/两URL及原PNG大小/hash。不是模型自评，答案语义仍保留人工范围。

日常共享out的5e9754测试先过3项后因测试错误假定纯web树失败；实际是update_plan+web混合组沿原视图。随后另一构建把out换为c95a17，恢复脚本SHA门禁正确拒绝，未覆盖或放宽。最终用不可变b7候选+真实日常profile重验，**不声称当前共享out/安装包已验**。首失败、测试路径/loader/定位错误均保留。固定build测试期间不变；收尾并行source漂移apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts，原样保留，不把本片结果归到它们的新代码。

证据/命令：apps/desktop/test-results/goal/feishu-net-stream-20261015/{progress.json,progress.md,commands.ps1}；实际浅1366/暗1920与原浏览器截图已查看。用户原图/文件、无VPN、当前共享out/安装/Office、完整12路、旧领域golden失败与H05–10仍未完成。下一步优先飞书F07：提问/审批/教师回答按callId回原位置并真实恢复验收，再S2安全12路；不可退回“等登录”或因本片通过关Goal。无commit/push。


## 2026-10-15：S1/F07 原位置交互与 BoardUI 复核

M10/M12；Master/Goal ACTIVE，H04 DOING，本片限定接受。问题、回答、复制/文本/产物/教育核对沿原组件及回调，按原runId/callId回到对应工具后、下一段正文前；工具组在卡处切开，未知旧锚明确保留在“其他交互记录”。Learning/Collection只读补已有callId；原题批组补已有rootCallId并仍聚合一组。无新DDL/IPC/依赖/循环或上传授权。

固定2df5ce828d1787ccf6eb3e06944d151b505024ac3675fb285492abb5d9d298e5/368：正式Pi/DeepSeek提问、回答、复制批准/拒绝、刷新/切会话、正常退出/真实自有进程崩溃分开验证，9jyRZp 8/8。原公开合成图Dg1XGd 13/13，独立先查看PNG冻结gold，真实图hash/HTTP200/验证码及形状位置一致；冷恢复原位置YZ2lO3 3/3，包括相同回答幂等、冲突回答拒绝且无新run/native。浅1366/暗1920图已查看。

renderer11、领域98、BoardUI复核8、独立SQLite/native/文件/图/源码manifest读回5、组件217、隔离legacy教育smoke207均通过且exit0已收取；type/原vite配置隔离build exit0。BoardUI6文件原/适配hash均一致，仍由host真实状态和来源驱动。不是模型自评；未把图片送达当成所有识别正确。

首失败cAPgAK与j2yCK0保留：前者复现旧尾部定位，后者是测试误把正常退出当崩溃恢复；生产正常停止规则未放宽。旧学习夹具缺collections只补fail-closed测试依赖；SSR复用实际classroom-preview构建器。收尾production-host出现并行源码漂移，未覆盖；本片证据只对应固定构建，不归到最新main/共享out/安装包。

证据与精确命令：apps/desktop/test-results/goal/feishu-inline-20261015/{progress.json,progress.md,commands.ps1}。原日常IMG/FILE反馈、用户原图、无VPN、全业务卡真实UI/全部H04 golden、完整12路及H05–H10仍OPEN。下一步S2：先核“2”的实际来源，再冻结安全只读12路；F05/A13无callId队列保留原入口，不能猜定位。无commit/push。
## 2026-10-16 S2 收尾证据

S2 只读调度已在隔离冻结构建上复测通过。工作目录为 `apps/desktop`，命令如下：

```powershell
$env:OMNI_EDU_TEST_BUILD_ROOT = 'test-results/goal/harness-read-scheduler-20261016-final/build-isolated'
node scripts/xiaozhi-agent/pi-read-scheduler-web-ui.mjs
Remove-Item Env:OMNI_EDU_TEST_BUILD_ROOT
```

结果：exit 0，4/4 checks；报告目录为 `apps/desktop/test-results/xiaozhi-agent/pi-read-scheduler-web-ui-jQ6sf7`。构建 SHA `acf357002c23adccd23d5914c9abcc5a0fd26e7a87130f9845e7f23c9e6efef3`，脚本 SHA `975fb57dc503ef2fc82dc7121d9f83689d88c0f0b56098fc17409514ea6fc6a1`。13 个真实 Pi 工具调用、12 个 active、第13个排队、释放后 admission、最终 SQLite/journal/projection 对账均通过。

本证据只接受生产调度/UI/持久化时序；受控网页 body 为合成夹具，不把它写成真实联网成功。下一执行片为 S3 输入框与少追问，真实网站错误恢复、图片识别、文件链路和无 VPN 继续单独验收。

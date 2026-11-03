# UI-FINAL 唯一执行记录

结论：**BLOCKED（S0领域硬依赖，正式UI未完成）**。设计版本UI-FINAL-2026-11-03；执行入口 ../../goal/UI_FINAL_RECONCILED_GOAL.md。

## S0 基线与对账

运行根D:/WorkProject/EduProject-sidebar；分支codex/ui-goal-implementation-20261101。初始HEAD10061eb；远端最终交接c0009b9；正常merge327409a，禁止回退53e3954。preload唯一冲突保留PaperBasketV2ImportInput及PaperReferenceAPI，自动合并PaperBasketWorkspace保留双方；未切换其他工作树、无reset/stash/清理/新模型请求。

原35份未提交/未跟踪文件已逐字节备份并校验，路径apps/desktop/test-results/ui-final-reconcile-backup-20261103；可提交历史清单见evidence/history/dirty-backup-manifest.json。未把未提交补丁算主线已交付，工作树仍保留。其他D主目录/知识库/Hana工作树及其任务不接管。

29份批准设计Git blob全部与manifest一致；原型26项不计正式验收。Astra独立只读核c0009b9：shared/paper-export.ts的paper/answer_sheet是固定输出种类，不是模板版本；paper-print-layout固定A4不是版本模板。shared/paper-blueprint.ts validPaperBlueprint仍要求考试时长总分，A24不能仅隐藏控件认定具备。paper-selection/paper-fulfillment能复用选择/缺额，不等于完整A26；A27仍未证明。A28所需模板实体/仓储/版本保存/独立应用不存在，不能在UI合同内新造领域服务。

### 修复预算

| 阶段 | 本合同实现/验收 | 已用定向修复 | 状态 |
| --- | --- | --- | --- |
| S0 | 1次盘点/1次依赖验收 | 0/2；Git冲突合并不是产品修复 | BLOCKED A28 |
| S1 | 未开始 | 0/2 | NOT_RUN |
| S2 | 未开始 | 0/2 | NOT_RUN |
| S3 | 历史C2a一次正式失败保留；本合同未启动 | checkbox相关累计1/2，不能换名重置 | NOT_RUN；受A28阻断 |
| S4 | 未开始 | 0/2 | NOT_RUN |

## 固定36项（逐字保留，均来自最终冻结文档）

| ID | 验收行为与合格标准 | 初始状态 |
| --- | --- | --- |
| A01 | 新建/搜索/历史/教学空间、四主目的页和底部设置可达；原路由/参数/权限守卫有映射且有效 | NOT_RUN |
| A02 | 首页输入优先、轻量教学入口；空白右栏关闭，有成果提示后可手动打开；普通工具不抢焦点/栏宽 | NOT_RUN |
| A03 | 原OfficeComposer、工具栏及弹层在同环境前后外观/配置/行为一致；IME不误发、换行正确、会话草稿隔离 | NOT_RUN |
| A04 | CSSOM证明组件官方交互未被全局样式污染；记录获胜选择器/文件/layer，禁改vendor和全局!important | NOT_RUN |
| A05 | 请求接受立即反馈；运行时只用真实公开说明/工具事件；无事件时仅等待，不造步骤/隐藏推理 | NOT_RUN |
| A06 | 读文件/搜索/执行有不同图标和文字，真实工具开始/完成/失败与详情绑定对应runId及结果 | NOT_RUN |
| A07 | 最终正文边界到达时整段过程自动收起一次；正文继续流式，用户重新展开不再被抢回 | NOT_RUN |
| A08 | 用时位于过程顶部，首次公开活动→最终正文开始，交接后冻结；无公开活动不造用时，底部不重复展示 | NOT_RUN |
| A09 | 停止/失败/审批各有真实状态和恢复路径；已有正文保留，危险操作不被视觉精简绕过 | NOT_RUN |
| A10 | 长对话上翻/选字不强追底；新事件不重建外壳；冷启恢复不重放模型/工具，不串run | NOT_RUN |
| A11 | 资料库文件组织、目录/标签/类型/状态组合筛选、文件查找与内容检索真实有效；清空可恢复 | NOT_RUN |
| A12 | 资料概要/原页/题目/笔记按需进入；来源与原页可定位，教师校正不覆盖原始文件 | NOT_RUN |
| A13 | 导入/解析/索引/题目可用分别呈现；任务取消、失败、重试有效；旧版本与迟到事件不覆盖当前详情 | NOT_RUN |
| A14 | 教学文件/备课本/讲义/题本与原预览、版本、编辑、保存、返回可用；删除可见冗余未删业务 | NOT_RUN |
| A15 | 学生页先搜索/选学生；同一studentId切换档案/记录/错题/计划/复盘/概览；查找及新增记录可达 | NOT_RUN |
| A16 | 切换学生/资料保护未保存草稿，迟到请求不污染新对象；刷新/重启绑定正确 | NOT_RUN |
| A17 | 设置日常/高级分层、搜索和返回有效；配置就近保存，失败反馈与生效范围真实，原模型/技能/工具/备份可达 | NOT_RUN |
| A18 | 文件权限、来源授权、备份恢复与确认仍走原契约；空间/导航选择不自动扩大读取和写入范围 | NOT_RUN |
| A19 | 课堂设计/互动预览/理解检查/教师核对接现有真实备课与成果；保存/取消有效，不自动写学生事实；缺依赖明确阻断 | NOT_RUN |
| A20 | 组卷入口是完整题目选题/筛选＋题篮，不存在三个同质模式首页；清楚返回教学工作台 | NOT_RUN |
| A21 | 章节/知识点、关键词/题号、题型、难度及实际来源范围筛选有效；图文、公式与选项完整可读 | NOT_RUN |
| A22 | 同一来源题重复加入被阻止；已加入/移除反馈正确；题篮题量和分布随当前题组变化 | NOT_RUN |
| A23 | 选题⇄编辑⇄预览、返回父页、应用导航前进后退保留题组/筛选/滚动；重启恢复不丢草稿 | NOT_RUN |
| A24 | 选三题可直接做练习，不强制考试字段；练习/试卷切换保留题目、分值和来源；新建保护原草稿 | NOT_RUN |
| A25 | 上传/粘贴后核对题目边界与图文再加入，可取消不写；与题库题混用；真实文件错误显示，不使用固定OCR样例 | NOT_RUN |
| A26 | 按需求形成可编辑命题方案，确认后按题型/知识点/难度/配额补缺，保留已选题；缺题明确报告，不暗放宽 | NOT_RUN |
| A27 | 指定题目改编有原题/候选/答案对照，显式接受才替换或新增；保留父题/来源版本/要求；换题保留位置与分值 | NOT_RUN |
| A28 | 参考卷真实提取后核对，命题结构/卷面版式可独立或同时应用，模板可保存/修改/另存版本；应用不覆盖手选题 | NOT_RUN |
| A29 | 编辑题干/图片/答案/蓝图或来源变更使关联审核失效；题序/分值统计一致，待核对可预览但不能冒充确认交付 | NOT_RUN |
| A30 | 学生/教师预览与原正式导出读取同一确认快照；学生版无答案，实际Word/PDF/答题卡既有格式可打开；核对题号/分值/图片/公式/分页，写入失败和取消保留草稿 | NOT_RUN |
| A31 | 全页面1366×768与1920×1080浅色截图，800×768可操作：导航/右栏响应式、无遮挡/横向溢出，弹窗底部确认可达 | NOT_RUN |
| A32 | Hover/Focus/Pressed/disabled可区分；键盘Tab/Enter/Escape、焦点归还、可访问名称/展开属性、reduced-motion正常 | NOT_RUN |
| A33 | 最终有效构建覆盖空/长内容、加载/运行/完成/失败/停止/待确认、展开/收起；无新增控制台错误/未处理异常 | NOT_RUN |
| A34 | 适用构建/类型/Lint/组件/模块/关键smoke完成；记录真实exit和基线失败；UI性能前后观察无本轮明确退化 | NOT_RUN |
| A35 | diff核验只包含本轮授权内容；整合远端main并复验受影响项，冲突有记录；非强推，远端包含交付提交 | NOT_RUN |
| A36 | 实际启动整合后的正式小智窗口，源码根/SHA/构建指纹一致；最终报告、36项证据、遗留及可审查回滚步骤齐全 | NOT_RUN |

A28执行状态覆盖为 **BLOCKED**；其余35项 **NOT_RUN**。主项合计36：PASS0、FAIL0、BLOCKED1、NOT_RUN35。旧实际失败tqyAoo在历史证据中仍为失败，不移除，也不等同本轮正式A28已执行失败。

## 原有效增补断言

| X01 | A03/A10/A32 | 同步写入阻断；原IME/附件单独发送/幂等发送/队列/失败草稿/五类菜单；关闭弹层焦点归还，不增加发送权限 | S1 |
| X02 | A13/A16/A19/A25/A28 | 预提交取消回滚；提交后不能报未保存；读回失败沿原幂等请求核实、不重复建版本；取消/离开/切对象后的迟到请求不落写；已生成成果和教师草稿保留；未知结果不得标成功 | S2/S3 |
| X03 | A13 | 暂停/停止/失败重试沿原队列；保留原件与已完成页，不因UI重试重复付费处理成功页 | S2 |
| X04 | A12/A21/A25 | 图文/选项/小问/公式/两遍原文与教师补充保持分层；真实原页/版本可定位，禁止合成OCR冒充 | S2/S3 |
| X05 | A26–A29 | 来源source_only/hybrid/ai_original、生成配额/教师确认语义保留；模板应用不删除手选成员/实例/分值；孤立成员须明确安排后才能确认 | S3 |
| X06 | A28/A29/A30 | 精确资源版本/模板不可变版本/确认摘要/题篮revision绑定；来源改变使确认失效；保存新版不隐式改旧绑定；回退保留schema读器及来源/布局拒绝；D1旧卷意图不得回退latest；跨学生/私有资料不得越权 | S3 |
| X07 | A30 | 截图/日志不暴露凭证；备份恢复影响预览、取消、失败与冷启须真实测试；学生卷/教师答案/答题卡×Word/PDF沿原审批/同名/图像完整/公式/失败恢复；拒绝和取消不写成功记录，实际文件读回 | S3 |
| X08 | A05/A07 | 默认公开说明+真实工具，私有推理不泄漏；不从renderer强制拆合正文/伪造过程；工具详情保留内容但不显示逐工具调用时间，不出现原生黑色details三角 | S1 |

X01–X08均NOT_RUN，不继承旧测试PASS。逐项组件/路由/服务复用表见下一节；原36个旧要求到新项的去向见RECONCILIATION。

## 命令与证据

- git fetch origin：exit0；已核远端main c0009b9。
- 初次git merge origin/main：exit1，preload import冲突；保留双方后git commit：exit0，327409a。
- 29份原始Git blob SHA-256：全匹配，evidence/design-baseline-check.json；这只证明设计指纹。
- 当前构建/组件/审计结果在本记录末补实际exit；不据工程成功把A01–A36改PASS。
- 无当前正式全页Electron/800窗口/IME/性能前后验证，截图仍旧构建范围；未伪造前后性能或视觉验收。
- 环境自动Goal首次旧objective/blocked，随后用户恢复active且已核实，objective仍未改写；工具不支持替换objective，未虚报切换，详情evidence/history/automatic-goal-observation.json。

## 阻断出口及恢复

阻断A28：需要组卷领域负责人在独立合同交付真实参考模板模型、不可变版本保存/修改另存、结构/版式独立应用、授权/来源版本校验、快照与正式Office绑定及必要兼容性。用户解除此依赖后从S0复核进入S1；A24/A26/A27仍须验证真实服务，不得伪造。

当前没有启动“最终验收最新版”，A36 NOT_RUN；不能把旧试用窗当本次交付。BLOCKED按最终合同停止，不继续追加领域开发或美化。保留已完成327409a及旧功能2d2a35a/e2704cd，未提交补丁仅备份保留。主线推送状态在末尾填真实结果；不把阻断文档交付称产品DONE。

回滚：本轮文档及合并提交审查后限定revert，保留协作main和全部真实数据。旧Goal原文/旧进度副本可从history检索；不清空工作树，不删除未提交补丁。其他团队任务、Master和领域AT状态未改。

## S0 逐项消费者映射

路径根apps/desktop/src/renderer/components；A项映射为复用入口，不是PASS证据。

| ID | 现有组件/目录 | 路由/服务与余项 |
| --- | --- | --- |
| A01 | `product/ProductSpaceShell.tsx` | 主导航原route→各工作台；原权限守卫 |
| A02 | `office/PiWorkspaceShell.tsx` | office会话/成果投影；不得自动抢栏 |
| A03 | `office/OfficeComposer.tsx` | 原发送/附件/IME及typed preload，保护不改 |
| A04 | `office/OfficeComposer.tsx` | styles.css/main.tsx及HeroUI CSSOM；不改内部 |
| A05 | `office` | Pi事件→公开执行→等待 |
| A06 | `office` | Pi run/tool结果投影 |
| A07 | `office` | 最终正文明确边界→折叠一次 |
| A08 | `office` | 公开活动时间→正文交接冻结 |
| A09 | `office` | 原Pi stop/审批/失败接口 |
| A10 | `office` | 持久run恢复/滚动/事件消费者 |
| A11 | `product/MaterialsWorkspace.tsx` | knowledge route→main/assets/material-ipc与retrieval |
| A12 | `product/MaterialDetailNavigation.tsx` | resourceId/version→原页/题目/笔记 |
| A13 | `product/MaterialImportPanel.tsx` | main/assets原任务/队列/派生状态 |
| A14 | `product/WorkbenchPageNavigation.tsx` | teaching route→原文件/版本/预览接口 |
| A15 | `product/StudentWorkbench.tsx` | students route→原student/evidence服务 |
| A16 | `product/useMaterialDraftGuard.ts` | 资料守卫及学生context异步/持久恢复 |
| A17 | `office/PiSettingsWorkspace.tsx` | settings route→模型/技能/MCP/备份原API |
| A18 | `office` | 主进程原文件授权/审批/备份服务 |
| A19 | `office` | 原science-lesson/lesson-recovery服务→互动/教师审阅 |
| A20 | `paper-ui/PaperBasketWorkspace.tsx` | teaching组卷→持久篮；旧自动组卷/历史保留 |
| A21 | `paper-ui/PaperCandidateBrowser.tsx` | 原题库查询/来源/图片公式 |
| A22 | `paper-ui/PaperBasketPanel.tsx` | paper-basket原仓储身份/去重 |
| A23 | `paper-ui/usePaperBasketWorkspace.ts` | 原basket-ui持久/阶段route及原栏位 |
| A24 | `paper-ui/PaperBasketBlueprintForm.tsx` | validPaperBlueprint强制考试字段；用途服务未证实 |
| A25 | `paper-ui` | C1材料回接/原真实导入；粘贴闭环待核 |
| A26 | `paper-ui/PaperFulfillmentDetails.tsx` | paper-selection/fulfillment基础，需求方案闭环待核 |
| A27 | `paper-ui/PaperInstanceEditor.tsx` | 实例编辑/来源父版本可复用，改编对照接受未证实 |
| A28 | `paper-ui/PaperReferencePanel.tsx` | paper-reference-ipc只有列举/提取/取消；无模板CRUD/应用，BLOCKED |
| A29 | `paper-ui/PaperBasketPreview.tsx` | paper-basket-state/repository→快照核对/失效 |
| A30 | `PaperExportEntry.tsx` | paper-export/compilePaperOffice及rich/instance→原审批Office |
| A31 | `product/ProductSpaceShell.tsx` | 全页面三尺寸/原生布局 |
| A32 | `ui/DisclosureCard.tsx` | 全页面键盘/焦点/动效；checkbox历史单列 |
| A33 | `office` | 所有受影响页面真实状态/console异常 |
| A34 | `paper-ui` | package.json真实门禁与smoke/性能观察 |
| A35 | `product` | Git范围/冲突/远端包含证明 |
| A36 | `office` | 实际start-desktop入口/运行根/构建/窗口 |

## S0 命令记录补充

首次三条重定向误用../../../（错误指向D:/WorkProject/docs），PowerShell Out-File在npm启动前失败；尽管shell返回0，不能记检查通过。已改绝对日志路径并重新执行；该脚本路径错误不消耗UI产品修复轮。35份原未提交文件在合并后逐字节hash一致，见evidence/dirty-preservation-check.json。

## S0 实际工程结果与交付边界

整合327409a+原未提交补丁的工作树：npm run build exit0（含tsc）；npm run test:renderer-components exit0；npm audit --package-lock-only --ignore-scripts --json exit1，42既有漏洞（8高/26中/8低/0严重），无依赖变动。当前没有独立lint脚本，未宣称Lint通过。日志evidence/build.log、components.log、npm-audit.json。工程门禁不抵扣36项正式验收，build包含未提交补丁，因此不能把327409a提交独自认定为验证构建。

Astra第二次只读审查：36原文无差异，指出同步写入/凭证/恢复与C2提交取消/幂等/安全回退需显式承接；已补入原X编号，未降低标准。

本轮仅对账/Goal/审计文档按正常提交交付main；参考提取与版式代码尚未完整验收，保留任务分支及原未提交补丁，不把其合并进main冒充产品完成。文档交付通过隔离临时Git index从最新origin/main树叠加本轮文档，不切换或移动其他工作树。最终远端包含证明由交付时核对；若并发main推进则非强推失败保留待整合。

原始工程日志以build.log.gz/components.log.gz归档，避免忽略规则丢证据；历史副本另存gzip原字节并在history-manifest登记，跨平台Git换行不会破坏归档校验。组件确数245/245。

自动Goal与人工合同区别：用户本轮恢复active后get_goal已核实active；工具无objective更新。S0人工合同BLOCKED不冒充工具blocked，本轮同一依赖尚未达到工具要求三次连续Goal回合，未擅自调用update_goal。

## 已核实远端交付

正常原子非强推成功：main文档交付cd1e8f6500d2e7a702513d5fcd7d636f1aa271fb，任务分支e22eb3b9d53b820ef0529517776fb86b2d135bac；ls-remote逐项相符，evidence/remote-delivery.json。main相对c0009b9的apps/python差异为空，仅交付对账文档，未将半验收功能带入主线。本节后续证据提交只补报告，不改变产品构建；最终提交号由交付响应列出。

## 用户替换自动Goal后的首次复核（2026-11-03）

get_goal已实际确认objective改为执行UI-FINAL、唯一入口UI_FINAL_RECONCILED_GOAL.md，status=active；此前“自动Goal仍为旧目标”的文字仅是历史观察，现已由用户通过宿主成功替换，不再是阻断。没有把旧目标虚假标记complete。

本次git fetch origin exit0；最新main82914e9（知识库团队合同更新）相对交接c0009b9在apps/python无源码差异，故原A28领域缺失证据仍有效。已复核上述交接、固定验收、manifest、Skill、对账与RESULT；主线新K2-Q1属知识库团队，未接管也未取消。

当前唯一实际阻断仍为A28：需独立交付真实模板实体、不可变版本保存/修改/另存、结构/版式独立或同时应用、来源与归属校验、确认快照/原正式Office出口绑定及兼容证据；UI合同明确禁止本会话擅自新增领域引擎。S0合同BLOCKED，S1–S4未启动；36主项仍PASS0/FAIL0/BLOCKED1/NOT_RUN35，8增补未验。本轮只有RESULT状态记录，没有代码、模型调用、构建或产品测试变化，不将历史工程结果改标为当前全项通过。原未提交修改保留。

本次作为用户替换Goal后的首次阻断复核，环境Goal按三回合规则保持active；若后续连续复核仍同一依赖，达阈值再设置blocked，不无限追加实现或改变修复次数。恢复入口仍S0依赖复核。

本次提交前npm audit --package-lock-only --ignore-scripts --json exit1，仍42项（8高26中8低0严重），依赖文件未修改；git diff --check对RESULT通过。日志留apps/desktop/test-results/ui-final-reconcile-backup-20261103-audit.json，不当作产品测试。

## 用户显式授权A28领域补齐（2026-11-03）

用户已选择由本会话补齐A28真实模板版本与应用并同步有限合同，原“等外部A28交付”责任阻断解除；未将A28标PASS。统一Goal追加明确写集/接口/迁移兼容/来源与学生scope/旧分节保留/快照与原Office导出/回滚合同，继续固定36+8及原S0–S4；C2a已用修复1/2未清零。Astra只读核精确消费者与高危边界，Sol实施；父负责集成与实际Electron。

新实施前35份未提交文件已逐字节备份到apps/desktop/test-results/ui-final-a28-authorized-backup；最新origin/main e80c25c以正常merge整合，无冲突，其他工作树未动。图索引PaperBasketRepository查询0条（旧索引不足），后续按当前源码查读，不用图缺失推断实现不存在。

### A28 首次实现中的早审与基础验证（尚未阶段冻结验收）

Sol已新增模板/C2契约、三表增量迁移、不可变版本/receipt仓储、mapping及focused test；host/IPC/全mutation/currentness/UI尚未贯通，不能验收完成。Astra静态早审发现mapping方向和现有成员sectionId变化、retained连续应用丢失、已提交receipt被后续source_changed遮蔽、focused断言固化错误四项，均已交实施者在完整实现中修正；原不足不藏掉、不用基础测试抵扣正式A28。既有阶段修复预算仍保留，未重复冻结/新阶段清零。

父独立重跑node scripts/paper-reference-checkbox-test.mjs exit0，真实Chromium挂载生产字段及官方CSS六项通过，报告apps/desktop/test-results/paper-reference-checkbox-gO2Pch/report.json；不是Electron/完整C2a。独立QA默认offline13项及语法通过，不是产品验收。全构建/正式Electron等待生产与QA共同冻结，避免写入中把不同源码混为同一构建。

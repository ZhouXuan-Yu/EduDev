# UI-FINAL 唯一执行记录

当前状态：**BLOCKED（有限合同停止；A28已实现但未完整验收，另确认A24/A26/A27必选领域依赖缺失）**。设计版本UI-FINAL-2026-11-03；执行入口 ../../goal/UI_FINAL_RECONCILED_GOAL.md。S3累计定向修复2/2，不再追加修改。已保存任务分支checkpoint，未将半验收产品合入main、未启动窗口冒充最终交付。下文早期判断与失败保留为历史；当前逐项状态、最终工程检查和恢复要求以末尾“本轮有限合同出口”为准。

## S0 基线与对账

运行根D:/WorkProject/EduProject-sidebar；分支codex/ui-goal-implementation-20261101。初始HEAD10061eb；远端最终交接c0009b9；正常merge327409a，禁止回退53e3954。preload唯一冲突保留PaperBasketV2ImportInput及PaperReferenceAPI，自动合并PaperBasketWorkspace保留双方；未切换其他工作树、无reset/stash/清理/新模型请求。

原35份未提交/未跟踪文件已逐字节备份并校验，路径apps/desktop/test-results/ui-final-reconcile-backup-20261103；可提交历史清单见evidence/history/dirty-backup-manifest.json。未把未提交补丁算主线已交付，工作树仍保留。其他D主目录/知识库/Hana工作树及其任务不接管。

29份批准设计Git blob全部与manifest一致；原型26项不计正式验收。Astra独立只读核c0009b9：shared/paper-export.ts的paper/answer_sheet是固定输出种类，不是模板版本；paper-print-layout固定A4不是版本模板。shared/paper-blueprint.ts validPaperBlueprint仍要求考试时长总分，A24不能仅隐藏控件认定具备。paper-selection/paper-fulfillment能复用选择/缺额，不等于完整A26；A27仍未证明。A28所需模板实体/仓储/版本保存/独立应用不存在，不能在UI合同内新造领域服务。

### 修复预算

| 阶段 | 本合同实现/验收 | 已用定向修复 | 状态 |
| --- | --- | --- | --- |
| S0 | 已对账；A28授权解除旧责任阻断，复核新增三个领域依赖 | 0/2；Git整合不计产品修复 | BLOCKED A24/A26/A27 |
| S1 | 复用现有实现；实际Electron披露/导航限定复核100/100 | 0/2 | 全部对话状态/Composer保护断言未完整执行 |
| S2 | 复用资料/教学/学生/设置；同一限定复核覆盖可达和披露 | 0/2 | 业务、权限、恢复全集未完整执行 |
| S3 | A28真实版本/C2/Office接线；C2a实际5/5；C2b矩阵中止 | 累计2/2：历史checkbox1轮＋本轮六项统一修复1轮 | STOP；无下一批产品修复 |
| S4 | 整合main至任务分支、工程复验、checkpoint及报告 | 0/2 | 未满足全项条件，不向main交付半验收产品 |

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

### A28 完整首次集成冻结及验收（进行中）

b/c生产写集及QA已明确冻结后，父执行当前统一npm run build exit0（含tsc）、npm run test:renderer-components exit0，245/245。未修改OfficeComposer、全局styles/main.tsx、vendor或依赖锁。源码src指纹0c71cb2931de394d030785137c0451eefa5524b599b74bdb04860f8f9b815e8d；完整out指纹ca84e295f2a33281aaefabeeb333ad411aa5209c6d90767a14c4999fc50603b4；详细身份apps/desktop/test-results/ui-final-a28-first-freeze.json。日志同目录ui-final-a28-{build,components}-first.log。此为未提交工作树构建，不把daaadeb单独称为产品验证SHA。

父独立node scripts/paper-template-focused-test.mjs exit0；host-focused exit0，真实文件+SQLite报告a28-c2b/host-1793717889928/report.json；ui-focused exit0，真实Chromium受控IPC挂载8项，a28-c2b/ui-2zBDeS/report.json。作用域分别为DAO/真实host与受控renderer，不抵扣实际Electron。四早审问题已有针对断言；提交已完成而来源失效时不会永久锁定导航。鼠标popover历史detach失败仍保留，不能被键盘结果自动关闭。

父node scripts/ui-goal-paper-reference.mjs --check exit0，13项纯准备通过、零持久写入/模型。随后按固定out指纹从mOHpzM独立副本运行 --run-ui，exit0，ui-goal-paper-reference-hsCrWS/report.json：实际导入不同TXT/DOCX、保留真实多行/XML依据、教师核对/放弃、跨owner/私有/旧revision与版本拒绝、取消及第二次真实冷启5/5。模型0；原非空篮、来源及原baseline不变。C2a既有checkbox修复1/2已真实补验通过，不清零旧失败；该子范围通过不等于完整A28。

正式新Office首次focused验收exit1：compiler→真实generator的8DOCX/XML通过，但service安装后parse configuration。根因：office-artifact-state的lineage触发器仅覆盖v2–v6，漏v7；v7 generatorVersion亦回退旧paper-office2。原失败ui-final-a28-office-first.log保留；C2预览新出口仍关闭。上述与本轮完整冻结静态审查、实际b UI结果收齐后统一安排定向修复，不无限追加轮次，不提前合main或启动冒充最终版。

### S3 最后一轮定向修复授权与固定范围（累计2/2）

Astra完整冻结审查确认6项：P1 v7 lineage缺失、P1 uncertain核实绕过来源重验；P2 v7生成器身份回退、P2 C2预览/正式出口未贯通、P2 C2明确改分不重算分节导致不能确认、P2任一历史模板来源失效使全部健康模板列表失败。四项早审及已提交来源失效导航死锁静态关闭。安装后复核失败保留文件并转uncertain本身符合原合同；真正缺陷是后续verify无条件补saved，不能用SQL回滚能撤销文件的错误假设修复。

固定本次批次：b负责C2改分/总分与绑定、健康列表及失效状态/授权过滤、同确认快照预览及正式出口；c负责增量v7 lineage、独立生成器身份与兼容、uncertain来源/授权复核及同hash/异hash保护。不修改Composer/vendor/全局样式或其他团队任务；本轮结束仅复验失败及受影响项。历史checkbox修复1/2与本次合计2/2，不因b/c拆分或新增会话重置；仍有必选失败按合同BLOCKED停止。

首次b实际Electron BxEVoy exit1，8项通过：真实两输入导入、结构/版式各v1→v2→另存、草稿取消。随后assertMembers将派生availability true→section_mismatch误当成员变化而中止；未直接判产品丢题，已交独立QA核对完整持久事实与定位器。此次确实完成鼠标映射/应用后才断言失败，不能用历史popover detach未经复现修改组件。保留原report.error及0截图的取证缺口；QA只修适配器/失败捕获，不能删成员/实例/审核/来源/原分值断言或抵扣未执行矩阵。

### 最后批次复验及剩余依赖

最后批次全部源码冻结后，父统一build exit0（含tsc）、components exit0 245/245；host-focused exit0（a28-c2b/host-1793719371996/report.json）、Preview/Export门禁Chromium 3项exit0（s3-preview-6YnodW）；完整Office focused exit0，真实SQLite/文件安装及来源关联与uncertain恢复报告TEMP/c2-office-focused-aF72ol/report.json。Astra限定独立复核6项全部closed，无新增blocking findings；不把静态/受控测试记完整产品PASS。

最终本次测试构建身份：src 0f294d85f88872edcbbaf2c1efeb960ce3843e12116d56973f75ee4b274c9c34；out 27c832097e7fb1e86d285877ca22dedfd24a08950b3a59e18fffef6c716a60e6；QA typed/selector contract 50d1ef95f77c71def5516f5f26ac27c90301a0dd917624a4d77078ab5081adb5。ui-final-a28-final-freeze.json含逐文件身份。新QA启动前读receipt表不兼容原旧基线，未启动Electron即失败；仅将该只读观察移至真实生产启动迁移后，保留首日志和校验，不SQL造表、不算产品修复清零；源构建未变，最后实际b矩阵另录。

真实Electron disclosure-live/run-RDEmji exit0，100/100：双尺寸、两种motion、主导航/原业务目的页/设置分层、官方Disclosure交互与224个CSSOM样本、控制台/异常0。作用域不含800、真实流式过程、权限恢复和新Office文件矩阵，不能直接把全部A01–A19/A31–A36置PASS。npm audit --package-lock-only --ignore-scripts --json exit1，仍42既有（8高26中8低、0严重），无依赖文件变动；当前无独立lint脚本。

S0原待核A24/A26/A27现已确认缺真实协议：A24只有强制时长/总分的PaperBlueprint，无同篮practice/paper用途切换；A26原selectPaper从空选整卷，无锁已选成员的确认后补缺事务；A27已有真实变式/对照/入库及普通换题，但缺指定entry/改编要求/父题版本的接受回接绑定。均不能隐藏控件/重新选整卷/任意候选替换抵扣。最新授权只补A28，不扩练习用途/补缺/指定改编领域；三项保持必选BLOCKED，不擅自新引擎或续修复轮。完成已在途验证后保存分支checkpoint与证据，正式main不带入半验收功能。

协作main在本次实施期间推进至7c128494209dd554af0ac0047a95bb766f7e0a2b（知识库目录处理策略、教案设计及其他团队有限基座文档）。其独立任务/原B01失败不接管不取消；当前旧测试身份不冒充这次远端整合后的构建。后续task分支整合及受影响复核单独记录，禁止reset或移动其他工作树。

## 本轮有限合同出口：BLOCKED

用户此次仅扩展A28真实模板版本与应用的领域授权；该实现已保存，不再以“完全没有模板服务”描述当前代码。A28仍未完整通过用户路径验收；A24/A26/A27新确认的领域缺口不能由本轮UI合同擅自扩建。S3修复累计2/2已用完；本轮停止追加产品修改、设计讨论和测试适配器重试。此处状态覆盖上文早期A28责任阻断、NOT_RUN阶段与IN_PROGRESS历史描述，失败和原始报告均保留。

### 实际完成与文件目的

代码checkpoint：`dd9adcab0b97b53fa98bec02e9f9c080da645d6e`；A28补充合同：`daaadeb`。任务分支正常整合`origin/main`的`7c128494209dd554af0ac0047a95bb766f7e0a2b`，合并提交`820e0ef9571aabe2ae37579ad4569c3940c0addc`，无冲突。检查合并差分：preload保留双方typed API；production-host保留main教材来源校验和本分支C2草稿分支。没有移动其他工作树、没有强推/reset/清空数据。相对当前main，本分支产品差分56个文件；完整路径可由`git diff --name-status 7c12849 820e0ef -- apps/desktop/src`复核。

| 修改组 | 文件/入口（根apps/desktop） | 目的 |
| --- | --- | --- |
| 版本契约 | src/shared/paper-template.ts、paper-template-validation.ts、paper-basket-c2.ts | 严格版本/patch/CAS/精确绑定与C2快照，避免renderer伪造来源 |
| 真实领域 | src/main/education/paper-template-{schema,repository,read,source,candidate,mapping,currentness,snapshot,service,ipc,list}.ts | SQLite三表增量迁移、宿主重提取、不可变保存/另存、权限、独立/同时应用、幂等回执和当前性 |
| 原篮接线 | paper-basket-c2-state.ts、paper-basket-{state,repository,v2-repository}.ts、paper-repository.ts、paper-export.ts；db.ts/index.ts/preload/index.ts薄接线 | 保留原条目/实例/分值与旧schema，所有mutation避免降级；确认及原导出绑定同一精确版本 |
| 教师操作 | renderer/components/paper-ui/PaperTemplatePanel.tsx、PaperTemplateRetained.tsx、usePaperTemplates.ts、paper-template-patches.ts、PaperLayoutPreview.tsx及原Workspace/Preview/Organizer | 保存新版本/另存/明确映射与遗留分节安排/取消恢复、预览与正式出口；连续CSS预览不称真实分页 |
| 已有提取 | paper-reference-{extract,ipc,service,source,word}.ts；PaperReference{Fields,Panel}.tsx及usePaperReference.ts | 保留并补验真实TXT/DOCX核对，官方checkbox、放弃及冷启；非模拟OCR |
| 原Office链 | shared/xiaozhi-office-draft.ts、paper-{blueprint,export,layout}.ts；main/xiaozhi-agent/office-{artifact-state,artifact-service,generator,pdf-renderer,images}.ts、paper-layout-{docx,html}.ts及production-host.ts | 新schema v7/独立生成器身份、版式分支、原Pi审批/授权/图像/安装、来源失效与uncertain核实；保留旧分支 |
| 验证及证据 | scripts/paper-template-*、scripts/acceptance/paper-template-*、scripts/ui-final-paper-template.mjs、paper-c2-office-focused-test.mjs及本审计evidence | 真实宿主/SQLite/文件验证、限定UI适配器、原始失败与构建身份归档；不是完整产品验收替身 |

OfficeComposer、全局styles.css、renderer/main.tsx、vendor及依赖锁本轮未改；相对初始10061eb核对这些保护路径diff为空。不把源码未改等同其全部运行态已验。旧版式基础29件归档、A28归档manifest和逐文件hash均保留；未上传用户资料/凭证，测试未追加模型调用。

### 合并后仅一次受影响工程复验

本节工程证据来自合并后的820e0ef，而上文C2a/C2b及100项Electron证据来自合并前冻结源码，身份不可混用。

| 命令（apps/desktop） | 真实结果 | 证据/边界 |
| --- | --- | --- |
| npm run build | exit0，含tsc | ui-final-a28-postmerge-build.log；不是正式Electron产品验收 |
| npm run test:renderer-components | exit0，245/245 | ui-final-a28-postmerge-components.log；Vite非致命警告Port 24678已占用，未杀其他进程 |
| node scripts/paper-template-host-focused-test.mjs | exit0 | a28-c2b/host-1793720987098/report.json；真实SQLite/TXT/DOCX、权限/来源/迁移/分值/回执/冷读，非UI整路径 |
| node --experimental-transform-types scripts/xiaozhi-agent/paper-c2-office-focused-test.mjs | exit0 | TEMP/c2-office-focused-P98GmW/report.json；8个DOCX/XML及真实授权目录安装/来源失效/uncertain恢复；非PDF或实际Pi验收 |
| npm audit --package-lock-only --ignore-scripts --json | exit1 | 42既有漏洞：8高/26中/8低/0严重；未改依赖，未批量升级 |
| git diff --check | exit0 | 提交前最终复核；无独立Lint脚本，未宣称Lint通过 |

本次合并后源码指纹`606f6ae644546f0db4d0b362be30c195b455df8edfb35e39b424ec70bfcf899d`；out指纹`e18fc91819521919acc53bb83debed2e248584fad47bcea88213509546ca73cc`。逐文件身份ui-final-a28-postmerge-freeze.json及日志原字节gzip归档见evidence/a28/manifest.json。没有用合并前截图给这个新构建背书；无当前全UI性能前后数据，不编造P95、内存或无退化结论。

### 实际UI失败、截图与未执行边界

最终C2b实际Electron报告`ui-final-paper-template-wePJGK/report.json` exit1：8项先行检查通过、一次真实结构apply receipt、修订6、integrityVerified=true。`paper-template-run.mjs:102`在structure-only应用后比较两个均未设置的layout；`paper-export-intent-evidence.mjs:15`的jsonEqual对undefined执行JSON.parse，抛出`"undefined" is not valid JSON`。已只读定位为测试适配器错误，冻结不再改脚本/重启矩阵；不能说后续独立版式/同时应用/安排/冷启/来源失效已通过，也不把该错误说成已确认产品丢题。此前BxEVoy和启动前receipt观察失败日志均保留。

可审查截图：evidence/a28/home-1366.png、knowledge-1366.png、template-actual-failure-1920.png。前两张为合并前真实披露专项，第三张为实际模板矩阵中止现场；无造出的“全部通过后”截图或同构建前后对比。原100/100 Electron披露专项覆盖1366/1920及motion/224个CSSOM/零console异常；它不覆盖800、完整流式/停止/审批/Composer及数据恢复。C2a 5/5的两次启动同样不能抵扣C2b或新Office路径。A30仍缺实际Pi→审批→C2确认快照→真实Word/PDF/答题卡矩阵与图片/公式/分页人工核对；独立helper和focused安装不作为完整正式输出验收。

### 新确认领域阻断及恢复所需动作

| ID | 位置/触发条件 | 影响及恢复所需最小领域交付 |
| --- | --- | --- |
| A24 | shared/paper-blueprint.ts:15；renderer/components/paper-ui/PaperBasketBlueprintForm.tsx:35。已有三题想直接出练习或在练习/试卷间切换 | 现有蓝图仍要求考试时长/总分；独立practice-review不是同篮用途。需要同一持久篮purpose契约、切换保留实例/分值/来源和草稿保护，不能仅隐藏考试字段 |
| A26 | main/education/paper-selection.ts:13、:19；现有完整create协议。已有手选题，确认命题方案后只补缺 | 原selectPaper从空集选整卷，没有锁已选成员、expected basket revision和确认方案的补缺事务。需最小补缺协议，保留原题并严格报告缺额，不暗放宽 |
| A27 | main/education/question-review-repository.ts:165；renderer/components/paper-ui/PaperCandidateBrowser.tsx:146；shared/paper-basket-v2.ts:22。指定篮内原题改编并接受 | 真实变式与对照可复用，但缺entry意图/改编要求/确切父版本→接受回接绑定，普通任意换题不能抵扣。需显式接受后精准回接并保持位置/分值的窄协议 |

三项均为固定必选，保持BLOCKED而非N/A；不改变其他团队已分配任务。恢复需先明确这三项领域交付责任及有限合同，再补未完成UI/Office验收与可复现适配器问题；不是自动开启第三轮A28产品修复。不删除断言，不把旧通过或原型当正式能力。

### 当前固定集合结果（逐项，覆盖早期状态）

| ID | 当前状态 | 当前证据限制/剩余动作 |
| --- | --- | --- |
| A01 | NOT_RUN | 导航限定实操通过；全会话/空间/权限集合未完成 |
| A02 | NOT_RUN | 首页截图/披露可复用；真实成果提示与普通工具不抢栏待完整验 |
| A03 | NOT_RUN | 保护路径未改；原IME/附件/弹层与草稿全集待验 |
| A04 | NOT_RUN | 限定CSSOM已采样；Composer官方交互全集待验 |
| A05 | NOT_RUN | 真实公开事件时序未在当前构建完整复验 |
| A06 | NOT_RUN | 真实工具图标/结果/run完整状态未验 |
| A07 | NOT_RUN | 正文边界折叠及手动重开不抢回未完整复验 |
| A08 | NOT_RUN | 顶部计时冻结/无公开活动不造时长未完整复验 |
| A09 | NOT_RUN | 停止/失败/审批恢复全集未验 |
| A10 | NOT_RUN | 长对话/滚动/冷启run恢复全集未验 |
| A11 | NOT_RUN | 资料入口披露通过；组合筛选/检索全集未验 |
| A12 | NOT_RUN | 来源/原页/校正全集未验 |
| A13 | NOT_RUN | 导入解析/索引/取消重试全集未验 |
| A14 | NOT_RUN | 工作台入口通过；各成果编辑/版本/保存全集未验 |
| A15 | NOT_RUN | 学生页入口通过；全学生业务上下文未验 |
| A16 | NOT_RUN | 迟到请求/未保存草稿/重启绑定未完整验 |
| A17 | NOT_RUN | 设置分层披露通过；真实配置失败与生效全集未验 |
| A18 | NOT_RUN | A28宿主权限专项通过；全备份恢复与权限未验 |
| A19 | NOT_RUN | main课堂实现已保留；实际课堂/教师核对全集未验 |
| A20 | NOT_RUN | 已有真实题篮入口复用；完整页面验收未完成 |
| A21 | NOT_RUN | 图文/来源等全筛选集合未验 |
| A22 | NOT_RUN | 题篮一致性focused不能替完整去重UI |
| A23 | NOT_RUN | C2a限定冷启通过；全选题/编辑/预览导航恢复未验 |
| A24 | BLOCKED | 缺同一题篮练习/试卷用途契约 |
| A25 | NOT_RUN | C2a真实文件提取通过；上传/粘贴选题全集未验 |
| A26 | BLOCKED | 缺确认方案与锁定已选成员的补缺事务 |
| A27 | BLOCKED | 缺指定改编接受后精确回接原entry协议 |
| A28 | NOT_RUN | 真实版本服务已实现；实际UI矩阵被adapter错误中止，不完整通过 |
| A29 | NOT_RUN | currentness/快照focused通过；全编辑失效UI未验 |
| A30 | NOT_RUN | DOCX安装/恢复focused通过；正式Pi输出/PDF/分页全集未验 |
| A31 | NOT_RUN | 双尺寸限定截图；800及全页可操作未完成 |
| A32 | NOT_RUN | Disclosure键盘/两motion通过；全部控件与焦点归还未验 |
| A33 | NOT_RUN | 限定披露零console；完整聊天及业务状态全集未验 |
| A34 | NOT_RUN | 合并后build/245/host/Office专项通过；关键全smoke/性能集合未完成 |
| A35 | NOT_RUN | main已合入task；不向main合并半验收功能，不能称最终整合完成 |
| A36 | NOT_RUN | 未满足全项条件，未启动最终产品供验收 |

合计36：**PASS0 / FAIL0 / BLOCKED3 / NOT_RUN33**。完整条目中部分检查通过不升级整条PASS；实际QA exit1及历史产品失败仍在原报告，不被此整项汇总洗掉。X01–X08全部NOT_RUN：X02/X05/X06部分宿主/C2/Office断言有证据，未覆盖完整UI和权限恢复集合，不能整项通过。

### Git交付、回滚和停止状态

本次只交付任务分支checkpoint与本报告；不把未完成产品推main。交付前检查完整diff及审计、保护两份根test-results/paper-layout-focused-*未跟踪产物，无删除/覆盖。最终任务分支提交号及非强推远端一致性由推送后现场核验，写入本地test-results/ui-final-a28-task-delivery.json并在最终回复列出；不把820e0ef声称已是远端最终报告提交。

回滚应先审查dd9adca及其后限定提交，在任务分支revert受影响入口；main没有这次半验收产品，不做main reset/强推。保留SQLite新表、不可变模板历史、旧篮/实例/确认/文件与新schema读器；不能降级到latest或去掉来源/版式拒绝。原35文件备份及证据manifest可审查，不能用删除新表或用户文件模拟恢复。

人工有限合同现在BLOCKED并停止；get_goal实际仍active，其旧A28禁止新增措辞已被用户最新授权覆盖，工具不支持改objective。此次首次确认A24/A26/A27新阻断，未满足同一阻断三次连续Goal回合，故不虚假complete、不擅自pause、不声称工具已改blocked。不会因宿主仍active自动追加产品修复；恢复须按上文有限依赖处理。

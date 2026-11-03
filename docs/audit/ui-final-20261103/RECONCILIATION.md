# UI-FINAL 任务合并清单

日期2026-11-03；只替代本会话UI队列，不修改Master Goal或其他AI任务。

| 旧任务 | 实际情况 | 新验收 | 代码与历史证据 | 剩余动作 | 依赖 / 责任人 |
| --- | --- | --- | --- | --- | --- |
| U0 基线 | 有历史CSS与组件证据，非当前全页通过 | A01/A03/A04/A31/A32 | FINAL_VALIDATION.md；office/OfficeComposer、product/ProductSpaceShell | 按最终构建复核污染/输入/旧路由 | 既有HeroUI；UI实施者 |
| U1 过程/正文 | 历史M4运行中重开续流；完整parity未验 | A05–A10、X01/X08 | office/过程组件与旧FINAL_VALIDATION；原构建M4 | 按冻结时序实测，不再追求开放式逐像素竞品一致 | Pi公开事件；UI实施者；Pi引擎属原团队 |
| U2 首页/外壳 | 已实现切片，最终设计映射待复核 | A01–A04 | product/ProductSpaceShell、office/OfficeComposer | 必要复核，禁止重做composer | UI实施者 |
| U3 资料库 | KB57仅受控边界；自然整卷历史质量失败保留 | A11–A13/A16、X03/X04 | product/MaterialsWorkspace；main/assets；原KB记录 | 真实资料分层/队列/版本/冷启；质量引擎不接管 | KB团队服务；UI实施者投影 |
| U4-A 持久选题 | 已交付旧构建；不等于最终A20–24通过 | A20–A24 | paper-ui/PaperBasketWorkspace；paper-basket仓储；U4_A合同 | 当前构建恢复/筛选/用途路径复验 | 题篮真源；UI实施者 |
| U4-B 实例编辑 | 旧构建桌面9项及六格式13项限定通过 | A27/A29/A30、X05/X07 | U4_B_DESKTOP_VALIDATION、U4_B_OFFICE_DESKTOP_VALIDATION | 复用实例、审核、来源及学生答案隔离；改编闭环另核 | 原组卷服务；UI实施者 |
| U4-C1 资料回接 | 历史6项/双启动12图；限定通过 | A25/A16、X02/X04 | e265ec3；U4_C1_DESKTOP_VALIDATION | 取消不写、显式加入、异步草稿保护复核 | 原导入/抽题；UI实施者 |
| U4-C2a 参考提取 | 2d2a35a代码；首次Electron tqyAoo失败；checkbox修补仅Chromium6项历史通过 | A28/A32、X02/X06 | paper-reference-*；evidence/reference-first-failure.json；未提交补丁备份 | 完整Electron未补验；提取不冒充模板应用 | A28领域依赖阻断；UI实施者 |
| U4-C2b 模板版本/应用 | 尚未实现 | A28、X05/X06 | origin/main无模板实体/仓储/保存应用IPC；参考提取API不是模板API | 必须先由领域责任人交付独立合同，不在UI合同新造引擎 | 组卷领域责任人；本会话不自动接管 |
| U4-C2c 版式导出 | e2704cd纯helper；4DOCX/4PDF独立验证，未接正式链 | A28/A30、X07 | paper-layout-*；u4c2-layout-base；非正式Office出口 | 模板/快照绑定先到位，再接原正式Office出口并实开文件 | C2b→原Office责任人；UI投影 |
| U4-D1 当前卷绑定 | 旧构建正常/竞争8项、补验4项限定通过 | A29/A30、X06/X07 | 20a8382；U4_D1_DELIVERY；mOHpzM/kWaJSj | 当前构建旧意图拒绝/原授权链复核，不重复重建 | 原Pi/导出服务；UI实施者 |
| U4 用途/需求/改编 | 有蓝图/缺额/实例基础，完整用途及对照确认闭环未证实 | A24/A26/A27 | validPaperBlueprint强制考试字段；paper-selection/paper-fulfillment | 逐项核服务；未具备不能靠隐藏字段/固定结果补齐 | 组卷领域依赖，A28已触发总阻断 |
| U5 工作台/设置 | 有归档/备份局部证据，整套未验 | A14–A18 | StudentWorkbench、PiSettingsWorkspace；旧FINAL_VALIDATION | 选择上下文/草稿/权限/实际恢复复核 | 原服务；UI实施者 |
| U6 课堂 | 工程限定接受，内容55/70非整体接受 | A19、X02 | 旧FINAL_VALIDATION；原备课/互动/审阅接口 | 仅投影已有真实能力，缺依赖显式阻断 | 课堂领域原责任人；UI投影 |
| U7 集成 | 旧交付存在；本轮327409a整合c0009b9，尚未UI验收 | A31–A36 | Git历史及RESULT | 全项通过才发布产品；BLOCKED不宣称最新试用交付 | 集成者本会话 |
| 旧“继续美化/重选视觉/像素级ChatGPT复刻/待视觉设计确认” | 已被最终设计替代 | A01–A10/A31–A33 | UI_FINAL_HANDOFF | 按批准HTML和固定行为验收，不追加竞品调研 | 无新设计讨论 |
| 旧DeepTutor/OpenMAIC同输入全量质量/全科/40GB/安装包 | 本合同外保留，不认定完成、不取消其他任务 | 不纳入UI固定出口 | 旧Goal归档及Master独立任务 | 移交原领域队列；不得因此无限延长UI任务 | 原团队/用户未来独立合同 |

## 原逐项要求去向（原文见不可变历史副本）

| 旧编号 | 唯一新验收去向 | 处理 |
| --- | --- | --- |
| UI-BASE-01 | A04 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-BASE-02 | A01 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-BASE-03 | A03 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-BASE-04 | A31/A32 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-01 | A05/A06 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-02 | A07 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-03 | A08 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-04 | A06/A09 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-05 | A09/A10 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-CHAT-06 | X08 | UI不强行拆合正文要求保留；模型/学科质量部分移交原合同外队列，未认定完成。 |
| UI-HOME-01 | A02/A03 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-HOME-02 | A02/A09 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-HOME-03 | A01 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-HOME-04 | A03/A32/X01 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-01 | A11 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-02 | A12/X04 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-03 | A13 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-04 | A13/X03 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-05 | A12/A16 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-KB-06 | A11/A12/A13/X04 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-PAPER-01 | A26/A28/X05 | 蓝图/来源策略部分复用；模板版本应用领域缺失，A28阻断。 |
| UI-PAPER-02 | A26/A29/X05 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-PAPER-03 | A29/X06 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-PAPER-04 | A29/A30 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-PAPER-05 | A30/X07 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-PAPER-06 | A30/X07 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-STUDENT-01 | A15/A16 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-STUDENT-02 | A15/A18 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-STUDENT-03 | A16/A33 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-SETTINGS-01 | A17 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-SETTINGS-02 | A17/A18 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-SETTINGS-03 | A18 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-LESSON-01 | A19 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-LESSON-02 | A19/X02 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-LESSON-03 | A19/A18 | 要求保留；实现与当前构建待核，不继承PASS。 |
| UI-LESSON-04 | A19/X02 | 要求保留；实现与当前构建待核，不继承PASS。 |

所有旧编号均有去向；X08仅保留普通解释可读性与不强行改正文的UI边界，原字数/学科/模型质量研究归合同外历史，不降低领域验收。

独立审查修正：UI-HOME-04同步写入阻断→X01；UI-SETTINGS-02凭证不入截图/日志及03恢复预览/取消/失败/冷启→X07/A18；C2预提交取消回滚/提交事实/幂等核实→X02，回退保留schema读器及来源/布局拒绝→X06。未新增编号。

# 小智 UI / UX R1：工程化执行包

版本：2026-11-24。包编号：XIAOZHI_UI_UX_R1_20261124。

**用途：交给执行 AI，在现有小智代码上完成一轮可以结束的界面与使用体验改造。正常修复不限轮次；达到本包完成定义即交付停止。**

本包是执行合同和验收工具，不是已经改造完成的软件，也不是产品验收报告。包内所有运行验收初始均为 NOT_RUN。

## 1. 给执行 AI 的起始指令

阅读本文件，然后以 01_EXECUTION_GOAL.md 为本轮唯一任务入口，依次读取 docs/01_SCOPE_AND_DECISIONS.md、docs/02_BASELINE.md、docs/03_PAGE_UX_SPEC.md 和 docs/04_COMPONENT_POLICY.md，再按 docs/06_IMPLEMENTATION_PLAN.md 执行。验收依据 docs/07_ACCEPTANCE.md 与 acceptance/criteria.json，收敛规则见 docs/09_COMPLETION_PROTOCOL.md。

先完成 Phase 0 的真实仓库、运行版本、页面、组件、并行任务和接口审计，随后在授权范围内连续实施、验证、修复与交付。不要只交计划；不要逐项询问例行布局选择。必要依赖阻塞时完成可独立部分，交付明确 BLOCKED 报告后结束。

## 2. 范围一眼看清

- 保留已确定的灰白、克制风格和现行页面职责；优化页面定位、主次、排版、控件、状态、操作反馈、返回与工作连续性。
- 逐页盘点当前 18 个页面合同和其实际可见入口，优先修复全局外壳、设置、任务，再处理资料、教学、组卷和学生页面。
- 小组件复用项目现有 HeroUI / 可用 HeroUI Pro；替换突兀默认黑三角，保留交互和可访问性。
- 保护 OfficeComposer、工具栏及弹层；同时保护主线最新消息队列和 PiComposerPendingPanel 的行为。
- 配置、模型、权限、记忆、数据库与 Harness 由原负责方维护。本轮通过真实接口改善呈现，不另写一套业务。
- “重新分工三个入口”“教学工作台成果优先首页”“设置固定六大分类”仍为后续提案，本轮不作为已批准的全量信息架构迁移。

## 3. 与旧文件的关系

本次用户已要求整理正式执行任务，先前交接记录中“等待正式交接、暂不开发”的阶段性约束，现对本包授权的 UI R1 范围结束。

本次用户明确“正常流程中的优化，不限制修改次数”，替代旧设计决策 D15 和 docs/goal/UI_FINAL_IMPLEMENTATION_GOAL.md 中“每阶段最多两轮、同一失败最多两轮”的固定次数限制。有限范围、权限保护、真实验收和完成即停止继续有效。

本包不宣告旧 UI-FINAL 的 36 项已经通过，也不把旧合同全部业务能力重新交给 UI AI 开发。36 项必须建立影响映射；本轮改动触及的行为、保护行为与本包必选验收不得删除或豁免。其他旧项保持原状态并如实登记，不伪造 PASS。

## 4. 使用方式

1. 将压缩包解压到执行 AI 可以读取的目录，保持文件夹结构；不要把本包文件直接覆盖仓库 AGENTS.md 或现有工程合同。
2. 将 01_EXECUTION_GOAL.md 的内容交给执行 AI，或让其直接读取该文件。外部单独提供的 XIAOZHI_UI_UX_R1_GOAL.md 是它的同内容副本。
3. 执行 AI 找到用户实际工程。仓库约定常见根为 D:/WorkProject/EduProject；必须现场核对，不能凭此路径宣称找到或启动了应用。
4. 在本轮记录中同步本包编号、范围、旧轮次覆盖说明与状态。用户正式验收目录沿用 D:/WorkProject/EduProject/acceptance/ui-ux-r1-20261124，实际根不同则使用其 acceptance 子目录。
5. 执行结束只交一次完整结果：UI_R1_DONE 或 BLOCKED。DONE 后等待用户反馈，不维持自动循环。

## 5. 文件导航

| 文件 | 作用 |
| --- | --- |
| 01_EXECUTION_GOAL.md | 可直接作为 Goal 的总任务 |
| docs/01_SCOPE_AND_DECISIONS.md | 确认事项、授权变化、保护范围和待讨论项 |
| docs/02_BASELINE.md | 本次核实的代码、截图和依赖事实 |
| docs/03_PAGE_UX_SPEC.md | 按页面组织的可执行 UX 要求 |
| docs/04_COMPONENT_POLICY.md | HeroUI 复用和样式边界 |
| docs/05_PARALLEL_CONTRACT.md | 与配置 / 底座执行方的协作合同 |
| docs/06_IMPLEMENTATION_PLAN.md | 阶段、任务顺序和产出 |
| docs/07_ACCEPTANCE.md | 28 项新增专项验收与判据 |
| docs/08_TEST_RUNBOOK.md | 实机操作、场景数据、证据与命令 |
| docs/09_COMPLETION_PROTOCOL.md | 有进展迭代、阻塞收尾和停止规则 |
| docs/10_RESEARCH.md | 官方成熟方案、采用方式和边界 |
| tasks/backlog.csv | 带依赖和验收编号的任务清单 |
| acceptance/criteria.json | 新增专项验收编号的机器可读来源 |
| templates/ | 页面、组件、接口、旧门禁、缺陷、报告和运行状态模板 |
| scripts/validate_delivery.py | 检查报告完整性、证据路径 / 哈希及 DONE 条件 |
| references/PREVIOUS_UI_DECISIONS.md | 上一轮决策原文归档；阶段变化以本包为准 |
| MANIFEST.json | 本包文件清单与 SHA-256 |

脚本只能检查报告一致性，不能凭空证明实际产品通过。真实 Electron、数据 / 文件 readback、必要工程门禁与人工视觉检查必须由执行 / 验收 AI 完成。

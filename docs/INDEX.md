# 文档地图：先读入口，再按任务取用

通过当前入口找任务与证据。历史命令、授权和“下一步”按各自的日期和适用版本理解。

## 默认最小阅读集

1. [AGENTS](../AGENTS.md)：协作规则、数据/权限保护、验证与文档更新方式。
2. [当前状态](goal/CURRENT_STATE.md)：当前事实、边界与工作线。
3. 从下面选当前任务的路线，再核对相应源码和证据。

## 任务路由

| 任务 | 先读 | 继续按需读 |
| --- | --- | --- |
| 知识库、抽题、组卷 | [活动索引](goal/KB_EXAM_ACTIVE_TASK.md) | [架构](architecture/KNOWLEDGE_BASE.md)、[实施合同](goal/KB_IMPLEMENTATION_CONTRACT.md)、[证据索引](goal/KB_IMPLEMENTATION_EVIDENCE.md) |
| UI/交互 | [设计技能](../.agents/skills/edudev-design/SKILL.md)、[设计系统](design/system/README.md) | 技能指向的决策台账、目标目录 [renderer 规则](../apps/desktop/src/renderer/AGENTS.md)、相关真实界面证据 |
| 跨模块产品/架构边界 | [Master](goal/XIAOZHI_CODEX_GOAL.md)相关合同章节 | [产品](product/CURRENT.md)、[架构](architecture/CURRENT.md)、[集成](integrations/CURRENT.md)相关章节 |
| 验收与发布判断 | [验收入口](acceptance/CURRENT.md) | [能力矩阵](goal/CAPABILITY_MATRIX.md)、[验收台账](goal/ACCEPTANCE.md)、[前端 E2E 矩阵](26_FRONTEND_E2E_COVERAGE_MATRIX.md)、具体冻结构建报告 |
| 历史决策与原因 | [决策台账](goal/DECISIONS.md)相关条目 | [进度记录](goal/WORK_PROGRESS.md)、旧编号文档、对应证据 |
| 启动/环境 | [启动说明](../启动.md) | 实际 package 脚本、锁文件和本机环境 |

## 协作与历史资料

- 项目规则统一维护在根目录 [AGENTS.md](../AGENTS.md)。[恢复入口](../2.Memory.md)、[教训](../3.Learning.md) 和 [稳定事实](../4.Wiki.md) 各自记录对应内容。
- [2026-08-30 AI 路由实施记录](archive/ai-routing-20260830/progress.md) 与 [2026-10-05 架构审计](archive/architecture-review-20261005/XIAOZHI_THREE_REPO_DEEP_AUDIT_2026-10-05.md) 为历史资料。历史脚本中的文件路径对应各自的原构建和仓库版本。
- [旧根目录执行约定](https://github.com/ZhouXuan-Yu/EduDev/blob/dcf273bf28e123cc0fa05cbe050ae88f5d3cc6cc/1.Agent.md) 和 [旧 Claude 项目约定](https://github.com/ZhouXuan-Yu/EduDev/blob/dcf273bf28e123cc0fa05cbe050ae88f5d3cc6cc/CLAUDE.md) 可从 Git 查阅。
- [2026-07-28 早期规划与 UI 预览](archive/legacy-product-planning-20260728/README.md) 保留 MVP、中控台和旧多用户方案。
- `28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md`、旧 P04/P05 排程及 `docs/design/**/source/` 记录冻结时的架构、计划与证据。

## 维护方式

- 当前摘要在 `goal/CURRENT_STATE.md` 覆盖更新，知识库下一步在活动索引更新。
- 规则/接口/产品决定只更新对应主要文档；其他地方链接，不复制整段测试日志。
- 一轮详细证据只存一处，注明提交/构建、环境、命令、结果及未验证范围。旧失败和原始报告不改写。
- 新任务先有有限范围，完成、失败或明确阻塞后收尾；历史 ACTIVE 不自动创建下一任务。
- 本次入口修改的原文与哈希见[快照索引](archive/entry-baseline-20261109-a828e062/INDEX.md)。

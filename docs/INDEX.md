# 文档地图：先读入口，再按任务取用

本轮只整理 AI 默认入口和当前状态，不批量分类、移动或删除整个 `docs/`。文档路径存在不代表内容全部现行；历史命令、授权转述和“下一步”须结合日期、适用版本与当前用户请求判断。

## 默认最小阅读集

1. [AGENTS](../AGENTS.md)：协作规则、数据/权限保护、验证与文档更新方式。
2. [当前状态](goal/CURRENT_STATE.md)：当前事实、边界与工作线。
3. 当前任务对应的一项路由，以及实际源码/证据。Claude 另有薄入口 [CLAUDE](../CLAUDE.md)。

## 任务路由

| 任务 | 先读 | 继续按需读 |
| --- | --- | --- |
| 知识库、抽题、组卷 | [活动索引](goal/KB_EXAM_ACTIVE_TASK.md) | [架构](architecture/KNOWLEDGE_BASE.md)、[实施合同](goal/KB_IMPLEMENTATION_CONTRACT.md)、[证据索引](goal/KB_IMPLEMENTATION_EVIDENCE.md) |
| UI/交互 | [设计技能](../.agents/skills/edudev-design/SKILL.md)、[设计系统](design/system/README.md) | 技能指向的决策台账、目标目录 [renderer 规则](../apps/desktop/src/renderer/AGENTS.md)、相关真实界面证据 |
| 跨模块产品/架构边界 | [Master](goal/XIAOZHI_CODEX_GOAL.md)相关合同章节 | [产品](product/CURRENT.md)、[架构](architecture/CURRENT.md)、[集成](integrations/CURRENT.md)相关章节 |
| 验收与发布判断 | [验收入口](acceptance/CURRENT.md) | [能力矩阵](goal/CAPABILITY_MATRIX.md)、[验收台账](goal/ACCEPTANCE.md)、[前端 E2E 矩阵](26_FRONTEND_E2E_COVERAGE_MATRIX.md)、具体冻结构建报告 |
| 历史决策与原因 | [决策台账](goal/DECISIONS.md)相关条目 | [进度记录](goal/WORK_PROGRESS.md)、旧编号文档、对应证据 |
| 启动/环境 | [启动说明](../启动.md) | 实际 package 脚本、锁文件和本机环境 |

## 本轮没有重写的历史型入口

`1.Agent.md`、`2.Memory.md`、`3.Learning.md`、`4.Wiki.md`、Master、领域 `CURRENT.md` 与 Goal 台账仍保留原路径和全文；它们混有稳定约束和历史日志。检索相关章节后核对证据，不每轮全读，也不再机械地全部追加更新。不能因为某规则在旧文件中就擅自放宽它，遇到真正冲突报告并请求当前决定。

`28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md` 是历史基线，旧 P04/P05 排程不是当前状态。`docs/design/**/source/` 等冻结快照不是可随意删除的冗余文件，本阶段不处理。

## 维护方式

- 当前摘要在 `goal/CURRENT_STATE.md` 覆盖更新，知识库下一步在活动索引更新。
- 规则/接口/产品决定只更新对应主要文档；其他地方链接，不复制整段测试日志。
- 一轮详细证据只存一处，注明提交/构建、环境、命令、结果及未验证范围。旧失败和原始报告不改写。
- 新任务先有有限范围，完成、失败或明确阻塞后收尾；历史 ACTIVE 不自动创建下一任务。
- 本次入口修改的原文与哈希见[快照索引](archive/entry-baseline-20261109-a828e062/INDEX.md)。

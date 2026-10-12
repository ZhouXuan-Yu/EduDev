# 小智 AI Harness：源码审计与下一轮重构入口

日期：2026-10-12。**本轮为设计交付，不是功能修复验收。没有重启日常应用、调用付费模型、修改业务源码或安装依赖。** Master Goal 仍 ACTIVE，既有教育业务切片的完成范围保持原记录。

## 结论与推荐

推荐 **方案 B：保留 Pi 原生执行循环，重构小智宿主的核心 Harness 控制面**。以增量切片实施，不重写 Pi、不接 Codex CLI、不再增加 DeepTutor / OpenMAIC / LangGraph 调度循环。

小智已有真实模型选择工具、执行后继续、流式回执和权限控制，不能简单称为聊天包装。但它尚缺统一的任务执行与验收系统：计划状态由模型声明，目标证据主要是工具标签，正常结束并保存回复仍能成为“已完成”。复杂任务目前难以逐步骤核验、可靠恢复和解释计划变更。

优先级：**结果验证与完成语义 → 持久事件和恢复 → 工具可靠性 → 上下文与决策 → 事件 UI → 同环境实例验收**。界面不负责判断任务成功。

## 交付目录

| 交付 | 文件 | 内容 |
| --- | --- | --- |
| A | [A_CURRENT_ARCHITECTURE.md](A_CURRENT_ARCHITECTURE.md) | 日常入口、完整执行链、数据与权限真源、回答任务书中的架构问题 |
| B | [B_FINDINGS.md](B_FINDINGS.md) | P0/P1/P2、已证实/风险/假设、源码论证、成本与验收 |
| C | [C_SOURCE_REUSE.md](C_SOURCE_REUSE.md) | mu 与全部指定参考项目的准确源码、许可、版本、复用边界 |
| D | [D_TARGET_HARNESS.md](D_TARGET_HARNESS.md) | A/B 取舍、目标接口、生命周期、事件、工具协议、上下文及迁移 |
| E | [E_EVENT_UI.md](E_EVENT_UI.md) | HeroUI 真实查询、组件接入、视觉与交互、失败/恢复/验证呈现 |
| F | [F_NEXT_GOALS.md](F_NEXT_GOALS.md) | 依赖顺序、每个 Goal 的文件、实现、测试、DoD 和回滚 |
| 证据 | [EVIDENCE.md](EVIDENCE.md) / `evidence.json` | 实读核心文件定位、SHA、版本与覆盖边界 |
| 检查 | [REQUIREMENTS_CHECK.md](REQUIREMENTS_CHECK.md) | 任务书逐项覆盖、未进行的运行验证 |
| 索引 | `source-index.json` / `mu-index.json` | 文件目录索引；索引不等于每个文件均已审阅 |

## 已确认的三项 P0

1. `production-host.ts:519–546` 的正常终止与保存成功不能证明教师目标完成；关键工具失败没有通用验收门禁。
2. `publicEvent:162–168` 仅更新活跃内存和发送页面事件，公开工具时间线在终态集中保存；`PiEducationWorkspace:117–145` 不补事件缺口。完整事件回放与崩溃恢复存在结构缺口，具体丢失窗口待实例验证。
3. `production-host.ts:380` 的 `limitsEnforced:false` 关闭生产运行总预算，`goal-coordinator:20–31` 以整段文字指纹判断重复；文字变化可绕过该保护。需将费用选择与无进展/失控保护分离。

以上为源码结论，**不是本轮已复现故障统计**。参考仓库没有被运行，其测试通过率没有被本轮证明。

## 下一轮启动方式

以 `F_NEXT_GOALS.md` 的 H01 为首个独立 Goal，先冻结构建、记录当前能力和失败样本，随后 H02 验证契约。不要一次开启全部 Goal，也不要在 H02/H03 验收前建设新的过程页面。

本轮依据：[mu 固定源码](https://github.com/qybaihe/mu/tree/faed8c364323c477399b1dc2ef1d2fa36ce51267)、[HeroUI Chat Tool 官方文档](https://heroui.pro/docs/react/components/chat-tool)。具体复用依据与本地代码见 C/E/证据表；不能以产品宣传代替源码。

## 文档验证

在项目根运行 `python docs/audit/harness-2026-10-12/validate-audit-docs.py`，结果写入 `validation.json`。只检查交付结构、引用、源码SHA、状态文档标记及差异格式；应用功能执行数为0，不能据此关闭图片或联网故障。

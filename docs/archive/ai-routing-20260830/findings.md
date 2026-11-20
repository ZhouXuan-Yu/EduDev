# 小智 AI 优化发现

## 当前证据

- 桌面端已启动，窗口标题为 `Omni-Edu Agent`，窗口句柄非零且进程响应正常。
- codebase-memory 项目 `D-WorkProject-EduProject` 状态为 ready。
- 图谱入口显示 AI 主链涉及 `runDeepTutorConsole`、`compileAiContext`、工具注册、DeepSeek 请求、结构化回复解析与评分门禁。
- `runAiConsole` 是 renderer 侧提交入口，`runDeepTutorConsole` 是 preload/主进程入口；现有链同时覆盖 route/capability、progressive tools、结构化回复、教育与可用性评分。
- 项目已经有 `ai-agent-runtime-smoke`、`ai-tool-calling-smoke`、`ai-usability-replay-smoke`、`electron-smoke` 等轻量脚本，可直接收敛成按键模拟与批量样例，不需要引入新测试框架。
- 外部 Skill 搜索结果安装量较低，且没有明显优于本地 `ai-regression-testing` 的轻量方案，本轮不安装额外 Skill。

## 待 Sol 输出

- 当前过重判定链的具体位置与影响。
- 2025-2026 主流 Agent 产品的轻量路由和动态上下文方案。
- 可直接交给 Luna 的最小修改规格。

## 外部主流方案（官方资料）

- Anthropic 2025 context engineering：上下文是有限资源，应按每轮任务挑选最有用的信息；上下文膨胀会带来注意力下降。
- Anthropic 2025 advanced tool use：工具定义应按需发现，常用只保留 3-5 个，其他延迟加载；其公开案例同时降低 token 与错误选工具概率。
- Anthropic 2026 harness design：每一层 harness 都代表“模型做不到”的假设，应持续验证并采用能完成任务的最简单方案，只在必要时增加复杂度。
- OpenAI Agents SDK：工具可以条件启用、命名空间化和延迟加载；简单回答可使用 `tool_choice=none/auto`，风险动作再进入审批与 guardrail。
- OpenAI practical guide：用单一基础 prompt 加少量策略变量控制复杂度；guardrail 应围绕已发现风险逐层增加，并同时优化安全和体验。
- Google ADK：支持动态路由与按需 Skill/context 加载，避免把大量领域信息塞进单体系统提示。

## 当前方向

- 默认走 direct-answer fast path；只有明确需要本地事实、外部工具、文档产出或写入时才升级到 agent path。
- 上下文从“预先汇总所有模块”改为按需读取；工具从“按 route 猜测后展开”改为小核心工具集 + 延迟加载。
- 保留写入确认、隐私、权限和结构化业务产物门禁；普通聊天不强制完整业务 schema/grader 链。

## Sol 实施规格

- 新增 `direct | structured` 联合执行模式。direct 只用于寒暄、致谢、能力说明和无上下文的独立通识问答。
- 出现学生引用、记录/档案/知识库/附件/上文、PDF/Word/题组/报告、写入动作、明确工具意图或高风险个性化判断时，一律 structured。
- direct 返回普通 Markdown，只做空响应、长度和敏感信息边界；structured 继续沿用 AgentLoop、`xiazhi.reply.v2`、repair、grader、确认和审计。
- UI 对 direct 只显示答案；structured 才显示真实路由、上下文、工具和确认事件。隐藏推理链始终不展示。
- 回滚通过执行模式开关恢复全量 structured，不需要数据库迁移。

## 最终验收

- direct 已确认在 `startDeepTutorTurn` 前返回，不执行上下文、工具、schema repair 或 grader。
- structured 旧链完整保留；direct UI 与审计明确区分“不适用”和“未通过”。
- 学生孩子/代词与“小数”有无标点边界已纳入 13 条批量样例。
- Sol 第三轮独立验收通过。残余风险仅为真实 provider 质量和完整 Electron 键盘 E2E 未在本轮执行。

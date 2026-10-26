# Agent Trace Streaming 落地合同（2026-10-23）

用户本轮明确指定 `{name: "Agent Trace Streaming", render: () => <AgentTraceStreamingDemo />}`，并确认“按官方示例：运行时展开，整轮结束自动收起”。此决策取代 DSH 默认收起与预览策略。

## 根因与范围

当前 b5a7fc6 使用了 ChainOfThought 底层组件，却没有复用官方 AgentTraceContent / TraceItem / TraceSection / FileAction 组合；额外加入 DSH 预览，工具全部包在一个默认收起的 execution disclosure 中。因此即使真实 reasoning 数据存在，也不是指定示例的结构与默认交互。

官方文档：https://heroui.pro/docs/react/components/chain-of-thought#agent-trace-streaming 。本轮 MCP get_component_docs(chain-of-thought) 成功返回完整组合源码；本地旧 example/ChainOfThought.tsx 只有 Default/Streaming，不能当成指定组合。AgentTraceStreamingDemo 是示例封装名，真实基础库 API 仍为 ChainOfThought。

## 可核验交付

- M10 展示切片：教师看到多块独立可折叠轨迹、嵌套步骤、原厂运行流光；运行时默认展开，整轮 completed/interrupted/failed 后自动收起，可手动重开。
- 采用官方组合函数与 utility 类。只将静态登录页/示意图片/示例文件替换为真实 provider reasoning 与现有公开工具证据；不填充示例假事件。
- 模型推理仍来自 Pi thinking_delta 脱敏桥；工具来自现有 items，正文独立流式。准备/等待不是思考，没有 reasoning 不伪造。
- 修改 renderer 的轨迹组合/工具证据复用、移除 DSH 预览及对应测试；不改 vendor、主题、backend/shared/preload、DDL、上传/教师权限或模型调用配置，不加依赖。
- 保留非 Pi 通用聊天入口及工具链接、截图、错误、来源、教师确认。既有 SQLite metadata 兼容，回滚仅恢复 renderer；无数据迁移。
- 门禁：build、renderer-components、reasoning/trace 边界；真实 Electron/DeepSeek 流式、完成折叠/重开、工具、停止、失败、SQLite/重启；亮色双尺寸与 Hover/Focus/Active CSSOM；控制台及既有 smoke。验证结果分开记录，不把 fixture 当 provider。
- 本轮不实施整套聊天视觉改造、性能优化或隐藏 SDK 内部状态提取；Master 保持 DOING。

## 本轮追加纠正（用户明确要求）

- 删除输入区上方 PiWorkspaceActivity 及重复计划展示。它是运行遥测，不是推理，不能混入思考内容。“持续目标”是已有业务控制，迁到任务与来源侧栏，不删除后端目标或教师验收功能。
- 实际新闻请求 preparing → waiting_model 9,486ms；waiting_model → first modelReasoning 1,192ms。这是主进程持久记录，不能将全部等待说成模型推理。
- 新增只读主进程 CPU profile 定位 managed-skills.noLinks/readPackage/verify 的大量同步 realpath/lstat；profile 本身引入开销，不用其21秒当普通请求延迟。最小优化只在 Windows 改用等价 realpathSync.native；保留逐级 lstat/规范路径比较、读前/读后校验和每轮重验，不缓存权限或跳过技能安全检查。新增门禁为现有技能管理/权限/篡改专项。
- 真实Electron首次几何断言失败还证明官方示例所需Tailwind工具类未生成；补齐仅示例范围的MIT Tailwind4.3.3生成CSS（约3KB），显式包含scope根选择器，避免工具类被旧样式隔离。源码生成器与生成物一同追踪；无新依赖/lock变化，无全局preflight或vendor覆盖。
- 用户进一步指定优先思考/正文：最终结束自动收起全部过程块，正文保留；普通问答自然段落，必要任务结构仍使用列表/表格。渲染器未将段落转换为列表，原提示未统一强制分点，但存在阶段说明与编号技能规则；在当前presentation suffix增加自然表达策略，保留immutable creation identity、权限规则、原生历史与原文保存。模型表达不承诺与其他产品逐字一致。真实普通问答另验正文，不能拿要求“三练习/两错误”的结构化题目当默认文风样本。

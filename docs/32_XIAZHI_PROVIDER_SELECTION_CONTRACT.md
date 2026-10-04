# 小智模型供应商选择交付合同（2026-09-24）

- 模块：M10 AI 治理。教师可在设置页或聊天输入栏选择 DeepSeek 或智谱 GLM，分别保存模型与密钥；聊天页、错题三元题组和旧 AI 入口按当前选择请求模型。
- 当前路径：`app_settings.deepseek` → main runtime → DeepSeek Chat Completions → typed preload → 设置页。缺口是单供应商硬编码，GLM 无独立凭证、路由和重启回读。
- 改动：扩展共享设置契约；保留旧 `deepseek` 行，新增 `glm` 与 `ai_provider_selected` 行；保留既有 IPC 名作为兼容适配；main 模型网关选择官方 Chat Completions URL；设置页增加供应商选择与各自模型、密钥状态，聊天输入栏可快速切换。Python sidecar 仍只经 main 代理模型调用。
- 兼容与回滚：旧库无选择行时默认 DeepSeek，旧 DeepSeek 密钥原样保留。切换供应商不删除另一家的密钥；空密钥输入保留该供应商旧值。DeepTutor 每轮把供应商固定在请求上下文，后续模型回合不跟随设置变化。失败时保留清晰终态，不回退另一家以免误发资料。
- 验收：新库和旧库配置读回、重启保持、两家请求地址与凭证隔离、direct/structured/错题图路由、Electron 设置到聊天用户路径、build、组件测试、专项和完整 smoke。真实供应商 HTTP 成功须独立验证。
- 不做：任意自定义 URL、Anthropic 协议、自动跨供应商故障转移、原始资料上传和密钥回显。

GLM 的主接口依据[智谱官方对话补全文档](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8)：`POST https://open.bigmodel.cn/api/paas/v4/chat/completions`。截图所示 `/api/anthropic` 属于另一种协议，当前 Chat Completions 宿主不使用。

用户截图中的 Sonnet、Opus、Fable、Haiku 是 Claude Code 的角色映射标签，实际请求模型是右侧的 `glm-4.5-air`、`glm-4.6`、`glm-5.1`。小智设置提供这三个实际模型 ID，并以 `glm-4.5-air` 为新 GLM 配置默认值；已保存的其他模型选择不迁移覆盖。[智谱官方对话补全文档](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8)列出这些模型 ID。截图中的 1M 是 Claude Code 映射页上的能力声明，不作为小智上下文窗口保证。

[智谱 Coding Plan 接入文档](https://docs.bigmodel.cn/cn/coding-plan/tool/others)单列 Coding Plan 接入场景与接口。当前小智走标准模型 API，不能仅凭 Claude Code 配置截图推断该账号的套餐密钥可在小智调用；有效密钥和实际生成仍需在小智中单独验收。

本轮实例证据：`npm run build`、`npm run test:renderer-components`（79/79）、`npm run test:triplet-graph`、`node --experimental-strip-types scripts/ai-provider-electron-smoke.mjs`、`node scripts/ai-workspace-visual-smoke.mjs`（1366×768、1920×1080）、`node scripts/electron-smoke.mjs` 均通过。供应商专项使用隔离数据根与无效测试密钥，direct 和 structured 都收到 GLM 服务端鉴权错误，说明网络路由实际到达服务端；没有有效 GLM 密钥的成功生成证据。

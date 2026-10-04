# Pi 教育工具与正式小智入口交付合同

2026-10-02；P02/N03，M10/M01/M04。上一轮 P01 有实际 SDK/Electron/DeepSeek 证据，属于进展；本轮补正式入口，不重复独立基座实验。

## 教师可见结果与当前缺口

教师从“小智”进入，发送知识检索任务，输入立即清空；Pi 真实调用现有 search_teacher_knowledge 审核/执行/脱敏路径，流式中文正文与工具步骤进入已复用 HeroUI Pro OfficeConversation/Composer，终态、来源和历史重启保持。普通对话也走同一个 Pi 循环。私有推理不广播，公开任务说明与分段正文按真实事件展示。

当前正式 App.runAiConsole → preload.runDeepTutorConsole → 旧 main loop/图/sidecar；回复仅最后 append SQLite，未绑定 Pi。教育工具已存在，返回 bounded 元数据/个人信息隐藏正文。会话/运行/事件表已存在；不另造知识库，不把原学生库路径授权给通用文件工具。

## 将改动的边界

- Pi 门面新增 main-only 教育 customTools，复用既有 tool-registry 定义、reviewModelToolCall/executeAiToolCall。首片只接 search_teacher_knowledge，不能顺带开放 write/student/shell。私有空任务目录只用于受限文件工具，真实教育资料通过审核工具访问。
- 新独立 host/IPC 模块：公开 start/stop/snapshot/events；输入严格长度/身份/字段校验。一会话一运行；宿主创建用户/助手消息与 ai_agent_run/events，renderer 不负责重复 append。SDK ID/JSONL 路径只在 main。
- 新增单表 xiaozhi_pi_session_bindings（本地会话→SDK 历史相对路径/固定 model，版本化增量幂等），复用现有会话/运行/事件表；迁移实现放领域文件，db.ts 仅窄适配。新库、旧库副本/重启验证，真实库不删除、不重放旧助手消息到 SDK。
- 复用既有 OfficeConversation/Composer、AiConversationSidebar 和样式。独立 Pi 工作区组件挂到正式 App 小智导航；旧入口保留，通过 OMNI_EDU_XIAOZHI_PI=0 回退。main/preload/renderer 使用单一共享契约，不让 renderer 直接访问 SDK或密钥。
- 事件只投影正文/工具名称/安全状态；最终 SQLite 消息保存公共分段投影，SDK JSONL 管唯一模型历史。终态通知在消息/运行落库后发送，重进页面从 SQLite + 当前 active run 补读。

## 兼容、失败与完成定义

旧对话仍可见，旧模型历史不自动转换；从旧会话首次发起 Pi 使用新的私有上下文并明确提示。模型变更不静默恢复旧历史。关闭页面/切会话不串草稿或吞当前宿主任务，停止等待期间不接受第二 run；退出遗留 running 由既有启动恢复变中断，不自动重放写入。

只 DeepSeek，凭证由 main 读取已有设置/忽略环境，不向 UI 回显。API/auth/timeout/取消状态清楚；无 credential 也要有本地用户消息和失败终态。生产持久审批/完整命令幂等、Skills、联网服务、完整设置与一比一 UI 总验收属于后续 P03–P08，保留总范围。

最低验收：正式页面真实 DeepSeek 知识检索（合成资料经现有导入流程），多 delta/工具/引用与 SQLite readback；新会话发送清空、IME、防重、停止/错误、会话切换与应用重启；1366/1920 可达截图。实际 Electron，不用静态页面/mock API 冒充真实 provider。运行 build、renderer-components、专项、新旧库幂等与关键路径 test:smoke、git diff --check，精确记录失败和未验证边界。

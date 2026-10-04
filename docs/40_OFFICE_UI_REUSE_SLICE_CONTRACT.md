# 小智办公 UI 组件复用切片合同

日期：2026-10-02；关联 U01/U03/U04、A04/A05。H05 系统初始化授权待答复，当前不接管生产运行链。本切片复用现有组件并建立真实公开数据的渲染边界，不能称为完整工作区交付。

## 目标与当前能力

- 当前 App 已使用本地 HeroUI Pro 的 PromptInput、ChatConversation、ChatMessage、ChainOfThought 等；不再复制一套同名组件。
- 本轮 MCP 实际读取 PromptInput 文档/CSS、ChatConversation CSS、Dropdown 文档；MCP 明确 Pro 实现源码不暴露，因此按 AGENTS.md 沿用已复制的本地源码与完整 CSS/utils/icon 依赖。
- finesse 固定 `5050b6c71e27b829d1b3087d2be889d29c60db00`，读取 product-ui、ai-console 与 relay 示例；MIT。按用户明确截图锁定白色阅读区、薄荷外框及蓝色主按钮，不执行技能中的另选配色或再次设计确认流程。
- 采用真实步骤、分段正文、稳定停止位置、用户主动上滚时不抢滚动、行内失败与产物来源规则。停止先显示请求状态，只有运行时确认才显示中断；不按示例乐观伪造终态。工具原文按宿主许可投影，示例展开原始 payload 不覆盖项目隐私规则。

## 文件与边界

- 新增 `renderer/components/office/OfficeConversation.tsx`、`OfficeComposer.tsx` 与局部 CSS：纯 typed props，无 Node、密钥、引擎私有 RPC、原始推理字段。
- 复用源核对 22 份组件文件最初均与本地来源 hash 相同；发现 PromptInput 基础 Enter 提交未处理 IME，局部适配这一处：先调用自定义 handler、尊重 preventDefault，再拒绝 composing/229。该修复也影响旧入口，需真实键盘边界与现有组件门禁。
- 真实滚动实例另暴露已排队自动滚动与用户上滚竞争；ChatConversation 的 scroll handler 取消待执行 RAF，防止新片段把正在读历史的用户拉回底部。测试等待两个实际渲染帧后核验位置，不能在 effect 前读瞬时坐标冒充通过。
- 复用现有 heroui-pro 目录；不新增 npm 依赖。登记当前源码与本地源差异、CSS/MCP 参考。Pro 的公开再分发许可另需核验，不将缺失 LICENSE 推断成 MIT；本轮仅在既有本地项目内适配。
- 输入框每次发送冻结消息快照并立即清空；重复发送被拒绝；失败快照独立于新输入；输入法 Enter 不提交，Shift+Enter 换行。运行时允许编辑下一条草稿，但暂不提供未接入的队列动作。
- 输入组件按 sessionId 建立状态边界，切会话不携带旧草稿/失败重试快照，旧异步发送失败不能覆盖新会话。每会话草稿持久保存仍需在后续宿主/SQLite 切片实现，当前不宣称已实现。
- 消息以 turnId/itemId 保持键和顺序，commentary/final_answer 分开保留；工具只显示标签、状态与实际时长，缺失耗时不编造；未知状态不当成功。
- 不新增数据库/IPC，不改变旧 AI 导航/路由，不迁移真实会话；P0 放行后由 A04/A05 绑定实际订阅与命令。

## 验收与回滚

- 独立 Electron 组件实例读取已通过的真实 DeepSeek `public-projection.json`，检查准确正文、分段、工具、键、滚动与两个视口；这证明组件消费实际数据，不证明生产 IPC 或新任务发起完成。
- 交互边界另用明确标注的测试输入：中文输入法、换行、重复发送、清空、失败/新草稿分离、真实回调等待期间停止反馈。
- build、renderer-components、组件 Electron 专项、git diff --check；截屏记录组件范围，无整页一比一通过声明。
- 无生产入口修改，回滚为移除本切片新增组件与测试；现有用户会话和文件不受影响。

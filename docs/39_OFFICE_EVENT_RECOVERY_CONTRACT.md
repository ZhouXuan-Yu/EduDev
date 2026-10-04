# 小智办公事件补读与状态合同

日期：2026-10-02。对应 H06，预备 A01/A02/A04。变更范围限于版本化共享类型、事件白名单投影和隔离 app-server 验证；未通过 P0 权限门禁前不接管生产路由。

## 事实与所有权

- Codex 私有线程历史是模型 transcript 唯一真源。小智不构造第二份模型消息历史，不把 renderer 的显示列表重新发送为历史。
- 小智宿主映射 sessionId/threadId/runId/turnId，单会话只允许一个活跃运行所有者；跨进程认领和 SQLite 持久化在 A02/A07 实现，P0 不将内存互斥宣称跨进程完成。
- 引擎连接每次增加宿主 epoch；同 epoch 的事件序号必须递增。重复序号和旧 epoch 拒绝投影；重连或序号缺口必须补读真实线程历史。
- 官方通知中的 itemId 是正文/工具项的键。delta 只追加到对应 item，completed 用真实完整项替换该项正文，不能把完成通知再当一条新回复。
- final_answer/commentary 在 completed 时按引擎真实 phase 更新，不能永久依赖 delta 开始时尚未确定的 phase。

## 投影边界

- typed projection 只允许 userMessage、agentMessage、plan、工具元数据、contextCompaction、明确错误/状态和实际 usage。不得持久化或向 renderer 暴露 reasoning.content、reasoning/textDelta、raw response、未知字段或凭证。
- 正文有长度预算；工具只保留允许的名称、状态和实际时长。完整工具结果由宿主按工具契约处理，不从引擎原始 contentItems 自动搬入 DOM。
- 等待用户输入/审批与 completed 不同；崩溃导致 interrupted，旧活跃 RPC 审批失效。后续写入需要新 turn、新 scope、新审批，不能重用旧 requestId。
- interrupted/failed/completed 终态不会被同一 turn 的迟到 started/delta 改回 running。用户新消息产生新 turnId。

## 补读与恢复

1. 停止旧连接并使其 epoch 失效，禁止旧回调执行工具或覆盖新投影。
2. thread/resume 返回原 threadId、provider/model 快照；不静默选择另一家或默认模型。
3. 调用实际 thread/read(includeTurns=true)，或按当前 historyMode 逐页读取 turns/items；只有完整页集才能替换整个投影。分页/未加载结果不能当空历史。
4. 按真实 itemId upsert。被压缩的模型上下文不等于界面历史丢失；补读来源是持久线程记录。
5. SQLite 本地投影提交成功后再通知 renderer。renderer 订阅先接快照/序号，再补缺失事件；卸载取消订阅，不直接绑定私有 stdio RPC。

## 本切片验收

实际 DeepSeek 多段 delta+completed 不重复正文；thread/read 可重建相同正文项；杀引擎重启后原 itemId/正文保持；重放通知无重复项；旧 epoch 和终态迟到事件不改变状态；隐藏推理哨兵不进入投影。命令、结果与未完成边界写入 docs/38。

本切片不新增业务表、改真实数据或删除旧会话。SQLite projection/迁移、typed preload、正式 UI、分页生产兼容和跨进程所有者在后续纵向切片验收；共享类型本身不作为这些功能完成证据。

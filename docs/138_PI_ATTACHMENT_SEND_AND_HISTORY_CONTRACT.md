# D2-C 附件发送与历史交付合同

2026-10-04；M01/M10；延续132§4与137。用户目标、67组件与公开执行过程基线保持，整体目标active、三元题组暂停。

## 1. 用户结果与现有缺口

从当前“+”添加本地附件后，可以随文字或单独发送；输入框接受后清空，已发送附件留在对应用户消息，可本地预览。跨会话、源删除、失败与重启不丢已提交副本、不自动重放模型或工具。原Pro ChatAttachment/Group/PromptInput与既有Modal继续复用，不修改原组件。

当前草稿已真实登记/复制/预览，普通send临时阻塞。原host claimCommand→run→teacher message分别写入；仅调用D1 bind不足以保证整体原子性。图谱节点存在但snippet位置已陈旧，具体实现按当前源码读取。Sql仅提供run/change/all，直接跨await BEGIN会与其他Store写交错，不新增不受控事务。沿office-artifact-state现有SQLite单语句触发器原子发布模式，增量附件send ledger引用原command/run/message，单INSERT触发全量CAS校验与原事实写入；失败整条语句回滚。暂不迁移无附件旧流程。

## 2. 持久准入和兼容

- strict start增加可选1–8个 `{id,revision}`；拒绝额外字段/getter/symbol/重复/跨会话/已移除/未知版本。无附件仍原三字段与完全相同request hash。带附件hash包含有序selection，其不可变ID+revision在ledger另核fileVersion/contentSha256，renderer不传路径/字节/hash。
- 原host先保留owner与原command starting持久准入，核所有本地草稿明确参与本轮、副本ready/version/hash，读取或停止失败不得产生teacher/run/submitted事实。原command占位保留供重启明确中断，不自动重放。
- 原子ledger事务创建原run/teacher message、更新全部附件submitted/revision/run/message、绑定原command running与session摘要。事务前后崩溃只能无teacher事实或全部已提交；启动原恢复仍将running中断，已提交历史不返回草稿。旧command重试先核原hash并返回已有run，不再次读源或创建副作用；变化selection必须冲突。
- 附件单独发送使用明确本地任务默认文字；模型仅接本轮文字和真实本地附件数量说明，未经D3实现不自动把原文件/图片或私有文件名注入云端，不声称已读取。D3按ID工具读取、本地学生OCR与公开图片授权视觉，D4真实查看回执仍必需。

## 3. 贯通与失败

新增领域send-state、session-state增量迁移与既有host集成；shared start/投影附件字段、原typed preload接口与renderer hook/composer/history适配，无第二事件循环、native files.json或新依赖。已发送卡片只从SQLite按message/run投影，输入卡片成功后刷新draft。失败保持未提交草稿和失败文字，未知返回同command确认，禁止误重发。运行中既有文字queue/stop保持，文件chooser仍禁用；不扩充队列附件。

历史本地预览沿原六操作与strict request/cancel，无新任意路径接口；同会话提交ID可预览，不可remove。原父目录/workspace/native绑定/来源/教师授权和blockImages规则保持。

## 4. 验收、恢复、后续

边界：strict schema、同command幂等/变更冲突、全部附件CAS失败零teacher/run、任一SQL写失败原子回滚、归档/跨会话/损坏副本拒绝、旧无附件hash/native保持。真实Electron native SQLite：新库与旧副本二次迁移、原事实保持、事务前/提交后实际进程终止与重启不重放。真实正式页面：+选择→文字及附件单独发送→input空/原Pro历史→本地预览、源删除/切会话/重启、失败/停止、双原生1366×768与1920×1080；真实DeepSeek/Pi，不以Node SQLite或静态页面代替。build/renderer/本轮专项/关键main smoke/git diff --check精确终态记录139。

只owned合成输入/测试profile，无真实教师上传、真实数据删除、OS网络修改、提交push或子agent。兼容回退为禁用附件send入口，保留旧ledger/文件和旧无附件功能；不删除历史。四根/26/28/35/67按真实完成更新，未完成部分清楚保留；D2完成后立即D3/D4→E/全D1–D7/P08实际无VPN/Windows安装/未知官方参照/最终八组，整体目标保持。

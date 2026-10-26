# H09 Journal 缺号、乱序、重连与冷恢复交付合同

状态：`LIMITED_ACCEPTED`

日期：2026-10-22

关联：H03 journal、H09 真实事件 UI、教师确认与文件写入恢复

## 教师结果

小智正在执行时，如果已提交事件通知丢失、事件顺序错乱、补拉请求短暂失败或应用重启，教师必须看到明确的“正在同步/同步失败”状态。依赖这些事件的确认、文件和队列写入保持禁用；草稿、只读内容、停止和导航不应丢失。只有权威 SQLite snapshot/连续 journal 页补齐后才能恢复。冷启只能恢复已提交结果，不能重放模型、工具、审批或文件效果。

## 覆盖范围

1. SQLite event/state/outbox 同事务；event hash、连续 sequence、outbox 和投影一致。
2. receiver 对 gap/duplicate/reorder/reconnect 的连续拉取、游标、generation 和 navigation epoch。
3. 真实 Electron 中丢弃 tool-start 与 terminal 通知，页面从当前 journal 补齐真实结果。
4. 真实教师文件审批卡在同步阻断时零 IPC/零写入；失败补拉不解除；实际补齐后单次保存。
5. 旧 revision 冲突、Stop、草稿保留、冷启恢复和 native bytes 不变化。
6. 持久化触发失败时停止执行，不产生成功工具结果，重试被拒，冷启为 unknown/interrupted 且不重放。

## 反例与安全边界

- gap 不得部分推进 projection；outbox/journal 失败必须回滚。
- 跨 session、错误 generation、cursor ahead、伪造或无 transaction 能力失败关闭。
- 乱序/重复通知只按 sequence 重排或忽略重复，不能越过缺口。
- 补拉 promise 完成但页面无效、失败或跨导航 epoch 时不能解除阻断。
- 旧 revision 不能覆盖新审批；同步恢复不能自动点击批准或写文件。
- 本切片不新增 Loop、表、依赖、网络能力或外部上传；不改变教师确认规则。

## 当前构建验收

构建`c7e088ca418a65a361d254482553a9c5b0c4fc0b5316f20e1380721fd972374b`/373。

- `pi-event-journal-XMx2OZ` 19/19：迁移、原子outbox、重复/gap、失败回滚、跨会话、ordered catch-up、cold recovery、late owner、dropped notification、receiver reorder/duplicate、navigation epoch、bad page、persistence unavailable、tail polling。
- `pi-event-sync-ui-CvMrmV` 10/10：真实DeepSeek提案，提交通知gap阻断审批和文件写入，补拉失败保持阻断，网络/主题双尺寸可见，恢复后一次批准，旧revision拒绝，Stop零文件，210行journal hash一致，冷启不重放。
- `pi-event-journal-ui-QOMPZa` 12/12：真实tool-start通知丢失和terminal withheld，页面从SQLite补齐；typed页、journal、projection、outbox一致；generation、reload、cold restart；教师问题恢复；实际journal写入失败后停止、拒绝重试、冷启unknown。

## 未完成

本片只关闭 journal gap/reorder/reconnect/cold 恢复软件门禁。H09仍`IMPLEMENTING`：真人读屏软件操作、全部动态状态点击区/焦点/对比度、125/150% DPI、完整长任务性能仍未验。H10的课堂播放、无VPN、安装包、真实教师和真实学生图继续OPEN。

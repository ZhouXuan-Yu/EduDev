# 小智 S2：安全只读 12 路调度合同

日期：2026-10-15

状态：**S2/F02 LIMITED_ACCEPTED（受控正式实例）；真实站点/自然吞吐仍 OPEN**

## 1. 目标

在现有 Pi 唯一 Agent Loop 与工具执行边界内，支持同一 Electron 主进程最多 12 个经审查的 `safe_read` 工具处于实际执行状态。模型只请求 2 个工具时只执行并报告 2 个；系统不为了满足数字制造假调用。

## 2. 先确认的“2”

- `ToolManifest.maxAttempts = 2` 表示 `office_web_search` 与 `office_web_fetch` 在网络、限流、服务错误或超时后的最多一次重试。
- 它不是模型调用数、搜索结果数、并发槽数，也不是每轮必须执行的工具数量。
- `401`、`403`、权限失败、写入、上传、浏览器操作、OCR/解析缓存和教师确认不自动重试。

## 3. 调度边界

- 调度器是进程内 FIFO 队列，容量为 12 个活动槽；队列等待项不占活动槽。
- 只有 `ToolManifest.effect === 'safe_read'` 的工具进入该调度器。写入、`local_cache`、`external_effect` 和教师审批继续使用原有资源锁、审批和效果回执。
- 槽位在实际工具 Promise 解决或拒绝后释放。工具超时只结束调用方等待，若底层仍未结束，槽位和资源锁继续保留。
- 排队等待计时与获得槽后的工具执行计时分开；取消排队项必须从 FIFO 队列移除，不能留下幽灵活动。
- 已获得槽的调用取消后仍等待底层 Promise 真实结束，避免迟到结果与下一项并发污染。
- 调度器不新增数据库表、IPC 或第二 Agent Loop；现有 `tool_attempt`、journal、projection 和 UI 继续承载状态。

## 4. 验收定义

1. 合成边界测试能证明 12 个只读调用同时执行，第 13 个保持排队；释放一个真实 Promise 后第 13 个按 FIFO 获得槽。
2. 排队项取消后不执行底层工具，活动峰值不超过 12，队列长度和等待时间可读。
3. 活动调用超时但底层 Promise 仍未结束时，槽不提前释放；底层结束后下一项才进入。
4. 现有网页读取重试仍为最多两次，写入/OCR 缓存/上传/浏览器/教师确认仍为一次或原审批路径。
5. 正式 Pi 同批真实请求记录实际活动峰值与第 13 项排队证据；没有 12 个真实请求时，不以合成测试替代自然任务结果。
6. 类型检查、组件门禁、S2 专项边界测试和 `git diff --check` 通过；旧失败记录和未验证范围保留。

## 5. 修改范围与回滚

预计修改：`tools/read-scheduler.ts`、`tools/execution-bound.ts`、`shared/xiaozhi-tool-attempt.ts`、`OfficeToolProcess.tsx`、`OfficeWebSearchProcess.tsx`、S2 专项测试与状态文档。沿已有 schemaVersion=1 attempt 增加 queued 状态和可选 queueWaitMs/executionMs；旧无字段记录照常读，无新 IPC/DDL。页面实际排队状态与两种耗时沿原 journal/projection 显示；不复制 BoardUI vendor。不得修改 Pi vendor、业务事实表、凭证、网络策略或用户资料。

回滚时移除调度器接入和对应测试/说明，保留已写入的 attempt/receipt 证据；不删除历史失败，不重放任何写入或上传。

## 6. 明确不做

- 不保证每次自然对话都产生 12 次读取。
- 不把并行 SDK 默认行为、模型自评、搜索返回条数或重试次数当成 12 路通过证据。
- 不在本片扩展 S3 输入框、S4 OCR/题库或 H05 任务计划。

## 7. 实际验收记录（2026-10-16）

冻结构建 `acf357002c23adccd23d5914c9abcc5a0fd26e7a87130f9845e7f23c9e6efef3`（368 文件）上，正式 Electron/DeepSeek 测试 4/4 通过。13 个 `office_web_fetch` 生产调用中，12 个受控传输保持 active，第 13 个在页面显示“等待读取”且未 admission；释放一个响应后第 13 个进入传输，峰值仍为12。最终 13 个调用均完成，`queued → started → succeeded` 的 attempt、排队等待时间、SQLite journal/receipt 与 typed projection 一致。

报告：[pi-read-scheduler-web-ui-jQ6sf7/report.json](../apps/desktop/test-results/xiaozhi-agent/pi-read-scheduler-web-ui-jQ6sf7/report.json)；截图：[twelve-active-one-queued.png](../apps/desktop/test-results/xiaozhi-agent/pi-read-scheduler-web-ui-jQ6sf7/twelve-active-one-queued.png)。当前脚本 SHA256：`975fb57dc503ef2fc82dc7121d9f83689d88c0f0b56098fc17409514ea6fc6a1`。

限制：网页响应是受控合成内容，未访问教育部真实网页；因此不升级真实搜索、403/重定向、无 VPN、图片/文件链路或自然任务吞吐结论。早期失败报告保留，不删除。

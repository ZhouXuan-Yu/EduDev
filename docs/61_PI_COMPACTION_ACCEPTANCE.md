# P04-B2a 原生手动上下文压缩验收

日期：2026-10-03。M10/M01；合同 docs/60。本记录只放行手动压缩，不放行完整 P04 或完整 Codex 体验。

## 实现与来源

- 正式 Pi 工作区“压缩上下文”→ typed preload `compactXiaozhi`→ `xiaozhi:compact`→ production-host 单会话 owner/持久 command→ Pi 0.80.3 `AgentSession.compact`。SDK 原生生成摘要、追加 compaction、重建有效上下文，没有第二模型循环。
- 摘要生成沿用固定 DeepSeek 模型、原授权目录、原私有 JSONL。原消息前缀不删除，教育 SQLite 保留可见历史/计划/审批。没有新增表或依赖；旧入口回退开关保留。
- main 从同一会话取计划、来源标题、复制审批及来源 SHA256，重新脱敏后追加受保护事实。按完整记录装入有界上下文，不能切断 JSON/hash；优先较新审批，明确省略数量。记忆不能授权、计划不能冒充交付、旧写入不能重放。摘要保持私有。
- 摘要的真实 provider usage 从原生 stream.result 记录；原生拆分轮次的并行摘要请求全部 settle 后收尾。公开仅真实状态、SDK 压缩前计数与压缩后估计、用量白名单，费用未知。示例约 16004→4315 是上下文估计，不是累计账单。
- 调用停止包含 abortCompaction；运行中拒绝新任务/压缩/追加。相同持久 command 返回原结果，不请求第二次。空历史零 API 请求。
- SDK terminal usage 在主进程持久终态提交前保持 running；原生摘要已落盘而公开 run 尚未提交时退出，启动恢复为 interrupted/partial，保留原生摘要但不重放命令。
- 界面复用既有 HeroUI Pro ChatTool，实际 MCP 文档核对 slots，finesse 固定 AI-console 参考；运行/完成/失败/停止均依真实事件。双视口可达，但整体布局仍不是 Codex 一比一。

## 实例与门禁

下列命令在 `D:\WorkProject\EduProject\apps\desktop` 执行。报告/日志均在 Git 忽略的 test-results，下列数据为合成教师资料；真实用户数据未迁移、未删除。

| 命令 | 实际结果 | 证据 |
|---|---|---|
| `npm run build`（最新完整记录格式修订后） | exit 0 | pi-compaction-build-bounded-context.log |
| `node scripts/xiaozhi-agent/pi-compaction-ui-smoke.mjs` | 真实 Electron/DeepSeek 18/18 | pi-compaction-ui-UVXuHm/report.json；pi-compaction-ui-settlement-final.log |
| `node scripts/xiaozhi-agent/pi-compaction-existing-session-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-UVXuHm/data` | 最新源码、真实旧 JSONL 副本续问/再次压缩 3/3 | pi-compaction-existing-3JRaqz/report.json；pi-compaction-existing-final.log |
| `node scripts/xiaozhi-agent/pi-compaction-context-smoke.mjs` | 有界上下文/完整 hash/省略回执/同会话/脱敏边界 3/3 | pi-compaction-context-boundary.json |
| `node scripts/xiaozhi-agent/pi-budget-ui-smoke.mjs` | 真实预算与审批等待复验 18/18 | pi-budget-ui-fAfCQK/report.json |
| `node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs` | 真实控制/队列/取消复验 17/17 | pi-control-ui-iXVpt4/report.json；pi-compaction-control-regression-retry.log |
| `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-approval-ui-e6RCHZ/data/app.db` | 新旧测试库迁移 10/10 | pi-state-migration-nCmhbh/report.json |
| `npm run test:renderer-components` | 79/79，exit 0 | pi-compaction-renderer-final.log |
| `npm run test:smoke` | ok=true，207/207，exit 0 | pi-compaction-legacy.log |

18 项正式压缩实例包括：空历史与非法 IPC、并发 owner/追加拒绝、真实摘要落盘且原历史前缀保留、来源/计划/拒绝审批和精确文件版本保护、usage 对账、公开投影不含摘要/hash、防重、1366×768/1920×1080、随机验收码与学年续问、实际重启、停止零写、活动上限、落盘前杀进程、原生落盘后公开提交前杀进程、主动续问读取已提交摘要、跨会话隔离。

最后修订只涉及保护上下文的整条记录装入格式，重新 build、边界 3/3 及真实既有会话 3/3；上述 207 项冒烟在该格式修订前已完成，包含关键 owner/终态修复。控制专项未传可选旧 P03 副本参数，第 18 项历史升级本轮未执行；历史证据见 docs/57，不冒称本轮 18/18。

## 保留的失败与修复

1. 初次 build 的 useRef 初始化类型错误，改明确 undefined 初始化，后续构建通过。
2. pi-compaction-ui-W5gJPd 前 10 项通过，随机事实断言误要求模型字面标点；私有读回事实正确。按完整随机码/学年/状态核验，保持事实强度。
3. pi-compaction-ui-t0zUsl 前 14 项通过，测试 helper 重复点击预算折叠按钮使其关闭；检查可见后再展开，产品未作迁就修改。
4. pi-compaction-ui-5OW4Gh 是此前 16 项真实通过基线；随后加真实原生提交间隙退出。
5. pi-compaction-ui-HSEQCE 前 15 项通过，发现原生压缩已提交但主进程未提交时杀进程，usage 误记 completed。修复 SDK terminal→host durable terminal 的持久边界，最终 UVXuHm 18 项通过。
6. 控制复验 pi-control-ui-fE7LHD 在第一轮输入 press 超时，零项通过；失败截图与报告保留，原因未确认。同代码未改动复跑 iXVpt4 17 项通过，不把未知原因归为 provider 或业务失败。
7. 大字符串切片会切断审批事实且失去省略回执，改整条记录有界装入，最新边界和真实旧会话复验通过。

## 未完成与下一项

- 自动压缩仍关闭。下一项 P04-B2b：官方模型能力/完整请求窗口核对，原生自动阈值、同一 run 预算/用量/取消/失败与持久状态，真实长会话验收。不能将本地 32768 配置称为模型官方上限。
- Hana 缓存保留 extension、拆分轮次两请求完整专门验收、完整教育 L1/L2/L3 作用域及队列编辑撤回仍待交付；之后 P05 Skills、P06 设置与一比一界面、P07 办公联网、P08 实际无 VPN 和安装。
- 用户要求优先完成目标，暂不考虑每轮 token 消耗。用量真实性与现有可配置运行保护保留，不为 token 优化延后功能。
- 无 commit/push/子 Agent/系统 DNS、代理或 VPN 配置变更。凭证不在本报告或公开历史。

收尾：`git diff --check` exit0（仅现有LF/CRLF提示）。下一合同docs/63已冻结；只读官方模型能力probe HTTP200成功，未改变生产窗口或开启auto。

# P04-B2b 自动上下文整理与模型能力验收

日期：2026-10-03。合同 docs/63；M10/M01。**本切片通过，正式 IPC 默认启用自动整理；完整 P04 与全目标未完成。** 用户要求先完成目标，暂不做每轮 token 成本优化。

## 1. 实际交付

- main 固定官方 `/v1/models` 请求，10秒超时、64KiB/32模型上限、schema/ID校验、安全字段投影、版本1本地缓存与24小时新鲜度。官方列表明确移除当前模型时拒绝配置，不用旧缓存复活；网络失败只回退同ID旧能力并标明过期。未知能力不伪造官方容量，自动关闭。
- 本次真实 DeepSeek-V4.1-Flash 能力是 context=1048576 / output=393216；每次回复本地策略仍4096，两者分开展示。模型支持图片不改变学生图片保持本地的规则。固定模型/目录/历史指纹保持，没有静默切供应商或改写旧 JSONL。
- 使用 Pi0.80.3 原生 prepareCompaction/compact/appendCompaction 与既有唯一 streamFn，复用 Hana `computeCompactionReserveTokens`、`installMidRunCompaction`。每次请求和工具循环下一轮检查完整 system/messages/tools/output/协议余量；失败明确终止，不硬截断或吞掉错误继续。SDK裸自动开关保持关闭，正式宿主接缝控制自动整理。
- 私有摘要与继续通知不进入公开正文。main重新保护同会话计划、来源、审批/拒绝与文件版本；保留完整有界记录/省略回执，记忆不授权。一个公开run可有多个真实整理卡；native entry提交与host终态分开。
- 摘要请求，包括原生split-turn的两个并行请求，共用活动时间/请求预算/真实usage账本；停止、预算耗尽、失败及提交前后退出不自动重放文件效果。成本未知。
- 正式默认自动启用只在模型能力已核验时生效；局部回退 `OMNI_EDU_PI_AUTO_COMPACTION=0`。E2E的65536较早阈值、故障/提交延迟仅未打包且隔离E2E开启，不能当官方窗口或部署默认。未修改系统DNS/代理/VPN，未提交/推送。

## 2. 来源与必要适配

- Hana0.449.0 Apache-2.0：新增 `core/session-compaction-runtime.ts` 的AST提取脚本与独立callback注入，保留先前SDK model/tools/system/context hook；摘要仍原生，失败传播。新源/output hash登记，静态来源核验SDK7+工具6共13/13一致；`hana-auto-source-audit.json`不是运行证据。
- Pi0.80.3 root没有导出prepareCompaction且仅ESM入口：精确版本检查后经 `import.meta.resolve` 定位固定原生模块；不调用私有SDK方法。
- 该版本末尾大toolResult不能直接当切点；只调增keepRecentTokens到完整最新工具批次，原生选择真实切点，保留toolCall/result配对，不自写摘要/有损截断。单元与实际中途两次读取均验收。
- 完整请求估计只包含实际provider可见字段，排除本地tool details/usage，使用UTF8 bytes保守估计。它不是精确tokenizer/账单，也未验证真实百万输入极限；过大当前任务不通过摘要把自己消掉。
- 继续使用已有HeroUI Pro ChatTool过程卡与finesse AI-console规则，没有新增依赖；右卡能力来源/策略清楚，整体一比一视觉仍P06。

## 3. 精确命令与最终结果

以下cwd均 `D:/WorkProject/EduProject/apps/desktop`。实例均真实Electron/DeepSeek、授权的合成教研资料及明确隔离历史副本。

| 命令 | 最终结果 | 报告/日志（test-results/xiaozhi-agent下） |
|---|---|---|
| `node scripts/xiaozhi-agent/pi-auto-compaction-ui-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-UVXuHm/data` | 18/18，exit0 | pi-auto-ui-ik9wla/report.json；pi-auto-ui-command-fixed.log |
| `node scripts/xiaozhi-agent/pi-auto-control-edge-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-UVXuHm/data` | 7/7，exit0 | pi-auto-edge-ft8SH3/report.json；pi-auto-edge.log |
| `node scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | 11/11，exit0；deterministic边界 | pi-auto-boundary-2ricaa/report.json；pi-auto-boundary-tool-cut.log |
| `node scripts/xiaozhi-agent/pi-compaction-ui-smoke.mjs` | 19/19，exit0；默认auto真实能力策略与手动回归 | pi-compaction-ui-igh8BW/report.json；pi-auto-manual-regression.log |
| `node scripts/xiaozhi-agent/pi-budget-ui-smoke.mjs` | 18/18，exit0 | pi-budget-ui-cskeLV/report.json；pi-auto-budget-regression.log |
| `node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs` | 17/17，exit0；可选旧SDK副本项未执行 | pi-control-ui-2AWPBO/report.json；pi-auto-control-regression.log |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | 13/13，exit0；静态来源 | hana-auto-source-audit.json |
| `npm run build` | exit0 | pi-auto-release-build.log |
| `npm run test:renderer-components` | 79/79，exit0；UI修改后 | pi-auto-renderer.log |
| `npm run test:smoke`（内含最终build） | ok=true、207/207、exit0 | pi-auto-legacy.log |
| `git diff --check`（repo root或子目录） | exit0；仅CRLF提示 | 收尾命令读回 |

自动18项覆盖真实長会话/重复整理/来源计划拒绝事实/usage/原任务随机码年级/双视口/两次自然文件读取中途整理/原生并行摘要/停止重启/摘要响应后注入提交失败/原生提交间隙实际kill/持久command防重/主动新任务继续/首个超早阈值任务零请求拒绝/跨会话隔离。7项另覆盖自动期间正式composer接着处理、SDK实际恰一条消费、1366×768与1920×1080输入及能力区域可达、native提交前真实kill、一个请求预算阻止额外调度及原副本不变。各套有重叠，不累加为独立场景总数。

双视口截图 `pi-auto-edge-ft8SH3/edge-1366x768.png`、`edge-1920x1080.png`：已实际查看，按钮/输入/能力区可达，DPI导致物理像素与CSS视口不同。当前侧栏/右卡/阅读布局仍非Codex一比一，不标U06通过。

## 4. 保留失败与修复先后

- p5EaIp：历史fixture绑定已不存在文件，测试helper先检查实际文件后选择，未改生产数据。
- 6mZysT：CJS resolve对ESM-only包失败，改固定ESM入口。dmdL5A：错误将本地tool.details再次计入provider估计；修正provider字段投影。dFs6q2：原生末尾大工具结果没有切点；按完整最近批次调整原生保留参数。之后真实efsbuu10/10通过基础范围。
- IDBHNf：扩展套14项已过，测试helper误取command.id（真实列command_id）；仅修正helper，最终ik9wla18/18。原失败报告保留，不算整套通过。
- “真实摘要响应之后失败”是明确的main故障注入；真实DeepSeek摘要成功不等于真实provider网络故障已覆盖。commit前/后kill为真实自有进程退出，测试不能证明电源断电或文件系统故障。

## 5. 仍未验收与下一项

无本轮新表/数据迁移；既有迁移10/10是docs/61的此前结果，未作为本轮新迁移通过。真实无VPN环境、百万输入极限、Windows installer、真实教师内容质量、provider真实断网故障、Hana缓存前缀优化尚未实测；前三项在最终安装/直连边界继续，不阻止此有界自动切片完成。

**下一项P04-B3：已有教育L1/L2/L3授权scope与可追溯脱敏、队列编辑/撤回。** 先核查既有local_only工具/证据关系与SDK队列API并冻结docs/65，不直接把全库记忆装入云prompt。随后P05 Skills、P06模型设置与一比一UI、P07办公联网、P08实际无VPN/打包；完整目标持续执行。

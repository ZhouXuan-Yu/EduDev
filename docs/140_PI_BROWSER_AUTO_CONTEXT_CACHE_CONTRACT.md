# 小智浏览器、自动上下文与 DeepSeek 缓存交付合同

日期：2026-10-04。用户本轮明确覆盖旧 58–64 的运行预算要求；旧数据保留，不再由正式入口的模型次数、工具次数、累计 token、累计运行或教师等待时长停止任务。真实取消、网络/工具单次超时、模型上下文与输出能力仍有效。

## 目标与现状

M01/M10 小智教育办公智能体，嵌入 Pi SDK，直接使用国内 API，不接 Codex CLI。128–129 仅提供搜索和静态正文，不代表浏览器完成。附件138–139只提交本地元数据，不代表模型读图或文件正文。

- 浏览器：真实页面导航、DOM快照、稳定引用操作、输入/选择/滚动/按键、标签页、可见窗口、取消和错误。参考 Hana Electron WebContentsView/原 SNAPSHOT_SCRIPT，避免另写浏览器引擎和另起任务 agent loop。
- 最新 SDK：npm/官方 release 核实 Pi 1.0.2（2026-10-04），当前生产0.80.3；先审查 SDK/原自动压缩源码与兼容面，再锁定升级。最新 native prepareNextTurn 在工具结果后检查 canonical context，优先使用原实现，不能将旧 admission 验收称为实际自动压缩。
- 缓存：Hana cache-prefix-contract/session snapshot/cache-preserving compaction 作为复用候选。固定已授权的 system/tool/schema/model 前缀，变化任务事实放在后续消息；权限变更必须真正失效，不能为了缓存保留撤销信息。DeepSeek 自动缓存使用完整已持久化前缀匹配；只用真实 prompt_cache_hit_tokens/miss_tokens 计算命中率，未知不能写零，不能保证100%。

## 实施次序与可核验清单

1. 保存138附件发送验收与进度；解除生产运行配额，保留真实用量、旧usage/settings与恢复兼容，移除预算设置卡。
2. 固定 Hana 最新 release/源码 SHA/Apache许可，提取原 DOM 快照与浏览器等待原语，保留来源与必需适配记录。密码/凭证不进入模型快照，网页是非可信资料。
3. 浏览器main宿主使用隔离会话，页面无Node/preload/业务IPC、禁止下载/权限/任意evaluate；公网URL逐跳/子资源校验，连接IP检查与实际连接一致。会话互相隔离；停止后不允许迟到动作；退出关闭 owned窗口与连接。
4. typed契约→主宿主→原Pi registry/执行scope/once→公开真实工具回执/来源→实际可见浏览器。页面写入/提交/账号/支付等动作走教师明确确认，确认不跨会话、页面或重启重放。
5. 安装并锁定评审后的最新Pi组件，适配原生自动压缩、工具结果边界、事件、技能/教育记忆/原JSONL。压缩保留任务目标、计划、来源、文档版本、教师批准与拒绝，不能将记忆提升为权限。失败明确终止，不吞错或静默截断继续。
6. 稳定前缀及真实缓存指标接入SQLite只存安全指纹/计数；合成教育材料多轮官方DeepSeek验证，实际自动压缩前后比较，不保存密钥/完整请求到公共报告。

## 兼容与回退

增量表与schema，不删除旧配额行、会话绑定、native JSONL或业务事实。旧usage按原schema读取，新不限额记录明确schema；不把旧上限用于正式运行。浏览器冷恢复只显示已知状态，实际操作须新指令，不自动导航或提交。升级保留旧文件副本进行验收，源码/依赖回退不能覆盖用户产生的新事实。

## 完成定义

实际Electron主窗口从可见入口操作浏览器，真实Pi调用→网页读取与动作→公开说明与来源→最终回复；教师确认/拒绝/取消/跨会话/窗口关闭/重启不重放均有证据。1366×768与1920×1080可达。真实国内站点与合成交互夹具分开记录，无VPN运行/Windows安装仍需独立环境验收。最新native实际中途压缩必须发生，原JSONL完整，工具及审批无重复。npm run build、renderer、专项实例及必要主smoke通过后写141验收与四根下一步。任何部分未验收就标未完成，不用文档或单元测试替代页面闭环。

## 官方来源

- https://github.com/liliMozi/openhanako/releases/tag/v0.450.0
- https://github.com/earendil-works/pi/releases/tag/v1.0.2
- https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/compaction.md
- https://api-docs.deepseek.com/guides/kv_cache/

不修改系统DNS/代理/VPN，不发布、push、派发子agent，不上传学生原图、教师私有资料或整库。D3/D4/E/全D1–D7/未知Skills设置参照/P08仍保留，当前优先本合同。

## 执行后的依赖与交付记录（2026-10-04）

本合同已按141验收；计划中的升级现在实际锁定pi-ai/pi-agent-core/pi-coding-agent/pi-tui四包1.0.2（MIT）。用途是最新ModelRuntime、原生上下文/资源/工具循环，不另加浏览器引擎/agent loop；浏览器复用Electron和Hana450 Apache源码。新SDK传递依赖包含chord/codemode/MCP，均由精确package-lock固定，不自动启用远程资源发现。

Pi coding npm包compressed7,467,472bytes/unpacked22,716,526bytes；当前安装目录含nested依赖34,415,957bytes，Photon0.3.4 Apache目录2,265,687bytes。Node要求>=22.19，当前Node24与实际Electron开发运行通过；体积不是最终安装包大小，Windows产物/worker/WASM/新传递依赖仍P08独立验收。原依赖锁副本在ignored测试根可供回退，回退不能覆盖新业务事实。安装exit0；旧进程曾锁clipboard DLL的EPERM清理提示未强删，安全审计现有5项未作无关升级，详情141。

正式浏览器/自动压缩/无累计预算/cache/UI与底层完成范围见141；旧完整18项人工小容量失败不抹掉，新旧副本6项不冒称全18。下一恢复位置为D3，不再从本合同的升级候选或附件D2-C开始。

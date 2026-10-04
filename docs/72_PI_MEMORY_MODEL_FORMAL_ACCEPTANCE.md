# P04-B3b2 正式教育记忆与上下文隔离验收

日期：2026-10-03；M10/M01；合同 docs/70，基础 docs/71，视觉基准 docs/67。最后 v2 正式记忆26/26、自动/旧历史9/9、原生17/17、状态13/13、组件79/79与最新主冒烟207/207均通过。B3b2/B3b及既定P04范围完成；全目标/P05–P08仍未完成。

## 1. 实际交付与来源

- `memory-tools.ts` 注册固定空参数 `read_education_memory/read_session_process`，renderer/模型不能提交其他会话、run 或条目 ID。main 复用已有教师记忆、脱敏、版本/指纹与安全过程投影；L3 只有实际来源分类，不伪造事件引用。
- production-host → Pi 唯一循环 → main authority/readSelected → 真实 SDK tool result → 公开来源/消息/隔离回执 → 现有 typed preload/UI。modelAccess 正式为 available；本地保存选择不等于立即把正文注入模型。
- 普通/摘要请求、工具前后、摘要提交前后验权限版本；500ms 观察器用于来源失效时中断等待，不构成第二模型循环。已发出请求无法撤回，已完成文件效果保留，不自动重放。
- 明确运行中“关闭并清空”：先核 CAS/version、持有配置锁、停止并等待本轮终态，再保存关闭空选择。过期清空不能停止当前轮次，其他活动配置仍 busy。
- 用 Pi 0.80.3 原生 branch/append 建立干净分支，保留原 JSONL 字节/历史。隔离污染后缀、派生文本和摘要，并从同会话 protectedContext 排除相关 run。记忆撤销与中断工具恢复回执分开；未知 marker、非法边界拒绝。
- 原生摘要会遗漏事实，因此仅对已经真实读过且仍有效的必要教育事实从 main 重验保护；不自动注入尚未读过的选择，不保存另一份记忆正文。Hana 原生回合/工具适配和既有 Pro ChatTool 继续复用；教师授权和撤销为必要教育适配，未复制跨频道人格记忆。
- 沿既有绑定 schema_version 增量采用 v2，新 reader 接受 v1/v2，未知未来版拒绝，setter 不降级。正式模型执行前写 v2，既有 v1 reader 的版本门禁拒绝它；原 JSONL/header/fingerprint 不重写。旧安装程序整体尚未实测，不宣称安装回滚已验收。
- 无新增依赖。Pi exact0.80.3 MIT、Hana0.449.0 Apache-2.0、既有本地 Pro 组件沿既有许可/清单；没有新的 Windows 服务、原生包或全局资源扫描。MCP 本轮查到组件文档，未返回 Codex 桌面组件实现，不称同源。

## 2. 精确命令与证据

工作目录：`D:\WorkProject\EduProject\apps\desktop`；输出均为被忽略的 test-results，合成教师材料/明确旧测试副本。PowerShell 用 `exit $LASTEXITCODE` 传播真实失败。

| 命令 | 当前实际结果 | 报告/日志 |
|---|---|---|
| `npm run build` | 最后 v2 build exit0 | pi-memory-model-build-final2.log |
| `npm run test:renderer-components` | 最后79/79、exit0 | pi-memory-model-renderer-final2.log |
| `npm run test:xiaozhi-pi-memory-epoch` | 17/17、exit0；原生 SDK/确定性 fixture | pi-memory-model-epoch-final.log；pi-memory-epoch-I2gwQq/report.json |
| `node scripts/xiaozhi-agent/pi-memory-scope-state-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 13/13、exit0；旧副本/新库，含 v2 不降级/未来版拒绝 | pi-memory-model-state-final.log；pi-memory-scope-state-LuA7XV/report.json |
| `node scripts/xiaozhi-agent/pi-memory-model-ui-smoke.mjs` | 最后v2 26/26、exit0 | pi-memory-model-ui-v2.log；pi-memory-model-ui-6D51NX/report.json |
| `node scripts/xiaozhi-agent/pi-memory-auto-ui-smoke.mjs test-results/xiaozhi-agent/pi-memory-scope-ui-R8nC5O/data` | 最后v2 9/9、exit0 | pi-memory-auto-ui-v2.log；pi-memory-auto-ui-miiKCM/report.json |
| `node scripts/xiaozhi-agent/pi-compaction-ui-smoke.mjs` | 本轮手动路径改造后19/19、exit0；在必要教育事实保护/v2绑定追加前 | pi-memory-model-compaction.log；pi-compaction-ui-US8RfT/report.json |
| `npm run test:smoke` | 最新v2 207/207、ok=true、exit0 | pi-memory-model-smoke-v2.log |
| 仓库根 `git diff --check` | exit0 | Windows行尾提示不作为错误 |

正式测试实际模型 `deepseek-flash`。官方能力 context=1048576；自动专项65536是仅隔离 E2E 的提前整理策略，不能冒称供应商容量或默认部署值。费用未知，未做 token 成本优化。

## 3. 正式实例含义

- 教师既有治理页真实创建/采纳/编辑 L2/L3，在小智页预览原文与脱敏文本，选择明确版本；模型实际读取随机教学偏好、引用别名/版本，电话不进入工具 payload，选择之外不返回文字。
- 手动 native 摘要、实际续问仍保留授权事实；治理修改/停用时停止等待，旧版本拒绝，停止后的迟到回答不能继续。
- 清空 → 新轮隔离原记忆/派生/真实摘要 → 重启 native 当前 branch 不带旧标记；SQLite公开历史和原字节前缀保持。本会话来源/授权不被新会话继承；1366×768/1920×1080控件可达。
- 明确 B3b1 测试副本原 v1 native 快照升级，真实自动摘要、撤销、重启、带未配对工具的进程退出与恢复。异常退出保留的问题只有教师主动回答才创建新 run，重复回答不新增；不同于停止/来源失效后的迟到响应。

## 4. 保留的失败与修正

- 1sSXeK：测试工具行标签写错，真实标签为“读取本会话教育记忆”；SDK 实际工具成功，修正对照后通过。
- IMOagY：25项后最后重启空白页/超时，与并行 build 重写 out 重叠；未采集该次 console，不能确认根因。随后不在重启期间改 bundle，26项通过；保留截图/报告。
- 4ojCux：实际自动模型摘要遗漏随机教学代号，不能把 compaction 事件成功当事实保留。已补“确已读取且仍授权”必要事实重验保护，后续自动实例通过。
- 8dAcKf：真实 DeepSeek transport 失败，保留失败；没有修改系统 DNS/代理/VPN或把失败改成成功。后续重新独立运行通过。
- 2lW2oL：测试把重启后的主动回答误当迟到，回答已合法启动恢复新轮，随后普通发送进入队列，错误等待“新增轮次”而超时。依既有 docs/57 用可见恢复入口回答、验证恰一新轮及重复防重；生产恢复规则保留。
- TS target 不支持 findLastIndex，改兼容有界遍历；不会为本修复升级运行时或 TS 配置。

## 5. 未验证边界与下一步

最终 v2 实例/冒烟全部通过后，台账勾选 B3b2/B3b/P04 的既定控制/记忆范围。下一条第一动作：P05 沿 Pi 原生 Skill 格式/显式发现与 Hana 管理路径，冻结教育 Skills 交付合同（备课资料、知识检索、解析/练习草稿、教学办公），只开放真实受控工具支持的能力；办公新写入/DOCX等仍按P07依赖贯通，不做虚假工具或静态产物。

P06 开始前必须重新读 docs/67 第1/2/5/8/9节与 docs/35；D1–D7仍未完成。完整Codex组件/布局、Skills/模型与设置、办公联网、实际无VPN/安装及最终八组实例属于后续范围，不能由本轮记忆或基础测试冒称已完成。无commit/push、真实教师库、系统网络或全局凭证修改。

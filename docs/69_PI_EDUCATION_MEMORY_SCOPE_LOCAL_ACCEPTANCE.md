# P04-B3b1 本地教育记忆预览与会话选择验收

日期：2026-10-03。M10/M01。合同：docs/68；Codex 过程与组件基准：docs/67。

**本切片通过；完整 B3b、P04 和 Codex 体验目标仍未完成。** 当前只提供本地预览与会话选择，页面明确显示“模型读取尚未接入”。没有注册教育记忆模型工具，不能把这次真实 DeepSeek 继续对话当作记忆引用成功。

## 1. 实际交付

- 新 shared/xiaozhi-memory 共享契约，main memory-selection / memory-scope-state / memory-scope，production-host 单会话配置所有权，typed IPC/preload，正式 PiMemoryScope 页面。复用已有 MemoryGovernanceWorkspace 教师编辑入口和已有 HeroUI Pro ChatTool，没有新增依赖或另一套模型循环。
- L1 只读当前会话最近 Pi run 的安全事件字段，不使用全库最近 run 兜底。L2/L3 读取现有 SQLite 记忆真源；原文只在本地明确预览，另显示既有教育脱敏结果和实际来源。
- L2 保留真实 run/event 引用；L3 仅有 sourceDocuments 来源分类，页面明确没有逐条证据，不伪造证据强度。
- 本会话默认关闭、零选择；显式选择最多12项。只保存层/来源/条目ID/版本/main指纹，新增 xiaozhi_pi_memory_scopes schema1、版本CAS。公开快照不含原文、私有指纹或额外权限字段。
- 重新查源后显示版本变更、停用、删除/不存在、无法核验；不自动升级授权。关闭并清空只移除选择，不删除原记忆。另一个会话不继承选择或L1记录。
- 配置与现有预算/目录/运行共用 main 所有权，运行期间拒绝保存，页面提示先结束或停止。旧会话无 scope 等同默认关闭；未来 schema/额外字段拒绝。原 SDK 工具集、prompt 和 JSONL 不改写。

## 2. 命令与真实结果

以下命令在 `D:\WorkProject\EduProject\apps\desktop` 执行；日志/报告均在该目录 `test-results/xiaozhi-agent`，使用独立测试数据根。

| 命令 | 结果 | 最新证据 |
|---|---|---|
| `npm run build` | exit0 | pi-memory-scope-build-validation.log |
| `node scripts/xiaozhi-agent/pi-memory-scope-ui-smoke.mjs` | 18/18，success=true，exit0 | pi-memory-scope-ui-validation.log；pi-memory-scope-ui-R8nC5O/report.json |
| `node scripts/xiaozhi-agent/pi-memory-scope-state-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 10/10，success=true，exit0 | pi-memory-scope-state-final.log；pi-memory-scope-state-RabHJY/report.json |
| `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-igh8BW/data/app.db` | 10/10，success=true，exit0 | pi-memory-scope-existing-migration.log；pi-state-migration-ht171X/report.json |
| `npm run test:renderer-components` | 79/79，exit0 | pi-memory-scope-renderer-final.log |
| `npm run test:smoke` | ok=true，207/207，exit0 | pi-memory-scope-smoke-final.log |
| 仓库根 `git diff --check` | exit0，只有既有CRLF转换提示 | pi-memory-scope-diff-check.log |

最新 build+专项 UI 在同一 PowerShell 顺序执行，build成功才启动UI；测试及主冒烟均显式 `exit $LASTEXITCODE` 传播结果。最后 renderer/state/main smoke 均运行于严格输入校验与 React key 修正后的源码，不沿用旧结果。

### 真实页面实例18项

正式 Electron + 用户已授权调试的 DeepSeek，只有合成教学文字与假手机号；现有教师页面实际起草、采纳、编辑 L2/L3，未直接插表冒充教师操作。

1. 新会话默认关闭、选择空、L1无全库回退。
2. 自然知识检索任务经真实 DeepSeek 完成。
3. L1归属本会话，公开字段有界。
4. 现有治理入口创建、采纳并编辑真实 L2/L3 事实。
5. 本地预览保留原文，脱敏文本掩码假手机号，显示真实 L2 引用。
6. 明确选择两项并保存当前版本，modelAccess仍 unavailable。
7. SQLite只保存选择metadata，SDK历史没有测试记忆标记。
8–9. 1366×768、1920×1080内容视口下操作控件可达。
10. 实际应用重启后会话版本/选择身份保持。
11. 新会话不继承授权或别人的L1记录。
12. 旧scope版本、额外权限字段、任意来源及不存在会话拒绝。
13. 选择保存后真实provider续问，SDK历史仍没有本地记忆内容。
14. 现有教师页面编辑L2、停用L3，保存的旧选择显示changed/disabled。
15. 旧来源版本不能静默保存为新授权。
16. 可见关闭清空操作成功，原事实仍在。
17. 真实活动Pi所有权拒绝修改，页面保存禁用。
18. 停止并重启仍无选择，不重放所选记忆。

截图：`pi-memory-scope-ui-R8nC5O/memory-1366x768.png` 和 `memory-1920x1080.png`。内容视口与PNG物理像素分别记录：PNG为2049×1152、2880×1620；不能把物理像素当CSS尺寸。本轮检查可达与真实状态，**没有完成 Codex 同DPI叠图验收**。

### 确定性边界10项

明确命名旧测试DB复制后增量、幂等迁移，既有教育/消息/历史事实readback不变；CAS恰一胜者；旧版本拒绝；原文/额外字段/重复/13项拒绝；未来schema/非法payload拒绝；全新DB/FK；目录投影无私有hash；L3弱来源；同版本文本改写由hash发现，停用/软删除失效；原测试DB字节hash未改变。

分页50为实现边界，本次真实UI仅少量记忆，没有覆盖超过50条的真实治理分页操作；不把它宣称为已验完整大目录。

## 3. 保留的失败与修复

- 初次 TypeScript 构建发现联合类型经Omit丢失层/来源关联，以及可空preload访问；修正类型投影及API存在校验后再构建，保留旧日志。
- `pi-memory-scope-ui-zoAEl4`、`Dtdvs8` 在第4项后发现同一aside下持续出现两个记忆面板。只读DOM核验是同会话两个兄弟组件使用相同key造成协调错误，不是动画。PiMemoryScope/PiBudgetCard改用领域前缀key；没有用locator.first隐藏重复节点。
- `pi-memory-scope-ui-PAyHEA` 已通过11项，但带额外权限字段的输入因另一配置占用先返回busy。提取共用严格输入校验，host先验证再认领配置锁；最新18项全部通过。
- 中途source规范化错误将请求字段/私有fingerprint带入selection验证；projectMemorySource明确只投影layer/source。保留失败构建/实例，不把首次失败称通过。

## 4. 来源与剩余边界

- 教育记忆与脱敏沿本项目已有事实/方法复用，Hana的分层/范围机制作参考；没有复制Hana人格/梦境内容，也没有本轮新增vendor代码或伪称重验其hash。
- 本轮再次用HeroUI Pro MCP查询chat-tool文档，MCP没有返回Pro实现源码；页面复用此前本地复制组件及CSS，原Pro许可边界按其README继续保留。不能称其与Codex桌面组件为同一源码。
- 不修改真实教师库、全局配置、系统DNS/代理/VPN；未提交或推送。真实provider路径本轮成功，不等于无VPN或安装包通过。
- 目前模型不读取这些选择，因此不存在本步新授权内容已进入模型上下文的路径。**未来B3b2必须解决已读取文本在SDK历史/原生compact摘要中的撤销隔离，不能仅关闭工具或删几段toolResult。**

## 5. 下一步第一动作

冻结B3b2交付合同：沿Pi0.80.3支持的原生上下文/新分支或epoch机制，确定选中事实逐次校验、运行中失效/撤销、旧历史/摘要隔离、旧SDK快照升级兼容和可查历史保留算法；再接本会话受控记忆工具，真实DeepSeek引用/失效/撤销/压缩/重启/跨会话验收。完成后才勾B3b/P04。之后P05 Skills、按docs/67执行P06页面/设置、P07办公联网、P08实际无VPN与安装，完整目标继续。

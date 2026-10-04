# P06c-B1 原生历史模型切换与恢复基础验收

日期：2026-10-03。合同 docs/91；M10/M01。**B1 基础通过，B2 正式接线与 B3 用户/提供商实例未完成。完整目标 active。**

## 1. 实际交付

- `model-switch-state.ts` 新增模型账本与 prepared/committed/aborted 意图；origin/native session/file/revision 固定，prepared 唯一与 CAS。单条 SQL UPDATE 的触发器同时提交 ledger 和 binding（schema5），检查归档/身份/旧模型/revision，冲突整条回滚。
- `native-model-switch.ts` 调用真实 Pi 0.80.3 `AgentSession.setModel`，原生 `model_change` 与私有 intent/commit receipt 按 ancestry 双源核验。prepared/intent 阶段退出恢复为 aborted；native/receipt/committed 阶段恢复为 committed，第二次恢复无新 entry。恢复不 prompt、不 setModel、不执行工具或旧审批。
- 同一 JSONL/session ID/原 message entries 和创建 snapshot 保留；没有重写创建模型指纹。严格私有文件身份、限定当前格式 v3/64MiB、原始 JSONL 与 SDK 缓存一致、ID 唯一与父链可达，拒绝损坏行、缓存外写、未知变化、异会话和逃逸路径。
- Hana0.449.0 原生 switchSessionModel 的容量检查与错误 helper 从 AST 提取复用；`floor(contextWindow*0.9)-4000` 与当前 usage/estimateTokens fallback 保留，i18n 改为固定 `context_limit`。未复制 Persona、服务端协调器或权限逻辑。Apache LICENSE 与既有 third_party 原件 hash 一致；source manifest 登记原文件/输出 hash。
- `session-state.ts` 接入 `modelSwitch` 及幂等增量建表，生产只创建空表。**没有 IPC/页面接入；当前有历史菜单继续锁定，getBinding 仍拒绝5，B1 的 schema5 写入只在 owned 实例中调用。** B2 必须同时改原生身份准入、生产恢复和 schema fence，不能只放开版本或菜单。
- 无 npm 新依赖，无真实教师数据、凭证、系统网络改动，无提交/推送。

## 2. 精确命令与结果

工作目录 `D:\WorkProject\EduProject\apps\desktop`。所有表中命令 exit0；固定最后 build 后运行 main smoke。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | tsc/electron-vite通过；renderer index-CaaHO90h 未变 | test-results/xiaozhi-agent/p06cb1-build-final3.log |
| `npm run test:renderer-components` | 79/79 | p06cb1-renderer.log |
| `node scripts/xiaozhi-agent/pi-history-model-switch-smoke.mjs` | 26/26，networkRequests=0 | pi-history-model-switch-HiKebR/report.json；p06cb1-switch-final3.log |
| `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 10/10，明确 owned 旧库副本/全新库；业务/消息/run数量不变 | pi-state-migration-Jjagiu/report.json；p06cb1-migration.log |
| `node scripts/xiaozhi-agent/pi-model-settings-boundary-smoke.mjs` | 18/18 | pi-model-settings-boundary-dnGVCv/report.json；p06cb1-settings-boundary.log |
| `node scripts/xiaozhi-agent/pi-model-settings-host-lock-smoke.mjs` | 6/6 | pi-model-host-lock-sDls5r/report.json；p06cb1-settings-host.log |
| `node scripts/xiaozhi-agent/reuse-hana-model-switch.mjs --verify` | 3，静态源/输出/license核验 | p06cb1-source.log；vendor/hana/model-switch-source-manifest.json |
| `node scripts/electron-smoke.mjs` | 固定最终out 207/207，ok=true，exit0 | p06cb1-main-smoke-final3.log |

仓库收尾 `git diff --check` 与本轮新增文件尾空白检查结果在后续确认项；不修改仓库 autocrlf，不格式化既有脏文件。没有 skipped 专项；B2/B3、真实提供商续问与其用户路径明确未运行，不能当 skipped 成功。

**最终确认项：** 最后build-final3后主smoke207/207、ok=true、exit0；标准git diff --check exit0（仅仓库已有LF→CRLF提示），本轮9个源码/脚本/合同/验收文件尾空白0，p06cb1-diff.log与p06cb1-new-whitespace.json。最终原字节native report/migration report/source manifest已保存到 `docs/design/codex-2026-10-03/p06-model-switch`，artifacts.json记录bytes/SHA256；没有复制数据库、凭证或教师原文件。

26项包括：实际 SDK 双向切换与重开；五个退出阶段/第二次恢复零改写；abort 后新切换；独立 SQLite handle 并发；binding/ledger 冲突原子 rollback；归档竞态不恢复权限；host lock/权限/Hana容量拒绝；未知 model_change；setModel 原生变更后 event 抛错恢复；错身份/路径；篡改 receipt；pending 期间异常消息；authority 隔离 B1 fail closed；异常 schema/ID；同模型无写入；坏 JSONL/缓存外写/循环父链；网络零请求；native/ledger无 synthetic credential。

## 3. 失败与修复

保留 p06cb1-build1.log：工程 ES2020/Node resolution 不能直接导入 pi-ai/compat，改为已锁 SDK `Parameters<AgentSession['setModel']>[0]`；replaceAll 改 regex。之后 strict narrowing 提示已返回 aborted 分支仍比较 aborted，删除冗余比较，build-final3通过。

原生实例首次 PVfTqe 在 Node SQLite null-prototype row 与普通对象的断言上失败；检查字段不变，显式转普通对象进行精确比较。laxEFq20项/v0Nqok23项等中间通过不作为最终26项。新增文件一致性风险后补齐3项，最终 HiKebR26项。

Hana AST 首次选错上下文变量名/假设 LICENSE 路径失败，按真实 switchSessionModel 的 `const msgs` 至 setModel 前块提取，并读现有 `third_party/openhanako/LICENSE`；没有手写替代容量公式。来源证明仅静态；不等于生产用户路径。

## 4. 下一步与未验边界

1. 读四根→docs/67第1/2/5/8/9→35最新→91/本节，冻结 docs/93 的 B2 接线及 authority 分支恢复补充。图查 `createPiXiaozhiSession`/生产 execute/模型服务/Pi原生；不要再选引擎。
2. 主进程核对 ledger+JSONL 原生链后把 origin_model 提供给原 fingerprint，不改 snapshot；当前目标仍用于真实请求、完整 system/messages/tools/output 准入和 native compact。idle switch 加载同一 JSONL 的短寿命 SDK 对象，setModel 后 dispose，下一轮重新配置新目标，不能让旧恒定 stream/compact closure 发送新目标。
3. memory/skill epoch 改分支时仅以 durable 已授权模型状态在隔离分支重新登记模型，不复活旧消息/摘要或工具权限。B1 此情形明确拒绝；B2 必须设计私有恢复 receipt 与 audit 白名单及真实撤权测试，不能直接删掉 audit。
4. 现有全局配置锁+官方目录验证→绑定会话 ledger revision CAS→原生 coordinator→typed selector→正式 menu；快照/start/settings view 先恢复 pending，关闭/归档/竞争都不产生晚到副作用。getBinding schema5 只在这些契约同时贯通后开放。
5. B3 真实正式 Electron 同会话 Flash↔Pro/重启/旧标记续问、整理/停止/审批不重放/authority撤销/双viewport。B1 SDK对象重开仅证明 native history保留，没有提供商请求和正式菜单实例，不能勾完整P06c-B。

之后完整设置C→D1–D7精准视觉→P07办公/联网/图片/产物→P08实际无VPN/安装/最终八组；总目标未完成。

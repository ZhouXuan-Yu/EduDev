# P07-A1 Pi原编辑与本地版本撤销基础验收

日期：2026-10-04。合同110、共同合同109；M10/M01。前一目标轮107→108为进展；本轮新增可执行主进程基础和真实SDK/SQLite/文件/退出证据。**A1通过；完整P07-A及Codex目标未完成，下一必须继续A2/A3正式工具与用户审阅。**

## 1. 真实交付与来源

- shared/xiaozhi-changes.ts固定xiaozhi.change.v1、公有事实/本地review、revision决策和create/edit输入；renderer决策契约不接路径/root/正文/hash。
- text-edit-proposal.ts直接调用已安装Pi0.80.3 root exports createEditToolDefinition/createWriteToolDefinition，custom operations只读写内存。原唯一/重叠/模糊匹配、BOM/CRLF/原line ending算法保持；原generateDiffString/generateUnifiedPatch从捕获实际before/after字节生成审阅，不另写替换或diff算法。
- text-change-state.ts新增xiaozhi_pi_text_changes，保存会话/run/call、workspace/input/hash、before/after原字节、原diff/patch、revision/CAS及状态。schema/hash/UTF8/体量/原diff-patch重新核验；坏审阅文本也fail closed。64KiB文本、16替换、512KiB diff/patch、每会话256条；本地before不自动进入模型/公开消息。
- text-change-service.ts授权路径/原workspace-authority、链接/hardlink/Windows别名/排除数据根保护；批准前零写，批准及apply都核来源版本，Pi原mutation queue串行同目标。同步同目录wx/flush/最后重核/原子rename；新产物exclusive link安装防覆盖并发新目标，安装后临时文件删除，实际文件nlink1/hash回读。
- undo只教师明确决策且当前after版本吻合，恢复before或删除本次新产物；手工后改拒绝。SQLite/FS不能同事务，intent先落库，执行/撤销退出变uncertain/undo_uncertain；verify只读实际文件，不重放写。物理完成后晚取消不能把已提交文件标未写入。
- session-state按领域组合changes/migrate/recover，不堆db.ts；新表增量幂等，旧copy/业务/历史/模型数据不改。无新依赖、IPC、renderer/工具注册、产品真源或云上传规则。

Pi版本和原工具/exports来自实际node_modules及已锁依赖，MIT全文在third_party/pi/LICENSE。本轮不复制Codex组件源、不改原Pro32；HeroUI MCP chat-tool/code-block已核，Finesse ai-console原在流确认/依据/回执/常驻停止继续。Hana line-diff额外包装无须引入，Pi已供原算法。

## 2. 精确门禁与实际边界

cwd：D:\WorkProject\EduProject\apps\desktop。最终build2，renderer index-BM1rsdTp.js（renderer未改，不能用其相同hash推断main未改）。最后主smoke同源码重建，实例期间没有运行时源码/out修改；只有隔离test脚本增加并发/链接检查。

| 命令 | 最终结果 | 证明边界 |
| --- | --- | --- |
| `npx tsc --noEmit` | exit0，p07a-foundation-typecheck1.log；之后build2再typecheck | 类型，不是UI |
| `npm run build` | build2 exit0，p07a-build2.log | main/preload/renderer构建 |
| `npm run test:renderer-components` | 79/79、exit0，p07a-renderer1.log | renderer未改，现有状态兼容 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes、exit0，p07a-pro-source.log | 原组件源，不是Codex同源证明 |
| `node scripts/xiaozhi-agent/pi-text-change-foundation-smoke.mjs` | 最终20/20、exit0，W2QfNr，p07a-foundation3.log | 真Pi/SQLite/FS/子进程退出；零provider/零UI与IPC |
| `npm run test:smoke` | 最终同源码207/207、ok=true、exit0，p07a-smoke-final2.log | 原生产用户路径兼容，不包含新增编辑UI |
| `git diff --check` | exit0，p07a-diff-check.log | 未提交/push；原大脏树保留 |

20项覆盖原SDK多处修改/Unicode模糊/BOM+CRLF/重复重叠和no-change拒绝，批准前零写/拒绝、call唯一/旧revision、双会话拒绝、确认前后源冲突、create批准/真实新文件/undo删除、竞争目标/缺父目录、undo冲突、stop/abort/撤权、路径/设备/格式/hardlink/junction及目标替换、UTF8/NUL/大小/nested输入、幂等恢复、坏blob/hash/diff/schema、四个真正process.exit(73)切点和旧真实隔离数据库副本迁移。

并发同revision批准/拒绝只有一个成功，同目标两个apply只有一次安装、最终revision3。子进程分别在intent/file/undo-intent/undo-file退出，重启恢复不prompt、不写；教师verify只hash读取，前后文件字节相同。旧库副本学生/资料/messages/runs/confirmation全行readback保持，原测试源app.db hash保持。没有真实教师资料或数据库参与测试。

前置foundation1 18/18 GTEu7O，foundation2扩并发/链接20/20 VbmxqX；随后发现原tool details diff用normalized视图，而ledger要核实际原字节，改为Pi root原算法从原字节统一生成/重新验证，foundation3 W2QfNr20全过，未放宽原断言。当前专项零失败/零skipped；源码读取曾误用不存在脚本/SDK LICENSE路径，已核正确文件与third_party/pi/LICENSE，不把这些读取错误当运行失败。

## 3. 未完成与下一第一动作

**当前用户页面还不能调用新增编辑工具或审阅/撤销。** 不因A1 20项或原主207通过勾完整A，不拿service脚本当真实教师路径。新增工件的run identity/active/全局owner、teacher wait和主frame typed API需A2生产宿主接线；SDK静态工具历史指纹需增量office能力版本，不能改旧创建snapshot；停止/关闭/撤权与压缩不得复活内容。

第一动作：四根→67§1/2/5/8/9→35最新→109/110-A2/A3与本文，冻结112正式Pi工具/持久等待/旧native快照兼容/typed main-frame/UI审阅合同。复用现有SessionExecutionRegistry、Hana execution-once、Pi budget.wait、原审批协调模式和原ChatTool/CodeBlock/Tabs/FileTree；模型仅收到脱敏必要结果和真实产物回执，不自动发送before原文或整个diff。

然后自然任务真实DeepSeek从小智页面起点、审阅拒绝零写/批准一次/实际打开、修改摘要/undo冲突/stop/kill/restart/权限及Skills/模型/compact边界、actual native1366/1920、SQLite/FS readback。完整A通过后109 B OfficePDF/C国内联网/D附件图像/E持久goal与P08；当前每run计划仍非goal。官方未知Skills/设置参考未答，原R1/R2/Pi/Hana/中国API/教育隐私及谱系保持，总目标active/三元题组暂停。

## 4. 证据归档

原字节logs/reports/source与最终main/preload/renderer及实际Pi工具source hash归档design/codex-2026-10-03/p07-text-foundation/artifacts.json，逐文件bytes/SHA回读。只报告/源码/合成公开证据，不复制SQLite、native JSONL/私有摘要、before原字节、Key或教师资料；原测试owned fixtures留在ignored test-results以供下一继续。

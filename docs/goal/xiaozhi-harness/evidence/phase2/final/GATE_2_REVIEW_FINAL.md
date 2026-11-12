# Gate2 独立最终审查

## 结论 ACCEPTED

日期为2026-11-12，范围为T2.1–T2.4、PHASE_2_IMPLEMENTATION.md及03/05/08协议。工作树D:/WorkProject/EduProject-harness，分支codex/xiaozhi-harness-20261112，基线HEAD eefb674421bf7bd8d8896d98a1b74c070fb43443，加最终冻结Phase2改动。

最终54个受审源码、测试、构建、依赖及合同文件的逐文件SHA256见final-reviewed-source-hashes.json，完整字节副本在final-source/。原第一轮55文件和source/保持原样。差异为移出两个未引用候选CJS并新增native-stat-require.ts。实施报告按授权补齐结果表后已更新其非生产文档hash，其他53文件保持一致。

测试后再次核对实施冻结记录，29个生产/测试/构建文件、90个out/main文件均0差异，证据post-test-source-out-verification.json。当前artifact为88562字节、22个本地source依赖，SHA256为0c327b73170a428d809b7239406b2e53ef931887a88826a01ad025ad96036831。

## 亲自执行的验证

前三条工作目录均为D:/WorkProject/EduProject-harness/apps/desktop。全部exit0，生产专项同时要求report.success=true及逐项pass。

| 精确命令 | 结果 | 报告 |
|---|---|---|
| node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs | PASS 10/10 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase2-contract-UeZC8b/report.json |
| node scripts/xiaozhi-agent/capability-phase1-smoke.mjs | PASS 32/32 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase1-f4foPM/report.json |
| node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs | PASS 24/24 | D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/capability-phase2-production-bNFOhJ/report.json及worker.log |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate2-review-e5b2cc90dfbc4ea2a4398658020c53fb/fixed-loader-probe.mjs | PASS 5/5 | 本目录fixed-loader-owned/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate2-review-e5b2cc90dfbc4ea2a4398658020c53fb/snapshot-readback-probe.mjs D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/capability-phase2-production-bNFOhJ/external-root.json | PASS 8/8 | 本目录snapshot-readback-owned/report.json |
| git diff --check | PASS exit0 | 本轮工具记录，存在LF/CRLF提示 |

生产24项使用实际Electron、锁定Pi 1.0.2、原production-host、Boundary、Task/Journal/Receipt、真实SQLite及真实Native artifact，模型协议为loopback SSE，真实远端模型请求0。worker从当前源码独立打包后在Electron运行，当前out的artifact bytes另行检查并实际执行。仓外dataRoot为C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase2-user-data-9vSITb/data，NODE_PATH清空，三个同名依赖marker加载次数0。

自有Snapshot探针从上述实际生产fixture数据库以只读连接VACUUM复制，仅修改副本。七种JSON身份字段错置即使重算正确hash仍全部拒绝，恢复后历史与原值一致。原数据库无写入。

## 四项发现闭环与门禁事实

| 条目 | 关闭证据 |
|---|---|
| G2-F01 普通升级旧实现保留 | 真实V1返回text/plain，真实V2归一化返回application/x-native-stat-v2。同Run升级后继续执行V1及其确切version/hash。删除V1实际文件及缓存后，本次execute返回provider_version_unavailable，V2调用计数不增加，旧Snapshot不覆盖。显式safe-point refresh另存关联Snapshot及explicit_refresh原因后V2才执行，新Run选择当前V2。 |
| G2-F02 实现身份 | 旧函数toString方案已换成实际CJS bundle bytes的SHA256与可信ExecutorMap。修改归一化和仅修改fileVersion依赖均生成不同artifact身份。伪descriptor及改字节拒绝。独立探针核对22 source hashes、当前及out同字节，并通过仓外加载器执行原Hana文件stat。 |
| G2-F03 当前Conformance | 原full Snapshot保持历史值，Optional证明丢失后的本次最终结果为partial且披露mime缺口。Required证明撤回时0次新artifact执行，统一结果采用本次native assessment。 |
| G2-F04 依赖解析 | 当前loader使用可信应用package根和受控require，禁止数据根决定npm解析。自有仓外ipaddr.js/undici/jsdom marker均0执行，合法artifact实际stat成功，relative/absolute/不支持specifier拒绝。实际Electron仓外retained V2冷启也通过。 |
| Snapshot归属/selection | 实际SQLite拒绝伪providerHash/version/conformance/revision/evidence写入，数量不增加。跨owner合法JSON+匹配hash错置拒绝。自有七身份字段错置反例和还原readback通过。 |
| 无关变化/撤销 | 无关Registry revision保持相同Snapshot和选择。Provider版本撤销优先于retained bytes/旧Snapshot，当前scope与Run在执行前后重验。 |
| 同Session激活/恢复 | 稳定Bootstrap与原明确工具共存，新相关Provider在原Pi Session安全点安装并使用。同Run所有调用保留Task/Run和Journal准入，冷Pi Session重建沿Composer continueTask恢复同Task与新围栏Run。 |
| 统一执行边界 | 三个稳定入口进入原customTools→Boundary→Task safe-read→Journal admission。实际延迟artifact取消后，底层迟到settle受旧Run fence约束。Boundary超时后实际效果锁保持至真实settle，包含nonresolver local_cache的刷新围栏。 |

未发现剩余Phase2阻断项。Registry/Provider Snapshot为原SQLite的附属表，复用事务和serialized writer，未引入第二Agent Loop、Task真源或Permission系统。新增入口只接已验证只读Native stat，后续写Provider仍需单独效应分类和业务准入。

## 保留的失败证据

原预审G2-F01/F02/F03及Snapshot建议保存在C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase2-code-pre-review-20261112.md及其sources目录。Gate2第一轮因实际G2-F04判REJECTED，GATE_2_ROUND_1_FINDING.md及最初55文件快照保留。

G2-F04原探针目录为C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate2-loader-probe-40387a75fb284314af5efe6283700c4b。两次预期仓外MODULE_NOT_FOUND的假设断言失败，原因是本机祖先C:/Users/ZhouXuan/node_modules提供依赖，纯净新机缺依赖情况未验证。随后相同已验bundle实际执行TEMP数据根的无害依赖marker，形成P1证据。report.json、两个脚本及failed-assumptions.log完整保留。

本审查第一次out核对将绝对路径再次与workspace拼接，产生伪missing结果。修正IsPathRooted后对29源码和90 out/main重新核验为0差异，错误输出另保存在post-test-source-out-verification-path-error.json，未据该错误判产品失败。

实施Agent的h4DsjS在23项通过后撞到150秒整套fixture预算，仍按原FAIL保留。最终runner只把外层预算改成240秒，产品Run/Tool预算未改。独立生产套件最后检查152434.7628ms，最后同Task续接18513.7678ms，实际总时长超过旧150秒预算，预算放宽没有被解释为性能改善。

## 读取的实施证据

本审查读取了最终build日志C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase2-build-loader-final.log，主进程/preload/renderer完成，renderer构建57.48s。本审查未重建out。

已读取renderer-components日志246/246，以及Hana14/14、Office文档边界12/12、Task Store8/8的success报告。这些suite由实施Agent执行，本审查没有重复运行。对应路径分别为TEMP/xiaozhi-harness-phase2-components-final.log、test-results/office-plan/hana-tools-cL3lJb/report.json、TEMP/xiaozhi-office-boundary-0Fi7Kp/report.json、test-results/xiaozhi-agent/pi-goal-task-store-hAMtp8/report.json。

root报告最新npm audit返回28项，low8/moderate12/high8/critical0，exit1由漏洞清单产生，首次TLS失败保留。此项为root读取的审计证据，未作为安全通过。Phase2未新增依赖、未修改lock。

## 性能、边界与回滚

独立生产fixture的dependency-only artifact首次载入2.5419ms，安装布局副本实际Native30次均值1.067313ms、P95 1.3055ms。stop receipt为87.6148ms，人为三秒延迟的底层settle为3038.5956ms。该fixture变体artifact为88581字节，正式当前artifact为88562字节。

独立原能力32项中的同文件交错测量，原Native50次均值1.206778ms/P95 1.6906ms，适配50次均值3.149904ms/P95 4.0015ms，Resolver100次均值0.771715ms。新增元数据层存在实际开销，原命名工具入口保持。

实施文档记录三个Bootstrap function Schema合计2098 UTF-8 JSON bytes，属于静态Schema字节统计，未运行tokenizer。真实模型质量、模型响应速度、教师页面体感与长期资源表现留待后续验收。

当前验证涵盖源码worker、安装布局副本及out artifact身份。真实asar安装包、Windows完整安装/换机移植、页面与最终全量207按Phase8执行。Phase0 F01终端scope、F02旧MCP hints、F03审批重启和F04完整Effect metadata继续后续Phase3/6，整体P0尚未由Gate2关闭。

回滚恢复Phase1接线并一致重建应用。新增版本档案/Snapshot表保留历史事实，教师文件、已确认成果、原Task/Run/Journal与旧Provider引用保留。Capability Definition跨版本共存与可信迁移尚未实现，继续明确记录该边界。

本审查仅写自有TEMP探针/报告和正常测试生成目录，未修改生产/测试源码，未commit/push，真实模型请求0。

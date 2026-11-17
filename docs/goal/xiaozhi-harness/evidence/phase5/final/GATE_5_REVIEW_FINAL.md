# Gate5 独立源码与集成验收报告

结论为 **ACCEPTED_SCOPED_PHASE5**。冻结合同P5-01至P5-12在本机当前交付范围内通过。未确认本阶段P0/P1缺陷。runtime已释放，owned进程库存为0。

## 受测身份

工作树为D:/WorkProject/EduProject-harness，冻结基线ffb6c90，HEAD标识7a93b4b，Phase5 WIP。角色只读审查生产源码并执行独立验收，Git和状态文档由root维护。

- FINAL_FREEZE.json SHA256为ac07f17cf9485722052836955602f3efd90888ef88196d627f9f52017286f126。
- 2984份source清单SHA256为248b93c622ebcb849ebd59d1f40d80a79251e6178bbada97285a6a3952e46e07。
- 471份out清单SHA256为3f4b9db94f1cc0f0e69960d1a5943506da7b88941e44577dc8d070d2f8b9102e。
- 3份固定artifact在前、中、后检查均无差异。shipped helper为52736 bytes、915a468e8747b93db77f3fb2c7424e43405ccd7ba973cad029af8b510ef5cf0f。
- 584份core manifest输入逐份重算无差异，sourceHash为79e6d2484ee488979d1f3a108b4536d88a06663de887efd8af36ecf511cb70f5。
- 20份实际依赖metadata/入口/native二进制前后SHA无差异。Node24.12.0、Pi SDK/MCP1.0.2、Electron43.8.3、sqlite3 6.0.1。

身份记录位于identity-before.json、identity-during.json、identity-after.json、dependencies-before.json、dependencies-after.json与summary.json。当前整项目graph为0节点，Extension小域graph可检索，源码判断由小域符号和冻结文件读取共同支撑。

## 独立实际运行

下表命令工作目录均为D:/WorkProject/EduProject-harness/apps/desktop。十一套145项全部PASS，runner全部exit0。补充探针5项全部PASS、exit0，合计150/150。最终集中套件FAIL0、SKIPPED0。

| 集合 | 实际命令 | 结果 | exit | 证据 |
| --- | --- | --- | --- | --- |
| governance | `node scripts/xiaozhi-agent/phase5-governance-smoke.mjs` | 11/11 PASS | 0 | [原始报告](D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-governance-OcbrRK/report.json) |
| extension-protocol | `node scripts/xiaozhi-agent/phase5-extension-protocol-smoke.mjs` | 16/16 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-protocol-jCmuhW/report.json) |
| acquisition-lifecycle | `node scripts/xiaozhi-agent/phase5-acquisition-lifecycle-smoke.mjs` | 14/14 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-acquisition-lifecycle-h07Sa6/evidence/report.json) |
| renderer | `node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs` | 33/33 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-acquisition-renderer-hbdxek/report.json) |
| extension-native | `node scripts/xiaozhi-agent/phase5-extension-native-smoke.mjs` | 21/21 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-UhGkzi/evidence/report.json) |
| extension-package | `node scripts/xiaozhi-agent/phase5-extension-package-smoke.mjs` | 18/18 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-heSMW4/evidence/report.json) |
| recovery | `node scripts/xiaozhi-agent/phase5-extension-recovery-parent.mjs` | 2/2 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-recovery-V76VIp/report.json) |
| production | `node scripts/xiaozhi-agent/phase5-production-smoke.mjs` | 5/5 PASS | 0 | [原始报告](D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-production-ZNtzfV/report.json) |
| mcp-lifecycle | `node scripts/xiaozhi-agent/phase5-mcp-lifecycle-smoke.mjs` | 11/11 PASS | 0 | [原始报告](D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-mcp-lifecycle-dfSW6A/report.json) |
| extension-host | `node scripts/xiaozhi-agent/phase5-extension-host-smoke.mjs` | 6/6 PASS | 0 | [原始报告](D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-extension-host-7Rmes2/report.json) |
| ui | `node scripts/xiaozhi-agent/phase5-ui-smoke.mjs` | 8/8 PASS | 0 | [原始报告](D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase5-ui-xe6Fud/report.json) |
| stdio补证 | `node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-gate5-independent-20261117/stdio-negative-probes.mjs` | 5/5 PASS | 0 | [原始报告](C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-stdio-OGs0TO/evidence/report.json) |

stdio真实初始化被guest读入后持续挂起500ms，父取消至pending和完整close共79.4348ms。220KB请求面对不读stdin的真实guest，在750ms后仍pending，父控制取消至pending与完整close共62.4252ms。两次实际helper结果均为cancelled，Job0、profileRemoved、ACE0。另三项明确使用fake main-helper控制通道验证wrong_sequence、wrong_identity与extra_field，报告保留合同测试边界。

44个去重actual native cleanup均满足Job0/profileRemoved/ACE0。Host6的exit-sqlite-resources.json为空数组。24个本轮owned目录经Win32进程命令行和可执行路径库存匹配，存活数0。runtime-inventory.json记录检查时间与范围。

## 源码审查结果

检查了原Pi Session装配、core-governance与tool receipt、acquisition state/service/npm/source/managed adapter、controlled transport/service、Extension host/service/package/registry/RPC、SessionInput及JobLimits。Pi继续承载唯一生产Agent Loop，SQLite原Task/Journal/Permission继续承载权威事实。当前静态读取和上述实际链未确认P0/P1缺陷。

当前UI8实际启动冻结out，Host/Pi等专项从同一冻结source构建TEMP或test-results测试包。两类证据的入口和路径分别记录。复验期间生产源码内容和out字节保持冻结身份。

## P5合同逐项映射

| 固定条目 | 状态 | 原criteria | 证据 | 适用范围 |
| --- | --- | --- | --- | --- |
| P5-01 | PASS | M-01, M-07 | lifecycle14 L01/L02 | 多来源规范化、分页限额、坏条目隔离与发现缓存。目录在线可用性沿各来源原始记录。 |
| P5-02 | PASS | M-02/03/04, A-P0-03 | lifecycle14 L03–L08、Pi5 | 已审核精确filesystem包及其依赖与许可。当前Pi复验复用已验证真实包，首次fresh获取见实施原始证据。 |
| P5-03 | PASS | H23, P-01/02/05, A-P0-02/08/09 | governance11、Pi5、Host6 | 当前Session全部具名Tool集合等值、Registry身份、真实Grant引用、effect/validator与动态私有历史拒绝。 |
| P5-04 | PASS | A-P0-03/05 | 本Agentstdio真实2、私有ACK合同3、原stdio5 | 真实初始化挂起和pipe背压时取消，私有helper ACK使用明确fake控制通道，原stdio5覆盖真实ACK分块与服务lease。 |
| P5-05 | PASS | A-P0-03/06/07 | native21、package18、MCP11、recovery2 | 当前Windows AppContainer/Job、process/dependency/secret授权、来源漂移、socket/sibling阻断与owned清理。 |
| P5-06 | PASS | A-P0-03/06 | 资源原10及六文件SHA一致读回 | 本机实际支持的CPU与聚合内存API路径。真实API unavailable分支保持NOT_RUN，源码Set/Query/port失败分支可见。 |
| P5-07 | PASS | P-03, A-P0-09 | Pi5、lifecycle14 | 原Task内准备、注册、安全点刷新与Dispatcher执行，以及取消、owner、CAS与旧active保护。 |
| P5-08 | PASS | M-05/06, A-P0-05/08 | MCP11、governance11、UI8 | DPAPI、Secret Scope、替换/clear、schema重审、旧closure撤销与synthetic echo脱敏。 |
| P5-09 | PASS | M-08, A-P0-06/07 | RPC16、native21、package18、Host6 | 本地来源、context.transform/event.observe双钩子与窄RPC，disable/revoke/health/更新回滚。 |
| P5-10 | PASS | T-05/06/07/12/13 acquisition范围 | recovery2、package18、lifecycle14、Host6 | 真实SIGKILL切点为binding intent提交后rename前，以及rename后prepared事务提交前。保留旧选择与Grant并显式重试，完整Task/checkpoint/PTY沿Phase6。 |
| P5-11 | PASS | M-07/09, A-P0-07 | lifecycle14、MCP11、native21、Host6 | 有效/过期/撤销缓存分别验证，旧会话终止，新调用阻断，原生路径保留。 |
| P5-12 | PASS | UI-05/06/07/09/10/11阶段证据 | UI8、renderer33 | 真实main/preload/设置/Task/回执、两尺寸与cold。完整页面与教师体验由Phase7 Terra验收。 |

## 原89条矩阵建议

以下九条可按当前交付范围新增PASS。root负责应用到原矩阵。现有31条PASS保持原范围，新增九条后为40/89。A-P0全局项、完整Task/checkpoint/PTY恢复、规划、Terra页面和全系统质量门禁保留原状态并补充阶段证据。详细动作清单位于criteria-recommendations.json。

| 原ID | 建议动作 | scope |
| --- | --- | --- |
| M-01 | PASS候选 | 当前reviewed/Official MCP Registry/GitHub/community适配器的有界规范化与来源保留，在线可用性按原来源证据披露。 |
| M-02 | PASS候选 | 发现候选保持隔离，未经过验证注册的候选无生产执行路径。 |
| M-03 | PASS候选 | 固定已审核filesystem recipe、完整npm依赖锁、官方Node recipe、当前Scope和功能验证满足后的自动准备与注册。 |
| M-04 | PASS候选 | 未知来源、许可和安装脚本保持隔离或原审批状态。 |
| M-05 | PASS候选 | 当前HTTP/受控stdio MCP的live schema变化清空信任，权限范围变化按原Scope重新审批。 |
| M-06 | PASS候选 | 当前MCP安全输入、DPAPI密封引用、对应consumer与Secret Scope，合成秘密未进入普通配置/日志/Skill/JSONL。 |
| M-07 | PASS候选 | 发现缓存与已验证安装分开保存，安装有效期、来源字节、撤销状态和当前Task授权共同约束离线复用。 |
| M-08 | PASS候选 | 当前本地Extension包与双窄RPC钩子运行于受控Node/AppContainer，hostIO/secret/动态注册返回unsupported。 |
| M-09 | PASS候选 | 当前MCP/Capability/Extension撤销、disable与原MCP移除路径阻断新调用，保留版本和审计，owned Job/profile/ACE清理已核。 |

A-P0-01/02/03/05/06/07/08/09保持原状态。P-01/02/03/05、C-07/08、S-08、T-09/10增加Phase5证据并保留既有scope。T-05/06/07/12/13增加本阶段acquisition/Extension证据，完整恢复继续Phase6。UI-05/06/07/09/10/11增加实际设置页证据，页面整体继续Phase7。QG-01/03/04/05/06/07/08/09增加当前门禁范围证据，完整打包、教育主闭环与全系统质量继续Phase8。

## 复用证据与明确边界

- 原resources10含15次helper、父子聚合内存、caught allocation失败、CPU rate Query/实测与累计user-time。其六份脚本/C#/launcher源SHA和当前一致，原managed helper身份ca2eacbc0fe1b98ecccdae8690bc63faac2f345f2c7c2b7ed2b7a2cec553fac4保留。本轮复用实际资源证据并记录source parity。
- 原stdio5保留108KB分块、真实ACK、Unicode、双stream、单请求timeout后新请求和跨窗口服务lease证据。本轮两个实际负例补齐原合同的初始化挂起取消和背压取消。
- 实施侧最终build、tsc、renderer246、Phase4 state21+legacy21和Phase2 contract10按各自原报告读回。smoke207的out清单为516fcc7eb25a6222bd84904ae83070c8a15b17c7ae66b993d974a49907104d11，随后publisher fence进入最终build和受影响Host/UI。最终全系统回归沿Phase8。
- 两个实施索引共33份归档文件已独立SHA核对无差异。真实公开filesystem包的首次fresh npm/Node下载与锁图、许可和AppContainer功能证据沿原报告保留。当前Pi5以原owned grcqce Task和已验证缓存为前置。
- 本机全部相关OS资源API实际支持。真实OS API unavailable分支为NOT_RUN，JobLimits的Set/Query/completion-port失败源码分支已读。其他OS、跨机和asar继续后续平台验收。
- UI8为1366×768和1920×1080、DPR1，rendererErrors为空。实际目录picker的main入口使用owned测试目录返回值，系统dialog鼠标选择保留未覆盖边界。两次UI模型请求为loopback SSE，两个LICENSE读取使用已核缓存。
- hostIO/secret/动态工具注册等未支持Extension请求返回明确unsupported。当前Extension实际支持context.transform与event.observe。
- 本轮真实付费provider调用0。npm audit29项为low8/moderate13/high8/critical0，root原始证据保留，Phase8进行实际可达性复核。

## 性能记录

Pi5的runner总时长217800ms，GET0、新审批0、14次模型请求均为loopback SSE。五check原始时长依次为120328.353、29710.5444、31145.9956、3.7639与33269.7681ms。其前置为已存在的合成Task和缓存包，首次fresh来源获取单独保留。Host6 runner总时长271034ms，各check时长保存在原report。上述值属于多Run套件采样，Phase8继续统一A/B性能分析。

## 原失败与运行细节

独立stdio探针首候选85567732a47d81a770f2f969e2adf73e50ab042a4056ac45baafe8e6263cfff5在TEMP测试包解析typebox时exit1，发生于runtime前。修订仅调整自有TEMP测试包的依赖解析和bundle方式，最终候选1b90f4f80630fd4551bab6cebfd69a90e6f6808f6e44dc4677b3a197f2c8f217保持原断言和12秒deadline。原失败candidate与resolution-fail.log均保留。

直接调用的原production/Host runner包含buildCoreToolManifest，会以同字节重写generated core manifest。独立Agent应在创建集中队列前识别该调用。前、中、后逐文件SHA均无差异，原worker继续按固定deadline完成，报告保留此流程事实。当前没有生产内容或out字节差异。

实施侧早期退出134、promotion EPERM、module格式、获取政策和UI fixture等原FAIL继续保留。本报告引用最终成功运行时同时保留相应历史归属。

## 交付与回滚

本Agent交付独立报告、criteria建议、raw日志、证据索引、前后身份及runtime库存。root继续维护项目状态与Git整合。既有版本、原生能力和原权限审计均在原事实源，恢复沿版本化SQLite/文件回执处理。可使用当前撤销/disable/回滚入口停用相应新Provider或Extension，源码回滚由root按模块提交管理。

正式状态为RUNTIME_RELEASED。当前运行验收已结束。

# Phase2 源码预审

2026-11-12。审查树D:/WorkProject/EduProject-harness，HEAD a915f4e06982dec5b8694092d568c7e79d8eb760，加实施线程尚未冻结的Phase2修改。范围为T2.1–T2.4、PHASE_2_IMPLEMENTATION.md、03/05/08协议及相关接线。

本轮仅阅读源码，未运行测试、应用或模型，未重建out，未写生产/测试/root文档。本报告没有Gate2验收结论。位置对应预审时读取的工作文件，冻结后需重新核对hash和delta。

已在收束时将15个源文件的同一次读取字节保存到C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase2-code-pre-review-20261112-sources，source-manifest.json记录各文件SHA256及精确capturedAt。该归档包含下面发现的原始代码。每个copy的hash直接由被保存的同一字节数组计算，工作树后续修改不会改变该证据。报告结论均为代码推导、未测试。

| 发现 | 归档源码精确行 | 该文件SHA256 |
|---|---|---|
| G2-F01 | capabilities__runtime.ts第32–56行，另native-stat第94–102、127–143行 | 7DA409A930AB8547EA6CC5AB36AF04B629E60A18B489F767806B35896FA95BF8 |
| G2-F02 | capabilities__native-stat.ts第45–48行 | E0497A7BE04DCB045CF48E1EB8DC582A5FC9355F7F969FCA919394A8C6D3A233 |
| G2-F03 | capabilities__provider-contract.ts第62行，registry第35–42行，runtime第35–38行 | F3F8A2EEB1944422B7C71E1EC90CF50A48EE90B74B422A63779A779F194EA011 |
| Snapshot一致性 | capabilities__provider-snapshots.ts第26–30、38–57行 | 11A7E2A32EFD457902576AE56F2448DC3A0D13972F0B185018F1EE4F2CE72CD3 |

## P1预审发现

### G2-F01 普通升级的旧实现缺失可自动改用当前实现

runtime.ts resolveCurrent约第33–58行。已有相同需求snapshot时先resolveVersion，旧版本不再eligible便继续普通resolve并保存新snapshot，execute随即使用新选择。native-stat.ts约第94–102、127–143行只捕获当前导入的两项实现，verifySource只对照当前source，尚未校验版本与具体executable artifact映射。

08协议要求普通升级当前任务保持旧版本。旧代码不存在时本次执行应有明确不可用结果。代码当前允许升级改变source hash后，旧pinned选择因source不符失败，随后同Run自动选择新hash并调用当前实现。

最小修复为exact {providerId,version,hash}到可信执行artifact绑定。同需求snapshot遇普通旧artifact缺失，本次execute不隐式替换，旧选择事实保留。撤销/健康恶化等合法故障恢复可在明确安全点重新解析，另存snapshot及原因，保留Task/Run/成果。

冻结后反例应使用行为可区分的真实v1/v2实现。升级后当前Run仍执行v1，移除v1后本次v2调用计数0且原snapshot保持，新Run可选v2。仅修改Registry version元数据并运行相同当前函数，证据不足以证明旧代码执行。

### G2-F02 实现哈希遗漏实际执行依赖

native-stat.ts第45、48行。packageHash只覆盖createHanaOfficeTools或createWorkspaceFiles.toString，加validStatOutput及固定version。derived version依赖该hash。

Native Adapter实际execute归一化代码、fileVersion、approvedFile、resource-io等调用依赖均能影响结果/安全行为。仅改变这些实现可使执行行为变化而packageHash不变。

最小修复为可信构建生成的完整执行闭包manifest/hash或不可变artifact bytes，覆盖实际Adapter与必要依赖。执行器按该身份注册和校验。冻结后必须覆盖仅变化归一化或被调用安全IO依赖时身份变化，以及伪造来源不能调用当前实现。

### G2-F03 实时Conformance变化可被旧snapshot覆盖

registry.ts archive约第34–43行允许同version/hash更新binding.conformance。runtime.ts resolveCurrent只要旧identity仍合格就返回prior snapshot。provider-contract.ts providerResult的conformance直接来自snapshot.selection，忽略native.conformance。

反例为先保存Hana full snapshot，保持软件身份并移除mime Optional证明，保留Required。后续exact resolver和native结果均会partial并披露缺mime，统一结果仍携带旧full和空missingRequirements。R06要求交付信息披露实际缺口。

最小修复为本次result消费当前已验证native assessment，历史snapshot保留原选择事实，或用独立版本化assessment语义表达变化。冻结后测试Optional证明变化的两个方向及Required撤销拒绝，检查实际最终统一结果。

以上发现均已发root和唯一writer，目前待writer修复及冻结后独立测试。

## Snapshot一致性复核项

provider-snapshots.ts第26–30、38–54行。decode仅验证JSON结构与hash，current/history没有核对JSON里的task/session/run/generation/capability/snapshotId与行索引列。save检查Task owner和Registry revision，尚未验证selection/providerHash对应同事务Registry版本记录。

建议readback验证全部身份列和JSON相等，save验证真实Definition/Binding/Provider版本与hash。测试将另一合法snapshot JSON/hash复制到当前owner行，以及正确Registry revision配合伪providerHash/selection写入，应失败关闭。当前模型Schema没有直接暴露snapshot对象，本项不外推为已证实外部权限绕过。

## 已确认的合理接缝

- 三个稳定入口经pi-session definitions/customTools、原Execution Boundary、Task safe-read准入与Journal admission装配，核心Tool保留。
- host构造runtime闭包的owner/task/current/workspace/publisher.persist，模型Schema没有授权、Task、Run、snapshot可写字段。
- Registry历史版本表和Snapshot表复用既有Sql/transaction/serialized writer，Task与Journal继续原真源。
- 无关Registry变化的同需求旧selection走精确解析，不要求覆盖snapshot。全局/版本撤销在当前Resolver检查。
- read-only试点由Manifest决定safe_read，Phase2没有新增写Provider，后续effect mapping保留独立门禁。
- 统一error枚举和safe message映射避免任意异常/路径/凭据直接回模型。取消和callId缓存仍需冻结后做实际竞争反例。

## 冻结后决定性验证

1. 冻结所有实施与测试文件hash、build身份、独立依赖路径。
2. 真实SQLite迁移Phase1副本、版本档案回填、当前指针与历史版本、CAS/失败回滚及冷读。
3. 真实v1/v2 executable identity、普通升级旧版保留、旧artifact缺失安全失败、新Run新版、故障恢复原因与Task/成果保持。
4. 原Pi+loopback SSE经稳定Dispatcher、Boundary、Task/Journal成功调用两个真实Provider，观察同Pi Session安全点新能力激活。
5. 无关revision保持snapshot，撤销/当前scope覆盖旧snapshot，旧Run/generation拒绝。
6. 伪造来源/版本/hash/snapshot、重复和冲突callId、并发resolve/execute/cancel、活动写效果期间刷新。
7. 输入/输出/错误/取消/effect/provenance严格格式、Optional/Conditional/Required当前结果与日志脱敏。

F01终端scope、F02旧MCP hints、F03审批冷启及F04完整Effect Ledger沿Phase3/6，本报告没有新增这些阶段的交付要求。Phase2新增入口须继续原执行边界。

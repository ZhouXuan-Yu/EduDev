# Gate 1 独立源码审查第一轮

2026-11-12。实施树 D:/WorkProject/EduProject-harness，分支 codex/xiaozhi-harness-20261112，HEAD 4e8873065f6c4b0e30cd8b403668c5a08f63ad40 加 Phase1 未提交源码。只读生产代码，未提交、push、重建 out 或调用真实模型。

## 第一轮结论 REJECTED

两项已交给唯一写入者 phase1_implementation 修复。该结论绑定修复前源码，后续复验单独记录。

## G1-F01 P1 同版本已发布能力合同可被 Provider 注册覆盖

位置 apps/desktop/src/main/xiaozhi-agent/capabilities/registry.ts 第71–78行，尤其第78行以 capabilityId replace Definition。

依据 02_CAPABILITY_PROTOCOL_V1.md 第6节，输入输出破坏变更须提升Major，发布合同的版本语义应稳定。Required 是 Resolver 的硬过滤依据。

独立复现使用真实SQLite。先注册内建 edu.workspace.file.stat / 1.0.0，然后用新外部Provider mcp.outsider.stat 携带同ID同版本Definition，将required由[file_metadata]改成[]，Binding为空evidence。register成功并改变Registry revision，generic Resolver把该外部Provider纳入eligible。内部可信代码升级同样可能在旧版本号下漂移既有合同。

当前Native pilot另有可信源码检查，能排除外部Provider实际执行。本发现证明Registry/版本/Required协议缺陷。

最小修复要求已有同ID Definition内容必须相同，版本变更若没有显式升级机制则拒绝。生命周期撤销继续专用API。回归需覆盖Required、inputSchemaRef、outputSchemaRef及contractVersion替换被拒绝，revision和原Definition保持，缺Required的Provider仍被排除，相同Definition可注册多个Provider。

## G1-F02 P1 外部Provider可占内建命名空间

位置 apps/desktop/src/main/xiaozhi-agent/capabilities/validation.ts 第35–39行。official标志检查未约束非官方非native Provider的ID前缀。

独立复现 validProviderManifest接受type=mcp，id=edu.native.hana-file-stat，publisher={id:outsider,official:false}，runtime=managed。

最小修复要求Provider类型与相应namespace一致，edu.native.*仅用于内建官方Provider。外部Provider仍可经验证Binding映射核心Capability ID。

当前Native pilot source verifier会拒绝该外部声明实际执行，不把本探针外推为真实权限绕过。

## 独立测试证据

- node scripts/xiaozhi-agent/capability-phase1-smoke.mjs 在apps/desktop运行，30/30 PASS，exit0。C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase1-04FEb2/report.json。
- 独立探针3项PASS，真实SQLite两个独立连接CAS恰一成功、returned snapshot突变不改落盘、错误hash读取拒绝。independent-probes.mjs与probe-report.json保存在本报告同目录。
- 两个真实原Provider的文件元信息读取通过，Node专项直接调用原createHanaOfficeTools.office_file_stat及createWorkspaceFiles.stat。原Hana结果回归通过。
- Electron production-host复测尚未执行，等待唯一写入者最后构建完成，避免读取半写out。

Phase2 Dispatcher、动态Pi刷新和Snapshot、Phase3权限统一/审批、Phase6 Effect与恢复保留其阶段范围。F01–F04维持OPEN，本轮未声称整系统P0通过。

# Phase6 Provider resume test leaf

2026-11-18。SOURCE_DONE / TEST_LEAF_FROZEN。仅新增两个phase6-provider-resume脚本，原ConPTY/state/planning policy保持冻结。SHA及被测10份源的漂移核验见SOURCE_MANIFEST.json。

## 实际命令与报告

```powershell
cd D:/WorkProject/EduProject-harness/apps/desktop
D:/Node/node.exe scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs
D:/Node/node.exe scripts/xiaozhi-agent/phase6-provider-resume-smoke.mjs
```

- 原Phase2 contract首轮10/10，报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase2-contract-YY7TQN/report.json。
- 新固定集首轮12/12，报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-provider-resume-wDBp8x/report.json，SHA256 27d10566f4ef0af45b740c535b48115e4e57b040888482540ca618b4f878e170。检查耗时合计1830.43ms。
- 两个新增脚本node --check均exit0。10份被测生产源在测试前后SHA相同，sourceDrift为空。此轮没有功能失败或生产修复。

| 新脚本，相对apps/desktop/scripts/xiaozhi-agent | SHA256 |
| --- | --- |
| phase6-provider-resume-fixture.mjs | 5c36c826bde6a4609a7df43c372ddb1a84d2627adea49342cafca464cd981161 |
| phase6-provider-resume-smoke.mjs | fae6f6085058b50f19fdd7d451deaf95c53d554226dd0024b4d7cf508b08ce39 |

复用的冻结state worker SHA为8449ae5d16f86871fee2a5bace6d72233b98effa0e7c3cfdeb3bafe8497bf77a。

## 固定12项

1. 原coordinator真实创建Task，原settle/Journal终结旧Run，再原coordinator.resume建立同Task新Run/generation。旧pin仍有效时，存在新当前版9.8.7及高优先替代也先resolveVersion，并保存resume_revalidate及跨Run previousSnapshotId。adapter收到的仍为旧版本。
2. 旧version撤销后blocked/capability_revoked，Resolver不静默fallback，adapter调用0。
3. 旧执行器不可用时provider_version_unavailable，adapter调用0。
4. 旧授权callback拒绝时permission_denied，隐式替代调用0。
5. 所有Provider缺Required时无selectedProviders、无新Snapshot、无adapter调用，保留missing_required。
6. 同capability持久executing Effect阻止显式refresh，Resolver调用数与DB状态不变。
7. 持久unknown Effect同样阻止显式refresh。
8. 真实owned文件成功并读取digest，原Effect.transition提交reconciled后，显式refresh可选择兼容替代。Optional mime缺口与missing:mime限制保留，实际owned写入计数仍1。
9. 旧owner、foreign Task的previous读取及foreign previousSnapshotId保存均拒绝，DB状态不变。
10. 旧Registry revision的Snapshot.save被source_changed拒绝，CAS事实不变。
11. SQLite Snapshot INSERT trigger故障回滚，保留旧Snapshot与Task，adapter调用0。
12. Resolver返回后、persist前通过原Task/ToolStart/admit/contract/begin写入真实executing Effect，第二次canRefresh检查拒绝新Snapshot。

每个R目录保留state.sqlite、final-state.json及相关blocked/resolved/fallback JSON。顶层report保存Task原/新owner、Snapshot history及resolve/resolveVersion/execute/authorize/safety的调用记录。

## 接缝与证据边界

Registry、Resolver、SnapshotStore、Task create/resume、Journal/receipt及Effect使用当前真实源码和SQLite。State fixture直接导入冻结worker且保持原文件字节不变，Authority来自实际Journal owner与原Task绑定。

installed可用性Set、authorize许可Set与adapter.execute计数/统一结果是明确测试seam，所有Provider执行结果为合成metadata。metadata升级和替代声明沿原Phase2 nativeStatDeclarations及Registry API构造。安全点用例将声明映射到真实office_create_text capability，匹配原Task.admit/receipt的local_write Effect。canRefresh复用Host的同capability、local_write/external_effect及intent/executing/unknown持久谓词。内存执行边界处于idle，其真实未settle Effect fence另由原Phase2 contract10验证。

这些结果支持T08恢复pin、实时撤销/许可拒绝、兼容替代及Effect安全点的状态接缝。T09待审批跨应用重启、T10真实Permission/Grant审批失效、T11拒绝后完整Pi替代路线、真实Provider I/O、Job、Electron/完整教学产品路径仍为NOT_RUN。本leaf不关闭完整T条目。

实际主源固定为capabilities/runtime.ts b467291e45e86932680c6afb32c271e55c5e9cb9b2b1388306e4e59f1cfd7335，provider-snapshots.ts 56f44502df0874794b00c6cafb9088b3b2f5cfb25dd6bba896c7c361bcc65a3f。其余源SHA在manifest。

root持有Git整合及回滚，本leaf回滚范围是两个新增脚本，owned原报告保留。native runtime窗口未占用，外部网络、模型、真实key及实际预算写入均0。

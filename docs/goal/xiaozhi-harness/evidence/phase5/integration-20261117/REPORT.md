# Phase5 integration validation

状态为 PASS / RUNTIME_RELEASED，2026-11-17。当前工作树 `D:/WorkProject/EduProject-harness`，HEAD `ec749662da19906a5d0b82f455f54b74c24b9dc5`，MERGE_HEAD `44925e4e042141e44c9e7f5fe59740cc1c72fa78`。root持有未提交merge与后续Git操作。此次固定五组各运行一次，482/482通过，未发生整合功能失败，手工生产源码修复0，真实provider请求0。Phase6生产尚未开始。

## 精确命令与结果

以下命令在 `D:/WorkProject/EduProject-harness/apps/desktop` 执行。唯一原始日志根为 `%TEMP%/xiaozhi-phase5-integration-291cb001e3b441b6a042f12435f7d879`，六份日志原字节及SHA256见 `ARCHIVE_INDEX.json`，本目录logs保存副本。

| 命令 | 实际结果 | 本目录证据 |
| --- | --- | --- |
| `npm run test:smoke` | build含tsc PASS，207/207，exit0 | logs/smoke-build.log、reports/smoke.json |
| `npm run test:renderer-components` | 246/246，exit0 | logs/renderer-components.log |
| `node scripts/xiaozhi-agent/phase5-governance-smoke.mjs` | 11/11，exit0 | logs/governance.log、reports/governance.json |
| `node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs` | 10/10，exit0 | logs/phase2-contract.log、reports/phase2-contract.json |
| `node scripts/xiaozhi-agent/phase5-ui-smoke.mjs` | 8/8，exit0 | logs/ui8.log、reports/ui8.json、ui8截图/fixture原件 |

governance实际报告位于 `apps/desktop/test-results/xiaozhi-agent/phase5-governance-wsXwjA/report.json`，owned TEMP为 `xiaozhi-phase5-governance-zswgcj`。Phase2报告位于 `%TEMP%/xiaozhi-capability-phase2-contract-zyYss2/report.json`。实际UI报告位于 `apps/desktop/test-results/xiaozhi-agent/phase5-ui-N8E3Ra/report.json`，owned TEMP为 `xiaozhi-phase5-ui-ylYWHE`。

实际UI8使用此次整合out的main/preload/renderer，经原设置连接loopback MCP、选择外部效果工具、合成DPAPI密钥set/clear、本地目录picker隔离导入、原Task审批/Node准备取消重试、同Run隔离调用、双尺寸与idle撤销/cold读回。两个模型请求均loopback SSE，两个LICENSE请求使用此前核实的官方字节缓存，rendererErrors为空。报告记录1366×768与1920×1080的实际native content bounds、CSS viewport和DPR1。

renderer246日志出现 `WebSocket server error: Port 24678 is already in use`，suite正常完成246/246、exit0，未操作占用端口的其他进程。`git diff --check` exit0，原始日志logs/diffcheck.log保留CRLF提示。

## 整合与构建身份

| 时间点 | 源码/测试输入 | out |
| --- | --- | --- |
| Gate5最终implementation冻结 | 2984，清单248b93c622ebcb849ebd59d1f40d80a79251e6178bbada97285a6a3952e46e07 | 471，清单3f4b9db94f1cc0f0e69960d1a5943506da7b88941e44577dc8d070d2f8b9102e |
| 此次merge完成、build前 | 3004，清单a6d3fc0a863d152e19dff11cc857d78c563f843625de3ba953d703946f4ac5c8 | 471，清单3f4b9db94f1cc0f0e69960d1a5943506da7b88941e44577dc8d070d2f8b9102e |
| 此次最终受测冻结 | 3004，清单7e85ff5e45ecc21921441cfa1b14122139031fe8fbf03f7e595f84a2d98d8be9 | 473，清单db84a88a064336cc8924e62ca22bb203fff887b58bae63146c7095db88200635 |

清单算法沿原implementation SHA256(JSON.stringify(files))，条目含相对file、bytes、sha256，按绝对文件名排序。范围为desktop src、scripts（排除独立phase8-*）、构建/config/package文件与根package文件。`PRE_BUILD_IDENTITY.json`和`FINAL_FREEZE.json`保存全部字节身份，最后源3004/out473逐文件0差异。

build唯一自动源码变化为 `src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json`。新core sourceHash为 `2b4cc81082626b94f6d82f533a6df9e5e6a692526dc6df34f597b1eefbf9986f`，586个实际源码引用全部0差异。out净增两个Word worker `word-pdf-worker.py` 与 `word_office_worker.py`，另有hash命名chunk替换，完整added/modified/removed见FINAL_FREEZE.buildDelta。整合增加KB DB/assets/shared、renderer与preload/Vite变化，按本次新清单记录。

native-stat原manifest SHA256 `819aca5629e4c55fa3e4605e1c1e824af2964e75412dded68d71a34662d8a438`，对应CJS SHA256 `bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274`，22个源码引用逐个匹配。Phase5 sandbox manifest SHA256 `4f6fb1963a5864ed424e1bffe7af67d172f1462149c6aca3403786c973c15dd5`，helper52736 bytes、SHA256 `915a468e8747b93db77f3fb2c7424e43405ccd7ba973cad029af8b510ef5cf0f`，6个C#源逐个匹配，build实际reused=true。src与out各资源原字节身份均在清单中保存。

## 验证边界和交接

此轮按root固定整合集验证，完整Pi5/Host6和Wordworker业务专项留原领域报告，未在本轮重跑。实际UI8覆盖整合Host调用、原Task与受控运行时链。此次没有新的功能失败报告，前阶段所有历史FAIL继续保留在各原证据目录。性能A/B与Phase6实施按其正式阶段进行。

生产/out在最终验证后冻结，owned runtime关闭并释放给root。未执行git commit/merge/push。root完成merge提交和atomic push后再正式RELEASE6。

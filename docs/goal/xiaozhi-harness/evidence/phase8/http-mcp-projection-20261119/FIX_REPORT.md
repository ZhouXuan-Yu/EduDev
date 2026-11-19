# HTTP MCP 混合传输输入转换修复

生产修复已经冻结。唯一生产源为 `D:/WorkProject/EduProject-harness/apps/desktop/src/main/xiaozhi-agent/permissions/mcp.ts`，SHA256为 `1a562e61967ebeb52dfe0e6709ed73d040e49d36678dace0287aabcc555ac408`。

## 缺口与结果

原 `createMcpPermissionContext` 在提供stdio配置时，直接将stdio输入转换回调暴露给通用MCP Runtime。Runtime在HTTP调用也使用该回调，导致已完成原Schema、隐私与权限验证的合法HTTP输入被受控stdio的managed artifact binding拒绝，实际HTTP tools/call为0。

修复捕获原stdioInput，提供同类型包装，仅当source.transport为stdio时调用原转换；HTTP返回原input。原run泛型、Network/Egress/MCP/Secret scopes、原条件、Grant与Provider验证、撤销、网络broker和输出处理逻辑保持原代码。

## 真实复现与独立Host协作

验收者提供的原红trace位于 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-phase8-p0-stale-trace-196479b422`。栈为MCP_CAUGHT_DENY→acquisition.binding→controlled.transformInput→mcp-runtime.perform。原请求为合成topic public-normal-grant，实际loopback目的地，Network POST/mcp_call、精确MCP source/schema/tool与teacher_private Egress三个Grant齐全，tools/call仍为0。

修复ready后已通知phase8_timing_prep。其新TEMP真实Host记录位于 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-phase8-p0-stale-after-4504693ad8/REPORT.json`，提供2/2通过。实际正常调用计数为1，MCP Grant撤销后原registered callback和同Pi旧工具重调均保持1，另一个session的服务撤销也未增加计数。该Agent同时报告provider分支有原journal event_persistence→cancel，仍在核查其状态归属。本文只引用其已回传的调用计数与撤销事实，不将这些记录提升为整轮Host没有错误。

## 新必要回归

新增唯一脚本 `apps/desktop/scripts/xiaozhi-agent/permission-mcp-transports-smoke.mjs`。SHA256为 `5d084b19eb57e71f36f3411bb68b20c9d5bb587b32b49060b0d31f38f111076b`。

既有pi-mcp-boundaries覆盖通用Runtime，未将stdio转换器和HTTP权限Context混装；Phase5 MCP lifecycle覆盖真实受控stdio，缺少该HTTP组合。因此增加这一个定向回归以防再次引入。

实际命令如下，cwd均为 `D:/WorkProject/EduProject-harness/apps/desktop`。

```powershell
node scripts/xiaozhi-agent/permission-mcp-transports-smoke.mjs
npx tsc --noEmit
```

两者均exit0。回归11/11，paidCalls0，实际HTTP tools/call4次、总HTTP请求15次。SQLite和全部产物在本目录。

| 回归 | 结果 |
|---|---|
| HTTP原input保留且未调用stdio转换器 | PASS |
| stdio转换结果及其拒绝继续传播 | PASS |
| 混合Context的真实HTTP metadata/selected tools初始化 | PASS |
| 为其他实际URL origin签发的Network授权不能放行当前目的地 | PASS |
| 当前精确Network/Egress/MCP三Grant允许实际tools/call | PASS |
| Schema额外字段及隐私输入在HTTP前拒绝 | PASS |
| 合法目的地的服务端401独立识别为authentication | PASS |
| Egress撤销在新HTTP IO前阻断旧closure | PASS |
| MCP Grant撤销在新HTTP IO前阻断旧closure | PASS |
| Network撤销在新HTTP IO前阻断旧closure | PASS |
| Grant仍在时服务撤销阻断旧registered callback | PASS |

直接回归使用当前生产adapter、Permission Engine、真实本地SQLite和真实HTTP loopback网络broker。stdio转换器为明确回调夹具，未运行原生stdio进程。报告为 `report.json`，包含各断言及受测源SHA。

仓库根执行的限定 `git diff --check -- apps/desktop/src/main/xiaozhi-agent/permissions/mcp.ts apps/desktop/scripts/xiaozhi-agent/permission-mcp-transports-smoke.mjs` exit0。Git仅提示原mcp.ts未来可能规范化CRLF，当前内容SHA已冻结。

## 交付边界

本次授权范围内只写一个生产源和一个必要回归脚本。没有运行build或改写out、generated、既有打包候选与Git。冻结安装包属于此前源码身份，由总控记录；本修复的运行验收使用当前源码构建的独立Host夹具。

没有全系统性能比较或最终产品验收结论。若需源码回退，只需由总控恢复该mcp.ts改动，保留本回归和原红证据用于诊断。

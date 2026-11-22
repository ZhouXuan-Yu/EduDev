# 小智 Harness D1 验收自检

日期为 2026-11-22。Windows 上以 Node 24.12.0、Electron 43.8.3 验证。同机独立合成资料库和 Electron 用户目录。未使用教师数据或付费模型。独立验收待复核，原 Harness 的 Phase 8 门禁状态另见原报告。

结论为自检 17/17。真实 Electron 主进程、桌面页面、托管 MCP、Windows 社区扩展和旧库迁移均有运行证据。

执行依据为用户指定目录中的 `D1改造.md` 和 `D1验收.md`。原文件 SHA-256 分别为 `dd81eb07ec2830aa8ae3467e46b000786edaac9f6c7fe2412d8b98634e40949e` 和 `9b6e20d0477b34a3ac804673ce81b0a70efc51c607ef930f5eb4075e2ebae176`。

## D1-001 至 D1-017

| 项 | 核验及证据 | 自检 |
| --- | --- | --- |
| D1-001 Capability Contract | 独立登记稳定 ID、合同版本、保证和限制。实际 Native 执行分别拒绝坏输入、坏输出。 | 已实现 |
| D1-002 Provider Definition | 真实库独立登记和查询定义，记录来源、发布者、版本、平台、依赖和 Adapter。声明后 Binding 计数为零，权限由宿主应用。 | 已实现 |
| D1-003 Provider Instance | 同一定义的两个实例有独立配置、连接、权限引用、健康和 revision。验证了停用拒绝、撤销、冲突和 SQLite 冷读。操作入口为主进程。 | 已实现 |
| D1-004 Binding | 逐配对检查合同、制品摘要、必需证据和限制。单独启停和撤销。升级后逐项补证，旧档案与原任务身份可回读。 | 已实现 |
| D1-005 一项能力对应多个 Provider | 合成 PDF 合同在真实 SQLite 中只有一个定义，Native、MCP 分别建边和进入实际 Resolver。停用一边后另一边仍可选。 | 已实现 |
| D1-006 一个 Provider 实现多个能力 | 教学资料 Provider 在真实库中关联 PDF、OCR、表格三项。OCR 缺证与撤销不影响另外两项。实际社区包运行两个真实钩子，升级后观察器失败，文本转换仍可用。合成 PDF/OCR/表格用于检验对象关系。 | 已实现 |
| D1-007 Adapter Contract | 核对注册 ID、版本、接入、执行、取消、错误和结果归属。适配器在已有选择与授权之后运行。 | 已实现 |
| D1-008 Adapter Registry | 验证发现、查询、重复制品、合同兼容判定、暂停、撤销、卸载。仅原 SQLite Registry 保存 Provider 资料。 | 已实现 |
| D1-009 Core Adapter | 真 Electron/Pi 运行正式 Native 文件属性和真实托管 MCP，核对原快照、权限和普通工具。 | 已实现 |
| D1-010 Community Adapter | 真包通过原审批和隔离运行。核对包来源、制品、许可证、依赖、权限及逐钩子验证。原始 Windows 子进程记录验证宿主文件和网络限制。 | 已实现 |
| D1-011 生命周期 | 验证注册顺序、未核验拒绝、暂停中止在途及拒接新调用、撤销拒绝重启、卸载移除有效注册。社区状态从原持久记录重核验。 | 已实现 |
| D1-012 T0–T3 | T0 和 Windows T2 实际运行。T1 定义独立进程约束。无后端的 T3 激活被拒绝，伪造等级字段被拒绝。 | 已实现 |
| D1-013 权限 | 在宽泛用户授权回调之前拒绝越权请求并留审计。替换 Provider 仍通过相同执行边界。真实 AppContainer 拒绝外部路径、套接字和未支持的宿主方法。工具参数无调级接口。 | 已实现 |
| D1-014 模块化 | 逐文件核对 Contract、Registry、Binding、Adapter、Lifecycle、Security 和 Runtime 的调用与依赖。装配入口注入原服务。 | 已实现 |
| D1-015 维护 | 复用现有协议，新绑定和同一 RPC 通道的新包不改 Runtime。按对象和生产路径有独立的集成与兼容性检查。 | 已实现 |
| D1-016 回归 | 原 Native、原 MCP、权限、任务状态、快照、冷启动和 Electron 编译。组件 253/253，桌面 207/207。 | 已实现 |
| D1-017 数据迁移 | 历史基线 `eaf3b44` 的 Electron 生成真旧库，迁移副本保留 4 组查询、8 条任务事实和撤销记录。增量迁移重复执行，坏目录校验和导致事务回滚，恢复路径已记录。 | 已实现 |

## 实际执行与证据位置

下列命令均从 Harness 工作树的 `apps/desktop` 执行。日志与可读原始报告保存在 `D:/WorkProject/EduProject/acceptance/D1-20261122`。在复跑桌面 smoke 前，将 `OMNI_EDU_ACCEPTANCE_ROOT` 指向该次验收的目录。

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/capability-d1-integration.mjs` | 8/8 | `d1-integration-final.log` |
| `node scripts/xiaozhi-agent/capability-phase1-smoke.mjs` | 33/33 | `phase1-final.log` |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs` | 10/10 | `phase2-contract-final.log` |
| `node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs` | 24/24。在 `OMNI_EDU_PHASE1_FIXTURE` 指定验收目录内的历史旧库，供实际迁移副本使用。 | `phase2-production-owned-fixture.log` |
| `node scripts/xiaozhi-agent/phase5-production-smoke.mjs` | 5/5，实际托管 MCP | `managed-mcp-production.log` |
| `node scripts/xiaozhi-agent/phase5-extension-host-smoke.mjs` | 6/6，真实扩展及逐钩子验证 | `extension-host-final.log` |
| `node scripts/xiaozhi-agent/phase5-extension-native-smoke.mjs` | 21/21，真实 Windows 隔离和清理 | `extension-native-final.log` |
| `npm.cmd run test:renderer-components` | 253/253 | `renderer-components.log` |
| `npm.cmd run test:smoke` | 生产编译和末轮桌面操作 207/207 | `electron-ui-final.log`、`electron-e2e/` |
| `npm.cmd run build` | 命令结束码 0。最后整理源文件尾部空行后重建并核对产物指纹。 | `build-final-receipt.log`、`build-fingerprints.json` |
| `npm.cmd audit --omit=dev --json` | 20 条既有依赖告警，2 条 high。依赖锁定文件无变动。 | `npm-audit.log` |

保留首轮失败。Phase 2 最初缺少真旧库，随后使用基线提交重新生成。原夹具以整任务快照数断言单项能力，导致把其他命名工具快照也计入。修正测试归属后，原证据撤回、快照变更和旧版本约束全部通过。扩展初轮暴露 10 秒总预算未覆盖沙箱接入与清理，执行总预算改为 30 秒，原单次 RPC 预算维持。逐钩子复测使用实际抛错模拟钩子失败，宿主 RPC 对观察器成功返回值按协议统一为 null。

同机 Phase 1 夹具测得直接 Native 50 次平均 2.46 ms，适配读取 50 次平均 8.80 ms，P95 分别为 4.09 ms 和 11.26 ms。该单文件测量用于记录封装成本，未据此推断真实模型首字时延。

## 验收边界

T1 通用执行器、其他平台 T2、完整社区下载页和生产 Pi 多实例选择界面暂未实施。Windows T2 的较强隔离限于现有沙箱、受控投影、禁止联网和任务健康检查。两条 high 依赖告警涉及既有 `@modelcontextprotocol/sdk` 与 `body-parser`。本轮未改动依赖版本。生产候选构建不覆盖日常安装，也未进行干净 Windows 安装或真实教师操作。

[D1 实施及文件清单](D1_IMPLEMENTATION.md) · [技术架构和恢复](../../architecture/HARNESS_D1.md)

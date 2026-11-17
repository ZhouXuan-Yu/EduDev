# Phase5 Acquisition UI源码交付

状态 **UI_SOURCE_DONE**，2026-11-17。源码停写，待root协调统一构建及真实UI门禁。实施者已转为UI writer，后续Gate5独立审查由fresh reviewer承担。

## 窄修改

实际6文件及SHA见 `freeze.json`，最终原件在 `source-snapshot-final/`。初版冻结和源码保留，当前freeze指向最终候选。

- 新增PiAcquisitionSettings，复用现有HeroUI控件与SettingsSection/Row/Stack、DisclosureCard。
- PiMcpSettings加入发现/搜索/准备与操作进度。原running/busy/chooser配置门禁沿原行为；新增cancel/revoke独立于配置锁。旧提示替换为当前宿主来源/权限校验的中性说明。
- PiManagedTools追加真实Acquisition安装记录、version/source/license、验证/ready/failed/revoked及撤销操作，原本地工具行为保留。
- PiEnvironmentSettings渐进披露外部能力状态，同时保护诊断及repair异步响应的session/generation归属。
- PiSettingsWorkspace仅在原两处Mcp/Managed消费者传已有sessionId，父级其他逻辑沿原实现。
- 单独组件测试脚本phase5-acquisition-renderer-smoke.mjs。

shared合同读取SHA为 `4fa0a486f2e26345ddb5d5e7315282dbc0a16673a5bdbe1671d2e4927bd18e36`。新数据只来自getXiaozhiAcquisition/searchXiaozhiAcquisition/mutateXiaozhiAcquisition，使用真实当前sessionId。未推断owner或新造权限。

Office Composer/工具栏与弹层、shared/preload/main、中央测试runner、Goal状态及out均由原owner维护，本轮app build/Electron/真实key读取/模型外发均0。测试在owned TEMP编译组件fixture并挂载真实React/HeroUI，未写app out。

## 可操作结果

搜索与view可idle；只有main返回非null context才启用prepare。确实返回无context的view显示ACQUISITION_ERRORS.task_required并引导回当前小智任务；读取失败保持unavailable反馈，区别于已知无Task。来源online/cached/unavailable、版本、许可证待核查或真实license、连接方式和来源hash按实际投影展示。

操作仅展示main phase。quarantined与source_requires_review如实可见，failed/cancelled/interrupted可重试，资源验证中与ready各自显示。取消带operationId/revision，撤销带artifactId/revision，安全操作在active任务期间仍可用。

实际main prepare API等待整个pipeline，renderer将它与短控制请求分开。等待prepare返回时继续读取真实进度，可取消；未伪造成功百分比。viewport正面积可见且document前台时轮询，每次read结束1200ms后再调度；renderer读取10s反馈deadline后仍保留原IPC single-flight到真正settle，避免悬挂请求堆叠。每个可见实例最多一个get请求，离屏/隐藏/卸载停止新增轮询。

session epoch、请求序号及响应context检查避免旧会话覆盖；prepare完成使较旧read失效。卸载/切session后的成功、错误及finally均检查归属。操作错误使用ACQUISITION_ERRORS，正常poll不抹掉尚未处理的action错误。

## 精确验证

cwd为 `D:/WorkProject/EduProject-harness/apps/desktop`。

```powershell
node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

最终组件报告 `%TEMP%/xiaozhi-phase5-acquisition-renderer-0SxAcD/report.json`，**12/12，exit0**，副本 `component-final.json`。完整日志 `xiaozhi-phase5-acquisition-ui-frozen.log`。覆盖缺session不查询、idle搜索/null context门禁、真实搜索表单、prepare精确payload、quarantine、取消及重试、长prepare未返回时poll/取消、安装license与ready区分、revoke、错误与读取失败、session/卸载、前台可见single-flight、原MCP busy及环境session响应。

single-flight case把renderer10s反馈timer缩到20ms，保留真实1200ms poll周期，用悬挂桥接Promise断言deadline后无第二IPC；该计时缩放仅在测试fixture。CSS loader为空且JSDOM无真实布局，此处验证组件逻辑及实际HeroUI事件处理，视觉/焦点与平台交互待Electron门禁。

全src noEmit早两轮exit0，日志 `xiaozhi-phase5-acquisition-ui-typecheck-after.log`、`xiaozhi-phase5-acquisition-ui-typecheck-final.log`。最后统一复核exit2，仅并行新写的main/xiaozhi-agent/extensions/validation.ts 8条unknown类型错误，见 `xiaozhi-phase5-acquisition-ui-typecheck-frozen.log`。core writer确认由Extension leaf writer收尾，最终全src门禁由core owner执行。该次UI文件无报错，不能据早一次pass把当前整个树标绿。

定向git diff --check exit0，见 `diff-check.log`。6文件SHA再核一致。未运行中央renderer246、npm run build或真实Electron两尺寸UI。

## 原失败保留

- TDD red为新组件尚未存在，`component-tdd-red.json`与日志保留。
- 首轮3/11，JSDOM缺HTMLTextAreaElement等DOM构造器，并存在测试创建的MessagePort未收束。只修专属测试环境，记录后终止该自有Node PID4472；后续fixture收束自身MessagePorts并正常exit。原 `component-first-failure.json`、日志保留。
- 初次noEmit遇并行core临时node-bootstrap.ts移除接缝，exit2；该原日志保留。core writer完成移动后再检查exit0。
- 初版11/11、补长pipeline12/12以及最终12/12报告均保存。后续通过不覆盖这些历史记录。

## 控件testId

动态操作/记录在discovery/installed/environment可分别出现，真实UI脚本应先定位对应容器再查子控件。

| 范围 | 标识 |
| --- | --- |
| 顶层模式 | pi-acquisition-discovery / pi-acquisition-installed / pi-acquisition-environment |
| 搜索 | pi-acquisition-search-form / pi-acquisition-query / pi-acquisition-search |
| Task与错误 | pi-acquisition-task-required / pi-acquisition-notice-<mode> |
| 来源 | pi-acquisition-source-<source> |
| 候选/准备 | pi-acquisition-candidate-<id> / pi-acquisition-prepare-<id> |
| 操作/取消 | pi-acquisition-operation-<id>（data-phase） / pi-acquisition-cancel-<id> |
| Artifact/撤销 | pi-acquisition-artifact-<id>（data-status） / pi-acquisition-revoke-<id> |
| 刷新 | pi-acquisition-refresh-<mode> |
| 环境渐进入口 | pi-environment-acquisition |

原MCP和Managed控件testId保留。

## 未验收与回滚

真实main/preload/API与页面点击、实际下载/许可/schema/撤销、两尺寸可达性、键盘/焦点及视觉接受均待root统一out后验证。当前无UI性能实测，新增工作仅为有界可见读取及实际请求的组件状态；没有产品时延改善声明。Secret/Extension/rollback可选合同尚待core稳定发布，当前只接已释放的prepare/cancel/revoke三API语义。

回滚可恢复这5个renderer文件的本轮patch并移除新增专属组件/测试引用。原backend的安装/来源/审批/撤销事实继续保留，UI回滚不修改SQLite或受管文件。最终提交、整合、构建、真实UI及独立Gate5由root协调。

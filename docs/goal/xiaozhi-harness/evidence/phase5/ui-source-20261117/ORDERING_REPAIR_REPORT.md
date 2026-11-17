# Phase5 UI prepare顺序修复

2026-11-17，状态UI_SOURCE_DONE_ORDERING_REPAIRED。root指出的两个deferred顺序已用真实React/HeroUI JSDOM组件复现。原6文件冻结、组件12/12与root独立12/12证据保持，previous-freeze.json保存原身份。

## 修前实际证据

cwd为D:/WorkProject/EduProject-harness/apps/desktop。

```powershell
node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs --prepare-ordering-only
```

exit1，0/2。report为 `%TEMP%/xiaozhi-phase5-acquisition-renderer-YrbhJu/report.json`，本目录before-report.json和before.log保留。

- prepare pending，poll读到downloading。cancel成功回较新cancelled revision6后，旧prepare回ready revision4，使DOM data-phase从cancelled变成ready。
- cancel API pending时旧prepare先回，随后cancel成功投影被request guard丢掉，DOM仍ready。
- 同顺序cancel回conflict时，错误notice为空，DOM仍ready。

这些状态在下一次poll之前读取，证明短暂覆盖及丢失控制结果真实发生。

## 最小修复

仅PiAcquisitionSettings与专属测试发生变化。Lifecycle增加组件本地action序号，发起search/prepare/cancel/revoke时递增，poll不递增。prepare捕获其action序号，响应/错误只在它仍为最新动作时接入。较新控制动作已经发起或已完成时，旧prepare不改view、request序号或notice。原IPC single-flight、session fence、main CAS及progress poll继续复用。

action只描述当前组件已观察请求顺序，组件生命周期结束即失效，没有新持久状态、全局业务revision或main授权逻辑。

## 集中复验

```powershell
node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs
```

原12项全部保留，新增2组顺序断言，14/14 exit0。report为 `%TEMP%/xiaozhi-phase5-acquisition-renderer-8fneSg/report.json`，本目录after-report.json与after.log保留。

- cancel较新投影之后旧prepare到达，DOM保持cancelled。
- 旧prepare在cancel pending期间到达，后续cancel成功正常显示cancelled。
- 同顺序cancel失败正常显示“状态已更新，请刷新后重试。”，保持最后已观察downloading事实。

测试只加一个定向flag用于复现，默认仍运行完整14组。原候选代码与测试在本目录*-before文件和previous-freeze中保留。

6文件最终SHA在freeze.json/source-snapshot，仅2个delta，其余4文件与原冻结一致。定向git diff --check exit0。修后未跑全树typecheck、build或Electron，shared/preload/main与真实业务数据未改，真实模型0。真实UI和最终统一门禁继续由root协调。

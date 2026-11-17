# 请求预算辅助交付

2026-11-17，Sol实施的5个phase8验收辅助脚本经root独立源码复核及集中专项复跑，12/12通过，exit0。全部HTTP使用本地合成服务，真实模型调用0。

## 源码与运行证据

源码包括 `phase8-budget-ledger.mjs`、`phase8-counting-proxy.mjs`、`phase8-budget-cli.mjs`、`phase8-budget-smoke.mjs` 和 `phase8-budget-test-worker.mjs`，均位于 `apps/desktop/scripts/xiaozhi-agent/`。使用本机Node24.12.0内置SQLite3.50.4，无新增依赖。

root复核了SQLite预留和不可重置配置、代理转发前落盘、SSE/背压/取消、固定端点/零重试及CLI。独立执行命令如下。

```powershell
cd D:/WorkProject/EduProject-harness/apps/desktop
node scripts/xiaozhi-agent/phase8-budget-smoke.mjs
```

独立报告为 `TEMP/xiaozhi-phase8-budget-L3lu2C/report.json`。12项覆盖8进程竞争、SIGKILL后预留不退款、实际上游收到请求后强杀、SSE、503、超时、取消、截断、redirect零跟随、慢消费者背压、并发硬截止、元数据/原始DB隐私检查和CLI。

实施侧12/12、先前10/10及测试先行的缺模块FAIL均保留。root在复跑后核对6文件冻结清单，源码与计划均零差异。`raw-budget-evidence.zip`保存54个原始文件，`MANIFEST.json`逐项记录字节和SHA256。root后续追加的真实Goal账本路径检查点与原冻结版本分别保留。

## 固定实际账本

root核对本Goal真实请求仍为0后，首次建立唯一共享实际账本。

`D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase8-real-model-budget/goal.sqlite`

首次创建previouslyExisted=false，goalId为GOAL_XIAOZHI_HARNESS，limit=200、initialUsed=0、used=0、remaining=200、unresolved=0、WAL/FULL。关闭后由原CLI重新读取，结果保存在 `initial-goal-budget.json`。A/B两侧与重试必须共用此文件，后续沿原元数据核对，不能以新建文件重置额度。owned TEMP内专项夹具账本只记录合成HTTP。

## 待执行范围

该模块交付计量基础设施。正式HTTPS/TLS、实际provider、两侧真实UI/SDK全部请求路由、Run交叉绑定、质量和时延对照，继续由Phase8实际验证。当前尚未发送真实模型请求。

# S4启动R2最小方案

状态为PROPOSED，只读归因完成，生产源继续冻结。根正在执行A11与207 smoke，本次只读取现有工件。

## 最新实际证据

正式产物仍为after-startup-out，build `d9bb14092fba320280017058c4dbe5ee1a54f7ff86516b9721a8c2466e71e534`。五个fresh Electron case实际结果如下，所有报告的httpAttempts均为0。

| case | 结果 | 墙钟ms | 原预算 |
| --- | --- | ---: | ---: |
| electron-R1-xml-2PnxfN | FAIL，timeout | 15016.6319 | 15000 |
| electron-R1-html-Ms8PqR | PASS，原jsdom引擎 | 11047.9680 | 15000 |
| electron-R1-hana-reader-44zeUY | PASS，原正式reader | 814.0135 | 30000 |
| electron-R1-reader-cancel-ek9bFn | PASS，cancelled且子进程exit | 229.1365 | 30000 |
| electron-R1-utility-timeout-RNRYl2 | PASS，按期timeout且子进程exit | 15007.1005 | 15000 |

Hana reader值属于独立utility QA，正式main-thread execute保持单独消费者验收边界。首次XML失败完整保留，后续case通过维持各自身份。

### 新owned模块探针

读取after-runtime-wx0Jm2，PID176656，after-runtime.json明确绑定上述正式build。startup.json的before-main-import=97ms、after-main-import=2887ms，实际import差值2790ms，window-created=3185ms。

module-startup-probe.json观察窗口3201.9967ms，observerErrors=0、slowCount=0。resolve5533次共1196.7896ms，fs.readFileSync1648次共681.2216ms，load1929次共771.7743ms。后两项存在嵌套，累计值保持分别记录。native lock2.2372ms、setPath0.0996ms、setName0.0059ms。

observed-errors.json在window-loaded时consoleErrors/processEvents/httpAttempts/dropped均为0，stderr文件为空。本次记录没有指向某个超过10ms的剩余慢模块。

### A11 R1仍然失败

读取ui-final-material-catalog-live-w1XFic/report.json及bootstrap-state-1.json，其pins绑定同一source/build。BOOTSTRAP_MAIN_IMPORT到BOOTSTRAP_MAIN_IMPORTED的单调时钟差为20068.5774ms。原20秒就绪还覆盖此前profile/ready/guard及终态交接，因此仍为BOOTSTRAP_READY_DEADLINE，12项NOT_RUN。

同一正式build在owned探针中2790ms、在A11中20068.5774ms，显示本轮耗时具有显著运行条件变化。新owned快样本保留为该运行结果，A11失败保留为完整门禁结果。当前probe的slow列表为空，尚不能按该列表选择一个确定的主进程慢模块继续生产修改。

## 已确认的最小源依赖切口

先前只读追踪已证明如下边。

```text
checks/worker.ts
 → shared/xiaozhi-delivery-checks.ts
   → officeRelativePath from shared/xiaozhi-office-artifacts.ts
     → shared/xiaozhi-office-draft.ts
       → paper/classroom/teaching exports → @openmaic/dsl
```

worker只需要STRUCTURE_SCHEMA和validStructureRequest；原wire validator自身只依赖纯helper。delivery-checks的高层输入/coverage校验因使用officeRelativePath而引入Office draft链。正式typed-table共享块已保留这条静态边，before/after的5个依赖块同哈希。

当前source中structure.ts的唯一运行时入口是checks/worker.ts。after-startup-out/main/index.js没有unpdf/getJSDOM/inspectDocumentStructure引用。因而这一切口首先改善checker worker的冷依赖闭包，其主启动收益需由新构建测量，不能仅凭共享块变化预填A11通过。

## 建议R2候选写集，仅3文件

待根释放后实施一次。

1. 新增 `apps/desktop/src/shared/office-relative-path.ts`，承接已有officeRelativePath原函数。
2. `apps/desktop/src/shared/xiaozhi-office-artifacts.ts`从leaf导入并重导出该函数，保留所有既有导入路径和消费者API。
3. `apps/desktop/src/shared/xiaozhi-delivery-checks.ts`直接从leaf导入该函数。

这份写集只切断已证实的高层运行时依赖边。原officeRelativePath的AST、Windows保留名、层级、500字符上限、私密目录拒绝及调用结果必须逐项保持。schema、请求/结果wire、parser、取消和15/30秒预算沿原合同。

本次将worker wire整体搬家涉及更多schema/helper归属决策，可保留为后续独立选择。unpdf按PDF分支加载也有单文件切口，但当前缺少其在失败worker中耗时占比，暂不纳入最小R2候选。

## 一次实现后的固定验收

- AST/真值表验证原路径规则与所有原消费者，覆盖Windows保留名、私密目录、相对路径层级与长度边界。
- root正式build/tsc/sourceguard后检查inspection-worker静态闭包，确认高层paper/materials/attachments/DSL链实际退出。构建仍残留该链则记录依赖切口未达到目标。
- 由根排程首次冷XML置于该轮parser测试前执行，保持15秒、真实SVG输入和fresh Electron；保留此前FAIL。再沿原HTML、Hana reader、取消和timeout入口做本构建验证。OS缓存状态和执行顺序写入报告。
- 原15/30秒内仍失败则保留FAIL并返回根决定，不扩大等待预算或以已暖case替代首冷证据。
- A11沿原20秒门禁，保留12项NOT_RUN直到真实完成；与当前207 smoke结果分别记录。该方案的启动及首用收益均以实际新构建结果为准。

## 当前主启动归因边界

R1移除了main的eager HTML reader入口，最新owned记录确实显示剩余模块读取总量1648次及较低读取墙钟。A11仍有20.0686秒import，现有A11工件没有同区间的逐模块/fs耗时。已有数据支持继续关注文件读取、模块解析及运行条件，OS缓存、文件系统过滤、调度等来源尚未分离。

如果根需要进一步定位主启动，只在下一次已排程的A11同一冷进程挂接已有owned模块观察器，把阶段与fs/load统计绑定该次deadline。其结果用于决定另一个精确主进程切口。当前这份warm owned记录不足以授权推断Pi或其他未定位模块的具体性能问题。

本次交付为这份候选方案，生产两文件继续保持R1冻结SHA256。

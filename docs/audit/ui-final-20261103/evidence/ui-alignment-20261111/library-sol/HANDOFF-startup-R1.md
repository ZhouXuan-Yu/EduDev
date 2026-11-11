# S4启动R1源码冻结交接

## 当前结论

两份生产源已冻结，源稳定可构建。AST与源码检查12项通过，原Node专项29项通过，冷进程与原预算/取消夹具14项通过。Electron冷首用、正式20s就绪、三链和207 smoke继续由根按统一构建排程验证。

已读取根AGENTS/CLAUDE和本轮合同；授权目录及父目录未发现额外嵌套AGENTS。原UI源保持冻结，根维护唯一RESULT。

## 唯一生产文件与SHA256

| 文件 | SHA256 |
| --- | --- |
| apps/desktop/src/main/office-agent/hana-tool-adapter.ts | 918ac5809a5d534266a5eeb6a6f3b06869e8096694fb723f2f4512b827f3ec47 |
| apps/desktop/src/main/xiaozhi-agent/checks/structure.ts | 8111ee004c17af807b212583697f4b04bc807c7773a0714fdcb67b508d3ea743 |

`startup-R1-static.json`的files数组正好包含上表两项path/sha256。`startup-R1-baseline.json`保留修改前源码、哈希和函数AST基线。正常回滚恢复这两份源码后统一重建，业务数据无需迁移。

## 修改及业务保持

- Hana静态web-reader导入替换为同名async wrapper，在真实HTML分支需要时await import原vendor函数，并原样转发html/url及结果。createHanaOfficeTools整棵原业务函数AST逐项同基线，包含execute的参数、网络权限、SSRF、预算、取消、来源、结果和错误映射。
- structure使用本文件缓存的JSDOM ctor getter，两个原new调用只把构造器表达式改为getJSDOM()。恢复构造器标识后，原parts/xmlPart/ppt/xlsx/inspectDocumentStructure等函数AST均与基线一致。DOM参数、返回/close、DOCTYPE/ENTITY、编码、ZIP/CRC/路径及大小边界保持原实现。
- 成功加载的构造器复用；require失败不会留下成功缓存。Hana的模块缓存沿Node原dynamic import规则。

首次HTML动态导入期间仍在execute原30s timeoutSignal及原outerSignal组合的作用域内。解析返回后原signal.throwIfAborted继续阻止迟到成功，原catch优先映射outerSignal取消及timeoutSignal超时。该AST保持证据加上本轮取消/30s实测只覆盖Node source路径，Electron主线程上的冷加载成本和响应时序仍需实际工具链验证。

## 已实际执行的检查

命令均在 `D:/WorkProject/EduProject/apps/desktop` 执行。

| 精确命令 | 实际结果 | 本目录证据 |
| --- | --- | --- |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-static.mjs | 12项PASS，exit0 | startup-R1-static.json |
| node scripts/office-agent/hana-tools-smoke.mjs | 14项PASS，外网用例0，exit0 | startup-R1-hana-tools-report.json，原test-results/office-plan/hana-tools-swMpO1/report.json |
| node scripts/xiaozhi-agent/pi-copy-cancel-boundary-smoke.mjs | 3项PASS，exit0 | startup-R1-copy-cancel-report.json，原test-results/xiaozhi-agent/pi-copy-cancel-cXv3sL/report.json |
| node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/delivery-check-smoke.mjs | 12项PASS，exit0 | startup-R1-delivery-check-report.json，原Temp/omni-edu-delivery-check-9Jc1r5/report.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-cold-node.mjs hana-html | 最新3项PASS，exit0 | startup-R1-cold-hana-html.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-cold-node.mjs checks-html | 2项PASS，exit0 | startup-R1-cold-checks-html.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-cold-node.mjs checks-xml | 2项PASS，exit0 | startup-R1-cold-checks-xml.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-cold-node.mjs hana-cancel | 2项PASS，exit0 | startup-R1-cold-hana-cancel.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-cold-node.mjs hana-timeout | 2项PASS，exit0 | startup-R1-cold-hana-timeout.json |
| node test-results/ui-alignment-20261111/library-sol/startup-R1-utility-boundary.mjs | 3项PASS，exit0 | startup-R1-utility-boundary.json |

另已运行两份生产文件限定git diff --check，exit0。四份本轮QA脚本的node --check均exit0。root可复跑上述静态脚本核对冻结哈希。

### Node冷进程首用与原预算实测

每个cold命令使用全新Node进程，导入被测宿主模块时jsdom加载计数为0。解析使用原jsdom29.0.2与原vendor转换器，HTML传输由明确的无外网QA响应替代。OS文件缓存状态未控制。

| 用例 | 模块导入ms | 冷首次用ms | 同进程二次ms | 原预算与断言 |
| --- | ---: | ---: | ---: | --- |
| Hana HTML首轮 | 274.8214 | 18250.7379 | 31.1693 | 30s内成功，正文/绝对来源链接/脚本隔离 |
| Hana HTML后续新进程 | 252.1348 | 1213.5805 | 12.1348 | 同上，另通过原256调用预算与网络拒绝 |
| checks HTML | 74.0684 | 2311.0766 | 16.1268 | 15s内原parser成功，隐藏script正文及原大小限制 |
| checks XML/SVG | 97.0949 | 1184.9732 | 6.4379 | 15s内原XML parser成功，DOCTYPE/错误XML拒绝 |
| Hana HTML加载中取消 | 334.1102 | 2138.6048 | — | 在jsdom首次加载观察点触发原outerSignal，execute最终cancelled且无成功data |
| Hana真实30s计时器 | 280.0599 | 30008.4725 | — | 原timeoutSignal触发，execute返回timeout |

首轮Hana18.25s记录保留在startup-R1-cold-hana-html-initial.json。两个新进程数值差异保留为实际运行条件差异，当前没有据此判定Electron性能改善。

utility-boundary执行的是原runLocalUtility父级代码，子传输使用受控EventEmitter。原15000ms计时器在15001.4146ms返回timeout并kill；取消/迟到消息与八worker池释放断言通过。真实Electron utility退出留给下述根QA。

### 保留的失败

- 原完整A11运行ui-final-material-catalog-live-P4sHWb在BOOTSTRAP_MAIN_IMPORT触发BOOTSTRAP_READY_DEADLINE，12项NOT_RUN，继续保留原FAIL。
- 首次hana-timeout QA因合成pending传输没有保持Node事件循环，出现unsettled top-level await，exec exit1。记录在startup-R1-cold-hana-timeout-initial.json。仅在QA中增加keepalive后，沿原30000ms timeout重跑通过。
- static脚本第一次仓库根推导多一层，加载typescript失败；更正工件内路径后12项检查通过。该错误发生在QA脚本初始化阶段。

## 根在after-startup-out上的精确Electron命令

执行前先通知根并按统一排程串行运行。下列runner只在根显式执行时启动全新Electron，QA没有BrowserWindow，使用同一正式build的原utility host、原inspection-worker及原动态web-reader块。runner沿现有zeroNetworkBootstrap建立原网络边界，数据/profile/报告均在独立electron-R1-*目录。

```powershell
Set-Location D:/WorkProject/EduProject/apps/desktop
$r1Build = 'D:/WorkProject/EduProject/apps/desktop/test-results/ui-alignment-20261111/after-startup-out'
$r1Runner = 'test-results/ui-alignment-20261111/library-sol/startup-R1-electron-run.mjs'
node $r1Runner $r1Build xml
node $r1Runner $r1Build html
node $r1Runner $r1Build hana-reader
node $r1Runner $r1Build reader-cancel
node $r1Runner $r1Build utility-timeout
```

每条命令等待上一条结束并检查exit0和对应report.json。每条都使用新的Electron进程及新的utility子进程。QA启动就绪watchdog为20s；操作deadline由原runLocalUtility维持，XML/HTML为15s、Hana reader为30s；父runner仅另留有界child-exit清理观察。应用timeout保持原值。首用超过原预算会保留timeout和非零退出，禁止把失败改成通过。

| 命令case | 实际覆盖与待验状态 |
| --- | --- |
| xml | 原正式inspection-worker.js首次SVG/XML解析，15s预算和原引擎/正文断言，NOT_RUN |
| html | 原正式inspection-worker.js首次HTML解析，15s预算和原引擎/脚本隔离，NOT_RUN |
| hana-reader | 从正式main的动态import定位原web-reader块，在独立utility QA中首次导入和真实转换，30s预算、正文及原来源链接，NOT_RUN |
| reader-cancel | 在该utility写入before-reader-import标记后触发原父级取消并核对真实子进程退出，NOT_RUN |
| utility-timeout | 受控停滞utility由原15s父级deadline终止，核对实际退出，NOT_RUN |

Hana reader case衡量的是正式reader块在fresh Electron utility中的加载与解析。正式Hana execute仍在main线程，消费者的网络权限、取消响应和预算需在根原Office三链中验证。原 `node scripts/office-agent/hana-tools-electron-smoke.mjs` 可补14项Electron兼容检查，但它会另建隔离模块测试bundle且预导入web-reader，该脚本只用于兼容覆盖。

根原正式三链/207 smoke和A11脚本必须继续使用after-startup-out及原20s就绪。新QA未覆盖的Hana正式调用首用/主线程取消、Office消费者和整库链均保留待验。本轮测试工件通过不自动提升这些验收项。

## 当前交付范围

生产两文件共14行新增、4行删除，旧业务AST保持。全部本轮新测试与证据位于library-sol。本轮实际只执行静态与CLI，Electron首用及正式构建结果由根后续填入。需要因实际失败继续修改时，由根释放本轮两文件写集。

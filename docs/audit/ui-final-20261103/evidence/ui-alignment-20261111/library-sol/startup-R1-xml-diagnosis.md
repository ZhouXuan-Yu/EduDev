# S4 R1冷XML失败只读诊断

## 实际失败

根已提供after-startup-out的正式build/tsc/sourceguard125通过结果，source为 `4ec370179e3a2f04b8ceb3c33cf503567054ad6b997ae812f13e8c32a875dc15`，build为 `d9bb14092fba320280017058c4dbe5ee1a54f7ff86516b9721a8c2466e71e534`。

本次读取 `library-sol/electron-R1-xml-2PnxfN/` 下report/startup/stdout/stderr及正式worker。Node24.22.0、Electron43.8.3，子PID171164。原15000ms预算在15016.6319ms返回timeout，checks为空，httpAttempts为0。stdout已出现R1_READY，stderr为空。其余四case仍为NOT_RUN。

startup.json的before-main-import=192ms、after-main-import=217ms指向本QA入口的导入，exit=15247ms。这个短导入区间属于QA parent；正式应用的A11结果由根另行记录。

当前失败报告没有worker模块入口、message接收、getJSDOM开始/结束的子进程阶段记录。它证明原deadline实际终止了无有效回执的冷首次请求，尚不能把这15秒逐项分配给静态依赖、jsdom require、DOM构造或其他等待。测试在result.ok断言处失败，随后进入finally清理，未达到报告中“全部子进程exit已观察”的通过断言。

## 原15秒覆盖范围与before比较

`src/main/xiaozhi-agent/local-utility-host.ts`在utilityProcess.fork返回后立即建立options.timeout计时器，再postMessage；超时会kill并返回timeout。`checks/service.ts`第95行与116行原本均传15000ms。这个预算包含子进程初始化、ESM静态依赖加载、消息接收和实际解析。

before-out的inspection-worker在顶层执行createRequire(...)(jsdom)，之后才安装process.parentPort消息监听。after-startup-out改为接到请求、进入xmlPart后通过缓存getter加载同一个JSDOM。两者的首次XML工作都需要完整jsdom加载和相同构造器，整个过程仍在同一15秒外层预算内。

两份worker的静态依赖列表完全相同。字节差异集中在构造器getter及两个new表达式，before为16301字节，after为16416字节。5个本地依赖块同名同SHA256，外部静态依赖同为@openmaic/dsl、node:path、yauzl、node:module和unpdf，外加运行时require的jsdom。

| 文件 | before SHA256 | after SHA256 |
| --- | --- | --- |
| inspection-worker.js | 7e050acd1b39a5a9fbafa1f2cf9d9dcb2ff6dfeff3bacf242b5ffe1c29f1e401 | e93aba215d0a54d9372f0c4a2d3c8be86693fe6871824fefcb19393066d6f537 |
| typed-table-BQI5XvHC.js | 3f5534431a05237244aaa71f7d3aa13b7937d4d4973f0f953f9c7add2f4f8857 | 相同 |
| paper-export-DEwQcDSS.js | 58a0c0c072a949429a9744150515a6ea41b52bf57ef97b09a3bc32848fbf8073 | 相同 |
| materials-CCWuAHyz.js | 66a6a52ba1097b366ea3b674411c85b294bd18a501fa392a76cb3fc6fd224362 | 相同 |
| xiaozhi-ocr-CIJofHV6.js | e217ade0c188d99d11bf50c21fd725892be78c01a3908dc0a4c623c3d7249457 | 相同 |
| xiaozhi-attachments-B1qAiFrn.js | a0e938b46c0d5b0c9fe7746296e10bda19c2ae1d6c6da108c302cd6f566e1b0f | 相同 |

因此可以确认旧worker本来也承担这项冷加载预算风险。旧版是否在同输入、同冷条件下实际超过15秒，当前未实测。旧正式main还会eager加载jsdom，可能提前改变系统文件缓存；R1去掉这项启动工作后，首次checker的文件缓存条件可能变化。相同worker依赖图本身不足以证明旧正式用户路径也失败。

根当前A11继续独立验收。当前生产两文件保持冻结，本次只读追踪未启动Electron。

## 已定位的源依赖边界

MCP图谱没有返回当前相关节点，以下按实际source静态import及正式产物追踪。

```text
checks/worker.ts
  → shared/xiaozhi-delivery-checks.ts
      → officeRelativePath from shared/xiaozhi-office-artifacts.ts
          → shared/xiaozhi-office-draft.ts
              → classroom-export / paper-export / teaching-lesson-export
                  → @openmaic/dsl 等共享依赖
  → checks/structure.ts
      → managed-tools/typed-table.ts → shared/xiaozhi-computation.ts
      → yauzl
      → unpdf（当前顶层import，SVG/XML也会先加载该模块）
      → 按需createRequire(jsdom)
```

`xiaozhi-delivery-checks.ts`只有validDeliveryCheckInput和validRequirementCoverage的高层文件路径校验使用officeRelativePath。worker所需的STRUCTURE_SCHEMA、validStructureRequest及validStructureResult自身只依赖本文件的obj/keys/text/integer等纯helper，不需要Office draft、paper或DSL。

`managed-tools/typed-table.ts`的CSV parser只导入纯shared/xiaozhi-computation.ts。产物名typed-table表示Rollup共享块，并不意味着CSV parser自身调用了paper业务。该共享块实际还包含delivery-checks模块的其他运行时内容，因此存在到paper-export的实际静态import。

`structure.ts`对DocumentMetrics的导入是type-only，运行时耦合从worker对wire校验的value import进入。constructor getter已成功延后jsdom入口，仍需在首次XML时加载相同parser。

## 最小定向修复选择

### 选择A，先切断纯路径校验对Office业务的运行时依赖

候选3文件写集，待根另行授权。

1. 新增纯 `shared/office-relative-path.ts`，移动已有officeRelativePath原函数，保持其AST、Windows保留名、长度、层级和私密目录拒绝规则。
2. `shared/xiaozhi-office-artifacts.ts`改为导入并重导出该函数，保持现有消费者API。
3. `shared/xiaozhi-delivery-checks.ts`直接从纯leaf导入该函数。

该边界保留wire/schema/parser及worker协议，直接消除已确认的高层依赖边。正式构建后必须核对inspection-worker静态闭包确实退出paper/materials/attachments/DSL，并重跑路径权限边界和冷15秒解析。减少这条链的具体毫秒收益尚未测得，验收仍以原deadline结果为准。

### 选择B，只把worker wire拆成无运行时依赖的leaf

候选3文件写集为新 `shared/xiaozhi-document-structure.ts`、原delivery-checks barrel及checks/worker.ts。迁出STRUCTURE_SCHEMA、StructureRequest/Result、DocumentMetrics及原validator所需的纯helper，原文件重导出以保持消费者兼容，worker直接导入leaf。

这是按领域隔离checker wire的方案，改动面涉及共享schema定义位置和validator helper归属。需逐AST核对旧/新请求、结果、大小限制及错误码，并在正式产物确认Rollup不再将其与高层barrel共置后引入paper依赖。

从当前证据看，选择A是更短的已确认源依赖切口；选择B可以作为worker领域隔离的独立选择。二者都不能单独保证jsdom冷加载低于15秒。

### 可独立评估的单文件收窄

structure.ts的getDocumentProxy只有PDF分支实际调用，当前仍为顶层unpdf import。将该入口按需加载可以缩小XML/SVG的静态依赖面，保留原PDF调用参数、安全设置、结果与清理。它需要根释放该文件，且当前未取得unpdf在失败worker中占用多少时间的证据。

如果闭包收窄后，真实fresh Electron仍在jsdom加载阶段耗尽15秒，应另立小合同评估同版本parser的可复现依赖预打包，以减少数千小文件读取。需保存许可、可选原生依赖和等价解析/取消证据，并在原15/30秒deadline内验收。当前没有该构建方案的实现或性能通过记录。

## 只读结论与下一证据

本次已确认冷XML实际FAIL、原预算包括全部冷加载、before/after worker的依赖闭包基本相同，并定位到纯路径helper引出的高层共享依赖。当前没有把该失败归因到Defender或某一具体OS I/O来源，也没有before冷Electron实测结果。

如根安排下一轮，可先用同一QA入口在before-out执行单独xml case，维持15秒、相同输入及独立fresh Electron，并保留OS缓存与顺序影响。需要准确分段时，额外只在owned utility QA记录worker入口、接收请求、parser开始/结束时间及fs/模块慢项。该观测须覆盖子进程，现有parent probe不能代表其加载时间。以上均等待根统一排程。

# 20261111 async UI wait QA 最终冻结交接

## 状态与精确写集

QA_FROZEN_FOR_ROOT_COMPLETE_SMOKE。root已审静态报告和9项纯受控结果，并核实下表2文件SHA。root当前复用after-final-out，运行完整node scripts/electron-smoke.mjs，日志smoke-async-fixed.log。本文只整理既有证据，未重新测试、启动GUI或修改源码。

唯一QA变更为electron-smoke.mjs和新增acceptance/async-ui-wait.mjs。教学11文件继续冻结。static报告已逐项核实生产SHA变化0。after-final-out的生产源与产物仍沿root的sourcefe397.../build3193acb...身份，QA修复直接用于脚本。

| 最终冻结文件 | SHA256 |
| --- | --- |
| D:/WorkProject/EduProject/apps/desktop/scripts/electron-smoke.mjs | 17bd814d8dd38b50c37f6d503e2d748bc0d3ec536b762c187f5a9a5af91267bb |
| D:/WorkProject/EduProject/apps/desktop/scripts/acceptance/async-ui-wait.mjs | 1d28d626a08c0e5b3725afede17c0a245199fb8053a51e5ce5d6cfd8a295aae4 |

## 已证实的等待根因

本机playwright-core版本1.62.0。coreBundle.js:23886的next函数执行const success = predicate()，随后依据Promise对象的truthiness执行fulfill(success)。Promise随后可以resolve false，外层等待已经结束。

纯受控负控制按该已安装代码模式执行，async predicate resolve false时只有1次调用，等待结果为false。原1335的chapters.length === 1屏障存在提前通过路径，随后1336读取0章与此竞态一致。原smoke-final.log的章undefined真实FAIL永久保留，生产章节持久性仍由新完整运行核实。

本地源码与SHA记录在async-ui-wait-local-evidence.json。coreBundle.js的记录SHA为3258d1cf334c6afc95f22aa9c292436cb976b391e0437f1359c83b84f0cb9d66。

## 默认预算本地证据

- coreBundle.js:4264定义DEFAULT_PLAYWRIGHT_TIMEOUT = 3e4。
- coreBundle.js:57160起的TimeoutSettings._timeout优先使用options.timeout，其次debug/default/parent设置，最终返回该默认常量。
- electron-smoke.mjs全文件没有setDefaultTimeout或setDefaultNavigationTimeout覆盖。
- 46个async调用中45处默认30000ms，1处原显式{ timeout: 4_000 }继续为4000ms。该显式调用位于原699行，等待getAiAgentRun的waiting_input。

## helper语义与diff边界

waitForAsyncUi在主机端逐次await page.evaluate(predicate, argument)，对求值完成后的结果采用原truthiness语义。falsy继续轮询，truthy完成。求值串行，主机端轮询间隔16ms，总deadline从首次求值前启动，包含求值挂起时间。

超时抛TimeoutError，异常原样传播，清理deadline及轮询timer，停止后续读取。timeout0沿用无deadline语义。正在执行的只读evaluate即使迟到为true，也不能将已超时的等待改为成功。

原脚本的46个async page.waitForFunction调用替换为waitForAsyncUi(page, predicate, arg, options)。原callback、argument、options逐项AST文本完全一致，均为独立await表达式，JSHandle消费者0。剩余22个同步谓词waitForFunction保持原接入。

反向恢复这46个调用并移除新增import后，脚本归一换行后的全文与本轮QA基线逐字相同。新增helper没有放宽chapters.length === 1、pages.length === 1、blocks.length === 1或任一单版本比较。

| 验收集合 | 修改前 | 修改后 |
| --- | --- | --- |
| 等待目标 | 199 | 199，其中46个awaited屏障、153个原等待调用 |
| assert | 459 | 459 |
| launchApp | 3 | 3 |
| 原报告passed/total集合 | 207/207 | 207/207 |
| 同步waitForFunction | 22 | 22 |
| async JSHandle消费者 | 0 | 0 |
| 教学11文件SHA变化 | 0 | 0 |

207为保留的原完整验收集合，当前完整复验终态由root写入smoke-async-fixed.log。本交接的静态PASS与纯受控PASS具有各自验证范围。

## 已完成的检查

node --check apps/desktop/scripts/electron-smoke.mjs和node --check apps/desktop/scripts/acceptance/async-ui-wait.mjs均exit0。

node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/async-ui-wait-test.mjs实际exit0，9项纯受控检查通过。覆盖原Promise-false提前通过负控制、false/false/true串行读取、30000/4000预算、false超时与停止后不再读取、挂起evaluate超时和迟到true、predicate异常、transport异常、undefined/null/false保持轮询、timeout0。

node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/async-ui-wait-static-check.cjs实际exit0，完整caller参数、返回值消费、默认预算、199目标、459断言、3启动、207集合和生产冻结核对通过。该脚本最初因CRLF import行的元数据规范化失败，修正后按相同完整文本断言通过，QA和生产源码未因该工具问题另行变化。

完整证据位于async-ui-wait-static-check.json、async-ui-wait-test.json。修改前脚本与SHA保存在async-ui-wait-smoke-before.json。此前smoke入口适配及其原失败继续保留各自报告身份。

## 全46个caller清单

行号相对apps/desktop/scripts/electron-smoke.mjs，完整未改谓词、argument与options保存在async-ui-wait-static-check.json的callers数组。

| 序号 | 原行号 | 新行号 | 原宿主读口 | 预算ms |
| --- | --- | --- | --- | --- |
| 1 | 699 | 700 | getAiAgentRun | 4000 |
| 2 | 1047 | 1048 | listAiConfirmations | 30000 |
| 3 | 1054 | 1055 | listExerciseSets | 30000 |
| 4 | 1128 | 1129 | listAiConfirmations | 30000 |
| 5 | 1138 | 1139 | listExerciseSets | 30000 |
| 6 | 1213 | 1214 | listQuestionNotebook | 30000 |
| 7 | 1221 | 1222 | listQuestionNotebookCategories | 30000 |
| 8 | 1226 | 1227 | listQuestionNotebookCategories | 30000 |
| 9 | 1239 | 1240 | getQuestionNotebookEntry | 30000 |
| 10 | 1244 | 1245 | listQuestionNotebookUsage | 30000 |
| 11 | 1250 | 1251 | listQuestionNotebookCategories | 30000 |
| 12 | 1254 | 1255 | listQuestionNotebookCategories | 30000 |
| 13 | 1258 | 1259 | getQuestionNotebookEntry | 30000 |
| 14 | 1277 | 1278 | listTeacherNotebooks | 30000 |
| 15 | 1286 | 1287 | listTeacherNotebookRecords | 30000 |
| 16 | 1293 | 1294 | listTeacherNotebookRecords | 30000 |
| 17 | 1297 | 1298 | listTeacherNotebookRecords | 30000 |
| 18 | 1301 | 1302 | listTeacherNotebooks | 30000 |
| 19 | 1303 | 1304 | listTeacherNotebooks | 30000 |
| 20 | 1321 | 1322 | listTeachingBooks | 30000 |
| 21 | 1328 | 1329 | getTeachingBook | 30000 |
| 22 | 1335 | 1336 | getTeachingBook | 30000 |
| 23 | 1342 | 1343 | getTeachingBook | 30000 |
| 24 | 1351 | 1352 | getTeachingBook | 30000 |
| 25 | 1358 | 1359 | getTeachingBook | 30000 |
| 26 | 1372 | 1373 | listTeachingBookPatches | 30000 |
| 27 | 1381 | 1382 | getTeachingBook | 30000 |
| 28 | 1385 | 1386 | getTeachingBook | 30000 |
| 29 | 1396 | 1397 | listTeachingBookPatches | 30000 |
| 30 | 1403 | 1404 | getTeachingBook | 30000 |
| 31 | 1406 | 1407 | getTeachingBook | 30000 |
| 32 | 1412 | 1413 | getTeachingBook | 30000 |
| 33 | 1439 | 1440 | getTeachingBookHealth | 30000 |
| 34 | 1442 | 1443 | getTeachingBook | 30000 |
| 35 | 1444 | 1445 | getTeachingBook | 30000 |
| 36 | 1453 | 1454 | listTeachingBooks | 30000 |
| 37 | 1519 | 1520 | getAiMemoryDocument | 30000 |
| 38 | 1523 | 1524 | getAiMemoryDocument | 30000 |
| 39 | 1529 | 1530 | getAiMemoryDocument | 30000 |
| 40 | 1545 | 1546 | getAiMemoryDocument | 30000 |
| 41 | 1547 | 1548 | getAiMemoryDocument | 30000 |
| 42 | 1549 | 1550 | getAiMemoryDocument | 30000 |
| 43 | 1557 | 1558 | getAiMemoryL3Document | 30000 |
| 44 | 1561 | 1562 | getAiMemoryL3Document | 30000 |
| 45 | 1571 | 1572 | getAiMemoryL3Document | 30000 |
| 46 | 1573 | 1574 | getAiMemoryL3Document | 30000 |

## root后续收口

root收取当前完整smoke终态并保留日志。若再次失败，先保存终态、失败截图和实际readback再定位，沿本轮有限QA修复边界处理。当前QA两文件及教学11文件继续冻结。

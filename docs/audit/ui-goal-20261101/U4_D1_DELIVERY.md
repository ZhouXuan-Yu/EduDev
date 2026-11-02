# U4-D1 · 当前确认卷导出绑定

2026-11-02。首次真实桌面mOHpzM8项exit0：一份目标教师DOCX经原Pi/审批保存及独立读回通过，旧A在新B确认后模型前拒绝、输入保留。父看截图发现拒绝原因误映射为发送记录冲突，正修专码与单次0模型补验，尚未最终接受提示UX。整体UI Goal仍active。[合同](U4_D1_CONTRACT.md) · [源码与命令冻结](U4_D1_SOURCE_FREEZE.json) · [根因与修复](U4_D1_REVIEW_AND_REPAIRS.md)。

## 功能与根因

原页面只有卷名文本，专用工具实际取本会话latest；多卷会话中A准备请求后确认B，可使B成为合法输出目标，下游来源校验无法识别点击意图丢失。这是源码可达P2，不声称已观察到错误文件。

现在当前卷按钮捕获paperId/digest及学生卷/教师卷/答题卡、Word/PDF规格，经typed导航、草稿持久化、原发送与重试、command hash、本轮Active到专用工具。host精确重读并校验归属/来源/current；参数不符或旧A被替代明确拒绝，无latest回退。原目录授权、文件审批、图片校验、安装锁与来源账本保持。无绑定的旧普通请求保持原行为，不开放历史已替代卷导出。

原输入控件、工具栏、弹层及样式未改；只增加绑定/取消及不支持操作的既有提示样式。已有草稿不能被覆盖或串配。带绑定的补充、续接或混合附件明确阻止，输入保留；权威原消息有绑定的旧任务三种续接同样拒绝，普通任务保持。

## 修改文件

| 文件（apps/desktop） | 目的 |
| --- | --- |
| src/shared/paper-export.ts | 版本化最小绑定、严格校验/复制/比较，不含题目或目录授权 |
| src/shared/xiaozhi-agent.ts / xiaozhi-start.ts / xiaozhi-projection.ts | 可选typed请求及清晰续接拒绝错误；旧无绑定兼容 |
| src/main/education/paper-export.ts / paper-export-intent.ts | 专用工具捕获本轮绑定，精确读取、规格匹配和失效拒绝 |
| src/main/xiaozhi-agent/production-host.ts | admission、幂等身份、原消息metadata、本轮工具接线；原安装流程保持 |
| src/main/xiaozhi-agent/tasks/coordinator.ts / paper-export-continuation.ts | 原绑定任务三种续接的权威检查，防止丢绑定后走latest |
| src/renderer/components/PaperExportEntry.tsx | 点击身份/导航世代、异步读回、旧稿检查与typed准备 |
| src/renderer/components/desktop/DesktopFrame.tsx | 导航seed身份、拒绝覆盖/迟到消费 |
| src/renderer/components/office/composer-drafts.ts / OfficeComposerState.tsx | 文本与绑定共同保存/恢复、pending seed、明确取消及失败状态 |
| src/renderer/components/office/OfficeComposer.tsx / paper-export-request.ts | 原控件发送/重试携带绑定；阻止不支持操作并保留输入 |
| src/renderer/components/office/PiEducationWorkspace.tsx | typed seed消费、失败重试身份及真实start接线 |

合计16生产文件；新增三个窄helper，未往App新增业务。无新表/IPC名/依赖或vendor、全局CSS修改。六个Sol测试文件和三个独立actual QA文件见冻结清单/运行报告；唯一既有测试helper调整只补navigation fixture契约，不弱化生产校验。

## 工程验证

| 命令/证据 | 结果与范围 |
| --- | --- |
| npm.cmd run build | exit0，含TSC；d1-build-attempt1.log |
| npm.cmd run test:renderer-components | 245/245，exit0 |
| npm.cmd run test:smoke | 207/207，exit0，含自身build；受控legacy桌面回归，非自然模型或完整Goal验收；旧electron-e2e先备份 |
| D1 frozen六测试 | 44/44：shared/tool6、host9、race4、mounted renderer19、mounted Pi6 |
| 适用旧回归 | 369项分别通过，精确命令/范围/日志hash见源码冻结；模块仅加载的paper-boundaries不计通过 |
| node scripts/ui-goal-paper-export-intent.mjs --check | 修QA后11/11，exit0，无应用/模型/业务写入 |
| npm.cmd audit --json | exit1，既有42项：8高/26中/8低/0严重；无依赖变更 |

生产聚合73c42e9a…；正式构建bf73fd95…（455文件）、全src f71f860e…（1281文件）。actual仅按该冻结执行：一次正常教师DOCX发送和一次模型前竞争拒绝，零自动重发。实际报告、截图和独立文件核对完成后补录，不用离线11或工程测试替代。

## 性能与剩余项

整合基线main3705080→3709666B（+4586），renderer7607223→7619155B（+11932），preload37712B不变，CSS455420B不变。仅准备/发送时读取快照，无逐token任务或新模型循环。未测P95/内存/主线程，不以包体积声明性能达标。

自然扫描/图像/复杂数学、其他五类本轮实际文件、原生Word/WPS、完整ChatGPT体感、教师质量和参考卷/用途版式仍开放。历史B六类文件按其原构建接受，不改写为本轮全部重新验收。停止与晚期安装竞态的focused证据不能冒称实际UI矩阵。

回退先停用D1新准备入口，保留已有绑定草稿/消息读器及续接拒绝，避免降成无绑定请求；原文件/来源/快照/历史/题篮数据不删。未进行完整回退演练。D日常及其他AI工作树不接管；本任务正常整合/推main并另启独立可见窗口，最终提交/窗口随后登记。

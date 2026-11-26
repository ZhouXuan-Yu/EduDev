# 上轮 UI、动效与依赖问题收敛

2026-11-26 接手续交付：本轮修复代码为 `42830ae`、`694da73` 和 `58d74dc`。整体结论仍为 **BLOCKED**，不是 UI_R1_DONE。工程检查和可独立验证的修复已完成；原生125%与未完整覆盖的业务状态不冒充通过。推送身份以本轮 `acceptance/ux-followup-20261126/final-delivery-receipt.json` 的实查记录为准，提交报告本身不代表已推送。

本轮从 be28dd2 复用 codex/ui-ux-r1-20261125，正常快进整合主线 f420db0 的附件归属修复，保留其 App、SQLite、IPC和回执行为。D:/WorkProject/EduProject 仍由协作者维护，没有移动它的分支、清理或覆盖未提交代码。本轮修改位于 D:/WorkProject/EduProject-ui-ux-r1-20261125。

实施合同：[CONTRACT](../../../acceptance/ux-followup-20261126/CONTRACT.md)。原报告和失败证据保留在 docs/audit/ux-motion-20261126 与 acceptance/ui-ux-r1-20261124。本报告不取代 Master Goal 或其他团队的独立验收。

## 修复与根因

| 项 | 根因与处理 | 当前结论 |
|---|---|---|
| R01 依赖 | 生产20条含父包传播告警，主修MCP/HTTP、minimatch与KaTeX；没有盲用audit force或降级OpenMAIC。开发工具另有告警，也一并兼容修复 | 全树audit 0；受支持npm ls 0；兼容回归通过 |
| R02 输入来源 | 五个不匹配来自已合入生产的effc6c0，不是本轮改样式。其前驱确实复原原基线；新守卫从固定历史提交重建五文件，其余11文件与官方参考仍按原摘要保护 | 新版本守卫29/29；16额外漂移与5回退均拒绝；原基线、旧28/1保留 |
| R03 首次长帧 | 未使用的检索、恢复和诊断子树原本也初始化；现在首次打开才初始化，随后一直挂载。顶栏原来在React提交中同步测量，现在消费ResizeObserver已有布局且只在高度变化时写变量 | 节点541→495；最新三次冷峰66.7–84.8ms，未消除；深度追踪主要GPU栅格化69ms，不宣称全帧稳定 |
| R04 页面状态 | 新增真实Electron只读故障边界，延迟/拒绝原读处理器，恢复后调用真实SQLite。截图发现未知资料数显示伪0，已改为未知标记；缩窗会强行卸载手动打开的面板，已保留打开意图和原实例 | 五目录15状态、四窄窗几何条件通过；18页普通尺寸场景与交互/队列另测，不能据此宣称全部业务状态笛卡尔积通过 |
| R05 原生125% | 当前实际DPR1.5。Windows显示设置进程无响应，启动和窗口选择超时；重置桌面连接后仍无设置窗口 | BLOCKED；未修改系统缩放，没有以强制DPR代替原生验证 |
| R06 交付 | 固定最终构建验证、前轮只读GPT复审与本轮当前模型复核、正常整合与推送main，并启动相同构建 | 测试与窗口见delivery.json；远端完成情况只以final-delivery-receipt.json实查为准 |

首次无动画对照误用了容器类名，已作废该因果判断；后续使用真实 edu-workspace 且断言抑制次数为1，仍见冷峰。受控旧/新各三次P95约6.2–6.3ms，最大帧间隔约72.6–72.9ms，不能声称冷峰有改善。GPU追踪也不是“驱动缺陷已确认”的证据。

## 修改范围

- package.json / package-lock.json：兼容更新及精确override。Pi四直接依赖仍1.0.2；用户已允许必要时适度升级，但本轮无须改Pi主包。
- package.json 的 allowScripts：新版npm默认阻止未登记的依赖安装步骤，已按实际安装版本登记7条已检查脚本，不改全局npm配置。最终以严格策略干净安装和实际启动验证，不把被跳过的脚本称为已执行。机制见[npm官方文档](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)。
- packageManager固定npm11.21.3作为可复现的依赖校验入口；其在最终锁文件clean CI后ls为0。本机旧npm11.6.2仍会对满足原范围的override/optional peer报告invalid，旧诊断保留，没有忽略peer门禁或修改全局npm。
- MaterialsWorkspace、MaterialLibraryLayout、MaterialLibraryActivity：首次使用延迟初始化，折叠后保留挂载、草稿和异步守卫。
- MaterialCatalogFilters、MaterialLibraryNavigation：从真实facets判断数量是否已知，未知不是0，保留无障碍说明。
- useHeaderExtent：去掉React提交阶段强制测量，保留窄窗真实栏高。
- PiWorkspaceShell：保留手动打开的任务/文件栏跨断点状态；原自动恢复策略、会话隔离、数据与权限不变。
- PiConversationContextActions、PiEducationWorkspace及chat.css：仅隔离“查找历史”外层原生组件样式并对齐输入内容列，原Button及记忆处理器不变。原生点击仍进入唯一PiComposerPendingPanel，并可收起再展开；没有另写记忆UI或权限路径。
- pi-education-boundary-smoke：SDK未注册工具用例改用真实未注册的bash；受控exec_command校验参数失败且执行器零调用。接手修复P2：必须先匹配本次`invalid-terminal`调用和`exec_command`工具，再验证错误及零副作用，防止拾取上一轮错误误绿。该修复只改测试，没有改生产工具或权限。
- ui-contracts及独立source guard：保护原11文件和官方参考，精确验证五个历史生产文件；测试包括额外漂移和回退拒绝。未编辑vendor、原组件配置或全局CSS。
- ux-followup四个验收脚本：真实运行、故障边界、兼容比较及帧追踪，模块分别保存，没有堆入App.tsx。

新增传递包 @isaacs/nonrecursive-glob-match 使用BlueOak-1.0.0，minimatch现版同许可；KaTeX、MCP SDK和Hono适配器标识MIT。没有新增UI库、原生运行服务或数据库迁移。未验证新的安装包发行和macOS打包。

公式验证覆盖真实Office MathML转换、常用中文/矩阵/积分公式和非法输入拒绝；没有将这些断言称作Office/WPS实机排版验收。完整逐页边界见[状态表](../../../acceptance/ux-followup-20261126/STATE_COVERAGE.md)。

## 证据口径

接手后再次执行的门禁：

| 命令（apps/desktop） | 退出与结果 |
| --- | --- |
| npm.cmd run test:xiaozhi-pi | exit0，9/9；新增结果归属断言已实跑。真实Pi SDK＋受控模型协议，不是真实provider |
| npm.cmd run build | exit0，含tsc；完整out与之前正式Pi隔离构建逐文件指纹一致 |
| npm.cmd run test:renderer-components | exit0，261/261 |
| npm.cmd run test:ui-contracts | exit0，29/29，18页 |
| npm.cmd run test:ui-style-isolation | exit0，9/9 |
| node scripts/acceptance/frozen-component-sources-test.mjs | exit0，11原文件＋5生产快照，16漂移/5回退拒绝 |
| npx.cmd --yes --package=npm@11.21.3 --prefer-offline npm audit --noproxy=registry.npmjs.org --fetch-retries=0 --fetch-timeout=20000 --json | exit0，全树0告警；没有修改代理或全局npm配置 |
| node scripts/ux-followup-read-states.mjs --header-only | exit0，四尺寸对齐＋四面板断点几何；此模式cases为0，不计为五目录重跑 |
| node scripts/ux-motion-electron.mjs | exit0，最新正式Pi构建10/10；真实本地交互、草稿归属、原时间、四尺寸、减少动效与SQLite重启读回，网络尝试为空 |

上述日志以`*-resumed.log`、`pi-boundary-attributed.log`、`audit-resumed.json`保留在证据根，机器索引记录hash。完整五目录故障/恢复、10项交互、5项队列证据各自按精确构建归属记录；旧legacy207结果明确标明早期构建，不冒充本轮生产Pi全量验收。

当前源码指纹`7f6f84b36df7883a9952c7abafb4b2a5d2de4e4e8695665e9d100fe8db8c4bae`，out与隔离目录`test-results/ux-followup-context-final`同为`df5c2e85baca1c46a1e4f6c7bade69c8941bb25653299b4dfe1ee4588620aa3c`。`58d74dc`只改变测试断言，不改变src/package/lock。运行窗口标题为“小智 · UI修复验收（最新版·独立数据）”，路径、独立数据根及实际进程见review-window.json；没有迁移或替换日常资料。

原生实操使用sky在实际Electron中完成：首页对齐、资料加载→真实空态、处理队列展开/收起、恢复分组展开、返回问小智、历史查找打开及收起原待处理面板。详情见native-actions.json；原生快照已在会话展示，磁盘截图为同版Electron自动化证据，不把两种来源混为原生录像。

工作树并非全干净：4个能力/权限生成文件与6个vendor行尾差异在接手前已存在，未混入本轮提交。源码摘要为执行生成脚本后的实际磁盘身份，不冒充所有src文件都与Git原始blob逐字节一致；构建与实际窗口均按此摘要核对。完整交付证据用collect-delivery.mjs筛选，发布文本换行处理见EVIDENCE_FORMAT.md，原件与发布件均保存摘要。

精确命令和结果写入证据根的delivery.json。旧全量smoke运行期间构建输出被刷新，该次已作废；full-smoke.log不计通过。所有失败日志保留。组件夹具不是Electron业务闭环，受控Pi响应不是真实provider，窄桌面窗口不是手机安装包。

原生缩放及完整自然业务状态仍不足，因此不输出UI_R1_DONE，不把本轮局部交付称作整个项目或原UI_R1结项。原厂授权制品身份仍未认证；新守卫证明的是既有生产快照身份及防漂移。

## 恢复与回滚

从本轮交付回执核对源码/构建摘要、数据根和测试身份。测试使用独立虚构资料，未替换日常配置或资料根。恢复125%验收需要可操作的Windows显示设置或另一台真实125%桌面；恢复首次冷峰诊断使用 ux-followup-performance.mjs --deep-trace，保留GPU任务和原始帧。

按本轮具体实现提交正常revert，不回滚f420db0团队修复，不reset、强推或删除协作者工作树。依赖回滚应按同一提交恢复package与锁文件并重新安装、构建，不以现有node_modules作为回滚证据。

参考：[MCP安全公告](https://github.com/advisories/GHSA-6prh-2h8m-c8cw)、[minimatch安全公告](https://github.com/advisories/GHSA-g3hv-75wg-m249)、[KaTeX安全公告](https://github.com/advisories/GHSA-238p-pmpm-9mq7)。修复结论以实际最终锁文件审计和回归为准。

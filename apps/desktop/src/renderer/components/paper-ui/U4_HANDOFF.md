# U4 智能组卷交接

## 范围与组件合同

仅 renderer 组卷展示和相应组件测试。没有 Git、全局构建、Electron 启动、后端、IPC、数据库或 vendor 修改。任务要求本身作为实施合同：三阶段、原业务/来源/确认/版本/六类导出守卫不变。Root 协作文档由父统一更新。

| 组件 | 真源 / API | 本轮使用 | 内部样式 |
| --- | --- | --- | --- |
| Button | 当前安装的 @heroui/react；官网 Button API | variant、onPress、isDisabled、isPending；导航 aria-current=step | 未覆盖 |
| Input | 当前安装的 @heroui/react；官网 TextField/Input 文档及本地 input.d.ts | 原生 label 关联；value/onChange/number/min/max/maxLength | 未覆盖 |
| Stepper / NativeSelect | 最新 imitation 源码有，但当前 vendor 未安装 | 不复制 vendor；步骤由原有 Button 组合，select 沿用现有实现 | 无新增 vendor |

官方核对：https://heroui.com/en/docs/react/components/button 、https://heroui.com/en/docs/react/components/text-field 。本轮不宣称 Pro 原样复制，也没有依赖升级或新组件库。

## 修改文件

- `PaperBlueprintWorkspace.tsx`：原 IPC、创建/取消、session/request/generation、快照与 dirty 判定保留；三阶段显示，历史和比较渐进展开。
- `paper-ui/PaperBlueprintEditor.tsx`：抽出原蓝图全部字段与三模式/已确认题组上下文，Input 使用现有 HeroUI 默认设计。
- `paper-ui/PaperWorkflowNavigation.tsx`：可键盘操作的步骤按钮，未生成不能核题，未满足交付条件不能进入交付。
- `paper-ui/paper-workflow.ts`：纯展示交付守卫。host 仍为权限、来源、版本和实际导出的权威。
- `PaperReviewPanel.tsx`：选题扫描/排除记录收为详情，缺题/来源失效/蓝图变化警告及逐题内容/拒绝/确认保留。
- `PaperExportEntry.tsx`：学生卷、教师答案卷、答题卡三组，Word/PDF 共六入口，沿原输出授权、工具草稿与文件审批，不显示虚构成功。
- `ui-system/paper.css`：仅应用命名空间的组卷布局，不使用 !important、不改 HeroUI slots/BEM/变量。放在 ui-system 是为了沿既有 CSS 边界被当作应用布局加载，避免被旧 CSS 兼容变换隔离。
- `scripts/paper-workflow-ui-test.mjs`：纯展示和 SSR 回归。

## 验证

`node scripts/paper-workflow-ui-test.mjs`，在 `apps/desktop` 执行，最终 exit 0。覆盖交付守卫、步骤 disabled/aria-current、三模式全部蓝图字段/生成配额与上下文、确认/拒绝守卫、六导出入口及版本/来源阻断。无 host 写入、模型或 Electron 调用。

第一次完成实现后测试 exit 0；一次重跑期间修改源文件导致 Vite SSR 等待未返回，主动 Ctrl+C 后 exit 1；停止写入后重新执行最终 exit 0。不用中止运行冒充通过。

## 父任务待验

- 统一 typecheck/build/全组件回归，双尺寸截图、Hover/Focus/键盘和控制台。
- 真实快照、历史比较、来源变化、拒绝、冷启、审批取消/写入失败与六种文件实际打开核对。本片 SSR 不能证明这些端到端通过。
- 原 `paper-workspace.css` 仍由 `office/PiPaperReview.tsx` 使用，未删除以保护聊天核题弹窗；旧文件三个 !important 原样保留，本轮新 CSS 没有新增。
- `PaperReviewPanel` 与 `PaperExportEntry` 也由聊天核题弹窗复用，父验收需检查弹窗。未更改其 props/API、typed IPC 或业务守卫。
- 历史展开列表暂用现有全量数据（与原实现相同），超长列表仍需真实性能验收；本轮不声称性能指标改善。
- 回滚只需限定还原上述 renderer 与测试文件，不涉及任何数据迁移。


## 独立细审追加

修复：步骤禁用的可见原因；历史/新建替换未保存编辑前显式保留/放弃；模式和题组上下文修改保留原快照以识别失效；侧栏明确草稿与旧快照区别。步骤切换本身不写蓝图、不撤销已有确认。dirty 阻断交付，host 仍复核最新确认版本。新增 PaperExportChoices 纯展示模块，六个 onPress 分别实测委派原 prepare callback 对应 audience/format/template。

测试：`node scripts/paper-workflow-ui-test.mjs` 最终 exit 0。`node scripts/education/paper-export-boundaries.mjs` exit 0，21项，临时证据 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-paper-export-voFLFr`。直接执行 `paper-boundaries.mjs` 初次 exit 1（Node extensionless student-context 解析），且此文件本身只导出函数；复用现有 register-source.mjs、capability-boundary-smoke 的 Electron/JSON source hook、synthetic Pi stream 和网络禁用，在临时目录调用原 paperBoundaries，exit 0，24项，证据 `C:/Users/ZhouXuan/AppData/Local/Temp/u4-paper-boundaries-XAR6Yk`。没有修改 shared/main 或 smoke 原断言，没有启动 Electron、构建或付费。

`paper-export-journey.mjs` 已读。旧旅程确认后直接访问导出入口，新 UI 需先点击 `paper-to-delivery` 或 `paper-step-delivery`；原六类真实导出循环及 verify-paper-export.py 可复用。但旧旅程只有首次点击 UI 导出，其余直接填 composer，不证明六入口逐一可点。建议新增独立入口检查 helper（暂未写/运行）：复用 ctx/paper/相同 fixture，六次点击入口只检查预填 draft 和未自动发送，回历史重开同一 paper；再由父只跑一次原旅程完成真实六类文件读回。父确认后再决定是否增加 helper，避免重复 paid 测试。

为父提供稳定 selector：根 paper-workspace 的 data-stage=blueprint/review/delivery；paper-step-*；paper-to-delivery；paper-history；paper-saved 上 data-paper-id；paper-draft-status；paper-discard-continue；paper-export-{student|teacher|answer_sheet}-{docx|pdf}。

# U6 源码交接

## 已实现

- 原资料读取提供宿主来源快照；Pi 只提议大纲，不能批准。稳定 sceneId、目标、活动、每页时长及总时长受严格 schema 约束。
- 大纲 CAS 编辑保留版本，保存新版本清空其确认与检查点；生成时只读。新入口携带严格 outline/generate typed start，不能用旧 prepare/stage 绕过。
- 教师明确点击生成/继续，原 Pi 绑定大纲 id/version 与真实 run。原 OpenMAIC prompt/normalize/build + 同一离线 DSL 逐页检查；每页成功立即保存原确认账本。
- 停止及冷恢复保留成功页；恢复只将状态标 interrupted，不启动模型。显式继续只补缺页；重复相同 contentJson 保留首次页，不受上游新 canvas ID/时间戳影响。
- 全部必要页齐全后确定性提交原 pending classroom。复用原 SlidePreview/Quiz、最终教师确认与 Office 导出审批。来源、大纲版本改变后旧课堂确认/导出被宿主拒绝。
- 计划 action 排除旧 generic 确认；不写成绩，不增服务/DB/deps/AgentLoop，不改 vendor/输入组件/知识库调度。AI 还原页及学生证据个性化明确不支持。

## 写集

新增生产文件：

- `shared/classroom-plan.ts`：DTO、严格校验、工具常量。
- `main/education/classroom-plan-state.ts`：原 SQLite 账本上的版本、确认、生成所有权、检查点、恢复及来源守卫。
- `main/education/classroom-plan-tools.ts`：五个原 Pi 工具；不发独立模型调用。
- `renderer/components/product/ClassroomOutlineEditor.tsx` / `ui-system/classroom-outline.css`：大纲编辑、确认、进度、停止与显式继续；仅应用自有布局。
- `renderer/components/product/ClassroomOutlineCards.tsx`：U6 自有教学安排与参考说明卡片，复用共享 `DisclosureCard` 及其官方 Card/Disclosure/Chevron，不新增原生 details/summary。

现有局部接缝：

- `shared/classroom.ts`：抽出同一单页校验供 checkpoint，旧完整校验仍须 slide+quiz；课堂保留计划来源。
- `shared/xiaozhi-{agent,start}.ts`：typed start 字段和严格互斥校验，保留 U1 event/capturedAt。
- `main/education/classroom-{state,tools,api}.ts`：最终来源守卫、旧 stage 阻断、新 typed IPC。
- `main/xiaozhi-agent/{session-state,production-host,ipc,pi-session}.ts`：实例化/恢复、start 绑定与释放、注册和新增独立工具 identity；旧课堂 identity 未改。
- `main/xiaozhi-agent/tools/manifest.ts`：五个工具效果分类。
- `main/db.ts`：仅三个 generic 查询排除名单。
- `preload/index.ts`：四个 typed 计划接口。
- `renderer/components/product/ClassroomWorkspace.tsx`：新制作入口及大纲组件，原预演、编辑、最终确认和导出链保留。

## 已执行验证

工作目录均为 `D:\WorkProject\EduProject-sidebar\apps\desktop`。

| 命令 | 实际结果 |
| --- | --- |
| `node_modules/.bin/tsc.cmd --noEmit` | P1 阶段及共享 DisclosureCard 迁移后最终均 exit 0；中间协作者依赖尚未落盘的失败已保留在下方记录 |
| `node scripts/education/classroom-plan-boundaries.mjs` | Astra P1 修复后最终 15 组通过、exit 0；真实隔离 SQLite、原 DSL 与 Pi 工具、IPC handler，无 provider/Electron 声称 |
| `node scripts/education/classroom-example.mjs --join` | 旧课堂/来源/Office 兼容 11 项，exit 0 |
| `node scripts/xiaozhi-agent/ui-style-isolation-test.mjs` | 8 项，exit 0 |
| `node scripts/education/classroom-outline-components.mjs` | 共享 DisclosureCard 迁移后 18 项，exit 0；真实 React/HeroUI DOM、键盘、多项展开、内容保持挂载、只读与状态摘要，无 Electron/布局声称 |
| `node --check scripts/ui-goal-classroom-live.mjs` / `--check` | exit 0，仅准备，不启动/不付费 |

域报告：`apps/desktop/test-results/classroom-plan-domain-FbLs3Z/report.json`。首次边界断言把改变页标题判为 conflict，而宿主合理返回 invalid_input；已改为在保留合法标题时改变正文，确实验证重复内容冲突。未放松生产守卫。

未执行 Git、应用 build 或 Electron。父统一完成全 renderer、构建及实际桌面验收。

## 父验收入口

父注入运行密钥并在最终 out 构建后运行：

```powershell
node scripts/ui-goal-classroom-live.mjs
```

脚本不构建；使用独立 data/profile 与现有 buoyancy-review.pdf，从资料库 UI 导入，真实 Pi 大纲、未确认阻断、教师确认、首个真实 checkpoint 后停止、冷启零重放、显式补缺页、原预演与选择题反馈、独立最终确认、原 Office PPTX 审批及文件/hash/ZIP 读回，再冷启。双尺寸截图与 SQLite checkpoint 读回，无 raw reasoning 日志；若没观察到部分成功停止窗口会真实报失败，不冒充中断验收。

关键 testid：`classroom-plan-editor`、`classroom-plan-{id}`、`classroom-plan-{title,objectives,total,save,confirm,generate,stop,preview,error,notice}`。原 `classroom-*` 预演/编辑/导出 testid 保留；新制作入口现在直接 typed start，旧验收“点击制作后要求输入框出现草稿再发送”的时序需按新合同调整。

## 未验收边界

- 真实模型、双尺寸/CSSOM、实际停止/重启/导出及教师学科正确性均待父跑上述脚本；不能将域测试当真实教育质量等同。
- 原工具公开展示投影只支持既有安全摘要/来源；新增 U6 工具沿该投影，不 dump 原生提示或内容 JSON。若统一过程区需更具体摘要，由父协调 U1 的公开 DTO 切片。
- 首片不含 AI 还原来源绑定、学生证据个性化或仿真引擎。课程分钟数是教学安排，不是工具调用用时。
- 旧课堂 v1 可读；不带 typed intent 的旧无资料入口仍兼容旧工具。有活动新计划的会话，其 legacy stage 被宿主拦截。

回退：限定 U6 文件 revert，保留计划账本行，不删除用户数据；旧 generic 确认排除应继续保留。

## Astra P1：教师编辑后的模型交付隐私边界

根因：教师编辑应原样保存，但 `education_read_classroom_plan` 与 `education_prepare_planned_scene` 原先未再次脱敏检查，已确认大纲中的姓名、电话可能进入模型上下文。只保护 propose/save-scene 不覆盖该路径。

本次仅修改 `main/education/classroom-plan-tools.ts`、`scripts/education/classroom-plan-boundaries.mjs` 和本交接文档。两个出口共用 `deliverApproved`：检查已确认大纲全文和待交付内容，复用生产宿主注入的 `options.sanitize`。结果只要有变化就返回 `sensitive_content`，要求教师修改、保存并重新确认；不交付原文、不静默改写已批准文档/版本，也不增加 checkpoint。已保存页的 prepare 快速返回同样经过检查。

异步脱敏前后均复查 active run、当前大纲版本与来源；等待期间停止、AbortSignal 取消、run 结束、来源变更、教师另存新版本均拒绝交付。停止统一返回 `cancelled`，错误只含固定安全文案，不附 document/system/user 或敏感值。未修改 shared/main 注册接缝、状态存储、vendor 或他人文件。

精准回归实际走教师 edit→confirm→begin、真实 SQLite 状态及原 Pi adapter：姓名、电话、非目标页敏感文本均阻断两个出口；安全大纲与原生 prompt 原样通过；脱敏挂起时五种失效路径均无晚到正文。脱敏器在域测试中可控注入，用来稳定制造等待窗口；不将此冒充真实模型/生产脱敏质量验收。15 组 exit 0；最终锁定编译器 `node_modules/.bin/tsc.cmd --noEmit` exit 0。

性能边界：每次大纲/提示交付新增一次异步脱敏和前后 SQLite 守卫，无新模型调用或网络权限；真实端到端延迟仍待父验收。未运行应用 build、Electron 或 Git。源码已就绪，由父统一构建与真实桌面验收。

## 最新 U6 冻结：卡片与 Chevron（供父及 Astra 复核）

按父最新要求，仅修改 U6 新编辑器、专用 CSS、新增 `ClassroomOutlineCards.tsx` 和局部 DOM 测试。教学设计使用现有安装版本的 [HeroUI Card](https://heroui.com/en/docs/react/components/card)；折叠区域在父提供共享 source 后已从独立 Accordion 迁移为 `import {DisclosureCard} from '../ui/DisclosureCard'`。沿共享组件官方 Card/Disclosure/Heading/Trigger/Indicator/Content/Body 原有 anatomy、样式、Chevron 和键盘行为；不改共享实现、vendor、Composer、共享 ClassroomSources、旧 ClassroomWorkspace 或其他 worker 领域。

教学名称/目标/总时长放进教学设计卡片。逐页先显示标题、类型、教学分钟数和保存状态，默认只展开首个编辑表单，可同时展开多页。来源与较长使用范围按需展开，三层批准区别及修改后重新确认始终可见。未新增原生 details/summary、marker、全局样式或 !important；业务审批与 DTO 没有变化。

局部测试最终使用 `server:{middlewareMode:true,hmr:false,ws:false}`，显式关闭 WS transport，不占用 24678。该锁定 Vite 的 middleware 模式仅 hmr:false 仍会创建 WS，一次中间测试出现占用提示；只修本测试脚本增加 ws:false 和配置断言，未终止任何进程，最终 18 项通过且无端口提示。18 项 React/HeroUI DOM 检查、15 组真实 SQLite/工具边界、8 项样式隔离均 exit 0。历史中间类型检查曾因下列协作者文件依赖尚未落盘的 `DisclosureCard` 而 exit 1：

- `src/renderer/components/paper-ui/PaperQuestionReviewCard.tsx:3`
- `src/renderer/components/PaperBlueprintWorkspace.tsx:8`
- `src/renderer/components/PaperReviewPanel.tsx:4`

共享组件随后已落盘，迁移前重跑及迁移后最终类型检查均 exit 0。新 UI 使用 `defaultExpanded`（仅首个课页默认展开）和独立卡片以支持多项展开，标题仅含非交互文本；data-testid 定位 inner Disclosure，再由测试查询其官方 trigger，不伪造 open/onToggle。折叠内容保持挂载，测试验证同一 textarea DOM 不因收起而丢失。真实 Electron 样式/截图与教育质量仍待父验收，DOM 测试不替代之。

Astra P1 复核位置：`classroom-plan-tools.ts` 的 `deliverApproved` 及两个调用出口；`classroom-plan-boundaries.mjs` 的 teacher-edit→confirm→begin 隐私案例和五类异步失效案例。父最新明确确认：父复跑 U6 边界 15 组 exit 0，Astra P1 cleared，当前主线无 U6 冲突。

父要求最终冻结后，只检查自有 `ui-goal-classroom-live.mjs`：`node --check` 与脚本 `--check` 均 exit 0，未启动应用或模型调用。当前该脚本无原生 details/summary 选择器；组件测试已按共享 data-testid 在 inner Disclosure 下查找官方 button。如真实验收遇到其他旧选择器，由父给出具体失败后再局部调整脚本。

U6 owned source 已冻结，不再写入；未执行 Git、应用 build 或 Electron。

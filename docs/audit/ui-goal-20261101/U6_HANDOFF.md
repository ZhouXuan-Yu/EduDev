# U6 源码交接

## 1042579 之后的科学提示修复（source ready，待父构建与真实复测）

Astra 的 `QUALITY_RESULT.md:106` 指出旧 `run-lMlOPD` 唯一 quiz 的题干为“浸没水中静止”，正确选项/解析却因重力较大断言下沉，遗漏测力计拉力；本轮读回成功不能抵消该科学关键错误。旧公开产物早于 B 新物理护栏，继续原样保留，不改分、不改答案或旧 checkpoint。

实际调用链：同一原 Pi → `education_prepare_planned_scene` 获取 OpenMAIC 原生提示 → 同一 Pi 生成 contentJson → `education_save_classroom_scene` 归一化/DSL 验证/保存。OpenMAIC 在 prepare 中的回调只捕获提示，在 save 中只接收 Pi 已生成的 JSON，没有独立 provider 请求。B 在 Pi.prompt 依据本轮文本/续做任务添加的护栏可覆盖含学科词的入口，但不能只凭该标题判断所有实际课页上下文。

此次唯一生产修改为 `apps/desktop/src/main/education/classroom-plan-tools.ts:8,52`：复用 B 的 `physicsAnswerInstructions`，根据宿主已确认大纲全文作条件路由，附加至原 OpenMAIC 页级 system 字段；原 user 提示保留。两页 slide 与 quiz 的每个缺页都经过同一 prepare 出口，因此无需新 Agent/provider/loop。结果仍经过原 deliverApproved 脱敏及异步前后 active/source/version 校验，仍限 48,000 字符。未改 approved document、schema、确认/权限、写入准入、停止恢复或已有页；没有样本数值答案硬编码、输出过滤或自动纠错。

自有测试修改为 `apps/desktop/scripts/education/classroom-plan-boundaries.mjs`：真实 edit→confirm→begin→三个 prepare 工具调用，课程标题/目标均为中性文字，仅第二页活动含物理条件，验证两页 slide 与 quiz 都收到同一份 B 护栏且只出现一次；语文课三页不添加该护栏。确认版本与 checkpoint 完全不变，原隐私/来源/取消/迟到/确认测试保留。

实际验证：领域边界 16 组 exit 0，报告 `apps/desktop/test-results/classroom-plan-domain-DZU1GJ/report.json`；原宿主准入集成 11 组 exit 0，报告 `apps/desktop/test-results/classroom-admission-ztlRnY/report.json`；锁定编译器 `node_modules/.bin/tsc.cmd --noEmit` exit 0。未运行应用 build、Electron 或模型；旧 QA 脚本未改。

性能与未验收边界：每页多一次有界大纲序列化、关键词路由及少量提示 token，无新增 IO/provider 请求；真实延迟和新产物科学正确性待父复测。关键词路由不是学科求解器，不能声称保证答案正确，也不以单例证明对照质量等同。F 生产源码与测试重新冻结，父可统一构建；下节 1042579 证据仅对应旧构建，不能回填为此次科学修复效果。

## 最新验收状态（1042579 同构建补验结束）

本节覆盖下文历史的“待父运行/待补验”状态；原失败记录不删除、不改判整套通过。

- 原真实运行 `classroom-live/run-lMlOPD/report.json` 仍为 `success:false`、exit 1、5 项通过。真实大纲待确认、未确认生成阻断、逐页 checkpoint、停止/冷启/显式补缺、3 页进入 pending classroom、原 sandbox/quiz 反馈、独立最终确认及零学生记录均已通过；随后 QA 用 `exports + 初始 artifact.path` 读文件而 ENOENT。
- 该失败是 QA 的目录假设错误。导出按钮不触发目录选择器，本轮未绑定外部工作目录；原 host 保存到该运行自有 `XiaozhiOutputs/<scope>/<session>/...pptx`。实际 Office receipt 为 saved、document artifact 为 exported，两者持久化文件路径相等，工作区 hash 与 receipt 相对路径均匹配。未因该失败修改生产导出、审批或路径策略。
- 父在相同 1042579 out 上完成 `ui-goal-classroom-readback.mjs --check`（exit 0）及实际补验（exit 0、3 项通过）。独立证据：`apps/desktop/test-results/ui-goal-20261101/classroom-live/run-lMlOPD/readback-followup-0KpxmA/report.json`。报告 `success:true` 仅属于此次补验，不覆盖原报告。
- 补验 build SHA256：`59afcfe2a5240286233674b18449c7f0295ff650c6aebf528c7a9aaed5c347f4`。原报告 SHA256：`bb6a6be0ac9a738cab5aa3d5f906957035d00390e58c52dc705c4dd9d472f68d`，补验确认其内容未变。
- 实际 PPTX 为 108,031 bytes，SHA256 `7dd39cb0ea5703bffd5e89b54d99a0097c502b1cf07fca5f6174aaca976de22a`，与 receipt/output hash 及 document artifact hash 一致；ZIP CRC 通过，包内 4 张 slide XML。保存的课堂版本与导出 source 绑定一致。文件位于本轮自有 run 目录内，未读取外部用户文件。
- 实际补验重开同一 profile，恢复同一 ready 大纲、3 个 checkpoint、confirmed classroom 与 saved Office artifact；展示原预演，并生成 1366×768/1920×1080 两张截图。课堂/计划账本 digest 未变、模型运行数未增、学生学习记录仍为零、文件 bytes/hash 未变、无已捕获控制台错误。补验未发起模型或批准动作。
- 工程定位前一轮 `run-3QtUDC` 的 6 次大纲工具失败公开码为 task_blocked；修复为宿主 captured typed intent 选择课堂版本账本，保留通用任务 refresh、原 write manifest、journal 准入和独立确认。父重跑新增实际 task runtime/执行边界/SQLite 集成 11 项通过，A 只读审查已接受 source freeze。新测试初次 tool_receipt_conflict 为夹具漏掉 SDK tool_start 生命周期；补齐原 tool_start→准入/执行→tool_end 并验证 receipt 状态，生产 receipts 守卫未放宽。

本轮 QA 修复及新增路径（父精确 staging 时勿遗漏）：

- `apps/desktop/scripts/ui-goal-classroom-live.mjs`：不再排队无消费者的导出目录 dialog；使用已提交 receipt 读回实际文件。其他原闭环断言保留。
- `apps/desktop/scripts/acceptance/classroom-export-readback.mjs`（新增）：只读验证持久化路径、工作区与 session/classroom/version 绑定、自有运行范围、hash/size 及 ZIP CRC。
- `apps/desktop/scripts/ui-goal-classroom-readback.mjs`（新增）：同 build、同自有 profile 的最小冷启动补验，单独报告；`--check` 不启动 Electron。
- 较早准入修复新增 `apps/desktop/src/main/education/classroom-plan-admission.ts`、`apps/desktop/scripts/education/classroom-plan-admission.mjs`、`apps/desktop/scripts/acceptance/classroom-outline-wait.mjs`；host 接缝由 B 独占编辑，见 `U6_HOST_ADMISSION_PATCH.md`。

最终状态：生产源码与全部 QA 脚本均冻结；本次只更新 U6 自有文档，不再写生产/QA，不执行 Git/build/Electron。原整套运行仍失败，相关导出/冷启动补验另行通过；尚未形成一次修正后整套连续成功或教师盲评/对照教育质量等同证明。父后续 B 源码构建不能冒用本 1042579 的运行证据。

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

## GOAL 状态：父串行真实验收前

- 生产实现与共享 DisclosureCard 迁移：source frozen；类型检查 exit 0、组件 DOM 18 项、样式隔离 8 项通过。
- 隐私 P1：父复跑 SQLite/工具边界 15 组通过，父确认 Astra cleared。此后未再改生产文件。
- 真实教育闭环与配对质量：prepared，待父运行；未将源码/DOM 测试当作 Electron、模型或教师质量验收。
- 父告知当前 out 基线 `9752656`。本 worker 没有 build/启动/新模型调用，不改此 out。

### 自有真实脚本 QA 与最终修改

运行目录 `D:\WorkProject\EduProject-sidebar\apps\desktop`，父注入运行密钥后执行：

```powershell
node scripts/ui-goal-classroom-live.mjs
```

安全准备检查：`node --check scripts/ui-goal-classroom-live.mjs`、`node scripts/ui-goal-classroom-live.mjs --check`，最终均 exit 0。`--check` 仅读本地合成文件，不启动 Electron/网络/模型。

该轮只改脚本与本交接文件。脚本复用 `openmaic-public-content.mjs` 的 `fixtureSha256`、requirement 与 `assertScenes`：教师输入仅把“附件 buoyancy-review.pdf”改成“资料库 buoyancy-review.pdf”，保持相同测力计 3 N/2 N、八年级、40 分钟、2 slide+1 quiz、恰好 1 道单选题及无联网/仿真/外部图片/配音/视频/脚本的核心要求。实际系统上下文及资料通道不同，不能称完整模型请求逐字相同或质量已等同。

默认合成 PDF 为 2964 bytes，实际 SHA256 与基准完全一致：`309735f1bb95aef4b849af7a759848393a4b780d52269abaae0c390f36fccf90`。现在启动与离线检查都强制相等，路径优先级 `UI_PAIRED_PDF` → `UI_CLASSROOM_PDF` → 原默认路径，错误文件会在模型调用前阻断。报告记录任务与 promptSha256；确认大纲前断言 3 页/40 分钟，最终原 DSL 内容通过相同 `assertScenes` 检查，并仅保存 `outline-public.json`、`course-public.json` 的公开教学字段用于质量比对，不导出原生推理。

选择器 QA：脚本没有 details/summary/native-marker 选择器；现有课堂操作走真实 testid 按钮，教学入口为原 Tabs。Office 待批准卡默认展开，其 preview/checkbox/approve 仍用现有控件选择器；未发现需要本轮迁移的原生按钮选择器，未改受保护 Composer 或 vendor。真实运行中的未观察到问题仍须以父当次失败记录为准。

等待是条件轮询，250ms 检查一次：PDF 导入上限 180s；模型/生成/导出等默认单阶段上限 420s；中断状态持久化 60s；预演画布 30s；每次 launch 60s、工作区就绪另 60s。多个阶段可叠加，这些是脚本超时预算，不是实测耗时估计。正常/部分页停止/冷启/显式继续/最终确认/Office 审批均需要父串行观察；若未捕获部分页停止窗口会明确失败，不自动重跑或冒充恢复通过。

最终状态：脚本 ready 并冻结，父可用现有 out 运行；未修改任何生产源码，不需要本轮重新 build。正式 chat QA 的其他焦点问题由父协调，不混入 U6 写集。

## 2026-11-01 跨构建 compat 只读边界补充

`classroom-compatibility/run-eBPbd2` 保持原判：3 项工程检查通过，整体 `exit 1 / incomplete_compatibility_boundary`。新构建首次及冷启动均恢复 ready 三页、confirmed 课堂与 saved 产物，artifactSources 各返回 1 条 classroom relation；复制 PPTX 为 106155 bytes、4 slides、ZIP CRC 通过，SHA-256 `334afcd190ea51441c23f8face5a92508b7905ff21f60f088e914bd89495f613`，原证据不可变性校验通过。这些仅为已通过的工程子项，不增加内容质量结论。

剩余两个 blocking 均为原导出绝对 receipt authority 位于复制根之外；ordinary Office 对课堂 schema 的 unsupported 仍仅为预期 informational。后续仅查询复制库，匹配原 workspace hash 的 paper-output grant 为 0，legacy workspace 为 0；未调用 `reviewXiaozhiOffice`。按当前 authority 解析源码，无原授权记录时会回落到复制实例目录并与原 hash 不匹配；元数据读取也不能替代文件与 authority 的完整 receipt 验证。此限制不构成生产回归证据。原 compat 脚本、报告、路径、authority 与元事实均不改，不再新测；完整 receipt 权限边界继续保留。

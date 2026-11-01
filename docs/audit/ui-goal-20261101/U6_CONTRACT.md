# U6 生产切片合同

## DTO 与真源

- `ClassroomPlanDocument`：版本化 schema、title、objectives、totalMinutes、稳定 sceneId 的 slide/quiz 列表；每页包含活动与分钟数，合计须与 totalMinutes 一致。2–12 页，至少一页讲解与一页选择题；不支持仿真、脚本、远程资产。
- `ClassroomPlanItem`：id/session/run/revision/version、上述 document、宿主实读 `ClassroomContext`、draft/confirmed/generating/interrupted/ready/rejected、成功页 checkpoint 和最终 classroomId。来源必须非空且为已实读的保存正文；不接受模型指定的来源、学生证据或 AI 还原页。
- `ClassroomPlanBinding`：id + outline version，作为现有 `XiaozhiStartInput` 可选字段；宿主校验会话、确认状态、来源及当前版本，认领实际 runId 后工具才可写页。客户端改 prompt 不能绕过。
- 复用 `ai_confirmation_items`，action_type=`pi_classroom_plan`；所有旧 generic 确认查询明确排除。无新表、服务、依赖或模型循环。大纲版本保留独立行；checkpoint 属于具体已确认行和实际 run。

## 行为与权限

1. Pi 实读资料 → propose outline 工具只保存 draft，不生成页。教师在大纲编辑器逐项编辑和明确确认当前版本。
2. 编辑用 CAS；修改产生新版本并使旧确认/旧页失效，稳定 sceneId 保留。generating 时编辑只读。
3. 教师点“生成课页/继续缺页”调用原 Pi start，附 typed binding；宿主确认、来源、run 及 late/duplicate 检查。不得仅靠模型“等待确认”。
4. 逐页复用 OpenMAIC prompt/normalizer/build/DSL/offline subset，保存成功 checkpoint。重复同内容幂等，不同内容冲突；停止/冷启保留成功页，恢复只标 interrupted，不重放。
5. 显式继续仍走原 Pi，只补缺页。全部必要页齐全后原账本生成 pending classroom，绝不自动 confirmed。
6. 最终课堂确认与 Office 文件写入批准分别沿旧流程。课堂、确认和导出都重新校验计划版本及原资料快照。作答只在 React 局部状态，零成绩写入。

## 写集及顺序

冻结构建期间只写本合同，等待父发构建完成。

1. 新增 `shared/classroom-plan.ts`、`main/education/classroom-plan-state.ts`、必要工具模块、`ClassroomOutlineEditor.tsx` 与专用布局 CSS、宿主边界测试。
2. 现有 `classroom-{api,tools,state}.ts` / `ClassroomWorkspace.tsx` 接入；保留旧 v1 读取和既有路由。旧 stage 在存在有效新计划时不能绕过。
3. `session-state.ts` 仅实例化/恢复；`production-host.ts` 仅 typed start 绑定、工具注册与终态释放；`pi-session.ts` 仅新工具 identity/指令；`tools/manifest.ts` 注册；`db.ts` 仅 generic 排除名单；`shared/xiaozhi-{agent,start}.ts` 与 preload 仅类型和严格 schema 接缝。保留 U1 capturedAt。
4. 本 worker 不 Git/build/Electron。父串行类型检查、构建与 Electron；新 Vite 测试均 middlewareMode + hmr:false，不占用 24678。

## 验收与边界

宿主：未确认阻断、版本修改/来源变化失效、重复/迟到、停止/重启不重放、显式继续只补缺页、最终 pending、确认及导出绑定、通用批准不可处理计划。renderer：只读、编辑、确认、错误与成功页状态，所有原入口可达。

正式场景：同 buoyancy-review.pdf，2 slides + 1 quiz，真实 Pi → 大纲教师确认 → 逐页 checkpoint → 原 SlidePreview/Quiz → 最终确认 → Office 导出批准；双尺寸截图、SQLite/readback、重启及零成绩写入。父注入运行密钥，不能用 mock 或离线 HTML 代替实际验收。

回退：限定本切片文件 revert；旧 v1 action 仍可读。新增 plan 行留在原账本，旧 generic 查询必须继续排除，不删除任何资料或产物。

## 组件合同与来源

| 项 | 采用方案 |
| --- | --- |
| 编辑组件 | 现有 `@heroui/react` Button / TextField / Label / Input / TextArea；无匹配的大纲业务组件，复用控件而非伪装成 Pro block |
| 官方核对 | https://heroui.com/en/docs/react/components/text-field 与 https://heroui.com/en/docs/react/components/button，2026-11-01 实读 |
| anatomy | TextField → Label + Input 或 TextArea；按钮沿 onPress/isDisabled/variant 现有 API |
| 默认交互 | HeroUI 原有 hover、pressed、focus-visible、disabled，不添加内部选择器覆盖 |
| slots/BEM | OSS 自有 textfield/input/textarea/button；应用 CSS 只选择 U6 自有布局类 |
| 本地差异 | 不改 vendor，原 SlidePreview opaque-origin sandbox 与 Quiz 复用 |
| 源版本 | 使用本项目锁定依赖；不随参照库最新提交升级依赖 |

首次来源驱动制作入口使用 `{mode:'outline'}` typed start；生成阶段使用 `{mode:'generate', id, version}`。两者均属 `classroomPlan`，严格互斥，不接受额外字段、attachments/continueTask 混传。保留没有此字段的旧入口兼容，新入口不允许走旧 legacy stage。

检查点幂等以宿主计算的原始 contentJson 摘要绑定 sceneId；OpenMAIC buildCompleteScene 会自动分配 canvas.id 与时间戳，不能用每次新组装的整页 JSON 判断同一请求是否重复。首次成功内容保留，重复请求返回已有页，摘要不同冲突。

# 学生与设置定向修复 1

## 当前状态

本组生产源已重新冻结，等待 root 统一构建及 Terra 实际对图。修复前失败为 Terra after-findings.md 和 after-student-selected-1366x768.png、after-settings-1366x768.png 的实际记录。原 after-verified-out 及其 FAIL 保留各自身份。

本次只有静态证据。repair1-static-check.json 为 18 PASS、10 文件摘要，限定路径 git diff --check exit 0。新 build、全量 tsc、GUI、after 截图、CRUD/guard/迟到/冷启业务验证和性能测量均待 root/Terra。

## 有限生产写集

1. apps/desktop/src/renderer/App.tsx
2. apps/desktop/src/renderer/components/product/StudentWorkbench.tsx
3. apps/desktop/src/renderer/components/StudentProfileLifecycle.tsx
4. apps/desktop/src/renderer/components/office/PiWebSettings.tsx
5. apps/desktop/src/renderer/components/office/PiModelSettings.tsx
6. apps/desktop/src/renderer/components/product/StudentContextNavigation.tsx，新纯展示导航
7. apps/desktop/src/renderer/components/product/StudentProfileOverview.tsx，新档案只读投影
8. apps/desktop/src/renderer/components/product/StudentRecordFilters.tsx，新筛选披露
9. apps/desktop/src/renderer/ui-system/student-settings/student-workbench.module.css
10. apps/desktop/src/renderer/ui-system/student-settings/student-settings-layout.module.css

App 仅调整展示参数、展示组件 import 与学生工作台 slots。renderStudentsView 的 presentation 为 all/profile/records，默认 all；renderTimeline 的 presentation 为 all/records，默认 all。原 students route 仍调用无第二参数的 renderStudentsView。StudentProfileLifecycle 增加 all/compact 展示参数，默认 all，原 standalone 档案/表单/全部模块继续通过默认路径组合。

repair1-before/ 保存本次释放时 7 个既有文件的完整前像与摘要，仅用于本轮静态比较和限定回滚。3 个新组件的初次版本在本轮生成。

## 学生结构与保留映射

工作台选中学生后显示六主标签。档案与学习记录使用两个显式 ReactNode slots 切换，其他四个标签通过原 DesktopNavigation.navigate 进入原领域路由。

| 页面位置 | 原能力与本轮位置 |
| --- | --- |
| 档案 | 核心字段为年级、学科、当前关注、真实学生资料范围；教师备注来自 activeStudent.teacherNotes，在读/归档状态保留 |
| 档案就近操作 | 原 student-edit、student-ask-xiaozhi；编辑继续 loadActiveStudentForEdit，学习对话继续原 StudentConversationAction |
| 更多档案操作 | student-profile-more 展开后可见原 student-open-folder、student-export、student-archive，以及原 students route 入口 hub-entry-students。阶段目标、家长关注、标签来自原真实字段，随该披露展开 |
| 学习记录 | 独立 records slot，原 timeline 的 records.map、编辑、附件与来源动作保留；查找和新增记录为轻量按钮 |
| 学习记录筛选 | student-record-filters-toggle 显式展开原记录类型、科目、标签、关键词、开始/结束日期，原受控值和 handlers 保留 |
| 错题与练习 | 原 mistakes route、hub-entry-mistakes |
| 学习计划 | 原 mastery route、hub-entry-mastery |
| 学习复盘 | 原 review route、hub-entry-review |
| 学习概览 | 原 analytics route、hub-entry-analytics |

工作台的 compact 只读档案和 records 标题直接渲染相应内容，装饰 02/03 步骤不进入这两个 slots。首屏的时间线和旧四列生命周期块通过 slots 分开。完整档案与历史仍可从显式入口访问，原 standalone all 展示继续兼容。

## 真实验收定位的前置动作

| 定位 | 当前动作 |
| --- | --- |
| nav-student-workbench | 原主导航进入工作台，student-workbench-layout 保留 |
| student-workbench-empty | 显式选择缺失或与当前 activeStudent 不一致时显示，选择仍通过原学生行确认逻辑 |
| student-create | 页头“添加学生”，继续原 startNewStudent 进入原 students route 的创建表单 |
| student-row-{id} | 原目录真实节点，取消未保存切换继续留在原学生；成功切换后工作台回到档案标签 |
| student-page-navigation | 工作台内为六主标签，其标签是原生 role=tab。原领域 route 的旧页内导航继续由既有 shell 提供 |
| student-context-tab-profile，新定位 | 本地“档案”标签，选中学生后默认激活 |
| student-context-tab-records，新定位 | 本地“学习记录”标签，先点击它再寻找查找/新增记录入口 |
| hub-entry-search | 学习记录标签下“查找记录”，原 guarded search route |
| hub-entry-intake | 学习记录标签下“添加记录”，原 guarded intake route |
| hub-entry-students | 档案标签 → student-profile-more → “完整档案与历史”，原 guarded students route |
| hub-entry-mistakes / mastery / review / analytics | 工作台六标签中的后四项，继续各自原 guarded route |
| student-profile-readback | compact 只读投影，含真实年级/学科/当前关注及含 displayName 的资料范围。原 all 路由仍使用其原 readback 容器 |
| student-profile-more，新定位 | 展开更多资料与原目录/导出/归档/完整档案入口 |
| student-profile-additional-facts，新定位 | 更多档案操作展开后的阶段目标、家长关注和标签 |
| student-edit / student-ask-xiaozhi | 档案主体下的直接操作，保留原 disabled 与调用 |
| student-open-folder / student-export / student-archive | 工作台先展开更多，standalone all 保持原直接按钮。归档确认和反馈继续原 student-archive-confirmation / cancel / confirm 及生命周期反馈定位 |
| student-record-filters-toggle，新定位 | 学习记录标签下打开原筛选控件，折叠时保留字段挂载与状态 |

root 适配 ui-goal-students-live 时，工作台的 hub-entry-search/intake/students 已分别有上述前置动作。其余学生切换取消、真实 profileForm 保存、同 B 上下文、SQLite、禁止伪造学习事实、主导航/设置菜单 guard、迟到与冷启断言保持原强度。下游领域页继续使用旧导航的唯一可见定位。工作台的初始档案仍有 student-profile-readback，profileFor(name) 可以核对其真实资料范围中的学生称呼。

## 联网设置

PiWebSettings 使用与模型配置相同的 app-owned section/row/rowText/control/save 组合。公开网页权限说明与 Switch 同行，网络解析说明与原 Dropdown 同行，保存位于本组末尾。保留原始资料/学生图片本地、必要脱敏查询、来源标注、自动 DNS 触发条件与系统网络边界说明。

| 原定位 | 位置与语义 |
| --- | --- |
| pi-web-settings | 模型首组之后的“联网资料”独立 section |
| pi-web-enabled | 第一行右侧原 Switch，原 locked/busy/未读取 disabled 与 enabled 状态 |
| pi-web-dns | 第二行右侧原 Dropdown，auto/system/alidns 选项及受控 handler 相同 |
| pi-web-save | 两行下方右对齐“保存联网设置”，原版本化服务保存 |
| pi-web-feedback | 原成功/失败反馈，成功仍说明“下次任务按此设置联网” |

PiModelSettings 只撤掉网络组件的旧包装层，原模型、密钥、思考、目录与账户逻辑保持该文件释放时内容。两份 CSS 仍在 ui-system/student-settings，删除旧网络 DOM 结构选择器，复用本组显式 app-owned 类。官方 Switch/Dropdown/Button 内部及默认外观由其原组件提供。

## 验证、待验与回滚

在仓库根运行如下静态命令。

```powershell
node apps/desktop/test-results/ui-alignment-20261111/student-settings-sol/repair1-static-check.mjs
```

当前 18 项均 PASS、exit 0。覆盖 8 份 TSX 语法、相对 imports/CSS 类，App 核心 handlers 与目录 AST、原生命周期 props/callbacks、原筛选与 timeline body、生命周期 4 个异步 handlers/归档确认/表单、联网状态保存与官方控件原 JSX、模型仅网络包装差异、6 标签/7 路由、显式学生选择逻辑以及 2 份 CSS 的真实 native boundary 文本保留。每个文件的摘要保存在 repair1-static-check.json。

root 统一构建后，Terra 需以同一真实学生比对档案选中态与 reference-student-selected，覆盖六标签、更多操作、原学生路由、记录筛选，以及设置联网两行在 1366×768 / 1920×1080 / 800×768 的可达性与长文案换行。运行时 Focus/Hover、guard/迟到/冷启、样张与正式业务通过状态由该次实际结果给出。

本轮性能测量尚待 root。业务 I/O handlers 与原联网服务保持相同，新增状态仅用于本地标签和信息披露。回滚可对照 repair1-before 仅撤销本组 7 个既有文件的修复差异，移除本轮 3 个新展示组件，再统一构建。其他 writer 的文件按各自所有权保留。

# shell/home/paper 定向修复2

R2沿用现有修复计数。生产源码已冻结，等待根会话统一构建和Terra实际复验。触发证据为Terra after-findings.md、after-paper-two-find-1366x768.png与reference-paper-1366.png。首屏FAIL记录保留。

## 精确写集

本writer累计22份renderer文件，当前SHA见static-check-current.json。相对修复1最终冻结，本轮修改或新增以下14份文件。

- `apps/desktop/src/renderer/ui-system/layout.css`
- `apps/desktop/src/renderer/ui-system/workbench-home.css`
- `apps/desktop/src/renderer/ui-system/workbench-navigation.css`
- `apps/desktop/src/renderer/ui-system/paper-studio/paper-studio.module.css`
- `apps/desktop/src/renderer/components/paper-ui/PaperBasketWorkspace.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperCandidateBrowser.tsx`
- `apps/desktop/src/renderer/ui-system/chat.css`
- `apps/desktop/src/renderer/components/paper-ui/PaperQuestionContent.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperSelect.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperFulfillmentPanel.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperQuestionDisclosure.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperQuestionDetails.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperCandidateCard.tsx`
- `apps/desktop/src/renderer/components/paper-ui/PaperPastePanel.tsx`

检查仅覆盖本writer明确拥有的shell/home/paper清单。资料库、学生/设置及其最小typed App props与根QA改动归各自writer，根负责三份scope合并后的全树核对。

## 本轮清单与实现

- 选题区采用搜索、来源入口、常用筛选三层。来源入口集中在中央题目工作区，顶部独立全宽来源行已退出。
- 原题号、题源、上一页/下一页、完整候选刷新、资料补题、自动组卷与历史进入更多筛选。已保存原题号/题源条件存在时，更多筛选首次展开。常用搜索仍走原query及200ms读取逻辑，搜索按钮只触发同一完整候选读取。
- 中央粘贴/按要求出题/参考卷出题分别复用原PaperPastePanel、PaperFulfillmentPanel和reference.show路径。按要求出题显示原真实需求方案与严格补缺表单。服务请求、严格配额和保留原成员的执行语义沿用现有实现。
- 候选题完整正文、选项和原图读取保留。答案与来源改为官方Disclosure原语组合，原内容、标注来源、版本、谱系与原图查看仍在对应披露中。当前加入分节名称在触发文字中可见，原Select在展开后可操作。题目正文没有截断或行数限制。
- 普通预览/实例回退路径仍使用原Card披露组合。compactDetails仅用于候选题卡。学生版showAnswers=false继续省略答案与解析内容。
- 粘贴面板保留同一挂载位置。独立跟踪open用于中央工具区的滚动和全宽布局，原dirty用于导航/写入守卫。待核实请求、取消、保存后的回执面板均沿原状态机。中央粘贴区保持可操作，其他相关控件通过原disabled及局部inert保护。
- 短历史后目的入口自然接续。wb-scroll使用0 1 auto，长历史仅压缩并滚动历史区域，目的入口保持独立可达，只有设置footer使用margin-top:auto锚底。
- 页头自有strong/span使用Segoe 15px，正常标题weight500。字体声明限定自有文字，保留会话副标题原13px规则。
- 空首页office-composer-container外层width min(100%,792px)、左右padding36px，正常宽度内列720px。900px以下左右24px，360px以下12px。首页建议区使用同一外层列。原外层纵向padding保留，受保护输入、工具栏、弹层的外观与字体采用原实现。

## 回归入口调整

1. 原paper-candidate-scroll仍是实际候选滚动容器，observeCandidateScroll及query/filter/offset/restoreKey依赖保留。继续验证实际滚动、整理往返、筛选重置、冷启与持久偏好。
2. 在找题与选题中，点击paper-basket-advanced里的更多筛选触发器，再访问原paper-basket-question-number、paper-basket-source-kind、paper-basket-prev/next、paper-basket-refresh-candidates、paper-basket-materials、paper-entry-automatic。原业务断言和请求/readback要求保留。
3. 题卡内按paper-basket-answer和paper-basket-source定位官方Disclosure.Trigger，原标题分别为参考答案与解析、题目来源与保存版本。先真实展开再核对原内容。加入分节通过新paper-basket-section-choice展开后操作原加入分节Select。paper-basket-add和paper-instance-replace-candidate的版本/实例/审核和imageReady守卫保留。
4. 中央paper-basket-requirements进入配置并展开原paper-fulfillment-plan。原paper-plan-save/confirm/fulfill及严格缺额断言继续使用。
5. 中央paper-paste-open及后续paper-paste-*保持原testid，核对部分、取消、待核实重试、成功后资料回跳和dirty保护。模型调用和导入事实只能来自原服务。
6. 中央参考卷入口仍为paper-basket-reference。模板页有独立paper-template-reference入口，二者调用同一reference.show并记录各自焦点归还位置。模板Panel仍为同一个挂载实例，参考卷核对时原保存/另存/应用/重试控件保持可达。
7. 我的练习与试卷中的owner/saved、配置中的用途/蓝图、整理/预览及四个原生tab入口沿HANDOFF-repair1.md继续验证。其它阶段需要自动组卷/资料入口时，在配置区访问原testid。

## 本轮验证

- node test-results/ui-alignment-20261111/sol/static-check.mjs，exit0，显式22路径TSX/CSS解析、模块引用、hash与保护路径检查通过。
- node test-results/ui-alignment-20261111/sol/repair2-render-check.mjs，exit0，SSR 12/12。覆盖原七种结构场景与完整候选内容/披露/分节、重复题禁用、失效题源禁用、替换专用动作、学生正文排除答案解析。fixture只在QA进程中提供，不进入生产。
- node test-results/ui-alignment-20261111/sol/repair2-operation-check.mjs，exit0。add与replaceEntry操作参数对象的AST和HEAD原候选实现一致，保留版本及实例修订字段。
- git diff --check限定本writer本轮区域，exit0。
- 补充组件检查验证结构。实际几何、首题完整可见和第二题开头、三尺寸、Hover/Focus、真实滚动恢复、粘贴/参考卷/需求及重启业务链等待根的R2构建和Terra验收。此前246与R1证据保留原构建身份。

本轮没有测得新的运行时性能或包体数字。回滚采用本轮14文件相对static-check-repair1-final.json的限定恢复，保留其他writer源与业务数据。当前仍等待本轮实际复验结果。

Disclosure API核对采用官方文档与官方MCP，复用现有Root/Heading/Trigger/Content/Body/Indicator。应用布局和文字只在自有wrapper/span上定义。[官方Disclosure文档](https://heroui.com/en/docs/react/components/disclosure)

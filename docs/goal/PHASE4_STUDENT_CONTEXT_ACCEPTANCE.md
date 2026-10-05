# DT-02 入口与新版页面基准验收

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

**DT-02-context 保存事实读取限定A/C接受；完整Goal ACTIVE，DT-03 NEXT。** 此前entry记录保留历史。

### 实际交付

教师在新版学生档案“问小智”创建固定绑定的新对话。typed mainFrame服务读取既有student_id，Pi工具仅按该范围读取同一SQLite的必要匿名档案、学习历史/错题/记录成绩。每页10条可筛选分页，明确总量/下一页；版本、取消、学生/会话归档、超长和非法输入均拒绝。实读来源可点击回原新版学生页，原文只在本机显示，当前版本变化要求重读。普通新聊天不继承授权，另一学生必须新会话。无Schema/第二Store/Loop/新依赖；Pi1.0.2唯一循环，DeepTutor f070身份域只参考。

已修实际迟到hydrate竞态、未知确认被错误当false，以及新面板内部class类型/标题对齐。真实成绩仅来自既有记录正文；未创建结构化掌握度或训练策略，未自动修改学生FACT。

### 精确门禁与构建

cwd=apps/desktop，证据根apps/desktop/test-results/goal/phase4-student-context-20261005/。OMNI_EDU_TEST_BUILD_ROOT指向该根final-build6；相关build5回归明确指向final-build。

|命令|实际结果|报告/日志|
|---|---|---|
|npm run build|exit0（含typecheck）|build6.log/.exit|
|npm run test:renderer-components|exit0，133/133|components3.log/.exit|
|npm run test:education-capabilities|exit0，25/25|boundary3.log/.exit；education-boundary-1tYK8r/report.json|
|node scripts/education/golden-teacher-journeys.mjs --scenario=DT-02-context|exit0，9/9，rendererErrors=[]，两次正式Pi启动/真实DeepSeek|journey4.log/.exit；education-journey-8mHAh4/report.json、readback.json|
|同一runner --scenario=DT-02-visual --restore-root=…/education-journey-8mHAh4|exit0，2/2、8图、无模型请求，owned事实副本冷恢复|visual2.log/.exit；education-journey-op57MO/report.json|
|node scripts/xiaozhi-agent/pi-queue-ui-smoke.mjs|exit0，16/16真实DeepSeek/键盘流式编辑/崩溃恢复|queue-ui4.log/.exit；pi-queue-ui-ePfpSD/report.json|
|npm run test:xiaozhi-pi-queue-boundary|exit0，9/9有限native边界|queue-boundary日志；pi-queue-boundary-PDmXxF/report.json|
|node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs（build5）|exit0，30/30真实控制回归|controls.log/.exit；pi-control-ui-7JnkmE/report.json|
|npm run test:smoke（build5）|exit0，ok=true，207/207历史教育兼容|smoke2.log/.exit；legacy-regression-report.json|
|npm start|exit0，日常44784退出→62836默认out|daily-switch.log/.exit、daily-process.json|
|git diff --check|exit0|diff-check.log/.exit|

final-build6与默认out均329文件/SHA 165fb35efc0ffef86ad3e840009b9310dcb0a03ad60e7027791fe74a5a65efee；9功能与8图报告的运行前后指纹一致。build5为72ac498d30e83402b49ea13b1a6a5f619e58962ab4695707a38a1821a4685466，最后仅改renderer引用详情中文/标题/复用标签，18个main与1个preload文件逐字一致。**207/30不冒称在build6重新执行，也不称新版Golden接受。** runner原功能版本归档functional-runner.mjs；最后功能和visual使用同一个扩展后的现行脚本，SHA在报告/closeout中核对。

9实例包括：教师UI真实创建2学生13记录；新固定绑定；实际读取最近错题和第一页外较早83分测验/随机完整编号且已知姓名/学校/联系方式/私密字段不进入native模型消息；正确来源点击；冷恢复无重发；第二学生独立范围；普通聊天no_student；空档案零事实；真实归档禁用和旧来源/main启动拒绝。边界覆盖严格参数、分页/过滤/隔离、已知单字姓名/学校/联系/路径脱敏、来源过期/越权、撤销/取消/变更/超长及旧native前缀兼容。owned合成数据不写日常。

### 图审、失败与未验证边界

最终op57MO的聊天绑定4图、学生引用4图均已实际查看（light/dark ×1366×768/1920×1080）。保留用户指定五空间/分类侧栏/档案目录与详情布局；引用和新入口可达、无横向溢出，新面板中文标签/标题修复生效。CSS视口与Windows1.5倍物理PNG区分。发现深色已归档行对比度偏低、偶发英文公开过程，列Phase3欠项；dark native标题栏静态截图存在裁边而DOMtop=0，不由此宣称原生动画/标题栏人工接受。

首cVvlqD（加载）与iWuE6D（缩写编号）失败保留；yTAVxh为build5修复后9通过，8mHAh4为build6再次9通过。最初smoke在mutable out重建时明确终止/失效，不当正式失败或成功。队列鼠标ntMzRN/eBA2pG/roHfca均13后失败；强制点击没有解决，最终真实键盘开启/保存通过16并保留原生仅修改文本一次、撤回不送、锁定/冷恢复断言。**这不证明鼠标在流式移动期间稳定，不能删除原失败或宣称完整控制UX接受。**

日常PID/out切换只核进程、构建和启动器，不冒称日常DOM/人工。学生结构化评分/掌握度/练习/两周计划、完整Golden F、OpenMAIC/Golden E、飞轮、安装与无VPN仍OPEN。下一DT-03先冻结精确合同，再比较固定DeepTutor Learning/Practice与现有事实和策略，教师确认/拒绝与历史版本须贯通。Master未改、HEAD仍90d67381a08db8ba040211921288b55c87de3f55；无提交/push/真实数据清空/凭据或网络变更。

以下既有记录保留历史范围，当前状态以上述记录为准。


2026-10-05。**DT-02-entry 限定接受，DT-02-context NEXT；DT-02整体未完成。** Master完整目标、学生个性化/Golden F、OpenMAIC/Golden E仍未完成。合同：`PHASE4_STUDENT_CONTEXT_CONTRACT.md`。

## 用户指定新版与旧图原因

新版以用户截图 `codex-clipboard-1cd19f53-5c46-40ef-99d6-7391de621202.png` 为准：五空间图标栏、学生分类、淡色主区域与现有档案布局。**保留该布局**，没有因旧截图另造学生页。

旧图来自隔离的 `legacy-test` 全套教育回归。正式生产由 `ProductSpaceShell` / Pi控制；旧测试图不能充当新版页面证据。本轮统一教育实例runner加实际断言：加载正式main且没有test-runtime、没有旧 `.app-shell`、五空间标签准确，报告标记 `product-five-spaces-v1`。历史回归图不再作为当前页面展示。

另核日常程序仍为较早启动的PID53024。通过 `npm start` 成功构建和版本比较自动重启：旧PID退出，当前唯一日常进程PID44784（2026-10-05 16:17:22），命令加载当前 `out/main/index.js`，没有测试profile参数。启动器exit0，receipt为 `daily-switch-receipt.json`。没有删除、换目录或写入模拟日常数据；实际日常窗口DOM/内容没有自动图审，不将正式隔离图当作日常人工证明。

## 真实故障与修复

先在固定正式Pi构建、owned空库中复现 cuvFCS：首次学生已真实保存且当前学生读取正确，但成功反馈15秒超时。不是模拟接口或名字查错。

原组件在 activeStudent.id 改变时清除反馈，只按 transient busyAction 判断；React可将父层选人和保存完成合并提交，成功提示被清除。修为App保存返回确切保存ID，成功/失败回执绑定学生；选择变化保留同一学生回执，手动换人不携带另一学生提示。无新表、依赖、学生事实迁移、模型或权限变更。

## 最终测试与图审

证据根 `apps/desktop/test-results/goal/phase4-student-entry-20261005/`；命令从apps/desktop运行。

|命令|实际结果|证据|
|---|---|---|
|`npm run build`|exit0，typecheck包含在内|build.log / build.exit|
|`npm run test:renderer-components`|exit0，133/133|components.log / components.exit|
|`node scripts/education/golden-teacher-journeys.mjs --scenario=DT-02-entry`，指定fixed final-build|exit0，7/7，success=true、rendererErrors=[]；两次正式隔离Pi启动|journey-final.log；education-journey-QnY2Kn/report.json|
|`npm run test:smoke`|exit0，ok=true，207项历史教育兼容回归；先前学生提示失败已不再出现|smoke.log / smoke.exit；legacy-regression-report.json|
|`npm start`|exit0，旧日常进程退出，当前单个日常进程加载out|daily-switch.log / daily-switch.exit / daily-switch-receipt.json|
|`git diff --check`|exit0，只有现有CRLF提示|diff-check.log / diff-check.exit|

最终入口实例构建328文件 / SHA `d8fddd991feecd6bd77fe8ffab72caea837f2ede64162b91c76c08e027302a32`，运行前后不变；默认out、全smoke重新构建和日常启动构建核同一SHA。全smoke的旧截图只是历史回归输出，不是新Golden E/F。

七项：正式空库无种子、创建首个学生、创建另一学生并保留保存提示、手动切换清除对方提示、编辑真实档案、空名字真实失败且零新增、冷恢复两档案且无临时提示。无模型请求，不冒充学生上下文已经接Pi。

QnY2Kn最终5图全部实际查看：保存后浅暗1366×768/1920×1080四图、student-invalid.png一图。新版五空间与用户布局一致，保存/失败控件可读可达，页面可滚动。CSS视口与Windows 1.5倍PNG物理分辨率分开记录，不把DPI或滚动位置差异当另一版本。不宣称全页Codex像素/动画/人工接受。C4uruZ首个修复后7通过报告保留，只有其中一图曾查看，不将其全套图冒称接受。

## 下一继续位置

DT-02-context：教师明确选学生后开启绑定的新对话，main从唯一SQLite读取必要的脱敏学习/错题/成绩/历史事实，Pi注册只读能力；强参数、取消/失效、旧会话/空档案/归档、最小隐私与冷恢复先冻结精确合同。然后DT-03策略、DT-04两周训练、DT-05，再MA-01至MA-05。完整顺序见EDUCATION_BRANCH_TODOLIST。

HEAD仍 `90d67381a08db8ba040211921288b55c87de3f55`；未提交/push、新依赖/Schema、供应商/凭据/DNS/proxy/VPN变更。收口脚本首次导入相对路径及CRLF日志提取问题均在读取/归档工具侧修正，不改正式报告或测试结果。

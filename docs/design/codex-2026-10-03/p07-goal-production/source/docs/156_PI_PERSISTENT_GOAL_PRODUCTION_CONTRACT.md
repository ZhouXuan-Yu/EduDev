# P07-E生产持久目标纵向交付合同

日期2026-10-04；M01/M10。前置154/155已证当前Pi1.0.2原BoundaryResult继续与Hana候选限制，完整Codex目标active。本合同先于生产代码。

## 目标与真实缺口

教师在输入区设持续目标及1–8条验收要求；当前会话真实说明/工具/结果持续推进，目标和进度不随单轮结束丢失。能暂停、恢复、结束、审阅结果确认完成。既有update_plan/office-tools/Skills/模型/审批/附件/原Pi唯一loop不替代持久goal；普通聊天不自动激活目标。

## 数据/契约/页面

- 新shared/xiaozhi-goal.ts：schema1，id/session/revision、objective、criteria、active/waiting_teacher/paused/interrupted/review_required/completed/ended，run关系/公开进度/实际工具证据/待验收结果。严格边界不收任意路径或credentials。
- 新main/goal-state.ts增量xiaozhi_pi_goals表，FK到现有会话、版本CAS、目标ID命令幂等、历史保留、单会话一个未结束goal；session-state.init/recover接入。不删除旧表/数据，不改旧native identity；新旧DB与幂等迁移验收。
- main/goal-coordinator.ts复用现有sanitize、current-run、现有权限/审批和原host.start/stop。report_goal_progress只提议继续/验收，宿主收集真实run/call工具事实，不接受模型自行complete；候选文本结果经durable assistant/run保存后供教师审阅，教师逐项验收方可complete。文件/图片读写仍原受控工具，目标不授新权限。
- PiXiaozhiOptions增加main-private goal tools/context/boundary callbacks；现有nativeResources extensionFactories并列turn_end，提交独立goal-checkpoint与custom_message当前目标上下文，原continue确保下一请求；现有before request/compaction/epoch检查不移除。无累积预算/第二循环/renderer timer/fake teacher continue。宿主同run仍持有原session直至review/pause/stop/error；恢复显式新run+同native，不再发送旧附件或批准。
- typed preload与独立IPC goal-mutate，主frame/参数/会话归档/current revision校验。snapshot/event新增optional goal兼容旧renderer/历史，不让用户构造host上下文。
- renderer/PiGoalControl.tsx复用原Pro ChainOfThought/已有OSS Button/Modal/TextArea/Checkbox，正式MCP本轮已核；当前输入前显示同款简短目标条、可展开真实progress/criteria/evidence、暂停恢复/结束/逐条确认。原供应商/Skills/模型/输入队列不混入假控件；Finesse无新callable仍保留原闭包。CSS只适配现有布局，1366/1920控件可达。

## 持续执行与无进展

每次请求从正式goal当前revision/run重核并重建必要脱敏事实。模型必须report_goal_progress；工具正常运行继续，纯文本终止但目标未提交验收时由原boundary补宿主context继续。模型不得把计划步骤/一句完成当目标完成。真实同文本/同next step、无新成功工具连续重复时interrupted并显示需要调整入口；不是tokens/轮数/时间运行预算。教师wait保留原卡，暂停取消wait/工作，恢复需本轮新确认。模型/目录/Skills切换仅沿既有idle门禁，goal不是权限epoch。

pause/end先CAS入终态/暂停再abort；stop把当前active/waiting转interrupted，不覆盖paused/ended。cold recover只active/waiting→interrupted，paused/review/completed保持；启动零请求/零写重放。review_required只有durable结果run可达且本会话原goal候选，教师明确逐项确认；模型报告为候选，不宣称客观验收自动通过。失败保存已发生证据和可见错误，UI只在新revision后更新。

## 验收与回滚

旧DB副本/全新真实Electron SQLite：幂等创建/CAS/跨会话/旧revision/恢复保留/模型不得complete/停止竞态。正式隔离Electron从可见目标按钮开始，真实DeepSeek/原工具/分段/主动继续→验收→教师逐项完成；暂停/恢复/停止/冷重启零自动请求/待确认旧批准不重放，双尺寸截图与SQLite/native/file readback。实际首次失败保留，不用A夹具冒充C用户链。

isolated build、renderer79与当前主207门禁、模块native/C实例、git diff --check。用户33640/标准out/profile不维护。若需回滚可停用goal入口/回到原无goal调用，表只保留未重放事实、旧Pi绑定完整；未知schema拒绝，不静默清库。四根+26/28/35/67收尾及验收157；完整D1–D7/P08/最终八组/日常人工仍独立，不本切片完成即标全goal结束。

# DT-02 学生真实上下文交付合同

2026-10-05。M08/M07/M10，按EDUCATION_BRANCH_TODOLIST从已限定接受DT-01b继续。完整Goal未完成，旧全套smoke学生保存反馈失败未被专项接受覆盖。

## 当前事实和分步目标

SQLite已有students、learning_records、错题/评分/历史领域；typed学生创建/编辑/归档/时间线已存在。生产Pi工具尚无选定学生的真实上下文读取。历史旧harness中的get_student_profile不等于生产Pi已接入。学生界面仍有Phase3体验欠项。

1. **DT-02-entry，先验入口**：在正式Pi构建、owned空数据库中，教师创建学生、保存后的成功/失败反馈、选择切换和冷恢复真实运行。查明上一轮保存提示超时，若确有故障修实际UI状态；不得只删断言。无模型/模拟业务种子，无新表与依赖。该子项不等于DT-02整体完成。
2. **DT-02-context**：冻结严格学生上下文共享契约与选择权限；学生选择只由教师操作，以同一会话/任务有效域持久化，不让模型自行选人或以姓名查整库。main Repository从唯一SQLite读取必要学习事实，脱敏后才交同一Pi工具。空档案、无记录、未知/归档、变更、取消如实反馈；不得自动发送图片/真实姓名/学校/家长隐私/全量附件。
3. **DT-02-accept**：typed选人→Pi真实读取错题/成绩/历史→公开可追踪事实→同一DeepSeek回答→SQLite/冷恢复；姓名/联系信息不上云，无法取得的事实不编造。学生选择切换不会混用既有模型上下文，需显式新会话/重建授权边界。先盘现有库与DeepTutor固定源码，再定字段；不引LearningStore或第二循环。

## 本次入口子项改动与门禁

- 只扩展统一教育实例runner的DT-02-entry场景，必要时修改StudentProfileLifecycle保存回执作用域与App提交返回值；现有控件/布局复用，不新增工作台。
- 正常build/typecheck、renderer组件、专项正式Electron用户路径、真实SQLite回读和冷恢复。涉及UI实际查看浅暗1366×768、1920×1080截图。此前完整smoke失败保留，不把入口专项说成207通过。
- 若需修反馈，消息应关联确切学生ID，异步保存造成的选择变化保留该学生回执，手动切换不得残留另一学生反馈。保护未提交代码，原学生数据/目录与typed创建API不改Schema。撤回代码可回滚，不删除真实事实。
- 后续上下文涉及字段/IPC/marker/表变更前补齐本合同的精确字段、权限与兼容方案；不在尚未核事实前大改。

完成定义：入口子项每项有真实报告/截图/回读与失败记录；之后仍需context/accept才接受DT-02，DT-03/04、OpenMAIC及完整Goal均保持OPEN。

## 用户本轮版本纠偏

用户明确指定 `codex-clipboard-1cd19f53-5c46-40ef-99d6-7391de621202.png` 为新版页面基准：五空间纵向图标栏、学生分类侧栏、淡色主区域及现有学生详情布局。保留该布局，不因历史截图误解而重新设计学生页。

旧截图来自明确隔离的legacy-test回归入口，不能作为新版UI验收。统一教育实例runner必须核真实main、无旧app-shell、五空间标签和原生隐藏窗口，报告标记uiGeneration；历史smoke仅留作旧领域兼容回归，其失败截图不再展示为当前页面。日常从启动小智.cmd/npm start成功构建后加载out，核已运行旧进程版本切换；保持原数据目录与会话，不清库。

## DT-02-context 精确交付合同（实施前冻结）

- 复用 `ai_conversation_sessions.student_id`，不加表。教师在真实学生档案点击“问小智”，typed `createStudentConversation({schemaVersion,studentId})` 由唯一主窗口/mainFrame 校验严格字段和在读学生，再调用现有会话创建。切换学生创建新会话，不修改旧会话绑定。旧无绑定会话仍无绑定。
- `StudentContextRepository` 从同一 SQLite 的 students/learning_records 以参数化单条 SELECT 读取档案和当前页/匹配总数；默认最近10条，可按 type/subject/keyword 与 offset 翻页。上限10条/页、正文每条8000字符、整页64KiB；超限明确失败，不截断后宣称完整。档案、学习历史、错题与教师记录成绩均是既有记录；没有结构化成绩不推测成绩，没有记录不生成虚假事实。
- 新 Pi 只读工具 `education_read_student_context` 不接受姓名、studentId、SQL或路径。绑定由main读取会话事实，tool每次检查会话未归档、学生在读、run有效且未取消。先读事实→本地脱敏→重新核同页fingerprint→交付；期间变化/撤销/取消不交付旧结果。
- 云字段白名单为匿名“当前学生”、年级、科目、阶段目标、当前问题及当页必要记录的类型/科目/标题/正文/摘要/时间。真实姓名、显示名、学校、家长关注、教师私密备注、标签原库、附件/图片/路径不作为独立字段上云；复用现有联系方式与已知学生姓名脱敏，再排除已知学校、单字姓名和本地路径。结果按事实日期与读取时间描述，旧工具结果不是最新事实或教师确认结论。原文指令不授予权限。
- 追加独立 native `xiaozhi.education.student-context.v1` 身份，绑定确切主进程studentId（本地控制字段）及工具版本。不同绑定/缺失能力拒绝加载，不重写 creation/reading/search 等旧marker或原生历史。生产仍只有 Pi 1.0.2 循环；DeepTutor固定f070身份域方案参考，原路径sanitize/default不能用于学生权限，不引其LearningStore/runtime，无新依赖。
- 公共 snapshot 仅本地界面显示绑定学生及可用/已归档状态；模型只收到固定匿名工具说明。工具来源生成严格 `StudentContextSource`（sessionId/recordId?/version），仅实读成功工具可投影。typed `getStudentContextSource` 由main校验会话绑定及当前事实版本，前端点来源在原新版学生页查看确切记录；版本变化提示重读。
- 前端复用已有 HeroUI Button、来源行与学生页，保持用户指定布局。问小智显示当前绑定学生；任意新建普通聊天不继承绑定；切换专属聊天保留各自范围。非目标、空档案、无匹配、归档/变更与启动失败均有反馈。
- 修改范围：新增 shared student-context、main students Repository/conversation service、education provider、renderer学生动作/来源组件；db仅Repository注入；main/preload仅typed接缝；production-host/Pi仅能力接入；App仅导航和来源状态；统一实例/边界runner扩展，不另造agent或smoke。
- 兼容/回滚：现有student_id和记录不迁移/不删；旧会话首次使用新marker允许新增，已带marker若绑定改变拒绝。撤销代码能力前有新marker会话必须保持只读不可送模型，不能删marker冒充兼容。owned验收数据库测试，日常资料不改。
- 门禁：build/typecheck、renderer组件、教育边界专项、正式Electron教师选人→随机独有事实→真实DeepSeek实读→来源点击→冷恢复→另学生隔离/普通聊天无授权→归档/旧版本拒绝；浅暗两种分辨率实际查看。关键用户路径完整smoke，git diff --check。DT-02本切片不等于掌握度/评分/Golden F完整个性化学习或OpenMAIC已完成。

# KB-S3 编码交付合同（2026-10-09，LIMITED_ACCEPTED）

## 2026-10-09 KB-S3限定接受，下一S4（当前读点）

状态LIMITED_ACCEPTED，仅合同中当前source_only/教师预览/快照范围；最终证据见closeout。未覆盖的自然原图/公式/答案和Office保持OPEN。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


当前读点：已验S2-B，下一S3，不宣称整模块完成。唯一真源仍question_bank_items/ai_confirmation_items，本切片无新DDL/依赖/运行时，不改Master。

## 教师结果
教学内容→组卷：编辑纯题库蓝图，10×3+6×5+4×10=100分；确定性去重配额，缺题明确阻止确认；逐题/原图/六项题面及参考答案预览；教师确认/拒绝；同源版本快照重启回读。问小智的同Pi工具使用同服务并等待教师审批。答案仍未独立验证。

## 接缝与文件
shared/paper-blueprint.ts：xiaozhi.paper-blueprint.v1，source_only、整数总分、≤100题、≤20节；每节id/label/questionType/count/points/difficulty?/knowledgePoint?，验证字段/长度/分数总和。PaperCreateInput sessionId/requestId/blueprint/replace?，PaperReviewInput sessionId/id，PaperDecision revision/action，PaperCancelInput sessionId/requestId。所有边界严格校验。
main/education/paper-selection.ts：游标扫描当前subject+grade及source_kind local_bank/teacher_resource，再按节过滤；按S2-B内容key的SHA-256分组，确定性增广匹配解决重叠节/同题多记录元数据差异。没有完整题面/答案/解析、坏document_json或图源过期隔离，绝不自动补题。选满可停止但scanComplete=false；不足须遍历真实尾部。只保留候选身份/节边代表记录，正文仅选中后复读，取消逐批检查。
main/education/paper-repository.ts：action pi_paper_candidate，payload版本化蓝图/选题快照/排除与缺口/requestId/revision=1，result带完整snapshot digest。复用db.ts短facade和BEGIN IMMEDIATE事务。UI run_id为空（真实教师操作无Agent），Pi run_id必须是真实同session run；session可无学生，有学生则必须现存active并原绑定不变。replace只替换同session/pending/同revision旧稿，成功新稿与旧稿拒绝原子提交。重复requestId同payload幂等，冲突拒绝。源questionVersion/原件CAS、cancel、坏payload/result、事务故障均拒绝，不晚写。
main/education/paper-coordinator.ts + paper-api.ts：education:paper-list/create/review/decide/cancel，主窗口fromMain guard→productionHost methods→repository。UI创建真实现AiConversationSession，不虚构学生/run。生产host维持cancel lease，close/会话start/stop不能造成晚提交。preload typed方法list/create/review/decide/cancelPaper。列表仅此本地教师的未归档有效session，读取/确认保持精确session。
Pi tools education_propose_paper/education_read_paper：小蓝图/安全摘要，不上送全部本机题目；参数不接受questionID/path/run/student。保持native identity的新独立paper marker，旧历史可追加、新marker不匹配拒绝。等待教师原生paper_review卡确认，取消/拒绝不重放。压缩恢复读取真实已保存审核状态。
UI PaperBlueprintWorkspace + PaperReviewPanel + PiPaperReview：复用现HeroUI Button/Modal、work-panel/native表单/status-chip/QuestionAnswerEvidence/QuestionOriginalPicture/QuestionSourceLink；App只加导航/组件，Pi surface只加现审核卡。错误/空/加载/取消/缺题/恢复有界面反馈，编辑蓝图立即使当前确认不可用，再生成使用replace原子废止旧稿。旧通用confirmation三查询排除新action。

## 复用审查
现Practice≤8题+student FK不适合整卷，只借事务/审批/来源模式；Pi仅编排，确定性服务不建loop。DeepTutor exam_mimic实码委托AgentCoordinator生成模拟卷，不能拿来替代纯题库配额或并列runtime；Apache-2.0保留，无新复制。OpenMAIC当前内容/课堂生成没有本地题库CAS整卷合同；现源码与LICENSE已读。HeroUI沿已查官方组件和现项目样式，不迁移整页；finesse未安装，无新增依赖。

## 验收和退出
扩展现领域/组件/Golden，不造新的重复runner：100分/分数错/重复题/重叠配额/末尾补足/不合来源/坏文档/缺题、同session重复/跨session拒绝/旧来源和旧revision/编辑废止/取消/事务回滚/损坏拒绝/冷读；正式新版用户创建题库→组卷→预览→确认/拒绝→重启；浅暗1366×768/1920×1080截图查看；build、renderer、domain、smoke、diff-check。真实自然扫描题/答案/Office不冒充本片对照题，导出留S5/S6。所有测试保留build/source SHA、首次失败与回滚点。
回滚：apps/desktop/test-results/goal/kb-paper-20261009/before/保存当前dirty基线；只还原本片并删除新增域文件/入口；审核账本旧新action隔离，禁止删用户原题/原件/配置/上片证据。关闭入口仍保留已保存ledger供恢复，不破坏正式源数据。

# KB-S4-B 同 Pi 关联候选与练习交接合同

日期：2026-10-09。状态：LIMITED_ACCEPTED，限定受控教学筛选与同Pi练习闭环；自然扫描/通用语义与数学正确性仍未验。Master ACTIVE；本合同不修改 Master，不把 S4-A 文字关联当作语义推荐完成。

## 教师可见结果

在已确认错题的学生对话中，小智先读实际学习证据，再查询该条照片事实关联的本地候选；沿同一 Pi 原生工具链读取版本化完整题面，向教师说明选题依据，通过现有 PracticeReview 预览、编辑、批准或拒绝。批准前不新增练习、题库或学生事实。候选不足、答案未经独立核验、源变化和停止必须如实反馈。

## Recherche / Reuse

- KEEP：现 `createLearningProvider` 的会话/学生授权、学习快照 CAS 和脱敏；`MistakeFactsRepository.forRecord` 的照片事实回读；S4-A 本地关联查询；`createQuestionContextProvider` 的真实题目别名与源版本；PracticeReview 的实读来源、教师确认和幂等持久化。
- EXTEND：学习工具只登记**实际交付**的证据别名和记录版本，不授权未交付的整份快照；同一运行内共享题目别名登记表，使关联候选可以进入现 `education_read_question`，仍须实际读取后才可进入练习审核。
- ADAPT：追加独立的教育会话能力身份标记，绑定现学生，不改变历史 question-context 身份；旧会话按新增能力的显式身份接纳，任何跨学生或伪造工具集合拒绝。
- RETIRE：不采用固定 0.9/0.6 分数作相似度；不新建检索真源、AgentLoop、未批准练习写入器或额外模型服务。

## 冻结契约

新 Pi 工具 `education_find_similar_questions` 仅接收本轮实际交付的 `学习证据N` 别名与对应版本；不接收 studentId、recordId、题目 ID 或文件路径。宿主由当前会话反查已绑定学生和证据。只支持已确认且来源仍有效的照片事实。返回脱敏候选摘要、实际关联依据、版本化题目别名和不足提示；不返回学生图片、私有路径或答案正确性承诺。

来源登记在所有脱敏、大小限制、最终 CAS、会话授权和取消检查通过后执行；失败不得留下部分新别名。候选查询不等于实读，只有现 `education_read_question` 的成功 onRead 才进入 observedQuestions。教师练习审核必须再次校验来源。

沿用 SQLite/本地文件，无 DDL，无原数据迁移，无新增依赖。仅新增独立共享契约/领域 provider 和对应小范围适配；不继续堆叠主进程业务。Pi 是唯一编排，关联候选查询是确定性领域函数。语义教学价值另用实际题面与教师审查验证，文字相同不等于数学同类。

## 具体故障修复

S4-A 首次复用照片 facts 场景时，11 项本地流程后 Pi 请求因 `context_limit` 失败；官方模型目录诊断出现 TLS ECONNRESET。先检查目录真实响应、能力 schema、现 SDK 请求和正式应用网络路径。未知能力不得擅自改大窗口；不得清空旧历史、降低授权或隐藏失败来通过。若需要网络策略变化，保持原系统配置，只在既有应用边界处理并记录。

2026-10-09 实际诊断：同一台机器、同一已授权本地测试凭证，Node fetch 的目录 GET 出现 ECONNRESET；Windows curl 和独立隐藏 Electron 的 `net.fetch` 均返回 HTTP 200。官方实际目录给出 `deepseek-flash` / `deepseek-v4-pro`，窗口 1048576、输出上限 393216；当前 db 默认仍为 `deepseek-v4-flash`。证据位于 `test-results/goal/kb-similar-20261009/{catalogue-diagnostic,electron-catalogue-diagnostic}.json`。拟优先复用 Electron 自身网络读取固定官方目录，Node 测试仍用原 fetch；只修正**未显式选择的新配置默认值**，不静默切换任何已绑定模型或改写历史。容量只能来自当次官方目录/合法缓存；上述诊断值不得作为硬编码窗口。

## 门禁 / Acceptance

1. 契约检查：伪造/未交付/旧证据、普通记录而非照片事实、跨会话/学生、归档、取消及源变化拒绝；无部分别名残留。
2. 领域集成：同运行关联候选别名可实读；未实读不能过 PracticeReview；源更新后原版本失效，拒绝/停止无新练习，重复批准幂等。
3. 正式 Electron：真实照片 OCR/校正/事实→学生小智对话→真实 provider 调用查询/实读→教师预览/编辑/确认→冷启动回读；另测拒绝和停止。不用确定性代理冒充真实模型。
4. 质量：原题与推荐题逐一检查条件、图/公式完整性、知识点和参考解答；未独立数学验证明确保留，不报准确率。教学同类质量未过不能标 S4 完成。
5. build/typecheck、相关组件与领域 smoke、必要兼容 smoke、双尺寸浅暗截图、`git diff --check`。每份报告绑定实际 build SHA、命令、首次失败和未验边界。

## 回滚与接续

编辑前保留本片源码副本；恢复适配并关闭新增工具即可回退，不删除已保存的照片、题目、练习、会话或证据。旧身份与 JSONL 不覆盖。

S4 完整收口后进入 S5/S6：复用 Office 宿主交付学生卷/教师答案卷 Word/PDF，并以真实扫描、公式、图和答案联合审查；再做 KB002 三模式/五变式与审核隔离，KB003 后台增量资料整理和 30–40GB 验收。

## 真实收口

KB-S4-B同Pi本地候选→实读→受审练习 LIMITED_ACCEPTED。build ab6835d59e7d7c65e24895eafeaef6915482dc3b60e02a3f8f68c66004b2a037 /340文件；build/typecheck exit0、领域289、组件203/203、模型目录19、SDK fetch边界5、正式新版Electron26项/5启动/20张已查看浅暗双尺寸截图/0 renderer错误、冻结构建兼容207/207。真实DeepSeek读取实际交付照片学习证据，查询10候选、实读原题及所选5题版本，排除两道实际进入Top10的面积干扰；教师修改后只保存1份5题练习及5条使用记录。实际拒绝、停止冷恢复不重放、重复确认幂等及冷读通过，题库/学生事实不新增或改写。Node fetch目录/SDK ECONNRESET通过Pi原生fetch hook接Electron net.fetch修复，固定官方HTTPS/不带cookies/不重定向；容量来自官方目录，不硬编码。证据：apps/desktop/test-results/goal/kb-similar-pi-20261009/closeout.json。

限定为教师自制照片/受控题库与两个教学干扰对照；不是自然数学扫描、复杂图/公式、通用语义准确率或答案正确性证明。answerVerified=false；Word/PDF、hybrid/ai_original、5变式/校验隔离及30–40GB仍OPEN。

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S5/S6：已确认整卷→学生卷/教师答案卷→同Office审批宿主Word/PDF→真实扫描/公式/图/答案联合验收。Done：S2-A/S2-B/S3/S4-A/S4-B限定接受。Doing：知识库与智能组卷完整交付。Next：S5/S6后KB002三模式、5变式和校验隔离，再KB003后台增量、任务优先、30–40GB及安装。Failed：保留各片首次失败，S4-B最终26项通过；自然扫描/导出尚未验。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

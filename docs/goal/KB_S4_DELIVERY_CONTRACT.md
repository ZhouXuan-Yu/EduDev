# KB-S4-A 本地错题关联候选合同

日期：2026-10-09。状态：LIMITED_ACCEPTED，仅本地关联候选；S4完整闭环未验收。Master ACTIVE，Phase4/5 DOING。

## 教师可见结果

真实照片经过现本地OCR、教师校正和事实确认后，在错题页查询本机最多10道同学科同年级的关联原题。逐题说明同知识点/题干文字匹配依据，展示来源、参考答案和未独立验证声明；不足10道如实提示。复用现交给小智的练习审核路径，不自动写题、成绩或练习。

## 当前能力与复用

KEEP：MistakeFactsRepository.forRecord核验照片/校正/记录/题目版本；question_bank_items、questionVersion、questionContentIdentity、readQuestionContextSource；PaperSql现200条游标；typed preload主窗口授权；QuestionOriginalPicture、QuestionAnswerEvidence、现PracticeReview和Pi。

EXTEND：共享mistake-similar.v1输入/结果，确定性本地Top10、取消IPC、错题页可操作结果。先完成本地候选；语义推荐质量与同Pi候选精确交接作为S4-B，不能用关键词排序冒充语义完成。

RETIRE：不将旧searchQuestionBank固定0.9/0.6分值用于相似度或答案可信度。无新依赖、DDL、第二数据源或Agent loop。DeepTutor vendored embedding需额外模型配置，不为本切片强行部署/上云；本地先保证真实可追溯候选。

## 数据与安全合同

输入schemaVersion/studentId/recordId/receiptVersion/requestId严格校验；版本为原确认receipt.digest。所有检索以forRecord当前有效事实为根、当前根题学科年级硬过滤，在LIMIT前执行；排除根题和其同题副本、unsupported/冲突题/来源过期题及缺答案解析题。遍历200条批次，逐批让出事件循环并检查取消；仅保存Top10和同题hash，返回匹配方法/扫描完整性/排除计数，无概率分数。返回前复读根receipt和全部选题版本/原件。全流程只读；不缓存事实、不用生成补足、不上传照片或私有路径。

UI异步epoch隔离、切学生/卸载取消、停止后晚结果不可展示；main jobs最多8，60秒超时，renderer销毁/应用退出取消。同requestId冲突不能取消另一学生的工作。旧数据不迁移，结果重启重新检索并校验，已保存原题/事实不变。

## 门禁与回滚

扩展现领域/renderer/Golden runner：严格输入、硬过滤、去重/根题排除、全库尾部候选、缺答案/坏来源、排序确定性、不足/空、前中后取消、旧receipt/题目/原件拒绝、跨学生拒绝；实际照片OCR→确认→查询→答案/原图→冷读，浅暗双尺寸截图、源故障/恢复。build、renderer、领域专项、必要兼容smoke、diff-check。自然图片识别质量、语义推荐、数学答案正确性与导出不由文字对照替代。

证据与回滚：apps/desktop/test-results/goal/kb-similar-20261009/。仅恢复本片before源码/移除新增入口，保留原照片、题库、receipt、配置及之前S2/S3证据。

## 接续

S4-B同Pi安全别名交接/练习审核和语义质量验证；随后S5/S6 Word/PDF与真实图公式联合验收、KB002三模式/变式、KB00330–40GB。不得将S4-A局部实现标记整模块完成。

## 本切片验收收口

KB-S4-A本地关联候选 LIMITED_ACCEPTED。build 428fbf1a36c6ac12608442ed82a4c8def91734bccf889753daec5e34e3aca31a /340文件；build/typecheck exit0、领域282、组件203/203、正式Electron19项/3启动/0 renderer错误、兼容smoke207/207。12张最终浅暗1366×768/1920×1080截图实际查看。教师自制数学图片→固定本地OCR→教师事实确认→17条真实UI题库对照→本地Top10；原题/副本/错年级/错学科/缺答案排除，空结果、源版本故障与恢复、跨学生/旧receipt拒绝、真实停止无晚结果、冷读一致通过。纯文字题不伪造原图入口。method=local_knowledge_keyword_v1，仅知识点/文字关联，未证明语义或答案正确；不调用模型补题、不改学生事实。证据：apps/desktop/test-results/goal/kb-similar-20261009/closeout.json。

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S4-B：同Pi安全别名交接关联候选→实读版本→教师审核练习；补语义推荐质量，不用关键词分值代替。Next：S4-B后S5/S6学生/教师Word/PDF与真实图公式答案联合验收，再KB002三模式/5变式、KB003增量30–40GB。Done：S2-A/S2-B/S3及S4-A各自限定范围；Doing：S4完整闭环；Failed：首次build Object.hasOwn编译不兼容已修；首次formal11项后AI阅读context_limit，仍未接受S4-B，目录GET另见TLS ECONNRESET；Blocked：无，仍可推进本地能力。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty）。

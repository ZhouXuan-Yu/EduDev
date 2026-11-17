# 选择题答案表示误判修复

## 教师可用结果

已修复普通选择题字母答案与原选项附注的表示误判。新的quality页输入固定printed-choice-answer.v1，原AI批次提供0调用本地复核。真实原界面将3道完整裁块题由ai_needs_review转为ai_final，另4道图文/OCR疑点继续待核。题目字段、原图文档、时间戳及全部原付费行保持，累计715调用、3202条题目记录，新增审计3条。

教师从资料库打开原版PDF，进入“题目与校正”，展开“AI深度整理”，在旧批次点击“复核选项答案（无需模型调用）”。结果状态回到同一题本。AI定稿题在正式组卷阶段仍沿原教师确认流程。

## 实现与保护

选择题表示等价须绑定同题、完整题面、连续唯一原选项与相同选择集合，附注须逐字对应所选原项。旧输入不自动改策略；历史纠正只更新归档状态并持久保存原行及来源摘要，冷读独立重算审计。每次最多20候选，教师编辑/收藏/分类/使用均受保护。回退停用新输入和新动作，保留已写审计reader。

新增共享比较模块 material-ai-choice-answer.ts，接入 blindAnswerIssues、版本化页提示及统一DeepSeek provider。只比较AI推导答案的表示形式，来源答案继续原严格检查。选项解析接受连续A至H标签、相同原项附注和多选集合；重复、缺项、错注、题面变化及角色变化均保留严格处理。

本地复核类 material-ai-choice-rechecks.ts复用planAiPageQuestion、readAiPageReceipt、readPageCrops和原writer事务，SQL预筛未被教师操作、完整裁块且只有answer_conflict的候选。只写archive_json和独立审计，保留原题字段与document_json。来源reader在重新验证原图及题文档后独立重算原/新归档计划，再采用版本化答案比较。新增表及batch索引均为增量幂等DDL，无新依赖。新功能选择每次上限20个旧候选以约束单写事务，其他待核题继续原校正入口。

## 真实资料与证据

既有自动Word目录首页面7题，本轮以保存的两稿/来源稿和原图复核，题号1、2、6改为ai_final，题号3、4、5、7保持待核。保存3条审计，原字段、图文档和时间戳逐字段保持。其余3199条题目归档及所有3202条题目其他字段保持。

原223资料、1319分块、312AI单元、715回执、893Word历史、6恢复审计、2目录授权和223目录资源行摘要保持。两个目录仍paused，SQLite quick_check=ok，应用正常关闭。原资料、原模型内容、数据库及截图保存在本地测试根，Git收录安全元数据和测试日志。

最终运行main SHA be19c42f5e440779208dd42155406df17228edd95aa36c8ff8ffbc84656e447e，构建整树 996b09883120f8c8f99bf0b21884bf4bc238a8fc330f0dc0fd97ca9c1f718d43，469文件。source-manifest.json绑定本轮实现源码。实际原UI点击约373ms，新增模型请求0，原3题在该操作前仅因格式比较留为待核，操作后消除这3个格式冲突。此时间为单次有界资料实测，整库性能对比仍待后续。

## 验证命令

工作目录D:/WorkProject/EduProject-kb-isolation/apps/desktop。

- npm run build 通过，日志choice-answer-build-final.log。
- npm run test:renderer-components 246/246，日志choice-answer-components.log。
- node --experimental-transform-types scripts/education/kb-choice-answer-boundaries.mjs D:/WorkProject/EduProject-kb-run/flow-1gb-20261111 D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/choice-answer-before.db，20/20。新规则、旧版本、错误附注/字母、数学关键字符、教师保护、部分写入回滚、篡改与冷读均通过。使用本地数据库副本并回滚每个用例，provider请求检查使用截获fetch，真实付费请求0。
- node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs，247/247。先前缺少正式题本业务表的最小测试夹具已补齐，保留该次失败。
- node test-results/corpus-flow-1gb/choice-answer-freeze.mjs 绑定完整构建并备份原库，随后choice-answer-live.mjs从原导航点击新动作，验证3定稿/4待核、两尺寸、重启、三份原裁块和SQLite读回。
- node scripts/electron-smoke.mjs，207/207综合legacy用户路径通过，日志choice-answer-legacy-smoke.log。该套使用独立合成资料目录。
- npm audit，low8/moderate13/high8/critical0，共29项既有依赖告警，本轮无依赖变更。
- git diff --check在提交前执行。

首次静态TS导入、缺transform参数、测试把response对象传作question、收藏缺created_at、缺分类数据、请求夹具漏imageCoverage等失败均保留。真实界面本轮首次运行通过，原模型字节没有为这些夹具错误重发。

测试日志与原失败收录logs.zip，逐项SHA见log-entries.json。测试均完成，最终门禁无skipped。既有独立跨页历史失败继续单独记录。

## 仍待完成与回退

完整知识库Goal仍ACTIVE。下一修复带图选择题的原文/选项与裁块映射缺陷，依据已存首稿、来源稿、末稿及原图定位ai_mismatch、incomplete_question和OCR疑点，做通用链路修正。随后继续当前导入资料的后台归档、Word题答关联/联网补答、检索组卷与安装移植，约10GB验收待后续。两目录授权保持paused，应用已关闭。

现有独立跨页suite在056f445基线也出现invalid_response，该历史失败继续OPEN。247页面协议检查与该独立suite分别记录。通用带图/OCR自然质量、已知答案/联网补答、完整检索组卷、安装换机及约10GB均未完成。

设置OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS=0可停用新quality比较与新本地动作，已写审计reader继续认证历史结果。二进制降级须先验证已存新输入与审计兼容性。原本地choice-answer-before.db备份保留，本轮未自动恢复整库。需要撤销单条纠正时可在维护事务认证审计和未编辑状态后恢复其before_json.archive_json，保留审计证据并停止新动作，不能用整库覆盖教师后续工作。

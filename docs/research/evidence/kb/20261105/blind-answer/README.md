# 盲解复核与来源/答案分离：2026-11-05

已修复两项通用问题：最终复核不再携带首稿/纠错稿的AI答案和解析；来源图完整性不再依赖AI解析逐字相同。题干、图义、原资料答案、块归属、OCR、原件版本仍严格核对。两个可读答案不同则标为answer_conflict，保留最终答案、题图及原始回执，排除Pi正式读取和组卷；教师仍可看原件、实际补正再使用。

**自然质量未达标。** 新自然批次6题仅1题满足全部归档条件，另外5题待核；旧光学案例的最终AI解析仍有相反判断。盲解暴露了答案分歧并将该题拦截，不能据此宣称解题正确或整套知识库达标。完整Goal、KB-A01～A10保持OPEN。

基线0a1cf41，专用分支codex/knowledge-base-reuse-implementation。Windows/Node24.12.0；没有新依赖、服务、数据库迁移、IPC、页面或模型轮次。SQLite/文件真源和Pi编排不变。新standard第二遍、quality第三遍默认冻结blind-answer-review.v1；quality第二遍仍作原图纠错，legacy仅显式启用。验证完整本地原响应/哈希/图像绑定后，仅为发送构造来源稿；不修改保存的付费响应。原件印刷的source角色不删除。

修改：shared/material-ai-answer-review.ts及material-ai-page.ts保存策略/严格校验与传输投影；main/assets/material-ai-provider.ts构造盲解请求，避免correctionVerification.originalFirst漏出旧推导；material-ai-page-fragments.ts仅将非source解答排除于来源一致性比较；material-ai-page-publish.ts独立处理答案分歧；material-ai-repository.ts冻结新策略。其余修改为现有测试入口和文档。

| 检查 | 结果和实际边界 |
| --- | --- |
| build / typecheck | exit0；主进程SHA112e990f40081691f72cabbef4c70af2cd78ec6a3e9992c76425ca07bf38fd54，与两项实际桌面路径相同 |
| page-boundaries.log | 120项，包括新增8项；验证两种模式、实际provider请求隐藏AI/保留source、旧模式、伪造/来源变化、保留图稿、冷读取及回滚开关 |
| book-match.log | 30项 |
| book-document-final.log | 原配答30项及结构化书册来源7项 |
| folder-boundaries.log | 目录AI12项 |
| components.log | 246/246 |
| folder-final.log / journey-summary.json | 新递归PDF目录→授权题答配对→独立答案分歧隔离→双尺寸原件→生产Pi与题篮拒绝→勾选不能解禁→真实教师补正→题篮加入→冷启，共7项；5条受控响应、云0、renderer错误0 |
| natural-summary.json / natural-journey.log | 真实教师批次选择自然资料2–3页，原图及必要续题/裁图，6次实际DeepSeek请求均HTTP200，2次盲解；4项集成检查通过，冷启0新调用，原付费输入/首末稿不变；6题1可用5待核，质量失败exit1 |
| shared-electron.log | 最终相同构建207/207，32张本地截图，exit0；所有本轮命令已结束 |

自然失败不是重试依据：保留本地原请求和响应，不重复计费刷过。原始资料、截图、AI解答正文、DB、profile和密钥均不入Git；本目录只有脱敏状态、响应哈希和本地截图大小/哈希。受控样例不是自然准确率或教师验收；六题也不代表120题留出集。旧协议缺省继续原行为，不追溯改变旧9题档案。

首次桌面脚本把正确的提前隔离当成异常review，又把已有答案册的held原因限定为“保留两份”；已按independentAnswerConflict分支识别，但不放宽生产门禁。首次5条受控响应、续查0、最终新夹具5条，桌面本轮合计10条受控响应/0云；只有最后新夹具7项计为最终验收。原失败日志保留，不能称首次通过。首次类型检查漏导入、命令缺transform/预加载、错误脚本名、测试把第二条AI角色当印刷角色，以及自然账户位置不对，均在失败记录中列明；这些预检失败没有额外云请求。

性能：main4,049,094→4,052,558字节（+3,464），preload38,520、renderer入口7,758,791不变。benchmark.log为32题一组、1000组热比较，旧/新每题P95=0.0185656/0.0190219ms；仅增加来源比较投影，不能视为提速，也不包含I/O、源认证、OCR、模型、IPC、检索或40GiB压力。没有新增模型轮次，但盲解可能改变输出token，未验自然耗时P95或成本预算。audit既有42（8高26中8低0严重），依赖和锁文件未变。

命令在apps/desktop执行，日志由cmd重定向保留原字节：

```powershell
npx tsc --noEmit
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-match-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --answer-conflict --blind-answers
node --experimental-transform-types scripts/education/kb-blind-answer-benchmark.mjs
# 自然批次：已授权专用Temp目录；脚本核验同根/哈希及受限范围。
$root='C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-aWObCn'
$inspection=$root+'\whole-exam-aHo7lv'
$account='C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-NGRlNr'
$env:OMNI_EDU_AI_BLIND_ANSWERS='1'
$env:OMNI_EDU_AI_CONTINUATION_TEXT='1'
$env:OMNI_EDU_AI_CROP_BODY_TEXT='1'
node scripts/education/kb-cross-page-real.mjs $root $inspection $account
node scripts/electron-smoke.mjs
npm audit --json
git diff --check
```

精确本机路径、批次号和状态在两个summary；不得把账户/资料目录上传。自然脚本成功完成集成且明确质量失败，进程退出1；并非传输重试或整库PASS。普通教师来源预览允许待核题，生产Pi正式provider和题篮资格另行限制。

下一主线：修复自然资料的题面/图义/投影不稳定和答案语义，接通能绑定原件的已知答案/已核实网络来源，适用时复用现有SymPy等科学工具；同模型盲解或形式化计算都不能证明建模条件正确。继续120自然留出、真实搜题正反例、200查询、三套正式蓝图成品、40GiB/72h及普通Windows安装换机。不得逐题手改验收书、靠增加同模型轮次或放宽OCR/图义门禁刷通过。

回滚：OMNI_EDU_AI_BLIND_ANSWERS=0停止新输入生成；原冻结策略读器/冲突issue/图稿/付费回执保留，不重解释历史，不批量清除疑点。既有教师补正路径可恢复资格。本片无数据迁移；旧二进制直接降级未演练。

Git收尾在完成记录后执行：刷新origin/main，整合最新主线，非强制推送HEAD:main及专用分支，工具核对远端SHA；不动其他工作树。

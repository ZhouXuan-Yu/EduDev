# 质量任务推理预算试验：2026-11-05

**自然质量失败，撤回默认启用。** 发现知识库 provider 将全部模式固定为 `reasoning_effort=none / max_tokens=8192`。复用项目现有 `applyThinkingPayload` 接入冻结、有界的高推理策略后，同一诊断样本实际调用6次：6题全部待核，光学题仍给出错误判断，未证明自然准确率提升。该策略最终只在显式设置 `OMNI_EDU_AI_REASONING_HIGH=1` 时为新quality/legacy单元生成；默认质量任务保持历史预算。standard、答案册及历史输入不改。

基线13e6725，分支codex/knowledge-base-reuse-implementation。新增 `deepseek-high.v1` 输入策略与严格组合校验；三遍统一thinking.enabled/high、32768总输出token上限、1MiB传输上限、5分钟请求时限；最终JSON仍限制128KiB。reasoning_content不成为题库正文、原角色回执或下轮上下文。无新依赖、服务、表、IPC、页面、模型或轮次，上传仍仅为本批授权原页及必要续题/裁图。

官方参数实查：[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) 与 [Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion/)。none关闭思考；启用思考时使用受支持的high和输出预算，移除不生效的temperature。接入可用不等于教育内容正确。

| 检查 | 结果和边界 |
| --- | --- |
| typecheck-final.log / build-final.log | exit0；最终main SHA f3857e3bc6f17281f70a1df8dc96567a7f0069003c907083616faf312145936c |
| page-boundaries-final.log | 128项：原120及新增8项；冻结/未知策略、三遍实际参数、盲解、历史预算、长思考包、截断/超限/取消、来源绑定、默认不启用、恢复/停止开关 |
| components.log | 246/246；renderer没有修改 |
| folder-journey.log | 试验构建实际递归PDF题答流程7项，题页三遍high，5条受控响应、云0 |
| folder-final-default.log / journey-summary.json | 最终构建默认预算：实际递归目录授权、配答/冲突、双尺寸原图、Pi/题篮拒绝、勾选不能清除、实际教师补正、入篮与冷启7项，5条受控响应、云0、renderer错误0 |
| natural-journey.log / natural-summary.json | 新自然两页批次6次HTTP200、均high；4项集成检查及双尺寸/冷启通过；6题0可用6待核，质量FAIL、exit1 |
| natural-final-readback.log | 最终构建零云读取上述冻结高推理批次，3项集成检查通过，质量仍FAIL、exit1；旧付费请求不重放 |
| historical-continuity.json | 直接对照3份先前保留报告：6个付费单元input/first/final与18道规范题全部字段一致，算法及前后哈希列明 |
| shared-electron-final.log | 最终相同构建207/207、32张本地截图、exit0；首次试验构建shared-electron.log亦207/207，两条命令均已结束 |

自然问题诊断：高预算仍出现磁场/杠杆图读法变化、光学判断错误；同一选项只因附加原选项说明或括号形式变化被标answer_conflict，选项字母与中文间的空格变化又使来源一致性失败。严格拦截避免了将不稳定内容投入组卷，但可用率不达需求。当前没有放宽题面/OCR/图义或用模糊答案比较解禁；也没有逐题改原件、提示词或重复付费刷过。自然解答、截图、原图、DB、profile和密钥仅保留于受限本地目录，不入Git。

真实代价：六次高推理响应体合计耗时592.666秒，单次50.502–145.073秒，不含本地OCR/队列/界面；94127 reasoning tokens、114371 completion tokens、200442 total tokens。上一相同样本非思考批次completion18879、total103670，约6.06倍输出token、1.93倍总token。旧脚本没有完整响应体计时，不能据此计算耗时倍率或P95；未测货币费用，token不等于账单。main 4052558→4053966字节（+1408），preload38520、renderer入口7758791不变。audit既有42（8高26中8低0严重），锁文件和依赖未改。

命令在apps/desktop执行：

```powershell
npx tsc --noEmit
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
# 试验目录路径设置OMNI_EDU_AI_REASONING_HIGH=1；最终默认路径移除此变量。
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --answer-conflict --blind-answers
$root='C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-aWObCn'
$inspection=$root+'\whole-exam-aHo7lv'
$account='C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-NGRlNr'
$env:OMNI_EDU_AI_REASONING_HIGH='1'
$env:OMNI_EDU_AI_BLIND_ANSWERS='1'
$env:OMNI_EDU_AI_CONTINUATION_TEXT='1'
$env:OMNI_EDU_AI_CROP_BODY_TEXT='1'
node scripts/education/kb-cross-page-real.mjs $root $inspection $account
# 下行是已保留批次零云读取，不能再次执行上行当作重试。
node scripts/education/kb-cross-page-real.mjs $root $inspection $account ($root+'\high-inference-real-WYjELl')
node scripts/electron-smoke.mjs
npm audit --json
git diff --check
```

首次试验门禁127项通过；收窄为显式开关并增加默认预算检查后128项通过。两套目录夹具合计10条受控响应/0云，本轮自然合计6次实际云请求，最终冷读新增0。自然脚本的exit1是明确质量失败，集成成功不能覆盖它。取证脚本曾猜测历史指纹字段而未复现原未标算法快照，最终改为对照原报告原文/全部题字段并保存可复算算法；historical-before.json仅为原始快照，不作为该验证的通过证据。少量诊断命令读取不存在的文档/输出文件未改变业务数据，不能据其输出推断功能状态。

下一主线：先用保留自然响应零云复现，修复可机械证明等价的版式/同原件选项表达误判，不能模糊匹配答案；复用现有完整题文档与答案角色writer，把已核来源与独立求解结果绑定，减少求解轮重新改写题面/图义。局部OCR已确认使用原版RapidOCR小模型；质量复查应优先评估同一成熟引擎的高精度模型/本地对照，不拿AI猜字覆盖原件。继续已知答案/认证网源、自然留出120、200查询、三套蓝图、40GiB/72h、普通Windows安装换机。完整Goal、KB-A01～A10仍OPEN。

回滚：默认没有启用高推理；移除开关或设0停止新策略。已冻结单元继续其原预算及有界读器，不重解释历史、不删除回执或教师修改。本片无迁移；旧二进制直接降级未演练。Git收尾刷新main后正常推送并核对远端，不改其他工作树。

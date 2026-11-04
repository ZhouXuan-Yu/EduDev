# 原题选项锚定与版式一致性：2026-11-05

基线700016e；分支codex/knowledge-base-reuse-implementation。本轮交付是严格、版本化的原题选项表达比较，不能据此关闭完整知识库Goal或KB-A01～A10。

新standard/quality单元在现有盲解、完整来源裁图及整题正文OCR合同下冻结`choiceReviewPolicy=choice-concordance.v1`。复用原页转写、来源比较、盲解冲突判断、规范题writer与冷读器，仅将完整“选填/选涂”引号组内字母旁空格视作版式；每个连续编号小问的所有空位均有唯一紧邻原选项组时，字母与“字母+准确选项原文注释”可比较为相同。答案槽序、数量和印刷选项文字必须完整一致；字母变化、指向另一选项的注释、来源正文/数字/单位/正负/否定/指数/图表变化仍隔离。不支持的语法退回旧严格比较，不能猜测等价。印刷source答案、原始响应与教师编辑均不改写。

没有新表、迁移、IPC、页面、依赖、服务或模型轮次；SQLite/本地文件事实来源、Pi、上传授权及正式组卷教师确认不变。高推理仍默认关闭。共享工具`questionNumberPrefix`仅提取已有的已知父题号版式规则，不新增自由数字前缀删除。

| 检查 | 最终结果与边界 |
| --- | --- |
| typecheck-final.log / build-final.log | exit0；main SHA117afa76b9fd4f29cb69034df605900a2dc103c0526db0cffb8d77c061e1947d |
| page-boundaries.log | 141/141，原128+新13；含标准/质量实际归档、冷验证、旧输入/停用、严格策略组合、正反语法和角色保护 |
| body-boundaries.log | 21/21；整题OCR/来源门禁未放宽 |
| book-document.log | 配答30及结构化书册来源7项通过 |
| components.log | 246/246；renderer未改 |
| folder-journey.log / folder-summary.json | 实际递归PDF题答→盲解冲突→双尺寸原图→生产Pi/题篮拒绝→勾选不能解禁→实际教师补正→入篮/冷启7项；受控5响应、云0、高推理0、renderer错误0 |
| natural-replay.log / natural-high-summary.json | 保留high响应认证后原样回放6次、云0；期待题7可用的断言FAIL、exit1，6题0可用6待核；原始数据未变 |
| caption-diagnostic.json | 题7的选项答案误冲突已消除，转写/整题正文/投影比较通过；原页及裁图OCR把“图4”均读成“图”，完整来源归并仍失败，保留待核 |
| natural-none-replay.log / natural-none-summary.json | 另一份已保留none响应原样认证回放6次，双尺寸原图/来源及冷启3项通过；6题1可用5待核，题7有6张来源图；光学等真实分歧仍隔离。该旧none批次原本已有1可用，不能声称自然可用率提升 |
| historical-continuity.json / source-continuity.json | 4个旧批次8单元input/first/final、24题全部字段、复核/crop收据及provider设置前后SHA完全一致；原PDF内容SHA未变 |
| shared-electron.log / shared-summary.json | 最终相同构建207/207，32张本地截图，exit0；全部验证进程已结束 |
| audit.json | exit1，既有42：8高/26中/8低/0严重；依赖和锁文件未改 |

自然high失败没有用另一批次成功覆盖：高响应题7的字母与注释等价已可证明，但还缺数字图注的本地来源证据。删除图注或忽略来源差异会降低质量门槛，本轮没有这样处理。下一主线优先复用成熟OCR引擎的高精度本地复查，对细小图注、数字/单位/否定和公式保留双路证据及分歧；再将已核来源与独立求解、已知答案或认证网源绑定。完整题面、图义和自然正确率仍未达标。

本轮Electron流程共17条受控响应（失败high6、none6、目录5），新增真实云调用0。保留响应必须逐条等于原付费SQLite收据，再由生产教师入口创建新冻结任务；回放不是新模型测试或自然留出评估。原图、自然题文/答案/思考过程、原始HTTP正文、SQLite、profile和密钥不入Git；摘要只保存状态、哈希及本地截图清单。

性能：主进程4053966→4061748字节（+7782）；preload38520、renderer入口7758791不变。16题/组、500组合成热比较，组耗时除以16后旧P95=0.041475ms、新P95=0.199700ms，中位0.031525→0.167506ms。测试重复执行整页比较，测的是纯热函数开销；不含来源认证、OCR、provider、SQLite、IPC、冷启动、检索，不是个人题目延迟，更不能当40GiB/P95验收。

精确命令，在apps/desktop中运行（输出见同名证据）：

```powershell
npx tsc --noEmit
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-crop-body-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --answer-conflict --blind-answers
$env:OMNI_EDU_AI_CHOICE_CONCORDANCE='1'
$env:OMNI_EDU_AI_BLIND_ANSWERS='1'
$root='C:\Users\ZhouXuan\AppData\Local\Temp\omni-real-material-aWObCn'
$inspection=$root+'\whole-exam-aHo7lv'
$env:OMNI_EDU_AI_REASONING_HIGH='1'
node --experimental-transform-types scripts/education/kb-crop-body-journey.mjs $root $inspection ($root+'\high-inference-real-WYjELl')
# 上述真实来源回放FAIL，保留现场；下面是另一份原有完整none响应的兼容验证。
Remove-Item Env:OMNI_EDU_AI_REASONING_HIGH -ErrorAction SilentlyContinue
node --experimental-transform-types scripts/education/kb-crop-body-journey.mjs $root $inspection ($root+'\continuation-text-real-cNaEeM')
node --experimental-transform-types scripts/education/kb-choice-benchmark.mjs
node scripts/electron-smoke.mjs
npm audit --json
git diff --check
```

历史SHA算法：SHA256(UTF8(JSON.stringify(value, recursively key-sorted objects)))。4批次ID及前后摘要在historical-continuity.json；SQL投影分别为material_ai_units的ordinal,input_json,first_json,final_json按ordinal；question_bank_items全部字段关联material_ai_members按q.id；material_ai_page_verifications全部字段按ordinal；material_ai_page_crops全部字段按ordinal,number；app_settings中xiaozhi.provider.v1原value_json同算法单值摘要。结束后均与实施前快照deepEqual。

保留的初始失败：页测试父题号未剥离导致等价答案误冲突，复用既有精确父题号规则修复；新增数值注释测试有括号语法错误，修正测试文件；热测静态TS导入早于运行时预加载导致模块解析失败，改为预加载后动态导入。page-first-failure.log、page-syntax-failure.log、benchmark-first-failure.log保留。自然high来源FAIL是产品质量缺口，未重写夹具或放宽断言。

回滚：`OMNI_EDU_AI_CHOICE_CONCORDANCE=0`停止新标准/质量策略；legacy仅显式1生成。必须保留已冻结策略读器，不删除旧收据/教师题目或用整版旧二进制降级；旧二进制降级未验。全部自然留出120、独立200查询、三套正式蓝图、40GiB/72h及普通Windows链式安装/换机仍OPEN。Git收尾刷新main、正常推送并核对远端，不改其他工作树。

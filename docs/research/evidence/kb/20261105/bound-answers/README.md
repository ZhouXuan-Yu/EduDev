# 已核来源绑定独立答案：2026-11-05

基线07833f4；分支codex/knowledge-base-reuse-implementation。本轮是M02/M03/M05的来源与求解分离切片。完整知识库Goal及KB-A01～A10仍OPEN。

新quality页任务冻结`answerBindingPolicy=source-bound-answers.v1`，复用现有本地OCR、整题/图义门禁、三遍预算、DeepSeek provider、题本、Pi、教师编辑及组卷资格。首两遍的完整来源、题号/顺序/选块/投影/分类必须一致且无疑点，第三遍才只返回绑定sourceSha256的答案/解析/issues；题面变化或未闭合继续原完整纠错复核。印刷source答案与解析保持原文，候选冲突隔离；严格答案协议不能改题干/图义、伪造来源或教师权威。原图/OCR疑点仍可使派生题待核，绑定不代表来源或数学已验证。

原始答案响应单独保存于新增`material_ai_bound_answers`，与原规范题发布同一SQLite事务写入；原首稿/复核稿、旧输入/旧final及教师记录不改。冷读重新解析原答案、重建完整final并比对source/final SHA与全部final原文，缺失/篡改不能用于Pi或组卷。新表幂等CREATE IF NOT EXISTS，已有旧表库及新库有检查；备份入口仍为整库SQLite snapshot，新表无本地路径/新媒体，真正换机恢复本轮未验。原raw答案最大128KiB，增加本地收据占用；图片仍为本地文件引用。无新依赖、模型包、IPC、页面、服务或模型轮次。

| 检查 | 结果及边界 |
| --- | --- |
| build.log / build-and-payload.json | build含tsc，exit0；main SHA34a5bffd2b28b59020fc4d026a0753480f1441c2a25ce2f0c6f3bbe5ce82f484 |
| page-boundaries.log | 154/154，原141+13；同源/变化回退、严格协议/假权威、印刷角色、原始收据、篡改冷读、新默认/旧输入/停止恢复、隐私、暂停及原子回滚 |
| body-boundaries.log | 21/21，整题本地OCR门禁不变 |
| book-document.log | 原配答30及完整题书册来源7通过 |
| book-answers.log | 独立配答18项通过，与上项有重复，不累加为不同能力 |
| components.log | 246/246，renderer没有修改 |
| folder-bound.log / folder-controlled-summary.json | 实际三层目录PDF题答、盲解冲突、双尺寸原图、Pi/题篮拒绝、教师实际补正、入篮/冷启及新raw收据8项；5条受控响应/云0 |
| folder-bound-real.log / folder-bound-real-resume.log / folder-real-summary.json | 新导入只将最终bound请求发给真实DeepSeek，HTTP200、答案100；首两稿与答案册共4条受控响应。初次被旧夹具硬编码90℃断言打断；保存原失败后只冷启续测，0新增调用，最终8项通过。真实模型总计1次；不是自然书库质量证据 |
| historical-continuity.json | 对比上轮封存：4旧批次8单元原input/first/final、24题全字段、复核/crop收据及provider原值摘要一致；按resource.local_path核对同一原PDF，SHA仍edc42e345797f89f99958228db677c0030229fdcaaa43f5d6a7faa33bb8042d7 |
| electron-smoke.log | 最终相同构建207/207通过，exit0；所有本轮验证进程已结束，截图目录见shared-summary.json |
| audit.json | exit1，当前既有28：8高/12中/8低/0严重；依赖/锁文件不改。上轮42是历史审计数据库快照，不能将下降归因于本轮修复 |

本轮总计9条受控响应、1次真实DeepSeek请求。真实样本是本脚本生成的清晰沸点题，最终答案协议经过实际云端兼容性检查，不能替代120道自然留出、科学推理或题库准确率验收。HTTP首部延迟326.73ms不含模型完整响应时间；不以该数字报告最终求解速度。完整原始响应保存在隔离测试数据，Git只保存本受控题面及状态/哈希；自然原图、整库、profile、密钥与思考内容不提交。

本地成熟OCR评估：使用锁定RapidOCR3.9.2/ORT1.30.0，10个保留自然细图注分别运行small/medium、检测+识别/仅识别共40次；medium_rec固定SHAeef444829dbbe18d7fea59a3f6eb75647518d2b3a9568d27c92e42940204894b、76,629,984B仅保存在忽略的诊断目录。受损数字在两个模型、2400/4800/7200原生页边长下均未恢复；高置信度一致仍可能漏字。其他图注基本相同，另有空格/置信度退化；本地热识别small约0.015～0.021秒、medium约0.63～0.81秒，仅小样本诊断。**拒绝默认升级/交付medium**，不增加安装体积，不删除图注/放宽门禁，不继续追着这页重复识别；medium专属许可及Windows安装/大库资格尚未完成。见ocr-comparison.json，原图/全文仅本地。

官方核对：[RapidOCR模型目录v3.9.2](https://raw.githubusercontent.com/RapidAI/RapidOCR/v3.9.2/python/rapidocr/default_models.yaml)、[用法说明](https://rapidai.github.io/RapidOCRDocs/main/install_usage/rapidocr/usage/)、[模型许可证说明](https://rapidai.github.io/RapidOCRDocs/main/model_licenses/)。目录有medium不能证明适合默认交付，决定来自本地对照，非官方质量保证。

体积/代价：main4061748→4070295字节（+8547），preload38520和renderer入口7758791不变。受控新raw答案276B/派生整页1085B，真实新raw318B/派生整页1127B；只是本次返回JSON与本地收据字节对照，不是总token、费用或吞吐收益。调用轮次不变；SHA与组合校验增加本地开销，未测端到端/大库P95，不宣称性能达标。

精确最终命令，cwd为apps/desktop：

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-crop-body-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-answer-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --answer-conflict --bound-answers
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --answer-conflict --bound-answers "--bound-real=$env:TEMP\omni-real-material-NGRlNr"
# 上条保留响应后因夹具断言FAIL，修正断言；下面只读取同一现存原始收据，冷启禁网。
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs "--resume=$env:TEMP\omni-folder-books-tvFlsa" --answer-conflict --bound-answers
node scripts/electron-smoke.mjs
npm audit --json
git diff --check
```

OCR对照的本地脚本/精确参数：`.local-ocr/layout-build-env/Scripts/python.exe $env:TEMP/kb-ocr-quality-probe.py`与`kb-ocr-resolution-probe.py`；前者参数及模型固定SHA、后者同原页同归一化box见本地脚本，脱敏结果和原报告SHA见ocr-comparison.json。下载脚本kb-ocr-model-download.py仅存忽略目录、校验SHA/有界大小，不是安装器交付。

保留的失败与复盘：page-boundaries-first-failure.log中测试误把目录mode加到严格单页输入，改为真实folder处理设置；book-document-preload-failure.log中静态TS依赖缺少预加载，改正确命令；folder-bound-real.log硬编码受控90℃已改为真实求解100的明确校验，复用原结果续测。历史原件初次把另一份主书与自然试卷hash作比较，现由resource.local_path定位相同原件后比对。未改生产质量门禁来适配这些错误。

回滚：`OMNI_EDU_AI_BOUND_ANSWERS=0`停止新quality策略；legacy仅显式1，standard/答案册/历史输入语义不变。必须保留冻结读器与raw表，不删收据或回写旧题；旧二进制降级未验。完整Goal及120自然留出、200查询、三套正式蓝图、40GiB/72h、普通Windows链式安装及换机恢复仍OPEN。下一优先将自然题面与已知答案/认证网源及现有科学工具的适用性校验贯通；不要再以清晰受控沸点题代替自然质量，或逐页手修验收书。

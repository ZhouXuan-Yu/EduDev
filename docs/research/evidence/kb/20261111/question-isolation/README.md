# 单题模型格式隔离交付记录

日期为2026-11-11。完整知识库Goal保持ACTIVE，KB-A01～A10保持OPEN。

## 交付范围

旧v4中，一道题的裁图index或答案字段错误会使整页literal响应拒绝。本轮新增冻结协议host-crop-body-isolated.v5 / xiaozhi.material-ai-literal.v5。先认证页根、题数、题序、唯一题号和宿主裁图/OCR身份，再逐题使用现有派生器及canonical parser。局部错误沿首稿形成待核占位，答案解析缺失、来源读数为空且uncertain，保留旧合法疑点与原始provider回执。合格题继续原归档门禁。

题量、身份和页根错误继续整页拒绝。新quality任务默认v5，legacy显式1采用，standard沿原协议。已有v1～v4按保存版本解释。复用现有executor、回执、writer、typed IPC、题本和Pi/题篮门禁，无DDL、运行时依赖、附属服务或额外模型轮次。

代码涉及material-ai-literal、material-ai-isolated-literal、material-ai-page和material-ai-repository，专项脚本覆盖格式边界与递归目录用户路径。实施前合同见docs/goal/KB_IMPLEMENTATION_CONTRACT.md的2026-11-11条目。

## 执行环境与保留失败

基线为87a7f9db406346be648b58288b8dfaa4e547b87c。恢复暂停前自有修改后，共享D盘工作树出现另一项UI开发的源码修改。组件运行碰到尚未创建的CSS，且npm test:smoke内部构建与早期Electron旅程发生时序重叠。早期旅程在首窗口前检查模块时出现promise garbage collected。保留failed-shared-components.log、failed-early-source.log、failed-early-final.log和stopped-shared-smoke.log，这些运行均无通过结论。

自有修改转至独立工作树D:/WorkProject/EduProject-kb-isolation，分支codex/kb-isolation-delivery-20261111，原D盘main及协作者UI/课件文档改动保留。执行npm ci --prefer-offline --no-audit独立安装锁定依赖。复制开发机现有file-v3和blocks-v1受管OCR运行包到独立根，由原生产manifest再次校验。验收脚本先等待首窗口，再执行原profile及已加载模块隔离检查。构建完成后才启动专项旅程。

所有以下命令从该工作树apps/desktop执行。SQLite、profile、合成PNG与截图均在独立TEMP目录。provider为受控格式故障，真实云调用为0。现有启动前网络隔离先于main导入，正式Pi模式拒绝加载历史test-runtime。

## 验证结果

| 命令 | 终态与证据 |
| --- | --- |
| `node --experimental-transform-types scripts/education/kb-question-isolation-boundaries.mjs` | PASS，32组，exit0，boundaries.log。包括15类局部损坏、身份/题号/预算整页拒绝、旧疑点保留及模式/版本边界。 |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | PASS，245组，exit0，legacy.log。 |
| `npm run test:renderer-components` | PASS，246/246，exit0，components.log。 |
| `npm run test:smoke` | PASS，含build/typecheck，Electron 207/207，exit0，smoke.log及smoke-report.json。 |
| `node scripts/education/kb-source-content-journey.mjs --isolate-source` | PASS，6组，exit0，source.log及source-report.json。 |
| `node scripts/education/kb-source-content-journey.mjs --isolate-final` | PASS，6组，exit0，final.log及final-report.json。 |
| `node scripts/education/kb-source-content-journey.mjs "%TEMP%/omni-source-content-ui-9PMaWe" --isolate-final --disable-new-isolation` | PASS，5组，exit0，disabled-cold.log及disabled-cold-report.json。 |
| `node --check scripts/education/kb-source-content-journey.mjs` | PASS，末次仅调整新代码排版后语法检查。 |
| `npm audit --json` | exit1，存量28项，其中8 high、12 moderate、8 low、0 critical，audit.json。本轮依赖和锁文件无变更。 |

两个新导入批次均在正式资料导航选择含子目录的合成PNG目录，执行真实本地OCR/版面，再经原三阶段executor得到三份受控provider回执。正确兄弟题形成ai_final完整题文，坏题保留ai_needs_review且缺完整题文。实际题本允许教师检查坏题，生产Pi读题及题篮拒绝坏题，正确兄弟题可读。1366×768和1920×1080以及冷启通过，renderer错误0，真实云调用0。每批三次受控请求，重启及停新策略冷读新增请求0。原坏index=7及每份原响应SHA均保留。

这批合成题及受控provider专用于验证格式故障、持久化和门禁。自然提取、复杂数学和独立教师操作验收尚未完成。

## 性能与质量边界

归档同页一题错误、一题合格的受控输入，v4整页拒绝可在专项边界中重现，v5允许合格题继续，坏题待核。隔离增加有界的逐题canonical校验和JSON投影，原128KiB响应预算继续生效。逐题吞吐、大库P95及内存峰值尚未测量。

同构建main为4,347,071B，相比2026-11-09原图预览报告的4,343,204B增加3,867B。preload为40,997B、renderer主chunk为7,933,838B，与该报告字节数相同。此对比采用历史报告基线，构建摘要见build-before.json。两次受控故障批及停用新策略冷读均使用main SHA 27dbef46e0ecf4e7481fb3102e86e40600f0fd93d5e9a712cb6c98f8b0193d25。

最终所有验证命令已结束。共享Electron和专项旅程前后的main入口、preload入口及renderer主chunk摘要一致，见build-after.json。仓库及暂存区git diff --check通过。源码与依赖保持本轮冻结范围，验收脚本末次可读性调整已重跑32组边界及语法检查。

日志按原始字节保存，目录内.gitattributes仅将这些验收log声明为原样二进制证据，保留构建工具自带的行尾空白。

独立自然逐字/数学质量、120题留出、200检索查询、三套正式蓝图、真实10→40GiB/72h、干净Windows安装与异机迁移仍待完成。本轮未重发自然PDF，已有自然12题的8可用/4待核及整体质量FAIL沿用先前报告。

## 回滚

设置OMNI_EDU_AI_QUESTION_ISOLATION=0停止新v5策略，保存的v5由保留的新reader继续读取。无需数据回写。旧二进制直接降级尚未验证，应保留当前二进制与数据备份。修复或再次处理待核题继续走既有显式授权和教师修正路径。

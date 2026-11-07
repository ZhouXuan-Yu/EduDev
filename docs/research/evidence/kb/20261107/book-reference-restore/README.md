# M05 同源答案引用恢复，2026-11-07

教师曾将题册与答案册关联、完成归档，再解绑并重新关联相同两份原件，旧题目的完整来源及已知答案会因配对revision变化拒绝读取。本轮修复这条实际操作路径。完整知识库Goal保持ACTIVE，KB-A01～A10仍OPEN。

## 实现与范围

- `material-ai-book-reference.ts`复用现有`sameMaterialBookIdentity`。新显式授权可选用相同双原件身份的旧答案回执，冻结记录仍绑定当前revision。
- `readArchivedBookReferenceRecord`仅在宿主已认证发表回执后读取SQLite原引用，核对context/source/final摘要，再允许历史只读的当前活动配对仅revision不同。`MaterialAiRepository.pageEvidence`使用此入口。
- live来源选择、beforeSend、未发表恢复、publish仍严格检查revision；不把旧授权变成新授权。换原件、取消关联、版本变化、缺本批授权、索引变化、来源篡改继续拒绝。
- 无新依赖、DDL、IPC或服务；不改原题、教师编辑、OCR/模型回执、已知答案及旧冲突状态。无模型重发，无自然书资料上传。

## 先失败后修复

1. SQLite边界在当前授权revision从1升为2后，复用同源旧答案回执失败：`boundary-before.log`，进程exit1。
2. 首次Electron脚本没有等待资料搜索防抖结果，count0断言失败，尚未解绑：`ui-harness-before.json/log`。保留为测试脚本失败，不算产品缺陷。增加精确控件等待后继续原数据，无重新导入或模型重发。
3. 旧构建`1e3ab981...`真实界面解绑/重联revision1→3，解绑正确拒绝，重联仍打不开原来源：`ui-product-before.json/log`，exit1。题目/引用/模型事实指纹与旧调用账本均不变。
4. 最终构建`93e1f362...`在同一既有受控PDF数据根真实解绑/重联revision3→5，通过原题本来源/已知答案面板、1366×768与1920×1080及冷启动3组。`ui-after.json/log`、四张截图。题目/引用/模型事实及原始PDF均不变，renderer错误0，provider请求0，既有8调用账本未追加。

## 精确验证

以下从`apps/desktop`运行，临时根为既有受控题册/答案册测试目录`%TEMP%/omni-book-reference-ui-0tt7sv`，不是正式用户数据。旧真实书仅作只读像素诊断。

| 命令 | 本轮结果 | 证据 |
| --- | --- | --- |
| `npx tsc --noEmit` | exit0 | typecheck.log（空日志即无诊断） |
| `npm run build` | exit0 | build.log |
| `npm run test:renderer-components` | 246/246，exit0 | components.log |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 页归档245、配答34、最终引用34（原19+新增15），exit0；不将重复导入的套件累加 | boundaries.log |
| `node --experimental-transform-types scripts/education/kb-book-reference-restore-journey.mjs "$env:TEMP\omni-book-reference-ui-0tt7sv"` | 3组，exit0 | ui-after.json/log |
| `node scripts/electron-smoke.mjs` | 207/207，exit0，同一冻结构建 | electron.log |
| `npm audit --json` | 完整JSON报告：28项，8high/12moderate/8low，0critical；未宣称安全门禁全绿 | audit.json |
| `git diff --check` | 收尾记录 | 无输出表示通过 |

新增15组覆盖相同双原件、live严格门禁、已发表证明、final/context/source摘要、缺引用行、缺final tag、解绑、双原件ID/版本、授权目录、取消与回退开关。其余原边界继续覆盖证据/隐私/最新索引/请求内容等。当前没有新增依赖，未为此修复擅自升级整个依赖树；audit shell句柄未取回，不额外声称其exit码。

## 性能、数据与回滚

修复前main为4,330,136B，修复后4,330,868B（+732B），preload40,997B及renderer主包7,920,365B字节不变；本片只读同一条有界引用，没有新后台扫描。`frozen-before.json`记录最终构建开测前摘要，`frozen-after.json`在全部最终验证后复核。此处不代表大库P95/吞吐/内存通过，未采集其前后数据。

`OMNI_EDU_BOOK_REFERENCE_RESTORE=0`恢复旧严格revision策略，不写数据；同源重联的历史来源可能再次打不开。重新启用即可恢复，无需重发模型。可回退本片两个生产源文件；旧二进制整体降级未验收。

## 尚未解决与下一步

- 对上一轮自然批次第2题裁图已核对像素/SHA：末行括号被截，邻近二维码在上部约束整个矩形。第5题有几何背景水印触底，但不能解释全部来源完整性问题。`crop-diagnosis.json`只存坐标/摘要/发现；未提交自然原图或题文。未放宽边缘/颜色阈值，未按该书修题。
- 下一应实现通用图文区域归属与安全裁图恢复，保留原图、来源和教师校正。并核查已知答案与最终稿不一致时，publish事务和异步配答之间是否存在状态窗口；这目前仅为待证假设，不能当已确认缺陷。
- 上一轮自然批12题归档/10完整文档/8可用稿/4待核属于旧证据，本轮未增加自然质量通过数。独立逐字、数学、120题留出、200查询、三套正式蓝图、真实10→40GiB/72h、普通Windows安装与异机移植均未通过完整验收。

# 整题正文与本地 OCR 核对

本轮在 `634b276f08edfb1cf048051e9ce9ac8b42e752bb` 上实现 M02/M03/M05 的新归档策略。只核对首尾24字会同时造成误拦截和漏检：自然物理卷7/8题因为括号、填空线和汉文标点一直待核；9题首尾通过，中间仍有实字分歧，且此前还发现独立的物理解析矛盾。

复用现有布局块、归属裁剪、RapidOCR、版本化输入、三遍整理、原发布器、来源读器和教师题本/Pi，不引入数据库、服务、Agent、依赖或额外模型轮次。新标准/质量任务冻结 `cropTextPolicy=body-concordance.v1`；legacy须显式开启 `OMNI_EDU_AI_CROP_BODY_TEXT=1`。无字段的历史收据保持旧语义。

正文组须整题逐字对应；仅归一明确的全半角括号/汉文标点、空白、已知父题号和非变量填空线，采用NFC，保留指数、下标、数字、单位、负号、字母及实字。独立布局图像/图表/图题组不拼进正文，但图片、原OCR及图义门禁保留；混合图文组必须全部核对。纯文字题也必须通过裁剪核对，不能绕用两遍AI原文认证。无模糊编辑距离/相似度阈值。

## 实际结果

- 真实教师入口对原独立物理卷第2–3页创建新任务；使用原来保存的6条DeepSeek HTTP响应逐字回放，实际重跑本地布局/裁剪/OCR，未新增云请求。6条回放不等于6次真实模型调用，也不能证明当前provider质量。
- 新7/8题成为 `ai_final`，各保留6张归属来源裁剪；新6/9题实字不一致仍待核，10/11题仍有原有图文/页疑点。没有改原输入、付费响应或旧规范题。
- 原图在1366×768和1920×1080真实内容尺寸可读，无横向溢出；暖/冷启动的Pi `getQuestionContextSource` 均接受两道新规范题；待核题显示暂不用于组卷。新任务的SQLite事实与文档冷读一致，原付费单元/题目指纹不变，renderer错误0。
- 首次界面断言在异步图片挂载前数图，失败 `0 !== 6`；增加 `waitFor` 后直接对同一批次零模型复读通过，未再导入/识别。此前脚本路径、Node静态加载器及“中段反例实际落在首24字内”的夹具错误没有作为产品失败或成功率样本。现存失败日志保留。
- 新21项边界、原112项页归档、5项文字来源裁剪、12项目录策略、246组件及最终build/typecheck通过。最终冻结构建共享Electron207/207通过，所有本轮命令已结束；未重跑无UI改动的UI合同，上一轮受保护输入框指纹失败仍是历史未解决项。

## 性能与限制

四道保留自然题一组，共1000组同步热测，组耗时除以4后：旧首尾检查P95约0.0092ms/题，新整题正文检查约0.0221ms/题；这不是逐题延迟分布。只含内存字符串核对，排除原件认证、SQLite、IPC、OCR和模型；不能当作40GiB或检索延迟达标。主进程4043516→4047139字节（+3623），preload38520与renderer入口7758791不变，指纹见 `performance.json`。

本轮audit42项（8高、26中、8低、0严重），依赖/锁文件未改。本片不解决OCR实字纠错和图义的全部正确性，也未接入导入题的独立科学解题核验。旧自然9题的解析矛盾保留；新9题仅因正文不一致被拦截，不得把这次拦截冒称物理推理校验通过。历史旧策略不会自动回溯隔离错误答案。

完整Goal与KB-A01～A10继续OPEN。下一优先把已知答案册/网页证据与现有数学/物理工具接入归档质量验证，再推进自然120题留出、200查询、蓝图正式成品、10→40GiB长稳及普通Windows安装换机。不得逐页手改验收书或用重复AI一致替代独立正确性。

## 复现与证据边界

工作目录 `C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject\apps\desktop`：

```powershell
npm run build
node --experimental-transform-types scripts/education/kb-crop-body-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-text-source-crops-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
npm run test:renderer-components
npm audit --json
node scripts/electron-smoke.mjs
```

首次自然回放：`node scripts/education/kb-crop-body-journey.mjs <owned-root> <six-page-manifest> <retained-six-response-run>`；最终同批次只读：

```powershell
node --experimental-transform-types scripts/education/kb-crop-body-journey.mjs "$env:TEMP\omni-real-material-aWObCn" "$env:TEMP\omni-real-material-aWObCn\whole-exam-aHo7lv" "$env:TEMP\omni-real-material-aWObCn\continuation-text-real-JFIOM2" "$env:TEMP\omni-real-material-aWObCn\body-concordance-6JWKUe"
```

本轮没有上传原PDF、自然试题文字/图片、HTTP请求/响应、数据库或凭证。真实截图和完整报告留在上述本地目录；提交的 `journey-summary.json` 仅含状态、检查结果和私有文件SHA。`source-frozen.json` 固定本片源码/脚本；最后脚本仅补只读报告的batchId字段，主进程构建未变。

回滚：`OMNI_EDU_AI_CROP_BODY_TEXT=0` 仅停止新任务启用；保留新字段读器、现有SQLite/文件和旧付费收据。不得删除新字段以把存量严格任务降为旧首尾规则。无业务迁移；完整代码回退须保留此兼容读器。

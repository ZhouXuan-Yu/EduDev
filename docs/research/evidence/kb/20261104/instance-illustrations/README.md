# 本卷编辑复用独立题图：实现与验收

教师从默认目录导入生成的图题进入题篮，无需先改全局题干，即可编辑本卷正文、移动或补回独立题图。保存后的显示、预览及Word生成使用同一版本、同一图片。原题与答案册事实保持原值。

## 修复的实际问题

- 原编辑器把整题、答案截图也当作题面图片引用，而主进程拒绝所有引用；现只从已验证冻结裁图证明选择独立题图。
- 图片块原先只有占位说明；现按块顺序显示、保留失败输入并支持重读，一个角色一次gallery读取。
- 逐题核对之外，整卷确认和待确认快照也等待当前修订的全部题图成功显示。换版本、内容摘要或重试均使旧就绪状态失效。
- 漏掉必需插图、重复、答案角色、整页正文、混合续页、旧版本及伪造证明仍不能正式交付。

## 当前证据

| 检查 | 结果和边界 |
| --- | --- |
| 实际目录导入与本卷编辑 | 10项；本地PDF/OCR/版面/切图和题答配对，删图受阻、补图、移位、确认快照、双尺寸及冷启 |
| main整合后实际冷读 | 新增1项；同一保存卷、来源/Pi、双尺寸、学生/教师DOCX；新增模型调用0 |
| 新组件 | 10项；多图一次读取、逐图加载、失败/重试、旧回包、整卷确认门闩及补回图片 |
| 新边界 | 7项；严格证明、来源绑定、必要图完整性、旧格式、实际学生/教师DOCX图顺序和媒体SHA |
| 来源归档 | 112项，包含重新推导证明拒绝整页图伪装、旧文档无迁移/重放兼容；另有续页、书册等专项日志 |
| 构建/常规组件/实例交付 | 整合后build、246组件、17实例与实际Office事务检查通过 |
| 共享桌面回归 | 最终整合冻结构建207/207通过；整合前207/207证据单独保存，精确哈希见manifest |
| 依赖审计 | 首次网络中断；重试得到既有42项（8高/26中/8低，0严重），无新依赖 |

仅使用自建受控PDF与5条受控响应，外部云请求0。`initial-report.json`保留首次10项结果，`report.json`保留整合后的累计11项，未重发模型。Word媒体SHA与归档独立图一致，学生卷不含答案/解析。截图与四份DOCX均为自建合成资料。

实际DOCX通过生产编译器/生成器读取**生产UI已确认快照**后生成并解包核对；本例尚未经过Composer的导出审批与最终安装事务，也未验证PDF及Office/WPS显示。不能据此关闭KB-A06，更不能代替自然题库、200查询召回、40GiB长稳或独立Windows安装换机验收。KB-A01～A10仍OPEN。

## 重现命令

在本工作树`apps/desktop`执行，使用现有Node 24解析钩子，无新增tsx依赖：

```powershell
npm run build
npm run test:renderer-components
node scripts/paper-instance-illustrations-test.mjs
node scripts/paper-instance-options-images-test.mjs
node scripts/paper-instance-ui-test.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/paper-instance-illustrations-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/paper-instance-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-text-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-critical-archive-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-figure-crops-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-text-presentation-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --folder-pairs --figure-crops --instance-illustrations
# 上条创建的已成功、原地保留夹具；只读回实际UI与产物，不复制profile/资料根：
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:/Users/ZhouXuan/AppData/Local/Temp/omni-folder-books-EdO10x --figure-crops --allow-build-change --instance-illustrations-readback
node scripts/electron-smoke.mjs
npm audit --registry=https://registry.npmjs.org --fetch-retries=2 --fetch-timeout=30000 --json
```

## 保留的失败与限制

首次命令错误地假定安装了tsx，随后未在解析导入前注册Node钩子、缺少transform-types，均在测试装载阶段退出。首个DOCX断言把ZIP目录项也纳入媒体哈希，改为只核对媒体文件后通过，仍逐字节核对原图SHA。日志及首次失败报告保留。

额外调用B04教案专项脚本未提供其必需的专属fixture，在前置条件退出，记为NOT_RUN，不作为教案产品失败或验收通过；未操作协作者fixture。原B04源码和记录随main整合保留。

新证明是版本化可选字段，旧文件保持可读。现有历史图题可通过原题重新保存获得证明，本轮不批量迁移或重放旧付费任务。回滚时保留新格式读器和所有原图/事实/账本，再停用新证明生成；不得直接降级至不识别该字段的旧二进制。

包体对比：本轮自身相对1e033fb主进程增加2961B、renderer入口增加8660B，preload不变；B04整合增量单列manifest。单角色最多8图并复用原资产读取边界；这是有界读取设计证据，不是检索延迟、内存峰值或40GiB性能结论。

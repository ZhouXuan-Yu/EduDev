# 续页独立插图：实现与验收证据

新page-fragments.v3输入冻结continuationCropPolicy=layout-subcrops.v1，复用原归属分组、QuestionAssets、gallery、Pi与Office。跨页正文和可安全分离的插图可分别归档，随后在本卷编辑中保留、移动和补回；两页共用最多8图，禁止丢块或混入下一题。旧输入继续整图及原SHA语义。纯图/空标注的极窄下划线OCR规则与遗留章节问题见[批判复核](review.md)。

具体结果和源码/构建/证据指纹见[manifest](manifest.json)。本目录局部Git属性保留采集字节，避免换行转换导致证据SHA失配；源码及构建指纹对应本次Windows运行现场。新边界9项、归档112、跨页12、续页文字10、原题图6、题面表示7及组件246通过；这些套件有重叠，不加总为独立用例数。真实软件目录导入、两页PDF本地OCR/版面、答案册关联、本卷编辑、确认与冷启动累计11项，整合B06后冷读/Pi/双尺寸/实际DOCX新增1项，累计12项通过。成功导入8条受控响应，云请求0；恢复验收及整合冷读新增调用0，renderer错误0。

学生/教师DOCX使用生产UI已确认快照及实际归档图生成；ZIP媒体SHA与续页原图相同，学生正文不含答案解析。未跑本例Composer导出审批、PDF或Office/WPS视觉开卷，不关闭A06。第2题已ai_final但答案匹配held/missing_section，属于下一切片，不能声称整本书配答已完成。自然准确性、200查询召回、40GiB长稳和Windows安装/移植均未验收，KB-A01～A10继续OPEN。

整合B06后的同一冻结构建，共享桌面回归207/207通过，命令exit 0；所有本轮命令均已结束，见integrated-smoke日志。构建、组件或正常Git推送均不能替代产品验收。

## 精确命令

工作目录为本工作树apps/desktop。每条命令分别运行并收集终态；未使用真实账户、API Key或上传用户资料。

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-text-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-figure-crops-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-text-presentation-boundaries.mjs
npm audit --omit=dev --json
```

真实目录由应用生成三层子目录内的两页试题PDF和一页答案PDF，从可见目录导入/批次授权/书册关联开始；仅控制模型transport响应，实际parser/OCR/layout/crops/SQLite/typed IPC/UI均为生产路径：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --folder-pairs --figure-crops --continuation-figures --instance-illustrations
```

成功导入保留在临时目录omni-folder-books-k4nSHM。首次本卷验收因多行搜索等待条件失败；后续恢复遇到相同模板无须保存、以及小问块在图前的脚本假设，失败日志全部保留。修复脚本后只恢复该已归档现场，未重新导入或请求模型：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-k4nSHM --figure-crops --continuation-figures --instance-illustrations --continue-instance-illustrations
```

整合origin/main 72705e9后重新build/246组件，并在新构建禁止模型请求的冷读路径复核原题、Pi、本卷、正式快照与两份实际DOCX：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-k4nSHM --figure-crops --continuation-figures --allow-build-change --instance-illustrations-readback
node scripts/electron-smoke.mjs
```

最后一条是npm run test:smoke中build后的原共享入口，前置已完成相同npm run build，避免再次改动冻结构建。仓库收尾另运行git diff --check。

## 资源与回滚

最大几何微测为每页256检测块、选32块，两页共64块，12次：旧整图方案中位2.72ms，新分图方案5.94ms、最大8.68ms。新功能增加有界计算；复用每页一次规划后，比早期重复规划32.80ms下降，不能据此声称检索或全库吞吐提升。整合主进程4016612B，相对ca45b2b的4012300B增加4312B，包含本片与B06的合计；preload38520B与renderer入口7757761B不变。模型轮次未增加，但复核时需保留授权原前缀以及局部图，会增加同页图片字节；各图仍4MiB以内、裁图总16MiB、整题8图，原前缀另作有界读取。

本次production-only audit共29项（8高/13中/8低/0严重），exit 1；与上一轮全依赖42项口径不同，不能声称修复漏洞。无新依赖或lockfile变化。

可停止新输入策略生成但保留读器，不删源文件、教师事实、旧资产或回执，不重放已付费调用，无破坏性迁移。二进制降级未演练。证据只包含生成的受控资料、截图、DOCX、报告和日志，不含数据库、profile、凭证或用户原书。
